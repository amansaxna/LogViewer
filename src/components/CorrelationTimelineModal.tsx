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
  ArrowDown,
  GitMerge,
  AlertOctagon,
  Flame,
  Share2,
  Download,
  Keyboard,
  Cpu,
  Layers as LayersIcon,
  Boxes,
  CornerDownRight,
  Undo2,
  Minus,
  Plus,
  Eye,
  EyeOff,
} from 'lucide-react';
import { LogEntry, LogLevel } from '../types.ts';
import { apiFetch, openSourceLocation, isVsCode } from '../api/bridge.ts';
import { copyWithToast } from '../utils/copyNotifier.ts';
import { renderSyntaxColoredLine } from '../utils/coloredLogRenderer.tsx';
import { findJsonBlocks, findXmlBlocks } from '../utils/messageContextHighlighter.tsx';
import { TraceViewer } from './TraceViewer.tsx';
import { GroupTransitionsGraph } from './GroupTransitionsGraph.tsx';
import {
  parseNamespaceHierarchy,
  groupNodesIntoSubsystems,
  groupNodesIntoThreadSwimlanes,
  getSubsystemColor,
  resolveEffectiveClusterLevel,
  buildMacroGraph,
  computeCallStackFrames,
  computeActiveCallPath,
  CallStackFrameInfo,
  ActivationStackItem,
  NamespaceHierarchy,
  SubsystemCluster,
  ThreadSwimlane,
  ClusterGranularity,
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
  callDepth: number;
  parentCallerStepIndex?: number;
  parentCallerOperation?: string;
  parentCallerNamespace?: string;
  isReturnResume: boolean;
  returnedFromStepIndex?: number;
  returnedFromOperation?: string;
  callStack?: ActivationStackItem[];
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
  const [viewLayout, setViewLayout] = useState<'dag' | 'flame' | 'macro' | 'waterfall' | 'swimlanes'>('dag');
  const [showTransitionsGraph, setShowTransitionsGraph] = useState<boolean>(true);
  const [clusterGranularity, setClusterGranularity] = useState<ClusterGranularity>('auto');
  const [showGranularityMenu, setShowGranularityMenu] = useState(false);
  const isSubsystemClustered = clusterGranularity !== 'none';
  const [collapsedClusterIds, setCollapsedClusterIds] = useState<Set<string>>(new Set());
  const [isSpotlightEnabled, setIsSpotlightEnabled] = useState<boolean>(true);
  const [isStackUnfolded, setIsStackUnfolded] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [rcaCopied, setRcaCopied] = useState(false);
  const [payloadCopied, setPayloadCopied] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Floating Draggable Group Transitions Graph HUD State
  const [hudPos, setHudPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingHud, setIsDraggingHud] = useState(false);
  const dragRef = useRef<{ startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null);
  const hudElementRef = useRef<HTMLDivElement>(null);

  const handleHudMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('svg.interactive') || target.closest('.no-drag')) {
      return;
    }
    if (!target.closest('.hud-drag-handle')) {
      return;
    }
    const rect = hudElementRef.current?.getBoundingClientRect();
    const modalRect = document.querySelector('.modal-content')?.getBoundingClientRect();
    const modalLeft = modalRect ? modalRect.left : 0;
    const modalTop = modalRect ? modalRect.top : 0;

    const currentX = rect ? (rect.left - modalLeft) : (window.innerWidth - 420);
    const currentY = rect ? (rect.top - modalTop) : 64;

    dragRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: currentX,
      startY: currentY,
    };
    setIsDraggingHud(true);
  };

  useEffect(() => {
    if (!isDraggingHud) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startMouseX;
      const dy = e.clientY - dragRef.current.startMouseY;
      const modalRect = document.querySelector('.modal-content')?.getBoundingClientRect();
      const modalWidth = modalRect ? modalRect.width : window.innerWidth;
      const modalHeight = modalRect ? modalRect.height : window.innerHeight;

      const newX = Math.max(12, Math.min(modalWidth - 360, dragRef.current.startX + dx));
      const newY = Math.max(56, Math.min(modalHeight - 80, dragRef.current.startY + dy));

      setHudPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDraggingHud(false);
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingHud]);

  const toggleCollapseCluster = (clusterId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedClusterIds((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId);
      else next.add(clusterId);
      return next;
    });
  };

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

    // Reconstitute Virtual Activation Call Stack (f1 -> f2 -> f3 -> return to f1)
    const stackFrames = computeCallStackFrames(
      rawNodes.map((n) => ({
        index: n.index,
        module: n.module,
        operation: n.operation,
        message: n.entry.message || n.entry.raw,
        level: n.level,
        duration: n.duration,
        fileLocation: n.fileLocation,
      }))
    );

    return rawNodes.map((node) => {
      const frame = stackFrames.get(node.index) || { callDepth: 0, isReturnResume: false };
      return {
        ...node,
        callDepth: frame.callDepth,
        parentCallerStepIndex: frame.parentCallerStepIndex,
        parentCallerOperation: frame.parentCallerOperation,
        parentCallerNamespace: frame.parentCallerNamespace,
        isReturnResume: frame.isReturnResume,
        returnedFromStepIndex: frame.returnedFromStepIndex,
        returnedFromOperation: frame.returnedFromOperation,
        callStack: frame.callStack,
      };
    });
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

  const formattedPayloadSnippet = useMemo(() => {
    if (!selectedNode?.payloadSnippet) return '';
    const trimmed = selectedNode.payloadSnippet.trim();
    if (trimmed.startsWith('<')) {
      return trimmed;
    }
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return trimmed;
    }
  }, [selectedNode?.payloadSnippet]);

  // Active Call Stack frames for the selected node (Root -> Intermediate Caller -> Current Callee)
  const activeStackFrames = useMemo(() => {
    if (!selectedNode) return [];
    if (selectedNode.callStack && selectedNode.callStack.length > 0) {
      return selectedNode.callStack;
    }
    // Fallback synthesis if callStack was not populated
    const frames: ActivationStackItem[] = [];
    if (selectedNode.parentCallerStepIndex !== undefined) {
      frames.push({
        index: selectedNode.parentCallerStepIndex,
        depth: Math.max(0, (selectedNode.callDepth || 1) - 1),
        module: selectedNode.parentCallerNamespace || 'Caller Context',
        operation: selectedNode.parentCallerOperation || 'Parent Subroutine',
        namespace: selectedNode.parentCallerNamespace || '',
      });
    }
    frames.push({
      index: selectedNode.index,
      depth: selectedNode.callDepth || 0,
      module: selectedNode.module,
      operation: selectedNode.operation,
      namespace: selectedNode.module,
      fileLocation: selectedNode.fileLocation,
      level: selectedNode.level,
    });
    return frames;
  }, [selectedNode]);

  // Display stack frames with adaptive folding for deep traces (> 5 frames)
  const displayStackFrames = useMemo(() => {
    if (activeStackFrames.length <= 5 || isStackUnfolded) {
      return activeStackFrames.map((f, i) => ({ frame: f, originalIdx: i, isFoldIndicator: false, hiddenCount: 0 }));
    }
    return [
      { frame: activeStackFrames[0], originalIdx: 0, isFoldIndicator: false, hiddenCount: 0 },
      {
        frame: activeStackFrames[1],
        originalIdx: 1,
        isFoldIndicator: true,
        hiddenCount: activeStackFrames.length - 3,
      },
      {
        frame: activeStackFrames[activeStackFrames.length - 2],
        originalIdx: activeStackFrames.length - 2,
        isFoldIndicator: false,
        hiddenCount: 0,
      },
      {
        frame: activeStackFrames[activeStackFrames.length - 1],
        originalIdx: activeStackFrames.length - 1,
        isFoldIndicator: false,
        hiddenCount: 0,
      },
    ];
  }, [activeStackFrames, isStackUnfolded]);

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

  // Subsystem clusters and Adaptive LCP resolution (Solutions 1 & 2)
  const clusteringMetadata = useMemo(() => {
    const hierarchies = filteredStepNodes.map((n) => n.hierarchy);
    return resolveEffectiveClusterLevel(hierarchies, clusterGranularity);
  }, [filteredStepNodes, clusterGranularity]);

  // Active Call-Path Spotlight computation (tied to selectedNodeIndex for instant 60fps responsiveness on 200+ steps)
  const activeSpotlightPath = useMemo(() => {
    if (!isSpotlightEnabled) return null;
    return computeActiveCallPath(selectedNodeIndex, stepNodes);
  }, [isSpotlightEnabled, selectedNodeIndex, stepNodes]);

  const subsystemClusters = useMemo(() => {
    return groupNodesIntoSubsystems(filteredStepNodes, isLight, clusterGranularity);
  }, [filteredStepNodes, isLight, clusterGranularity]);

  // Macro-Graph transit view (Solution 3)
  const macroGraph = useMemo(() => {
    return buildMacroGraph(subsystemClusters);
  }, [subsystemClusters]);

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
          initialMode: 'tree',
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

      // 8. Cycle DAG ↔ Flame-DAG ↔ Macro-Graph ↔ Waterfall ↔ Swimlanes View ('v' or Tab)
      if (e.key === 'v' || e.key === 'V' || e.key === 'Tab') {
        e.preventDefault();
        setViewLayout((prev) =>
          prev === 'dag' ? 'flame' : prev === 'flame' ? 'macro' : prev === 'macro' ? 'waterfall' : prev === 'waterfall' ? 'swimlanes' : 'dag'
        );
        return;
      }

      // 8b. Cycle Subsystem Cluster Granularity ('b' / 'B')
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setClusterGranularity((prev) => {
          if (prev === 'auto') return 'l2';
          if (prev === 'l2') return 'l1';
          if (prev === 'l1') return 'l3';
          if (prev === 'l3') return 'none';
          return 'auto';
        });
        return;
      }

      // 8c. Toggle Call-Path Spotlight ('s' / 'S')
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setIsSpotlightEnabled((prev) => !prev);
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
            height: 52,
            minHeight: 52,
            padding: '0 16px',
            backgroundColor: isLight ? '#f3eee5' : '#101216',
            borderBottom: isLight ? '1px solid #ded7ca' : '1px solid #1c212a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'nowrap',
            boxSizing: 'border-box',
            flexShrink: 0,
            overflowX: 'auto',
          }}
        >
          {/* Left Brand & Timeline Identity (Correlation or Workflow) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
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
                flexShrink: 0,
              }}
            >
              {isWorkflow ? <GitBranch size={16} /> : <Zap size={16} />}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', lineHeight: 1.2 }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, letterSpacing: '-0.01em', color: isLight ? '#1c1917' : '#ededef', whiteSpace: 'nowrap' }}>
                  {isWorkflow ? 'Workflow Timeline & DAG' : 'Correlation Timeline & DAG'}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.74rem',
                    color: isWorkflow
                      ? (isLight ? '#6d28d9' : '#c084fc')
                      : (isLight ? '#047857' : '#34d399'),
                    backgroundColor: isWorkflow
                      ? (isLight ? 'rgba(124, 58, 237, 0.1)' : 'rgba(192, 132, 252, 0.1)')
                      : (isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(52, 211, 153, 0.1)'),
                    padding: '1px 7px',
                    borderRadius: 4,
                    border: isWorkflow
                      ? (isLight ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid rgba(192, 132, 252, 0.3)')
                      : (isLight ? '1px solid rgba(5, 150, 105, 0.3)' : '1px solid rgba(52, 211, 153, 0.3)'),
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {targetId}
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.70rem',
                  color: isLight ? '#78716c' : 'var(--text-muted, #8b949e)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{stepNodes.length} {stepNodes.length === 1 ? 'step' : 'steps'}</span>
                <span>•</span>
                <span>{distinctModules.length} {distinctModules.length === 1 ? 'module' : 'modules'}</span>
                <span>•</span>
                <span style={{ color: isLight ? '#0284c7' : '#38bdf8' }}>Total Δt: {formatDurationMs(totalTimeMs)}</span>
                {errorCount > 0 && (
                  <>
                    <span>•</span>
                    <span style={{ color: isLight ? '#dc2626' : '#f87171', fontWeight: 600 }}>
                      {errorCount} {errorCount === 1 ? 'error' : 'errors'}
                    </span>
                  </>
                )}
                {warnCount > 0 && (
                  <>
                    <span>•</span>
                    <span style={{ color: isLight ? '#d97706' : '#fbbf24' }}>
                      {warnCount} {warnCount === 1 ? 'warning' : 'warnings'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Toolbar Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {/* Search Filter */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: isLight ? '#eae4d8' : '#090a0d',
                border: isLight ? '1px solid #ded7ca' : '1px solid #232832',
                borderRadius: 5,
                padding: '3px 7px',
                width: 95,
              }}
            >
              <Search size={12} color={isLight ? '#78716c' : '#64748b'} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Filter... (/)"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: isLight ? '#1c1917' : '#ededef',
                  fontSize: '0.72rem',
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
                  padding: '3px 7px',
                  borderRadius: 4,
                  fontSize: '0.70rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 150ms ease',
                }}
                title="Copy Root Cause Analysis Markdown report to clipboard (Hotkey: r)"
              >
                {rcaCopied ? <Check size={11} color={isLight ? '#047857' : '#34d399'} /> : <Copy size={11} />}
                <span>{rcaCopied ? 'Copied' : 'RCA'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadRca}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: isLight ? '#57534e' : '#8b949e',
                  padding: '3px 5px',
                  borderRadius: 4,
                  fontSize: '0.70rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Download RCA Report as .md file (Hotkey: d)"
              >
                <Download size={11} />
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
                padding: '3px 7px',
                borderRadius: 5,
                fontSize: '0.70rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Toggle Developer Keyboard Shortcuts (?)"
            >
              <Keyboard size={12} />
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
                  fontSize: '0.70rem',
                  fontWeight: viewLayout === 'dag' ? 600 : 400,
                  padding: '3px 7px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
                title="DAG Pipeline View (v)"
              >
                <Layers size={11} />
                <span>DAG</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('flame')}
                style={{
                  border: 'none',
                  background: viewLayout === 'flame' ? (isLight ? '#ffffff' : 'rgba(59, 130, 246, 0.18)') : 'transparent',
                  boxShadow: viewLayout === 'flame' && isLight ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  color: viewLayout === 'flame' ? (isLight ? '#0284c7' : '#60a5fa') : (isLight ? '#78716c' : '#8b949e'),
                  fontSize: '0.70rem',
                  fontWeight: viewLayout === 'flame' ? 600 : 400,
                  padding: '3px 7px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
                title="2D Stack-Depth Flame-DAG View (v)"
              >
                <Flame size={11} />
                <span>Flame</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('macro')}
                style={{
                  border: 'none',
                  background: viewLayout === 'macro' ? (isLight ? '#ffffff' : 'rgba(59, 130, 246, 0.18)') : 'transparent',
                  boxShadow: viewLayout === 'macro' && isLight ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  color: viewLayout === 'macro' ? (isLight ? '#0284c7' : '#60a5fa') : (isLight ? '#78716c' : '#8b949e'),
                  fontSize: '0.70rem',
                  fontWeight: viewLayout === 'macro' ? 600 : 400,
                  padding: '3px 7px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
                title="Subsystem Macro Transit Graph (v)"
              >
                <Boxes size={11} />
                <span>Macro</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('waterfall')}
                style={{
                  border: 'none',
                  background: viewLayout === 'waterfall' ? (isLight ? '#ffffff' : 'rgba(59, 130, 246, 0.18)') : 'transparent',
                  boxShadow: viewLayout === 'waterfall' && isLight ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  color: viewLayout === 'waterfall' ? (isLight ? '#0284c7' : '#60a5fa') : (isLight ? '#78716c' : '#8b949e'),
                  fontSize: '0.70rem',
                  fontWeight: viewLayout === 'waterfall' ? 600 : 400,
                  padding: '3px 7px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
                title="Chronological Waterfall View (v)"
              >
                <Activity size={11} />
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
                  fontSize: '0.70rem',
                  fontWeight: viewLayout === 'swimlanes' ? 600 : 400,
                  padding: '3px 7px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
                title="Parallel Multi-Thread Async Swimlanes View (v)"
              >
                <Cpu size={11} />
                <span>Swim</span>
              </button>
            </div>

            {/* Subsystem Granularity Dropdown (Only for DAG Layout) */}
            {viewLayout === 'dag' && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowGranularityMenu((p) => !p)}
                  style={{
                    border: clusterGranularity !== 'none'
                      ? (isLight ? '1px solid #0284c7' : '1px solid #3b82f6')
                      : (isLight ? '1px solid #ded7ca' : '1px solid #232832'),
                    backgroundColor: clusterGranularity !== 'none'
                      ? (isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(59, 130, 246, 0.15)')
                      : (isLight ? '#eae4d8' : '#090a0d'),
                    color: clusterGranularity !== 'none'
                      ? (isLight ? '#0284c7' : '#60a5fa')
                      : (isLight ? '#78716c' : '#8b949e'),
                    padding: '3px 7px',
                    borderRadius: 5,
                    fontSize: '0.70rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Cluster Granularity & Depth (Hotkey: b)"
                >
                  <LayersIcon size={11} />
                  <span>
                    Group: {clusterGranularity === 'auto' ? 'Auto' : clusterGranularity === 'l1' ? 'L1' : clusterGranularity === 'l2' ? 'L2' : clusterGranularity === 'l3' ? 'L3' : 'Flat'}
                  </span>
                  <ChevronDown size={10} style={{ opacity: 0.7 }} />
                </button>

                {showGranularityMenu && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
                      onClick={() => setShowGranularityMenu(false)}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: 4,
                        zIndex: 1001,
                        backgroundColor: isLight ? '#ffffff' : '#141820',
                        border: isLight ? '1px solid #ded7ca' : '1px solid #283040',
                        borderRadius: 6,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        padding: 4,
                        minWidth: 210,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      {[
                        { id: 'auto', label: 'Auto (Smart LCP)', desc: 'Auto-trims shared parent (e.g. CoreBanking)' },
                        { id: 'l1', label: 'L1: Domain / Root', desc: 'Highest root prefix (e.g. CoreBanking)' },
                        { id: 'l2', label: 'L2: Module / Service', desc: 'Secondary module (e.g. AlertSubsystem)' },
                        { id: 'l3', label: 'L3: Component / Class', desc: 'Tertiary component (e.g. PagerDutyNotifier)' },
                        { id: 'none', label: 'Flat (Clusters Off)', desc: 'No bounding enclosures' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setClusterGranularity(opt.id as ClusterGranularity);
                            setShowGranularityMenu(false);
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            padding: '6px 8px',
                            borderRadius: 4,
                            border: 'none',
                            background: clusterGranularity === opt.id
                              ? (isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(59, 130, 246, 0.18)')
                              : 'transparent',
                            color: clusterGranularity === opt.id
                              ? (isLight ? '#0284c7' : '#60a5fa')
                              : (isLight ? '#1f2937' : '#cbd5e1'),
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: '0.74rem', fontWeight: clusterGranularity === opt.id ? 700 : 500 }}>
                            {opt.label}
                          </span>
                          <span style={{ fontSize: '0.64rem', color: isLight ? '#78716c' : '#8b949e' }}>
                            {opt.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Group Transitions Graph Toggle */}
            {viewLayout === 'dag' && (
              <button
                type="button"
                onClick={() => setShowTransitionsGraph((p) => !p)}
                style={{
                  border: showTransitionsGraph
                    ? (isLight ? '1px solid #0284c7' : '1px solid #3b82f6')
                    : (isLight ? '1px solid #ded7ca' : '1px solid #232832'),
                  backgroundColor: showTransitionsGraph
                    ? (isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(59, 130, 246, 0.15)')
                    : (isLight ? '#eae4d8' : '#090a0d'),
                  color: showTransitionsGraph
                    ? (isLight ? '#0284c7' : '#60a5fa')
                    : (isLight ? '#78716c' : '#8b949e'),
                  padding: '3px 7px',
                  borderRadius: 5,
                  fontSize: '0.70rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Toggle Draggable Group Level Transitions HUD"
              >
                <GitMerge size={11} />
                <span>Transitions</span>
              </button>
            )}

            {/* Call-Path Spotlight Toggle (Only for DAG and Flame Layouts) */}
            {(viewLayout === 'dag' || viewLayout === 'flame') && (
              <button
                type="button"
                onClick={() => setIsSpotlightEnabled((p) => !p)}
                style={{
                  border: isSpotlightEnabled
                    ? (isLight ? '1px solid #0284c7' : '1px solid #3b82f6')
                    : (isLight ? '1px solid #ded7ca' : '1px solid #232832'),
                  backgroundColor: isSpotlightEnabled
                    ? (isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(59, 130, 246, 0.15)')
                    : (isLight ? '#eae4d8' : '#090a0d'),
                  color: isSpotlightEnabled
                    ? (isLight ? '#0284c7' : '#60a5fa')
                    : (isLight ? '#78716c' : '#8b949e'),
                  padding: '3px 7px',
                  borderRadius: 5,
                  fontSize: '0.70rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Toggle Active Call-Path Spotlight (Hotkey: s)"
              >
                {isSpotlightEnabled ? <Eye size={11} /> : <EyeOff size={11} />}
                <span>Spotlight</span>
              </button>
            )}

            {/* Right Pinned Window Controls (Zoom, Fullscreen, Close) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
              {/* Zoom Controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  backgroundColor: isLight ? '#eae4d8' : '#090a0d',
                  border: isLight ? '1px solid #ded7ca' : '1px solid #232832',
                  borderRadius: 5,
                  padding: 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.1))}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: isLight ? '#57534e' : '#8b949e',
                    padding: 3,
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                  title="Zoom Out"
                >
                  <ZoomOut size={12} />
                </button>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontFamily: 'var(--font-mono, monospace)',
                    color: isLight ? '#57534e' : '#8b949e',
                    padding: '0 3px',
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
                    padding: 3,
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                  title="Zoom In"
                >
                  <ZoomIn size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: isLight ? '#57534e' : '#8b949e',
                    padding: 3,
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                  title="Reset Zoom"
                >
                  <RotateCcw size={10} />
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
                  padding: '4px 6px',
                  borderRadius: 5,
                  cursor: 'pointer',
                }}
                title={isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullScreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                style={{
                  border: isLight ? '1px solid #ded7ca' : '1px solid #232832',
                  backgroundColor: isLight ? '#eae4d8' : '#090a0d',
                  color: isLight ? '#57534e' : '#8b949e',
                  padding: '4px 6px',
                  borderRadius: 5,
                  cursor: 'pointer',
                }}
                title="Close Timeline (Esc)"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* ====================================================================
            BODY: SPLIT GRAPH / WATERFALL VIEWPORT & STEP INSPECTOR DRAWER
           ==================================================================== */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* Floating Draggable Group Transitions Graph HUD (Movable Item) */}
          {showTransitionsGraph && filteredStepNodes.length > 0 && viewLayout === 'dag' && (
            <div
              ref={hudElementRef}
              onMouseDown={handleHudMouseDown}
              style={{
                position: 'absolute',
                top: hudPos ? hudPos.y : 16,
                left: hudPos ? hudPos.x : undefined,
                right: hudPos ? undefined : 24,
                zIndex: 40,
                maxWidth: 390,
                width: '100%',
                pointerEvents: 'auto',
                cursor: isDraggingHud ? 'grabbing' : undefined,
              }}
            >
              <GroupTransitionsGraph
                nodes={filteredStepNodes}
                selectedStepIndex={selectedNodeIndex}
                onSelectStep={(idx) => {
                  setSelectedNodeIndex(idx);
                }}
                isLight={isLight}
                onClose={() => setShowTransitionsGraph(false)}
              />
            </div>
          )}
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
            {/* Sticky Common Ancestor Scope Banner (Solution 1) */}
            {clusteringMetadata.commonAncestor && clusterGranularity !== 'none' && (
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 16px',
                  backgroundColor: isLight ? 'rgba(244, 241, 234, 0.96)' : 'rgba(13, 15, 18, 0.96)',
                  backdropFilter: 'blur(8px)',
                  borderBottom: isLight ? '1px solid #ded7ca' : '1px solid #232832',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: isLight ? '#78716c' : '#8b949e', textTransform: 'uppercase', fontSize: '0.64rem', fontWeight: 800 }}>
                    COMMON ANCESTOR SCOPE:
                  </span>
                  <span
                    style={{
                      color: isLight ? '#0284c7' : '#38bdf8',
                      fontWeight: 700,
                      backgroundColor: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(56, 189, 248, 0.12)',
                      padding: '1px 6px',
                      borderRadius: 4,
                      border: isLight ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid rgba(56, 189, 248, 0.25)',
                    }}
                  >
                    {clusteringMetadata.commonAncestor}
                  </span>
                  <span style={{ color: isLight ? '#a8a29e' : '#64748b' }}>›</span>
                  <span style={{ color: isLight ? '#1f2937' : '#cbd5e1', fontWeight: 600 }}>
                    {clusteringMetadata.levelName} ({subsystemClusters.length} {subsystemClusters.length === 1 ? 'cluster' : 'clusters'})
                  </span>
                </div>

                <div
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.65rem',
                    color: isLight ? '#78716c' : '#8b949e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      backgroundColor: isLight ? '#eae4d8' : '#1e2430',
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    Auto-trimmed uniform root across all {filteredStepNodes.length} steps
                  </span>
                </div>
              </div>
            )}

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
                 MODE 1: DAG WORKFLOW PIPELINE GRAPH (TOP-TO-BOTTOM CARD DIRECTION)
                 & ATTACHED ANIMATED GROUP TRANSITIONS GRAPH
                 ============================================================== */
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                }}
              >
                {/* Global SVG Marker Definitions for DAG Vector Connectors */}
                <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
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
                    <marker
                      id="arrowhead-light"
                      markerWidth="6"
                      markerHeight="6"
                      refX="5"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0 0, 6 3, 0 6" fill="#0284c7" />
                    </marker>
                  </defs>
                </svg>

                {/* Main Cards Graph Flow: Starting immediately from the top-left */}
                <div
                  style={{
                    padding: '20px 32px 80px 32px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 0,
                    transformOrigin: '0 0',
                    transform: `scale(${zoomLevel})`,
                    minWidth: 'max-content',
                    boxSizing: 'border-box',
                  }}
                >
                {isSubsystemClustered ? (
                  /* --- CLUSTERED SUBSYSTEM BOUNDARY VIEW (Across=Top-to-Bottom, Within=Left-to-Right) --- */
                  subsystemClusters.map((cluster, cIdx) => {
                    const isLastCluster = cIdx === subsystemClusters.length - 1;
                    const cTheme = getSubsystemColor(cluster.displayName || cluster.root, isLight);

                    return (
                      <React.Fragment key={cluster.id}>
                        {/* Cluster Bounding Enclosure (Expands horizontally to contain its steps) */}
                        <div
                          style={{
                            border: `1.5px dashed ${cTheme.border}`,
                            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 20, 28, 0.65)',
                            borderRadius: 10,
                            padding: '14px 16px 16px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            gap: 12,
                            position: 'relative',
                            boxShadow: isLight
                              ? '0 2px 8px rgba(0, 0, 0, 0.04)'
                              : `0 4px 20px ${cTheme.bg}`,
                            width: 'fit-content',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
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
                              width: '100%',
                              boxSizing: 'border-box',
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
                                SUBSYSTEM: {cluster.displayName || cluster.root}
                              </span>
                              {cluster.errorCount > 0 && (
                                <span
                                  style={{
                                    fontSize: '0.62rem',
                                    backgroundColor: isLight ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.2)',
                                    color: isLight ? '#dc2626' : '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    fontWeight: 700,
                                  }}
                                >
                                  {cluster.errorCount} ERR
                                </span>
                              )}
                              <span style={{ fontSize: '0.68rem', color: isLight ? '#78716c' : '#8b949e' }}>
                                {cluster.items.length} {cluster.items.length === 1 ? 'step' : 'steps'}
                              </span>

                              {/* Subroutine Fold / Unfold Button */}
                              <button
                                type="button"
                                onClick={(e) => toggleCollapseCluster(cluster.id, e)}
                                style={{
                                  background: 'none',
                                  border: isLight ? '1px solid #ded7ca' : '1px solid #283040',
                                  borderRadius: 4,
                                  color: isLight ? '#57534e' : '#94a3b8',
                                  padding: '1px 6px',
                                  fontSize: '0.62rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontWeight: 600,
                                }}
                                title={collapsedClusterIds.has(cluster.id) ? 'Expand folded subroutine' : 'Fold subroutine'}
                              >
                                {collapsedClusterIds.has(cluster.id) ? <Plus size={9} /> : <Minus size={9} />}
                                <span>{collapsedClusterIds.has(cluster.id) ? 'Expand' : 'Fold'}</span>
                              </button>
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

                          {/* If folded, render compact capsule; otherwise render horizontal row of nodes */}
                          {collapsedClusterIds.has(cluster.id) ? (
                            <div
                              onClick={() => toggleCollapseCluster(cluster.id)}
                              style={{
                                padding: '12px 18px',
                                borderRadius: 8,
                                backgroundColor: isLight ? '#eae4d8' : '#141820',
                                border: isLight ? '1.5px dashed #0284c7' : '1.5px dashed #38bdf8',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                cursor: 'pointer',
                                minWidth: 260,
                              }}
                              title="Click to expand folded subroutine"
                            >
                              <Plus size={16} color={cTheme.text} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: cTheme.text }}>
                                  {cluster.items.length} steps folded ({cluster.displayName})
                                </span>
                                <span style={{ fontSize: '0.65rem', color: isLight ? '#78716c' : '#8b949e', fontFamily: 'var(--font-mono, monospace)' }}>
                                  Σ Δt: {formatDurationMs(cluster.totalDeltaMs)} • Click to expand
                                </span>
                              </div>
                            </div>
                          ) : (
                            /* Horizontal Nodes inside this Cluster (Left-to-Right Flow) */
                            <div
                              style={{
                                display: 'inline-flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 0,
                                width: 'auto',
                              }}
                            >
                              {cluster.items.map((node, i) => {
                                const isSelected = selectedNode?.id === node.id;
                                const isLastInCluster = i === cluster.items.length - 1;
                                const lvlTheme = getLevelColors(node.level, isLight);
                                const isSpotlighted = !activeSpotlightPath || activeSpotlightPath.has(node.index);

                                return (
                                  <React.Fragment key={node.id}>
                                    {/* Step Node Card with Compact Breadcrumbs (Phase 1) */}
                                    <div
                                      ref={isSelected ? activeNodeRef : null}
                                      onClick={() => setSelectedNodeIndex(node.index)}
                                      style={{
                                        width: 250,
                                        contentVisibility: 'auto',
                                        containIntrinsicSize: '250px 110px',
                                        opacity: isSpotlighted ? 1 : 0.22,
                                        filter: isSpotlighted ? 'none' : 'grayscale(0.65)',
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
                                        transition: 'opacity 140ms ease, filter 140ms ease, border-color 160ms ease, box-shadow 160ms ease',
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

                                    {/* Call Stack Return-to-Caller Resume Pill */}
                                    {node.isReturnResume && (
                                      <div
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          fontSize: '0.62rem',
                                          fontWeight: 700,
                                          fontFamily: 'var(--font-mono, monospace)',
                                          color: isLight ? '#0369a1' : '#38bdf8',
                                          backgroundColor: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(56, 189, 248, 0.16)',
                                          border: isLight ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                                          padding: '2px 6px',
                                          borderRadius: 4,
                                          marginBottom: 6,
                                        }}
                                        title={`Returned from ${node.returnedFromOperation || 'callee'} (Step #${(node.returnedFromStepIndex ?? 0) + 1}) back to ${node.operation}`}
                                      >
                                        <Undo2 size={10} />
                                        <span>↩ Return to Caller</span>
                                        {node.returnedFromOperation && (
                                          <span style={{ opacity: 0.75, maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            ({node.returnedFromOperation})
                                          </span>
                                        )}
                                      </div>
                                    )}

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

                                  {/* Intra-Cluster Connecting Vector Edge (Left-to-Right Horizontal Arrow) */}
                                  {!isLastInCluster && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 70,
                                        height: 36,
                                        position: 'relative',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {/* Latency Pill */}
                                      <div
                                        style={{
                                          position: 'absolute',
                                          top: -7,
                                          left: '50%',
                                          transform: 'translateX(-50%)',
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

                                      {/* Arrow Vector Line (Horizontal Flow inside cluster) */}
                                      <svg width={70} height={24} style={{ display: 'block' }}>
                                        <line
                                          x1={0}
                                          y1={12}
                                          x2={64}
                                          y2={12}
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
                        )}
                        </div>

                        {/* Inter-Subsystem Boundary Vector Edge (Top-to-Bottom across clusters) */}
                        {!isLastCluster && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 282,
                              height: 60,
                              position: 'relative',
                              flexShrink: 0,
                              alignSelf: 'flex-start',
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: 'calc(50% + 18px)',
                                transform: 'translateY(-50%)',
                                fontSize: '0.60rem',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                                color: isLight ? '#b45309' : '#f59e0b',
                                letterSpacing: '0.04em',
                                backgroundColor: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.15)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              CROSS-SUBSYSTEM
                            </div>
                            <svg width={24} height={60} style={{ display: 'block' }}>
                              <line
                                x1={12}
                                y1={0}
                                x2={12}
                                y2={54}
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
                  <div
                    style={{
                      display: 'inline-flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 0,
                    }}
                  >
                    {filteredStepNodes.map((node, i) => {
                      const isSelected = selectedNode?.id === node.id;
                      const isLast = i === filteredStepNodes.length - 1;
                      const lvlTheme = getLevelColors(node.level, isLight);
                      const isSpotlighted = !activeSpotlightPath || activeSpotlightPath.has(node.index);

                      return (
                        <React.Fragment key={node.id}>
                          {/* Step Node Card with Compact Breadcrumbs */}
                          <div
                            ref={isSelected ? activeNodeRef : null}
                            onClick={() => setSelectedNodeIndex(node.index)}
                            style={{
                              width: 250,
                              contentVisibility: 'auto',
                              containIntrinsicSize: '250px 110px',
                            opacity: isSpotlighted ? 1 : 0.22,
                            filter: isSpotlighted ? 'none' : 'grayscale(0.65)',
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
                            transition: 'opacity 140ms ease, filter 140ms ease, border-color 160ms ease, box-shadow 160ms ease',
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

                          {/* Call Stack Return-to-Caller Resume Pill */}
                          {node.isReturnResume && (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono, monospace)',
                                color: isLight ? '#0369a1' : '#38bdf8',
                                backgroundColor: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(56, 189, 248, 0.16)',
                                border: isLight ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                marginBottom: 6,
                              }}
                              title={`Returned from ${node.returnedFromOperation || 'callee'} (Step #${(node.returnedFromStepIndex ?? 0) + 1}) back to ${node.operation}`}
                            >
                              <Undo2 size={10} />
                              <span>↩ Return to Caller</span>
                              {node.returnedFromOperation && (
                                <span style={{ opacity: 0.75, maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  ({node.returnedFromOperation})
                                </span>
                              )}
                            </div>
                          )}

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

                        {/* Connecting Latency Vector Edge (Horizontal Arrow in Flat View) */}
                        {!isLast && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 70,
                              height: 36,
                              position: 'relative',
                              flexShrink: 0,
                            }}
                          >
                            {/* Latency Pill */}
                            <div
                              style={{
                                position: 'absolute',
                                top: -7,
                                left: '50%',
                                transform: 'translateX(-50%)',
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
                            <svg width={70} height={24} style={{ display: 'block' }}>
                              <line
                                x1={0}
                                y1={12}
                                x2={64}
                                y2={12}
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
                  })}
                  </div>
                )}
                </div>
              </div>
            ) : viewLayout === 'flame' ? (
              /* ==============================================================
                 MODE 5: FLAME-DAG (2D STACK-DEPTH INDENTED VIEW - Feature 3)
                 ============================================================== */
              (() => {
                const cardWidth = 250;
                const cardHeight = 110;
                const gapX = 80;
                const rowHeight = 150;
                const startX = 32;
                const startY = 20;

                const maxDepth = Math.max(0, ...filteredStepNodes.map((n) => n.callDepth || 0));
                const canvasWidth = startX * 2 + filteredStepNodes.length * (cardWidth + gapX);
                const canvasHeight = startY * 2 + (maxDepth + 1) * rowHeight + 20;

                return (
                  <div
                    style={{
                      position: 'relative',
                      width: canvasWidth,
                      height: canvasHeight,
                      minWidth: 'max-content',
                      minHeight: '100%',
                      transformOrigin: '0 0',
                      transform: `scale(${zoomLevel})`,
                      padding: 16,
                    }}
                  >
                    {/* Horizontal Depth Swim-Tier Guideline Rails */}
                    {Array.from({ length: maxDepth + 1 }).map((_, depth) => {
                      const railY = startY + depth * rowHeight;
                      return (
                        <div
                          key={`rail-${depth}`}
                          style={{
                            position: 'absolute',
                            left: 16,
                            right: 16,
                            top: railY,
                            height: rowHeight - 20,
                            borderRadius: 8,
                            backgroundColor: isLight
                              ? (depth % 2 === 0 ? 'rgba(0, 0, 0, 0.015)' : 'rgba(2, 132, 199, 0.025)')
                              : (depth % 2 === 0 ? 'rgba(255, 255, 255, 0.012)' : 'rgba(56, 189, 248, 0.025)'),
                            border: isLight ? '1px dashed #e2ded5' : '1px dashed #1a2230',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'flex-start',
                            padding: '6px 12px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontFamily: 'var(--font-mono, monospace)',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              color: isLight ? '#78716c' : '#64748b',
                              backgroundColor: isLight ? '#ffffff' : '#0e1117',
                              padding: '2px 8px',
                              borderRadius: 4,
                              border: isLight ? '1px solid #ded7ca' : '1px solid #232c3d',
                            }}
                          >
                            {depth === 0
                              ? 'Depth 0 • Root Call Frame'
                              : depth === 1
                              ? 'Depth 1 • Callee Subroutine'
                              : `Depth ${depth} • Subroutine Descent`}
                          </span>
                        </div>
                      );
                    })}

                    {/* Shared SVG Markers for Flame Connectors */}
                    <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
                      <defs>
                        <marker
                          id={isLight ? 'flame-arrow-light' : 'flame-arrow'}
                          markerWidth="6"
                          markerHeight="6"
                          refX="5"
                          refY="3"
                          orient="auto"
                        >
                          <polygon points="0 0, 6 3, 0 6" fill={isLight ? '#0284c7' : '#38bdf8'} />
                        </marker>
                        <marker
                          id={isLight ? 'flame-return-light' : 'flame-return'}
                          markerWidth="6"
                          markerHeight="6"
                          refX="5"
                          refY="3"
                          orient="auto"
                        >
                          <polygon points="0 0, 6 3, 0 6" fill={isLight ? '#059669' : '#34d399'} />
                        </marker>
                      </defs>
                    </svg>

                    {/* Highly performant localized SVG Spline Connectors (Eliminates single massive 66,000px SVG) */}
                    {filteredStepNodes.map((curr, idx) => {
                      if (idx === filteredStepNodes.length - 1) return null;
                      const next = filteredStepNodes[idx + 1];

                      const x1 = startX + idx * (cardWidth + gapX) + cardWidth;
                      const y1 = startY + curr.callDepth * rowHeight + 65;

                      const x2 = startX + (idx + 1) * (cardWidth + gapX);
                      const y2 = startY + next.callDepth * rowHeight + 65;

                      const minY = Math.min(y1, y2) - 15;
                      const maxY = Math.max(y1, y2) + 15;
                      const svgHeight = Math.max(maxY - minY, 30);
                      const localY1 = y1 - minY;
                      const localY2 = y2 - minY;
                      const midY = (localY1 + localY2) / 2;

                      const isReturn = next.isReturnResume || next.callDepth < curr.callDepth;
                      const isDescent = next.callDepth > curr.callDepth;
                      const strokeColor = isReturn
                        ? (isLight ? '#059669' : '#34d399')
                        : isDescent
                        ? (isLight ? '#0284c7' : '#38bdf8')
                        : (isLight ? '#0284c7' : '#3b82f6');

                      const isSpotlighted =
                        !activeSpotlightPath ||
                        (activeSpotlightPath.has(curr.index) && activeSpotlightPath.has(next.index));

                      return (
                        <svg
                          key={`flame-spline-${curr.id}-${next.id}`}
                          width={gapX + 10}
                          height={svgHeight}
                          style={{
                            position: 'absolute',
                            left: x1,
                            top: minY,
                            pointerEvents: 'none',
                            zIndex: 1,
                            overflow: 'visible',
                            opacity: isSpotlighted ? 1 : 0.2,
                            contentVisibility: 'auto',
                            containIntrinsicSize: `${gapX + 10}px ${svgHeight}px`,
                          }}
                        >
                          <path
                            d={`M 0 ${localY1} C 40 ${localY1}, 40 ${localY2}, 80 ${localY2}`}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={isReturn ? 2.2 : 2.0}
                            strokeDasharray={isReturn ? '6 4' : isDescent ? 'none' : '4 3'}
                            markerEnd={`url(#${
                              isReturn
                                ? (isLight ? 'flame-return-light' : 'flame-return')
                                : (isLight ? 'flame-arrow-light' : 'flame-arrow')
                            })`}
                          />

                          {/* Native High-Performance SVG Spline Badge (Replaces heavyweight foreignObject) */}
                          <g transform={`translate(40, ${midY})`}>
                            <rect
                              x={-34}
                              y={-9}
                              width={68}
                              height={18}
                              rx={9}
                              ry={9}
                              fill={isReturn ? (isLight ? '#ecfdf5' : '#062d1f') : (isLight ? '#ffffff' : '#0e1117')}
                              stroke={isReturn ? (isLight ? '#10b981' : '#34d399') : (isLight ? '#ded7ca' : '#283040')}
                              strokeWidth={1}
                            />
                            <text
                              x={0}
                              y={3.5}
                              textAnchor="middle"
                              fill={isReturn ? (isLight ? '#047857' : '#34d399') : (isLight ? '#0284c7' : '#38bdf8')}
                              fontSize="9.5"
                              fontFamily="var(--font-mono, monospace)"
                              fontWeight="700"
                            >
                              {isReturn ? '↩ return' : `+${formatDurationMs(next.deltaFromPrevMs)}`}
                            </text>
                          </g>
                        </svg>
                      );
                    })}

                    {/* Step Node Cards Placed on 2D Flame Coordinates */}
                    {filteredStepNodes.map((node, nodeIdx) => {
                      const isSelected = selectedNode?.id === node.id;
                      const lvlTheme = getLevelColors(node.level, isLight);
                      const isSpotlighted = !activeSpotlightPath || activeSpotlightPath.has(node.index);
                      const nodeX = startX + nodeIdx * (cardWidth + gapX);
                      const nodeY = startY + node.callDepth * rowHeight + 10;
                      const subColor = getSubsystemColor(node.hierarchy.root, isLight);

                      return (
                        <div
                          key={`flame-node-${node.id}`}
                          ref={isSelected ? activeNodeRef : null}
                          onClick={() => setSelectedNodeIndex(node.index)}
                          style={{
                            position: 'absolute',
                            left: nodeX,
                            top: nodeY,
                            width: cardWidth,
                            minHeight: cardHeight,
                            contentVisibility: 'auto',
                            containIntrinsicSize: '250px 110px',
                            zIndex: 2,
                            opacity: isSpotlighted ? 1 : 0.22,
                            filter: isSpotlighted ? 'none' : 'grayscale(0.65)',
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
                            transition: 'opacity 140ms ease, filter 140ms ease, border-color 160ms ease, box-shadow 160ms ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          {/* Card Top Row: Sequence, Depth Pill, Level, Elapsed */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 800,
                                  fontFamily: 'var(--font-mono, monospace)',
                                  backgroundColor: isSelected
                                    ? (isLight ? '#0284c7' : '#3b82f6')
                                    : (isLight ? '#eae4d8' : '#1f2533'),
                                  color: isSelected ? '#ffffff' : (isLight ? '#1c1917' : '#94a3b8'),
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                #{node.index + 1}
                              </span>

                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  fontFamily: 'var(--font-mono, monospace)',
                                  fontWeight: 700,
                                  backgroundColor: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(56, 189, 248, 0.12)',
                                  color: isLight ? '#0284c7' : '#38bdf8',
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                }}
                              >
                                D{node.callDepth}
                              </span>

                              {node.level && (
                                <span
                                  style={{
                                    fontSize: '0.60rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    backgroundColor: lvlTheme.bg,
                                    color: lvlTheme.text,
                                    border: `1px solid ${lvlTheme.border}`,
                                    padding: '1px 4px',
                                    borderRadius: 3,
                                  }}
                                >
                                  {node.level}
                                </span>
                              )}
                            </div>

                            <span
                              style={{
                                fontSize: '0.64rem',
                                fontFamily: 'var(--font-mono, monospace)',
                                color: isLight ? '#78716c' : '#64748b',
                              }}
                            >
                              +{formatDurationMs(node.deltaFromStartMs)}
                            </span>
                          </div>

                          {/* Return Resume Chip */}
                          {node.isReturnResume && (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                color: isLight ? '#047857' : '#34d399',
                                backgroundColor: isLight ? 'rgba(5, 150, 105, 0.08)' : 'rgba(52, 211, 153, 0.12)',
                                border: isLight ? '1px solid rgba(5, 150, 105, 0.25)' : '1px solid rgba(52, 211, 153, 0.25)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                width: 'fit-content',
                              }}
                              title={node.returnedFromOperation ? `Returned from ${node.returnedFromOperation}` : undefined}
                            >
                              <CornerDownRight size={10} />
                              <span>↩ Returned to Caller</span>
                            </div>
                          )}

                          {/* Namespace Breadcrumb Root & Leaf */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '0.64rem',
                                color: isLight ? '#78716c' : '#8b949e',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span
                                style={{
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                  fontSize: '0.60rem',
                                  fontWeight: 700,
                                  backgroundColor: subColor.bg,
                                  color: subColor.text,
                                  border: `1px solid ${subColor.border}`,
                                  flexShrink: 0,
                                }}
                              >
                                {node.hierarchy.root}
                              </span>
                              {node.hierarchy.parentPath && (
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {node.hierarchy.parentPath}
                                </span>
                              )}
                            </div>

                            <div
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono, monospace)',
                                color: isSelected ? (isLight ? '#0284c7' : '#60a5fa') : (isLight ? '#1c1917' : '#f1f5f9'),
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={node.hierarchy.leaf}
                            >
                              {node.hierarchy.leaf}
                            </div>
                          </div>

                          {/* Operation Name */}
                          <div
                            style={{
                              fontSize: '0.70rem',
                              fontFamily: 'var(--font-mono, monospace)',
                              color: isLight ? '#57534e' : '#94a3b8',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={node.operation}
                          >
                            {node.operation}
                          </div>

                          {/* Bottom Row: Line Number, Payload Badge, Hotspot */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4, borderTop: isLight ? '1px solid #f0ece3' : '1px solid #1a2230' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono, monospace)', color: isLight ? '#78716c' : '#64748b' }}>
                                L#{node.lineNumber}
                              </span>
                              {node.hasPayload && (
                                <span
                                  style={{
                                    fontSize: '0.58rem',
                                    fontWeight: 700,
                                    padding: '1px 4px',
                                    borderRadius: 3,
                                    backgroundColor: isLight ? 'rgba(217, 119, 6, 0.12)' : 'rgba(234, 179, 8, 0.14)',
                                    color: isLight ? '#b45309' : '#fde047',
                                  }}
                                >
                                  AST
                                </span>
                              )}
                            </div>

                            {node.isHotspot && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 2,
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                  color: '#ef4444',
                                }}
                              >
                                <Flame size={10} />
                                <span>Slow</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : viewLayout === 'macro' ? (
              /* ==============================================================
                 MODE 4: SUBSYSTEM MACRO-GRAPH (INTER-MODULE TRANSIT VIEW - Solution 3)
                 ============================================================== */
              <div
                style={{
                  padding: '36px 32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0,
                  transformOrigin: '0 0',
                  transform: `scale(${zoomLevel})`,
                  minWidth: 'max-content',
                }}
              >
                {macroGraph.clusters.map((cluster, cIdx) => {
                  const cTheme = getSubsystemColor(cluster.displayName || cluster.root, isLight);
                  const isSelectedCluster = cluster.items.some((it) => it.id === selectedNode?.id);
                  const transitEdge = macroGraph.edges[cIdx];

                  return (
                    <React.Fragment key={cluster.id}>
                      {/* Macro Subsystem Node Card */}
                      <div
                        onClick={() => {
                          if (cluster.items[0]) {
                            setSelectedNodeIndex(cluster.items[0].index);
                          }
                        }}
                        style={{
                          width: 290,
                          backgroundColor: isLight ? '#ffffff' : '#141820',
                          border: isSelectedCluster
                            ? `2px solid ${cTheme.border}`
                            : (isLight ? '1px solid #ded7ca' : '1px solid #283040'),
                          borderRadius: 10,
                          padding: 14,
                          boxShadow: isSelectedCluster
                            ? (isLight ? '0 4px 16px rgba(0,0,0,0.1)' : `0 4px 20px ${cTheme.bg}`)
                            : (isLight ? '0 2px 6px rgba(0,0,0,0.04)' : 'none'),
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                          position: 'relative',
                        }}
                      >
                        {/* Macro Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: cTheme.border,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: '0.84rem',
                                fontWeight: 700,
                                color: cTheme.text,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={cluster.displayName}
                            >
                              {cluster.displayName}
                            </span>
                          </div>

                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontFamily: 'var(--font-mono, monospace)',
                              color: isLight ? '#0284c7' : '#38bdf8',
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            Σ Δt: {formatDurationMs(cluster.totalDeltaMs)}
                          </span>
                        </div>

                        {/* Metrics Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.66rem',
                              backgroundColor: isLight ? '#eae4d8' : '#1e2430',
                              color: isLight ? '#57534e' : '#94a3b8',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {cluster.items.length} {cluster.items.length === 1 ? 'step' : 'steps'}
                          </span>

                          {cluster.errorCount > 0 && (
                            <span
                              style={{
                                fontSize: '0.66rem',
                                backgroundColor: isLight ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.2)',
                                color: isLight ? '#dc2626' : '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                padding: '1px 6px',
                                borderRadius: 4,
                                fontWeight: 700,
                              }}
                            >
                              {cluster.errorCount} {cluster.errorCount === 1 ? 'Error' : 'Errors'}
                            </span>
                          )}

                          {cluster.warnCount > 0 && (
                            <span
                              style={{
                                fontSize: '0.66rem',
                                backgroundColor: isLight ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.2)',
                                color: isLight ? '#b45309' : '#fbbf24',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                padding: '1px 6px',
                                borderRadius: 4,
                                fontWeight: 600,
                              }}
                            >
                              {cluster.warnCount} Warn
                            </span>
                          )}
                        </div>

                        {/* List of operations executed inside this module */}
                        <div
                          style={{
                            borderTop: isLight ? '1px solid #f0ece3' : '1px solid rgba(255,255,255,0.06)',
                            paddingTop: 8,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            maxHeight: 130,
                            overflowY: 'auto',
                          }}
                        >
                          {cluster.items.map((node) => {
                            const isNodeSelected = selectedNode?.id === node.id;
                            const isErr = node.level === 'error' || node.level === 'critical' || node.level === 'emergency';

                            return (
                              <div
                                key={node.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedNodeIndex(node.index);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '3px 6px',
                                  borderRadius: 4,
                                  backgroundColor: isNodeSelected
                                    ? (isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(59, 130, 246, 0.2)')
                                    : 'transparent',
                                  fontSize: '0.68rem',
                                  fontFamily: 'var(--font-mono, monospace)',
                                }}
                              >
                                <span
                                  style={{
                                    color: isErr ? '#ef4444' : (isLight ? '#1f2937' : '#cbd5e1'),
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontWeight: isNodeSelected ? 700 : 400,
                                  }}
                                  title={node.operation}
                                >
                                  #{node.index + 1} {node.operation}
                                </span>
                                <span style={{ color: isLight ? '#78716c' : '#64748b', fontSize: '0.62rem', flexShrink: 0 }}>
                                  +{formatDurationMs(node.deltaFromPrevMs)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Inter-Subsystem Transit Bridge / Latency Edge */}
                      {transitEdge && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 100,
                            position: 'relative',
                            padding: '0 8px',
                          }}
                        >
                          {/* Latency Pill */}
                          <div
                            style={{
                              fontSize: '0.62rem',
                              fontFamily: 'var(--font-mono, monospace)',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              marginBottom: 4,
                              backgroundColor: transitEdge.isHotspot
                                ? (isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.2)')
                                : (isLight ? '#eae4d8' : '#1e2430'),
                              color: transitEdge.isHotspot
                                ? '#dc2626'
                                : (isLight ? '#57534e' : '#94a3b8'),
                              border: transitEdge.isHotspot
                                ? '1px solid rgba(239, 68, 68, 0.4)'
                                : (isLight ? '1px solid #ded7ca' : '1px solid #283040'),
                              whiteSpace: 'nowrap',
                            }}
                            title={`Inter-subsystem dispatch latency from ${transitEdge.fromName} to ${transitEdge.toName}`}
                          >
                            Δ {formatDurationMs(transitEdge.transitDeltaMs)}
                          </div>

                          {/* Arrow Connector Line */}
                          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <div
                              style={{
                                height: 2,
                                flex: 1,
                                backgroundColor: transitEdge.isHotspot
                                  ? '#ef4444'
                                  : (isLight ? '#0284c7' : '#38bdf8'),
                              }}
                            />
                            <ArrowRight
                              size={14}
                              color={transitEdge.isHotspot ? '#ef4444' : (isLight ? '#0284c7' : '#38bdf8')}
                              style={{ marginLeft: -3 }}
                            />
                          </div>

                          <span style={{ fontSize: '0.58rem', color: isLight ? '#a8a29e' : '#64748b', marginTop: 2 }}>
                            transit
                          </span>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, width: '100%' }}>
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
                                wordBreak: 'break-all',
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
                                  flexShrink: 0,
                                }}
                              >
                                {selectedNode.hierarchy.root}
                              </span>
                              {selectedNode.hierarchy.segments.slice(1, -1).map((seg, idx) => (
                                <React.Fragment key={idx}>
                                  <span style={{ opacity: 0.4 }}>›</span>
                                  <span style={{ fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{seg}</span>
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
                                wordBreak: 'break-all',
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
                          wordBreak: 'break-all',
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
                        wordBreak: 'break-all',
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

                {/* Reconstituted Call Stack & Return Context Card */}
                {(selectedNode.isReturnResume || selectedNode.parentCallerStepIndex !== undefined || selectedNode.callDepth > 0) && (
                  <div
                    style={{
                      marginBottom: 16,
                      backgroundColor: isLight ? '#ffffff' : '#0c0e12',
                      border: selectedNode.isReturnResume
                        ? (isLight ? '1.5px solid #0284c7' : '1.5px solid #38bdf8')
                        : (isLight ? '1px solid #ded7ca' : '1px solid #1e2430'),
                      borderRadius: 8,
                      padding: 10,
                      boxShadow: selectedNode.isReturnResume
                        ? (isLight ? '0 2px 10px rgba(2, 132, 199, 0.12)' : '0 4px 16px rgba(56, 189, 248, 0.12)')
                        : 'none',
                    }}
                  >
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
                        <CornerDownRight size={13} color={selectedNode.isReturnResume ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? '#78716c' : '#8b949e')} />
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            color: selectedNode.isReturnResume ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? '#57534e' : '#94a3b8'),
                            textTransform: 'uppercase',
                          }}
                        >
                          {selectedNode.isReturnResume ? '↩ RETURNED TO CALLER CONTEXT' : 'CALL STACK ACTIVATION'}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontFamily: 'var(--font-mono, monospace)',
                          backgroundColor: isLight ? '#eae4d8' : '#1e2430',
                          padding: '1px 6px',
                          borderRadius: 3,
                          color: isLight ? '#57534e' : '#94a3b8',
                          fontWeight: 600,
                        }}
                      >
                        Depth {selectedNode.callDepth} {selectedNode.callDepth === 0 ? '(Root)' : '(Callee)'}
                      </span>
                    </div>

                    {/* Return Info */}
                    {selectedNode.isReturnResume && selectedNode.returnedFromStepIndex !== undefined && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: 5,
                          backgroundColor: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(56, 189, 248, 0.1)',
                          marginBottom: selectedNode.parentCallerStepIndex !== undefined ? 6 : 0,
                          fontSize: '0.7rem',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
                          <span style={{ fontSize: '0.6rem', color: isLight ? '#0369a1' : '#38bdf8', textTransform: 'uppercase', fontWeight: 700 }}>
                            Returned from callee
                          </span>
                          <span
                            style={{
                              fontWeight: 600,
                              color: isLight ? '#1f2937' : '#e2e8f0',
                              fontFamily: 'var(--font-mono, monospace)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 190,
                            }}
                            title={selectedNode.returnedFromOperation}
                          >
                            Step #{selectedNode.returnedFromStepIndex + 1}: {selectedNode.returnedFromOperation || 'Subroutine'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedNodeIndex(selectedNode.returnedFromStepIndex!)}
                          style={{
                            background: 'none',
                            border: isLight ? '1px solid #0284c7' : '1px solid #38bdf8',
                            color: isLight ? '#0284c7' : '#38bdf8',
                            borderRadius: 4,
                            padding: '2px 7px',
                            fontSize: '0.64rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                          title="Jump back to the completed callee step"
                        >
                          Jump to Callee
                        </button>
                      </div>
                    )}

                    {/* Active Virtual Call Stack Trace (Root -> Callee) */}
                    <div style={{ marginTop: selectedNode.isReturnResume && selectedNode.returnedFromStepIndex !== undefined ? 8 : 4 }}>
                      <div
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: isLight ? '#78716c' : '#8b949e',
                          marginBottom: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>Active Call Stack (Root → Callee)</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                            {activeStackFrames.length} {activeStackFrames.length === 1 ? 'frame' : 'frames'}
                          </span>
                          {activeStackFrames.length > 5 && (
                            <button
                              type="button"
                              onClick={() => setIsStackUnfolded((u) => !u)}
                              style={{
                                background: 'none',
                                border: isLight ? '1px solid #ded7ca' : '1px solid #283040',
                                borderRadius: 3,
                                color: isLight ? '#0284c7' : '#38bdf8',
                                fontSize: '0.58rem',
                                cursor: 'pointer',
                                padding: '1px 5px',
                                fontWeight: 600,
                              }}
                            >
                              {isStackUnfolded ? 'Fold' : 'Expand All'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {displayStackFrames.map((item, fIdx) => {
                          if (item.isFoldIndicator) {
                            return (
                              <div
                                key="stack-fold-indicator"
                                onClick={() => setIsStackUnfolded(true)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 4,
                                  backgroundColor: isLight ? '#eae4d8' : '#141820',
                                  border: isLight ? '1px dashed #0284c7' : '1px dashed #38bdf8',
                                  color: isLight ? '#0369a1' : '#38bdf8',
                                  fontSize: '0.62rem',
                                  fontFamily: 'var(--font-mono, monospace)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  margin: '2px 0 2px 14px',
                                }}
                                title="Click to expand all intermediate call frames"
                              >
                                <span>↕ {item.hiddenCount} intermediate frames folded</span>
                                <span style={{ textDecoration: 'underline', fontWeight: 600 }}>Expand</span>
                              </div>
                            );
                          }

                          const frame = item.frame;
                          const isCurrent = frame.index === selectedNode.index;
                          const isRoot = frame.depth === 0;

                          return (
                            <React.Fragment key={`frame-${frame.depth}-${frame.index}-${fIdx}`}>
                              {/* Visual Subroutine Call Flow Connector between frames */}
                              {fIdx > 0 && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    paddingLeft: 10 + (fIdx - 1) * 8,
                                    margin: '-1px 0',
                                    color: isLight ? '#0284c7' : '#38bdf8',
                                    fontSize: '0.58rem',
                                    fontFamily: 'var(--font-mono, monospace)',
                                    opacity: 0.8,
                                  }}
                                >
                                  <span>│</span>
                                  <span>↳ invokes callee</span>
                                </div>
                              )}

                              <div
                                onClick={() => setSelectedNodeIndex(frame.index)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 8px',
                                  borderRadius: 5,
                                  backgroundColor: isCurrent
                                    ? (isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(56, 189, 248, 0.12)')
                                    : (isLight ? '#f5f2eb' : '#141820'),
                                  borderLeft: isCurrent
                                    ? (isLight ? '3px solid #0284c7' : '3px solid #38bdf8')
                                    : (isLight ? '3px solid #ded7ca' : '3px solid #232832'),
                                  borderTop: isCurrent
                                    ? (isLight ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(56, 189, 248, 0.35)')
                                    : (isLight ? '1px solid #e7e2d6' : '1px solid #1a202c'),
                                  borderRight: isCurrent
                                    ? (isLight ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(56, 189, 248, 0.35)')
                                    : (isLight ? '1px solid #e7e2d6' : '1px solid #1a202c'),
                                  borderBottom: isCurrent
                                    ? (isLight ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(56, 189, 248, 0.35)')
                                    : (isLight ? '1px solid #e7e2d6' : '1px solid #1a202c'),
                                  cursor: 'pointer',
                                  transition: 'all 120ms ease',
                                  marginLeft: frame.depth * 6,
                                }}
                                title={isCurrent ? 'Current active frame' : `Click to jump to Step #${frame.index + 1}`}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span
                                      style={{
                                        fontSize: '0.58rem',
                                        fontFamily: 'var(--font-mono, monospace)',
                                        fontWeight: 700,
                                        backgroundColor: isCurrent
                                          ? (isLight ? '#0284c7' : '#38bdf8')
                                          : (isLight ? '#e7e2d6' : '#1e2430'),
                                        color: isCurrent
                                          ? '#ffffff'
                                          : (isLight ? '#57534e' : '#94a3b8'),
                                        padding: '1px 5px',
                                        borderRadius: 3,
                                      }}
                                    >
                                      Depth {frame.depth} {isRoot ? '• Root' : isCurrent ? '• Active Callee' : '• Caller'}
                                    </span>

                                    <span
                                      style={{
                                        fontSize: '0.64rem',
                                        fontWeight: 700,
                                        fontFamily: 'var(--font-mono, monospace)',
                                        color: isCurrent
                                          ? (isLight ? '#0369a1' : '#38bdf8')
                                          : (isLight ? '#1f2937' : '#e2e8f0'),
                                      }}
                                    >
                                      Step #{frame.index + 1}
                                    </span>
                                  </div>

                                  <div
                                    style={{
                                      fontFamily: 'var(--font-mono, monospace)',
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      color: isCurrent
                                        ? (isLight ? '#0369a1' : '#38bdf8')
                                        : (isLight ? '#1f2937' : '#cbd5e1'),
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={frame.operation}
                                  >
                                    {frame.operation || 'Subroutine'}
                                  </div>

                                  <div
                                    style={{
                                      fontSize: '0.62rem',
                                      color: isLight ? '#78716c' : '#8b949e',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <span>{frame.namespace || frame.module}</span>
                                    {frame.fileLocation && (
                                      <>
                                        <span>•</span>
                                        <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{frame.fileLocation}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div style={{ marginLeft: 8, flexShrink: 0 }}>
                                  {isCurrent ? (
                                    <span
                                      style={{
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                        color: isLight ? '#0284c7' : '#38bdf8',
                                        backgroundColor: isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(56, 189, 248, 0.15)',
                                        border: isLight ? '1px solid #0284c7' : '1px solid #38bdf8',
                                        borderRadius: 3,
                                        padding: '2px 6px',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      Active
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedNodeIndex(frame.index);
                                      }}
                                      style={{
                                        background: 'none',
                                        border: isLight ? '1px solid #ded7ca' : '1px solid #3b82f6',
                                        color: isLight ? '#0284c7' : '#60a5fa',
                                        borderRadius: 4,
                                        padding: '2px 7px',
                                        fontSize: '0.64rem',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                      }}
                                      title={`Jump to step #${frame.index + 1}`}
                                    >
                                      Jump
                                    </button>
                                  )}
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

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
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      <span>EMBEDDED PAYLOAD INSPECTION</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            handleCopyRaw(formattedPayloadSnippet || selectedNode.payloadSnippet!);
                            setPayloadCopied(true);
                            setTimeout(() => setPayloadCopied(false), 1800);
                          }}
                          style={{
                            backgroundColor: payloadCopied
                              ? (isLight ? 'rgba(5, 150, 105, 0.15)' : 'rgba(52, 211, 153, 0.18)')
                              : (isLight ? 'rgba(217, 119, 6, 0.08)' : 'rgba(234, 179, 8, 0.1)'),
                            border: payloadCopied
                              ? (isLight ? '1px solid #10b981' : '1px solid #34d399')
                              : (isLight ? '1px solid #d97706' : '1px solid #fde047'),
                            color: payloadCopied
                              ? (isLight ? '#047857' : '#34d399')
                              : (isLight ? '#b45309' : '#fde047'),
                            fontSize: '0.68rem',
                            borderRadius: 4,
                            padding: '2px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontWeight: 600,
                          }}
                          title="Copy payload to clipboard"
                        >
                          {payloadCopied ? <Check size={11} /> : <Copy size={11} />}
                          <span>{payloadCopied ? 'Copied' : 'Copy'}</span>
                        </button>

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
                          title="Open in full interactive AST Tree Inspector (Hotkey: p)"
                        >
                          <Code2 size={11} />
                          <span>Open in AST Tree (p)</span>
                        </button>
                      </div>
                    </div>

                    <pre
                      onClick={() =>
                        handleOpenInspector(
                          selectedNode.payloadSnippet!,
                          selectedNode.payloadSnippet!.trim().startsWith('<') ? 'xml' : 'json'
                        )
                      }
                      style={{
                        backgroundColor: isLight ? '#eae4d8' : '#090a0d',
                        borderRadius: 6,
                        border: isLight ? '1px solid rgba(217, 119, 6, 0.3)' : '1px solid rgba(234, 179, 8, 0.25)',
                        padding: 10,
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        color: isLight ? '#92400e' : '#fde047',
                        margin: 0,
                        maxHeight: 140,
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        cursor: 'pointer',
                      }}
                      title="Click to open interactive AST Tree"
                    >
                      {(formattedPayloadSnippet || selectedNode.payloadSnippet).slice(0, 400)}
                      {(formattedPayloadSnippet || selectedNode.payloadSnippet).length > 400 ? '...' : ''}
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
            <span title="Toggle between DAG, Flame, Macro, Waterfall and Swimlanes view">
              <kbd style={kbdStyle(isLight)}>v</kbd> / <kbd style={kbdStyle(isLight)}>Tab</kbd> View
            </span>
            <span title="Toggle Active Call-Path Spotlight">
              <kbd style={kbdStyle(isLight)}>s</kbd> Spotlight
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
                <div><kbd style={kbdStyle(isLight)}>v</kbd> / <kbd style={kbdStyle(isLight)}>Tab</kbd> : Cycle DAG ↔ Flame ↔ Macro ↔ Waterfall ↔ Swimlanes</div>
                <div><kbd style={kbdStyle(isLight)}>s</kbd> : Toggle Active Call-Path Spotlight</div>
                <div><kbd style={kbdStyle(isLight)}>b</kbd> : Cycle Granularity (Auto / L1 / L2 / L3 / Off)</div>
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
