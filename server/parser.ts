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
  audit: 'audit',
  debug: 'debug',
  trace: 'trace',
};

export function isXmlLogContent(content: string): boolean {
  const trimmed = content.trim();
  return (
    trimmed.startsWith('<?xml') ||
    trimmed.includes('<log4j:event') ||
    trimmed.includes('<record>') ||
    trimmed.includes('<Event xmlns=') ||
    trimmed.includes('<log:entry') ||
    trimmed.includes('<event ')
  );
}

export function parseXmlLogRecords(content: string): LogEntry[] | null {
  const RECORD_REGEX = /(<(?:log4j:event|record|Event|entry|log:record|log:entry)\b[\s\S]*?<\/(?:log4j:event|record|Event|entry|log:record|log:entry)>|<(?:event|record|entry)\b[^>]*?\/>)/gi;
  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = RECORD_REGEX.exec(content)) !== null) {
    matches.push(m);
  }

  if (matches.length === 0) return null;

  const entries: LogEntry[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const xml = match[0];
    const index = match.index;

    // Calculate line number up to this index
    const prefix = content.slice(0, index);
    const lineNumber = (prefix.match(/\n/g) || []).length + 1;

    // 1. Level extraction
    let level: LogLevel = 'info';
    const levelAttrMatch = xml.match(/\blevel=["']([a-zA-Z0-9_-]+)["']/i) || xml.match(/<level>([^<]+)<\/level>/i);
    if (levelAttrMatch) {
      const rawLvl = levelAttrMatch[1].toLowerCase();
      if (rawLvl === 'severe' || rawLvl === 'error' || rawLvl === 'fatal' || rawLvl === '2') {
        level = 'error';
      } else if (rawLvl === 'warning' || rawLvl === 'warn' || rawLvl === '3') {
        level = 'warning';
      } else if (rawLvl === 'audit') {
        level = 'audit';
      } else if (rawLvl === 'debug' || rawLvl === 'config' || rawLvl === 'fine') {
        level = 'debug';
      } else if (rawLvl === 'trace' || rawLvl === 'finer' || rawLvl === 'finest') {
        level = 'trace';
      } else {
        level = STATUS_LEVEL_MAP[rawLvl] || 'info';
      }
    } else {
      level = inferLevelFromText(xml);
    }

    // 2. Timestamp extraction
    let datetime: string | undefined = undefined;
    const timeAttrMatch =
      xml.match(/\b(?:timestamp|time)=["']([^"']+)["']/i) ||
      xml.match(/<date>([^<]+)<\/date>/i) ||
      xml.match(/\bSystemTime=["']([^"']+)["']/i);

    if (timeAttrMatch) {
      const val = timeAttrMatch[1];
      if (/^\d{10,13}$/.test(val)) {
        const ms = val.length === 10 ? parseInt(val, 10) * 1000 : parseInt(val, 10);
        datetime = new Date(ms).toISOString();
      } else {
        datetime = val;
      }
    } else {
      const millisMatch = xml.match(/<millis>(\d+)<\/millis>/i);
      if (millisMatch) {
        datetime = new Date(parseInt(millisMatch[1], 10)).toISOString();
      }
    }

    // 3. Workflow / Logger
    let workflow: string | undefined = undefined;
    const loggerMatch =
      xml.match(/\blogger=["']([^"']+)["']/i) ||
      xml.match(/<class>([^<]+)<\/class>/i) ||
      xml.match(/<Channel>([^<]+)<\/Channel>/i) ||
      xml.match(/\bsource=["']([^"']+)["']/i);
    if (loggerMatch) {
      workflow = loggerMatch[1];
    }

    // 4. Thread / PID
    let thread: string | undefined = undefined;
    const threadMatch =
      xml.match(/\bthread=["']([^"']+)["']/i) ||
      xml.match(/<thread>([^<]+)<\/thread>/i) ||
      xml.match(/\bThreadID=["']([^"']+)["']/i);
    if (threadMatch) {
      thread = threadMatch[1];
    }

    let pid: string | undefined = undefined;
    const pidMatch = xml.match(/\b(?:ProcessID|pid)=["']([^"']+)["']/i);
    if (pidMatch) {
      pid = pidMatch[1];
    }

    // 5. Message
    let message = '';
    const cdataMatch = xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
    const messageTagMatch =
      xml.match(/<(?:log4j:message|message)>([\s\S]*?)<\/(?:log4j:message|message)>/i) ||
      xml.match(/<Data[^>]*>([\s\S]*?)<\/Data>/i) ||
      xml.match(/\bmessage=["']([^"']+)["']/i);

    if (cdataMatch) {
      message = cdataMatch[1].trim();
    } else if (messageTagMatch) {
      message = messageTagMatch[1].trim();
    } else {
      message = xml.replace(/\s+/g, ' ').slice(0, 300);
    }

    // 6. Trace
    let trace: TraceData | undefined = undefined;
    const throwableMatch = xml.match(/<(?:log4j:throwable|throwable|exception|stackTrace)>([\s\S]*?)<\/(?:log4j:throwable|throwable|exception|stackTrace)>/i);
    if (throwableMatch) {
      const traceText = throwableMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/i, '$1').trim();
      trace = parseTraceLines(traceText.split(/\r?\n/));
    }

    entries.push({
      id: `xml-${lineNumber}-${i}`,
      lineNumber,
      datetime,
      level,
      workflow,
      tid: thread,
      pid,
      message,
      trace,
      raw: xml,
    });
  }

  return entries;
}

