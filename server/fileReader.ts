import fs from 'node:fs';
import path from 'node:path';
import { LogEntry, LogLevel, LogQuery, LogQueryResult } from './types.ts';
import { parseLogLines } from './parser.ts';
import { findSourceById, getSources } from './config.ts';
import { metrics } from './metrics.ts';

interface CacheFacets {
  levelCounts: Record<string, number>;
  workflowCounts: Record<string, number>;
  operationCounts: Record<string, number>;
  correlationCounts: Record<string, number>;
}

// Bounded LRU in-memory cache for parsed entries per source with mtime invalidation
interface CacheEntry {
  mtimeMs: number;
  size: number;
  entries: LogEntry[];
  facets: CacheFacets;
  lastAccessed: number;
}

const MAX_CACHED_SOURCES = 25;
const MAX_TOTAL_CACHED_ENTRIES = 350000;
const fileCache: Map<string, CacheEntry> = new Map();

function limitTopK(record: Record<string, number>, max = 100): Record<string, number> {
  const keys = Object.keys(record);
  if (keys.length <= max) return record;

  const sortedKeys = keys.sort((a, b) => record[b] - record[a]).slice(0, max);
  const result: Record<string, number> = {};
  for (let i = 0; i < sortedKeys.length; i++) {
    result[sortedKeys[i]] = record[sortedKeys[i]];
  }
  return result;
}

function computeFacets(entries: LogEntry[]): CacheFacets {
  const levelCounts: Record<string, number> = {
    all: entries.length,
    emergency: 0,
    critical: 0,
    error: 0,
    warning: 0,
    notice: 0,
    info: 0,
    audit: 0,
    debug: 0,
    trace: 0,
  };
  const workflowCounts: Record<string, number> = {};
  const operationCounts: Record<string, number> = {};
  const correlationCounts: Record<string, number> = {};

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (levelCounts[entry.level] !== undefined) {
      levelCounts[entry.level]++;
    }
    if (entry.workflow) {
      const baseWf = entry.workflow.replace(/[-_]\d+$/, '');
      workflowCounts[baseWf] = (workflowCounts[baseWf] || 0) + 1;
    }
    if (entry.operation) {
      operationCounts[entry.operation] = (operationCounts[entry.operation] || 0) + 1;
    }
    if (entry.correlationId) {
      correlationCounts[entry.correlationId] = (correlationCounts[entry.correlationId] || 0) + 1;
    }
  }

  return {
    levelCounts,
    workflowCounts: limitTopK(workflowCounts, 100),
    operationCounts: limitTopK(operationCounts, 100),
    correlationCounts: limitTopK(correlationCounts, 100),
  };
}

// Register provider for metrics dashboard
metrics.registerCacheStatsProvider(() => {
  let entriesTotal = 0;
  for (const item of fileCache.values()) {
    entriesTotal += item.entries.length;
  }
  // Approximate memory (each entry ~350 bytes in memory)
  const memoryMb = Math.round(((entriesTotal * 350) / 1024 / 1024) * 10) / 10;
  return {
    sourcesCount: fileCache.size,
    entriesTotal,
    memoryMb,
  };
});

function evictLruCacheIfNeeded() {
  if (fileCache.size <= MAX_CACHED_SOURCES) {
    let total = 0;
    for (const item of fileCache.values()) {
      total += item.entries.length;
    }
    if (total <= MAX_TOTAL_CACHED_ENTRIES) return;
  }

  // Find least recently accessed entry
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, item] of fileCache.entries()) {
    if (item.lastAccessed < oldestTime) {
      oldestTime = item.lastAccessed;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    fileCache.delete(oldestKey);
    metrics.recordCacheEviction();
  }
}

// Regex compilation cache (last 100 patterns)
const regexCache: Map<string, RegExp> = new Map();
function getCompiledRegex(pattern: string, flags: string): RegExp {
  const key = `${pattern}:::${flags}`;
  const existing = regexCache.get(key);
  if (existing) return existing;

  const reg = new RegExp(pattern, flags);
  if (regexCache.size > 150) {
    const firstKey = regexCache.keys().next().value;
    if (firstKey) regexCache.delete(firstKey);
  }
  regexCache.set(key, reg);
  return reg;
}

function parseDurationMs(durationStr?: string): number {
  if (!durationStr) return 0;
  const match = durationStr.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|µs|us|ns)?$/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = (match[2] || 'ms').toLowerCase();
  if (unit === 's') return val * 1000;
  if (unit === 'm') return val * 60000;
  if (unit === 'µs' || unit === 'us') return val / 1000;
  if (unit === 'ns') return val / 1000000;
  return val;
}

