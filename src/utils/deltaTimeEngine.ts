import { LogEntry } from '../types.ts';

export interface DeltaMeasurement {
  anchorLine: number;
  anchorEntry: LogEntry;
  targetLine: number;
  targetEntry: LogEntry;
  deltaMs: number;
  formattedDelta: string;
  stepCount: number;
  direction: 'forward' | 'backward' | 'same';
  anchorTimeStr: string;
  targetTimeStr: string;
}

/**
 * Extracts a numeric epoch timestamp (in milliseconds) from a LogEntry.
 */
export function extractEntryTimestampMs(entry: LogEntry): number | null {
  if (typeof entry.timestamp === 'number' && !isNaN(entry.timestamp) && entry.timestamp > 0) {
    return entry.timestamp;
  }

  if (entry.datetime) {
    const raw = entry.datetime.trim();
    // 1. Direct ISO Date parse (e.g. 2026-09-02 00:05:01.002 or 2026-09-02T00:05:01.002Z)
    const isoParsed = Date.parse(raw.replace(' ', 'T'));
    if (!isNaN(isoParsed)) {
      return isoParsed;
    }

    // 2. Time-only format: HH:mm:ss.SSS (e.g. 00:05:01.002)
    const timeMatch = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseInt(timeMatch[3], 10);
      const ms = timeMatch[4] ? parseInt(timeMatch[4].padEnd(3, '0').slice(0, 3), 10) : 0;
      return ((hours * 3600 + minutes * 60 + seconds) * 1000) + ms;
    }
  }

  return null;
}

/**
 * Formats a delta in milliseconds into human-readable latency.
 */
export function formatDeltaMs(deltaMs: number): string {
  const absMs = Math.abs(deltaMs);
  if (absMs === 0) {
    return '0ms';
  }
  const sign = deltaMs > 0 ? '+' : '−';

  if (absMs < 1) {
    return `${sign}${absMs.toFixed(2)}ms`;
  }
  if (absMs < 1000) {
    return `${sign}${Math.round(absMs)}ms`;
  }
  if (absMs < 60000) {
    const s = (absMs / 1000).toFixed(3);
    return `${sign}${s}s`;
  }
  if (absMs < 3600000) {
    const totalSec = Math.floor(absMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = (absMs / 1000 - m * 60).toFixed(1);
    return `${sign}${m}m ${s}s`;
  }

  const totalSec = Math.floor(absMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = (totalSec % 60);
  return `${sign}${h}h ${m}m ${s}s`;
}

/**
 * Computes the delta measurement between two LogEntries.
 */
export function calculateDeltaTime(
  anchorEntry: LogEntry,
  targetEntry: LogEntry,
  allEntries?: LogEntry[]
): DeltaMeasurement | null {
  const t1 = extractEntryTimestampMs(anchorEntry);
  const t2 = extractEntryTimestampMs(targetEntry);

  const anchorTimeStr = anchorEntry.datetime || `#${anchorEntry.lineNumber}`;
  const targetTimeStr = targetEntry.datetime || `#${targetEntry.lineNumber}`;

  // Calculate step count if entries array is provided
  let stepCount = Math.abs(targetEntry.lineNumber - anchorEntry.lineNumber);
  if (allEntries && allEntries.length > 0) {
    const idx1 = allEntries.findIndex((e) => e.lineNumber === anchorEntry.lineNumber);
    const idx2 = allEntries.findIndex((e) => e.lineNumber === targetEntry.lineNumber);
    if (idx1 !== -1 && idx2 !== -1) {
      stepCount = Math.abs(idx2 - idx1);
    }
  }

  let deltaMs = 0;
  if (t1 !== null && t2 !== null) {
    deltaMs = t2 - t1;
  }

  const direction: 'forward' | 'backward' | 'same' =
    deltaMs > 0 ? 'forward' : deltaMs < 0 ? 'backward' : 'same';

  return {
    anchorLine: anchorEntry.lineNumber,
    anchorEntry,
    targetLine: targetEntry.lineNumber,
    targetEntry,
    deltaMs,
    formattedDelta: formatDeltaMs(deltaMs),
    stepCount,
    direction,
    anchorTimeStr,
    targetTimeStr,
  };
}
