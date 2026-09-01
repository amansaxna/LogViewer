import React, { useState } from 'react';
import {
  Filter,
  Search,
  X,
  Code2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Download,
  List,
  LayoutList,
  Binary,
  FileText,
  WrapText,
  Sun,
  Moon,
  Radio,
  ArrowUpDown,
  GitBranch,
  GitCommit,
  Zap,
  ChevronDown,
  Check,
  Keyboard,
  Maximize,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  History,
  Activity,
} from 'lucide-react';
import { LogLevel, LogSource, SortOption } from '../types.ts';

interface TopbarProps {
  activeSource?: LogSource;
  totalEntries: number;
  filteredCount: number;
  durationMs: number;

  // Filters
  markerFilter: string;
  onMarkerFilterChange: (val: string) => void;
  isMarkerRegex: boolean;
  onToggleMarkerRegex: () => void;

  // Datetime range
  startDate?: string | null;
  endDate?: string | null;
  onDateRangeChange?: (start: string | null, end: string | null) => void;

  search: string;
  onSearchChange: (val: string) => void;
  isRegex: boolean;
  onToggleRegex: () => void;
  caseSensitive: boolean;
  onToggleCaseSensitive: () => void;
  invert: boolean;
  onToggleInvert: () => void;

  // Match navigation & line jump
  currentMatchIndex: number;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  onGoToLine?: (targetLine: number) => void;

  // Go to line modal
  onOpenGoToLine: () => void;

  // View modes
  viewMode: 'compact' | 'standard' | 'raw';
  onChangeViewMode: (mode: 'compact' | 'standard' | 'raw') => void;
  wrapLines: boolean;
  onToggleWrapLines: () => void;

  // Sorting
  sortOption: SortOption;
  onChangeSortOption: (opt: SortOption) => void;

  // Level Pills
  selectedLevels: LogLevel[];
  onToggleLevel: (level: LogLevel | 'all') => void;
  levelCounts: Record<string, number>;

  // Workflow & Operation dropdown filters
  selectedWorkflow: string | null;
  onSelectWorkflow: (wf: string | null) => void;
  workflowCounts: Record<string, number>;

  selectedOperation: string | null;
  onSelectOperation: (op: string | null) => void;
  operationCounts: Record<string, number>;

  // Correlation filter
  selectedCorrelation?: string | null;
  onSelectCorrelation?: (corr: string | null) => void;
  correlationCounts?: Record<string, number>;

  // Stream & theme
  isLiveTail: boolean;
  liveLogsPerSec?: number;
  onToggleLiveTail: () => void;
  onExportFiltered: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenShortcuts?: () => void;

