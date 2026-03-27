import { useQuery } from '@tanstack/react-query';
import type { ResourceSnapshot } from '@/types';

const EMPTY_SNAPSHOT: ResourceSnapshot = { windowMinutes: 60, series: [] };

function isValidSnapshot(data: unknown): data is ResourceSnapshot {
  if (typeof data !== 'object' || data === null) return false;
  return 'series' in data && Array.isArray(data.series);
}

export function useResources(bucket: string = '60s') {
  return useQuery({
    queryKey: ['resources', bucket],
    queryFn: async (): Promise<ResourceSnapshot> => {
      const res = await fetch(`/api/resources?bucket=${bucket}`);
      const data: unknown = await res.json();
      if (!isValidSnapshot(data)) return EMPTY_SNAPSHOT;
      return data;
    },
    refetchInterval: 10_000,
  });
}
