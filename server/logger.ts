import { config } from './config.js';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;

function shouldLog(level: keyof typeof LEVELS): boolean {
  return LEVELS[level] >= LEVELS[config.logLevel];
}

function format(level: string, message: string, meta?: Record<string, unknown>): string {
  const lines = [`[Monitor] [${level.toUpperCase()}] ${message}`];
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      lines.push(`  ${key}: ${String(value)}`);
    }
  }
  return lines.join('\n');
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('debug')) console.log(format('debug', message, meta));
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('info')) console.log(format('info', message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('warn')) console.error(format('warn', message, meta));
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('error')) console.error(format('error', message, meta));
  },
};
