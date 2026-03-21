import { useState } from 'react';
import { useStreams } from '@/hooks/useStreams';
import type { StreamEntry } from '@/types';

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatTextLength(length: number): string {
  if (length < 1000) return `${length}`;
  return `${(length / 1000).toFixed(1)}k`;
}

function extractProvider(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes('openai')) return 'OpenAI';
    if (hostname.includes('anthropic')) return 'Anthropic';
    if (hostname.includes('google') || hostname.includes('generativelanguage')) return 'Google';
    if (hostname.includes('openrouter')) return 'OpenRouter';
    return hostname;
  } catch {
    return 'unknown';
  }
}

function formatTimeAgo(completedAt: number): string {
  const ago = Math.floor((Date.now() - completedAt) / 1000);
  if (ago < 60) return `${ago}s ago`;
  if (ago < 3600) return `${Math.floor(ago / 60)}m ago`;
  return `${Math.floor(ago / 3600)}h ago`;
}

function StreamRow({
  stream,
  isActive,
}: {
  stream: StreamEntry;
  isActive: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-800/50 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-3 px-3 py-1.5 text-xs w-full text-left hover:bg-white/[0.02] transition-colors ${
          isActive ? '' : 'opacity-50'
        }`}
      >
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${
            isActive
              ? 'bg-green-500 animate-pulse'
              : stream.status === 'failed'
                ? 'bg-red-500'
                : 'bg-gray-500'
          }`}
        />
        <span className="text-gray-400 tabular-nums shrink-0">
          {isActive
            ? formatElapsed(stream.elapsedMs)
            : stream.completedAt
              ? formatTimeAgo(stream.completedAt)
              : formatElapsed(stream.elapsedMs)}
        </span>
        <span className="text-gray-300 truncate min-w-0">
          {stream.targetCharId ?? 'unknown'}
        </span>
        {stream.model && (
          <span className="text-gray-500 text-[11px] shrink-0">
            {stream.model}
          </span>
        )}
        <span className="text-gray-500 tabular-nums ml-auto shrink-0">
          {formatTextLength(stream.textLength)} chars
          {!isActive && (
            <span className="ml-1.5">
              ({formatElapsed(stream.elapsedMs)})
            </span>
          )}
        </span>
        <span className="text-gray-600 shrink-0">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-1.5">
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
            {stream.model && (
              <div>
                <span className="text-gray-500">Model </span>
                <span className="text-gray-300">{stream.model}</span>
              </div>
            )}
            {stream.targetUrl && (
              <div>
                <span className="text-gray-500">Provider </span>
                <span className="text-gray-300">
                  {extractProvider(stream.targetUrl)}
                </span>
              </div>
            )}
            <div>
              <span className="text-gray-500">
                {isActive ? 'Elapsed' : 'Duration'}{' '}
              </span>
              <span className="text-gray-300">
                {formatElapsed(stream.elapsedMs)}
              </span>
            </div>
            {stream.messageCount > 0 && (
              <div>
                <span className="text-gray-500">Messages </span>
                <span className="text-gray-300">{stream.messageCount}</span>
              </div>
            )}
            {stream.imageCount > 0 && (
              <div>
                <span className="text-gray-500">Images </span>
                <span className="text-amber-300">{stream.imageCount}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Output </span>
              <span className="text-gray-300">
                {formatTextLength(stream.textLength)} chars
              </span>
            </div>
            <div>
              <span className="text-gray-500">Char </span>
              <span className="text-gray-300">
                {stream.targetCharId ?? 'N/A'}
              </span>
            </div>
            {stream.status === 'failed' && (
              <div>
                <span className="text-red-400">Failed</span>
              </div>
            )}
          </div>

          {stream.requestBody && (
            <div>
              <div className="text-[11px] text-gray-500 mb-0.5">
                Request Body
                {stream.imageCount > 0 && (
                  <span className="text-amber-400 ml-1">
                    +{stream.imageCount} image{stream.imageCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <pre className="text-[11px] text-gray-400 bg-gray-950 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                {stream.requestBody}
              </pre>
            </div>
          )}

          {stream.outputPreview && (
            <div>
              <div className="text-[11px] text-gray-500 mb-0.5">Output</div>
              <pre className="text-[11px] text-gray-400 bg-gray-950 rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                {stream.outputPreview}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ActiveStreams() {
  const { data } = useStreams();

  const active = data?.active ?? [];
  const recent = data?.recent ?? [];
  const hasActive = active.length > 0;
  const hasRecent = recent.length > 0;

  if (!hasActive && !hasRecent) return null;

  return (
    <div className="px-4 py-2">
      <div className="rounded-lg bg-gray-900 border border-purple-500/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800">
          <span className="text-xs font-medium text-purple-300">
            LLM Streams
          </span>
          {hasActive && (
            <span className="text-xs text-green-400 tabular-nums">
              {active.length} active
            </span>
          )}
          {hasRecent && (
            <span className="text-xs text-gray-500 tabular-nums">
              {recent.length} recent
            </span>
          )}
        </div>
        {active.map((stream) => (
          <StreamRow key={stream.id} stream={stream} isActive />
        ))}
        {recent.map((stream) => (
          <StreamRow key={stream.id} stream={stream} isActive={false} />
        ))}
      </div>
    </div>
  );
}
