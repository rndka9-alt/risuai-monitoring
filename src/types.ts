export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type ProxyName = 'sync' | 'with-sqlite' | 'remote-inlay' | 'caddy' | 'risuai';

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

export interface StreamEntry {
  id: string;
  senderClientId: string;
  targetCharId: string | null;
  status: string;
  textLength: number;
  createdAt: number;
  elapsedMs: number;
  targetUrl: string;
  model: string;
  requestBody: string;
  messageCount: number;
  imageCount: number;
  outputPreview: string;
  completedAt: number | null;
  finishReason: string;
  outputTokens: number;
  reasoningTokens: number;
  error: string;
}

export interface StreamsSnapshot {
  active: StreamEntry[];
  recent: StreamEntry[];
  total: number;
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
