import type { ProxyHealth, ProxyName } from '@/types';
import { useDragScroll } from '@/hooks/useDragScroll';

interface HealthBarProps {
  health: ProxyHealth[] | undefined;
  isLoading: boolean;
  activeProxy: ProxyName | null;
  onSelect: (proxy: ProxyName | null) => void;
}

const PROXY_COLORS: Record<ProxyName, { border: string; activeBg: string }> = {
  sync: { border: 'border-purple-500/40', activeBg: 'bg-purple-500/10 border-purple-500/80' },
  'with-sqlite': { border: 'border-emerald-500/40', activeBg: 'bg-emerald-500/10 border-emerald-500/80' },
  'remote-inlay': { border: 'border-pink-500/40', activeBg: 'bg-pink-500/10 border-pink-500/80' },
  caddy: { border: 'border-cyan-500/40', activeBg: 'bg-cyan-500/10 border-cyan-500/80' },
  risuai: { border: 'border-orange-500/40', activeBg: 'bg-orange-500/10 border-orange-500/80' },
  'setting-searchbar': { border: 'border-amber-500/40', activeBg: 'bg-amber-500/10 border-amber-500/80' },
};

const STATUS_DOT: Record<string, string> = {
  up: 'bg-green-500',
  down: 'bg-red-500',
  unknown: 'bg-gray-500',
};

export function HealthBar({ health, isLoading, activeProxy, onSelect }: HealthBarProps) {
  const { scrollRef, onMouseDown, onClickCapture } = useDragScroll();

  if (isLoading || !health) {
    return (
      <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-16 min-w-[180px] rounded-lg bg-gray-900 animate-pulse shrink-0"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide"
      onMouseDown={onMouseDown}
      onClickCapture={onClickCapture}
    >
      {health.map((h) => {
        const isActive = activeProxy === h.proxy;
        const colors = PROXY_COLORS[h.proxy];
        return (
          <button
            key={h.proxy}
            onClick={() => onSelect(isActive ? null : h.proxy)}
            className={`min-w-[180px] shrink-0 rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
              isActive
                ? `${colors.activeBg}`
                : `bg-gray-900 ${colors.border} hover:bg-gray-800/50`
            }`}
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
          </button>
        );
      })}
    </div>
  );
}
