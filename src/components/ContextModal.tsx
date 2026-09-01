import React, { useEffect, useState, useRef } from 'react';
import { X, AlignLeft, Maximize2, Minimize2, WrapText, Target, Copy, Check } from 'lucide-react';
import { renderSyntaxColoredLine } from '../utils/coloredLogRenderer.tsx';
import { ModalLoadingState } from './Loaders.tsx';

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
  const [selectedLineNumbers, setSelectedLineNumbers] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const targetLineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastClickedLineRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen && sourceId && lineNumber) {
      setLoading(true);
      fetch(`/api/logs/context?sourceId=${encodeURIComponent(sourceId)}&lineNumber=${lineNumber}&radius=${radius}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.lines) {
            setLines(data.lines);
            // Default select the target line
            setSelectedLineNumbers(new Set([lineNumber]));
            lastClickedLineRef.current = lineNumber;
          }
        })
        .catch((err) => console.error('Failed to fetch context:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, sourceId, lineNumber, radius]);

  // Scroll to target line whenever lines finish loading
  useEffect(() => {
    if (!loading && lines.length > 0) {
      const timer = setTimeout(() => {
        if (targetLineRef.current) {
          targetLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, lines]);

  const scrollToTarget = () => {
    targetLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleToggleLine = (num: number, shiftKey = false) => {
    setSelectedLineNumbers((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClickedLineRef.current !== null) {
        const start = Math.min(lastClickedLineRef.current, num);
        const end = Math.max(lastClickedLineRef.current, num);
        lines.forEach((l) => {
          if (l.number >= start && l.number <= end) {
            next.add(l.number);
          }
        });
      } else {
        if (next.has(num)) {
          next.delete(num);
        } else {
          next.add(num);
        }
        lastClickedLineRef.current = num;
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedLineNumbers(new Set(lines.map((l) => l.number)));
  };

  const handleSelectTargetOnly = () => {
    if (lineNumber) setSelectedLineNumbers(new Set([lineNumber]));
  };

  const handleClearSelection = () => {
    setSelectedLineNumbers(new Set());
  };

  const handleCopySelected = async () => {
    if (selectedLineNumbers.size === 0) return;
    const selectedContent = lines
      .filter((l) => selectedLineNumbers.has(l.number))
      .map((l) => l.content)
      .join('\n');

    try {
      await navigator.clipboard.writeText(selectedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy selected lines to clipboard:', err);
    }
  };

  if (!isOpen || !lineNumber) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{
          width: isFullScreen ? '98vw' : '85vw',
          maxWidth: isFullScreen ? '98vw' : '1400px',
          height: isFullScreen ? '95vh' : '82vh',
          maxHeight: isFullScreen ? '95vh' : '82vh',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.2s ease',
          backgroundColor: '#080c14',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '12px 18px',
            background: 'var(--bg-sidebar)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlignLeft size={20} color="var(--accent-primary)" />
            <h2 className="modal-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Log File Context</span>
              <span
                style={{
                  background: '#facc15',
                  color: '#000000',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 4,
                  letterSpacing: '0.02em',
                }}
              >
                Line #{lineNumber}
              </span>
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
              {lines.length} lines loaded
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Jump to Target Button */}
            <button
              className="btn-secondary"
              onClick={scrollToTarget}
              style={{
                height: 28,
                padding: '0 10px',
                fontSize: '0.78rem',
                gap: 5,
                backgroundColor: 'rgba(250, 204, 21, 0.15)',
                color: '#facc15',
                borderColor: 'rgba(250, 204, 21, 0.4)',
                fontWeight: 600,
              }}
              title="Center view on target line"
            >
              <Target size={13} />
              Jump to Target
            </button>

            {/* Radius Selectors */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Radius:</span>
              {[10, 25, 50, 100].map((r) => (
                <button
                  key={r}
                  className={`search-modifier-btn ${radius === r ? 'active' : ''}`}
                  onClick={() => setRadius(r)}
                  style={{ padding: '3px 8px', height: 26 }}
                >
                  ±{r}
                </button>
              ))}
            </div>

            {/* Quick Selection Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Select:</span>
              <button
                className="search-modifier-btn"
                onClick={handleSelectAll}
                style={{ padding: '2px 7px', height: 26, fontSize: '0.74rem' }}
                title="Select all loaded lines"
              >
                All
              </button>
              <button
                className="search-modifier-btn"
                onClick={handleSelectTargetOnly}
                style={{ padding: '2px 7px', height: 26, fontSize: '0.74rem' }}
                title="Select only target line"
              >
                Target
              </button>
              {selectedLineNumbers.size > 0 && (
                <button
                  className="search-modifier-btn"
                  onClick={handleClearSelection}
                  style={{ padding: '2px 7px', height: 26, fontSize: '0.74rem' }}
                  title="Clear all selected lines"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Copy Selected Button */}
            <button
              className="btn-primary"
              onClick={handleCopySelected}
              disabled={selectedLineNumbers.size === 0}
              style={{
                height: 28,
                padding: '0 12px',
                fontSize: '0.78rem',
                gap: 5,
                fontWeight: 600,
                backgroundColor: copied ? 'rgba(34, 197, 94, 0.2)' : undefined,
                borderColor: copied ? '#22c55e' : undefined,
                color: copied ? '#22c55e' : undefined,
              }}
              title="Copy only selected log lines to clipboard"
            >
              {copied ? (
                <>
                  <Check size={13} />
                  <span>Copied {selectedLineNumbers.size} Line{selectedLineNumbers.size > 1 ? 's' : ''}!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy Selected ({selectedLineNumbers.size})</span>
                </>
              )}
            </button>

            {/* Line Wrap Toggle */}
            <button
              className={`search-modifier-btn ${wrapLines ? 'active' : ''}`}
              onClick={() => setWrapLines(!wrapLines)}
              title={wrapLines ? 'Disable word wrap (single line)' : 'Enable word wrap'}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', height: 26 }}
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

        {/* Body with Token & ANSI Syntax Colors */}
        <div
          ref={scrollContainerRef}
          className="modal-body"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '8px 0',
            background: '#080c14',
          }}
        >
          {loading ? (
            <ModalLoadingState
              message={`Loading Context Window around #${lineNumber}...`}
              subtext="Fetching adjacent log lines from source on disk"
            />
          ) : (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                minWidth: 'max-content',
                width: '100%',
              }}
            >
              {lines.map((line) => {
                const isTarget = line.isTarget;
                const isSelected = selectedLineNumbers.has(line.number);

                return (
                  <div
                    key={line.number}
                    ref={isTarget ? targetLineRef : undefined}
                    onClick={(e) => handleToggleLine(line.number, e.shiftKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      padding: isTarget ? '6px 16px' : '2px 16px',
                      backgroundColor: isTarget
                        ? 'rgba(2, 132, 199, 0.35)'
                        : isSelected
                        ? 'rgba(56, 189, 248, 0.14)'
                        : 'transparent',
                      borderLeft: isTarget
                        ? '6px solid #facc15'
                        : isSelected
                        ? '6px solid #38bdf8'
                        : '6px solid transparent',
                      boxShadow: isTarget
                        ? 'inset 0 0 16px rgba(56, 189, 248, 0.25), 0 0 10px rgba(250, 204, 21, 0.2)'
                        : isSelected
                        ? 'inset 0 0 10px rgba(56, 189, 248, 0.15)'
                        : 'none',
                      margin: isTarget ? '4px 0' : '0',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    title={`Click to toggle line #${line.number} (Shift+Click for range selection)`}
                  >
                    {/* Line selection checkbox & Line number gutter */}
                    <span
                      style={{
                        width: 90,
                        minWidth: 90,
                        color: isTarget ? '#facc15' : isSelected ? '#38bdf8' : '#64748b',
                        userSelect: 'none',
                        flexShrink: 0,
                        textAlign: 'right',
                        paddingRight: 14,
                        fontWeight: isTarget || isSelected ? 700 : 400,
                        lineHeight: 1.6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 6,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleLine(line.number, (e.nativeEvent as MouseEvent).shiftKey);
                        }}
                        style={{
                          cursor: 'pointer',
                          accentColor: '#38bdf8',
                          width: 13,
                          height: 13,
                          flexShrink: 0,
                        }}
                        title={`Select line #${line.number} for copying`}
                      />

                      {isTarget && (
                        <span
                          style={{
                            background: '#facc15',
                            color: '#000000',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '1px 3px',
                            borderRadius: 2,
                            lineHeight: 1.1,
                          }}
                        >
                          TARGET
                        </span>
                      )}
                      <span>{line.number}</span>
                    </span>

                    {/* Syntax & ANSI colored line content */}
                    <div
                      style={{
                        flex: 1,
                        lineHeight: 1.6,
                        whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
                        wordBreak: wrapLines ? 'break-word' : 'normal',
                      }}
                    >
                      {renderSyntaxColoredLine(line.content || ' ')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '10px 20px',
            background: 'var(--bg-sidebar)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#facc15' }} />
            <span>Target line <strong>#{lineNumber}</strong> is prominently highlighted. Click lines or checkboxes to select logs.</span>
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn-primary"
              onClick={handleCopySelected}
              disabled={selectedLineNumbers.size === 0}
              style={{
                height: 32,
                padding: '0 14px',
                fontSize: '0.82rem',
                gap: 6,
                backgroundColor: copied ? 'rgba(34, 197, 94, 0.2)' : undefined,
                borderColor: copied ? '#22c55e' : undefined,
                color: copied ? '#22c55e' : undefined,
                fontWeight: 600,
              }}
              title="Copy selected logs to clipboard"
            >
              {copied ? (
                <>
                  <Check size={14} />
                  <span>Copied {selectedLineNumbers.size} Selected Line{selectedLineNumbers.size > 1 ? 's' : ''}!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Selected ({selectedLineNumbers.size} lines)</span>
                </>
              )}
            </button>
            <button className="btn-secondary" onClick={onClose} style={{ padding: '6px 18px', height: 32 }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
