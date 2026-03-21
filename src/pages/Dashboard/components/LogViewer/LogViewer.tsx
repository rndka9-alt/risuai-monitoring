import { useState, useRef, useEffect } from 'react';
import type { LogEntry, LogLevel, ProxyName } from '@/types';

interface LogViewerProps {
  logs: LogEntry[];
  connected: boolean;
}

const LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];
const PROXIES: readonly ProxyName[] = ['sync', 'with-sqlite', 'remote-inlay', 'caddy', 'risuai'];

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: 'text-gray-400',
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const PROXY_COLORS: Record<ProxyName, string> = {
  sync: 'bg-purple-500/20 text-purple-300',
  'with-sqlite': 'bg-emerald-500/20 text-emerald-300',
  'remote-inlay': 'bg-pink-500/20 text-pink-300',
  caddy: 'bg-cyan-500/20 text-cyan-300',
  risuai: 'bg-orange-500/20 text-orange-300',
};

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

export function LogViewer({ logs, connected }: LogViewerProps) {
  const [levelFilter, setLevelFilter] = useState<Set<LogLevel>>(
    () => new Set(LEVELS),
  );
  const [proxyFilter, setProxyFilter] = useState<Set<ProxyName>>(
    () => new Set(PROXIES),
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter(
    (log) => levelFilter.has(log.level) && proxyFilter.has(log.proxy),
  );

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-800 bg-gray-950">
        {/* Connection indicator */}
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-xs text-gray-500">
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>

        <div className="w-px h-4 bg-gray-800" />

        {/* Level filters */}
        <div className="flex gap-1">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setLevelFilter((prev) => toggleInSet(prev, level))}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                levelFilter.has(level)
                  ? `${LEVEL_COLORS[level]} bg-gray-800`
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-gray-800" />

        {/* Proxy filters */}
        <div className="flex gap-1">
          {PROXIES.map((proxy) => (
            <button
              key={proxy}
              onClick={() =>
                setProxyFilter((prev) => toggleInSet(prev, proxy))
              }
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                proxyFilter.has(proxy)
                  ? PROXY_COLORS[proxy]
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {proxy}
            </button>
          ))}
        </div>

        {/* Log count */}
        <span className="text-xs text-gray-600 ml-auto tabular-nums">
          {filteredLogs.length} / {logs.length}
        </span>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-hide font-mono text-[13px] leading-5"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            {logs.length === 0 ? 'Waiting for logs...' : 'No logs match filters'}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex gap-2 px-4 py-px hover:bg-white/[0.02] border-b border-gray-900/50"
            >
              <span className="text-gray-600 shrink-0 tabular-nums">
                {formatTime(log.timestamp)}
              </span>
              <span
                className={`shrink-0 px-1.5 rounded text-xs leading-5 ${PROXY_COLORS[log.proxy]}`}
              >
                {log.proxy}
              </span>
              <span
                className={`shrink-0 w-12 text-xs leading-5 ${LEVEL_COLORS[log.level]}`}
              >
                {log.level.toUpperCase()}
              </span>
              <span className="text-gray-300 break-all min-w-0">
                {log.message}
                {log.meta && Object.keys(log.meta).length > 0 && (
                  <span className="text-gray-500 ml-2">
                    {Object.entries(log.meta)
                      .map(([k, v]) => `${k}=${String(v)}`)
                      .join(' ')}
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-4 right-4 px-3 py-1.5 bg-gray-800 text-gray-300 text-xs rounded-full hover:bg-gray-700 transition-colors shadow-lg"
        >
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
