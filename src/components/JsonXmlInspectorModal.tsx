import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Code2, Search, WrapText, Palette, ChevronDown, ChevronRight, ListTree } from 'lucide-react';
import { tokenizeJson, tokenizeXml } from '../utils/messageContextHighlighter.tsx';
import { copyWithToast } from '../utils/copyNotifier.ts';

export interface InspectorPayload {
  type: 'json' | 'xml';
  raw: string;
  title?: string;
}

interface JsonXmlInspectorModalProps {
  payload: InspectorPayload | null;
  onClose: () => void;
}

export interface XmlNode {
  tag: string;
  attributes?: Record<string, string>;
  children?: XmlNode[];
  textContent?: string;
}

export const JsonXmlInspectorModal: React.FC<JsonXmlInspectorModalProps> = ({
  payload,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);
  const [isFormatted, setIsFormatted] = useState(true);
  const [showColors, setShowColors] = useState(true);
  const [viewMode, setViewMode] = useState<'code' | 'tree'>('code');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandAllKey, setExpandAllKey] = useState(0);

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

  const parsedJsonObj = useMemo(() => {
    if (!payload || payload.type !== 'json') return null;
    try {
      return JSON.parse(payload.raw);
    } catch {
      return null;
    }
  }, [payload]);

  const parsedXmlTree = useMemo(() => {
    if (!payload || payload.type !== 'xml') return null;
    return parseXmlToTree(payload.raw);
  }, [payload]);

  const parsedTokens = useMemo(() => {
    if (!payload) return null;
    if (payload.type === 'json') {
      return { type: 'json' as const, list: tokenizeJson(formattedContent) };
    }
    if (payload.type === 'xml') {
      return { type: 'xml' as const, list: tokenizeXml(formattedContent) };
    }
    return null;
  }, [payload, formattedContent]);

  if (!payload) return null;

  const handleCopy = async (text: string) => {
    try {
      copyWithToast(text, payload.type.toUpperCase());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const lines = formattedContent.split('\n');
  const hasTreeMode = (payload.type === 'json' && parsedJsonObj !== null) || (payload.type === 'xml' && parsedXmlTree !== null);

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
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Code2 size={20} color="var(--accent-primary)" />
            <h2 className="modal-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{payload.title || (payload.type === 'json' ? 'JSON Payload Inspector' : 'XML Document Inspector')}</span>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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

            {/* Tree vs Code View mode (JSON and XML) */}
            {hasTreeMode && (
              <div className="view-mode-segmented">
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === 'code' ? 'active' : ''}`}
                  onClick={() => setViewMode('code')}
                  title="Raw Line-Numbered Code View"
                >
                  <Code2 size={12} />
                  <span>Code</span>
                </button>
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === 'tree' ? 'active' : ''}`}
                  onClick={() => setViewMode('tree')}
                  title="Interactive Collapsible Values Tree"
                >
                  <ListTree size={12} />
                  <span>Collapsible Tree</span>
                </button>
              </div>
            )}

            {/* Syntax Colors Toggle */}
            <button
              type="button"
              className={`search-modifier-btn ${showColors ? 'active' : ''}`}
              onClick={() => setShowColors(!showColors)}
              style={{ padding: '3px 8px', height: 28, fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: 4 }}
              title={showColors ? 'Disable Syntax Colors (Plain text)' : 'Enable Vibrant Syntax Colors'}
            >
              <Palette size={13} />
              <span>Colors</span>
            </button>

            {/* Format toggle (only in code mode) */}
            {viewMode === 'code' && (
              <button
                type="button"
                className={`search-modifier-btn ${isFormatted ? 'active' : ''}`}
                onClick={() => setIsFormatted(!isFormatted)}
                style={{ padding: '3px 8px', height: 28, fontSize: '0.76rem' }}
                title={isFormatted ? 'Switch to Compact Minified view' : 'Format / Pretty-print'}
              >
                {isFormatted ? 'Formatted' : 'Compact'}
              </button>
            )}

            {/* Word wrap toggle */}
            {viewMode === 'code' && (
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
            )}

            {/* Expand / Collapse All in Tree mode */}
            {viewMode === 'tree' && (
              <button
                type="button"
                className="search-modifier-btn"
                onClick={() => setExpandAllKey((k) => k + 1)}
                style={{ padding: '3px 8px', height: 28, fontSize: '0.76rem' }}
                title="Expand or reset all tree branches"
              >
                Reset Tree
              </button>
            )}

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
        {viewMode === 'tree' && hasTreeMode ? (
          <div
            key={expandAllKey}
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px 20px',
              background: 'var(--bg-app)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.84rem',
            }}
          >
            {payload.type === 'json' && parsedJsonObj !== null && (
              <JsonTreeNode
                value={parsedJsonObj}
                searchQuery={searchQuery}
                showColors={showColors}
                isLast={true}
              />
            )}
            {payload.type === 'xml' && parsedXmlTree !== null && (
              <XmlTreeNode
                node={parsedXmlTree}
                searchQuery={searchQuery}
                showColors={showColors}
              />
            )}
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: 0,
              background: 'var(--bg-app)',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
            }}
          >
            {/* Line Numbers Gutter */}
            <div
              style={{
                padding: '14px 12px 14px 16px',
                borderRight: '1px solid var(--border-subtle)',
                background: 'var(--bg-sidebar)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                lineHeight: 1.6,
                color: 'var(--text-muted)',
                textAlign: 'right',
                userSelect: 'none',
                flexShrink: 0,
                minWidth: 44,
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
                padding: '14px 18px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                lineHeight: 1.6,
                color: 'var(--text-primary)',
                whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
                wordBreak: wrapLines ? 'break-word' : 'normal',
                overflowX: 'auto',
              }}
            >
              {showColors && parsedTokens?.type === 'json' ? (
                <div>
                  {parsedTokens.list.map((tok, idx) => (
                    <span key={idx} className={`json-tok-${tok.type}`}>
                      {renderWithHighlight(tok.value, searchQuery)}
                    </span>
                  ))}
                </div>
              ) : showColors && parsedTokens?.type === 'xml' ? (
                <div>
                  {parsedTokens.list.map((tok, idx) => (
                    <span key={idx} className={`xml-tok-${tok.type}`}>
                      {renderWithHighlight(tok.value, searchQuery)}
                    </span>
                  ))}
                </div>
              ) : (
                <div>{renderWithHighlight(formattedContent, searchQuery)}</div>
              )}
            </div>
          </div>
        )}

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