export function getEntriesForSource(sourceId: string): LogEntry[] {
  const loadStart = performance.now();
  const source = findSourceById(sourceId);
  if (!source) {
    metrics.recordCacheMiss('not_found');
    metrics.recordFileLoadFailure(sourceId, sourceId, 'not_found', `Log source not registered in configuration: ${sourceId}`);
    return [];
  }

  const resolvedPath = path.isAbsolute(source.path)
    ? source.path
    : path.resolve(process.cwd(), source.path);

  if (!fs.existsSync(resolvedPath)) {
    metrics.recordCacheMiss('not_found');
    metrics.recordFileLoadFailure(source.id, resolvedPath, 'not_found', `File does not exist on disk: ${resolvedPath}`);
    return [];
  }

  try {
    const stats = fs.statSync(resolvedPath);
    const cached = fileCache.get(resolvedPath);

    if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
      cached.lastAccessed = Date.now();
      metrics.recordCacheHit();
      return cached.entries;
    }

    // Cache miss - read file from disk
    const missReason = cached ? 'file_modified' : 'initial_load';
    metrics.recordCacheMiss(missReason);

    let content = '';
    try {
      content = fs.readFileSync(resolvedPath, 'utf-8');
    } catch (readErr: any) {
      const isPermission = readErr?.code === 'EACCES' || readErr?.code === 'EPERM';
      metrics.recordFileLoadFailure(
        source.id,
        resolvedPath,
        isPermission ? 'permission_denied' : 'read_error',
        readErr?.message || 'Failed to read file contents'
      );
      return [];
    }

    if (!content || content.trim().length === 0) {
      metrics.recordFileLoadSuccess(source.id, resolvedPath, performance.now() - loadStart, stats.size, 0, 0);
      return [];
    }

    let parsed: any[] = [];
    try {
      parsed = parseLogLines(content);
    } catch (parseErr: any) {
      metrics.recordFileLoadFailure(
        source.id,
        resolvedPath,
        'parse_error',
        parseErr?.message || 'Parser failed to process log lines'
      );
      return [];
    }

    const sourceName = source.name || sourceId;
    const entries = parsed.map((e) => ({
      ...e,
      id: `${source.id}-${e.lineNumber}`,
      sourceId: source.id,
      sourceName,
    }));

    evictLruCacheIfNeeded();

    const facets = computeFacets(entries);

    fileCache.set(resolvedPath, {
      mtimeMs: stats.mtimeMs,
      size: stats.size,
      entries,
      facets,
      lastAccessed: Date.now(),
    });

    const loadDuration = performance.now() - loadStart;
    metrics.recordFileLoadSuccess(source.id, resolvedPath, loadDuration, stats.size, entries.length, 0);

    return entries;
  } catch (err: any) {
    metrics.recordFileLoadFailure(source.id, resolvedPath, 'unknown', err?.message || 'Unknown file load failure');
    return [];
  }
}

export function getSourceCacheItem(sourceId: string): CacheEntry | null {
  const source = findSourceById(sourceId);
  if (!source) return null;
  const resolvedPath = path.resolve(process.cwd(), source.path);
  return fileCache.get(resolvedPath) || null;
}

export const SOURCE_PALETTE = [
  '#38bdf8', // Sky Blue
  '#c084fc', // Purple
  '#34d399', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#06b6d4', // Cyan
  '#a855f7', // Violet
  '#ec4899', // Pink
];

export function getSourceColor(sourceIndex: number): string {
  return SOURCE_PALETTE[sourceIndex % SOURCE_PALETTE.length];
}

export function parseTimestamp(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return NaN;
  if (typeof val === 'number') return isNaN(val) ? NaN : val;
  const str = String(val).trim();
  if (/^\d{10,13}$/.test(str)) {
    const num = parseInt(str, 10);
    return str.length === 10 ? num * 1000 : num;
  }
  const normalized = str.replace(' ', 'T').replace(',', '.');
  if (!normalized.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(normalized)) {
    const utcParsed = Date.parse(normalized + 'Z');
    if (!isNaN(utcParsed)) return utcParsed;
  }
  let parsed = Date.parse(normalized);
  if (!isNaN(parsed)) return parsed;
  parsed = Date.parse(str);
  if (!isNaN(parsed)) return parsed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    parsed = Date.parse(`${str}T00:00:00Z`);
    if (!isNaN(parsed)) return parsed;
  }
  return NaN;
}

