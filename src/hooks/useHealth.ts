import { useQuery } from '@tanstack/react-query';
import type { ProxyHealth } from '@/types';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async (): Promise<ProxyHealth[]> => {
      const res = await fetch('/api/health');
      const data: unknown = await res.json();
      if (!Array.isArray(data)) return [];
      return data;
    },
    refetchInterval: 10_000,
  });
}