  // Sidebar & Fullscreen
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const AVAILABLE_LEVELS: { key: LogLevel; label: string }[] = [
  { key: 'emergency', label: 'EMERGENCY' },
  { key: 'critical', label: 'CRITICAL' },
  { key: 'error', label: 'ERROR' },
  { key: 'warning', label: 'WARN' },
  { key: 'notice', label: 'NOTICE' },
  { key: 'info', label: 'INFO' },
  { key: 'debug', label: 'DEBUG' },
];

export const Topbar: React.FC<TopbarProps> = ({
  activeSource,
  totalEntries,
  filteredCount,
  durationMs,
  markerFilter,
  onMarkerFilterChange,
  isMarkerRegex,
  onToggleMarkerRegex,
  search,
  onSearchChange,
  isRegex,
  onToggleRegex,
  caseSensitive,
  onToggleCaseSensitive,
  invert,
  onToggleInvert,
  currentMatchIndex,
  onPrevMatch,
  onNextMatch,
  onGoToLine,
  onOpenGoToLine,
  viewMode,
  onChangeViewMode,
  wrapLines,
  onToggleWrapLines,
  sortOption,
  onChangeSortOption,
  selectedLevels,
  onToggleLevel,
  levelCounts,
  selectedWorkflow,
  onSelectWorkflow,
  workflowCounts = {},
  selectedOperation,
  onSelectOperation,
  operationCounts = {},
  selectedCorrelation,
  onSelectCorrelation,
  correlationCounts = {},
  isLiveTail,
  liveLogsPerSec = 0,
  onToggleLiveTail,
  onExportFiltered,
  startDate,
  endDate,
  onDateRangeChange,
  theme,
  onToggleTheme,
  onOpenShortcuts,
  isSidebarOpen,
  onToggleSidebar,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [lineInput, setLineInput] = useState<string>(currentMatchIndex ? currentMatchIndex.toString() : '1');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [localStartDate, setLocalStartDate] = useState(startDate || '');
  const [localEndDate, setLocalEndDate] = useState(endDate || '');
  const [isWorkflowDropdownOpen, setIsWorkflowDropdownOpen] = useState(false);
  const [isOperationDropdownOpen, setIsOperationDropdownOpen] = useState(false);
  const [isCorrelationDropdownOpen, setIsCorrelationDropdownOpen] = useState(false);
  const [workflowSearch, setWorkflowSearch] = useState('');
  const [operationSearch, setOperationSearch] = useState('');
  const [correlationSearch, setCorrelationSearch] = useState('');
  const [isPathCopied, setIsPathCopied] = useState(false);

  // Refs for click outside & mouse leave
  const workflowRef = React.useRef<HTMLDivElement>(null);
  const operationRef = React.useRef<HTMLDivElement>(null);
  const correlationRef = React.useRef<HTMLDivElement>(null);
  const datePickerRef = React.useRef<HTMLDivElement>(null);

  const wfLeaveTimer = React.useRef<any>(null);
  const opLeaveTimer = React.useRef<any>(null);
  const corrLeaveTimer = React.useRef<any>(null);
  const dtLeaveTimer = React.useRef<any>(null);

  // Sync local date strings when props change
  React.useEffect(() => {
    setLocalStartDate(startDate || '');
    setLocalEndDate(endDate || '');
  }, [startDate, endDate]);

  // Sync line input when match index changes
  React.useEffect(() => {
    setLineInput(currentMatchIndex > 0 ? currentMatchIndex.toString() : '1');
  }, [currentMatchIndex]);

  // Click outside listener for all popovers
  React.useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (workflowRef.current && !workflowRef.current.contains(target)) {
        setIsWorkflowDropdownOpen(false);
      }
      if (operationRef.current && !operationRef.current.contains(target)) {
        setIsOperationDropdownOpen(false);
      }
      if (correlationRef.current && !correlationRef.current.contains(target)) {
        setIsCorrelationDropdownOpen(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(target)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  // Mouse leave handlers (graceful close when moved outside)
  const handleWfMouseLeave = () => {
    wfLeaveTimer.current = setTimeout(() => setIsWorkflowDropdownOpen(false), 260);
  };
  const cancelWfMouseLeave = () => {
    if (wfLeaveTimer.current) clearTimeout(wfLeaveTimer.current);
  };

  const handleOpMouseLeave = () => {
    opLeaveTimer.current = setTimeout(() => setIsOperationDropdownOpen(false), 260);
  };
  const cancelOpMouseLeave = () => {
    if (opLeaveTimer.current) clearTimeout(opLeaveTimer.current);
  };

  const handleCorrMouseLeave = () => {
    corrLeaveTimer.current = setTimeout(() => setIsCorrelationDropdownOpen(false), 260);
  };
  const cancelCorrMouseLeave = () => {
    if (corrLeaveTimer.current) clearTimeout(corrLeaveTimer.current);
  };

  const handleDtMouseLeave = () => {
    dtLeaveTimer.current = setTimeout(() => setShowDatePicker(false), 260);
  };
  const cancelDtMouseLeave = () => {
    if (dtLeaveTimer.current) clearTimeout(dtLeaveTimer.current);
  };

  const handleCopyPath = () => {
    if (activeSource?.path) {
      navigator.clipboard.writeText(activeSource.path);
      setIsPathCopied(true);
      setTimeout(() => setIsPathCopied(false), 2000);
    }
  };

  const isAllSelected = selectedLevels.length === 0;

  return (
    <header className="topbar" style={{ gap: 8, padding: '10px 16px' }}>
      {/* ROW 1: DUAL FILTERS, MATCH NAVIGATOR, GO TO LINE, LINE STATS (Image 4) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Toggle Left Panel Button - ONLY shown when sidebar is collapsed to avoid duplicate button */}
        {onToggleSidebar && !isSidebarOpen && (
          <button
            className="btn-icon"
            onClick={onToggleSidebar}
            title="Expand Left Panel ([)"
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              backgroundColor: 'var(--accent-bg)',
              borderColor: 'var(--accent-primary)',
              color: 'var(--accent-primary)',
            }}
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        {/* Filter Box 1: Marker / Workflow Filter */}
        <div
          className="search-container"
          style={{
            flex: '1 1 240px',
            maxWidth: '360px',
            background: 'var(--bg-surface)',
            borderRadius: 6,
            height: 34,
            padding: '2px 8px',
            position: 'relative',
          }}
        >
          <Filter size={14} style={{ color: '#c084fc', flexShrink: 0 }} />
          <input
            type="text"
            className="search-input"
            placeholder="Marker / WF (e.g. RefundProcess)..."
            value={markerFilter}
            onChange={(e) => onMarkerFilterChange(e.target.value)}
            style={{ fontSize: '0.82rem' }}
            title="Filter by Workflow Marker regex or plain text"
          />

          <div className="search-modifiers" style={{ gap: 2 }}>
            <button
              className={`search-modifier-btn ${isMarkerRegex ? 'active' : ''}`}
              onClick={onToggleMarkerRegex}
              title="Toggle Marker Regex (.*)"
              style={{ padding: '2px 5px' }}
            >
              <Code2 size={12} />
            </button>

            {/* Datetime Picker Trigger Button */}
            <div style={{ position: 'relative' }} ref={datePickerRef}>
              <button
                className={`search-modifier-btn ${showDatePicker || startDate || endDate ? 'active' : ''}`}
                onClick={() => setShowDatePicker(!showDatePicker)}
                title={startDate || endDate ? `Date filter active: ${startDate || '...'} to ${endDate || '...'}` : "Filter by datetime range"}
                style={{
                  padding: '2px 5px',
                  color: (startDate || endDate) ? '#38bdf8' : undefined,
                  borderColor: (startDate || endDate) ? '#38bdf8' : undefined,
                  backgroundColor: (startDate || endDate) ? 'var(--accent-bg)' : undefined,
                }}
              >
                <Calendar size={12} />
              </button>

              {/* Datetime Range Picker Dropdown */}
              {showDatePicker && (
                <div
                  onMouseEnter={cancelDtMouseLeave}
                  onMouseLeave={handleDtMouseLeave}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: -120,
                    background: '#0f172a',
                    border: '1px solid #38bdf8',
                    borderRadius: 8,
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.95), 0 0 15px rgba(56, 189, 248, 0.25)',
                    zIndex: 1000,
                    minWidth: 310,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={14} /> Filter by Datetime
                    </span>
                    {(startDate || endDate) && (
                      <button
                        onClick={() => {
                          onDateRangeChange?.(null, null);
                          setShowDatePicker(false);
                        }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                        title="Reset datetime filter"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Quick Presets */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className="level-pill"
                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      onClick={() => {
                        const now = Date.now();
                        const from = new Date(now - 15 * 60 * 1000).toISOString().slice(0, 16);
                        const to = new Date(now).toISOString().slice(0, 16);
                        onDateRangeChange?.(from, to);
                        setShowDatePicker(false);
                      }}
                      title="Filter logs in the last 15 minutes"
                    >
                      Last 15m
                    </button>
                    <button
                      className="level-pill"
                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      onClick={() => {
                        const now = Date.now();
                        const from = new Date(now - 60 * 60 * 1000).toISOString().slice(0, 16);
                        const to = new Date(now).toISOString().slice(0, 16);
                        onDateRangeChange?.(from, to);
                        setShowDatePicker(false);
                      }}
                      title="Filter logs in the last 1 hour"
                    >
                      Last 1h
                    </button>
                    <button
                      className="level-pill"
                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      onClick={() => {
                        const now = Date.now();
                        const from = new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
                        const to = new Date(now).toISOString().slice(0, 16);
                        onDateRangeChange?.(from, to);
                        setShowDatePicker(false);
                      }}
                      title="Filter logs in the last 24 hours"
                    >
                      Last 24h
                    </button>
                    <button
                      className="level-pill"
                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      onClick={() => {
                        onDateRangeChange?.(null, null);
                        setShowDatePicker(false);
                      }}
                      title="Clear time filter to show all"
                    >
                      All Time
                    </button>
                  </div>

                  {/* Manual Start / End Datetime */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>From Datetime:</label>
                    <input
                      type="datetime-local"
                      value={localStartDate}
                      onChange={(e) => setLocalStartDate(e.target.value)}
                      className="sidebar-search-input"
                      style={{ fontSize: '0.78rem', padding: '5px 8px', background: '#1e293b', border: '1px solid #334155' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>To Datetime:</label>
                    <input
                      type="datetime-local"
                      value={localEndDate}
                      onChange={(e) => setLocalEndDate(e.target.value)}
                      className="sidebar-search-input"
                      style={{ fontSize: '0.78rem', padding: '5px 8px', background: '#1e293b', border: '1px solid #334155' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      className="btn-primary"
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.78rem', justifyContent: 'center' }}
                      onClick={() => {
                        onDateRangeChange?.(localStartDate || null, localEndDate || null);
                        setShowDatePicker(false);
                      }}
                      title="Apply date range filter"
                    >
                      Apply Filter
                    </button>
                    <button
                      className="toolbar-btn"
                      style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                      onClick={() => setShowDatePicker(false)}
                      title="Close date picker"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {markerFilter && (
              <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                onClick={() => onMarkerFilterChange('')}
                title="Clear marker filter"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Box 2: Search Text Filter */}
        <div
          className="search-container"
          style={{
            flex: '1 1 260px',
            maxWidth: '380px',
            background: 'var(--bg-surface)',
            borderRadius: 6,
            height: 34,
            padding: '2px 8px',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            className="search-input"
            placeholder="Search message or content..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ fontSize: '0.82rem' }}
          />

          <div className="search-modifiers" style={{ gap: 2 }}>
            <button
              className={`search-modifier-btn ${isRegex ? 'active' : ''}`}
              onClick={onToggleRegex}
              title="Toggle Regex"
              style={{ padding: '2px 5px' }}
            >
              <Code2 size={12} />
            </button>
            <button
              className={`search-modifier-btn ${caseSensitive ? 'active' : ''}`}
              onClick={onToggleCaseSensitive}
              title="Match Case"
              style={{ padding: '2px 5px', fontSize: '0.7rem' }}
            >
              Aa
            </button>
            <button
              className={`search-modifier-btn ${invert ? 'active' : ''}`}
              onClick={onToggleInvert}
              title="Invert Match"
              style={{ padding: '2px 5px', fontSize: '0.7rem' }}
            >
              !
            </button>
            {search && (
              <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                onClick={() => onSearchChange('')}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Combined Go to Line & Match Navigation (Directly Editable, e.g. [ 1 ] / 5,200 < >) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--bg-surface)',
            padding: '2px 8px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            height: 34,
          }}
          title="Directly edit current line number and press Enter to jump (or use < >)"
        >
          {/* Editable current line number input */}
          <input
            type="text"
            value={lineInput}
            onChange={(e) => setLineInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const num = parseInt(lineInput.replace(/,/g, '').trim(), 10);
                if (!isNaN(num) && num > 0) {
                  onGoToLine?.(num);
                }
              }
            }}
            onBlur={() => {
              const num = parseInt(lineInput.replace(/,/g, '').trim(), 10);
              if (!isNaN(num) && num > 0) {
                onGoToLine?.(num);
              } else {
                setLineInput(currentMatchIndex > 0 ? currentMatchIndex.toString() : '1');
              }
            }}
            onFocus={(e) => e.target.select()}
            style={{
              width: 54,
              padding: '2px 4px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              color: '#38bdf8',
              fontWeight: 700,
              fontSize: '0.82rem',
              fontFamily: 'var(--font-mono)',
              outline: 'none',
              cursor: 'text',
            }}
            title="Edit current line directly and press Enter"
          />

          <span style={{ color: 'var(--text-muted)' }}>/</span>

          <span
            style={{
              color: 'var(--text-primary)',
              minWidth: 44,
              textAlign: 'center',
              paddingRight: 4,
            }}
            title={`Total matching lines: ${filteredCount.toLocaleString()}`}
          >
            {filteredCount > 0 ? filteredCount.toLocaleString() : '0'}
          </span>

          <button
            className="btn-icon"
            onClick={onPrevMatch}
            disabled={filteredCount === 0}
            style={{ width: 22, height: 22, border: 'none' }}
            title="Previous match / line (Shift+N or Up)"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="btn-icon"
            onClick={onNextMatch}
            disabled={filteredCount === 0}
            style={{ width: 22, height: 22, border: 'none' }}
            title="Next match / line (N or Down)"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Line Count Stats (Lines: 623 / 5,688) */}
        <div
          style={{
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>Lines:</span>
          <span style={{ color: '#38bdf8', fontWeight: 700 }}>{filteredCount.toLocaleString()}</span>
          <span>/</span>
          <span>{totalEntries.toLocaleString()}</span>
          {isLiveTail && (
            <span
              style={{
                marginLeft: 6,
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: liveLogsPerSec > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.12)',
                color: liveLogsPerSec > 0 ? '#16a34a' : 'var(--text-muted)',
              }}
              title="Live arrival rate: new logs added per second"
            >
              +{liveLogsPerSec} logs/s
            </span>
          )}
          {durationMs !== undefined && (
            <span style={{ marginLeft: 6, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              ({durationMs}ms)
            </span>
          )}
        </div>

        {/* Live Tail & Theme Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Live Speed Badge */}
          {isLiveTail && (
            <div
              className="live-speed-badge"
              title={`Live stream rate: ${liveLogsPerSec} new logs added per second`}
            >
              <Activity size={12} className={liveLogsPerSec > 0 ? 'pulse-activity' : ''} />
              <span>
                <strong style={{ fontWeight: 700 }}>{liveLogsPerSec}</strong> logs/s
              </span>
            </div>
          )}

          <button
            className={`btn-live-tail ${isLiveTail ? 'active' : ''}`}
            onClick={onToggleLiveTail}
            title={isLiveTail ? `Live tailing active: ${liveLogsPerSec} logs/s - click to pause` : 'Enable live tailing'}
            style={{ height: 32, padding: '0 10px', fontSize: '0.75rem' }}
          >
            {isLiveTail && <span className="pulse-dot" />}
            <Radio size={12} />
            {isLiveTail ? 'LIVE' : 'Live'}
          </button>

          <button
            className="btn-icon"
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            style={{ width: 32, height: 32 }}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Full Screen Button */}
          {onToggleFullscreen && (
            <button
              className="btn-icon"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit Full Screen (F11)' : 'Full Screen (F11)'}
              style={{ width: 32, height: 32 }}
            >
              {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* ROW 2: SECONDARY TOOLBAR (EXPORT, COMPACT VIEW, SORTING, ASCII, PLAIN TEXT) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 6,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Export Button */}
          <button
            className="btn-secondary"
            onClick={onExportFiltered}
            style={{ height: 28, padding: '0 10px', fontSize: '0.78rem', gap: 5 }}
            title="Download current filtered log lines"
          >
            <Download size={13} />
            Export
          </button>

          {/* Copy Log Path Button */}
          {activeSource?.path && (
            <button
              className={`btn-secondary ${isPathCopied ? 'active' : ''}`}
              onClick={handleCopyPath}
              style={{
                height: 28,
                padding: '0 10px',
                fontSize: '0.78rem',
                gap: 5,
                borderColor: isPathCopied ? '#4ade80' : undefined,
                color: isPathCopied ? '#4ade80' : undefined,
                backgroundColor: isPathCopied ? 'rgba(74, 222, 128, 0.15)' : undefined,
              }}
              title={`Copy system path to clipboard: ${activeSource.path}`}
            >
              {isPathCopied ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
              {isPathCopied ? 'Path Copied!' : 'Copy Path'}
            </button>
          )}

          {/* Rotated archive indicator */}
          {activeSource?.isRotated && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
              title="Viewing rotated archive snapshot"
            >
              <History size={12} />
              Rotated Archive {activeSource.rotationSuffix && `(${activeSource.rotationSuffix})`}
            </span>
          )}

          {/* Compact View Toggle */}
          <button
            className={`btn-secondary ${viewMode === 'compact' ? 'active' : ''}`}
            onClick={() => onChangeViewMode(viewMode === 'compact' ? 'standard' : 'compact')}
            style={{
              height: 28,
              padding: '0 10px',
              fontSize: '0.78rem',
              gap: 5,
              background: viewMode === 'compact' ? 'var(--accent-bg)' : undefined,
              borderColor: viewMode === 'compact' ? 'var(--accent-primary)' : undefined,
              color: viewMode === 'compact' ? 'var(--accent-primary)' : undefined,
              fontWeight: 600,
            }}
          >
            <List size={13} />
            Compact View
          </button>

          {/* Structured View Toggle */}
          <button
            className={`btn-secondary ${viewMode === 'standard' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('standard')}
            style={{
              height: 28,
              padding: '0 10px',
              fontSize: '0.78rem',
              gap: 5,
              background: viewMode === 'standard' ? 'var(--accent-bg)' : undefined,
              borderColor: viewMode === 'standard' ? 'var(--accent-primary)' : undefined,
              color: viewMode === 'standard' ? 'var(--accent-primary)' : undefined,
            }}
          >
            <LayoutList size={13} />
            Detailed Cards
          </button>

          {/* Word Wrap Toggle */}
          <button
            className={`search-modifier-btn ${wrapLines ? 'active' : ''}`}
            onClick={onToggleWrapLines}
            style={{ height: 26, padding: '0 8px', gap: 4, display: 'flex', alignItems: 'center' }}
            title="Toggle word wrap for long log lines"
          >
            <WrapText size={12} />
            <span>Wrap</span>
          </button>

          {/* Marker & Multi-Field Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 6 }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Sort by:</span>
            <select
              value={sortOption}
              onChange={(e) => onChangeSortOption(e.target.value as SortOption)}
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: '0.76rem',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
              }}
            >
              <option value="time-asc">Time (Log Flow: Oldest → Newest)</option>
              <option value="time-desc">Time (Tail: Latest at Top)</option>
              <option value="marker-asc">Workflow Marker (A → Z)</option>
              <option value="marker-desc">Workflow Marker (Z → A)</option>
              <option value="line-asc">Line Number (Asc)</option>
              <option value="line-desc">Line Number (Desc)</option>
              <option value="duration-desc">Duration (Slowest First)</option>
              <option value="duration-asc">Duration (Fastest First)</option>
              <option value="namespace-asc">Namespace (A → Z)</option>
            </select>
          </div>

          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Showing full log lines
          </span>
        </div>

        {/* Right Buttons: ASCII & Plain Text (Image 4) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className={`btn-secondary ${viewMode === 'raw' ? 'active' : ''}`}
            onClick={() => onChangeViewMode(viewMode === 'raw' ? 'compact' : 'raw')}
            style={{
              height: 28,
              padding: '0 8px',
              fontSize: '0.76rem',
              gap: 4,
              background: viewMode === 'raw' ? 'var(--accent-bg)' : undefined,
              borderColor: viewMode === 'raw' ? 'var(--accent-primary)' : undefined,
            }}
          >
            <Binary size={12} />
            ASCII
          </button>

          <button
            className={`btn-secondary ${viewMode === 'raw' ? 'active' : ''}`}
            onClick={() => onChangeViewMode(viewMode === 'raw' ? 'compact' : 'raw')}
            style={{
              height: 28,
              padding: '0 8px',
              fontSize: '0.76rem',
              gap: 4,
            }}
          >
            <FileText size={12} />
            Plain Text
          </button>

          {/* Keyboard Shortcuts Button */}
          <button
            className="btn-secondary"
            onClick={onOpenShortcuts}
            style={{
              height: 28,
              padding: '0 8px',
              fontSize: '0.76rem',
              gap: 4,
              color: 'var(--text-secondary)',
            }}
            title="View Keyboard Shortcuts (?)"
          >
            <Keyboard size={12} />
            <span>Shortcuts</span>
            <kbd style={{ fontSize: '0.65rem', background: 'var(--bg-surface)', padding: '1px 4px', borderRadius: 3, border: '1px solid var(--border-subtle)' }}>?</kbd>
          </button>
        </div>
      </div>

      {/* ROW 3: LEVEL PILLS (REAL-TIME COUNTS) */}
      <div className="level-pills-row" style={{ paddingTop: 2 }}>
        <button
          className={`level-pill all ${isAllSelected ? 'active' : ''}`}
          onClick={() => onToggleLevel('all')}
        >
          <span>ALL</span>
          <span className="level-pill-count">{levelCounts.all || 0}</span>
        </button>

        {AVAILABLE_LEVELS.map(({ key, label }) => {
          const count = levelCounts[key] || 0;
          const isSelected = selectedLevels.includes(key);

          return (
            <button
              key={key}
              className={`level-pill ${key} ${isSelected ? 'active' : ''}`}
              onClick={() => onToggleLevel(key)}
            >
              <span>{label}</span>
              <span className="level-pill-count">{count}</span>
            </button>
          );
        })}

        {/* DIVIDER */}
        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-subtle)', margin: '0 4px', flexShrink: 0 }} />

        {/* WORKFLOW DROPDOWN TOGGLE */}
        <div style={{ position: 'relative' }}>
          <button
            className={`level-pill ${selectedWorkflow ? 'active' : ''}`}
            onClick={() => {
              setIsWorkflowDropdownOpen(!isWorkflowDropdownOpen);
              setIsOperationDropdownOpen(false);
            }}
            style={{
              backgroundColor: selectedWorkflow ? 'rgba(192, 132, 252, 0.2)' : undefined,
              borderColor: selectedWorkflow ? '#c084fc' : undefined,
              color: selectedWorkflow ? '#c084fc' : undefined,
              fontWeight: selectedWorkflow ? 700 : undefined,
            }}
          >
            <GitBranch size={12} />
            <span>{selectedWorkflow ? selectedWorkflow : 'Workflows'}</span>
            <span className="level-pill-count">
              {selectedWorkflow ? (workflowCounts[selectedWorkflow] || 0) : Object.keys(workflowCounts).length}
            </span>
            <ChevronDown size={11} />
          </button>

          {/* Active workflow clear button */}
          {selectedWorkflow && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectWorkflow(null);
              }}
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: 15,
                height: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                zIndex: 2,
              }}
              title="Clear workflow filter"
            >
              ×
            </button>
          )}

          {/* Workflow Dropdown Popup */}
          {isWorkflowDropdownOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                onClick={() => setIsWorkflowDropdownOpen(false)}
              />
              <div
                ref={workflowRef}
                onMouseEnter={cancelWfMouseLeave}
                onMouseLeave={handleWfMouseLeave}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: '#0f172a',
                  border: '1px solid rgba(192, 132, 252, 0.5)',
                  borderRadius: 8,
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.95), 0 0 15px rgba(192, 132, 252, 0.25)',
                  zIndex: 1000,
                  minWidth: 280,
                  maxWidth: 340,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', background: '#1e293b' }}>
                  <input
                    type="text"
                    placeholder="Filter active workflows..."
                    value={workflowSearch}
                    onChange={(e) => setWorkflowSearch(e.target.value)}
                    className="sidebar-search-input"
                    style={{ fontSize: '0.78rem', padding: '5px 10px', background: '#0f172a', border: '1px solid #334155' }}
                    autoFocus
                  />
                </div>

                <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 6px' }}>
                <div
                  onClick={() => {
                    onSelectWorkflow(null);
                    setIsWorkflowDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    backgroundColor: !selectedWorkflow ? 'var(--accent-bg)' : 'transparent',
                    color: !selectedWorkflow ? 'var(--accent-primary)' : 'var(--text-primary)',
                    fontWeight: !selectedWorkflow ? 600 : 400,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GitBranch size={12} />
                    All Workflows
                  </span>
                  {!selectedWorkflow && <Check size={13} color="var(--accent-primary)" />}
                </div>

                {Object.entries(workflowCounts)
                  .filter(([wf]) => wf.toLowerCase().includes(workflowSearch.toLowerCase()))
                  .sort((a, b) => b[1] - a[1])
                  .map(([wf, count]) => {
                    const isSelected = selectedWorkflow === wf;
                    return (
                      <div
                        key={wf}
                        onClick={() => {
                          onSelectWorkflow(isSelected ? null : wf);
                          setIsWorkflowDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          backgroundColor: isSelected ? 'rgba(192, 132, 252, 0.2)' : 'transparent',
                          color: isSelected ? '#c084fc' : 'var(--text-primary)',
                          fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {wf}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontFamily: 'var(--font-mono)',
                              backgroundColor: 'var(--bg-surface)',
                              padding: '1px 6px',
                              borderRadius: 4,
                              color: isSelected ? '#c084fc' : 'var(--text-muted)',
                            }}
                          >
                            {count}
                          </span>
                          {isSelected && <Check size={13} color="#c084fc" />}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            </>
          )}
        </div>

        {/* OPERATION DROPDOWN TOGGLE */}
        <div style={{ position: 'relative' }}>
          <button
            className={`level-pill ${selectedOperation ? 'active' : ''}`}
            onClick={() => {
              setIsOperationDropdownOpen(!isOperationDropdownOpen);
              setIsWorkflowDropdownOpen(false);
            }}
            style={{
              backgroundColor: selectedOperation ? 'rgba(251, 146, 60, 0.2)' : undefined,
              borderColor: selectedOperation ? '#fb923c' : undefined,
              color: selectedOperation ? '#fb923c' : undefined,
              fontWeight: selectedOperation ? 700 : undefined,
            }}
          >
            <Zap size={12} />
            <span>{selectedOperation ? selectedOperation : 'Operations'}</span>
            <span className="level-pill-count">
              {selectedOperation ? (operationCounts[selectedOperation] || 0) : Object.keys(operationCounts).length}
            </span>
            <ChevronDown size={11} />
          </button>

          {/* Active operation clear button */}
          {selectedOperation && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectOperation(null);
              }}
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: 15,
                height: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                zIndex: 2,
              }}
              title="Clear operation filter"
            >
              ×
            </button>
          )}

          {/* Operation Dropdown Popup */}
          {isOperationDropdownOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                onClick={() => setIsOperationDropdownOpen(false)}
              />
              <div
                ref={operationRef}
                onMouseEnter={cancelOpMouseLeave}
                onMouseLeave={handleOpMouseLeave}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: '#0f172a',
                  border: '1px solid rgba(251, 146, 60, 0.5)',
                  borderRadius: 8,
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.95), 0 0 15px rgba(251, 146, 60, 0.25)',
                  zIndex: 1000,
                  minWidth: 280,
                  maxWidth: 360,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', background: '#1e293b' }}>
                  <input
                    type="text"
                    placeholder="Filter active operations..."
                    value={operationSearch}
                    onChange={(e) => setOperationSearch(e.target.value)}
                    className="sidebar-search-input"
                    style={{ fontSize: '0.78rem', padding: '5px 10px', background: '#0f172a', border: '1px solid #334155' }}
                    autoFocus
                  />
                </div>

                <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 6px' }}>
                  <div
                    onClick={() => {
                      onSelectOperation(null);
                      setIsOperationDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      backgroundColor: !selectedOperation ? 'var(--accent-bg)' : 'transparent',
                      color: !selectedOperation ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontWeight: !selectedOperation ? 600 : 400,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={12} />
                      All Operations
                    </span>
                    {!selectedOperation && <Check size={13} color="var(--accent-primary)" />}
                  </div>

                  {Object.entries(operationCounts)
                    .filter(([op]) => op.toLowerCase().includes(operationSearch.toLowerCase()))
                    .sort((a, b) => b[1] - a[1])
                    .map(([op, count]) => {
                      const isSelected = selectedOperation === op;
                      return (
                        <div
                          key={op}
                          onClick={() => {
                            onSelectOperation(isSelected ? null : op);
                            setIsOperationDropdownOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            backgroundColor: isSelected ? 'rgba(251, 146, 60, 0.2)' : 'transparent',
                            color: isSelected ? '#fb923c' : 'var(--text-primary)',
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {op}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontFamily: 'var(--font-mono)',
                                backgroundColor: 'var(--bg-surface)',
                                padding: '1px 6px',
                                borderRadius: 4,
                                color: isSelected ? '#fb923c' : 'var(--text-muted)',
                              }}
                            >
                              {count}
                            </span>
                            {isSelected && <Check size={13} color="#fb923c" />}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* CORRELATION ID DROPDOWN TOGGLE */}
        <div style={{ position: 'relative' }}>
          <button
            className={`level-pill ${selectedCorrelation ? 'active' : ''}`}
            onClick={() => {
              setIsCorrelationDropdownOpen(!isCorrelationDropdownOpen);
              setIsWorkflowDropdownOpen(false);
              setIsOperationDropdownOpen(false);
            }}
            style={{
              backgroundColor: selectedCorrelation ? 'rgba(52, 211, 153, 0.2)' : undefined,
              borderColor: selectedCorrelation ? '#34d399' : undefined,
              color: selectedCorrelation ? '#34d399' : undefined,
              fontWeight: selectedCorrelation ? 700 : undefined,
            }}
            title="Filter by Correlation ID"
          >
            <GitCommit size={12} />
            <span>{selectedCorrelation ? selectedCorrelation : 'Correlation'}</span>
            <span
              className="level-pill-count"
              style={{
                backgroundColor: selectedCorrelation ? '#34d399' : undefined,
                color: selectedCorrelation ? '#000' : undefined,
              }}
            >
              {selectedCorrelation
                ? (correlationCounts[selectedCorrelation] || 0)
                : Object.keys(correlationCounts).length}
            </span>
            <ChevronDown size={11} />
          </button>

          {/* Active correlation clear button */}
          {selectedCorrelation && onSelectCorrelation && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectCorrelation(null);
              }}
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: 15,
                height: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                zIndex: 2,
              }}
              title="Clear correlation filter"
            >
              ×
            </button>
          )}

          {/* Correlation Dropdown Popup */}
          {isCorrelationDropdownOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                onClick={() => setIsCorrelationDropdownOpen(false)}
              />
              <div
                ref={correlationRef}
                onMouseEnter={cancelCorrMouseLeave}
                onMouseLeave={handleCorrMouseLeave}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: '#0f172a',
                  border: '1px solid rgba(52, 211, 153, 0.5)',
                  borderRadius: 8,
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.95), 0 0 15px rgba(52, 211, 153, 0.25)',
                  zIndex: 1000,
                  minWidth: 280,
                  maxWidth: 360,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', background: '#1e293b' }}>
                  <input
                    type="text"
                    placeholder="Filter correlation IDs..."
                    value={correlationSearch}
                    onChange={(e) => setCorrelationSearch(e.target.value)}
                    className="sidebar-search-input"
                    style={{ fontSize: '0.78rem', padding: '5px 10px', background: '#0f172a', border: '1px solid #334155' }}
                    autoFocus
                  />
                </div>

                <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 6px' }}>
                  <div
                    onClick={() => {
                      onSelectCorrelation?.(null);
                      setIsCorrelationDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      backgroundColor: !selectedCorrelation ? 'var(--accent-bg)' : 'transparent',
                      color: !selectedCorrelation ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontWeight: !selectedCorrelation ? 600 : 400,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <GitCommit size={12} />
                      All Correlation IDs
                    </span>
                    {!selectedCorrelation && <Check size={13} color="var(--accent-primary)" />}
                  </div>

                  {Object.entries(correlationCounts)
                    .filter(([corr]) => corr.toLowerCase().includes(correlationSearch.toLowerCase()))
                    .sort((a, b) => b[1] - a[1])
                    .map(([corr, count]) => {
                      const isSelected = selectedCorrelation === corr;
                      return (
                        <div
                          key={corr}
                          onClick={() => {
                            onSelectCorrelation?.(isSelected ? null : corr);
                            setIsCorrelationDropdownOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            backgroundColor: isSelected ? 'rgba(52, 211, 153, 0.2)' : 'transparent',
                            color: isSelected ? '#34d399' : 'var(--text-primary)',
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-mono)' }}>
                            {corr}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontFamily: 'var(--font-mono)',
                                backgroundColor: 'var(--bg-surface)',
                                padding: '1px 6px',
                                borderRadius: 4,
                                color: isSelected ? '#34d399' : 'var(--text-muted)',
                              }}
                            >
                              {count}
                            </span>
                            {isSelected && <Check size={13} color="#34d399" />}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
