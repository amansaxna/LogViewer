import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Terminal,
  ArrowUpRight,
  Layers,
  Clock,
  SlidersHorizontal,
  Cpu,
  Keyboard,
  Play,
  Pause,
  Search,
  Copy,
  Check,
  ChevronDown,
  Code2,
  Sparkles
} from 'lucide-react';
import '../landing.css';

interface LandingPageProps {
  onLaunchApp: () => void;
}

interface DemoLogEntry {
  line: number;
  timestamp: string;
  epochMs: number;
  pid: string;
  tid: string;
  corr: string;
  namespace: string;
  workflow: string;
  op: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'AUDIT' | 'DEBUG';
  duration: string;
  message: string;
  payloadType?: 'JSON' | 'XML';
  payloadRaw?: string;
  file: string;
  source: string;
  sourceColor: string;
}

const SCENARIOS: {
  id: string;
  title: string;
  sourceBreadcrumb: string;
  rateNow: number;
  rateAvg: number;
  logs: DemoLogEntry[];
}[] = [
  {
    id: 'checkout-spike',
    title: 'app_workflow.log',
    sourceBreadcrumb: 'app_workflow.log',
    rateNow: 1420,
    rateAvg: 890,
    logs: [
      {
        line: 101,
        timestamp: '2026-10-27T18:10:00.000Z',
        epochMs: 1793124600000,
        pid: '2048',
        tid: 'MainThread',
        corr: 'corr-99214-ax',
        namespace: 'PaymentGateway',
        workflow: 'WF:Checkout',
        op: 'POST /v1/authorize',
        level: 'INFO',
        duration: '18ms',
        message: 'Initiating idempotent ledger reservation merchant_id=m_8821',
        file: 'authorize.ts:44',
        source: 'app_workflow.log',
        sourceColor: '#3b82f6',
      },
      {
        line: 102,
        timestamp: '2026-10-27T18:10:01.420Z',
        epochMs: 1793124601420,
        pid: '2048',
        tid: 'Worker-04',
        corr: 'corr-99214-ax',
        namespace: 'RiskEngine',
        workflow: 'WF:Checkout',
        op: 'ExecuteRuleSet',
        level: 'AUDIT',
        duration: '64ms',
        message: 'Velocity rule evaluation {"score":12,"decision":"ALLOW","region":"eu-central-1"}',
        payloadType: 'JSON',
        payloadRaw: '{\n  "score": 12,\n  "decision": "ALLOW",\n  "region": "eu-central-1"\n}',
        file: 'riskEvaluator.ts:119',
        source: 'app_workflow.log',
        sourceColor: '#3b82f6',
      },
      {
        line: 103,
        timestamp: '2026-10-27T18:10:04.110Z',
        epochMs: 1793124604110,
        pid: '2048',
        tid: 'Worker-04',
        corr: 'corr-99214-ax',
        namespace: 'PgPoolCluster',
        workflow: 'WF:Checkout',
        op: 'AcquireConn',
        level: 'WARN',
        duration: '2690ms',
        message: 'Pool saturation (active=48/50) on postgres://replica-02:5432',
        file: 'poolManager.ts:207',
        source: 'app_workflow.log',
        sourceColor: '#3b82f6',
      },
      {
        line: 104,
        timestamp: '2026-10-27T18:10:09.000Z',
        epochMs: 1793124609000,
        pid: '2048',
        tid: 'Worker-04',
        corr: 'corr-99214-ax',
        namespace: 'PaymentGateway',
        workflow: 'WF:Checkout',
        op: 'POST /v1/charge',
        level: 'ERROR',
        duration: '4890ms',
        message: 'Upstream settlement socket timeout {"code":"ERR_UPSTREAM_TIMEOUT","attempt":3}',
        payloadType: 'JSON',
        payloadRaw: '{\n  "code": "ERR_UPSTREAM_TIMEOUT",\n  "retryable": true,\n  "attempt": 3\n}',
        file: 'chargeController.ts:188',
        source: 'app_workflow.log',
        sourceColor: '#3b82f6',
      },
      {
        line: 105,
        timestamp: '2026-10-27T18:10:09.125Z',
        epochMs: 1793124609125,
        pid: '2048',
        tid: 'RecoveryWorker',
        corr: 'corr-99214-ax',
        namespace: 'OutboxDispatcher',
        workflow: 'WF:Compensation',
        op: 'EnqueueRollback',
        level: 'INFO',
        duration: '12ms',
        message: 'Scheduled reversal transition for corr-99214-ax',
        file: 'outbox.ts:91',
        source: 'app_workflow.log',
        sourceColor: '#3b82f6',
      },
    ],
  },
  {
    id: 'xml-audit',
    title: 'service_audit.xml',
    sourceBreadcrumb: 'service_audit.xml',
    rateNow: 610,
    rateAvg: 540,
    logs: [
      {
        line: 401,
        timestamp: '2026-10-27T19:02:10.000Z',
        epochMs: 1793127730000,
        pid: '9102',
        tid: 'AuthWorker-1',
        corr: 'corr-77401-zp',
        namespace: 'SamlFederation',
        workflow: 'WF:SSOHandshake',
        op: 'POST /sso/acs',
        level: 'AUDIT',
        duration: '31ms',
        message: 'Signed SAMLAssertion <Assertion ID="_8f92a"><Status Value="Success"/></Assertion>',
        payloadType: 'XML',
        payloadRaw: '<Assertion ID="_8f92a">\n  <Issuer>idp.corp.internal</Issuer>\n  <Status Value="Success" />\n</Assertion>',
        file: 'samlVerifier.ts:82',
        source: 'service_audit.xml',
        sourceColor: '#a78bfa',
      },
      {
        line: 402,
        timestamp: '2026-10-27T19:02:10.180Z',
        epochMs: 1793127730180,
        pid: '9102',
        tid: 'AuthWorker-1',
        corr: 'corr-77401-zp',
        namespace: 'KeyVaultClient',
        workflow: 'WF:SSOHandshake',
        op: 'VerifySignature',
        level: 'WARN',
        duration: '148ms',
        message: 'Certificate thumbprint sha256:9f8e...21b0 expires in < 72h',
        file: 'certStore.ts:154',
        source: 'service_audit.xml',
        sourceColor: '#a78bfa',
      },
      {
        line: 403,
        timestamp: '2026-10-27T19:02:10.640Z',
        epochMs: 1793127730640,
        pid: '9102',
        tid: 'AuthWorker-1',
        corr: 'corr-77401-zp',
        namespace: 'SessionAuthority',
        workflow: 'WF:TokenMint',
        op: 'IssueJWT',
        level: 'INFO',
        duration: '9ms',
        message: 'Minted short-lived session token scope=cluster:admin ttl=3600s',
        file: 'tokenMint.ts:63',
        source: 'service_audit.xml',
        sourceColor: '#a78bfa',
      },
    ],
  },
  {
    id: 'kway-merge',
    title: 'Unified Stream (3)',
    sourceBreadcrumb: 'Unified Stream (3 sources)',
    rateNow: 2840,
    rateAvg: 2110,
    logs: [
      {
        line: 1,
        timestamp: '2026-10-27T20:15:00.010Z',
        epochMs: 1793132100010,
        pid: '1104',
        tid: 'EdgeIngress',
        corr: 'corr-55109-km',
        namespace: 'EnvoyGateway',
        workflow: 'WF:EdgeRoute',
        op: 'GET /api/v2/ledger',
        level: 'INFO',
        duration: '4ms',
        message: 'Forwarded ingress request to ledger-service-grpc',
        file: 'router.ts:39',
        source: 'ingress_edge.log',
        sourceColor: '#34d399',
      },
      {
        line: 2,
        timestamp: '2026-10-27T20:15:00.095Z',
        epochMs: 1793132100095,
        pid: '4420',
        tid: 'GrpcWorker-7',
        corr: 'corr-55109-km',
        namespace: 'LedgerCore',
        workflow: 'WF:QuerySnapshot',
        op: 'ReadCommitted',
        level: 'WARN',
        duration: '81ms',
        message: 'Read replica lag detected (lsn_delta=14.2MB), routing primary',
        file: 'snapshotReader.ts:142',
        source: 'ledger_core.json',
        sourceColor: '#3b82f6',
      },
      {
        line: 3,
        timestamp: '2026-10-27T20:15:00.410Z',
        epochMs: 1793132100410,
        pid: '8819',
        tid: 'AuditSink',
        corr: 'corr-55109-km',
        namespace: 'ComplianceSink',
        workflow: 'WF:AuditTrail',
        op: 'AppendImmutable',
        level: 'AUDIT',
        duration: '11ms',
        message: 'Committed trace digest {"corr":"corr-55109-km","status":"VERIFIED"}',
        payloadType: 'JSON',
        payloadRaw: '{\n  "corr": "corr-55109-km",\n  "spans": 3,\n  "status": "VERIFIED"\n}',
        file: 'auditSink.ts:77',
        source: 'service_audit.xml',
        sourceColor: '#a78bfa',
      },
    ],
  },
];

