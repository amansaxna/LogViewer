import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  GitBranch,
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
  ArrowRight,
  AlertOctagon,
  Flame,
  Share2,
  Download,
  Keyboard,
  Cpu,
  Layers as LayersIcon
} from 'lucide-react';
import { LogEntry, LogLevel } from '../types.ts';
import { apiFetch, openSourceLocation, isVsCode } from '../api/bridge.ts';
import { copyWithToast } from '../utils/copyNotifier.ts';
import { renderSyntaxColoredLine } from '../utils/coloredLogRenderer.tsx';
import { findJsonBlocks, findXmlBlocks } from '../utils/messageContextHighlighter.tsx';
import { TraceViewer } from './TraceViewer.tsx';
import {
  parseNamespaceHierarchy,
  groupNodesIntoSubsystems,
  groupNodesIntoThreadSwimlanes,
  getSubsystemColor,
  NamespaceHierarchy,
  SubsystemCluster,
  ThreadSwimlane,
} from '../utils/dagHierarchyEngine.ts';

interface CorrelationTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  correlationId?: string | null;
  workflowId?: string | null;
  activeSourceId?: string | null;
  selectedSourceIds?: string[];
  currentEntries?: LogEntry[];
  theme?: 'dark' | 'light';
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
  hasTrace: boolean;
  isHotspot: boolean;
  hierarchy: NamespaceHierarchy;
}

function getLevelColors(level: string, isLight: boolean) {
  if (isLight) {
    switch (level) {
      case 'emergency':
      case 'alert':
      case 'critical':
      case 'error':
        return { bg: 'rgba(239, 68, 68, 0.12)', border: '#dc2626', text: '#b91c1c', glow: 'rgba(220, 38, 38, 0.25)' };
      case 'warning':
        return { bg: 'rgba(245, 158, 11, 0.14)', border: '#d97706', text: '#b45309', glow: 'rgba(217, 119, 6, 0.25)' };
      case 'notice':
        return { bg: 'rgba(2, 132, 199, 0.12)', border: '#0284c7', text: '#0369a1', glow: 'rgba(2, 132, 199, 0.25)' };
      case 'info':
        return { bg: 'rgba(37, 99, 235, 0.12)', border: '#2563eb', text: '#1d4ed8', glow: 'rgba(37, 99, 235, 0.25)' };
      case 'audit':
        return { bg: 'rgba(124, 58, 237, 0.12)', border: '#7c3aed', text: '#6d28d9', glow: 'rgba(124, 58, 237, 0.25)' };
      case 'debug':
      case 'trace':
      default:
        return { bg: 'rgba(100, 116, 139, 0.12)', border: '#64748b', text: '#475569', glow: 'rgba(100, 116, 139, 0.2)' };
    }
  }

  // Dark mode
  switch (level) {
    case 'emergency':
    case 'alert':
    case 'critical':
      return { bg: 'rgba(239, 68, 68, 0.18)', border: '#ef4444', text: '#fca5a5', glow: 'rgba(239, 68, 68, 0.4)' };
    case 'error':
      return { bg: 'rgba(248, 113, 113, 0.16)', border: '#f87171', text: '#fca5a5', glow: 'rgba(248, 113, 113, 0.35)' };
    case 'warning':
      return { bg: 'rgba(251, 191, 36, 0.14)', border: '#fbbf24', text: '#fde047', glow: 'rgba(251, 191, 36, 0.35)' };
    case 'notice':
      return { bg: 'rgba(56, 189, 248, 0.12)', border: '#38bdf8', text: '#7dd3fc', glow: 'rgba(56, 189, 248, 0.3)' };
    case 'info':
      return { bg: 'rgba(96, 165, 250, 0.12)', border: '#60a5fa', text: '#93c5fd', glow: 'rgba(96, 165, 250, 0.25)' };
    case 'audit':
      return { bg: 'rgba(192, 132, 252, 0.14)', border: '#c084fc', text: '#d8b4fe', glow: 'rgba(192, 132, 252, 0.3)' };
    case 'debug':
      return { bg: 'rgba(148, 163, 184, 0.12)', border: '#94a3b8', text: '#cbd5e1', glow: 'rgba(148, 163, 184, 0.2)' };
    case 'trace':
    default:
      return { bg: 'rgba(100, 116, 139, 0.12)', border: '#64748b', text: '#94a3b8', glow: 'rgba(100, 116, 139, 0.2)' };
  }
}

function formatDurationMs(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function kbdStyle(isLight: boolean): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '1px 5px',
    fontSize: '0.64rem',
    fontFamily: 'var(--font-mono, monospace)',
    fontWeight: 700,
    lineHeight: '1.2',
    color: isLight ? '#1c1917' : '#f1f5f9',
    backgroundColor: isLight ? '#ffffff' : '#1e2430',
    border: isLight ? '1px solid #d6cfc3' : '1px solid #333d4e',
    borderRadius: 3,
    boxShadow: isLight ? '0 1px 0 rgba(0,0,0,0.1)' : '0 1px 0 rgba(0,0,0,0.4)',
  };
}

