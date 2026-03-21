import { useLogStream } from '@/hooks/useLogStream';
import { useHealth } from '@/hooks/useHealth';
import { LogViewer } from './components/LogViewer';
import { HealthBar } from './components/HealthBar';
import { MetricsPanel } from './components/MetricsPanel';
import { ActiveStreams } from './components/ActiveStreams';

export function Dashboard() {
  const { logs, connected } = useLogStream();
  const { data: health, isLoading: healthLoading } = useHealth();

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

      <section className="shrink-0 border-b border-gray-800 max-h-72 overflow-y-auto scrollbar-hide">
        <ActiveStreams />
      </section>

      <main className="flex-1 overflow-hidden relative">
        <LogViewer logs={logs} connected={connected} />
      </main>
    </div>
  );
}
