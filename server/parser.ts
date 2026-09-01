import { LogEntry, LogLevel, TraceData, TraceFrame } from './types.ts';

const DATETIME_REGEX = /^\d{4}[-/.]\d{2}[-/.]\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const DURATION_REGEX = /^\d+(\.\d+)?\s*(ms|s|m|µs|us|ns)$/i;
const LOCATION_TRAILING_REGEX = /\s+\[([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+::\d+)\]$/;

const STATUS_LEVEL_MAP: Record<string, LogLevel> = {
  emergency: 'emergency',
  alert: 'alert',
  critical: 'critical',
  fatal: 'critical',
  panic: 'critical',
  error: 'error',
  failed: 'error',
  fail: 'error',
  err: 'error',
  warn: 'warning',
  warning: 'warning',
  notice: 'notice',
  pending: 'notice',
  info: 'info',
  success: 'info',
  ok: 'info',
  debug: 'debug',
  trace: 'trace',
};

export function parseLogLines(rawContent: string): LogEntry[] {
  const lines = rawContent.split(/\r?\n/);
  const entries: LogEntry[] = [];
  let currentEntry: LogEntry | null = null;
  let traceLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === '' && i === lines.length - 1) {
      continue;
    }

    // Check if line is continuation / stack trace
    const isIndented = /^(\s{2,}|\t)/.test(rawLine);
    const isTraceLeader = /^(Trace:|Error:|Exception:|Caused by:|Traceback |java\.|at\s+)/i.test(rawLine.trim());

    if (currentEntry && (isIndented || isTraceLeader)) {
      traceLines.push(rawLine);
      currentEntry.raw += '\n' + rawLine;
      continue;
    }

    // Commit previous entry trace if any
    if (currentEntry && traceLines.length > 0) {
      currentEntry.trace = parseTraceLines(traceLines);
      traceLines = [];
    }

    // Parse new line
    currentEntry = parseSingleLine(rawLine, i + 1);
    entries.push(currentEntry);
  }

  // Final trace commit
  if (currentEntry && traceLines.length > 0) {
    currentEntry.trace = parseTraceLines(traceLines);
  }

  return entries;
}

