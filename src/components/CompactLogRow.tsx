import React from 'react';
import { LogEntry } from '../types.ts';

interface CompactLogRowProps {
  entry: LogEntry;
  isSelected: boolean;
  onSelect: (lineNumber: number) => void;
  onDoubleClick: (lineNumber: number) => void;
  searchQuery?: string;
  markerQuery?: string;
  correlationQuery?: string;
  wrapLines?: boolean;
  showPid?: boolean;
  showTid?: boolean;
  showCorrelation?: boolean;
}

export const CompactLogRow: React.FC<CompactLogRowProps> = ({
  entry,
  isSelected,
  onSelect,
  onDoubleClick,
  searchQuery,
  markerQuery,
  correlationQuery,
  wrapLines = false,
  showPid = true,
  showTid = true,
  showCorrelation = true,
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
    if (!status) return 'var(--tok-pid)';
    const s = status.toUpperCase();
    if (s.includes('FAIL') || s.includes('ERR')) return 'var(--tok-status-error)';
    if (s.includes('WARN')) return 'var(--tok-status-warn)';
    if (s.includes('SUCCESS') || s === '200') return 'var(--tok-status-success)';
    if (s.includes('PEND')) return 'var(--tok-duration)';
    if (s.includes('CRIT') || s.includes('FATAL')) return 'var(--lvl-critical)';
    if (s.includes('AUDIT')) return 'var(--lvl-audit)';
    if (s.includes('INFO')) return 'var(--tok-status-info)';
    return 'var(--tok-pid)';
  };

  // Operation method color (POST/GET/etc orange vs action amber)
  const isHttpOp = Boolean(entry.operation && /^(POST|GET|PUT|DELETE|PATCH|HEAD)/i.test(entry.operation));

  return (
    <div
      onClick={() => onSelect(entry.lineNumber)}
      onDoubleClick={() => onDoubleClick(entry.lineNumber)}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        padding: '3px 12px 3px 0',
        backgroundColor: isSelected ? 'var(--row-selected-bg)' : 'transparent',
        borderLeft: isSelected ? '4px solid var(--row-selected-border)' : '4px solid transparent',
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
          color: isSelected ? 'var(--gutter-selected-text)' : 'var(--text-muted)',
          textAlign: 'right',
          paddingRight: 14,
          userSelect: 'none',
          flexShrink: 0,
          fontWeight: isSelected ? 700 : 400,
          position: 'sticky',
          left: 0,
          backgroundColor: isSelected ? 'var(--gutter-selected-bg)' : 'var(--bg-app)',
          zIndex: 3,
        }}
      >
        {entry.lineNumber}
      </span>

      {/* Structured Colored Log Line */}
      <div style={{ display: 'inline', flex: 1 }}>
        {/* Datetime */}
        {entry.datetime && (
          <span style={{ color: 'var(--tok-datetime)', marginRight: 8 }}>[{entry.datetime}]</span>
        )}

        {/* PID & TID (Muted Slate) */}
        {showPid && entry.pid && (
          <span style={{ color: 'var(--tok-pid)', marginRight: 6 }}>[{entry.pid}]</span>
        )}
        {showTid && entry.tid && (
          <span style={{ color: 'var(--tok-pid)', marginRight: 6 }}>[{entry.tid}]</span>
        )}

        {/* Correlation ID */}
        {showCorrelation && entry.correlationId && (
          <span
            style={{ color: 'var(--tok-corr)', fontWeight: 600, marginRight: 6 }}
            title={`Correlation ID: ${entry.correlationId}`}
          >
            [{highlightMatches(entry.correlationId, [searchQuery, correlationQuery])}]
          </span>
        )}

        {/* Namespace */}
        {entry.namespace && (
          <span style={{ color: 'var(--tok-namespace)', marginRight: 6 }}>
            [{highlightMatches(entry.namespace, [searchQuery])}]
          </span>
        )}

        {/* Workflow Marker */}
        {entry.workflow && (
          <span style={{ color: 'var(--tok-workflow)', fontWeight: 600, marginRight: 6 }}>
            [{highlightMatches(entry.workflow, [searchQuery, markerQuery])}]
          </span>
        )}

        {/* Operation */}
        {entry.operation && (
          <span
            style={{
              color: isHttpOp ? 'var(--tok-op-http)' : 'var(--tok-op-action)',
              fontWeight: 600,
              marginRight: 6,
            }}
          >
            [{highlightMatches(entry.operation, [searchQuery])}]
          </span>
        )}

        {/* Status */}
        {entry.status && (
          <span style={{ color: getStatusColor(entry.status), fontWeight: 700, marginRight: 6 }}>
            [{entry.status}]
          </span>
        )}

        {/* Duration */}
        {entry.duration && (
          <span style={{ color: 'var(--tok-duration)', fontWeight: 600, marginRight: 8 }}>
            [{entry.duration}]
          </span>
        )}

        {/* Message Content */}
        <span style={{ color: 'var(--tok-msg)' }}>
          {highlightMatches(entry.message, [searchQuery, markerQuery])}
        </span>

        {/* Code Location */}
        {entry.fileLocation && (
          <span style={{ color: 'var(--tok-file)', marginLeft: 8 }}>
            [{entry.fileLocation}]
          </span>
        )}

        {/* Trace indicator if available */}
        {entry.trace && (
          <div style={{ color: 'var(--tok-status-error)', paddingLeft: 20, fontSize: '0.76rem' }}>
            Trace: {entry.trace.title || entry.trace.raw.split('\n')[0]}
          </div>
        )}
      </div>
    </div>
  );
};
