import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import {
  LogEntry,
  LogLevel,
  LogQuery,
  LogQueryResult,
  LogSource,
  LogPreset,
  SortOption,
} from '../../server/types.ts';
import { parseLogLines } from '../../server/parser.ts';
import { detectRotation } from '../../server/config.ts';

// Palette for multi-source coloring
const SOURCE_PALETTE = ['#38bdf8', '#a855f7', '#f43f5e', '#34d399', '#fbbf24', '#f97316'];

interface CacheEntry {
  mtimeMs: number;
  size: number;
  entries: LogEntry[];
}

export class LogService {
  private sources: Map<string, LogSource> = new Map();
  private fileCache: Map<string, CacheEntry> = new Map();
  private watchers: Map<string, { interval: NodeJS.Timeout; lastSize: number; listeners: Set<(added: number) => void> }> = new Map();
  private presets: LogPreset[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.initBuiltInPresets();
  }

  private initBuiltInPresets() {
    this.presets = [
      {
        id: 'errors-and-crashes',
        name: 'Errors & Crashes',
        description: 'Instant isolation of all critical, error, and emergency logs with active stack traces.',
        isBuiltIn: true,
        rules: {
          levels: ['emergency', 'critical', 'error'],
          sortOption: 'time-desc',
          showDatetime: true,
          showCorrelation: true,
        },
      },
      {
        id: 'slow-operations',
        name: 'Slow Operations (>500ms)',
        description: 'Performance triage focusing on high latency execution steps and slow HTTP requests.',
        isBuiltIn: true,
        rules: {
          sortOption: 'duration-desc',
          search: 'ms|s',
          isRegex: true,
          showDatetime: true,
        },
      },
      {
        id: 'security-audit',
        name: 'Security & Auth',
        description: 'Audit trails, permission checks, authentication tokens, and access evaluations.',
        isBuiltIn: true,
        rules: {
          levels: ['audit', 'warning', 'error'],
          workflow: 'auth',
          sortOption: 'time-desc',
          showCorrelation: true,
        },
      },
      {
        id: 'warnings-and-retries',
        name: 'Warnings & Retries',
        description: 'Transient failures, network retries, timeouts, and degradation warnings.',
        isBuiltIn: true,
        rules: {
          levels: ['warning', 'notice'],
          sortOption: 'time-desc',
        },
      },
    ];
  }

  /**
   * Scans workspace folders for log files and registers them.
   */
  public async scanWorkspace(): Promise<LogSource[]> {
    const logFiles = await vscode.workspace.findFiles('**/*.{log,txt}', '**/node_modules/**', 100);

    for (const fileUri of logFiles) {
      const fsPath = fileUri.fsPath;
      try {
        if (!fs.existsSync(fsPath)) continue;
        const stats = fs.statSync(fsPath);
        if (stats.isDirectory()) continue;

        const fileName = path.basename(fsPath);
        const folderName = path.dirname(fsPath);
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
        const relDir = workspaceFolder
          ? path.relative(workspaceFolder.uri.fsPath, folderName) || 'Root Workspace'
          : path.basename(folderName);

        const id = crypto.createHash('md5').update(fsPath).digest('hex').slice(0, 10);
        const rot = detectRotation(fileName);

        const source: LogSource = {
          id,
          name: fileName,
          category: `Workspace: ${relDir}`,
          path: fsPath,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          exists: true,
          isRotated: rot.isRotated,
          rotationSuffix: rot.isRotated ? rot.suffix : undefined,
        };

        this.sources.set(id, source);
      } catch (err) {
        console.warn('Error reading file stat in scanWorkspace:', fsPath, err);
      }
    }

    return this.getAllSources();
  }

  /**
   * Registers a specific file (e.g. opened in custom editor or via file dialog).
   */
  public registerSource(filePath: string, customName?: string, category = 'Custom / Opened Files'): LogSource {
    const resolved = path.resolve(filePath);
    const id = crypto.createHash('md5').update(resolved).digest('hex').slice(0, 10);
    const fileName = customName || path.basename(resolved);
    const rot = detectRotation(fileName);

    let size = 0;
    let modifiedAt: string | undefined;
    let exists = false;

    if (fs.existsSync(resolved)) {
      exists = true;
      const stats = fs.statSync(resolved);
      size = stats.size;
      modifiedAt = stats.mtime.toISOString();
    }

    const source: LogSource = {
      id,
      name: fileName,
      category,
      path: resolved,
      size,
      modifiedAt,
      exists,
      isCustom: true,
      isRotated: rot.isRotated,
      rotationSuffix: rot.isRotated ? rot.suffix : undefined,
    };

    this.sources.set(id, source);
    return source;
  }

