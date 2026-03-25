import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useMetrics } from '@/hooks/useMetrics';
import type { MetricsSnapshot, ProxyName } from '@/types';

const PROXY_STROKE: Record<ProxyName, string> = {
  sync: '#a855f7',
  'with-sqlite': '#10b981',
  'remote-inlay': '#ec4899',
  caddy: '#06b6d4',
  risuai: '#f97316',
  'setting-searchbar': '#f59e0b',
};

const PROXIES: readonly ProxyName[] = ['sync', 'with-sqlite', 'remote-inlay', 'caddy', 'risuai', 'setting-searchbar'];

const BUCKET_OPTIONS = ['5s', '10s', '30s', '60s', '1h'] as const;

// 버킷 크기별 표시할 최대 포인트 수 → 차트 시간 범위 결정
// 5s × 120 = 10분, 10s × 120 = 20분, 30s × 60 = 30분, 60s × 60 = 1시간, 1h × 6 = 6시간
const BUCKET_MAX_POINTS: Record<string, number> = {
  '5s': 120,
  '10s': 120,
  '30s': 60,
  '60s': 60,
  '1h': 6,
};

interface MergedPoint {
  timestamp: number;
  [key: string]: number;
}

function mergeSeriesFor(
  metrics: MetricsSnapshot,
  field: 'rps' | 'errorRate' | 'ttfbP50' | 'ttfbP95',
): MergedPoint[] {
  const byTimestamp = new Map<number, MergedPoint>();

  for (const s of metrics.series) {
    for (const p of s.points) {
      let row = byTimestamp.get(p.timestamp);
      if (!row) {
        row = { timestamp: p.timestamp };
        byTimestamp.set(p.timestamp, row);
      }
      row[s.proxy] = p[field];
    }
  }

  return Array.from(byTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface ChartCardProps {
  title: string;
  data: MergedPoint[];
  unit?: string;
}

function ChartCard({ title, data, unit }: ChartCardProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-3">
      <h3 className="text-xs font-medium text-gray-400 mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data}>
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <Tooltip
            wrapperStyle={{ zIndex: 'var(--z-tooltip)' }}
            contentStyle={{
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: '0.375rem',
              fontSize: '12px',
            }}
            labelFormatter={formatTime}
            formatter={(value: number) =>
              [`${Math.round(value * 100) / 100}${unit ?? ''}`, '']
            }
          />
          <Legend
            iconSize={8}
            wrapperStyle={{ fontSize: '11px' }}
          />
          {PROXIES.map((proxy) => (
            <Line
              key={proxy}
              type="monotone"
              dataKey={proxy}
              stroke={PROXY_STROKE[proxy]}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MetricsPanel() {
  const [bucket, setBucket] = useState('60s');
  const { data: metrics, isLoading } = useMetrics(bucket);

  return (
    <div>
      {/* Bucket selector */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <span className="text-xs text-gray-500">Bucket</span>
        <div className="flex gap-1">
          {BUCKET_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setBucket(opt)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                bucket === opt
                  ? 'bg-gray-700 text-gray-200'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      {isLoading || !metrics ? (
        <div className="grid grid-cols-3 gap-3 px-4 py-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[196px] rounded-lg bg-gray-900 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 px-4 py-3">
          <ChartCard title="RPS (req/s)" data={mergeSeriesFor(metrics, 'rps').slice(-(BUCKET_MAX_POINTS[bucket] ?? 60))} unit=" r/s" />
          <ChartCard title="TTFB p50 (ms)" data={mergeSeriesFor(metrics, 'ttfbP50').slice(-(BUCKET_MAX_POINTS[bucket] ?? 60))} unit="ms" />
          <ChartCard title="Error Rate" data={mergeSeriesFor(metrics, 'errorRate').slice(-(BUCKET_MAX_POINTS[bucket] ?? 60))} />
        </div>
      )}
    </div>
  );
}
