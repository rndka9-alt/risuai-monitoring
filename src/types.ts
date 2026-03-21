export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type ProxyName = 'sync' | 'db-proxy' | 'caddy' | 'risuai';

export interface LogEntry {
  id: string;
  timestamp: number;
  proxy: ProxyName;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

export interface HealthStatus {
  proxy: ProxyName;
  status: 'up' | 'down' | 'unknown';
  latency?: number;
  details?: Record<string, unknown>;
}

export interface ProxyMetrics {
  proxy: ProxyName;
  rps: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
}
