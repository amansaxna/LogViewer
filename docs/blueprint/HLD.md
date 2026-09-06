# High-Level Design (HLD): LogViewer Architecture

> **Document Version**: 2.0.0  
> **Status**: Approved & Active  
> **Target System**: Local High-Throughput Structured Log Analysis & Telemetry Platform  
> **Primary Authors**: Core Architecture Engineering Team  

---

## 1. Executive Summary & Problem Statement

Modern microservice, distributed, and backend system development generates massive volumes of semi-structured and unstructured flat log files. Developers and site reliability engineers (SREs) frequently encounter two major extremes:
1. **Cloud Observability Tools (Datadog, Splunk, Elastic)**: Incur high latency, cost, and strict data exfiltration/privacy barriers during local development, integration testing, and offline triage.
2. **Traditional Command-Line Tools (`grep`, `tail -f`, `less`, `awk`)**: Lack multi-panel spatial layouts, interactive token filtering, visual call stack decomposition, delta-time latency measurements, and real-time unified streams across multiple files.

**LogViewer** bridges this gap as a zero-cloud, ultra-fast, local-first web application capable of ingesting, indexing, and rendering massive log streams at **60 frames per second (FPS)** while providing IDE-grade ergonomics, heuristic token classification, and multi-source correlation.

---

## 2. Core Architectural Principles & NFRs

| Principle / NFR | Architecture Strategy | Target Metric / SLA |
| :--- | :--- | :--- |
| **Virtual 60 FPS Rendering** | Virtualized DOM windowing (`@tanstack/react-virtual`) rendering only viewable elements. | Stable 60 FPS up to 1,000,000 log lines |
| **Sub-Millisecond Query Response** | LRU memory caching, zero-copy string slicing, and indexed binary search. | P50 < 4ms, P99 < 50ms for 500k lines |
| **Permissive 0-Config Ingestion** | Dynamic heuristic regex classifier parsing leading brackets, timestamps, and stack traces without requiring predefined schemas. | 100% ingest rate across arbitrary logs |
| **Multi-Panel Isolation & Synchronization** | Independent panel state containers with global coordinate broadcast and focus targeting. | Supports 1, 2-col, 2-row, 3-grid, 4-grid simultaneously |
| **Local-First Zero Data Exfiltration** | Strictly self-contained Node.js & React architecture running on `localhost`. | Zero external network calls; 100% air-gapped |
| **Comprehensive System Telemetry** | Native event-loop, heap, cache, and SLA telemetry with client-side incident tracking. | Real-time health scoring (0–100) & incident audit log |

---

## 3. C4 Architecture Level 1: System Context Diagram

The following C4 Context diagram illustrates how developers, engineers, and external file system streams interact with the LogViewer system boundary:

```mermaid
C4Context
    title System Context Diagram for LogViewer Platform

    Person(developer, "Software Engineer / SRE", "Analyzes, filters, measures latency, and debugs multi-source log streams.")
    
    System(logViewer, "LogViewer System", "Local-first, high-throughput log visualization, multi-panel grid, and telemetry engine.")
    
    System_Ext(filesystem, "Local File System", "Stores raw log files, rotated archives (.log.1, .log.2), and dynamic system logs.")
    System_Ext(logProducers, "Log Stream Generators", "Microservices, background daemons, or docker containers appending logs at 100+ lines/sec.")
    System_Ext(osClipboard, "OS Clipboard", "Accepts structured multi-line selections, raw traces, and delta latency payloads.")

    Rel(developer, logViewer, "Views logs, searches with regex, inspects stack traces, and controls layouts via UI and keyboard", "HTTPS / WebSocket / Hotkeys")
    Rel(logProducers, filesystem, "Writes operational event streams", "POSIX I/O")
    Rel(logViewer, filesystem, "Discovers sources, scans rotations, watches tail changes, and streams byte ranges", "Node fs.promises / SSE")
    Rel(logViewer, osClipboard, "Copies selected lines, token values, JSON/XML blocks, and delta measurements", "Navigator Clipboard API")
```

---

## 4. C4 Architecture Level 2: Container Diagram

The system comprises two core containers: a **Single-Page Application (SPA) Frontend** and a **Node.js High-Throughput Ingestion Backend**:

```mermaid
C4Container
    title Container Diagram for LogViewer Platform

    Person(user, "User / Developer", "Interacts via browser")

    Container_Boundary(c1, "LogViewer Platform") {
        Container(spa, "Single-Page Application (SPA)", "React 19, TypeScript, TanStack Virtual, Vanilla CSS", "Provides virtualized log feeds, 4-panel grid, floating selection actions, delta time ruler, and telemetry dashboards.")
        Container(backend, "Ingestion & Analysis Server", "Node.js, Express, TypeScript, tsx", "Exposes REST endpoints, SSE streams, LRU memory caches, heuristic parsers, and system telemetry monitors.")
    }

    ContainerDb(fileStorage, "Log Files & Rotations", "Local Disk (SSD / HDD)", "Pre-configured logs, custom uploaded paths, rotated backups, and live streams.")

    Rel(user, spa, "Navigates, selects lines, triggers shortcuts, switches layouts", "Browser UI / Hotkeys")
    Rel(spa, backend, "Queries filtered entries, requests context surroundings, streams live tail updates, reports metrics", "REST / SSE (/api/*)")
    Rel(backend, fileStorage, "Reads chunked logs, watches file size, queries directory trees", "Native File System API")
```

