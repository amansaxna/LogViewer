import React, { useState, useEffect, useMemo } from 'react';
import {
  Terminal,
  FileText,
  Plus,
  X,
  Search,
  Folder,
  FolderOpen,
  CloudUpload,
  Link2,
  ClipboardList,
  PanelLeftClose,
  Copy,
  Check,
  History,
  ChevronDown,
  ChevronRight,
  GitMerge,
  CheckSquare,
  Square,
  FileCode,
  FileJson,
  Radio,
  Layers,
  Sparkles,
  HardDrive,
  ExternalLink,
} from 'lucide-react';
import { LogSource } from '../types.ts';
import { PanelLayout, PanelState, getLayoutCount } from '../types/panel.ts';

interface SidebarProps {
  sources: LogSource[];
  activeSourceId: string | null;
  selectedSourceIds?: string[];
  onSelectSource: (id: string) => void;
  onToggleSourceSelect?: (id: string) => void;
  onSelectAllSources?: () => void;
  onClearAllSources?: () => void;
  onOpenModal: () => void;
  onOpenPasteModal: () => void;
  onToggleLiveTail: () => void;
  isLiveTail: boolean;
  liveLogsPerSec?: number;
  liveAvgLogsPerSec?: number;
  onRemoveCustomSource: (id: string) => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  // Multi-panel integration
  panels?: PanelState[];
  activePanelId?: string;
  panelLayout?: PanelLayout;
  onSelectActivePanel?: (id: string) => void;
  onOpenLanding?: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatBytesSplit(bytes?: number): { value: string; unit: string } {
  if (!bytes || bytes === 0) return { value: '0', unit: 'B' };
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return { value: val.toString(), unit: sizes[i] };
}

function getFormatIcon(format?: string, category?: string) {
  const cat = (category || '').toLowerCase();
  const fmt = (format || '').toLowerCase();

  if (cat.includes('xml') || fmt.includes('xml')) {
    return <FileCode size={14} className="text-cyan-400" />;
  }
  if (cat.includes('json') || fmt.includes('json')) {
    return <FileJson size={14} className="text-purple-400" />;
  }
  if (cat.includes('stream') || fmt.includes('stream')) {
    return <Radio size={14} className="text-emerald-400" />;
  }
  return <FileText size={14} className="text-amber-400" />;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sources,
  activeSourceId,
  selectedSourceIds = [],
  onSelectSource,
  onToggleSourceSelect,
  onSelectAllSources,
  onClearAllSources,
  onOpenModal,
  onOpenPasteModal,
  onToggleLiveTail,
  isLiveTail,
  liveLogsPerSec = 0,
  liveAvgLogsPerSec = 0,
  onRemoveCustomSource,
  isOpen = true,
  onToggleOpen,
  panels,
  activePanelId,
  panelLayout,
  onSelectActivePanel,
  onOpenLanding,
}) => {
  const [filterText, setFilterText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedRotations, setExpandedRotations] = useState<Record<string, boolean>>({});

  const visiblePanelsCount = panelLayout ? getLayoutCount(panelLayout) : 1;
  const visiblePanels = panels ? panels.slice(0, visiblePanelsCount) : [];

  // Initialize categories as expanded by default
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    for (const s of sources) {
      const cat = s.category || 'General';
      if (initial[cat] === undefined) initial[cat] = true;
    }
    setExpandedCategories(initial);
  }, [sources]);

  // Handle keyboard shortcut for expand all
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setExpandedCategories((prev) => {
          const allExpanded = Object.values(prev).every((v) => v);
          const next: Record<string, boolean> = {};
          for (const k of Object.keys(prev)) {
            next[k] = !allExpanded;
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-expand rotations if active source is an archive
  useEffect(() => {
    if (activeSourceId) {
      for (const s of sources) {
        if (s.rotations?.some((r) => r.id === activeSourceId)) {
          setExpandedRotations((prev) => ({ ...prev, [s.id]: true }));
        }
      }
    }
  }, [activeSourceId, sources]);

  const handleCopy = (e: React.MouseEvent, path: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: prev[cat] === undefined ? false : !prev[cat],
    }));
  };

  // Filter sources
  const filteredSources = useMemo(() => {
    if (!filterText.trim()) return sources;
    const q = filterText.toLowerCase();
    return sources.filter((s) => {
      const matchName = s.name.toLowerCase().includes(q);
      const matchPath = s.path.toLowerCase().includes(q);
      const matchCategory = (s.category || '').toLowerCase().includes(q);
      return matchName || matchPath || matchCategory;
    });
  }, [sources, filterText]);

  // Unique categories
  const categories = useMemo(() => {
    return Array.from(new Set(filteredSources.map((s) => s.category || 'General')));
  }, [filteredSources]);

  // Group filtered sources by category
  const groupedSources = useMemo(() => {
    const groups: Record<string, LogSource[]> = {};
    for (const s of filteredSources) {
      const cat = s.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    }
    return groups;
  }, [filteredSources]);

  // Overall statistics
  const totalSizeBytes = useMemo(() => {
    return sources.reduce((sum, s) => sum + (s.size || 0), 0);
  }, [sources]);

  const isAllMerged = sources.length > 1 && selectedSourceIds.length === sources.length;
  const isSomeMerged = selectedSourceIds.length > 1 && !isAllMerged;

  return (
    <aside className={`sidebar modern-sidebar ${!isOpen ? 'collapsed' : ''}`}>
      {/* Sleek App Branding Header */}
      <div className="sidebar-brand-header">
        <div
          className="sidebar-brand-left"
          onClick={onOpenLanding}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onOpenLanding) {
              e.preventDefault();
              onOpenLanding();
            }
          }}
          title="Click to view LogViewer Overview & Product Tour"
        >
          <div className="sidebar-brand-mark">
            <Terminal size={17} strokeWidth={2.4} />
          </div>
          <div className="sidebar-brand-meta">
            <div className="sidebar-brand-name">
              <span>EconViewer</span>
              <span className="sidebar-version-pill">v2.4</span>
            </div>
            <span className="sidebar-brand-sub">Universal Log Stream Engine</span>
          </div>
        </div>

        {onToggleOpen && (
          <button
            className="sidebar-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleOpen();
            }}
            title="Collapse Sidebar ([)"
            aria-label="Collapse Sidebar"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {/* Primary Actions & Quick Controls Bar */}
      <div className="sidebar-actions-section">
        {/* Main Load Button */}
        <button
          onClick={onOpenModal}
          className="sidebar-primary-action-btn"
          title="Open files or browse directory"
        >
          <CloudUpload size={15} />
          <span>Load Log Files</span>
          <span className="sidebar-action-shortcut">⌘O</span>
        </button>

        {/* 3-Column Compact Quick Action Toolbar */}
        <div className="sidebar-quick-toolbar">
          {/* Live Tail Toggle */}
          <button
            type="button"
            onClick={onToggleLiveTail}
            className={`sidebar-tool-btn ${isLiveTail ? 'active-streaming' : ''}`}
            title={isLiveTail ? 'Live Tail is active — click to pause (Shortcut: T)' : 'Start live tailing incoming logs (Shortcut: T)'}
          >
            {isLiveTail ? (
              <>
                <span className="sidebar-status-dot pulsing" />
                <span className="sidebar-tool-label">Tail</span>
                <span className="sidebar-rate-chip">
                  {liveAvgLogsPerSec > 0 ? `${liveAvgLogsPerSec}/s` : `${liveLogsPerSec}/s`}
                </span>
              </>
            ) : (
              <>
                <Link2 size={13} />
                <span className="sidebar-tool-label">Live Tail</span>
              </>
            )}
          </button>

          {/* Paste Logs */}
          <button
            type="button"
            onClick={onOpenPasteModal}
            className="sidebar-tool-btn"
            title="Paste log snippet from clipboard to inspect (Shortcut: ⌘V)"
          >
            <ClipboardList size={13} />
            <span className="sidebar-tool-label">Paste</span>
          </button>

          {/* Merge All / Unified Stream */}
          {sources.length > 1 ? (
            <button
              type="button"
              onClick={() => {
                if (isAllMerged || isSomeMerged) {
                  onClearAllSources?.();
                } else {
                  onSelectAllSources?.();
                }
              }}
              className={`sidebar-tool-btn ${isAllMerged || isSomeMerged ? 'active-merged' : ''}`}
              title={
                isAllMerged || isSomeMerged
                  ? 'Exit Unified Stream (Clear multi-source merge)'
                  : 'Merge all active log sources into a synchronized unified stream'
              }
            >
              <GitMerge size={13} />
              <span className="sidebar-tool-label">
                {isAllMerged ? 'Merged' : isSomeMerged ? `Merged` : 'Merge All'}
              </span>
              {(isAllMerged || isSomeMerged) && (
                <span className="sidebar-merge-chip">
                  {isAllMerged ? 'All' : selectedSourceIds.length}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="sidebar-tool-btn disabled"
              title="Add 2 or more log sources to enable multi-source merge"
            >
              <GitMerge size={13} />
              <span className="sidebar-tool-label">Merge</span>
            </button>
          )}
        </div>
      </div>

      {/* Focus Target Panel Switcher (When Multi-Panel is Active) */}
      {visiblePanelsCount > 1 && (
        <div className="sidebar-target-segment-wrapper">
          <div className="sidebar-target-segment-header">
            <span className="sidebar-target-segment-title">Focus Target Panel</span>
            <span className="sidebar-target-segment-hint">Click file to load into target</span>
          </div>
          <div className="sidebar-target-segmented-control">
            {visiblePanels.map((p, idx) => {
              const panelNumber = parseInt(p.id.replace(/\D/g, ''), 10) || (idx + 1);
              const isCurrentActive =
                p.id === activePanelId ||
                (idx === 0 && !visiblePanels.some((vp) => vp.id === activePanelId));
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`sidebar-target-segment-tab ${isCurrentActive ? 'active' : ''}`}
                  onClick={() => onSelectActivePanel?.(p.id)}
                  title={`Select Panel ${panelNumber} as active insertion target`}
                >
                  <span className="target-tab-badge">P{panelNumber}</span>
                  <span className="target-tab-status">Panel {panelNumber}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="sidebar-search-container">
        <div className="sidebar-search-box">
          <Search size={13} className="sidebar-search-icon" />
          <input
            type="text"
            className="sidebar-search-field"
            placeholder="Filter sources & files..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              className="sidebar-search-clear-btn"
              title="Clear filter"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Sources Tree View */}
      <div className="sidebar-tree-viewport">
        {sources.length === 0 && (
          <div className="sidebar-empty-state">
            <HardDrive size={28} className="sidebar-empty-icon" />
            <p className="sidebar-empty-title">No log sources loaded</p>
            <p className="sidebar-empty-subtitle">Drop files anywhere or click Load Files</p>
            <button onClick={onOpenModal} className="sidebar-empty-btn">
              <Plus size={13} />
              Add Local Log Source
            </button>
          </div>
        )}

        {categories.map((category) => {
          const categorySources = filteredSources.filter((s) => (s.category || 'General') === category);
          const isCategoryExpanded = expandedCategories[category] !== false;

          return (
            <div key={category} className="sidebar-category-group">
              {/* Collapsible Category Header */}
              <button
                type="button"
                className="sidebar-category-header"
                onClick={() => toggleCategory(category)}
              >
                <div className="sidebar-category-header-left">
                  {isCategoryExpanded ? <FolderOpen size={13} /> : <Folder size={13} />}
                  <span className="sidebar-category-name">{category}</span>
                </div>
                <div className="sidebar-category-header-right">
                  <span className="sidebar-category-count">{categorySources.length}</span>
                  {isCategoryExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>
              </button>

              {/* Source Items */}
              {isCategoryExpanded && (
                <div className="sidebar-category-items">
                  {categorySources.map((source) => {
                    const isMultiSelected = selectedSourceIds.includes(source.id);
                    const isSingleActive = selectedSourceIds.length <= 1;
                    const isActive = isSingleActive ? source.id === activeSourceId : isMultiSelected;
                    const hasRotations = Boolean(source.rotations && source.rotations.length > 0);
                    const isRotExpanded = Boolean(expandedRotations[source.id]);
                    const sizeFormatted = formatBytes(source.size);

                    // Check which quadrant panels have this source loaded (deduplicated & strictly ordered P1..P4)
                    const openInPanelsMap = new Map<number, { panelId: string; index: number }>();
                    if (visiblePanelsCount > 1) {
                      visiblePanels.forEach((p, idx) => {
                        const panelNumber = parseInt(p.id.replace(/\D/g, ''), 10) || (idx + 1);
                        const isLoaded = p.selectedSourceIds && p.selectedSourceIds.length > 0
                          ? p.selectedSourceIds.includes(source.id)
                          : p.sourceId === source.id;
                        if (isLoaded) {
                          if (!openInPanelsMap.has(panelNumber)) {
                            openInPanelsMap.set(panelNumber, {
                              panelId: p.id,
                              index: panelNumber,
                            });
                          }
                        }
                      });
                    }
                    const openInPanels = Array.from(openInPanelsMap.values()).sort((a, b) => a.index - b.index);

                    return (
                      <div key={source.id} className="sidebar-source-node">
                        <div
                          className={`sidebar-source-row ${isActive ? 'active-row' : ''}`}
                          onClick={() => onSelectSource(source.id)}
                          title={`${source.name}\n${source.path}\nSize: ${sizeFormatted}`}
                        >
                          {/* Row Left: Checkbox + Format Icon + Title */}
                          <div className="sidebar-source-row-left">
                            {onToggleSourceSelect && sources.length > 1 && (
                              <button
                                type="button"
                                className="sidebar-source-checkbox source-checkbox-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleSourceSelect(source.id);
                                }}
                                title={
                                  isMultiSelected
                                    ? 'Remove from unified merge'
                                    : 'Add to unified multi-source stream'
                                }
                              >
                                {isMultiSelected ? (
                                  <CheckSquare size={13} className="text-sky-400" />
                                ) : (
                                  <Square size={13} className="text-slate-500" />
                                )}
                              </button>
                            )}

                            <div className="sidebar-source-format-icon">
                              {getFormatIcon(source.format, source.category)}
                            </div>

                            <div className="sidebar-source-title-meta">
                              <span className="sidebar-source-title">{source.name}</span>
                            </div>
                          </div>

                          {/* Row Right: Panel Badges + Rotations + Size + Copy */}
                          <div className="sidebar-source-row-right">
                            {/* Panel Chips (e.g. P1, P2) */}
                            {openInPanels.length > 0 && (
                              <div className="sidebar-panel-chips-group">
                                {openInPanels.map((p) => (
                                  <span
                                    key={p.panelId}
                                    className={`sidebar-panel-chip ${
                                      p.panelId === activePanelId ? 'active-panel-chip' : ''
                                    }`}
                                    title={`Loaded in Panel ${p.index}`}
                                  >
                                    P{p.index}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Rotation Archive Counter */}
                            {hasRotations && (
                              <button
                                type="button"
                                className={`sidebar-rotations-toggle-pill ${isRotExpanded ? 'expanded' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedRotations((prev) => ({
                                    ...prev,
                                    [source.id]: !prev[source.id],
                                  }));
                                }}
                                title={`Toggle ${source.rotations?.length} rotated archives`}
                              >
                                <History size={10} />
                                <span>{source.rotations?.length}</span>
                                {isRotExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                              </button>
                            )}

                            {/* File Size */}
                            <span className="sidebar-filesize-text">{sizeFormatted}</span>

                            {/* Actions (Copy / Remove) */}
                            <div className="sidebar-row-hover-actions">
                              <button
                                type="button"
                                className="sidebar-row-action-btn"
                                onClick={(e) => handleCopy(e, source.path, source.id)}
                                title={copiedId === source.id ? 'Copied path!' : 'Copy full file path'}
                              >
                                {copiedId === source.id ? (
                                  <Check size={12} className="text-emerald-400" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>

                              {source.isCustom && (
                                <button
                                  type="button"
                                  className="sidebar-row-action-btn delete-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveCustomSource(source.id);
                                  }}
                                  title="Close custom file"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Sub-tree for Rotations */}
                        {hasRotations && isRotExpanded && (
                          <div className="sidebar-rotations-subtree">
                            {source.rotations!.map((rot) => {
                              const isRotActive = rot.id === activeSourceId;
                              const rotSize = formatBytes(rot.size);

                              return (
                                <div
                                  key={rot.id}
                                  className={`sidebar-rotated-row ${isRotActive ? 'active-row' : ''}`}
                                  onClick={() => onSelectSource(rot.id)}
                                  title={`Archive: ${rot.name}\n${rot.path}\nSize: ${rotSize}`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <History size={12} className="text-slate-500 shrink-0" />
                                    <span className="sidebar-rotated-name">{rot.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="sidebar-filesize-text">{rotSize}</span>
                                    <button
                                      type="button"
                                      className="sidebar-row-action-btn"
                                      onClick={(e) => handleCopy(e, rot.path, rot.id)}
                                      title="Copy path"
                                    >
                                      {copiedId === rot.id ? (
                                        <Check size={11} className="text-emerald-400" />
                                      ) : (
                                        <Copy size={11} />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Minimal Sleek Footer with Stats */}
      <div className="sidebar-stats-footer">
        <div className="sidebar-footer-stats-line">
          <span className="sidebar-footer-count">{sources.length} sources</span>
          <span className="sidebar-footer-dot">·</span>
          <span className="sidebar-footer-size">{formatBytes(totalSizeBytes)} total</span>
        </div>
        <button onClick={onOpenModal} className="sidebar-footer-open-btn" title="Add another log file">
          <Plus size={13} />
          <span>Add Source</span>
        </button>
      </div>
    </aside>
  );
};
