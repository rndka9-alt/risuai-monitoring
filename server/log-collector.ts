import { EventEmitter } from 'node:events';
import { dockerGet, demuxDockerStream } from './docker.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { parseLogLine, parseMetaLine } from './parsers.js';
import type { LogEntry, ProxyName } from '../src/types.js';

interface ContainerTarget {
  containerName: string;
  proxy: ProxyName;
}

const TARGETS: readonly ContainerTarget[] = [
  { containerName: 'sync', proxy: 'sync' },
  { containerName: 'with-sqlite', proxy: 'db-proxy' },
  { containerName: 'caddy', proxy: 'caddy' },
  { containerName: 'risuai', proxy: 'risuai' },
];

const TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s(.+)$/;

let idCounter = 0;

function generateId(): string {
  return `${Date.now()}-${++idCounter}`;
}

function stripTimestamp(line: string): { timestamp: number; content: string } {
  const match = line.match(TIMESTAMP_RE);
  if (match) {
    return { timestamp: new Date(match[1]).getTime(), content: match[2] };
  }
  return { timestamp: Date.now(), content: line };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class LogCollector extends EventEmitter {
  private running = false;

  start(): void {
    this.running = true;
    for (const target of TARGETS) {
      this.streamContainer(target);
    }
    logger.info('Log collector started', {
      containers: TARGETS.map((t) => t.containerName).join(', '),
    });
  }

  stop(): void {
    this.running = false;
  }

  private async streamContainer(target: ContainerTarget): Promise<void> {
    while (this.running) {
      try {
        await this.connectAndStream(target);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.debug(`Container ${target.containerName} unavailable`, {
          error: message,
        });
      }

      if (this.running) {
        await sleep(config.reconnectIntervalMs);
      }
    }
  }

  private async connectAndStream(
    target: ContainerTarget,
  ): Promise<void> {
    const reqPath =
      `/containers/${target.containerName}/logs` +
      `?follow=true&stdout=true&stderr=true&timestamps=true&tail=${config.tailLines}`;

    const response = await dockerGet(reqPath);

    if (response.statusCode !== 200) {
      response.resume();
      return;
    }

    logger.info(`Streaming logs from ${target.containerName}`);

    const supportsContinuation =
      target.proxy === 'sync' || target.proxy === 'db-proxy';

    return new Promise((resolve) => {
      let pendingEntry: LogEntry | null = null;
      let flushTimer: ReturnType<typeof setTimeout> | null = null;

      const flush = (): void => {
        if (pendingEntry) {
          this.emit('log', pendingEntry);
          pendingEntry = null;
        }
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
      };

      const scheduleFlush = (): void => {
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(flush, 100);
      };

      demuxDockerStream(
        response,
        (stream, rawLine) => {
          const { timestamp, content } = stripTimestamp(rawLine);

          // Check for continuation lines (indented key: value)
          if (supportsContinuation && content.startsWith('  ') && pendingEntry) {
            const meta = parseMetaLine(content);
            if (meta) {
              if (!pendingEntry.meta) pendingEntry.meta = {};
              pendingEntry.meta[meta.key] = meta.value;
              scheduleFlush();
              return;
            }
          }

          // New log entry
          flush();
          const parsed = parseLogLine(target.proxy, content, stream);
          pendingEntry = {
            id: generateId(),
            timestamp,
            proxy: target.proxy,
            level: parsed.level,
            message: parsed.message,
            meta: parsed.meta,
          };
          scheduleFlush();
        },
        (error) => {
          flush();
          if (error) {
            logger.warn(`Log stream error for ${target.containerName}`, {
              error: error.message,
            });
          }
          resolve();
        },
      );
    });
  }
}
