import { monitorEventLoopDelay, IntervalHistogram } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';

export interface SystemVitals {
  uptimeSeconds: number;
  heapUsedMb: number;
  heapTotalMb: number;
  heapLimitMb: number;
  rssMb: number;
  externalMb: number;
  heapUsagePercent: number;
  cpuUserSeconds: number;
  cpuSystemSeconds: number;
  activeHandles: number;
}

export interface EventLoopMetrics {
  minMs: number;
  meanMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

export interface CacheMetrics {
  totalLookups: number;
  hits: number;
  misses: number;
  hitRatioPercent: number;
  evictions: number;
  cachedSourcesCount: number;
  cachedEntriesTotal: number;
  estimatedMemoryMb: number;
  missReasons: {
    initial_load: number;
    file_modified: number;
    evicted_lru: number;
    not_found: number;
  };
}

export interface QuerySlaMetrics {
  totalQueries: number;
  queriesLastMinute: number;
  throughputQps: number;
  avgDurationMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  slowQueriesCount: number; // > 50ms
  criticalQueriesCount: number; // > 200ms
  errorCount: number;
  errorRatePercent: number;
}

export interface SlowQueryRecord {
  id: string;
  timestamp: string;
  durationMs: number;
  sourceIds: string[];
  search?: string;
  isRegex?: boolean;
  matchedCount: number;
  totalCount: number;
}

export interface IncidentRecord {
  id: string;
  timestamp: string;
  category: 'crash' | 'file_load_failure' | 'stream_drop' | 'flicker_burst' | 'slow_query' | 'memory_pressure' | 'client_error' | 'react_error';
  severity: 'warning' | 'error' | 'critical';
  source: 'server' | 'client' | 'file_reader' | 'stream_engine' | 'react_ui';
  message: string;
  details?: {
    path?: string;
    sourceId?: string;
    reason?: string;
    stack?: string;
    panelId?: string;
    durationMs?: number;
    fileSizeMb?: number;
    componentStack?: string;
    url?: string;
    [key: string]: any;
  };
}

export interface FileLoadFailureRecord {
  timestamp: string;
  sourceId: string;
  path: string;
  reason: 'not_found' | 'permission_denied' | 'parse_error' | 'empty_file' | 'timeout' | 'read_error' | 'unknown';
  error: string;
}

export interface FileLoadTelemetry {
  totalAttempts: number;
  successfulLoads: number;
  failedLoads: number;
  failureRatePercent: number;
  avgLoadTimeMs: number;
  p95LoadTimeMs: number;
  maxLoadTimeMs: number;
  slowestLoadedFile: {
    path: string;
    sourceId: string;
    durationMs: number;
    sizeBytes: number;
    linesCount: number;
  } | null;
  recentFailures: FileLoadFailureRecord[];
  malformedLinesCount: number;
}

export interface StabilityTelemetry {
  serverCrashesCount: number;
  clientErrorsCount: number;
  streamDropsCount: number;
  streamReconnectionsCount: number;
  abortedQueriesCount: number;
  flickerBurstCount: number;
  lastIncidentTimestamp: string | null;
}

export type HealthStatus = 'OPTIMAL' | 'DEGRADED' | 'CRITICAL';

export interface HealthDiagnostic {
  type: 'info' | 'warning' | 'critical';
  component: 'event_loop' | 'memory' | 'cache' | 'query_sla' | 'error_rate' | 'file_loading' | 'stability';
  message: string;
  recommendation: string;
}

export interface TelemetryStorageInfo {
  enabled: boolean;
  directory: string;
  currentFile: string;
  currentFileSizeBytes: number;
  currentFileSizeMb: number;
  maxCapMb: number;
  maxCapBytes: number;
  totalDirSizeBytes: number;
  totalDirSizeMb: number;
  totalFilesCount: number;
}

export interface ApplicationHealthReport {
  timestamp: string;
  status: HealthStatus;
  healthScore: number; // 0 - 100
  isOptimal: boolean;
  vitals: SystemVitals;
  eventLoop: EventLoopMetrics;
  cache: CacheMetrics;
  querySla: QuerySlaMetrics;
  fileLoading: FileLoadTelemetry;
  stability: StabilityTelemetry;
  incidents: IncidentRecord[];
  diagnostics: HealthDiagnostic[];
  recentSlowQueries: SlowQueryRecord[];
  activeStreamsCount: number;
  ingestionRateLinesPerSec: number;
  storage: TelemetryStorageInfo;
}

class MetricsManager {
  private elHistogram: IntervalHistogram | null = null;
  private queryDurations: number[] = [];
  private maxDurationSamples = 1000;
  
