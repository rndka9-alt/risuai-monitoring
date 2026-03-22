import { useState, useMemo } from 'react';
import { useStreams } from '@/hooks/useStreams';
import { useStreamImages } from '@/hooks/useStreamImages';
import { useStreamResponseBody } from '@/hooks/useStreamResponseBody';
import { JsonTree } from '@/components/JsonTree';
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

function CollapsibleSection({ label, children, extra }: { label: string; children: React.ReactNode; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 mb-0.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>{label}</span>
        {extra}
      </button>
      {open && children}
    </div>
  );
}

function RequestBody({ raw }: { raw: string }) {
  const [showRaw, setShowRaw] = useState(false);
  const parsed = useMemo(() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [raw]);

  return (
    <CollapsibleSection
      label="Request Body"
      extra={parsed ? (
        <button
          onClick={(e) => { e.stopPropagation(); setShowRaw(!showRaw); }}
          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
        >
          {showRaw ? 'Tree' : 'Raw'}
        </button>
      ) : undefined}
    >
      <div className="bg-gray-950 rounded p-2 max-h-48 overflow-y-auto scrollbar-hide">
        {parsed && !showRaw ? (
          <JsonTree data={parsed} defaultExpandLevel={1} />
        ) : (
          <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-words leading-relaxed">
            {parsed ? JSON.stringify(parsed, null, 2) : raw}
          </pre>
        )}
      </div>
    </CollapsibleSection>
  );
}

function StreamImages({ streamId }: { streamId: string }) {
  const { data: images, isLoading } = useStreamImages(streamId);

  if (isLoading) {
    return <div className="text-[11px] text-gray-600">Loading images...</div>;
  }

  if (!images || images.length === 0) return null;

  const inputImages = images.filter((img) => !img.isOutput);
  const outputImages = images.filter((img) => img.isOutput);

  return (
    <>
      {inputImages.length > 0 && (
        <div>
          <div className="text-[11px] text-gray-500 mb-1">
            Input Images ({inputImages.length})
          </div>
          <div className="flex gap-2 flex-wrap">
            {inputImages.map((img, i) => (
              <img
                key={`in-${i}`}
                src={`data:${img.mediaType};base64,${img.data}`}
                alt={`Input image ${i + 1}`}
                className="max-h-32 max-w-48 rounded border border-gray-700 object-contain bg-gray-950"
              />
            ))}
          </div>
        </div>
      )}
      {outputImages.length > 0 && (
        <div>
          <div className="text-[11px] text-gray-500 mb-1">
            Output Image
          </div>
          <div className="flex gap-2 flex-wrap">
            {outputImages.map((img, i) => (
              <img
                key={`out-${i}`}
                src={`data:${img.mediaType};base64,${img.data}`}
                alt={`Output image ${i + 1}`}
                className="max-h-48 max-w-64 rounded border border-purple-500/30 object-contain bg-gray-950"
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ResponseBody({ streamId }: { streamId: string }) {
  const { data, isLoading } = useStreamResponseBody(streamId);
  const [showRaw, setShowRaw] = useState(false);

  const parsed = useMemo(() => {
    if (!data) return null;
    if (data.contentType.includes('text/event-stream')) return null;
    try {
      return JSON.parse(data.body);
    } catch {
      return null;
    }
  }, [data]);

  if (isLoading) {
    return <div className="text-[11px] text-gray-600">Loading response body...</div>;
  }

  if (!data) return null;

  return (
    <CollapsibleSection
      label="Response Body"
      extra={
        <>
          <span className="text-[10px] text-gray-600">{data.contentType}</span>
          {parsed && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowRaw(!showRaw); }}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
            >
              {showRaw ? 'Tree' : 'Raw'}
            </button>
          )}
        </>
      }
    >
      <div className="bg-gray-950 rounded p-2 max-h-48 overflow-y-auto scrollbar-hide">
        {parsed && !showRaw ? (
          <JsonTree data={parsed} defaultExpandLevel={1} />
        ) : (
          <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-words leading-relaxed">
            {parsed ? JSON.stringify(parsed, null, 2) : data.body}
          </pre>
        )}
      </div>
    </CollapsibleSection>
  );
}

function StreamRow({
  stream,
  isActive,
  expanded,
  onToggle,
}: {
  stream: StreamEntry;
  isActive: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {

  return (
    <div className="border-b border-gray-800/50 last:border-b-0">
      <button
        onClick={onToggle}
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
                : stream.status === 'cached'
                  ? 'bg-blue-400'
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
          {stream.outputTokens > 0
            ? `${stream.outputTokens.toLocaleString()} tok`
            : `${formatTextLength(stream.outputPreview.length)} chars`}
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
            {stream.outputTokens > 0 && (
              <div>
                <span className="text-gray-500">Tokens </span>
                <span className="text-gray-300">{stream.outputTokens.toLocaleString()}</span>
              </div>
            )}
            {stream.finishReason && (
              <div>
                <span className="text-gray-500">Finish </span>
                <span className={
                  stream.finishReason === 'stop' || stream.finishReason === 'end_turn' || stream.finishReason === 'STOP'
                    ? 'text-gray-300'
                    : 'text-amber-300'
                }>
                  {stream.finishReason}
                </span>
              </div>
            )}
            {stream.status === 'failed' && (
              <div>
                <span className="text-red-400">Failed</span>
              </div>
            )}
            {stream.status === 'cached' && (
              <div>
                <span className="text-blue-400">Cached</span>
              </div>
            )}
          </div>

          <StreamImages streamId={stream.id} />

          {stream.requestBody && (
            <RequestBody raw={stream.requestBody} />
          )}

          <ResponseBody streamId={stream.id} />

          {stream.outputPreview && (
            <CollapsibleSection
              label={`Output (${formatTextLength(stream.outputPreview.length)} chars)`}
            >
              <pre className="text-[11px] text-gray-400 bg-gray-950 rounded p-2 max-h-48 overflow-y-auto scrollbar-hide whitespace-pre-wrap break-words leading-relaxed">
                {stream.outputPreview}
              </pre>
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}

export function ActiveStreams() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
            LLM Requests
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
          <StreamRow
            key={stream.id}
            stream={stream}
            isActive
            expanded={expandedId === stream.id}
            onToggle={() => setExpandedId(expandedId === stream.id ? null : stream.id)}
          />
        ))}
        {recent.map((stream) => (
          <StreamRow
            key={stream.id}
            stream={stream}
            isActive={false}
            expanded={expandedId === stream.id}
            onToggle={() => setExpandedId(expandedId === stream.id ? null : stream.id)}
          />
        ))}
      </div>
    </div>
  );
}
