import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ExternalLink, Copy, Check, FileCode, Tag } from 'lucide-react';

/**
 * Helper to highlight search query matches in any text node
 */
export function renderWithSearchHighlight(text: string, queries: (string | undefined)[]): React.ReactNode {
  const validQueries = queries
    .filter((q): q is string => Boolean(q && q.trim().length > 0))
    .map((q) => q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (validQueries.length === 0) return text;

  const regex = new RegExp(`(${validQueries.join('|')})`, 'gi');
  const parts = text.split(regex);

  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        className="search-match-mark"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// Token type enum
export type EntityType =
  | 'json'
  | 'xml'
  | 'url'
  | 'ip'
  | 'uuid'
  | 'kv'
  | 'path'
  | 'filepath'
  | 'quoted'
  | 'email';

export interface EntityMatch {
  index: number;
  length: number;
  text: string;
  type: EntityType;
  key?: string;
  val?: string;
}

// RFC 8259 Semantic JSON Tokenizer
export type JsonTokenType =
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'punctuation'
  | 'whitespace';

export interface JsonToken {
  type: JsonTokenType;
  value: string;
}

/**
 * Lexical JSON tokenizer parsing standard RFC 8259 JSON streams into typed syntax tokens.
 */
export function tokenizeJson(input: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // 1. Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      const start = i;
      while (i < len && (input[i] === ' ' || input[i] === '\t' || input[i] === '\n' || input[i] === '\r')) {
        i++;
      }
      tokens.push({ type: 'whitespace', value: input.slice(start, i) });
      continue;
    }

    // 2. Punctuation: { } [ ] : ,
    if (ch === '{' || ch === '}' || ch === '[' || ch === ']' || ch === ':' || ch === ',') {
      tokens.push({ type: 'punctuation', value: ch });
      i++;
      continue;
    }

    // 3. Strings: " ... "
    if (ch === '"') {
      const start = i;
      i++; // skip opening quote
      while (i < len) {
        if (input[i] === '\\') {
          i += 2; // skip escaped character
        } else if (input[i] === '"') {
          i++; // include closing quote
          break;
        } else {
          i++;
        }
      }
      const strVal = input.slice(start, i);

      // Lookahead to check if this string is followed by a colon ':' (meaning it's an object key)
      let peek = i;
      while (peek < len && (input[peek] === ' ' || input[peek] === '\t' || input[peek] === '\n' || input[peek] === '\r')) {
        peek++;
      }
      const isKey = peek < len && input[peek] === ':';

      tokens.push({
        type: isKey ? 'key' : 'string',
        value: strVal,
      });
      continue;
    }

    // 4. Numbers: e.g. -123.45e+6
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const start = i;
      if (input[i] === '-') i++;
      while (i < len && input[i] >= '0' && input[i] <= '9') i++;
      if (i < len && input[i] === '.') {
        i++;
        while (i < len && input[i] >= '0' && input[i] <= '9') i++;
      }
      if (i < len && (input[i] === 'e' || input[i] === 'E')) {
        i++;
        if (i < len && (input[i] === '+' || input[i] === '-')) i++;
        while (i < len && input[i] >= '0' && input[i] <= '9') i++;
      }
      tokens.push({ type: 'number', value: input.slice(start, i) });
      continue;
    }

    // 5. Booleans (true / false) and null
    if (input.startsWith('true', i)) {
      tokens.push({ type: 'boolean', value: 'true' });
      i += 4;
      continue;
    }
    if (input.startsWith('false', i)) {
      tokens.push({ type: 'boolean', value: 'false' });
      i += 5;
      continue;
    }
    if (input.startsWith('null', i)) {
      tokens.push({ type: 'null', value: 'null' });
      i += 4;
      continue;
    }

    // Fallback: any other character
    tokens.push({ type: 'punctuation', value: ch });
    i++;
  }

  return tokens;
}

/**
 * Scans text for balanced JSON objects `{ ... }` or arrays `[ ... ]`
 * Validates them with JSON.parse to guarantee true JSON syntax.
 */
