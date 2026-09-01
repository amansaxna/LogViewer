# Agent Development Guide - LogViewer

This document provides instructions, conventions, and architectural context for AI agents working on this codebase.

## 1. Project Overview
LogViewer is a local log visualizer inspired by [logviewer.io](https://logviewer.io/) and [OpCodes Log Viewer](https://github.com/opcodesio/log-viewer). It provides high-performance viewing, virtualized scrolling, live-tailing, and custom token parsing for structured and unstructured flat logs.

### Key Capabilities
- **Pre-configured Standard Logs & Folders**: Configured in `config/log_sources.json`, supporting explicit file sources and `folders: [...]` with recursive subfolder directory scanning.
- **Log Rotation Detection & Grouping**: Automatically identifies rotated archives (`.log.1`, `.log.2`, date-based rotations `YYYY-MM-DD.log`), attaches them to their parent log source, and presents collapsible sub-items in the sidebar.
- **Dynamic File Opening**: Can open any file path on the local system via API or UI modal.
- **High-Performance Virtual Scrolling**: Uses `@tanstack/react-virtual` to smoothly render 100,000+ log lines at 60 FPS.
- **Permissive Flat-File Parser**: Handles logs formatted as:
  `[Datetime] [Process ID] [Thread ID] [Correlation ID] [Namespace] [WorkflowMarkers] [operations] [Status] [Duration] Message [FileName::LineNumner]`
  Gracefully handles missing brackets, missing timestamps, markerless logs, and multi-line stack traces.
- **Optimal Trace Viewer**: Automatically parses and structures multi-line call stacks into collapsible frames with file:line indicators and one-click copying.
- **Live Tail Streaming**: Real-time file observation using Server-Sent Events (SSE).

---

## 2. Architecture & File Structure

```
LogViewer/
├── Makefile                     # Build & run automation targets
├── agent.md                     # This file - agent guidance and reference
├── DECISIONS.md                 # Architecture Decision Records (ADRs)
├── TRANSACTIONS.md              # Transaction and audit event log
├── package.json                 # Node dependencies and scripts
├── tsconfig.json                # TypeScript settings
├── vite.config.ts               # Vite configuration (proxies /api to Express)
├── config/
│   └── log_sources.json         # Standard pre-configured log sources
├── logs/                        # Sample and active log files
│   ├── app_workflow.log         # Complete flat format with stack traces
│   ├── payments.log             # Partial bracketed tokens
│   ├── system_errors.log        # Raw markerless lines & crash traces
│   └── services.log             # Background worker execution logs
├── server/                      # Node.js backend
│   ├── index.ts                 # Express REST API and SSE stream
│   ├── config.ts                # Source manager & file metadata detector
│   ├── fileReader.ts            # Fast search, filter, cache, & context reader
│   ├── parser.ts                # Tokenizer, bracket classifier, trace extractor
│   └── types.ts                 # Shared TypeScript interfaces
├── src/                         # React frontend
│   ├── index.css                # Modern CSS tokens, dark/light theme, glassmorphism
│   ├── main.tsx                 # React DOM mount point
│   ├── App.tsx                  # State manager, query coordinator, SSE listener
│   ├── types.ts                 # Frontend data types
│   └── components/
│       ├── Sidebar.tsx          # File selector, categories, sizes, open file button
│       ├── Topbar.tsx           # Search, regex, level pills, live tail, theme switch
│       ├── LogTable.tsx         # Virtualized scroll list (TanStack Virtual)
│       ├── LogRow.tsx           # Line renderer with badges & expanded details
│       ├── TraceViewer.tsx      # Formatted stack trace visualization
│       ├── OpenFileModal.tsx    # Modal to open arbitrary local paths
│       └── ContextModal.tsx     # Surroundings viewer (±10, ±25, ±50 lines)
└── test/
    └── parser.test.ts           # Parser unit tests
```

---

## 3. Log Parsing Logic (`server/parser.ts`)

### Line Classification
1. **Continuation / Stack Trace**: If a line begins with 2+ spaces, a tab, or words like `Trace:`, `Error:`, `Exception:`, `at `, or `Caused by:`, it is appended to the preceding log entry's trace buffer.
2. **Trailing Code Location**: Matches `[FileName.ext::LineNumber]` at the end of the line (e.g. `[AuthTokenProvider.ts::88]`).
3. **Leading Bracket Tokens**: Permissively extracts `[...]` at the line prefix.
4. **Smart Heuristics**:
   - `datetime`: Verified against timestamp patterns (`YYYY-MM-DD HH:mm:ss.SSS`).
   - `pid`: Numeric or `PID:\d+`.
   - `tid`: `thread-\w+`, `worker-\w+`, `tid:\w+`.
   - `namespace`: Dotted identifiers (`Auth.Service`).
   - `workflow`: Prefixes `WF:`, `flow-`, `jobexecution-`, `txn-`.
   - `operation`: HTTP requests (`POST /api/...`) or PascalCase action verbs.
   - `status`: Keywords like `SUCCESS`, `FAILED`, `PENDING`, `ERROR`, `WARN`.
   - `duration`: Patterns like `42ms`, `1.2s`, `85µs`.
5. **Fallback**: If no bracketed tokens exist, the entire line is stored as `message`, and the severity level is inferred from keyword analysis.

---

## 4. Operational Commands

- **Install**: `make install`
- **Start Dev Environment**: `make dev` (Runs backend on `http://localhost:3001` and frontend on `http://localhost:3000`)
- **Run Parser Tests**: `make test`
- **Build Production**: `make build`
- **Run Production**: `make start` (Listens on `http://localhost:3001`)

---

## 5. Adding New Features
- When modifying log parsing, always add corresponding test cases in `test/parser.test.ts` and run `npm test`.
- When adding API endpoints, record significant decisions in `DECISIONS.md` and log operational changes in `TRANSACTIONS.md`.
