# Low-Level Design (LLD): LogViewer Architecture

> **Document Version**: 2.0.0  
> **Status**: Approved & Active  
> **Target System**: High-Throughput Structured Log Analysis Engine & DOM Virtualizer  
> **Primary Authors**: Core Architecture & Engine Engineering Team  

---

## 1. System Overview & Module Decomposition

LogViewer is architected with a strict separation of concerns across two primary tiers:
1. **Frontend Presentation & Interaction Engine** (React 19, TypeScript, `@tanstack/react-virtual`, Vanilla CSS Tokens)
2. **Backend Ingestion, Parsing & Telemetry Engine** (Node.js, Express, Stream Pipelines, Heuristic Parser, Telemetry Sampler)

```mermaid
graph TD
    subgraph Frontend ["Frontend Tier (SPA - React 19)"]
        App["App.tsx<br/>(Global Keyboard Dispatcher & State Hub)"]
        PanelGrid["PanelGrid.tsx<br/>(Spatial Layout Manager)"]
        LogPanel["LogPanel.tsx<br/>(Independent Panel Controller)"]
        LogTable["LogTable.tsx<br/>(TanStack Virtualized Virtual Scroller)"]
        LogRow["LogRow.tsx / CompactLogRow.tsx<br/>(Standard/Compact Card Renderer)"]
        DeltaEngine["deltaTimeEngine.ts<br/>(T1/T2 Latency Calculator)"]
        ContextModal["ContextModal.tsx<br/>(Before/After Line Slice Viewer)"]
        InspectorModal["JsonXmlInspectorModal.tsx<br/>(JSON/XML Tree Beautifier)"]
        HealthModal["SystemHealthModal.tsx<br/>(Event Loop & Heap Diagnostics)"]
        TextToolbar["TextSelectionToolbar.tsx<br/>(Floating Quick-Filter Bar)"]
    end

    subgraph Backend ["Backend Tier (Node.js / Express)"]
        Server["server/index.ts<br/>(REST & SSE Endpoint Router)"]
        FileReader["server/fileReader.ts<br/>(Stream Slicer & Multi-Source Interleaver)"]
        Parser["server/parser.ts<br/>(Heuristic Regex & Token Classifier)"]
        Config["server/config.ts<br/>(Auto-Discovery & Rotation Resolver)"]
        Metrics["server/metrics.ts<br/>(Event-Loop Lag & SLA Percentile Engine)"]
    end

    App --> PanelGrid
    PanelGrid --> LogPanel
    LogPanel --> LogTable
    LogTable --> LogRow
    LogPanel --> DeltaEngine
    LogPanel --> TextToolbar
    App --> ContextModal
    App --> InspectorModal
    App --> HealthModal

    LogPanel -- "HTTP GET /api/logs/query" --> Server
    LogPanel -- "SSE /api/logs/live/:id" --> Server
    Server --> FileReader
    FileReader --> Parser
    Server --> Config
    Server --> Metrics
```

---

## 2. C4 Architecture Level 3: Component Diagram

### 2.1 Frontend Component Architecture

