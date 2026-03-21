import { useLogStream } from '@/hooks/useLogStream';
import { LogViewer } from './components/LogViewer';

export function Dashboard() {
  const { logs, connected } = useLogStream();

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <header className="shrink-0 px-4 py-3 border-b border-gray-800">
        <h1 className="text-lg font-bold">RisuAI Monitoring</h1>
      </header>
      <main className="flex-1 overflow-hidden relative">
        <LogViewer logs={logs} connected={connected} />
      </main>
    </div>
  );
}
