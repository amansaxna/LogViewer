import React from 'react';
import { Timer, ArrowRight, X, GitBranch, Zap, Layers } from 'lucide-react';
import { LogEntry } from '../types.ts';

interface DeltaTimeBadgeProps {
  baselineEntry: LogEntry | null;
  targetEntry: LogEntry | null;
  onClear: () => void;
  onOpenWaterfall?: (correlationId?: string, workflow?: string) => void;
}

export function formatDeltaTime(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < 1) return `${(abs * 1000).toFixed(0)} µs`;
  if (abs < 1000) return `${abs.toFixed(1)} ms`;
  if (abs < 60000) return `${(abs / 1000).toFixed(3)} s`;
  const mins = Math.floor(abs / 60000);
  const secs = ((abs % 60000) / 1000).toFixed(1);
  return `${mins}m ${secs}s`;
}

export const DeltaTimeBadge: React.FC<DeltaTimeBadgeProps> = ({
  baselineEntry,
  targetEntry,
  onClear,
  onOpenWaterfall,
}) => {
  if (!baselineEntry) return null;

  // Single baseline selected, waiting for target
  if (!targetEntry) {
    return (
      <div
        className="delta-time-card single"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1050,
          background: 'var(--bg-card)',
          border: '1.5px solid rgba(56, 189, 248, 0.5)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.25)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'fadeInUp 0.2s ease',
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'rgba(56, 189, 248, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
          }}
        >
          <Timer size={16} />
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>
            Baseline Set: Line #{baselineEntry.lineNumber}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Alt+Click or click another line to measure elapsed delta time
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
          title="Cancel delta measurement (Esc)"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  // Both baseline and target selected
  const timeA = baselineEntry.timestamp || 0;
  const timeB = targetEntry.timestamp || 0;
  const deltaMs = timeB - timeA;
  const lineDiff = Math.abs(targetEntry.lineNumber - baselineEntry.lineNumber);
  const throughput = deltaMs !== 0 ? Math.abs(lineDiff / (deltaMs / 1000)).toFixed(1) : '∞';

  const correlationId = baselineEntry.correlationId || targetEntry.correlationId;
  const workflow = baselineEntry.workflow || targetEntry.workflow;

  return (
    <div
      className="delta-time-card complete"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1050,
        background: 'var(--bg-card)',
        border: '1.5px solid rgba(192, 132, 252, 0.6)',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.85), 0 0 25px rgba(192, 132, 252, 0.3)',
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 320,
        animation: 'fadeInUp 0.2s ease',
      }}
    >
      {/* Header with Delta Time */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: 'rgba(192, 132, 252, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc',
            }}
          >
            <Timer size={17} />
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Latency / Elapsed
            </span>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#c084fc', letterSpacing: '0.02em' }}>
              Δ {formatDeltaTime(deltaMs)}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClear}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
          title="Clear Delta Measurement (Esc)"
        >
          <X size={15} />
        </button>
      </div>

      {/* Path / Line span */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.76rem',
          background: 'var(--bg-surface)',
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      >
        <span style={{ fontWeight: 700, color: '#38bdf8' }}>Line #{baselineEntry.lineNumber}</span>
        <ArrowRight size={12} color="var(--text-muted)" />
        <span style={{ fontWeight: 700, color: '#c084fc' }}>Line #{targetEntry.lineNumber}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
          +{lineDiff} lines ({throughput} logs/s)
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
        {onOpenWaterfall && (correlationId || workflow) && (
          <button
            type="button"
            className="level-pill"
            onClick={() => onOpenWaterfall(correlationId, workflow)}
            style={{
              flex: 1,
              justifyContent: 'center',
              background: 'rgba(192, 132, 252, 0.15)',
              borderColor: '#c084fc',
              color: '#c084fc',
              fontSize: '0.75rem',
              padding: '4px 8px',
              fontWeight: 700,
            }}
            title="Open interactive waterfall trace for this transaction"
          >
            <GitBranch size={13} />
            <span>Trace Waterfall</span>
          </button>
        )}
        <button
          type="button"
          className="search-modifier-btn"
          onClick={onClear}
          style={{ fontSize: '0.74rem', padding: '4px 10px' }}
        >
          Clear
        </button>
      </div>
    </div>
  );
};