export function parseEndTimestamp(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return NaN;
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parsed = Date.parse(`${str}T23:59:59.999Z`);
    if (!isNaN(parsed)) return parsed;
  }
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}$/.test(str)) {
    const norm = str.replace(' ', 'T');
    const parsed = Date.parse(`${norm}:59.999Z`);
    if (!isNaN(parsed)) return parsed;
  }
  return parseTimestamp(val);
}

export function getEntryTimestamp(entry: LogEntry): number {
  if (entry.datetime) {
    const ts = parseTimestamp(entry.datetime);
    if (!isNaN(ts)) {
      entry.timestamp = ts;
      return ts;
    }
  }
  if (entry.timestamp !== undefined && !isNaN(entry.timestamp)) return entry.timestamp;
  const m = entry.raw.match(/\[(\d{4}[-/.]\d{2}[-/.]\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)\]/);
  if (m) {
    const ts = parseTimestamp(m[1]);
    if (!isNaN(ts)) {
      entry.timestamp = ts;
      return ts;
    }
  }
  return NaN;
}

function combineFacets(sources: string[]): CacheFacets {
  const levelCounts: Record<string, number> = {
    all: 0,
    emergency: 0,
    critical: 0,
    error: 0,
    warning: 0,
    notice: 0,
    info: 0,
    audit: 0,
    debug: 0,
    trace: 0,
  };
  const workflowCounts: Record<string, number> = {};
  const operationCounts: Record<string, number> = {};
  const correlationCounts: Record<string, number> = {};

  for (const srcId of sources) {
    const cached = getSourceCacheItem(srcId);
    if (!cached || !cached.facets) continue;
    const f = cached.facets;
    for (const [lvl, cnt] of Object.entries(f.levelCounts)) {
      levelCounts[lvl] = (levelCounts[lvl] || 0) + cnt;
    }
    for (const [wf, cnt] of Object.entries(f.workflowCounts)) {
      workflowCounts[wf] = (workflowCounts[wf] || 0) + cnt;
    }
    for (const [op, cnt] of Object.entries(f.operationCounts)) {
      operationCounts[op] = (operationCounts[op] || 0) + cnt;
    }
    for (const [corr, cnt] of Object.entries(f.correlationCounts)) {
      correlationCounts[corr] = (correlationCounts[corr] || 0) + cnt;
    }
  }

  return {
    levelCounts,
    workflowCounts: limitTopK(workflowCounts, 100),
    operationCounts: limitTopK(operationCounts, 100),
    correlationCounts: limitTopK(correlationCounts, 100),
  };
}

