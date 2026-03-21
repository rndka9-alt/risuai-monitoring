import type { ProxyHealth, ProxyName } from '@/types';

interface HealthBarProps {
  health: ProxyHealth[] | undefined;
  isLoading: boolean;
}

const PROXY_COLORS: Record<ProxyName, string> = {
  sync: 'border-purple-500/40',
  'with-sqlite': 'border-emerald-500/40',
  'remote-inlay': 'border-pink-500/40',
  caddy: 'border-cyan-500/40',
  risuai: 'border-orange-500/40',
};

const STATUS_DOT: Record<string, string> = {
  up: 'bg-green-500',
  down: 'bg-red-500',
  unknown: 'bg-gray-500',
};

export function HealthBar({ health, isLoading }: HealthBarProps) {
  if (isLoading || !health) {
    return (
      <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 min-w-[180px] rounded-lg bg-gray-900 animate-pulse shrink-0"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
      {health.map((h) => (
        <div
          key={h.proxy}
          className={`min-w-[180px] shrink-0 rounded-lg bg-gray-900 border ${PROXY_COLORS[h.proxy]} px-3 py-2`}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${STATUS_DOT[h.status]}`} />
            <span className="text-sm font-medium">{h.proxy}</span>
            {h.status === 'up' && (
              <span className="text-xs text-gray-500 ml-auto tabular-nums">
                {h.latencyMs}ms
              </span>
            )}
          </div>

          {h.container ? (
            <div className="flex gap-4 text-xs text-gray-400">
              <span>
                CPU{' '}
                <span className="text-gray-300 tabular-nums">
                  {h.container.cpuPercent}%
                </span>
              </span>
              <span>
                MEM{' '}
                <span className="text-gray-300 tabular-nums">
                  {h.container.memoryUsageMB}MB
                </span>
              </span>
            </div>
          ) : (
            <div className="text-xs text-gray-600">No stats</div>
          )}
        </div>
      ))}
    </div>
  );
}
