import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { logger } from './logger.js';
import { LogCollector } from './log-collector.js';
import { addLog, getRecentLogs } from './log-store.js';
import { handleLogStream } from './sse.js';

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

  if (url.pathname.startsWith('/api/')) {
    handleApi(url, req, res);
    return;
  }

  serveStatic(url.pathname, res);
});

function handleApi(
  url: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
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

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(logs));
    return;
  }

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
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
});
