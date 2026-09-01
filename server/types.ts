export type LogLevel =
  | 'emergency'
  | 'alert'
  | 'critical'
  | 'error'
  | 'warning'
  | 'notice'
  | 'info'
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

export interface LogSource {
  id: string;
  name: string;
  category: string;
  path: string;
  format?: string;
  description?: string;
  isDefault?: boolean;
  isCustom?: boolean;
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
  namespace?: string;
  workflow?: string;
  marker?: string;
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
  durationMs: number;
}
