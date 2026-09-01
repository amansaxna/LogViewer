import React, { useState } from 'react';
import { X, FileText, AlertCircle, ClipboardPaste } from 'lucide-react';

interface PasteLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasteSubmit: (text: string, name?: string) => Promise<void>;
}

export const PasteLogsModal: React.FC<PasteLogsModalProps> = ({
  isOpen,
  onClose,
  onPasteSubmit,
}) => {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await onPasteSubmit(text, name.trim() || undefined);
      setText('');
      setName('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to analyze pasted logs');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) setText(clipText);
    } catch {
      // clipboard permission denied or not available
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '800px', width: '90vw' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={20} color="var(--accent-primary)" />
            <h2 className="modal-title">Paste & Analyze Logs</h2>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Session Label (Optional)
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleQuickPaste}
                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
              >
                <ClipboardPaste size={13} />
                Paste from Clipboard
              </button>
            </div>

            <input
              type="text"
              className="input-field"
              placeholder="e.g. Staging Crash Dump 00:42"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Log Lines
              </label>
              <textarea
                className="input-field"
                rows={14}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                  resize: 'vertical',
                }}
                placeholder="Paste raw log lines here... Supports structured flat files, traces, or unformatted logs."
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !text.trim()}>
              {loading ? 'Analyzing...' : 'Analyze Logs'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