export function findJsonBlocks(text: string): { start: number; end: number; raw: string }[] {
  const blocks: { start: number; end: number; raw: string }[] = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    const ch = text[i];
    if (ch === '{' || ch === '[') {
      const closing = ch === '{' ? '}' : ']';
      let depth = 0;
      let inString = false;
      let escape = false;
      const start = i;
      let foundEnd = -1;

      for (let j = i; j < len; j++) {
        const c = text[j];
        if (inString) {
          if (escape) {
            escape = false;
          } else if (c === '\\') {
            escape = true;
          } else if (c === '"') {
            inString = false;
          }
        } else {
          if (c === '"') {
            inString = true;
          } else if (c === ch) {
            depth++;
          } else if (c === closing) {
            depth--;
            if (depth === 0) {
              foundEnd = j + 1;
              break;
            }
          }
        }
      }

      if (foundEnd !== -1 && foundEnd - start >= 2) {
        const candidate = text.slice(start, foundEnd);
        // Ensure object has ':' or array has structure before running JSON.parse
        if (
          (ch === '{' && (candidate.includes(':') || candidate.trim() === '{}')) ||
          (ch === '[' && candidate.length > 2 && (candidate.includes(',') || candidate.includes(':') || candidate.includes('"')))
        ) {
          try {
            JSON.parse(candidate);
            blocks.push({ start, end: foundEnd, raw: candidate });
            i = foundEnd;
            continue;
          } catch {
            // Not valid JSON, continue scanning
          }
        }
      }
    }
    i++;
  }

  return blocks;
}

// ==========================================
// PROPER W3C XML TOKENIZER & PARSER
// ==========================================
export type XmlTokenType =
  | 'tag'
  | 'tagname'
  | 'attr'
  | 'string'
  | 'content'
  | 'comment'
  | 'cdata'
  | 'punctuation'
  | 'whitespace';

export interface XmlToken {
  type: XmlTokenType;
  value: string;
}

/**
 * Lexical XML tokenizer parsing standard XML into typed syntax tokens.
 */
export function tokenizeXml(input: string): XmlToken[] {
  const tokens: XmlToken[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    // 1. Comments: <!-- ... -->
    if (input.startsWith('<!--', i)) {
      const end = input.indexOf('-->', i + 4);
      const commentEnd = end !== -1 ? end + 3 : len;
      tokens.push({ type: 'comment', value: input.slice(i, commentEnd) });
      i = commentEnd;
      continue;
    }

    // 2. CDATA: <![CDATA[ ... ]]>
    if (input.startsWith('<![CDATA[', i)) {
      const end = input.indexOf(']]>', i + 9);
      const cdataEnd = end !== -1 ? end + 3 : len;
      tokens.push({ type: 'cdata', value: input.slice(i, cdataEnd) });
      i = cdataEnd;
      continue;
    }

    // 3. XML Declaration: <? ... ?>
    if (input.startsWith('<?', i)) {
      const end = input.indexOf('?>', i + 2);
      const declEnd = end !== -1 ? end + 2 : len;
      tokens.push({ type: 'tag', value: input.slice(i, declEnd) });
      i = declEnd;
      continue;
    }

    // 4. Tags: <tag ...> or </tag>
    if (input[i] === '<') {
      const isClosing = input.startsWith('</', i);
      const tagPrefix = isClosing ? '</' : '<';
      tokens.push({ type: 'tag', value: tagPrefix });
      i += tagPrefix.length;

      // Tag name: letters, digits, _, -, :, .
      const nameStart = i;
      while (i < len && /[a-zA-Z0-9_:.-]/.test(input[i])) {
        i++;
      }
      if (i > nameStart) {
        tokens.push({ type: 'tagname', value: input.slice(nameStart, i) });
      }

      // Attributes inside tag until > or />
      while (i < len && input[i] !== '>' && !input.startsWith('/>', i)) {
        // Whitespace
        if (/\s/.test(input[i])) {
          const wsStart = i;
          while (i < len && /\s/.test(input[i])) i++;
          tokens.push({ type: 'whitespace', value: input.slice(wsStart, i) });
          continue;
        }

        // Attribute name
        if (/[a-zA-Z0-9_:.-]/.test(input[i])) {
          const attrStart = i;
          while (i < len && /[a-zA-Z0-9_:.-]/.test(input[i])) i++;
          tokens.push({ type: 'attr', value: input.slice(attrStart, i) });

          // Optional '='
          let peek = i;
          while (peek < len && /\s/.test(input[peek])) peek++;
          if (peek < len && input[peek] === '=') {
            if (peek > i) {
              tokens.push({ type: 'whitespace', value: input.slice(i, peek) });
            }
            tokens.push({ type: 'punctuation', value: '=' });
            i = peek + 1;

            // Optional whitespace after '='
            let valPeek = i;
            while (valPeek < len && /\s/.test(input[valPeek])) valPeek++;
            if (valPeek > i) {
              tokens.push({ type: 'whitespace', value: input.slice(i, valPeek) });
              i = valPeek;
            }

            // Attribute value: quoted string "..." or '...'
            if (i < len && (input[i] === '"' || input[i] === "'")) {
              const quote = input[i];
              const strStart = i;
              i++;
              while (i < len && input[i] !== quote) {
                if (input[i] === '\\') i++;
                i++;
              }
              if (i < len) i++;
              tokens.push({ type: 'string', value: input.slice(strStart, i) });
            }
          }
          continue;
        }

        // Other character inside tag
        tokens.push({ type: 'punctuation', value: input[i] });
        i++;
      }

      // Tag closure: /> or >
      if (input.startsWith('/>', i)) {
        tokens.push({ type: 'tag', value: '/>' });
        i += 2;
      } else if (input[i] === '>') {
        tokens.push({ type: 'tag', value: '>' });
        i++;
      }
      continue;
    }

    // 5. Text content between tags (until next '<')
    const contentStart = i;
    while (i < len && input[i] !== '<') {
      i++;
    }
    if (i > contentStart) {
      tokens.push({ type: 'content', value: input.slice(contentStart, i) });
    }
  }

  return tokens;
}

