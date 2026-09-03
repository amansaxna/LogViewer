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

