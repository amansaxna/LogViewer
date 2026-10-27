import React, { useState, useEffect } from 'react';
import {
  Terminal,
  FileText,
  Plus,
  X,
  Search,
  Folder,
  CloudUpload,
  Link2,
  ClipboardList,
  PanelLeftClose,
  Copy,
  Check,
  History,
  ChevronDown,
  ChevronRight,
  Trash2,
  GitMerge,
  CheckSquare,
  Square,
} from 'lucide-react';
import { LogSource } from '../types.ts';

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

export const Sidebar: React.FC<SidebarProps> = ({
  sources,
  activeSourceId,
  selectedSourceIds,
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
}) => {
  const [filterText, setFilterText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedRotations, setExpandedRotations] = useState<Record<string, boolean>>({});

  // Auto-expand rotations if an active source is inside it
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

  // Group sources by category
  const filteredSources = sources.filter(
    (s) =>
      s.name.toLowerCase().includes(filterText.toLowerCase()) ||
      s.category.toLowerCase().includes(filterText.toLowerCase()) ||
      s.path.toLowerCase().includes(filterText.toLowerCase())
  );

  const categories = Array.from(new Set(filteredSources.map((s) => s.category || 'General')));

  return (
    <aside className={`sidebar ${!isOpen ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="sidebar-logo">
            <Terminal size={14} />
          </div>
          <span className="sidebar-title">LogViewer</span>
        </div>
        {onToggleOpen && (
          <button
            className="btn-icon"
            onClick={onToggleOpen}
            title="Collapse left panel ([)"
            style={{ width: 24, height: 24, flexShrink: 0 }}
          >
            <PanelLeftClose size={13} />
          </button>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div style={{ padding: '5px 8px 3px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Row 1: Primary File Actions in 2-button grid */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={onOpenModal}
            className="btn-load-files"
            title="Open local log files or folders (Ctrl+O)"
          >
            <CloudUpload size={13} />
            <span>Load Files</span>
          </button>

          <button
            onClick={onOpenPasteModal}
            className="btn-paste-logs"
            title="Paste raw log lines directly into session"
          >
            <ClipboardList size={13} />
            <span>Paste Logs</span>
          </button>
        </div>

        {/* Row 2: Unified Multi-Source Stream Toggle */}
        {sources.length > 1 && (
          <button
            onClick={() => {
              if (selectedSourceIds && selectedSourceIds.length === sources.length) {
                onClearAllSources?.();
              } else {
                onSelectAllSources?.();
              }
            }}
            className={`btn-merge-all ${selectedSourceIds && selectedSourceIds.length > 1 ? 'active' : ''}`}
            title="Toggle Unified Multi-Source Stream"
          >
            <GitMerge size={12} />
            <span>
              {selectedSourceIds && selectedSourceIds.length > 1
                ? `Unified Stream (${selectedSourceIds.length}/${sources.length})`
                : `Merge All Sources (${sources.length})`}
            </span>
          </button>
        )}
      </div>

      {/* Filter Sources */}
      <div className="sidebar-search">
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="sidebar-search-input"
            placeholder="Search log files..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <Search
            size={12}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* Grouped Sources List */}
      <div className="sidebar-sources-list">
        {sources.length === 0 && (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton-box" style={{ width: '40%', height: 14 }} />
            <div className="skeleton-box" style={{ width: '100%', height: 32 }} />
            <div className="skeleton-box" style={{ width: '100%', height: 32 }} />
            <div className="skeleton-box" style={{ width: '60%', height: 14, marginTop: 8 }} />
            <div className="skeleton-box" style={{ width: '100%', height: 32 }} />
          </div>
        )}
        {categories.map((category) => {
          const categorySources = filteredSources.filter((s) => (s.category || 'General') === category);
          return (
            <div key={category} className="source-category-group">
              <div className="source-category-title" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Folder size={12} />
                {category}
              </div>

              {categorySources.map((source) => {
                const isMultiSelected = selectedSourceIds ? selectedSourceIds.includes(source.id) : false;
                const isSingleActive = !selectedSourceIds || selectedSourceIds.length <= 1;
                const isActive = isSingleActive ? source.id === activeSourceId : isMultiSelected;
                const sizeInfo = formatBytesSplit(source.size);
                const hasRotations = source.rotations && source.rotations.length > 0;
                const isExpanded = !!expandedRotations[source.id];

                return (
                  <div key={source.id} style={{ marginBottom: 1 }}>
                    <div
                      className={`source-item ${isActive ? 'active' : ''}`}
                      onClick={() => onSelectSource(source.id)}
                    >
                      <div className="source-item-left">
                        {onToggleSourceSelect && sources.length > 1 && (
                          <button
                            type="button"
                            className="source-checkbox-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleSourceSelect(source.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              marginRight: 1,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              color: isMultiSelected ? '#38bdf8' : 'var(--text-muted)',
                              opacity: isMultiSelected ? 1 : 0.6,
                            }}
                            title={isMultiSelected ? 'Remove from unified stream' : 'Add to unified stream'}
                          >
                            {isMultiSelected ? <CheckSquare size={12} color="#38bdf8" /> : <Square size={12} />}
                          </button>
                        )}
                        <FileText size={14} color={isActive ? '#38bdf8' : '#64748b'} />
                        <span className="source-item-name" title={source.name}>
                          {source.name}
                        </span>
                      </div>

                      <div className="source-item-right">
                        {/* Rotation toggle badge placed neatly in right group */}
                        {hasRotations && (
                          <button
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              background: isExpanded ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.08)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              borderRadius: 3,
                              padding: '1px 4px',
                              color: '#38bdf8',
                              fontSize: '0.66rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRotations((prev) => ({ ...prev, [source.id]: !prev[source.id] }));
                            }}
                            title={`Toggle ${source.rotations?.length} rotated archives`}
                          >
                            <History size={10} />
                            <span>{source.rotations?.length}</span>
                            {isExpanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                          </button>
                        )}

                        {/* Stacked 2-line size badge (matching screenshot) */}
                        {source.exists !== false ? (
                          <div
                            className="source-size-badge"
                            title={`File size: ${formatBytes(source.size)}`}
                          >
                            <span className="source-size-badge-val">{sizeInfo.value}</span>
                            <span className="source-size-badge-unit">{sizeInfo.unit}</span>
                          </div>
                        ) : (
                          <span className="source-size-badge" style={{ color: '#ef4444' }}>
                            Missing
                          </span>
                        )}

                        {/* Copy path button (shown on hover without reserving layout space) */}
                        <button
                          className={`source-copy-btn ${copiedId === source.id ? 'copied' : ''}`}
                          style={{
                            color: copiedId === source.id ? '#4ade80' : '#64748b',
                          }}
                          onClick={(e) => handleCopy(e, source.path, source.id)}
                          title={copiedId === source.id ? 'Copied path!' : `Copy path: ${source.path}`}
                        >
                          {copiedId === source.id ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                        </button>

                        {source.isCustom && (
                          <button
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              padding: 2,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveCustomSource(source.id);
                            }}
                            title="Close file"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sub-list of Rotated Files in dedicated tree */}
                    {hasRotations && isExpanded && (
                      <div className="source-rotations-tree">
                        {source.rotations!.map((rot) => {
                          const isRotActive = rot.id === activeSourceId;
                          const rotSize = formatBytesSplit(rot.size);
                          return (
                            <div
                              key={rot.id}
                              className={`source-rotated-item ${isRotActive ? 'active' : ''}`}
                              onClick={() => onSelectSource(rot.id)}
                              title={rot.name}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1 }}>
                                <History size={11} color={isRotActive ? '#38bdf8' : '#64748b'} />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {rot.name}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                <div className="source-size-badge" style={{ padding: '1px 3px', minWidth: 28 }}>
                                  <span className="source-size-badge-val" style={{ fontSize: '0.64rem' }}>
                                    {rotSize.value}
                                  </span>
                                  <span className="source-size-badge-unit" style={{ fontSize: '0.5rem' }}>
                                    {rotSize.unit}
                                  </span>
                                </div>

                                <button
                                  className={`source-copy-btn ${copiedId === rot.id ? 'copied' : ''}`}
                                  style={{
                                    color: copiedId === rot.id ? '#4ade80' : '#64748b',
                                  }}
                                  onClick={(e) => handleCopy(e, rot.path, rot.id)}
                                  title={`Copy path: ${rot.path}`}
                                >
                                  {copiedId === rot.id ? <Check size={11} color="#4ade80" /> : <Copy size={11} />}
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
          );
        })}

        {filteredSources.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20, fontSize: '0.8rem' }}>
            No log files matching filter
          </div>
        )}
      </div>
    </aside>
  );
};
