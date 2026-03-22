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
      const record = data as Record<string, unknown>;
      if (typeof record.body !== 'string' || !record.body) return null;
      return { contentType: String(record.contentType ?? ''), body: record.body };
    },
    enabled: !!streamId,
    staleTime: Infinity,
  });
}
