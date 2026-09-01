import React, { useState, useMemo } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';

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
export type EntityType = 'json' | 'url' | 'ip' | 'uuid' | 'kv' | 'path' | 'email';

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

// Master pattern to identify special context entities
// 1. URL: http(s) or ws(s)
const URL_REGEX = /https?:\/\/[^\s<>"'()]+|wss?:\/\/[^\s<>"'()]+/gi;
// 2. Email
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// 3. UUID
const UUID_REGEX = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;
// 4. IP with optional port (e.g. 192.168.1.1 or 127.0.0.1:8080)
const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::[0-9]{2,5})?\b/g;

// 5. Key-Value pairs supporting:
//    - x=y, x = y, x="some val", x='val', x=123, status=active, foo.bar=baz, [x=y]
const KV_REGEX = /(?:^|[\s,;([{\\/])([a-zA-Z0-9_$@.][a-zA-Z0-9_$@.-]*)\s*=\s*((?:"[^"]*")|(?:'[^']*')|(?:[^\s,;()[\]{}'"]+))/g;

// 6. Standalone JSON key-value pairs (e.g. "userId": 1024 or "status": "active") outside JSON objects
const JSON_KV_REGEX = /(?:^|[\s,;([{\\/])"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*((?:"[^"\\]*(?:\\.[^"\\]*)*")|(?:-?\d+(?:\.\d+)?)|(?:true|false|null))/g;

// 7. Common web/API paths like /api/v1/users or /oauth/token
const PATH_REGEX = /(?<=\s|^)(\/(?:api|v\d|oauth|webhook|auth|users|orders|items|services|health|metrics|ws)[a-zA-Z0-9_.~/-]*)(?=[,\s;:]|$)/gi;

/**
 * Interactive Chip component for parsed JSON blocks
 */
export const JsonChip: React.FC<{
  rawJson: string;
  queries: (string | undefined)[];
}> = ({ rawJson, queries }) => {
  const [copied, setCopied] = useState(false);
  const [pretty, setPretty] = useState(false);

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

  return (
    <span className="msg-chip msg-chip-json" onClick={(e) => e.stopPropagation()}>
      <span className="msg-chip-json-header">
        <span className="msg-chip-json-tag">JSON</span>
        <button
          type="button"
          className="msg-chip-json-btn"
          onClick={handleToggleFormat}
          title={pretty ? 'Switch to compact JSON' : 'Format / pretty-print JSON'}
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
      </span>
      <span className="msg-chip-json-content">
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

  // 2. URLs
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

  // 3. Email addresses
  EMAIL_REGEX.lastIndex = 0;
  while ((m = EMAIL_REGEX.exec(text)) !== null) {
    addMatch({
      index: m.index,
      length: m[0].length,
      text: m[0],
      type: 'email',
    });
  }

  // 4. UUIDs
  UUID_REGEX.lastIndex = 0;
  while ((m = UUID_REGEX.exec(text)) !== null) {
    addMatch({
      index: m.index,
      length: m[0].length,
      text: m[0],
      type: 'uuid',
    });
  }

  // 5. IP Addresses
  IP_REGEX.lastIndex = 0;
  while ((m = IP_REGEX.exec(text)) !== null) {
    addMatch({
      index: m.index,
      length: m[0].length,
      text: m[0],
      type: 'ip',
    });
  }

  // 6. Standalone JSON key-value pairs ("key": "val" or "count": 123)
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

  // 7. Key-Value pairs (x=y, x = y, status=active, etc.)
  KV_REGEX.lastIndex = 0;
  while ((m = KV_REGEX.exec(text)) !== null) {
    const fullMatch = m[0];
    const key = m[1];
    let val = m[2];

    // Strip trailing punctuation from unquoted values
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

  // 8. Paths
  PATH_REGEX.lastIndex = 0;
  while ((m = PATH_REGEX.exec(text)) !== null) {
    addMatch({
      index: m.index,
      length: m[0].length,
      text: m[0],
      type: 'path',
    });
  }

  // Sort by appearance index
  matches.sort((a, b) => a.index - b.index);
  return matches;
}

/**
 * Highlights special context entities within a message string:
 * - JSON structures with full RFC 8259 tokenizer & interactive formatting/copy
 * - URLs (clickable pill with icon)
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
