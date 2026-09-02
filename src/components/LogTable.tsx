import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LogEntry } from '../types.ts';
import { LogRow } from './LogRow.tsx';
import { CompactLogRow } from './CompactLogRow.tsx';
import { renderSyntaxColoredLine } from '../utils/coloredLogRenderer.tsx';
import { TopProgressBar, LogFeedSkeleton, CenterLoadingOverlay } from './Loaders.tsx';

interface LogTableProps {
  entries: LogEntry[];
  isLoading?: boolean;
  isLiveTail: boolean;
  onViewContext: (lineNumber: number) => void;
  wrapLines?: boolean;
  viewMode?: 'compact' | 'standard' | 'raw';
  selectedLineNumber: number | null;
  onSelectLine: (lineNumber: number) => void;
  searchQuery?: string;
  markerQuery?: string;
  correlationQuery?: string;
  targetScrollIndex?: number | null;
  showDatetime?: boolean;
  showPid?: boolean;
  showTid?: boolean;
  showCorrelation?: boolean;
  hideBrackets?: boolean;
}

export const LogTable: React.FC<LogTableProps> = ({
  entries,
  isLoading = false,
  isLiveTail,
  onViewContext,
  wrapLines = false,
  viewMode = 'compact',
  selectedLineNumber,
  onSelectLine,
  searchQuery,
  markerQuery,
  correlationQuery,
  targetScrollIndex,
  showDatetime = true,
  showPid = true,
  showTid = true,
  showCorrelation = true,
  hideBrackets = false,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (viewMode === 'compact' ? 26 : 42),
    overscan: 30,
  });

  // Auto-scroll to top if live tail is active
  useEffect(() => {
    if (isLiveTail && entries.length > 0 && parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
  }, [entries.length, isLiveTail]);

  // Scroll to target index when match, arrow keys, or go-to-line changes
  useEffect(() => {
    if (targetScrollIndex !== undefined && targetScrollIndex !== null && targetScrollIndex >= 0 && targetScrollIndex < entries.length) {
      virtualizer.scrollToIndex(targetScrollIndex, { align: 'auto' });
    }
  }, [targetScrollIndex, entries.length, virtualizer]);

  if (entries.length === 0) {
    if (isLoading) {
      return (
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden', height: '100%' }}>
          <TopProgressBar isVisible={true} />
          <LogFeedSkeleton rows={16} />
          <CenterLoadingOverlay
            message="Indexing & Parsing Log Stream..."
            subtext="Analyzing structured tokens, timestamps, correlations & stack traces"
          />
        </div>
      );
    }

    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: 'var(--text-muted)',
          padding: 40,
        }}
      >
        <div style={{ fontSize: '2.5rem' }}>🪵</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          No Log Entries Found
        </div>
        <div style={{ fontSize: '0.85rem' }}>
          Try clearing your search query or enabling more severity levels.
        </div>
      </div>
    );
  }

  // Raw plain-text / ASCII view
  if (viewMode === 'raw') {
    return (
      <div
        ref={parentRef}
        className="log-feed-container"
        style={{
          position: 'relative',
          padding: '12px 16px',
          background: 'var(--bg-app)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.81rem',
          lineHeight: 1.6,
          color: 'var(--text-primary)',
          whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
          overflowX: 'auto',
        }}
      >
        <TopProgressBar isVisible={isLoading} />
        {entries.map((e) => {
          const isSelected = selectedLineNumber === e.lineNumber;
          return (
            <div
              key={e.id}
              onClick={() => onSelectLine(e.lineNumber)}
              onDoubleClick={() => onViewContext(e.lineNumber)}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                borderLeft: isSelected ? '4px solid #facc15' : '4px solid transparent',
                padding: '2px 8px 2px 0',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 54,
                  minWidth: 54,
                  color: isSelected ? '#facc15' : '#64748b',
                  userSelect: 'none',
                  flexShrink: 0,
                  textAlign: 'right',
                  paddingRight: 14,
                  fontWeight: isSelected ? 700 : 400,
                }}
              >
                {e.lineNumber}
              </span>
              <div style={{ flex: 1 }}>
                {renderSyntaxColoredLine(e.raw, hideBrackets)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="log-feed-container"
      style={{
        position: 'relative',
        background: 'var(--bg-app)',
        paddingBottom: 40,
      }}
    >
      <TopProgressBar isVisible={isLoading} />
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualRow) => {
          const entry = entries[virtualRow.index];
          const isSelected = selectedLineNumber === entry.lineNumber;

          return (
            <div
              key={virtualRow.index}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {viewMode === 'compact' ? (
                <CompactLogRow
                  entry={entry}
                  isSelected={isSelected}
                  onSelect={(line) => onSelectLine(line)}
                  onDoubleClick={(line) => onViewContext(line)}
                  searchQuery={searchQuery}
                  markerQuery={markerQuery}
                  correlationQuery={correlationQuery}
                  wrapLines={wrapLines}
                  hideBrackets={hideBrackets}
                  showDatetime={showDatetime}
                  showPid={showPid}
                  showTid={showTid}
                  showCorrelation={showCorrelation}
                />
              ) : (
                <LogRow
                  entry={entry}
                  onViewContext={onViewContext}
                  wrapLines={wrapLines}
                  hideBrackets={hideBrackets}
                  showDatetime={showDatetime}
                  showPid={showPid}
                  showTid={showTid}
                  showCorrelation={showCorrelation}
                  searchQuery={searchQuery}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
