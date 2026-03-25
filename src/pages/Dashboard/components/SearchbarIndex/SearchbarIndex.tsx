import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { JsonTree } from '@/components/JsonTree';

interface IndexEntry {
  displayText: string;
  searchText: string;
  menuButtonIdx: number;
  menuLabel: string;
  subIdx: number;
  subLabel: string;
  accordionPath: string[];
}

interface IndexResponse {
  entries: IndexEntry[];
  cachedAt: number;
  age: number | null;
}

interface ScoredEntry {
  entry: IndexEntry;
  score: number;
}

function tokenMatches(token: string, text: string): boolean {
  return text.includes(token);
}

function scoreEntry(entry: IndexEntry, query: string, tokens: string[]): number {
  const display = entry.displayText.toLowerCase();
  const full = entry.searchText.toLowerCase();
  const path = `${entry.menuLabel} ${entry.subLabel}`.toLowerCase();
  const all = `${display} ${full} ${path}`;

  if (!tokens.every((tok) => tokenMatches(tok, all))) return 0;

  let score = 0;
  if (display.includes(query)) score += 100;
  if (full.includes(query)) score += 50;
  for (const tok of tokens) {
    if (tokenMatches(tok, display)) score += 20;
    if (tokenMatches(tok, full)) score += 10;
    if (tokenMatches(tok, path)) score += 5;
  }
  return score;
}

function searchEntries(entries: IndexEntry[], query: string): ScoredEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored: ScoredEntry[] = [];
  for (const entry of entries) {
    const score = scoreEntry(entry, q, tokens);
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function EntryPath({ entry }: { entry: IndexEntry }) {
  const parts = [entry.menuLabel, entry.subLabel, ...entry.accordionPath].filter(Boolean);
  return (
    <span className="text-gray-500 text-[10px]">
      {parts.join(' › ')}
    </span>
  );
}

export function SearchbarIndex() {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'search' | 'tree' | 'raw'>('search');
  const [selectedEntry, setSelectedEntry] = useState<IndexEntry | null>(null);

  const { data, isLoading, error, refetch } = useQuery<IndexResponse>({
    queryKey: ['searchbar-index'],
    queryFn: () => fetch('/api/searchbar/index').then((r) => r.json()),
    staleTime: 30_000,
  });

  const entries = data?.entries ?? [];
  const results = searchEntries(entries, query);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-800 flex items-center gap-3">
        <span className="text-sm text-gray-400">
          {entries.length} entries indexed
          {data?.age != null && (
            <span className="text-gray-600 ml-1">
              ({data.age}s ago)
            </span>
          )}
        </span>
        <button
          onClick={() => { refetch(); }}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
        >
          refresh
        </button>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setViewMode('search')}
            className={`text-xs px-2 py-1 rounded cursor-pointer ${viewMode === 'search' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Search
          </button>
          <button
            onClick={() => setViewMode('tree')}
            className={`text-xs px-2 py-1 rounded cursor-pointer ${viewMode === 'tree' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Tree
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`text-xs px-2 py-1 rounded cursor-pointer ${viewMode === 'raw' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Raw
          </button>
        </div>
      </div>

      {/* Search input */}
      <div className="shrink-0 px-4 py-2 border-b border-gray-800">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Test search query..."
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder:text-gray-600 outline-hidden focus:border-amber-500/50"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {isLoading && (
          <div className="p-4 text-gray-600 text-sm">Loading index...</div>
        )}

        {error && (
          <div className="p-4 text-red-400 text-sm">
            Failed to fetch index: {error instanceof Error ? error.message : 'unknown'}
          </div>
        )}

        {!isLoading && !error && viewMode === 'tree' && (
          <div className="p-4">
            <JsonTree data={entries} defaultExpandLevel={0} />
          </div>
        )}

        {!isLoading && !error && viewMode === 'raw' && (
          <pre className="p-4 text-[11px] font-mono text-gray-300 whitespace-pre-wrap select-all">
            {JSON.stringify(entries, null, 2)}
          </pre>
        )}

        {!isLoading && !error && viewMode === 'search' && (
          <>
            {query && results.length === 0 && (
              <div className="p-4 text-gray-600 text-sm">No results</div>
            )}

            {!query && (
              <div className="p-4 text-gray-600 text-sm">
                Type a query to test search matching
              </div>
            )}

            {results.length > 0 && (
              <div className="divide-y divide-gray-800/50">
                {results.map((r, i) => (
                  <button
                    key={`${r.entry.menuButtonIdx}-${r.entry.subIdx}-${r.entry.displayText}-${i}`}
                    onClick={() => setSelectedEntry(
                      selectedEntry === r.entry ? null : r.entry,
                    )}
                    className="w-full text-left px-4 py-2 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-gray-200 shrink-0">
                        {r.entry.displayText}
                      </span>
                      <EntryPath entry={r.entry} />
                      <span className="ml-auto text-[10px] text-amber-500/60 shrink-0">
                        score: {r.score}
                      </span>
                    </div>
                    {selectedEntry === r.entry && (
                      <div className="mt-2 mb-1">
                        <JsonTree data={r.entry} defaultExpandLevel={2} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
