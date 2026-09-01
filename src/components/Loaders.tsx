import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: number;
  color?: string;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 18,
  color = 'var(--accent-primary)',
  className = '',
}) => {
  return (
    <Loader2
      size={size}
      className={`icon-spin ${className}`}
      style={{ color, flexShrink: 0 }}
    />
  );
};

interface ButtonSpinnerProps {
  text?: string;
  size?: number;
}

export const ButtonSpinner: React.FC<ButtonSpinnerProps> = ({
  text = 'Loading...',
  size = 14,
}) => {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Loader2 size={size} className="icon-spin" />
      <span>{text}</span>
    </span>
  );
};

interface TopProgressBarProps {
  isVisible: boolean;
}

export const TopProgressBar: React.FC<TopProgressBarProps> = ({ isVisible }) => {
  if (!isVisible) return null;
  return (
    <div className="top-progress-bar-container" title="Updating log stream...">
      <div className="top-progress-bar-indicator" />
    </div>
  );
};

interface LogFeedSkeletonProps {
  rows?: number;
}

export const LogFeedSkeleton: React.FC<LogFeedSkeletonProps> = ({ rows = 14 }) => {
  const widths = [65, 80, 45, 90, 70, 85, 55, 75, 60, 95, 50, 70, 80, 60];

  return (
    <div className="feed-skeleton-container">
      {Array.from({ length: rows }).map((_, idx) => {
        const w = widths[idx % widths.length];
        return (
          <div key={idx} className="skeleton-row">
            {/* Line number placeholder */}
            <div className="skeleton-box skeleton-line-num" />

            {/* Datetime badge placeholder */}
            <div className="skeleton-box skeleton-datetime" />

            {/* PID/TID placeholder */}
            <div className="skeleton-box skeleton-badge-sm" />

            {/* Workflow badge placeholder */}
            <div className="skeleton-box skeleton-badge-md" />

            {/* Status badge placeholder */}
            <div className="skeleton-box skeleton-badge-status" />

            {/* Message placeholder with random width */}
            <div
              className="skeleton-box skeleton-message"
              style={{ width: `${w}%` }}
            />
          </div>
        );
      })}
    </div>
  );
};

interface CenterLoadingOverlayProps {
  message?: string;
  subtext?: string;
}

export const CenterLoadingOverlay: React.FC<CenterLoadingOverlayProps> = ({
  message = 'Indexing & Parsing Log Stream...',
  subtext = 'Analyzing structured tokens, timestamps, correlations & stack traces',
}) => {
  return (
    <div className="center-loading-backdrop">
      <div className="center-loading-card">
        <div className="loading-orbit-ring">
          <div className="orbit-core-dot" />
        </div>
        <div className="loading-card-text">
          <div className="loading-card-title">{message}</div>
          {subtext && <div className="loading-card-subtext">{subtext}</div>}
        </div>
      </div>
    </div>
  );
};

interface ModalLoadingStateProps {
  message?: string;
  subtext?: string;
}

export const ModalLoadingState: React.FC<ModalLoadingStateProps> = ({
  message = 'Loading Context Window...',
  subtext = 'Fetching surrounding log lines from disk',
}) => {
  return (
    <div className="modal-loading-container">
      <div className="loading-orbit-ring">
        <div className="orbit-core-dot" />
      </div>
      <div style={{ marginTop: 14, textAlign: 'center' }}>
        <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.92rem' }}>
          {message}
        </div>
        {subtext && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
};