```mermaid
C4Component
    title C4 Level 3 Component Diagram - Frontend Client Tier

    Container(spa, "SPA Client Container", "React 19 / TypeScript", "Renders UI, manages virtualized scroll, handles keyboard events.")

    Component(appRouter, "App State Hub", "App.tsx", "Holds active sources, multi-panel layout state, global search query, active modal states, and 28-hotkey dispatcher.")
    Component(panelGrid, "Panel Grid Layout", "PanelGrid.tsx", "Renders CSS Grid topologies (1, 2-col, 2-row, 3-grid, 4-grid) and manages focus indicators.")
    Component(logPanel, "Log Panel Container", "LogPanel.tsx", "Encapsulates query filters, view modes (compact/standard/raw), sorting, and SSE subscriptions per panel.")
    Component(virtualTable, "Virtual Window Scroller", "LogTable.tsx", "Executes TanStack windowing math with dynamic row heights, overscan buffers, and sticky headers.")
    Component(rowRenderer, "Token Highlight Row", "LogRow.tsx & CompactLogRow.tsx", "Decomposes log message into tokens, paints colored levels, and extracts inline JSON/XML payloads.")
    Component(deltaEngine, "Delta Latency Engine", "deltaTimeEngine.ts", "Stores T1 anchor and T2 target log timestamps to compute millisecond/microsecond execution deltas.")
    Component(textToolbar, "Selection Action Bar", "TextSelectionToolbar.tsx", "Detects window.getSelection() in log tables and renders floating context menu for Include/Exclude/Delta.")
    Component(telemetryClient, "Client Telemetry Monitor", "clientTelemetry.ts", "Records FPS samples, INP interaction latencies, render durations, and incident logs.")

    Rel(appRouter, panelGrid, "Distributes panel state and focused panel ID")
    Rel(panelGrid, logPanel, "Instantiates 1 to 4 isolated log panel views")
    Rel(logPanel, virtualTable, "Supplies filtered and sorted LogEntry[] array")
    Rel(virtualTable, rowRenderer, "Renders virtual item slices within viewport")
    Rel(logPanel, deltaEngine, "Computes relative timestamps and anchor differences")
    Rel(logPanel, textToolbar, "Receives contextual filter operations")
    Rel(appRouter, telemetryClient, "Captures UX metrics and health vitals")
```

### 2.2 Backend Component Architecture

```mermaid
C4Component
    title C4 Level 3 Component Diagram - Backend Ingestion Tier

    Container(backendApp, "Backend Service Container", "Node.js / Express", "Exposes REST endpoints, streams SSE deltas, parses logs.")

    Component(httpRouter, "HTTP & SSE Controller", "server/index.ts", "Handles /api/logs/query, /api/logs/live/:id, /api/telemetry, /api/config.")
    Component(fileReader, "Stream Reader & Slicer", "server/fileReader.ts", "Reads files in 64KB chunks, performs regex filtering, pagination, and multi-file interleaving.")
    Component(heuristicParser, "Heuristic Token Parser", "server/parser.ts", "State machine classifying timestamps, brackets, log levels, PIDs, TIDs, correlations, and stack traces.")
    Component(lruCache, "File In-Memory Cache", "server/fileReader.ts (LRU)", "Caches parsed LogEntry[] arrays with automatic mtime invalidation.")
    Component(sourceDiscovery, "Source & Rotation Resolver", "server/config.ts", "Scans configured directories and globs to identify active files and rotated log siblings.")
    Component(telemetrySampler, "Telemetry & Metric Sampler", "server/metrics.ts", "Samples Event Loop Lag (Min, Mean, P50, P90, P95, P99, Max) and query SLA response times.")

    Rel(httpRouter, fileReader, "Requests queried/paged log slices")
    Rel(fileReader, heuristicParser, "Feeds raw log line chunks for tokenization")
    Rel(fileReader, lruCache, "Checks and populates parsed entry caches")
    Rel(httpRouter, sourceDiscovery, "Discovers available sources and file rotations")
    Rel(httpRouter, telemetrySampler, "Records request latencies and exposes system health")
```

---

## 3. Core Class & Interface Models

### 3.1 Data Structures (`src/types.ts` & `server/types.ts`)