/**
 * Scans text for complete XML fragments, elements, and documents.
 */
export function findXmlBlocks(text: string): { start: number; end: number; raw: string }[] {
  const blocks: { start: number; end: number; raw: string }[] = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    if (text[i] === '<') {
      // Check if tag begins
      if (i + 1 < len && /[a-zA-Z_?]/.test(text[i + 1])) {
        const start = i;
        let foundEnd = -1;

        const xmlRegex = /<\/?([a-zA-Z0-9_:.-]+)(?:\s+[^>]*?)?(\/?)>/g;
        xmlRegex.lastIndex = i;
        let m: RegExpExecArray | null;

        const openTags: string[] = [];

        while ((m = xmlRegex.exec(text)) !== null) {
          const isClosing = m[0].startsWith('</');
          const isSelfClosing = m[2] === '/' || m[0].endsWith('/>') || m[0].startsWith('<?');
          const tagName = m[1];

          if (isSelfClosing) {
            if (openTags.length === 0) {
              foundEnd = m.index + m[0].length;
              break;
            }
          } else if (isClosing) {
            if (openTags.length > 0 && openTags[openTags.length - 1] === tagName) {
              openTags.pop();
              if (openTags.length === 0) {
                foundEnd = m.index + m[0].length;
                break;
              }
            } else if (openTags.length === 0) {
              break;
            }
          } else {
            openTags.push(tagName);
          }

          if (m.index - start > 6000) break;
        }

        if (foundEnd !== -1 && foundEnd - start >= 4) {
          const candidate = text.slice(start, foundEnd);
          if (candidate.includes('<') && candidate.includes('>')) {
            blocks.push({ start, end: foundEnd, raw: candidate });
            i = foundEnd;
            continue;
          }
        }
      }
    }
    i++;
  }

  return blocks;
}

// Master pattern to identify special context entities
// 1. URL & Cloud / Storage / Protocol URIs:
//    - http(s), ws(s)
//    - s3:// (e.g. s3://company-invoices/2026/09/INV-9921.pdf)
//    - gs://, azure://, blob://
//    - ftp://, ftps://, file://
//    - postgres(ql)://, mysql://, redis://, mongodb://, amqp(s)://, kafka://, grpc://, git://
const URL_REGEX = /(?:https?|wss?|s3|gs|azure|blob|ftp|ftps|file|postgres|postgresql|mysql|redis|mongodb|amqp|amqps|kafka|grpc|git):\/\/[^\s<>"'()]+(?=[,\s;)'"]|$)/gi;
// 2. Email
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// 3. UUID
const UUID_REGEX = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;
// 4. IP with optional port (e.g. 192.168.1.1 or 127.0.0.1:8080)
const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::[0-9]{2,5})?\b/g;

