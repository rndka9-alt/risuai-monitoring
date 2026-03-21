import { useState } from 'react';

interface JsonTreeProps {
  data: unknown;
  defaultExpandLevel?: number;
}

interface NodeProps {
  value: unknown;
  keyName?: string;
  depth: number;
  defaultExpandLevel: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function preview(value: unknown): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (isRecord(value)) {
    const keys = Object.keys(value);
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
  }
  return String(value);
}

function ValueSpan({ value }: { value: unknown }) {
  if (value === null) return <span className="text-gray-500">null</span>;
  if (value === undefined) return <span className="text-gray-500">undefined</span>;
  if (typeof value === 'string') {
    // 긴 문자열은 줄여서 표시
    const display = value.length > 120 ? value.slice(0, 120) + '...' : value;
    return <span className="text-green-400">&quot;{display}&quot;</span>;
  }
  if (typeof value === 'number') return <span className="text-blue-400">{value}</span>;
  if (typeof value === 'boolean') return <span className="text-red-400">{String(value)}</span>;
  return <span className="text-gray-300">{String(value)}</span>;
}

function TreeNode({ value, keyName, depth, defaultExpandLevel }: NodeProps) {
  const isExpandable = Array.isArray(value) || isRecord(value);
  const [expanded, setExpanded] = useState(depth < defaultExpandLevel);

  if (!isExpandable) {
    return (
      <div className="flex" style={{ paddingLeft: depth * 16 }}>
        {keyName !== undefined && (
          <span className="text-purple-300 mr-1">{keyName}:</span>
        )}
        <ValueSpan value={value} />
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  const bracket = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  const isEmpty = entries.length === 0;

  return (
    <div>
      <div
        className="flex cursor-pointer hover:bg-white/[0.03]"
        style={{ paddingLeft: depth * 16 }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-gray-600 w-4 shrink-0 select-none">
          {isEmpty ? '' : expanded ? '▼' : '▶'}
        </span>
        {keyName !== undefined && (
          <span className="text-purple-300 mr-1">{keyName}:</span>
        )}
        {expanded ? (
          <span className="text-gray-500">{bracket[0]}</span>
        ) : (
          <span className="text-gray-500">
            {bracket[0]} {preview(value)} {bracket[1]}
          </span>
        )}
      </div>
      {expanded && (
        <>
          {entries.map(([key, val]) => (
            <TreeNode
              key={key}
              keyName={key}
              value={val}
              depth={depth + 1}
              defaultExpandLevel={defaultExpandLevel}
            />
          ))}
          <div
            className="text-gray-500"
            style={{ paddingLeft: depth * 16 + 16 }}
          >
            {bracket[1]}
          </div>
        </>
      )}
    </div>
  );
}

export function JsonTree({ data, defaultExpandLevel = 1 }: JsonTreeProps) {
  return (
    <div className="text-[11px] font-mono leading-relaxed">
      <TreeNode
        value={data}
        depth={0}
        defaultExpandLevel={defaultExpandLevel}
      />
    </div>
  );
}
