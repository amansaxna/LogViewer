import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LogEntry } from '../types.ts';
import { LogRow } from './LogRow.tsx';

interface LogTableProps {
  entries: LogEntry[];
  isLiveTail: boolean;
  onViewContext: (lineNumber: number) => void;
  wrapLines?: boolean;
}

export const LogTable: React.FC<LogTableProps> = ({
  entries,
  isLiveTail,
  onViewContext,
  wrapLines = false,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 20,
  });

  // Auto-scroll to bottom or top if live tail is active and new items arrive
  useEffect(() => {
    if (isLiveTail && entries.length > 0 && parentRef.current) {
      parentRef.current.scrollTop = 0; // or bottom if newest first vs oldest
    }
  }, [entries.length, isLiveTail]);

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

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="log-feed-container">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualRow) => {
          const entry = entries[virtualRow.index];
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
              <LogRow entry={entry} onViewContext={onViewContext} wrapLines={wrapLines} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
