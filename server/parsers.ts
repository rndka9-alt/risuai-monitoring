import type { LogLevel, ProxyName } from '../src/types.js';

export interface ParseResult {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

function isLogLevel(value: string): value is LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const SYNC_RE = /^\[Sync\]\s+\[(\w+)\]\s+(.+)$/;
const DB_PROXY_RE = /^\[DB-Proxy\]\s+\[(\w+)\]\s+(.+)$/;
const REMOTE_INLAY_RE = /^\[remote-inlay\]\s+\[(\w+)\]\s+(.+)$/;
const META_RE = /^\s{2}(\S+):\s+(.+)$/;

function parseBracketedLine(re: RegExp, line: string): ParseResult | null {
  const match = line.match(re);
  if (!match) return null;
  const rawLevel = match[1].toLowerCase();
  return {
    level: isLogLevel(rawLevel) ? rawLevel : 'info',
    message: match[2],
  };
}

function parseCaddyLine(line: string): ParseResult | null {
  try {
    const parsed: unknown = JSON.parse(line);
    if (!isRecord(parsed)) return null;

    const rawLevel = typeof parsed.level === 'string' ? parsed.level : 'info';
    const message = typeof parsed.msg === 'string' ? parsed.msg : line;

    return {
      level: isLogLevel(rawLevel) ? rawLevel : 'info',
      message,
    };
  } catch {
    return null;
  }
}

function parseGenericLine(
  line: string,
  stream: 'stdout' | 'stderr',
): ParseResult {
  return {
    level: stream === 'stderr' ? 'warn' : 'info',
    message: line,
  };
}

export function parseLogLine(
  proxy: ProxyName,
  line: string,
  stream: 'stdout' | 'stderr',
): ParseResult {
  let result: ParseResult | null = null;

  switch (proxy) {
    case 'sync':
      result = parseBracketedLine(SYNC_RE, line);
      break;
    case 'with-sqlite':
      result = parseBracketedLine(DB_PROXY_RE, line);
      break;
    case 'remote-inlay':
      result = parseBracketedLine(REMOTE_INLAY_RE, line);
      break;
    case 'caddy':
      result = parseCaddyLine(line);
      break;
  }

  return result ?? parseGenericLine(line, stream);
}

export function parseMetaLine(
  line: string,
): { key: string; value: string } | null {
  const match = line.match(META_RE);
  if (!match) return null;
  return { key: match[1], value: match[2] };
}
