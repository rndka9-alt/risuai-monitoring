import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAssetValidator } from '@/hooks/useAssetValidator';
import { useCharacterDelete } from '@/hooks/useSqlite';
import type { CharacterIssues, ModuleIssues, AssetIssue, CharacterDeleteResult } from '@/types';

type FilterMode = 'missing-only' | 'all';

function fieldLabel(field: string): string {
  if (field.startsWith('template:')) return `template (${field.slice(9)})`;
  return field;
}

// --- Toast ---

interface ToastState {
  message: string;
  type: 'success' | 'warn' | 'error';
}

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const colorMap = {
    success: 'bg-green-500/20 text-green-300 border-green-500/30',
    warn: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    error: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg border text-sm shadow-lg ${colorMap[toast.type]}`}>
      {toast.message}
    </div>
  );
}

// --- Delete Confirm Dialog ---

function DeleteConfirmDialog({
  characters,
  onConfirm,
  onCancel,
  isPending,
}: {
  characters: Array<{ characterId: string; characterName: string }>;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 max-w-lg w-full mx-4 shadow-xl">
        <h3 className="text-red-400 font-medium mb-2">Delete {characters.length} Character{characters.length > 1 ? 's' : ''}</h3>
        <p className="text-gray-400 text-sm mb-3">
          This will remove files from RisuAI and soft-delete all related data.
        </p>
        <div className="bg-gray-950 border border-gray-800 rounded p-3 text-xs font-mono text-gray-300 mb-4 max-h-40 overflow-y-auto scrollbar-hide space-y-1">
          {characters.map((c) => (
            <div key={c.characterId} className="truncate">
              <span className="text-gray-500">-</span> {c.characterName} <span className="text-gray-600">({c.characterId})</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors cursor-pointer disabled:opacity-40"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function SummaryBar({
  totalCharacters,
  totalAssets,
  totalMissing,
  scannedAt,
  onRefresh,
  isLoading,
  selectedCount,
  onDeleteSelected,
}: {
  totalCharacters: number;
  totalAssets: number;
  totalMissing: number;
  scannedAt: number;
  onRefresh: () => void;
  isLoading: boolean;
  selectedCount: number;
  onDeleteSelected: () => void;
}) {
  const time = new Date(scannedAt).toLocaleTimeString();

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Characters</span>
          <span className="text-sm text-gray-200">{totalCharacters}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Assets</span>
          <span className="text-sm text-gray-200">{totalAssets}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Missing</span>
          <span
            className={`text-sm font-medium ${
              totalMissing > 0 ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {totalMissing}
          </span>
        </div>
        <span className="text-[10px] text-gray-600">scanned {time}</span>
      </div>
      <div className="flex items-center gap-2">
        {selectedCount > 0 && (
          <button
            onClick={onDeleteSelected}
            className="text-[11px] px-3 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
          >
            Delete {selectedCount} selected
          </button>
        )}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-[11px] px-3 py-1 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          {isLoading ? 'Scanning...' : 'Re-scan'}
        </button>
      </div>
    </div>
  );
}

function IssueRow({ issue }: { issue: AssetIssue }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 text-[11px] hover:bg-gray-800/50 rounded">
      <span className="shrink-0 w-5 text-center text-red-400">✕</span>
      <span className="shrink-0 w-32 text-gray-500 truncate" title={issue.field}>
        {fieldLabel(issue.field)}
      </span>
      <span className="shrink-0 w-40 text-gray-300 truncate" title={issue.assetName}>
        {issue.assetName}
      </span>
      <span
        className="flex-1 text-gray-600 truncate font-mono"
        title={issue.assetPath || '(unresolved)'}
      >
        {issue.assetPath || '(unresolved)'}
      </span>
    </div>
  );
}

