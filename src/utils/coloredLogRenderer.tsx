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
  // Regex to match ANSI escape codes like \u001b[31m or \x1b[0m
  const ansiRegex = /(?:\u001b|\\u001b|\\x1b|\[)\??(\d+(?:;\d+)*)m/g;

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
  // First check if line has ANSI escape sequences
  const ansiRender = renderAnsiText(rawLine);
  if (ansiRender) {
    return ansiRender;
  }

  // Check if stack trace line
  const isTrace = /^\s*(Trace:|Error:|Exception:|at\s+|Caused by:)/i.test(rawLine);
  if (isTrace) {
    return (
      <span style={{ color: '#fb7185' }}>
        {rawLine}
      </span>
    );
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
      elements.push(
        <span key={`txt-${lastIndex}`} style={{ color: '#f8fafc' }}>
          {nonToken}
        </span>
      );
    }

    const token = match[1].trim();
    const tokenLower = token.toLowerCase();
    let tokenColor = '#94a3b8'; // Default slate
    let fontWeight: 400 | 500 | 600 | 700 = 400;

    // 1. Datetime: cyan
    if (/^\d{4}[-/.]\d{2}[-/.]\d{2}/.test(token)) {
      tokenColor = '#00e5ff'; // Vivid cyan
      fontWeight = 600;
    }
    // 2. PID or TID: slate/gray
    else if (/^\d{3,6}$/.test(token) || /^thread[-_]?\w+/i.test(token) || /^worker[-_]?\w+/i.test(token)) {
      tokenColor = '#94a3b8';
    }
    // 3. Workflow marker: purple
    else if (/^wf:/i.test(token) || /^flow[-_:]/i.test(token) || /^txn-/i.test(token)) {
      tokenColor = '#c084fc';
      fontWeight = 600;
    }
    // 4. Operation: bright orange for HTTP or yellow for action
    else if (/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/i.test(token)) {
      tokenColor = '#ff9800'; // Bright Orange
      fontWeight = 700;
    } else if (/^[A-Z][a-zA-Z0-9]+(Check|Create|Update|Delete|Query|Fetch|Dispatch|Process|Rollback|Sync|Validate|Reserve|Charge|Finalize|Send)$/.test(token)) {
      tokenColor = '#fbbf24';
      fontWeight = 600;
    }
    // 5. Status / Level
    else if (tokenLower.includes('fail') || tokenLower.includes('err')) {
      tokenColor = '#f87171'; // Red
      fontWeight = 700;
    } else if (tokenLower.includes('warn')) {
      tokenColor = '#fbbf24'; // Amber
      fontWeight = 700;
    } else if (tokenLower.includes('success') || token === '200') {
      tokenColor = '#86efac'; // Green
      fontWeight = 700;
    } else if (tokenLower.includes('pend')) {
      tokenColor = '#facc15'; // Yellow
      fontWeight = 600;
    } else if (tokenLower.includes('crit') || tokenLower.includes('fatal')) {
      tokenColor = '#f43f5e'; // Rose
      fontWeight = 700;
    } else if (tokenLower.includes('info')) {
      tokenColor = '#38bdf8'; // Sky
      fontWeight = 600;
    }
    // 6. Duration: bright gold
    else if (/^\d+(\.\d+)?\s*(ms|s|m|µs|us|ns)$/i.test(token)) {
      tokenColor = '#facc15'; // Gold
      fontWeight = 600;
    }
    // 7. Trailing file location: [FileName::LineNumber]
    else if (token.includes('::') || /\.[a-z]{2,4}::\d+$/i.test(token)) {
      tokenColor = '#64748b'; // Muted slate
    }
    // 8. Namespace
    else if (token.includes('.') || /^[A-Z][a-zA-Z0-9_]+$/.test(token)) {
      tokenColor = '#7dd3fc'; // Soft light blue
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
    elements.push(
      <span key={`rem-${lastIndex}`} style={{ color: '#f8fafc' }}>
        {rawLine.slice(lastIndex)}
      </span>
    );
  }

  return <>{elements}</>;
}
