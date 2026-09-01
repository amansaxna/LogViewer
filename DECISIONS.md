# Architectural Decision Records (ADR) - LogViewer

This document captures the architectural decisions made during the design and implementation of the LogViewer service.

---

## ADR-001: Technology Stack Selection (Node.js/Express + React/Vite)
- **Status**: Accepted
- **Context**: The user requires a local log viewer running on `localhost`, capable of high-performance file reading, token extraction, live streaming, and rich UI presentation inspired by OpCodes Log Viewer and LogViewer.io.
- **Decision**:
  - **Backend**: Node.js (v22+) with Express and TypeScript (`tsx`). Node provides native streaming filesystem APIs (`fs.createReadStream`, `fs.watchFile`), low resource footprint, and frictionless cross-platform local hosting on macOS.
  - **Frontend**: Vite + React 19 + TypeScript. Vite provides sub-second HMR, optimal asset tree-shaking, and seamless proxying to the local backend.
- **Consequences**: Easy installation with `npm install` and zero external service dependencies.

---

## ADR-002: TanStack Virtual for DOM Virtualization
- **Status**: Accepted
- **Context**: Production log files frequently contain 10,000 to 500,000+ lines. Rendering raw DOM nodes for all items degrades performance, causes memory bloat, and drops UI frame rates.
- **Decision**: Adopt `@tanstack/react-virtual` with dynamic row height measurement. Only items currently within the active viewport (plus a 20-row overscan buffer) are rendered in the DOM.
- **Consequences**: Smooth 60 FPS scrolling regardless of file length, sub-millisecond scrolling latency, and minimal DOM node memory footprint.

---

## ADR-003: Permissive Bracket Tokenizer with Graceful Fallback
- **Status**: Accepted
- **Context**: The user specified the flat file log format:
  `[Datetime] [Process ID] [Thread ID] [Namespace] [WorkflowMarkers] [operations] [Status] [Duration] Message [FileName::LineNumner]`
  With the explicit constraint that any of these attributes may or may not be present on any line, and lines may have no timestamps, missing markers, or be raw crash dumps.
- **Decision**:
  Implement a multi-pass heuristic tokenizer (`server/parser.ts`):
  1. Detects continuation / stack trace lines (indented lines or exception keywords) and merges them into the preceding entry's `trace` object.
  2. Extracts trailing `[FileName::LineNumber]` via regex match.
  3. Scans leading brackets and assigns tokens via pattern classification (ISO date, numeric PID, thread format, workflow prefix, HTTP/action verb, duration unit, status keyword).
  4. If zero brackets exist, treats the whole line as `message` and infers severity level via keyword scanning.
- **Consequences**: Completely crash-resistant. The parser never fails or discards lines, even on non-conforming or corrupted log data.

---

## ADR-004: Server-Sent Events (SSE) for Real-Time Live Tail
- **Status**: Accepted
- **Context**: Users need real-time updates when log files are written to during local debugging, with pause/play capability and low overhead.
- **Decision**: Implement an SSE endpoint (`/api/logs/stream?sourceId=...`). The server monitors file mtime/size and pushes lightweight event notifications (`file_changed`). The client re-queries updated entries smoothly without full page reloads.
- **Consequences**: Simpler than full bidirectional WebSockets for a read-only stream, works across all browsers natively via `EventSource`, and reconnects automatically.

---

## ADR-005: Dual Source Model (Preloaded JSON Config + Dynamic File Opening)
- **Status**: Accepted
- **Context**: The user needs pre-defined standard log paths loaded automatically at startup, while also allowing arbitrary local files to be opened on demand.
- **Decision**:
  - `config/log_sources.json` defines permanent standard sources organized by category.
  - `/api/sources/open` registers any local path dynamically into the session's active source registry.
  - UI provides an "Open Local File" modal with path input and presets.
- **Consequences**: Satisfies both out-of-the-box consistency for team setups and ad-hoc file inspection.

---