  // Cache tracking
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheEvictions = 0;
  private missReasons = {
    initial_load: 0,
    file_modified: 0,
    evicted_lru: 0,
    not_found: 0,
  };

  // Query & Requests tracking
  private totalQueries = 0;
  private errorCount = 0;
  private slowQueries: SlowQueryRecord[] = [];
  private maxSlowQueries = 30;
  private queryTimestamps: number[] = [];

  // File Loading Telemetry
  private fileLoadAttempts = 0;
  private successfulLoads = 0;
  private failedLoads = 0;
  private fileLoadDurations: number[] = [];
  private slowestLoadedFile: {
    path: string;
    sourceId: string;
    durationMs: number;
    sizeBytes: number;
    linesCount: number;
  } | null = null;
  private recentFileFailures: FileLoadFailureRecord[] = [];
  private malformedLinesCount = 0;

  // Stability & Incident Tracking
  private serverCrashesCount = 0;
  private clientErrorsCount = 0;
  private streamDropsCount = 0;
  private streamReconnectionsCount = 0;
  private abortedQueriesCount = 0;
  private flickerBurstCount = 0;
  private lastIncidentTimestamp: string | null = null;
  private incidents: IncidentRecord[] = [];
  private maxIncidents = 50;

  // Ingestion tracking
  private ingestedLinesLastMinute: { timestamp: number; count: number }[] = [];
  private activeStreams = 0;

  // External cache stats provider hook
  private cacheStatsProvider: () => { sourcesCount: number; entriesTotal: number; memoryMb: number } = () => ({
    sourcesCount: 0,
    entriesTotal: 0,
    memoryMb: 0,
  });

  private diskLoggerInterval: NodeJS.Timeout | null = null;
  private telemetryDir = path.resolve(process.cwd(), 'logs', 'telemetry');
  private maxTelemetryCapBytes = 1024 * 1024 * 1024; // 1 GB (1024 MB)
  private isDiskLoggingEnabled = true;

  constructor() {
    this.initEventLoopMonitor();
    this.initDiskLogger();
    this.initProcessCrashHooks();
  }

  private initProcessCrashHooks() {
    // Process-level unhandled exception hook
    process.on('uncaughtException', (err) => {
      this.serverCrashesCount++;
      this.recordIncident(
        'crash',
        'critical',
        'server',
        `Uncaught Server Exception: ${err?.message || err}`,
        { stack: err?.stack }
      );
      console.error('[Telemetry] Uncaught Exception intercepted:', err);
    });

    process.on('unhandledRejection', (reason: any) => {
      this.serverCrashesCount++;
      this.recordIncident(
        'crash',
        'critical',
        'server',
        `Unhandled Promise Rejection: ${reason?.message || reason}`,
        { stack: reason?.stack }
      );
      console.error('[Telemetry] Unhandled Rejection intercepted:', reason);
    });
  }

  private initDiskLogger() {
    try {
      if (!fs.existsSync(this.telemetryDir)) {
        fs.mkdirSync(this.telemetryDir, { recursive: true });
      }
      // Periodic snapshot persistence every 10 seconds
      this.diskLoggerInterval = setInterval(() => {
        this.persistTelemetrySnapshot();
      }, 10000);
      if (this.diskLoggerInterval.unref) {
        this.diskLoggerInterval.unref();
      }
    } catch (e) {
      console.warn('[Metrics] Failed to initialize persistent disk logger:', e);
    }
  }

