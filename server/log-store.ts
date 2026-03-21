import type { LogEntry } from '../src/types.js';

const MAX_ENTRIES = 1000;
const TRIM_THRESHOLD = 1500;

const entries: LogEntry[] = [];

export function addLog(entry: LogEntry): void {
  entries.push(entry);
  if (entries.length > TRIM_THRESHOLD) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
}

export function getRecentLogs(limit?: number): readonly LogEntry[] {
  if (limit) {
    return entries.slice(-limit);
  }
  return entries.slice();
}