export function queryLogs(query: LogQuery): LogQueryResult {
  const startTime = performance.now();
  
  // Support multi-source querying
  const requestedIds = query.sourceIds && query.sourceIds.length > 0
    ? query.sourceIds.filter(Boolean)
    : [query.sourceId].filter(Boolean);

  let allEntries: LogEntry[];
  let levelCounts: Record<string, number>;
  let workflowCounts: Record<string, number>;
  let operationCounts: Record<string, number>;
  let correlationCounts: Record<string, number>;

  if (requestedIds.length === 1) {
    allEntries = getEntriesForSource(requestedIds[0]);
    const cachedItem = getSourceCacheItem(requestedIds[0]);
    if (cachedItem && cachedItem.facets) {
      levelCounts = { ...cachedItem.facets.levelCounts };
      workflowCounts = { ...cachedItem.facets.workflowCounts };
      operationCounts = { ...cachedItem.facets.operationCounts };
      correlationCounts = { ...cachedItem.facets.correlationCounts };
    } else {
      const computed = computeFacets(allEntries);
      levelCounts = computed.levelCounts;
      workflowCounts = computed.workflowCounts;
      operationCounts = computed.operationCounts;
      correlationCounts = computed.correlationCounts;
    }
  } else {
    allEntries = [];
    for (let idx = 0; idx < requestedIds.length; idx++) {
      const srcId = requestedIds[idx];
      const sourceColor = getSourceColor(idx);
      const rawEntries = getEntriesForSource(srcId);
      for (let i = 0; i < rawEntries.length; i++) {
        const item = rawEntries[i];
        if (item.sourceColor !== sourceColor) {
          item.sourceColor = sourceColor;
        }
        allEntries.push(item);
      }
    }
    const combined = combineFacets(requestedIds);
    levelCounts = combined.levelCounts;
    workflowCounts = combined.workflowCounts;
    operationCounts = combined.operationCounts;
    correlationCounts = combined.correlationCounts;
  }

  // 2. Fast check: Check if any filters are applied
  const selectedLevels = query.levels && query.levels.length > 0 ? new Set(query.levels) : null;
  const excludedLevels = query.excludeLevels && query.excludeLevels.length > 0 ? new Set(query.excludeLevels) : null;
  const hasSearch = Boolean(query.search && query.search.trim().length > 0);
  const rawSearchPattern = hasSearch ? query.search!.trim() : '';

  // Smart prefix extraction in search input (e.g. pid:24010, tid:worker-27, marker:Audit, etc.)
  let inlinePid = query.pid ? query.pid.trim().toLowerCase() : '';
  let inlineTid = query.tid ? query.tid.trim().toLowerCase() : '';
  let inlineMarker = query.marker ? query.marker.trim() : '';
  let inlineWorkflow = query.workflow ? query.workflow.trim().toLowerCase() : '';
  let inlineOperation = query.operation ? query.operation.trim().toLowerCase() : '';
  let inlineCorrelation = query.correlationId ? query.correlationId.trim().toLowerCase() : '';
  let inlineNamespace = query.namespace ? query.namespace.trim().toLowerCase() : '';
  let effectiveSearch = rawSearchPattern;

  if (hasSearch && !query.isRegex) {
    const tokens = rawSearchPattern.split(/\s+/);
    const remainingTerms: string[] = [];
    for (const tok of tokens) {
      const kvMatch = tok.match(/^(pid|tid|thread|marker|wf|workflow|op|operation|corr|cid|ns|service)[:=](.+)$/i);
      if (kvMatch) {
        const key = kvMatch[1].toLowerCase();
        const val = kvMatch[2].trim();
        if (key === 'pid') inlinePid = val.toLowerCase();
        else if (key === 'tid' || key === 'thread') inlineTid = val.toLowerCase();
        else if (key === 'marker' || key === 'wf' || key === 'workflow') inlineMarker = val;
        else if (key === 'op' || key === 'operation') inlineOperation = val.toLowerCase();
        else if (key === 'corr' || key === 'cid') inlineCorrelation = val.toLowerCase();
        else if (key === 'ns' || key === 'service') inlineNamespace = val.toLowerCase();
      } else {
        remainingTerms.push(tok);
      }
    }
    effectiveSearch = remainingTerms.join(' ');
  }

  const hasEffectiveSearch = effectiveSearch.length > 0;
  let searchRegex: RegExp | null = null;
  let literalSearchLower = '';
  let literalSearchExact = '';

  if (hasEffectiveSearch) {
    if (query.isRegex) {
      const flags = query.caseSensitive ? '' : 'i';
      try {
        searchRegex = getCompiledRegex(effectiveSearch, flags);
      } catch {
        try {
          searchRegex = getCompiledRegex(effectiveSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        } catch {}
      }
    } else {
      literalSearchLower = effectiveSearch.toLowerCase();
      literalSearchExact = effectiveSearch;
    }
  }

  // Marker filter setup (clean brackets & setup regex if enabled)
  let markerRegex: RegExp | null = null;
  let markerLower = '';
  const cleanMarker = inlineMarker.replace(/^\[|\]$/g, '').trim();
  if (cleanMarker) {
    if (query.isMarkerRegex) {
      try {
        markerRegex = getCompiledRegex(cleanMarker, 'i');
      } catch {
        try {
          markerRegex = getCompiledRegex(cleanMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        } catch {}
      }
    } else {
      markerLower = cleanMarker.toLowerCase();
    }
  }

  const startMs = parseTimestamp(query.startDate);
  const endMs = parseEndTimestamp(query.endDate);

  const hasFilters = Boolean(
    hasEffectiveSearch ||
    inlinePid ||
    inlineTid ||
    cleanMarker ||
    selectedLevels ||
    excludedLevels ||
    !isNaN(startMs) ||
    !isNaN(endMs) ||
    inlineNamespace ||
    inlineWorkflow ||
    inlineOperation ||
    inlineCorrelation
  );

  let filtered: LogEntry[];

  if (!hasFilters) {
    // Fast path: No filters
    filtered = allEntries;
  } else {
    filtered = allEntries.filter((entry) => {
      // Negative Level Filter
      if (excludedLevels && excludedLevels.has(entry.level)) return false;

      // Positive Level filter
      if (selectedLevels && !selectedLevels.has(entry.level)) return false;

      // Start Date filter
      if (!isNaN(startMs)) {
        const ts = getEntryTimestamp(entry);
        if (isNaN(ts) || ts < startMs) return false;
      }

      // End Date filter
      if (!isNaN(endMs)) {
        const ts = getEntryTimestamp(entry);
        if (isNaN(ts) || ts > endMs) return false;
      }

      // Namespace filter
      if (inlineNamespace) {
        const ns = (entry.namespace || '').toLowerCase();
        if (!ns.includes(inlineNamespace)) return false;
      }

      // Workflow filter
      if (inlineWorkflow) {
        const wf = (entry.workflow || '').toLowerCase();
        if (!wf.includes(inlineWorkflow)) return false;
      }

      // Operation filter
      if (inlineOperation) {
        const op = (entry.operation || '').toLowerCase();
        if (!op.includes(inlineOperation)) return false;
      }

      // Correlation ID filter
      if (inlineCorrelation) {
        const corr = (entry.correlationId || '').toLowerCase();
        if (!corr.includes(inlineCorrelation)) return false;
      }

      // PID filter
      if (inlinePid) {
        const pid = (entry.pid || '').toLowerCase();
        const raw = entry.raw.toLowerCase();
        const matchesPid = pid.includes(inlinePid) || raw.includes(`[${inlinePid}]`) || raw.includes(`[pid:${inlinePid}]`);
        if (!matchesPid) return false;
      }

      // TID filter
      if (inlineTid) {
        const tid = (entry.tid || '').toLowerCase();
        const raw = entry.raw.toLowerCase();
        const matchesTid = tid.includes(inlineTid) || raw.includes(`[${inlineTid}]`) || raw.includes(`[tid:${inlineTid}]`);
        if (!matchesTid) return false;
      }

      // Marker filter
      if (markerRegex) {
        const wf = entry.workflow || '';
        const op = entry.operation || '';
        const ns = entry.namespace || '';
        const raw = entry.raw || '';
        const matches = markerRegex.test(wf) || markerRegex.test(op) || markerRegex.test(ns) || markerRegex.test(raw);
        if (!matches) return false;
      } else if (markerLower) {
        const wf = (entry.workflow || '').toLowerCase();
        const op = (entry.operation || '').toLowerCase();
        const ns = (entry.namespace || '').toLowerCase();
        const raw = (entry.raw || '').toLowerCase();
        const matches = wf.includes(markerLower) || op.includes(markerLower) || ns.includes(markerLower) || raw.includes(`[${markerLower}`) || raw.includes(markerLower);
        if (!matches) return false;
      }

      // Search filter
      if (hasEffectiveSearch) {
        let match = false;
        if (searchRegex) {
          match = searchRegex.test(entry.raw) ||
            Boolean(entry.message && searchRegex.test(entry.message)) ||
            Boolean(entry.datetime && searchRegex.test(entry.datetime)) ||
            Boolean(entry.pid && searchRegex.test(entry.pid)) ||
            Boolean(entry.tid && searchRegex.test(entry.tid)) ||
            Boolean(entry.workflow && searchRegex.test(entry.workflow)) ||
            Boolean(entry.operation && searchRegex.test(entry.operation)) ||
            Boolean(entry.correlationId && searchRegex.test(entry.correlationId)) ||
            Boolean(entry.trace?.raw && searchRegex.test(entry.trace.raw));
        } else {
          if (query.caseSensitive) {
            match = entry.raw.includes(literalSearchExact) ||
              Boolean(entry.message && entry.message.includes(literalSearchExact)) ||
              Boolean(entry.datetime && entry.datetime.includes(literalSearchExact)) ||
              Boolean(entry.pid && entry.pid.includes(literalSearchExact)) ||
              Boolean(entry.tid && entry.tid.includes(literalSearchExact));
          } else {
            match = entry.raw.toLowerCase().includes(literalSearchLower) ||
              Boolean(entry.message && entry.message.toLowerCase().includes(literalSearchLower)) ||
              Boolean(entry.datetime && entry.datetime.toLowerCase().includes(literalSearchLower)) ||
              Boolean(entry.pid && entry.pid.toLowerCase().includes(literalSearchLower)) ||
              Boolean(entry.tid && entry.tid.toLowerCase().includes(literalSearchLower));
          }
        }

        if (query.invert ? match : !match) return false;
      }

      return true;
    });
  }

  // 4. Sort entries
  const sortBy = query.sortBy || 'time';
  const direction = query.direction || 'desc';
  const multiplier = direction === 'asc' ? 1 : -1;

  let sorted: LogEntry[];

  // Fast path for line/time ordering when single source (already in ascending line/time order)
  if (requestedIds.length === 1 && (sortBy === 'time' || sortBy === 'line')) {
    if (direction === 'asc') {
      sorted = filtered;
    } else {
      sorted = filtered.slice().reverse();
    }
  } else {
    sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'marker') {
        const mA = a.workflow || '';
        const mB = b.workflow || '';
        const cmp = mA.localeCompare(mB);
        if (cmp !== 0) return cmp * multiplier;
        return (a.lineNumber - b.lineNumber) * multiplier;
      }
      if (sortBy === 'namespace') {
        const nA = a.namespace || '';
        const nB = b.namespace || '';
        const cmp = nA.localeCompare(nB);
        if (cmp !== 0) return cmp * multiplier;
        return (a.lineNumber - b.lineNumber) * multiplier;
      }
      if (sortBy === 'duration') {
        const dA = parseDurationMs(a.duration);
        const dB = parseDurationMs(b.duration);
        if (dA !== dB) return (dA - dB) * multiplier;
        return (a.lineNumber - b.lineNumber) * multiplier;
      }
      if (sortBy === 'line') {
        return (a.lineNumber - b.lineNumber) * multiplier;
      }
      // default: time
      const tA = a.timestamp || a.lineNumber;
      const tB = b.timestamp || b.lineNumber;
      return (tA - tB) * multiplier;
    });
  }

  // 5. Paginate
  const page = query.page || 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 25000;
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;
  const paginatedEntries = sorted.slice(offset, offset + pageSize);

  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

  // Record metrics
  metrics.recordQuery(durationMs, {
    sourceIds: requestedIds,
    search: query.search,
    isRegex: query.isRegex,
    matchedCount: total,
    totalCount: allEntries.length,
  });

  return {
    entries: paginatedEntries,
    total,
    page,
    pageSize,
    totalPages,
    levelCounts,
    workflowCounts,
    operationCounts,
    correlationCounts,
    durationMs,
  };
}

