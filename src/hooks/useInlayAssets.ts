import { useQuery } from '@tanstack/react-query';

export interface InlayAssetMeta {
  ext: string;
  type: string;
  width: number;
  height: number;
  name: string;
}

export function useInlayAssets() {
  return useQuery({
    queryKey: ['inlay-assets'],
    queryFn: async (): Promise<string[]> => {
      const res = await fetch('/api/inlay/assets');
      const data: unknown = await res.json();
      if (!Array.isArray(data)) return [];
      return data.filter((v): v is string => typeof v === 'string');
    },
    staleTime: 30_000,
  });
}

export function useInlayAssetMeta(id: string | null) {
  return useQuery({
    queryKey: ['inlay-asset-meta', id],
    queryFn: async (): Promise<InlayAssetMeta | null> => {
      if (!id) return null;
      const res = await fetch(`/api/inlay/assets/${encodeURIComponent(id)}`, {
        method: 'HEAD',
      });
      if (!res.ok) return null;
      return {
        ext: res.headers.get('x-inlay-ext') ?? 'png',
        type: res.headers.get('x-inlay-type') ?? 'image',
        width: Number(res.headers.get('x-inlay-width')) || 0,
        height: Number(res.headers.get('x-inlay-height')) || 0,
        name: res.headers.get('x-inlay-name') ?? '',
      };
    },
    enabled: !!id,
    staleTime: Infinity,
  });
}
