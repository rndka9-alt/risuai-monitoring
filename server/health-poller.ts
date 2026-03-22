import http from 'node:http';
import { config } from './config.js';
import { logger } from './logger.js';
import { dockerGet, readBody } from './docker.js';
import type { ProxyName, ProxyHealth, ContainerStats } from '../src/types.js';

interface HealthTarget {
  proxy: ProxyName;
  containerName: string;
  healthUrl: string;
}

const TARGETS: readonly HealthTarget[] = [
  { proxy: 'sync', containerName: 'sync', healthUrl: 'http://sync:3000/sync/health' },
  { proxy: 'with-sqlite', containerName: 'with-sqlite', healthUrl: 'http://with-sqlite:3001/' },
  { proxy: 'remote-inlay', containerName: 'remote-inlay', healthUrl: 'http://remote-inlay:3003/remote-inlay/health' },
  { proxy: 'caddy', containerName: 'caddy', healthUrl: 'http://caddy:80/' },
  { proxy: 'risuai', containerName: 'risuai', healthUrl: 'http://risuai:6001/' },
];

const HEALTH_TIMEOUT_MS = 3000;

let latestHealth: ProxyHealth[] = TARGETS.map((t) => ({
  proxy: t.proxy,
  status: 'unknown',
  latencyMs: 0,
}));

let timer: ReturnType<typeof setInterval> | null = null;

export function startHealthPoller(): void {
  poll();
  timer = setInterval(poll, config.healthIntervalMs);
  logger.info('Health poller started');
}

export function stopHealthPoller(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function getHealth(): readonly ProxyHealth[] {
  return latestHealth;
}

async function poll(): Promise<void> {
  latestHealth = await Promise.all(TARGETS.map(pollTarget));
}

async function pollTarget(target: HealthTarget): Promise<ProxyHealth> {
  const [healthResult, containerStats] = await Promise.all([
    checkHealth(target),
    getContainerStats(target.containerName, target.proxy),
  ]);

  return {
    ...healthResult,
    container: containerStats ?? undefined,
  };
}

async function checkHealth(
  target: HealthTarget,
): Promise<ProxyHealth> {
  try {
    const start = Date.now();
    const url = new URL(target.healthUrl);

    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'GET',
          timeout: HEALTH_TIMEOUT_MS,
        },
        resolve,
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('timeout'));
      });
      req.end();
    });

    const latencyMs = Date.now() - start;
    const body = await readBody(response);

    let details: Record<string, unknown> | undefined;
    if (target.proxy === 'sync') {
      try {
        const parsed: unknown = JSON.parse(body);
        if (typeof parsed === 'object' && parsed !== null) {
          details = parsed as Record<string, unknown>;
        }
      } catch {
        // not JSON, ignore
      }
    }

    const status = response.statusCode !== undefined && response.statusCode < 500 ? 'up' : 'down';

    return { proxy: target.proxy, status, latencyMs, details };
  } catch {
    return { proxy: target.proxy, status: 'down', latencyMs: 0 };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function getContainerStats(
  containerName: string,
  proxy: ProxyName,
): Promise<ContainerStats | null> {
  try {
    const response = await dockerGet(
      `/containers/${containerName}/stats?stream=false`,
    );
    if (response.statusCode !== 200) {
      response.resume();
      return null;
    }

    const body = await readBody(response);
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed)) return null;

    const cpuStats = isRecord(parsed.cpu_stats) ? parsed.cpu_stats : null;
    const preCpuStats = isRecord(parsed.precpu_stats) ? parsed.precpu_stats : null;
    const memStats = isRecord(parsed.memory_stats) ? parsed.memory_stats : null;

    // CPU percentage
    let cpuPercent = 0;
    if (cpuStats && preCpuStats) {
      const cpuUsage = isRecord(cpuStats.cpu_usage) ? cpuStats.cpu_usage : null;
      const preCpuUsage = isRecord(preCpuStats.cpu_usage) ? preCpuStats.cpu_usage : null;

      if (cpuUsage && preCpuUsage) {
        const cpuDelta = Number(cpuUsage.total_usage) - Number(preCpuUsage.total_usage);
        const systemDelta = Number(cpuStats.system_cpu_usage) - Number(preCpuStats.system_cpu_usage);
        const onlineCpus = Number(cpuStats.online_cpus) || 1;

        if (systemDelta > 0) {
          cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100;
        }
      }
    }

    // Memory
    let memoryUsageMB = 0;
    let memoryLimitMB = 0;
    if (memStats) {
      const usage = Number(memStats.usage) || 0;
      const statsObj = isRecord(memStats.stats) ? memStats.stats : null;
      const cache = statsObj ? Number(statsObj.cache) || 0 : 0;
      memoryUsageMB = Math.round((usage - cache) / 1024 / 1024);
      memoryLimitMB = Math.round(Number(memStats.limit) / 1024 / 1024);
    }

    return { cpuPercent: Math.round(cpuPercent * 10) / 10, memoryUsageMB, memoryLimitMB, running: true };
  } catch (err) {
    logger.debug(`Stats unavailable for ${proxy}`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
