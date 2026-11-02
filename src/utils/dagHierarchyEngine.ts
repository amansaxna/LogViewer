/**
 * Hierarchy & Swimlane Analysis Engine for LogViewer DAG & Workflow Inspector
 */

export interface NamespaceHierarchy {
  full: string;
  root: string;
  subsystem: string;
  parentPath: string;
  leaf: string;
  segments: string[];
}

export type ClusterGranularity = 'auto' | 'l1' | 'l2' | 'l3' | 'none';

export interface ClusteringMetadata {
  commonAncestor: string;
  effectiveLevel: number;
  levelName: string;
  granularity: ClusterGranularity;
  totalClusters: number;
}

export interface SubsystemCluster<T> {
  id: string;
  displayName: string;
  root: string;
  subsystem: string;
  color: string;
  items: T[];
  totalDeltaMs: number;
  errorCount: number;
  warnCount: number;
  distinctOperations: string[];
}

export interface ThreadSwimlane<T> {
  threadId: string;
  processId?: string;
  items: T[];
  startTimeMs: number;
  endTimeMs: number;
  totalDurationMs: number;
}

export interface MacroTransitEdge {
  fromClusterId: string;
  toClusterId: string;
  fromName: string;
  toName: string;
  transitDeltaMs: number;
  isHotspot: boolean;
}

export interface MacroGraphData<T> {
  clusters: SubsystemCluster<T>[];
  edges: MacroTransitEdge[];
  totalDurationMs: number;
}

/**
 * Deterministic palette generator for root subsystems and modules
 */