export function parseLogLines(rawContent: string): LogEntry[] {
  // Check if content is an XML log file
  if (isXmlLogContent(rawContent)) {
    const xmlEntries = parseXmlLogRecords(rawContent);
    if (xmlEntries && xmlEntries.length > 0) {
      return xmlEntries;
    }
  }

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

  // If no brackets found, check for JSON log record or treat whole line as message
  if (bracketTokens.length === 0) {
    if (workingLine.startsWith('{') && workingLine.endsWith('}')) {
      try {
        const obj = JSON.parse(workingLine);
        if (typeof obj === 'object' && obj !== null) {
          const rawLvl = String(obj.level || obj.severity || obj.lvl || obj.log_level || '').toLowerCase();
          const level = STATUS_LEVEL_MAP[rawLvl] || inferLevelFromText(workingLine);
          const dt = obj.time || obj.timestamp || obj.datetime || obj.date || obj['@timestamp'];
          const msg = obj.message || obj.msg || obj.log || workingLine;
          const corr = obj.correlationId || obj.correlation_id || obj.traceId || obj.trace_id || obj.reqId;
          const ns = obj.service || obj.logger || obj.name || obj.namespace;
          const wf = obj.workflow || obj.action;
          const op = obj.operation || obj.op || obj.method;
          const st = obj.status || obj.status_code || obj.statusCode ? String(obj.status || obj.status_code || obj.statusCode) : undefined;
          const dur = obj.duration || obj.durationMs || obj.elapsed ? `${obj.duration || obj.durationMs || obj.elapsed}ms` : undefined;

          return {
            id: `entry-${lineNumber}`,
            lineNumber,
            raw: rawLine,
            datetime: typeof dt === 'string' ? dt : undefined,
            timestamp: typeof dt === 'number' ? dt : undefined,
            message: typeof msg === 'string' ? msg : JSON.stringify(msg),
            level,
            correlationId: typeof corr === 'string' ? corr : undefined,
            namespace: typeof ns === 'string' ? ns : undefined,
            workflow: typeof wf === 'string' ? wf : undefined,
            operation: typeof op === 'string' ? op : undefined,
            status: st,
            duration: dur,
            fileLocation,
          };
        }
      } catch {
        // Fallback to normal text line
      }
    }

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
  let correlationId: string | undefined;
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
      /^workflow[-_:]/i.test(token)
    )) {
      workflow = token;
      continue;
    }

    // Check Correlation ID (e.g. [corr-8f92a10b], [cid-1002], [c:xyz], UUIDs, or req-xxx)
    if (!correlationId && (
      /^(corr|cid|correlation|req|traceid|trace_id|correlation_id|txn)[-_:]/i.test(token) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token) ||
      /^(c|corr)_[a-f0-9]{6,}/i.test(token)
    )) {
      correlationId = token;
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
    } else if (!correlationId && (/^(corr|cid|correlation|req|trace)[-_:]/i.test(token) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(token) || /^c_[a-f0-9]{4,}/i.test(token))) {
      correlationId = token;
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
    correlationId,
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
  if (upper.includes('AUDIT')) {
    return 'audit';
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