## ADR-006: Vanilla CSS Design System with HSL Tokens
- **Status**: Accepted
- **Context**: Rich visual design matching OpCodes Log Viewer (glassmorphism, vibrant level badges, dark/light themes, monospace fonts) without heavy CSS framework dependencies.
- **Decision**: Build a custom CSS token system in `src/index.css` with CSS custom properties (`--bg-app`, `--lvl-error`, etc.), dark theme by default, and responsive styling.
- **Consequences**: Zero framework bundle overhead, immediate styling control, and seamless dark/light switching.

---

## ADR-007: Dual Filter Toolbar & Match Navigation (Screenshot 12.37.56)
- **Status**: Accepted
- **Context**: The user provided reference Screenshot 12.37.56 requiring a dual filter system (Marker filter + Search filter), match navigation (`<` and `>` with `1 / 623` match counter), and "Go to line" jumping.
- **Decision**: Implement independent `marker` and `search` query parameters on the backend, paired with a match index tracker and `virtualizer.scrollToIndex` in the frontend for instantaneous match navigation.
- **Consequences**: Matches the reference UI layout with sub-millisecond keyboard and button navigation.

---

## ADR-008: High-Density Token Syntax Coloring in Compact View
- **Status**: Accepted
- **Context**: Raw monochrome log feeds are hard to parse visually. The user requested color coding for logs to make them more visible, matching Screenshot 12.37.56 and VSCode syntax highlighting.
- **Decision**: Tokenize the line in `CompactLogRow.tsx` with dedicated HSL color accents:
  - Datetime: Cyan `#00e5ff`
  - PID/TID: Muted slate `#94a3b8`
  - Namespace: Soft blue `#7dd3fc`
  - Markers: Purple `#c084fc`
  - Operations / HTTP verbs: Bright Orange `#ff9800`
  - Statuses: Red (FAILED), Amber (WARN), Green (SUCCESS), Sky (INFO)
  - Durations: Bright Gold `#facc15`
  - Selected line: Yellow left indicator bar `#facc15`
- **Consequences**: Greatly increased scannability and visual contrast.

---

## ADR-009: Marker Sorting Engine
- **Status**: Accepted
- **Context**: Users need to group and sort logs by workflow markers (e.g. `WF:InventoryAudit`, `WF:RefundProcess`), line numbers, duration, or timestamps.
- **Decision**: Added `sortBy` and `sortOption` to `server/fileReader.ts` supporting `marker-asc`, `marker-desc`, `duration-desc`, `duration-asc`, `time-desc`, `time-asc`, `line-asc`, and `line-desc`.
- **Consequences**: Allows inspecting workflow progression and slowest transactions in one click.

---

## ADR-010: Document-Active Workflow & Operation Dropdown Toggles
- **Status**: Accepted
- **Context**: Users need pills/dropdown toggles similar to the severity level pills to inspect and filter by all active workflows and operations present in the current document.
- **Decision**: Dynamically compute `workflowCounts` and `operationCounts` in `server/fileReader.ts` across all entries in the active document. Expose two pill dropdown toggles in `Topbar.tsx` (purple for Workflows, orange for Operations) displaying live count badges, quick search filtering, active selection indicators, and one-click clear buttons.
- **Consequences**: Enables multi-dimensional slicing of complex workflows and operations with sub-millisecond filtering.

---

## ADR-011: Global Keyboard Shortcuts & Line-by-Line Navigation
- **Status**: Accepted
- **Context**: Rapid log triage requires vim-like and arrow-key keyboard navigation without requiring mouse clicks. The user specifically requested: `down arrow: move to next log downwards (e.g. 5684 -> 5683), moving the yellow highlight accordingly`.
- **Decision**: Implemented global window listener in `src/App.tsx` coordinating `ArrowDown`/`j`, `ArrowUp`/`k`, `PageDown`/`PageUp`, `Home`/`End`, `Enter`/`Space` (Context Viewer), `g` (Go to line), `/` (Focus search), `n`/`N` (Match navigation), `c` (Compact toggle), `w` (Wrap toggle), `t` (Live tail toggle), and `?` (Keyboard shortcuts cheat sheet modal).
- **Consequences**: Fast keyboard-driven workflow, auto-scrolling virtual table keeping highlighted lines visible at all times.

---

