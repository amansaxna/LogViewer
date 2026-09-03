import React, { useState, useEffect, useRef } from 'react';
import { Columns2, X, Link2, Unlink, Search, Filter, RefreshCw, FileText } from 'lucide-react';
import { LogEntry, LogSource, LogLevel, SortOption } from '../types.ts';
import { LogTable } from './LogTable.tsx';
import { evaluateQuery } from '../utils/queryEngine.ts';

interface DualPaneViewerProps {
  sources: LogSource[];
  leftSource: LogSource | undefined;
  leftEntries: LogEntry[];
  leftTotal: number;
  rightSourceId: string | null;
  onSelectRightSource: (id: string) => void;
  onCloseSplit: () => void;
  theme: 'dark' | 'light';
  wrapLines: boolean;
  hideBrackets: boolean;
  viewMode: 'compact' | 'standard' | 'raw';
  onViewContext?: (line: number) => void;
  onSelectLine?: (line: number) => void;
  selectedLineNumber?: number | null;
  showDatetime?: boolean;
  showPid?: boolean;
  showTid?: boolean;
  showCorrelation?: boolean;
  sortOption?: SortOption;
}

export const DualPaneViewer: React.FC<DualPaneViewerProps> = ({
  sources,
  leftSource,
  leftEntries,
  leftTotal,
  rightSourceId,
  onSelectRightSource,
  onCloseSplit,
  wrapLines,
  hideBrackets,
  viewMode,
  onViewContext = () => {},
  onSelectLine = () => {},
  selectedLineNumber = null,
  showDatetime,
  showPid,
  showTid,
  showCorrelation,
  sortOption = 'time-asc',
}) => {
  const [rightEntries, setRightEntries] = useState<LogEntry[]>([]);
  const [rightTotal, setRightTotal] = useState(0);
  const [rightLoading, setRightLoading] = useState(false);
  const [rightSearch, setRightSearch] = useState('');
  const [isSyncScroll, setIsSyncScroll] = useState(false);
  const [selectedRightLine, setSelectedRightLine] = useState<number | null>(null);

  // Auto-select secondary source if not set
  useEffect(() => {
    if (!rightSourceId && sources.length > 1) {
      const otherSource = sources.find((s) => s.id !== leftSource?.id) || sources[0];
      if (otherSource) {
        onSelectRightSource(otherSource.id);
      }
    }
  }, [rightSourceId, sources, leftSource, onSelectRightSource]);

  // Fetch right pane entries whenever rightSourceId changes
  useEffect(() => {
    if (!rightSourceId) return;

    let isMounted = true;
    setRightLoading(true);

    fetch(`/api/logs?sourceId=${encodeURIComponent(rightSourceId)}&limit=5000`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setRightEntries(data.entries || []);
          setRightTotal(data.total || 0);
        }
      })
      .catch((err) => console.error('Failed to load secondary source logs:', err))
      .finally(() => {
        if (isMounted) setRightLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [rightSourceId]);

  // Filter right entries
  const displayRightEntries = React.useMemo(() => {
    if (!rightSearch.trim()) return rightEntries;
    return rightEntries.filter((entry) => evaluateQuery(entry, rightSearch));
  }, [rightEntries, rightSearch]);

  const rightSource = sources.find((s) => s.id === rightSourceId);

  return (
    <div
      className="dual-pane-container"
      style={{
        display: 'flex',
        flex: 1,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-app)',
      }}
    >
      {/* LEFT PANE */}
      <div
        className="dual-pane-left"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1.5px solid var(--border-subtle)',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Left Pane Sub-header */}
        <div
          style={{
            padding: '6px 14px',
            background: 'var(--bg-sidebar)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-primary)' }}>
            <FileText size={14} color="#38bdf8" />
            <span>{leftSource?.name || 'Primary Source'}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({leftTotal.toLocaleString()} lines)</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 600 }}>PANE 1</span>
        </div>

        {/* Left Log Table */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <LogTable
            entries={leftEntries}
            isLoading={false}
            isLiveTail={false}
            onViewContext={onViewContext}
            wrapLines={wrapLines}
            hideBrackets={hideBrackets}
            viewMode={viewMode}
            selectedLineNumber={selectedLineNumber}
            onSelectLine={onSelectLine}
            showDatetime={showDatetime}
            showPid={showPid}
            showTid={showTid}
            showCorrelation={showCorrelation}
            sortOption={sortOption}
          />
        </div>
      </div>

      {/* RIGHT PANE */}
      <div
        className="dual-pane-right"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Right Pane Sub-header & Controls */}
        <div
          style={{
            padding: '6px 14px',
            background: 'var(--bg-sidebar)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            fontSize: '0.78rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Source Picker for Right Pane */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={14} color="#c084fc" />
            <select
              value={rightSourceId || ''}
              onChange={(e) => onSelectRightSource(e.target.value)}
              style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: 4,
                padding: '2px 6px',
                outline: 'none',
                maxWidth: 200,
              }}
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.category || 'General'})
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              ({rightTotal.toLocaleString()} lines)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Quick Search for Right Pane */}
            <div
              className="search-container"
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 6,
                height: 24,
                padding: '2px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Search size={11} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter right pane..."
                value={rightSearch}
                onChange={(e) => setRightSearch(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.72rem',
                  outline: 'none',
                  width: 110,
                }}
              />
              {rightSearch && (
                <button
                  type="button"
                  onClick={() => setRightSearch('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={10} />
                </button>
              )}
            </div>

            {/* Close Split View */}
            <button
              type="button"
              className="btn-icon"
              onClick={onCloseSplit}
              style={{ width: 24, height: 24 }}
              title="Close Split View (Esc)"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Right Log Table */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <LogTable
            entries={displayRightEntries}
            isLoading={rightLoading}
            isLiveTail={false}
            onViewContext={onViewContext}
            wrapLines={wrapLines}
            hideBrackets={hideBrackets}
            viewMode={viewMode}
            selectedLineNumber={selectedRightLine}
            onSelectLine={(line) => setSelectedRightLine(line)}
            showDatetime={showDatetime}
            showPid={showPid}
            showTid={showTid}
            showCorrelation={showCorrelation}
            sortOption={sortOption}
          />
        </div>
      </div>
    </div>
  );
};