// ==========================================
// COLLAPSIBLE JSON TREE NODE
// ==========================================
interface JsonTreeNodeProps {
  name?: string;
  value: any;
  isLast?: boolean;
  level?: number;
  searchQuery?: string;
  showColors?: boolean;
}

const JsonTreeNode: React.FC<JsonTreeNodeProps> = ({
  name,
  value,
  isLast = true,
  level = 0,
  searchQuery = '',
  showColors = true,
}) => {
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const [isExpanded, setIsExpanded] = useState(true);

  if (isObject) {
    const keys = Object.keys(value);
    const isEmpty = keys.length === 0;
    const countLabel = isArray ? `${keys.length} items` : `${keys.length} keys`;
    const openBracket = isArray ? '[' : '{';
    const closeBracket = isArray ? ']' : '}';

    return (
      <div style={{ paddingLeft: level > 0 ? 18 : 0, lineHeight: 1.6 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: isEmpty ? 'default' : 'pointer',
            userSelect: 'none',
          }}
          onClick={() => !isEmpty && setIsExpanded(!isExpanded)}
        >
          {!isEmpty ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 16,
                height: 16,
                color: 'var(--text-muted)',
              }}
            >
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
          ) : (
            <span style={{ width: 16 }} />
          )}

          {name !== undefined && (
            <span
              className={showColors ? 'json-tok-key' : ''}
              style={{
                color: showColors ? '#38bdf8' : 'var(--text-primary)',
                fontWeight: 600,
              }}
            >
              "{name}":{' '}
            </span>
          )}

          <span style={{ color: 'var(--text-muted)' }}>{openBracket}</span>

          {!isExpanded && !isEmpty && (
            <span
              style={{
                fontSize: '0.72rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                padding: '0 6px',
                borderRadius: 4,
                margin: '0 4px',
              }}
            >
              ... {countLabel}
            </span>
          )}

          {!isExpanded && (
            <span style={{ color: 'var(--text-muted)' }}>
              {closeBracket}{!isLast ? ',' : ''}
            </span>
          )}
        </div>

        {isExpanded && !isEmpty && (
          <div style={{ borderLeft: '1px dashed rgba(148, 163, 184, 0.2)', marginLeft: 7 }}>
            {keys.map((k, idx) => (
              <JsonTreeNode
                key={k}
                name={isArray ? undefined : k}
                value={value[k]}
                isLast={idx === keys.length - 1}
                level={level + 1}
                searchQuery={searchQuery}
                showColors={showColors}
              />
            ))}
          </div>
        )}

        {isExpanded && !isEmpty && (
          <div style={{ paddingLeft: 18, color: 'var(--text-muted)' }}>
            {closeBracket}{!isLast ? ',' : ''}
          </div>
        )}
      </div>
    );
  }

  // Primitive value
  const valType = value === null ? 'null' : typeof value;
  let valClass = 'json-tok-string';
  let formattedVal = JSON.stringify(value);
  if (valType === 'number') valClass = 'json-tok-number';
  else if (valType === 'boolean') valClass = 'json-tok-boolean';
  else if (valType === 'null' || value === null) {
    valClass = 'json-tok-null';
    formattedVal = 'null';
  }

  return (
    <div
      style={{
        paddingLeft: level > 0 ? 18 : 0,
        lineHeight: 1.6,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span style={{ width: 16 }} />
      {name !== undefined && (
        <span
          className={showColors ? 'json-tok-key' : ''}
          style={{
            color: showColors ? '#38bdf8' : 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          "{name}":{' '}
        </span>
      )}
      <span
        className={showColors ? valClass : ''}
        style={{ color: showColors ? undefined : 'var(--text-primary)' }}
      >
        {renderWithHighlight(formattedVal, searchQuery)}
      </span>
      {!isLast && <span style={{ color: 'var(--text-muted)' }}>,</span>}
    </div>
  );
};

// ==========================================
// COLLAPSIBLE XML TREE NODE
// ==========================================
interface XmlTreeNodeProps {
  node: XmlNode;
  level?: number;
  searchQuery?: string;
  showColors?: boolean;
}

export const XmlTreeNode: React.FC<XmlTreeNodeProps> = ({
  node,
  level = 0,
  searchQuery = '',
  showColors = true,
}) => {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const hasText = Boolean(node.textContent && node.textContent.trim().length > 0);
  const [isExpanded, setIsExpanded] = useState(true);

  const attrEntries = node.attributes ? Object.entries(node.attributes) : [];

  const renderAttributes = () => {
    if (attrEntries.length === 0) return null;
    return (
      <>
        {attrEntries.map(([k, v]) => (
          <span key={k} style={{ marginLeft: 6 }}>
            <span
              className={showColors ? 'xml-tok-attr' : ''}
              style={{ color: showColors ? undefined : 'var(--text-secondary)' }}
            >
              {renderWithHighlight(k, searchQuery)}
            </span>
            <span className={showColors ? 'xml-tok-punctuation' : ''}>=</span>
            <span
              className={showColors ? 'xml-tok-string' : ''}
              style={{ color: showColors ? undefined : 'var(--text-primary)' }}
            >
              "{renderWithHighlight(v, searchQuery)}"
            </span>
          </span>
        ))}
      </>
    );
  };

  // 1. Leaf node with only text content (<tag attr="...">text</tag>)
  if (!hasChildren && hasText) {
    return (
      <div
        style={{
          paddingLeft: level > 0 ? 18 : 0,
          lineHeight: 1.6,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ width: 16, flexShrink: 0 }} />
        <span>
          <span className={showColors ? 'xml-tok-tag' : ''}>&lt;</span>
          <span className={showColors ? 'xml-tok-tagname' : ''} style={{ fontWeight: 600 }}>
            {renderWithHighlight(node.tag, searchQuery)}
          </span>
          {renderAttributes()}
          <span className={showColors ? 'xml-tok-tag' : ''}>&gt;</span>
          <span
            className={showColors ? 'xml-tok-content' : ''}
            style={{ margin: '0 4px', color: showColors ? undefined : 'var(--text-primary)' }}
          >
            {renderWithHighlight(node.textContent!, searchQuery)}
          </span>
          <span className={showColors ? 'xml-tok-tag' : ''}>&lt;/</span>
          <span className={showColors ? 'xml-tok-tagname' : ''} style={{ fontWeight: 600 }}>
            {node.tag}
          </span>
          <span className={showColors ? 'xml-tok-tag' : ''}>&gt;</span>
        </span>
      </div>
    );
  }

  // 2. Self-closing or empty leaf node (<tag attr="..." />)
  if (!hasChildren && !hasText) {
    return (
      <div
        style={{
          paddingLeft: level > 0 ? 18 : 0,
          lineHeight: 1.6,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ width: 16, flexShrink: 0 }} />
        <span>
          <span className={showColors ? 'xml-tok-tag' : ''}>&lt;</span>
          <span className={showColors ? 'xml-tok-tagname' : ''} style={{ fontWeight: 600 }}>
            {renderWithHighlight(node.tag, searchQuery)}
          </span>
          {renderAttributes()}
          <span className={showColors ? 'xml-tok-tag' : ''}> /&gt;</span>
        </span>
      </div>
    );
  }

  // 3. Container Node with child XML elements
  const childrenCount = node.children!.length;
  const countLabel = childrenCount === 1 ? '1 child' : `${childrenCount} children`;

  return (
    <div style={{ paddingLeft: level > 0 ? 18 : 0, lineHeight: 1.6 }}>
      {/* Container Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          cursor: 'pointer',
          userSelect: 'none',
          flexWrap: 'wrap',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>

        <span>
          <span className={showColors ? 'xml-tok-tag' : ''}>&lt;</span>
          <span className={showColors ? 'xml-tok-tagname' : ''} style={{ fontWeight: 600 }}>
            {renderWithHighlight(node.tag, searchQuery)}
          </span>
          {renderAttributes()}
          <span className={showColors ? 'xml-tok-tag' : ''}>&gt;</span>
        </span>

        {/* Collapsed summary pill */}
        {!isExpanded && (
          <span
            style={{
              fontSize: '0.72rem',
              background: 'rgba(192, 132, 252, 0.15)',
              color: '#c084fc',
              border: '1px solid rgba(192, 132, 252, 0.3)',
              padding: '0 6px',
              borderRadius: 4,
              margin: '0 4px',
              fontWeight: 600,
            }}
          >
            ... {countLabel}
          </span>
        )}

        {!isExpanded && (
          <span>
            <span className={showColors ? 'xml-tok-tag' : ''}>&lt;/</span>
            <span className={showColors ? 'xml-tok-tagname' : ''} style={{ fontWeight: 600 }}>
              {node.tag}
            </span>
            <span className={showColors ? 'xml-tok-tag' : ''}>&gt;</span>
          </span>
        )}
      </div>

      {/* Children list with indentation guide line */}
      {isExpanded && (
        <div style={{ borderLeft: '1px dashed rgba(148, 163, 184, 0.2)', marginLeft: 7 }}>
          {hasText && (
            <div
              style={{
                paddingLeft: 18,
                lineHeight: 1.6,
                color: showColors ? undefined : 'var(--text-primary)',
              }}
              className={showColors ? 'xml-tok-content' : ''}
            >
              {renderWithHighlight(node.textContent!, searchQuery)}
            </div>
          )}
          {node.children!.map((child, idx) => (
            <XmlTreeNode
              key={idx}
              node={child}
              level={level + 1}
              searchQuery={searchQuery}
              showColors={showColors}
            />
          ))}
        </div>
      )}

      {/* Closing tag */}
      {isExpanded && (
        <div style={{ paddingLeft: 18 }}>
          <span className={showColors ? 'xml-tok-tag' : ''}>&lt;/</span>
          <span className={showColors ? 'xml-tok-tagname' : ''} style={{ fontWeight: 600 }}>
            {node.tag}
          </span>
          <span className={showColors ? 'xml-tok-tag' : ''}>&gt;</span>
        </div>
      )}
    </div>
  );
};

// ==========================================
// PARSE XML TO HIERARCHICAL TREE
// ==========================================
export function parseXmlToTree(xmlText: string): XmlNode | null {
  if (!xmlText || !xmlText.trim()) return null;
  try {
    const parser = new DOMParser();
    let doc = parser.parseFromString(xmlText, 'text/xml');
    let hasError = !!doc.querySelector('parsererror');

    if (hasError) {
      const cleanXml = xmlText.replace(/<\?xml[^>]*\?>/i, '').trim();
      const wrappedDoc = parser.parseFromString(`<root>${cleanXml}</root>`, 'text/xml');
      if (!wrappedDoc.querySelector('parsererror')) {
        doc = wrappedDoc;
        hasError = false;
      } else {
        return null;
      }
    }

    const rootElement = doc.documentElement;
    if (!rootElement) return null;

    function domNodeToXmlNode(elem: Element): XmlNode {
      const attributes: Record<string, string> = {};
      if (elem.attributes) {
        for (let i = 0; i < elem.attributes.length; i++) {
          const attr = elem.attributes[i];
          attributes[attr.name] = attr.value;
        }
      }

      const children: XmlNode[] = [];
      let textContent = '';

      for (let i = 0; i < elem.childNodes.length; i++) {
        const child = elem.childNodes[i];
        if (child.nodeType === 1 /* ELEMENT_NODE */) {
          children.push(domNodeToXmlNode(child as Element));
        } else if (child.nodeType === 3 /* TEXT_NODE */ || child.nodeType === 4 /* CDATA_SECTION_NODE */) {
          const val = child.nodeValue?.trim();
          if (val) {
            textContent += (textContent ? ' ' : '') + val;
          }
        }
      }

      return {
        tag: elem.tagName,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
        children: children.length > 0 ? children : undefined,
        textContent: textContent || undefined,
      };
    }

    if (rootElement.tagName.toLowerCase() === 'root' && hasError === false) {
      const childNodes: XmlNode[] = [];
      for (let i = 0; i < rootElement.children.length; i++) {
        childNodes.push(domNodeToXmlNode(rootElement.children[i]));
      }
      if (childNodes.length === 1) {
        return childNodes[0];
      }
      return {
        tag: 'root',
        children: childNodes,
      };
    }

    return domNodeToXmlNode(rootElement);
  } catch {
    return null;
  }
}

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
