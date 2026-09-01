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
