import { LogEntry } from '../types.ts';

/**
 * Query AST Node Types
 */
export type QueryNode =
  | { type: 'AND'; left: QueryNode; right: QueryNode }
  | { type: 'OR'; left: QueryNode; right: QueryNode }
  | { type: 'NOT'; child: QueryNode }
  | {
      type: 'FIELD';
      field: string;
      operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | ':' | 'contains';
      value: string | number;
      isRegex?: boolean;
    }
  | { type: 'TERM'; value: string; isRegex?: boolean };

/**
 * Tokenize a search query string into tokens
 */
interface Token {
  type: 'AND' | 'OR' | 'NOT' | 'LPAREN' | 'RPAREN' | 'FIELD' | 'TERM';
  field?: string;
  operator?: '=' | '!=' | '>' | '>=' | '<' | '<=' | ':' | 'contains';
  value: string;
}

export function tokenizeQuery(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const str = query.trim();

  while (i < str.length) {
    const char = str[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    // Check for logical keywords or symbols
    if (str.slice(i, i + 3).toUpperCase() === 'AND' && (i + 3 >= str.length || /\s|\(/.test(str[i + 3]))) {
      tokens.push({ type: 'AND', value: 'AND' });
      i += 3;
      continue;
    }
    if (str.slice(i, i + 2) === '&&') {
      tokens.push({ type: 'AND', value: 'AND' });
      i += 2;
      continue;
    }

    if (str.slice(i, i + 2).toUpperCase() === 'OR' && (i + 2 >= str.length || /\s|\(/.test(str[i + 2]))) {
      tokens.push({ type: 'OR', value: 'OR' });
      i += 2;
      continue;
    }
    if (str.slice(i, i + 2) === '||') {
      tokens.push({ type: 'OR', value: 'OR' });
      i += 2;
      continue;
    }

    if (str.slice(i, i + 3).toUpperCase() === 'NOT' && (i + 3 >= str.length || /\s|\(/.test(str[i + 3]))) {
      tokens.push({ type: 'NOT', value: 'NOT' });
      i += 3;
      continue;
    }
    if (char === '!') {
      tokens.push({ type: 'NOT', value: 'NOT' });
      i += 1;
      continue;
    }

    // Field or Term extraction
    // Check for quoted strings: "..." or '...'
    if (char === '"' || char === "'") {
      const quote = char;
      let val = '';
      i++;
      while (i < str.length && str[i] !== quote) {
        if (str[i] === '\\' && i + 1 < str.length) {
          val += str[i + 1];
          i += 2;
        } else {
          val += str[i];
          i++;
        }
      }
      i++; // Skip closing quote
      tokens.push({ type: 'TERM', value: val });
      continue;
    }

    // Read word until whitespace, quote, or parenthesis
    let word = '';
    while (i < str.length && !/\s|\(|\)/.test(str[i])) {
      word += str[i];
      i++;
    }

    // Check if word contains a field separator like field:val, field>=val, field>val, field<=val, field<val, field!=val, field=val
    const fieldMatch = word.match(/^([a-zA-Z0-9_.-]+)(>=|<=|!=|:|=|>|<)(.*)$/);
    if (fieldMatch) {
      const field = fieldMatch[1].toLowerCase();
      const rawOp = fieldMatch[2];
      let val = fieldMatch[3];

      // If value is empty, read next token
      if (!val) {
        // Skip whitespace
        while (i < str.length && /\s/.test(str[i])) i++;
        if (str[i] === '"' || str[i] === "'") {
          const q = str[i];
          i++;
          while (i < str.length && str[i] !== q) {
            val += str[i];
            i++;
          }
          i++;
        } else {
          while (i < str.length && !/\s|\(|\)/.test(str[i])) {
            val += str[i];
            i++;
          }
        }
      }

      // Strip quotes if wrapped
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }

      const op = rawOp === ':' ? ':' : (rawOp as any);
      tokens.push({
        type: 'FIELD',
        field,
        operator: op,
        value: val,
      });
      continue;
    }

    // Check if next characters are an operator with whitespace (e.g. elapsed > 1000)
    let peekIdx = i;
    while (peekIdx < str.length && /\s/.test(str[peekIdx])) peekIdx++;
    const nextOpMatch = str.slice(peekIdx).match(/^(>=|<=|!=|:|=|>|<)/);

    if (nextOpMatch && /^[a-zA-Z0-9_.-]+$/.test(word)) {
      const rawOp = nextOpMatch[1];
      i = peekIdx + rawOp.length;
      while (i < str.length && /\s/.test(str[i])) i++;

      let val = '';
      if (str[i] === '"' || str[i] === "'") {
        const q = str[i];
        i++;
        while (i < str.length && str[i] !== q) {
          val += str[i];
          i++;
        }
        i++;
      } else {
        while (i < str.length && !/\s|\(|\)/.test(str[i])) {
          val += str[i];
          i++;
        }
      }

      const op = rawOp === ':' ? ':' : (rawOp as any);
      tokens.push({
        type: 'FIELD',
        field: word.toLowerCase(),
        operator: op,
        value: val,
      });
      continue;
    }

    tokens.push({ type: 'TERM', value: word });
  }

  return tokens;
}

/**
 * Parse tokens into an Abstract Syntax Tree (AST)
 * Grammar with standard precedence: OR < AND < NOT < Primitives
 */
export function parseQuery(query: string): QueryNode | null {
  if (!query || !query.trim()) return null;
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return null;

  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(type?: string): Token {
    const tok = tokens[pos];
    if (type && tok?.type !== type) {
      throw new Error(`Expected token ${type} but got ${tok?.type}`);
    }
    pos++;
    return tok;
  }

  function parseExpression(): QueryNode {
    return parseOr();
  }

  function parseOr(): QueryNode {
    let left = parseAnd();

    while (pos < tokens.length && peek()?.type === 'OR') {
      consume('OR');
      const right = parseAnd();
      left = { type: 'OR', left, right };
    }

    return left;
  }

  function parseAnd(): QueryNode {
    let left = parseNot();

    while (pos < tokens.length && (peek()?.type === 'AND' || (peek()?.type !== 'OR' && peek()?.type !== 'RPAREN'))) {
      if (peek()?.type === 'AND') {
        consume('AND');
      }
      const right = parseNot();
      left = { type: 'AND', left, right };
    }

    return left;
  }

  function parseNot(): QueryNode {
    if (peek()?.type === 'NOT') {
      consume('NOT');
      const child = parseNot();
      return { type: 'NOT', child };
    }
    return parsePrimary();
  }

  function parsePrimary(): QueryNode {
    const tok = peek();
    if (!tok) {
      return { type: 'TERM', value: '' };
    }

    if (tok.type === 'LPAREN') {
      consume('LPAREN');
      const node = parseExpression();
      if (peek()?.type === 'RPAREN') {
        consume('RPAREN');
      }
      return node;
    }

    if (tok.type === 'FIELD') {
      consume('FIELD');
      return {
        type: 'FIELD',
        field: tok.field!,
        operator: tok.operator || ':',
        value: tok.value,
      };
    }

    if (tok.type === 'TERM') {
      consume('TERM');
      return {
        type: 'TERM',
        value: tok.value,
      };
    }

    // Fallback consume
    consume();
    return { type: 'TERM', value: tok.value };
  }

  try {
    return parseExpression();
  } catch {
    // If complex grammar fails, fallback to simple term matching
    return { type: 'TERM', value: query.trim() };
  }
}

/**
 * Evaluates a LogEntry against a parsed Query AST
 */
export function evaluateAst(entry: LogEntry, node: QueryNode | null, caseSensitive: boolean = false): boolean {
  if (!node) return true;

  switch (node.type) {
    case 'AND':
      return evaluateAst(entry, node.left, caseSensitive) && evaluateAst(entry, node.right, caseSensitive);

    case 'OR':
      return evaluateAst(entry, node.left, caseSensitive) || evaluateAst(entry, node.right, caseSensitive);

    case 'NOT':
      return !evaluateAst(entry, node.child, caseSensitive);

    case 'FIELD': {
      const field = node.field.toLowerCase();
      let targetVal: any = undefined;

      if (field === 'level' || field === 'severity') targetVal = entry.level;
      else if (field === 'workflow' || field === 'wf') targetVal = entry.workflow;
      else if (field === 'operation' || field === 'op') targetVal = entry.operation;
      else if (field === 'correlation' || field === 'correlationid' || field === 'corr' || field === 'cid') targetVal = entry.correlationId;
      else if (field === 'pid') targetVal = entry.pid;
      else if (field === 'tid') targetVal = entry.tid;
      else if (field === 'line' || field === 'linenumber') targetVal = entry.lineNumber;
      else if (field === 'msg' || field === 'message') targetVal = entry.message;
      else if (field === 'duration' || field === 'elapsed') {
        targetVal = entry.durationMs !== undefined ? entry.durationMs : undefined;
      } else {
        // Search in message for custom key-value pairs (e.g., status=500, user_id=9821, endpoint=/api)
        const match = entry.message.match(new RegExp(`(?:^|\\s|\\[|\\{)${field}[:=]([^\\s,\\]\\}]+)`, 'i'));
        if (match) {
          targetVal = match[1].replace(/^["']|["']$/g, '');
        } else {
          targetVal = '';
        }
      }

      if (targetVal === undefined || targetVal === null) return false;

      const expectedStr = String(node.value);
      const actualStr = String(targetVal);

      // Numeric comparisons
      const expectedNum = parseFloat(expectedStr);
      const actualNum = parseFloat(actualStr);
      const isBothNum = !isNaN(expectedNum) && !isNaN(actualNum);

      switch (node.operator) {
        case '>':
          return isBothNum ? actualNum > expectedNum : actualStr > expectedStr;
        case '>=':
          return isBothNum ? actualNum >= expectedNum : actualStr >= expectedStr;
        case '<':
          return isBothNum ? actualNum < expectedNum : actualStr < expectedStr;
        case '<=':
          return isBothNum ? actualNum <= expectedNum : actualStr <= expectedStr;
        case '!=':
          return caseSensitive
            ? actualStr !== expectedStr
            : actualStr.toLowerCase() !== expectedStr.toLowerCase();
        case '=':
        case ':':
        case 'contains':
        default:
          return caseSensitive
            ? actualStr.includes(expectedStr)
            : actualStr.toLowerCase().includes(expectedStr.toLowerCase());
      }
    }

    case 'TERM': {
      if (!node.value) return true;
      const term = caseSensitive ? node.value : node.value.toLowerCase();
      const rawText = caseSensitive ? entry.raw : entry.raw.toLowerCase();
      return rawText.includes(term);
    }

    default:
      return true;
  }
}

/**
 * Main query entry point
 */
export function evaluateQuery(entry: LogEntry, queryStr: string, caseSensitive: boolean = false): boolean {
  if (!queryStr || !queryStr.trim()) return true;
  const ast = parseQuery(queryStr);
  return evaluateAst(entry, ast, caseSensitive);
}
