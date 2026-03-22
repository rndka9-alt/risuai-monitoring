import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useAbortStream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (streamId: string): Promise<{ success?: boolean; error?: string }> => {
      const res = await fetch(`/api/streams/${encodeURIComponent(streamId)}/abort`, {
        method: 'POST',
      });
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
    },
  });
}
