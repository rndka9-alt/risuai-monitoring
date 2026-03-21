import type { LogCollector } from './log-collector.js';
import { config } from './config.js';
import type { LogEntry, ProxyName, MetricPoint, MetricsSnapshot } from '../src/types.js';

const BUCKET_SIZE_MS = 60_000;

interface Bucket {
  requests: number;
  errors: number;
  timings: number[];
}

type ProxyBuckets = Map<number, Bucket>;

const allBuckets = new Map<ProxyName, ProxyBuckets>();

function getBucket(proxy: ProxyName, timestamp: number): Bucket {
  let proxyMap = allBuckets.get(proxy);
  if (!proxyMap) {
    proxyMap = new Map();
    allBuckets.set(proxy, proxyMap);
  }

  const bucketTs = Math.floor(timestamp / BUCKET_SIZE_MS) * BUCKET_SIZE_MS;
  let bucket = proxyMap.get(bucketTs);
  if (!bucket) {
    bucket = { requests: 0, errors: 0, timings: [] };
    proxyMap.set(bucketTs, bucket);
  }

  return bucket;
}

function pruneOldBuckets(): void {
  const cutoff = Date.now() - config.metricsWindowMinutes * 60_000;
  for (const proxyMap of allBuckets.values()) {
    for (const ts of proxyMap.keys()) {
      if (ts < cutoff) {
        proxyMap.delete(ts);
      }
    }
  }
}

function handleLog(entry: LogEntry): void {
  const bucket = getBucket(entry.proxy, entry.timestamp);

  const isResponse = entry.message === 'Response' ||
    entry.message.startsWith('Response');

  if (isResponse) {
    bucket.requests++;

    const status = entry.meta ? Number(entry.meta.status) : 0;
    if (status >= 400) {
      bucket.errors++;
    }
  }

  if (entry.level === 'error') {
    bucket.errors++;
  }

  const ms = entry.meta ? Number(entry.meta.ms) : NaN;
  if (!Number.isNaN(ms) && ms > 0) {
    bucket.timings.push(ms);
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * p / 100) - 1);
  return sorted[idx];
}

export function getMetrics(): MetricsSnapshot {
  pruneOldBuckets();

  const proxies: ProxyName[] = ['sync', 'db-proxy', 'caddy', 'risuai'];
  const now = Date.now();
  const windowStart = now - config.metricsWindowMinutes * 60_000;
  const bucketStart = Math.floor(windowStart / BUCKET_SIZE_MS) * BUCKET_SIZE_MS;

  const series = proxies.map((proxy) => {
    const proxyMap = allBuckets.get(proxy);
    const points: MetricPoint[] = [];

    for (let ts = bucketStart; ts <= now; ts += BUCKET_SIZE_MS) {
      const bucket = proxyMap?.get(ts);
      if (bucket) {
        const rps = Math.round((bucket.requests / 60) * 100) / 100;
        const errorRate = bucket.requests > 0
          ? Math.round((bucket.errors / bucket.requests) * 1000) / 1000
          : 0;
        points.push({
          timestamp: ts,
          rps,
          errorRate,
          ttfbP50: Math.round(percentile(bucket.timings, 50)),
          ttfbP95: Math.round(percentile(bucket.timings, 95)),
        });
      } else {
        points.push({ timestamp: ts, rps: 0, errorRate: 0, ttfbP50: 0, ttfbP95: 0 });
      }
    }

    return { proxy, points };
  });

  return { windowMinutes: config.metricsWindowMinutes, series };
}

export function startMetricsAggregator(collector: LogCollector): void {
  collector.on('log', handleLog);
}
