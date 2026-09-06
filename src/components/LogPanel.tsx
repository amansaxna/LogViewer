import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  X,
  Maximize2,
  Columns2,
  FileText,
} from 'lucide-react';
import { LogEntry, LogQueryResult, LogSource, LogPreset } from '../types.ts';
import { PanelState } from '../types/panel.ts';
import { LogTable } from './LogTable.tsx';
import { calculateDeltaTime } from '../utils/deltaTimeEngine.ts';
import { copyWithToast } from '../utils/copyNotifier.ts';
import { DeltaTimeToolbar } from './DeltaTimeToolbar.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { reportFlickerDetected, reportFileLoadFailed } from '../utils/clientTelemetry.ts';

interface LogPanelProps {
  panel: PanelState;
  panelIndex: number;
  isActive: boolean;
  onFocus: () => void;
  sources: LogSource[];
  activePreset: LogPreset | null;
  totalPanels: number;
  onUpdatePanel: (updates: Partial<PanelState>) => void;
  onClosePanel: () => void;
  onMaximizePanel: () => void;
  onSplitPanel: () => void;
  onViewContext: (lineNumber: number, sourceId?: string) => void;
  onLoadedStats?: (stats: {
    total: number;
    durationMs: number;
    levelCounts: Record<string, number>;
    workflowCounts: Record<string, number>;
    operationCounts: Record<string, number>;
    correlationCounts: Record<string, number>;
    entries: LogEntry[];
  }) => void;
  isLiveTailGlobal?: boolean;
}