export function getContextLines(
  sourceId: string,
  lineNumber: number,
  radius = 10
): { lines: { number: number; content: string; isTarget: boolean }[]; sourceName?: string; totalLines?: number } {
  let source = findSourceById(sourceId);
  if (!source && sourceId) {
    const sources = getSources();
    source = sources.find(
      (s) =>
        s.name.toLowerCase() === sourceId.toLowerCase() ||
        s.path.toLowerCase().endsWith(sourceId.toLowerCase()) ||
        sourceId.toLowerCase().includes(s.id.toLowerCase())
    );
  }

  // Fallback: if not found by ID or filename, search sources for one containing that lineNumber
  if (!source) {
    const sources = getSources();
    for (const s of sources) {
      const resolved = path.isAbsolute(s.path) ? s.path : path.resolve(process.cwd(), s.path);
      if (fs.existsSync(resolved)) {
        const lineCount = (fs.readFileSync(resolved, 'utf-8').match(/\n/g) || []).length + 1;
        if (lineCount >= lineNumber) {
          source = s;
          break;
        }
      }
    }
  }

  if (!source) {
    return { lines: [], sourceName: sourceId, totalLines: 0 };
  }

  const resolvedPath = path.isAbsolute(source.path)
    ? source.path
    : path.resolve(process.cwd(), source.path);

  if (!fs.existsSync(resolvedPath)) {
    return { lines: [], sourceName: source.name, totalLines: 0 };
  }

  const rawLines = fs.readFileSync(resolvedPath, 'utf-8').split(/\r?\n/);
  const start = Math.max(0, lineNumber - 1 - radius);
  const end = Math.min(rawLines.length, lineNumber - 1 + radius + 1);

  const lines = [];
  for (let i = start; i < end; i++) {
    lines.push({
      number: i + 1,
      content: rawLines[i],
      isTarget: i + 1 === lineNumber,
    });
  }

  return { lines, sourceName: source.name, totalLines: rawLines.length };
}

export function clearFileCache(sourcePath?: string) {
  if (sourcePath) {
    fileCache.delete(sourcePath);
  } else {
    fileCache.clear();
  }
}