export function parseSingleLine(rawLine: string, lineNumber: number): LogEntry {
  let workingLine = rawLine.trimEnd();
  let fileLocation: string | undefined = undefined;

  // 1. Check for trailing location bracket: [FileName::LineNumber]
  const locMatch = workingLine.match(LOCATION_TRAILING_REGEX);
  if (locMatch) {
    fileLocation = locMatch[1];
    workingLine = workingLine.slice(0, locMatch.index).trimEnd();
  }

  // 2. Extract leading bracket tokens: [token1] [token2] ...
  const bracketTokens: string[] = [];
  let cursor = 0;

  while (cursor < workingLine.length) {
    // skip whitespace
    while (cursor < workingLine.length && /\s/.test(workingLine[cursor])) {
      cursor++;
    }

    if (workingLine[cursor] === '[') {
      const closeIdx = workingLine.indexOf(']', cursor);
      if (closeIdx !== -1) {
        const tokenContent = workingLine.slice(cursor + 1, closeIdx).trim();
        bracketTokens.push(tokenContent);
        cursor = closeIdx + 1;
        continue;
      }
    }
    break;
  }

  const remainderMessage = workingLine.slice(cursor).trim();

  // If no brackets found, treat whole line as message
  if (bracketTokens.length === 0) {
    const inferredLevel = inferLevelFromText(workingLine);
    return {
      id: `entry-${lineNumber}`,
      lineNumber,
      raw: rawLine,
      message: workingLine,
      level: inferredLevel,
      fileLocation,
    };
  }

  // 3. Classify bracket tokens
  let datetime: string | undefined;
  let timestamp: number | undefined;
  let pid: string | undefined;
  let tid: string | undefined;
  let namespace: string | undefined;
  let workflow: string | undefined;
  let operation: string | undefined;
  let status: string | undefined;
  let duration: string | undefined;
  let explicitLevel: LogLevel | undefined;

  const unassignedTokens: string[] = [];

  for (let idx = 0; idx < bracketTokens.length; idx++) {
    const token = bracketTokens[idx];
    const tokenLower = token.toLowerCase();

    // Check if token is a direct log level
    if (STATUS_LEVEL_MAP[tokenLower] && !status) {
      status = token.toUpperCase();
      explicitLevel = STATUS_LEVEL_MAP[tokenLower];
      continue;
    }

    // Check DateTime
    if (!datetime && (DATETIME_REGEX.test(token) || !isNaN(Date.parse(token)) && token.length >= 10)) {
      datetime = token;
      const parsedTime = Date.parse(token);
      if (!isNaN(parsedTime)) {
        timestamp = parsedTime;
      }
      continue;
    }

    // Check Duration
    if (!duration && DURATION_REGEX.test(token)) {
      duration = token;
      continue;
    }

    // Check Workflow Marker
    if (!workflow && (
      /^wf:/i.test(token) ||
      /^flow[-_:]/i.test(token) ||
      /^jobexecution-/i.test(token) ||
      /^txn-/i.test(token)
    )) {
      workflow = token;
      continue;
    }

    // Check PID
    if (!pid && (/^\d{3,6}$/.test(token) || /^pid:\s*\d+/i.test(token))) {
      pid = token.replace(/^pid:\s*/i, '');
      continue;
    }

    // Check TID
    if (!tid && (
      /^thread[-_]?\w+/i.test(token) ||
      /^worker[-_]?\w+/i.test(token) ||
      /^tid:\s*\w+/i.test(token)
    )) {
      tid = token.replace(/^tid:\s*/i, '');
      continue;
    }

    // Check HTTP or standard operation
    if (!operation && (
      /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\S+/i.test(token) ||
      /^[A-Z][a-zA-Z0-9]+(Check|Create|Update|Delete|Query|Fetch|Dispatch|Process|Rollback|Sync|Validate|Reserve|Charge|Finalize|Send)$/.test(token)
    )) {
      operation = token;
      continue;
    }

    // Check Namespace (e.g. Auth.Service or Security.Session or BillingService)
    if (!namespace && (token.includes('.') || /^[A-Z][a-zA-Z0-9_]+$/.test(token))) {
      namespace = token;
      continue;
    }

    unassignedTokens.push(token);
  }

  // Assign any remaining unassigned tokens if fields are still empty
  for (const token of unassignedTokens) {
    if (!status && STATUS_LEVEL_MAP[token.toLowerCase()]) {
      status = token.toUpperCase();
      explicitLevel = STATUS_LEVEL_MAP[token.toLowerCase()];
    } else if (!namespace) {
      namespace = token;
    } else if (!operation) {
      operation = token;
    } else if (!workflow) {
      workflow = token;
    }
  }

  // Determine final level
  const finalLevel: LogLevel =
    explicitLevel ||
    (status ? STATUS_LEVEL_MAP[status.toLowerCase()] : undefined) ||
    inferLevelFromText(remainderMessage || workingLine);

  return {
    id: `entry-${lineNumber}`,
    lineNumber,
    raw: rawLine,
    datetime,
    timestamp,
    pid,
    tid,
    namespace,
    workflow,
    operation,
    status,
    duration,
    message: remainderMessage || (unassignedTokens.join(' ') || rawLine),
    fileLocation,
    level: finalLevel,
  };
}

export function inferLevelFromText(text: string): LogLevel {
  const upper = text.toUpperCase();
  if (upper.includes('EMERGENCY') || upper.includes('FATAL') || upper.includes('PANIC')) {
    return 'emergency';
  }
  if (upper.includes('CRITICAL')) {
    return 'critical';
  }
  if (upper.includes('ERROR') || upper.includes('EXCEPTION') || upper.includes('FAIL')) {
    return 'error';
  }
  if (upper.includes('WARN') || upper.includes('WARNING')) {
    return 'warning';
  }
  if (upper.includes('NOTICE')) {
    return 'notice';
  }
  if (upper.includes('DEBUG')) {
    return 'debug';
  }
  if (upper.includes('TRACE')) {
    return 'trace';
  }
  return 'info';
}

export function parseTraceLines(traceLines: string[]): TraceData {
  const raw = traceLines.join('\n');
  const title = traceLines.length > 0 ? traceLines[0].trim() : undefined;
  const frames: TraceFrame[] = [];

  const FRAME_REGEX = /^\s*at\s+(?:(.+?)\s+\((.+?):(\d+):?(\d+)?\)|(.+?):(\d+):?(\d+)?|(.*?))$/;

  for (let i = 0; i < traceLines.length; i++) {
    const line = traceLines[i];
    const match = line.match(FRAME_REGEX);
    if (match) {
      if (match[2]) {
        // at fn (file:line:col)
        frames.push({
          text: match[1] || match[0].trim(),
          file: match[2],
          line: parseInt(match[3], 10),
        });
      } else if (match[5]) {
        // at file:line:col
        frames.push({
          text: match[5],
          file: match[5],
          line: parseInt(match[6], 10),
        });
      } else {
        frames.push({
          text: line.trim(),
        });
      }
    } else if (line.trim().length > 0) {
      frames.push({
        text: line.trim(),
      });
    }
  }

  return {
    title,
    frames,
    raw,
  };
}
