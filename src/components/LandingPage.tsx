import React, { useState, useEffect, useRef } from 'react';
import '../landing.css';

interface LandingPageProps {
  onLaunchApp: () => void;
}

interface HotspotPin {
  top: string;
  left: string;
  label: string;
}

interface ShowcaseStage {
  id: number;
  badge: string;
  title: string;
  description: string;
  chips: string[];
  hotspots?: HotspotPin[];
}

const STAGES: ShowcaseStage[] = [
  {
    id: 0,
    badge: '01 • System Canvas',
    title: 'Universal Log Stream Engine',
    description: 'Zero-cloud, high-throughput log analysis running 100% locally on your machine with zero data exfiltration.',
    chips: ['100% Air-Gapped', 'Localhost First', '60 FPS Engine'],
    hotspots: [
      { top: '4%', left: '8%', label: 'EconViewer v2.4 Engine' },
      { top: '4%', left: '88%', label: 'Live SLA: 11.15ms' },
    ],
  },
  {
    id: 1,
    badge: '02 • Smart Ingestion',
    title: 'Heuristic Token Classifier',
    description: 'Zero-schema parser decomposes timestamps, bracketed levels, PIDs, TIDs, correlations, and HTTP status codes in real time.',
    chips: ['ISO 8601 & Epoch', '11 Severity Levels', 'Key-Value Parsing'],
    hotspots: [
      { top: '5%', left: '26%', label: 'Smart Regex / Token Search' },
      { top: '5%', left: '52%', label: '11-Level Severity Badges' },
      { top: '5%', left: '86%', label: 'Live Throughput HUD' },
    ],
  },
  {
    id: 2,
    badge: '03 • 60 FPS Virtualizer',
    title: 'TanStack DOM Windowing',
    description: 'Scroll through 1,000,000+ lines at 60 FPS while rendering only 40–80 physical DOM nodes with zero layout thrashing.',
    chips: ['Sub-4ms Query SLA', 'Zero Memory Leaks', '24px/54px Density'],
    hotspots: [
      { top: '28%', left: '42%', label: '[PID:18900] [thread-17]' },
      { top: '46%', left: '56%', label: '[Warehouse.Dispatcher] [SUCCESS]' },
      { top: '62%', left: '68%', label: 'Duration: 185ms' },
    ],
  },
  {
    id: 3,
    badge: '04 • Unified Streams',
    title: 'Multi-Source Interleaver',
    description: 'O(N log K) priority merge sort streams multiple log files and rotated archives (.log.1, .log.2) into a single chronological view.',
    chips: ['Rotated Files', 'Directory Recursion', '100 LPS Live Tail'],
    hotspots: [
      { top: '22%', left: '10%', label: 'Application Workflow (1.3MB)' },
      { top: '56%', left: '10%', label: 'Live Stream (100 LPS)' },
      { top: '78%', left: '10%', label: 'Discovered Files & Subdirs' },
    ],
  },
  {
    id: 4,
    badge: '05 • Latency & Traces',
    title: 'Delta Time Latency & Stack Traces',
    description: 'Measure exact microsecond execution latencies between any two log lines and inspect collapsible exception stack frames.',
    chips: ['T1 → T2 Latency', 'Microsecond Precision', 'Trace Visualizer'],
    hotspots: [
      { top: '60%', left: '45%', label: 'Trace: ServiceException Call Stack' },
      { top: '74%', left: '78%', label: 'Delta Latency Anchor Point' },
    ],
  },
];

const FAQS = [
  {
    q: 'How does LogViewer maintain 60 FPS with 1,000,000+ log lines?',
    a: 'LogViewer uses DOM windowing powered by TanStack Virtual. Regardless of whether your file has 1,000 or 10,000,000 lines, only 40–80 physical DOM elements exist in the browser viewport at any instant, eliminating layout thrashing and memory exhaustion.',
  },
  {
    q: 'Is any log data or telemetry exfiltrated to the cloud?',
    a: 'Zero. LogViewer runs 100% locally on localhost. It makes no external network calls, collects no external analytics, and is fully safe for air-gapped security, HIPAA, GDPR, and proprietary backend environments.',
  },
  {
    q: 'How does the in-memory LRU cache prevent Out-of-Memory (OOM) crashes?',
    a: 'The Express ingestion server parses log streams in 64KB chunks and bounds in-memory parsed entries to a strict 256MB LRU cache. Older or rotated files are automatically evicted when new streams are loaded.',
  },
  {
    q: 'Can I interleave multiple microservice log files chronologically?',
    a: 'Yes! Select multiple files in the sidebar and LogViewer executes an O(N log K) min-heap k-way merge sort, streaming all events into a unified, microsecond-accurate timeline with distinct color-coded source badges.',
  },
];

const LAYOUT_MODES: Array<'1' | '2-col' | '2-row' | '4'> = ['1', '2-col', '2-row', '4'];

