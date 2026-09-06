export type LogLevel =
  | 'emergency'
  | 'alert'
  | 'critical'
  | 'error'
  | 'warning'
  | 'notice'
  | 'info'
  | 'audit'
  | 'debug'
  | 'trace'
  | 'unknown';

export interface TraceFrame {
  text: string;
  file?: string;
  line?: number;
}

export interface TraceData {
  title?: string;
  frames: TraceFrame[];
  raw: string;
}

export interface LogEntry {
  id: string;
  lineNumber: number;
  raw: string;
  datetime?: string;
  timestamp?: number;
  sourceId?: string;
  sourceName?: string;
  sourceColor?: string;
  pid?: string;
  tid?: string;
  correlationId?: string;
  namespace?: string;
  workflow?: string;
  operation?: string;
  status?: string;
  duration?: string;
  message: string;
  fileLocation?: string;
  level: LogLevel;
  trace?: TraceData;
}

export type SortOption =
  | 'time-desc'
  | 'time-asc'
  | 'marker-asc'
  | 'marker-desc'
  | 'line-asc'
  | 'line-desc'
  | 'duration-desc'
  | 'duration-asc'
  | 'namespace-asc';

export interface LogFolderConfig {
  path: string;
  category?: string;
  recursive?: boolean;
  pattern?: string;
}

export interface LogSource {
  id: string;
  name: string;
  category: string;
  path: string;
  format?: string;
  description?: string;
  isDefault?: boolean;
  isCustom?: boolean;
  isFolder?: boolean;
  recursive?: boolean;
  isRotated?: boolean;
  rotationParentId?: string;
  rotationSuffix?: string;
  rotations?: LogSource[];
  exists?: boolean;
  size?: number;
  lineCount?: number;
  modifiedAt?: string;
}

export interface LogQueryResult {
  entries: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  levelCounts: Record<string, number>;
  workflowCounts: Record<string, number>;
  operationCounts: Record<string, number>;
  correlationCounts?: Record<string, number>;
  durationMs: number;
}

export interface PresetRules {
  // Search & Pattern Filters
  search?: string;
  isRegex?: boolean;
  caseSensitive?: boolean;
  invert?: boolean;

  // Marker & Workflow Filter
  marker?: string;
  isMarkerRegex?: boolean;

  // Dimension Facets
  workflow?: string | null;
  operation?: string | null;
  correlationId?: string | null;

  // Datetime Range
  startDate?: string | null;
  endDate?: string | null;

  // Sorting
  sortOption?: SortOption;

  // Severity Levels
  levels?: LogLevel[];
  excludeLevels?: LogLevel[];

  // Noise & Rule Engine Keywords
  excludeKeywords?: string[];
  includeKeywords?: string[];
  excludeMarkers?: string[];
  includeMarkers?: string[];

  // Visibility & Layout Toggles
  viewMode?: 'compact' | 'standard' | 'raw';
  wrapLines?: boolean;
  hideBrackets?: boolean;
  showDatetime?: boolean;
  showPid?: boolean;
  showTid?: boolean;
  showCorrelation?: boolean;
}

export interface LogPreset {
  id: string;
  name: string;
  description?: string;
  isBuiltIn?: boolean;
  rules: PresetRules;
}

export type HealthStatus = 'OPTIMAL' | 'DEGRADED' | 'CRITICAL';

export interface HealthDiagnostic {
  type: 'info' | 'warning' | 'critical';
  component: 'event_loop' | 'memory' | 'cache' | 'query_sla' | 'error_rate';
  message: string;
  recommendation: string;
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

export interface ApplicationHealthReport {
  timestamp: string;
  status: HealthStatus;
  healthScore: number;
  isOptimal: boolean;
  vitals: {
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
  };
  eventLoop: {
    minMs: number;
    meanMs: number;
    p50Ms: number;
    p90Ms: number;
    p95Ms: number;
    p99Ms: number;
    maxMs: number;
  };
  cache: {
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
  };
  querySla: {
    totalQueries: number;
    queriesLastMinute: number;
    throughputQps: number;
    avgDurationMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    minMs: number;
    maxMs: number;
    slowQueriesCount: number;
    criticalQueriesCount: number;
    errorCount: number;
    errorRatePercent: number;
  };
  fileLoading: FileLoadTelemetry;
  stability: StabilityTelemetry;
  incidents: IncidentRecord[];
  diagnostics: HealthDiagnostic[];
  recentSlowQueries: SlowQueryRecord[];
  activeStreamsCount: number;
  ingestionRateLinesPerSec: number;
  storage?: TelemetryStorageInfo;
}


