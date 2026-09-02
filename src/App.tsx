import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LogEntry, LogLevel, LogQueryResult, LogSource, SortOption, LogPreset } from './types.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { Topbar } from './components/Topbar.tsx';
import { LogTable } from './components/LogTable.tsx';
import { OpenFileModal } from './components/OpenFileModal.tsx';
import { ContextModal } from './components/ContextModal.tsx';
import { PasteLogsModal } from './components/PasteLogsModal.tsx';
import { GoToLineModal } from './components/GoToLineModal.tsx';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal.tsx';
import { JsonXmlInspectorModal, InspectorPayload } from './components/JsonXmlInspectorModal.tsx';
import { CopyToast } from './components/CopyToast.tsx';
import { PresetModal } from './components/PresetModal.tsx';
import { DEFAULT_PRESETS } from './presets.ts';

export const App: React.FC = () => {
  const [sources, setSources] = useState<LogSource[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(() => localStorage.getItem('lv_active_source') || null);

  // Filters and state (restored from localStorage on reload)
  const [markerFilter, setMarkerFilter] = useState<string>(() => localStorage.getItem('lv_marker_filter') || '');
  const [isMarkerRegex, setIsMarkerRegex] = useState<boolean>(() => localStorage.getItem('lv_marker_regex') === 'true');
  const [search, setSearch] = useState<string>(() => localStorage.getItem('lv_search') || '');
  const [isRegex, setIsRegex] = useState<boolean>(() => localStorage.getItem('lv_regex') === 'true');
  const [caseSensitive, setCaseSensitive] = useState<boolean>(() => localStorage.getItem('lv_case_sensitive') === 'true');
  const [invert, setInvert] = useState<boolean>(() => localStorage.getItem('lv_invert') === 'true');
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>(() => {
    try {
      const saved = localStorage.getItem('lv_selected_levels');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [excludeLevels, setExcludeLevels] = useState<LogLevel[]>(() => {
    try {
      const saved = localStorage.getItem('lv_exclude_levels');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(() => localStorage.getItem('lv_selected_workflow') || null);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(() => localStorage.getItem('lv_selected_operation') || null);
  const [selectedCorrelation, setSelectedCorrelation] = useState<string | null>(() => localStorage.getItem('lv_selected_correlation') || null);
  const [startDate, setStartDate] = useState<string | null>(() => localStorage.getItem('lv_start_date') || null);
  const [endDate, setEndDate] = useState<string | null>(() => localStorage.getItem('lv_end_date') || null);
  const [sortOption, setSortOption] = useState<SortOption>(() => (localStorage.getItem('lv_sort_option') as SortOption) || 'time-asc');
  const [wrapLines, setWrapLines] = useState<boolean>(() => localStorage.getItem('lv_wrap_lines') === 'true');
  const [hideBrackets, setHideBrackets] = useState<boolean>(() => localStorage.getItem('lv_hide_brackets') === 'true');
  const [viewMode, setViewMode] = useState<'compact' | 'standard' | 'raw'>(() => (localStorage.getItem('lv_view_mode') as 'compact' | 'standard' | 'raw') || 'compact');

  const handleToggleHideBrackets = () => {
    setHideBrackets((prev) => {
      const next = !prev;
      localStorage.setItem('lv_hide_brackets', String(next));
      return next;
    });
  };

  // Metadata columns toggle (Datetime, PID, TID, Correlation ID)
  const [showDatetime, setShowDatetime] = useState<boolean>(() => localStorage.getItem('lv_show_datetime') !== 'false');
  const [showPid, setShowPid] = useState<boolean>(() => localStorage.getItem('lv_show_pid') !== 'false');
  const [showTid, setShowTid] = useState<boolean>(() => localStorage.getItem('lv_show_tid') !== 'false');
  const [showCorrelation, setShowCorrelation] = useState<boolean>(() => localStorage.getItem('lv_show_corr') !== 'false');

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleShowDatetime = () => {
    setShowDatetime((prev) => {
      const next = !prev;
      localStorage.setItem('lv_show_datetime', String(next));
      return next;
    });
  };

  const handleToggleShowPid = () => {
    setShowPid((prev) => {
      const next = !prev;
      localStorage.setItem('lv_show_pid', String(next));
      return next;
    });
  };

  const handleToggleShowTid = () => {
    setShowTid((prev) => {
      const next = !prev;
      localStorage.setItem('lv_show_tid', String(next));
      return next;
    });
  };

  const handleToggleShowCorrelation = () => {
    setShowCorrelation((prev) => {
      const next = !prev;
      localStorage.setItem('lv_show_corr', String(next));
      return next;
    });
  };

  const handleToggleAllMeta = () => {
    const anyActive = showDatetime || showPid || showTid || showCorrelation;
    const next = !anyActive;
    setShowDatetime(next);
    setShowPid(next);
    setShowTid(next);
    setShowCorrelation(next);
    localStorage.setItem('lv_show_datetime', String(next));
    localStorage.setItem('lv_show_pid', String(next));
    localStorage.setItem('lv_show_tid', String(next));
    localStorage.setItem('lv_show_corr', String(next));
  };

  // Match and navigation state
  const [selectedLineNumber, setSelectedLineNumber] = useState<number | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(1);
  const [targetScrollIndex, setTargetScrollIndex] = useState<number | null>(null);

  // Query results
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [levelCounts, setLevelCounts] = useState<Record<string, number>>({});
  const [workflowCounts, setWorkflowCounts] = useState<Record<string, number>>({});
  const [operationCounts, setOperationCounts] = useState<Record<string, number>>({});
  const [correlationCounts, setCorrelationCounts] = useState<Record<string, number>>({});

  // Live tail (persisted across page reloads in localStorage)
  const [isLiveTail, setIsLiveTail] = useState<boolean>(() => {
    return localStorage.getItem('lv_live_tail') === 'true';
  });
  const [liveLogsPerSec, setLiveLogsPerSec] = useState<number>(0);
  const [liveAvgLogsPerSec, setLiveAvgLogsPerSec] = useState<number>(0);
  const [liveTotalAdded, setLiveTotalAdded] = useState<number>(0);
  const liveSessionStartRef = useRef<number>(0);
  const liveTotalAddedRef = useRef<number>(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const recentArrivalsRef = useRef<{ timestamp: number; count: number }[]>([]);
  const prevTotalEntriesRef = useRef<number | null>(null);

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('lv_theme') as 'dark' | 'light') || 'dark';
  });

  // Presets - instantly ready with built-in presets
  const [presets, setPresets] = useState<LogPreset[]>(DEFAULT_PRESETS);
  const [activePresetId, setActivePresetId] = useState<string | null>(() => localStorage.getItem('lv_active_preset') || null);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [presetModalInitialCreate, setPresetModalInitialCreate] = useState(false);

  // Modals
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isGoToLineModalOpen, setIsGoToLineModalOpen] = useState(false);
  const [contextLineNumber, setContextLineNumber] = useState<number | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [inspectorPayload, setInspectorPayload] = useState<InspectorPayload | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return localStorage.getItem('lv_sidebar') !== 'false';
  });
  const [isFullscreen, setIsFullscreen] = useState(() => {
    return localStorage.getItem('lv_fullscreen') === 'true';
  });

  // Global listener for payload inspector modal (JSON and XML on another div)
  useEffect(() => {
    const handleOpenInspector = (e: Event) => {
      const customEvent = e as CustomEvent<InspectorPayload>;
      if (customEvent.detail) {
        setInspectorPayload(customEvent.detail);
      }
    };
    window.addEventListener('open-payload-inspector', handleOpenInspector);
    return () => window.removeEventListener('open-payload-inspector', handleOpenInspector);
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        setIsFullscreen(true);
        localStorage.setItem('lv_fullscreen', 'true');
      } else {
        setIsFullscreen(false);
        localStorage.setItem('lv_fullscreen', 'false');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('lv_sidebar', String(next));
      return next;
    });
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      localStorage.setItem('lv_fullscreen', String(next));
      if (next) {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  };

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lv_theme', theme);
  }, [theme]);

  // Auto-persist all user settings to localStorage across reloads
  useEffect(() => {
    if (activeSourceId) localStorage.setItem('lv_active_source', activeSourceId);
    else localStorage.removeItem('lv_active_source');
    localStorage.setItem('lv_marker_filter', markerFilter);
    localStorage.setItem('lv_marker_regex', String(isMarkerRegex));
    localStorage.setItem('lv_search', search);
    localStorage.setItem('lv_regex', String(isRegex));
    localStorage.setItem('lv_case_sensitive', String(caseSensitive));
    localStorage.setItem('lv_invert', String(invert));
    localStorage.setItem('lv_selected_levels', JSON.stringify(selectedLevels));
    localStorage.setItem('lv_exclude_levels', JSON.stringify(excludeLevels));
    if (selectedWorkflow) localStorage.setItem('lv_selected_workflow', selectedWorkflow);
    else localStorage.removeItem('lv_selected_workflow');
    if (selectedOperation) localStorage.setItem('lv_selected_operation', selectedOperation);
    else localStorage.removeItem('lv_selected_operation');
    if (selectedCorrelation) localStorage.setItem('lv_selected_correlation', selectedCorrelation);
    else localStorage.removeItem('lv_selected_correlation');
    if (startDate) localStorage.setItem('lv_start_date', startDate);
    else localStorage.removeItem('lv_start_date');
    if (endDate) localStorage.setItem('lv_end_date', endDate);
    else localStorage.removeItem('lv_end_date');
    localStorage.setItem('lv_sort_option', sortOption);
    localStorage.setItem('lv_wrap_lines', String(wrapLines));
    localStorage.setItem('lv_hide_brackets', String(hideBrackets));
    localStorage.setItem('lv_view_mode', viewMode);
    localStorage.setItem('lv_show_datetime', String(showDatetime));
    localStorage.setItem('lv_show_pid', String(showPid));
    localStorage.setItem('lv_show_tid', String(showTid));
    localStorage.setItem('lv_show_corr', String(showCorrelation));
    localStorage.setItem('lv_theme', theme);
    localStorage.setItem('lv_sidebar', String(isSidebarOpen));
  }, [
    activeSourceId,
    markerFilter,
    isMarkerRegex,
    search,
    isRegex,
    caseSensitive,
    invert,
    selectedLevels,
    excludeLevels,
    selectedWorkflow,
    selectedOperation,
    selectedCorrelation,
    startDate,
    endDate,
    sortOption,
    wrapLines,
    hideBrackets,
    viewMode,
    showDatetime,
    showPid,
    showTid,
    showCorrelation,
    theme,
    isSidebarOpen,
  ]);

  // Reset all settings and filters to default
  const handleResetSettings = useCallback(() => {
    const keys = [
      'lv_active_source',
      'lv_marker_filter',
      'lv_marker_regex',
      'lv_search',
      'lv_regex',
      'lv_case_sensitive',
      'lv_invert',
      'lv_selected_levels',
      'lv_exclude_levels',
      'lv_selected_workflow',
      'lv_selected_operation',
      'lv_selected_correlation',
      'lv_start_date',
      'lv_end_date',
      'lv_sort_option',
      'lv_wrap_lines',
      'lv_hide_brackets',
      'lv_view_mode',
      'lv_show_datetime',
      'lv_show_pid',
      'lv_show_tid',
      'lv_show_corr',
      'lv_theme',
      'lv_sidebar',
      'lv_active_preset',
      'lv_live_tail',
    ];
    keys.forEach((k) => localStorage.removeItem(k));

    setActivePresetId(null);
    setIsLiveTail(false);
    setMarkerFilter('');
    setIsMarkerRegex(false);
    setSearch('');
    setIsRegex(false);
    setCaseSensitive(false);
    setInvert(false);
    setSelectedLevels([]);
    setExcludeLevels([]);
    setSelectedWorkflow(null);
    setSelectedOperation(null);
    setSelectedCorrelation(null);
    setStartDate(null);
    setEndDate(null);
    setSortOption('time-asc');
    setWrapLines(false);
    setHideBrackets(false);
    setViewMode('compact');
    setShowDatetime(true);
    setShowPid(true);
    setShowTid(true);
    setShowCorrelation(true);
    setTheme('dark');
    setIsSidebarOpen(true);
  }, []);

  // Load available presets from server
  const fetchPresets = useCallback(async () => {
    try {
      const res = await fetch('/api/presets');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.presets)) {
          setPresets(data.presets);
        }
      }
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  }, []);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  // Handle Preset Selection and apply all available filters to active UI controls
  const handleSelectPreset = useCallback((presetId: string | null) => {
    setActivePresetId(presetId);
    if (!presetId) {
      localStorage.removeItem('lv_active_preset');
      return;
    }
    localStorage.setItem('lv_active_preset', presetId);
    const target = presets.find((p) => p.id === presetId);
    if (target) {
      const { rules } = target;

      // 1. Search & Pattern Filters
      if (rules.search !== undefined) {
        setSearch(rules.search);
        localStorage.setItem('lv_search', rules.search);
      }
      if (rules.isRegex !== undefined) {
        setIsRegex(rules.isRegex);
        localStorage.setItem('lv_regex', String(rules.isRegex));
      }
      if (rules.caseSensitive !== undefined) {
        setCaseSensitive(rules.caseSensitive);
        localStorage.setItem('lv_case_sensitive', String(rules.caseSensitive));
      }
      if (rules.invert !== undefined) {
        setInvert(rules.invert);
        localStorage.setItem('lv_invert', String(rules.invert));
      }

      // 2. Scoped Marker Filter
      if (rules.marker !== undefined) {
        setMarkerFilter(rules.marker);
        localStorage.setItem('lv_marker_filter', rules.marker);
      }
      if (rules.isMarkerRegex !== undefined) {
        setIsMarkerRegex(rules.isMarkerRegex);
        localStorage.setItem('lv_marker_regex', String(rules.isMarkerRegex));
      }

      // 3. Dimension Facets
      if (rules.workflow !== undefined) {
        setSelectedWorkflow(rules.workflow);
        if (rules.workflow) localStorage.setItem('lv_selected_workflow', rules.workflow);
        else localStorage.removeItem('lv_selected_workflow');
      }
      if (rules.operation !== undefined) {
        setSelectedOperation(rules.operation);
        if (rules.operation) localStorage.setItem('lv_selected_operation', rules.operation);
        else localStorage.removeItem('lv_selected_operation');
      }
      if (rules.correlationId !== undefined) {
        setSelectedCorrelation(rules.correlationId);
        if (rules.correlationId) localStorage.setItem('lv_selected_correlation', rules.correlationId);
        else localStorage.removeItem('lv_selected_correlation');
      }

      // 4. Datetime Range
      if (rules.startDate !== undefined) {
        setStartDate(rules.startDate);
        if (rules.startDate) localStorage.setItem('lv_start_date', rules.startDate);
        else localStorage.removeItem('lv_start_date');
      }
      if (rules.endDate !== undefined) {
        setEndDate(rules.endDate);
        if (rules.endDate) localStorage.setItem('lv_end_date', rules.endDate);
        else localStorage.removeItem('lv_end_date');
      }

      // 5. Sorting
      if (rules.sortOption !== undefined) {
        setSortOption(rules.sortOption);
        localStorage.setItem('lv_sort_option', rules.sortOption);
      }

      // 6. Severity Levels
      if (rules.levels !== undefined) {
        setSelectedLevels(rules.levels);
        localStorage.setItem('lv_selected_levels', JSON.stringify(rules.levels));
      }
      if (rules.excludeLevels !== undefined) {
        setExcludeLevels(rules.excludeLevels);
        localStorage.setItem('lv_exclude_levels', JSON.stringify(rules.excludeLevels));
      }

      // 7. Visual Toggles & Metadata
      if (rules.hideBrackets !== undefined) {
        setHideBrackets(rules.hideBrackets);
        localStorage.setItem('lv_hide_brackets', String(rules.hideBrackets));
      }
      if (rules.showCorrelation !== undefined) {
        setShowCorrelation(rules.showCorrelation);
        localStorage.setItem('lv_show_corr', String(rules.showCorrelation));
      }
      if (rules.showDatetime !== undefined) {
        setShowDatetime(rules.showDatetime);
        localStorage.setItem('lv_show_datetime', String(rules.showDatetime));
      }
      if (rules.showPid !== undefined) {
        setShowPid(rules.showPid);
        localStorage.setItem('lv_show_pid', String(rules.showPid));
      }
      if (rules.showTid !== undefined) {
        setShowTid(rules.showTid);
        localStorage.setItem('lv_show_tid', String(rules.showTid));
      }
      if (rules.viewMode !== undefined) {
        setViewMode(rules.viewMode);
        localStorage.setItem('lv_view_mode', rules.viewMode);
      }
      if (rules.wrapLines !== undefined) {
        setWrapLines(rules.wrapLines);
        localStorage.setItem('lv_wrap_lines', String(rules.wrapLines));
      }
    }
  }, [presets]);

  const handleSavePreset = async (preset: LogPreset) => {
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preset),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save preset');
    }
    await fetchPresets();
  };

  const handleDeletePreset = async (id: string) => {
    const res = await fetch(`/api/presets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete preset');
    }
    if (activePresetId === id) {
      handleSelectPreset(null);
    }
    await fetchPresets();
  };

  const handleOpenPresetModal = useCallback(() => {
    setPresetModalInitialCreate(false);
    setIsPresetModalOpen(true);
  }, []);

  const handleCreateNewPreset = useCallback(() => {
    setPresetModalInitialCreate(true);
    setIsPresetModalOpen(true);
  }, []);

  // Load available sources
  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/sources');
      const data = await res.json();
      if (data.sources) {
        setSources(data.sources);
        if (data.sources.length > 0) {
          setActiveSourceId((prev) => {
            if (prev && data.sources.some((s: LogSource) => s.id === prev)) return prev;
            const saved = localStorage.getItem('lv_active_source');
            const found = saved && data.sources.find((s: LogSource) => s.id === saved);
            const defaultSrc = found || data.sources.find((s: LogSource) => s.isDefault) || data.sources[0];
            return defaultSrc.id;
          });
        }
      }
    } catch (err) {
      console.error('Failed to load sources:', err);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Fetch entries for active source and filters
  const fetchEntries = useCallback(async () => {
    if (!activeSourceId) return;

    // Parse sort option
    let sortBy = 'time';
    let direction: 'desc' | 'asc' = 'desc';
    if (sortOption.startsWith('marker-')) {
      sortBy = 'marker';
      direction = sortOption.endsWith('asc') ? 'asc' : 'desc';
    } else if (sortOption.startsWith('line-')) {
      sortBy = 'line';
      direction = sortOption.endsWith('asc') ? 'asc' : 'desc';
    } else if (sortOption.startsWith('duration-')) {
      sortBy = 'duration';
      direction = sortOption.endsWith('asc') ? 'asc' : 'desc';
    } else if (sortOption.startsWith('namespace-')) {
      sortBy = 'namespace';
      direction = sortOption.endsWith('asc') ? 'asc' : 'desc';
    } else {
      sortBy = 'time';
      direction = sortOption.endsWith('asc') ? 'asc' : 'desc';
    }

    const params = new URLSearchParams({
      sourceId: activeSourceId,
      sortBy,
      direction,
      page: '1',
      pageSize: '25000',
    });

    if (markerFilter.trim()) {
      params.append('marker', markerFilter.trim());
    }
    if (search.trim()) {
      params.append('search', search.trim());
    }
    if (isRegex) {
      params.append('isRegex', 'true');
    }
    if (caseSensitive) {
      params.append('caseSensitive', 'true');
    }
    if (invert) {
      params.append('invert', 'true');
    }
    if (selectedLevels.length > 0) {
      params.append('levels', selectedLevels.join(','));
    }
    if (excludeLevels.length > 0) {
      params.append('excludeLevels', excludeLevels.join(','));
    }
    if (selectedWorkflow) {
      params.append('workflow', selectedWorkflow);
    }
    if (selectedOperation) {
      params.append('operation', selectedOperation);
    }
    if (selectedCorrelation) {
      params.append('correlationId', selectedCorrelation);
    }
    if (startDate) {
      params.append('startDate', startDate);
    }
    if (endDate) {
      params.append('endDate', endDate);
    }

    if (!isLiveTail) {
      setIsLoading(true);
    }

    try {
      const res = await fetch(`/api/logs/entries?${params.toString()}`);
      if (!res.ok) throw new Error('Query failed');
      const data: LogQueryResult = await res.json();

      // Track newly added logs in live tail mode
      if (prevTotalEntriesRef.current !== null && data.total > prevTotalEntriesRef.current && isLiveTail) {
        const diff = data.total - prevTotalEntriesRef.current;
        const recentSum = recentArrivalsRef.current
          .filter((item) => Date.now() - item.timestamp <= 1200)
          .reduce((acc, item) => acc + item.count, 0);
        if (diff > recentSum) {
          recentArrivalsRef.current.push({ timestamp: Date.now(), count: diff - recentSum });
        }
      }
      prevTotalEntriesRef.current = data.total;

      setEntries(data.entries);
      setTotalEntries(data.total);
      setDurationMs(data.durationMs);
      setLevelCounts(data.levelCounts);
      setWorkflowCounts(data.workflowCounts || {});
      setOperationCounts(data.operationCounts || {});
      setCorrelationCounts(data.correlationCounts || {});
      setCurrentMatchIndex(1);
    } catch (err) {
      console.error('Failed to query entries:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeSourceId,
    markerFilter,
    search,
    isRegex,
    caseSensitive,
    invert,
    selectedLevels,
    excludeLevels,
    selectedWorkflow,
    selectedOperation,
    selectedCorrelation,
    startDate,
    endDate,
    sortOption,
    isLiveTail,
  ]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Calculate average log generation rate across loaded dataset
  const fileAvgLogsPerSec = useMemo(() => {
    if (!entries || entries.length < 2) return 0;
    let firstTime: number | null = null;
    for (let i = 0; i < entries.length; i++) {
      const ts = entries[i].timestamp || (entries[i].datetime ? Date.parse(entries[i].datetime!.replace(',', '.')) : NaN);
      if (!isNaN(ts) && ts > 0) {
        firstTime = ts;
        break;
      }
    }
    let lastTime: number | null = null;
    for (let i = entries.length - 1; i >= 0; i--) {
      const ts = entries[i].timestamp || (entries[i].datetime ? Date.parse(entries[i].datetime!.replace(',', '.')) : NaN);
      if (!isNaN(ts) && ts > 0) {
        lastTime = ts;
        break;
      }
    }
    if (firstTime === null || lastTime === null) return 0;
    const diffSec = Math.abs(lastTime - firstTime) / 1000;
    if (diffSec < 0.5) return 0;
    return Number((entries.length / diffSec).toFixed(1));
  }, [entries]);

  // Track logs added per second (both instantaneous and session average)
  useEffect(() => {
    if (!isLiveTail) {
      setLiveLogsPerSec(0);
      setLiveAvgLogsPerSec(0);
      setLiveTotalAdded(0);
      recentArrivalsRef.current = [];
      liveSessionStartRef.current = 0;
      liveTotalAddedRef.current = 0;
      return;
    }

    liveSessionStartRef.current = Date.now();
    liveTotalAddedRef.current = 0;
    recentArrivalsRef.current = [];
    setLiveTotalAdded(0);

    const interval = setInterval(() => {
      const now = Date.now();
      // Keep arrivals within last 30 seconds for rolling average
      recentArrivalsRef.current = recentArrivalsRef.current.filter((item) => now - item.timestamp <= 30000);

      // Instantaneous (last 1.5s)
      const instantArrivals = recentArrivalsRef.current.filter((item) => now - item.timestamp <= 1500);
      const instantSum = instantArrivals.reduce((acc, item) => acc + item.count, 0);
      setLiveLogsPerSec(instantSum);

      // Average logs added per second
      const elapsedSessionSec = Math.max(1, (now - liveSessionStartRef.current) / 1000);
      if (liveTotalAddedRef.current > 0) {
        if (elapsedSessionSec <= 30) {
          const avg = Number((liveTotalAddedRef.current / elapsedSessionSec).toFixed(1));
          setLiveAvgLogsPerSec(avg);
        } else {
          const windowSum = recentArrivalsRef.current.reduce((acc, item) => acc + item.count, 0);
          const avg = Number((windowSum / 30).toFixed(1));
          setLiveAvgLogsPerSec(avg);
        }
      } else {
        setLiveAvgLogsPerSec(0);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [isLiveTail]);

  // Setup SSE Live Tail
  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (isLiveTail && activeSourceId) {
      const es = new EventSource(`/api/logs/stream?sourceId=${encodeURIComponent(activeSourceId)}`);
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'file_changed') {
            const addedCount = payload.addedLogs || 1;
            liveTotalAddedRef.current += addedCount;
            setLiveTotalAdded(liveTotalAddedRef.current);
            recentArrivalsRef.current.push({ timestamp: Date.now(), count: addedCount });
            fetchEntries();
            fetchSources();
          }
        } catch {}
      };
      eventSourceRef.current = es;
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isLiveTail, activeSourceId, fetchEntries, fetchSources]);

  // Persist live tail state across page reloads
  useEffect(() => {
    localStorage.setItem('lv_live_tail', String(isLiveTail));
  }, [isLiveTail]);

  // Toggle Live Tail (snaps to newest logs in stream)
  const handleToggleLiveTail = () => {
    setIsLiveTail((prev) => {
      const next = !prev;
      if (next) {
        if (sortOption.endsWith('desc')) {
          setTargetScrollIndex(0);
        } else {
          setTargetScrollIndex(Math.max(0, entries.length - 1));
        }
      }
      return next;
    });
  };

  // Match Navigation Handlers (< > buttons)
  const handlePrevMatch = () => {
    if (entries.length === 0) return;
    const newIdx = currentMatchIndex > 1 ? currentMatchIndex - 1 : entries.length;
    setCurrentMatchIndex(newIdx);
    setTargetScrollIndex(newIdx - 1);
    setSelectedLineNumber(entries[newIdx - 1]?.lineNumber || null);
  };

  const handleNextMatch = () => {
    if (entries.length === 0) return;
    const newIdx = currentMatchIndex < entries.length ? currentMatchIndex + 1 : 1;
    setCurrentMatchIndex(newIdx);
    setTargetScrollIndex(newIdx - 1);
    setSelectedLineNumber(entries[newIdx - 1]?.lineNumber || null);
  };

  // "Go to Line" / Index handler
  const handleGoToLine = (targetNum: number) => {
    if (entries.length === 0) return;

    // 1. Check exact line number match
    const entryByLine = entries.findIndex((e) => e.lineNumber === targetNum);
    if (entryByLine !== -1) {
      setSelectedLineNumber(targetNum);
      setTargetScrollIndex(entryByLine);
      setCurrentMatchIndex(entryByLine + 1);
      return;
    }

    // 2. Check 1-based index (e.g. 1 in 1 / 100)
    if (targetNum >= 1 && targetNum <= entries.length) {
      const entryByIdx = entries[targetNum - 1];
      setSelectedLineNumber(entryByIdx.lineNumber);
      setTargetScrollIndex(targetNum - 1);
      setCurrentMatchIndex(targetNum);
      return;
    }

    // 3. Find closest line number
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < entries.length; i++) {
      const diff = Math.abs(entries[i].lineNumber - targetNum);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    setTargetScrollIndex(closestIdx);
    setCurrentMatchIndex(closestIdx + 1);
    setSelectedLineNumber(entries[closestIdx].lineNumber);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Escape key closes open modals or deselects line
      if (e.key === 'Escape') {
        if (isPresetModalOpen) { setIsPresetModalOpen(false); setPresetModalInitialCreate(false); return; }
        if (isShortcutsOpen) { setIsShortcutsOpen(false); return; }
        if (contextLineNumber !== null) { setContextLineNumber(null); return; }
        if (isGoToLineModalOpen) { setIsGoToLineModalOpen(false); return; }
        if (isPasteModalOpen) { setIsPasteModalOpen(false); return; }
        if (isOpenModalOpen) { setIsOpenModalOpen(false); return; }
        if (inspectorPayload !== null) { setInspectorPayload(null); return; }
        if (isTyping) { target.blur(); return; }
        setSelectedLineNumber(null);
        return;
      }

      // If user is actively typing in a form input or search box, don't trigger hotkeys
      if (isTyping) return;

      // Don't navigate background feed if any modal is open
      if (
        isOpenModalOpen ||
        isPasteModalOpen ||
        isGoToLineModalOpen ||
        isPresetModalOpen ||
        contextLineNumber !== null ||
        isShortcutsOpen ||
        inspectorPayload !== null
      ) {
        return;
      }

      // Never intercept standard browser/OS modifier combinations (Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+W, Ctrl+T, etc.)
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

      // 1. Down Arrow or 'j': Move to next log downwards
      if (!hasModifier && (e.key === 'ArrowDown' || e.key === 'j')) {
        e.preventDefault();
        if (entries.length === 0) return;
        const currentIdx = selectedLineNumber !== null
          ? entries.findIndex((entry) => entry.lineNumber === selectedLineNumber)
          : -1;
        const nextIdx = currentIdx === -1
          ? 0
          : Math.min(entries.length - 1, currentIdx + 1);
        const targetEntry = entries[nextIdx];
        if (targetEntry) {
          setSelectedLineNumber(targetEntry.lineNumber);
          setTargetScrollIndex(nextIdx);
          setCurrentMatchIndex(nextIdx + 1);
        }
        return;
      }

      // 2. Up Arrow or 'k': Move to previous log upwards
      if (!hasModifier && (e.key === 'ArrowUp' || e.key === 'k')) {
        e.preventDefault();
        if (entries.length === 0) return;
        const currentIdx = selectedLineNumber !== null
          ? entries.findIndex((entry) => entry.lineNumber === selectedLineNumber)
          : -1;
        const prevIdx = currentIdx === -1
          ? 0
          : Math.max(0, currentIdx - 1);
        const targetEntry = entries[prevIdx];
        if (targetEntry) {
          setSelectedLineNumber(targetEntry.lineNumber);
          setTargetScrollIndex(prevIdx);
          setCurrentMatchIndex(prevIdx + 1);
        }
        return;
      }

      // 3. PageDown / PageUp: Jump 15 logs
      if (!e.ctrlKey && !e.metaKey && e.key === 'PageDown') {
        e.preventDefault();
        if (entries.length === 0) return;
        const currentIdx = selectedLineNumber !== null
          ? entries.findIndex((entry) => entry.lineNumber === selectedLineNumber)
          : 0;
        const nextIdx = Math.min(entries.length - 1, currentIdx + 15);
        const targetEntry = entries[nextIdx];
        if (targetEntry) {
          setSelectedLineNumber(targetEntry.lineNumber);
          setTargetScrollIndex(nextIdx);
          setCurrentMatchIndex(nextIdx + 1);
        }
        return;
      }
      if (!e.ctrlKey && !e.metaKey && e.key === 'PageUp') {
        e.preventDefault();
        if (entries.length === 0) return;
        const currentIdx = selectedLineNumber !== null
          ? entries.findIndex((entry) => entry.lineNumber === selectedLineNumber)
          : 0;
        const prevIdx = Math.max(0, currentIdx - 15);
        const targetEntry = entries[prevIdx];
        if (targetEntry) {
          setSelectedLineNumber(targetEntry.lineNumber);
          setTargetScrollIndex(prevIdx);
          setCurrentMatchIndex(prevIdx + 1);
        }
        return;
      }

      // 4. Home / End
      if (!e.ctrlKey && !e.metaKey && e.key === 'Home') {
        e.preventDefault();
        if (entries.length > 0) {
          setSelectedLineNumber(entries[0].lineNumber);
          setTargetScrollIndex(0);
          setCurrentMatchIndex(1);
        }
        return;
      }
      if (!e.ctrlKey && !e.metaKey && e.key === 'End') {
        e.preventDefault();
        if (entries.length > 0) {
          const lastIdx = entries.length - 1;
          setSelectedLineNumber(entries[lastIdx].lineNumber);
          setTargetScrollIndex(lastIdx);
          setCurrentMatchIndex(entries.length);
        }
        return;
      }

      // 5. Enter or Space: Open Context Modal for selected line
      if (!hasModifier && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        if (selectedLineNumber !== null) {
          setContextLineNumber(selectedLineNumber);
        }
        return;
      }

      // 6. 'g': Open "Go to line" modal
      if (!hasModifier && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        setIsGoToLineModalOpen(true);
        return;
      }

      // 7. '/': Focus global content search
      if (!hasModifier && e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search in log lines..."]') as HTMLInputElement;
        searchInput?.focus();
        return;
      }

      // 8. 'n' / 'N': Next / previous search match
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        handleNextMatch();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && ((e.key === 'n' && e.shiftKey) || e.key === 'N')) {
        e.preventDefault();
        handlePrevMatch();
        return;
      }

      // 9. 'c': Toggle Compact View / Detailed Cards (Strictly guarded so Ctrl+C Windows/Mac copy works naturally)
      if (!hasModifier && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setViewMode((prev) => (prev === 'compact' ? 'standard' : 'compact'));
        return;
      }

      // 10. 'w': Toggle word wrap
      if (!hasModifier && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        setWrapLines((prev) => !prev);
        return;
      }

      // 11. 't': Toggle Live Tail
      if (!hasModifier && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        handleToggleLiveTail();
        return;
      }

      // 12. '[': Toggle left panel
      if (!hasModifier && e.key === '[') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // 13. 'F11': Toggle fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // 14. '?': Show keyboard shortcuts cheat sheet
      if (!hasModifier && e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen(true);
        return;
      }

      // 15. Alt + r: Reset all settings & filters to default
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleResetSettings();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    entries,
    selectedLineNumber,
    isOpenModalOpen,
    isPasteModalOpen,
    isGoToLineModalOpen,
    isPresetModalOpen,
    inspectorPayload,
    contextLineNumber,
    isShortcutsOpen,
    handleNextMatch,
    handlePrevMatch,
    handleToggleLiveTail,
    toggleSidebar,
    toggleFullscreen,
    handleResetSettings,
  ]);

  // Active Preset & Rule Engine
  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) || null,
    [presets, activePresetId]
  );

  const displayEntries = useMemo(() => {
    if (!activePreset) return entries;
    const { excludeKeywords, includeKeywords, excludeMarkers, includeMarkers } = activePreset.rules;
    if (
      !excludeKeywords?.length &&
      !includeKeywords?.length &&
      !excludeMarkers?.length &&
      !includeMarkers?.length
    ) {
      return entries;
    }

    return entries.filter((entry) => {
      const msg = (entry.message || '').toLowerCase();
      const raw = (entry.raw || '').toLowerCase();

      // 1. excludeKeywords (e.g. "x", "y", "ping", "heartbeat")
      if (excludeKeywords && excludeKeywords.length > 0) {
        for (const kw of excludeKeywords) {
          const trimmed = kw.trim();
          if (!trimmed) continue;
          // Match whole word or key (e.g. "x":, "y", "x=1", standalone keyword) to avoid substring collisions
          const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, 'i');
          if (regex.test(msg) || regex.test(raw)) {
            return false;
          }
        }
      }

      // 2. includeKeywords
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

      // 3. excludeMarkers (e.g. "Deregister unavailable")
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

      // 4. includeMarkers (e.g. "Register")
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

  // Export Filtered Logs
  const handleExportFiltered = () => {
    if (displayEntries.length === 0) return;
    const content = displayEntries.map((e) => e.raw).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeSource?.name || 'logs'}_filtered_${Date.now()}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Level Toggle Handler (Positive and Negative filtering)
  const handleToggleLevel = (level: LogLevel | 'all') => {
    if (level === 'all') {
      setSelectedLevels([]);
      setExcludeLevels([]);
      return;
    }
    // If it was excluded, remove exclusion and include it
    setExcludeLevels((prev) => prev.filter((l) => l !== level));
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const handleToggleExcludeLevel = (level: LogLevel) => {
    // If it was included, remove inclusion and exclude it
    setSelectedLevels((prev) => prev.filter((l) => l !== level));
    setExcludeLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  // Source Handlers
  const handleOpenSource = async (path: string, name?: string, category?: string) => {
    const res = await fetch('/api/sources/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, name, category }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to open source');
    }
    await fetchSources();
    setActiveSourceId(data.source.id);
  };

  const handlePasteSubmit = async (text: string, name?: string) => {
    const res = await fetch('/api/logs/paste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, name }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to analyze pasted logs');
    }
    await fetchSources();
    setActiveSourceId(data.source.id);
  };

  const handleRemoveCustomSource = async (id: string) => {
    await fetch(`/api/sources/${id}`, { method: 'DELETE' });
    await fetchSources();
    if (activeSourceId === id) {
      setActiveSourceId(sources[0]?.id || null);
    }
  };

  const activeSource = sources.find((s) => s.id === activeSourceId);

  return (
    <div className={`app-container ${isFullscreen ? 'app-fullscreen' : ''}`}>
      {/* Sidebar with LogViewer.io 3 Quick Actions */}
      <Sidebar
        sources={sources}
        activeSourceId={activeSourceId}
        onSelectSource={(id) => setActiveSourceId(id)}
        onOpenModal={() => setIsOpenModalOpen(true)}
        onOpenPasteModal={() => setIsPasteModalOpen(true)}
        onToggleLiveTail={handleToggleLiveTail}
        isLiveTail={isLiveTail}
        liveLogsPerSec={liveLogsPerSec}
        liveAvgLogsPerSec={liveAvgLogsPerSec}
        onRemoveCustomSource={handleRemoveCustomSource}
        isOpen={!isFullscreen && isSidebarOpen}
        onToggleOpen={toggleSidebar}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {/* Topbar Matching Image 4 (Screenshot 12.37.56) */}
        <Topbar
          activeSource={activeSource}
          totalEntries={totalEntries}
          filteredCount={displayEntries.length}
          durationMs={durationMs}
          markerFilter={markerFilter}
          onMarkerFilterChange={setMarkerFilter}
          isMarkerRegex={isMarkerRegex}
          onToggleMarkerRegex={() => setIsMarkerRegex(!isMarkerRegex)}
          search={search}
          onSearchChange={setSearch}
          isRegex={isRegex}
          onToggleRegex={() => setIsRegex(!isRegex)}
          caseSensitive={caseSensitive}
          onToggleCaseSensitive={() => setCaseSensitive(!caseSensitive)}
          invert={invert}
          onToggleInvert={() => setInvert(!invert)}
          currentMatchIndex={currentMatchIndex}
          onPrevMatch={handlePrevMatch}
          onNextMatch={handleNextMatch}
          onGoToLine={handleGoToLine}
          onOpenGoToLine={() => setIsGoToLineModalOpen(true)}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          wrapLines={wrapLines}
          onToggleWrapLines={() => setWrapLines(!wrapLines)}
          hideBrackets={hideBrackets}
          onToggleHideBrackets={handleToggleHideBrackets}
          sortOption={sortOption}
          onChangeSortOption={setSortOption}
          selectedLevels={selectedLevels}
          excludeLevels={excludeLevels}
          onToggleLevel={handleToggleLevel}
          onToggleExcludeLevel={handleToggleExcludeLevel}
          levelCounts={levelCounts}
          selectedWorkflow={selectedWorkflow}
          onSelectWorkflow={setSelectedWorkflow}
          workflowCounts={workflowCounts}
          selectedOperation={selectedOperation}
          onSelectOperation={setSelectedOperation}
          operationCounts={operationCounts}
          selectedCorrelation={selectedCorrelation}
          onSelectCorrelation={setSelectedCorrelation}
          correlationCounts={correlationCounts}
          isLiveTail={isLiveTail}
          liveLogsPerSec={liveLogsPerSec}
          liveAvgLogsPerSec={liveAvgLogsPerSec}
          fileAvgLogsPerSec={fileAvgLogsPerSec}
          liveTotalAdded={liveTotalAdded}
          onToggleLiveTail={handleToggleLiveTail}
          onExportFiltered={handleExportFiltered}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onResetSettings={handleResetSettings}
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }}
          isSidebarOpen={!isFullscreen && isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          showDatetime={showDatetime}
          onToggleShowDatetime={handleToggleShowDatetime}
          showPid={showPid}
          onToggleShowPid={handleToggleShowPid}
          showTid={showTid}
          onToggleShowTid={handleToggleShowTid}
          showCorrelation={showCorrelation}
          onToggleShowCorrelation={handleToggleShowCorrelation}
          onToggleAllMeta={handleToggleAllMeta}
          isLoading={isLoading}
          presets={presets}
          activePresetId={activePresetId}
          onSelectPreset={handleSelectPreset}
          onOpenPresetModal={handleOpenPresetModal}
          onCreateNewPreset={handleCreateNewPreset}
        />

        {/* Log Feed Table */}
        <LogTable
          entries={displayEntries}
          isLoading={isLoading}
          isLiveTail={isLiveTail}
          onViewContext={(line) => setContextLineNumber(line)}
          wrapLines={wrapLines}
          hideBrackets={hideBrackets}
          viewMode={viewMode}
          selectedLineNumber={selectedLineNumber}
          onSelectLine={(line) => setSelectedLineNumber(line)}
          searchQuery={search}
          markerQuery={markerFilter}
          correlationQuery={selectedCorrelation || undefined}
          targetScrollIndex={targetScrollIndex}
          showDatetime={showDatetime}
          showPid={showPid}
          showTid={showTid}
          showCorrelation={showCorrelation}
          sortOption={sortOption}
        />
      </main>

      {/* Modals */}
      <OpenFileModal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        onOpen={handleOpenSource}
      />

      <PasteLogsModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onPasteSubmit={handlePasteSubmit}
      />

      <GoToLineModal
        isOpen={isGoToLineModalOpen}
        onClose={() => setIsGoToLineModalOpen(false)}
        maxLines={totalEntries || 10000}
        onGoToLine={handleGoToLine}
      />

      <ContextModal
        isOpen={contextLineNumber !== null}
        onClose={() => setContextLineNumber(null)}
        sourceId={activeSourceId || ''}
        lineNumber={contextLineNumber}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Dedicated JSON and XML Inspector on another div */}
      <JsonXmlInspectorModal
        payload={inspectorPayload}
        onClose={() => setInspectorPayload(null)}
      />

      {/* Presets Management Modal */}
      <PresetModal
        isOpen={isPresetModalOpen}
        onClose={() => {
          setIsPresetModalOpen(false);
          setPresetModalInitialCreate(false);
        }}
        initialCreateNew={presetModalInitialCreate}
        presets={presets}
        activePresetId={activePresetId}
        onSelectPreset={handleSelectPreset}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
        currentViewerRules={{
          search,
          isRegex,
          caseSensitive,
          invert,
          marker: markerFilter,
          isMarkerRegex,
          workflow: selectedWorkflow,
          operation: selectedOperation,
          correlationId: selectedCorrelation,
          startDate,
          endDate,
          sortOption,
          levels: selectedLevels,
          excludeLevels,
          hideBrackets,
          showDatetime,
          showPid,
          showTid,
          showCorrelation,
          viewMode,
          wrapLines,
        }}
        availableWorkflows={Object.keys(workflowCounts)}
        availableOperations={Object.keys(operationCounts)}
      />

      {/* Sleek bright copy notification */}
      <CopyToast />
    </div>
  );
};