const LIVE_TAIL_POOL: Omit<DemoLogEntry, 'line' | 'epochMs'>[] = [
  {
    timestamp: '2026-10-27T18:10:09.450Z',
    pid: '2048',
    tid: 'Worker-06',
    corr: 'corr-99214-ax',
    namespace: 'CircuitBreaker',
    workflow: 'WF:Checkout',
    op: 'TripHalfOpen',
    level: 'WARN',
    duration: '5ms',
    message: 'Upstream settlement-core entered HALF_OPEN (err=18.4%)',
    file: 'breaker.ts:112',
    source: 'app_workflow.log',
    sourceColor: '#3b82f6',
  },
  {
    timestamp: '2026-10-27T18:10:09.890Z',
    pid: '2048',
    tid: 'Worker-02',
    corr: 'corr-99214-ax',
    namespace: 'PaymentGateway',
    workflow: 'WF:Checkout',
    op: 'POST /v1/charge',
    level: 'AUDIT',
    duration: '42ms',
    message: 'Failover settlement captured {"gateway":"stripe_eu_2","status":"OK"}',
    payloadType: 'JSON',
    payloadRaw: '{\n  "gateway": "stripe_eu_2",\n  "status": "OK",\n  "latency_ms": 42\n}',
    file: 'chargeController.ts:214',
    source: 'app_workflow.log',
    sourceColor: '#3b82f6',
  },
];

const TOKEN_ANATOMY = [
  { id: 'datetime', label: 'Datetime', tokenVar: '--tok-datetime', hex: '#8b949e', raw: '[18:10:09.000Z]', stripped: '18:10:09.000Z' },
  { id: 'pid', label: 'PID / TID', tokenVar: '--tok-pid', hex: '#64748b', raw: '[2048] [Worker-04]', stripped: '2048 Worker-04' },
  { id: 'corr', label: 'Correlation', tokenVar: '--tok-corr', hex: '#34d399', raw: '[corr-99214-ax]', stripped: 'corr-99214-ax' },
  { id: 'namespace', label: 'Namespace', tokenVar: '--tok-namespace', hex: '#60a5fa', raw: '[PaymentGateway]', stripped: 'PaymentGateway' },
  { id: 'workflow', label: 'Workflow', tokenVar: '--tok-workflow', hex: '#a78bfa', raw: '[WF:Checkout]', stripped: 'WF:Checkout' },
  { id: 'operation', label: 'Operation', tokenVar: '--tok-op-http', hex: '#f59e0b', raw: '[POST /v1/charge]', stripped: 'POST /v1/charge' },
  { id: 'status', label: 'Severity', tokenVar: '--tok-status-error', hex: '#f87171', raw: '[ERROR]', stripped: 'ERROR' },
  { id: 'duration', label: 'Duration', tokenVar: '--tok-duration', hex: '#eab308', raw: '[4890ms]', stripped: '4890ms' },
];

const SEVEN_STORY_LAYERS = [
  { idx: '01', short: 'K-Way Merge', file: 'server/fileReader.ts', metric: '2,840/s MERGED', color: '#34d399' },
  { idx: '02', short: 'Bracket Tokenizer', file: 'server/parser.ts', metric: '10 TOKENS · 0 SCHEMA', color: '#60a5fa' },
  { idx: '03', short: '3-Tier Facets', file: 'src/components/Topbar.tsx', metric: '10 LEVELS + (-) NOT', color: '#a78bfa' },
  { idx: '04', short: 'AST Inspector', file: 'JsonXmlInspectorModal.tsx', metric: 'JSON · XML · URI', color: '#38bdf8' },
  { idx: '05', short: 'Range Delta Δt', file: 'DeltaTimeToolbar.tsx', metric: 'AUTO T1 → T2 MS', color: '#f59e0b' },
  { idx: '06', short: 'Presets & Compact', file: 'CompactLogRow.tsx', metric: '1-LINE · 0px IDLE', color: '#4ade80' },
  { idx: '07', short: '60 FPS Virtual DOM', file: 'LogTable.tsx · bridge.ts', metric: '28 DOM NODES MAX', color: '#3b82f6' },
];

const VIM_KEYS = [
  { key: 'j', label: 'Next Row', rowIdx: 1 },
  { key: 'k', label: 'Prev Row', rowIdx: 0 },
  { key: 'gg', label: 'Line 1', rowIdx: 0 },
  { key: 'G', label: 'Live Tail', rowIdx: 3 },
  { key: '/', label: 'Search', rowIdx: 2 },
  { key: 'Enter', label: '±20 Context', rowIdx: 2 },
  { key: 'Shift', label: 'Range Δt', rowIdx: 3 },
  { key: '?', label: 'Shortcuts', rowIdx: 1 },
];

