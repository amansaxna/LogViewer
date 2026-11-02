import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Zap,
  Activity,
  Layers,
  Clock,
  Code2,
  FileText,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Search,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { LogEntry, LogLevel } from '../types.ts';
import { apiFetch, openSourceLocation, isVsCode } from '../api/bridge.ts';
import { copyWithToast } from '../utils/copyNotifier.ts';
import { renderSyntaxColoredLine } from '../utils/coloredLogRenderer.tsx';
import { findJsonBlocks, findXmlBlocks } from '../utils/messageContextHighlighter.tsx';

interface CorrelationTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  correlationId: string | null;
  activeSourceId?: string | null;
  selectedSourceIds?: string[];
  currentEntries?: LogEntry[];
  onSelectLine?: (lineNumber: number) => void;
  onViewContext?: (lineNumber: number, sourceId?: string) => void;
}

interface TimelineStepNode {
  id: string;
  index: number;
  entry: LogEntry;
  lineNumber: number;
  timestampMs: number;
  formattedTime: string;
  deltaFromPrevMs: number;
  deltaFromStartMs: number;
  module: string;
  operation: string;
  fileLocation?: string;
  level: LogLevel;
  duration?: string;
  hasPayload: boolean;
  payloadSnippet?: string;
}

const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  emergency: { bg: 'rgba(239, 68, 68, 0.18)', border: '#ef4444', text: '#fca5a5', glow: 'rgba(239, 68, 68, 0.4)' },
  alert: { bg: 'rgba(239, 68, 68, 0.18)', border: '#ef4444', text: '#fca5a5', glow: 'rgba(239, 68, 68, 0.4)' },
  critical: { bg: 'rgba(239, 68, 68, 0.18)', border: '#ef4444', text: '#fca5a5', glow: 'rgba(239, 68, 68, 0.4)' },
  error: { bg: 'rgba(248, 113, 113, 0.16)', border: '#f87171', text: '#fca5a5', glow: 'rgba(248, 113, 113, 0.35)' },
  warning: { bg: 'rgba(251, 191, 36, 0.14)', border: '#fbbf24', text: '#fde047', glow: 'rgba(251, 191, 36, 0.35)' },
  notice: { bg: 'rgba(56, 189, 248, 0.12)', border: '#38bdf8', text: '#7dd3fc', glow: 'rgba(56, 189, 248, 0.3)' },
  info: { bg: 'rgba(96, 165, 250, 0.12)', border: '#60a5fa', text: '#93c5fd', glow: 'rgba(96, 165, 250, 0.25)' },
  audit: { bg: 'rgba(192, 132, 252, 0.14)', border: '#c084fc', text: '#d8b4fe', glow: 'rgba(192, 132, 252, 0.3)' },
  debug: { bg: 'rgba(148, 163, 184, 0.12)', border: '#94a3b8', text: '#cbd5e1', glow: 'rgba(148, 163, 184, 0.2)' },
  trace: { bg: 'rgba(100, 116, 139, 0.12)', border: '#64748b', text: '#94a3b8', glow: 'rgba(100, 116, 139, 0.2)' },
  unknown: { bg: 'rgba(100, 116, 139, 0.12)', border: '#64748b', text: '#94a3b8', glow: 'rgba(100, 116, 139, 0.2)' },
};

