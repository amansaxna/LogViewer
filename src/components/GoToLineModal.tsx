import React, { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';

interface GoToLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  maxLines: number;
  onGoToLine: (lineNumber: number) => void;
}

export const GoToLineModal: React.FC<GoToLineModalProps> = ({
  isOpen,
  onClose,
  maxLines,
  onGoToLine,
}) => {
  const [lineStr, setLineStr] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(lineStr, 10);
    if (!isNaN(num) && num > 0) {
      onGoToLine(num);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{ maxWidth: '380px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ padding: '12px 16px' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Go to Line</span>
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
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Enter line number between 1 and {maxLines.toLocaleString()}:
            </label>
            <input
              type="number"
              min={1}
              max={maxLines}
              className="input-field"
              placeholder={`e.g. ${Math.min(100, maxLines)}`}
              value={lineStr}
              onChange={(e) => setLineStr(e.target.value)}
              autoFocus
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowRight size={14} />
                Jump
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
