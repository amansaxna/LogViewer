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

  search: string;
  onSearchChange: (val: string) => void;
  isRegex: boolean;
  onToggleRegex: () => void;
  caseSensitive: boolean;
  onToggleCaseSensitive: () => void;
  invert: boolean;
  onToggleInvert: () => void;

  // Match navigation
  currentMatchIndex: number;
  onPrevMatch: () => void;
  onNextMatch: () => void;

  // Go to line
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

  // Stream & theme
  isLiveTail: boolean;
  onToggleLiveTail: () => void;
  onExportFiltered: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
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
  isLiveTail,
  onToggleLiveTail,
  onExportFiltered,
  theme,
  onToggleTheme,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isAllSelected = selectedLevels.length === 0;

  return (
    <header className="topbar" style={{ gap: 8, padding: '10px 16px' }}>
      {/* ROW 1: DUAL FILTERS, MATCH NAVIGATOR, GO TO LINE, LINE STATS (Image 4) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
          />

          <div className="search-modifiers" style={{ gap: 2 }}>
            <button
              className={`search-modifier-btn ${isMarkerRegex ? 'active' : ''}`}
              onClick={onToggleMarkerRegex}
              title="Toggle Marker Regex"
              style={{ padding: '2px 5px' }}
            >
              <Code2 size={12} />
            </button>
            <button
              className={`search-modifier-btn ${showDatePicker ? 'active' : ''}`}
              onClick={() => setShowDatePicker(!showDatePicker)}
              title="Filter by date range"
              style={{ padding: '2px 5px' }}
            >
              <Calendar size={12} />
            </button>
            {markerFilter && (
              <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                onClick={() => onMarkerFilterChange('')}
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

        {/* Match Navigation (e.g. 1 / 623 < >) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--bg-surface)',
            padding: '3px 8px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            height: 34,
          }}
        >
          <span style={{ color: 'var(--text-primary)', minWidth: 50, textAlign: 'center' }}>
            {filteredCount > 0 ? `${currentMatchIndex} / ${filteredCount.toLocaleString()}` : '0 / 0'}
          </span>
          <button
            className="btn-icon"
            onClick={onPrevMatch}
            disabled={filteredCount === 0}
            style={{ width: 22, height: 22, border: 'none' }}
            title="Previous match"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="btn-icon"
            onClick={onNextMatch}
            disabled={filteredCount === 0}
            style={{ width: 22, height: 22, border: 'none' }}
            title="Next match"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Go to line Button */}
        <button
          className="btn-secondary"
          onClick={onOpenGoToLine}
          style={{ height: 34, padding: '0 12px', fontSize: '0.82rem', gap: 6 }}
        >
          <ArrowRight size={13} color="var(--accent-primary)" />
          Go to line
        </button>

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
          {durationMs !== undefined && (
            <span style={{ marginLeft: 6, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              ({durationMs}ms)
            </span>
          )}
        </div>

        {/* Live Tail & Theme Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className={`btn-live-tail ${isLiveTail ? 'active' : ''}`}
            onClick={onToggleLiveTail}
            title={isLiveTail ? 'Live tailing active - click to pause' : 'Enable live tailing'}
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
              <option value="time-desc">Time (Newest First)</option>
              <option value="time-asc">Time (Oldest First)</option>
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
      </div>
    </header>
  );
};
