import React from 'react';
import { LogEntry } from '../types.ts';

interface CompactLogRowProps {
  entry: LogEntry;
  isSelected: boolean;
  onSelect: (lineNumber: number) => void;
  onDoubleClick: (lineNumber: number) => void;
  searchQuery?: string;
  markerQuery?: string;
  wrapLines?: boolean;
}

export const CompactLogRow: React.FC<CompactLogRowProps> = ({
  entry,
  isSelected,
  onSelect,
  onDoubleClick,
  searchQuery,
  markerQuery,
  wrapLines = false,
}) => {
  // Helper to highlight matching terms inside text
  const highlightMatches = (text: string, queries: (string | undefined)[]) => {
    const validQueries = queries
      .filter((q): q is string => Boolean(q && q.trim().length > 0))
      .map((q) => q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (validQueries.length === 0) return text;

    const regex = new RegExp(`(${validQueries.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.45)',
            color: '#ffffff',
            borderRadius: 2,
            padding: '0 2px',
          }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Determine status color
  const getStatusColor = (status?: string) => {
    if (!status) return '#94a3b8';
    const s = status.toUpperCase();
    if (s.includes('FAIL') || s.includes('ERR')) return '#f87171'; // Red
    if (s.includes('WARN')) return '#fbbf24'; // Amber
    if (s.includes('SUCCESS') || s === '200') return '#86efac'; // Green
    if (s.includes('PEND')) return '#facc15'; // Yellow
    if (s.includes('CRIT') || s.includes('FATAL')) return '#f43f5e'; // Rose
    if (s.includes('INFO')) return '#38bdf8'; // Sky
    return '#94a3b8';
  };

  // Operation method color (POST/GET/etc orange)
  const isHttpOp = Boolean(entry.operation && /^(POST|GET|PUT|DELETE|PATCH|HEAD)/i.test(entry.operation));

  return (
    <div
      onClick={() => onSelect(entry.lineNumber)}
      onDoubleClick={() => onDoubleClick(entry.lineNumber)}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        padding: '3px 12px 3px 0',
        backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.14)' : 'transparent',
        borderLeft: isSelected ? '4px solid #facc15' : '4px solid transparent',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.81rem',
        lineHeight: 1.5,
        userSelect: 'text',
        whiteSpace: wrapLines ? 'normal' : 'pre',
        wordBreak: wrapLines ? 'break-word' : 'normal',
      }}
      className="compact-log-row"
      title="Click to select, Double click to view full context"
    >
      {/* Line Number Gutter */}
      <span
        style={{
          width: 54,
          minWidth: 54,
          color: isSelected ? '#facc15' : '#64748b',
          textAlign: 'right',
          paddingRight: 14,
          userSelect: 'none',
          flexShrink: 0,
          fontWeight: isSelected ? 700 : 400,
        }}
      >
        {entry.lineNumber}
      </span>

      {/* Structured Colored Log Line */}
      <div style={{ display: 'inline', flex: 1 }}>
        {/* Datetime (Cyan) */}
        {entry.datetime && (
          <span style={{ color: '#00e5ff', marginRight: 8 }}>[{entry.datetime}]</span>
        )}

        {/* PID & TID (Muted Slate) */}
        {entry.pid && (
          <span style={{ color: '#94a3b8', marginRight: 6 }}>[{entry.pid}]</span>
        )}
        {entry.tid && (
          <span style={{ color: '#94a3b8', marginRight: 6 }}>[{entry.tid}]</span>
        )}

        {/* Namespace (Soft Light Blue) */}
        {entry.namespace && (
          <span style={{ color: '#7dd3fc', marginRight: 6 }}>
            [{highlightMatches(entry.namespace, [searchQuery])}]
          </span>
        )}

        {/* Workflow Marker (Purple / Highlighted) */}
        {entry.workflow && (
          <span style={{ color: '#c084fc', fontWeight: 600, marginRight: 6 }}>
            [{highlightMatches(entry.workflow, [searchQuery, markerQuery])}]
          </span>
        )}

        {/* Operation (Bright Orange for POST/GET, Amber for actions) */}
        {entry.operation && (
          <span
            style={{
              color: isHttpOp ? '#ff9800' : '#fbbf24',
              fontWeight: 600,
              marginRight: 6,
            }}
          >
            [{highlightMatches(entry.operation, [searchQuery])}]
          </span>
        )}

        {/* Status (Color coded by severity) */}
        {entry.status && (
          <span style={{ color: getStatusColor(entry.status), fontWeight: 700, marginRight: 6 }}>
            [{entry.status}]
          </span>
        )}

        {/* Duration (Bright Gold) */}
        {entry.duration && (
          <span style={{ color: '#facc15', fontWeight: 600, marginRight: 8 }}>
            [{entry.duration}]
          </span>
        )}

        {/* Message Content */}
        <span style={{ color: '#f1f5f9' }}>
          {highlightMatches(entry.message, [searchQuery, markerQuery])}
        </span>

        {/* Code Location (Slate) */}
        {entry.fileLocation && (
          <span style={{ color: '#64748b', marginLeft: 8 }}>
            [{entry.fileLocation}]
          </span>
        )}

        {/* Trace indicator if available */}
        {entry.trace && (
          <div style={{ color: '#f87171', paddingLeft: 20, fontSize: '0.76rem' }}>
            Trace: {entry.trace.title || entry.trace.raw.split('\n')[0]}
          </div>
        )}
      </div>
    </div>
  );
};