---

## 5. End-to-End Data Flow Architecture

### 5.1 Ingestion, Parsing & Indexing Flow
```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant UI as React UI (LogPanel)
    participant API as Express Server (server/index.ts)
    participant Reader as FileReader (fileReader.ts)
    participant Parser as Parser Engine (parser.ts)
    participant FS as Local File System

    Dev->>UI: Selects Source / Enters Search / Updates Filters
    UI->>API: GET /api/logs/entries?sourceId=X&search=Y&levels=error
    API->>Reader: queryLogs(queryOptions)
    
    alt File in LRU Cache & Unchanged
        Reader->>Reader: Fetch Cached Structured Entries
    else Cache Miss or File Modified
        Reader->>FS: Read File Stream (fs.createReadStream)
        FS-->>Reader: Raw Text Buffer
        Reader->>Parser: parseRawLogText(content, sourceId)
        Parser->>Parser: Heuristic Token Classification (Datetime, PID, TID, Markers, Operations, Traces)
        Parser-->>Reader: Structured LogEntry[] Array
        Reader->>Reader: Store in LRU Cache with File Invalidation Check
    end

    Reader->>Reader: Apply Predicates (Search, Regex, Level Exclusion, Marker, Datetime Range)
    Reader->>Reader: Execute Sorting (time-asc, time-desc, line, marker)
    Reader-->>API: Filtered LogQueryResult (Entries, Stats, LevelCounts, DurationMs)
    API-->>UI: JSON Response Payload
    UI->>UI: TanStack Virtualizer Renders Visible Viewport (60 FPS)
```

### 5.2 Multi-Source Unified Merge Stream Flow
When multiple log files are checked in the sidebar, LogViewer chronologically merges diverse files into a unified timeline:

```mermaid
graph TD
    A[Source A: app_workflow.log] -->|Parse & Tokenize| PA[Entries Array A]
    B[Source B: payments.log] -->|Parse & Tokenize| PB[Entries Array B]
    C[Source C: system_errors.log] -->|Parse & Tokenize| PC[Entries Array C]

    PA --> M[Multi-Source Merge Engine]
    PB --> M
    PC --> M

    M -->|Extract Timestamps & Normalize ISO-8601| T[Timestamp Normalizer]
    T -->|O N log K Priority Interleaving| S[Unified Chronological Stream]
    S -->|Apply Source Color Palette Palette-1..Palette-8| SC[Color-Coded Source Badges]
    SC -->|Apply Universal Filters| V[Virtualized Panel Feed]
```

---

## 6. Multi-Panel Grid Orchestration

The application supports simultaneous multi-file observation through an adaptive grid manager:

```mermaid
graph LR
    subgraph Layout Options
        L1[Single Panel 1]
        L2[2-Panel Split 2-col / 2-row]
        L3[3-Panel Grid 3-grid]
        L4[4-Panel Quad 4-grid]
    end

    subgraph Panel State Isolation
        P1[Panel 1 State: Source A, View: Compact, Filter: Error]
        P2[Panel 2 State: Source B, View: Standard, Filter: Workflow]
        P3[Panel 3 State: Unified A+B, View: Raw, Filter: PID]
        P4[Panel 4 State: Source C, View: Compact, Live Tail: ON]
    end

    subgraph Shared Controls & Broadcast
        GC[Global Topbar Controls]
        SC[Sidebar Target Selector]
        KH[Global Keyboard Event Loop]
    end

    GC -.->|Sync Metadata Toggles & Theme| P1 & P2 & P3 & P4
    SC -->|Focus Target Insertion P1..P4| P1 & P2 & P3 & P4
    KH -->|Routes Keystrokes to Active Panel| P1 & P2 & P3 & P4
```

---

## 7. Memory & Performance Safeguards

1. **LRU In-Memory Cache**:
   - Fixed capacity caching parsed `LogEntry[]` structures.
   - Cache keys incorporate source ID, file mtime, and file size to eliminate stale data bugs.
2. **Backpressure & Memory Bounds**:
   - Query results default to slicing 15,000 maximum entries per viewport window.
   - Automatic buffer truncation guards prevent browser out-of-memory (OOM) states on multi-gigabyte log streams.
3. **AbortController Request Cancellation**:
   - In-flight fetch queries for any panel are aborted immediately when new filter keystrokes arrive, preventing cascading network stalls.
4. **Debounced Live Tail Polling**:
   - Live stream polling defaults to 500ms intervals with request locking to prevent overlapping tick collisions.

---

## 8. Telemetry & Observability Architecture

LogViewer contains a built-in telemetry engine (`server/metrics.ts` & `src/utils/clientTelemetry.ts`) tracking:
* **Event Loop Latency**: Samples Node.js event loop lag percentiles (Min, Mean, P50, P90, P95, P99, Max).
* **Heap Vitals**: Real-time tracking of heap used, heap total, external memory, and RSS.
* **Query SLA Benchmarks**: P50, P95, and P99 query duration percentiles, slow query threshold detection (>200ms), and throughput QPS.
* **Cache Efficiency**: Hit ratio tracking, miss classification (`initial_load`, `file_modified`, `evicted_lru`), and eviction audits.
* **Client Incident Recording**: Browser crash diagnostics, unhandled promise rejection capturing, and rapid flicker thrashing alerts.
