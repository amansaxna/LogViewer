import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Repeat,
  ChevronDown,
  ChevronUp,
  X,
  Flame,
  AlertTriangle,
  GitMerge,
  GripHorizontal,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  computeGroupTransitions,
  GroupTransitionsData,
  GroupNodeInfo,
} from '../utils/dagHierarchyEngine.ts';

interface StepNodeItem {
  index: number;
  module: string;
  operation: string;
  level?: string;
  deltaFromPrevMs?: number;
  isHotspot?: boolean;
  hasTrace?: boolean;
  hierarchy?: any;
}

interface GroupTransitionsGraphProps {
  nodes: StepNodeItem[];
  selectedStepIndex: number;
  onSelectStep: (stepIndex: number) => void;
  isLight?: boolean;
  onClose?: () => void;
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(1);
  return `${mins}m ${secs}s`;
}

export const GroupTransitionsGraph: React.FC<GroupTransitionsGraphProps> = ({
  nodes,
  selectedStepIndex,
  onSelectStep,
  isLight = false,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 0.5x, 1x, 2x
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);

  // Compute graph data & transitions
  const graphData: GroupTransitionsData = useMemo(() => {
    return computeGroupTransitions(nodes, isLight);
  }, [nodes, isLight]);

  const { groups, transitions, totalSteps } = graphData;

  // Active step index within [0, totalSteps - 1]
  const currentStep = Math.max(0, Math.min(selectedStepIndex, totalSteps - 1));
  const activeTransition = transitions[currentStep] || transitions[0];

  const currentStepRef = useRef(currentStep);
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Auto-play interval effect
  useEffect(() => {
    if (!isPlaying || totalSteps <= 1) return;

    const intervalMs = Math.round(850 / playbackSpeed);
    const timer = setInterval(() => {
      const next = currentStepRef.current + 1;
      if (next >= totalSteps) {
        if (isLooping) {
          onSelectStep(0);
        } else {
          setIsPlaying(false);
        }
      } else {
        onSelectStep(next);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, isLooping, totalSteps, onSelectStep]);

  // Compute 2D coordinates for group nodes inside SVG (viewBox: 0 0 360 145)
  const groupCoords = useMemo(() => {
    const coords = new Map<string, { x: number; y: number; group: GroupNodeInfo }>();
    const count = groups.length;
    if (count === 0) return coords;

    if (count === 1) {
      coords.set(groups[0].name, { x: 180, y: 70, group: groups[0] });
    } else if (count === 2) {
      coords.set(groups[0].name, { x: 95, y: 70, group: groups[0] });
      coords.set(groups[1].name, { x: 265, y: 70, group: groups[1] });
    } else if (count === 3) {
      coords.set(groups[0].name, { x: 105, y: 46, group: groups[0] });
      coords.set(groups[1].name, { x: 255, y: 46, group: groups[1] });
      coords.set(groups[2].name, { x: 180, y: 112, group: groups[2] });
    } else if (count === 4) {
      coords.set(groups[0].name, { x: 80, y: 70, group: groups[0] });
      coords.set(groups[1].name, { x: 180, y: 38, group: groups[1] });
      coords.set(groups[2].name, { x: 280, y: 70, group: groups[2] });
      coords.set(groups[3].name, { x: 180, y: 110, group: groups[3] });
    } else {
      // 5+ groups arranged around an ellipse
      const cx = 180;
      const cy = 72;
      const rx = 120;
      const ry = 44;
      for (let i = 0; i < count; i++) {
        const theta = -Math.PI / 2 + (2 * Math.PI * i) / count;
        const x = Math.round(cx + rx * Math.cos(theta));
        const y = Math.round(cy + ry * Math.sin(theta));
        coords.set(groups[i].name, { x, y, group: groups[i] });
      }
    }

    return coords;
  }, [groups]);

  // Compute curved paths for transition edges
  const edgePaths = useMemo(() => {
    return graphData.edges.map((edge) => {
      const fromCoord = groupCoords.get(edge.fromGroup);
      const toCoord = groupCoords.get(edge.toGroup);
      if (!fromCoord || !toCoord) return null;

      if (edge.isSelfLoop) {
        // Self loop arc above the node
        const { x, y } = fromCoord;
        const pathD = `M ${x - 8} ${y - 12} C ${x - 24} ${y - 36}, ${x + 24} ${y - 36}, ${x + 8} ${y - 12}`;
        return {
          edge,
          pathD,
          isSelfLoop: true,
          fromCoord,
          toCoord,
        };
      }

      // Curved quadratic bezier arc between distinct groups
      const { x: x1, y: y1 } = fromCoord;
      const { x: x2, y: y2 } = toCoord;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const curvature = Math.min(26, dist * 0.22);
      const nx = -dy / dist;
      const ny = dx / dist;
      const cx = (x1 + x2) / 2 + nx * curvature;
      const cy = (y1 + y2) / 2 + ny * curvature;
      const pathD = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

      return {
        edge,
        pathD,
        isSelfLoop: false,
        fromCoord,
        toCoord,
      };
    }).filter(Boolean);
  }, [graphData.edges, groupCoords]);

  // Determine active transition path
  const activeEdgeInfo = useMemo(() => {
    if (!activeTransition) return null;
    const { fromGroup, toGroup } = activeTransition;
    const fromCoord = groupCoords.get(fromGroup);
    const toCoord = groupCoords.get(toGroup);
    if (!fromCoord || !toCoord) return null;

    if (fromGroup === toGroup) {
      const { x, y } = fromCoord;
      return {
        pathD: `M ${x - 8} ${y - 12} C ${x - 24} ${y - 36}, ${x + 24} ${y - 36}, ${x + 8} ${y - 12}`,
        color: fromCoord.group.color.border,
      };
    }

    const { x: x1, y: y1 } = fromCoord;
    const { x: x2, y: y2 } = toCoord;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const curvature = Math.min(26, dist * 0.22);
    const nx = -dy / dist;
    const ny = dx / dist;
    const cx = (x1 + x2) / 2 + nx * curvature;
    const cy = (y1 + y2) / 2 + ny * curvature;

    return {
      pathD: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
      color: toCoord.group.color.border,
    };
  }, [activeTransition, groupCoords]);

  if (totalSteps === 0) return null;

  // Render Collapsed Mini-Pill Mode
  if (isCollapsed) {
    return (
      <div
        className="hud-drag-handle"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(15, 20, 28, 0.94)',
          backdropFilter: 'blur(10px)',
          border: isLight ? '1px solid #ded7ca' : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 20,
          boxShadow: isLight
            ? '0 4px 16px rgba(0, 0, 0, 0.08)'
            : '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 12px rgba(56, 189, 248, 0.15)',
          fontSize: '0.72rem',
          fontFamily: 'var(--font-mono, monospace)',
          cursor: 'grab',
          userSelect: 'none',
        }}
        onClick={() => setIsCollapsed(false)}
        title="Click to expand (or drag to reposition)"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsPlaying((p) => !p);
          }}
          style={{
            border: 'none',
            background: isPlaying ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
            color: isPlaying ? '#ef4444' : '#38bdf8',
            padding: 3,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isPlaying ? <Pause size={10} /> : <Play size={10} />}
        </button>

        <span style={{ fontWeight: 700, color: isLight ? '#0369a1' : '#38bdf8' }}>
          GROUP FLOW
        </span>

        <span style={{ color: isLight ? '#78716c' : '#94a3b8' }}>
          Step {currentStep + 1}/{totalSteps}:
        </span>

        <span style={{ fontWeight: 600, color: isLight ? '#1c1917' : '#f1f5f9' }}>
          {activeTransition ? `${activeTransition.fromGroup} ➔ ${activeTransition.toGroup}` : 'Transition'}
        </span>

        <ChevronDown size={12} style={{ color: isLight ? '#78716c' : '#94a3b8', marginLeft: 2 }} />
      </div>
    );
  }

  // Render Full Interactive Animated Graph Card
  return (
    <div
      style={{
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 20, 28, 0.94)',
        backdropFilter: 'blur(12px)',
        border: isLight ? '1px solid #ded7ca' : '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 12,
        boxShadow: isLight
          ? '0 6px 24px rgba(0, 0, 0, 0.08)'
          : '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.12)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: 390,
        userSelect: 'none',
      }}
    >
      {/* HUD Header (Draggable Handle) */}
      <div
        className="hud-drag-handle"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: isLight ? '1px solid #ded7ca' : '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: 8,
          cursor: 'grab',
        }}
        title="Click and drag anywhere on this header to reposition HUD"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              padding: 4,
              borderRadius: 6,
              backgroundColor: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(56, 189, 248, 0.15)',
              color: isLight ? '#0284c7' : '#38bdf8',
              display: 'flex',
            }}
          >
            <GitMerge size={12} />
          </div>
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: isLight ? '#1c1917' : '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>GROUP TRANSITIONS</span>
              <GripHorizontal size={12} style={{ opacity: 0.45 }} />
              <span
                style={{
                  fontSize: '0.60rem',
                  padding: '1px 5px',
                  borderRadius: 3,
                  backgroundColor: isPlaying
                    ? (isLight ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.2)')
                    : (isLight ? '#eae4d8' : '#1e2430'),
                  color: isPlaying ? (isLight ? '#15803d' : '#4ade80') : (isLight ? '#78716c' : '#94a3b8'),
                  fontWeight: 700,
                }}
              >
                {isPlaying ? 'ANIMATING' : 'PAUSED'}
              </span>
            </div>
            <div style={{ fontSize: '0.62rem', color: isLight ? '#78716c' : '#8b949e' }}>
              Step {currentStep + 1} of {totalSteps} • {groups.length} distinct groups
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Collapse Button */}
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            style={{
              border: 'none',
              background: 'transparent',
              color: isLight ? '#78716c' : '#8b949e',
              padding: 3,
              cursor: 'pointer',
              borderRadius: 4,
              display: 'flex',
            }}
            title="Minimize to compact floating badge"
          >
            <ChevronUp size={13} />
          </button>

          {/* Close HUD */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                border: 'none',
                background: 'transparent',
                color: isLight ? '#78716c' : '#8b949e',
                padding: 3,
                cursor: 'pointer',
                borderRadius: 4,
                display: 'flex',
              }}
              title="Close Group Transitions Graph"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* SVG Canvas Visualizing Groups & Animated Directed Transitions */}
      <div
        style={{
          width: '100%',
          height: 145,
          position: 'relative',
          backgroundColor: isLight ? '#faf8f5' : '#0a0d13',
          borderRadius: 8,
          border: isLight ? '1px solid #ded7ca' : '1px solid rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
        }}
      >
        <svg
          width="100%"
          height="145"
          viewBox="0 0 360 145"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            {/* Soft Glow Filter */}
            <filter id="glow-neon" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Directed Arrow Marker for Transition Edges */}
            <marker
              id="trans-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="4"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 6 3, 0 6" fill={isLight ? '#0284c7' : '#38bdf8'} />
            </marker>

            <marker
              id="trans-arrow-subtle"
              markerWidth="5"
              markerHeight="5"
              refX="4"
              refY="2.5"
              orient="auto"
            >
              <polygon points="0 0, 5 2.5, 0 5" fill={isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.18)'} />
            </marker>
          </defs>

          {/* Background Grid Pattern Dots */}
          <pattern id="grid-dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)'} />
          </pattern>
          <rect width="360" height="145" fill="url(#grid-dots)" />

          {/* Static Background Transition Edges */}
          {edgePaths.map((ep, i) => {
            if (!ep) return null;
            return (
              <path
                key={`base-edge-${i}`}
                d={ep.pathD}
                fill="none"
                stroke={isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.14)'}
                strokeWidth="1.2"
                strokeDasharray={ep.isSelfLoop ? '3 2' : 'none'}
                markerEnd="url(#trans-arrow-subtle)"
              />
            );
          })}

          {/* Active Highlighted Transition Edge with Glowing Animated Particle */}
          {activeEdgeInfo && (
            <>
              {/* Active Path Glow Halo */}
              <path
                d={activeEdgeInfo.pathD}
                fill="none"
                stroke={activeEdgeInfo.color}
                strokeWidth="3.2"
                strokeOpacity="0.45"
                filter="url(#glow-neon)"
              />

              {/* Active Path Solid Core */}
              <path
                d={activeEdgeInfo.pathD}
                fill="none"
                stroke={activeEdgeInfo.color}
                strokeWidth="2.2"
                markerEnd="url(#trans-arrow)"
              />

              {/* Travelling Animated Laser Particle flowing along the active transition curve */}
              <circle r="4" fill={activeEdgeInfo.color} filter="url(#glow-neon)">
                <animateMotion
                  path={activeEdgeInfo.pathD}
                  dur={`${Math.max(0.4, 0.85 / playbackSpeed)}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </>
          )}

          {/* Group Nodes */}
          {Array.from(groupCoords.values()).map(({ x, y, group }) => {
            const isActive = activeTransition?.toGroup === group.name;
            const isSource = activeTransition?.fromGroup === group.name;
            const nodeColor = group.color.border;

            return (
              <g
                key={group.id}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  // Jump to first step in this group
                  const targetStep = transitions.find((t) => t.toGroup === group.name);
                  if (targetStep) onSelectStep(targetStep.stepIndex);
                }}
              >
                {/* Active Radiating Ripple Wave */}
                {isActive && (
                  <circle
                    cx={x}
                    cy={y}
                    r="16"
                    fill="none"
                    stroke={nodeColor}
                    strokeWidth="1.5"
                    opacity="0.8"
                  >
                    <animate
                      attributeName="r"
                      values="16;28"
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.8;0"
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Node Outer Ring */}
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 16 : 14}
                  fill={isLight ? '#ffffff' : '#141820'}
                  stroke={nodeColor}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  filter={isActive ? 'url(#glow-neon)' : 'none'}
                />

                {/* Node Text: Initials */}
                <text
                  x={x}
                  y={y + 3.5}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="800"
                  fontFamily="var(--font-mono, monospace)"
                  fill={nodeColor}
                >
                  {group.initials}
                </text>

                {/* Group Name Label Below Node */}
                <text
                  x={x}
                  y={y + 24}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight={isActive ? '700' : '500'}
                  fontFamily="var(--font-mono, monospace)"
                  fill={isActive ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? '#57534e' : '#94a3b8')}
                >
                  {group.name.length > 10 ? `${group.name.slice(0, 9)}…` : group.name}
                  <title>{group.name} ({group.stepCount} steps)</title>
                </text>

                {/* Error Dot Indicator if Group contains errors */}
                {group.hasError && (
                  <circle
                    cx={x + 11}
                    cy={y - 9}
                    r="3.5"
                    fill="#ef4444"
                    stroke={isLight ? '#ffffff' : '#0e1117'}
                    strokeWidth="1.2"
                  >
                    <title>Group has logged errors</title>
                  </circle>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Current Transition Readout Pill */}
      {activeTransition && (
        <div
          style={{
            backgroundColor: isLight ? '#f4f1ea' : '#141820',
            border: isLight ? '1px solid #ded7ca' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 7,
            padding: '7px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: '0.68rem',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span
                style={{
                  fontWeight: 800,
                  color: isLight ? '#0284c7' : '#38bdf8',
                  backgroundColor: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(56, 189, 248, 0.15)',
                  padding: '1px 5px',
                  borderRadius: 3,
                }}
              >
                STEP {String(currentStep + 1).padStart(2, '0')}
              </span>

              <span
                style={{
                  color: isLight ? '#1c1917' : '#f1f5f9',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={`${activeTransition.fromGroup} ➔ ${activeTransition.toGroup}`}
              >
                {activeTransition.fromGroup}
                <span style={{ color: isLight ? '#0284c7' : '#38bdf8', margin: '0 4px' }}>➔</span>
                {activeTransition.toGroup}
              </span>
            </div>

            <span style={{ color: isLight ? '#78716c' : '#94a3b8', whiteSpace: 'nowrap' }}>
              +{formatDuration(activeTransition.deltaFromPrevMs)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span
              style={{
                color: isLight ? '#57534e' : '#94a3b8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={activeTransition.operation}
            >
              op: {activeTransition.operation}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {activeTransition.isHotspot && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    color: '#f97316',
                    fontSize: '0.60rem',
                    fontWeight: 700,
                  }}
                  title="Bottleneck Hotspot Step"
                >
                  <Flame size={10} />
                  <span>HOTSPOT</span>
                </span>
              )}
              {activeTransition.level === 'error' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    color: '#ef4444',
                    fontSize: '0.60rem',
                    fontWeight: 700,
                  }}
                >
                  <AlertTriangle size={10} />
                  <span>ERR</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step Ribbon Scrubber (Dots from Step 1 to Last) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.62rem',
            color: isLight ? '#78716c' : '#8b949e',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          <span>Step 1</span>
          <span>Scrub Trace Timeline</span>
          <span>Step {totalSteps}</span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: totalSteps > 30 ? 2 : 4,
            padding: '5px 4px',
            backgroundColor: isLight ? '#eae4d8' : '#0c0f15',
            borderRadius: 6,
            overflowX: 'auto',
          }}
        >
          {transitions.map((t, idx) => {
            const isCurr = idx === currentStep;
            const grp = groupCoords.get(t.toGroup);
            const dotColor = grp ? grp.group.color.border : '#38bdf8';
            const isErr = t.level === 'error' || t.level === 'critical';

            return (
              <button
                key={`dot-${idx}`}
                type="button"
                onClick={() => onSelectStep(t.stepIndex)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                title={`Step ${idx + 1}: ${t.operation} (${t.toGroup})`}
              >
                <div
                  style={{
                    width: isCurr ? 10 : 6,
                    height: isCurr ? 10 : 6,
                    borderRadius: '50%',
                    backgroundColor: isErr ? '#ef4444' : dotColor,
                    boxShadow: isCurr
                      ? `0 0 0 2px ${isLight ? '#ffffff' : '#0f1217'}, 0 0 8px ${dotColor}`
                      : 'none',
                    transform: isCurr ? 'scale(1.2)' : 'none',
                    transition: 'transform 120ms ease, width 120ms ease, height 120ms ease',
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Playback Controls Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: isLight ? '1px solid #ded7ca' : '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: 8,
        }}
      >
        {/* Playback Navigation Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {/* Rewind to Step 1 */}
          <button
            type="button"
            onClick={() => onSelectStep(0)}
            style={{
              border: isLight ? '1px solid #ded7ca' : '1px solid #232832',
              backgroundColor: isLight ? '#eae4d8' : '#12151c',
              color: isLight ? '#57534e' : '#94a3b8',
              padding: 5,
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
            }}
            title="Rewind to Step 1"
          >
            <RotateCcw size={11} />
          </button>

          {/* Previous Step */}
          <button
            type="button"
            onClick={() => onSelectStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            style={{
              border: isLight ? '1px solid #ded7ca' : '1px solid #232832',
              backgroundColor: isLight ? '#eae4d8' : '#12151c',
              color: isLight ? '#57534e' : '#94a3b8',
              padding: 5,
              borderRadius: 4,
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              opacity: currentStep === 0 ? 0.4 : 1,
              display: 'flex',
            }}
            title="Step Backward"
          >
            <SkipBack size={11} />
          </button>

          {/* Play / Pause Toggle */}
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            style={{
              border: 'none',
              backgroundColor: isPlaying
                ? (isLight ? '#dc2626' : '#ef4444')
                : (isLight ? '#0284c7' : '#3b82f6'),
              color: '#ffffff',
              padding: '5px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.68rem',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title={isPlaying ? 'Pause Animation' : 'Play Transitions 1 -> Last'}
          >
            {isPlaying ? <Pause size={11} /> : <Play size={11} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          {/* Next Step */}
          <button
            type="button"
            onClick={() => onSelectStep(Math.min(totalSteps - 1, currentStep + 1))}
            disabled={currentStep === totalSteps - 1}
            style={{
              border: isLight ? '1px solid #ded7ca' : '1px solid #232832',
              backgroundColor: isLight ? '#eae4d8' : '#12151c',
              color: isLight ? '#57534e' : '#94a3b8',
              padding: 5,
              borderRadius: 4,
              cursor: currentStep === totalSteps - 1 ? 'not-allowed' : 'pointer',
              opacity: currentStep === totalSteps - 1 ? 0.4 : 1,
              display: 'flex',
            }}
            title="Step Forward"
          >
            <SkipForward size={11} />
          </button>

          {/* Loop Toggle */}
          <button
            type="button"
            onClick={() => setIsLooping((l) => !l)}
            style={{
              border: isLooping
                ? (isLight ? '1px solid #0284c7' : '1px solid #3b82f6')
                : (isLight ? '1px solid #ded7ca' : '1px solid #232832'),
              backgroundColor: isLooping
                ? (isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(59, 130, 246, 0.15)')
                : (isLight ? '#eae4d8' : '#12151c'),
              color: isLooping
                ? (isLight ? '#0284c7' : '#60a5fa')
                : (isLight ? '#78716c' : '#8b949e'),
              padding: 5,
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
            }}
            title={isLooping ? 'Looping Enabled' : 'Looping Disabled'}
          >
            <Repeat size={11} />
          </button>
        </div>

        {/* Speed Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {[0.5, 1, 2].map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => setPlaybackSpeed(spd)}
              style={{
                border: 'none',
                background: playbackSpeed === spd
                  ? (isLight ? '#0284c7' : '#3b82f6')
                  : (isLight ? '#eae4d8' : '#12151c'),
                color: playbackSpeed === spd
                  ? '#ffffff'
                  : (isLight ? '#78716c' : '#8b949e'),
                fontSize: '0.62rem',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: playbackSpeed === spd ? 700 : 500,
                padding: '2px 5px',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
