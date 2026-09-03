import React, { useEffect } from 'react';
import { Timer, ArrowRight, ArrowLeftRight, X, Anchor, Target } from 'lucide-react';
import { DeltaMeasurement } from '../utils/deltaTimeEngine.ts';

interface DeltaTimeToolbarProps {
  measurement: DeltaMeasurement | null;
  anchorLine: number | null;
  targetLine: number | null;
  onSwap: () => void;
  onClear: () => void;
  onJumpToLine?: (line: number) => void;
}

export const DeltaTimeToolbar: React.FC<DeltaTimeToolbarProps> = ({
  measurement,
  anchorLine,
  targetLine,
  onSwap,
  onClear,
  onJumpToLine,
}) => {
  // Clear delta on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (anchorLine !== null || targetLine !== null)) {
        onClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [anchorLine, targetLine, onClear]);

  if (anchorLine === null) {
    return null;
  }

  // Anchor is selected, but target is waiting
  if (!measurement) {
    return (
      <div className="delta-time-toolbar active-prompt">
        <div className="delta-hud-left">
          <span className="delta-hud-icon pulse">
            <Anchor size={14} color="#38bdf8" />
          </span>
          <span className="delta-anchor-tag">
            Anchor T<sub>1</sub>: Line #{anchorLine}
          </span>
          <span className="delta-prompt-text">
            Click any second log line to measure exact elapsed latency (Δ)
          </span>
        </div>
        <button
          type="button"
          className="delta-hud-btn close"
          onClick={onClear}
          title="Cancel Delta measurement (Esc)"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="delta-time-toolbar">
      <div className="delta-hud-left">
        <span className="delta-hud-icon">
          <Timer size={15} color="#38bdf8" />
        </span>

        {/* Anchor T1 */}
        <button
          type="button"
          className="delta-hud-badge anchor"
          onClick={() => onJumpToLine?.(measurement.anchorLine)}
          title={`Click to jump to Anchor Line #${measurement.anchorLine}`}
        >
          <Anchor size={11} />
          <span>#{measurement.anchorLine}</span>
          <span className="delta-time-val">{measurement.anchorTimeStr}</span>
        </button>

        <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />

        {/* Target T2 */}
        <button
          type="button"
          className="delta-hud-badge target"
          onClick={() => onJumpToLine?.(measurement.targetLine)}
          title={`Click to jump to Target Line #${measurement.targetLine}`}
        >
          <Target size={11} />
          <span>#{measurement.targetLine}</span>
          <span className="delta-time-val">{measurement.targetTimeStr}</span>
        </button>

        {/* Latency Output Metric */}
        <div className="delta-metric-box">
          <span className="delta-label">LATENCY Δ:</span>
          <span
            className={`delta-value ${measurement.deltaMs < 0 ? 'backward' : 'forward'}`}
          >
            {measurement.formattedDelta}
          </span>
          {measurement.deltaMs !== 0 && (
            <span className="delta-raw-ms">
              ({Math.abs(measurement.deltaMs).toLocaleString()} ms)
            </span>
          )}
        </div>

        {/* Step Count */}
        <div className="delta-step-badge">
          <span>{measurement.stepCount} {measurement.stepCount === 1 ? 'step' : 'steps'}</span>
        </div>
      </div>

      <div className="delta-hud-right">
        {/* Swap Direction */}
        <button
          type="button"
          className="delta-hud-btn swap"
          onClick={onSwap}
          title="Swap Anchor and Target directions"
        >
          <ArrowLeftRight size={13} />
          <span>Swap</span>
        </button>

        {/* Clear */}
        <button
          type="button"
          className="delta-hud-btn close"
          onClick={onClear}
          title="Close Delta Measurement (Esc)"
        >
          <X size={13} />
          <span>Clear</span>
        </button>
      </div>
    </div>
  );
};
