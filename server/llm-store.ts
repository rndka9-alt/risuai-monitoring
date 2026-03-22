import type { StreamEntry, StreamsSnapshot } from '../src/types.js';

const MAX_RECENT = 10;
const MAX_IMAGES_PER_REQUEST = 5;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

interface StreamImage {
  mediaType: string;
  data: string; // base64
  isOutput?: boolean;
}

const activeStreams = new Map<string, StreamEntry>();
const recentStreams: StreamEntry[] = [];
/** streamId → images */
const streamImages = new Map<string, StreamImage[]>();
/** streamId → { contentType, base64 } */
const streamResponseBodies = new Map<string, { contentType: string; base64: string }>();

import { inflateRawSync } from 'node:zlib';

const BASE64_RE = /data:[^;]*;base64,[A-Za-z0-9+/=]{100,}/g;

function sanitizeBase64(text: string): string {
  return text.replace(BASE64_RE, (match) => {
    const sizeKB = Math.round(match.length * 0.75 / 1024);
    const mediaMatch = match.match(/^data:([^;]*)/);
    const mediaType = mediaMatch ? mediaMatch[1] : 'unknown';
    return `[${mediaType}, ${sizeKB}KB]`;
  });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseRequestBody(raw: string): {
  model: string;
  messageCount: number;
  imageCount: number;
  images: StreamImage[];
} {
  let model = 'unknown';
  let messageCount = 0;
  let imageCount = 0;
  const images: StreamImage[] = [];

  try {
    const obj: unknown = JSON.parse(raw);
    if (!isRecord(obj)) return { model, messageCount, imageCount, images };

    if (typeof obj.model === 'string') model = obj.model;

    if (Array.isArray(obj.messages)) {
      messageCount = obj.messages.length;
      for (const msg of obj.messages) {
        if (!isRecord(msg)) continue;
        if (!Array.isArray(msg.content)) continue;

        for (const part of msg.content) {
          if (!isRecord(part)) continue;

          // OpenAI format: {type: "image_url", image_url: {url: "data:...;base64,..."}}
          if (part.type === 'image_url' && isRecord(part.image_url)) {
            imageCount++;
            const url = String(part.image_url.url ?? '');
            const match = url.match(/^data:([^;]+);base64,(.+)/);
            if (match && images.length < MAX_IMAGES_PER_REQUEST) {
              const dataLen = match[2].length * 0.75;
              if (dataLen <= MAX_IMAGE_BYTES) {
                images.push({ mediaType: match[1], data: match[2] });
              }
            }
          }

          // Anthropic format: {type: "image", source: {type: "base64", media_type: "...", data: "..."}}
          if (part.type === 'image' && isRecord(part.source) && part.source.type === 'base64') {
            imageCount++;
            const data = String(part.source.data ?? '');
            if (data && images.length < MAX_IMAGES_PER_REQUEST) {
              const dataLen = data.length * 0.75;
              if (dataLen <= MAX_IMAGE_BYTES) {
                images.push({
                  mediaType: String(part.source.media_type ?? 'image/png'),
                  data,
                });
              }
            }
          }
        }
      }
    }
  } catch {
    // not JSON
  }

  return { model, messageCount, imageCount, images };
}

export function handleLlmEvent(event: Record<string, unknown>): void {
  const type = String(event.type ?? '');
  const id = String(event.streamId ?? '');

  if (!id) return;

  if (type === 'start') {
    const rawBody = String(event.requestBody ?? '');
    const { model, messageCount, imageCount, images } = parseRequestBody(rawBody);

    if (images.length > 0) {
      streamImages.set(id, images);
    }

    activeStreams.set(id, {
      id,
      senderClientId: String(event.sender ?? ''),
      targetCharId: typeof event.targetCharId === 'string' ? event.targetCharId : null,
      status: 'streaming',
      textLength: 0,
      createdAt: Number(event.timestamp) || Date.now(),
      elapsedMs: 0,
      targetUrl: String(event.targetUrl ?? ''),
      model,
      requestBody: rawBody,
      messageCount,
      imageCount,
      outputPreview: '',
      completedAt: null,
    });
    return;
  }

  if (type === 'end') {
    const active = activeStreams.get(id);
    activeStreams.delete(id);

    const hasError = typeof event.error === 'string' && event.error.length > 0;
    const isCached = event.responseType === 'cache';
    const status = hasError ? 'failed' : isCached ? 'cached' : 'completed';

    const completed: StreamEntry = active
      ? {
          ...active,
          status,
          elapsedMs: Number(event.duration) || 0,
          textLength: Number(event.textLength) || 0,
          outputPreview: String(event.outputPreview ?? ''),
          completedAt: Date.now(),
        }
      : {
          id,
          senderClientId: '',
          targetCharId: null,
          status,
          textLength: Number(event.textLength) || 0,
          createdAt: Date.now() - (Number(event.duration) || 0),
          elapsedMs: Number(event.duration) || 0,
          targetUrl: '',
          model: 'unknown',
          requestBody: '',
          messageCount: 0,
          imageCount: 0,
          outputPreview: String(event.outputPreview ?? ''),
          completedAt: Date.now(),
        };

    // 응답 바이너리에서 이미지 추출 + response body 저장
    if (typeof event.responseBody === 'string' && event.responseBody.length > 0) {
      const contentType = String(event.responseContentType ?? '');

      streamResponseBodies.set(id, { contentType, base64: event.responseBody });

      const outputImages = extractOutputImages(event.responseBody, contentType);
      if (outputImages.length > 0) {
        const existing = streamImages.get(id) ?? [];
        existing.push(...outputImages);
        streamImages.set(id, existing);
      }
    }

    recentStreams.unshift(completed);
    if (recentStreams.length > MAX_RECENT) {
      // 오래된 항목의 이미지·responseBody도 정리
      const removed = recentStreams.splice(MAX_RECENT);
      for (const r of removed) {
        streamImages.delete(r.id);
        streamResponseBodies.delete(r.id);
      }
    }
  }
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

function mediaTypeFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/png';
}

/**
 * ZIP 파일에서 이미지 추출 (Store method only, no compression or Deflate)
 */
/**
 * Central Directory에서 파일 정보를 읽어 이미지 추출.
 * Local file header의 compressedSize가 0인 경우(data descriptor 방식)에도 동작.
 */
function extractImagesFromZip(buf: Buffer): StreamImage[] {
  const images: StreamImage[] = [];

  // End of Central Directory record (EOCD) 찾기 — 뒤에서 검색
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return images;

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const cdEntries = buf.readUInt16LE(eocdOffset + 10);

  let offset = cdOffset;
  for (let i = 0; i < cdEntries && offset + 46 <= buf.length; i++) {
    // Central Directory file header: 0x02014b50
    if (buf.readUInt32LE(offset) !== 0x02014b50) break;

    const compressionMethod = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);

    const fileName = buf.subarray(offset + 46, offset + 46 + nameLen).toString('utf-8');
    const isImage = IMAGE_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext));

    if (isImage && compressedSize > 0) {
      // Local file header에서 data 시작점 계산
      const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;

      try {
        let fileData: Buffer;
        if (compressionMethod === 0) {
          fileData = buf.subarray(dataStart, dataStart + compressedSize);
        } else if (compressionMethod === 8) {
          fileData = inflateRawSync(buf.subarray(dataStart, dataStart + compressedSize));
        } else {
          offset += 46 + nameLen + extraLen + commentLen;
          continue;
        }

        if (fileData.length > 0 && fileData.length <= MAX_IMAGE_BYTES) {
          images.push({
            mediaType: mediaTypeFromFilename(fileName),
            data: fileData.toString('base64'),
            isOutput: true,
          });
        }
      } catch {
        // skip corrupt entry
      }
    }

    offset += 46 + nameLen + extraLen + commentLen;
    if (images.length >= MAX_IMAGES_PER_REQUEST) break;
  }

  return images;
}

