import React from 'react';

// ANSI escape code mappings to CSS hex colors
const ANSI_COLOR_MAP: Record<string, string> = {
  '30': '#1e293b', // black
  '31': '#f87171', // red
  '32': '#4ade80', // green
  '33': '#facc15', // yellow
  '34': '#60a5fa', // blue
  '35': '#c084fc', // magenta
  '36': '#22d3ee', // cyan
  '37': '#f8fafc', // white
  '90': '#64748b', // bright black/gray
  '91': '#ef4444', // bright red
  '92': '#22c55e', // bright green
  '93': '#fbbf24', // bright yellow
  '94': '#38bdf8', // bright blue
  '95': '#a855f7', // bright magenta
  '96': '#06b6d4', // bright cyan
  '97': '#ffffff', // bright white
};

/**
 * Parses and renders ANSI escape sequences (e.g. \u001b[31mRed\u001b[0m) into colored React spans.
 */
export function renderAnsiText(text: string): React.ReactNode {
  // Regex strictly matching ANSI escape sequences starting with ESC (\u001b, \x1b, \e)
  const ansiRegex = /(?:\u001b|\\u001b|\\x1b|\x1b|\\033|\\e)\[\??(\d+(?:;\d+)*)m/g;

  if (!ansiRegex.test(text)) {
    return null; // No ANSI codes found
  }

  ansiRegex.lastIndex = 0;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let currentColor: string | undefined = undefined;
  let isBold = false;
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const chunk = text.slice(lastIndex, match.index);
      elements.push(
        <span
          key={elements.length}
          style={{
            color: currentColor,
            fontWeight: isBold ? 700 : undefined,
          }}
        >
          {chunk}
        </span>
      );
    }

    // Process code
    const codes = match[1].split(';');
    for (const code of codes) {
      if (code === '0' || code === '00') {
        currentColor = undefined;
        isBold = false;
      } else if (code === '1') {
        isBold = true;
      } else if (ANSI_COLOR_MAP[code]) {
        currentColor = ANSI_COLOR_MAP[code];
      }
    }

    lastIndex = ansiRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(
      <span
        key={elements.length}
        style={{
          color: currentColor,
          fontWeight: isBold ? 700 : undefined,
        }}
      >
        {text.slice(lastIndex)}
      </span>
    );
  }

  return <>{elements}</>;
}

/**
 * Parses a flat log line into syntax-colored tokens matching Image 3 and Image 4.
 */
export function renderSyntaxColoredLine(rawLine: string): React.ReactNode {
  // Check if stack trace line
  const isTrace = /^\s*(Trace:|Error:|Exception:|at\s+|Caused by:)/i.test(rawLine);
  if (isTrace) {
    return (
      <span style={{ color: '#fb7185' }}>
        {rawLine}
      </span>
    );
  }

  // If no bracket tokens are present in this line, check for pure ANSI formatting
  const hasBrackets = /\[(.*?)\]/.test(rawLine);
  if (!hasBrackets) {
    const ansiOnly = renderAnsiText(rawLine);
    if (ansiOnly) return ansiOnly;
  }

  // Bracket tokens regex
  const bracketRegex = /\[(.*?)\]/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = bracketRegex.exec(rawLine)) !== null) {
    // Non-bracket text preceding this token
    if (match.index > lastIndex) {
      const nonToken = rawLine.slice(lastIndex, match.index);
      const ansiChunk = renderAnsiText(nonToken);
      elements.push(
        <span key={`txt-${lastIndex}`} style={{ color: 'var(--tok-msg)' }}>
          {ansiChunk || nonToken}
        </span>
      );
    }

    const token = match[1].trim();
    const tokenLower = token.toLowerCase();
    let tokenColor = 'var(--tok-pid)'; // Default slate
    let fontWeight: 400 | 500 | 600 | 700 = 400;

    // 1. Datetime: cyan
    if (/^\d{4}[-/.]\d{2}[-/.]\d{2}/.test(token)) {
      tokenColor = 'var(--tok-datetime)';
      fontWeight = 600;
    }
    // 2. PID or TID: slate/gray
    else if (/^\d{3,6}$/.test(token) || /^thread[-_]?\w+/i.test(token) || /^worker[-_]?\w+/i.test(token)) {
      tokenColor = 'var(--tok-pid)';
    }
    // 3. Correlation ID: emerald green
    else if (/^(corr|cid|correlation|req|traceid|trace_id|correlation_id|txn)[-_:]/i.test(token) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(token) || /^c_[a-f0-9]{6,}/i.test(token)) {
      tokenColor = 'var(--tok-corr)';
      fontWeight = 600;
    }
    // 4. Workflow marker: purple
    else if (/^wf:/i.test(token) || /^flow[-_:]/i.test(token) || /^workflow[-_:]/i.test(token)) {
      tokenColor = 'var(--tok-workflow)';
      fontWeight = 600;
    }
    // 4. Operation: bright orange for HTTP or yellow for action
    else if (/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/i.test(token)) {
      tokenColor = 'var(--tok-op-http)';
      fontWeight = 700;
    } else if (/^[A-Z][a-zA-Z0-9]+(Check|Create|Update|Delete|Query|Fetch|Dispatch|Process|Rollback|Sync|Validate|Reserve|Charge|Finalize|Send)$/.test(token)) {
      tokenColor = 'var(--tok-op-action)';
      fontWeight = 600;
    }
    // 5. Status / Level
    else if (tokenLower.includes('fail') || tokenLower.includes('err')) {
      tokenColor = 'var(--tok-status-error)';
      fontWeight = 700;
    } else if (tokenLower.includes('warn')) {
      tokenColor = 'var(--tok-status-warn)';
      fontWeight = 700;
    } else if (tokenLower.includes('success') || token === '200') {
      tokenColor = 'var(--tok-status-success)';
      fontWeight = 700;
    } else if (tokenLower.includes('pend')) {
      tokenColor = 'var(--tok-duration)';
      fontWeight = 600;
    } else if (tokenLower.includes('crit') || tokenLower.includes('fatal')) {
      tokenColor = 'var(--lvl-critical)';
      fontWeight = 700;
    } else if (tokenLower.includes('info')) {
      tokenColor = 'var(--tok-status-info)';
      fontWeight = 600;
    }
    // 6. Duration: bright gold
    else if (/^\d+(\.\d+)?\s*(ms|s|m|µs|us|ns)$/i.test(token)) {
      tokenColor = 'var(--tok-duration)';
      fontWeight = 600;
    }
    // 7. Trailing file location: [FileName::LineNumber]
    else if (token.includes('::') || /\.[a-z]{2,4}::\d+$/i.test(token)) {
      tokenColor = 'var(--tok-file)';
    }
    // 8. Namespace
    else if (token.includes('.') || /^[A-Z][a-zA-Z0-9_]+$/.test(token)) {
      tokenColor = 'var(--tok-namespace)';
      fontWeight = 500;
    }

    elements.push(
      <span
        key={`tok-${match.index}`}
        style={{
          color: tokenColor,
          fontWeight,
        }}
      >
        [{token}]
      </span>
    );

    lastIndex = bracketRegex.lastIndex;
  }

  // Trailing remainder of line (message body)
  if (lastIndex < rawLine.length) {
    const remainder = rawLine.slice(lastIndex);
    const ansiRemainder = renderAnsiText(remainder);
    elements.push(
      <span key={`rem-${lastIndex}`} style={{ color: 'var(--tok-msg)' }}>
        {ansiRemainder || remainder}
      </span>
    );
  }

  return <>{elements}</>;
}
