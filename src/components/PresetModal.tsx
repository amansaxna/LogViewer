import React, { useState, useEffect, useRef } from 'react';
import { LogPreset, PresetRules, LogLevel, SortOption } from '../types.ts';
import {
  X,
  Sliders,
  Code2,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  Check,
  Zap,
  RotateCcw,
  Sparkles,
  Layers,
  Filter,
  Search,
  Calendar,
  ArrowUpDown,
  ShieldAlert,
} from 'lucide-react';

interface PresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  presets: LogPreset[];
  activePresetId: string | null;
  onSelectPreset: (id: string | null) => void;
  onSavePreset: (preset: LogPreset) => Promise<void>;
  onDeletePreset: (id: string) => Promise<void>;
  currentViewerRules?: PresetRules;
  availableWorkflows?: string[];
  availableOperations?: string[];
}

const AVAILABLE_LEVELS: { key: LogLevel; label: string; color: string }[] = [
  { key: 'error', label: 'ERROR', color: '#ef4444' },
  { key: 'warning', label: 'WARN', color: '#f59e0b' },
  { key: 'info', label: 'INFO', color: '#38bdf8' },
  { key: 'audit', label: 'AUDIT', color: '#a855f7' },
  { key: 'debug', label: 'DEBUG', color: '#64748b' },
];

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'time-asc', label: 'Time (Oldest → Newest)' },
  { key: 'time-desc', label: 'Time (Newest at Top)' },
  { key: 'marker-asc', label: 'Marker (A → Z)' },
  { key: 'marker-desc', label: 'Marker (Z → A)' },
  { key: 'line-asc', label: 'Line Number (Ascending)' },
  { key: 'line-desc', label: 'Line Number (Descending)' },
  { key: 'duration-desc', label: 'Duration (Highest First)' },
];