const SEARCH_TYPING_FRAMES = [
  't',
  'ti',
  'tim',
  'time',
  'timeo',
  'timeou',
  'timeout',
  'timeout, ',
  'timeout, c',
  'timeout, co',
  'timeout, cor',
  'timeout, corr-992...',
  'timeout, corr-992...',
  'timeout, corr-992...',
];

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeNavStage, setActiveNavStage] = useState(0);

  // Hero Interactive Workbench State
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [heroViewMode, setHeroViewMode] = useState<'interactive' | 'capture'>('interactive');
  const [activeSeverity, setActiveSeverity] = useState<'ALL' | 'ERROR' | 'WARN' | 'INFO' | 'AUDIT'>('ALL');
  const [excludeWarn, setExcludeWarn] = useState(false);
  const [heroSearch, setHeroSearch] = useState('');
  const [isLiveTail, setIsLiveTail] = useState(true);
  const [liveExtraRows, setLiveExtraRows] = useState<DemoLogEntry[]>([]);
  const [liveVelocityJitter, setLiveVelocityJitter] = useState(0);
  const [selectedRange, setSelectedRange] = useState<[number, number]>([0, 3]);
  const [inspectedPayload, setInspectedPayload] = useState<DemoLogEntry | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 30 });

  // Full-Width 7-Layer Kinetic Theater State
  const [activeLayer, setActiveLayer] = useState<number>(0);
  const [autoCycleLayers, setAutoCycleLayers] = useState<boolean>(true);
  const [activeTokenIdx, setActiveTokenIdx] = useState<number>(0);
  const [stripBracketsDemo, setStripBracketsDemo] = useState<boolean>(false);
  const [facetNegativeMode, setFacetNegativeMode] = useState<boolean>(false);
  const [typingFrameIdx, setTypingFrameIdx] = useState<number>(0);
  const [astHighlightLine, setAstHighlightLine] = useState<number>(0);
  const [deltaSelection, setDeltaSelection] = useState<[number, number]>([0, 3]);
  const [compactRowDemo, setCompactRowDemo] = useState<boolean>(true);
  const [toastSnippet, setToastSnippet] = useState<string | null>('[18:10:09.000Z] Upst...');
  const [mergedSources, setMergedSources] = useState<Record<string, boolean>>({
    'app_workflow.log': true,
    'payments_gateway.json': true,
    'service_audit.xml': true,
  });

  // 3D Isometric Exploded Stack Active Layer
  const [isoLayerIdx, setIsoLayerIdx] = useState<number>(0);
  const [isoAutoPlay, setIsoAutoPlay] = useState<boolean>(true);

  // Virtualization Scrubber & Keyboard Simulator State
  const [virtualLineOffset, setVirtualLineOffset] = useState<number>(142850);
  const [activeVimKey, setActiveVimKey] = useState<number>(0);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  const currentScenario = SCENARIOS[scenarioIdx];

  // Scroll progress + Section reveal IntersectionObserver
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;

    const handleScroll = () => {
      const maxScroll = el.scrollHeight - el.clientHeight;
      const pct = maxScroll > 0 ? Math.min(100, Math.max(0, (el.scrollTop / maxScroll) * 100)) : 0;
      setScrollProgress(pct);

      if (pct < 20) setActiveNavStage(0);
      else if (pct < 50) setActiveNavStage(1);
      else if (pct < 76) setActiveNavStage(2);
      else setActiveNavStage(3);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { root: el, threshold: 0.1 }
    );

    const revealEls = el.querySelectorAll('.lv-reveal-block');
    revealEls.forEach((node) => observer.observe(node));

    return () => {
      el.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  // Continuous Live SSE Stream & Auto-Sweeping Range Caliper in Hero
  useEffect(() => {
    if (!isLiveTail) return;
    const pairs: [number, number][] = [
      [0, 2],
      [0, 3],
      [1, 3],
      [1, 4],
    ];
    let step = 0;
    const timer = setInterval(() => {
      step = (step + 1) % pairs.length;
      setLiveVelocityJitter(Math.floor(Math.random() * 110) - 40);
      setSelectedRange(pairs[step]);
      setLiveExtraRows((prev) => {
        if (prev.length >= 2) return [];
        const template = LIVE_TAIL_POOL[prev.length % LIVE_TAIL_POOL.length];
        const baseLogs = SCENARIOS[scenarioIdx].logs;
        const lastLog = prev.length > 0 ? prev[prev.length - 1] : baseLogs[baseLogs.length - 1];
        return [
          ...prev,
          {
            ...template,
            line: lastLog.line + 1,
            epochMs: lastLog.epochMs + 450,
          },
        ];
      });
    }, 2200);
    return () => clearInterval(timer);
  }, [isLiveTail, scenarioIdx]);

  // Auto-cycle through the 7 Storytelling Layers
  useEffect(() => {
    if (!autoCycleLayers) return;
    const timer = setInterval(() => {
      setActiveLayer((prev) => (prev + 1) % SEVEN_STORY_LAYERS.length);
    }, 4800);
    return () => clearInterval(timer);
  }, [autoCycleLayers]);

  // Continuous sub-animations inside Stage 02 & Stage 03 & Stage 04
  useEffect(() => {
    const fastTicker = setInterval(() => {
      // Token spotlight & bracket toggle
      setActiveTokenIdx((prev) => {
        const next = (prev + 1) % TOKEN_ANATOMY.length;
        if (next === 0) setStripBracketsDemo((b) => !b);
        return next;
      });
      // Search typing frame
      setTypingFrameIdx((prev) => (prev + 1) % SEARCH_TYPING_FRAMES.length);
      // AST line scanner
      setAstHighlightLine((prev) => (prev + 1) % 6);
      // Negative mode pulse
      setFacetNegativeMode((prev) => !prev);
      // Delta selection sweep
      setDeltaSelection((prev) => {
        const nextEnd = prev[1] >= 4 ? 1 : prev[1] + 1;
        return [0, nextEnd];
      });
    }, 950);

    return () => clearInterval(fastTicker);
  }, []);

  // Continuous Compact/Standard morph, Isometric stack wave, Vim sequencer, Virtual DOM glide
  useEffect(() => {
    const mediumTicker = setInterval(() => {
      setCompactRowDemo((v) => !v);
      setActiveVimKey((prev) => (prev + 1) % VIM_KEYS.length);
      setVirtualLineOffset((prev) => {
        const next = prev + 31420;
        return next > 245000 ? 8420 : next;
      });
      if (isoAutoPlay) {
        setIsoLayerIdx((prev) => (prev + 1) % SEVEN_STORY_LAYERS.length);
      }
    }, 1500);

    return () => clearInterval(mediumTicker);
  }, [isoAutoPlay]);

  // Keyboard listener for manual Vim key press
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = VIM_KEYS.findIndex((k) => k.key.toLowerCase() === e.key.toLowerCase());
      if (idx !== -1) {
        setActiveVimKey(idx);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const allScenarioLogs = useMemo(() => {
    return [...currentScenario.logs, ...liveExtraRows];
  }, [currentScenario, liveExtraRows]);

  const filteredHeroLogs = useMemo(() => {
    return allScenarioLogs.filter((row) => {
      if (activeSeverity !== 'ALL' && row.level !== activeSeverity) return false;
      if (excludeWarn && row.level === 'WARN') return false;
      if (heroSearch.trim()) {
        const terms = heroSearch
          .toLowerCase()
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        const haystack = `${row.timestamp} ${row.corr} ${row.namespace} ${row.workflow} ${row.op} ${row.level} ${row.message}`.toLowerCase();
        return terms.every((term) => haystack.includes(term.replace(/\.\.\.$/, '')));
      }
      return true;
    });
  }, [allScenarioLogs, activeSeverity, excludeWarn, heroSearch]);

  const heroDeltaMetrics = useMemo(() => {
    const [a, b] = selectedRange;
    const rowA = allScenarioLogs[Math.min(a, b)] || allScenarioLogs[0];
    const rowB = allScenarioLogs[Math.max(a, b)] || allScenarioLogs[allScenarioLogs.length - 1];
    const diffMs = Math.abs(rowB.epochMs - rowA.epochMs);
    const steps = Math.abs(rowB.line - rowA.line);
    return {
      startLine: rowA.line,
      endLine: rowB.line,
      diffMs,
      formattedSec: `+${(diffMs / 1000).toFixed(3)}s`,
      steps,
    };
  }, [allScenarioLogs, selectedRange]);

  const dynamicGutterWidth = useMemo(() => {
    const digits = String(virtualLineOffset + 28).length;
    return Math.max(30, digits * 8 + 14);
  }, [virtualLineOffset]);

  const handleWorkbenchMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const ry = (x - 0.5) * 6;
    const rx = (0.5 - y) * 5;
    setTilt({ rx, ry, gx: Math.round(x * 100), gy: Math.round(y * 100) });
  };

  const handleWorkbenchMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 30 });
  };

  const scrollToSection = (id: string) => {
    const container = pageRef.current;
    const target = document.getElementById(id);
    if (container && target) {
      container.scrollTo({ top: target.offsetTop - 68, behavior: 'smooth' });
    }
  };

  const handleCopyCli = () => {
    navigator.clipboard?.writeText('git clone https://github.com/umaniax/LogViewer.git && cd LogViewer && npm run dev:all');
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 1800);
  };

  const triggerFastCopyToast = (text: string) => {
    const snippet = text.slice(0, 20) + (text.length > 20 ? '...' : '');
    setToastSnippet(snippet);
  };

  return (
    <div ref={pageRef} className="lv-relay-page">
      {/* Animated Engineering Grid Backdrop */}
      <div className="lv-relay-backdrop" />

      {/* Continuous Vertical Signal Conduit Spine */}
      <div className="lv-conduit-spine" aria-hidden="true">
        <div className="lv-conduit-progress" style={{ height: `${scrollProgress}%` }} />
        <div className="lv-conduit-packet" style={{ top: `${scrollProgress}%` }} />
      </div>

      {/* Floating Left Rail Nodes */}
      <div className="lv-conduit-nodes" aria-label="Storytelling Stage Rail">
        {[
          { idx: '01', label: 'Live Instrument', id: 'stage-hero' },
          { idx: '02', label: '7-Layer Theater', id: 'stage-layers' },
          { idx: '03', label: '3D Isometric Core', id: 'stage-exploded' },
          { idx: '04', label: '60 FPS Engine', id: 'stage-engine' },
        ].map((node, i) => (
          <button
            key={node.id}
            type="button"
            className={`lv-conduit-node-btn ${activeNavStage === i ? 'active' : ''}`}
            onClick={() => scrollToSection(node.id)}
          >
            <span className="lv-conduit-node-dot">{node.idx}</span>
            <span className="lv-conduit-node-label">{node.label}</span>
          </button>
        ))}
      </div>

      {/* Sticky Topbar Navigation */}
      <header className="lv-nav">
        <div className="lv-nav-inner">
          <button type="button" className="lv-brand" onClick={onLaunchApp} title="Return to LogViewer Console">
            <span className="lv-brand-mark">
              <span className="lv-brand-ring" />
              <Terminal size={15} strokeWidth={1.8} />
            </span>
            <span className="lv-brand-name">
              LogViewer
              <span
                style={{
                  fontFamily: 'var(--lv-font-mono)',
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--lv-border-mid)',
                  color: 'var(--lv-accent-bright)',
                }}
              >
                OBSIDIAN STUDIO
              </span>
            </span>
          </button>

          <nav className="lv-nav-stages" aria-label="Product Storytelling Chapters">
            {[
              { idx: '01', label: 'Instrument', id: 'stage-hero' },
              { idx: '02', label: '7 Layers', id: 'stage-layers' },
              { idx: '03', label: '3D Stack', id: 'stage-exploded' },
              { idx: '04', label: '60 FPS Engine', id: 'stage-engine' },
            ].map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={`lv-nav-stage-btn ${activeNavStage === i ? 'active' : ''}`}
                onClick={() => scrollToSection(item.id)}
              >
                <span className="lv-nav-stage-idx">{item.idx}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="lv-nav-actions">
            <div className="lv-telemetry-pill">
              <span className="lv-status-dot" />
              <span>LIVE TELEMETRY</span>
            </div>
            <button type="button" className="lv-btn-primary" onClick={onLaunchApp}>
              <span>Launch Console</span>
              <ArrowUpRight size={15} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>

      <main className="lv-main">
        {/* ====================================================================
            STAGE 01: MINIMAL HERO + SELF-ANIMATING 3D INSTRUMENT
           ==================================================================== */}
        <section id="stage-hero" className="lv-hero">
          <div className="lv-hero-copy">
            <div className="lv-eyebrow">
              <Layers size={13} strokeWidth={1.8} />
              <span>STAGE 01 // ZERO-SCHEMA TELEMETRY</span>
            </div>

            <h1 className="lv-hero-title">
              Raw chaos.{' '}
              <span className="lv-hero-title-emphasis">Structured</span> speed.
            </h1>

            <p className="lv-hero-sub">
              60 FPS bracket, JSON, and XML log stream engine with live range $\Delta t$ latency.
            </p>

            <div className="lv-hero-cta-row">
              <button type="button" className="lv-btn-primary" onClick={onLaunchApp}>
                <Terminal size={15} strokeWidth={1.8} />
                <span>Launch Console</span>
                <ArrowUpRight size={15} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className="lv-btn-secondary"
                onClick={() => scrollToSection('stage-layers')}
              >
                <Layers size={15} strokeWidth={1.8} />
                <span>7-Layer Pipeline</span>
              </button>
            </div>

            {/* Compact 3-Stream Pill Selector */}
            <div className="lv-stream-pills">
              {SCENARIOS.map((scen, idx) => (
                <button
                  key={scen.id}
                  type="button"
                  className={`lv-stream-pill-btn ${scenarioIdx === idx ? 'active' : ''}`}
                  onClick={() => {
                    setScenarioIdx(idx);
                    setLiveExtraRows([]);
                    setSelectedRange([0, Math.min(2, scen.logs.length - 1)]);
                    setInspectedPayload(null);
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: scenarioIdx === idx ? '#60a5fa' : '#64748b',
                    }}
                  />
                  <span>{scen.title}</span>
                  <span style={{ color: 'var(--lv-accent-bright)' }}>{scen.rateNow}/s</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Self-Animating 3D Tilting Obsidian Studio Instrument */}
          <div
            className="lv-hero-stage-wrap"
            onMouseMove={handleWorkbenchMouseMove}
            onMouseLeave={handleWorkbenchMouseLeave}
          >
            <div
              className="lv-workbench-frame"
              style={{
                transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
              }}
            >
              <div
                className="lv-workbench-glare"
                style={{
                  background: `radial-gradient(540px circle at ${tilt.gx}% ${tilt.gy}%, rgba(96, 165, 250, 0.09), transparent 65%)`,
                }}
              />

              {/* Tier 1: Source Breadcrumb, Animated Waveform, Dual Velocity Badges */}
              <div className="lv-mini-tier1">
                <div className="lv-mini-breadcrumb">
                  <Terminal size={13} color="#60a5fa" />
                  <span>{currentScenario.sourceBreadcrumb}</span>
                  <div className="lv-mini-rate-group">
                    <span className="lv-mini-rate-now">
                      {(currentScenario.rateNow + (isLiveTail ? liveVelocityJitter : 0)).toLocaleString()}/s
                    </span>
                    <span className="lv-mini-rate-avg">{currentScenario.rateAvg}/s avg</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsLiveTail((v) => !v)}
                    className="lv-sev-pill"
                    style={{
                      borderColor: isLiveTail ? 'var(--lv-tok-corr)' : 'var(--lv-border-subtle)',
                      color: isLiveTail ? 'var(--lv-tok-corr)' : 'var(--lv-text-muted)',
                    }}
                  >
                    {isLiveTail ? <Play size={10} /> : <Pause size={10} />}
                    <span>{isLiveTail ? 'SSE LIVE' : 'PAUSED'}</span>
                  </button>

                  <div className="lv-mini-mode-switch">
                    <button
                      type="button"
                      className={`lv-mini-mode-btn ${heroViewMode === 'interactive' ? 'active' : ''}`}
                      onClick={() => setHeroViewMode('interactive')}
                    >
                      LIVE DOM
                    </button>
                    <button
                      type="button"
                      className={`lv-mini-mode-btn ${heroViewMode === 'capture' ? 'active' : ''}`}
                      onClick={() => setHeroViewMode('capture')}
                    >
                      PNG
                    </button>
                  </div>
                </div>
              </div>

              {heroViewMode === 'interactive' ? (
                <>
                  {/* Tier 2: Single-Line Severity Pills + Negative Exclusion */}
                  <div className="lv-mini-tier2">
                    <div className="lv-mini-pills">
                      {(['ALL', 'ERROR', 'WARN', 'INFO', 'AUDIT'] as const).map((sev) => {
                        const isActive = activeSeverity === sev;
                        const activeClass =
                          sev === 'ALL'
                            ? 'active-all'
                            : sev === 'ERROR'
                            ? 'active-error'
                            : sev === 'WARN'
                            ? 'active-warn'
                            : sev === 'INFO'
                            ? 'active-info'
                            : 'active-audit';
                        return (
                          <button
                            key={sev}
                            type="button"
                            className={`lv-sev-pill ${isActive ? activeClass : ''}`}
                            onClick={() => setActiveSeverity(sev)}
                          >
                            <span>{sev}</span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className="lv-sev-pill"
                        onClick={() => setExcludeWarn((v) => !v)}
                        style={{
                          borderColor: excludeWarn ? 'var(--lv-tok-status-error)' : 'var(--lv-border-subtle)',
                          color: excludeWarn ? 'var(--lv-tok-status-error)' : 'var(--lv-text-muted)',
                        }}
                      >
                        <span>-WARN</span>
                      </button>
                    </div>

                    <div className="lv-mini-pills">
                      <span className="lv-sev-pill">
                        <span>Workflows</span>
                        <ChevronDown size={10} />
                      </span>
                      <span className="lv-sev-pill" style={{ color: 'var(--lv-accent-bright)' }}>
                        <span>Sort: Time Asc</span>
                      </span>
                    </div>
                  </div>

                  {/* Tier 3: Search Input */}
                  <div className="lv-mini-tier3">
                    <div className="lv-mini-search">
                      <Search size={12} color="#64748b" />
                      <input
                        type="text"
                        value={heroSearch}
                        onChange={(e) => setHeroSearch(e.target.value)}
                        placeholder="comma-AND query, trailing ... wildcard"
                        aria-label="Filter interactive log stream"
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: 'var(--lv-font-mono)',
                        fontSize: '10px',
                        color: 'var(--lv-text-muted)',
                      }}
                    >
                      {filteredHeroLogs.length}/{allScenarioLogs.length}
                    </span>
                  </div>

                  {/* Virtualized Log Rows */}
                  <div className="lv-mini-viewport">
                    {filteredHeroLogs.map((row, idx) => {
                      const [rStart, rEnd] = selectedRange;
                      const inRange =
                        idx >= Math.min(rStart, rEnd) && idx <= Math.max(rStart, rEnd);
                      const rowClass = [
                        'lv-mini-row',
                        inRange ? 'selected' : '',
                        row.level === 'ERROR' ? 'error-row' : '',
                        row.level === 'WARN' ? 'warn-row' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');

                      return (
                        <div
                          key={row.line}
                          className={rowClass}
                          onClick={() =>
                            setSelectedRange([idx, Math.min(allScenarioLogs.length - 1, idx + 1)])
                          }
                        >
                          <div className="lv-mini-gutter" style={{ borderLeft: `2px solid ${row.sourceColor}` }}>
                            {row.line}
                          </div>
                          <div className="lv-mini-cell">
                            <span style={{ color: 'var(--lv-tok-datetime)' }}>
                              [{row.timestamp.slice(11, 23)}]
                            </span>
                            <span style={{ color: 'var(--lv-tok-corr)' }}>[{row.corr}]</span>
                            <span style={{ color: 'var(--lv-tok-workflow)' }}>[{row.workflow}]</span>
                            <span style={{ color: 'var(--lv-tok-op-http)' }}>[{row.op}]</span>
                            <span
                              style={{
                                color:
                                  row.level === 'ERROR'
                                    ? 'var(--lv-tok-status-error)'
                                    : row.level === 'WARN'
                                    ? 'var(--lv-tok-status-warn)'
                                    : row.level === 'AUDIT'
                                    ? 'var(--lv-tok-status-audit)'
                                    : 'var(--lv-tok-status-info)',
                                fontWeight: 600,
                              }}
                            >
                              [{row.level}]
                            </span>
                            <span style={{ color: 'var(--lv-tok-duration)' }}>[{row.duration}]</span>
                            <span style={{ color: 'var(--lv-text-primary)' }}>{row.message}</span>
                            {row.payloadType && (
                              <button
                                type="button"
                                className="lv-sev-pill"
                                style={{
                                  height: '18px',
                                  padding: '0 6px',
                                  borderColor: 'var(--lv-accent)',
                                  color: 'var(--lv-accent-bright)',
                                  marginLeft: 'auto',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectedPayload(
                                    inspectedPayload?.line === row.line ? null : row
                                  );
                                }}
                              >
                                <Code2 size={10} />
                                <span>{row.payloadType}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {inspectedPayload && (
                      <div
                        className="lv-plate-animate"
                        style={{
                          margin: '8px 12px',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          background: 'var(--lv-bg-panel)',
                          border: '1px solid var(--lv-accent)',
                          fontFamily: 'var(--lv-font-mono)',
                          fontSize: '11px',
                        }}
                      >
                        <pre style={{ margin: 0, color: 'var(--lv-text-primary)' }}>
                          {inspectedPayload.payloadRaw}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Auto-Sweeping Range Delta Time HUD */}
                  <div className="lv-mini-delta-hud">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="lv-delta-badge">
                        <Clock size={12} />
                        <span>Δt {heroDeltaMetrics.formattedSec}</span>
                      </span>
                      <span style={{ color: 'var(--lv-text-secondary)' }}>
                        L{heroDeltaMetrics.startLine} → L{heroDeltaMetrics.endLine} (
                        {heroDeltaMetrics.diffMs.toLocaleString()} ms · {heroDeltaMetrics.steps} steps)
                      </span>
                    </div>
                    <span style={{ color: 'var(--lv-tok-corr)', fontSize: '10px' }}>
                      ● AUTO-SWEEP ACTIVE
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ background: 'var(--lv-bg-void)', padding: '12px' }}>
                  <img
                    src="/Viewer.png"
                    alt="LogViewer Obsidian Studio Workbench"
                    style={{
                      width: '100%',
                      height: '335px',
                      objectFit: 'cover',
                      objectPosition: 'top center',
                      borderRadius: '6px',
                      border: '1px solid var(--lv-border-subtle)',
                      display: 'block',
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ====================================================================
            STAGE 02: FULL-WIDTH 7-LAYER KINETIC THEATER
           ==================================================================== */}
        <section id="stage-layers" className="lv-layers-section lv-reveal-block">
          <div className="lv-compact-head">
            <div>
              <div className="lv-eyebrow" style={{ marginBottom: '8px' }}>
                <SlidersHorizontal size={12} strokeWidth={1.8} />
                <span>STAGE 02 // 7-LAYER KINETIC PIPELINE</span>
              </div>
              <h2 className="lv-section-title">Seven self-animating telemetry layers.</h2>
            </div>

            <button
              type="button"
              className="lv-sev-pill"
              onClick={() => setAutoCycleLayers((v) => !v)}
              style={{
                height: '28px',
                padding: '0 12px',
                borderColor: autoCycleLayers ? 'var(--lv-tok-corr)' : 'var(--lv-border-mid)',
                color: autoCycleLayers ? 'var(--lv-tok-corr)' : 'var(--lv-text-secondary)',
              }}
            >
              {autoCycleLayers ? <Pause size={11} /> : <Play size={11} />}
              <span>{autoCycleLayers ? 'AUTO-CYCLE ON' : 'PAUSED'}</span>
            </button>
          </div>

          {/* 7-Node Horizontal Ribbon */}
          <div className="lv-layer-ribbon">
            {SEVEN_STORY_LAYERS.map((layer, idx) => {
              const isActive = activeLayer === idx;
              return (
                <button
                  key={layer.idx}
                  type="button"
                  className={`lv-ribbon-node ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveLayer(idx);
                    setAutoCycleLayers(false);
                  }}
                >
                  <div className="lv-ribbon-idx">
                    <span>L{layer.idx}</span>
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: isActive ? layer.color : 'transparent',
                        boxShadow: isActive ? `0 0 8px ${layer.color}` : 'none',
                      }}
                    />
                  </div>
                  <div className="lv-ribbon-name">{layer.short}</div>
                  {isActive && autoCycleLayers && <div className="lv-ribbon-bar" />}
                </button>
              );
            })}
          </div>

          {/* Full-Width Animated Stage */}
          <div className="lv-kinetic-stage">
            <div className="lv-stage-topbar">
              <span style={{ color: 'var(--lv-accent-bright)' }}>
                LAYER {SEVEN_STORY_LAYERS[activeLayer].idx} // {SEVEN_STORY_LAYERS[activeLayer].short.toUpperCase()}
              </span>
              <span style={{ color: 'var(--lv-text-muted)' }}>
                {SEVEN_STORY_LAYERS[activeLayer].file} ·{' '}
                <strong style={{ color: SEVEN_STORY_LAYERS[activeLayer].color }}>
                  {SEVEN_STORY_LAYERS[activeLayer].metric}
                </strong>
              </span>
            </div>

            <div key={activeLayer} className="lv-stage-body lv-plate-animate">
              {/* LAYER 01: ANIMATED K-WAY MERGE CONVEYOR */}
              {activeLayer === 0 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {[
                      { name: 'app_workflow.log', color: '#3b82f6', badge: '🕒 2 > (.1, .2)' },
                      { name: 'payments_gateway.json', color: '#34d399', badge: '🕒 1 > (.1)' },
                      { name: 'service_audit.xml', color: '#a78bfa', badge: 'PasteLogsModal' },
                    ].map((src) => {
                      const active = mergedSources[src.name];
                      return (
                        <div
                          key={src.name}
                          onClick={() =>
                            setMergedSources((p) => ({ ...p, [src.name]: !p[src.name] }))
                          }
                          style={{
                            padding: '12px',
                            borderRadius: '6px',
                            background: 'var(--lv-bg-void)',
                            border: `1px solid ${active ? src.color : 'var(--lv-border-subtle)'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontFamily: 'var(--lv-font-mono)',
                            fontSize: '11.5px',
                          }}
                        >
                          <span style={{ color: active ? src.color : 'var(--lv-text-muted)' }}>
                            ● {src.name}
                          </span>
                          <span className="lv-spec-chip">{src.badge}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Animated SVG Packet Merger */}
                  <svg
                    viewBox="0 0 800 72"
                    style={{ width: '100%', height: '72px', display: 'block' }}
                  >
                    <path
                      d="M 130 6 C 130 42, 400 28, 400 66"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      strokeDasharray="8 8"
                      style={{ animation: 'lvPacketFlow 1.6s linear infinite' }}
                    />
                    <path
                      d="M 400 6 L 400 66"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2"
                      strokeDasharray="8 8"
                      style={{ animation: 'lvPacketFlow 1.2s linear infinite' }}
                    />
                    <path
                      d="M 670 6 C 670 42, 400 28, 400 66"
                      fill="none"
                      stroke="#a78bfa"
                      strokeWidth="2"
                      strokeDasharray="8 8"
                      style={{ animation: 'lvPacketFlow 1.9s linear infinite' }}
                    />
                    <circle cx="400" cy="64" r="5" fill="#60a5fa" />
                  </svg>

                  <div
                    style={{
                      borderRadius: '6px',
                      background: 'var(--lv-bg-void)',
                      border: '1px solid var(--lv-border-subtle)',
                      padding: '10px',
                      fontFamily: 'var(--lv-font-mono)',
                      fontSize: '11.5px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {[
                      { src: 'app_workflow.log', color: '#3b82f6', t: '18:10:00.010', m: '[WF:Checkout] POST /v1/authorize' },
                      { src: 'payments_gateway.json', color: '#34d399', t: '18:10:00.044', m: '{"event":"ledger_lock","corr":"corr-99214-ax"}' },
                      { src: 'service_audit.xml', color: '#a78bfa', t: '18:10:00.112', m: '<AuditEvent corr="corr-99214-ax" status="VERIFIED"/>' },
                    ]
                      .filter((r) => mergedSources[r.src])
                      .map((r, idx) => (
                        <div
                          key={r.t}
                          style={{
                            padding: '7px 10px',
                            borderLeft: `3px solid ${r.color}`,
                            background:
                              astHighlightLine % 3 === idx
                                ? 'rgba(59, 130, 246, 0.12)'
                                : 'rgba(255,255,255,0.02)',
                            display: 'flex',
                            gap: '10px',
                            transition: 'background 200ms ease',
                          }}
                        >
                          <span style={{ color: 'var(--lv-tok-datetime)' }}>{r.t}</span>
                          <span style={{ color: r.color }}>[{r.src.split('.')[0]}]</span>
                          <span style={{ color: 'var(--lv-text-primary)' }}>{r.m}</span>
                        </div>
                      ))}
                  </div>
                </>
              )}

              {/* LAYER 02: LASER BRACKET TOKENIZER */}
              {activeLayer === 1 && (
                <>
                  <div className="lv-laser-box">
                    <div className="lv-laser-beam" />
                    {TOKEN_ANATOMY.map((tok, i) => (
                      <span
                        key={tok.id}
                        onClick={() => setActiveTokenIdx(i)}
                        style={{
                          color: tok.hex,
                          padding: '3px 6px',
                          marginRight: '6px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          border:
                            activeTokenIdx === i ? `1px solid ${tok.hex}` : '1px solid transparent',
                          background:
                            activeTokenIdx === i ? 'rgba(255,255,255,0.08)' : 'transparent',
                          transition: 'all 150ms ease',
                          display: 'inline-block',
                        }}
                      >
                        {stripBracketsDemo ? tok.stripped : tok.raw}
                      </span>
                    ))}
                  </div>

                  <div className="lv-token-anatomy-grid">
                    {TOKEN_ANATOMY.map((tok, i) => (
                      <div
                        key={tok.id}
                        className={`lv-token-plate ${activeTokenIdx === i ? 'active' : ''}`}
                        onClick={() => setActiveTokenIdx(i)}
                        style={{
                          borderColor: activeTokenIdx === i ? tok.hex : undefined,
                        }}
                      >
                        <div className="lv-token-plate-top">
                          <span>{tok.label}</span>
                          <span>{tok.hex}</span>
                        </div>
                        <div className="lv-token-plate-val" style={{ color: tok.hex }}>
                          {stripBracketsDemo ? tok.stripped : tok.raw}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontFamily: 'var(--lv-font-mono)',
                      fontSize: '11px',
                      color: 'var(--lv-text-secondary)',
                    }}
                  >
                    <span>
                      ACTIVE TOKEN:{' '}
                      <strong style={{ color: TOKEN_ANATOMY[activeTokenIdx].hex }}>
                        {TOKEN_ANATOMY[activeTokenIdx].tokenVar}
                      </strong>
                    </span>
                    <button
                      type="button"
                      className="lv-sev-pill active-all"
                      onClick={() => setStripBracketsDemo((v) => !v)}
                    >
                      [ ] Brackets: {stripBracketsDemo ? 'STRIPPED' : 'VISIBLE'}
                    </button>
                  </div>
                </>
              )}

              {/* LAYER 03: SELF-TYPING 3-TIER FACET & SEARCH ENGINE */}
              {activeLayer === 2 && (
                <>
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      background: 'var(--lv-bg-void)',
                      border: '1px solid var(--lv-border-subtle)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    {[
                      { label: 'ALL', color: '#3b82f6' },
                      { label: 'CRITICAL', color: '#f87171' },
                      { label: 'ERROR', color: '#f87171' },
                      { label: 'WARNING', color: '#fbbf24' },
                      { label: 'INFO', color: '#60a5fa' },
                      { label: 'NOTICE', color: '#34d399' },
                      { label: 'AUDIT', color: '#c084fc' },
                      { label: 'DEBUG', color: '#94a3b8' },
                      { label: 'TRACE', color: '#64748b' },
                      { label: 'VERBOSE', color: '#64748b' },
                    ].map((s, idx) => (
                      <span
                        key={s.label}
                        className="lv-sev-pill"
                        style={{
                          borderColor: s.color,
                          color: s.color,
                          transform: activeTokenIdx === idx ? 'translateY(-2px)' : 'none',
                          background:
                            activeTokenIdx === idx ? 'rgba(255,255,255,0.06)' : 'transparent',
                        }}
                      >
                        {facetNegativeMode && s.label !== 'ALL' ? `-${s.label}` : s.label}
                      </span>
                    ))}
                  </div>

                  {/* Animated Self-Typing Tier 3 Search Bar */}
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '6px',
                      background: 'var(--lv-bg-void)',
                      border: '1px solid var(--lv-accent)',
                      fontFamily: 'var(--lv-font-mono)',
                      fontSize: '12.5px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      <span style={{ color: 'var(--lv-text-muted)' }}>SEARCH // </span>
                      <span style={{ color: 'var(--lv-accent-bright)' }}>
                        {SEARCH_TYPING_FRAMES[typingFrameIdx]}
                      </span>
                      <span style={{ color: 'var(--lv-tok-corr)' }}>▋</span>
                    </span>
                    <span className="lv-delta-badge">
                      Match {(typingFrameIdx % 3) + 1} / 623 · 8-Way Sort
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {[
                      { label: 'Workflows', val: 'WF:Checkout (412)', color: 'var(--lv-tok-workflow)' },
                      { label: 'Operations', val: 'POST /v1/charge', color: 'var(--lv-tok-op-http)' },
                      { label: 'Correlations', val: 'corr-99214-ax', color: 'var(--lv-tok-corr)' },
                    ].map((f) => (
                      <div
                        key={f.label}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          background: 'var(--lv-bg-void)',
                          border: '1px solid var(--lv-border-subtle)',
                          fontFamily: 'var(--lv-font-mono)',
                          fontSize: '11px',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ color: 'var(--lv-text-muted)' }}>{f.label}</span>
                        <span style={{ color: f.color }}>{f.val}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* LAYER 04: ANIMATED AST SYNTAX TREE SCANNER */}
              {activeLayer === 3 && (
                <>
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '6px',
                      background: 'var(--lv-bg-void)',
                      border: '1px solid var(--lv-border-subtle)',
                      fontFamily: 'var(--lv-font-mono)',
                      fontSize: '11.5px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      <span style={{ color: 'var(--lv-tok-status-error)', marginRight: '8px' }}>[ERROR]</span>
                      <span
                        style={{
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.45)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          marginRight: '8px',
                        }}
                      >
                        postgres://replica-02:5432
                      </span>
                      <span
                        style={{
                          color: 'var(--lv-accent-bright)',
                          border: '1px solid var(--lv-accent)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {'{"code":"ERR_UPSTREAM_TIMEOUT"}'}
                      </span>
                    </span>
                    <span className="lv-delta-badge">Format · Copy · Inspect</span>
                  </div>

                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '6px',
                      background: 'var(--lv-bg-void)',
                      border: '1px solid var(--lv-accent)',
                      fontFamily: 'var(--lv-font-mono)',
                      fontSize: '11.5px',
                      lineHeight: 1.65,
                    }}
                  >
                    {[
                      { ln: '01', text: '▼ root {4}', color: 'var(--lv-accent-bright)' },
                      { ln: '02', text: '  "code": "ERR_UPSTREAM_TIMEOUT"', color: 'var(--lv-tok-status-error)' },
                      { ln: '03', text: '  "retryable": true', color: 'var(--lv-tok-corr)' },
                      { ln: '04', text: '  ▼ "upstream_socket": {2}', color: 'var(--lv-tok-namespace)' },
                      { ln: '05', text: '    "host": "settlement-core.internal:8443"', color: 'var(--lv-text-primary)' },
                      { ln: '06', text: '    "latency_ms": 4890', color: 'var(--lv-tok-duration)' },
                    ].map((item, idx) => (
                      <div
                        key={item.ln}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background:
                            astHighlightLine === idx ? 'rgba(59, 130, 246, 0.16)' : 'transparent',
                          borderLeft:
                            astHighlightLine === idx
                              ? '2px solid var(--lv-accent-bright)'
                              : '2px solid transparent',
                          transition: 'all 160ms ease',
                        }}
                      >
                        <span style={{ color: 'var(--lv-text-muted)', marginRight: '12px' }}>
                          {item.ln}
                        </span>
                        <span style={{ color: item.color }}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* LAYER 05: AUTO-SWEEPING RANGE DELTA TIME CALIPER */}
              {activeLayer === 4 && (
                <>
                  <div
                    style={{
                      borderRadius: '6px',
                      background: 'var(--lv-bg-void)',
                      border: '1px solid var(--lv-border-subtle)',
                      overflow: 'hidden',
                      fontFamily: 'var(--lv-font-mono)',
                      fontSize: '11.5px',
                    }}
                  >
                    {SCENARIOS[0].logs.map((row, idx) => {
                      const isAnchor = deltaSelection[0] === idx || deltaSelection[1] === idx;
                      const inSpan =
                        idx >= Math.min(deltaSelection[0], deltaSelection[1]) &&
                        idx <= Math.max(deltaSelection[0], deltaSelection[1]);
                      return (
                        <div
                          key={row.line}
                          onClick={() => setDeltaSelection([0, idx])}
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            borderLeft: isAnchor
                              ? '3px solid var(--lv-accent-bright)'
                              : inSpan
                              ? '3px solid rgba(59, 130, 246, 0.45)'
                              : '3px solid transparent',
                            background: isAnchor
                              ? 'rgba(59, 130, 246, 0.16)'
                              : inSpan
                              ? 'rgba(59, 130, 246, 0.06)'
                              : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            transition: 'all 180ms ease',
                          }}
                        >
                          <span>
                            <span style={{ color: 'var(--lv-text-muted)', marginRight: '10px' }}>
                              L{row.line}
                            </span>
                            <span style={{ color: 'var(--lv-tok-datetime)', marginRight: '10px' }}>
                              {row.timestamp.slice(11, 23)}
                            </span>
                            <span style={{ color: 'var(--lv-tok-op-http)', marginRight: '10px' }}>
                              [{row.op}]
                            </span>
                            <span style={{ color: 'var(--lv-text-primary)' }}>
                              {row.message.slice(0, 44)}
                            </span>
                          </span>
                          <span style={{ color: 'var(--lv-tok-duration)' }}>{row.duration}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '6px',
                      background: 'var(--lv-bg-void)',
                      border: '1px solid var(--lv-accent)',
                      fontFamily: 'var(--lv-font-mono)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="lv-delta-badge" style={{ fontSize: '13px' }}>
                        {(() => {
                          const r1 = SCENARIOS[0].logs[deltaSelection[0]];
                          const r2 = SCENARIOS[0].logs[deltaSelection[1]];
                          const ms = Math.abs(r2.epochMs - r1.epochMs);
                          return `Δt +${(ms / 1000).toFixed(3)}s (${ms.toLocaleString()} ms)`;
                        })()}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--lv-text-secondary)' }}>
                        L{SCENARIOS[0].logs[deltaSelection[0]].line} → L
                        {SCENARIOS[0].logs[deltaSelection[1]].line} (
                        {Math.abs(deltaSelection[1] - deltaSelection[0])} steps)
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span className="lv-sev-pill active-all">+ Include</span>
                      <span className="lv-sev-pill active-error">- Exclude NOT</span>
                      <span className="lv-sev-pill">±20 ContextModal</span>
                    </div>
                  </div>
                </>
              )}

              {/* LAYER 06: AUTO-MORPHING COMPACT / STANDARD ROW & COPYTOAST */}
              {activeLayer === 5 && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontFamily: 'var(--lv-font-mono)',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className={`lv-sev-pill ${compactRowDemo ? 'active-all' : ''}`}
                        onClick={() => setCompactRowDemo(true)}
                      >
                        1-Line CompactLogRow
                      </button>
                      <button
                        type="button"
                        className={`lv-sev-pill ${!compactRowDemo ? 'active-all' : ''}`}
                        onClick={() => setCompactRowDemo(false)}
                      >
                        2-Line Standard LogRow
                      </button>
                    </div>
                    <span className="lv-delta-badge">CopyToast: "{toastSnippet}"</span>
                  </div>

                  <div
                    style={{
                      borderRadius: '6px',
                      background: 'var(--lv-bg-void)',
                      border: '1px solid var(--lv-border-subtle)',
                      padding: '12px',
                      fontFamily: 'var(--lv-font-mono)',
                      fontSize: '11.5px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {SCENARIOS[0].logs.slice(1, 4).map((row) => (
                      <div
                        key={row.line}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '5px',
                          background: 'var(--lv-bg-panel)',
                          border: '1px solid var(--lv-border-subtle)',
                          display: 'flex',
                          flexDirection: compactRowDemo ? 'row' : 'column',
                          alignItems: compactRowDemo ? 'center' : 'flex-start',
                          justifyContent: 'space-between',
                          gap: '8px',
                          transition: 'all 220ms ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className="lv-sev-pill active-all"
                            onClick={() => triggerFastCopyToast(`[${row.timestamp}] ${row.message}`)}
                          >
                            <Copy size={10} />
                            <span>L{row.line}</span>
                          </button>
                          <span style={{ color: 'var(--lv-tok-datetime)' }}>
                            [{row.timestamp.slice(11, 23)}]
                          </span>
                          <span style={{ color: 'var(--lv-tok-corr)' }}>[{row.corr}]</span>
                          <span style={{ color: 'var(--lv-tok-workflow)' }}>[{row.workflow}]</span>
                        </div>
                        <div style={{ color: 'var(--lv-text-primary)' }}>{row.message}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* LAYER 07: AUTO-GLIDING 250K VIRTUAL DOM WINDOW */}
              {activeLayer === 6 && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--lv-font-mono)',
                      fontSize: '11.5px',
                    }}
                  >
                    <span style={{ color: 'var(--lv-accent-bright)' }}>
                      OFFSET: LINE {virtualLineOffset.toLocaleString()} / 250,000
                    </span>
                    <span style={{ color: 'var(--lv-tok-corr)' }}>
                      MOUNTED DOM: 28 NODES · GUTTER: {dynamicGutterWidth}px
                    </span>
                  </div>

                  <input
                    type="range"
                    min={1}
                    max={249970}
                    value={virtualLineOffset}
                    onChange={(e) => setVirtualLineOffset(Number(e.target.value))}
                    aria-label="Virtual DOM Line Offset Scrubber"
                    style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                  />

                  <div
                    style={{
                      borderRadius: '6px',
                      background: 'var(--lv-bg-void)',
                      border: '1px solid var(--lv-border-subtle)',
                      padding: '10px',
                      fontFamily: 'var(--lv-font-mono)',
                      fontSize: '11.5px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {[0, 1, 2, 3].map((offset) => {
                      const lineNum = virtualLineOffset + offset;
                      return (
                        <div
                          key={lineNum}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                            padding: '4px 0',
                          }}
                        >
                          <span
                            style={{
                              width: `${dynamicGutterWidth}px`,
                              textAlign: 'right',
                              paddingRight: '8px',
                              color: 'var(--lv-accent-bright)',
                              borderRight: '1px solid var(--lv-border-subtle)',
                              marginRight: '10px',
                              transition: 'width 180ms ease',
                            }}
                          >
                            {lineNum}
                          </span>
                          <span style={{ color: 'var(--lv-tok-datetime)', marginRight: '8px' }}>
                            [18:42:{10 + offset}.004]
                          </span>
                          <span style={{ color: 'var(--lv-tok-corr)', marginRight: '8px' }}>
                            [corr-{lineNum}]
                          </span>
                          <span style={{ color: 'var(--lv-text-primary)' }}>
                            @tanstack/react-virtual active window row
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ====================================================================
            STAGE 03: 3D ISOMETRIC EXPLODED LAYER STACK WITH LASER CORE
           ==================================================================== */}
        <section id="stage-exploded" className="lv-exploded-section lv-reveal-block">
          <div className="lv-compact-head">
            <div>
              <h2 className="lv-section-title">3D isometric telemetry stack.</h2>
            </div>
            <button
              type="button"
              className="lv-sev-pill"
              onClick={() => setIsoAutoPlay((v) => !v)}
              style={{
                height: '28px',
                padding: '0 12px',
                borderColor: isoAutoPlay ? 'var(--lv-tok-corr)' : 'var(--lv-border-mid)',
                color: isoAutoPlay ? 'var(--lv-tok-corr)' : 'var(--lv-text-secondary)',
              }}
            >
              {isoAutoPlay ? '3D WAVE AUTO' : 'MANUAL HOVER'}
            </button>
          </div>

          <div className="lv-exploded-layout">
            {/* Left: 3D Isometric Stack with Vertical Laser Core */}
            <div className="lv-iso-stack-wrap">
              <div className="lv-iso-core-beam" />
              <div className="lv-iso-stack">
                {SEVEN_STORY_LAYERS.map((layer, idx) => {
                  const isSelected = isoLayerIdx === idx;
                  return (
                    <div
                      key={layer.idx}
                      className={`lv-iso-plate ${isSelected ? 'active' : ''}`}
                      onMouseEnter={() => {
                        setIsoAutoPlay(false);
                        setIsoLayerIdx(idx);
                      }}
                      onClick={() => {
                        setActiveLayer(idx);
                        scrollToSection('stage-layers');
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className="lv-layer-index">L{layer.idx}</span>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--lv-text-primary)' }}>
                          {layer.short}
                        </span>
                      </div>
                      <span
                        style={{
                          fontFamily: 'var(--lv-font-mono)',
                          fontSize: '10.5px',
                          color: isSelected ? layer.color : 'var(--lv-text-muted)',
                        }}
                      >
                        {layer.metric}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Visual Telemetry Pulse Matrix (Zero Prose) */}
            <div className="lv-hardware-plate" key={isoLayerIdx}>
              <div className="lv-plate-header">
                <h3 className="lv-plate-title">
                  <Sparkles size={14} color={SEVEN_STORY_LAYERS[isoLayerIdx].color} />
                  <span>
                    LAYER {SEVEN_STORY_LAYERS[isoLayerIdx].idx} //{' '}
                    {SEVEN_STORY_LAYERS[isoLayerIdx].short.toUpperCase()}
                  </span>
                </h3>
                <span className="lv-spec-chip">{SEVEN_STORY_LAYERS[isoLayerIdx].file}</span>
              </div>

              <div className="lv-plate-content lv-plate-animate">
                {/* Animated SVG Signal Oscilloscope */}
                <div
                  style={{
                    borderRadius: '6px',
                    background: 'var(--lv-bg-void)',
                    border: '1px solid var(--lv-border-subtle)',
                    padding: '16px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <svg
                    viewBox="0 0 600 110"
                    style={{ width: '100%', height: '110px', display: 'block' }}
                  >
                    <path
                      d="M 0 55 Q 35 12, 70 55 T 140 55 T 210 55 T 280 55 T 350 55 T 420 55 T 490 55 T 560 55 T 630 55"
                      fill="none"
                      stroke={SEVEN_STORY_LAYERS[isoLayerIdx].color}
                      strokeWidth="2"
                      strokeDasharray="10 6"
                      style={{ animation: 'lvPacketFlow 1.4s linear infinite' }}
                    />
                    <path
                      d="M 0 75 Q 45 35, 90 75 T 180 75 T 270 75 T 360 75 T 450 75 T 540 75 T 630 75"
                      fill="none"
                      stroke="rgba(96, 165, 250, 0.35)"
                      strokeWidth="1.5"
                    />
                  </svg>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--lv-font-mono)',
                      fontSize: '11px',
                      marginTop: '8px',
                    }}
                  >
                    <span style={{ color: 'var(--lv-text-muted)' }}>
                      STAGE {isoLayerIdx + 1} / 7 ACTIVE
                    </span>
                    <span style={{ color: SEVEN_STORY_LAYERS[isoLayerIdx].color }}>
                      {SEVEN_STORY_LAYERS[isoLayerIdx].metric}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      background: 'var(--lv-bg-void)',
                      border: '1px solid var(--lv-border-subtle)',
                      fontFamily: 'var(--lv-font-mono)',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: 'var(--lv-text-muted)' }}>FRAME BUDGET</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--lv-tok-corr)' }}>
                      16.6 ms
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      background: 'var(--lv-bg-void)',
                      border: '1px solid var(--lv-border-subtle)',
                      fontFamily: 'var(--lv-font-mono)',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: 'var(--lv-text-muted)' }}>DOM NODES</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--lv-accent-bright)' }}>
                      28 CONST
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      background: 'var(--lv-bg-void)',
                      border: '1px solid var(--lv-border-subtle)',
                      fontFamily: 'var(--lv-font-mono)',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: 'var(--lv-text-muted)' }}>TEST SUITES</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--lv-text-primary)' }}>
                      10 / 10 PASS
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================================
            STAGE 04: AUTO-SEQUENCING VIM MATRIX & VIRTUAL DOM ENGINE
           ==================================================================== */}
        <section id="stage-engine" className="lv-engine-section lv-reveal-block">
          <div className="lv-compact-head">
            <h2 className="lv-section-title">60 FPS virtualization &amp; live Vim sequencer.</h2>
          </div>

          <div className="lv-engine-grid">
            {/* Left Plate: Auto-Gliding Virtual DOM Window */}
            <div className="lv-hardware-plate">
              <div className="lv-plate-header">
                <h3 className="lv-plate-title">
                  <Cpu size={14} color="#3b82f6" />
                  <span>@tanstack/react-virtual Window</span>
                </h3>
                <span className="lv-spec-chip">GUTTER: {dynamicGutterWidth}px</span>
              </div>

              <div className="lv-plate-content">
                <input
                  type="range"
                  min={1}
                  max={249970}
                  value={virtualLineOffset}
                  onChange={(e) => setVirtualLineOffset(Number(e.target.value))}
                  aria-label="Virtual DOM Line Offset Scrubber"
                  style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                />

                <div
                  style={{
                    borderRadius: '6px',
                    background: 'var(--lv-bg-void)',
                    border: '1px solid var(--lv-border-subtle)',
                    padding: '10px',
                    fontFamily: 'var(--lv-font-mono)',
                    fontSize: '11px',
                  }}
                >
                  {[0, 1, 2, 3].map((offset) => {
                    const lineNum = virtualLineOffset + offset;
                    return (
                      <div
                        key={lineNum}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          padding: '5px 0',
                        }}
                      >
                        <span
                          style={{
                            width: `${dynamicGutterWidth}px`,
                            textAlign: 'right',
                            paddingRight: '8px',
                            color: 'var(--lv-accent-bright)',
                            borderRight: '1px solid var(--lv-border-subtle)',
                            marginRight: '10px',
                            transition: 'width 180ms ease',
                          }}
                        >
                          {lineNum}
                        </span>
                        <span style={{ color: 'var(--lv-tok-datetime)', marginRight: '8px' }}>
                          [18:42:{10 + offset}.004]
                        </span>
                        <span style={{ color: 'var(--lv-tok-corr)', marginRight: '8px' }}>
                          [corr-{lineNum}]
                        </span>
                        <span style={{ color: 'var(--lv-text-primary)' }}>60 FPS virtual row</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Plate: Self-Sequencing Vim Navigation Deck */}
            <div className="lv-hardware-plate">
              <div className="lv-plate-header">
                <h3 className="lv-plate-title">
                  <Keyboard size={14} color="#a78bfa" />
                  <span>Vim Keystroke Sequencer</span>
                </h3>
                <span className="lv-spec-chip">
                  ACTIVE: [{VIM_KEYS[activeVimKey].key}] {VIM_KEYS[activeVimKey].label}
                </span>
              </div>

              <div className="lv-plate-content">
                <div className="lv-keycap-grid">
                  {VIM_KEYS.map((item, idx) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`lv-keycap-btn ${activeVimKey === idx ? 'active' : ''}`}
                      onClick={() => setActiveVimKey(idx)}
                    >
                      <span className="lv-keycap-kbd">{item.key}</span>
                      <span className="lv-keycap-lbl">{item.label}</span>
                    </button>
                  ))}
                </div>

                {/* Live Cursor Viewport Driven by the Active Vim Key */}
                <div
                  style={{
                    borderRadius: '6px',
                    background: 'var(--lv-bg-void)',
                    border: '1px solid var(--lv-border-subtle)',
                    padding: '8px',
                    fontFamily: 'var(--lv-font-mono)',
                    fontSize: '11px',
                  }}
                >
                  {SCENARIOS[0].logs.slice(0, 4).map((r, rIdx) => {
                    const isCursor = VIM_KEYS[activeVimKey].rowIdx === rIdx;
                    return (
                      <div
                        key={r.line}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          borderLeft: isCursor
                            ? '2px solid var(--lv-accent-bright)'
                            : '2px solid transparent',
                          background: isCursor ? 'rgba(59, 130, 246, 0.16)' : 'transparent',
                          display: 'flex',
                          justifyContent: 'space-between',
                          transition: 'all 140ms ease',
                        }}
                      >
                        <span>
                          <span style={{ color: 'var(--lv-text-muted)', marginRight: '8px' }}>
                            L{r.line}
                          </span>
                          <span style={{ color: 'var(--lv-tok-workflow)', marginRight: '8px' }}>
                            [{r.workflow}]
                          </span>
                          <span style={{ color: 'var(--lv-text-primary)' }}>{r.op}</span>
                        </span>
                        <span style={{ color: 'var(--lv-tok-duration)' }}>{r.duration}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================================
            DUAL RUNTIME QUICKSTART
           ==================================================================== */}
        <section className="lv-runtime-section lv-reveal-block">
          <div className="lv-runtime-banner">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'flex-start' }}>
              <h2 className="lv-section-title" style={{ fontSize: '1.85rem' }}>
                Standalone Web &amp; Native VS Code Extension.
              </h2>
              <button type="button" className="lv-btn-primary" onClick={onLaunchApp}>
                <Terminal size={15} strokeWidth={1.8} />
                <span>Launch Console</span>
                <ArrowUpRight size={15} strokeWidth={1.8} />
              </button>
            </div>

            <div className="lv-cli-box">
              <div className="lv-cli-head">
                <span>src/api/bridge.ts // EXPRESS + VSCODE IPC</span>
                <button
                  type="button"
                  onClick={handleCopyCli}
                  className="lv-sev-pill"
                  style={{ height: '20px' }}
                >
                  {copiedCli ? <Check size={11} color="#4ade80" /> : <Copy size={11} />}
                  <span>{copiedCli ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="lv-cli-body">
                <div style={{ color: 'var(--lv-text-primary)' }}>
                  <span style={{ color: 'var(--lv-accent-bright)' }}>$</span> npm run dev:all
                </div>
                <div style={{ color: 'var(--lv-text-primary)' }}>
                  <span style={{ color: 'var(--lv-accent-bright)' }}>$</span> npm run package:ext
                </div>
              </div>
            </div>
          </div>

          <footer className="lv-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={13} color="#60a5fa" />
              <span>LogViewer — Obsidian Studio</span>
            </div>
            <div style={{ fontFamily: 'var(--lv-font-mono)' }}>
              <span>Express + SSE · @tanstack/react-virtual · VS Code Webview</span>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
