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

---

## ADR-025: Rich Context Highlighting for Message Sections (URLs, IPs, UUIDs, Key-Values, Endpoints)
- **Status**: Accepted
- **Context**: The user requested that special contextual entities inside log message sections (such as URLs, IP addresses, key-value pairs, and endpoints) be properly highlighted with dedicated pill chips, borders, and backgrounds rather than basic font color changes.
- **Decision**:
  1. Created dedicated tokenizer utility [`src/utils/messageContextHighlighter.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/utils/messageContextHighlighter.tsx) with `renderRichMessageContext()`:
     - **URLs**: Recognizes `http(s)://` and `ws(s)://`. Renders as an interactive link chip with an external link icon `<ExternalLink />` opening in a new tab without propagating row selection.
     - **IP Addresses & Ports**: Recognizes IPv4 with optional port numbers (e.g. `192.168.1.1:8080`).
     - **UUIDs & Hashes**: Recognizes 36-char UUIDs and hexadecimal hash IDs.
     - **Key-Value Pairs**: Recognizes `key=value`, `key="value"`, `key='value'`, formatting keys and values into structured multi-color badge tokens.
     - **API Endpoints**: Recognizes path segments like `/api/v1/...`, `/oauth/...`, `/auth/...`.
     - **Email Addresses**: Recognizes emails with mailto links.
     - **Search Queries**: Integrates seamlessly with active search queries, highlighting matching substrings inside or outside entity chips.
  2. Applied chip styles in [`src/index.css`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/index.css):
     - Distinct tinted background chips, 1px subtle borders, 4px border radius, font-mono typography, and subtle drop shadows for both Dark Mode and Light Mode.
  3. Integrated across all viewer modes:
     - Compact log row feed ([`CompactLogRow.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/components/CompactLogRow.tsx)).
     - Detailed card log row preview and expanded message detail panel ([`LogRow.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/components/LogRow.tsx)).
     - Raw ANSI / Context Modal view ([`coloredLogRenderer.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/utils/coloredLogRenderer.tsx)).
- **Consequences**: Drastically elevates log message scanability and readability, transforming raw unstructured text blocks into visually structured, interactive, and distinct data tokens.

---

## ADR-026: Modern Loaders & Skeleton States Suite
- **Status**: Accepted
- **Context**: The user requested proper, modern loaders across the application rather than basic/missing feedback during queries, file opening, parsing, and context inspection.
- **Decision**:
  1. Built comprehensive loader component library [`src/components/Loaders.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/components/Loaders.tsx):
     - `TopProgressBar`: 2.5px sweeping indeterminate gradient progress bar that sweeps smoothly along the top of the feed during background queries.
     - `LogFeedSkeleton`: 16-row animated shimmering placeholders with varying width message bodies, badge tokens, and line gutters.
     - `CenterLoadingOverlay`: Dual orbiting rings with glowing core dot and glassmorphism card for initial source load / large queries.
     - `ModalLoadingState`: Centered glowing spinner and informative status text for `ContextModal`.
     - `ButtonSpinner`: Seamless spinning indicator for modal submit buttons (`OpenFileModal`, `PasteLogsModal`).
     - `Spinner`: Compact icon spinner with smooth 360deg keyframe rotation for headers and toolbars.
  2. Styled with CSS keyframe animations in [`src/index.css`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/index.css):
     - `@keyframes shimmer` (wave sweep across placeholder boxes).
     - `@keyframes sweepProgress` (laser sweep across top progress bar with glowing cyan/amber shadows).
     - `@keyframes spin` (0.85s ease linear).
  3. Integrated across all states:
     - `LogTable`: Shows `LogFeedSkeleton` + `CenterLoadingOverlay` when empty + loading; shows `TopProgressBar` when updating an existing log dataset.
     - `Topbar`: Shows a live `Spinner` next to the line stats when indexing or updating.
     - `ContextModal`: Replaced plain unstyled text with `ModalLoadingState`.
     - `OpenFileModal` & `PasteLogsModal`: Interactive button spinners during file read/parse.
     - `Sidebar`: Skeleton placeholders when loading log sources.
- **Consequences**: Delivers instant, smooth, non-blocking visual feedback with zero UI freezing across dark and light themes.

---

## ADR-027: Log File Context Selective Copy & Multi-Line Selection
- **Status**: Accepted
- **Context**: The user requested a copy button that copies only selected logs inside the surrounding Log File Context modal.
- **Decision**:
  1. Implemented selection state in [`src/components/ContextModal.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/components/ContextModal.tsx):
     - Maintained `selectedLineNumbers: Set<number>`.
     - Automatically pre-selects the target line (`lineNumber`) upon modal open for instant 1-click copying.
     - Added row checkbox selection in the line number gutter and row click toggle with Shift+Click range selection.
     - Active rows display highlighted cyan borders and soft background tints (`rgba(56, 189, 248, 0.14)`).
  2. Created quick selection pills:
     - `All`: Selects all loaded context lines.
     - `Target`: Re-selects only the focal target line.
     - `Clear`: Clears current selection.
  3. Added interactive **Copy Selected** buttons (in both header toolbar and footer):
     - Displays dynamic selection count: `Copy Selected (N)`.
     - Copies only raw log line content (`line.content`) joined by newlines directly to the system clipboard.
     - Provides instant visual confirmation with a green checkmark: `✓ Copied N Selected Lines!`.
- **Consequences**: Enables developers to extract exact ranges of surrounding context lines cleanly without copying entire file windows or dragging cursor selections over line numbers.

---

## ADR-028: RFC 8259 Semantic JSON Tokenizer & Universal `x=y` Key-Value Highlighter
- **Status**: Accepted
- **Context**: The user requested that the rich context tokenizer be improved to support universal key-value forms like `x=y` and incorporate a proper, full-featured JSON tokenizer for embedded objects, arrays, and fields.
- **Decision**:
  1. Built **RFC 8259 JSON Lexer & Tokenizer** in [`src/utils/messageContextHighlighter.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/utils/messageContextHighlighter.tsx):
     - `tokenizeJson()`: Scans JSON characters into typed tokens: `key`, `string`, `number`, `boolean`, `null`, `punctuation`, `whitespace`.
     - `findJsonBlocks()`: Uses balanced bracket/brace depth scanning to locate candidate JSON objects `{ ... }` and arrays `[ ... ]` and verifies syntactic validity via native parsing.
     - `JsonChip`: Renders embedded JSON with a badge, interactive format toggle (switches between single-line compact and multi-line pretty-printed JSON), and copy button.
     - Semantic Token Styling in [`src/index.css`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/index.css):
       - `.json-tok-key`: Bold cyan (`#38bdf8` dark, `#0284c7` light).
       - `.json-tok-string`: Mint green (`#4ade80` dark, `#15803d` light).
       - `.json-tok-number`: Warm amber/orange (`#fb923c` dark, `#c2410c` light).
       - `.json-tok-boolean`: Vivid purple (`#c084fc` dark, `#7e22ce` light).
       - `.json-tok-null`: Italic rose (`#f87171` dark, `#b91c1c` light).
       - `.json-tok-punctuation`: Slate gray (`#94a3b8` dark, `#78716c` light).
  2. Built **Universal `x=y` & Standalone JSON KV Highlighter**:
     - Upgraded `KV_REGEX` to accurately match single-letter variables (`x=y`, `i=0`, `k=v`), spaced assignments (`x = y`, `a = 10`), quoted values (`x="hello world"`), and bracketed contexts (`[x=y]`, `(x=y)`), stripping trailing sentence punctuation.
     - Added `JSON_KV_REGEX` to highlight unbracketed JSON fields (`"userId": 1042`, `"status": "APPROVED"`).
  3. Added comprehensive automated tests in [`test/highlighter.test.ts`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/test/highlighter.test.ts) (Tests 7, 8, 9, 10).
- **Consequences**: Complex log messages containing nested JSON payloads, microservice webhooks, and raw variable assignments `x=y` are cleanly tokenized with IDE-grade syntax highlighting and interactive format/copy controls.

---

## ADR-029: Constant-Size Hover-Only Code Chips, W3C XML Tokenizer & Dedicated Payload Inspector Modal
- **Status**: Accepted
- **Context**: The user requested that the JSON chip size be kept completely constant without expanding log row height, with action buttons (Copy, Format, Inspect) hovering above the text only. Additionally, requested a proper XML tokenizer, native XML log file detection, filepath highlighting, quoted string `"xyz"` highlighting, and a dedicated JSON/XML viewer on another div/modal.
- **Decision**:
  1. **Constant-Size Hover-Only Code Chips**:
     - Converted `.msg-chip-json` and `.msg-chip-xml` into inline baseline flow elements (`display: inline-block; vertical-align: baseline;`) with zero layout displacement.
     - Extracted toolbar actions into a floating glassmorphic action pill (`.msg-chip-floating-bar`) with `position: absolute; bottom: calc(100% + 4px); right: 0;`.
     - The floating action pill is hidden with `opacity: 0` by default and smoothly fades in on hover (`:hover`), keeping the parent container and log row height completely constant.
  2. **W3C XML Lexer & Tokenizer**:
     - Built `tokenizeXml()` in [`src/utils/messageContextHighlighter.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/utils/messageContextHighlighter.tsx): tokens for tags (`<`, `>`, `</`, `/>`), tag names (`xml-tok-tagname`), attributes (`xml-tok-attr`), values (`xml-tok-string`), text content (`xml-tok-content`), comments, and CDATA.
     - Built `findXmlBlocks()` for balanced XML fragment detection.
  3. **Native XML Log Files Identification**:
     - Upgraded server parser [`server/parser.ts`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/server/parser.ts): `isXmlLogContent()` identifies Log4j XML, Java `java.util.logging.XMLFormatter`, Windows Event XML, and XML records.
     - Extracts timestamp, severity levels (SEVERE, ERROR, WARN, AUDIT, INFO), workflow/class, thread/tid, message, and throwable stack traces into structured `LogEntry` objects.
     - Added native XML source `logs/service_audit.xml` in [`config/log_sources.json`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/config/log_sources.json).
  4. **Filepaths & Quoted String Tokens**:
     - Added `FILEPATH_REGEX`: highlights Unix/Linux, Windows, and project relative file paths with dedicated file badge (`.msg-chip-filepath`).
     - Added `QUOTED_REGEX`: highlights standalone quoted strings `"xyz"` and `'xyz'` (`.msg-chip-quoted`).
  5. **Dedicated JSON & XML Inspector Modal ("Another Div")**:
     - Created [`src/components/JsonXmlInspectorModal.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/components/JsonXmlInspectorModal.tsx) mounted in `App.tsx`.
     - Triggered via decoupled window event (`open-payload-inspector`) from any chip's `↗ Inspect` button.
     - Features syntax-highlighted code view, line numbers gutter, live search/filtering within payload, wrap toggle, format/compact toggle, and one-click copy buttons.
  6. **Automated Verification**:
     - Added Parser Test 6 for XML log files (`test/parser.test.ts`).
     - Added Highlighter Tests 11, 12, 13 for XML, filepaths, and quoted strings (`test/highlighter.test.ts`).
     - Added API Test 20 for XML log queries (`test/api.test.ts`). All 20 API tests and 19 unit tests passing.
- **Consequences**: Log rows remain completely sleek and uniform in height, while developers gain instant access to rich inline syntax coloring and dedicated deep-inspection tools for JSON, XML, filepaths, and variables.

---

## ADR-030: Reachable Hover Action Bridge, Cloud URI Tokenization, Meta Datetime Toggle, and Negative Level Filters
- **Status**: Accepted
- **Context**:
  1. The floating action toolbar above JSON/XML chips was disappearing when the user moved the mouse from the chip up toward the buttons because of a hover gap.
  2. Cloud URIs like `s3://company-invoices/2026/09/INV-9921.pdf` were not highlighted as URLs.
  3. The user requested a toggle to show/hide `Datetime` in the `Meta:` group (`Meta: [ Time ] [ PID ] [ TID ] [ Corr ]`).
  4. The user requested removing cluttered `EMERGENCY`, `CRITICAL`, and `NOTICE` pills from the level filter bar.
  5. The user requested a negative level filter feature (e.g. exclude `ERROR` logs to see only non-error logs).
- **Decision**:
  1. **Reachable Hover Bridge & Grace Period**:
     - Added an invisible hover bridge pseudo-element (`.msg-chip-floating-bar::before`) extending 16px downwards to seamlessly bridge the mouse path between the code chip and the floating toolbar.
     - Added React hover state with a 280ms grace timer (`isHovered`) on `JsonChip` and `XmlChip` so quick or diagonal mouse movements never cause the toolbar to disappear.
     - Positioned toolbar flush at `bottom: calc(100% + 2px)` with `z-index: 10000`.
  2. **Cloud & Protocol URIs**:
     - Expanded `URL_REGEX` to match `s3://`, `gs://`, `azure://`, `blob://`, `ftp://`, `file://`, `postgres(ql)://`, `mysql://`, `redis://`, `mongodb://`, `amqp(s)://`, `kafka://`, `grpc://`, and `git://`.
  3. **Meta Datetime Toggle**:
     - Added `showDatetime` state persisted in `localStorage` (`lv_show_datetime`).
     - Added `[ Time ]` button in the `Meta:` toggle group in [`src/components/Topbar.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/components/Topbar.tsx).
     - Dynamically shows/hides the Datetime column in [`src/components/LogTable.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/components/LogTable.tsx), [`src/components/CompactLogRow.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/components/CompactLogRow.tsx), and [`src/components/LogRow.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/components/LogRow.tsx).
  4. **Clean Level Filter Bar**:
     - Removed `EMERGENCY`, `CRITICAL`, and `NOTICE` from `AVAILABLE_LEVELS`. Filter bar now cleanly displays: `ALL`, `ERROR`, `WARN`, `INFO`, `AUDIT`, `DEBUG`.
  5. **Negative Level Filtering (Exclusion Mode)**:
     - Added `excludeLevels` parameter in `LogQuery`, backend Express route, and `server/fileReader.ts` filter pipeline.
     - Built tri-state level pills in `Topbar.tsx`:
       - Normal Click: Includes level (`+`).
       - Right-click or Alt-click: Excludes level (`−`).
       - Dedicated interactive `−` / `✕` button on each pill for one-click exclusion.
       - Excluded pills styled with distinct red glow, red strikethrough label (`− ERROR`), and exclusion badge.
       - Clicking `ALL` resets both included and excluded filters.
  6. **Automated Tests**:
     - Added Highlighter Test 14 for cloud URIs (`test/highlighter.test.ts`).
     - Added API Integration Test 21 for `excludeLevels` negative filtering (`test/api.test.ts`). All 21 API tests and 14 highlighter tests passing cleanly.
- **Consequences**: Developers can seamlessly inspect floating code toolbars, detect all cloud URIs like `s3://`, toggle timestamps on/off to save horizontal screen real-estate, and exclude noisy log levels with one click.

---

## ADR-031: Global Bracket Marker Removal Toggle ([ ] vs No [ ])
- **Status**: Accepted
- **Context**: Standard enterprise logs wrap every token, timestamp, PID, TID, workflow, and marker in square brackets:
  `[18904] [thread-21] [corr-70-d34] [Payment.StripeGateway] [ReserveInventory] [SUCCESS] Operation ReserveInventory completed successfully for session user_1140 (payload: 351 bytes) [ReportEngine.ts::310]`
  The user clarified that "removal of marker []" means stripping all `[...]` bracket markers completely, transforming the line into:
  `Operation ReserveInventory completed successfully for session user_1140 (payload: 351 bytes)`.
- **Decision**:
  1. **UI Toggle Button**:
     - Added a dedicated button `[ ]` / `No [ ]` in Topbar Row 2 next to `Wrap` in [`src/components/Topbar.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/components/Topbar.tsx#L900).
     - State persisted in `localStorage` (`lv_hide_brackets`).
  2. **View Modes Behavior**:
     - Added `stripBracketMarkers(text: string): string` in [`src/utils/coloredLogRenderer.tsx`](file:///Users/amansaxena/Documents/Claude/Projects/LogViewer/src/utils/coloredLogRenderer.tsx).
     - **Compact Log Rows**: When `hideBrackets` is enabled, all metadata marker badges (`datetime`, `pid`, `tid`, `correlationId`, `workflow`, `operation`, `status`, `duration`, `fileLocation`) are omitted, leaving purely the line number gutter and the clean message with rich context highlighting.
     - **Detailed Card Rows**: In the summary preview, all metadata badges and bracket markers are omitted.
     - **Raw & Plain Text View**: In `renderSyntaxColoredLine(rawLine, hideBrackets)`, `stripBracketMarkers` strips all leading, trailing, and isolated `[...]` markers before rendering rich context tokens.
  3. **Automated Verification**:
     - Added Test 15 in `test/highlighter.test.ts` verifying the exact user string transformation:
       `[18904] [thread-21] [corr-70-d34] [Payment.StripeGateway] [ReserveInventory] [SUCCESS] Operation ReserveInventory completed successfully for session user_1140 (payload: 351 bytes) [ReportEngine.ts::310]`
       transforms to:
       `Operation ReserveInventory completed successfully for session user_1140 (payload: 351 bytes)`.
- **Consequences**: Users can instantly eliminate all marker noise and view clean, readable log messages.

---

## ADR-032: Average Logs Added Per Second Velocity Badge
- **Status**: Accepted
- **Context**: The user identified that the live tail rate badge displayed `+0 logs/s` during intervals between write bursts, providing limited insight into real log ingestion throughput. The user requested displaying the average number of logs added per second.
- **Decision**:
  1. **Dual-Velocity Tracking (Instantaneous + Rolling/Session Average)**:
     - When Live Tail is active, track `liveSessionStartRef`, `liveTotalAddedRef`, and a rolling 30-second arrival sliding window in `src/App.tsx`.
     - Compute instantaneous rate over the last 1.5s (`liveLogsPerSec`) and rolling 30s/session average (`liveAvgLogsPerSec`).
  2. **File Historical Average Rate**:
     - Compute `fileAvgLogsPerSec` across loaded entries using first and last entry timestamps (`t_end - t_start`). For instance, `app-workflow.log` (5,221 lines across 60s) computes to `86.9 logs/s`.
  3. **UI Display in Topbar & Sidebar**:
     - **Line Stats Pill**:
       - When streaming with active writes: displays `+{liveLogsPerSec} logs/s (avg {liveAvgLogsPerSec}/s)`.
       - When idle between bursts: displays `avg {liveAvgLogsPerSec} logs/s` instead of dropping to an uninformative `+0 logs/s`.
       - When not live tailing: displays the loaded file's average generation rate `avg {fileAvgLogsPerSec} logs/s`.
     - **Right-side Live Speed Badge**: Prominently shows `avg {liveAvgLogsPerSec} logs/s`.
     - **Sidebar Streaming Button**: Shows `Streaming File (avg {liveAvgLogsPerSec} logs/s)`.
  4. **Verification**:
     - Verified with `make test && make build`. All 21 API integration tests and 15 highlighter tests passed.
- **Consequences**: Users always see a statistically stable and accurate average log velocity (`avg X logs/s`), whether actively live streaming or analyzing existing log files.

---

## ADR-033: Page Reload Settings Auto-Persistence & Global Reset Button
- **Status**: Accepted
- **Context**: Users customize filters, search terms, view modes, bracket toggles, sort options, and meta columns during log analysis. Previously, hard reloads reset several of these ephemeral states. The user requested:
  1. Preserving all last used settings across page reloads.
  2. Adding a button to reset all settings to defaults.
- **Decision**:
  1. **Comprehensive Auto-Persistence**:
     - All user states auto-persist to `localStorage`:
       - `lv_active_source`: Currently loaded log file
       - `lv_marker_filter` & `lv_marker_regex`: Workflow marker filter & regex toggle
       - `lv_search`, `lv_regex`, `lv_case_sensitive`, `lv_invert`: Search term and modifiers
       - `lv_selected_levels` & `lv_exclude_levels`: Level inclusion and exclusion filters
       - `lv_selected_workflow`, `lv_selected_operation`, `lv_selected_correlation`: Facet selections
       - `lv_start_date` & `lv_end_date`: Date range filters
       - `lv_sort_option`: Sort criteria
       - `lv_wrap_lines`: Word wrap preference
       - `lv_hide_brackets`: `No [ ]` clean marker mode
       - `lv_view_mode`: `compact` | `standard` | `raw`
       - `lv_show_datetime`, `lv_show_pid`, `lv_show_tid`, `lv_show_corr`: Metadata column toggles
       - `lv_theme`: `dark` | `light`
       - `lv_sidebar`: Panel open/collapse state
     - States initialize from `localStorage` on component mount with safe JSON fallbacks.
  2. **Global "Reset Settings" Button & Shortcut**:
     - Placed in Topbar Row 2 beside `Shortcuts` with `RotateCcw` icon.
     - Registered keyboard shortcut: `Alt + r`.
     - Clears all stored `lv_*` preferences and restores all filters, views, columns, and search inputs to factory defaults.
  3. **Verification**:
     - Automated test suite `test/settings.test.ts` tests both storage persistence and clean reset.
     - All 21 API tests, 15 highlighter tests, and settings unit tests passing.
- **Consequences**: User customizations survive browser refreshes seamlessly, and can be wiped back to pristine defaults in one click.

---

## ADR-034: Fast Line Copy Icon & Complete Light Mode System Polish
- **Status**: Accepted
- **Context**:
  1. The user requested adding a fast copy icon on log lines (e.g. next to the line number like `464 [Order.Checkout]...`) to immediately copy that single line to the clipboard with one click.
  2. The user provided screenshots highlighting remaining dark mode remnants in light mode:
     - The Topbar dropdown menus (`Operations`, `Workflows`, `Correlation`, `Datetime`) had hardcoded dark backgrounds (`#0f172a`), rendering dark text on dark backgrounds.
     - The `ContextModal` had a hardcoded dark background (`#080c14`), conflicting with the light header.
     - File size badges in the sidebar had hardcoded `#0f172a` backgrounds.
- **Decision**:
  1. **Fast Line Copy Icon**:
     - Added a subtle copy icon (`<Copy size={11} />`) right next to the line number in `CompactLogRow.tsx`, `LogRow.tsx`, and `ContextModal.tsx`.
     - Appears smoothly on row hover (`opacity: 0.75; transform: scale(1)`) with `.fast-copy-btn`.
     - On click: immediately writes the line's raw content to the clipboard (`navigator.clipboard.writeText(entry.raw)`), displays an emerald checkmark (`<Check size={11} color="#22c55e" />`), and reverts after 1.5 seconds.
  2. **Light Mode System Polish**:
     - **Topbar Dropdown Popups**: Replaced hardcoded `#0f172a`, `#1e293b`, and `#334155` in `Workflow`, `Operation`, `Correlation`, and `Datetime` popups with theme CSS variables (`var(--bg-card)`, `var(--bg-sidebar)`, `var(--bg-surface)`, `var(--border-subtle)`, `var(--text-primary)`).
     - **Context Modal**: Replaced `#080c14` with `var(--bg-card)` and `var(--bg-app)`. In light mode, the code area displays on crisp warm canvas with amber-tinted target line highlighting. Added fast copy buttons to every line in the context modal.
     - **Sidebar Size Badges**: Replaced `#0f172a` in `.source-size-badge` with `var(--badge-bg)` and `var(--badge-val)`.
     - **Row Hover in Light Mode**: Introduced `--row-hover-bg` (`rgba(0, 0, 0, 0.035)` in light mode, `rgba(255, 255, 255, 0.04)` in dark mode).
  3. **Verification**:
     - Updated automated test suite `test/settings.test.ts` to assert that light mode variables and fast copy rules exist and that hardcoded `#0f172a` colors are purged from Topbar dropdowns.
     - All 21 API integration tests, 15 highlighter tests, 6 parser tests, and 4 settings/light mode tests pass (`make test`).
     - Production build compiles cleanly in 790ms (`npm run build`).
- **Consequences**: Every log line can be copied with one click via the hover copy icon, and all dropdowns, modals, badges, and row hovers seamlessly respect light mode.

---

## ADR-035: Viewport-Sticky Floating Action Bar for JSON and XML Chips
- **Status**: Accepted
- **Context**: When a log line contains a wide JSON or XML block extending horizontally beyond the visible screen, the floating action bar (`Format`, `Copy`, `Inspect`) was pinned to the far right edge of the entire element (`right: 0`), requiring the user to scroll horizontally hundreds or thousands of pixels to the right just to see or click the selector. The user requested:
  - Keep the floating bar on the right side of the container.
  - Keep it visible inside the current viewport.
  - Dynamically drag/stick it as the user scrolls left to right.
- **Decision**:
  1. **Dynamic Viewport Right-Offset Computation (`useStickyRightOffset`)**:
     - Built `useStickyRightOffset(containerRef, isHovered)` hook in `src/utils/messageContextHighlighter.tsx`.
     - Determines the nearest scroll ancestor (or window) and inspects `containerRect.right` relative to `viewportRight - 16`.
     - If `containerRect.right > targetRight`, computes `offset = containerRect.right - targetRight` (clamped to prevent overflowing past the visible chip's left edge).
     - Dynamically applies `style={{ right: rightOffset > 0 ? `${rightOffset}px` : undefined }}` on `.msg-chip-floating-bar`.
  2. **Real-Time Dragging on Horizontal Scroll**:
     - Attached global capture scroll listener (`window.addEventListener('scroll', updateOffset, { passive: true, capture: true })`) and resize listener while hovered.
     - As the user scrolls horizontally left and right, the action bar repositions synchronously with zero jitter, remaining pinned to the right edge of the visible viewport.
     - When the true right edge of the chip comes into view, the offset returns to `0`, seating the bar naturally at the end of the chip.
  3. **Verification**:
     - Added Test 16 in `test/highlighter.test.ts` validating viewport-sticky offset calculations across wide elements, scrolled viewports, and short chips.
     - All 21 API tests, 16 highlighter tests, 6 parser tests, and 4 settings tests pass cleanly (`make test`).
     - Production build compiles in 820ms (`npm run build`).
- **Consequences**: Users can immediately interact with the JSON and XML action bars regardless of how wide the log message or code block is, without having to scroll horizontally to the end of the line.
