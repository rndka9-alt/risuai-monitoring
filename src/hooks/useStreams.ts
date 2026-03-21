import { useQuery } from '@tanstack/react-query';
import type { StreamsSnapshot } from '@/types';

const EMPTY: StreamsSnapshot = { active: [], recent: [], total: 0 };

function isValid(data: unknown): data is StreamsSnapshot {
  if (typeof data !== 'object' || data === null) return false;
  return 'active' in data && Array.isArray((data as Record<string, unknown>).active);
}

export function useStreams() {
  return useQuery({
    queryKey: ['streams'],
    queryFn: async (): Promise<StreamsSnapshot> => {
      const res = await fetch('/api/streams');
      const data: unknown = await res.json();
      if (!isValid(data)) return EMPTY;
      return data;
    },
    refetchInterval: (query) => {
      const hasActive = query.state.data && query.state.data.active.length > 0;
      return hasActive ? 1_000 : 5_000;
    },
  });
}
