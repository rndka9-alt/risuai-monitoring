import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { MetricsSnapshot, ProxyName } from '@/types';

interface MetricsPanelProps {
  metrics: MetricsSnapshot | undefined;
  isLoading: boolean;
}

const PROXY_STROKE: Record<ProxyName, string> = {
  sync: '#a855f7',
  'db-proxy': '#10b981',
  caddy: '#06b6d4',
  risuai: '#f97316',
};

const PROXIES: readonly ProxyName[] = ['sync', 'db-proxy', 'caddy', 'risuai'];

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

export function MetricsPanel({ metrics, isLoading }: MetricsPanelProps) {
  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-3 gap-3 px-4 py-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[196px] rounded-lg bg-gray-900 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const rpsData = mergeSeriesFor(metrics, 'rps');
  const ttfbData = mergeSeriesFor(metrics, 'ttfbP50');
  const errorData = mergeSeriesFor(metrics, 'errorRate');

  return (
    <div className="grid grid-cols-3 gap-3 px-4 py-3">
      <ChartCard title="RPS (req/s)" data={rpsData} unit=" r/s" />
      <ChartCard title="TTFB p50 (ms)" data={ttfbData} unit="ms" />
      <ChartCard title="Error Rate" data={errorData} />
    </div>
  );
}
