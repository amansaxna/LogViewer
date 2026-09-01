import React, { useEffect, useState } from 'react';
import { X, AlignLeft, Maximize2, Minimize2, WrapText } from 'lucide-react';

interface ContextLine {
  number: number;
  content: string;
  isTarget: boolean;
}

interface ContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceId: string;
  lineNumber: number | null;
}

export const ContextModal: React.FC<ContextModalProps> = ({
  isOpen,
  onClose,
  sourceId,
  lineNumber,
}) => {
  const [lines, setLines] = useState<ContextLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState(25);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [wrapLines, setWrapLines] = useState(false);

  useEffect(() => {
    if (isOpen && sourceId && lineNumber) {
      setLoading(true);
      fetch(`/api/logs/context?sourceId=${encodeURIComponent(sourceId)}&lineNumber=${lineNumber}&radius=${radius}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.lines) {
            setLines(data.lines);
          }
        })
        .catch((err) => console.error('Failed to fetch context:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, sourceId, lineNumber, radius]);

  if (!isOpen || !lineNumber) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{
          width: isFullScreen ? '98vw' : '85vw',
          maxWidth: isFullScreen ? '98vw' : '1200px',
          height: isFullScreen ? '95vh' : '80vh',
          maxHeight: isFullScreen ? '95vh' : '80vh',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlignLeft size={20} color="var(--accent-primary)" />
            <h2 className="modal-title" style={{ fontSize: '1.05rem' }}>
              Log File Context (Around Line #{lineNumber})
            </h2>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-surface)',
                padding: '2px 8px',
                borderRadius: 12,
                border: '1px solid var(--border-subtle)',
              }}
            >
              Showing {lines.length} lines
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Radius Selectors */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Radius:</span>
              {[10, 25, 50, 100].map((r) => (
                <button
                  key={r}
                  className={`search-modifier-btn ${radius === r ? 'active' : ''}`}
                  onClick={() => setRadius(r)}
                  style={{ padding: '3px 8px' }}
                >
                  ±{r}
                </button>
              ))}
            </div>

            {/* Line Wrap Toggle */}
            <button
              className={`search-modifier-btn ${wrapLines ? 'active' : ''}`}
              onClick={() => setWrapLines(!wrapLines)}
              title={wrapLines ? 'Disable word wrap (keep single line)' : 'Enable word wrap'}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
            >
              <WrapText size={13} />
              <span>Wrap</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              className="btn-icon"
              onClick={() => setIsFullScreen(!isFullScreen)}
              title={isFullScreen ? 'Restore window size' : 'Expand full screen'}
              style={{ width: 30, height: 30 }}
            >
              {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            {/* Close */}
            <button
              className="btn-icon"
              onClick={onClose}
              title="Close modal"
              style={{ width: 30, height: 30 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body with full length / full height */}
        <div
          className="modal-body"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 0,
            background: 'var(--bg-app)',
          }}
        >
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading context lines...
            </div>
          ) : (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.84rem',
                minWidth: 'max-content',
                width: '100%',
              }}
            >
              {lines.map((line) => (
                <div
                  key={line.number}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '4px 16px',
                    backgroundColor: line.isTarget ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                    borderLeft: line.isTarget ? '4px solid var(--accent-primary)' : '4px solid transparent',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                  }}
                >
                  <span
                    style={{
                      width: 60,
                      color: line.isTarget ? 'var(--accent-primary)' : 'var(--text-muted)',
                      userSelect: 'none',
                      flexShrink: 0,
                      textAlign: 'right',
                      paddingRight: 16,
                      fontWeight: line.isTarget ? 700 : 400,
                      lineHeight: 1.6,
                    }}
                  >
                    {line.number}
                  </span>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
                      wordBreak: wrapLines ? 'break-word' : 'normal',
                      overflowX: 'visible',
                      color: line.isTarget ? '#38bdf8' : 'var(--text-primary)',
                      fontWeight: line.isTarget ? 600 : 400,
                      lineHeight: 1.6,
                      flex: 1,
                    }}
                  >
                    {line.content || ' '}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '10px 20px', background: 'var(--bg-card)' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
            Tip: Target line is highlighted in cyan. Use radius buttons to load more surrounding lines.
          </span>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '6px 16px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
