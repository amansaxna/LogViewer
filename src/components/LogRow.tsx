import React, { useState } from 'react';
import { Copy, Check, ExternalLink, ChevronDown, ChevronRight, Timer } from 'lucide-react';
import { LogEntry, LogLevel } from '../types.ts';
import { TraceViewer } from './TraceViewer.tsx';
import { renderRichMessageContext } from '../utils/messageContextHighlighter.tsx';
import { stripBracketMarkers } from '../utils/coloredLogRenderer.tsx';
import { copyWithToast } from '../utils/copyNotifier.ts';
import { openSourceLocation, isVsCode } from '../api/bridge.ts';

interface LogRowProps {
  entry: LogEntry;
  isSelected?: boolean;
  onSelect?: (lineNumber: number, isShift?: boolean) => void;
  onViewContext: (lineNumber: number, sourceId?: string) => void;
  onSetDeltaAnchor?: (lineNumber: number) => void;
  onOpenCorrelationTimeline?: (corr: string) => void;
  onOpenWorkflowTimeline?: (wf: string) => void;
  wrapLines?: boolean;
  hideBrackets?: boolean;
  showDatetime?: boolean;
  showPid?: boolean;
  showTid?: boolean;
  showCorrelation?: boolean;
  searchQuery?: string;
  isUnifiedStream?: boolean;
  isDeltaAnchor?: boolean;
  isDeltaTarget?: boolean;
  isDeltaInRange?: boolean;
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
  isSelected = false,
  onSelect,
  onViewContext,
  onSetDeltaAnchor,
  onOpenCorrelationTimeline,
  onOpenWorkflowTimeline,
  wrapLines = false,
  hideBrackets = false,
  showDatetime = true,
  showPid = true,
  showTid = true,
  showCorrelation = true,
  searchQuery,
  isUnifiedStream = false,
  isDeltaAnchor = false,
  isDeltaTarget = false,
  isDeltaInRange = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const levelColor = LEVEL_COLORS[entry.level] || 'var(--lvl-info)';

