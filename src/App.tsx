import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LogEntry, LogLevel, LogQueryResult, LogSource } from './types.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { Topbar } from './components/Topbar.tsx';
import { LogTable } from './components/LogTable.tsx';
import { OpenFileModal } from './components/OpenFileModal.tsx';
import { ContextModal } from './components/ContextModal.tsx';

export const App: React.FC = () => {
  const [sources, setSources] = useState<LogSource[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  // Filters and state
  const [search, setSearch] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [invert, setInvert] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [direction, setDirection] = useState<'desc' | 'asc'>('desc');
  const [wrapLines, setWrapLines] = useState(false);

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

    const params = new URLSearchParams({
      sourceId: activeSourceId,
      direction,
      page: '1',
      pageSize: '25000',
    });

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
    } catch (err) {
      console.error('Failed to query entries:', err);
    }
  }, [activeSourceId, search, isRegex, caseSensitive, invert, selectedLevels, direction]);

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

  // Handlers
  const handleToggleLevel = (level: LogLevel | 'all') => {
    if (level === 'all') {
      setSelectedLevels([]);
      return;
    }
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

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

  const handleRemoveCustomSource = async (id: string) => {
    await fetch(`/api/sources/${id}`, { method: 'DELETE' });
    await fetchSources();
    if (activeSourceId === id) {
      setActiveSourceId(sources[0]?.id || null);
    }
  };

  const handleClearLog = async () => {
    if (!activeSourceId) return;
    if (!window.confirm('Are you sure you want to clear the contents of this log file?')) {
      return;
    }
    await fetch('/api/logs/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: activeSourceId }),
    });
    fetchEntries();
    fetchSources();
  };

  const handleDownloadLog = () => {
    if (!activeSourceId) return;
    window.location.href = `/api/logs/download?sourceId=${encodeURIComponent(activeSourceId)}`;
  };

  const activeSource = sources.find((s) => s.id === activeSourceId);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar
        sources={sources}
        activeSourceId={activeSourceId}
        onSelectSource={(id) => setActiveSourceId(id)}
        onOpenModal={() => setIsOpenModalOpen(true)}
        onRemoveCustomSource={handleRemoveCustomSource}
      />

      {/* Main Panel */}
      <main className="main-content">
        <Topbar
          activeSource={activeSource}
          totalEntries={totalEntries}
          durationMs={durationMs}
          search={search}
          onSearchChange={setSearch}
          isRegex={isRegex}
          onToggleRegex={() => setIsRegex(!isRegex)}
          caseSensitive={caseSensitive}
          onToggleCaseSensitive={() => setCaseSensitive(!caseSensitive)}
          invert={invert}
          onToggleInvert={() => setInvert(!invert)}
          selectedLevels={selectedLevels}
          onToggleLevel={handleToggleLevel}
          levelCounts={levelCounts}
          isLiveTail={isLiveTail}
          onToggleLiveTail={() => setIsLiveTail(!isLiveTail)}
          direction={direction}
          onToggleDirection={() => setDirection(direction === 'desc' ? 'asc' : 'desc')}
          onRefresh={fetchEntries}
          onClearLog={handleClearLog}
          onDownloadLog={handleDownloadLog}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          wrapLines={wrapLines}
          onToggleWrapLines={() => setWrapLines(!wrapLines)}
        />

        <LogTable
          entries={entries}
          isLiveTail={isLiveTail}
          onViewContext={(line) => setContextLineNumber(line)}
          wrapLines={wrapLines}
        />
      </main>

      {/* Modals */}
      <OpenFileModal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        onOpen={handleOpenSource}
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