## ADR-012: Collapsible Sidebar, Fullscreen Mode, and Popover Stacking
- **Status**: Accepted
- **Context**: The user identified that the Workflow/Operation dropdowns were being clipped vertically by `.level-pills-row` overflow, and requested a toggleable left panel (sidebar) and a full-screen button on the top right.
- **Decision**:
  1. Set `.level-pills-row` and `.topbar` to `overflow: visible; position: relative; z-index: 50;`. Dropdowns are rendered with `position: absolute; right: 0; zIndex: 1000;` over a fixed click-outside dismiss backdrop.
  2. Implemented collapsible sidebar with smooth CSS width transition (`.sidebar.collapsed { width: 0; min-width: 0; }`), toggled via topbar button, sidebar header button, or `[` / `Ctrl+B` key shortcut.
  3. Added Fullscreen button on the top right using the HTML5 Fullscreen API (`document.documentElement.requestFullscreen()`) with dynamic `fullscreenchange` synchronization.
- **Consequences**: Unimpeded popover menus, maximum screen real estate for wide logs, and seamless distraction-free fullscreen triage.

---

## ADR-013: Popover Dismissal on Click/MouseLeave, Datetime Picker, Duplicate Toggle Fix & Copy Log Path
- **Status**: Accepted
- **Context**: The user requested:
  1. Dropdowns should close when clicked outside or when the mouse moves outside (`onMouseLeave`).
  2. Add simple tooltips across all buttons.
  3. Add a button to copy the log path on the system to clipboard.
  4. Fix duplicate expand buttons (one in sidebar header and one in topbar).
  5. The datetime picker was not coming up when clicking the calendar icon (`📅`).
- **Decision**:
  1. Implemented global document `mousedown` event listener to close all popups on click outside, plus graceful `onMouseLeave` timers (260ms delay) so moving the cursor outside cleanly dismisses dropdowns without accidental flickers.
  2. Added rich, descriptive `title` tooltips across all buttons, pills, and inputs.
  3. Added Copy Path button in Topbar Row 2 (beside Export), in Topbar Row 1, and for each source item in the Sidebar with temporary checkmark feedback (`navigator.clipboard.writeText`).
  4. Topbar expand button is now conditionally rendered ONLY when `!isSidebarOpen`. When the sidebar is open, only the sidebar header collapse button exists.
  5. Implemented full interactive Datetime Range Picker popup anchored under `📅` with quick presets (`Last 15m`, `Last 1h`, `Last 24h`, `All Time`), manual inputs, clear button, and backend filtering via `startDate` and `endDate`. Made line gutter sticky in `CompactLogRow.tsx` so line numbers and datetimes are never hidden during horizontal scroll.
- **Consequences**: Intuitive mouse and keyboard interaction, zero duplicate controls, full datetime range filtering, and one-click log path copying.

---

## ADR-014: Flat File Schema Extension with Correlation ID & Filter
- **Status**: Accepted
- **Context**: The user requested extending the flat file schema to include `[Correlation ID]`:
  `[Datetime] [Process ID] [Thread ID] [Correlation ID] [Namespace] [WorkflowMarkers] [operations] [Status] [Duration] Message [FileName::LineNumner]`
  and adding a filter for Correlation ID.
- **Decision**:
  1. Updated `LogEntry`, `LogQuery`, and `LogQueryResult` interfaces across `server/types.ts` and `src/types.ts` to include `correlationId` and `correlationCounts`.
  2. Enhanced `server/parser.ts` to recognize explicit correlation formats (`corr-`, `cid-`, UUIDs, `req-`, `trace-`) and schema positional tokens.
  3. Added `correlationId` filtering and dynamic document-wide `correlationCounts` aggregation in `server/fileReader.ts` and `server/index.ts`.
  4. Updated sample log generator (`scripts/generate_logs.ts`) and regenerated `logs/app_workflow.log` (5,200 lines) with realistic correlated trace IDs.
  5. Implemented interactive Correlation ID dropdown pill in `src/components/Topbar.tsx` styled in mint/emerald `#34d399` with search, counts, active clear button, and click/move-outside dismiss.
  6. Highlighted `[Correlation ID]` in `CompactLogRow.tsx`, `LogRow.tsx`, and `coloredLogRenderer.tsx` with distinct emerald badges and search highlight matching.