```typescript
export type LogLevel =
  | 'emergency' | 'alert' | 'critical' | 'error' | 'warning'
  | 'notice' | 'info' | 'audit' | 'debug' | 'trace' | 'unknown';

export interface TraceFrame {
  text: string;
  file?: string;
  line?: number;
}

export interface TraceData {
  title?: string;
  frames: TraceFrame[];
  raw: string;
}

export interface LogEntry {
  id: string;               // Unique ID: `${sourceId}-${lineNumber}-${timestamp}`
  lineNumber: number;       // 1-indexed source file line number
  raw: string;              // Exact unmodified raw line string
  datetime?: string;        // ISO 8601 formatted string or raw timestamp
  timestamp?: number;       // Unix epoch in milliseconds for chronological sorting
  sourceId?: string;        // ID of originating log file
  sourceName?: string;      // Human-readable source alias
  sourceColor?: string;     // Assigned distinct palette color for multi-source views
  pid?: string;             // Process Identifier token
  tid?: string;             // Thread Identifier token
  correlationId?: string;   // Trace / Correlation / Request ID token
  namespace?: string;       // Logger namespace / Class path / Component prefix
  workflow?: string;        // High-level operational workflow tag
  operation?: string;       // Specific method, endpoint, or action
  status?: string;          // Execution status: SUCCESS, FAILED, TIMEOUT, 200, 500
  duration?: string;        // Measured duration string: e.g. "45ms", "1.2s"
  message: string;          // Main log message body after token extraction
  fileLocation?: string;    // Originating source code file and line number
  level: LogLevel;          // Normalized severity classification
  trace?: TraceData;        // Parsed multi-line stack trace if present
}

export interface LogQueryResult {
  entries: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  levelCounts: Record<LogLevel, number>;
  workflowCounts: Record<string, number>;
  operationCounts: Record<string, number>;
  correlationCounts?: Record<string, number>;
  durationMs: number;
}

export interface PanelState {
  id: string;                               // 'panel-1' | 'panel-2' | 'panel-3' | 'panel-4'
  selectedSources: string[];                // Array of active source IDs (supports combined streams)
  searchQuery: string;                      // Free text or regex query
  selectedLevels: LogLevel[];               // Active severity filter set
  selectedNamespaces: string[];             // Active namespace filter set
  selectedPids: string[];                   // Active PID filter set
  selectedWorkflows: string[];              // Active Workflow filter set
  selectedOperations: string[];             // Active Operation filter set
  selectedCorrelations: string[];           // Active Correlation ID filter set
  sortOption: SortOption;                   // Sorting strategy ('time-desc', 'time-asc', 'line-asc', etc.)
  viewMode: 'compact' | 'standard' | 'raw'; // Row density and rendering mode
  autoScroll: boolean;                      // Real-time live tail auto-scroll anchor
  fontSize: number;                         // Font scaling (10px - 18px)
  lineWrap: boolean;                        // Word wrap vs horizontal scroll
  visibleColumns: Record<string, boolean>;  // Dynamic column visibility toggles
  selectedLineIds: Set<string>;             // Multi-select active lines
  focusedLineIndex: number | null;          // Keyboard cursor line index
}
```

---

## 4. Key Algorithms & Implementation Logic

### 4.1 Heuristic Token Classification State Machine (`server/parser.ts`)

The parser operates without requiring fixed schemas or JSON formats. It utilizes a multi-pass heuristic regex state machine to tokenize flat log lines into structured fields:

```mermaid
flowchart TD
    Start(["Raw Log Line String"]) --> Clean["Trim & Strip ANSI Escape Sequences"]
    Clean --> StackCheck{"Is Continuation /<br/>Stack Frame Line?"}
    
    StackCheck -- Yes --> StackExtract["Attach to Previous LogEntry as TraceFrame<br/>(extract 'at class.method (file:line)')"]
    StackExtract --> End(["Return Modified Previous Entry"])
    
    StackCheck -- No --> TimestampPass["1. Timestamp Pass: ISO 8601, RFC 3339, Syslog, Epoch, HH:mm:ss.SSS"]
    TimestampPass --> LevelPass["2. Severity Pass: Bracketed & Unbracketed Levels [ERROR], [WARN], <INF>"]
    LevelPass --> MetaBracketPass["3. Metadata Brackets: [PID:1234], [tid-89], [corr=abc-xyz]"]
    MetaBracketPass --> KVPass["4. Key-Value Tokens: correlationId=..., status=200, duration=15ms"]
    KVPass --> ContextPass["5. Namespace / Component: [AuthService], [db.pool], [org.apache.kafka]"]
    ContextPass --> PayloadPass["6. Message & Embedded JSON/XML Payload Detection"]
    PayloadPass --> Assemble["Assemble LogEntry Record with Unix Epoch Timestamp"]
    Assemble --> Complete(["Emit LogEntry"])
```

