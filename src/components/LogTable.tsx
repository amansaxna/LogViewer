import React, { useRef, useEffect, useMemo } from 'react';
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
  onViewContext: (lineNumber: number, sourceId?: string) => void;
  wrapLines?: boolean;
  viewMode?: 'compact' | 'standard' | 'raw';
  selectedLineNumber: number | null;
  selectedLineNumbers?: Set<number>;
  selectedEntryId?: string | null;
  selectedEntryIds?: Set<string>;
  onSelectLine: (lineNumber: number, isShift?: boolean, entry?: LogEntry, isCtrlOrMeta?: boolean) => void;
  searchQuery?: string;
  markerQuery?: string;
  correlationQuery?: string;
  targetScrollIndex?: number | null;
  showDatetime?: boolean;
  showPid?: boolean;
  showTid?: boolean;
  showCorrelation?: boolean;
  hideBrackets?: boolean;
  sortOption?: string;
  isUnifiedStream?: boolean;
  deltaAnchorLine?: number | null;
  deltaTargetLine?: number | null;
  onSetDeltaAnchor?: (lineNumber: number) => void;
}

export const LogTable: React.FC<LogTableProps> = ({
  entries,
  isLoading = false,
  isLiveTail,
  onViewContext,
  onSetDeltaAnchor,
  wrapLines = false,
  viewMode = 'compact',
  selectedLineNumber,
  selectedLineNumbers,
  selectedEntryId,
  selectedEntryIds,
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
  sortOption = 'time-asc',
  isUnifiedStream = false,
  deltaAnchorLine = null,
  deltaTargetLine = null,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = React.useState(false);

  const isTailAtTop = Boolean(sortOption && sortOption.endsWith('desc'));

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (viewMode === 'compact' ? 26 : viewMode === 'raw' ? 24 : 42),
    overscan: 30,
  });

  const scrollToTail = React.useCallback(() => {
    if (entries.length === 0) return;
    setIsAutoScrollPaused(false);
    if (isTailAtTop) {
      virtualizer.scrollToIndex(0, { align: 'start' });
      if (parentRef.current) parentRef.current.scrollTop = 0;
    } else {
      virtualizer.scrollToIndex(entries.length - 1, { align: 'end' });
      if (parentRef.current) parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, [isTailAtTop, entries.length, virtualizer]);

  // When live tail is enabled, unpause auto-scroll and immediately jump to tail
  useEffect(() => {
    if (isLiveTail && entries.length > 0) {
      setIsAutoScrollPaused(false);
      if (isTailAtTop) {
        virtualizer.scrollToIndex(0, { align: 'start' });
      } else {
        virtualizer.scrollToIndex(entries.length - 1, { align: 'end' });
      }
    }
  }, [isLiveTail]);

  // Handle user manual scroll: if user scrolls away from tail, pause auto-scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isLiveTail) return;
    const el = e.currentTarget;
    if (isTailAtTop) {
      if (el.scrollTop > 80) {
        setIsAutoScrollPaused(true);
      } else {
        setIsAutoScrollPaused(false);
      }
    } else {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom > 100) {
        setIsAutoScrollPaused(true);
      } else {
        setIsAutoScrollPaused(false);
      }
    }
  };

  // Auto-scroll when new logs arrive in live tail mode
  useEffect(() => {
    if (isLiveTail && entries.length > 0 && !isAutoScrollPaused && parentRef.current) {
      if (isTailAtTop) {
        virtualizer.scrollToIndex(0, { align: 'start' });
        parentRef.current.scrollTop = 0;
      } else {
        virtualizer.scrollToIndex(entries.length - 1, { align: 'end' });
      }
    }
  }, [entries.length, isLiveTail, isAutoScrollPaused, isTailAtTop, virtualizer]);

  // Scroll to target index when match, arrow keys, or go-to-line changes
  useEffect(() => {
    if (targetScrollIndex !== undefined && targetScrollIndex !== null && targetScrollIndex >= 0 && targetScrollIndex < entries.length) {
      virtualizer.scrollToIndex(targetScrollIndex, { align: 'auto' });
    }
  }, [targetScrollIndex, entries.length, virtualizer]);

  // Dynamically compute gutter width based on maximum line number in dataset (Hooks at top level)
  const maxLineNumber = useMemo(() => {
    if (!entries || entries.length === 0) return 1;
    let max = 1;
    const len = entries.length;
    for (let i = 0; i < Math.min(len, 100); i++) {
      if (entries[i].lineNumber > max) max = entries[i].lineNumber;
    }
    for (let i = Math.max(0, len - 100); i < len; i++) {
      if (entries[i].lineNumber > max) max = entries[i].lineNumber;
    }
    return max;
  }, [entries]);

  const gutterWidth = useMemo(() => {
    const digits = String(maxLineNumber).length;
    return Math.max(48, digits * 9 + 20);
  }, [maxLineNumber]);

  const items = virtualizer.getVirtualItems();

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

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      className="log-feed-container"
      style={{
        position: 'relative',
        background: 'var(--bg-app)',
        paddingBottom: 40,
        overflowX: 'auto',
      }}
    >
      <TopProgressBar isVisible={isLoading} />

      {/* Floating Follow Live Tail Button */}
      {isLiveTail && isAutoScrollPaused && (
        <button
          onClick={scrollToTail}
          style={{
            position: 'sticky',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 16px',
            borderRadius: 20,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '1.5px solid #38bdf8',
            color: '#38bdf8',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5), 0 0 14px rgba(56, 189, 248, 0.4)',
            zIndex: 100,
            backdropFilter: 'blur(8px)',
          }}
          title="Resume auto-scrolling to newest logs"
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
              display: 'inline-block',
            }}
          />
          <span>{isTailAtTop ? '↑ Resume Live Tail' : '↓ Follow Live Tail'}</span>
        </button>
      )}

      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualRow) => {
          const entry = entries[virtualRow.index];
          const entryKey = entry.id || `${entry.sourceId || ''}-${entry.lineNumber}`;
          const isSelected = selectedEntryIds && selectedEntryIds.size > 0
            ? selectedEntryIds.has(entryKey)
            : selectedEntryId
            ? selectedEntryId === entryKey
            : selectedLineNumbers && selectedLineNumbers.size > 0
            ? selectedLineNumbers.has(entry.lineNumber) && (!isUnifiedStream || (selectedEntryId ? selectedEntryId === entryKey : true))
            : selectedLineNumber === entry.lineNumber && (!isUnifiedStream || (selectedEntryId ? selectedEntryId === entryKey : true));

          const isDeltaAnchor = deltaAnchorLine === entry.lineNumber;
          const isDeltaTarget = deltaTargetLine === entry.lineNumber;
          const isDeltaInRange = Boolean(
            deltaAnchorLine !== null &&
            deltaTargetLine !== null &&
            ((entry.lineNumber > Math.min(deltaAnchorLine, deltaTargetLine) &&
              entry.lineNumber < Math.max(deltaAnchorLine, deltaTargetLine)))
          );

          return (
            <div
              key={entryKey || virtualRow.index}
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
                  isSelected={Boolean(isSelected)}
                  onSelect={(line, isShift, ent, isCtrl) => onSelectLine(line, isShift, ent || entry, isCtrl)}
                  onDoubleClick={(line, srcId) => onViewContext(line, srcId || entry.sourceId)}
                  searchQuery={searchQuery}
                  markerQuery={markerQuery}
                  correlationQuery={correlationQuery}
                  wrapLines={wrapLines}
                  hideBrackets={hideBrackets}
                  showDatetime={showDatetime}
                  showPid={showPid}
                  showTid={showTid}
                  showCorrelation={showCorrelation}
                  isUnifiedStream={isUnifiedStream}
                  isDeltaAnchor={isDeltaAnchor}
                  isDeltaTarget={isDeltaTarget}
                  isDeltaInRange={isDeltaInRange}
                  gutterWidth={gutterWidth}
                />
              ) : viewMode === 'raw' ? (
                <div
                  onClick={(e) => onSelectLine(entry.lineNumber, e.shiftKey, entry, e.ctrlKey || e.metaKey)}
                  onDoubleClick={() => onViewContext(entry.lineNumber, entry.sourceId)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                    borderLeft: isSelected ? '4px solid #facc15' : '4px solid transparent',
                    padding: '2px 8px 2px 0',
                    cursor: 'pointer',
                    minWidth: wrapLines ? undefined : 'max-content',
                    width: '100%',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.81rem',
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    style={{
                      width: Math.max(gutterWidth, String(entry.lineNumber).length * 9 + 18),
                      minWidth: Math.max(gutterWidth, String(entry.lineNumber).length * 9 + 18),
                      color: isSelected ? '#facc15' : '#64748b',
                      userSelect: 'none',
                      flexShrink: 0,
                      textAlign: 'right',
                      paddingRight: 8,
                      paddingLeft: 4,
                      boxSizing: 'border-box',
                      fontWeight: isSelected ? 700 : 400,
                      position: 'sticky',
                      left: 0,
                      backgroundColor: isSelected ? 'var(--gutter-selected-bg)' : 'var(--bg-app)',
                      zIndex: 2,
                    }}
                  >
                    {entry.lineNumber}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      whiteSpace: wrapLines ? 'pre-wrap' : 'nowrap',
                      wordBreak: wrapLines ? 'break-word' : 'normal',
                    }}
                  >
                    {renderSyntaxColoredLine(entry.raw, {
                      hideBrackets,
                      showDatetime,
                      showPid,
                      showTid,
                      showCorrelation,
                    })}
                  </div>
                </div>
              ) : (
                <LogRow
                  entry={entry}
                  isSelected={isSelected}
                  onSelect={(line, isShift, ent, isCtrl) => onSelectLine(line, isShift, ent || entry, isCtrl)}
                  onViewContext={(line, srcId) => onViewContext(line, srcId || entry.sourceId)}
                  onSetDeltaAnchor={onSetDeltaAnchor}
                  wrapLines={wrapLines}
                  hideBrackets={hideBrackets}
                  showDatetime={showDatetime}
                  showPid={showPid}
                  showTid={showTid}
                  showCorrelation={showCorrelation}
                  searchQuery={searchQuery}
                  isUnifiedStream={isUnifiedStream}
                  isDeltaAnchor={isDeltaAnchor}
                  isDeltaTarget={isDeltaTarget}
                  isDeltaInRange={isDeltaInRange}
                  gutterWidth={gutterWidth}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
