import { useRef, useCallback, useEffect } from 'react';
import type { ProxyHealth, ProxyName } from '@/types';

interface HealthBarProps {
  health: ProxyHealth[] | undefined;
  isLoading: boolean;
  activeProxy: ProxyName | null;
  onSelect: (proxy: ProxyName | null) => void;
}

const DRAG_THRESHOLD = 5;

function useDragScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const state = useRef({ pressing: false, dragged: false, startX: 0, scrollLeft: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    state.current = { pressing: true, dragged: false, startX: e.clientX, scrollLeft: el.scrollLeft };
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!state.current.pressing) return;
      const el = scrollRef.current;
      if (!el) return;
      const dx = e.clientX - state.current.startX;
      if (Math.abs(dx) > DRAG_THRESHOLD) state.current.dragged = true;
      if (state.current.dragged) {
        el.scrollLeft = state.current.scrollLeft - dx;
      }
    };
    const onMouseUp = () => { state.current.pressing = false; };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (state.current.dragged) {
      e.stopPropagation();
    }
  }, []);

  return { scrollRef, onMouseDown, onClickCapture };
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