#### Token Recognition Table
| Field | Regex Patterns / Heuristic Rules | Extracted Output |
| :--- | :--- | :--- |
| **Timestamp** | `^\[?(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?` | `datetime`, `timestamp` |
| **Log Level** | `\b(EMERGENCY\|ALERT\|CRITICAL\|FATAL\|ERROR\|WARN(?:ING)?\|NOTICE\|INFO\|AUDIT\|DEBUG\|TRACE)\b` | `level: LogLevel` |
| **PID / TID** | `\[(?:pid|PID|process)[:=]?\s*(\d+)\]` / `\[(?:tid|TID|thread)[:=]?\s*(\w+)\]` | `pid`, `tid` |
| **Correlation ID** | `\[?(?:corr(?:elation)?(?:_|-)?id\|trace(?:_|-)?id\|req(?:uest)?(?:_|-)?id)[:=]\s*([a-zA-Z0-9_-]+)\]?` | `correlationId` |
| **Namespace** | `\[([a-zA-Z0-9_.-]+(?:\.[a-zA-Z0-9_.-]+)+)\]` or leading `([a-zA-Z0-9_]+::[a-zA-Z0-9_]+)` | `namespace` |
| **Duration** | `\b(?:took\|duration\|in)[:=]?\s*(\d+(?:\.\d+)?\s*(?:ms\|s\|µs\|ns))\b` | `duration` |
| **Status Code** | `\b(?:status|code|HTTP)[:=]?\s*([1-5]\d{2})\b` | `status` |

---

### 4.2 Multi-Source Unified Merge Algorithm ($O(N \log K)$)

When multiple log sources are selected in a single panel, the backend executes an indexed k-way merge sort across active streams:

```mermaid
graph TD
    subgraph Sources ["K Independent Source File Caches"]
        S1["Source 1 (Sorted by timestamp)"]
        S2["Source 2 (Sorted by timestamp)"]
        SK["Source K (Sorted by timestamp)"]
    end

    subgraph MinHeap ["K-Way Min-Heap / Priority Queue"]
        Heap["Priority Queue (Key: timestamp, SubKey: lineNumber)"]
    end

    subgraph Slicer ["Query Predicate & Pagination Slicer"]
        Filter["Predicate Evaluator (Regex, Level, Namespace)"]
        Window["Pagination Slicer [offset, offset + limit]"]
    end

    S1 -- "Head Pointer" --> Heap
    S2 -- "Head Pointer" --> Heap
    SK -- "Head Pointer" --> Heap

    Heap -- "Extract Min" --> Filter
    Filter -- "Matches Predicate" --> Window
    Window -- "Filled Page Size" --> Output(["LogQueryResult (Combined Chronological Stream)"])
```

#### Merge Complexity:
- **Time Complexity**: $O(N \log K)$ where $N$ is the total candidate entries and $K$ is the number of active sources.
- **Space Complexity**: $O(K)$ auxiliary memory for the Priority Queue pointers.

---

### 4.3 Virtual Table Height & Overscan Optimization Math (`LogTable.tsx`)

To maintain a consistent 60 FPS without layout thrashing, the virtual table dynamically adapts row heights based on view mode and expansion states:

$$\text{Estimated Row Height } H_{\text{row}} = \begin{cases} 
24\text{ px} & \text{if } \text{viewMode} = \text{'compact'} \\
32\text{ px} & \text{if } \text{viewMode} = \text{'raw'} \\
54\text{ px} & \text{if } \text{viewMode} = \text{'standard'} \text{ and not expanded} \\
54 + 20 \times N_{\text{frames}} + H_{\text{payload}}\text{ px} & \text{if } \text{expanded}
\end{cases}$$

