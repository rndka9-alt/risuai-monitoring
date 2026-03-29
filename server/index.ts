import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { logger } from './logger.js';
import { LogCollector } from './log-collector.js';
import { addLog, getRecentLogs } from './log-store.js';
import { handleLogStream } from './sse.js';
import { startHealthPoller, getHealth, getResources, parseResourceBucket } from './health-poller.js';
import { startMetricsAggregator, getMetrics, parseBucketSize } from './metrics-aggregator.js';
import { handleLlmEvent, getStreams, getStreamImages, getStreamResponseBody, streamEvents } from './llm-store.js';

const DIST_CLIENT = path.join(import.meta.dirname, 'client');

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const collector = new LogCollector();
collector.on('log', (entry) => addLog(entry));

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost`);

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_api/')) {
    handleApi(url, req, res);
    return;
  }

  serveStatic(url.pathname, res);
});

function sendJson(res: http.ServerResponse, data: unknown): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: string) => (body += chunk));
    req.on('end', () => resolve(body));
  });
}

function handleApi(
  url: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  // Push endpoint from sync → monitor
  if (url.pathname === '/_api/llm-event' && req.method === 'POST') {
    readRequestBody(req).then((body) => {
      try {
        const event: unknown = JSON.parse(body);
        if (typeof event === 'object' && event !== null && !Array.isArray(event)) {
          handleLlmEvent(event);
        }
      } catch {
        // ignore malformed
      }
      res.writeHead(200);
      res.end('ok');
    });
    return;
  }

  if (url.pathname === '/api/logs/stream') {
    handleLogStream(req, res, collector);
    return;
  }

  if (url.pathname === '/api/logs') {
    const proxy = url.searchParams.get('proxy');
    const level = url.searchParams.get('level');
    const limit = Number(url.searchParams.get('limit')) || 200;

    let logs = getRecentLogs(limit);

    if (proxy) {
      logs = logs.filter((l) => l.proxy === proxy);
    }
    if (level) {
      logs = logs.filter((l) => l.level === level);
    }

    sendJson(res, logs);
    return;
  }

  if (url.pathname === '/api/health') {
    sendJson(res, getHealth());
    return;
  }

  if (url.pathname === '/api/streams') {
    sendJson(res, getStreams());
    return;
  }

  if (url.pathname === '/api/streams/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const onChange = (): void => { res.write('event: change\ndata: \n\n'); };
    streamEvents.on('change', onChange);
    const heartbeat = setInterval(() => { res.write(': heartbeat\n\n'); }, 15_000);
    req.on('close', () => {
      streamEvents.off('change', onChange);
      clearInterval(heartbeat);
    });
    return;
  }

  const imagesMatch = url.pathname.match(/^\/api\/streams\/([^/]+)\/images$/);
  if (imagesMatch) {
    sendJson(res, getStreamImages(imagesMatch[1]));
    return;
  }

  const responseBodyMatch = url.pathname.match(/^\/api\/streams\/([^/]+)\/response-body$/);
  if (responseBodyMatch) {
    const result = getStreamResponseBody(responseBodyMatch[1]);
    sendJson(res, result ?? { contentType: '', body: '' });
    return;
  }

  const abortMatch = url.pathname.match(/^\/api\/streams\/([^/]+)\/abort$/);
  if (abortMatch && req.method === 'POST') {
    const streamId = abortMatch[1];
    if (!config.syncUrl) {
      res.writeHead(501, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'SYNC_URL not configured' }));
      return;
    }
    const syncTarget = `${config.syncUrl}/_internal/stream/${encodeURIComponent(streamId)}/abort`;
    fetch(syncTarget, { method: 'POST' })
      .then(async (syncRes) => {
        const body = await syncRes.text();
        res.writeHead(syncRes.status, { 'Content-Type': 'application/json' });
        res.end(body);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'unknown error';
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      });
    return;
  }

  if (url.pathname === '/api/searchbar/index') {
    fetch('http://setting-searchbar:3004/setting-searchbar/index')
      .then(async (upstream) => {
        const body = await upstream.text();
        res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
        res.end(body);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'unknown error';
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      });
    return;
  }

  if (url.pathname === '/api/metrics') {
    const bucketMs = parseBucketSize(url.searchParams.get('bucket'));
    sendJson(res, getMetrics(bucketMs));
    return;
  }

  if (url.pathname === '/api/resources') {
    const bucketMs = parseResourceBucket(url.searchParams.get('bucket'));
    sendJson(res, getResources(bucketMs));
    return;
  }

  // --- with-sqlite /_internal/* proxy ---
  // /api/sqlite/*  → /_internal/sql/*
  // /api/sync/*    → /_internal/sync/*
  const sqliteMatch = url.pathname.startsWith('/api/sqlite/') && config.sqliteUrl;
  const syncMatch = url.pathname.startsWith('/api/sync/') && config.sqliteUrl;
  if (sqliteMatch || syncMatch) {
    const target = sqliteMatch
      ? `${config.sqliteUrl}/_internal/sql/${url.pathname.replace('/api/sqlite/', '')}`
      : `${config.sqliteUrl}/_internal/sync/${url.pathname.replace('/api/sync/', '')}`;

    if (req.method === 'POST') {
      readRequestBody(req).then((body) => {
        fetch(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
          .then(async (upstream) => {
            const text = await upstream.text();
            res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
            res.end(text);
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'unknown error';
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: message }));
          });
      });
    } else {
      fetch(target)
        .then(async (upstream) => {
          const text = await upstream.text();
          res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
          res.end(text);
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'unknown error';
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        });
    }
    return;
  }

  // --- remote-inlay proxy ---
  if (url.pathname === '/api/inlay/assets' && config.remoteInlayUrl) {
    fetch(`${config.remoteInlayUrl}/remote-inlay/assets`)
      .then(async (upstream) => {
        const body = await upstream.text();
        res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
        res.end(body);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'unknown error';
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      });
    return;
  }

  const inlayAssetMatch = url.pathname.match(/^\/api\/inlay\/assets\/(.+)$/);
  if (inlayAssetMatch && config.remoteInlayUrl) {
    const assetId = inlayAssetMatch[1];
    fetch(`${config.remoteInlayUrl}/remote-inlay/assets/${encodeURIComponent(assetId)}`)
      .then(async (upstream) => {
        if (upstream.status !== 200) {
          res.writeHead(upstream.status);
          res.end();
          return;
        }
        const buffer = Buffer.from(await upstream.arrayBuffer());
        const ext = upstream.headers.get('x-inlay-ext') ?? 'png';
        const mimeMap: Record<string, string> = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          webp: 'image/webp',
          gif: 'image/gif',
        };
        res.writeHead(200, {
          'Content-Type': mimeMap[ext] ?? 'application/octet-stream',
          'Content-Length': String(buffer.length),
          'x-inlay-ext': ext,
          'x-inlay-type': upstream.headers.get('x-inlay-type') ?? 'image',
          'x-inlay-width': upstream.headers.get('x-inlay-width') ?? '0',
          'x-inlay-height': upstream.headers.get('x-inlay-height') ?? '0',
          'x-inlay-name': upstream.headers.get('x-inlay-name') ?? '',
          'Cache-Control': 'public, max-age=86400',
        });
        res.end(buffer);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'unknown error';
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
}

function serveStatic(pathname: string, res: http.ServerResponse) {
  let filePath = path.join(DIST_CLIENT, pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_CLIENT, 'index.html');
  }

  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

server.listen(config.port, () => {
  logger.info(`Server listening on :${config.port}`);
  collector.start();
  startMetricsAggregator(collector);
  startHealthPoller();
});
