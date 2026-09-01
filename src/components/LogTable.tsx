import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LogEntry } from '../types.ts';
import { LogRow } from './LogRow.tsx';
import { CompactLogRow } from './CompactLogRow.tsx';
import { renderSyntaxColoredLine } from '../utils/coloredLogRenderer.tsx';

interface LogTableProps {
  entries: LogEntry[];
  isLiveTail: boolean;
  onViewContext: (lineNumber: number) => void;
  wrapLines?: boolean;
  viewMode?: 'compact' | 'standard' | 'raw';
  selectedLineNumber: number | null;
  onSelectLine: (lineNumber: number) => void;
  searchQuery?: string;
  markerQuery?: string;
  targetScrollIndex?: number | null;
}

export const LogTable: React.FC<LogTableProps> = ({
  entries,
  isLiveTail,
  onViewContext,
  wrapLines = false,
  viewMode = 'compact',
  selectedLineNumber,
  onSelectLine,
  searchQuery,
  markerQuery,
  targetScrollIndex,
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

  // Scroll to target index when match or go-to-line changes
  useEffect(() => {
    if (targetScrollIndex !== undefined && targetScrollIndex !== null && targetScrollIndex >= 0 && targetScrollIndex < entries.length) {
      virtualizer.scrollToIndex(targetScrollIndex, { align: 'center' });
    }
  }, [targetScrollIndex, entries.length, virtualizer]);

  if (entries.length === 0) {
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
                {renderSyntaxColoredLine(e.raw)}
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
        background: 'var(--bg-app)',
        paddingBottom: 40,
      }}
    >
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
                  wrapLines={wrapLines}
                />
              ) : (
                <LogRow
                  entry={entry}
                  onViewContext={onViewContext}
                  wrapLines={wrapLines}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
