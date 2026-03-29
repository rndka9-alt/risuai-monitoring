import { useState, useEffect, useCallback, useMemo } from 'react';
import { useInlayAssets, useInlayBookmarks, useToggleBookmark } from '@/hooks/useInlayAssets';

function inlayImageUrl(id: string): string {
  return `/api/inlay/assets/${encodeURIComponent(id)}`;
}

function BookmarkButton({
  bookmarked,
  onClick,
}: {
  bookmarked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full transition-all ${
        bookmarked
          ? 'bg-pink-500/80 text-white'
          : 'bg-black/50 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-pink-300'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={bookmarked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        className="w-4 h-4"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}

function ImageModal({
  id,
  bookmarked,
  onClose,
  onToggleBookmark,
}: {
  id: string;
  bookmarked: boolean;
  onClose: () => void;
  onToggleBookmark: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <img
          src={inlayImageUrl(id)}
          alt={id}
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        />
        <button
          onClick={onToggleBookmark}
          className={`absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full transition-all ${
            bookmarked
              ? 'bg-pink-500/80 text-white hover:bg-pink-500'
              : 'bg-black/60 text-gray-300 hover:text-pink-300'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill={bookmarked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={2}
            className="w-5 h-5"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ColumnSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-gray-500">Columns</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`w-6 h-6 text-[11px] rounded transition-colors ${
            value === n
              ? 'bg-pink-500/30 text-pink-300 border border-pink-500/50'
              : 'bg-gray-800 text-gray-500 hover:text-gray-300 border border-gray-700'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

type FilterMode = 'all' | 'bookmarked';

function FilterToggle({
  value,
  onChange,
  bookmarkCount,
}: {
  value: FilterMode;
  onChange: (v: FilterMode) => void;
  bookmarkCount: number;
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
        All
      </button>
      <button
        onClick={() => onChange('bookmarked')}
        className={`text-[11px] px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
          value === 'bookmarked'
            ? 'bg-pink-500/30 text-pink-300'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {bookmarkCount}
      </button>
    </div>
  );
}

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

export function InlayGallery() {
  const { data: assetIds, isLoading, error } = useInlayAssets();
  const { data: bookmarkedIds } = useInlayBookmarks();
  const toggleBookmark = useToggleBookmark();
  const [columns, setColumns] = useState(3);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');

  const bookmarkSet = useMemo(
    () => new Set(bookmarkedIds ?? []),
    [bookmarkedIds],
  );

  const filteredIds = useMemo(() => {
    if (!assetIds) return [];
    if (filter === 'bookmarked') return assetIds.filter((id) => bookmarkSet.has(id));
    return assetIds;
  }, [assetIds, filter, bookmarkSet]);

  const closeModal = useCallback(() => setSelectedId(null), []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-gray-500 text-sm">Loading inlay assets...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-red-400 text-sm">
          Failed to load assets: {error instanceof Error ? error.message : 'unknown error'}
        </span>
      </div>
    );
  }

  if (!assetIds || assetIds.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-gray-600 text-sm">No inlay images found</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {filteredIds.length}{filter === 'bookmarked' ? `/${assetIds.length}` : ''} images
          </span>
          <FilterToggle
            value={filter}
            onChange={setFilter}
            bookmarkCount={bookmarkSet.size}
          />
        </div>
        <ColumnSelector value={columns} onChange={setColumns} />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
        {filteredIds.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-600 text-sm">No bookmarked images</span>
          </div>
        ) : (
          <div className={`grid ${GRID_COLS[columns]} gap-3`}>
            {filteredIds.map((id) => (
              <button
                key={id}
                onClick={() => setSelectedId(id)}
                className="group relative aspect-square rounded-lg overflow-hidden border border-gray-800 hover:border-pink-500/40 transition-colors bg-gray-900"
              >
                <img
                  src={inlayImageUrl(id)}
                  alt={id}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <BookmarkButton
                  bookmarked={bookmarkSet.has(id)}
                  onClick={() => toggleBookmark.mutate(id)}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-gray-300 truncate block">
                    {id}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedId && (
        <ImageModal
          id={selectedId}
          bookmarked={bookmarkSet.has(selectedId)}
          onClose={closeModal}
          onToggleBookmark={() => toggleBookmark.mutate(selectedId)}
        />
      )}
    </div>
  );
}
