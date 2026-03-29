import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAssetValidator } from '@/hooks/useAssetValidator';
import type { CharacterIssues, ModuleIssues, AssetIssue } from '@/types';

type FilterMode = 'missing-only' | 'all';

function fieldLabel(field: string): string {
  if (field.startsWith('template:')) return `template (${field.slice(9)})`;
  return field;
}

function SummaryBar({
  totalCharacters,
  totalAssets,
  totalMissing,
  scannedAt,
  onRefresh,
  isLoading,
}: {
  totalCharacters: number;
  totalAssets: number;
  totalMissing: number;
  scannedAt: number;
  onRefresh: () => void;
  isLoading: boolean;
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
      <button
        onClick={onRefresh}
        disabled={isLoading}
        className="text-[11px] px-3 py-1 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-40"
      >
        {isLoading ? 'Scanning...' : 'Re-scan'}
      </button>
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
  defaultExpanded,
}: {
  character: CharacterIssues;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasMissing = character.issues.length > 0;

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

function ModuleCard({
  module,
  defaultExpanded,
}: {
  module: ModuleIssues;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
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

export function AssetValidator() {
  const [started, setStarted] = useState(false);
  const { data, isLoading, error, isFetching } = useAssetValidator(started);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterMode>('missing-only');

  const handleStart = useCallback(() => {
    if (started) {
      queryClient.invalidateQueries({ queryKey: ['asset-validator'] });
    } else {
      setStarted(true);
    }
  }, [started, queryClient]);

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
                defaultExpanded={char.issues.length > 0 && char.issues.length <= 10}
              />
            ))}
            {filteredModules.map((mod) => (
              <ModuleCard
                key={mod.moduleId}
                module={mod}
                defaultExpanded={mod.issues.length > 0 && mod.issues.length <= 10}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
