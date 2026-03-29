import { useQuery } from '@tanstack/react-query';
import type { ValidationResult } from '@/types';

export function useAssetValidator(enabled: boolean) {
  return useQuery({
    queryKey: ['asset-validator'],
    queryFn: async (): Promise<ValidationResult> => {
      const res = await fetch('/api/validator/run');
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    },
    enabled,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });
}