const SUBSYSTEM_PALETTE = [
  { border: '#38bdf8', bg: 'rgba(56, 189, 248, 0.08)', text: '#38bdf8', badge: 'rgba(56, 189, 248, 0.18)' },
  { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.08)', text: '#c084fc', badge: 'rgba(168, 85, 247, 0.18)' },
  { border: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', text: '#34d399', badge: 'rgba(16, 185, 129, 0.18)' },
  { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', text: '#fbbf24', badge: 'rgba(245, 158, 11, 0.18)' },
  { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.08)', text: '#f472b6', badge: 'rgba(236, 72, 153, 0.18)' },
  { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.08)', text: '#22d3ee', badge: 'rgba(6, 182, 212, 0.18)' },
  { border: '#f97316', bg: 'rgba(249, 115, 22, 0.08)', text: '#fb923c', badge: 'rgba(249, 115, 22, 0.18)' },
  { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', text: '#a78bfa', badge: 'rgba(139, 92, 246, 0.18)' },
  { border: '#14b8a6', bg: 'rgba(20, 184, 166, 0.08)', text: '#2dd4bf', badge: 'rgba(20, 184, 166, 0.18)' },
  { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.08)', text: '#818cf8', badge: 'rgba(99, 102, 241, 0.18)' },
];

export function getSubsystemColor(root: string, isLight: boolean = false) {
  let hash = 0;
  for (let i = 0; i < root.length; i++) {
    hash = (hash << 5) - hash + root.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % SUBSYSTEM_PALETTE.length;
  const p = SUBSYSTEM_PALETTE[idx];
  if (isLight) {
    return {
      border: p.border,
      bg: p.bg.replace('0.08', '0.06'),
      text: p.border === '#f59e0b' ? '#b45309' : p.border,
      badge: p.bg.replace('0.08', '0.12'),
    };
  }
  return p;
}

/**
 * Parses deep colon (::) or dot (.) separated namespace paths
 * into structured hierarchy tokens.
 */
export function parseNamespaceHierarchy(rawNamespace?: string): NamespaceHierarchy {
  if (!rawNamespace || !rawNamespace.trim()) {
    return {
      full: 'Core',
      root: 'Core',
      subsystem: 'Core',
      parentPath: '',
      leaf: 'Operation',
      segments: ['Core'],
    };
  }

  const trimmed = rawNamespace.trim();
  const delimiter = trimmed.includes('::') ? '::' : trimmed.includes('.') ? '.' : '';

  if (!delimiter) {
    return {
      full: trimmed,
      root: trimmed,
      subsystem: trimmed,
      parentPath: '',
      leaf: trimmed,
      segments: [trimmed],
    };
  }

  const segments = trimmed.split(delimiter).filter(Boolean);
  const root = segments[0] || trimmed;
  const leaf = segments[segments.length - 1] || trimmed;
  const parentPath = segments.length > 1 ? segments.slice(0, -1).join(' › ') : '';
  const subsystem = segments.length >= 2 ? `${segments[0]} :: ${segments[1]}` : root;

  return {
    full: trimmed,
    root,
    subsystem,
    parentPath,
    leaf,
    segments,
  };
}

/**
 * Computes the longest common prefix of segments shared across all hierarchies.
 */
export function computeCommonNamespacePrefix(hierarchies: NamespaceHierarchy[]): string[] {
  if (!hierarchies.length) return [];
  if (hierarchies.length === 1) {
    const s = hierarchies[0].segments;
    return s.length > 1 ? s.slice(0, -1) : [];
  }

  const first = hierarchies[0].segments;
  let prefixLen = 0;

  for (let idx = 0; idx < first.length; idx++) {
    const seg = first[idx];
    const isUniform = hierarchies.every((h) => h.segments[idx] === seg);
    if (!isUniform) break;
    prefixLen++;
  }

  return first.slice(0, prefixLen);
}

/**
 * Resolves the effective cluster level and common ancestor breadcrumb.
 */
export function resolveEffectiveClusterLevel(
  hierarchies: NamespaceHierarchy[],
  granularity: ClusterGranularity = 'auto'
): { level: number; commonAncestor: string; levelName: string } {
  if (!hierarchies.length) {
    return { level: 0, commonAncestor: '', levelName: 'Subsystem' };
  }

  if (granularity === 'l1') {
    return { level: 0, commonAncestor: '', levelName: 'L1: Domain' };
  }

  if (granularity === 'l2') {
    const commonAncestor = hierarchies[0]?.segments[0] || '';
    return { level: 1, commonAncestor, levelName: 'L2: Module' };
  }

  if (granularity === 'l3') {
    const commonAncestor = hierarchies[0]?.segments.slice(0, 2).join(' › ') || '';
    return { level: 2, commonAncestor, levelName: 'L3: Component' };
  }

  if (granularity === 'none') {
    return { level: 0, commonAncestor: '', levelName: 'Flat' };
  }

  // --- Adaptive Smart LCP Auto-Resolution ---
  const commonPrefix = computeCommonNamespacePrefix(hierarchies);
  const maxSegments = Math.max(...hierarchies.map((h) => h.segments.length));

  if (commonPrefix.length === 0) {
    // Roots are diverse (e.g. Commerce, Security, Billing) -> group by L1
    return { level: 0, commonAncestor: '', levelName: 'Auto: Root Subsystems' };
  }

  // If all nodes share common prefix, step down to the first diverging segment
  let targetLevel = commonPrefix.length;
  // If targetLevel points beyond available segments or is the leaf function, step back one level
  if (targetLevel >= maxSegments) {
    targetLevel = Math.max(0, maxSegments - 2);
  }

  const commonAncestor = commonPrefix.slice(0, targetLevel).join(' › ');
  const levelName = targetLevel === 0
    ? 'Auto: Root Subsystems'
    : targetLevel === 1
    ? 'Auto: Functional Modules'
    : `Auto: Sub-Modules (Depth ${targetLevel + 1})`;

  return {
    level: targetLevel,
    commonAncestor,
    levelName,
  };
}

/**
 * Clusters an array of step items by contiguous subsystem boundaries,
 * supporting adaptive common-prefix trimming and user-selectable granularity.
 */
export function groupNodesIntoSubsystems<
  T extends {
    module: string;
    deltaFromPrevMs: number;
    level?: string;
    operation?: string;
  }
>(
  nodes: T[],
  isLight: boolean = false,
  granularity: ClusterGranularity = 'auto'
): SubsystemCluster<T>[] {
  if (!nodes.length) return [];
  if (granularity === 'none') return [];

  const hierarchies = nodes.map((n) => parseNamespaceHierarchy(n.module));
  const { level: effectiveLevel } = resolveEffectiveClusterLevel(hierarchies, granularity);

  const clusters: SubsystemCluster<T>[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const h = hierarchies[i];

    // Determine cluster key based on effective level
    const clusterSegment = h.segments[effectiveLevel] || (effectiveLevel === 0 ? h.root : h.leaf);
    const lastCluster = clusters[clusters.length - 1];

    const isError = node.level === 'error' || node.level === 'critical' || node.level === 'emergency';
    const isWarn = node.level === 'warning';
    const opName = node.operation || h.leaf;

    if (lastCluster && lastCluster.displayName === clusterSegment) {
      lastCluster.items.push(node);
      lastCluster.totalDeltaMs += node.deltaFromPrevMs || 0;
      if (isError) lastCluster.errorCount++;
      if (isWarn) lastCluster.warnCount++;
      if (opName && !lastCluster.distinctOperations.includes(opName)) {
        lastCluster.distinctOperations.push(opName);
      }
    } else {
      const palette = getSubsystemColor(clusterSegment, isLight);
      clusters.push({
        id: `cluster-${clusterSegment}-${clusters.length}`,
        displayName: clusterSegment,
        root: h.root, // Preserved for backward compatibility
        subsystem: h.subsystem,
        color: palette.border,
        items: [node],
        totalDeltaMs: node.deltaFromPrevMs || 0,
        errorCount: isError ? 1 : 0,
        warnCount: isWarn ? 1 : 0,
        distinctOperations: opName ? [opName] : [],
      });
    }
  }

  return clusters;
}

/**
 * Builds Macro-Graph data containing aggregated module transit cards and latency bridges.
 */
export function buildMacroGraph<
  T extends {
    module: string;
    deltaFromPrevMs: number;
    level?: string;
    operation?: string;
  }
>(clusters: SubsystemCluster<T>[]): MacroGraphData<T> {
  const edges: MacroTransitEdge[] = [];
  let totalDurationMs = 0;

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    totalDurationMs += cluster.totalDeltaMs;

    if (i < clusters.length - 1) {
      const nextCluster = clusters[i + 1];
      const firstNextNode = nextCluster.items[0];
      const transitDeltaMs = firstNextNode?.deltaFromPrevMs || 0;
      totalDurationMs += transitDeltaMs;

      edges.push({
        fromClusterId: cluster.id,
        toClusterId: nextCluster.id,
        fromName: cluster.displayName,
        toName: nextCluster.displayName,
        transitDeltaMs,
        isHotspot: transitDeltaMs >= 100,
      });
    }
  }

  return {
    clusters,
    edges,
    totalDurationMs,
  };
}

/**
 * Groups step items into parallel thread execution swimlanes.
 */
export function groupNodesIntoThreadSwimlanes<
  T extends {
    entry: { tid?: string; pid?: string };
    timestampMs: number;
    deltaFromPrevMs: number;
  }
>(nodes: T[]): ThreadSwimlane<T>[] {
  const laneMap = new Map<string, ThreadSwimlane<T>>();

  for (const node of nodes) {
    const tid = node.entry.tid || 'main_thread';
    const pid = node.entry.pid;
    let lane = laneMap.get(tid);

    if (!lane) {
      lane = {
        threadId: tid,
        processId: pid,
        items: [],
        startTimeMs: node.timestampMs,
        endTimeMs: node.timestampMs,
        totalDurationMs: 0,
      };
      laneMap.set(tid, lane);
    }

    lane.items.push(node);
    if (node.timestampMs < lane.startTimeMs) lane.startTimeMs = node.timestampMs;
    if (node.timestampMs > lane.endTimeMs) lane.endTimeMs = node.timestampMs;
  }

  // Calculate duration per lane
  const lanes = Array.from(laneMap.values());
  for (const lane of lanes) {
    lane.totalDurationMs = Math.max(0, lane.endTimeMs - lane.startTimeMs);
  }

  // Stable sort: earliest starting lane first
  return lanes.sort((a, b) => a.startTimeMs - b.startTimeMs);
}

export interface CallStackFrameInfo {
  callDepth: number;
  parentCallerStepIndex?: number;
  parentCallerOperation?: string;
  parentCallerNamespace?: string;
  isReturnResume: boolean;
  returnedFromStepIndex?: number;
  returnedFromOperation?: string;
}

export interface ActivationStackItem {
  index: number;
  module: string;
  operation: string;
  depth: number;
  namespace: string;
}

/**
 * Reconstitutes the virtual activation call stack from a sequential chronological trace.
 * Detects subroutine descent (call push) and caller resumption (call pop / return).
 */
export function computeCallStackFrames<
  T extends {
    index: number;
    module: string;
    operation: string;
    message?: string;
    level?: string;
    duration?: string;
  }
>(nodes: T[]): Map<number, CallStackFrameInfo> {
  const result = new Map<number, CallStackFrameInfo>();
  if (!nodes.length) return result;

  const stack: ActivationStackItem[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const h = parseNamespaceHierarchy(node.module);
    // Use module/service parent path (or root) so sibling operations inside the same service share the frame
    const contextKey = h.parentPath || h.root || node.module;
    const msg = (node.message || '').toLowerCase();

    const isExplicitExit =
      /\b(exit|exited|exiting|return|returned|returning|completed|complete|finished|done|succeeded)\b/.test(msg) ||
      Boolean(node.duration);

    if (stack.length === 0) {
      // Root frame
      stack.push({
        index: node.index,
        module: contextKey,
        operation: node.operation,
        depth: 0,
        namespace: node.module,
      });
      result.set(node.index, {
        callDepth: 0,
        isReturnResume: false,
      });
      continue;
    }

    const currentTop = stack[stack.length - 1];

    // Check if the current context matches an existing ancestor in the stack
    // e.g. stack = [OrderService, PaymentEngine] and current is OrderService
    const existingIndex = stack.findIndex(
      (frame) => frame.module === contextKey || (contextKey.startsWith(frame.module) && frame.module !== '')
    );

    if (existingIndex !== -1 && existingIndex < stack.length - 1) {
      // Execution has returned back to an earlier caller frame!
      const poppedCallee = stack[stack.length - 1];
      stack.length = existingIndex + 1; // pop callees off the stack

      const activeFrame = stack[existingIndex];
      const parentCaller = existingIndex > 0 ? stack[existingIndex - 1] : undefined;

      result.set(node.index, {
        callDepth: existingIndex,
        isReturnResume: true,
        returnedFromStepIndex: poppedCallee.index,
        returnedFromOperation: poppedCallee.operation,
        parentCallerStepIndex: parentCaller?.index ?? (existingIndex === 0 && activeFrame.index !== node.index ? activeFrame.index : undefined),
        parentCallerOperation: parentCaller?.operation ?? (existingIndex === 0 && activeFrame.index !== node.index ? activeFrame.operation : undefined),
        parentCallerNamespace: parentCaller?.namespace ?? (existingIndex === 0 && activeFrame.index !== node.index ? activeFrame.namespace : undefined),
      });

      // Update active frame to latest step
      activeFrame.index = node.index;
      activeFrame.operation = node.operation;
    } else if (existingIndex === stack.length - 1) {
      // Continuing inside the same active frame
      const parentCaller = stack.length > 1 ? stack[stack.length - 2] : undefined;
      result.set(node.index, {
        callDepth: stack.length - 1,
        isReturnResume: false,
        parentCallerStepIndex: parentCaller?.index ?? (stack.length === 1 && currentTop.index !== node.index ? currentTop.index : undefined),
        parentCallerOperation: parentCaller?.operation ?? (stack.length === 1 && currentTop.index !== node.index ? currentTop.operation : undefined),
        parentCallerNamespace: parentCaller?.namespace ?? (stack.length === 1 && currentTop.index !== node.index ? currentTop.namespace : undefined),
      });

      // Update top frame to latest step
      currentTop.index = node.index;
      currentTop.operation = node.operation;

      if (isExplicitExit && stack.length > 1) {
        stack.pop();
      }
    } else {
      // New nested subroutine call pushed onto the stack
      const depth = stack.length;
      const caller = currentTop;

      stack.push({
        index: node.index,
        module: contextKey,
        operation: node.operation,
        depth,
        namespace: node.module,
      });

      result.set(node.index, {
        callDepth: depth,
        isReturnResume: false,
        parentCallerStepIndex: caller.index,
        parentCallerOperation: caller.operation,
        parentCallerNamespace: caller.namespace,
      });

      if (isExplicitExit && stack.length > 1) {
        stack.pop();
      }
    }
  }

  return result;
}
