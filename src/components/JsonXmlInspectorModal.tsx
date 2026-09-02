import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Code2, Search, WrapText, Minimize2 } from 'lucide-react';
import { tokenizeJson } from '../utils/messageContextHighlighter.tsx';

export interface InspectorPayload {
  type: 'json' | 'xml';
  raw: string;
  title?: string;
}

interface JsonXmlInspectorModalProps {
  payload: InspectorPayload | null;
  onClose: () => void;
}

export const JsonXmlInspectorModal: React.FC<JsonXmlInspectorModalProps> = ({
  payload,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);
  const [isFormatted, setIsFormatted] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const formattedContent = useMemo(() => {
    if (!payload) return '';
    if (payload.type === 'json') {
      try {
        const parsed = JSON.parse(payload.raw);
        return isFormatted ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
      } catch {
        return payload.raw;
      }
    } else {
      // XML formatting
      if (!isFormatted) {
        return payload.raw.replace(/>\s+</g, '><').trim();
      }
      return formatXml(payload.raw);
    }
  }, [payload, isFormatted]);

  const tokens = useMemo(() => {
    if (!payload) return [];
    if (payload.type === 'json') {
      return tokenizeJson(formattedContent);
    }
    return null;
  }, [payload, formattedContent]);

  if (!payload) return null;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const lines = formattedContent.split('\n');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{
          width: '88vw',
          maxWidth: '1200px',
          height: '84vh',
          maxHeight: '84vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-app)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '12px 18px',
            background: 'var(--bg-sidebar)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Code2 size={20} color="var(--accent-primary)" />
            <h2 className="modal-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{payload.title || (payload.type === 'json' ? 'JSON Inspector' : 'XML Inspector')}</span>
              <span
                style={{
                  background: payload.type === 'json' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(192, 132, 252, 0.2)',
                  color: payload.type === 'json' ? '#38bdf8' : '#c084fc',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: `1px solid ${payload.type === 'json' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(192, 132, 252, 0.4)'}`,
                  letterSpacing: '0.05em',
                }}
              >
                {payload.type.toUpperCase()}
              </span>
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {lines.length} lines • {new Blob([payload.raw]).size} bytes
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Search within payload */}
            <div
              className="search-container"
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 6,
                height: 28,
                padding: '2px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Search size={12} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Find in payload..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.76rem',
                  outline: 'none',
                  width: 140,
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Format toggle */}
            <button
              type="button"
              className={`search-modifier-btn ${isFormatted ? 'active' : ''}`}
              onClick={() => setIsFormatted(!isFormatted)}
              style={{ padding: '3px 8px', height: 28, fontSize: '0.76rem' }}
              title={isFormatted ? 'Switch to Compact Minified view' : 'Format / Pretty-print'}
            >
              {isFormatted ? 'Formatted' : 'Compact'}
            </button>

            {/* Word wrap toggle */}
            <button
              type="button"
              className={`search-modifier-btn ${wrapLines ? 'active' : ''}`}
              onClick={() => setWrapLines(!wrapLines)}
              style={{ padding: '3px 8px', height: 28, fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: 4 }}
              title="Toggle line wrapping"
            >
              <WrapText size={13} />
              <span>Wrap</span>
            </button>

            {/* Copy button */}
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleCopy(formattedContent)}
              style={{
                height: 28,
                padding: '0 12px',
                fontSize: '0.78rem',
                gap: 5,
                backgroundColor: copied ? 'rgba(34, 197, 94, 0.2)' : undefined,
                borderColor: copied ? '#22c55e' : undefined,
                color: copied ? '#22c55e' : undefined,
              }}
              title="Copy payload to clipboard"
            >
              {copied ? (
                <>
                  <Check size={13} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Close button */}
            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              style={{ width: 28, height: 28 }}
              title="Close Inspector (Esc)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Modal Code Body */}
        <div
          className="modal-body"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 0,
            background: 'var(--bg-app)',
            display: 'flex',
          }}
        >
          {/* Line Numbers Gutter */}
          <div
            style={{
              padding: '12px 14px 12px 8px',
              borderRight: '1px solid var(--border-subtle)',
              background: 'var(--bg-sidebar)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
              lineHeight: 1.6,
              color: 'var(--text-muted)',
              textAlign: 'right',
              userSelect: 'none',
              minWidth: 48,
            }}
          >
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Code View Area */}
          <div
            style={{
              flex: 1,
              padding: '12px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
              wordBreak: wrapLines ? 'break-word' : 'normal',
              overflowX: 'auto',
            }}
          >
            {payload.type === 'json' && tokens ? (
              <div>
                {tokens.map((tok, idx) => (
                  <span key={idx} className={`json-tok-${tok.type}`}>
                    {renderWithHighlight(tok.value, searchQuery)}
                  </span>
                ))}
              </div>
            ) : (
              <div>
                {renderXmlHighlighted(formattedContent, searchQuery)}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '10px 18px',
            background: 'var(--bg-sidebar)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Hover and click any JSON or XML element to view formatted payload. Press <strong>Esc</strong> to dismiss.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleCopy(payload.raw)}
              style={{ fontSize: '0.8rem', padding: '5px 14px' }}
              title="Copy original unformatted text"
            >
              Copy Raw Minified
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={onClose}
              style={{ fontSize: '0.8rem', padding: '5px 18px' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper to format XML cleanly
function formatXml(xml: string): string {
  let formatted = '';
  let pad = 0;
  const reg = /(>)(<)(\/*)/g;
  const xmlStr = xml.replace(reg, '$1\r\n$2$3');
  xmlStr.split('\r\n').forEach((node) => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/)) {
      if (pad !== 0) {
        pad -= 1;
      }
    } else if (node.match(/^<\w[^>]*[^/]>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }

    formatted += '  '.repeat(pad) + node + '\r\n';
    pad += indent;
  });
  return formatted.trim();
}

// Search highlighter for inspector
function renderWithHighlight(text: string, query: string): React.ReactNode {
  if (!query || !query.trim()) return text;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    regex.test(p) ? (
      <mark key={i} className="search-match-mark">
        {p}
      </mark>
    ) : (
      p
    )
  );
}

// Basic XML syntax highlighter for inspector
function renderXmlHighlighted(xml: string, query: string): React.ReactNode {
  const parts = xml.split(/(<[^>]+>)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('<')) {
      return (
        <span key={idx} className="xml-tok-tag">
          {renderWithHighlight(part, query)}
        </span>
      );
    }
    return (
      <span key={idx} className="xml-tok-content">
        {renderWithHighlight(part, query)}
      </span>
    );
  });
}
