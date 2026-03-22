import { useQuery } from '@tanstack/react-query';

interface StreamResponseBody {
  contentType: string;
  body: string;
}

export function useStreamResponseBody(streamId: string | null) {
  return useQuery({
    queryKey: ['stream-response-body', streamId],
    queryFn: async (): Promise<StreamResponseBody | null> => {
      if (!streamId) return null;
      const res = await fetch(`/api/streams/${streamId}/response-body`);
      const data: unknown = await res.json();
      if (typeof data !== 'object' || data === null) return null;
      if (!('body' in data) || typeof data.body !== 'string' || !data.body) return null;
      const contentType = 'contentType' in data && typeof data.contentType === 'string' ? data.contentType : '';
      return { contentType, body: data.body };
    },
    enabled: !!streamId,
    staleTime: Infinity,
  });
}
