import type http from 'node:http';
import type { LogCollector } from './log-collector.js';
import { getRecentLogs } from './log-store.js';
import type { LogEntry } from '../src/types.js';

const HEARTBEAT_INTERVAL_MS = 15_000;

export function handleLogStream(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  collector: LogCollector,
): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Send buffered logs as initial batch
  const recent = getRecentLogs();
  res.write(`event: init\ndata: ${JSON.stringify(recent)}\n\n`);

  // Stream new logs
  const onLog = (entry: LogEntry): void => {
    res.write(`event: log\ndata: ${JSON.stringify(entry)}\n\n`);
  };
  collector.on('log', onLog);

  // Keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, HEARTBEAT_INTERVAL_MS);

  // Cleanup on disconnect
  req.on('close', () => {
    collector.off('log', onLog);
    clearInterval(heartbeat);
  });
}
