import { useState, useEffect, useRef } from 'react';
import type { LogEntry } from '@/types';

const MAX_CLIENT_LOGS = 5000;

interface UseLogStreamResult {
  logs: LogEntry[];
  connected: boolean;
}

export function useLogStream(): UseLogStreamResult {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/logs/stream');
    esRef.current = es;

    es.addEventListener('init', (event) => {
      try {
        const initial: LogEntry[] = JSON.parse(event.data);
        setLogs(initial.slice(-MAX_CLIENT_LOGS));
      } catch {
        // ignore malformed data
      }
      setConnected(true);
    });

    es.addEventListener('log', (event) => {
      try {
        const entry: LogEntry = JSON.parse(event.data);
        setLogs((prev) => {
          const next = [...prev, entry];
          if (next.length > MAX_CLIENT_LOGS) {
            return next.slice(-MAX_CLIENT_LOGS);
          }
          return next;
        });
      } catch {
        // ignore malformed data
      }
    });

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
    };
  }, []);

  return { logs, connected };
}