$$\text{Render Viewport Slices } [I_{\text{start}}, I_{\text{end}}] = \left[ \max\left(0, \left\lfloor \frac{S_{\text{top}}}{H_{\text{avg}}} \right\rfloor - O_{\text{scan}}\right), \min\left(N_{\text{total}}, \left\lceil \frac{S_{\text{top}} + V_{\text{height}}}{H_{\text{avg}}} \right\rceil + O_{\text{scan}}\right) \right]$$

Where:
- $S_{\text{top}}$ = Scroll container `scrollTop` offset
- $V_{\text{height}}$ = Viewport client height
- $O_{\text{scan}}$ = Overscan buffer (configured to `10` items above and below)
- $H_{\text{avg}}$ = Dynamic measured rolling average height from TanStack virtualizer

---

### 4.4 Conflict-Free Keyboard Navigation & `isInternalNavRef` Dispatcher

LogViewer supports 28 high-precision keyboard shortcuts. To avoid race conditions between programmatic scrolling, user scrolling, and keyboard selections, the system uses an atomic navigation lock:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Hotkey as App Keyboard Dispatcher
    participant Lock as isInternalNavRef Lock
    participant Panel as LogPanel State
    participant Virt as TanStack Virtualizer
    participant Table as Virtual Scroller DOM

    User->>Hotkey: Presses 'j' or 'ArrowDown'
    Hotkey->>Hotkey: Check active element !== input / textarea / modal
    Hotkey->>Lock: Set isInternalNavRef.current = true
    Hotkey->>Panel: Increment focusedLineIndex (idx -> idx + 1)
    Panel->>Virt: virtualizer.scrollToIndex(idx + 1, { align: 'auto' })
    Virt->>Table: Mutate scrollTop smoothly
    Table-->>User: Visual focus ring moves to target line
    Note over Hotkey,Lock: Release lock via requestAnimationFrame or 50ms debounce
    Hotkey->>Lock: Set isInternalNavRef.current = false
```

#### Shift-Selection Range Logic:
When the user presses `Shift + ArrowDown` or `Shift + ArrowUp`:
1. If no anchor exists, set `anchorIndex = currentFocusedIndex`.
2. Compute range: $[\min(\text{anchorIndex}, \text{newIndex}), \max(\text{anchorIndex}, \text{newIndex})]$.
3. Batch update `selectedLineIds` Set with all `entry.id` keys within the range.
4. Update UI counter: `"N lines selected"` and render floating selection bar.

---

### 4.5 Delta Time Latency Calculation Engine (`src/utils/deltaTimeEngine.ts`)

```typescript
export interface DeltaTimeResult {
  anchorEntry: LogEntry;
  targetEntry: LogEntry;
  deltaMs: number;
  deltaFormatted: string;
  isPositive: boolean; // true if target is chronologically after anchor
  ratePerSec?: number;
}