- **Consequences**: Full support for distributed tracing and cross-service transaction inspection directly from the log table and filter bar.

---

## ADR-015: Direct Inline Line Jump & ASCII/ANSI Syntax Coloring Bugfix
- **Status**: Accepted
- **Context**: The user requested:
  1. Combine "Go to line" into the current line indicator so the user can directly edit `1` in `1 / 100` and press Enter to jump immediately, eliminating the separate redundant "Go to line" button.
  2. In the selected window (Context Modal), the ASCII/syntax coloring was not displaying properly (most lines appeared uncolored).
- **Decision**:
  1. Replaced the static match indicator and separate "Go to line" button with a unified, directly-editable inline input: `[ [1] / 100 < > ]`. Users can click/type any line number or entry index and hit `Enter` or click outside to instantly jump and auto-scroll the log feed.
  2. Root cause of missing syntax/ASCII colors in Context Modal: `renderAnsiText` had a regex pattern `|\[)\??(\d+)m` which accidentally treated duration bracket tokens like `[297ms]` as ANSI escape sequences (`\[297m`). This swallowed the bracket, returned uncolored ANSI fragments, and bypassed token syntax coloring entirely.
  3. Fixed ANSI regex to strictly require escape prefixes (`(?:\u001b|\\u001b|\\x1b|\x1b|\\033|\\e)\[\??(\d+(?:;\d+)*)m`), and enabled seamless embedding of ANSI colors inside message bodies while preserving full token syntax coloring for Datetime, PID, TID, Correlation ID, Namespace, Workflow, Operation, Status, Duration, and File Location.
- **Consequences**: Sleek, compact topbar with one-touch direct line jumping, and vivid token and ASCII syntax coloring restored across all context modal views.

---

## ADR-016: Recursive Folder Discovery, Log Rotation Management & Pixel-Matched Sidebar View
- **Status**: Accepted
- **Context**: The user requested:
  1. In `config/log_sources.json`, implement a field where folders can be given and searched recursively for log files.
  2. Handle rotated log files properly (e.g. `*.log.1`, `*.log.2`, date-based rotations like `*.2026-09-01.log`).
  3. Improve the view of the files in the sidebar, matching the provided screenshot (stacked 2-line number/unit badges, active borders, cyan highlights, copy buttons).
- **Decision**:
  1. Extended `config/log_sources.json` to support a top-level `folders: LogFolderConfig[]` array and individual source folders.
  2. Implemented `scanFolderRecursively` in `server/config.ts` to traverse directory trees and discover log files (`.log`, `.txt`, `.jsonl`, `.out`, and rotated variants).
  3. Implemented `detectRotation` to recognize standard rotation patterns (`.log.1`, `.log.2`, `YYYY-MM-DD.log`, etc.) and group rotated archives directly under their parent source (`source.rotations: LogSource[]`).
  4. Updated `Sidebar.tsx` to match the user screenshot:
     - Stacked 2-line dark badge (`1.3` on line 1, `MB` on line 2).
     - Active item highlighted in cyan `#38bdf8` with dark blue glow and border `#0284c7`.
     - Expandable rotation accordion pill (`<History /> {count}`) to toggle nested archives.
     - Topbar shows `Rotated Archive` indicator when inspecting archived snapshots.
- **Consequences**: Effortless auto-discovery of all logs across microservices and directories, clean hierarchy without clutter, and 1-click access to rotated archives.

---

## ADR-017: Source ID Uniqueness, Name Truncation & Rotation Hierarchy Fix
- **Status**: Accepted
- **Context**: In the sidebar:
  1. Multiple items simultaneously showed active blue borders because base64 path slicing (`slice(0, 16)`) generated identical IDs for all discovered and rotated files under `/Users/amansaxena/...`.
  2. The source item name was prematurely truncated to `Application W...` due to an artificial `max-width: 145px` CSS constraint.
  3. The rotation toggle pill in `source-item-right` disrupted the vertical column alignment of size badges and copy buttons.
  4. An outer `title={source.path}` tooltip on the row popped up over size badges on hover.
  5. Temporary scratch files (`pasted_*.log`) polluted `DISCOVERED LOGS`.
