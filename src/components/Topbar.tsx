import React, { useState } from 'react';
import {
  Filter,
  Search,
  X,
  Regex,
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
  RotateCcw,
  Sliders,
  Plus,
  Trash2,
  Columns2,
  Cpu,
  Hash,
} from 'lucide-react';
import { LogLevel, LogSource, SortOption, LogPreset } from '../types.ts';
import { Spinner } from './Loaders.tsx';

interface TopbarProps {
  activeSource?: LogSource;
  totalEntries: number;
  filteredCount: number;
  durationMs: number;

  // Split View & Waterfall
  isSplitView?: boolean;
  onToggleSplitView?: () => void;
  onOpenWaterfall?: () => void;

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
  hideBrackets?: boolean;
  onToggleHideBrackets?: () => void;

  // Sorting
  sortOption: SortOption;
  onChangeSortOption: (opt: SortOption) => void;

  // Level Pills
  selectedLevels: LogLevel[];
  excludeLevels?: LogLevel[];
  onToggleLevel: (level: LogLevel | 'all') => void;
  onToggleExcludeLevel?: (level: LogLevel) => void;
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

  // Process (PID) filter
  selectedPid?: string | null;
  onSelectPid?: (pid: string | null) => void;
  pidCounts?: Record<string, number>;

  // Thread (TID) filter
  selectedTid?: string | null;
  onSelectTid?: (tid: string | null) => void;
  tidCounts?: Record<string, number>;

  // Stream & theme
  isLiveTail: boolean;
  liveLogsPerSec?: number;
  liveAvgLogsPerSec?: number;
  fileAvgLogsPerSec?: number;
  liveTotalAdded?: number;
  onToggleLiveTail: () => void;
  onExportFiltered: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenShortcuts?: () => void;
  onResetSettings?: () => void;

  // Sidebar & Fullscreen
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;

  // Metadata token visibility toggles (Datetime, PID, TID, Correlation)
  showDatetime?: boolean;
  onToggleShowDatetime?: () => void;
  showPid?: boolean;
  onToggleShowPid?: () => void;
  showTid?: boolean;
  onToggleShowTid?: () => void;
  showCorrelation?: boolean;
  onToggleShowCorrelation?: () => void;
  onToggleAllMeta?: () => void;
  isLoading?: boolean;

  // Presets
  presets?: LogPreset[];
  activePresetId?: string | null;
  onSelectPreset?: (id: string | null) => void;
  onOpenPresetModal?: () => void;
  onCreateNewPreset?: () => void;
}

const AVAILABLE_LEVELS: { key: LogLevel; label: string }[] = [
  { key: 'error', label: 'ERROR' },
  { key: 'warning', label: 'WARN' },
  { key: 'info', label: 'INFO' },
  { key: 'audit', label: 'AUDIT' },
  { key: 'debug', label: 'DEBUG' },
];