  const handleCopyRaw = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyWithToast(entry.raw, `Line #${entry.lineNumber}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContextClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewContext(entry.lineNumber, entry.sourceId);
  };

  const handleDeltaClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSetDeltaAnchor?.(entry.lineNumber);
  };

  const renderToken = (tokenType: string): React.ReactNode => {
    switch (tokenType) {
      case 'datetime':
        return showDatetime !== false && entry.datetime ? (
          <span key="tok-dt" className="log-datetime">{entry.datetime}</span>
        ) : null;

      case 'pid':
      case 'tid':
        if ((showPid && entry.pid) || (showTid && entry.tid)) {
          return (
            <span key="tok-pid-tid" className="badge-pid-tid">
              {showPid && entry.pid ? `P:${entry.pid}` : ''}
              {showPid && entry.pid && showTid && entry.tid ? ' ' : ''}
              {showTid && entry.tid ? `T:${entry.tid}` : ''}
            </span>
          );
        }
        return null;

      case 'correlationId':
        return showCorrelation && entry.correlationId ? (
          <span
            key="tok-corr"
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
              cursor: onOpenCorrelationTimeline ? 'pointer' : 'default',
              textDecoration: onOpenCorrelationTimeline ? 'underline' : 'none',
            }}
            onClick={(e) => {
              if (onOpenCorrelationTimeline && entry.correlationId) {
                e.stopPropagation();
                onOpenCorrelationTimeline(entry.correlationId);
              }
            }}
            title={
              onOpenCorrelationTimeline
                ? `Correlation ID: ${entry.correlationId} (Click to open Timeline Graph)`
                : `Correlation ID: ${entry.correlationId}`
            }
          >
            {entry.correlationId}
          </span>
        ) : null;

      case 'status':
        return entry.status ? (
          <span
            key="tok-status"
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
        ) : null;

      case 'namespace':
        return entry.namespace ? <span key="tok-ns" className="badge-namespace">{entry.namespace}</span> : null;

      case 'workflow':
        return entry.workflow ? (
          <span
            key="tok-wf"
            className="badge-workflow"
            onClick={
              onOpenWorkflowTimeline
                ? (e) => {
                    e.stopPropagation();
                    onOpenWorkflowTimeline(entry.workflow!);
                  }
                : undefined
            }
            style={{
              cursor: onOpenWorkflowTimeline ? 'pointer' : 'default',
              textDecoration: onOpenWorkflowTimeline ? 'underline' : 'none',
            }}
            title={
              onOpenWorkflowTimeline
                ? `Workflow: ${entry.workflow} (Click to open Timeline Graph)`
                : `Workflow: ${entry.workflow}`
            }
          >
            {entry.workflow}
          </span>
        ) : null;

      case 'operation':
        return entry.operation ? <span key="tok-op" className="badge-operation">{entry.operation}</span> : null;

      case 'duration':
        return entry.duration ? <span key="tok-dur" className="badge-duration">{entry.duration}</span> : null;

      default:
        return null;
    }
  };

  return (
    <div
      className={`log-row-item ${expanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''} ${
        isDeltaAnchor ? 'delta-anchor' : isDeltaTarget ? 'delta-target' : isDeltaInRange ? 'delta-in-range' : ''
      }`}
      style={isSelected ? { backgroundColor: 'var(--row-selected-bg)', borderLeft: '3px solid #facc15' } : undefined}
    >
      {/* Summary Row */}
      <div
        className="log-row-summary"
        onClick={(e) => {
          onSelect?.(entry.lineNumber, e.shiftKey);
          setExpanded(!expanded);
        }}
      >
        {/* Severity Color Bar */}
        <div className="log-level-bar" style={{ backgroundColor: levelColor }} />

        {/* Expand Chevron */}
        <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>

        {/* Line Number with Fast Copy Button */}
        <span
          className="log-line-num"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <button
            className="fast-copy-btn"
            onClick={handleCopyRaw}
            title={`Copy line #${entry.lineNumber}`}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              color: copied ? '#22c55e' : 'var(--text-muted)',
              opacity: copied ? 1 : undefined,
            }}
          >
            {copied ? <Check size={11} color="#22c55e" /> : <Copy size={11} />}
          </button>
          <span>#{entry.lineNumber}</span>
        </span>

        {!hideBrackets && (
          <>
            {/* Multi-Source Origin Badge - ONLY shown in unified multi-source mode */}
            {isUnifiedStream && entry.sourceName && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  backgroundColor: `${entry.sourceColor || '#38bdf8'}18`,
                  color: entry.sourceColor || '#38bdf8',
                  border: `1px solid ${entry.sourceColor || '#38bdf8'}40`,
                }}
                title={`Source: ${entry.sourceName}`}
              >
                {entry.sourceName}
              </span>
            )}

            {/* Dynamic Native Schema Order from Log File */}
            {(() => {
              const defaultOrder = ['datetime', 'pid', 'tid', 'correlationId', 'namespace', 'workflow', 'operation', 'status', 'duration'];
              const order = entry.tokenOrder && entry.tokenOrder.length > 0 ? entry.tokenOrder : defaultOrder;

              // De-duplicate pid/tid since LogRow handles them jointly
              const seenTokens = new Set<string>();
              const renderedTokens: React.ReactNode[] = [];

              for (const tok of order) {
                if (tok === 'pid' || tok === 'tid') {
                  if (!seenTokens.has('pid_tid')) {
                    seenTokens.add('pid_tid');
                    renderedTokens.push(renderToken('pid'));
                  }
                } else if (!seenTokens.has(tok)) {
                  seenTokens.add(tok);
                  renderedTokens.push(renderToken(tok));
                }
              }

              // Render fallback tokens present on entry but missing from tokenOrder
              for (const tok of defaultOrder) {
                if (tok === 'pid' || tok === 'tid') {
                  if (!seenTokens.has('pid_tid')) {
                    seenTokens.add('pid_tid');
                    renderedTokens.push(renderToken('pid'));
                  }
                } else if (!seenTokens.has(tok)) {
                  seenTokens.add(tok);
                  renderedTokens.push(renderToken(tok));
                }
              }

              return <React.Fragment key="tokens-container">{renderedTokens}</React.Fragment>;
            })()}
          </>
        )}

        {/* Message */}
        <span
          className="log-message-preview"
          style={
            wrapLines
              ? { whiteSpace: 'normal', wordBreak: 'break-word', overflow: 'visible' }
              : undefined
          }
        >
          {renderRichMessageContext(
            hideBrackets ? stripBracketMarkers(entry.raw || entry.message) : entry.message,
            [searchQuery]
          )}
        </span>

        {/* Trailing Location [FileName::LineNumber] */}
        {!hideBrackets && entry.fileLocation && (
          <span
            className="badge-location"
            onClick={(e) => {
              e.stopPropagation();
              openSourceLocation(entry.fileLocation!);
            }}
            title={isVsCode() ? 'Click to open in editor' : `Code location: ${entry.fileLocation}`}
            style={{ cursor: 'pointer' }}
          >
            {entry.fileLocation}
          </span>
        )}
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
                <span
                  className="detail-value"
                  onClick={(e) => {
                    e.stopPropagation();
                    openSourceLocation(entry.fileLocation!);
                  }}
                  title={isVsCode() ? 'Click to open in editor' : `Code location: ${entry.fileLocation}`}
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {entry.fileLocation}
                </span>
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

            {onSetDeltaAnchor && (
              <button className="btn-secondary" onClick={handleDeltaClick} title="Set as Delta Anchor (T1) to measure elapsed latency to another line">
                <Timer size={13} color="#38bdf8" />
                Measure Latency Delta (T<sub>1</sub>)
              </button>
            )}

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