function CharacterCard({
  character,
  selected,
  onToggleSelect,
}: {
  character: CharacterIssues;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMissing = character.issues.length > 0;

  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${
      selected ? 'border-red-500/40 bg-red-500/[0.03]' : 'border-gray-800'
    }`}>
      <div className="flex items-center gap-1 px-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="shrink-0 accent-red-500 cursor-pointer"
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-3 px-2 py-2.5 text-left hover:bg-gray-800/50 transition-colors"
        >
          <span
            className={`text-[10px] transition-transform ${expanded ? 'rotate-90' : ''}`}
          >
            ▶
          </span>
          <span className="text-sm text-gray-200 truncate flex-1">
            {character.characterName}
          </span>
          <span className="text-[10px] text-gray-600 shrink-0">
            {character.type}
          </span>
          {hasMissing ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 shrink-0">
              {character.issues.length} missing
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 shrink-0">
              OK ({character.totalAssets})
            </span>
          )}
        </button>
      </div>

      {expanded && hasMissing && (
        <div className="border-t border-gray-800 px-2 py-1.5 space-y-0.5 bg-gray-900/50">
          <div className="flex items-center gap-3 px-3 py-1 text-[10px] text-gray-600">
            <span className="w-5" />
            <span className="w-32">Field</span>
            <span className="w-40">Asset Name</span>
            <span className="flex-1">Path</span>
          </div>
          {character.issues.map((issue, i) => (
            <IssueRow key={i} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleCard({ module }: { module: ModuleIssues }) {
  const [expanded, setExpanded] = useState(false);
  const hasMissing = module.issues.length > 0;

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-800/50 transition-colors"
      >
        <span
          className={`text-[10px] transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          ▶
        </span>
        <span className="text-sm text-purple-300 truncate flex-1">
          {module.moduleName}
        </span>
        <span className="text-[10px] text-gray-600 shrink-0">module</span>
        {hasMissing ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 shrink-0">
            {module.issues.length} missing
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 shrink-0">
            OK ({module.totalAssets})
          </span>
        )}
      </button>

      {expanded && hasMissing && (
        <div className="border-t border-gray-800 px-2 py-1.5 space-y-0.5 bg-gray-900/50">
          <div className="flex items-center gap-3 px-3 py-1 text-[10px] text-gray-600">
            <span className="w-5" />
            <span className="w-32">Field</span>
            <span className="w-40">Asset Name</span>
            <span className="flex-1">Path</span>
          </div>
          {module.issues.map((issue, i) => (
            <IssueRow key={i} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterToggle({
  value,
  onChange,
  missingCount,
  totalCount,
}: {
  value: FilterMode;
  onChange: (v: FilterMode) => void;
  missingCount: number;
  totalCount: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange('all')}
        className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
          value === 'all'
            ? 'bg-gray-700 text-gray-200'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        All ({totalCount})
      </button>
      <button
        onClick={() => onChange('missing-only')}
        className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
          value === 'missing-only'
            ? 'bg-red-500/30 text-red-300'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        Missing only ({missingCount})
      </button>
    </div>
  );
}

// --- Main ---

export function AssetValidator() {
  const [started, setStarted] = useState(false);
  const { data, isLoading, error, isFetching } = useAssetValidator(started);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterMode>('missing-only');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Array<{ characterId: string; characterName: string }> | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const deleteMutation = useCharacterDelete();

  const handleStart = useCallback(() => {
    if (started) {
      queryClient.invalidateQueries({ queryKey: ['asset-validator'] });
    } else {
      setStarted(true);
    }
  }, [started, queryClient]);

  const showToast = useCallback((message: string, type: ToastState['type']) => {
    setToast({ message, type });
  }, []);

  const toggleSelect = useCallback((charId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(charId)) next.delete(charId);
      else next.add(charId);
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!data || selectedIds.size === 0) return;
    const targets = data.characters
      .filter((c) => selectedIds.has(c.characterId))
      .map((c) => ({ characterId: c.characterId, characterName: c.characterName }));
    if (targets.length > 0) setPendingDelete(targets);
  }, [data, selectedIds]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete || pendingDelete.length === 0) return;

    const results: CharacterDeleteResult[] = [];
    for (const target of pendingDelete) {
      try {
        const result = await deleteMutation.mutateAsync(target.characterId);
        results.push(result);
      } catch (err) {
        results.push({
          ok: false,
          charId: target.characterId,
          fileRemoved: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    setPendingDelete(null);

    const succeeded = results.filter((r) => r.ok);
    const noFile = succeeded.filter((r) => !r.fileRemoved);
    const failed = results.filter((r) => !r.ok);

    if (failed.length > 0) {
      showToast(`${failed.length} failed: ${failed[0].error}`, 'error');
    } else if (noFile.length > 0 && noFile.length === succeeded.length) {
      showToast('DB data deleted, but files were already gone', 'warn');
    } else if (noFile.length > 0) {
      showToast(`${succeeded.length} deleted (${noFile.length} had no file on disk)`, 'warn');
    } else {
      showToast(`${succeeded.length} character${succeeded.length > 1 ? 's' : ''} deleted`, 'success');
    }

    // 삭제된 항목 선택 해제
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of succeeded) next.delete(r.charId);
      return next;
    });

    queryClient.invalidateQueries({ queryKey: ['asset-validator'] });
  }, [pendingDelete, deleteMutation, showToast, queryClient]);

  const { filteredCharacters, filteredModules, charWithIssues, modWithIssues } =
    useMemo(() => {
      if (!data) {
        return {
          filteredCharacters: [],
          filteredModules: [],
          charWithIssues: 0,
          modWithIssues: 0,
        };
      }

      const charIssued = data.characters.filter((c) => c.issues.length > 0);
      const modIssued = data.modules.filter((m) => m.issues.length > 0);

      return {
        filteredCharacters:
          filter === 'missing-only' ? charIssued : data.characters,
        filteredModules: filter === 'missing-only' ? modIssued : data.modules,
        charWithIssues: charIssued.length,
        modWithIssues: modIssued.length,
      };
    }, [data, filter]);

  // Initial state: show scan button
  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-gray-500 text-sm">
          Scan character cards and modules for missing asset references.
        </p>
        <button
          onClick={handleStart}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm transition-colors"
        >
          Start Scan
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-gray-500 text-sm">Scanning assets...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-red-400 text-sm">
          Scan failed: {error instanceof Error ? error.message : 'unknown error'}
        </span>
      </div>
    );
  }

  if (!data) return null;

  const totalEntries = data.characters.length + data.modules.length;
  const totalWithIssues = charWithIssues + modWithIssues;

  return (
    <div className="h-full flex flex-col">
      <SummaryBar
        totalCharacters={data.totalCharacters}
        totalAssets={data.totalAssets}
        totalMissing={data.totalMissing}
        scannedAt={data.scannedAt}
        onRefresh={handleStart}
        isLoading={isFetching}
        selectedCount={selectedIds.size}
        onDeleteSelected={handleDeleteSelected}
      />

      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <FilterToggle
          value={filter}
          onChange={setFilter}
          missingCount={totalWithIssues}
          totalCount={totalEntries}
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-2">
        {filteredCharacters.length === 0 && filteredModules.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-600 text-sm">
              {data.totalMissing === 0
                ? 'All assets verified — no issues found.'
                : 'No items match the current filter.'}
            </span>
          </div>
        ) : (
          <>
            {filteredCharacters.map((char) => (
              <CharacterCard
                key={char.characterId}
                character={char}
                selected={selectedIds.has(char.characterId)}
                onToggleSelect={() => toggleSelect(char.characterId)}
              />
            ))}
            {filteredModules.map((mod) => (
              <ModuleCard key={mod.moduleId} module={mod} />
            ))}
          </>
        )}
      </div>

      {/* Delete confirm dialog */}
      {pendingDelete && (
        <DeleteConfirmDialog
          characters={pendingDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPendingDelete(null)}
          isPending={deleteMutation.isPending}
        />
      )}

      {/* Toast */}
      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