const KEYBOARD_SIM_STEPS = [
  { key: 'j / ↓ Down', row: 1, label: 'j / ↓ Down' },
  { key: 'j / ↓ Down', row: 2, label: 'j / ↓ Down' },
  { key: 'k / ↑ Up', row: 1, label: 'k / ↑ Up' },
  { key: 'gg Top', row: 0, label: 'gg Top' },
  { key: 'G Bottom', row: 2, label: 'G Bottom' },
  { key: 'k / ↑ Up', row: 1, label: 'k / ↑ Up' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedRowToast, setCopiedRowToast] = useState(false);
  const [simRowIndex, setSimRowIndex] = useState(1);
  const [activeSimKeyBtn, setActiveSimKeyBtn] = useState<string>('j / ↓ Down');
  const [activeLayoutPreview, setActiveLayoutPreview] = useState<'1' | '2-col' | '2-row' | '4'>('1');
  const [activePayloadFormat, setActivePayloadFormat] = useState<'json' | 'xml'>('json');
  const [jsonNodeOpen, setJsonNodeOpen] = useState(true);
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(0);
  const [lastPhysicalKey, setLastPhysicalKey] = useState<string | null>(null);
  const [pageScrollProgress, setPageScrollProgress] = useState(0);

  // Live telemetry fluctuating vitals
  const [telemetryP50, setTelemetryP50] = useState('11.04');
  const [telemetryP99, setTelemetryP99] = useState('2.49');

  // Section DOM observation
  const showcaseRef = useRef<HTMLElement>(null);
  const bentoRef = useRef<HTMLElement>(null);

  const [isShowcaseInView, setIsShowcaseInView] = useState(false);
  const [isBentoInView, setIsBentoInView] = useState(false);

  // Pause locks when user manually hovers or clicks
  const [pauseShowcase, setPauseShowcase] = useState(false);
  const [pauseLayout, setPauseLayout] = useState(false);
  const [pauseKeyboard, setPauseKeyboard] = useState(false);
  const [pausePayload, setPausePayload] = useState(false);

  // Ensure window/body scrolling is completely unlocked on landing page
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.body.style.overflowX = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overflowX = '';
    };
  }, []);

  // Top specular scroll progress bar listener
  useEffect(() => {
    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setPageScrollProgress(Math.max(0, Math.min(1, window.scrollY / docHeight)));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // IntersectionObserver: Detect when sections enter DOM viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === showcaseRef.current) {
            setIsShowcaseInView(entry.isIntersecting);
          } else if (entry.target === bentoRef.current) {
            setIsBentoInView(entry.isIntersecting);
          }
        });
      },
      { threshold: 0.15 }
    );

    if (showcaseRef.current) observer.observe(showcaseRef.current);
    if (bentoRef.current) observer.observe(bentoRef.current);

    return () => observer.disconnect();
  }, []);

  // 1. Showcase Auto-Cycle when in DOM viewport
  useEffect(() => {
    if (!isShowcaseInView || pauseShowcase) return;
    const interval = setInterval(() => {
      setActiveStageIndex(prev => (prev + 1) % STAGES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isShowcaseInView, pauseShowcase]);

  // 2. Spatial Multi-Panel Auto-Move (1-Panel -> 2-Col -> 2-Row -> 4-Grid)
  useEffect(() => {
    if (!isBentoInView || pauseLayout) return;
    const interval = setInterval(() => {
      setActiveLayoutPreview(prev => {
        const nextIdx = (LAYOUT_MODES.indexOf(prev) + 1) % LAYOUT_MODES.length;
        return LAYOUT_MODES[nextIdx];
      });
    }, 2600);
    return () => clearInterval(interval);
  }, [isBentoInView, pauseLayout]);

  // 3. 28 Keyboard Shortcuts Auto-Step when in DOM viewport
  useEffect(() => {
    if (!isBentoInView || pauseKeyboard) return;
    let stepIdx = 0;
    const interval = setInterval(() => {
      stepIdx = (stepIdx + 1) % KEYBOARD_SIM_STEPS.length;
      const curStep = KEYBOARD_SIM_STEPS[stepIdx];
      setSimRowIndex(curStep.row);
      setActiveSimKeyBtn(curStep.key);
      setLastPhysicalKey(`Auto Demo (${curStep.label})`);
    }, 2000);
    return () => clearInterval(interval);
  }, [isBentoInView, pauseKeyboard]);

  // 4. Dual JSON / XML Inspector Auto-Toggle when in DOM viewport
  useEffect(() => {
    if (!isBentoInView || pausePayload) return;
    const interval = setInterval(() => {
      setActivePayloadFormat(prev => (prev === 'json' ? 'xml' : 'json'));
    }, 3400);
    return () => clearInterval(interval);
  }, [isBentoInView, pausePayload]);

  // 5. System Health Telemetry Live Vitals Fluctuations
  useEffect(() => {
    if (!isBentoInView) return;
    const interval = setInterval(() => {
      setTelemetryP50((10.8 + Math.random() * 0.45).toFixed(2));
      setTelemetryP99((2.15 + Math.random() * 0.45).toFixed(2));
    }, 1800);
    return () => clearInterval(interval);
  }, [isBentoInView]);

  // Physical keyboard listener for live interactive tester
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        setSimRowIndex(prev => Math.min(2, prev + 1));
        setActiveSimKeyBtn('j / ↓ Down');
        setLastPhysicalKey('j / ↓ Down');
        setPauseKeyboard(true);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        setSimRowIndex(prev => Math.max(0, prev - 1));
        setActiveSimKeyBtn('k / ↑ Up');
        setLastPhysicalKey('k / ↑ Up');
        setPauseKeyboard(true);
      } else if (e.key === 'g') {
        setSimRowIndex(0);
        setActiveSimKeyBtn('gg Top');
        setLastPhysicalKey('gg Top');
        setPauseKeyboard(true);
      } else if (e.key === 'G') {
        setSimRowIndex(2);
        setActiveSimKeyBtn('G Bottom');
        setLastPhysicalKey('G Bottom');
        setPauseKeyboard(true);
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const layoutMap: Record<string, '1' | '2-col' | '2-row' | '4'> = {
          '1': '1',
          '2': '2-col',
          '3': '2-row',
          '4': '4',
        };
        setActiveLayoutPreview(layoutMap[e.key]);
        setLastPhysicalKey(`Alt + ${e.key} Layout`);
        setPauseLayout(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const copyCliCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const copyRowLine = () => {
    navigator.clipboard.writeText('[2026-09-02 00:18:11.079] [18900] [Warehouse.Dispatcher] [PENDING] 286ms');
    setActiveSimKeyBtn('Ctrl+C Copy');
    setCopiedRowToast(true);
    setTimeout(() => setCopiedRowToast(false), 1800);
  };

  const activeStage = STAGES[activeStageIndex];

  return (
    <div className="lp-root">
      {/* Top Specular Scroll Progress Indicator */}
      <div
        className="lp-top-progress-bar"
        style={{ width: `${Math.round(pageScrollProgress * 100)}%` }}
      />

      {/* Background Lighting & Grid Overlays */}
      <div className="lp-ambient-bg" />
      <div className="lp-grid-overlay" />

      <div className="lp-content-wrapper">
        {/* Navigation Header */}
        <header className="lp-navbar">
          <div className="lp-nav-container">
            <a href="#hero" className="lp-brand">
              <div className="lp-brand-icon">⚡</div>
              <span>LogViewer</span>
              <span className="lp-version-pill">v2.4</span>
            </a>

            <nav>
              <ul className="lp-nav-links">
                <li><a href="#showcase" className="lp-nav-link">Interactive Tour</a></li>
                <li><a href="#capabilities" className="lp-nav-link">Capabilities</a></li>
                <li><a href="#comparison" className="lp-nav-link">Comparison</a></li>
                <li><a href="#faq" className="lp-nav-link">FAQ</a></li>
              </ul>
            </nav>

            <div className="lp-nav-actions">
              <a
                href="https://github.com/amansaxna/LogViewer"
                target="_blank"
                rel="noreferrer"
                className="lp-btn-secondary"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                <span>GitHub</span>
              </a>

              <button
                onClick={onLaunchApp}
                className="lp-btn-primary"
                id="lp-nav-launch-btn"
              >
                <span>Launch App</span>
                <span>🚀</span>
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section id="hero" className="lp-hero">
          <div className="lp-hero-badge">
            <span className="lp-live-pulse" />
            <span>High-Throughput Local Log Observability & Telemetry</span>
          </div>

          <h1 className="lp-hero-title">
            Log Observability at the <br />
            <span className="lp-gradient-text">Speed of Light.</span>
          </h1>

          <p className="lp-hero-subhead">
            Zero-cloud, 60 FPS virtualized rendering, heuristic token intelligence,
            and spatial multi-panel workspaces running 100% locally on your machine.
          </p>

          <div className="lp-hero-ctas">
            <button
              onClick={onLaunchApp}
              className="lp-hero-btn-launch"
              id="lp-hero-launch-btn"
            >
              <span>Launch EconViewer</span>
              <span style={{ fontSize: '1.2rem' }}>→</span>
            </button>

            <button
              onClick={() => copyCliCommand('git clone https://github.com/amansaxna/LogViewer.git && cd LogViewer && make dev')}
              className="lp-hero-btn-cli"
              title="Click to copy CLI launch command"
            >
              <span className="lp-cli-prefix">$</span>
              <span>make dev</span>
              <span style={{ opacity: 0.6 }}>{copiedCli ? '✓ Copied' : '📋'}</span>
            </button>
          </div>

          {/* Metric Pills Strip */}
          <div className="lp-metric-strip">
            <div className="lp-metric-pill">
              <span>⚡</span>
              <span><strong>60 FPS</strong> Virtualized Scroller</span>
            </div>
            <div className="lp-metric-pill">
              <span>⏱️</span>
              <span><strong>&lt; 4ms</strong> Query Response SLA</span>
            </div>
            <div className="lp-metric-pill">
              <span>🛡️</span>
              <span><strong>100% Air-Gapped</strong> Zero Cloud Egress</span>
            </div>
            <div className="lp-metric-pill">
              <span>🔍</span>
              <span><strong>0-Config</strong> Heuristic Token Parser</span>
            </div>
          </div>
        </section>

        {/* Universal Ecosystem & Formats Compatibility Strip */}
        <section className="lp-ecosystem-section">
          <div className="lp-ecosystem-label">Zero-Config Support For Arbitrary Flat & Structured Logs</div>
          <div className="lp-ecosystem-pills">
            <span className="lp-eco-pill">⚡ JSON Lines (.jsonl)</span>
            <span className="lp-eco-pill">📋 RFC 5424 Syslog</span>
            <span className="lp-eco-pill">🕒 ISO 8601 & Epoch</span>
            <span className="lp-eco-pill">☕ Java Spring / Logback</span>
            <span className="lp-eco-pill">🐹 Go Zap & Logrus</span>
            <span className="lp-eco-pill">🐍 Python Tracebacks</span>
            <span className="lp-eco-pill">📦 XML SOAP Envelopes</span>
            <span className="lp-eco-pill">🌐 W3C / Nginx Access Logs</span>
          </div>
        </section>

        {/* ==================================================================
            INTERACTIVE PRODUCT SHOWCASE SECTION (Auto-Cycles on DOM Enter)
            ================================================================== */}
        <section
          id="showcase"
          ref={showcaseRef}
          className="lp-showcase-section"
          onMouseEnter={() => setPauseShowcase(true)}
          onMouseLeave={() => setPauseShowcase(false)}
        >
          {/* Interactive Feature Selector Tabs */}
          <div className="lp-showcase-tabs">
            {STAGES.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveStageIndex(idx);
                  setPauseShowcase(true);
                }}
                className={`lp-showcase-tab ${idx === activeStageIndex ? 'active' : ''}`}
              >
                <span className="lp-tab-num">{`0${idx + 1}`}</span>
                <span>{s.title}</span>
              </button>
            ))}
          </div>

          {/* Centered High-Fidelity macOS Window Frame */}
          <div className="lp-showcase-frame">
            {/* Titlebar */}
            <div className="lp-showcase-titlebar">
              <div className="lp-window-controls">
                <span className="lp-win-btn lp-win-close" />
                <span className="lp-win-btn lp-win-min" />
                <span className="lp-win-btn lp-win-max" />
              </div>
              <span className="lp-window-title">EconViewer v2.4 • Universal Log Stream Engine</span>
              <span className="lp-window-chip">60 FPS Virtualized</span>
            </div>

            {/* Window Body with Crisp UI Image and Spotlight Overlays */}
            <div className="lp-showcase-body">
              <img
                src="/Viewer.png"
                alt="EconViewer Log Observability UI"
                className="lp-showcase-img"
              />

              {/* Dynamic Illuminated Spotlight Bounding Box */}
              <div className={`lp-spotlight-box lp-spotlight-stage-${activeStage.id}`} />

              {/* Radar Pins with Architecture Tooltips */}
              {activeStage.hotspots?.map((pin, i) => (
                <div
                  key={i}
                  className="lp-hotspot"
                  style={{ top: pin.top, left: pin.left }}
                >
                  <div className="lp-radar-pin">
                    <span className="lp-radar-core" />
                    <span className="lp-radar-ring" />
                    <span className="lp-hotspot-tag">{pin.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature Narrative Card Underneath */}
          <div className="lp-showcase-narrative" key={activeStage.id}>
            <div className="lp-narrative-left">
              <div className="lp-narrative-badge">{activeStage.badge}</div>
              <h3 className="lp-narrative-title">{activeStage.title}</h3>
              <p className="lp-narrative-desc">{activeStage.description}</p>
              <div className="lp-narrative-chips">
                {activeStage.chips.map((chip, i) => (
                  <span key={i} className="lp-chip">{chip}</span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => {
                  setActiveStageIndex(prev => (prev === 0 ? STAGES.length - 1 : prev - 1));
                  setPauseShowcase(true);
                }}
                className="lp-btn-secondary"
                style={{ padding: '0.45rem 0.85rem' }}
                title="Previous Feature"
              >
                ‹ Previous
              </button>
              <button
                onClick={() => {
                  setActiveStageIndex(prev => (prev + 1) % STAGES.length);
                  setPauseShowcase(true);
                }}
                className="lp-btn-secondary"
                style={{ padding: '0.45rem 0.85rem' }}
                title="Next Feature"
              >
                Next ›
              </button>
            </div>
          </div>
        </section>

        {/* ==================================================================
            INTERACTIVE BENTO GRID (Auto-Steps Buttons & Previews on DOM Enter)
            ================================================================== */}
        <section id="capabilities" ref={bentoRef} className="lp-bento-section">
          <div className="lp-section-header">
            <div className="lp-section-tag">High-Performance Architecture</div>
            <h2 className="lp-section-title">Engineered for Massive Scale & Velocity</h2>
            <p className="lp-section-subhead">
              Every component is crafted for sub-millisecond precision, tactile ergonomics,
              and uncompromising stability.
            </p>
          </div>

          <div className="lp-bento-grid">
            {/* Bento Card 1: 28 Keyboard Shortcuts Simulator (Auto-Steps Lines & Keys) */}
            <div
              className="lp-bento-card lp-bento-card-7"
              onMouseEnter={() => setPauseKeyboard(true)}
              onMouseLeave={() => setPauseKeyboard(false)}
            >
              <div className="lp-bento-icon-header">
                <div className="lp-bento-icon">⌨️</div>
                <h3 className="lp-bento-title">28 Precision Keyboard Shortcuts</h3>
              </div>
              <p className="lp-bento-desc">
                100% mouse-free workflow. Try pressing keys on your physical keyboard (or watch auto-demo below):
              </p>

              <div className="lp-keyboard-tester">
                <div className="lp-sim-top-bar">
                  <span className="lp-phys-key-badge">
                    <span>⚡ Key Simulation</span>
                    {lastPhysicalKey && <span>({lastPhysicalKey})</span>}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Live Interactive HUD</span>
                </div>

                <div className="lp-keys-row">
                  <button
                    onClick={() => {
                      setSimRowIndex(prev => Math.max(0, prev - 1));
                      setActiveSimKeyBtn('k / ↑ Up');
                      setPauseKeyboard(true);
                    }}
                    className={`lp-key-btn ${activeSimKeyBtn === 'k / ↑ Up' ? 'active' : ''}`}
                  >
                    k / ↑ Up
                  </button>
                  <button
                    onClick={() => {
                      setSimRowIndex(prev => Math.min(2, prev + 1));
                      setActiveSimKeyBtn('j / ↓ Down');
                      setPauseKeyboard(true);
                    }}
                    className={`lp-key-btn ${activeSimKeyBtn === 'j / ↓ Down' ? 'active' : ''}`}
                  >
                    j / ↓ Down
                  </button>
                  <button
                    onClick={() => {
                      setSimRowIndex(0);
                      setActiveSimKeyBtn('gg Top');
                      setPauseKeyboard(true);
                    }}
                    className={`lp-key-btn ${activeSimKeyBtn === 'gg Top' ? 'active' : ''}`}
                  >
                    gg Top
                  </button>
                  <button
                    onClick={() => {
                      setSimRowIndex(2);
                      setActiveSimKeyBtn('G Bottom');
                      setPauseKeyboard(true);
                    }}
                    className={`lp-key-btn ${activeSimKeyBtn === 'G Bottom' ? 'active' : ''}`}
                  >
                    G Bottom
                  </button>
                  <button
                    onClick={() => {
                      copyRowLine();
                      setPauseKeyboard(true);
                    }}
                    className={`lp-key-btn ${activeSimKeyBtn === 'Ctrl+C Copy' ? 'active' : ''}`}
                  >
                    {copiedRowToast ? '✓ Copied' : 'Ctrl+C Copy'}
                  </button>
                </div>

                <div className="lp-sim-table">
                  <div className={`lp-sim-row ${simRowIndex === 0 ? 'active' : ''}`}>
                    <span>[2026-09-02 00:18:10.856] [18906] [Security.Firewall]</span>
                    <span style={{ color: '#10b981' }}>[SUCCESS] 178ms</span>
                  </div>
                  <div className={`lp-sim-row ${simRowIndex === 1 ? 'active' : ''}`}>
                    <span>[2026-09-02 00:18:11.079] [18900] [Warehouse.Dispatcher]</span>
                    <span style={{ color: '#00f2fe' }}>[PENDING] 286ms</span>
                  </div>
                  <div className={`lp-sim-row ${simRowIndex === 2 ? 'active' : ''}`}>
                    <span>[2026-09-02 00:18:12.857] [18903] [Auth.TokenProvider]</span>
                    <span style={{ color: '#ef4444' }}>[FAILED] 317ms</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Card 2: 4-Quadrant Spatial Workspace (Auto-Cycles 1 -> 2-Col -> 2-Row -> 4-Grid) */}
            <div
              className="lp-bento-card lp-bento-card-5"
              onMouseEnter={() => setPauseLayout(true)}
              onMouseLeave={() => setPauseLayout(false)}
            >
              <div className="lp-bento-icon-header">
                <div className="lp-bento-icon">🪟</div>
                <h3 className="lp-bento-title">Spatial Multi-Panel Grid</h3>
              </div>
              <p className="lp-bento-desc">
                Split workspaces into 1, 2-column, 2-row, or 4-quadrant layouts with isolated filters:
              </p>

              <div className="lp-grid-switcher">
                {LAYOUT_MODES.map(mode => (
                  <button
                    key={mode}
                    onClick={() => {
                      setActiveLayoutPreview(mode);
                      setPauseLayout(true);
                    }}
                    className={`lp-grid-tab ${activeLayoutPreview === mode ? 'active' : ''}`}
                  >
                    {mode === '1' ? '1-Panel' : mode === '2-col' ? '2-Col' : mode === '2-row' ? '2-Row' : '4-Grid'}
                  </button>
                ))}
              </div>

              <div className={`lp-grid-preview-box lp-grid-p${activeLayoutPreview}`}>
                <div className="lp-grid-cell active-cell">P1: Gateway</div>
                {(activeLayoutPreview === '2-col' || activeLayoutPreview === '4') && (
                  <div className="lp-grid-cell">P2: Auth</div>
                )}
                {activeLayoutPreview === '2-row' && (
                  <div className="lp-grid-cell">P2: Database</div>
                )}
                {activeLayoutPreview === '4' && (
                  <>
                    <div className="lp-grid-cell">P3: DB Pool</div>
                    <div className="lp-grid-cell">P4: Redis</div>
                  </>
                )}
              </div>
            </div>

            {/* Bento Card 3: Dual JSON / XML Inspector Demo (Auto-Toggles JSON & XML) */}
            <div
              className="lp-bento-card lp-bento-card-6"
              onMouseEnter={() => setPausePayload(true)}
              onMouseLeave={() => setPausePayload(false)}
            >
              <div className="lp-bento-icon-header">
                <div className="lp-bento-icon">📦</div>
                <h3 className="lp-bento-title">Embedded JSON & XML Inspector</h3>
              </div>
              <p className="lp-bento-desc">
                Interactive node tree with syntax validation, minification, and instant JSON path copying:
              </p>

              <div className="lp-payload-header">
                <div className="lp-format-tabs">
                  <button
                    onClick={() => {
                      setActivePayloadFormat('json');
                      setPausePayload(true);
                    }}
                    className={`lp-format-tab ${activePayloadFormat === 'json' ? 'active' : ''}`}
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => {
                      setActivePayloadFormat('xml');
                      setPausePayload(true);
                    }}
                    className={`lp-format-tab ${activePayloadFormat === 'xml' ? 'active' : ''}`}
                  >
                    XML SOAP
                  </button>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#10b981' }}>✓ Valid Syntax</span>
              </div>

              {activePayloadFormat === 'json' ? (
                <div className="lp-json-preview">
                  <div>
                    <span
                      onClick={() => setJsonNodeOpen(!jsonNodeOpen)}
                      style={{ cursor: 'pointer', userSelect: 'none', marginRight: '6px' }}
                    >
                      {jsonNodeOpen ? '▼' : '▶'}
                    </span>
                    <span className="lp-j-key">"responsePayload"</span>: &#123;
                  </div>
                  {jsonNodeOpen && (
                    <div style={{ paddingLeft: '1.25rem' }}>
                      <div><span className="lp-j-key">"status"</span>: <span className="lp-j-num">200</span>,</div>
                      <div><span className="lp-j-key">"correlationId"</span>: <span className="lp-j-str">"corr-84-429"</span>,</div>
                      <div><span className="lp-j-key">"durationMs"</span>: <span className="lp-j-num">14.2</span>,</div>
                      <div><span className="lp-j-key">"authenticated"</span>: <span className="lp-j-bool">true</span></div>
                    </div>
                  )}
                  <div>&#125;</div>
                </div>
              ) : (
                <div className="lp-json-preview">
                  <div><span className="lp-j-xml-tag">&lt;soapenv:Envelope&gt;</span></div>
                  <div style={{ paddingLeft: '1.25rem' }}>
                    <div><span className="lp-j-xml-tag">&lt;AuditHeader</span> <span className="lp-j-key">corrId</span>=<span className="lp-j-str">"soap-88-429"</span> <span className="lp-j-xml-tag">/&gt;</span></div>
                    <div><span className="lp-j-xml-tag">&lt;Status&gt;</span><span className="lp-j-xml-val">SUCCESS</span><span className="lp-j-xml-tag">&lt;/Status&gt;</span></div>
                  </div>
                  <div><span className="lp-j-xml-tag">&lt;/soapenv:Envelope&gt;</span></div>
                </div>
              )}
            </div>

            {/* Bento Card 4: System Health & Telemetry with Live Animated Oscilloscope Wave */}
            <div className="lp-bento-card lp-bento-card-6">
              <div className="lp-bento-icon-header">
                <div className="lp-bento-icon">📊</div>
                <h3 className="lp-bento-title">Native System Health Telemetry</h3>
              </div>
              <p className="lp-bento-desc">
                Continuous sampling of Node.js Event Loop Lag (P50/P95/P99) and V8 heap vitals:
              </p>

              <div className="lp-telemetry-box">
                {/* Pulsing Circular Health Score Gauge */}
                <div className="lp-score-circle-wrapper">
                  <div className="lp-score-orbit-beacon" />
                  <div className="lp-score-circle">
                    <span className="lp-score-val">100</span>
                    <span className="lp-score-label">
                      <span className="lp-score-live-dot" />
                      <span>Optimal</span>
                    </span>
                  </div>
                </div>

                {/* Real-time Vitals & Flowing ECG Wave */}
                <div className="lp-vitals-col">
                  <div className="lp-vital-item">
                    <span>Event Loop P50:</span>
                    <span className="lp-vital-val" style={{ color: '#00f2fe' }}>{telemetryP50} ms</span>
                  </div>
                  <div className="lp-vital-item">
                    <span>Query SLA P99:</span>
                    <span className="lp-vital-val" style={{ color: '#10b981' }}>{telemetryP99} ms</span>
                  </div>

                  {/* Flowing Real-Time Waveform Oscilloscope */}
                  <div className="lp-sparkline-track-wrapper" title="Real-time Node.js Event Loop SLA Stream">
                    <div className="lp-sparkline-gridline" />
                    <svg
                      className="lp-sparkline-flowing-svg"
                      viewBox="0 0 400 36"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="lpWaveGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.4" />
                          <stop offset="40%" stopColor="#00f2fe" stopOpacity="0.9" />
                          <stop offset="80%" stopColor="#38bdf8" stopOpacity="1" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
                        </linearGradient>
                        <linearGradient id="lpAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#00f2fe" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Repeating continuous sine wave (2 cycles of 200px = 400px seamless loop) */}
                      <path
                        className="lp-wave-fill"
                        d="M 0,18 Q 25,6 50,18 T 100,18 Q 125,30 150,18 T 200,18 Q 225,6 250,18 T 300,18 Q 325,30 350,18 T 400,18 L 400,36 L 0,36 Z"
                      />
                      <path
                        className="lp-wave-stroke"
                        d="M 0,18 Q 25,6 50,18 T 100,18 Q 125,30 150,18 T 200,18 Q 225,6 250,18 T 300,18 Q 325,30 350,18 T 400,18"
                      />
                    </svg>
                    <div className="lp-sparkline-glow-dot" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            ARCHITECTURAL COMPARISON MATRIX SECTION
            ================================================================== */}
        <section id="comparison" className="lp-comparison-section">
          <div className="lp-section-header">
            <div className="lp-section-tag">Value Proposition</div>
            <h2 className="lp-section-title">Why SREs & Developers Choose LogViewer</h2>
            <p className="lp-section-subhead">
              The sweet spot between heavy cloud platforms and minimal command-line utilities.
            </p>
          </div>

          <div className="lp-comp-table-card">
            <table className="lp-comp-table">
              <thead>
                <tr>
                  <th>Dimension</th>
                  <th className="highlight-col">⚡ LogViewer</th>
                  <th>☁️ Cloud Observability (Datadog/Splunk)</th>
                  <th>💻 CLI (grep / tail -f)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Data Privacy & Egress</strong></td>
                  <td className="highlight-col" style={{ color: '#10b981' }}>100% Air-Gapped (Localhost)</td>
                  <td>Remote Cloud Ingestion</td>
                  <td>Localhost</td>
                </tr>
                <tr>
                  <td><strong>Rendering Performance</strong></td>
                  <td className="highlight-col" style={{ color: '#00f2fe' }}>60 FPS DOM Windowing (1M+ lines)</td>
                  <td>Heavy Browser Lag on Dumps</td>
                  <td>Terminal Buffer Truncation</td>
                </tr>
                <tr>
                  <td><strong>Spatial Workspaces</strong></td>
                  <td className="highlight-col">1 to 4 Quadrants Side-by-Side</td>
                  <td>Multiple Browser Tabs</td>
                  <td>Split TMux Panes</td>
                </tr>
                <tr>
                  <td><strong>Delta Latency (T1 → T2)</strong></td>
                  <td className="highlight-col">1-Click Microsecond HUD</td>
                  <td>Complex Analytics Queries</td>
                  <td>Manual Epoch Math</td>
                </tr>
                <tr>
                  <td><strong>Cost & Licensing</strong></td>
                  <td className="highlight-col" style={{ color: '#10b981' }}>$0 Free & MIT Open-Source</td>
                  <td>$$$$ Per GB Egress / Month</td>
                  <td>$0 Free</td>
                </tr>
                <tr>
                  <td><strong>Initial Setup Time</strong></td>
                  <td className="highlight-col">0 Seconds (<code>make dev</code>)</td>
                  <td>Days to Weeks</td>
                  <td>0 Seconds</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ==================================================================
            DEVELOPER FAQ ACCORDION SECTION
            ================================================================== */}
        <section id="faq" className="lp-faq-section">
          <div className="lp-section-header">
            <div className="lp-section-tag">Architecture & FAQ</div>
            <h2 className="lp-section-title">Frequently Asked Questions</h2>
          </div>

          <div className="lp-faq-list">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="lp-faq-item">
                <div
                  className="lp-faq-question"
                  onClick={() => setActiveFaqIndex(activeFaqIndex === idx ? null : idx)}
                >
                  <span>{faq.q}</span>
                  <span className="lp-faq-icon">
                    {activeFaqIndex === idx ? '▲' : '▼'}
                  </span>
                </div>
                {activeFaqIndex === idx && (
                  <div className="lp-faq-answer">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ==================================================================
            QUICKSTART TERMINAL & BLUEPRINT SECTION
            ================================================================== */}
        <section id="quickstart" className="lp-terminal-section">
          <div className="lp-section-header">
            <div className="lp-section-tag">Ready in Seconds</div>
            <h2 className="lp-section-title">Start Triage in Under 30 Seconds</h2>
            <p className="lp-section-subhead">
              Zero cloud setup. Clone the repo and run with native parallel Make commands.
            </p>
          </div>

          <div className="lp-cli-window">
            <div className="lp-window-titlebar">
              <div className="lp-window-controls">
                <span className="lp-win-btn lp-win-close" />
                <span className="lp-win-btn lp-win-min" />
                <span className="lp-win-btn lp-win-max" />
              </div>
              <span className="lp-window-title">bash — 80x24</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>localhost</span>
            </div>

            <div className="lp-cli-body">
              <div className="lp-cli-cmd">
                <span>
                  <span style={{ color: '#10b981' }}>➜ </span>
                  <span style={{ color: '#00f2fe' }}>git clone</span> https://github.com/amansaxna/LogViewer.git
                </span>
              </div>
              <div className="lp-cli-cmd">
                <span>
                  <span style={{ color: '#10b981' }}>➜ </span>
                  <span style={{ color: '#00f2fe' }}>cd</span> LogViewer && <span style={{ color: '#00f2fe' }}>make dev</span>
                </span>
                <button
                  onClick={() => copyCliCommand('git clone https://github.com/amansaxna/LogViewer.git && cd LogViewer && make dev')}
                  className="lp-cli-copy-btn"
                >
                  {copiedCli ? '✓ Copied' : '📋 Copy All'}
                </button>
              </div>
              <div className="lp-cli-output">
                <div>[backend] Server listening on http://localhost:3001</div>
                <div>[frontend] Vite dev server ready at http://localhost:3002</div>
                <div style={{ color: '#10b981' }}>✓ All 14 test suites passing (100% success)</div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="lp-footer">
          <div className="lp-footer-inner">
            <div className="lp-footer-left">
              <div className="lp-brand" style={{ fontSize: '1rem' }}>
                <div className="lp-brand-icon" style={{ width: '24px', height: '24px', fontSize: '0.8rem' }}>⚡</div>
                <span>LogViewer (EconViewer v2.4)</span>
              </div>
              <p className="lp-footer-copy">
                High-throughput, local-first structured log analysis workspace. MIT Licensed.
              </p>
            </div>

            <ul className="lp-footer-links">
              <li>
                <button
                  onClick={onLaunchApp}
                  style={{ background: 'none', border: 'none', color: '#00f2fe', cursor: 'pointer', fontWeight: 600 }}
                >
                  Launch App 🚀
                </button>
              </li>
              <li><a href="https://github.com/amansaxna/LogViewer" target="_blank" rel="noreferrer" className="lp-footer-link">GitHub</a></li>
              <li><a href="https://github.com/amansaxna/LogViewer/blob/main/docs/blueprint/HLD.md" target="_blank" rel="noreferrer" className="lp-footer-link">HLD Blueprint</a></li>
              <li><a href="https://github.com/amansaxna/LogViewer/blob/main/docs/blueprint/LLD.md" target="_blank" rel="noreferrer" className="lp-footer-link">LLD Blueprint</a></li>
              <li><a href="https://github.com/amansaxna/LogViewer/blob/main/docs/blueprint/FEATURE_LIST.md" target="_blank" rel="noreferrer" className="lp-footer-link">Feature Matrix</a></li>
            </ul>
          </div>
        </footer>
      </div>
    </div>
  );
};
