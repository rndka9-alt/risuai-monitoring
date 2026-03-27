import { useRef, useState } from 'react';
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
import { useResources } from '@/hooks/useResources';
import { useDragScroll } from '@/hooks/useDragScroll';
import type { MetricsSnapshot, ResourceSnapshot, ProxyName } from '@/types';

const PROXY_STROKE: Record<ProxyName, string> = {
  sync: '#a855f7',
  'with-sqlite': '#10b981',
  'remote-inlay': '#ec4899',
  caddy: '#06b6d4',
  risuai: '#f97316',
  'setting-searchbar': '#f59e0b',
};

const PROXIES: readonly ProxyName[] = ['sync', 'with-sqlite', 'remote-inlay', 'caddy', 'risuai', 'setting-searchbar'];

const BUCKET_OPTIONS = ['10s', '30s', '60s', '1h'] as const;

// 버킷 크기별 표시할 최대 포인트 수 → 차트 시간 범위 결정
// 10s × 120 = 20분, 30s × 60 = 30분, 60s × 60 = 1시간, 1h × 6 = 6시간
const BUCKET_MAX_POINTS: Record<string, number> = {
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
  snapshot: MetricsSnapshot | ResourceSnapshot,
  field: string,
): MergedPoint[] {
  const byTimestamp = new Map<number, MergedPoint>();

  for (const s of snapshot.series) {
    for (const p of s.points) {
      let row = byTimestamp.get(p.timestamp);
      if (!row) {
        row = { timestamp: p.timestamp };
        byTimestamp.set(p.timestamp, row);
      }
      const value = (p as Record<string, number>)[field];
      if (value !== undefined) {
        row[s.proxy] = value;
      }
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
  description: string;
  data: MergedPoint[];
  unit?: string;
}

function TitleTooltip({ text, description }: { text: string; description: string }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  function show() {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function hide() {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  return (
    <span
      className="relative cursor-help"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <span className="border-b border-dashed border-gray-600">{text}</span>
      {open && (
        <span className="absolute left-0 top-full mt-1 z-50 w-56 rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-[11px] leading-relaxed text-gray-300 shadow-lg">
          {description}
        </span>
      )}
    </span>
  );
}

function ChartCard({ title, description, data, unit }: ChartCardProps) {
  return (
    <div className="min-w-[320px] shrink-0 bg-gray-900 rounded-lg p-3">
      <h3 className="text-xs font-medium text-gray-400 mb-2">
        <TitleTooltip text={title} description={description} />
      </h3>
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
  const { data: metrics, isLoading: metricsLoading } = useMetrics(bucket);
  const { data: resources, isLoading: resourcesLoading } = useResources(bucket);
  const { scrollRef, onMouseDown, onClickCapture } = useDragScroll();

  const maxPoints = BUCKET_MAX_POINTS[bucket] ?? 60;
  const isLoading = metricsLoading || resourcesLoading;

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
      <div
        ref={scrollRef}
        className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide"
        onMouseDown={onMouseDown}
        onClickCapture={onClickCapture}
      >
        {isLoading || !metrics || !resources ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[196px] min-w-[320px] shrink-0 rounded-lg bg-gray-900 animate-pulse"
            />
          ))
        ) : (
          <>
            <ChartCard
              title="RPS (req/s)"
              description="Requests Per Second — 초당 처리된 요청 수. 프록시가 얼마나 바쁜지를 나타냅니다."
              data={mergeSeriesFor(metrics, 'rps').slice(-maxPoints)}
              unit=" r/s"
            />
            <ChartCard
              title="TTFB p50 (ms)"
              description="Time To First Byte — 요청 후 첫 응답 바이트까지 걸린 시간의 중앙값(p50). 응답 속도를 나타냅니다."
              data={mergeSeriesFor(metrics, 'ttfbP50').slice(-maxPoints)}
              unit="ms"
            />
            <ChartCard
              title="Error Rate"
              description="오류 비율 — 전체 요청 중 HTTP 400 이상 응답의 비율. 0이면 에러 없음, 1이면 전부 에러."
              data={mergeSeriesFor(metrics, 'errorRate').slice(-maxPoints)}
            />
            <ChartCard
              title="CPU (%)"
              description="컨테이너별 CPU 사용률. Docker stats에서 10초마다 수집합니다."
              data={mergeSeriesFor(resources, 'cpuPercent').slice(-maxPoints)}
              unit="%"
            />
            <ChartCard
              title="Memory (MB)"
              description="컨테이너별 메모리 사용량(캐시 제외). Docker stats에서 10초마다 수집합니다."
              data={mergeSeriesFor(resources, 'memoryUsageMB').slice(-maxPoints)}
              unit=" MB"
            />
          </>
        )}
      </div>
    </div>
  );
}
