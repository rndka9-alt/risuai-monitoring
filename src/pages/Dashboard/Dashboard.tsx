import { useLogStream } from '@/hooks/useLogStream';
import { useHealth } from '@/hooks/useHealth';
import { LogViewer } from './components/LogViewer';
import { HealthBar } from './components/HealthBar';
import { MetricsPanel } from './components/MetricsPanel';
import { ActiveStreams } from './components/ActiveStreams';
import { useState, useCallback, useRef, useEffect } from 'react';

const MIN_HEIGHT = 48;
const DEFAULT_HEIGHT = 288;
const MAX_HEIGHT = 600;

export function Dashboard() {
  const { logs, connected } = useLogStream();
  const { data: health, isLoading: healthLoading } = useHealth();
  const [streamHeight, setStreamHeight] = useState(DEFAULT_HEIGHT);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startHeight.current = streamHeight;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [streamHeight]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = e.clientY - startY.current;
    setStreamHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight.current + delta)));
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  useEffect(() => {
    if (!dragging.current) return;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  });

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <header className="shrink-0 px-4 py-3 border-b border-gray-800">
        <h1 className="text-lg font-bold">RisuAI Monitoring</h1>
      </header>

      <section className="shrink-0 border-b border-gray-800">
        <HealthBar health={health} isLoading={healthLoading} />
      </section>

      <section className="shrink-0 border-b border-gray-800">
        <MetricsPanel />
      </section>

      <section
        className="shrink-0 overflow-y-auto scrollbar-hide"
        style={{ height: streamHeight }}
      >
        <ActiveStreams />
      </section>

      <div
        className="shrink-0 h-1.5 cursor-row-resize border-b border-gray-800 bg-gray-900 hover:bg-purple-500/30 active:bg-purple-500/40 transition-colors"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      <main className="flex-1 overflow-hidden relative">
        <LogViewer logs={logs} connected={connected} />
      </main>
    </div>
  );
}
