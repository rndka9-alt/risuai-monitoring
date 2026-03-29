import { useState } from 'react';
import { useLogStream } from '@/hooks/useLogStream';
import { useHealth } from '@/hooks/useHealth';
import { LogViewer } from './components/LogViewer';
import { HealthBar } from './components/HealthBar';
import { MetricsPanel } from './components/MetricsPanel';
import { ActiveStreams } from './components/ActiveStreams';
import { SearchbarIndex } from './components/SearchbarIndex';
import { SqliteBrowser } from './components/SqliteBrowser';
import { InlayGallery } from './components/InlayGallery';
import { AssetValidator } from './components/AssetValidator';
import type { ProxyName } from '@/types';

function DashboardTab() {
  const { logs, connected } = useLogStream();

  return (
    <>
      <section className="shrink-0 border-b border-gray-800">
        <MetricsPanel />
      </section>

      <main className="flex-1 overflow-hidden relative">
        <LogViewer logs={logs} connected={connected} />
      </main>
    </>
  );
}

function SyncTab() {
  return (
    <main className="flex-1 overflow-y-auto scrollbar-hide">
      <ActiveStreams />
    </main>
  );
}

type SqliteSubTab = 'browser' | 'validator';

function SubTabBar({
  value,
  onChange,
}: {
  value: SqliteSubTab;
  onChange: (v: SqliteSubTab) => void;
}) {
  const tabs: { id: SqliteSubTab; label: string }[] = [
    { id: 'browser', label: 'SQL Browser' },
    { id: 'validator', label: 'Asset Validator' },
  ];

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-gray-800">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`text-[11px] px-2.5 py-1 rounded transition-colors ${
            value === tab.id
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function WithSqliteTab() {
  const [subTab, setSubTab] = useState<SqliteSubTab>('browser');

  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      <SubTabBar value={subTab} onChange={setSubTab} />
      <div className="flex-1 overflow-hidden">
        {subTab === 'browser' ? <SqliteBrowser /> : <AssetValidator />}
      </div>
    </main>
  );
}

function RemoteInlayTab() {
  return (
    <main className="flex-1 overflow-hidden">
      <InlayGallery />
    </main>
  );
}

function PlaceholderTab({ proxy }: { proxy: ProxyName }) {
  return (
    <main className="flex-1 flex items-center justify-center">
      <span className="text-gray-600 text-sm">{proxy} — coming soon</span>
    </main>
  );
}

function SearchbarTab() {
  return (
    <main className="flex-1 overflow-hidden">
      <SearchbarIndex />
    </main>
  );
}

function TabContent({ activeProxy }: { activeProxy: ProxyName | null }) {
  if (activeProxy === null) return <DashboardTab />;
  if (activeProxy === 'sync') return <SyncTab />;
  if (activeProxy === 'with-sqlite') return <WithSqliteTab />;
  if (activeProxy === 'remote-inlay') return <RemoteInlayTab />;
  if (activeProxy === 'setting-searchbar') return <SearchbarTab />;
  return <PlaceholderTab proxy={activeProxy} />;
}

export function Dashboard() {
  const { data: health, isLoading: healthLoading } = useHealth();
  const [activeProxy, setActiveProxy] = useState<ProxyName | null>(null);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <header className="shrink-0 px-4 py-3 border-b border-gray-800 flex items-center gap-3">
        <button
          onClick={() => setActiveProxy(null)}
          className="text-lg font-bold hover:text-purple-300 transition-colors cursor-pointer"
        >
          RisuAI Monitoring
        </button>
        {activeProxy && (
          <>
            <span className="text-gray-600">/</span>
            <span className="text-sm text-gray-400">{activeProxy}</span>
          </>
        )}
      </header>

      <section className="shrink-0 border-b border-gray-800">
        <HealthBar
          health={health}
          isLoading={healthLoading}
          activeProxy={activeProxy}
          onSelect={setActiveProxy}
        />
      </section>

      <TabContent activeProxy={activeProxy} />
    </div>
  );
}
