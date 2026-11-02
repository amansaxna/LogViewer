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

export interface SubsystemCluster<T> {
  id: string;
  root: string;
  subsystem: string;
  color: string;
  items: T[];
  totalDeltaMs: number;
}

export interface ThreadSwimlane<T> {
  threadId: string;
  processId?: string;
  items: T[];
  startTimeMs: number;
  endTimeMs: number;
  totalDurationMs: number;
}

/**
 * Deterministic palette generator for root subsystems
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
 * Clusters an array of step items by contiguous root subsystem boundaries.
 */
export function groupNodesIntoSubsystems<T extends { module: string; deltaFromPrevMs: number }>(
  nodes: T[],
  isLight: boolean = false
): SubsystemCluster<T>[] {
  const clusters: SubsystemCluster<T>[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const h = parseNamespaceHierarchy(node.module);
    const lastCluster = clusters[clusters.length - 1];

    if (lastCluster && lastCluster.root === h.root) {
      lastCluster.items.push(node);
      lastCluster.totalDeltaMs += node.deltaFromPrevMs || 0;
    } else {
      const palette = getSubsystemColor(h.root, isLight);
      clusters.push({
        id: `cluster-${h.root}-${clusters.length}`,
        root: h.root,
        subsystem: h.subsystem,
        color: palette.border,
        items: [node],
        totalDeltaMs: node.deltaFromPrevMs || 0,
      });
    }
  }

  return clusters;
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
