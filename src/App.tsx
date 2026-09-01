import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LogEntry, LogLevel, LogQueryResult, LogSource, SortOption } from './types.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { Topbar } from './components/Topbar.tsx';
import { LogTable } from './components/LogTable.tsx';
import { OpenFileModal } from './components/OpenFileModal.tsx';
import { ContextModal } from './components/ContextModal.tsx';
import { PasteLogsModal } from './components/PasteLogsModal.tsx';
import { GoToLineModal } from './components/GoToLineModal.tsx';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal.tsx';

export const App: React.FC = () => {
  const [sources, setSources] = useState<LogSource[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  // Filters and state
  const [markerFilter, setMarkerFilter] = useState('');
  const [isMarkerRegex, setIsMarkerRegex] = useState(false);
  const [search, setSearch] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [invert, setInvert] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [selectedCorrelation, setSelectedCorrelation] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('time-desc');
  const [wrapLines, setWrapLines] = useState(false);
  const [viewMode, setViewMode] = useState<'compact' | 'standard' | 'raw'>('compact');

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

  // Live tail
  const [isLiveTail, setIsLiveTail] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('lv_theme') as 'dark' | 'light') || 'dark';
  });

  // Modals
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isGoToLineModalOpen, setIsGoToLineModalOpen] = useState(false);
  const [contextLineNumber, setContextLineNumber] = useState<number | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return localStorage.getItem('lv_sidebar') !== 'false';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
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
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lv_theme', theme);
  }, [theme]);

  // Load available sources
  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/sources');
      const data = await res.json();
      if (data.sources) {
        setSources(data.sources);
        if (!activeSourceId && data.sources.length > 0) {
          const defaultSrc = data.sources.find((s: LogSource) => s.isDefault) || data.sources[0];
          setActiveSourceId(defaultSrc.id);
        }
      }
    } catch (err) {
      console.error('Failed to load sources:', err);
    }
  }, [activeSourceId]);

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

    try {
      const res = await fetch(`/api/logs/entries?${params.toString()}`);
      if (!res.ok) throw new Error('Query failed');
      const data: LogQueryResult = await res.json();

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
    }
  }, [
    activeSourceId,
    markerFilter,
    search,
    isRegex,
    caseSensitive,
    invert,
    selectedLevels,
    selectedWorkflow,
    selectedOperation,
    selectedCorrelation,
    startDate,
    endDate,
    sortOption,
  ]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

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
        if (isShortcutsOpen) { setIsShortcutsOpen(false); return; }
        if (contextLineNumber !== null) { setContextLineNumber(null); return; }
        if (isGoToLineModalOpen) { setIsGoToLineModalOpen(false); return; }
        if (isPasteModalOpen) { setIsPasteModalOpen(false); return; }
        if (isOpenModalOpen) { setIsOpenModalOpen(false); return; }
        if (isTyping) { target.blur(); return; }
        setSelectedLineNumber(null);
        return;
      }

      // If user is actively typing in a form input or search box, don't trigger hotkeys
      if (isTyping) return;

      // Don't navigate background feed if a modal is open
      if (isOpenModalOpen || isPasteModalOpen || isGoToLineModalOpen || contextLineNumber !== null || isShortcutsOpen) {
        return;
      }

      // 1. Down Arrow or 'j': Move to next log downwards
      if (e.key === 'ArrowDown' || e.key === 'j') {
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
      if (e.key === 'ArrowUp' || e.key === 'k') {
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
      if (e.key === 'PageDown') {
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
      if (e.key === 'PageUp') {
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
      if (e.key === 'Home') {
        e.preventDefault();
        if (entries.length > 0) {
          setSelectedLineNumber(entries[0].lineNumber);
          setTargetScrollIndex(0);
          setCurrentMatchIndex(1);
        }
        return;
      }
      if (e.key === 'End') {
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
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (selectedLineNumber !== null) {
          setContextLineNumber(selectedLineNumber);
        }
        return;
      }

      // 6. 'g': Open "Go to line" modal
      if (e.key === 'g') {
        e.preventDefault();
        setIsGoToLineModalOpen(true);
        return;
      }

      // 7. '/': Focus global content search
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search in log lines..."]') as HTMLInputElement;
        searchInput?.focus();
        return;
      }

      // 8. 'n' / 'N': Next / previous search match
      if (e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        handleNextMatch();
        return;
      }
      if ((e.key === 'n' && e.shiftKey) || e.key === 'N') {
        e.preventDefault();
        handlePrevMatch();
        return;
      }

      // 9. 'c': Toggle Compact View / Detailed Cards
      if (e.key === 'c') {
        e.preventDefault();
        setViewMode((prev) => (prev === 'compact' ? 'standard' : 'compact'));
        return;
      }

      // 10. 'w': Toggle word wrap
      if (e.key === 'w') {
        e.preventDefault();
        setWrapLines((prev) => !prev);
        return;
      }

      // 11. 't': Toggle Live Tail
      if (e.key === 't') {
        e.preventDefault();
        setIsLiveTail((prev) => !prev);
        return;
      }

      // 12. '[' or (Cmd/Ctrl + b): Toggle left panel
      if (e.key === '[' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b')) {
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
      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen(true);
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
    contextLineNumber,
    isShortcutsOpen,
    handleNextMatch,
    handlePrevMatch,
  ]);

  // Export Filtered Logs
  const handleExportFiltered = () => {
    if (entries.length === 0) return;
    const content = entries.map((e) => e.raw).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeSource?.name || 'logs'}_filtered_${Date.now()}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Level Toggle Handler
  const handleToggleLevel = (level: LogLevel | 'all') => {
    if (level === 'all') {
      setSelectedLevels([]);
      return;
    }
    setSelectedLevels((prev) =>
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
    <div className="app-container">
      {/* Sidebar with LogViewer.io 3 Quick Actions */}
      <Sidebar
        sources={sources}
        activeSourceId={activeSourceId}
        onSelectSource={(id) => setActiveSourceId(id)}
        onOpenModal={() => setIsOpenModalOpen(true)}
        onOpenPasteModal={() => setIsPasteModalOpen(true)}
        onToggleLiveTail={() => setIsLiveTail(!isLiveTail)}
        isLiveTail={isLiveTail}
        onRemoveCustomSource={handleRemoveCustomSource}
        isOpen={isSidebarOpen}
        onToggleOpen={toggleSidebar}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {/* Topbar Matching Image 4 (Screenshot 12.37.56) */}
        <Topbar
          activeSource={activeSource}
          totalEntries={totalEntries}
          filteredCount={entries.length}
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
          sortOption={sortOption}
          onChangeSortOption={setSortOption}
          selectedLevels={selectedLevels}
          onToggleLevel={handleToggleLevel}
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
          onToggleLiveTail={() => setIsLiveTail(!isLiveTail)}
          onExportFiltered={handleExportFiltered}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />

        {/* Log Feed Table */}
        <LogTable
          entries={entries}
          isLiveTail={isLiveTail}
          onViewContext={(line) => setContextLineNumber(line)}
          wrapLines={wrapLines}
          viewMode={viewMode}
          selectedLineNumber={selectedLineNumber}
          onSelectLine={(line) => setSelectedLineNumber(line)}
          searchQuery={search}
          markerQuery={markerFilter}
          correlationQuery={selectedCorrelation || undefined}
          targetScrollIndex={targetScrollIndex}
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
    </div>
  );
};