export const CorrelationTimelineModal: React.FC<CorrelationTimelineModalProps> = ({
  isOpen,
  onClose,
  correlationId,
  workflowId,
  activeSourceId,
  selectedSourceIds,
  currentEntries = [],
  theme = 'dark',
  onSelectLine,
  onViewContext,
}) => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [viewLayout, setViewLayout] = useState<'dag' | 'waterfall' | 'swimlanes'>('dag');
  const [isSubsystemClustered, setIsSubsystemClustered] = useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [rcaCopied, setRcaCopied] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeNodeRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isWorkflow = Boolean(workflowId);
  const targetId = workflowId || correlationId;

  // Key navigation will be registered after stepNodes and handlers are initialized

  // Fetch or filter entries for this correlation ID or workflow
  useEffect(() => {
    if (!isOpen || !targetId) return;

    // Check if current in-memory entries contain matching items
    const matchingLocal = currentEntries.filter((e) => {
      if (isWorkflow && workflowId) {
        return Boolean(e.workflow && e.workflow.toLowerCase().includes(workflowId.toLowerCase()));
      }
      if (correlationId) {
        return Boolean(e.correlationId && e.correlationId.toLowerCase() === correlationId.toLowerCase());
      }
      return false;
    });

    // If local entries exist and represent multiple or all, load them first
    if (matchingLocal.length > 0) {
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

    const filterParam = isWorkflow && workflowId
      ? `workflow=${encodeURIComponent(workflowId)}`
      : `correlationId=${encodeURIComponent(correlationId || '')}`;

    const url = `/api/logs/entries?${sourceParam}&${filterParam}&pageSize=5000&sortBy=time&direction=asc`;

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
        console.warn('Could not fetch timeline entries from server:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, targetId, isWorkflow, workflowId, correlationId, activeSourceId, selectedSourceIds, currentEntries]);

  // Compute graph nodes with latency deltas, payload detection, trace detection, and bottleneck hotspots
  const stepNodes: TimelineStepNode[] = useMemo(() => {
    if (entries.length === 0) return [];

    let startMs = 0;
    const rawNodes = entries.map((entry, idx) => {
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
      const hasTrace = Boolean(entry.trace && entry.trace.frames && entry.trace.frames.length > 0);
      const rawModule = entry.namespace || (isWorkflow ? entry.operation || 'Workflow Action' : entry.workflow || 'Main');
      const hierarchy = parseNamespaceHierarchy(rawModule);

      return {
        id: entry.id || `node-${idx}-${entry.lineNumber}`,
        index: idx,
        entry,
        lineNumber: entry.lineNumber,
        timestampMs: ts,
        formattedTime: entry.datetime || new Date(ts).toISOString().slice(11, 23),
        deltaFromPrevMs,
        deltaFromStartMs,
        module: rawModule,
        operation: entry.operation || (entry.workflow && !isWorkflow ? `[${entry.workflow}]` : entry.correlationId ? `[${entry.correlationId}]` : (entry.message ? entry.message.slice(0, 48) : 'Event')),
        fileLocation: entry.fileLocation,
        level: entry.level,
        duration: entry.duration,
        hasPayload,
        payloadSnippet,
        hasTrace,
        isHotspot: false,
        hierarchy,
      };
    });

    const maxDelta = Math.max(0, ...rawNodes.map((n) => n.deltaFromPrevMs));
    if (maxDelta >= 80 && rawNodes.length > 2) {
      const hotspotNode = rawNodes.find((n) => n.deltaFromPrevMs === maxDelta);
      if (hotspotNode) {
        hotspotNode.isHotspot = true;
      }
    }

    return rawNodes;
  }, [entries, isWorkflow]);

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

  const isLight = theme === 'light';

  const totalTimeMs = stepNodes.length > 1
    ? stepNodes[stepNodes.length - 1].deltaFromStartMs
    : 0;

  const distinctModules = Array.from(new Set(stepNodes.map((n) => n.module)));
  const distinctSubsystems = Array.from(new Set(stepNodes.map((n) => n.hierarchy.root)));
  const errorCount = stepNodes.filter((n) => n.level === 'error' || n.level === 'critical' || n.level === 'emergency').length;
  const warnCount = stepNodes.filter((n) => n.level === 'warning').length;

  // Subsystem clusters for Phase 2
  const subsystemClusters = useMemo(() => {
    return groupNodesIntoSubsystems(filteredStepNodes, isLight);
  }, [filteredStepNodes, isLight]);

  // Thread Swimlanes for Phase 3
  const threadSwimlanes = useMemo(() => {
    return groupNodesIntoThreadSwimlanes(filteredStepNodes);
  }, [filteredStepNodes]);

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

  const buildRcaMarkdown = () => {
    if (stepNodes.length === 0) return '';
    const errors = stepNodes.filter((n) => n.level === 'error' || n.level === 'critical' || n.level === 'emergency');
    const warnings = stepNodes.filter((n) => n.level === 'warning');
    const hotspot = stepNodes.find((n) => n.isHotspot);

    const lines: string[] = [];
    lines.push(`# 🔍 Root Cause Analysis (RCA) — Trace Report`);
    lines.push(`- **Target Trace**: \`${targetId}\` (${isWorkflow ? 'Workflow' : 'Correlation ID'})`);
    lines.push(`- **Execution Status**: ${errors.length > 0 ? '❌ FAILED' : warnings.length > 0 ? '⚠️ COMPLETED WITH WARNINGS' : '✅ HEALTHY'}`);
    lines.push(`- **Span Metrics**: ${stepNodes.length} steps | Total Time: **${formatDurationMs(totalTimeMs)}** | Distinct Namespaces: **${distinctModules.length}**`);
    if (hotspot) {
      lines.push(`- **Latency Bottleneck**: Step #${hotspot.index + 1} (\`${hotspot.module}\` · \`${hotspot.operation}\`) consumed **+${formatDurationMs(hotspot.deltaFromPrevMs)}**`);
    }
    lines.push('');

    if (errors.length > 0) {
      lines.push(`## 🚨 Failure Root Cause Points (${errors.length})`);
      errors.forEach((err) => {
        lines.push(`### Step #${err.index + 1} (Line #${err.lineNumber}) — [${err.level.toUpperCase()}]`);
        lines.push(`- **Namespace**: \`${err.module}\``);
        lines.push(`- **Operation**: \`${err.operation}\``);
        if (err.fileLocation) lines.push(`- **Code Location**: \`${err.fileLocation}\``);
        lines.push(`- **Message**: ${err.entry.message || err.entry.raw}`);
        if (err.entry.trace?.raw) {
          lines.push(`\n\`\`\`text\n${err.entry.trace.raw}\n\`\`\``);
        }
      });
      lines.push('');
    }

    if (warnings.length > 0) {
      lines.push(`## ⚠️ Diagnostic Warnings (${warnings.length})`);
      warnings.forEach((warn) => {
        lines.push(`- **Step #${warn.index + 1} (Line #${warn.lineNumber})**: \`${warn.module}\` — ${warn.entry.message || warn.entry.raw}`);
      });
      lines.push('');
    }

    lines.push(`## ⏱️ Sequential Step Execution Timeline`);
    lines.push(`| Step | Line | Level | Elapsed | Duration | Namespace / Module | Operation / Action | File Location |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`);
    stepNodes.forEach((n) => {
      lines.push(`| #${n.index + 1} | L#${n.lineNumber} | ${n.level.toUpperCase()} | +${formatDurationMs(n.deltaFromStartMs)} | ${n.duration || '+' + formatDurationMs(n.deltaFromPrevMs)} | \`${n.module}\` | \`${n.operation}\` | \`${n.fileLocation || '-'}\` |`);
    });
    lines.push('');

    return lines.join('\n');
  };

  const handleCopyRca = () => {
    const text = buildRcaMarkdown();
    if (!text) return;
    copyWithToast(text, 'RCA Markdown Report');
    setRcaCopied(true);
    setTimeout(() => setRcaCopied(false), 2000);
  };

  const handleDownloadRca = () => {
    const text = buildRcaMarkdown();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rca_report_${(targetId || 'trace').replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    copyWithToast(text, 'Downloaded RCA Report (.md)');
  };

  // Developer Keyboard Shortcuts for both DAG & Waterfall Views
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      const isInputFocused =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';

      // When searching, let user type; Escape blurs the input
      if (isInputFocused) {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      // 1. Close Modal (Esc)
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // 2. Navigation: Next Step (ArrowRight, ArrowDown, 'j')
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setSelectedNodeIndex((prev) => Math.min(prev + 1, Math.max(0, stepNodes.length - 1)));
        return;
      }

      // 3. Navigation: Previous Step (ArrowLeft, ArrowUp, 'k')
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setSelectedNodeIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      // 4. Jump to Start / End of Trace (Home / End or g / G)
      if (e.key === 'Home' || (e.key === 'g' && !e.shiftKey)) {
        e.preventDefault();
        setSelectedNodeIndex(0);
        return;
      }
      if (e.key === 'End' || (e.key === 'G' && e.shiftKey)) {
        e.preventDefault();
        setSelectedNodeIndex(Math.max(0, stepNodes.length - 1));
        return;
      }

      // 5. Jump to Next Error / Failure Step ('e' / 'E')
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        const errIndices = stepNodes
          .map((n, i) => (['error', 'critical', 'emergency', 'alert'].includes(n.level) ? i : -1))
          .filter((i) => i !== -1);
        if (errIndices.length > 0) {
          const next = errIndices.find((i) => i > selectedNodeIndex);
          setSelectedNodeIndex(next !== undefined ? next : errIndices[0]);
        }
        return;
      }

      // 6. Jump to Next Warning Step ('w' / 'W')
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        const warnIndices = stepNodes
          .map((n, i) => (n.level === 'warning' ? i : -1))
          .filter((i) => i !== -1);
        if (warnIndices.length > 0) {
          const next = warnIndices.find((i) => i > selectedNodeIndex);
          setSelectedNodeIndex(next !== undefined ? next : warnIndices[0]);
        }
        return;
      }

      // 7. Jump to Latency Bottleneck / Hotspot ('h' / 'H')
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        const hotspotIdx = stepNodes.findIndex((n) => n.isHotspot);
        if (hotspotIdx !== -1) {
          setSelectedNodeIndex(hotspotIdx);
        }
        return;
      }

      // 8. Toggle DAG ↔ Waterfall ↔ Swimlanes View ('v' or Tab)
      if (e.key === 'v' || e.key === 'V' || e.key === 'Tab') {
        e.preventDefault();
        setViewLayout((prev) => (prev === 'dag' ? 'waterfall' : prev === 'waterfall' ? 'swimlanes' : 'dag'));
        return;
      }

      // 8b. Toggle Subsystem Cluster Enclosure ('b' / 'B')
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setIsSubsystemClustered((prev) => !prev);
        return;
      }

      // 9. Jump to Selected Line in Main Table (Enter)
      if (e.key === 'Enter') {
        if (selectedNode && onSelectLine) {
          e.preventDefault();
          onSelectLine(selectedNode.lineNumber);
          onClose();
        }
        return;
      }

      // 10. View Context Lines in Modal ('c' / 'C')
      if (e.key === 'c' || e.key === 'C') {
        if (selectedNode && onViewContext) {
          e.preventDefault();
          onViewContext(selectedNode.lineNumber, selectedNode.entry.sourceId);
          onClose();
        }
        return;
      }

      // 11. Yank / Copy Message to Clipboard ('y' / 'Y')
      if (e.key === 'y' || e.key === 'Y') {
        if (selectedNode) {
          e.preventDefault();
          handleCopyRaw(selectedNode.entry.message || selectedNode.entry.raw);
        }
        return;
      }

      // 12. Open Payload AST Inspector ('p' / 'P')
      if (e.key === 'p' || e.key === 'P') {
        if (selectedNode?.hasPayload && selectedNode.payloadSnippet) {
          e.preventDefault();
          handleOpenInspector(
            selectedNode.payloadSnippet,
            selectedNode.payloadSnippet.trim().startsWith('<') ? 'xml' : 'json'
          );
        }
        return;
      }

      // 13. Copy RCA Markdown Report ('r' / 'R')
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleCopyRca();
        return;
      }

      // 14. Download RCA Markdown File ('d' / 'D')
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleDownloadRca();
        return;
      }

      // 15. Zoom Controls ('+' / '=' in, '-' / '_' out, '0' reset)
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoomLevel((z) => Math.min(1.8, Math.round((z + 0.1) * 10) / 10));
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoomLevel((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10));
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        setZoomLevel(1);
        return;
      }

      // 16. Fullscreen Modal Toggle ('f' / 'F')
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFullScreen((prev) => !prev);
        return;
      }

      // 17. Focus Step Filter ('/')
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // 18. Toggle Developer Shortcuts Cheatsheet ('?' or 'F1')
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, stepNodes, selectedNode, selectedNodeIndex, onSelectLine, onViewContext]);

  if (!isOpen || !targetId) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: isLight ? 'rgba(28, 25, 23, 0.45)' : 'rgba(0, 0, 0, 0.85)',
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
          backgroundColor: isLight ? '#faf7f2' : '#0c0e12',
          border: isFullScreen ? 'none' : isLight ? '1px solid #ded7ca' : '1px solid #1f242e',
          borderRadius: isFullScreen ? 0 : 10,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isLight
            ? '0 20px 50px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08)'
            : '0 25px 65px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
          color: isLight ? '#1c1917' : 'var(--text-primary, #ededef)',
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
            backgroundColor: isLight ? '#f3eee5' : '#101216',
            borderBottom: isLight ? '1px solid #ded7ca' : '1px solid #1c212a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexShrink: 0,
          }}
        >
          {/* Left Brand & Timeline Identity (Correlation or Workflow) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: isWorkflow
                  ? (isLight ? 'rgba(124, 58, 237, 0.12)' : 'rgba(192, 132, 252, 0.15)')
                  : (isLight ? 'rgba(5, 150, 105, 0.12)' : 'rgba(52, 211, 153, 0.12)'),
                border: isWorkflow
                  ? (isLight ? '1px solid #7c3aed' : '1px solid #c084fc')
                  : (isLight ? '1px solid #059669' : '1px solid #34d399'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isWorkflow
                  ? (isLight ? '#7c3aed' : '#c084fc')
                  : (isLight ? '#059669' : '#34d399'),
              }}
            >
              {isWorkflow ? <GitBranch size={16} /> : <Zap size={16} />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, letterSpacing: '-0.01em', color: isLight ? '#1c1917' : '#ededef' }}>
                  {isWorkflow ? 'Workflow Timeline & DAG' : 'Correlation Timeline & DAG'}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.78rem',
                    color: isWorkflow
                      ? (isLight ? '#6d28d9' : '#c084fc')
                      : (isLight ? '#047857' : '#34d399'),
                    backgroundColor: isWorkflow
                      ? (isLight ? 'rgba(124, 58, 237, 0.1)' : 'rgba(192, 132, 252, 0.1)')
                      : (isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(52, 211, 153, 0.1)'),
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: isWorkflow
                      ? (isLight ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid rgba(192, 132, 252, 0.3)')
                      : (isLight ? '1px solid rgba(5, 150, 105, 0.3)' : '1px solid rgba(52, 211, 153, 0.3)'),
                    fontWeight: 600,
                  }}
                >
                  {targetId}
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: isLight ? '#78716c' : 'var(--text-muted, #8b949e)',
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
                <span style={{ color: isLight ? '#0284c7' : '#38bdf8' }}>Total Δt: {formatDurationMs(totalTimeMs)}</span>
                {errorCount > 0 && (
                  <>
                    <span>•</span>
                    <span style={{ color: isLight ? '#dc2626' : '#f87171', fontWeight: 600 }}>{errorCount} errors</span>
                  </>
                )}
                {warnCount > 0 && (
                  <>
                    <span>•</span>
                    <span style={{ color: isLight ? '#d97706' : '#fbbf24' }}>{warnCount} warnings</span>
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
                backgroundColor: isLight ? '#eae4d8' : '#090a0d',
                border: isLight ? '1px solid #ded7ca' : '1px solid #232832',
                borderRadius: 5,
                padding: '4px 8px',
                width: 170,
              }}
            >
              <Search size={13} color={isLight ? '#78716c' : '#64748b'} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Filter steps... (/)"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: isLight ? '#1c1917' : '#ededef',
                  fontSize: '0.74rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  width: '100%',
                }}
              />
            </div>

            {/* RCA Export Button Group */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: isLight ? '#eae4d8' : '#090a0d',
                border: isLight ? '1px solid #ded7ca' : '1px solid #232832',
                borderRadius: 5,
                padding: 2,
                gap: 2,
              }}
            >
              <button
                type="button"
                onClick={handleCopyRca}
                style={{
                  border: 'none',
                  backgroundColor: rcaCopied ? (isLight ? 'rgba(5, 150, 105, 0.15)' : 'rgba(52, 211, 153, 0.18)') : 'transparent',
                  color: rcaCopied ? (isLight ? '#047857' : '#34d399') : (isLight ? '#0369a1' : '#38bdf8'),
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 150ms ease',
                }}
                title="Copy Root Cause Analysis Markdown report to clipboard (Hotkey: r)"
              >
                {rcaCopied ? <Check size={12} color={isLight ? '#047857' : '#34d399'} /> : <Copy size={12} />}
                <span>{rcaCopied ? 'Copied RCA' : 'Copy RCA'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadRca}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: isLight ? '#57534e' : '#8b949e',
                  padding: '3px 6px',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Download RCA Report as .md file (Hotkey: d)"
              >
                <Download size={12} />
              </button>
            </div>

            {/* Developer Keyboard Shortcuts Trigger */}
            <button
              type="button"
              onClick={() => setShowShortcuts((prev) => !prev)}
              style={{
                border: isLight ? '1px solid #ded7ca' : '1px solid #232832',
                backgroundColor: showShortcuts
                  ? (isLight ? '#ffffff' : 'rgba(59, 130, 246, 0.18)')
                  : (isLight ? '#eae4d8' : '#090a0d'),
                color: showShortcuts ? (isLight ? '#0284c7' : '#60a5fa') : (isLight ? '#57534e' : '#8b949e'),
                padding: '4px 8px',
                borderRadius: 5,
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
              title="Toggle Developer Keyboard Shortcuts (?)"
            >
              <Keyboard size={13} />
              <span>Keys</span>
            </button>

            {/* View Mode Toggle: DAG vs Waterfall vs Swimlanes */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: isLight ? '#eae4d8' : '#090a0d',
                border: isLight ? '1px solid #ded7ca' : '1px solid #232832',
                borderRadius: 5,
                padding: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setViewLayout('dag')}
                style={{
                  border: 'none',
                  background: viewLayout === 'dag' ? (isLight ? '#ffffff' : 'rgba(59, 130, 246, 0.18)') : 'transparent',
                  boxShadow: viewLayout === 'dag' && isLight ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  color: viewLayout === 'dag' ? (isLight ? '#0284c7' : '#60a5fa') : (isLight ? '#78716c' : '#8b949e'),
                  fontSize: '0.72rem',
                  fontWeight: viewLayout === 'dag' ? 600 : 400,
                  padding: '3px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="DAG Pipeline View (v)"
              >
                <Layers size={12} />
                <span>DAG</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('waterfall')}
                style={{
                  border: 'none',
                  background: viewLayout === 'waterfall' ? (isLight ? '#ffffff' : 'rgba(59, 130, 246, 0.18)') : 'transparent',
                  boxShadow: viewLayout === 'waterfall' && isLight ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  color: viewLayout === 'waterfall' ? (isLight ? '#0284c7' : '#60a5fa') : (isLight ? '#78716c' : '#8b949e'),
                  fontSize: '0.72rem',
                  fontWeight: viewLayout === 'waterfall' ? 600 : 400,
                  padding: '3px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Chronological Waterfall View (v)"
              >
                <Activity size={12} />
                <span>Waterfall</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('swimlanes')}
                style={{
                  border: 'none',
                  background: viewLayout === 'swimlanes' ? (isLight ? '#ffffff' : 'rgba(59, 130, 246, 0.18)') : 'transparent',
                  boxShadow: viewLayout === 'swimlanes' && isLight ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  color: viewLayout === 'swimlanes' ? (isLight ? '#0284c7' : '#60a5fa') : (isLight ? '#78716c' : '#8b949e'),
                  fontSize: '0.72rem',
                  fontWeight: viewLayout === 'swimlanes' ? 600 : 400,
                  padding: '3px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Parallel Multi-Thread Async Swimlanes View (v)"
              >
                <Cpu size={12} />
                <span>Swimlanes</span>
              </button>
            </div>

            {/* Subsystem Cluster Bounding Enclosure Toggle */}
            <button
              type="button"
              onClick={() => setIsSubsystemClustered((c) => !c)}
              style={{
                border: isSubsystemClustered
                  ? (isLight ? '1px solid #0284c7' : '1px solid #3b82f6')
                  : (isLight ? '1px solid #ded7ca' : '1px solid #232832'),
                backgroundColor: isSubsystemClustered
                  ? (isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(59, 130, 246, 0.15)')
                  : (isLight ? '#eae4d8' : '#090a0d'),
                color: isSubsystemClustered
                  ? (isLight ? '#0284c7' : '#60a5fa')
                  : (isLight ? '#78716c' : '#8b949e'),
                padding: '4px 8px',
                borderRadius: 5,
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Toggle Subsystem Cluster Grouping Enclosures (Hotkey: b)"
            >
              <LayersIcon size={12} />
              <span>{isSubsystemClustered ? 'Clusters ON' : 'Clusters OFF'}</span>
            </button>

            {/* Zoom Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                backgroundColor: isLight ? '#eae4d8' : '#090a0d',
                border: isLight ? '1px solid #ded7ca' : '1px solid #232832',
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
                  color: isLight ? '#57534e' : '#8b949e',
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
                  color: isLight ? '#57534e' : '#8b949e',
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
                  color: isLight ? '#57534e' : '#8b949e',
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
                  color: isLight ? '#57534e' : '#8b949e',
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
                border: isLight ? '1px solid #ded7ca' : '1px solid #232832',
                backgroundColor: isLight ? '#eae4d8' : '#090a0d',
                color: isLight ? '#57534e' : '#8b949e',
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
                border: isLight ? '1px solid #ded7ca' : '1px solid #232832',
                backgroundColor: isLight ? '#eae4d8' : '#090a0d',
                color: isLight ? '#57534e' : '#8b949e',
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
              backgroundColor: isLight ? '#f7f4ed' : '#08090c',
              overflow: 'auto',
              position: 'relative',
              backgroundImage: isLight
                ? 'radial-gradient(circle at 1px 1px, rgba(28, 25, 23, 0.08) 1px, transparent 0)'
                : 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
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
                  color: isLight ? '#78716c' : '#8b949e',
                }}
              >
                <Activity size={24} className="animate-spin" color={isLight ? '#059669' : '#34d399'} />
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
                  color: isLight ? '#78716c' : '#8b949e',
                }}
              >
                <Info size={22} color={isLight ? '#78716c' : '#64748b'} />
                <span style={{ fontSize: '0.85rem' }}>No matching log entries found for this correlation ID</span>
              </div>
            ) : viewLayout === 'dag' ? (
              /* ==============================================================
                 MODE 1: DAG WORKFLOW PIPELINE GRAPH (WITH SUBSYSTEM CLUSTERS & COMPACT BREADCRUMBS)
                 ============================================================== */
              <div
                style={{
                  padding: '36px 32px',
                  display: 'inline-flex',
                  alignItems: 'flex-start',
                  gap: isSubsystemClustered ? 24 : 0,
                  transformOrigin: '0 0',
                  transform: `scale(${zoomLevel})`,
                  minWidth: 'max-content',
                }}
              >
                {isSubsystemClustered ? (
                  /* --- CLUSTERED SUBSYSTEM BOUNDARY VIEW (Phase 2) --- */
                  subsystemClusters.map((cluster, cIdx) => {
                    const isLastCluster = cIdx === subsystemClusters.length - 1;
                    const cTheme = getSubsystemColor(cluster.root, isLight);

                    return (
                      <React.Fragment key={cluster.id}>
                        {/* Cluster Bounding Enclosure */}
                        <div
                          style={{
                            border: `1.5px dashed ${cTheme.border}`,
                            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 20, 28, 0.65)',
                            borderRadius: 10,
                            padding: '14px 16px 16px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                            position: 'relative',
                            boxShadow: isLight
                              ? '0 2px 8px rgba(0, 0, 0, 0.04)'
                              : `0 4px 20px ${cTheme.bg}`,
                          }}
                        >
                          {/* Subsystem Cluster Header Badge */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              paddingBottom: 6,
                              borderBottom: isLight ? '1px solid #ded7ca' : '1px solid rgba(255, 255, 255, 0.06)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontSize: '0.64rem',
                                  textTransform: 'uppercase',
                                  fontWeight: 800,
                                  letterSpacing: '0.05em',
                                  color: cTheme.text,
                                  backgroundColor: cTheme.badge,
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  fontFamily: 'var(--font-mono, monospace)',
                                }}
                              >
                                SUBSYSTEM: {cluster.root}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: isLight ? '#78716c' : '#8b949e' }}>
                                {cluster.items.length} {cluster.items.length === 1 ? 'step' : 'steps'}
                              </span>
                            </div>

                            <span
                              style={{
                                fontSize: '0.64rem',
                                fontFamily: 'var(--font-mono, monospace)',
                                color: isLight ? '#0284c7' : '#38bdf8',
                              }}
                            >
                              Σ Δt: {formatDurationMs(cluster.totalDeltaMs)}
                            </span>
                          </div>

                          {/* Horizontal Row of Nodes inside this Cluster */}
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
                            {cluster.items.map((node, i) => {
                              const isSelected = selectedNode?.id === node.id;
                              const isLastInCluster = i === cluster.items.length - 1;
                              const lvlTheme = getLevelColors(node.level, isLight);

                              return (
                                <React.Fragment key={node.id}>
                                  {/* Step Node Card with Compact Breadcrumbs (Phase 1) */}
                                  <div
                                    ref={isSelected ? activeNodeRef : null}
                                    onClick={() => setSelectedNodeIndex(node.index)}
                                    style={{
                                      width: 250,
                                      backgroundColor: isSelected
                                        ? (isLight ? '#ffffff' : '#151922')
                                        : (isLight ? '#ffffff' : '#0e1117'),
                                      border: isSelected
                                        ? (isLight ? '1.5px solid #0284c7' : '1.5px solid #3b82f6')
                                        : `1.5px solid ${lvlTheme.border}`,
                                      boxShadow: isSelected
                                        ? (isLight
                                            ? '0 0 0 2px #0284c7, 0 8px 24px rgba(2, 132, 199, 0.2)'
                                            : '0 0 24px rgba(59, 130, 246, 0.4), inset 0 0 12px rgba(59, 130, 246, 0.1)')
                                        : (isLight
                                            ? '0 3px 10px rgba(28, 25, 23, 0.07)'
                                            : '0 8px 20px rgba(0,0,0,0.5)'),
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
                                        borderBottom: isLight ? '1px solid #ded7ca' : '1px solid rgba(255,255,255,0.06)',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span
                                          style={{
                                            fontFamily: 'var(--font-mono, monospace)',
                                            fontSize: '0.68rem',
                                            color: isSelected ? (isLight ? '#0284c7' : '#60a5fa') : (isLight ? '#57534e' : '#8b949e'),
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

                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {node.entry.tid && (
                                          <span
                                            style={{
                                              fontSize: '0.62rem',
                                              fontFamily: 'var(--font-mono, monospace)',
                                              color: isLight ? '#047857' : '#34d399',
                                              backgroundColor: isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(52, 211, 153, 0.12)',
                                              padding: '1px 4px',
                                              borderRadius: 3,
                                            }}
                                            title={`Thread: ${node.entry.tid}`}
                                          >
                                            {node.entry.tid}
                                          </span>
                                        )}
                                        <span
                                          style={{
                                            fontFamily: 'var(--font-mono, monospace)',
                                            fontSize: '0.68rem',
                                            color: isLight ? '#78716c' : '#64748b',
                                          }}
                                        >
                                          L#{node.lineNumber}
                                        </span>
                                      </div>
                                    </div>

                                    {/* PHASE 1: COMPACT NAMESPACE BREADCRUMB */}
                                    {node.hierarchy.parentPath ? (
                                      <div style={{ marginBottom: 4 }}>
                                        <div
                                          style={{
                                            fontSize: '0.63rem',
                                            fontFamily: 'var(--font-mono, monospace)',
                                            color: isLight ? '#78716c' : '#64748b',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                          }}
                                          title={`Full Namespace: ${node.module}`}
                                        >
                                          {node.hierarchy.parentPath}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: '0.82rem',
                                            fontWeight: 700,
                                            color: isLight ? '#0369a1' : '#38bdf8',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                          }}
                                          title={node.hierarchy.leaf}
                                        >
                                          {node.hierarchy.leaf}
                                        </div>
                                      </div>
                                    ) : (
                                      <div
                                        style={{
                                          fontSize: '0.82rem',
                                          fontWeight: 700,
                                          color: isLight ? '#1c1917' : '#ededef',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          marginBottom: 4,
                                        }}
                                        title={node.module}
                                      >
                                        {node.module}
                                      </div>
                                    )}

                                    {/* Operation / Action */}
                                    <div
                                      style={{
                                        fontSize: '0.74rem',
                                        fontFamily: 'var(--font-mono, monospace)',
                                        color: isSelected ? (isLight ? '#0369a1' : '#93c5fd') : (isLight ? '#57534e' : '#94a3b8'),
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
                                          color: isLight ? '#78716c' : '#64748b',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          marginBottom: 8,
                                        }}
                                        title={node.fileLocation}
                                      >
                                        <Code2 size={11} color={isLight ? "#0284c7" : "#60a5fa"} />
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
                                        color: isLight ? '#78716c' : '#8b949e',
                                      }}
                                    >
                                      <span style={{ color: isLight ? '#0284c7' : '#38bdf8' }}>
                                        {node.index === 0 ? 'T₀ START' : `+${formatDurationMs(node.deltaFromStartMs)}`}
                                      </span>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {node.isHotspot && (
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 2,
                                              color: isLight ? '#c2410c' : '#fb923c',
                                              backgroundColor: isLight ? 'rgba(234, 88, 12, 0.12)' : 'rgba(251, 146, 60, 0.15)',
                                              padding: '1px 5px',
                                              borderRadius: 3,
                                              border: isLight ? '1px solid rgba(234, 88, 12, 0.3)' : '1px solid rgba(251, 146, 60, 0.3)',
                                              fontWeight: 600,
                                            }}
                                            title="Slowest step in trace (Bottleneck Hotspot)"
                                          >
                                            <Flame size={9} />
                                            <span>Hotspot</span>
                                          </span>
                                        )}

                                        {node.hasTrace && (
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 2,
                                              color: isLight ? '#b91c1c' : '#f87171',
                                              backgroundColor: isLight ? 'rgba(220, 38, 38, 0.12)' : 'rgba(248, 113, 113, 0.15)',
                                              padding: '1px 5px',
                                              borderRadius: 3,
                                              border: isLight ? '1px solid rgba(220, 38, 38, 0.3)' : '1px solid rgba(248, 113, 113, 0.3)',
                                              fontWeight: 600,
                                            }}
                                            title="Captured Exception Stack Trace"
                                          >
                                            <AlertOctagon size={9} />
                                            <span>Trace</span>
                                          </span>
                                        )}

                                        {node.hasPayload && (
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 3,
                                              color: isLight ? '#92400e' : '#fde047',
                                              backgroundColor: isLight ? 'rgba(217, 119, 6, 0.12)' : 'rgba(234, 179, 8, 0.1)',
                                              padding: '1px 5px',
                                              borderRadius: 3,
                                              border: isLight ? '1px solid rgba(217, 119, 6, 0.3)' : '1px solid rgba(234, 179, 8, 0.25)',
                                            }}
                                          >
                                            <FileText size={10} />
                                            <span>Payload</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Intra-Cluster Connecting Vector Edge */}
                                  {!isLastInCluster && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 70,
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
                                          fontSize: '0.62rem',
                                          fontFamily: 'var(--font-mono, monospace)',
                                          backgroundColor: cluster.items[i + 1]?.isHotspot
                                            ? (isLight ? '#ffedd5' : 'rgba(234, 88, 12, 0.2)')
                                            : (isLight ? '#eae4d8' : '#11141b'),
                                          border: cluster.items[i + 1]?.isHotspot
                                            ? (isLight ? '1px solid #fb923c' : '1px solid #ea580c')
                                            : (isLight ? '1px solid #ded7ca' : '1px solid #283040'),
                                          padding: '1px 5px',
                                          borderRadius: 4,
                                          color: cluster.items[i + 1]?.isHotspot
                                            ? (isLight ? '#c2410c' : '#fb923c')
                                            : cluster.items[i + 1]?.deltaFromPrevMs > 500
                                            ? (isLight ? '#b45309' : '#f59e0b')
                                            : (isLight ? '#047857' : '#34d399'),
                                          whiteSpace: 'nowrap',
                                          fontWeight: 600,
                                          zIndex: 2,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 2,
                                        }}
                                        title={cluster.items[i + 1]?.isHotspot ? "Slowest latency hop (Bottleneck)" : undefined}
                                      >
                                        {cluster.items[i + 1]?.isHotspot && <Flame size={9} />}
                                        +{formatDurationMs(cluster.items[i + 1].deltaFromPrevMs)}
                                      </div>

                                      {/* Arrow Vector Line */}
                                      <svg width="70" height="24" style={{ display: 'block' }}>
                                        <line
                                          x1="0"
                                          y1="12"
                                          x2="64"
                                          y2="12"
                                          stroke={isLight ? '#0284c7' : '#3b82f6'}
                                          strokeWidth="1.6"
                                          strokeDasharray="4 3"
                                          markerEnd={`url(#${isLight ? 'arrowhead-light' : 'arrowhead'})`}
                                        />
                                      </svg>
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>

                        {/* Inter-Subsystem Boundary Vector Edge */}
                        {!isLastCluster && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 90,
                              position: 'relative',
                              flexShrink: 0,
                              alignSelf: 'center',
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                top: '-14px',
                                fontSize: '0.60rem',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                                color: isLight ? '#b45309' : '#f59e0b',
                                letterSpacing: '0.04em',
                                backgroundColor: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.15)',
                                padding: '1px 5px',
                                borderRadius: 3,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              CROSS-SUBSYSTEM
                            </div>
                            <svg width="90" height="28" style={{ display: 'block' }}>
                              <line
                                x1="0"
                                y1="14"
                                x2="84"
                                y2="14"
                                stroke={isLight ? '#d97706' : '#f59e0b'}
                                strokeWidth="2.2"
                                strokeDasharray="6 3"
                                markerEnd={`url(#${isLight ? 'arrowhead-light' : 'arrowhead'})`}
                              />
                            </svg>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  /* --- UNCLUSTERED FLAT DAG PIPELINE VIEW --- */
                  filteredStepNodes.map((node, i) => {
                    const isSelected = selectedNode?.id === node.id;
                    const isLast = i === filteredStepNodes.length - 1;
                    const lvlTheme = getLevelColors(node.level, isLight);

                    return (
                      <React.Fragment key={node.id}>
                        {/* Step Node Card with Compact Breadcrumbs */}
                        <div
                          ref={isSelected ? activeNodeRef : null}
                          onClick={() => setSelectedNodeIndex(node.index)}
                          style={{
                            width: 250,
                            backgroundColor: isSelected
                              ? (isLight ? '#ffffff' : '#151922')
                              : (isLight ? '#ffffff' : '#0e1117'),
                            border: isSelected
                              ? (isLight ? '1.5px solid #0284c7' : '1.5px solid #3b82f6')
                              : `1.5px solid ${lvlTheme.border}`,
                            boxShadow: isSelected
                              ? (isLight
                                  ? '0 0 0 2px #0284c7, 0 8px 24px rgba(2, 132, 199, 0.2)'
                                  : '0 0 24px rgba(59, 130, 246, 0.4), inset 0 0 12px rgba(59, 130, 246, 0.1)')
                              : (isLight
                                  ? '0 3px 10px rgba(28, 25, 23, 0.07)'
                                  : '0 8px 20px rgba(0,0,0,0.5)'),
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
                              borderBottom: isLight ? '1px solid #ded7ca' : '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono, monospace)',
                                  fontSize: '0.68rem',
                                  color: isSelected ? (isLight ? '#0284c7' : '#60a5fa') : (isLight ? '#57534e' : '#8b949e'),
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
                                color: isLight ? '#78716c' : '#64748b',
                              }}
                            >
                              L#{node.lineNumber}
                            </span>
                          </div>

                          {/* Compact Breadcrumb Module Header */}
                          {node.hierarchy.parentPath ? (
                            <div style={{ marginBottom: 4 }}>
                              <div
                                style={{
                                  fontSize: '0.63rem',
                                  fontFamily: 'var(--font-mono, monospace)',
                                  color: isLight ? '#78716c' : '#64748b',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={`Full Namespace: ${node.module}`}
                              >
                                {node.hierarchy.parentPath}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  color: isLight ? '#0369a1' : '#38bdf8',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={node.hierarchy.leaf}
                              >
                                {node.hierarchy.leaf}
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                color: isLight ? '#1c1917' : '#ededef',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                marginBottom: 4,
                              }}
                              title={node.module}
                            >
                              {node.module}
                            </div>
                          )}

                          {/* Operation / Action */}
                          <div
                            style={{
                              fontSize: '0.74rem',
                              fontFamily: 'var(--font-mono, monospace)',
                              color: isSelected ? (isLight ? '#0369a1' : '#93c5fd') : (isLight ? '#57534e' : '#94a3b8'),
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
                                color: isLight ? '#78716c' : '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                marginBottom: 8,
                              }}
                              title={node.fileLocation}
                            >
                              <Code2 size={11} color={isLight ? "#0284c7" : "#60a5fa"} />
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
                              color: isLight ? '#78716c' : '#8b949e',
                            }}
                          >
                            <span style={{ color: isLight ? '#0284c7' : '#38bdf8' }}>
                              {node.index === 0 ? 'T₀ START' : `+${formatDurationMs(node.deltaFromStartMs)}`}
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {node.isHotspot && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    color: isLight ? '#c2410c' : '#fb923c',
                                    backgroundColor: isLight ? 'rgba(234, 88, 12, 0.12)' : 'rgba(251, 146, 60, 0.15)',
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    border: isLight ? '1px solid rgba(234, 88, 12, 0.3)' : '1px solid rgba(251, 146, 60, 0.3)',
                                    fontWeight: 600,
                                  }}
                                  title="Slowest step in trace (Bottleneck Hotspot)"
                                >
                                  <Flame size={9} />
                                  <span>Hotspot</span>
                                </span>
                              )}

                              {node.hasTrace && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    color: isLight ? '#b91c1c' : '#f87171',
                                    backgroundColor: isLight ? 'rgba(220, 38, 38, 0.12)' : 'rgba(248, 113, 113, 0.15)',
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    border: isLight ? '1px solid rgba(220, 38, 38, 0.3)' : '1px solid rgba(248, 113, 113, 0.3)',
                                    fontWeight: 600,
                                  }}
                                  title="Captured Exception Stack Trace"
                                >
                                  <AlertOctagon size={9} />
                                  <span>Trace</span>
                                </span>
                              )}

                              {node.hasPayload && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    color: isLight ? '#92400e' : '#fde047',
                                    backgroundColor: isLight ? 'rgba(217, 119, 6, 0.12)' : 'rgba(234, 179, 8, 0.1)',
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    border: isLight ? '1px solid rgba(217, 119, 6, 0.3)' : '1px solid rgba(234, 179, 8, 0.25)',
                                  }}
                                >
                                  <FileText size={10} />
                                  <span>Payload</span>
                                </span>
                              )}
                            </div>
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
                                backgroundColor: filteredStepNodes[i + 1]?.isHotspot
                                  ? (isLight ? '#ffedd5' : 'rgba(234, 88, 12, 0.2)')
                                  : (isLight ? '#eae4d8' : '#11141b'),
                                border: filteredStepNodes[i + 1]?.isHotspot
                                  ? (isLight ? '1px solid #fb923c' : '1px solid #ea580c')
                                  : (isLight ? '1px solid #ded7ca' : '1px solid #283040'),
                                padding: '1px 6px',
                                borderRadius: 4,
                                color: filteredStepNodes[i + 1]?.isHotspot
                                  ? (isLight ? '#c2410c' : '#fb923c')
                                  : filteredStepNodes[i + 1].deltaFromPrevMs > 500
                                  ? (isLight ? '#b45309' : '#f59e0b')
                                  : (isLight ? '#047857' : '#34d399'),
                                whiteSpace: 'nowrap',
                                fontWeight: 600,
                                zIndex: 2,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2,
                              }}
                              title={filteredStepNodes[i + 1]?.isHotspot ? "Slowest latency hop (Bottleneck)" : undefined}
                            >
                              {filteredStepNodes[i + 1]?.isHotspot && <Flame size={9} />}
                              +{formatDurationMs(filteredStepNodes[i + 1].deltaFromPrevMs)}
                            </div>

                            {/* Arrow Vector Line */}
                            <svg width="80" height="24" style={{ display: 'block' }}>
                              <defs>
                                <marker
                                  id={isLight ? 'arrowhead-light' : 'arrowhead'}
                                  markerWidth="6"
                                  markerHeight="6"
                                  refX="5"
                                  refY="3"
                                  orient="auto"
                                >
                                  <polygon points="0 0, 6 3, 0 6" fill={isLight ? '#0284c7' : '#3b82f6'} />
                                </marker>
                              </defs>
                              <line
                                x1="0"
                                y1="12"
                                x2="74"
                                y2="12"
                                stroke={isLight ? '#0284c7' : '#3b82f6'}
                                strokeWidth="1.8"
                                strokeDasharray="4 3"
                                markerEnd={`url(#${isLight ? 'arrowhead-light' : 'arrowhead'})`}
                              />
                            </svg>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </div>
            ) : viewLayout === 'waterfall' ? (
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
                    color: isLight ? '#78716c' : '#64748b',
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
                  const lvlTheme = getLevelColors(node.level, isLight);
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
                        borderBottom: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.03)',
                        backgroundColor: isSelected
                          ? (isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(59, 130, 246, 0.12)')
                          : 'transparent',
                        cursor: 'pointer',
                        borderRadius: 4,
                        transition: 'background 120ms ease',
                      }}
                    >
                      {/* Left: Module Breadcrumb & Operation */}
                      <div style={{ overflow: 'hidden' }}>
                        <div
                          style={{
                            fontSize: '0.62rem',
                            fontFamily: 'var(--font-mono, monospace)',
                            color: isLight ? '#78716c' : '#8b949e',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          <span style={{ marginRight: 4, fontWeight: 700 }}>#{node.index + 1}</span>
                          {node.hierarchy.parentPath ? `${node.hierarchy.parentPath} ›` : ''}
                        </div>
                        <div
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: isSelected ? '#60a5fa' : (isLight ? '#1c1917' : '#ededef'),
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={node.hierarchy.leaf}
                        >
                          {node.hierarchy.leaf}
                        </div>
                        <div
                          style={{
                            fontSize: '0.69rem',
                            fontFamily: 'var(--font-mono, monospace)',
                            color: isLight ? '#78716c' : '#8b949e',
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
                          backgroundColor: isLight ? '#eae4d8' : '#0d1017',
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
                          color: isLight ? '#0284c7' : '#38bdf8',
                          textAlign: 'right',
                        }}
                      >
                        +{formatDurationMs(node.deltaFromStartMs)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ==============================================================
                 MODE 3: MULTI-THREAD / ASYNC SWIMLANES VIEW (Phase 3)
                 ============================================================== */
              <div
                style={{
                  padding: 24,
                  transformOrigin: '0 0',
                  transform: `scale(${zoomLevel})`,
                  minWidth: 900,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {/* Swimlanes Header Summary */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: isLight ? '#eae4d8' : '#11141b',
                    border: isLight ? '1px solid #ded7ca' : '1px solid #1c212a',
                    fontSize: '0.74rem',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Cpu size={14} color={isLight ? '#0284c7' : '#38bdf8'} />
                    <span style={{ fontWeight: 700, color: isLight ? '#1c1917' : '#ededef' }}>
                      CONCURRENCY MODEL: {threadSwimlanes.length} ACTIVE THREAD SWIMLANES
                    </span>
                  </div>
                  <span style={{ color: isLight ? '#78716c' : '#8b949e' }}>
                    Total Trace Span: {formatDurationMs(totalTimeMs)}
                  </span>
                </div>

                {/* Parallel Lanes Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {threadSwimlanes.map((lane, laneIdx) => {
                    return (
                      <div
                        key={lane.threadId}
                        style={{
                          borderRadius: 8,
                          backgroundColor: isLight ? '#ffffff' : '#0d1017',
                          border: isLight ? '1px solid #ded7ca' : '1px solid #1c212a',
                          padding: 12,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        {/* Lane Header */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingBottom: 6,
                            borderBottom: isLight ? '1px solid #ded7ca' : '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: isLight ? '#047857' : '#34d399',
                                backgroundColor: isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(52, 211, 153, 0.12)',
                                border: isLight ? '1px solid rgba(5, 150, 105, 0.25)' : '1px solid rgba(52, 211, 153, 0.25)',
                                padding: '2px 8px',
                                borderRadius: 4,
                              }}
                            >
                              LANE: {lane.threadId}
                            </span>
                            {lane.processId && (
                              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono, monospace)', color: isLight ? '#78716c' : '#64748b' }}>
                                PID: {lane.processId}
                              </span>
                            )}
                            <span style={{ fontSize: '0.68rem', color: isLight ? '#78716c' : '#8b949e' }}>
                              ({lane.items.length} {lane.items.length === 1 ? 'event' : 'events'})
                            </span>
                          </div>

                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontFamily: 'var(--font-mono, monospace)',
                              color: isLight ? '#0284c7' : '#38bdf8',
                            }}
                          >
                            Lane Span: {formatDurationMs(lane.totalDurationMs)}
                          </span>
                        </div>

                        {/* Steps in this Thread Lane */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                            gap: 10,
                          }}
                        >
                          {lane.items.map((node) => {
                            const isSelected = selectedNode?.id === node.id;
                            const lvlTheme = getLevelColors(node.level, isLight);

                            return (
                              <div
                                key={node.id}
                                onClick={() => setSelectedNodeIndex(node.index)}
                                style={{
                                  backgroundColor: isSelected
                                    ? (isLight ? '#ffffff' : '#151922')
                                    : (isLight ? '#faf7f2' : '#0a0d12'),
                                  border: isSelected
                                    ? (isLight ? '1.5px solid #0284c7' : '1.5px solid #3b82f6')
                                    : `1px solid ${lvlTheme.border}`,
                                  borderRadius: 6,
                                  padding: 10,
                                  cursor: 'pointer',
                                  transition: 'all 140ms ease',
                                  boxShadow: isSelected
                                    ? (isLight ? '0 0 0 2px #0284c7' : '0 0 16px rgba(59, 130, 246, 0.35)')
                                    : 'none',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <span style={{ fontSize: '0.66rem', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: isSelected ? '#60a5fa' : undefined }}>
                                    STEP #{node.index + 1}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '0.60rem',
                                      padding: '1px 4px',
                                      borderRadius: 3,
                                      backgroundColor: lvlTheme.bg,
                                      color: lvlTheme.text,
                                      border: `1px solid ${lvlTheme.border}`,
                                      fontWeight: 600,
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    {node.level}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    color: isLight ? '#0369a1' : '#38bdf8',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    marginBottom: 2,
                                  }}
                                  title={node.hierarchy.leaf}
                                >
                                  {node.hierarchy.leaf}
                                </div>

                                <div
                                  style={{
                                    fontSize: '0.68rem',
                                    fontFamily: 'var(--font-mono, monospace)',
                                    color: isLight ? '#78716c' : '#8b949e',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    marginBottom: 6,
                                  }}
                                >
                                  {node.operation}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.64rem', fontFamily: 'var(--font-mono, monospace)' }}>
                                  <span style={{ color: isLight ? '#0284c7' : '#38bdf8' }}>
                                    +{formatDurationMs(node.deltaFromStartMs)}
                                  </span>
                                  <span style={{ color: isLight ? '#78716c' : '#64748b' }}>
                                    L#{node.lineNumber}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ====================================================================
              RIGHT: STEP INSPECTOR DRAWER (WHAT HAPPENED IN THIS FLOW STEP)
             ==================================================================== */}
          <div
            style={{
              width: 440,
              backgroundColor: isLight ? '#fbf8f2' : '#0f1217',
              borderLeft: isLight ? '1px solid #ded7ca' : '1px solid #1c212a',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: isLight ? '1px solid #ded7ca' : '1px solid #1c212a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: isLight ? '#ece5d9' : '#12151c',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={14} color={isLight ? "#0284c7" : "#3b82f6"} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isLight ? '#1c1917' : '#ededef' }}>
                  Step Details &amp; Causality
                </span>
              </div>

              {selectedNode && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.72rem',
                    color: isLight ? '#0284c7' : '#60a5fa',
                    backgroundColor: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(59, 130, 246, 0.12)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: isLight ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid rgba(59, 130, 246, 0.3)',
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
                      backgroundColor: isLight ? '#ffffff' : '#0a0b0e',
                      borderRadius: 6,
                      border: isLight ? '1px solid #ded7ca' : '1px solid #1c202a',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: isLight ? '#78716c' : '#8b949e', marginBottom: 2 }}>
                      LINE NUMBER
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: isLight ? '#1c1917' : '#ededef' }}>
                      Line #{selectedNode.lineNumber}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      backgroundColor: isLight ? '#ffffff' : '#0a0b0e',
                      borderRadius: 6,
                      border: isLight ? '1px solid #ded7ca' : '1px solid #1c202a',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: isLight ? '#78716c' : '#8b949e', marginBottom: 2 }}>
                      ELAPSED LATENCY
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: isLight ? '#0284c7' : '#38bdf8' }}>
                      +{formatDurationMs(selectedNode.deltaFromStartMs)}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      backgroundColor: isLight ? '#ffffff' : '#0a0b0e',
                      borderRadius: 6,
                      border: isLight ? '1px solid #ded7ca' : '1px solid #1c202a',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: isLight ? '#78716c' : '#8b949e', marginBottom: 2 }}>
                      SEVERITY LEVEL
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: getLevelColors(selectedNode.level, isLight).text,
                      }}
                    >
                      {selectedNode.level}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      backgroundColor: isLight ? '#ffffff' : '#0a0b0e',
                      borderRadius: 6,
                      border: isLight ? '1px solid #ded7ca' : '1px solid #1c202a',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: isLight ? '#78716c' : '#8b949e', marginBottom: 2 }}>
                      STEP DURATION
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: '#34d399' }}>
                      {selectedNode.duration || formatDurationMs(selectedNode.deltaFromPrevMs)}
                    </div>
                  </div>
                </div>

                {/* Cross-Identity Tag: Correlation or Workflow Badge */}
                {((isWorkflow && selectedNode.entry.correlationId) || (!isWorkflow && selectedNode.entry.workflow)) && (
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.68rem', color: isLight ? '#78716c' : '#8b949e', fontWeight: 600 }}>
                      {isWorkflow ? 'CORRELATION TRACE:' : 'ASSOCIATED WORKFLOW:'}
                    </span>
                    {isWorkflow && selectedNode.entry.correlationId && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: '0.72rem',
                          color: isLight ? '#047857' : '#34d399',
                          backgroundColor: isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(52, 211, 153, 0.1)',
                          padding: '1px 6px',
                          borderRadius: 3,
                          border: isLight ? '1px solid rgba(5, 150, 105, 0.3)' : '1px solid rgba(52, 211, 153, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Zap size={10} />
                        {selectedNode.entry.correlationId}
                      </span>
                    )}
                    {!isWorkflow && selectedNode.entry.workflow && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: '0.72rem',
                          color: isLight ? '#6d28d9' : '#c084fc',
                          backgroundColor: isLight ? 'rgba(124, 58, 237, 0.1)' : 'rgba(192, 132, 252, 0.1)',
                          padding: '1px 6px',
                          borderRadius: 3,
                          border: isLight ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid rgba(192, 132, 252, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <GitBranch size={10} />
                        {selectedNode.entry.workflow}
                      </span>
                    )}
                  </div>
                )}

                {/* Module & Origin Function Location */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.68rem', color: isLight ? '#78716c' : '#8b949e', fontWeight: 600 }}>
                      MODULE &amp; FUNCTION CALL
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyRaw(selectedNode.module)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isLight ? '#0284c7' : '#60a5fa',
                        fontSize: '0.66rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: 0,
                      }}
                      title="Copy full qualified namespace"
                    >
                      <Copy size={10} />
                      <span>Copy Path</span>
                    </button>
                  </div>

                  <div
                    style={{
                      backgroundColor: isLight ? '#ffffff' : '#0a0b0e',
                      borderRadius: 6,
                      border: isLight ? '1px solid #ded7ca' : '1px solid #1c202a',
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    {/* Hierarchical Namespace Breadcrumb */}
                    {selectedNode.hierarchy.segments.length > 1 ? (
                      (() => {
                        const subColor = getSubsystemColor(selectedNode.hierarchy.root, isLight);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {/* Root Subsystem Badge + Ancestor Path */}
                            <div
                              style={{
                                fontSize: '0.68rem',
                                color: isLight ? '#78716c' : '#8b949e',
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '3px 6px',
                                lineHeight: 1.4,
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere',
                              }}
                            >
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  fontFamily: 'var(--font-mono, monospace)',
                                  backgroundColor: subColor.bg,
                                  color: subColor.text,
                                  border: `1px solid ${subColor.border}`,
                                }}
                              >
                                {selectedNode.hierarchy.root}
                              </span>
                              {selectedNode.hierarchy.segments.slice(1, -1).map((seg, idx) => (
                                <React.Fragment key={idx}>
                                  <span style={{ opacity: 0.4 }}>›</span>
                                  <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{seg}</span>
                                </React.Fragment>
                              ))}
                            </div>

                            {/* Leaf Function Name */}
                            <div
                              style={{
                                fontSize: '0.86rem',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono, monospace)',
                                color: isLight ? '#0284c7' : '#60a5fa',
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere',
                                lineHeight: 1.35,
                              }}
                              title={`Full Namespace: ${selectedNode.module}`}
                            >
                              {selectedNode.hierarchy.leaf}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono, monospace)',
                          color: isLight ? '#0284c7' : '#60a5fa',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                          lineHeight: 1.35,
                        }}
                      >
                        {selectedNode.module}
                      </div>
                    )}

                    {/* Operation / Action */}
                    <div
                      style={{
                        fontSize: '0.76rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        color: isLight ? '#1c1917' : '#cbd5e1',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {selectedNode.operation}
                    </div>

                    {selectedNode.fileLocation && (
                      <div
                        onClick={() => openSourceLocation(selectedNode.fileLocation!)}
                        style={{
                          marginTop: 2,
                          paddingTop: 6,
                          borderTop: isLight ? '1px solid #ded7ca' : '1px solid rgba(255,255,255,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono, monospace)',
                          color: isLight ? '#0284c7' : '#38bdf8',
                          cursor: 'pointer',
                          wordBreak: 'break-all',
                          overflowWrap: 'anywhere',
                        }}
                        title={isVsCode() ? 'Click to open in editor' : `Location: ${selectedNode.fileLocation}`}
                      >
                        <Code2 size={12} color={isLight ? "#0284c7" : undefined} style={{ flexShrink: 0 }} />
                        <span style={{ textDecoration: 'underline' }}>{selectedNode.fileLocation}</span>
                        <ExternalLink size={10} color={isLight ? "#78716c" : "#64748b"} style={{ flexShrink: 0 }} />
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
                      color: isLight ? '#78716c' : '#8b949e',
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
                        color: isLight ? '#0284c7' : '#60a5fa',
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
                      backgroundColor: isLight ? '#ffffff' : '#0a0b0e',
                      borderRadius: 6,
                      border: isLight ? '1px solid #ded7ca' : '1px solid #1c202a',
                      padding: 10,
                      fontSize: '0.76rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      lineHeight: 1.5,
                      color: isLight ? '#1c1917' : '#e2e8f0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: 140,
                      overflowY: 'auto',
                    }}
                  >
                    {renderSyntaxColoredLine(selectedNode.entry.message || selectedNode.entry.raw, false)}
                  </div>
                </div>

                {/* Captured Exception Stack Trace */}
                {selectedNode.entry.trace && (
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.68rem',
                        color: isLight ? '#b91c1c' : '#f87171',
                        marginBottom: 4,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <AlertOctagon size={12} />
                        <span>EXCEPTION CALL STACK</span>
                      </span>
                    </div>

                    <TraceViewer trace={selectedNode.entry.trace} />
                  </div>
                )}

                {/* Embedded JSON / XML Payload Detected */}
                {selectedNode.hasPayload && selectedNode.payloadSnippet && (
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.68rem',
                        color: isLight ? '#b45309' : '#fde047',
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
                          backgroundColor: isLight ? 'rgba(217, 119, 6, 0.12)' : 'rgba(234, 179, 8, 0.14)',
                          border: isLight ? '1px solid #d97706' : '1px solid #fde047',
                          color: isLight ? '#b45309' : '#fde047',
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
                        backgroundColor: isLight ? '#eae4d8' : '#090a0d',
                        borderRadius: 6,
                        border: isLight ? '1px solid rgba(217, 119, 6, 0.3)' : '1px solid rgba(234, 179, 8, 0.25)',
                        padding: 10,
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        color: isLight ? '#92400e' : '#fde047',
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
                      backgroundColor: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(59, 130, 246, 0.15)',
                      border: isLight ? '1px solid #0284c7' : '1px solid #3b82f6',
                      color: isLight ? '#0284c7' : '#60a5fa',
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
                      backgroundColor: isLight ? '#eae4d8' : '#161922',
                      border: isLight ? '1px solid #ded7ca' : '1px solid #283040',
                      color: isLight ? '#1c1917' : '#cbd5e1',
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
                  color: isLight ? '#78716c' : '#64748b',
                  fontSize: '0.78rem',
                }}
              >
                Click any step node in the graph to inspect details
              </div>
            )}
          </div>
        </div>

        {/* ====================================================================
            FOOTER: DEVELOPER KEYBOARD CHEATSHEET & RAPID HOTKEYS
           ==================================================================== */}
        <div
          style={{
            padding: '7px 16px',
            backgroundColor: isLight ? '#ece5d9' : '#0c0f14',
            borderTop: isLight ? '1px solid #ded7ca' : '1px solid #1c212a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.69rem',
            fontFamily: 'var(--font-mono, monospace)',
            color: isLight ? '#78716c' : '#8b949e',
            flexShrink: 0,
            overflowX: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'nowrap' }}>
            <span style={{ fontWeight: 700, color: isLight ? '#0284c7' : '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Keyboard size={12} />
              <span>DEV SHORTCUTS:</span>
            </span>
            <span title="Arrow keys or j/k to navigate steps">
              <kbd style={kbdStyle(isLight)}>←</kbd> <kbd style={kbdStyle(isLight)}>→</kbd> / <kbd style={kbdStyle(isLight)}>j</kbd> <kbd style={kbdStyle(isLight)}>k</kbd> Step
            </span>
            <span title="Jump directly to the next error in this trace">
              <kbd style={kbdStyle(isLight)}>e</kbd> Next Error
            </span>
            <span title="Jump directly to the next warning in this trace">
              <kbd style={kbdStyle(isLight)}>w</kbd> Warning
            </span>
            <span title="Jump to the slowest step (bottleneck hotspot)">
              <kbd style={kbdStyle(isLight)}>h</kbd> Hotspot
            </span>
            <span title="Toggle between DAG Graph and Waterfall timeline">
              <kbd style={kbdStyle(isLight)}>v</kbd> / <kbd style={kbdStyle(isLight)}>Tab</kbd> Toggle View
            </span>
            <span title="Select line and jump to main log table">
              <kbd style={kbdStyle(isLight)}>Enter</kbd> Jump Table
            </span>
            <span title="View ±25 context lines">
              <kbd style={kbdStyle(isLight)}>c</kbd> Context
            </span>
            <span title="Yank / Copy log message to clipboard">
              <kbd style={kbdStyle(isLight)}>y</kbd> Yank
            </span>
            <span title="Copy Root Cause Analysis markdown report">
              <kbd style={kbdStyle(isLight)}>r</kbd> Copy RCA
            </span>
            <span title="Download RCA report as .md file">
              <kbd style={kbdStyle(isLight)}>d</kbd> Download .md
            </span>
            <span title="Focus search filter">
              <kbd style={kbdStyle(isLight)}>/</kbd> Search
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16 }}>
            <button
              type="button"
              onClick={() => setShowShortcuts((s) => !s)}
              style={{
                border: 'none',
                background: 'transparent',
                color: isLight ? '#0284c7' : '#60a5fa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.68rem',
              }}
            >
              <kbd style={kbdStyle(isLight)}>?</kbd>
              <span>{showShortcuts ? 'Hide Guide' : 'All Hotkeys'}</span>
            </button>
          </div>
        </div>

        {/* Expanded Developer Shortcuts Drawer */}
        {showShortcuts && (
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: isLight ? '#f5efe4' : '#080a0e',
              borderTop: isLight ? '1px solid #ded7ca' : '1px solid #1c212a',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono, monospace)',
              animation: 'fadeIn 120ms ease',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: isLight ? '#0284c7' : '#38bdf8', marginBottom: 4 }}>
                1. TRACE NAVIGATION
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, color: isLight ? '#57534e' : '#94a3b8' }}>
                <div><kbd style={kbdStyle(isLight)}>→</kbd> / <kbd style={kbdStyle(isLight)}>↓</kbd> / <kbd style={kbdStyle(isLight)}>j</kbd> : Next step in trace</div>
                <div><kbd style={kbdStyle(isLight)}>←</kbd> / <kbd style={kbdStyle(isLight)}>↑</kbd> / <kbd style={kbdStyle(isLight)}>k</kbd> : Previous step</div>
                <div><kbd style={kbdStyle(isLight)}>Home</kbd> / <kbd style={kbdStyle(isLight)}>g</kbd> : Jump to start (T₀)</div>
                <div><kbd style={kbdStyle(isLight)}>End</kbd> / <kbd style={kbdStyle(isLight)}>G</kbd> : Jump to final step</div>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 4 }}>
                2. RAPID FAULT TRIAGING
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, color: isLight ? '#57534e' : '#94a3b8' }}>
                <div><kbd style={kbdStyle(isLight)}>e</kbd> : Jump directly to next error step</div>
                <div><kbd style={kbdStyle(isLight)}>w</kbd> : Jump directly to next warning step</div>
                <div><kbd style={kbdStyle(isLight)}>h</kbd> : Jump to latency hotspot (slowest step)</div>
                <div><kbd style={kbdStyle(isLight)}>v</kbd> / <kbd style={kbdStyle(isLight)}>Tab</kbd> : Flip DAG graph ↔ Waterfall</div>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, color: isLight ? '#d97706' : '#fde047', marginBottom: 4 }}>
                3. DEV ACTIONS &amp; INSPECTION
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, color: isLight ? '#57534e' : '#94a3b8' }}>
                <div><kbd style={kbdStyle(isLight)}>Enter</kbd> : Jump to line in main table</div>
                <div><kbd style={kbdStyle(isLight)}>c</kbd> : Open ±25 surrounding context</div>
                <div><kbd style={kbdStyle(isLight)}>y</kbd> : Yank (copy) step log message</div>
                <div><kbd style={kbdStyle(isLight)}>p</kbd> : Open JSON/XML payload in AST tree</div>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, color: isLight ? '#047857' : '#34d399', marginBottom: 4 }}>
                4. ROOT CAUSE REPORT &amp; VIEW
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, color: isLight ? '#57534e' : '#94a3b8' }}>
                <div><kbd style={kbdStyle(isLight)}>r</kbd> : Copy full RCA Markdown report</div>
                <div><kbd style={kbdStyle(isLight)}>d</kbd> : Download RCA report (.md)</div>
                <div><kbd style={kbdStyle(isLight)}>+</kbd> / <kbd style={kbdStyle(isLight)}>-</kbd> : Zoom in / out (DAG graph)</div>
                <div><kbd style={kbdStyle(isLight)}>f</kbd> : Toggle full-screen mode</div>
                <div><kbd style={kbdStyle(isLight)}>/</kbd> : Focus step search filter</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default CorrelationTimelineModal;