- **Decision**:
  1. Replaced base64 string slicing with full-path cryptographic MD5 hashing (`disc-${hash}` and `custom-${hash}`) and explicit parent-scoped rotation IDs (`${parent.id}-rot-${suffix}`).
  2. Removed `max-width: 145px` on `.source-item-name` and configured flexible flexbox shrinking (`flex: 1; min-width: 0`), allowing names like `Application Workflow Log` to show properly.
  3. Relocated the rotation toggle badge to `source-item-left` next to the name, ensuring the size badge and copy button column on the right remains uniformly aligned.
  4. Wrapped rotated log items in `.source-rotations-tree` with a subtle tree-line border.
  5. Removed intrusive outer container tooltips and ignored `pasted_*.log` temporary files from recursive discovery.
- **Consequences**: Clean, pixel-perfect sidebar view with strictly 1 active selection at a time, legible log names, and beautifully aligned size badges and copy buttons.

---

## ADR-018: Seafoam / Sage Medium Teal Light Mode Palette
- **Status**: Accepted
- **Context**: The user found the default light mode too bright and glary, and explicitly requested a darker teal palette: Seafoam / Sage Medium Teal with deep pine ink text.
- **Decision**:
  1. Updated `[data-theme='light']` in `src/index.css`:
     - Canvas background: `#b8dada` (rich, matte seafoam/sage teal canvas ~79% lightness, eliminating 96% white glare).
     - Sidebar: `#abcece`.
     - Surfaces/Cards: `#c7e3e3` and `#cde7e7`.
     - Borders: `#88b8b8`.
     - Text: `#032023` (deep pine ink for ultra-sharp legibility without eye fatigue).
     - Accent: `#0f766e` (Teal-700).
     - Gutter & row selection: `#99c4c4` with `rgba(15, 118, 110, 0.22)`.
     - Size badges: `#9ec7c7` with `#032427` value text.
  2. Defined deep, saturated log token colors for maximum clarity on the seafoam canvas:
     - Datetime: `#036170` (deep oceanic cyan/teal).
     - Correlation ID: `#065f46` (rich emerald pine).
     - Workflow: `#5b21b6` (deep violet).
     - Namespace: `#0369a1` (deep ocean blue).
     - Operations: `#9a3412` (burnt orange) and `#854d0e` (warm amber).
     - Status: `#14532d` (forest green), `#991b1b` (deep crimson), `#854d0e` (warm amber).
     - Message: `#032023` (deep pine ink).
- **Consequences**: A distinct, soothing, non-glaring daytime teal theme that is comfortable for long reading sessions while maintaining exceptional contrast and clarity.

---

## ADR-019: Coolors Earth, Sage & Terracotta Light Theme Palette
- **Status**: Accepted
- **Context**: The user provided a specific 7-color palette from Coolors: `https://coolors.co/palette/797d62-9b9b7a-d9ae94-f1dca7-ffcb69-d08c60-997b66`
- **Decision**:
  1. Mapped the 7 colors into `[data-theme='light']` in `src/index.css`:
     - `#f1dca7` (Soft Wheat / Vanilla Cream): Main application canvas background — warm, paper-like, zero white glare.
     - `#e5cd96` & `#faeed2`: Sidebar, surfaces, and card backgrounds.
     - `#d9ae94` (Desert Sand): Subtle UI borders and badge outlines.
     - `#d08c60` (Warm Terracotta): Primary accent color, row selection borders, highlight lines, and HTTP action tokens.
     - `#2b241c` (Deep Espresso/Walnut Ink): Primary typography and log message body for razor-sharp legibility.
     - `#797d62` (Olive / Reseda Green): Muted text, datetime tokens, info indicators, and badge units.
     - `#997b66` (Warm Umber / Walnut): PID/TID tokens, code file locations, and debug levels.
     - `#ffcb69` (Sunglow Amber Gold / darkened `#a86c12`): Duration values, warnings, and action operation tokens.
  2. Maintained the dark theme untouched and preserved full backward compatibility with virtualized rendering, token parsing, and live tailing.
- **Consequences**: A warm, natural, high-contrast earth & sage theme with comfortable readability and distinctive personality.

---