  public persistTelemetrySnapshot() {
    if (!this.isDiskLoggingEnabled) return;
    try {
      if (!fs.existsSync(this.telemetryDir)) {
        fs.mkdirSync(this.telemetryDir, { recursive: true });
      }

      const report = this.getHealthReport();
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const filePath = path.join(this.telemetryDir, `metrics_${dateStr}.jsonl`);

      const record =
        JSON.stringify({
          timestamp: report.timestamp,
          healthScore: report.healthScore,
          status: report.status,
          isOptimal: report.isOptimal,
          vitals: report.vitals,
          eventLoop: report.eventLoop,
          cache: report.cache,
          querySla: report.querySla,
          fileLoading: report.fileLoading,
          stability: report.stability,
          diagnosticsCount: report.diagnostics.length,
          recentIncidentsCount: report.incidents.length,
          slowQueriesCount: report.recentSlowQueries.length,
          ingestionRateLinesPerSec: report.ingestionRateLinesPerSec,
        }) + '\n';

      const recordBytes = Buffer.byteLength(record, 'utf-8');

      // Check current file size against 1GB threshold
      let currentSize = 0;
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        currentSize = stat.size;
      }

      // If exceeding 1 GB, truncate file to 0 and add new data on top with rollover marker
      if (currentSize + recordBytes > this.maxTelemetryCapBytes) {
        const rolloverMarker =
          JSON.stringify({
            type: 'system_rollover',
            message: `Telemetry log reached 1GB threshold (${(currentSize / 1024 / 1024).toFixed(2)} MB) - truncated to maintain <= 1GB disk boundary`,
            timestamp: new Date().toISOString(),
          }) + '\n';
        fs.writeFileSync(filePath, rolloverMarker + record, 'utf-8');
      } else {
        fs.appendFileSync(filePath, record, 'utf-8');
      }
    } catch (err) {
      console.error('[Metrics] Failed to write telemetry snapshot to disk:', err);
    }
  }

