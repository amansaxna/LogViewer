import React, { useState } from 'react';
import { Copy, Check, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { LogEntry, LogLevel } from '../types.ts';
import { TraceViewer } from './TraceViewer.tsx';
import { renderRichMessageContext } from '../utils/messageContextHighlighter.tsx';

interface LogRowProps {
  entry: LogEntry;
  onViewContext: (lineNumber: number) => void;
  wrapLines?: boolean;
  showPid?: boolean;
  showTid?: boolean;
  showCorrelation?: boolean;
  searchQuery?: string;
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  emergency: 'var(--lvl-critical)',
  alert: 'var(--lvl-critical)',
  critical: 'var(--lvl-critical)',
  error: 'var(--lvl-error)',
  warning: 'var(--lvl-warn)',
  notice: 'var(--lvl-notice)',
  info: 'var(--lvl-info)',
  audit: 'var(--lvl-audit)',
  debug: 'var(--lvl-debug)',
  trace: 'var(--lvl-trace)',
  unknown: 'var(--text-muted)',
};

export const LogRow: React.FC<LogRowProps> = ({
  entry,
  onViewContext,
  wrapLines = false,
  showPid = true,
  showTid = true,
  showCorrelation = true,
  searchQuery,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const levelColor = LEVEL_COLORS[entry.level] || 'var(--lvl-info)';

  const handleCopyRaw = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(entry.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContextClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewContext(entry.lineNumber);
  };

  return (
    <div className={`log-row-item ${expanded ? 'expanded' : ''}`}>
      {/* Summary Row */}
      <div className="log-row-summary" onClick={() => setExpanded(!expanded)}>
        {/* Severity Color Bar */}
        <div className="log-level-bar" style={{ backgroundColor: levelColor }} />

        {/* Expand Chevron */}
        <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>

        {/* Line Number */}
        <span className="log-line-num">#{entry.lineNumber}</span>

        {/* Datetime (if present) */}
        {entry.datetime && <span className="log-datetime">{entry.datetime}</span>}

        {/* Process ID & Thread ID */}
        {((showPid && entry.pid) || (showTid && entry.tid)) && (
          <span className="badge-pid-tid">
            {showPid && entry.pid ? `P:${entry.pid}` : ''}
            {showPid && entry.pid && showTid && entry.tid ? ' ' : ''}
            {showTid && entry.tid ? `T:${entry.tid}` : ''}
          </span>
        )}

        {/* Correlation ID */}
        {showCorrelation && entry.correlationId && (
          <span
            className="badge-correlation"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: 4,
              backgroundColor: 'var(--accent-bg)',
              color: 'var(--tok-corr)',
              border: '1px solid var(--accent-primary)',
              fontFamily: 'var(--font-mono)',
            }}
            title={`Correlation ID: ${entry.correlationId}`}
          >
            {entry.correlationId}
          </span>
        )}

        {/* Namespace */}
        {entry.namespace && <span className="badge-namespace">{entry.namespace}</span>}

        {/* Workflow Marker */}
        {entry.workflow && <span className="badge-workflow">{entry.workflow}</span>}

        {/* Operation */}
        {entry.operation && <span className="badge-operation">{entry.operation}</span>}

        {/* Status */}
        {entry.status && (
          <span
            className={`badge-status ${
              entry.status.toLowerCase().includes('success') || entry.status === '200'
                ? 'success'
                : entry.status.toLowerCase().includes('fail') ||
                  entry.status.toLowerCase().includes('error') ||
                  entry.status === '500'
                ? 'failed'
                : ''
            }`}
          >
            {entry.status}
          </span>
        )}

        {/* Duration */}
        {entry.duration && <span className="badge-duration">{entry.duration}</span>}

        {/* Message */}
        <span
          className="log-message-preview"
          style={
            wrapLines
              ? { whiteSpace: 'normal', wordBreak: 'break-word', overflow: 'visible' }
              : undefined
          }
        >
          {renderRichMessageContext(entry.message, [searchQuery])}
        </span>

        {/* Trailing Location [FileName::LineNumber] */}
        {entry.fileLocation && <span className="badge-location">{entry.fileLocation}</span>}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="log-row-details">
          {/* Structured Attributes Grid */}
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Severity Level</span>
              <span className="detail-value" style={{ color: levelColor, fontWeight: 600 }}>
                {entry.level.toUpperCase()}
              </span>
            </div>

            {entry.datetime && (
              <div className="detail-item">
                <span className="detail-label">Timestamp</span>
                <span className="detail-value">{entry.datetime}</span>
              </div>
            )}

            {entry.pid && (
              <div className="detail-item">
                <span className="detail-label">Process ID</span>
                <span className="detail-value">{entry.pid}</span>
              </div>
            )}

            {entry.tid && (
              <div className="detail-item">
                <span className="detail-label">Thread ID</span>
                <span className="detail-value">{entry.tid}</span>
              </div>
            )}

            {entry.namespace && (
              <div className="detail-item">
                <span className="detail-label">Namespace</span>
                <span className="detail-value" style={{ color: '#38bdf8' }}>
                  {entry.namespace}
                </span>
              </div>
            )}

            {entry.workflow && (
              <div className="detail-item">
                <span className="detail-label">Workflow Marker</span>
                <span className="detail-value" style={{ color: '#c084fc' }}>
                  {entry.workflow}
                </span>
              </div>
            )}

            {entry.operation && (
              <div className="detail-item">
                <span className="detail-label">Operation</span>
                <span className="detail-value" style={{ color: '#fbbf24' }}>
                  {entry.operation}
                </span>
              </div>
            )}

            {entry.status && (
              <div className="detail-item">
                <span className="detail-label">Status</span>
                <span className="detail-value">{entry.status}</span>
              </div>
            )}

            {entry.duration && (
              <div className="detail-item">
                <span className="detail-label">Duration</span>
                <span className="detail-value">{entry.duration}</span>
              </div>
            )}

            {entry.fileLocation && (
              <div className="detail-item">
                <span className="detail-label">Code Location</span>
                <span className="detail-value">{entry.fileLocation}</span>
              </div>
            )}
          </div>

          {/* Full Message */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="detail-label">Full Message</span>
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                padding: '10px 12px',
                borderRadius: 6,
                fontSize: '0.84rem',
                color: 'var(--text-primary)',
                wordBreak: 'break-word',
                lineHeight: 1.5,
              }}
            >
              {renderRichMessageContext(entry.message, [searchQuery])}
            </div>
          </div>

          {/* Trace Viewer if available */}
          {entry.trace && <TraceViewer trace={entry.trace} />}

          {/* Actions Bar */}
          <div className="details-actions-bar">
            <button className="btn-secondary" onClick={handleContextClick}>
              <ExternalLink size={13} />
              View Context Lines (File Line #{entry.lineNumber})
            </button>

            <button className="btn-secondary" onClick={handleCopyRaw}>
              {copied ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
              {copied ? 'Copied Raw Line' : 'Copy Raw Line'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
