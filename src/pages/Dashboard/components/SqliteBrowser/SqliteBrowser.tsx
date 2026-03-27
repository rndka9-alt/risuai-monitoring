import { useState, useRef, useCallback } from 'react';
import { useSqliteTables, useSqliteSchema, useSqliteQuery, useSyncStatus, useSyncTrigger } from '@/hooks/useSqlite';
import type { SqliteQueryResult, SqliteReadResult, SyncResult } from '@/types';

const WRITE_PATTERN = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE)\b/i;

function isWriteQuery(sql: string): boolean {
  return WRITE_PATTERN.test(sql.trim());
}

function truncateCell(value: unknown, maxLen = 120): string {
  if (value === null) return 'NULL';
  if (value === undefined) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

// --- Table List Sidebar ---

function TableList({
  onSelect,
  selected,
  onInsertTableName,
}: {
  onSelect: (table: string) => void;
  selected: string | null;
  onInsertTableName: (name: string) => void;
}) {
  const { data: tables, isLoading, error } = useSqliteTables();

  if (isLoading) return <div className="p-3 text-gray-600 text-xs">Loading tables...</div>;
  if (error) return <div className="p-3 text-red-400 text-xs">Error: {error.message}</div>;
  if (!tables || tables.length === 0) return <div className="p-3 text-gray-600 text-xs">No tables</div>;

  return (
    <div className="py-1">
      {tables.map((t) => (
        <button
          key={t.name}
          onClick={() => onSelect(t.name)}
          onDoubleClick={() => onInsertTableName(t.name)}
          title="Click: schema / Double-click: insert into editor"
          className={`w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer truncate ${
            selected === t.name
              ? 'bg-purple-500/20 text-purple-300'
              : 'text-gray-400 hover:bg-white/[0.03] hover:text-gray-200'
          }`}
        >
          <span className="text-gray-600 mr-1.5">{t.type === 'view' ? 'V' : 'T'}</span>
          {t.name}
        </button>
      ))}
    </div>
  );
}

// --- Schema Panel ---

function SchemaPanel({ table }: { table: string }) {
  const { data: schema, isLoading, error } = useSqliteSchema(table);

  if (isLoading) return <div className="p-3 text-gray-600 text-xs">Loading schema...</div>;
  if (error) return <div className="p-3 text-red-400 text-xs">{error.message}</div>;
  if (!schema) return null;

  return (
    <div className="border-b border-gray-800 px-4 py-3">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-sm font-medium text-gray-200">{schema.table}</span>
        <span className="text-xs text-gray-500">{schema.rowCount.toLocaleString()} rows</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 text-left">
            <th className="pr-3 pb-1 font-normal">#</th>
            <th className="pr-3 pb-1 font-normal">Column</th>
            <th className="pr-3 pb-1 font-normal">Type</th>
            <th className="pr-3 pb-1 font-normal">PK</th>
            <th className="pr-3 pb-1 font-normal">Not Null</th>
            <th className="pr-3 pb-1 font-normal">Default</th>
          </tr>
        </thead>
        <tbody>
          {schema.columns.map((col) => (
            <tr key={col.cid} className="text-gray-300 border-t border-gray-800/50">
              <td className="pr-3 py-0.5 text-gray-600">{col.cid}</td>
              <td className="pr-3 py-0.5 font-mono">
                {col.pk ? <span className="text-amber-400">{col.name}</span> : col.name}
              </td>
              <td className="pr-3 py-0.5 text-gray-500">{col.type || 'ANY'}</td>
              <td className="pr-3 py-0.5">{col.pk ? <span className="text-amber-500">PK</span> : ''}</td>
              <td className="pr-3 py-0.5">{col.notnull ? 'YES' : ''}</td>
              <td className="pr-3 py-0.5 text-gray-500 truncate max-w-32">{col.dflt_value ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {schema.indexes.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          Indexes: {schema.indexes.map((idx) => (
            <span key={idx.name} className="inline-block mr-2 text-gray-400">
              {idx.name}{idx.unique ? ' (unique)' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Results Table ---

function ResultsTable({ result }: { result: SqliteReadResult }) {
  const [expandedCell, setExpandedCell] = useState<{ row: number; col: string } | null>(null);

  if (result.rows.length === 0) {
    return <div className="p-4 text-gray-500 text-sm">No rows returned</div>;
  }

  return (
    <div className="overflow-auto scrollbar-hide">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-gray-900 z-10">
          <tr>
            <th className="px-2 py-1.5 text-left text-gray-500 font-normal border-b border-gray-700 w-10">#</th>
            {result.columns.map((col) => (
              <th key={col} className="px-2 py-1.5 text-left text-gray-400 font-medium border-b border-gray-700 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-800/30 hover:bg-white/[0.02]">
              <td className="px-2 py-1 text-gray-600 font-mono">{i + 1}</td>
              {result.columns.map((col) => {
                const val = row[col];
                const isNull = val === null;
                const isExpanded = expandedCell?.row === i && expandedCell.col === col;
                const full = isNull ? 'NULL' : (typeof val === 'string' ? val : JSON.stringify(val));
                const display = truncateCell(val);
                const isTruncated = display !== full;

                return (
                  <td
                    key={col}
                    onClick={isTruncated ? () => setExpandedCell(isExpanded ? null : { row: i, col }) : undefined}
                    className={`px-2 py-1 font-mono max-w-xs ${
                      isNull ? 'text-gray-600 italic' : 'text-gray-300'
                    } ${isTruncated ? 'cursor-pointer hover:text-gray-100' : ''}`}
                  >
                    {isExpanded ? (
                      <pre className="whitespace-pre-wrap text-[10px] text-gray-200 max-h-48 overflow-auto scrollbar-hide">
                        {full}
                      </pre>
                    ) : (
                      <span className="block truncate">{display}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Sync Panel ---

const HYDRATION_COLORS: Record<string, string> = {
  COLD: 'text-blue-400 bg-blue-500/10',
  WARMING: 'text-amber-400 bg-amber-500/10',
  HOT: 'text-green-400 bg-green-500/10',
};

function SyncPanel() {
  const { data: status } = useSyncStatus();
  const syncTrigger = useSyncTrigger();
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const handleSync = useCallback(() => {
    syncTrigger.mutate(undefined, {
      onSuccess: (result) => setLastResult(result),
    });
  }, [syncTrigger]);

  const colorClass = status ? (HYDRATION_COLORS[status.hydrationState] ?? 'text-gray-400') : 'text-gray-600';

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Hydration state badge */}
      {status && (
        <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${colorClass}`}>
          {status.hydrationState}
          {status.hydrationState === 'WARMING' && (
            <span className="text-gray-500 ml-1">
              ({status.capturedRemotes}/{status.expectedRemotes})
            </span>
          )}
        </span>
      )}

      {status && (
        <span className="text-[11px] text-gray-600">
          {status.capturedRemotes} remotes cached
        </span>
      )}

      {/* Sync trigger button */}
      <button
        onClick={handleSync}
        disabled={syncTrigger.isPending}
        className="text-[11px] px-2 py-0.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {syncTrigger.isPending ? 'Syncing...' : 'Sync Now'}
      </button>

      {/* Error */}
      {syncTrigger.isError && (
        <span className="text-[11px] text-red-400">
          {syncTrigger.error instanceof Error ? syncTrigger.error.message : 'Sync failed'}
        </span>
      )}

      {/* Last result */}
      {lastResult && !syncTrigger.isPending && (
        <SyncResultBadge result={lastResult} />
      )}
    </div>
  );
}

function SyncResultBadge({ result }: { result: SyncResult }) {
  if (result.skipped) {
    return <span className="text-[11px] text-amber-400">Skipped: {result.skipped}</span>;
  }

  const hasDrift = result.filesAdded > 0 || result.filesRemoved > 0
    || result.metaUpdated > 0 || result.dbBinDrift || result.remotesUpdated > 0;

  if (!hasDrift) {
    return <span className="text-[11px] text-green-400">No drift ({result.elapsedMs}ms)</span>;
  }

  const parts: string[] = [];
  if (result.filesAdded > 0) parts.push(`+${result.filesAdded} files`);
  if (result.filesRemoved > 0) parts.push(`-${result.filesRemoved} files`);
  if (result.metaUpdated > 0) parts.push(`${result.metaUpdated} meta`);
  if (result.dbBinDrift) parts.push('db.bin');
  if (result.remotesUpdated > 0) parts.push(`${result.remotesUpdated} remotes`);

  return (
    <span className="text-[11px] text-amber-400">
      Drift: {parts.join(', ')} ({result.elapsedMs}ms)
    </span>
  );
}

// --- Write Confirm Dialog ---

function WriteConfirmDialog({
  sql,
  onConfirm,
  onCancel,
}: {
  sql: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 max-w-lg w-full mx-4 shadow-xl">
        <h3 className="text-amber-400 font-medium mb-2">Write Operation Detected</h3>
        <p className="text-gray-400 text-sm mb-3">
          This query will modify the database. Are you sure?
        </p>
        <pre className="bg-gray-950 border border-gray-800 rounded p-3 text-xs text-gray-300 font-mono mb-4 max-h-32 overflow-auto whitespace-pre-wrap">
          {sql}
        </pre>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded transition-colors cursor-pointer"
          >
            Execute
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Query Result Info ---

function QueryResultInfo({ result }: { result: SqliteQueryResult }) {
  if (result.type === 'read') {
    return (
      <span className="text-xs text-gray-500">
        {result.totalRows} row{result.totalRows !== 1 ? 's' : ''}
        {result.truncated && <span className="text-amber-500"> (showing first 1000)</span>}
        {' '}in {result.elapsedMs}ms
      </span>
    );
  }
  return (
    <span className="text-xs text-gray-500">
      {result.changes} row{result.changes !== 1 ? 's' : ''} affected in {result.elapsedMs}ms
    </span>
  );
}

// --- Main Component ---

export function SqliteBrowser() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [sql, setSql] = useState('');
  const [pendingWriteSql, setPendingWriteSql] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<SqliteQueryResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryMutation = useSqliteQuery();

  const executeQuery = useCallback((sqlToRun: string) => {
    queryMutation.mutate(sqlToRun, {
      onSuccess: (result) => setQueryResult(result),
    });
  }, [queryMutation]);

  const handleExecute = useCallback(() => {
    const trimmed = sql.trim();
    if (!trimmed) return;

    if (isWriteQuery(trimmed)) {
      setPendingWriteSql(trimmed);
      return;
    }
    executeQuery(trimmed);
  }, [sql, executeQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  }, [handleExecute]);

  const handleTableSelect = useCallback((table: string) => {
    setSelectedTable((prev) => prev === table ? null : table);
  }, []);

  const handleInsertTableName = useCallback((name: string) => {
    setSql((prev) => {
      if (!prev.trim()) return `SELECT * FROM "${name}" LIMIT 100`;
      return prev + ` "${name}"`;
    });
    textareaRef.current?.focus();
  }, []);

  const handleQuickQuery = useCallback((table: string) => {
    const q = `SELECT * FROM "${table}" LIMIT 100`;
    setSql(q);
    executeQuery(q);
  }, [executeQuery]);

  return (
    <div className="flex h-full">
      {/* Sidebar — Table list */}
      <div className="w-52 shrink-0 border-r border-gray-800 overflow-y-auto scrollbar-hide">
        <div className="px-3 py-2 border-b border-gray-800 text-xs text-gray-500 font-medium">
          Tables
        </div>
        <TableList
          selected={selectedTable}
          onSelect={handleTableSelect}
          onInsertTableName={handleInsertTableName}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sync status bar */}
        <div className="shrink-0 px-4 py-2 border-b border-gray-800">
          <SyncPanel />
        </div>

        {/* Schema (collapsed when no table selected) */}
        {selectedTable && (
          <div className="shrink-0">
            <SchemaPanel table={selectedTable} />
            <div className="px-4 pb-2 border-b border-gray-800">
              <button
                onClick={() => handleQuickQuery(selectedTable)}
                className="text-[11px] text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
              >
                SELECT * FROM "{selectedTable}" LIMIT 100
              </button>
            </div>
          </div>
        )}

        {/* Query editor */}
        <div className="shrink-0 border-b border-gray-800 p-3">
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="SELECT * FROM table_name LIMIT 100"
              rows={3}
              spellCheck={false}
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 font-mono placeholder:text-gray-600 outline-hidden focus:border-purple-500/50 resize-y min-h-[4rem]"
            />
            <div className="flex flex-col gap-1.5">
              <button
                onClick={handleExecute}
                disabled={queryMutation.isPending || !sql.trim()}
                className="px-3 py-1.5 text-xs bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {queryMutation.isPending ? 'Running...' : 'Run'}
              </button>
              <span className="text-[10px] text-gray-600 text-center">
                {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
              </span>
            </div>
          </div>
        </div>

        {/* Error */}
        {queryMutation.isError && (
          <div className="shrink-0 px-4 py-2 bg-red-500/10 border-b border-red-500/20">
            <span className="text-xs text-red-400">
              {queryMutation.error instanceof Error ? queryMutation.error.message : 'Query failed'}
            </span>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {queryResult && (
            <>
              <div className="sticky top-0 bg-gray-950 px-4 py-2 border-b border-gray-800 z-10">
                <QueryResultInfo result={queryResult} />
              </div>
              {queryResult.type === 'read' ? (
                <ResultsTable result={queryResult} />
              ) : (
                <div className="p-4 text-sm text-gray-300">
                  {queryResult.changes} row{queryResult.changes !== 1 ? 's' : ''} affected
                  {queryResult.lastInsertRowid ? `, last rowid: ${queryResult.lastInsertRowid}` : ''}
                </div>
              )}
            </>
          )}

          {!queryResult && !queryMutation.isPending && (
            <div className="flex items-center justify-center h-full">
              <span className="text-gray-600 text-sm">
                {selectedTable ? 'Run a query to see results' : 'Select a table or run a query'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Write confirm dialog */}
      {pendingWriteSql && (
        <WriteConfirmDialog
          sql={pendingWriteSql}
          onConfirm={() => {
            executeQuery(pendingWriteSql);
            setPendingWriteSql(null);
          }}
          onCancel={() => setPendingWriteSql(null)}
        />
      )}
    </div>
  );
}
