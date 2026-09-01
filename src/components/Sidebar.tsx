import React, { useState } from 'react';
import { Terminal, FileText, Plus, X, Search, Folder } from 'lucide-react';
import { LogSource } from '../types.ts';

interface SidebarProps {
  sources: LogSource[];
  activeSourceId: string | null;
  onSelectSource: (id: string) => void;
  onOpenModal: () => void;
  onRemoveCustomSource: (id: string) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sources,
  activeSourceId,
  onSelectSource,
  onOpenModal,
  onRemoveCustomSource,
}) => {
  const [filterText, setFilterText] = useState('');

  // Group sources by category
  const filteredSources = sources.filter(
    (s) =>
      s.name.toLowerCase().includes(filterText.toLowerCase()) ||
      s.category.toLowerCase().includes(filterText.toLowerCase()) ||
      s.path.toLowerCase().includes(filterText.toLowerCase())
  );

  const categories = Array.from(new Set(filteredSources.map((s) => s.category || 'General')));

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Terminal size={18} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="sidebar-title">LogViewer</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Local Log Engine</span>
        </div>
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
                return (
                  <div
                    key={source.id}
                    className={`source-item ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectSource(source.id)}
                    title={source.path}
                  >
                    <div className="source-item-left">
                      <FileText size={15} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                      <span className="source-item-name">{source.name}</span>
                    </div>

                    <div className="source-item-right">
                      {source.exists !== false ? (
                        <span className="source-size-badge">{formatBytes(source.size)}</span>
                      ) : (
                        <span className="source-size-badge" style={{ color: '#ef4444' }}>
                          Missing
                        </span>
                      )}

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
