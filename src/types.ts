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

export interface ContainerStats {
  cpuPercent: number;
  memoryUsageMB: number;
  memoryLimitMB: number;
  running: boolean;
}

export interface ProxyHealth {
  proxy: ProxyName;
  status: 'up' | 'down' | 'unknown';
  latencyMs: number;
  details?: Record<string, unknown>;
  container?: ContainerStats;
}

export interface MetricPoint {
  timestamp: number;
  rps: number;
  errorRate: number;
  ttfbP50: number;
  ttfbP95: number;
}

export interface MetricsSeries {
  proxy: ProxyName;
  points: MetricPoint[];
}

export interface MetricsSnapshot {
  windowMinutes: number;
  series: MetricsSeries[];
}
