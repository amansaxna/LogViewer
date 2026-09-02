import fs from 'node:fs';
import path from 'node:path';
import { LogEntry, LogLevel, LogQuery, LogQueryResult } from './types.ts';
import { parseLogLines } from './parser.ts';
import { findSourceById } from './config.ts';

// Simple in-memory cache for parsed entries per source with mtime invalidation
interface CacheEntry {
  mtimeMs: number;
  size: number;
  entries: LogEntry[];
}

const fileCache: Map<string, CacheEntry> = new Map();

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
  const source = findSourceById(sourceId);
  if (!source) {
    throw new Error(`Log source not found: ${sourceId}`);
  }

  const resolvedPath = path.isAbsolute(source.path)
    ? source.path
    : path.resolve(process.cwd(), source.path);

  if (!fs.existsSync(resolvedPath)) {
    return [];
  }

  const stats = fs.statSync(resolvedPath);
  const cached = fileCache.get(resolvedPath);

  if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
    return cached.entries;
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const entries = parseLogLines(content);

  fileCache.set(resolvedPath, {
    mtimeMs: stats.mtimeMs,
    size: stats.size,
    entries,
  });

  return entries;
}

export function queryLogs(query: LogQuery): LogQueryResult {
  const startTime = performance.now();
  const allEntries = getEntriesForSource(query.sourceId);

  // 1. Calculate overall level counts
  const levelCounts: Record<string, number> = {
    all: allEntries.length,
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

  for (const entry of allEntries) {
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

  // 2. Prepare search regular expression if any
  let searchRegex: RegExp | null = null;
  if (query.search && query.search.trim().length > 0) {
    const rawPattern = query.search.trim();
    const flags = query.caseSensitive ? '' : 'i';
    try {
      if (query.isRegex) {
        searchRegex = new RegExp(rawPattern, flags);
      } else {
        // Escape special regex chars
        const escaped = rawPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        searchRegex = new RegExp(escaped, flags);
      }
    } catch {
      // Fallback to literal search if regex is invalid
      searchRegex = new RegExp(rawPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    }
  }

  // 3. Filter entries
  const selectedLevels = query.levels && query.levels.length > 0 ? new Set(query.levels) : null;
  const excludedLevels = query.excludeLevels && query.excludeLevels.length > 0 ? new Set(query.excludeLevels) : null;

  const filtered = allEntries.filter((entry) => {
    // Negative Level Filter (e.g. do not want Error logs)
    if (excludedLevels && excludedLevels.has(entry.level)) {
      return false;
    }

    // Positive Level filter
    if (selectedLevels && !selectedLevels.has(entry.level)) {
      return false;
    }

    // Start Date filter
    if (query.startDate) {
      const startMs = Date.parse(query.startDate);
      if (!isNaN(startMs) && entry.timestamp && entry.timestamp < startMs) {
        return false;
      }
    }

    // End Date filter
    if (query.endDate) {
      const endMs = Date.parse(query.endDate);
      if (!isNaN(endMs) && entry.timestamp && entry.timestamp > endMs) {
        return false;
      }
    }

    // Namespace filter
    if (query.namespace && (!entry.namespace || !entry.namespace.toLowerCase().includes(query.namespace.toLowerCase()))) {
      return false;
    }

    // Workflow filter
    if (query.workflow && query.workflow.trim().length > 0) {
      const wf = query.workflow.trim().toLowerCase();
      if (!entry.workflow || !entry.workflow.toLowerCase().includes(wf)) {
        return false;
      }
    }

    // Operation filter
    if (query.operation && query.operation.trim().length > 0) {
      const op = query.operation.trim().toLowerCase();
      if (!entry.operation || !entry.operation.toLowerCase().includes(op)) {
        return false;
      }
    }

    // Marker filter
    if (query.marker && query.marker.trim().length > 0) {
      const mQuery = query.marker.trim().toLowerCase();
      if (!entry.workflow || !entry.workflow.toLowerCase().includes(mQuery)) {
        return false;
      }
    }

    // Correlation ID filter
    if (query.correlationId && query.correlationId.trim().length > 0) {
      const cQuery = query.correlationId.trim().toLowerCase();
      if (!entry.correlationId || !entry.correlationId.toLowerCase().includes(cQuery)) {
        return false;
      }
    }

    // Search query match
    if (searchRegex) {
      const match = searchRegex.test(entry.raw) ||
        Boolean(entry.message && searchRegex.test(entry.message)) ||
        Boolean(entry.namespace && searchRegex.test(entry.namespace)) ||
        Boolean(entry.workflow && searchRegex.test(entry.workflow)) ||
        Boolean(entry.operation && searchRegex.test(entry.operation)) ||
        Boolean(entry.fileLocation && searchRegex.test(entry.fileLocation)) ||
        Boolean(entry.trace?.raw && searchRegex.test(entry.trace.raw));

      if (query.invert ? match : !match) {
        return false;
      }
    }

    return true;
  });

  // 4. Sort entries
  const sortBy = query.sortBy || 'time';
  const direction = query.direction || 'desc';
  const multiplier = direction === 'asc' ? 1 : -1;

  const sorted = [...filtered].sort((a, b) => {
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

  // 5. Paginate (or return full set if pageSize is <= 0 or very large for virtualized scrolling)
  const page = query.page || 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 25000;
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;
  const paginatedEntries = sorted.slice(offset, offset + pageSize);

  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

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

export function getContextLines(sourceId: string, lineNumber: number, radius = 10): { lines: { number: number; content: string; isTarget: boolean }[] } {
  const source = findSourceById(sourceId);
  if (!source) {
    throw new Error(`Log source not found: ${sourceId}`);
  }

  const resolvedPath = path.isAbsolute(source.path)
    ? source.path
    : path.resolve(process.cwd(), source.path);

  if (!fs.existsSync(resolvedPath)) {
    return { lines: [] };
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

  return { lines };
}

export function clearFileCache(sourcePath?: string) {
  if (sourcePath) {
    fileCache.delete(sourcePath);
  } else {
    fileCache.clear();
  }
}