export function computeDeltaTime(anchor: LogEntry, target: LogEntry): DeltaTimeResult | null {
  const t1 = anchor.timestamp ?? (anchor.datetime ? Date.parse(anchor.datetime) : null);
  const t2 = target.timestamp ?? (target.datetime ? Date.parse(target.datetime) : null);

  if (t1 === null || t2 === null || isNaN(t1) || isNaN(t2)) {
    return null;
  }

  const deltaMs = t2 - t1;
  const absDelta = Math.abs(deltaMs);

  let deltaFormatted = '';
  if (absDelta < 1) {
    deltaFormatted = `${(absDelta * 1000).toFixed(0)} µs`;
  } else if (absDelta < 1000) {
    deltaFormatted = `${absDelta.toFixed(2)} ms`;
  } else if (absDelta < 60000) {
    deltaFormatted = `${(absDelta / 1000).toFixed(3)} s`;
  } else {
    const mins = Math.floor(absDelta / 60000);
    const secs = ((absDelta % 60000) / 1000).toFixed(1);
    deltaFormatted = `${mins}m ${secs}s`;
  }

  return {
    anchorEntry: anchor,
    targetEntry: target,
    deltaMs,
    deltaFormatted: deltaMs >= 0 ? `+${deltaFormatted}` : `-${deltaFormatted}`,
    isPositive: deltaMs >= 0,
  };
}
```

---

## 5. C4 Architecture Level 4: Code & Sequence Diagrams

### 5.1 End-to-End Query Execution Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant UI as LogPanel (React)
    participant Server as Express Server (/api/logs/query)
    participant Cache as LRU Memory Cache
    participant Reader as FileReader (Chunk Stream)
    participant Parser as Heuristic Token Parser
    participant Metrics as Telemetry Sampler

    Dev->>UI: Types Regex Filter: "error.*timeout"
    UI->>UI: Debounce input (200ms)
    UI->>Server: GET /api/logs/query?sources=app.log&q=error.*timeout&level=error&page=1&limit=500
    Server->>Metrics: Record Query Start Time
    Server->>Cache: Check Cache Key (source + mtime)
    
    alt Cache Hit
        Cache-->>Server: Return cached LogEntry[]
    else Cache Miss
        Server->>Reader: Stream file in 64KB chunks
        Reader->>Parser: Parse raw chunk lines -> LogEntry[]
        Parser-->>Reader: Tokenized Entries
        Reader->>Cache: Store parsed entries with mtime validation
        Reader-->>Server: Parsed LogEntry[] array
    end

    Server->>Server: Apply Predicates: Regex, Severity, Namespace, PID
    Server->>Server: Compute Level & Workflow Aggregations
    Server->>Server: Extract Page Slice [0..500]
    Server->>Metrics: Record Query SLA Duration (e.g. 4.2ms)
    Server-->>UI: 200 OK (LogQueryResult JSON payload)
    UI->>UI: Update TanStack Virtualizer & Render Rows at 60 FPS
```

### 5.2 Real-Time SSE Live Tail & Auto-Scroll Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor App as External Process
    participant FS as File System
    participant SSE as Express SSE (/api/logs/live/:id)
    participant UI as LogPanel (Client)
    participant Virt as TanStack Virtualizer

    App->>FS: Appends 50 new log lines
    FS-->>SSE: fs.watchFile / Polling Byte Offset Change
    SSE->>SSE: Read new byte slice from last offset
    SSE->>SSE: Parse new lines through Heuristic Parser
    SSE-->>UI: event: append\ndata: [LogEntry, ...]\n\n
    UI->>UI: Append new entries to panel stream
    
    alt autoScroll === true
        UI->>Virt: virtualizer.scrollToIndex(total - 1, { align: 'end' })
        Virt-->>UI: Auto-scroll viewport to latest line
    else autoScroll === false
        UI->>UI: Maintain user viewport position & increment "New unread lines" badge
    end
```

---

## 6. Error Handling, Memory Boundaries & Telemetry

### 6.1 Memory Safeguards
1. **Server Heap Cap**: Maximum in-memory cache allocation capped at 256MB with aggressive LRU eviction for rotated log files.
2. **Streaming Chunk Size**: Standard read streams capped at 64KB buffers to avoid node buffer allocations exceeding 2GB V8 limits.
3. **Frontend DOM Capping**: At any instant, DOM nodes rendered are strictly $V_{\text{height}} / H_{\text{row}} + 20$ (approx. 40 to 80 DOM nodes), regardless of whether the log file has 1,000 or 1,000,000 lines.
4. **AbortController Cancellation**: Every inflight HTTP query binds to an `AbortController`. When user modifies filters before previous query returns, previous request is cancelled immediately.

### 6.2 Health & Telemetry Metrics Engine (`server/metrics.ts`)
The server continuously samples operational vitals:
- **Event Loop Lag**: `monitorEventLoopDelay({ resolution: 20 })` calculates Min, Mean, P50, P90, P95, P99, Max lag.
- **Heap Vitals**: `process.memoryUsage()` tracks `heapUsed`, `heapTotal`, `rss`, `external`.
- **System Health Score ($0 - 100$)**: Computed from weighted lag degradation, heap saturation, and query error rates.