function formatDurationMs(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export const CorrelationTimelineModal: React.FC<CorrelationTimelineModalProps> = ({
  isOpen,
  onClose,
  correlationId,
  activeSourceId,
  selectedSourceIds,
  currentEntries = [],
  onSelectLine,
  onViewContext,
}) => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [viewLayout, setViewLayout] = useState<'dag' | 'waterfall'>('dag');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeNodeRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'j') {
        setSelectedNodeIndex((prev) => Math.min(prev + 1, Math.max(0, entries.length - 1)));
      } else if (e.key === 'ArrowLeft' || e.key === 'k') {
        setSelectedNodeIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, entries.length]);

  // Fetch or filter entries for this correlation ID
  useEffect(() => {
    if (!isOpen || !correlationId) return;

    // Check if the current in-memory entries already contain full list
    const matchingLocal = currentEntries.filter(
      (e) => e.correlationId && e.correlationId.toLowerCase() === correlationId.toLowerCase()
    );

    // If local entries exist and represent multiple or all, load them first
    if (matchingLocal.length > 0) {
      // Sort chronologically ascending
      const sorted = [...matchingLocal].sort((a, b) => {
        const tA = a.timestamp || (a.datetime ? Date.parse(a.datetime) : 0);
        const tB = b.timestamp || (b.datetime ? Date.parse(b.datetime) : 0);
        if (tA !== tB) return tA - tB;
        return a.lineNumber - b.lineNumber;
      });
      setEntries(sorted);
      setSelectedNodeIndex(0);
    }

    // Also fetch from API to ensure we have all matching lines across files
    setIsLoading(true);
    const sourceParam = selectedSourceIds && selectedSourceIds.length > 0
      ? `sourceIds=${encodeURIComponent(selectedSourceIds.join(','))}`
      : activeSourceId
      ? `sourceId=${encodeURIComponent(activeSourceId)}`
      : '';

    const url = `/api/logs/entries?${sourceParam}&correlationId=${encodeURIComponent(correlationId)}&pageSize=5000&sortBy=time&direction=asc`;

    apiFetch<{ entries: LogEntry[] }>(url)
      .then((data) => {
        if (data && data.entries && data.entries.length > 0) {
          const sorted = [...data.entries].sort((a, b) => {
            const tA = a.timestamp || (a.datetime ? Date.parse(a.datetime) : 0);
            const tB = b.timestamp || (b.datetime ? Date.parse(b.datetime) : 0);
            if (tA !== tB) return tA - tB;
            return a.lineNumber - b.lineNumber;
          });
          setEntries(sorted);
          setSelectedNodeIndex(0);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch correlation entries from server:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, correlationId, activeSourceId, selectedSourceIds, currentEntries]);

  // Compute graph nodes with latency deltas and payload detection
  const stepNodes: TimelineStepNode[] = useMemo(() => {
    if (entries.length === 0) return [];

    let startMs = 0;
    return entries.map((entry, idx) => {
      const ts = entry.timestamp || (entry.datetime ? Date.parse(entry.datetime) : 0);
      if (idx === 0) startMs = ts;

      const prevDatetime = idx > 0 ? entries[idx - 1].datetime : undefined;
      const prevTs = idx > 0
        ? (entries[idx - 1].timestamp || (prevDatetime ? Date.parse(prevDatetime) : ts))
        : ts;
      const deltaFromPrevMs = Math.max(0, ts - prevTs);
      const deltaFromStartMs = Math.max(0, ts - startMs);

      // Extract JSON or XML payload snippets if present
      const jsonPayloads = findJsonBlocks(entry.message || entry.raw || '');
      const xmlPayloads = findXmlBlocks(entry.message || entry.raw || '');
      const hasPayload = jsonPayloads.length > 0 || xmlPayloads.length > 0;
      const payloadSnippet = jsonPayloads[0]?.raw || xmlPayloads[0]?.raw;

      return {
        id: entry.id || `node-${idx}-${entry.lineNumber}`,
        index: idx,
        entry,
        lineNumber: entry.lineNumber,
        timestampMs: ts,
        formattedTime: entry.datetime || new Date(ts).toISOString().slice(11, 23),
        deltaFromPrevMs,
        deltaFromStartMs,
        module: entry.namespace || entry.workflow || 'Main',
        operation: entry.operation || (entry.message ? entry.message.slice(0, 48) : 'Event'),
        fileLocation: entry.fileLocation,
        level: entry.level,
        duration: entry.duration,
        hasPayload,
        payloadSnippet,
      };
    });
  }, [entries]);

  const filteredStepNodes = useMemo(() => {
    if (!searchFilter.trim()) return stepNodes;
    const q = searchFilter.toLowerCase();
    return stepNodes.filter((node) => {
      return (
        node.module.toLowerCase().includes(q) ||
        node.operation.toLowerCase().includes(q) ||
        node.entry.message.toLowerCase().includes(q) ||
        (node.fileLocation && node.fileLocation.toLowerCase().includes(q))
      );
    });
  }, [stepNodes, searchFilter]);

  const selectedNode = stepNodes[selectedNodeIndex] || stepNodes[0] || null;

  // Auto-scroll node into view when selected
  useEffect(() => {
    if (activeNodeRef.current && containerRef.current) {
      activeNodeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedNodeIndex]);

  if (!isOpen || !correlationId) return null;

  const totalTimeMs = stepNodes.length > 1
    ? stepNodes[stepNodes.length - 1].deltaFromStartMs
    : 0;

  const distinctModules = Array.from(new Set(stepNodes.map((n) => n.module)));
  const errorCount = stepNodes.filter((n) => n.level === 'error' || n.level === 'critical' || n.level === 'emergency').length;
  const warnCount = stepNodes.filter((n) => n.level === 'warning').length;

  const handleOpenInspector = (rawPayload: string, type: 'json' | 'xml') => {
    window.dispatchEvent(
      new CustomEvent('open-payload-inspector', {
        detail: {
          type,
          raw: rawPayload,
          title: `Step #${selectedNode?.index !== undefined ? selectedNode.index + 1 : ''} Payload`,
        },
      })
    );
  };

  const handleCopyRaw = (text: string) => {
    copyWithToast(text, 'Correlation Log Entry');
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 1800);
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isFullScreen ? 0 : 20,
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          width: isFullScreen ? '100vw' : '96vw',
          height: isFullScreen ? '100vh' : '92vh',
          maxWidth: isFullScreen ? '100vw' : 1600,
          backgroundColor: '#0c0e12',
          border: isFullScreen ? 'none' : '1px solid #1f242e',
          borderRadius: isFullScreen ? 0 : 10,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 65px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
          color: 'var(--text-primary, #ededef)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ====================================================================
            HEADER
           ==================================================================== */}
        <div
          style={{
            height: 54,
            padding: '0 20px',
            backgroundColor: '#101216',
            borderBottom: '1px solid #1c212a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexShrink: 0,
          }}
        >
          {/* Left Brand & Correlation Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: 'rgba(52, 211, 153, 0.12)',
                border: '1px solid #34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34d399',
              }}
            >
              <Zap size={16} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Correlation Timeline &amp; DAG
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.78rem',
                    color: '#34d399',
                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    fontWeight: 600,
                  }}
                >
                  {correlationId}
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted, #8b949e)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 2,
                }}
              >
                <span>{stepNodes.length} steps</span>
                <span>•</span>
                <span>{distinctModules.length} modules</span>
                <span>•</span>
                <span style={{ color: '#38bdf8' }}>Total Δt: {formatDurationMs(totalTimeMs)}</span>
                {errorCount > 0 && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#f87171', fontWeight: 600 }}>{errorCount} errors</span>
                  </>
                )}
                {warnCount > 0 && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#fbbf24' }}>{warnCount} warnings</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Toolbar Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Search Filter */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#090a0d',
                border: '1px solid #232832',
                borderRadius: 5,
                padding: '4px 8px',
                width: 170,
              }}
            >
              <Search size={13} color="#64748b" />
              <input
                type="text"
                placeholder="Filter steps..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ededef',
                  fontSize: '0.74rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  width: '100%',
                }}
              />
            </div>

            {/* View Mode Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#090a0d',
                border: '1px solid #232832',
                borderRadius: 5,
                padding: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setViewLayout('dag')}
                style={{
                  border: 'none',
                  background: viewLayout === 'dag' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                  color: viewLayout === 'dag' ? '#60a5fa' : '#8b949e',
                  fontSize: '0.72rem',
                  fontWeight: viewLayout === 'dag' ? 600 : 400,
                  padding: '3px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Layers size={12} />
                <span>DAG Graph</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('waterfall')}
                style={{
                  border: 'none',
                  background: viewLayout === 'waterfall' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                  color: viewLayout === 'waterfall' ? '#60a5fa' : '#8b949e',
                  fontSize: '0.72rem',
                  fontWeight: viewLayout === 'waterfall' ? 600 : 400,
                  padding: '3px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Activity size={12} />
                <span>Waterfall</span>
              </button>
            </div>

            {/* Zoom Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                backgroundColor: '#090a0d',
                border: '1px solid #232832',
                borderRadius: 5,
                padding: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.1))}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#8b949e',
                  padding: 4,
                  cursor: 'pointer',
                  borderRadius: 3,
                }}
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#8b949e',
                  padding: '0 4px',
                }}
              >
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(1.8, z + 0.1))}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#8b949e',
                  padding: 4,
                  cursor: 'pointer',
                  borderRadius: 3,
                }}
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#8b949e',
                  padding: 4,
                  cursor: 'pointer',
                  borderRadius: 3,
                }}
                title="Reset Zoom"
              >
                <RotateCcw size={11} />
              </button>
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullScreen((v) => !v)}
              style={{
                border: '1px solid #232832',
                backgroundColor: '#090a0d',
                color: '#8b949e',
                padding: 6,
                borderRadius: 5,
                cursor: 'pointer',
              }}
              title={isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              style={{
                border: '1px solid #232832',
                backgroundColor: '#090a0d',
                color: '#8b949e',
                padding: 6,
                borderRadius: 5,
                cursor: 'pointer',
              }}
              title="Close Timeline (Esc)"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ====================================================================
            BODY: SPLIT GRAPH / WATERFALL VIEWPORT & STEP INSPECTOR DRAWER
           ==================================================================== */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Main Visual Canvas Area */}
          <div
            ref={containerRef}
            style={{
              flex: 1,
              backgroundColor: '#08090c',
              overflow: 'auto',
              position: 'relative',
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          >
            {isLoading ? (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  color: '#8b949e',
                }}
              >
                <Activity size={24} className="animate-spin" color="#34d399" />
                <span style={{ fontSize: '0.82rem' }}>Reconstructing workflow causality timeline...</span>
              </div>
            ) : filteredStepNodes.length === 0 ? (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: '#8b949e',
                }}
              >
                <Info size={22} color="#64748b" />
                <span style={{ fontSize: '0.85rem' }}>No matching log entries found for this correlation ID</span>
              </div>
            ) : viewLayout === 'dag' ? (
              /* ==============================================================
                 MODE 1: DAG WORKFLOW PIPELINE GRAPH (HORIZONTAL / MULTI-LANE)
                 ============================================================== */
              <div
                style={{
                  padding: '48px 40px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0,
                  transformOrigin: '0 0',
                  transform: `scale(${zoomLevel})`,
                  minWidth: 'max-content',
                }}
              >
                {filteredStepNodes.map((node, i) => {
                  const isSelected = selectedNode?.id === node.id;
                  const isLast = i === filteredStepNodes.length - 1;
                  const lvlTheme = LEVEL_COLORS[node.level] || LEVEL_COLORS.unknown;

                  return (
                    <React.Fragment key={node.id}>
                      {/* Step Node Card */}
                      <div
                        ref={isSelected ? activeNodeRef : null}
                        onClick={() => setSelectedNodeIndex(node.index)}
                        style={{
                          width: 250,
                          backgroundColor: isSelected ? '#151922' : '#0e1117',
                          border: `1.5px solid ${isSelected ? '#3b82f6' : lvlTheme.border}`,
                          boxShadow: isSelected
                            ? '0 0 24px rgba(59, 130, 246, 0.4), inset 0 0 12px rgba(59, 130, 246, 0.1)'
                            : '0 8px 20px rgba(0,0,0,0.5)',
                          borderRadius: 8,
                          padding: 12,
                          cursor: 'pointer',
                          transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                          position: 'relative',
                          flexShrink: 0,
                        }}
                      >
                        {/* Step Sequence Badge */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 8,
                            paddingBottom: 6,
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: '0.68rem',
                                color: isSelected ? '#60a5fa' : '#8b949e',
                                fontWeight: 700,
                              }}
                            >
                              STEP {String(node.index + 1).padStart(2, '0')}
                            </span>
                            <span
                              style={{
                                fontSize: '0.62rem',
                                padding: '1px 5px',
                                borderRadius: 3,
                                backgroundColor: lvlTheme.bg,
                                color: lvlTheme.text,
                                border: `1px solid ${lvlTheme.border}`,
                                textTransform: 'uppercase',
                                fontWeight: 600,
                              }}
                            >
                              {node.level}
                            </span>
                          </div>

                          <span
                            style={{
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: '0.68rem',
                              color: '#64748b',
                            }}
                          >
                            L#{node.lineNumber}
                          </span>
                        </div>

                        {/* Module Name */}
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: '#ededef',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: 4,
                          }}
                          title={node.module}
                        >
                          {node.module}
                        </div>

                        {/* Operation / Action */}
                        <div
                          style={{
                            fontSize: '0.74rem',
                            fontFamily: 'var(--font-mono, monospace)',
                            color: isSelected ? '#93c5fd' : '#94a3b8',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: 8,
                          }}
                          title={node.operation}
                        >
                          {node.operation}
                        </div>

                        {/* File Location Function Origin */}
                        {node.fileLocation && (
                          <div
                            style={{
                              fontSize: '0.68rem',
                              fontFamily: 'var(--font-mono, monospace)',
                              color: '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              marginBottom: 8,
                            }}
                            title={node.fileLocation}
                          >
                            <Code2 size={11} color="#60a5fa" />
                            <span style={{ textDecoration: 'underline' }}>{node.fileLocation}</span>
                          </div>
                        )}

                        {/* Bottom Metadata Badges */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.68rem',
                            fontFamily: 'var(--font-mono, monospace)',
                            color: '#8b949e',
                          }}
                        >
                          <span style={{ color: '#38bdf8' }}>
                            {node.index === 0 ? 'T₀ START' : `+${formatDurationMs(node.deltaFromStartMs)}`}
                          </span>

                          {node.hasPayload && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                color: '#fde047',
                                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                                padding: '1px 5px',
                                borderRadius: 3,
                                border: '1px solid rgba(234, 179, 8, 0.25)',
                              }}
                            >
                              <FileText size={10} />
                              <span>Payload</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Connecting Latency Vector Edge */}
                      {!isLast && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 80,
                            position: 'relative',
                            flexShrink: 0,
                          }}
                        >
                          {/* Latency Pill */}
                          <div
                            style={{
                              position: 'absolute',
                              top: '25%',
                              transform: 'translateY(-50%)',
                              fontSize: '0.64rem',
                              fontFamily: 'var(--font-mono, monospace)',
                              backgroundColor: '#11141b',
                              border: '1px solid #283040',
                              padding: '1px 6px',
                              borderRadius: 4,
                              color: filteredStepNodes[i + 1].deltaFromPrevMs > 500 ? '#f59e0b' : '#34d399',
                              whiteSpace: 'nowrap',
                              fontWeight: 600,
                              zIndex: 2,
                            }}
                          >
                            +{formatDurationMs(filteredStepNodes[i + 1].deltaFromPrevMs)}
                          </div>

                          {/* Arrow Vector Line */}
                          <svg width="80" height="24" style={{ display: 'block' }}>
                            <defs>
                              <marker
                                id="arrowhead"
                                markerWidth="6"
                                markerHeight="6"
                                refX="5"
                                refY="3"
                                orient="auto"
                              >
                                <polygon points="0 0, 6 3, 0 6" fill="#3b82f6" />
                              </marker>
                            </defs>
                            <line
                              x1="0"
                              y1="12"
                              x2="74"
                              y2="12"
                              stroke="#3b82f6"
                              strokeWidth="1.8"
                              strokeDasharray="4 3"
                              markerEnd="url(#arrowhead)"
                            />
                          </svg>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              /* ==============================================================
                 MODE 2: CHRONOLOGICAL WATERFALL GANTT VIEW
                 ============================================================== */
              <div
                style={{
                  padding: 24,
                  transformOrigin: '0 0',
                  transform: `scale(${zoomLevel})`,
                  minWidth: 800,
                }}
              >
                {/* Waterfall Scale Grid Header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '260px 1fr 90px',
                    gap: 16,
                    padding: '8px 12px',
                    borderBottom: '1px solid #1c212a',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono, monospace)',
                    color: '#64748b',
                  }}
                >
                  <span>MODULE &amp; OPERATION</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>0ms</span>
                    <span>{formatDurationMs(totalTimeMs * 0.5)}</span>
                    <span>{formatDurationMs(totalTimeMs)}</span>
                  </div>
                  <span style={{ textAlign: 'right' }}>ELAPSED</span>
                </div>

                {filteredStepNodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  const lvlTheme = LEVEL_COLORS[node.level] || LEVEL_COLORS.unknown;
                  const offsetPct = totalTimeMs > 0 ? (node.deltaFromStartMs / totalTimeMs) * 94 : 0;
                  const durMs = node.duration ? parseFloat(node.duration) : Math.max(12, node.deltaFromPrevMs);
                  const widthPct = totalTimeMs > 0 ? Math.max(2.5, (durMs / totalTimeMs) * 94) : 4;

                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNodeIndex(node.index)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '260px 1fr 90px',
                        gap: 16,
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                        cursor: 'pointer',
                        borderRadius: 4,
                        transition: 'background 120ms ease',
                      }}
                    >
                      {/* Left: Module & Operation */}
                      <div style={{ overflow: 'hidden' }}>
                        <div
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: isSelected ? '#60a5fa' : '#ededef',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          <span style={{ color: '#8b949e', marginRight: 6 }}>#{node.index + 1}</span>
                          {node.module}
                        </div>
                        <div
                          style={{
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-mono, monospace)',
                            color: '#8b949e',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {node.operation}
                        </div>
                      </div>

                      {/* Middle: Relative Waterfall Bar */}
                      <div
                        style={{
                          height: 20,
                          backgroundColor: '#0d1017',
                          borderRadius: 4,
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            left: `${offsetPct}%`,
                            width: `${Math.min(widthPct, 100 - offsetPct)}%`,
                            height: '100%',
                            backgroundColor: lvlTheme.border,
                            borderRadius: 3,
                            opacity: 0.85,
                            boxShadow: `0 0 10px ${lvlTheme.glow}`,
                          }}
                        />
                      </div>

                      {/* Right: Elapsed Ms */}
                      <div
                        style={{
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono, monospace)',
                          color: '#38bdf8',
                          textAlign: 'right',
                        }}
                      >
                        +{formatDurationMs(node.deltaFromStartMs)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ====================================================================
              RIGHT: STEP INSPECTOR DRAWER (WHAT HAPPENED IN THIS FLOW STEP)
             ==================================================================== */}
          <div
            style={{
              width: 440,
              backgroundColor: '#0f1217',
              borderLeft: '1px solid #1c212a',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #1c212a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#12151c',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={14} color="#3b82f6" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                  Step Details &amp; Causality
                </span>
              </div>

              {selectedNode && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.72rem',
                    color: '#60a5fa',
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    fontWeight: 600,
                  }}
                >
                  Step {selectedNode.index + 1} of {stepNodes.length}
                </span>
              )}
            </div>

            {/* Drawer Content */}
            {selectedNode ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {/* Key Metrics Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      padding: '8px 10px',
                      backgroundColor: '#0a0b0e',
                      borderRadius: 6,
                      border: '1px solid #1c202a',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: '#8b949e', marginBottom: 2 }}>
                      LINE NUMBER
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: '#ededef' }}>
                      Line #{selectedNode.lineNumber}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      backgroundColor: '#0a0b0e',
                      borderRadius: 6,
                      border: '1px solid #1c202a',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: '#8b949e', marginBottom: 2 }}>
                      ELAPSED LATENCY
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: '#38bdf8' }}>
                      +{formatDurationMs(selectedNode.deltaFromStartMs)}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      backgroundColor: '#0a0b0e',
                      borderRadius: 6,
                      border: '1px solid #1c202a',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: '#8b949e', marginBottom: 2 }}>
                      SEVERITY LEVEL
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: (LEVEL_COLORS[selectedNode.level] || LEVEL_COLORS.unknown).text,
                      }}
                    >
                      {selectedNode.level}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      backgroundColor: '#0a0b0e',
                      borderRadius: 6,
                      border: '1px solid #1c202a',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: '#8b949e', marginBottom: 2 }}>
                      STEP DURATION
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: '#34d399' }}>
                      {selectedNode.duration || formatDurationMs(selectedNode.deltaFromPrevMs)}
                    </div>
                  </div>
                </div>

                {/* Module & Origin Function Location */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.68rem', color: '#8b949e', marginBottom: 4, fontWeight: 600 }}>
                    MODULE &amp; FUNCTION CALL
                  </div>
                  <div
                    style={{
                      backgroundColor: '#0a0b0e',
                      borderRadius: 6,
                      border: '1px solid #1c202a',
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#60a5fa' }}>
                      {selectedNode.module}
                    </div>
                    <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono, monospace)', color: '#cbd5e1' }}>
                      {selectedNode.operation}
                    </div>

                    {selectedNode.fileLocation && (
                      <div
                        onClick={() => openSourceLocation(selectedNode.fileLocation!)}
                        style={{
                          marginTop: 4,
                          paddingTop: 6,
                          borderTop: '1px solid rgba(255,255,255,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono, monospace)',
                          color: '#38bdf8',
                          cursor: 'pointer',
                        }}
                        title={isVsCode() ? 'Click to open in editor' : `Location: ${selectedNode.fileLocation}`}
                      >
                        <Code2 size={12} />
                        <span style={{ textDecoration: 'underline' }}>{selectedNode.fileLocation}</span>
                        <ExternalLink size={10} color="#64748b" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Log Message Render */}
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.68rem',
                      color: '#8b949e',
                      marginBottom: 4,
                      fontWeight: 600,
                    }}
                  >
                    <span>MESSAGE CONTENT</span>
                    <button
                      type="button"
                      onClick={() => handleCopyRaw(selectedNode.entry.message || selectedNode.entry.raw)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#60a5fa',
                        fontSize: '0.68rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {copiedSnippet ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
                      <span>{copiedSnippet ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div
                    style={{
                      backgroundColor: '#0a0b0e',
                      borderRadius: 6,
                      border: '1px solid #1c202a',
                      padding: 10,
                      fontSize: '0.76rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      lineHeight: 1.5,
                      color: '#e2e8f0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: 140,
                      overflowY: 'auto',
                    }}
                  >
                    {renderSyntaxColoredLine(selectedNode.entry.message || selectedNode.entry.raw, false)}
                  </div>
                </div>

                {/* Embedded JSON / XML Payload Detected */}
                {selectedNode.hasPayload && selectedNode.payloadSnippet && (
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.68rem',
                        color: '#fde047',
                        marginBottom: 4,
                        fontWeight: 600,
                      }}
                    >
                      <span>EMBEDDED PAYLOAD INSPECTION</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenInspector(
                            selectedNode.payloadSnippet!,
                            selectedNode.payloadSnippet!.trim().startsWith('<') ? 'xml' : 'json'
                          )
                        }
                        style={{
                          backgroundColor: 'rgba(234, 179, 8, 0.14)',
                          border: '1px solid #fde047',
                          color: '#fde047',
                          fontSize: '0.68rem',
                          borderRadius: 4,
                          padding: '2px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: 600,
                        }}
                      >
                        <Code2 size={11} />
                        <span>Open in AST Tree</span>
                      </button>
                    </div>

                    <pre
                      style={{
                        backgroundColor: '#090a0d',
                        borderRadius: 6,
                        border: '1px solid rgba(234, 179, 8, 0.25)',
                        padding: 10,
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        color: '#fde047',
                        margin: 0,
                        maxHeight: 120,
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {selectedNode.payloadSnippet.slice(0, 300)}
                      {selectedNode.payloadSnippet.length > 300 ? '...' : ''}
                    </pre>
                  </div>
                )}

                {/* Action Buttons: Jump to Table & View Surrounding Context */}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectLine) {
                        onSelectLine(selectedNode.lineNumber);
                      }
                      onClose();
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid #3b82f6',
                      color: '#60a5fa',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      borderRadius: 5,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span>Highlight Line in Table</span>
                    <ArrowRight size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onViewContext) {
                        onViewContext(selectedNode.lineNumber, selectedNode.entry.sourceId);
                      }
                      onClose();
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: '#161922',
                      border: '1px solid #283040',
                      color: '#cbd5e1',
                      fontSize: '0.74rem',
                      borderRadius: 5,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span>±25 Context</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  fontSize: '0.78rem',
                }}
              >
                Click any step node in the graph to inspect details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default CorrelationTimelineModal;
