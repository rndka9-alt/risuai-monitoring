import { useQuery } from '@tanstack/react-query';
import type { MetricsSnapshot } from '@/types';

const EMPTY_SNAPSHOT: MetricsSnapshot = { windowMinutes: 60, series: [] };

function isValidSnapshot(data: unknown): data is MetricsSnapshot {
  if (typeof data !== 'object' || data === null) return false;
  return 'series' in data && Array.isArray((data as MetricsSnapshot).series);
}

export function useMetrics() {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: async (): Promise<MetricsSnapshot> => {
      const res = await fetch('/api/metrics');
      const data: unknown = await res.json();
      if (!isValidSnapshot(data)) return EMPTY_SNAPSHOT;
      return data;
    },
    refetchInterval: 30_000,
  });
}
