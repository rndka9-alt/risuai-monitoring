import type { StreamEntry, StreamsSnapshot } from '../src/types.js';

const MAX_RECENT = 10;

const activeStreams = new Map<string, StreamEntry>();
const recentStreams: StreamEntry[] = [];

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
} {
  let model = 'unknown';
  let messageCount = 0;
  let imageCount = 0;

  try {
    const obj: unknown = JSON.parse(raw);
    if (!isRecord(obj)) return { model, messageCount, imageCount };

    if (typeof obj.model === 'string') model = obj.model;

    if (Array.isArray(obj.messages)) {
      messageCount = obj.messages.length;
      for (const msg of obj.messages) {
        if (!isRecord(msg)) continue;
        if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (isRecord(part) && (part.type === 'image' || part.type === 'image_url')) {
              imageCount++;
            }
          }
        }
      }
    }
  } catch {
    // not JSON
  }

  return { model, messageCount, imageCount };
}

export function handleLlmEvent(event: Record<string, unknown>): void {
  const type = String(event.type ?? '');
  const id = String(event.streamId ?? '');

  if (!id) return;

  if (type === 'start') {
    const rawBody = String(event.requestBody ?? '');
    const { model, messageCount, imageCount } = parseRequestBody(rawBody);

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
    const status = hasError ? 'failed' : 'completed';

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

    recentStreams.unshift(completed);
    if (recentStreams.length > MAX_RECENT) {
      recentStreams.length = MAX_RECENT;
    }
  }
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
