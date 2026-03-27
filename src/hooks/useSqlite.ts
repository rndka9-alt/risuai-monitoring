import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  SqliteTable,
  SqliteSchemaResponse,
  SqliteQueryResult,
  SyncStatus,
  SyncResult,
} from '@/types';

export function useSqliteTables() {
  return useQuery({
    queryKey: ['sqlite', 'tables'],
    queryFn: async (): Promise<SqliteTable[]> => {
      const res = await fetch('/api/sqlite/tables');
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data: unknown = await res.json();
      if (typeof data !== 'object' || data === null || !('tables' in data)) return [];
      return (data as { tables: SqliteTable[] }).tables;
    },
    staleTime: 30_000,
  });
}

export function useSqliteSchema(table: string | null) {
  return useQuery({
    queryKey: ['sqlite', 'schema', table],
    queryFn: async (): Promise<SqliteSchemaResponse> => {
      const res = await fetch(`/api/sqlite/schema/${encodeURIComponent(table!)}`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    },
    enabled: table !== null,
    staleTime: 30_000,
  });
}

export function useSqliteQuery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sql: string): Promise<SqliteQueryResult> => {
      const res = await fetch('/api/sqlite/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => ({}));
        const message = typeof body === 'object' && body !== null && 'error' in body
          ? String((body as { error: unknown }).error)
          : `${res.status} ${res.statusText}`;
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: (result) => {
      // write 쿼리 후 테이블/스키마 캐시 갱신
      if (result.type === 'write') {
        queryClient.invalidateQueries({ queryKey: ['sqlite'] });
      }
    },
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync', 'status'],
    queryFn: async (): Promise<SyncStatus> => {
      const res = await fetch('/api/sync/status');
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    },
    refetchInterval: 10_000,
  });
}

export function useSyncTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<SyncResult> => {
      const res = await fetch('/api/sync/trigger', { method: 'POST' });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => ({}));
        const message = typeof body === 'object' && body !== null && 'error' in body
          ? String((body as { error: unknown }).error)
          : `${res.status} ${res.statusText}`;
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['sqlite'] });
    },
  });
}