export const PresetModal: React.FC<PresetModalProps> = ({
  isOpen,
  onClose,
  presets,
  activePresetId,
  onSelectPreset,
  onSavePreset,
  onDeletePreset,
  currentViewerRules,
  availableWorkflows = [],
  availableOperations = [],
}) => {
  const [selectedId, setSelectedId] = useState<string>(() => activePresetId || presets[0]?.id || 'minimal-set');
  const [activeTab, setActiveTab] = useState<'visual' | 'json'>('visual');

  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftRules, setDraftRules] = useState<PresetRules>({});
  const [jsonString, setJsonString] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [kwInput, setKwInput] = useState('');
  const [exMarkerInput, setExMarkerInput] = useState('');
  const [inMarkerInput, setInMarkerInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const target = presets.find((p) => p.id === selectedId) || presets[0];
    if (target) {
      setSelectedId(target.id);
      setDraftName(target.name);
      setDraftDesc(target.description || '');
      const rulesCopy = JSON.parse(JSON.stringify(target.rules || {}));
      setDraftRules(rulesCopy);
      setJsonString(JSON.stringify(target, null, 2));
      setJsonError(null);
    }
  }, [isOpen, selectedId, presets]);

  if (!isOpen) return null;

  const currentPreset = presets.find((p) => p.id === selectedId);

  const syncToJson = (name: string, desc: string, rules: PresetRules) => {
    const fullObj: LogPreset = {
      id: selectedId,
      name,
      description: desc || undefined,
      isBuiltIn: currentPreset?.isBuiltIn,
      rules,
    };
    setJsonString(JSON.stringify(fullObj, null, 2));
    setJsonError(null);
  };

  const addExcludeKeyword = () => {
    const val = kwInput.trim();
    if (!val) return;
    const list = draftRules.excludeKeywords || [];
    if (!list.includes(val)) {
      const next = [...list, val];
      const updated = { ...draftRules, excludeKeywords: next };
      setDraftRules(updated);
      syncToJson(draftName, draftDesc, updated);
    }
    setKwInput('');
  };

  const removeExcludeKeyword = (kw: string) => {
    const next = (draftRules.excludeKeywords || []).filter((k) => k !== kw);
    const updated = { ...draftRules, excludeKeywords: next };
    setDraftRules(updated);
    syncToJson(draftName, draftDesc, updated);
  };

  const addExcludeMarker = () => {
    const val = exMarkerInput.trim();
    if (!val) return;
    const list = draftRules.excludeMarkers || [];
    if (!list.includes(val)) {
      const next = [...list, val];
      const updated = { ...draftRules, excludeMarkers: next };
      setDraftRules(updated);
      syncToJson(draftName, draftDesc, updated);
    }
    setExMarkerInput('');
  };

  const removeExcludeMarker = (m: string) => {
    const next = (draftRules.excludeMarkers || []).filter((item) => item !== m);
    const updated = { ...draftRules, excludeMarkers: next };
    setDraftRules(updated);
    syncToJson(draftName, draftDesc, updated);
  };

  const addIncludeMarker = () => {
    const val = inMarkerInput.trim();
    if (!val) return;
    const list = draftRules.includeMarkers || [];
    if (!list.includes(val)) {
      const next = [...list, val];
      const updated = { ...draftRules, includeMarkers: next };
      setDraftRules(updated);
      syncToJson(draftName, draftDesc, updated);
    }
    setInMarkerInput('');
  };

  const removeIncludeMarker = (m: string) => {
    const next = (draftRules.includeMarkers || []).filter((item) => item !== m);
    const updated = { ...draftRules, includeMarkers: next };
    setDraftRules(updated);
    syncToJson(draftName, draftDesc, updated);
  };

  const toggleIncludeLevel = (level: LogLevel) => {
    const current = draftRules.levels || [];
    let next: LogLevel[];
    if (current.includes(level)) {
      next = current.filter((l) => l !== level);
    } else {
      next = [...current, level];
    }
    const nextExclude = (draftRules.excludeLevels || []).filter((l) => l !== level);
    const updated = { ...draftRules, levels: next, excludeLevels: nextExclude };
    setDraftRules(updated);
    syncToJson(draftName, draftDesc, updated);
  };

  const toggleExcludeLevel = (level: LogLevel) => {
    const current = draftRules.excludeLevels || [];
    let next: LogLevel[];
    if (current.includes(level)) {
      next = current.filter((l) => l !== level);
    } else {
      next = [...current, level];
    }
    const nextInclude = (draftRules.levels || []).filter((l) => l !== level);
    const updated = { ...draftRules, excludeLevels: next, levels: nextInclude };
    setDraftRules(updated);
    syncToJson(draftName, draftDesc, updated);
  };

  const handleJsonChange = (val: string) => {
    setJsonString(val);
    try {
      const parsed = JSON.parse(val);
      if (!parsed.name || typeof parsed.name !== 'string') {
        throw new Error('Preset must contain a valid string "name"');
      }
      setDraftName(parsed.name);
      setDraftDesc(parsed.description || '');
      setDraftRules(parsed.rules || {});
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message);
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonString);
      setJsonString(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (err: any) {
      setJsonError(`Cannot format: ${err.message}`);
    }
  };

  const handleCaptureCurrentViewerState = () => {
    if (!currentViewerRules) return;
    const captured: PresetRules = {
      ...draftRules,
      search: currentViewerRules.search || undefined,
      isRegex: currentViewerRules.isRegex || undefined,
      caseSensitive: currentViewerRules.caseSensitive || undefined,
      invert: currentViewerRules.invert || undefined,
      marker: currentViewerRules.marker || undefined,
      isMarkerRegex: currentViewerRules.isMarkerRegex || undefined,
      workflow: currentViewerRules.workflow || undefined,
      operation: currentViewerRules.operation || undefined,
      correlationId: currentViewerRules.correlationId || undefined,
      startDate: currentViewerRules.startDate || undefined,
      endDate: currentViewerRules.endDate || undefined,
      sortOption: currentViewerRules.sortOption || undefined,
      levels: currentViewerRules.levels?.length ? [...currentViewerRules.levels] : undefined,
      excludeLevels: currentViewerRules.excludeLevels?.length ? [...currentViewerRules.excludeLevels] : undefined,
      hideBrackets: currentViewerRules.hideBrackets,
      showDatetime: currentViewerRules.showDatetime,
      showPid: currentViewerRules.showPid,
      showTid: currentViewerRules.showTid,
      showCorrelation: currentViewerRules.showCorrelation,
      viewMode: currentViewerRules.viewMode,
      wrapLines: currentViewerRules.wrapLines,
    };
    setDraftRules(captured);
    syncToJson(draftName, draftDesc, captured);
    setStatusMessage('Captured active viewer filters into preset');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleResetFilters = () => {
    const cleared: PresetRules = {
      viewMode: 'compact',
      wrapLines: false,
      hideBrackets: false,
      showDatetime: true,
      showPid: true,
      showTid: true,
      showCorrelation: true,
      excludeKeywords: [],
      excludeMarkers: [],
      includeMarkers: [],
      levels: [],
      excludeLevels: [],
    };
    setDraftRules(cleared);
    syncToJson(draftName, draftDesc, cleared);
    setStatusMessage('Cleared all filters');
    setTimeout(() => setStatusMessage(null), 2000);
  };

  const handleSave = async () => {
    if (jsonError) return;
    if (!draftName.trim()) {
      setStatusMessage('Please enter a valid preset name');
      return;
    }
    setIsSaving(true);
    try {
      const toSave: LogPreset = {
        id: selectedId,
        name: draftName.trim(),
        description: draftDesc.trim() || undefined,
        isBuiltIn: currentPreset?.isBuiltIn,
        rules: draftRules,
      };
      await onSavePreset(toSave);
      setStatusMessage('Preset saved successfully');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err: any) {
      setStatusMessage(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = () => {
    const newId = `preset-${Date.now().toString(36)}`;
    const newPreset: LogPreset = {
      id: newId,
      name: 'New Custom Preset',
      rules: { viewMode: 'compact' },
    };
    setSelectedId(newId);
    setDraftName(newPreset.name);
    setDraftDesc('');
    setDraftRules(newPreset.rules);
    syncToJson(newPreset.name, '', newPreset.rules);
    setActiveTab('visual');
  };

  const handleDuplicate = () => {
    const newId = `preset-${Date.now().toString(36)}`;
    const dupName = `${draftName} (Copy)`;
    setSelectedId(newId);
    setDraftName(dupName);
    syncToJson(dupName, draftDesc, draftRules);
    setStatusMessage(`Duplicated as "${dupName}"`);
    setTimeout(() => setStatusMessage(null), 2000);
  };

  const handleExportJson = () => {
    const fullObj = { id: selectedId, name: draftName, description: draftDesc, rules: draftRules };
    const blob = new Blob([JSON.stringify(fullObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.name || typeof parsed.name !== 'string') throw new Error('Missing valid name');
        setSelectedId(parsed.id || `preset-${Date.now().toString(36)}`);
        setDraftName(parsed.name);
        setDraftDesc(parsed.description || '');
        setDraftRules(parsed.rules || {});
        setJsonString(JSON.stringify(parsed, null, 2));
        setJsonError(null);
      } catch (err: any) {
        setJsonError(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const countConfiguredFilters = () => {
    let count = 0;
    if (draftRules.search) count++;
    if (draftRules.marker) count++;
    if (draftRules.workflow) count++;
    if (draftRules.operation) count++;
    if (draftRules.correlationId) count++;
    if (draftRules.startDate || draftRules.endDate) count++;
    if (draftRules.levels && draftRules.levels.length > 0) count++;
    if (draftRules.excludeLevels && draftRules.excludeLevels.length > 0) count++;
    if (draftRules.excludeKeywords && draftRules.excludeKeywords.length > 0) count++;
    if (draftRules.excludeMarkers && draftRules.excludeMarkers.length > 0) count++;
    if (draftRules.includeMarkers && draftRules.includeMarkers.length > 0) count++;
    if (draftRules.hideBrackets) count++;
    if (draftRules.sortOption && draftRules.sortOption !== 'time-asc') count++;
    return count;
  };

  const configuredCount = countConfiguredFilters();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.78)',
        backdropFilter: 'blur(6px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '95%',
          maxWidth: 1040,
          height: '88vh',
          maxHeight: 780,
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid var(--border-subtle)',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-sidebar)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #9333ea, #38bdf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.3)',
              }}
            >
              <Sliders size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Log Presets & Custom View Profiles
                </h2>
                {configuredCount > 0 && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: 'rgba(56, 189, 248, 0.2)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                    }}
                  >
                    {configuredCount} active rules
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.73rem', margin: 0, color: 'var(--text-muted)' }}>
                Customize searches, severity levels, facets, noise filters, and layout tokens
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="view-mode-segmented">
              <button
                className={`view-mode-btn ${activeTab === 'visual' ? 'active' : ''}`}
                onClick={() => setActiveTab('visual')}
              >
                <Sliders size={12} />
                <span>Rule Builder</span>
              </button>
              <button
                className={`view-mode-btn ${activeTab === 'json' ? 'active' : ''}`}
                onClick={() => setActiveTab('json')}
              >
                <Code2 size={12} />
                <span>Raw JSON</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="btn-icon"
              style={{ width: 30, height: 30, color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              width: 250,
              borderRight: '1px solid var(--border-subtle)',
              background: 'var(--bg-sidebar)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <button
                className="btn-primary"
                onClick={handleCreateNew}
                style={{ width: '100%', justifyContent: 'center', gap: 6, fontSize: '0.78rem', padding: '6px 12px' }}
              >
                <Plus size={14} />
                <span>New Preset</span>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {presets.map((p) => {
                const isCurrent = p.id === selectedId;
                const isActive = p.id === activePresetId;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      marginBottom: 4,
                      cursor: 'pointer',
                      backgroundColor: isCurrent ? 'var(--accent-bg)' : 'transparent',
                      border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: isCurrent ? 700 : 500,
                          color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.name}
                      </span>
                      {isActive && (
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: '#22c55e',
                            color: '#080c14',
                            flexShrink: 0,
                          }}
                        >
                          ACTIVE
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 6 }}>
              <input type="file" ref={fileInputRef} accept=".json" style={{ display: 'none' }} onChange={handleImportJson} />
              <button
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.72rem', padding: '4px 8px', gap: 4 }}
              >
                <Upload size={12} />
                <span>Import</span>
              </button>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-surface)' }}>
            {activeTab === 'visual' ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Preset Name:
                      </label>
                      <input
                        type="text"
                        value={draftName}
                        onChange={(e) => {
                          setDraftName(e.target.value);
                          syncToJson(e.target.value, draftDesc, draftRules);
                        }}
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.84rem',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 6,
                          color: 'var(--text-primary)',
                        }}
                      />
                    </div>
                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Description:
                      </label>
                      <input
                        type="text"
                        value={draftDesc}
                        onChange={(e) => {
                          setDraftDesc(e.target.value);
                          syncToJson(draftName, e.target.value, draftRules);
                        }}
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.84rem',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 6,
                          color: 'var(--text-primary)',
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                    <button
                      className="btn-secondary"
                      onClick={handleCaptureCurrentViewerState}
                      style={{ fontSize: '0.73rem', padding: '4px 10px', gap: 6, color: '#38bdf8' }}
                    >
                      <Zap size={13} />
                      <span>Capture Current Viewer Filters</span>
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={handleResetFilters}
                      style={{ fontSize: '0.73rem', padding: '4px 8px', gap: 4, color: 'var(--text-muted)' }}
                    >
                      <RotateCcw size={12} />
                      <span>Reset Filters</span>
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Search size={14} /> Full-Text Search & Marker Filters
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Full-Text Search Query:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="text"
                          value={draftRules.search || ''}
                          onChange={(e) => {
                            const updated = { ...draftRules, search: e.target.value || undefined };
                            setDraftRules(updated);
                            syncToJson(draftName, draftDesc, updated);
                          }}
                          style={{
                            flex: 1,
                            fontSize: '0.78rem',
                            padding: '5px 8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 4,
                            color: 'var(--text-primary)',
                          }}
                        />
                        <button className={`search-modifier-btn ${draftRules.isRegex ? 'active' : ''}`} onClick={() => { const updated = { ...draftRules, isRegex: !draftRules.isRegex }; setDraftRules(updated); syncToJson(draftName, draftDesc, updated); }}>
                          <Code2 size={12} />
                        </button>
                        <button className={`search-modifier-btn ${draftRules.caseSensitive ? 'active' : ''}`} onClick={() => { const updated = { ...draftRules, caseSensitive: !draftRules.caseSensitive }; setDraftRules(updated); syncToJson(draftName, draftDesc, updated); }}>
                          Aa
                        </button>
                        <button className={`search-modifier-btn ${draftRules.invert ? 'active' : ''}`} onClick={() => { const updated = { ...draftRules, invert: !draftRules.invert }; setDraftRules(updated); syncToJson(draftName, draftDesc, updated); }}>
                          !
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Workflow / Marker Filter:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="text"
                          value={draftRules.marker || ''}
                          onChange={(e) => {
                            const updated = { ...draftRules, marker: e.target.value || undefined };
                            setDraftRules(updated);
                            syncToJson(draftName, draftDesc, updated);
                          }}
                          style={{
                            flex: 1,
                            fontSize: '0.78rem',
                            padding: '5px 8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 4,
                            color: 'var(--text-primary)',
                          }}
                        />
                        <button className={`search-modifier-btn ${draftRules.isMarkerRegex ? 'active' : ''}`} onClick={() => { const updated = { ...draftRules, isMarkerRegex: !draftRules.isMarkerRegex }; setDraftRules(updated); syncToJson(draftName, draftDesc, updated); }}>
                          <Code2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldAlert size={14} /> Severity Levels (Include & Exclude)
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Included Levels:</span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {AVAILABLE_LEVELS.map((lvl) => {
                          const isIncluded = (draftRules.levels || []).includes(lvl.key);
                          return (
                            <button
                              key={`inc-${lvl.key}`}
                              onClick={() => toggleIncludeLevel(lvl.key)}
                              style={{
                                padding: '3px 8px',
                                borderRadius: 4,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                border: isIncluded ? `1.5px solid ${lvl.color}` : '1px solid var(--border-subtle)',
                                background: isIncluded ? `${lvl.color}25` : 'transparent',
                                color: isIncluded ? lvl.color : 'var(--text-muted)',
                              }}
                            >
                              {isIncluded && '✓ '}
                              {lvl.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Excluded Levels:</span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {AVAILABLE_LEVELS.map((lvl) => {
                          const isExcluded = (draftRules.excludeLevels || []).includes(lvl.key);
                          return (
                            <button
                              key={`exc-${lvl.key}`}
                              onClick={() => toggleExcludeLevel(lvl.key)}
                              style={{
                                padding: '3px 8px',
                                borderRadius: 4,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                border: isExcluded ? '1.5px solid #ef4444' : '1px solid var(--border-subtle)',
                                background: isExcluded ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                color: isExcluded ? '#fca5a5' : 'var(--text-muted)',
                              }}
                            >
                              {isExcluded && '✕ '}
                              {lvl.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#a855f7', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={14} /> Dimension Facets & Sort Order
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Workflow Facet:</label>
                      <input type="text" list="preset-workflows-list" value={draftRules.workflow || ''} onChange={(e) => { const updated = { ...draftRules, workflow: e.target.value || undefined }; setDraftRules(updated); syncToJson(draftName, draftDesc, updated); }} style={{ fontSize: '0.78rem', padding: '5px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
                      <datalist id="preset-workflows-list">{availableWorkflows.map((w) => <option key={w} value={w} />)}</datalist>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Operation Facet:</label>
                      <input type="text" list="preset-ops-list" value={draftRules.operation || ''} onChange={(e) => { const updated = { ...draftRules, operation: e.target.value || undefined }; setDraftRules(updated); syncToJson(draftName, draftDesc, updated); }} style={{ fontSize: '0.78rem', padding: '5px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
                      <datalist id="preset-ops-list">{availableOperations.map((o) => <option key={o} value={o} />)}</datalist>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Correlation ID [Corr]:</label>
                      <input type="text" value={draftRules.correlationId || ''} onChange={(e) => { const updated = { ...draftRules, correlationId: e.target.value || undefined }; setDraftRules(updated); syncToJson(draftName, draftDesc, updated); }} style={{ fontSize: '0.78rem', padding: '5px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ArrowUpDown size={11} /> Default Sort Order:
                      </label>
                      <select value={draftRules.sortOption || 'time-asc'} onChange={(e) => { const updated = { ...draftRules, sortOption: e.target.value as SortOption }; setDraftRules(updated); syncToJson(draftName, draftDesc, updated); }} style={{ fontSize: '0.78rem', padding: '5px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none' }}>
                        {SORT_OPTIONS.map((opt) => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={14} /> Datetime Window Range
                    </span>
                    {(draftRules.startDate || draftRules.endDate) && (
                      <button onClick={() => { const updated = { ...draftRules, startDate: undefined, endDate: undefined }; setDraftRules(updated); syncToJson(draftName, draftDesc, updated); }} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>Clear Date Range</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>From Datetime:</label>
                      <input type="datetime-local" value={draftRules.startDate || ''} onChange={(e) => { const updated = { ...draftRules, startDate: e.target.value || undefined }; setDraftRules(updated); syncToJson(draftName, draftDesc, updated); }} style={{ fontSize: '0.78rem', padding: '5px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>To Datetime:</label>
                      <input type="datetime-local" value={draftRules.endDate || ''} onChange={(e) => { const updated = { ...draftRules, endDate: e.target.value || undefined }; setDraftRules(updated); syncToJson(draftName, draftDesc, updated); }} style={{ fontSize: '0.78rem', padding: '5px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#f43f5e', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Filter size={14} /> Rule Engine: Noise & Keywords
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#fca5a5' }}>Exclude Keywords:</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 28 }}>
                      {(draftRules.excludeKeywords || []).map((kw) => (
                        <span key={kw} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: '0.74rem', fontFamily: 'var(--font-mono)', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}>
                          {kw} <button onClick={() => removeExcludeKeyword(kw)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="text" value={kwInput} onChange={(e) => setKwInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addExcludeKeyword()} style={{ flex: 1, fontSize: '0.78rem', padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
                      <button className="btn-secondary" onClick={addExcludeKeyword} style={{ padding: '4px 10px', fontSize: '0.74rem' }}>Add</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, gap: 8, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Edit JSON definition directly:</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-secondary" onClick={handleFormatJson} style={{ fontSize: '0.72rem', padding: '3px 8px' }}>Format JSON</button>
                  </div>
                </div>
                <textarea
                  value={jsonString}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  style={{ flex: 1, width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', padding: 10, borderRadius: 6, backgroundColor: '#090d16', color: '#38bdf8', border: jsonError ? '1.5px solid #ef4444' : '1px solid var(--border-subtle)', outline: 'none', resize: 'none' }}
                  spellCheck={false}
                />
                {jsonError && <div style={{ color: '#ef4444', fontSize: '0.74rem', fontWeight: 600 }}>✕ {jsonError}</div>}
              </div>
            )}

            <div
              style={{
                padding: '10px 20px',
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-sidebar)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {statusMessage && <span style={{ fontSize: '0.76rem', color: 'var(--accent-primary)', fontWeight: 600 }}>✓ {statusMessage}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn-secondary" onClick={handleDuplicate} style={{ fontSize: '0.76rem', padding: '5px 10px', gap: 4 }}><Copy size={13} /> Duplicate</button>
                <button className="btn-secondary" onClick={handleExportJson} style={{ fontSize: '0.76rem', padding: '5px 10px', gap: 4 }}><Download size={13} /> Export</button>
                {presets.length > 1 && <button className="btn-secondary" onClick={async () => { if (confirm(`Delete "${draftName}"?`)) await onDeletePreset(selectedId); }} style={{ fontSize: '0.76rem', padding: '5px 8px', color: '#ef4444' }}><Trash2 size={13} /></button>}
                <button className="btn-primary" onClick={handleSave} disabled={isSaving || Boolean(jsonError)} style={{ fontSize: '0.78rem', padding: '6px 14px', gap: 6 }}><Check size={14} /> <span>{isSaving ? 'Saving...' : 'Save Preset'}</span></button>
                <button className="btn-primary" onClick={async () => { await handleSave(); onSelectPreset(selectedId); onClose(); }} style={{ fontSize: '0.78rem', padding: '6px 14px', gap: 6, background: 'linear-gradient(135deg, #10b981, #059669)', borderColor: '#10b981' }}>
                  <Zap size={14} /> <span>Apply Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
