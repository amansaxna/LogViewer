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
} from 'lucide-react';
import { LogSource } from '../types.ts';

interface SidebarProps {
  sources: LogSource[];
  activeSourceId: string | null;
  onSelectSource: (id: string) => void;
  onOpenModal: () => void;
  onOpenPasteModal: () => void;
  onToggleLiveTail: () => void;
  isLiveTail: boolean;
  liveLogsPerSec?: number;
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
  onSelectSource,
  onOpenModal,
  onOpenPasteModal,
  onToggleLiveTail,
  isLiveTail,
  liveLogsPerSec = 0,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="sidebar-logo">
            <Terminal size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="sidebar-title">EconViewer</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Modern log analyzer</span>
          </div>
        </div>
        {onToggleOpen && (
          <button
            className="btn-icon"
            onClick={onToggleOpen}
            title="Collapse left panel ([)"
            style={{ width: 28, height: 28, flexShrink: 0 }}
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {/* Quick Action Buttons (Matching Image 2) */}
      <div style={{ padding: '12px 14px 4px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Load Files Button */}
        <button
          onClick={onOpenModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '9px 14px',
            backgroundColor: 'var(--accent-primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: '0.86rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px var(--accent-bg)',
            transition: 'all 0.15s ease',
          }}
          className="btn-load-files"
        >
          <CloudUpload size={16} />
          Load Files
        </button>

        {/* Stream File Button */}
        <button
          onClick={onToggleLiveTail}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '8px 14px',
            backgroundColor: isLiveTail ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-surface)',
            color: isLiveTail ? '#22c55e' : 'var(--text-primary)',
            border: `1px solid ${isLiveTail ? 'rgba(34, 197, 94, 0.4)' : 'var(--border-subtle)'}`,
            borderRadius: 8,
            fontWeight: 500,
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Link2 size={15} />
          {isLiveTail ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>Streaming File</span>
              <span
                style={{
                  background: 'rgba(34, 197, 94, 0.25)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {liveLogsPerSec} logs/s
              </span>
            </span>
          ) : (
            'Stream File'
          )}
        </button>

        {/* Paste Logs Button */}
        <button
          onClick={onOpenPasteModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '8px 14px',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            fontWeight: 500,
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <ClipboardList size={15} />
          Paste Logs
        </button>
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
            size={13}
            style={{
              position: 'absolute',
              right: 10,
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
        {categories.map((category) => {
          const categorySources = filteredSources.filter((s) => (s.category || 'General') === category);
          return (
            <div key={category} className="source-category-group">
              <div className="source-category-title" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Folder size={12} />
                {category}
              </div>

              {categorySources.map((source) => {
                const isActive = source.id === activeSourceId;
                const sizeInfo = formatBytesSplit(source.size);
                const hasRotations = source.rotations && source.rotations.length > 0;
                const isExpanded = !!expandedRotations[source.id];

                return (
                  <div key={source.id} style={{ marginBottom: 4 }}>
                    <div
                      className={`source-item ${isActive ? 'active' : ''}`}
                      onClick={() => onSelectSource(source.id)}
                    >
                      <div className="source-item-left">
                        <FileText size={15} color={isActive ? '#38bdf8' : '#64748b'} />
                        <span className="source-item-name" title={source.name}>
                          {source.name}
                        </span>

                        {/* Rotation toggle badge placed neatly next to the name */}
                        {hasRotations && (
                          <button
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              background: isExpanded ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.08)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              borderRadius: 4,
                              padding: '1px 5px',
                              color: '#38bdf8',
                              fontSize: '0.68rem',
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
                            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                          </button>
                        )}
                      </div>

                      <div className="source-item-right">
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

                        {/* Copy path button */}
                        <button
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: copiedId === source.id ? '#4ade80' : '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: 2,
                          }}
                          onClick={(e) => handleCopy(e, source.path, source.id)}
                          title={copiedId === source.id ? 'Copied path!' : `Copy path: ${source.path}`}
                        >
                          {copiedId === source.id ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                                <History size={12} color={isRotActive ? '#38bdf8' : '#64748b'} />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {rot.name}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <div className="source-size-badge" style={{ padding: '1px 4px', minWidth: 30 }}>
                                  <span className="source-size-badge-val" style={{ fontSize: '0.66rem' }}>
                                    {rotSize.value}
                                  </span>
                                  <span className="source-size-badge-unit" style={{ fontSize: '0.52rem' }}>
                                    {rotSize.unit}
                                  </span>
                                </div>

                                <button
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: copiedId === rot.id ? '#4ade80' : '#64748b',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 2,
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

      {/* Footer / Open File Button */}
      <div className="sidebar-footer">
        <button className="btn-open-file" onClick={onOpenModal}>
          <Plus size={15} />
          Open Local File...
        </button>
      </div>
    </aside>
  );
};
