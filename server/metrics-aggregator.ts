import type { LogCollector } from './log-collector.js';
import { config } from './config.js';
import type { LogEntry, ProxyName, MetricPoint, MetricsSnapshot } from '../src/types.js';

const BASE_BUCKET_MS = config.metricsBucketSizeMs;

const VALID_BUCKET_SIZES: Record<string, number> = {
  '10s': 10_000,
  '30s': 30_000,
  '60s': 60_000,
  '1h': 3_600_000,
};

interface Bucket {
  requests: number;
  errors: number;
  timings: number[];
}

type ProxyBuckets = Map<number, Bucket>;

const allBuckets = new Map<ProxyName, ProxyBuckets>();

const PROXIES: readonly ProxyName[] = ['sync', 'with-sqlite', 'remote-inlay', 'caddy', 'risuai', 'setting-searchbar'];

function getBucket(proxy: ProxyName, timestamp: number): Bucket {
  let proxyMap = allBuckets.get(proxy);
  if (!proxyMap) {
    proxyMap = new Map();
    allBuckets.set(proxy, proxyMap);
  }

  const bucketTs = Math.floor(timestamp / BASE_BUCKET_MS) * BASE_BUCKET_MS;
  let bucket = proxyMap.get(bucketTs);
  if (!bucket) {
    bucket = { requests: 0, errors: 0, timings: [] };
    proxyMap.set(bucketTs, bucket);
  }

  return bucket;
}

function pruneOldBuckets(): void {
  const cutoff = Date.now() - config.metricsRetentionMinutes * 60_000;
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
    if (bucket.timings.length < config.metricsMaxTimingsPerBucket) {
      bucket.timings.push(ms);
    }
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * p / 100) - 1);
  return sorted[idx];
}

function mergeBucketsAtSize(
  proxyMap: ProxyBuckets | undefined,
  targetSizeMs: number,
  from: number,
  to: number,
): MetricPoint[] {
  const merged = new Map<number, Bucket>();

  if (proxyMap) {
    for (const [ts, bucket] of proxyMap) {
      if (ts < from || ts > to) continue;
      const mergedTs = Math.floor(ts / targetSizeMs) * targetSizeMs;
      let target = merged.get(mergedTs);
      if (!target) {
        target = { requests: 0, errors: 0, timings: [] };
        merged.set(mergedTs, target);
      }
      target.requests += bucket.requests;
      target.errors += bucket.errors;
      target.timings.push(...bucket.timings);
    }
  }

  const points: MetricPoint[] = [];
  const bucketStart = Math.floor(from / targetSizeMs) * targetSizeMs;
  const bucketSizeSec = targetSizeMs / 1000;

  for (let ts = bucketStart; ts <= to; ts += targetSizeMs) {
    const bucket = merged.get(ts);
    if (bucket) {
      points.push({
        timestamp: ts,
        rps: Math.round((bucket.requests / bucketSizeSec) * 100) / 100,
        errorRate: bucket.requests > 0
          ? Math.round((bucket.errors / bucket.requests) * 1000) / 1000
          : 0,
        ttfbP50: Math.round(percentile(bucket.timings, 50)),
        ttfbP95: Math.round(percentile(bucket.timings, 95)),
      });
    } else {
      points.push({ timestamp: ts, rps: 0, errorRate: 0, ttfbP50: 0, ttfbP95: 0 });
    }
  }

  return points;
}

export function parseBucketSize(param: string | null): number {
  if (param && param in VALID_BUCKET_SIZES) {
    return VALID_BUCKET_SIZES[param];
  }
  return 60_000;
}

export function getMetrics(targetBucketMs: number): MetricsSnapshot {
  pruneOldBuckets();

  const now = Date.now();
  const from = now - config.metricsRetentionMinutes * 60_000;

  const series = PROXIES.map((proxy) => ({
    proxy,
    points: mergeBucketsAtSize(allBuckets.get(proxy), targetBucketMs, from, now),
  }));

  return {
    windowMinutes: config.metricsRetentionMinutes,
    series,
  };
}

export function startMetricsAggregator(collector: LogCollector): void {
  collector.on('log', handleLog);
}
