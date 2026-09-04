import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  X,
  Maximize2,
  Columns2,
  FileText,
  Filter,
  Check,
  ChevronDown,
  WrapText,
  RotateCcw,
} from 'lucide-react';
import { LogEntry, LogLevel, LogQueryResult, LogSource, LogPreset } from '../types.ts';
import { PanelState } from '../types/panel.ts';
import { LogTable } from './LogTable.tsx';
import { calculateDeltaTime } from '../utils/deltaTimeEngine.ts';
import { copyWithToast } from '../utils/copyNotifier.ts';
import { DeltaTimeToolbar } from './DeltaTimeToolbar.tsx';

interface LogPanelProps {
  panel: PanelState;
  panelIndex: number;
  isActive: boolean;
  onFocus: () => void;
  sources: LogSource[];
  activePreset: LogPreset | null;
  totalPanels: number;
  onUpdatePanel: (updates: Partial<PanelState>) => void;
  onClosePanel: () => void;
  onMaximizePanel: () => void;
  onSplitPanel: () => void;
  onViewContext: (lineNumber: number, sourceId?: string) => void;
  isLiveTailGlobal?: boolean;
}

export const LogPanel: React.FC<LogPanelProps> = ({
  panel,
  panelIndex,
  isActive,
  onFocus,
  sources,
  activePreset,
  totalPanels,
  onUpdatePanel,
  onClosePanel,
  onMaximizePanel,
  onSplitPanel,
  onViewContext,
}) => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [levelCounts, setLevelCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState<boolean>(false);
  const sourceDropdownRef = useRef<HTMLDivElement>(null);

  // Delta time measurement local to this panel
  const [deltaAnchorLine, setDeltaAnchorLine] = useState<number | null>(null);
  const [deltaTargetLine, setDeltaTargetLine] = useState<number | null>(null);
  const [targetScrollIndex, setTargetScrollIndex] = useState<number | null>(null);
  const [selectedLineNumbers, setSelectedLineNumbers] = useState<Set<number>>(new Set());
  const selectionAnchorIndexRef = useRef<number | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(e.target as Node)) {
        setIsSourceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch log entries for this panel
  const fetchPanelEntries = useCallback(async () => {
    if (!panel.sourceId && panel.selectedSourceIds.length === 0) {
      setEntries([]);
      setTotalEntries(0);
      return;
    }

    const params = new URLSearchParams();

    if (panel.selectedSourceIds.length > 1) {
      params.append('sourceIds', panel.selectedSourceIds.join(','));
    } else if (panel.sourceId) {
      params.append('sourceId', panel.sourceId);
    }

    if (panel.markerFilter) {
      params.append('marker', panel.markerFilter);
      if (panel.isMarkerRegex) params.append('markerRegex', 'true');
    }
    if (panel.search) {
      params.append('search', panel.search);
      if (panel.isRegex) params.append('regex', 'true');
      if (panel.caseSensitive) params.append('caseSensitive', 'true');
      if (panel.invert) params.append('invert', 'true');
    }
    if (panel.selectedLevels.length > 0) {
      params.append('levels', panel.selectedLevels.join(','));
    }
    if (panel.excludeLevels.length > 0) {
      params.append('excludeLevels', panel.excludeLevels.join(','));
    }
    if (panel.selectedWorkflow) {
      params.append('workflow', panel.selectedWorkflow);
    }
    if (panel.selectedOperation) {
      params.append('operation', panel.selectedOperation);
    }
    if (panel.selectedCorrelation) {
      params.append('correlationId', panel.selectedCorrelation);
    }
    if (panel.startDate) {
      params.append('startDate', panel.startDate);
    }
    if (panel.endDate) {
      params.append('endDate', panel.endDate);
    }
    if (panel.sortOption) {
      params.append('sortOption', panel.sortOption);
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/logs/entries?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to query panel entries');
      const data: LogQueryResult = await res.json();
      setEntries(data.entries || []);
      setTotalEntries(data.total || 0);
      setDurationMs(data.durationMs || 0);
      setLevelCounts(data.levelCounts || {});
    } catch (err) {
      console.error(`[LogPanel ${panel.id}] query error:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [
    panel.sourceId,
    panel.selectedSourceIds,
    panel.markerFilter,
    panel.isMarkerRegex,
    panel.search,
    panel.isRegex,
    panel.caseSensitive,
    panel.invert,
    panel.selectedLevels,
    panel.excludeLevels,
    panel.selectedWorkflow,
    panel.selectedOperation,
    panel.selectedCorrelation,
    panel.startDate,
    panel.endDate,
    panel.sortOption,
  ]);

  useEffect(() => {
    fetchPanelEntries();
  }, [fetchPanelEntries]);

  // Apply active preset filter rules if any
  const displayEntries = useMemo(() => {
    if (!activePreset) return entries;
    const { excludeKeywords, includeKeywords, excludeMarkers, includeMarkers } = activePreset.rules;
    if (!excludeKeywords?.length && !includeKeywords?.length && !excludeMarkers?.length && !includeMarkers?.length) {
      return entries;
    }

    return entries.filter((entry) => {
      const msg = (entry.message || '').toLowerCase();
      const raw = (entry.raw || '').toLowerCase();

      if (excludeKeywords && excludeKeywords.length > 0) {
        for (const kw of excludeKeywords) {
          const trimmed = kw.trim();
          if (!trimmed) continue;
          const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, 'i');
          if (regex.test(msg) || regex.test(raw)) return false;
        }
      }

      if (includeKeywords && includeKeywords.length > 0) {
        const matches = includeKeywords.some((kw) => {
          const trimmed = kw.trim();
          if (!trimmed) return false;
          const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, 'i');
          return regex.test(msg) || regex.test(raw);
        });
        if (!matches) return false;
      }

      if (excludeMarkers && excludeMarkers.length > 0) {
        for (const m of excludeMarkers) {
          const cleanM = m.replace(/^\[|\]$/g, '').trim().toLowerCase();
          if (cleanM) {
            if (
              (entry.workflow && entry.workflow.toLowerCase().includes(cleanM)) ||
              (entry.operation && entry.operation.toLowerCase().includes(cleanM)) ||
              (entry.namespace && entry.namespace.toLowerCase().includes(cleanM)) ||
              raw.includes(cleanM)
            ) {
              return false;
            }
          }
        }
      }

      if (includeMarkers && includeMarkers.length > 0) {
        const matches = includeMarkers.some((m) => {
          const cleanM = m.replace(/^\[|\]$/g, '').trim().toLowerCase();
          if (!cleanM) return false;
          return (
            (entry.workflow && entry.workflow.toLowerCase().includes(cleanM)) ||
            (entry.operation && entry.operation.toLowerCase().includes(cleanM)) ||
            (entry.namespace && entry.namespace.toLowerCase().includes(cleanM)) ||
            raw.includes(cleanM)
          );
        });
        if (!matches) return false;
      }

      return true;
    });
  }, [entries, activePreset]);

  // Delta time measurement
  const deltaMeasurement = useMemo(() => {
    if (deltaAnchorLine === null || deltaTargetLine === null) return null;
    const anchorEntry = entries.find((e) => e.lineNumber === deltaAnchorLine);
    const targetEntry = entries.find((e) => e.lineNumber === deltaTargetLine);
    if (!anchorEntry || !targetEntry) return null;
    return calculateDeltaTime(anchorEntry, targetEntry, entries);
  }, [deltaAnchorLine, deltaTargetLine, entries]);

  const handleSelectLine = useCallback((line: number, isShift = false) => {
    onUpdatePanel({ selectedLineNumber: line });

    if (deltaAnchorLine !== null && deltaTargetLine === null && deltaAnchorLine !== line) {
      setDeltaTargetLine(line);
      return;
    }

    const clickedIdx = displayEntries.findIndex((e) => e.lineNumber === line);
    if (clickedIdx === -1) return;

    if (isShift && selectionAnchorIndexRef.current !== null) {
      const start = Math.min(selectionAnchorIndexRef.current, clickedIdx);
      const end = Math.max(selectionAnchorIndexRef.current, clickedIdx);
      const newSet = new Set<number>();
      for (let i = start; i <= end; i++) {
        newSet.add(displayEntries[i].lineNumber);
      }
      setSelectedLineNumbers(newSet);
    } else {
      selectionAnchorIndexRef.current = clickedIdx;
      setSelectedLineNumbers(new Set([line]));
    }
  }, [deltaAnchorLine, deltaTargetLine, displayEntries, onUpdatePanel]);

  const handleSetDeltaAnchor = useCallback((line: number) => {
    setDeltaAnchorLine(line);
    setDeltaTargetLine(null);
    copyWithToast(`Line #${line}`, 'Delta Anchor (T1) set');
  }, []);

  const handleSwapDelta = useCallback(() => {
    setDeltaAnchorLine(deltaTargetLine);
    setDeltaTargetLine(deltaAnchorLine);
  }, [deltaAnchorLine, deltaTargetLine]);

  const handleClearDelta = useCallback(() => {
    setDeltaAnchorLine(null);
    setDeltaTargetLine(null);
  }, []);

  const currentSource = useMemo(() => {
    return sources.find((s) => s.id === panel.sourceId) || null;
  }, [sources, panel.sourceId]);

  const handleToggleLevel = (lvl: LogLevel) => {
    const isSelected = panel.selectedLevels.includes(lvl);
    const nextLevels = isSelected
      ? panel.selectedLevels.filter((l) => l !== lvl)
      : [...panel.selectedLevels, lvl];
    onUpdatePanel({ selectedLevels: nextLevels });
  };

  return (
    <div
      className={`panel-window-card ${isActive ? 'active' : ''}`}
      onClick={() => {
        if (!isActive) onFocus();
      }}
    >
      {/* Panel Top Control Bar */}
      <div className="panel-header-bar">
        {/* Left: Panel Identification & Source Selector */}
        <div className="panel-header-left">
          <div className="panel-badge-group">
            <span className={`panel-badge ${isActive ? 'panel-badge-active' : ''}`}>
              P{panelIndex + 1}
            </span>
          </div>

          {/* Source Dropdown */}
          <div className="panel-source-picker" ref={sourceDropdownRef}>
            <button
              className="panel-source-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsSourceDropdownOpen((prev) => !prev);
              }}
              title="Change log source for this panel"
            >
              <FileText size={13} className="panel-source-icon" />
              <span className="panel-source-name">
                {currentSource ? currentSource.name : (panel.selectedSourceIds.length > 1 ? `Unified (${panel.selectedSourceIds.length})` : 'Select Source')}
              </span>
              <ChevronDown size={12} className="panel-source-chevron" />
            </button>

            {isSourceDropdownOpen && (
              <div className="panel-source-menu">
                <div className="panel-source-menu-header">Select Log Source</div>
                <div className="panel-source-menu-list">
                  {sources.map((src) => {
                    const isCurrent = src.id === panel.sourceId;
                    return (
                      <button
                        key={src.id}
                        className={`panel-source-item ${isCurrent ? 'selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdatePanel({ sourceId: src.id, selectedSourceIds: [src.id] });
                          setIsSourceDropdownOpen(false);
                        }}
                      >
                        <span className="panel-source-item-name">{src.name}</span>
                        <span className="panel-source-item-cat">{src.category}</span>
                        {isCurrent && <Check size={13} className="panel-source-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Search & Quick Level Filters */}
        <div className="panel-header-center">
          {/* Quick Search */}
          <div className="panel-search-box">
            <Search size={12} className="panel-search-icon" />
            <input
              type="text"
              className="panel-search-input"
              placeholder="Search in panel..."
              value={panel.search}
              onChange={(e) => onUpdatePanel({ search: e.target.value })}
              onFocus={onFocus}
            />
            {panel.search && (
              <button
                className="panel-search-clear"
                onClick={() => onUpdatePanel({ search: '' })}
                title="Clear search"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Quick Level Filter Badges */}
          <div className="panel-level-pills">
            {(['error', 'warning', 'info', 'debug'] as LogLevel[]).map((lvl) => {
              const count = levelCounts[lvl] || 0;
              const isSelected = panel.selectedLevels.includes(lvl);
              const displayLvl = lvl === 'warning' ? 'warn' : lvl;
              return (
                <button
                  key={lvl}
                  className={`panel-lvl-pill lvl-${displayLvl} ${isSelected ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleLevel(lvl);
                  }}
                  title={`Toggle ${lvl.toUpperCase()} logs (${count})`}
                >
                  <span className="lvl-dot" />
                  <span className="lvl-text">{displayLvl.slice(0, 3).toUpperCase()}</span>
                  {count > 0 && <span className="lvl-count">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: View Mode, Entry Count & Panel Actions */}
        <div className="panel-header-right">
          {/* Entry count */}
          <span className="panel-count-label" title={`${totalEntries} total, ${displayEntries.length} filtered, query time: ${durationMs}ms`}>
            {displayEntries.length.toLocaleString()}{' '}
            <span className="panel-count-total">/ {totalEntries.toLocaleString()}</span>
          </span>

          {/* View mode toggle */}
          <div className="panel-viewmode-group">
            <button
              className={`panel-viewmode-btn ${panel.viewMode === 'compact' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onUpdatePanel({ viewMode: 'compact' });
              }}
              title="Compact View"
            >
              C
            </button>
            <button
              className={`panel-viewmode-btn ${panel.viewMode === 'standard' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onUpdatePanel({ viewMode: 'standard' });
              }}
              title="Standard View"
            >
              S
            </button>
            <button
              className={`panel-viewmode-btn ${panel.viewMode === 'raw' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onUpdatePanel({ viewMode: 'raw' });
              }}
              title="Raw View"
            >
              R
            </button>
          </div>

          {/* Wrap lines toggle */}
          <button
            className={`panel-action-btn ${panel.wrapLines ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onUpdatePanel({ wrapLines: !panel.wrapLines });
            }}
            title="Toggle Word Wrap"
          >
            <WrapText size={13} />
          </button>

          {/* Reset Panel Filters */}
          <button
            className="panel-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onUpdatePanel({
                search: '',
                markerFilter: '',
                selectedLevels: [],
                excludeLevels: [],
                selectedWorkflow: null,
                selectedOperation: null,
                selectedCorrelation: null,
              });
            }}
            title="Reset Filters in Panel"
          >
            <RotateCcw size={12} />
          </button>

          {/* Split / Maximize / Close Actions */}
          {totalPanels > 1 && (
            <button
              className="panel-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onMaximizePanel();
              }}
              title="Maximize this panel (Single View)"
            >
              <Maximize2 size={13} />
            </button>
          )}

          {totalPanels < 4 && (
            <button
              className="panel-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSplitPanel();
              }}
              title="Split into another panel"
            >
              <Columns2 size={13} />
            </button>
          )}

          {totalPanels > 1 && (
            <button
              className="panel-action-btn panel-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                onClosePanel();
              }}
              title="Close panel"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Panel Log Feed Body */}
      <div className="panel-content-body">
        <LogTable
          entries={displayEntries}
          isLoading={isLoading}
          isLiveTail={false}
          onViewContext={(line, srcId) => {
            onViewContext(line, srcId || panel.sourceId || '');
          }}
          wrapLines={panel.wrapLines}
          hideBrackets={panel.hideBrackets}
          viewMode={panel.viewMode}
          selectedLineNumber={panel.selectedLineNumber}
          selectedLineNumbers={selectedLineNumbers}
          onSelectLine={handleSelectLine}
          searchQuery={panel.search}
          markerQuery={panel.markerFilter}
          correlationQuery={panel.selectedCorrelation || undefined}
          targetScrollIndex={targetScrollIndex}
          showDatetime={panel.showDatetime}
          showPid={panel.showPid}
          showTid={panel.showTid}
          showCorrelation={panel.showCorrelation}
          sortOption={panel.sortOption}
          isUnifiedStream={panel.selectedSourceIds.length > 1}
          deltaAnchorLine={deltaAnchorLine}
          deltaTargetLine={deltaTargetLine}
          onSetDeltaAnchor={handleSetDeltaAnchor}
        />

        {/* Delta Time HUD local to this panel */}
        <DeltaTimeToolbar
          measurement={deltaMeasurement}
          anchorLine={deltaAnchorLine}
          targetLine={deltaTargetLine}
          onSwap={handleSwapDelta}
          onClear={handleClearDelta}
          onJumpToLine={(line) => {
            onUpdatePanel({ selectedLineNumber: line });
            const idx = entries.findIndex((e) => e.lineNumber === line);
            if (idx !== -1) setTargetScrollIndex(idx);
          }}
        />
      </div>
    </div>
  );
};
