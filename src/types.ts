export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type ProxyName = 'sync' | 'with-sqlite' | 'remote-inlay' | 'caddy' | 'risuai' | 'setting-searchbar';

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

export interface ResourcePoint {
  timestamp: number;
  cpuPercent: number;
  memoryUsageMB: number;
}

export interface ResourceSeries {
  proxy: ProxyName;
  points: ResourcePoint[];
}

export interface ResourceSnapshot {
  windowMinutes: number;
  series: ResourceSeries[];
}

// --- SQLite Browser ---

export interface SqliteTable {
  name: string;
  type: string;
}

export interface SqliteColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
  comment: string | null;
}

export interface SqliteIndex {
  seq: number;
  name: string;
  unique: number;
}

export interface SqliteSchemaResponse {
  table: string;
  columns: SqliteColumn[];
  indexes: SqliteIndex[];
  rowCount: number;
}

export interface SqliteReadResult {
  type: 'read';
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  truncated: boolean;
  elapsedMs: number;
}

export interface SqliteWriteResult {
  type: 'write';
  changes: number;
  lastInsertRowid: number;
  elapsedMs: number;
}

export type SqliteQueryResult = SqliteReadResult | SqliteWriteResult;

// --- Sync Status ---

export interface SyncStatus {
  hydrationState: 'COLD' | 'WARMING' | 'HOT';
  capturedRemotes: number;
  expectedRemotes: number;
  dbReady: boolean;
}

export interface SyncResult {
  filesAdded: number;
  filesRemoved: number;
  metaUpdated: number;
  dbBinDrift: boolean;
  remotesUpdated: number;
  elapsedMs: number;
  skipped?: string;
}

// --- Character Delete ---

export interface CharacterDeleteResult {
  ok: boolean;
  charId: string;
  fileRemoved: boolean;
  error?: string;
}

// --- Asset Validator ---

export interface AssetIssue {
  field: string;
  assetName: string;
  assetPath: string;
}

export interface CharacterIssues {
  characterId: string;
  characterName: string;
  type: string;
  totalAssets: number;
  issues: AssetIssue[];
}

export interface ModuleIssues {
  moduleId: string;
  moduleName: string;
  totalAssets: number;
  issues: AssetIssue[];
}

export interface ValidationResult {
  totalCharacters: number;
  totalAssets: number;
  totalMissing: number;
  characters: CharacterIssues[];
  modules: ModuleIssues[];
  scannedAt: number;
}