## ADR-020: Clean Professional Slate & Sky Blue Light Mode
- **Status**: Accepted
- **Context**: The yellowish/wheat earth palette felt muddy and unsuitable for technical log viewing. The user requested an immediate fix for light mode.
- **Decision**:
  1. Transitioned `[data-theme='light']` in `src/index.css` to a clean, crisp, industry-standard modern developer theme (modeled after Linear, Datadog, and GitHub):
     - Canvas background: `#f8fafc` (Tailwind slate-50).
     - Sidebar and surface cards: `#ffffff` with delicate `#e2e8f0` borders.
     - Controls and inputs: `#f1f5f9` with subtle hover `#e2e8f0`.
     - Primary text: `#0f172a` (Slate-900: razor-sharp, dark, completely legible, zero wash-out).
     - Accent: `#0284c7` (clean Sky-600) with subtle `rgba(2, 132, 199, 0.08)` glow.
     - Size badges: clean light gray `#f1f5f9` pill with `#334155` text and `#64748b` unit.
  2. Professional syntax highlighting for log lines:
     - Datetime: `#0284c7` (Sky Blue)
     - Correlation ID: `#059669` (Emerald 600)
     - Workflow: `#7c3aed` (Royal Violet)
     - Namespace: `#0369a1` (Deep Ocean Blue)
     - Operations: `#ea580c` (Vivid Orange) & `#d97706` (Amber)
     - Status: `#16a34a` (Green), `#dc2626` (Red), `#d97706` (Amber)
     - Message: `#0f172a` (Crisp dark text)
- **Consequences**: Instantly clean, professional, crystal-clear light mode with zero muddy yellow tint and exceptional readability.

---

## ADR-021: Warm Alabaster & Amber Stone Light Theme
- **Status**: Accepted
- **Context**: The user requested a "more warm view" for light mode (moving away from cold blue-slate while avoiding muddy yellow tones).
- **Decision**:
  1. Updated `[data-theme='light']` in `src/index.css` to a cozy, natural Warm Alabaster & Amber Stone palette (modeled after Apple Books and Notion warm paper):
     - Canvas background: `#faf7f2` (soft warm alabaster paper, zero harsh blue/white glare).
     - Sidebar: `#f3eee5` (warm linen / parchment).
     - Controls & inputs: `#eae4d8` (soft warm oat).
     - Subtle borders: `#ded7ca` (delicate stone).
     - Typography: `#1c1917` (Stone-900: warm deep charcoal espresso ink).
     - Accent: `#d97706` (warm amber-600) with warm honey glow.
     - Size badges: `#ece5d9` with `#ddd5c7` border and `#292524` text.
     - EconViewer title gradient: `#d97706` to `#c2410c` (warm amber to terracotta).
  2. Preserved high-contrast syntax highlighting for all flat log tokens (cyan datetime, emerald correlation ID, royal violet workflow, warm orange/amber operations).
- **Consequences**: A cozy, natural, eye-friendly warm light mode with no cold glare, no muddy yellow tint, and razor-sharp readability.

---

## ADR-022: Real-Time Live Stream Rate Tracking (Logs Added/Sec)
- **Status**: Accepted
- **Context**: The user requested that during live streaming/tailing of a log file, the viewer show the number of new logs added per second.
- **Decision**:
  1. **Backend Event Stream Enhancement** (`server/index.ts`):
     - Updated `/api/logs/stream` SSE polling to 500ms intervals.
     - When file growth is detected (`stats.size > lastSize`), reads the appended buffer slice and counts the number of newly added lines (`addedLogs`).
     - Transmits `{ type: 'file_changed', addedLogs, ... }` via SSE.
     - Added `POST /api/logs/append` endpoint for external emitters and test simulation.
  2. **Frontend Rate Calculation Engine** (`src/App.tsx`):
     - Maintained a 1200ms sliding time window of arrival batches (`recentArrivalsRef`).
     - An interval ticker recalculates the instantaneous rate (`liveLogsPerSec = sum(counts in window)`), decaying naturally to `0 logs/s` if writes cease.
     - Reconciles both SSE pushes and query total increments.
  3. **UI Integration**:
     - Topbar: Added a prominent pulsing green/cyan speed badge (`<Activity /> {liveLogsPerSec} logs/s`) next to the `LIVE` button.
     - Topbar Line Stats: Appended a dynamic badge `+{liveLogsPerSec} logs/s` next to `Lines: X / Y`.
     - Sidebar: Added real-time rate readout inside the `Stream File` button (`Streaming File (X logs/s)`).
