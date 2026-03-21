import { config } from './config.js';
import type { LogEntry } from '../src/types.js';

const entries: LogEntry[] = [];

export function addLog(entry: LogEntry): void {
  entries.push(entry);
  if (entries.length > config.logBufferSize * 1.5) {
    entries.splice(0, entries.length - config.logBufferSize);
  }
}

export function getRecentLogs(limit?: number): readonly LogEntry[] {
  if (limit) {
    return entries.slice(-limit);
  }
  return entries.slice();
}