  public removeSource(id: string): boolean {
    return this.sources.delete(id);
  }

  public getSourceById(id: string): LogSource | undefined {
    return this.sources.get(id);
  }

  /**
   * Returns all active sources, grouping rotated files under parent log sources.
   */
  public getAllSources(): LogSource[] {
    const all = Array.from(this.sources.values());
    const parents: LogSource[] = [];
    const rotationsByBase = new Map<string, LogSource[]>();

    for (const src of all) {
      if (src.isRotated) {
        const baseName = detectRotation(src.name).baseName;
        const key = `${src.category}:${baseName}`;
        if (!rotationsByBase.has(key)) {
          rotationsByBase.set(key, []);
        }
        rotationsByBase.get(key)!.push(src);
      } else {
        parents.push(src);
      }
    }

    for (const parent of parents) {
      const key = `${parent.category}:${parent.name}`;
      if (rotationsByBase.has(key)) {
        parent.rotations = rotationsByBase.get(key);
        rotationsByBase.delete(key);
      }
    }

    // Rotations without direct parents
    for (const [, orphanRots] of rotationsByBase) {
      parents.push(...orphanRots);
    }

    return parents;
  }

  /**
   * Retrieves and parses entries for a source ID with mtime caching.
   */
  public getEntriesForSource(sourceId: string): LogEntry[] {
    const source = this.sources.get(sourceId);
    if (!source) return [];

    if (!fs.existsSync(source.path)) return [];

    const stats = fs.statSync(source.path);
    const cached = this.fileCache.get(source.path);

    if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
      return cached.entries;
    }

    const content = fs.readFileSync(source.path, 'utf-8');
    const parsed = parseLogLines(content);
    const entries = parsed.map((e) => ({
      ...e,
      sourceId: source.id,
      sourceName: source.name || sourceId,
    }));

    this.fileCache.set(source.path, {
      mtimeMs: stats.mtimeMs,
      size: stats.size,
      entries,
    });