export const LogPanel: React.FC<LogPanelProps> = ({
  panel,
  panelIndex,
  isActive,
  onFocus,
  sources,
  activePreset,
  totalPanels,
  onUpdatePanel,
  onClosePanel,
  onMaximizePanel,
  onSplitPanel,
  onViewContext,
  onLoadedStats,
  isLiveTailGlobal = false,
}) => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [levelCounts, setLevelCounts] = useState<Record<string, number>>({});
  const [workflowCounts, setWorkflowCounts] = useState<Record<string, number>>({});
  const [operationCounts, setOperationCounts] = useState<Record<string, number>>({});
  const [correlationCounts, setCorrelationCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Delta time measurement local to this panel
  const [deltaAnchorLine, setDeltaAnchorLine] = useState<number | null>(null);
  const [deltaTargetLine, setDeltaTargetLine] = useState<number | null>(null);
  const [targetScrollIndex, setTargetScrollIndex] = useState<number | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [selectedLineNumbers, setSelectedLineNumbers] = useState<Set<number>>(new Set());
  const selectionAnchorIndexRef = useRef<number | null>(null);
  const isInternalNavRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchTimestampsRef = useRef<number[]>([]);

  // Fetch log entries for this panel
  const onLoadedStatsRef = useRef(onLoadedStats);
  onLoadedStatsRef.current = onLoadedStats;

  const isFetchingRef = useRef(false);

  const serializedSourceIds = (panel.selectedSourceIds || []).join(',');
  const serializedLevels = (panel.selectedLevels || []).join(',');
  const serializedExcludeLevels = (panel.excludeLevels || []).join(',');

  const fetchPanelEntries = useCallback(async (isPolling = false) => {
    if (!panel.sourceId && (!panel.selectedSourceIds || panel.selectedSourceIds.length === 0)) {
      setEntries([]);
      setTotalEntries(0);
      return;
    }

    if (isPolling && isFetchingRef.current) {
      return; // Skip tick if previous request is still in-flight
    }

    // Detect rapid query burst / flicker thrashing
    const now = Date.now();
    fetchTimestampsRef.current.push(now);
    fetchTimestampsRef.current = fetchTimestampsRef.current.filter((t) => now - t < 1000);
    if (fetchTimestampsRef.current.length >= 6) {
      reportFlickerDetected(panel.id, fetchTimestampsRef.current.length, 'Rapid unmemoized re-fetch');
    }

    // Cancel any in-flight request for this panel to prevent cascading / hanging
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isFetchingRef.current = true;

    // Parse sort option
    const sortOpt = panel.sortOption || 'time-asc';
    let sortBy = 'time';
    if (sortOpt.startsWith('marker-')) {
      sortBy = 'marker';
    } else if (sortOpt.startsWith('line-')) {
      sortBy = 'line';
    } else if (sortOpt.startsWith('duration-')) {
      sortBy = 'duration';
    } else if (sortOpt.startsWith('namespace-')) {
      sortBy = 'namespace';
    } else {
      sortBy = 'time';
    }
    const direction: 'desc' | 'asc' = sortOpt.endsWith('desc') ? 'desc' : 'asc';

    const params = new URLSearchParams();
    if (panel.selectedSourceIds && panel.selectedSourceIds.length > 0) {
      panel.selectedSourceIds.forEach((id) => params.append('sourceIds', id));
    } else if (panel.sourceId) {
      params.append('sourceId', panel.sourceId);
    }
    params.append('sortBy', sortBy);
    params.append('direction', direction);
    params.append('sortDirection', direction);

    if (panel.markerFilter) {
      params.append('marker', panel.markerFilter);
      if (panel.isMarkerRegex) {
        params.append('isMarkerRegex', 'true');
        params.append('markerRegex', 'true');
      }
    }
    if (panel.search) {
      params.append('search', panel.search);
      if (panel.isRegex) {
        params.append('isRegex', 'true');
        params.append('regex', 'true');
      }
      if (panel.caseSensitive) params.append('caseSensitive', 'true');
      if (panel.invert) params.append('invert', 'true');
    }
    if (panel.selectedLevels && panel.selectedLevels.length > 0) {
      panel.selectedLevels.forEach((lvl) => params.append('levels', lvl));
    }
    if (panel.excludeLevels && panel.excludeLevels.length > 0) {
      panel.excludeLevels.forEach((lvl) => params.append('excludeLevels', lvl));
    }
    if (panel.selectedWorkflow) {
      params.append('workflow', panel.selectedWorkflow);
    }
    if (panel.selectedOperation) {
      params.append('operation', panel.selectedOperation);
    }
    if (panel.selectedCorrelation) {
      params.append('correlationId', panel.selectedCorrelation);
    }
    if (panel.startDate) {
      params.append('startDate', panel.startDate);
    }
    if (panel.endDate) {
      params.append('endDate', panel.endDate);
    }

    // Only show loading skeleton on cold initial load (avoid flicker on background polling/live tail)
    if (entries.length === 0 && !isPolling) {
      setIsLoading(true);
    }
    try {
      const res = await fetch(`/api/logs/entries?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Failed to query panel entries (HTTP ${res.status})`);
      }
      const data: LogQueryResult = await res.json();
      const entriesList = data.entries || [];
      setEntries(entriesList);
      setTotalEntries(data.total || 0);
      setDurationMs(data.durationMs || 0);
      setLevelCounts(data.levelCounts || {});
      setWorkflowCounts(data.workflowCounts || {});
      setOperationCounts(data.operationCounts || {});
      setCorrelationCounts(data.correlationCounts || {});

      if (isActive) {
        onLoadedStatsRef.current?.({
          total: data.total || 0,
          durationMs: data.durationMs || 0,
          levelCounts: data.levelCounts || {},
          workflowCounts: data.workflowCounts || {},
          operationCounts: data.operationCounts || {},
          correlationCounts: data.correlationCounts || {},
          entries: entriesList,
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        // Ignored: request intentionally cancelled in favor of a newer query
        return;
      }
      console.error(`[LogPanel ${panel.id}] query error:`, err);
      reportFileLoadFailed(panel.sourceId || 'multi', 'query', err?.message || 'Query failed');
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    }
  }, [
    panel.sourceId,
    panel.id,
    serializedSourceIds,
    panel.markerFilter,
    panel.isMarkerRegex,
    panel.search,
    panel.isRegex,
    panel.caseSensitive,
    panel.invert,
    serializedLevels,
    serializedExcludeLevels,
    panel.selectedWorkflow,
    panel.selectedOperation,
    panel.selectedCorrelation,
    panel.startDate,
    panel.endDate,
    panel.sortOption,
    isActive,
  ]);

  useEffect(() => {
    fetchPanelEntries(false);
  }, [fetchPanelEntries]);

  // Smooth polling when live tail is active without overlapping requests
  useEffect(() => {
    if (!isLiveTailGlobal) return;
    const interval = setInterval(() => {
      fetchPanelEntries(true);
    }, 500);
    return () => clearInterval(interval);
  }, [isLiveTailGlobal, fetchPanelEntries]);

  // Apply active preset filter rules if any
  const displayEntries = useMemo(() => {
    if (!activePreset) return entries;
    const { excludeKeywords, includeKeywords, excludeMarkers, includeMarkers } = activePreset.rules;
    if (!excludeKeywords?.length && !includeKeywords?.length && !excludeMarkers?.length && !includeMarkers?.length) {
      return entries;
    }

    return entries.filter((entry) => {
      const msg = (entry.message || '').toLowerCase();
      const raw = (entry.raw || '').toLowerCase();

      if (excludeKeywords && excludeKeywords.length > 0) {
        for (const kw of excludeKeywords) {
          const trimmed = kw.trim();
          if (!trimmed) continue;
          const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, 'i');
          if (regex.test(msg) || regex.test(raw)) return false;
        }
      }

      if (includeKeywords && includeKeywords.length > 0) {
        const matches = includeKeywords.some((kw) => {
          const trimmed = kw.trim();
          if (!trimmed) return false;
          const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, 'i');
          return regex.test(msg) || regex.test(raw);
        });
        if (!matches) return false;
      }

      if (excludeMarkers && excludeMarkers.length > 0) {
        for (const m of excludeMarkers) {
          const cleanM = m.replace(/^\[|\]$/g, '').trim().toLowerCase();
          if (cleanM) {
            if (
              (entry.workflow && entry.workflow.toLowerCase().includes(cleanM)) ||
              (entry.operation && entry.operation.toLowerCase().includes(cleanM)) ||
              (entry.namespace && entry.namespace.toLowerCase().includes(cleanM)) ||
              raw.includes(cleanM)
            ) {
              return false;
            }
          }
        }
      }

      if (includeMarkers && includeMarkers.length > 0) {
        const matches = includeMarkers.some((m) => {
          const cleanM = m.replace(/^\[|\]$/g, '').trim().toLowerCase();
          if (!cleanM) return false;
          return (
            (entry.workflow && entry.workflow.toLowerCase().includes(cleanM)) ||
            (entry.operation && entry.operation.toLowerCase().includes(cleanM)) ||
            (entry.namespace && entry.namespace.toLowerCase().includes(cleanM)) ||
            raw.includes(cleanM)
          );
        });
        if (!matches) return false;
      }

      return true;
    });
  }, [entries, activePreset]);

  // Delta time measurement
  const deltaMeasurement = useMemo(() => {
    if (deltaAnchorLine === null || deltaTargetLine === null) return null;
    const anchorEntry = entries.find((e) => e.lineNumber === deltaAnchorLine);
    const targetEntry = entries.find((e) => e.lineNumber === deltaTargetLine);
    if (!anchorEntry || !targetEntry) return null;
    return calculateDeltaTime(anchorEntry, targetEntry, entries);
  }, [deltaAnchorLine, deltaTargetLine, entries]);

  const handleSelectLine = useCallback(
    (line: number, isShift = false, entry?: LogEntry, isCtrlOrMeta = false) => {
      if (!isActive) {
        onFocus();
      }

      if (deltaAnchorLine !== null && deltaTargetLine === null && deltaAnchorLine !== line) {
        setDeltaTargetLine(line);
        return;
      }

      const clickedIdx = entry
        ? displayEntries.findIndex((e) => (e.id && entry.id ? e.id === entry.id : (e.sourceId === entry.sourceId && e.lineNumber === line)))
        : displayEntries.findIndex((e) => e.lineNumber === line);
      if (clickedIdx === -1) return;

      isInternalNavRef.current = true;
      setTimeout(() => {
        isInternalNavRef.current = false;
      }, 100);

      const target = displayEntries[clickedIdx];
      const entryKey = target.id || `${target.sourceId || ''}-${target.lineNumber}`;
      setTargetScrollIndex(clickedIdx);

      if (isShift) {
        if (selectionAnchorIndexRef.current === null) {
          selectionAnchorIndexRef.current = clickedIdx;
        }
        const start = Math.min(selectionAnchorIndexRef.current, clickedIdx);
        const end = Math.max(selectionAnchorIndexRef.current, clickedIdx);
        const newEntryIds = new Set<string>();
        const newLines = new Set<number>();
        for (let i = start; i <= end; i++) {
          const it = displayEntries[i];
          newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
          newLines.add(it.lineNumber);
        }
        setSelectedEntryIds(newEntryIds);
        setSelectedLineNumbers(newLines);
        setSelectedEntryId(entryKey);
        onUpdatePanel({ selectedLineNumber: line });
      } else if (isCtrlOrMeta) {
        const newEntryIds = new Set(selectedEntryIds);
        const newLines = new Set(selectedLineNumbers);
        if (newEntryIds.has(entryKey) || newLines.has(line)) {
          newEntryIds.delete(entryKey);
          newLines.delete(line);
          if (newLines.size === 0) {
            setSelectedEntryId(null);
            selectionAnchorIndexRef.current = null;
            onUpdatePanel({ selectedLineNumber: null });
          } else {
            const remainingLine = Array.from(newLines)[newLines.size - 1];
            setSelectedEntryId(Array.from(newEntryIds)[newEntryIds.size - 1]);
            onUpdatePanel({ selectedLineNumber: remainingLine });
          }
        } else {
          newEntryIds.add(entryKey);
          newLines.add(line);
          setSelectedEntryId(entryKey);
          selectionAnchorIndexRef.current = clickedIdx;
          onUpdatePanel({ selectedLineNumber: line });
        }
        setSelectedEntryIds(newEntryIds);
        setSelectedLineNumbers(newLines);
      } else {
        selectionAnchorIndexRef.current = clickedIdx;
        setSelectedEntryIds(new Set([entryKey]));
        setSelectedLineNumbers(new Set([line]));
        setSelectedEntryId(entryKey);
        onUpdatePanel({ selectedLineNumber: line });
      }
    },
    [isActive, onFocus, deltaAnchorLine, deltaTargetLine, displayEntries, onUpdatePanel, selectedEntryIds, selectedLineNumbers]
  );

  const handleSetDeltaAnchor = useCallback((line: number) => {
    setDeltaAnchorLine(line);
    setDeltaTargetLine(null);
    copyWithToast(`Line #${line}`, 'Delta Anchor (T1) set');
  }, []);

  const handleSwapDelta = useCallback(() => {
    setDeltaAnchorLine(deltaTargetLine);
    setDeltaTargetLine(deltaAnchorLine);
  }, [deltaAnchorLine, deltaTargetLine]);

  const handleClearDelta = useCallback(() => {
    setDeltaAnchorLine(null);
    setDeltaTargetLine(null);
  }, []);

  // Synchronize internal selection state when panel.selectedLineNumber changes externally
  useEffect(() => {
    if (isInternalNavRef.current) return;
    if (panel.selectedLineNumber === null || panel.selectedLineNumber === undefined) {
      if (selectedLineNumbers.size > 0 && selectionAnchorIndexRef.current === null) {
        setSelectedLineNumbers(new Set());
        setSelectedEntryIds(new Set());
        setSelectedEntryId(null);
      }
      return;
    }
    const idx = displayEntries.findIndex((e) => e.lineNumber === panel.selectedLineNumber);
    if (idx !== -1) {
      const target = displayEntries[idx];
      const entryKey = target.id || `${target.sourceId || ''}-${target.lineNumber}`;
      if (selectedEntryId !== entryKey) {
        setSelectedEntryId(entryKey);
      }
      // If the externally updated line is not in the current multi-selection, set as single active selection
      if (!selectedLineNumbers.has(panel.selectedLineNumber)) {
        setSelectedLineNumbers(new Set([panel.selectedLineNumber]));
        setSelectedEntryIds(new Set([entryKey]));
        selectionAnchorIndexRef.current = idx;
      }
      setTargetScrollIndex(idx);
    }
  }, [panel.selectedLineNumber, displayEntries]);

  // Keyboard navigation on active panel (ArrowDown, ArrowUp, j, k, PageDown, PageUp, Home, End, Shift+Arrows, Enter, Escape, Ctrl+C)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tag = activeEl.tagName.toLowerCase();
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          (activeEl as HTMLElement).isContentEditable ||
          activeEl.closest('input, textarea, select, [contenteditable="true"], .modal-overlay, .panel-search-box')
        ) {
          return;
        }
      }

      // If any modal overlay is open, do not handle panel keyboard navigation
      if (document.querySelector('.modal-overlay')) {
        return;
      }

      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

      // Mark internal navigation to protect selection sets from external overwrite
      isInternalNavRef.current = true;
      setTimeout(() => {
        isInternalNavRef.current = false;
      }, 150);

      // 1. ArrowDown or 'j' / 'J': Select next row downwards (supports Shift for range multi-selection)
      if ((!hasModifier || (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey)) && (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        if (displayEntries.length === 0) return;

        let currentIdx = -1;
        if (selectedEntryId) {
          currentIdx = displayEntries.findIndex((e) => (e.id || `${e.sourceId || ''}-${e.lineNumber}`) === selectedEntryId);
        }
        if (currentIdx === -1 && panel.selectedLineNumber !== null && panel.selectedLineNumber !== undefined) {
          currentIdx = displayEntries.findIndex((e) => e.lineNumber === panel.selectedLineNumber);
        }
        if (currentIdx === -1 && selectionAnchorIndexRef.current !== null) {
          currentIdx = selectionAnchorIndexRef.current;
        }

        const nextIdx = currentIdx === -1 ? 0 : Math.min(displayEntries.length - 1, currentIdx + 1);
        const targetEntry = displayEntries[nextIdx];
        if (!targetEntry) return;

        const entryKey = targetEntry.id || `${targetEntry.sourceId || ''}-${targetEntry.lineNumber}`;
        onUpdatePanel({ selectedLineNumber: targetEntry.lineNumber });
        setSelectedEntryId(entryKey);
        setTargetScrollIndex(nextIdx);

        if (e.shiftKey) {
          if (selectionAnchorIndexRef.current === null) {
            selectionAnchorIndexRef.current = currentIdx >= 0 ? currentIdx : 0;
          }
          const start = Math.min(selectionAnchorIndexRef.current, nextIdx);
          const end = Math.max(selectionAnchorIndexRef.current, nextIdx);
          const newEntryIds = new Set<string>();
          const newLines = new Set<number>();
          for (let i = start; i <= end; i++) {
            const it = displayEntries[i];
            newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
            newLines.add(it.lineNumber);
          }
          setSelectedEntryIds(newEntryIds);
          setSelectedLineNumbers(newLines);
        } else {
          selectionAnchorIndexRef.current = nextIdx;
          setSelectedEntryIds(new Set([entryKey]));
          setSelectedLineNumbers(new Set([targetEntry.lineNumber]));
        }
        return;
      }

      // 2. ArrowUp or 'k' / 'K': Select previous row upwards (supports Shift for range multi-selection)
      if ((!hasModifier || (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey)) && (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (displayEntries.length === 0) return;

        let currentIdx = -1;
        if (selectedEntryId) {
          currentIdx = displayEntries.findIndex((e) => (e.id || `${e.sourceId || ''}-${e.lineNumber}`) === selectedEntryId);
        }
        if (currentIdx === -1 && panel.selectedLineNumber !== null && panel.selectedLineNumber !== undefined) {
          currentIdx = displayEntries.findIndex((e) => e.lineNumber === panel.selectedLineNumber);
        }
        if (currentIdx === -1 && selectionAnchorIndexRef.current !== null) {
          currentIdx = selectionAnchorIndexRef.current;
        }

        const prevIdx = currentIdx === -1 ? 0 : Math.max(0, currentIdx - 1);
        const targetEntry = displayEntries[prevIdx];
        if (!targetEntry) return;

        const entryKey = targetEntry.id || `${targetEntry.sourceId || ''}-${targetEntry.lineNumber}`;
        onUpdatePanel({ selectedLineNumber: targetEntry.lineNumber });
        setSelectedEntryId(entryKey);
        setTargetScrollIndex(prevIdx);

        if (e.shiftKey) {
          if (selectionAnchorIndexRef.current === null) {
            selectionAnchorIndexRef.current = currentIdx >= 0 ? currentIdx : 0;
          }
          const start = Math.min(selectionAnchorIndexRef.current, prevIdx);
          const end = Math.max(selectionAnchorIndexRef.current, prevIdx);
          const newEntryIds = new Set<string>();
          const newLines = new Set<number>();
          for (let i = start; i <= end; i++) {
            const it = displayEntries[i];
            newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
            newLines.add(it.lineNumber);
          }
          setSelectedEntryIds(newEntryIds);
          setSelectedLineNumbers(newLines);
        } else {
          selectionAnchorIndexRef.current = prevIdx;
          setSelectedEntryIds(new Set([entryKey]));
          setSelectedLineNumbers(new Set([targetEntry.lineNumber]));
        }
        return;
      }

      // 3. PageDown / PageUp: Jump 15 rows (supports Shift for range multi-selection)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'PageDown') {
        e.preventDefault();
        if (displayEntries.length === 0) return;
        let currentIdx = -1;
        if (selectedEntryId) {
          currentIdx = displayEntries.findIndex((e) => (e.id || `${e.sourceId || ''}-${e.lineNumber}`) === selectedEntryId);
        }
        if (currentIdx === -1 && panel.selectedLineNumber !== null && panel.selectedLineNumber !== undefined) {
          currentIdx = displayEntries.findIndex((e) => e.lineNumber === panel.selectedLineNumber);
        }
        if (currentIdx === -1 && selectionAnchorIndexRef.current !== null) {
          currentIdx = selectionAnchorIndexRef.current;
        }
        const nextIdx = Math.min(displayEntries.length - 1, (currentIdx >= 0 ? currentIdx : 0) + 15);
        const targetEntry = displayEntries[nextIdx];
        if (targetEntry) {
          const entryKey = targetEntry.id || `${targetEntry.sourceId || ''}-${targetEntry.lineNumber}`;
          onUpdatePanel({ selectedLineNumber: targetEntry.lineNumber });
          setSelectedEntryId(entryKey);
          setTargetScrollIndex(nextIdx);

          if (e.shiftKey) {
            if (selectionAnchorIndexRef.current === null) {
              selectionAnchorIndexRef.current = currentIdx >= 0 ? currentIdx : 0;
            }
            const start = Math.min(selectionAnchorIndexRef.current, nextIdx);
            const end = Math.max(selectionAnchorIndexRef.current, nextIdx);
            const newEntryIds = new Set<string>();
            const newLines = new Set<number>();
            for (let i = start; i <= end; i++) {
              const it = displayEntries[i];
              newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
              newLines.add(it.lineNumber);
            }
            setSelectedEntryIds(newEntryIds);
            setSelectedLineNumbers(newLines);
          } else {
            setSelectedEntryIds(new Set([entryKey]));
            setSelectedLineNumbers(new Set([targetEntry.lineNumber]));
            selectionAnchorIndexRef.current = nextIdx;
          }
        }
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'PageUp') {
        e.preventDefault();
        if (displayEntries.length === 0) return;
        let currentIdx = -1;
        if (selectedEntryId) {
          currentIdx = displayEntries.findIndex((e) => (e.id || `${e.sourceId || ''}-${e.lineNumber}`) === selectedEntryId);
        }
        if (currentIdx === -1 && panel.selectedLineNumber !== null && panel.selectedLineNumber !== undefined) {
          currentIdx = displayEntries.findIndex((e) => e.lineNumber === panel.selectedLineNumber);
        }
        if (currentIdx === -1 && selectionAnchorIndexRef.current !== null) {
          currentIdx = selectionAnchorIndexRef.current;
        }
        const prevIdx = Math.max(0, (currentIdx >= 0 ? currentIdx : 0) - 15);
        const targetEntry = displayEntries[prevIdx];
        if (targetEntry) {
          const entryKey = targetEntry.id || `${targetEntry.sourceId || ''}-${targetEntry.lineNumber}`;
          onUpdatePanel({ selectedLineNumber: targetEntry.lineNumber });
          setSelectedEntryId(entryKey);
          setTargetScrollIndex(prevIdx);

          if (e.shiftKey) {
            if (selectionAnchorIndexRef.current === null) {
              selectionAnchorIndexRef.current = currentIdx >= 0 ? currentIdx : 0;
            }
            const start = Math.min(selectionAnchorIndexRef.current, prevIdx);
            const end = Math.max(selectionAnchorIndexRef.current, prevIdx);
            const newEntryIds = new Set<string>();
            const newLines = new Set<number>();
            for (let i = start; i <= end; i++) {
              const it = displayEntries[i];
              newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
              newLines.add(it.lineNumber);
            }
            setSelectedEntryIds(newEntryIds);
            setSelectedLineNumbers(newLines);
          } else {
            setSelectedEntryIds(new Set([entryKey]));
            setSelectedLineNumbers(new Set([targetEntry.lineNumber]));
            selectionAnchorIndexRef.current = prevIdx;
          }
        }
        return;
      }

      // 4. Home / End: Jump to first / last log (supports Shift for range multi-selection)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'Home') {
        e.preventDefault();
        if (displayEntries.length > 0) {
          let currentIdx = -1;
          if (selectedEntryId) {
            currentIdx = displayEntries.findIndex((e) => (e.id || `${e.sourceId || ''}-${e.lineNumber}`) === selectedEntryId);
          }
          if (currentIdx === -1 && panel.selectedLineNumber !== null && panel.selectedLineNumber !== undefined) {
            currentIdx = displayEntries.findIndex((e) => e.lineNumber === panel.selectedLineNumber);
          }
          if (currentIdx === -1 && selectionAnchorIndexRef.current !== null) {
            currentIdx = selectionAnchorIndexRef.current;
          }

          const targetEntry = displayEntries[0];
          const entryKey = targetEntry.id || `${targetEntry.sourceId || ''}-${targetEntry.lineNumber}`;
          onUpdatePanel({ selectedLineNumber: targetEntry.lineNumber });
          setSelectedEntryId(entryKey);
          setTargetScrollIndex(0);

          if (e.shiftKey) {
            if (selectionAnchorIndexRef.current === null) {
              selectionAnchorIndexRef.current = currentIdx >= 0 ? currentIdx : 0;
            }
            const start = 0;
            const end = Math.max(selectionAnchorIndexRef.current, 0);
            const newEntryIds = new Set<string>();
            const newLines = new Set<number>();
            for (let i = start; i <= end; i++) {
              const it = displayEntries[i];
              newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
              newLines.add(it.lineNumber);
            }
            setSelectedEntryIds(newEntryIds);
            setSelectedLineNumbers(newLines);
          } else {
            setSelectedEntryIds(new Set([entryKey]));
            setSelectedLineNumbers(new Set([targetEntry.lineNumber]));
            selectionAnchorIndexRef.current = 0;
          }
        }
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'End') {
        e.preventDefault();
        if (displayEntries.length > 0) {
          let currentIdx = -1;
          if (selectedEntryId) {
            currentIdx = displayEntries.findIndex((e) => (e.id || `${e.sourceId || ''}-${e.lineNumber}`) === selectedEntryId);
          }
          if (currentIdx === -1 && panel.selectedLineNumber !== null && panel.selectedLineNumber !== undefined) {
            currentIdx = displayEntries.findIndex((e) => e.lineNumber === panel.selectedLineNumber);
          }
          if (currentIdx === -1 && selectionAnchorIndexRef.current !== null) {
            currentIdx = selectionAnchorIndexRef.current;
          }

          const lastIdx = displayEntries.length - 1;
          const targetEntry = displayEntries[lastIdx];
          const entryKey = targetEntry.id || `${targetEntry.sourceId || ''}-${targetEntry.lineNumber}`;
          onUpdatePanel({ selectedLineNumber: targetEntry.lineNumber });
          setSelectedEntryId(entryKey);
          setTargetScrollIndex(lastIdx);

          if (e.shiftKey) {
            if (selectionAnchorIndexRef.current === null) {
              selectionAnchorIndexRef.current = currentIdx >= 0 ? currentIdx : 0;
            }
            const start = Math.min(selectionAnchorIndexRef.current, lastIdx);
            const end = lastIdx;
            const newEntryIds = new Set<string>();
            const newLines = new Set<number>();
            for (let i = start; i <= end; i++) {
              const it = displayEntries[i];
              newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
              newLines.add(it.lineNumber);
            }
            setSelectedEntryIds(newEntryIds);
            setSelectedLineNumbers(newLines);
          } else {
            setSelectedEntryIds(new Set([entryKey]));
            setSelectedLineNumbers(new Set([targetEntry.lineNumber]));
            selectionAnchorIndexRef.current = lastIdx;
          }
        }
        return;
      }

      // 5. Enter or Space: Open Context Modal for selected line
      if (!hasModifier && (e.key === 'Enter' || e.key === ' ')) {
        if (panel.selectedLineNumber !== null && panel.selectedLineNumber !== undefined) {
          e.preventDefault();
          onViewContext(panel.selectedLineNumber, panel.sourceId || undefined);
          return;
        }
      }

      // 6. 'd' / 'D': Set Delta Time Anchor (T1) on selected line
      if (!hasModifier && (e.key === 'd' || e.key === 'D')) {
        if (panel.selectedLineNumber !== null && panel.selectedLineNumber !== undefined) {
          e.preventDefault();
          handleSetDeltaAnchor(panel.selectedLineNumber);
          return;
        }
      }

      // 7. Escape: Deselect line / range
      if (!hasModifier && e.key === 'Escape') {
        setSelectedEntryId(null);
        setSelectedEntryIds(new Set());
        setSelectedLineNumbers(new Set());
        selectionAnchorIndexRef.current = null;
        onUpdatePanel({ selectedLineNumber: null });
        return;
      }

      // 8. Ctrl+A / Cmd+A: Select all visible logs in active panel
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        const textSelection = window.getSelection()?.toString() || '';
        if (textSelection.trim().length === 0 && displayEntries.length > 0) {
          e.preventDefault();
          const allEntryIds = new Set<string>();
          const allLines = new Set<number>();
          for (const it of displayEntries) {
            allEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
            allLines.add(it.lineNumber);
          }
          setSelectedEntryIds(allEntryIds);
          setSelectedLineNumbers(allLines);
          selectionAnchorIndexRef.current = 0;
          copyWithToast(`${allLines.size} lines selected`, `Selected all ${allLines.size} entries in view`);
          return;
        }
      }

      // 9. Ctrl+C / Cmd+C: Copy selected row(s) text if no window text selection is active
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'c' || e.key === 'C')) {
        const textSelection = window.getSelection()?.toString() || '';
        if (textSelection.trim().length === 0) {
          if (selectedEntryIds.size > 1 || selectedLineNumbers.size > 1) {
            e.preventDefault();
            const selectedEntries = displayEntries.filter((entry) => {
              const key = entry.id || `${entry.sourceId || ''}-${entry.lineNumber}`;
              return selectedEntryIds.has(key) || selectedLineNumbers.has(entry.lineNumber);
            });
            if (selectedEntries.length > 0) {
              const joinedText = selectedEntries.map((entry) => entry.raw || entry.message).join('\n');
              const firstLine = selectedEntries[0].lineNumber;
              const lastLine = selectedEntries[selectedEntries.length - 1].lineNumber;
              copyWithToast(joinedText, `${selectedEntries.length} lines (#${firstLine}–#${lastLine})`);
              return;
            }
          } else if (panel.selectedLineNumber !== null && panel.selectedLineNumber !== undefined) {
            const selectedEntry = displayEntries.find((entry) => entry.lineNumber === panel.selectedLineNumber) || entries.find((entry) => entry.lineNumber === panel.selectedLineNumber);
            if (selectedEntry) {
              e.preventDefault();
              copyWithToast(selectedEntry.raw || selectedEntry.message, `Line #${selectedEntry.lineNumber}`);
              return;
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isActive,
    displayEntries,
    entries,
    panel.selectedLineNumber,
    panel.sourceId,
    selectedEntryId,
    selectedEntryIds,
    selectedLineNumbers,
    onUpdatePanel,
    onViewContext,
    handleSetDeltaAnchor,
  ]);

  const currentSource = useMemo(() => {
    return sources.find((s) => s.id === panel.sourceId) || null;
  }, [sources, panel.sourceId]);

  return (
    <div
      className={`panel-window-card ${totalPanels === 1 ? 'single-panel' : ''} ${isActive && totalPanels > 1 ? 'active' : ''}`}
      onClick={() => {
        if (!isActive) onFocus();
      }}
    >
      {/* Panel Top Header Bar - Only rendered in Multi-Panel layouts */}
      {totalPanels > 1 && (
        <div className="panel-header-bar">
          {/* Left: Panel Identification & Source Title */}
          <div className="panel-header-left">
            <div className="panel-badge-group">
              <span className={`panel-badge ${isActive ? 'panel-badge-active' : ''}`}>
                P{panelIndex + 1}
              </span>
            </div>

            <div className="panel-source-title-display" title={currentSource ? `${currentSource.name} (${currentSource.path})` : 'Unified Stream'}>
              <FileText size={13} className="panel-source-icon" />
              <span className="panel-source-name">
                {currentSource ? currentSource.name : (panel.selectedSourceIds.length > 1 ? `Unified (${panel.selectedSourceIds.length})` : 'No Source Selected')}
              </span>
            </div>
          </div>

          {/* Center: Inline Panel Search Box */}
          <div className="panel-header-center">
            <div className="panel-search-box">
              <Search size={11} className="panel-search-icon" />
              <input
                type="text"
                className="panel-search-input"
                placeholder="Search in panel..."
                value={panel.search || ''}
                onChange={(e) => onUpdatePanel({ search: e.target.value })}
                onFocus={onFocus}
                onClick={(e) => e.stopPropagation()}
              />
              {panel.search && (
                <button
                  className="panel-search-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdatePanel({ search: '' });
                  }}
                  title="Clear search"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Right: Entry Count & Panel Window Actions */}
          <div className="panel-header-right">
            {/* Entry count */}
            <span className="panel-count-label" title={`${totalEntries} total, ${displayEntries.length} filtered, query time: ${durationMs}ms`}>
              {displayEntries.length.toLocaleString()}{' '}
              <span className="panel-count-total">/ {totalEntries.toLocaleString()}</span>
            </span>

            {/* Split / Maximize / Close Actions */}
            <button
              className="panel-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onMaximizePanel();
              }}
              title="Maximize this panel (Single View)"
            >
              <Maximize2 size={13} />
            </button>

            {totalPanels < 4 && (
              <button
                className="panel-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSplitPanel();
                }}
                title="Split into another panel"
              >
                <Columns2 size={13} />
              </button>
            )}

            <button
              className="panel-action-btn panel-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                onClosePanel();
              }}
              title="Close panel"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Panel Log Feed Body */}
      <div className="panel-content-body">
        <ErrorBoundary fallbackTitle="Panel View Error" onReset={fetchPanelEntries}>
          <LogTable
            entries={displayEntries}
            isLoading={isLoading}
            isLiveTail={Boolean(isLiveTailGlobal)}
            onViewContext={(line, srcId) => {
              onViewContext(line, srcId || panel.sourceId || '');
            }}
            wrapLines={panel.wrapLines}
            hideBrackets={panel.hideBrackets}
            viewMode={panel.viewMode}
            selectedLineNumber={panel.selectedLineNumber}
            selectedLineNumbers={selectedLineNumbers}
            selectedEntryId={selectedEntryId}
            selectedEntryIds={selectedEntryIds}
            onSelectLine={handleSelectLine}
            searchQuery={panel.search}
            markerQuery={panel.markerFilter}
            correlationQuery={panel.selectedCorrelation || undefined}
            targetScrollIndex={targetScrollIndex}
            showDatetime={panel.showDatetime}
            showPid={panel.showPid}
            showTid={panel.showTid}
            showCorrelation={panel.showCorrelation}
            sortOption={panel.sortOption}
            isUnifiedStream={panel.selectedSourceIds.length > 1}
            deltaAnchorLine={deltaAnchorLine}
            deltaTargetLine={deltaTargetLine}
            onSetDeltaAnchor={handleSetDeltaAnchor}
          />
        </ErrorBoundary>

        {/* Delta Time HUD local to this panel */}
        <DeltaTimeToolbar
          measurement={deltaMeasurement}
          anchorLine={deltaAnchorLine}
          targetLine={deltaTargetLine}
          onSwap={handleSwapDelta}
          onClear={handleClearDelta}
          onJumpToLine={(line) => {
            onUpdatePanel({ selectedLineNumber: line });
            const idx = entries.findIndex((e) => e.lineNumber === line);
            if (idx !== -1) setTargetScrollIndex(idx);
          }}
        />
      </div>
    </div>
  );
};
