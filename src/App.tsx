import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LogEntry, LogLevel, LogQueryResult, LogSource, SortOption } from './types.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { Topbar } from './components/Topbar.tsx';
import { LogTable } from './components/LogTable.tsx';
import { OpenFileModal } from './components/OpenFileModal.tsx';
import { ContextModal } from './components/ContextModal.tsx';
import { PasteLogsModal } from './components/PasteLogsModal.tsx';
import { GoToLineModal } from './components/GoToLineModal.tsx';

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

    try {
      const res = await fetch(`/api/logs/entries?${params.toString()}`);
      if (!res.ok) throw new Error('Query failed');
      const data: LogQueryResult = await res.json();

      setEntries(data.entries);
      setTotalEntries(data.total);
      setDurationMs(data.durationMs);
      setLevelCounts(data.levelCounts);
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

  // "Go to Line" handler
  const handleGoToLine = (targetLine: number) => {
    setSelectedLineNumber(targetLine);
    const entryIdx = entries.findIndex((e) => e.lineNumber === targetLine);
    if (entryIdx !== -1) {
      setTargetScrollIndex(entryIdx);
      setCurrentMatchIndex(entryIdx + 1);
    } else {
      // Find closest
      let closestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < entries.length; i++) {
        const diff = Math.abs(entries[i].lineNumber - targetLine);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      setTargetScrollIndex(closestIdx);
      setCurrentMatchIndex(closestIdx + 1);
    }
  };

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
          isLiveTail={isLiveTail}
          onToggleLiveTail={() => setIsLiveTail(!isLiveTail)}
          onExportFiltered={handleExportFiltered}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
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
    </div>
  );
};