  public recordIncident(
    category: IncidentRecord['category'],
    severity: IncidentRecord['severity'],
    source: IncidentRecord['source'],
    message: string,
    details?: IncidentRecord['details']
  ) {
    const timestamp = new Date().toISOString();
    this.lastIncidentTimestamp = timestamp;

    const incident: IncidentRecord = {
      id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp,
      category,
      severity,
      source,
      message,
      details,
    };

    this.incidents.unshift(incident);
    if (this.incidents.length > this.maxIncidents) {
      this.incidents.pop();
    }

    // Persist incident directly to issues disk log
    try {
      if (this.isDiskLoggingEnabled) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const issuesPath = path.join(this.telemetryDir, `incidents_${dateStr}.jsonl`);
        const line = JSON.stringify(incident) + '\n';
        fs.appendFileSync(issuesPath, line, 'utf-8');
      }
    } catch (e) {
      console.warn('[Metrics] Failed to write incident to disk:', e);
    }
  }

  public recordFileLoadSuccess(
    sourceId: string,
    filePath: string,
    durationMs: number,
    sizeBytes: number,
    linesCount: number,
    malformedCount = 0
  ) {
    this.fileLoadAttempts++;
    this.successfulLoads++;
    this.fileLoadDurations.push(durationMs);
    if (this.fileLoadDurations.length > 500) {
      this.fileLoadDurations.shift();
    }
    if (malformedCount > 0) {
      this.malformedLinesCount += malformedCount;
    }

    if (!this.slowestLoadedFile || durationMs > this.slowestLoadedFile.durationMs) {
      this.slowestLoadedFile = {
        path: filePath,
        sourceId,
        durationMs: Math.round(durationMs * 100) / 100,
        sizeBytes,
        linesCount,
      };
    }
  }

  public recordFileLoadFailure(
    sourceId: string,
    filePath: string,
    reason: FileLoadFailureRecord['reason'],
    error: string
  ) {
    this.fileLoadAttempts++;
    this.failedLoads++;
    const timestamp = new Date().toISOString();

    const failureRecord: FileLoadFailureRecord = {
      timestamp,
      sourceId,
      path: filePath,
      reason,
      error,
    };

    this.recentFileFailures.unshift(failureRecord);
    if (this.recentFileFailures.length > 30) {
      this.recentFileFailures.pop();
    }

    this.recordIncident(
      'file_load_failure',
      'error',
      'file_reader',
      `Failed to load log source "${sourceId}" (${reason}): ${error}`,
      { path: filePath, sourceId, reason }
    );
  }

  public recordClientEvent(event: {
    type: 'error' | 'unhandled_rejection' | 'flicker_detected' | 'file_load_failed' | 'stream_interrupted' | 'react_error';
    message: string;
    stack?: string;
    panelId?: string;
    context?: any;
  }) {
    if (event.type === 'flicker_detected') {
      this.flickerBurstCount++;
      this.recordIncident(
        'flicker_burst',
        'warning',
        'client',
        `UI Render Thrashing / Rapid Re-fetch Burst detected on panel ${event.panelId || 'global'} (${event.message})`,
        { panelId: event.panelId, stack: event.stack, ...event.context }
      );
      return;
    }

    if (event.type === 'stream_interrupted') {
      this.streamDropsCount++;
      this.recordIncident(
        'stream_drop',
        'warning',
        'stream_engine',
        `Live Stream Connection Dropped: ${event.message}`,
        { panelId: event.panelId, stack: event.stack, ...event.context }
      );
      return;
    }

    this.clientErrorsCount++;
    this.recordIncident(
      event.type === 'react_error' ? 'react_error' : 'client_error',
      'error',
      'client',
      `Client-Side Error: ${event.message}`,
      { panelId: event.panelId, stack: event.stack, ...event.context }
    );
  }

  public recordStreamDrop() {
    this.streamDropsCount++;
  }

  public recordStreamReconnect() {
    this.streamReconnectionsCount++;
  }

  public recordAbortedQuery() {
    this.abortedQueriesCount++;
  }

  public recordFlickerBurst(panelId?: string, burstCount = 1) {
    this.flickerBurstCount += burstCount;
    this.recordIncident(
      'flicker_burst',
      'warning',
      'client',
      `Rapid query burst detected (${burstCount} requests in <1s) on panel ${panelId || '1'}`,
      { panelId, burstCount }
    );
  }

  public clearIncidents() {
    this.incidents = [];
    this.recentFileFailures = [];
  }

  public getTelemetryStorageInfo(): TelemetryStorageInfo {
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const currentFilePath = path.join(this.telemetryDir, `metrics_${dateStr}.jsonl`);
      let currentFileSizeBytes = 0;
      if (fs.existsSync(currentFilePath)) {
        currentFileSizeBytes = fs.statSync(currentFilePath).size;
      }

      let totalDirSizeBytes = 0;
      let totalFilesCount = 0;
      if (fs.existsSync(this.telemetryDir)) {
        const files = fs.readdirSync(this.telemetryDir);
        totalFilesCount = files.length;
        for (const file of files) {
          try {
            const stat = fs.statSync(path.join(this.telemetryDir, file));
            totalDirSizeBytes += stat.size;
          } catch {}
        }
      }

      return {
        enabled: this.isDiskLoggingEnabled,
        directory: this.telemetryDir,
        currentFile: currentFilePath,
        currentFileSizeBytes,
        currentFileSizeMb: Math.round((currentFileSizeBytes / 1024 / 1024) * 100) / 100,
        maxCapMb: 1024,
        maxCapBytes: this.maxTelemetryCapBytes,
        totalDirSizeBytes,
        totalDirSizeMb: Math.round((totalDirSizeBytes / 1024 / 1024) * 100) / 100,
        totalFilesCount,
      };
    } catch {
      return {
        enabled: this.isDiskLoggingEnabled,
        directory: this.telemetryDir,
        currentFile: '',
        currentFileSizeBytes: 0,
        currentFileSizeMb: 0,
        maxCapMb: 1024,
        maxCapBytes: this.maxTelemetryCapBytes,
        totalDirSizeBytes: 0,
        totalDirSizeMb: 0,
        totalFilesCount: 0,
      };
    }
  }

  public stopDiskLogger() {
    if (this.diskLoggerInterval) {
      clearInterval(this.diskLoggerInterval);
      this.diskLoggerInterval = null;
    }
  }

  private initEventLoopMonitor() {
    try {
      this.elHistogram = monitorEventLoopDelay({ resolution: 10 });
      this.elHistogram.enable();
      // Periodically reset histogram window (every 60s) so transient startup lag doesn't linger indefinitely
      setInterval(() => {
        if (this.elHistogram) {
          this.elHistogram.reset();
        }
      }, 60000).unref();
    } catch (e) {
      console.warn('[Metrics] Event loop monitoring not supported on this runtime:', e);
    }
  }

  public registerCacheStatsProvider(provider: () => { sourcesCount: number; entriesTotal: number; memoryMb: number }) {
    this.cacheStatsProvider = provider;
  }

  public recordCacheHit() {
    this.cacheHits++;
  }

  public recordCacheMiss(reason: 'initial_load' | 'file_modified' | 'evicted_lru' | 'not_found' = 'initial_load') {
    this.cacheMisses++;
    if (this.missReasons[reason] !== undefined) {
      this.missReasons[reason]++;
    }
  }

  public recordCacheEviction() {
    this.cacheEvictions++;
  }

  public recordQuery(durationMs: number, meta?: {
    sourceIds?: string[];
    search?: string;
    isRegex?: boolean;
    matchedCount?: number;
    totalCount?: number;
  }) {
    this.totalQueries++;
    const now = Date.now();
    this.queryTimestamps.push(now);
    
    // Purge timestamps older than 60s
    const cutoff = now - 60000;
    while (this.queryTimestamps.length > 0 && this.queryTimestamps[0] < cutoff) {
      this.queryTimestamps.shift();
    }

    // Keep circular buffer of query durations
    this.queryDurations.push(durationMs);
    if (this.queryDurations.length > this.maxDurationSamples) {
      this.queryDurations.shift();
    }

    // Slow query recording (> 50ms)
    if (durationMs >= 50) {
      const record: SlowQueryRecord = {
        id: `sq-${now}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date(now).toISOString(),
        durationMs: Math.round(durationMs * 100) / 100,
        sourceIds: meta?.sourceIds || [],
        search: meta?.search,
        isRegex: meta?.isRegex,
        matchedCount: meta?.matchedCount ?? 0,
        totalCount: meta?.totalCount ?? 0,
      };

      this.slowQueries.unshift(record);
      if (this.slowQueries.length > this.maxSlowQueries) {
        this.slowQueries.pop();
      }

      if (durationMs >= 200) {
        this.recordIncident(
          'slow_query',
          'warning',
          'server',
          `Critical Query SLA Violation (${Math.round(durationMs)}ms on ${meta?.sourceIds?.join(', ') || 'source'})`,
          { durationMs, search: meta?.search, sourceIds: meta?.sourceIds }
        );
      }
    }
  }

  public recordError() {
    this.errorCount++;
  }

  public recordIngestion(linesCount: number) {
    const now = Date.now();
    this.ingestedLinesLastMinute.push({ timestamp: now, count: linesCount });
    const cutoff = now - 60000;
    while (this.ingestedLinesLastMinute.length > 0 && this.ingestedLinesLastMinute[0].timestamp < cutoff) {
      this.ingestedLinesLastMinute.shift();
    }
  }

  public setActiveStreams(count: number) {
    this.activeStreams = count;
  }

  public resetMetrics() {
    if (this.elHistogram) {
      this.elHistogram.reset();
    }
    this.queryDurations = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.cacheEvictions = 0;
    this.missReasons = {
      initial_load: 0,
      file_modified: 0,
      evicted_lru: 0,
      not_found: 0,
    };
    this.totalQueries = 0;
    this.errorCount = 0;
    this.slowQueries = [];
    this.queryTimestamps = [];
    this.ingestedLinesLastMinute = [];
    this.fileLoadAttempts = 0;
    this.successfulLoads = 0;
    this.failedLoads = 0;
    this.fileLoadDurations = [];
    this.slowestLoadedFile = null;
    this.recentFileFailures = [];
    this.malformedLinesCount = 0;
    this.serverCrashesCount = 0;
    this.clientErrorsCount = 0;
    this.streamDropsCount = 0;
    this.streamReconnectionsCount = 0;
    this.abortedQueriesCount = 0;
    this.flickerBurstCount = 0;
    this.incidents = [];
  }

  private calculatePercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
    return sorted[index];
  }

  public getEventLoopMetrics(): EventLoopMetrics {
    if (!this.elHistogram) {
      return { minMs: 0, meanMs: 0, p50Ms: 0, p90Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
    }

    // Convert nanoseconds to milliseconds
    const toMs = (ns: number) => Math.round((ns / 1_000_000) * 100) / 100;

    return {
      minMs: toMs(this.elHistogram.min),
      meanMs: toMs(isNaN(this.elHistogram.mean) ? 0 : this.elHistogram.mean),
      p50Ms: toMs(this.elHistogram.percentile(50)),
      p90Ms: toMs(this.elHistogram.percentile(90)),
      p95Ms: toMs(this.elHistogram.percentile(95)),
      p99Ms: toMs(this.elHistogram.percentile(99)),
      maxMs: toMs(this.elHistogram.max),
    };
  }

  public getVitals(): SystemVitals {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const v8Stats = v8.getHeapStatistics();
    const heapLimitMb = Math.round((v8Stats.heap_size_limit / 1024 / 1024) * 100) / 100 || 2048;
    const heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;
    const heapTotalMb = Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100;
    const rssMb = Math.round((mem.rss / 1024 / 1024) * 100) / 100;
    const externalMb = Math.round((mem.external / 1024 / 1024) * 100) / 100;
    const heapUsagePercent = heapLimitMb > 0 ? Math.round((heapUsedMb / heapLimitMb) * 1000) / 10 : 0;

    return {
      uptimeSeconds: Math.round(process.uptime()),
      heapUsedMb,
      heapTotalMb,
      heapLimitMb,
      rssMb,
      externalMb,
      heapUsagePercent,
      cpuUserSeconds: Math.round((cpu.user / 1_000_000) * 100) / 100,
      cpuSystemSeconds: Math.round((cpu.system / 1_000_000) * 100) / 100,
      activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
    };
  }

  public getCacheMetrics(): CacheMetrics {
    const totalLookups = this.cacheHits + this.cacheMisses;
    const hitRatioPercent = totalLookups > 0 ? Math.round((this.cacheHits / totalLookups) * 1000) / 10 : 100;
    const { sourcesCount, entriesTotal, memoryMb } = this.cacheStatsProvider();

    return {
      totalLookups,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRatioPercent,
      evictions: this.cacheEvictions,
      cachedSourcesCount: sourcesCount,
      cachedEntriesTotal: entriesTotal,
      estimatedMemoryMb: memoryMb,
      missReasons: { ...this.missReasons },
    };
  }

  public getQuerySlaMetrics(): QuerySlaMetrics {
    const sorted = [...this.queryDurations].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const avgDurationMs = sorted.length > 0 ? Math.round((sum / sorted.length) * 100) / 100 : 0;
    const p50Ms = Math.round(this.calculatePercentile(sorted, 50) * 100) / 100;
    const p95Ms = Math.round(this.calculatePercentile(sorted, 95) * 100) / 100;
    const p99Ms = Math.round(this.calculatePercentile(sorted, 99) * 100) / 100;
    const minMs = sorted.length > 0 ? Math.round(sorted[0] * 100) / 100 : 0;
    const maxMs = sorted.length > 0 ? Math.round(sorted[sorted.length - 1] * 100) / 100 : 0;

    const slowQueriesCount = this.queryDurations.filter((d) => d >= 50 && d < 200).length;
    const criticalQueriesCount = this.queryDurations.filter((d) => d >= 200).length;

    const queriesLastMinute = this.queryTimestamps.length;
    const throughputQps = Math.round((queriesLastMinute / 60) * 10) / 10;
    const errorRatePercent = this.totalQueries > 0
      ? Math.round((this.errorCount / this.totalQueries) * 1000) / 10
      : 0;

    return {
      totalQueries: this.totalQueries,
      queriesLastMinute,
      throughputQps,
      avgDurationMs,
      p50Ms,
      p95Ms,
      p99Ms,
      minMs,
      maxMs,
      slowQueriesCount,
      criticalQueriesCount,
      errorCount: this.errorCount,
      errorRatePercent,
    };
  }

  public getFileLoadTelemetry(): FileLoadTelemetry {
    const sorted = [...this.fileLoadDurations].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avgLoadTimeMs = sorted.length > 0 ? Math.round((sum / sorted.length) * 100) / 100 : 0;
    const p95LoadTimeMs = Math.round(this.calculatePercentile(sorted, 95) * 100) / 100;
    const maxLoadTimeMs = sorted.length > 0 ? Math.round(sorted[sorted.length - 1] * 100) / 100 : 0;
    const failureRatePercent = this.fileLoadAttempts > 0
      ? Math.round((this.failedLoads / this.fileLoadAttempts) * 1000) / 10
      : 0;

    return {
      totalAttempts: this.fileLoadAttempts,
      successfulLoads: this.successfulLoads,
      failedLoads: this.failedLoads,
      failureRatePercent,
      avgLoadTimeMs,
      p95LoadTimeMs,
      maxLoadTimeMs,
      slowestLoadedFile: this.slowestLoadedFile,
      recentFailures: this.recentFileFailures.slice(0, 15),
      malformedLinesCount: this.malformedLinesCount,
    };
  }

  public getStabilityTelemetry(): StabilityTelemetry {
    return {
      serverCrashesCount: this.serverCrashesCount,
      clientErrorsCount: this.clientErrorsCount,
      streamDropsCount: this.streamDropsCount,
      streamReconnectionsCount: this.streamReconnectionsCount,
      abortedQueriesCount: this.abortedQueriesCount,
      flickerBurstCount: this.flickerBurstCount,
      lastIncidentTimestamp: this.lastIncidentTimestamp,
    };
  }

  public getHealthReport(): ApplicationHealthReport {
    const vitals = this.getVitals();
    const eventLoop = this.getEventLoopMetrics();
    const cache = this.getCacheMetrics();
    const querySla = this.getQuerySlaMetrics();
    const fileLoading = this.getFileLoadTelemetry();
    const stability = this.getStabilityTelemetry();

    // Ingestion Rate
    const totalIngestedLastMin = this.ingestedLinesLastMinute.reduce((acc, i) => acc + i.count, 0);
    const ingestionRateLinesPerSec = Math.round((totalIngestedLastMin / 60) * 10) / 10;

    // Calculate Health Score (100 Base)
    let healthScore = 100;
    const diagnostics: HealthDiagnostic[] = [];

    // 1. Crash & Stability Check
    if (stability.serverCrashesCount > 0 || stability.clientErrorsCount > 3) {
      healthScore -= 35;
      diagnostics.push({
        type: 'critical',
        component: 'stability',
        message: `System Crashes / Client Errors detected (${stability.serverCrashesCount} server crashes, ${stability.clientErrorsCount} client errors).`,
        recommendation: 'Check the Incidents Log tab to review stack traces and source file locations.',
      });
    }

    // 2. File Load Failure Check
    if (fileLoading.failedLoads > 0) {
      healthScore -= 20;
      diagnostics.push({
        type: 'critical',
        component: 'file_loading',
        message: `File loading errors detected (${fileLoading.failedLoads} failed reads, ${fileLoading.failureRatePercent}% failure rate).`,
        recommendation: 'Verify that registered log source filepaths exist and process has read permissions.',
      });
    }

    // 3. UI Flicker & Re-fetch Bursts
    if (stability.flickerBurstCount > 3) {
      healthScore -= 12;
      diagnostics.push({
        type: 'warning',
        component: 'stability',
        message: `High UI Re-fetch / Flicker Bursts detected (${stability.flickerBurstCount} burst events).`,
        recommendation: 'Debounce search keystrokes and avoid triggering simultaneous background fetches.',
      });
    }

    // 4. Event Loop Lag Check (Live P99 and P95 latency)
    if (eventLoop.p99Ms > 100 || eventLoop.p95Ms > 60) {
      healthScore -= 25;
      diagnostics.push({
        type: 'critical',
        component: 'event_loop',
        message: `High Event Loop Lag detected (P99: ${eventLoop.p99Ms}ms, P95: ${eventLoop.p95Ms}ms). Process is busy on CPU-heavy operations.`,
        recommendation: 'Debounce search keystrokes and leverage fast-path parsed cache indexing.',
      });
    } else if (eventLoop.p95Ms > 25 || eventLoop.meanMs > 15) {
      healthScore -= 10;
      diagnostics.push({
        type: 'warning',
        component: 'event_loop',
        message: `Elevated Event Loop delay (P95: ${eventLoop.p95Ms}ms). Event loop is experiencing transient delays.`,
        recommendation: 'Enable parsed cache reuse and avoid running un-indexed pattern queries across multiple panels simultaneously.',
      });
    }

    // 5. Memory & Heap Check (Real V8 Heap Capacity)
    if (vitals.heapUsagePercent > 85 || vitals.rssMb > 1500) {
      healthScore -= 20;
      diagnostics.push({
        type: 'critical',
        component: 'memory',
        message: `High memory usage: Heap is at ${vitals.heapUsagePercent}% of system capacity (${vitals.heapUsedMb} MB / ${vitals.heapLimitMb} MB limit).`,
        recommendation: 'Proactively purge inactive source caches or restart service if memory does not drop after GC.',
      });
    } else if (vitals.heapUsagePercent > 70) {
      healthScore -= 8;
      diagnostics.push({
        type: 'warning',
        component: 'memory',
        message: `Heap utilization is elevated (${vitals.heapUsagePercent}% of ${vitals.heapLimitMb} MB capacity).`,
        recommendation: 'Log cache is approaching comfortable thresholds. LRU eviction is actively managing entries.',
      });
    }

    // 6. Cache Miss Ratio Check
    if (cache.totalLookups >= 5 && cache.hitRatioPercent < 60) {
      healthScore -= 12;
      diagnostics.push({
        type: 'warning',
        component: 'cache',
        message: `Low Cache Hit Ratio (${cache.hitRatioPercent}% hits, ${cache.misses} misses). Disk re-parsing is slowing down queries.`,
        recommendation: 'Keep active log sources cached in memory and avoid frequent external modifications to open log files.',
      });
    }

    // 7. Query SLA Check
    if (querySla.p95Ms > 150 || querySla.criticalQueriesCount > 5) {
      healthScore -= 12;
      diagnostics.push({
        type: 'warning',
        component: 'query_sla',
        message: `Slow Query SLA: P95 query latency is ${querySla.p95Ms}ms with ${querySla.criticalQueriesCount} queries taking >200ms.`,
        recommendation: 'Use marker and level filters before applying full-text fuzzy regex searches.',
      });
    }

    // 8. Error Rate Check
    if (querySla.errorRatePercent > 5) {
      healthScore -= 25;
      diagnostics.push({
        type: 'critical',
        component: 'error_rate',
        message: `Query error rate is high (${querySla.errorRatePercent}% of requests failing).`,
        recommendation: 'Inspect server logs for invalid regex syntax or unreadable source file paths.',
      });
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    let status: HealthStatus = 'OPTIMAL';
    if (healthScore < 60) {
      status = 'CRITICAL';
    } else if (healthScore < 85) {
      status = 'DEGRADED';
    }

    if (diagnostics.length === 0) {
      diagnostics.push({
        type: 'info',
        component: 'event_loop',
        message: 'All application systems operating within optimal thresholds.',
        recommendation: 'System is healthy. Zero crashes, event loop latency < 10ms, memory utilization stable, cache hit ratio optimal.',
      });
    }

    return {
      timestamp: new Date().toISOString(),
      status,
      healthScore,
      isOptimal: status === 'OPTIMAL',
      vitals,
      eventLoop,
      cache,
      querySla,
      fileLoading,
      stability,
      incidents: this.incidents.slice(0, 30),
      diagnostics,
      recentSlowQueries: this.slowQueries.slice(0, 10),
      activeStreamsCount: this.activeStreams,
      ingestionRateLinesPerSec,
      storage: this.getTelemetryStorageInfo(),
    };
  }
}

export const metrics = new MetricsManager();