const SORT_CONFIG: { key: SortOption; short: string; label: string }[] = [
  { key: 'time-desc', short: 'Time ↓', label: 'Time (Newest at Top)' },
  { key: 'time-asc', short: 'Time ↑', label: 'Time (Oldest First)' },
  { key: 'marker-asc', short: 'Marker A→Z', label: 'Workflow Marker (A → Z)' },
  { key: 'marker-desc', short: 'Marker Z→A', label: 'Workflow Marker (Z → A)' },
  { key: 'line-asc', short: 'Line ↑', label: 'Line Number (Asc)' },
  { key: 'line-desc', short: 'Line ↓', label: 'Line Number (Desc)' },
  { key: 'duration-desc', short: 'Duration ↓', label: 'Duration (Longest First)' },
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
  hideBrackets = false,
  onToggleHideBrackets,
  sortOption,
  onChangeSortOption,
  selectedLevels,
  excludeLevels = [],
  onToggleLevel,
  onToggleExcludeLevel,
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
  selectedPid,
  onSelectPid,
  pidCounts = {},
  selectedTid,
  onSelectTid,
  tidCounts = {},
  isLiveTail,
  liveLogsPerSec = 0,
  liveAvgLogsPerSec = 0,
  fileAvgLogsPerSec = 0,
  liveTotalAdded = 0,
  onToggleLiveTail,
  onExportFiltered,
  startDate,
  endDate,
  onDateRangeChange,
  theme,
  onToggleTheme,
  onOpenShortcuts,
  onResetSettings,
  isSidebarOpen,
  onToggleSidebar,
  isFullscreen,
  onToggleFullscreen,
  showDatetime = true,
  onToggleShowDatetime,
  showPid = true,
  onToggleShowPid,
  showTid = true,
  onToggleShowTid,
  showCorrelation = true,
  onToggleShowCorrelation,
  onToggleAllMeta,
  isLoading = false,
  presets = [],
  activePresetId = null,
  onSelectPreset,
  onOpenPresetModal,
  onCreateNewPreset,
  isSplitView = false,
  onToggleSplitView,
  onOpenWaterfall,
}) => {
  const [lineInput, setLineInput] = useState<string>(currentMatchIndex ? currentMatchIndex.toString() : '1');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [localStartDate, setLocalStartDate] = useState(startDate || '');
  const [localEndDate, setLocalEndDate] = useState(endDate || '');
  const [isWorkflowDropdownOpen, setIsWorkflowDropdownOpen] = useState(false);
  const [isOperationDropdownOpen, setIsOperationDropdownOpen] = useState(false);
  const [isCorrelationDropdownOpen, setIsCorrelationDropdownOpen] = useState(false);
  const [isPidDropdownOpen, setIsPidDropdownOpen] = useState(false);
  const [isTidDropdownOpen, setIsTidDropdownOpen] = useState(false);
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const [workflowSearch, setWorkflowSearch] = useState('');
  const [operationSearch, setOperationSearch] = useState('');
  const [correlationSearch, setCorrelationSearch] = useState('');
  const [pidSearch, setPidSearch] = useState('');
  const [tidSearch, setTidSearch] = useState('');
  const [isPathCopied, setIsPathCopied] = useState(false);

  // Refs for click outside & mouse leave
  const workflowRef = React.useRef<HTMLDivElement>(null);
  const operationRef = React.useRef<HTMLDivElement>(null);
  const correlationRef = React.useRef<HTMLDivElement>(null);
  const datePickerRef = React.useRef<HTMLDivElement>(null);
  const presetDropdownRef = React.useRef<HTMLDivElement>(null);
  const sortDropdownRef = React.useRef<HTMLDivElement>(null);

  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  const wfLeaveTimer = React.useRef<any>(null);
  const opLeaveTimer = React.useRef<any>(null);
  const corrLeaveTimer = React.useRef<any>(null);
  const dtLeaveTimer = React.useRef<any>(null);

  const activePreset = presets.find((p) => p.id === activePresetId);

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
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(target)) {
        setIsPresetDropdownOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setIsSortDropdownOpen(false);
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

  const isAllSelected = selectedLevels.length === 0 && (excludeLevels || []).length === 0;
  const currentSortConfig = SORT_CONFIG.find((s) => s.key === sortOption) || SORT_CONFIG[0];

  return (
    <header className="topbar" style={{ gap: 8, padding: '10px 16px' }}>
      {/* TIER 1: DUAL FILTERS, MATCH NAVIGATOR, GO TO LINE, LINE STATS, STREAM STATUS */}
      <div className="topbar-tier-1">
        {/* Toggle Left Panel Button - ONLY shown when sidebar is collapsed and not in fullscreen */}
        {onToggleSidebar && !isSidebarOpen && !isFullscreen && (
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

        {/* Primary Full-Text Search Box (Hero Input) */}
        <div
          className="search-container"
          style={{
            flex: '1 1 240px',
            maxWidth: '380px',
            background: 'var(--bg-surface)',
            borderRadius: 6,
            height: 34,
            padding: '2px 8px',
          }}
        >
          <Search size={14} style={{ color: '#38bdf8', flexShrink: 0 }} />
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
              data-tooltip="Toggle Regex (.*)"
            >
              <Regex size={13} />
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
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Box 2: Scoped Marker / Workflow Filter */}
        <div
          className="search-container"
          style={{
            flex: '0 0 190px',
            maxWidth: '220px',
            background: 'var(--bg-surface)',
            borderRadius: 6,
            height: 34,
            padding: '2px 8px',
            position: 'relative',
          }}
        >
          <Filter size={13} style={{ color: '#c084fc', flexShrink: 0 }} />
          <input
            type="text"
            className="search-input"
            placeholder="Marker / WF..."
            value={markerFilter}
            onChange={(e) => onMarkerFilterChange(e.target.value)}
            style={{ fontSize: '0.82rem' }}
            title="Filter by Workflow Marker regex or plain text"
          />

          <div className="search-modifiers" style={{ gap: 2 }}>
            <button
              className={`search-modifier-btn ${isMarkerRegex ? 'active' : ''}`}
              onClick={onToggleMarkerRegex}
              data-tooltip="Toggle Marker Regex (.*)"
            >
              <Regex size={13} />
            </button>

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

        {/* Datetime Picker Trigger Button (Dedicated Toolbar Control) */}
        <div style={{ position: 'relative', flexShrink: 0 }} ref={datePickerRef}>
          <button
            className={`toolbar-toggle-btn ${showDatePicker || startDate || endDate ? 'active' : ''}`}
            onClick={() => setShowDatePicker(!showDatePicker)}
            data-tooltip={startDate || endDate ? `Date filter active: ${startDate || '...'} to ${endDate || '...'}` : 'Filter by datetime range'}
            style={{
              height: 34,
              padding: '0 9px',
              gap: 5,
            }}
          >
            <Calendar size={13} style={{ color: (startDate || endDate) ? 'var(--accent-primary)' : undefined }} />
            {(startDate || endDate) && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-primary)' }}>Range</span>}
          </button>

          {/* Datetime Range Picker Dropdown */}
          {showDatePicker && (
            <div
              onMouseEnter={cancelDtMouseLeave}
              onMouseLeave={handleDtMouseLeave}
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25), 0 0 15px rgba(56, 189, 248, 0.15)',
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
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>From:</label>
                <input
                  type="datetime-local"
                  value={localStartDate}
                  onChange={(e) => setLocalStartDate(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 4,
                    padding: '4px 8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.78rem',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>To:</label>
                <input
                  type="datetime-local"
                  value={localEndDate}
                  onChange={(e) => setLocalEndDate(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 4,
                    padding: '4px 8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.78rem',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                <button
                  className="btn-primary"
                  style={{ padding: '4px 12px', fontSize: '0.75rem', height: 26 }}
                  onClick={() => {
                    onDateRangeChange?.(localStartDate || null, localEndDate || null);
                    setShowDatePicker(false);
                  }}
                >
                  Apply
                </button>
                <button
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem', height: 26 }}
                  onClick={() => setShowDatePicker(false)}
                  title="Close date picker"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Unified Line Navigator & Metrics (Zero Duplication) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg-surface)',
            padding: '2px 8px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            height: 34,
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
          data-tooltip="Jump to line: edit number and press Enter, or use arrows"
        >
          {isLoading && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--accent-primary)',
                fontSize: '0.74rem',
                marginRight: 2,
                fontWeight: 600,
              }}
              title="Querying & updating logs..."
            >
              <Spinner size={12} />
            </span>
          )}

          {/* Editable line number input */}
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
              width: 50,
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

          {/* Matching line count */}
          <span
            style={{
              color: '#38bdf8',
              fontWeight: 800,
            }}
            title={`Matching lines: ${filteredCount.toLocaleString()}`}
          >
            {filteredCount > 0 ? filteredCount.toLocaleString() : '0'}
          </span>

          {/* Total source lines if filtered */}
          {filteredCount < totalEntries && (
            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
              }}
              title={`Total lines in source: ${totalEntries.toLocaleString()}`}
            >
              (of {totalEntries.toLocaleString()})
            </span>
          )}

          {/* Query duration */}
          {durationMs !== undefined && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              ({durationMs}ms)
            </span>
          )}

          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 2px' }} />

          {/* Prev / Next Match navigation */}
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

        {/* Right: Live Telemetry Cluster + Window Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {/* Live Telemetry Cluster (Expanded when Live, Compact Circular Button when Paused) */}
          {isLiveTail ? (
            <div className={`live-telemetry-cluster active ${Number(liveLogsPerSec) > 0 ? 'has-burst' : ''}`}>
              {/* Leftmost live icon with circular right border, shadow, and fade design */}
              <button
                className="live-telemetry-toggle stream-live-pill active"
                onClick={onToggleLiveTail}
                data-tooltip={`Live stream active (+${liveLogsPerSec || 0}/s) • Click to pause`}
              >
                <Radio size={13} />
              </button>

              {/* Metric 1: New Added / sec (Instantaneous velocity) */}
              <span
                className={`rate-badge instant ${Number(liveLogsPerSec) > 0 ? 'active-burst' : ''}`}
                data-tooltip={`Instant velocity: ${liveLogsPerSec || 0} new logs added in the last second`}
              >
                <Zap size={11} />
                <span>+{liveLogsPerSec || 0}</span>
              </span>

              <div className="live-telemetry-divider" />

              {/* Metric 2: Average Addition / sec (Rolling session average) */}
              <span
                className="rate-badge average"
                data-tooltip={`Rolling average: ${liveAvgLogsPerSec || 0} logs/sec (Session total: ${liveTotalAdded || 0} logs)`}
              >
                <Activity size={11} />
                <span>avg {liveAvgLogsPerSec || 0}</span>
              </span>
            </div>
          ) : (
            <button
              className="stream-live-pill paused"
              onClick={onToggleLiveTail}
              data-tooltip="Live stream paused • Click to resume"
            >
              <Radio size={14} />
            </button>
          )}

          <div className="topbar-divider-v" />

          {/* Window Actions Group (Waterfall, Split View, Theme & Fullscreen) */}
          <div className="window-actions-group">
            {onOpenWaterfall && (
              <button
                type="button"
                className="btn-icon"
                onClick={onOpenWaterfall}
                data-tooltip="Transaction Waterfall & Gantt Trace View"
                style={{
                  width: 32,
                  height: 32,
                  color: selectedWorkflow || selectedCorrelation ? '#c084fc' : undefined,
                }}
              >
                <GitBranch size={14} />
              </button>
            )}

            {onToggleSplitView && (
              <button
                type="button"
                className={`btn-icon ${isSplitView ? 'active' : ''}`}
                onClick={onToggleSplitView}
                data-tooltip={isSplitView ? 'Exit Split Screen View' : 'Split Screen: Dual Log Viewer'}
                style={{
                  width: 32,
                  height: 32,
                  color: isSplitView ? '#38bdf8' : undefined,
                  background: isSplitView ? 'rgba(56, 189, 248, 0.15)' : undefined,
                }}
              >
                <Columns2 size={14} />
              </button>
            )}

            <button
              className="btn-icon"
              onClick={onToggleTheme}
              data-tooltip={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              style={{ width: 32, height: 32 }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {onToggleFullscreen && (
              <button
                className="btn-icon"
                onClick={onToggleFullscreen}
                data-tooltip={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                style={{ width: 32, height: 32 }}
              >
                {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TIER 2: SEVERITY LEVEL PILLS (LEFT) + DIMENSION FACETS & ARCHIVE (RIGHT) */}
      <div className="topbar-tier-2">
        {/* Left: Severity Level Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto' }}>
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
            const isExcluded = (excludeLevels || []).includes(key);

            return (
              <button
                key={key}
                className={`level-pill ${key} ${isSelected ? 'active' : ''} ${isExcluded ? 'excluded' : ''}`}
                onClick={(e) => {
                  if (e.altKey) {
                    onToggleExcludeLevel?.(key);
                  } else {
                    onToggleLevel(key);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onToggleExcludeLevel?.(key);
                }}
                title={`Click to include ${label} (+)\nRight-click or Alt+click: Exclude ${label} (–)`}
              >
                <span className="level-pill-label">{isExcluded ? `− ${label}` : label}</span>
                <span className="level-pill-count">{count}</span>
                <span
                  className={`level-pill-neg-btn ${isExcluded ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExcludeLevel?.(key);
                  }}
                  title={isExcluded ? `Remove exclusion of ${label}` : `Exclude ${label} logs (negative filter)`}
                >
                  {isExcluded ? '✕' : '−'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Vertical Divider */}
        <div className="topbar-divider-v" />

        {/* Right: Facet Dimension Dropdowns (Workflows, Operations, Correlation) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          {/* WORKFLOW DROPDOWN */}
          <div style={{ position: 'relative' }}>
            <button
              className={`level-pill ${selectedWorkflow ? 'active' : ''}`}
              onClick={() => {
                setIsWorkflowDropdownOpen(!isWorkflowDropdownOpen);
                setIsOperationDropdownOpen(false);
                setIsCorrelationDropdownOpen(false);
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
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25), 0 0 15px rgba(192, 132, 252, 0.15)',
                    zIndex: 1000,
                    minWidth: 280,
                    maxWidth: 340,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-sidebar)' }}>
                    <input
                      type="text"
                      placeholder="Filter active workflows..."
                      value={workflowSearch}
                      onChange={(e) => setWorkflowSearch(e.target.value)}
                      className="sidebar-search-input"
                      style={{ fontSize: '0.78rem', padding: '5px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
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
                      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
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

          {/* OPERATION DROPDOWN */}
          <div style={{ position: 'relative' }}>
            <button
              className={`level-pill ${selectedOperation ? 'active' : ''}`}
              onClick={() => {
                setIsOperationDropdownOpen(!isOperationDropdownOpen);
                setIsWorkflowDropdownOpen(false);
                setIsCorrelationDropdownOpen(false);
              }}
              style={{
                backgroundColor: selectedOperation ? 'rgba(56, 189, 248, 0.2)' : undefined,
                borderColor: selectedOperation ? '#38bdf8' : undefined,
                color: selectedOperation ? '#38bdf8' : undefined,
                fontWeight: selectedOperation ? 700 : undefined,
              }}
            >
              <GitCommit size={12} />
              <span>{selectedOperation ? selectedOperation : 'Operations'}</span>
              <span className="level-pill-count">
                {selectedOperation ? (operationCounts[selectedOperation] || 0) : Object.keys(operationCounts).length}
              </span>
              <ChevronDown size={11} />
            </button>

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
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25), 0 0 15px rgba(56, 189, 248, 0.15)',
                    zIndex: 1000,
                    minWidth: 280,
                    maxWidth: 340,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-sidebar)' }}>
                    <input
                      type="text"
                      placeholder="Filter operations..."
                      value={operationSearch}
                      onChange={(e) => setOperationSearch(e.target.value)}
                      className="sidebar-search-input"
                      style={{ fontSize: '0.78rem', padding: '5px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
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
                        <GitCommit size={12} />
                        All Operations
                      </span>
                      {!selectedOperation && <Check size={13} color="var(--accent-primary)" />}
                    </div>

                    {Object.entries(operationCounts)
                      .filter(([op]) => op.toLowerCase().includes(operationSearch.toLowerCase()))
                      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
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
                              backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                              color: isSelected ? '#38bdf8' : 'var(--text-primary)',
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
                                  color: isSelected ? '#38bdf8' : 'var(--text-muted)',
                                }}
                              >
                                {count}
                              </span>
                              {isSelected && <Check size={13} color="#38bdf8" />}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* CORRELATION DROPDOWN */}
          {correlationCounts && Object.keys(correlationCounts).length > 0 && (
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
              >
                <Zap size={12} />
                <span>{selectedCorrelation ? selectedCorrelation : 'Correlation'}</span>
                <span className="level-pill-count">
                  {selectedCorrelation ? (correlationCounts[selectedCorrelation] || 0) : Object.keys(correlationCounts).length}
                </span>
                <ChevronDown size={11} />
              </button>

              {selectedCorrelation && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCorrelation?.(null);
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
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25), 0 0 15px rgba(52, 211, 153, 0.15)',
                      zIndex: 1000,
                      minWidth: 280,
                      maxWidth: 360,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-sidebar)' }}>
                      <input
                        type="text"
                        placeholder="Filter correlation IDs..."
                        value={correlationSearch}
                        onChange={(e) => setCorrelationSearch(e.target.value)}
                        className="sidebar-search-input"
                        style={{ fontSize: '0.78rem', padding: '5px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
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
                          <Zap size={12} />
                          All Correlations
                        </span>
                        {!selectedCorrelation && <Check size={13} color="var(--accent-primary)" />}
                      </div>

                      {Object.entries(correlationCounts)
                        .filter(([corr]) => corr.toLowerCase().includes(correlationSearch.toLowerCase()))
                        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
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
          )}

          {/* PROCESS ID (PID) DROPDOWN */}
          {pidCounts && Object.keys(pidCounts).length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                className={`level-pill ${selectedPid ? 'active' : ''}`}
                onClick={() => {
                  setIsPidDropdownOpen(!isPidDropdownOpen);
                  setIsTidDropdownOpen(false);
                  setIsWorkflowDropdownOpen(false);
                  setIsOperationDropdownOpen(false);
                  setIsCorrelationDropdownOpen(false);
                }}
                style={{
                  backgroundColor: selectedPid ? 'rgba(56, 189, 248, 0.2)' : undefined,
                  borderColor: selectedPid ? '#38bdf8' : undefined,
                  color: selectedPid ? '#38bdf8' : undefined,
                  fontWeight: selectedPid ? 700 : undefined,
                }}
              >
                <Cpu size={12} />
                <span>{selectedPid ? `PID: ${selectedPid}` : 'Process (PID)'}</span>
                <span className="level-pill-count">
                  {selectedPid ? (pidCounts[selectedPid] || 0) : Object.keys(pidCounts).length}
                </span>
                <ChevronDown size={11} />
              </button>

              {selectedPid && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPid?.(null);
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
                  title="Clear PID filter"
                >
                  ×
                </button>
              )}

              {isPidDropdownOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                    onClick={() => setIsPidDropdownOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25), 0 0 15px rgba(56, 189, 248, 0.15)',
                      zIndex: 1000,
                      minWidth: 240,
                      maxWidth: 320,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-sidebar)' }}>
                      <input
                        type="text"
                        placeholder="Filter process IDs..."
                        value={pidSearch}
                        onChange={(e) => setPidSearch(e.target.value)}
                        className="sidebar-search-input"
                        style={{ fontSize: '0.78rem', padding: '5px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        autoFocus
                      />
                    </div>

                    <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 6px' }}>
                      <div
                        onClick={() => {
                          onSelectPid?.(null);
                          setIsPidDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          backgroundColor: !selectedPid ? 'var(--accent-bg)' : 'transparent',
                          color: !selectedPid ? 'var(--accent-primary)' : 'var(--text-primary)',
                          fontWeight: !selectedPid ? 600 : 400,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Cpu size={12} />
                          All Processes
                        </span>
                        {!selectedPid && <Check size={13} color="var(--accent-primary)" />}
                      </div>

                      {Object.entries(pidCounts)
                        .filter(([pid]) => pid.toLowerCase().includes(pidSearch.toLowerCase()))
                        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
                        .map(([pid, count]) => {
                          const isSelected = selectedPid === pid;
                          return (
                            <div
                              key={pid}
                              onClick={() => {
                                onSelectPid?.(isSelected ? null : pid);
                                setIsPidDropdownOpen(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 8px',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                                color: isSelected ? '#38bdf8' : 'var(--text-primary)',
                                fontWeight: isSelected ? 600 : 400,
                              }}
                            >
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                {pid}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    fontFamily: 'var(--font-mono)',
                                    backgroundColor: 'var(--bg-surface)',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    color: isSelected ? '#38bdf8' : 'var(--text-muted)',
                                  }}
                                >
                                  {count}
                                </span>
                                {isSelected && <Check size={13} color="#38bdf8" />}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* THREAD ID (TID) DROPDOWN */}
          {tidCounts && Object.keys(tidCounts).length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                className={`level-pill ${selectedTid ? 'active' : ''}`}
                onClick={() => {
                  setIsTidDropdownOpen(!isTidDropdownOpen);
                  setIsPidDropdownOpen(false);
                  setIsWorkflowDropdownOpen(false);
                  setIsOperationDropdownOpen(false);
                  setIsCorrelationDropdownOpen(false);
                }}
                style={{
                  backgroundColor: selectedTid ? 'rgba(251, 146, 60, 0.2)' : undefined,
                  borderColor: selectedTid ? '#fb923c' : undefined,
                  color: selectedTid ? '#fb923c' : undefined,
                  fontWeight: selectedTid ? 700 : undefined,
                }}
              >
                <Hash size={12} />
                <span>{selectedTid ? `TID: ${selectedTid}` : 'Thread (TID)'}</span>
                <span className="level-pill-count">
                  {selectedTid ? (tidCounts[selectedTid] || 0) : Object.keys(tidCounts).length}
                </span>
                <ChevronDown size={11} />
              </button>

              {selectedTid && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTid?.(null);
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
                  title="Clear TID filter"
                >
                  ×
                </button>
              )}

              {isTidDropdownOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                    onClick={() => setIsTidDropdownOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25), 0 0 15px rgba(251, 146, 60, 0.15)',
                      zIndex: 1000,
                      minWidth: 240,
                      maxWidth: 320,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-sidebar)' }}>
                      <input
                        type="text"
                        placeholder="Filter thread IDs..."
                        value={tidSearch}
                        onChange={(e) => setTidSearch(e.target.value)}
                        className="sidebar-search-input"
                        style={{ fontSize: '0.78rem', padding: '5px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        autoFocus
                      />
                    </div>

                    <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 6px' }}>
                      <div
                        onClick={() => {
                          onSelectTid?.(null);
                          setIsTidDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          backgroundColor: !selectedTid ? 'var(--accent-bg)' : 'transparent',
                          color: !selectedTid ? 'var(--accent-primary)' : 'var(--text-primary)',
                          fontWeight: !selectedTid ? 600 : 400,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Hash size={12} />
                          All Threads
                        </span>
                        {!selectedTid && <Check size={13} color="var(--accent-primary)" />}
                      </div>

                      {Object.entries(tidCounts)
                        .filter(([tid]) => tid.toLowerCase().includes(tidSearch.toLowerCase()))
                        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
                        .map(([tid, count]) => {
                          const isSelected = selectedTid === tid;
                          return (
                            <div
                              key={tid}
                              onClick={() => {
                                onSelectTid?.(isSelected ? null : tid);
                                setIsTidDropdownOpen(false);
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
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                {tid}
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
          )}

          {/* Rotated Archive Indicator */}
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
        </div>
      </div>

      {/* TIER 3: VIEW MODES, PRESETS, VISIBILITY & ACTION TOOLS */}
      <div className="topbar-tier-3">
        {/* Left: View Mode Segmented + Preset Dropdown + Wrap + [ ] Markers + Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
          {/* Segmented View Mode Switcher (Icons Only) */}
          <div className="view-mode-segmented" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            <button
              className={`view-mode-btn ${viewMode === 'compact' ? 'active' : ''}`}
              onClick={() => onChangeViewMode('compact')}
              data-tooltip="Compact View (Dense rows)"
            >
              <List size={13} />
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'standard' ? 'active' : ''}`}
              onClick={() => onChangeViewMode('standard')}
              data-tooltip="Cards View (Detailed cards)"
            >
              <LayoutList size={13} />
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'raw' ? 'active' : ''}`}
              onClick={() => onChangeViewMode('raw')}
              data-tooltip="Raw Plain Text View"
            >
              <FileText size={13} />
            </button>
          </div>

          {/* Preset Selector Dropdown */}
          <div style={{ position: 'relative', flexShrink: 0, whiteSpace: 'nowrap' }} ref={presetDropdownRef}>
            <button
              className={`preset-trigger-btn ${activePreset ? 'active' : ''}`}
              onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
              title={activePreset ? `Active Preset: ${activePreset.name} (Click to change or manage)` : 'Select or manage Log Presets'}
            >
              <Sliders size={12} />
              <span>{activePreset ? activePreset.name : 'Preset: None'}</span>
              <ChevronDown size={11} />
            </button>

            {isPresetDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25), 0 0 15px rgba(56, 189, 248, 0.15)',
                  zIndex: 1000,
                  minWidth: 230,
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <div style={{ padding: '4px 8px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Log View Presets
                </div>

                {/* Clear Preset option */}
                <button
                  onClick={() => {
                    onSelectPreset?.(null);
                    setIsPresetDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 4,
                    fontSize: '0.78rem',
                    border: 'none',
                    background: !activePresetId ? 'var(--accent-bg)' : 'transparent',
                    color: !activePresetId ? 'var(--accent-primary)' : 'var(--text-primary)',
                    fontWeight: !activePresetId ? 700 : 400,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>None (Default / All Logs)</span>
                  {!activePresetId && <Check size={13} color="var(--accent-primary)" />}
                </button>

                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

                {/* Preset items */}
                {presets.map((p) => {
                  const isSelected = p.id === activePresetId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectPreset?.(p.id);
                        setIsPresetDropdownOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: 4,
                        fontSize: '0.78rem',
                        border: 'none',
                        background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                        color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                        fontWeight: isSelected ? 700 : 400,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{p.name}</span>
                        {p.description && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {p.description}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check size={13} color="var(--accent-primary)" />}
                    </button>
                  );
                })}

                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

                <button
                  onClick={() => {
                    setIsPresetDropdownOpen(false);
                    onCreateNewPreset?.();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 8px',
                    borderRadius: 4,
                    fontSize: '0.76rem',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  <Plus size={12} />
                  <span>New Preset from Current View...</span>
                </button>

                <button
                  onClick={() => {
                    setIsPresetDropdownOpen(false);
                    onOpenPresetModal?.();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 8px',
                    borderRadius: 4,
                    fontSize: '0.76rem',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  <Sliders size={12} />
                  <span>Manage Presets...</span>
                </button>
              </div>
            )}
          </div>

          {/* Word Wrap Toggle (Icon-Only) */}
          <button
            className={`toolbar-toggle-btn ${wrapLines ? 'active' : ''}`}
            onClick={onToggleWrapLines}
            data-tooltip={wrapLines ? 'Word wrap enabled (click to disable)' : 'Word wrap disabled (click to enable)'}
          >
            <WrapText size={13} />
          </button>

          {/* [ ] Brackets Visibility Toggle - Uniform: active = visible! */}
          <button
            className={`toolbar-toggle-btn ${!hideBrackets ? 'active' : ''}`}
            onClick={onToggleHideBrackets}
            data-tooltip={!hideBrackets ? 'Hide [ ] bracket markers' : 'Show [ ] bracket markers'}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
              [ ]
            </span>
          </button>

          {/* Metadata Toggles Group (Clean Tokens Without Redundant "Meta:" label) */}
          <div className="meta-toggles-group" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            <button
              className={`meta-toggle-btn ${showDatetime ? 'active' : ''}`}
              onClick={onToggleShowDatetime}
              data-tooltip={showDatetime ? 'Hide Datetime column' : 'Show Datetime column'}
            >
              Time
            </button>
            <button
              className={`meta-toggle-btn ${showPid ? 'active' : ''}`}
              onClick={onToggleShowPid}
              data-tooltip={showPid ? 'Hide Process ID [PID]' : 'Show Process ID [PID]'}
            >
              PID
            </button>
            <button
              className={`meta-toggle-btn ${showTid ? 'active' : ''}`}
              onClick={onToggleShowTid}
              data-tooltip={showTid ? 'Hide Thread ID [TID]' : 'Show Thread ID [TID]'}
            >
              TID
            </button>
            <button
              className={`meta-toggle-btn ${showCorrelation ? 'active' : ''}`}
              onClick={onToggleShowCorrelation}
              data-tooltip={showCorrelation ? 'Hide Correlation ID [Corr]' : 'Show Correlation ID [Corr]'}
            >
              Corr
            </button>
          </div>

          <div className="topbar-divider-v" style={{ height: 16, margin: '0 2px' }} />

          {/* Observability Tools (Waterfall & Split View) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {onOpenWaterfall && (
              <button
                type="button"
                className="toolbar-toggle-btn"
                onClick={onOpenWaterfall}
                data-tooltip="Transaction Waterfall & Gantt Trace"
                style={{
                  height: 26,
                  padding: '0 8px',
                  gap: 5,
                  fontSize: '0.74rem',
                  color: selectedWorkflow || selectedCorrelation ? '#c084fc' : undefined,
                  borderColor: selectedWorkflow || selectedCorrelation ? 'rgba(192, 132, 252, 0.4)' : undefined,
                  background: selectedWorkflow || selectedCorrelation ? 'rgba(192, 132, 252, 0.12)' : undefined,
                }}
              >
                <GitBranch size={12} color="#c084fc" />
                <span>Waterfall</span>
              </button>
            )}

            {onToggleSplitView && (
              <button
                type="button"
                className={`toolbar-toggle-btn ${isSplitView ? 'active' : ''}`}
                onClick={onToggleSplitView}
                data-tooltip={isSplitView ? 'Exit Split Screen View' : 'Split Screen: Dual Log Viewer'}
                style={{
                  height: 26,
                  padding: '0 8px',
                  gap: 5,
                  fontSize: '0.74rem',
                  color: isSplitView ? '#38bdf8' : undefined,
                  borderColor: isSplitView ? '#38bdf8' : undefined,
                  background: isSplitView ? 'rgba(56, 189, 248, 0.15)' : undefined,
                }}
              >
                <Columns2 size={12} color="#38bdf8" />
                <span>Split</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Sort + Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {/* Multi-Field Sort Dropdown (Ultra-Compact Space-Saving Pill) */}
          <div style={{ position: 'relative', flexShrink: 0, whiteSpace: 'nowrap' }} ref={sortDropdownRef}>
            <button
              className="toolbar-toggle-btn"
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              data-tooltip={`Sort: ${currentSortConfig.label} (click to change)`}
              data-tooltip-align="right"
              style={{ height: 28, padding: '0 8px', gap: 5, fontSize: '0.74rem' }}
            >
              <ArrowUpDown size={12} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontWeight: 600 }}>{currentSortConfig.short}</span>
              <ChevronDown size={10} style={{ opacity: 0.7 }} />
            </button>

            {isSortDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  boxShadow: '0 16px 32px rgba(0, 0, 0, 0.3), 0 0 12px rgba(56, 189, 248, 0.12)',
                  zIndex: 1000,
                  minWidth: 210,
                  padding: '5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <div style={{ padding: '4px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Sort Order
                </div>

                {SORT_CONFIG.map((opt) => {
                  const isSelected = opt.key === sortOption;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => {
                        onChangeSortOption(opt.key);
                        setIsSortDropdownOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: 4,
                        fontSize: '0.76rem',
                        border: 'none',
                        background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                        color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                        fontWeight: isSelected ? 700 : 400,
                        cursor: 'pointer',
                        textAlign: 'left',
                        gap: 8,
                      }}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check size={12} color="var(--accent-primary)" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="topbar-divider-v" />

          {/* Export Button (Icon-Only + Micro-Tooltip) */}
          <button
            className="btn-secondary"
            onClick={onExportFiltered}
            style={{ height: 28, padding: '0 8px', fontSize: '0.74rem' }}
            data-tooltip="Export filtered log lines"
          >
            <Download size={13} />
          </button>

          {/* Copy Path */}
          {activeSource?.path && (
            <button
              className={`btn-secondary ${isPathCopied ? 'active' : ''}`}
              onClick={handleCopyPath}
              style={{
                height: 28,
                padding: '0 8px',
                fontSize: '0.74rem',
                gap: 4,
                borderColor: isPathCopied ? '#4ade80' : undefined,
                color: isPathCopied ? '#4ade80' : undefined,
                backgroundColor: isPathCopied ? 'rgba(74, 222, 128, 0.15)' : undefined,
              }}
              title={`Copy system path: ${activeSource.path}`}
            >
              {isPathCopied ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
              <span>{isPathCopied ? 'Copied' : 'Path'}</span>
            </button>
          )}

          {/* Shortcuts Modal Button */}
          {onOpenShortcuts && (
            <button
              className="btn-secondary"
              onClick={onOpenShortcuts}
              style={{ height: 28, padding: '0 8px', fontSize: '0.74rem', gap: 4 }}
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard size={12} />
              <span>?</span>
            </button>
          )}

          {/* Reset All Settings Button */}
          {onResetSettings && (
            <button
              className="btn-secondary"
              onClick={onResetSettings}
              style={{ height: 28, padding: '0 8px', fontSize: '0.74rem', gap: 4 }}
              title="Reset all settings and views to defaults"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