    return entries;
  }

  /**
   * Query logs with multi-source merging, filters, text/regex search, and sorting.
   */
  public query(query: LogQuery): LogQueryResult {
    const startTime = performance.now();

    const requestedIds = query.sourceIds && query.sourceIds.length > 0
      ? query.sourceIds.filter(Boolean)
      : [query.sourceId].filter(Boolean);

    let allEntries: LogEntry[] = [];

    if (requestedIds.length === 1) {
      allEntries = this.getEntriesForSource(requestedIds[0]);
    } else {
      requestedIds.forEach((srcId, idx) => {
        const sourceColor = SOURCE_PALETTE[idx % SOURCE_PALETTE.length];
        const rawEntries = this.getEntriesForSource(srcId);
        for (let i = 0; i < rawEntries.length; i++) {
          const item = rawEntries[i];
          allEntries.push({ ...item, sourceColor });
        }
      });
    }

    // 1. Level & dimension counts
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

    // 2. Search regex
    let searchRegex: RegExp | null = null;
    if (query.search && query.search.trim().length > 0) {
      const rawPattern = query.search.trim();
      const flags = query.caseSensitive ? '' : 'i';
      try {
        if (query.isRegex) {
          searchRegex = new RegExp(rawPattern, flags);
        } else {
          const escaped = rawPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          searchRegex = new RegExp(escaped, flags);
        }
      } catch {
        searchRegex = new RegExp(rawPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      }
    }

    // 3. Filter
    const selectedLevels = query.levels && query.levels.length > 0 ? new Set(query.levels) : null;
    const excludedLevels = query.excludeLevels && query.excludeLevels.length > 0 ? new Set(query.excludeLevels) : null;

    const filtered = allEntries.filter((entry) => {
      if (excludedLevels && excludedLevels.has(entry.level)) return false;
      if (selectedLevels && !selectedLevels.has(entry.level)) return false;

      if (query.startDate) {
        const startMs = Date.parse(query.startDate);
        if (!isNaN(startMs) && entry.timestamp && entry.timestamp < startMs) return false;
      }
      if (query.endDate) {
        const endMs = Date.parse(query.endDate);
        if (!isNaN(endMs) && entry.timestamp && entry.timestamp > endMs) return false;
      }

      if (query.namespace && (!entry.namespace || !entry.namespace.toLowerCase().includes(query.namespace.toLowerCase()))) {
        return false;
      }
      if (query.workflow) {
        const wf = query.workflow.trim().toLowerCase();
        if (!entry.workflow || !entry.workflow.toLowerCase().includes(wf)) return false;
      }
      if (query.operation) {
        const op = query.operation.trim().toLowerCase();
        if (!entry.operation || !entry.operation.toLowerCase().includes(op)) return false;
      }
      if (query.correlationId) {
        const corr = query.correlationId.trim().toLowerCase();
        if (!entry.correlationId || !entry.correlationId.toLowerCase().includes(corr)) return false;
      }

      if (searchRegex) {
        const textToMatch = `${entry.raw} ${entry.message} ${entry.fileLocation || ''}`;
        const matched = searchRegex.test(textToMatch);
        if (query.invert ? matched : !matched) return false;
      }

      return true;
    });

    // 4. Sorting
    const sort = (query.sortBy || 'time') as string;
    const direction = query.direction || 'desc';
    const isAsc = direction === 'asc';

    filtered.sort((a, b) => {
      if (sort === 'time') {
        const tA = a.timestamp || 0;
        const tB = b.timestamp || 0;
        if (tA !== tB) return isAsc ? tA - tB : tB - tA;
        return isAsc ? a.lineNumber - b.lineNumber : b.lineNumber - a.lineNumber;
      }
      if (sort === 'line') {
        return isAsc ? a.lineNumber - b.lineNumber : b.lineNumber - a.lineNumber;
      }
      if (sort === 'duration') {
        const parseDur = (d?: string) => {
          if (!d) return 0;
          const m = d.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|µs|us|ns)?$/i);
          if (!m) return 0;
          const val = parseFloat(m[1]);
          const unit = (m[2] || 'ms').toLowerCase();
          if (unit === 's') return val * 1000;
          if (unit === 'm') return val * 60000;
          if (unit === 'µs' || unit === 'us') return val / 1000;
          return val;
        };
        const dA = parseDur(a.duration);
        const dB = parseDur(b.duration);
        return isAsc ? dA - dB : dB - dA;
      }
      return 0;
    });

    // 5. Pagination
    const page = query.page || 1;
    const pageSize = query.pageSize || 25000;
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      entries: paginated,
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.ceil(filtered.length / pageSize),
      levelCounts,
      workflowCounts,
      operationCounts,
      correlationCounts,
      durationMs,
    };
  }

  /**
   * Retrieves context surrounding a specific line.
   */
  public getContextLines(sourceId: string, lineNumber: number, radius = 10) {
    const source = this.sources.get(sourceId);
    if (!source || !fs.existsSync(source.path)) {
      return { lines: [], sourceName: source?.name || sourceId, targetLineNumber: lineNumber };
    }

    const content = fs.readFileSync(source.path, 'utf-8');
    const rawLines = content.split('\n');
    const minLine = Math.max(1, lineNumber - radius);
    const maxLine = Math.min(rawLines.length, lineNumber + radius);

    const lines = [];
    for (let i = minLine; i <= maxLine; i++) {
      lines.push({
        number: i,
        content: rawLines[i - 1],
        isTarget: i === lineNumber,
      });
    }

    return {
      lines,
      sourceName: source.name,
      targetLineNumber: lineNumber,
      radius,
      totalLines: rawLines.length,
    };
  }

  /**
   * Subscribes to file additions for live tailing.
   */
  public subscribeTail(sourceId: string, callback: (added: number) => void): () => void {
    const source = this.sources.get(sourceId);
    if (!source || !fs.existsSync(source.path)) {
      return () => {};
    }

    let watcher = this.watchers.get(sourceId);
    if (!watcher) {
      let lastSize = 0;
      try {
        lastSize = fs.statSync(source.path).size;
      } catch {}

      const listeners = new Set<(added: number) => void>();
      const interval = setInterval(() => {
        try {
          if (!fs.existsSync(source.path)) return;
          const stat = fs.statSync(source.path);
          if (stat.size > lastSize) {
            lastSize = stat.size;
            listeners.forEach((fn) => fn(1));
          }
        } catch {}
      }, 500);

      watcher = { interval, lastSize, listeners };
      this.watchers.set(sourceId, watcher);
    }

    watcher.listeners.add(callback);

    return () => {
      const w = this.watchers.get(sourceId);
      if (w) {
        w.listeners.delete(callback);
        if (w.listeners.size === 0) {
          clearInterval(w.interval);
          this.watchers.delete(sourceId);
        }
      }
    };
  }

  public getPresets(): LogPreset[] {
    return this.presets;
  }

  public savePreset(preset: LogPreset): LogPreset {
    const existingIdx = this.presets.findIndex((p) => p.id === preset.id);
    if (existingIdx >= 0) {
      this.presets[existingIdx] = preset;
    } else {
      this.presets.push(preset);
    }
    return preset;
  }

  public deletePreset(id: string): boolean {
    const prevLen = this.presets.length;
    this.presets = this.presets.filter((p) => p.id !== id);
    return this.presets.length < prevLen;
  }

  /**
   * Router to handle all frontend API requests inside the extension host.
   */
  public async handleApiRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const [pathPart, queryPart] = endpoint.split('?');
    const queryParams = new URLSearchParams(queryPart || '');

    if (pathPart === '/api/sources' && method === 'GET') {
      const sources = this.getAllSources();
      return { sources };
    }

    if (pathPart === '/api/sources/open' && method === 'POST') {
      const { path: filePath, name, category } = body || {};
      if (!filePath) throw new Error('File path is required');
      const source = this.registerSource(filePath, name, category);
      return { source, message: `Successfully opened ${source.name}` };
    }

    if (pathPart.startsWith('/api/sources/') && method === 'DELETE') {
      const id = pathPart.replace('/api/sources/', '');
      const removed = this.removeSource(id);
      return { success: removed };
    }

    if (pathPart === '/api/presets' && method === 'GET') {
      return { presets: this.getPresets() };
    }

    if (pathPart === '/api/presets' && method === 'POST') {
      const preset = this.savePreset(body);
      return { preset, message: `Saved preset "${preset.name}"` };
    }

    if (pathPart.startsWith('/api/presets/') && method === 'DELETE') {
      const id = pathPart.replace('/api/presets/', '');
      const deleted = this.deletePreset(decodeURIComponent(id));
      return { success: deleted };
    }

    if (pathPart === '/api/logs/entries' && method === 'GET') {
      const sourceIdsParam = queryParams.get('sourceIds');
      const sourceIds = sourceIdsParam ? sourceIdsParam.split(',').filter(Boolean) : undefined;
      const sourceId = queryParams.get('sourceId') || (sourceIds && sourceIds[0]) || '';

      const levelsParam = queryParams.get('levels');
      const levels = levelsParam ? (levelsParam.split(',').filter(Boolean) as LogLevel[]) : undefined;

      const excludeLevelsParam = queryParams.get('excludeLevels');
      const excludeLevels = excludeLevelsParam ? (excludeLevelsParam.split(',').filter(Boolean) as LogLevel[]) : undefined;

      const query: LogQuery = {
        sourceId,
        sourceIds,
        search: queryParams.get('search') || undefined,
        isRegex: queryParams.get('isRegex') === 'true',
        caseSensitive: queryParams.get('caseSensitive') === 'true',
        invert: queryParams.get('invert') === 'true',
        levels,
        excludeLevels,
        startDate: queryParams.get('startDate') || undefined,
        endDate: queryParams.get('endDate') || undefined,
        namespace: queryParams.get('namespace') || undefined,
        workflow: queryParams.get('workflow') || undefined,
        operation: queryParams.get('operation') || undefined,
        correlationId: queryParams.get('correlationId') || undefined,
        sortBy: (queryParams.get('sortBy') as any) || 'time',
        direction: (queryParams.get('direction') as 'desc' | 'asc') || 'desc',
        page: queryParams.get('page') ? parseInt(queryParams.get('page')!, 10) : 1,
        pageSize: queryParams.get('pageSize') ? parseInt(queryParams.get('pageSize')!, 10) : 25000,
      };

      return this.query(query);
    }

    if (pathPart === '/api/logs/context' && method === 'GET') {
      const sourceId = queryParams.get('sourceId') || '';
      const lineNumber = parseInt(queryParams.get('lineNumber') || '0', 10);
      const radius = parseInt(queryParams.get('radius') || '10', 10);
      return this.getContextLines(sourceId, lineNumber, radius);
    }

    if (pathPart === '/api/logs/paste' && method === 'POST') {
      const { text, name } = body || {};
      if (!text) throw new Error('Text content is required');
      const tempPath = path.join(this.context.globalStorageUri.fsPath, `pasted_${Date.now()}.log`);
      fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      fs.writeFileSync(tempPath, text, 'utf-8');
      const source = this.registerSource(tempPath, name || 'Pasted Logs', 'Pasted Logs');
      return { source, message: 'Logs saved and opened' };
    }

    throw new Error(`Unhandled API route: ${method} ${endpoint}`);
  }
}