- **Consequences**: Provides immediate, visible, real-time observability of incoming log velocity during live tailing with zero perceptible latency.

---

## ADR-023: Adaptive Log Flow and Tail Orientation (Latest at Top vs Forward Flow)
- **Status**: Accepted
- **Context**: The user requested that:
  - When Live Tail is ON: Always show the latest log at the top, so streaming logs arrive at the top row.
  - When Live Tail is NOT set: Show logs in the natural direction of the log flow (oldest to newest, line 1 downwards), with new logs appended at the bottom.
- **Decision**:
  1. Defaulted the viewer's baseline sort order to `time-asc` (natural flow of logs: Line 1 / earliest timestamp at the top, progressing chronologically downwards).
  2. Created unified toggle handler `handleToggleLiveTail`:
     - When toggled ON (`isLiveTail = true`): Automatically switches sort order to `time-desc` (latest at top), scrolls directly to row 0 (`targetScrollIndex = 0`, `scrollTop = 0`), and locks the viewport to the top so new arrivals stream in directly at the top row.
     - When toggled OFF (`isLiveTail = false`): Automatically restores sort order to `time-asc` (natural flow of logs, oldest at top, flowing downwards).
  3. Connected `handleToggleLiveTail` to Topbar toggle button, Sidebar stream button, and keyboard shortcut `'t'`.
  4. Updated Sort dropdown labels: `Time (Log Flow: Oldest → Newest)` and `Time (Tail: Latest at Top)`.
- **Consequences**: Tail mode gives immediate top-row visibility for real-time streaming, while static viewing preserves natural top-to-bottom reading order.

---

## ADR-024: Metadata Columns Visibility Toggles and [AUDIT] Log Level
- **Status**: Accepted
- **Context**: The user requested:
  1. Toggle buttons to enable/disable showing Process ID (`PID`), Thread ID (`TID`), and Correlation ID (`Corr`).
  2. Add `[AUDIT]` as a first-class log level filter alongside `INFO`, `ERROR`, etc.
- **Decision**:
  1. **Metadata Visibility Toggles**:
     - Added persistent boolean state in `App.tsx` (`showPid`, `showTid`, `showCorrelation`), saved to `localStorage` (`lv_show_pid`, `lv_show_tid`, `lv_show_corr`).
     - Added a clean toolbar button group in Topbar Row 2: `Meta: [PID] [TID] [Corr]`.
     - Clicking "Meta:" toggles all 3 simultaneously; clicking individual pills (`PID`, `TID`, `Corr`) provides granular control.
     - Threaded visibility down to `CompactLogRow.tsx` and `LogRow.tsx`, allowing users to declutter log feeds without losing token parsing.
  2. **First-Class [AUDIT] Level**:
     - Extended `LogLevel` union in `server/types.ts` and `src/types.ts` with `'audit'`.
     - Updated `server/parser.ts`:
       - Added `audit: 'audit'` in `STATUS_LEVEL_MAP`.
       - Added `'AUDIT'` check in `inferLevelFromText()`.
       - Bracket token `[AUDIT]` sets `level: 'audit'` and `status: 'AUDIT'`.
     - Initialized `audit: 0` in `server/fileReader.ts` `levelCounts`.
     - Added `{ key: 'audit', label: 'AUDIT' }` in `AVAILABLE_LEVELS` in `Topbar.tsx`.
     - Added custom teal/emerald colors in `src/index.css`:
       - Dark theme: `--lvl-audit: #14b8a6;` `--lvl-audit-bg: rgba(20, 184, 166, 0.2);`
       - Light theme: `--lvl-audit: #0d9488;` `--lvl-audit-bg: #ccfbf1;`
       - Status badge `.badge-status.audit` and filter pill `.level-pill.audit.active`.
- **Consequences**: Enhanced log density customization and complete support for enterprise compliance audit logs.
