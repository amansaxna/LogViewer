import React from 'react';
import {
  Search,
  X,
  ArrowUpDown,
  Radio,
  Download,
  Trash2,
  RefreshCw,
  Sun,
  Moon,
  WrapText,
} from 'lucide-react';
import { LogLevel, LogSource } from '../types.ts';

interface TopbarProps {
  activeSource?: LogSource;
  totalEntries: number;
  durationMs: number;
  search: string;
  onSearchChange: (val: string) => void;
  isRegex: boolean;
  onToggleRegex: () => void;
  caseSensitive: boolean;
  onToggleCaseSensitive: () => void;
  invert: boolean;
  onToggleInvert: () => void;
  selectedLevels: LogLevel[];
  onToggleLevel: (level: LogLevel | 'all') => void;
  levelCounts: Record<string, number>;
  isLiveTail: boolean;
  onToggleLiveTail: () => void;
  direction: 'desc' | 'asc';
  onToggleDirection: () => void;
  onRefresh: () => void;
  onClearLog: () => void;
  onDownloadLog: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  wrapLines: boolean;
  onToggleWrapLines: () => void;
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
  durationMs,
  search,
  onSearchChange,
  isRegex,
  onToggleRegex,
  caseSensitive,
  onToggleCaseSensitive,
  invert,
  onToggleInvert,
  selectedLevels,
  onToggleLevel,
  levelCounts,
  isLiveTail,
  onToggleLiveTail,
  direction,
  onToggleDirection,
  onRefresh,
  onClearLog,
  onDownloadLog,
  theme,
  onToggleTheme,
  wrapLines,
  onToggleWrapLines,
}) => {
  const isAllSelected = selectedLevels.length === 0;

  return (
    <header className="topbar">
      {/* Top Row: File Info & Global Controls */}
      <div className="topbar-upper">
        <div className="topbar-file-info">
          <span className="topbar-file-name">{activeSource?.name || 'No Log Selected'}</span>
          {activeSource?.category && (
            <span className="topbar-badge">{activeSource.category}</span>
          )}
          <span className="topbar-badge">{totalEntries.toLocaleString()} entries</span>
          {durationMs !== undefined && (
            <span className="topbar-badge" style={{ color: 'var(--accent-primary)' }}>
              ⚡ {durationMs} ms
            </span>
          )}
        </div>

        <div className="topbar-actions">
          {/* Live Tail Toggle */}
          <button
            className={`btn-live-tail ${isLiveTail ? 'active' : ''}`}
            onClick={onToggleLiveTail}
            title={isLiveTail ? 'Live tailing active - click to pause' : 'Enable live tailing'}
          >
            {isLiveTail && <span className="pulse-dot" />}
            <Radio size={14} />
            {isLiveTail ? 'LIVE TAIL' : 'Live Tail'}
          </button>

          {/* Line Wrap Toggle */}
          <button
            className={`btn-icon ${wrapLines ? 'active' : ''}`}
            onClick={onToggleWrapLines}
            title={wrapLines ? 'Word Wrap enabled (full lines wrapped)' : 'Word Wrap disabled (single line)'}
          >
            <WrapText size={15} />
          </button>

          {/* Sort Direction Toggle */}
          <button
            className="btn-icon"
            onClick={onToggleDirection}
            title={`Sorting: ${direction === 'desc' ? 'Newest First' : 'Oldest First'}`}
          >
            <ArrowUpDown size={15} />
          </button>

          {/* Refresh */}
          <button className="btn-icon" onClick={onRefresh} title="Reload log entries">
            <RefreshCw size={15} />
          </button>

          {/* Download */}
          <button className="btn-icon" onClick={onDownloadLog} title="Download raw log file">
            <Download size={15} />
          </button>

          {/* Clear */}
          <button className="btn-icon" onClick={onClearLog} title="Clear file contents">
            <Trash2 size={15} />
          </button>

          {/* Theme Toggle */}
          <button
            className="btn-icon"
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {/* Middle Row: Search with Modifiers */}
      <div className="search-container">
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          className="search-input"
          placeholder="Search entries (keyword, message, namespace, code location)..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        {search && (
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
            }}
            onClick={() => onSearchChange('')}
          >
            <X size={14} />
          </button>
        )}

        <div className="search-modifiers">
          <button
            className={`search-modifier-btn ${isRegex ? 'active' : ''}`}
            onClick={onToggleRegex}
            title="Use Regular Expression"
          >
            .*
          </button>
          <button
            className={`search-modifier-btn ${caseSensitive ? 'active' : ''}`}
            onClick={onToggleCaseSensitive}
            title="Match Case"
          >
            Aa
          </button>
          <button
            className={`search-modifier-btn ${invert ? 'active' : ''}`}
            onClick={onToggleInvert}
            title="Invert Match (exclude results)"
          >
            !
          </button>
        </div>
      </div>

      {/* Bottom Row: Level Filter Pills */}
      <div className="level-pills-row">
        <button
          className={`level-pill all ${isAllSelected ? 'active' : ''}`}
          onClick={() => onToggleLevel('all')}
        >
          <span>ALL</span>
          <span className="level-pill-count">{levelCounts.all || 0}</span>
        </button>

        {AVAILABLE_LEVELS.map(({ key, label }) => {
          const count = levelCounts[key] || 0;
          if (count === 0 && !selectedLevels.includes(key)) {
            // Optional: still show pill if you want all levels visible
          }
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
