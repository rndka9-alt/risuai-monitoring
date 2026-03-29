import { useState, useEffect, useCallback } from 'react';
import { useInlayAssets } from '@/hooks/useInlayAssets';

function inlayImageUrl(id: string): string {
  return `/api/inlay/assets/${encodeURIComponent(id)}`;
}

function ImageModal({ id, onClose }: { id: string; onClose: () => void }) {
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
      <img
        src={inlayImageUrl(id)}
        alt={id}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
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

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

export function InlayGallery() {
  const { data: assetIds, isLoading, error } = useInlayAssets();
  const [columns, setColumns] = useState(3);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        <span className="text-xs text-gray-400">
          {assetIds.length} images
        </span>
        <ColumnSelector value={columns} onChange={setColumns} />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
        <div className={`grid ${GRID_COLS[columns]} gap-3`}>
          {assetIds.map((id) => (
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
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-gray-300 truncate block">
                  {id}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedId && <ImageModal id={selectedId} onClose={closeModal} />}
    </div>
  );
}