// 5. Universal Key-Value pairs supporting:
//    - x=y, x = y, x="some val", x='val', x=123, status=active, foo.bar=baz, [x=y], (a=b)
const KV_REGEX = /(?:^|[\s,;([{\\/])([a-zA-Z0-9_$@.][a-zA-Z0-9_$@.-]*)\s*=\s*((?:"[^"]*")|(?:'[^']*')|(?:[^\s,;()[\]{}'"]+))/g;

// 6. Standalone JSON key-value pairs (e.g. "userId": 1024 or "status": "active") outside JSON objects
const JSON_KV_REGEX = /(?:^|[\s,;([{\\/])"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*((?:"[^"\\]*(?:\\.[^"\\]*)*")|(?:-?\d+(?:\.\d+)?)|(?:true|false|null))/g;

// 7. Common web/API paths like /api/v1/users or /oauth/token
const PATH_REGEX = /(?<=\s|^)(\/(?:api|v\d|oauth|webhook|auth|users|orders|items|services|health|metrics|ws)[a-zA-Z0-9_.~/-]*)(?=[,\s;:]|$)/gi;

// 8. Filepaths: Absolute Unix, Windows paths, and project relative files
const FILEPATH_REGEX = /(?:^|[\s,;([{"'])((?:\/(?:var|etc|usr|bin|home|tmp|opt|Users|Applications|Volumes)\/[a-zA-Z0-9_.~/-]+\.[a-zA-Z0-9]+)|(?:[a-zA-Z]:\\(?:[a-zA-Z0-9_.-]+\\)*[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)|(?:\.\/|\.\.\/|[a-zA-Z0-9_.-]+\/)[a-zA-Z0-9_.~/-]+\.(?:ts|tsx|js|jsx|json|log|txt|xml|yaml|yml|css|html|md|py|go|java|sh|conf|cfg|ini|toml|sql|csv))(?=[,\s;)'"]|$)/gi;

// 9. Quoted Strings "xyz" or 'xyz'
const QUOTED_REGEX = /(?:^|[\s,;([{\\/])("([^"\r\n\\]*(?:\\.[^"\r\n\\]*)*)"|'([^'\r\n\\]*(?:\\.[^'\r\n\\]*)*)')(?=[,\s;)\]}]|$)/g;

/**
 * Hook to keep the floating action bar pinned to the visible right edge of the viewport
 * when hovering over wide code containers that stretch horizontally beyond the screen,
 * dragging dynamically as the user scrolls left to right.
 */
function useStickyRightOffset(
  containerRef: React.RefObject<HTMLElement | null>,
  isHovered: boolean
) {
  const [rightOffset, setRightOffset] = useState<number>(0);

  const updateOffset = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const containerRect = el.getBoundingClientRect();

    // Find nearest horizontally scrollable ancestor or fallback to document element
    let scrollEl: HTMLElement | null = el.parentElement;
    while (scrollEl && scrollEl !== document.body) {
      const style = window.getComputedStyle(scrollEl);
      const ox = style.overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'overlay') {
        break;
      }
      scrollEl = scrollEl.parentElement;
    }

    const viewportRight = scrollEl && scrollEl !== document.body
      ? scrollEl.getBoundingClientRect().right
      : window.innerWidth;

    // Target right coordinate inside the viewport with 16px breathing room
    const targetRight = viewportRight - 16;

    if (containerRect.right > targetRight) {
      const rawOffset = containerRect.right - targetRight;
      // Ensure we do not push the floating bar past the left edge of the visible container
      const maxOffset = Math.max(0, containerRect.width - 220);
      const clamped = Math.min(rawOffset, maxOffset);
      setRightOffset(Math.max(0, Math.round(clamped)));
    } else {
      setRightOffset(0);
    }
  }, [containerRef]);

  useEffect(() => {
    if (!isHovered) {
      setRightOffset(0);
      return;
    }

    updateOffset();

    // Listen to scroll globally with capture so ANY scroll container triggers the update
    window.addEventListener('scroll', updateOffset, { passive: true, capture: true });
    window.addEventListener('resize', updateOffset, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateOffset, { capture: true });
      window.removeEventListener('resize', updateOffset);
    };
  }, [isHovered, updateOffset]);

  return { rightOffset, updateOffset };
}

/**
 * Interactive Chip component for parsed JSON blocks with HOVER-ONLY actions (constant container size!)
 */
export const JsonChip: React.FC<{
  rawJson: string;
  queries: (string | undefined)[];
}> = ({ rawJson, queries }) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [copied, setCopied] = useState(false);
  const [pretty, setPretty] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = React.useRef<any>(null);

  const { rightOffset, updateOffset } = useStickyRightOffset(containerRef, isHovered);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsHovered(true);
    updateOffset();
  };

  const handleMouseLeave = () => {
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 280); // 280ms grace period so floating toolbar NEVER vanishes when cursor moves to it
  };

  const tokens = useMemo(() => {
    let displayStr = rawJson;
    if (pretty) {
      try {
        displayStr = JSON.stringify(JSON.parse(rawJson), null, 2);
      } catch {
        // keep raw on parse failure
      }
    }
    return tokenizeJson(displayStr);
  }, [rawJson, pretty]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const textToCopy = pretty ? JSON.stringify(JSON.parse(rawJson), null, 2) : rawJson;
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      navigator.clipboard.writeText(rawJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleToggleFormat = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPretty((p) => !p);
  };

  const handleInspect = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('open-payload-inspector', {
        detail: {
          type: 'json',
          raw: rawJson,
          title: 'JSON Payload Inspector',
        },
      })
    );
  };

  return (
    <span
      ref={containerRef}
      className={`msg-chip-code-container msg-chip-json ${isHovered ? 'is-hovered' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseMove={updateOffset}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Floating Action Pill: HOVERS ON TOP OF TEXT ONLY, KEEPING DIV SIZE CONSTANT! */}
      <span
        className="msg-chip-floating-bar"
        style={{ right: rightOffset > 0 ? `${rightOffset}px` : undefined }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="msg-chip-json-tag">JSON</span>
        <button
          type="button"
          className="msg-chip-json-btn"
          onClick={handleToggleFormat}
          title={pretty ? 'Switch to compact inline view' : 'Format / pretty-print'}
        >
          {pretty ? 'Compact' : 'Format'}
        </button>
        <button
          type="button"
          className="msg-chip-json-btn"
          onClick={handleCopy}
          title="Copy JSON to clipboard"
        >
          {copied ? (
            <>
              <Check size={10} style={{ display: 'inline', marginRight: 2 }} />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={10} style={{ display: 'inline', marginRight: 2 }} />
              <span>Copy</span>
            </>
          )}
        </button>
        <button
          type="button"
          className="msg-chip-json-btn inspect-btn"
          onClick={handleInspect}
          title="Inspect in dedicated viewer modal (another div)"
        >
          <ExternalLink size={10} style={{ display: 'inline', marginRight: 2 }} />
          <span>Inspect</span>
        </button>
      </span>

      {/* Constant-size syntax colored body */}
      <span className={`msg-chip-code-content ${pretty ? 'formatted-view' : ''}`}>
        {tokens.map((tok, idx) => (
          <span key={idx} className={`json-tok-${tok.type}`}>
            {renderWithSearchHighlight(tok.value, queries)}
          </span>
        ))}
      </span>
    </span>
  );
};

/**
 * Interactive Chip component for parsed XML blocks with HOVER-ONLY actions (constant container size!)
 */
export const XmlChip: React.FC<{
  rawXml: string;
  queries: (string | undefined)[];
}> = ({ rawXml, queries }) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [copied, setCopied] = useState(false);
  const [pretty, setPretty] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = React.useRef<any>(null);

  const { rightOffset, updateOffset } = useStickyRightOffset(containerRef, isHovered);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsHovered(true);
    updateOffset();
  };

  const handleMouseLeave = () => {
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 280); // 280ms grace period so floating toolbar NEVER vanishes when cursor moves to it
  };

  const tokens = useMemo(() => {
    let displayStr = rawXml;
    if (pretty) {
      displayStr = formatXmlString(rawXml);
    }
    return tokenizeXml(displayStr);
  }, [rawXml, pretty]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const textToCopy = pretty ? formatXmlString(rawXml) : rawXml;
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      navigator.clipboard.writeText(rawXml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleToggleFormat = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPretty((p) => !p);
  };

  const handleInspect = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('open-payload-inspector', {
        detail: {
          type: 'xml',
          raw: rawXml,
          title: 'XML Document Inspector',
        },
      })
    );
  };

  return (
    <span
      ref={containerRef}
      className={`msg-chip-code-container msg-chip-xml ${isHovered ? 'is-hovered' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseMove={updateOffset}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Floating Action Pill: HOVERS ON TOP OF TEXT ONLY, KEEPING DIV SIZE CONSTANT! */}
      <span
        className="msg-chip-floating-bar"
        style={{ right: rightOffset > 0 ? `${rightOffset}px` : undefined }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="msg-chip-xml-tag">XML</span>
        <button
          type="button"
          className="msg-chip-json-btn"
          onClick={handleToggleFormat}
          title={pretty ? 'Switch to compact inline view' : 'Format / pretty-print XML'}
        >
          {pretty ? 'Compact' : 'Format'}
        </button>
        <button
          type="button"
          className="msg-chip-json-btn"
          onClick={handleCopy}
          title="Copy XML to clipboard"
        >
          {copied ? (
            <>
              <Check size={10} style={{ display: 'inline', marginRight: 2 }} />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={10} style={{ display: 'inline', marginRight: 2 }} />
              <span>Copy</span>
            </>
          )}
        </button>
        <button
          type="button"
          className="msg-chip-json-btn inspect-btn"
          onClick={handleInspect}
          title="Inspect in dedicated viewer modal (another div)"
        >
          <ExternalLink size={10} style={{ display: 'inline', marginRight: 2 }} />
          <span>Inspect</span>
        </button>
      </span>

      {/* Constant-size syntax colored body */}
      <span className={`msg-chip-code-content ${pretty ? 'formatted-view' : ''}`}>
        {tokens.map((tok, idx) => (
          <span key={idx} className={`xml-tok-${tok.type}`}>
            {renderWithSearchHighlight(tok.value, queries)}
          </span>
        ))}
      </span>
    </span>
  );
};

// Helper to format XML
function formatXmlString(xml: string): string {
  let formatted = '';
  let pad = 0;
  const reg = /(>)(<)(\/*)/g;
  const xmlStr = xml.replace(reg, '$1\r\n$2$3');
  xmlStr.split('\r\n').forEach((node) => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/)) {
      if (pad !== 0) pad -= 1;
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

/**
 * Finds all context entities and tokens within a string.
 */
export function findEntitiesInMessage(text: string): EntityMatch[] {
  if (!text || text.length === 0) return [];

  const matches: EntityMatch[] = [];

  const addMatch = (match: EntityMatch) => {
    const overlap = matches.some(
      (m) =>
        (match.index >= m.index && match.index < m.index + m.length) ||
        (match.index + match.length > m.index && match.index + match.length <= m.index + m.length)
    );
    if (!overlap) {
      matches.push(match);
    }
  };

  // 1. Balanced RFC 8259 JSON objects and arrays (PRIORITY)
  const jsonBlocks = findJsonBlocks(text);
  for (const block of jsonBlocks) {
    addMatch({
      index: block.start,
      length: block.end - block.start,
      text: block.raw,
      type: 'json',
    });
  }

  // 2. Balanced XML elements and tags (PRIORITY)
  const xmlBlocks = findXmlBlocks(text);
  for (const block of xmlBlocks) {
    addMatch({
      index: block.start,
      length: block.end - block.start,
      text: block.raw,
      type: 'xml',
    });
  }

  // 3. URLs
  let m: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((m = URL_REGEX.exec(text)) !== null) {
    let cleanUrl = m[0];
    while (/[.,;:)]$/.test(cleanUrl)) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    addMatch({
      index: m.index,
      length: cleanUrl.length,
      text: cleanUrl,
      type: 'url',
    });
  }

  // 4. Email addresses
  EMAIL_REGEX.lastIndex = 0;
  while ((m = EMAIL_REGEX.exec(text)) !== null) {
    addMatch({
      index: m.index,
      length: m[0].length,
      text: m[0],
      type: 'email',
    });
  }

  // 5. UUIDs
  UUID_REGEX.lastIndex = 0;
  while ((m = UUID_REGEX.exec(text)) !== null) {
    addMatch({
      index: m.index,
      length: m[0].length,
      text: m[0],
      type: 'uuid',
    });
  }

  // 6. IP Addresses
  IP_REGEX.lastIndex = 0;
  while ((m = IP_REGEX.exec(text)) !== null) {
    addMatch({
      index: m.index,
      length: m[0].length,
      text: m[0],
      type: 'ip',
    });
  }

  // 7. Standalone JSON key-value pairs ("key": "val" or "count": 123)
  JSON_KV_REGEX.lastIndex = 0;
  while ((m = JSON_KV_REGEX.exec(text)) !== null) {
    const fullMatch = m[0];
    const key = `"${m[1]}"`;
    const val = m[2];
    const keyPos = fullMatch.indexOf(key);
    const matchStart = m.index + (keyPos >= 0 ? keyPos : 0);
    const valPos = fullMatch.lastIndexOf(val);
    const matchLength = (valPos >= 0 ? valPos + val.length : fullMatch.length) - (keyPos >= 0 ? keyPos : 0);

    addMatch({
      index: matchStart,
      length: matchLength,
      text: text.slice(matchStart, matchStart + matchLength),
      type: 'kv',
      key,
      val,
    });
  }

  // 8. Universal Key-Value pairs (x=y, x = y, status=active, etc.)
  KV_REGEX.lastIndex = 0;
  while ((m = KV_REGEX.exec(text)) !== null) {
    const fullMatch = m[0];
    const key = m[1];
    let val = m[2];

    if (!val.startsWith('"') && !val.startsWith("'")) {
      while (/[.,;:)]$/.test(val)) {
        val = val.slice(0, -1);
      }
    }

    if (!val) continue;

    const keyPos = fullMatch.indexOf(key);
    const matchStart = m.index + (keyPos >= 0 ? keyPos : 0);
    const eqPos = fullMatch.indexOf('=', keyPos + key.length);
    const valPos = fullMatch.indexOf(val, eqPos + 1);
    const matchLength = valPos >= 0 ? (valPos + val.length - keyPos) : (key.length + 1 + val.length);

    addMatch({
      index: matchStart,
      length: matchLength,
      text: text.slice(matchStart, matchStart + matchLength),
      type: 'kv',
      key,
      val,
    });
  }

  // 9. Filepaths (Linux, Windows, Relative)
  FILEPATH_REGEX.lastIndex = 0;
  while ((m = FILEPATH_REGEX.exec(text)) !== null) {
    const rawPath = m[1];
    const pathPos = m[0].indexOf(rawPath);
    const matchStart = m.index + (pathPos >= 0 ? pathPos : 0);
    addMatch({
      index: matchStart,
      length: rawPath.length,
      text: rawPath,
      type: 'filepath',
    });
  }

  // 10. Web/API Endpoints
  PATH_REGEX.lastIndex = 0;
  while ((m = PATH_REGEX.exec(text)) !== null) {
    addMatch({
      index: m.index,
      length: m[0].length,
      text: m[0],
      type: 'path',
    });
  }

  // 11. Quoted Strings ("xyz" or 'xyz')
  QUOTED_REGEX.lastIndex = 0;
  while ((m = QUOTED_REGEX.exec(text)) !== null) {
    const full = m[1];
    const quotePos = m[0].indexOf(full);
    const matchStart = m.index + (quotePos >= 0 ? quotePos : 0);
    addMatch({
      index: matchStart,
      length: full.length,
      text: full,
      type: 'quoted',
    });
  }

  // Sort by appearance index
  matches.sort((a, b) => a.index - b.index);
  return matches;
}

/**
 * Highlights special context entities within a message string:
 * - JSON structures with full RFC 8259 tokenizer & HOVER-ONLY floating actions (constant size!)
 * - XML structures with full W3C tokenizer & HOVER-ONLY floating actions (constant size!)
 * - URLs (clickable pill with icon)
 * - Filepaths (interactive badge with file icon)
 * - Quoted terms "xyz" (dedicated token chip)
 * - IP addresses & ports
 * - UUIDs & hashes
 * - Key=Value pairs (including x=y, x = y, status=active)
 * - Standalone JSON key-values
 * - API & file endpoints
 * - Email addresses
 * Along with search query highlights
 */
export function renderRichMessageContext(
  text: string,
  queries: (string | undefined)[] = []
): React.ReactNode {
  if (!text || text.length === 0) return null;

  const matches = findEntitiesInMessage(text);
  if (matches.length === 0) {
    return renderWithSearchHighlight(text, queries);
  }

  const elements: React.ReactNode[] = [];
  let cursor = 0;

  for (const entity of matches) {
    // Leading plain text
    if (entity.index > cursor) {
      const plainText = text.slice(cursor, entity.index);
      elements.push(
        <React.Fragment key={`text-${cursor}`}>
          {renderWithSearchHighlight(plainText, queries)}
        </React.Fragment>
      );
    }

    // Entity chip rendering
    if (entity.type === 'json') {
      elements.push(
        <JsonChip
          key={`json-${entity.index}`}
          rawJson={entity.text}
          queries={queries}
        />
      );
    } else if (entity.type === 'xml') {
      elements.push(
        <XmlChip
          key={`xml-${entity.index}`}
          rawXml={entity.text}
          queries={queries}
        />
      );
    } else if (entity.type === 'filepath') {
      elements.push(
        <span
          key={`filepath-${entity.index}`}
          className="msg-chip msg-chip-filepath"
          title={`File path: ${entity.text}`}
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(entity.text);
          }}
        >
          <FileCode size={11} className="msg-chip-icon" />
          <span>{renderWithSearchHighlight(entity.text, queries)}</span>
        </span>
      );
    } else if (entity.type === 'quoted') {
      elements.push(
        <span
          key={`quoted-${entity.index}`}
          className="msg-chip msg-chip-quoted"
          title={`Quoted String: ${entity.text}`}
        >
          {renderWithSearchHighlight(entity.text, queries)}
        </span>
      );
    } else if (entity.type === 'url') {
      elements.push(
        <a
          key={`url-${entity.index}`}
          href={entity.text}
          target="_blank"
          rel="noopener noreferrer"
          className="msg-chip msg-chip-url"
          title={`Open URL: ${entity.text}`}
          onClick={(e) => e.stopPropagation()}
        >
          <span>{renderWithSearchHighlight(entity.text, queries)}</span>
          <ExternalLink size={10} className="msg-chip-icon" />
        </a>
      );
    } else if (entity.type === 'email') {
      elements.push(
        <a
          key={`email-${entity.index}`}
          href={`mailto:${entity.text}`}
          className="msg-chip msg-chip-email"
          title={`Email: ${entity.text}`}
          onClick={(e) => e.stopPropagation()}
        >
          <span>{renderWithSearchHighlight(entity.text, queries)}</span>
        </a>
      );
    } else if (entity.type === 'ip') {
      elements.push(
        <span
          key={`ip-${entity.index}`}
          className="msg-chip msg-chip-ip"
          title={`IP Address: ${entity.text}`}
        >
          {renderWithSearchHighlight(entity.text, queries)}
        </span>
      );
    } else if (entity.type === 'uuid') {
      elements.push(
        <span
          key={`uuid-${entity.index}`}
          className="msg-chip msg-chip-uuid"
          title={`ID / Hash: ${entity.text}`}
        >
          {renderWithSearchHighlight(entity.text, queries)}
        </span>
      );
    } else if (entity.type === 'kv' && entity.key && entity.val) {
      const isJsonStyle = entity.text.includes(':');
      elements.push(
        <span
          key={`kv-${entity.index}`}
          className="msg-chip msg-chip-kv"
          title={`Key-Value: ${entity.key}${isJsonStyle ? ':' : '='}${entity.val}`}
        >
          <span className={isJsonStyle ? 'json-tok-key' : 'msg-chip-kv-key'}>
            {renderWithSearchHighlight(entity.key, queries)}
          </span>
          <span className={isJsonStyle ? 'json-tok-punctuation' : 'msg-chip-kv-eq'}>
            {isJsonStyle ? ':' : '='}
          </span>
          <span className={isJsonStyle ? 'json-tok-string' : 'msg-chip-kv-val'}>
            {renderWithSearchHighlight(entity.val, queries)}
          </span>
        </span>
      );
    } else if (entity.type === 'path') {
      elements.push(
        <span
          key={`path-${entity.index}`}
          className="msg-chip msg-chip-path"
          title={`Endpoint / Path: ${entity.text}`}
        >
          {renderWithSearchHighlight(entity.text, queries)}
        </span>
      );
    } else {
      elements.push(
        <span key={`entity-${entity.index}`} className="msg-chip">
          {renderWithSearchHighlight(entity.text, queries)}
        </span>
      );
    }

    cursor = entity.index + entity.length;
  }

  // Trailing plain text
  if (cursor < text.length) {
    const trailingText = text.slice(cursor);
    elements.push(
      <React.Fragment key={`text-end-${cursor}`}>
        {renderWithSearchHighlight(trailingText, queries)}
      </React.Fragment>
    );
  }

  return <>{elements}</>;
}