function extractOutputImages(responseBodyBase64: string, contentType: string): StreamImage[] {
  try {
    const buf = Buffer.from(responseBodyBase64, 'base64');

    // 직접 이미지 응답 (image/png 등)
    if (contentType.startsWith('image/')) {
      if (buf.length <= MAX_IMAGE_BYTES) {
        return [{ mediaType: contentType.split(';')[0], data: responseBodyBase64, isOutput: true }];
      }
      return [];
    }

    // ZIP 응답 (NAI 등)
    if (contentType.includes('zip') || contentType.includes('octet-stream')) {
      if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4B) {
        return extractImagesFromZip(buf);
      }
    }
  } catch {
    // ignore
  }
  return [];
}

/** API 응답용: base64를 placeholder로 치환 */
export function getStreams(): StreamsSnapshot {
  const now = Date.now();

  const active = Array.from(activeStreams.values()).map((s) => ({
    ...s,
    elapsedMs: now - s.createdAt,
    requestBody: sanitizeBase64(s.requestBody),
  }));

  const recent = recentStreams.map((s) => ({
    ...s,
    requestBody: sanitizeBase64(s.requestBody),
  }));

  return { active, recent, total: active.length };
}

/** 특정 스트림의 이미지 반환 */
export function getStreamImages(streamId: string): StreamImage[] {
  return streamImages.get(streamId) ?? [];
}

/** 특정 스트림의 response body 반환 */
export function getStreamResponseBody(streamId: string): { contentType: string; body: string } | null {
  const entry = streamResponseBodies.get(streamId);
  if (!entry) return null;
  const buf = Buffer.from(entry.base64, 'base64');
  return { contentType: entry.contentType, body: buf.toString('utf-8') };
}
