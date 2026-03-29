function parseLogLevel(
  value: string | undefined,
): 'debug' | 'info' | 'warn' | 'error' {
  const v = value ?? 'info';
  if (v === 'debug' || v === 'info' || v === 'warn' || v === 'error') {
    return v;
  }
  return 'info';
}

export const config = {
  port: Number(process.env.PORT) || 3002,
  logLevel: parseLogLevel(process.env.LOG_LEVEL),
  dockerSocket: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',
  logBufferSize: Number(process.env.LOG_BUFFER_SIZE) || 5000,
  reconnectIntervalMs: 5000,
  tailLines: 100,
  healthIntervalMs: 10_000,
  metricsBucketSizeMs: 10_000,
  metricsRetentionMinutes: Number(process.env.METRICS_RETENTION_MINUTES) || 180,
  metricsMaxTimingsPerBucket: 200,
  syncUrl: process.env.SYNC_URL ?? '',
  sqliteUrl: process.env.SQLITE_URL ?? 'http://with-sqlite:3001',
  remoteInlayUrl: process.env.REMOTE_INLAY_URL ?? 'http://remote-inlay:3003',
  /** active stream heartbeat 주기 (ms) */
  streamHeartbeatIntervalMs: 10_000,
};
