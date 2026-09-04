import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: ShortcutItem[] = [
  // Navigation
  { keys: ['↓', 'j'], description: 'Move to next log downwards', category: 'Navigation' },
  { keys: ['↑', 'k'], description: 'Move to previous log upwards', category: 'Navigation' },
  { keys: ['Shift', '↓'], description: 'Select range of logs downwards (Multi-select)', category: 'Navigation' },
  { keys: ['Shift', '↑'], description: 'Select range of logs upwards (Multi-select)', category: 'Navigation' },
  { keys: ['PgDn'], description: 'Jump 15 logs down', category: 'Navigation' },
  { keys: ['PgUp'], description: 'Jump 15 logs up', category: 'Navigation' },
  { keys: ['Home'], description: 'Jump to top of logs', category: 'Navigation' },
  { keys: ['End'], description: 'Jump to bottom of logs', category: 'Navigation' },

  // Actions & Inspection
  { keys: ['Enter', 'Space'], description: 'Open Context Viewer for highlighted line', category: 'Inspection' },
  { keys: ['Ctrl', 'c'], description: 'Copy selected log line content', category: 'Inspection' },
  { keys: ['d'], description: 'Set Delta Time Anchor (T1) to measure latency to another line', category: 'Inspection' },
  { keys: ['g'], description: 'Open "Go to line" modal', category: 'Inspection' },
  { keys: ['Esc'], description: 'Close modal or deselect line', category: 'Inspection' },

  // Search
  { keys: ['/'], description: 'Focus search bar', category: 'Search' },
  { keys: ['n'], description: 'Jump to next match', category: 'Search' },
  { keys: ['Shift', 'n'], description: 'Jump to previous match', category: 'Search' },

  // View & Tail
  { keys: ['['], description: 'Toggle Left Panel collapse / expand', category: 'View' },
  { keys: ['F11'], description: 'Toggle Full Screen mode', category: 'View' },
  { keys: ['w'], description: 'Toggle word wrap', category: 'View' },
  { keys: ['t'], description: 'Toggle Live Tail streaming', category: 'View' },
  { keys: ['Alt', '1'], description: 'Switch to 1 Single Panel View', category: 'Multi-Panel Windows' },
  { keys: ['Alt', '2'], description: 'Switch to 2 Panels (Split View)', category: 'Multi-Panel Windows' },
  { keys: ['Alt', '3'], description: 'Switch to 3 Panels Layout', category: 'Multi-Panel Windows' },
  { keys: ['Alt', '4'], description: 'Switch to 4 Panels (2x2 Quad Grid)', category: 'Multi-Panel Windows' },
  { keys: ['Alt', 'r'], description: 'Reset all settings & filters to default', category: 'General' },
  { keys: ['?'], description: 'Show keyboard shortcuts cheat sheet', category: 'General' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{
          width: 540,
          maxWidth: '92vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0d121f',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Keyboard size={20} color="var(--accent-primary)" />
            <h2 className="modal-title" style={{ fontSize: '1.05rem' }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '16px 20px', overflowY: 'auto' }}>
          {categories.map((cat) => (
            <div key={cat} style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--accent-primary)',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}
              >
                {cat}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SHORTCUTS.filter((s) => s.category === cat).map((shortcut, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                    }}
                  >
                    <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      {shortcut.description}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {shortcut.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 24,
                            padding: '2px 6px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-highlight)',
                            borderRadius: 4,
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: '#f8fafc',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className="modal-footer"
          style={{
            padding: '10px 20px',
            background: 'var(--bg-sidebar)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Tip: Press <kbd style={{ padding: '1px 4px', background: 'var(--bg-surface)', borderRadius: 3 }}>?</kbd> anytime to open this list
          </span>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '6px 16px' }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
