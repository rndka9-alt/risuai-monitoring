import { useQuery } from '@tanstack/react-query';

export interface StreamImage {
  mediaType: string;
  data: string;
  isOutput?: boolean;
}

export function useStreamImages(streamId: string | null) {
  return useQuery({
    queryKey: ['stream-images', streamId],
    queryFn: async (): Promise<StreamImage[]> => {
      if (!streamId) return [];
      const res = await fetch(`/api/streams/${streamId}/images`);
      const data: unknown = await res.json();
      if (!Array.isArray(data)) return [];
      return data;
    },
    enabled: !!streamId,
    staleTime: Infinity,
  });
}
