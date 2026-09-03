import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  GitBranch,
  Layers,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  ExternalLink,
  ChevronRight,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { LogEntry } from '../types.ts';
import { formatDeltaTime } from './DeltaTimeBadge.tsx';

interface WaterfallModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LogEntry[];
  correlationId?: string | null;
  workflow?: string | null;
  onSelectLine?: (lineNumber: number) => void;
}

interface SpanItem {
  entry: LogEntry;
  offsetMs: number;
  durationMs: number;
  percentLeft: number;
  percentWidth: number;
  stepName: string;
  hasError: boolean;
  hasWarn: boolean;
}

export const WaterfallModal: React.FC<WaterfallModalProps> = ({
  isOpen,
  onClose,
  entries,
  correlationId,
  workflow,
  onSelectLine,
}) => {
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  const traceSpans = useMemo(() => {
    if (!isOpen) return [];

    // Filter entries belonging to this transaction/correlation or workflow
    const matched = entries.filter((e) => {
      if (correlationId && e.correlationId === correlationId) return true;
      if (!correlationId && workflow && e.workflow === workflow) return true;
      return false;
    });

    if (matched.length === 0) return [];

    // Sort chronologically
    const sorted = [...matched].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const t0 = sorted[0].timestamp || 0;
    const tEndRaw = sorted[sorted.length - 1].timestamp || 0;
    const totalSpanDuration = Math.max(1, tEndRaw - t0);

    return sorted.map((entry, idx, arr) => {
      const entryTime = entry.timestamp || t0;
      const offsetMs = Math.max(0, entryTime - t0);

      // Determine step duration: from entry.durationMs, or delta until next entry
      let stepDuration = entry.durationMs;
      if (stepDuration === undefined || stepDuration <= 0) {
        if (idx < arr.length - 1) {
          const nextTime = arr[idx + 1].timestamp || entryTime;
          stepDuration = Math.max(1, nextTime - entryTime);
        } else {
          stepDuration = 5; // Default minimal bar width for point-in-time events
        }
      }

      // Calculate percentages for Gantt bar
      const percentLeft = Math.min(95, (offsetMs / totalSpanDuration) * 100);
      const percentWidth = Math.max(2, Math.min(100 - percentLeft, (stepDuration / totalSpanDuration) * 100));

      const stepName =
        entry.operation ||
        entry.workflow ||
        entry.message.slice(0, 60).replace(/[\[\]]/g, '') ||
        `Step #${idx + 1}`;

      const hasError = entry.level === 'error' || entry.level === 'critical' || entry.level === 'emergency';
      const hasWarn = entry.level === 'warning';

      return {
        entry,
        offsetMs,
        durationMs: stepDuration,
        percentLeft,
        percentWidth,
        stepName,
        hasError,
        hasWarn,
      };
    });
  }, [isOpen, entries, correlationId, workflow]);

  if (!isOpen) return null;

  const totalDurationMs =
    traceSpans.length > 0
      ? (traceSpans[traceSpans.length - 1].entry.timestamp || 0) - (traceSpans[0].entry.timestamp || 0)
      : 0;

  const errorCount = traceSpans.filter((s) => s.hasError).length;

  const filteredSpans = traceSpans.filter((s) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      s.stepName.toLowerCase().includes(q) ||
      s.entry.raw.toLowerCase().includes(q) ||
      s.entry.lineNumber.toString().includes(q)
    );
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{
          width: '92vw',
          maxWidth: '1240px',
          height: '86vh',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-app)',
          border: '1.5px solid rgba(192, 132, 252, 0.4)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(192, 132, 252, 0.2)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '12px 20px',
            background: 'var(--bg-sidebar)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(192, 132, 252, 0.2)',
                border: '1px solid rgba(192, 132, 252, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c084fc',
              }}
            >
              <GitBranch size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Transaction Waterfall &amp; Gantt Trace</span>
                {correlationId && (
                  <span
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      letterSpacing: '0.04em',
                    }}
                  >
                    CID: {correlationId}
                  </span>
                )}
                {workflow && (
                  <span
                    style={{
                      background: 'rgba(192, 132, 252, 0.15)',
                      color: '#c084fc',
                      border: '1px solid rgba(192, 132, 252, 0.3)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    WF: {workflow}
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Quick Metrics */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-surface)',
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                fontSize: '0.76rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#c084fc', fontWeight: 700 }}>
                <Clock size={13} />
                <span>Total Latency: {formatDeltaTime(totalDurationMs)}</span>
              </div>
              <div style={{ width: 1, height: 12, background: 'var(--border-subtle)' }} />
              <div style={{ color: 'var(--text-secondary)' }}>
                {traceSpans.length} spans
              </div>
              {errorCount > 0 && (
                <>
                  <div style={{ width: 1, height: 12, background: 'var(--border-subtle)' }} />
                  <div style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <AlertTriangle size={12} />
                    <span>{errorCount} errors</span>
                  </div>
                </>
              )}
            </div>

            {/* Filter Spans */}
            <div
              className="search-container"
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 6,
                height: 28,
                padding: '2px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Search size={12} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter trace spans..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.76rem',
                  outline: 'none',
                  width: 130,
                }}
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={11} />
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              style={{ width: 28, height: 28 }}
              title="Close Waterfall Trace (Esc)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Timeline Ruler Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 18px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ width: '40%', minWidth: 260, fontWeight: 700 }}>
            SPAN / OPERATION SEQUENCE
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', paddingLeft: 12 }}>
            <span>0 ms</span>
            <span>+{formatDeltaTime(totalDurationMs * 0.25)}</span>
            <span>+{formatDeltaTime(totalDurationMs * 0.5)}</span>
            <span>+{formatDeltaTime(totalDurationMs * 0.75)}</span>
            <span style={{ fontWeight: 700, color: '#c084fc' }}>+{formatDeltaTime(totalDurationMs)}</span>
          </div>
        </div>

        {/* Waterfall Gantt Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            background: 'var(--bg-app)',
          }}
        >
          {filteredSpans.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No spans found matching the filter criteria.
            </div>
          ) : (
            filteredSpans.map((span, idx) => {
              const barColor = span.hasError
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : span.hasWarn
                ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                : 'linear-gradient(90deg, #38bdf8, #818cf8)';

              return (
                <div
                  key={idx}
                  className="waterfall-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: span.hasError ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-surface)',
                    border: `1px solid ${span.hasError ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'}`,
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    onSelectLine?.(span.entry.lineNumber);
                    onClose();
                  }}
                  title={`Click to jump to Line #${span.entry.lineNumber}\n${span.entry.raw}`}
                >
                  {/* Left Metadata Column */}
                  <div
                    style={{
                      width: '40%',
                      minWidth: 260,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      overflow: 'hidden',
                      paddingRight: 10,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        minWidth: 44,
                      }}
                    >
                      #{span.entry.lineNumber}
                    </span>

                    <span
                      className={`level-badge ${span.entry.level}`}
                      style={{ fontSize: '0.65rem', padding: '1px 5px' }}
                    >
                      {span.entry.level.toUpperCase()}
                    </span>

                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: span.hasError ? '#f87171' : 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {span.stepName}
                    </span>
                  </div>

                  {/* Right Gantt Bar Column */}
                  <div
                    style={{
                      flex: 1,
                      height: 22,
                      position: 'relative',
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {/* Gantt Bar */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${span.percentLeft}%`,
                        width: `${span.percentWidth}%`,
                        minWidth: 6,
                        height: 16,
                        background: barColor,
                        borderRadius: 3,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                        transition: 'all 0.2s ease',
                      }}
                    />

                    {/* Latency Label on bar */}
                    <span
                      style={{
                        position: 'absolute',
                        left: `calc(${span.percentLeft}% + ${span.percentWidth}% + 6px)`,
                        fontSize: '0.7rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      +{formatDeltaTime(span.offsetMs)} ({formatDeltaTime(span.durationMs)})
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '10px 20px',
            background: 'var(--bg-sidebar)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.76rem',
            color: 'var(--text-muted)',
          }}
        >
          <span>
            Click any span row to immediately navigate to its corresponding log line in the viewer.
          </span>
          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
            style={{ fontSize: '0.8rem', padding: '5px 18px' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
