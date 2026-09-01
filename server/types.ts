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

export interface LogQuery {
  sourceId: string;
  search?: string;
  isRegex?: boolean;
  caseSensitive?: boolean;
  invert?: boolean;
  levels?: LogLevel[];
  startDate?: string;
  endDate?: string;
  namespace?: string;
  workflow?: string;
  operation?: string;
  marker?: string;
  correlationId?: string;
  sortBy?: 'line' | 'time' | 'marker' | 'namespace' | 'duration' | 'level';
  direction?: 'desc' | 'asc';
  page?: number;
  pageSize?: number;
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
