import React, { useState } from 'react';
import { X, FolderOpen, AlertCircle } from 'lucide-react';
import { ButtonSpinner } from './Loaders.tsx';
import { chooseFileNative, isVsCode } from '../api/bridge.ts';

interface OpenFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: (path: string, name?: string, category?: string) => Promise<void>;
}

export const OpenFileModal: React.FC<OpenFileModalProps> = ({ isOpen, onClose, onOpen }) => {
  const [filePath, setFilePath] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Custom / Opened Files');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filePath.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await onOpen(filePath.trim(), name.trim() || undefined, category.trim() || undefined);
      setFilePath('');
      setName('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to open file');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPreset = (presetPath: string, presetName: string) => {
    setFilePath(presetPath);
    setName(presetName);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderOpen size={18} color="var(--accent-primary)" />
            <h2 className="modal-title">Open Local Log File</h2>
          </div>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
            }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '10px 12px',
                  borderRadius: 6,
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                File Path (Absolute or Relative)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="/var/log/system.log or ./logs/my_app.log"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  style={{ flex: 1 }}
                  autoFocus
                  required
                />
                {isVsCode() && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={async () => {
                      const picked = await chooseFileNative();
                      if (picked) {
                        setFilePath(picked);
                        if (!name) {
                          setName(picked.split(/[/\\]/).pop() || '');
                        }
                      }
                    }}
                    style={{ padding: '0 12px', whiteSpace: 'nowrap' }}
                  >
                    Browse...
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Production Webhook Log"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Category
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Custom / Opened Files"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Quick Presets
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleQuickPreset('/var/log/system.log', 'macOS System Log')}
                >
                  /var/log/system.log
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleQuickPreset('/var/log/install.log', 'macOS Install Log')}
                >
                  /var/log/install.log
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleQuickPreset('./logs/app_workflow.log', 'App Workflow')}
                >
                  ./logs/app_workflow.log
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !filePath.trim()}>
              {loading ? <ButtonSpinner text="Opening & Parsing..." /> : 'Open Log File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
