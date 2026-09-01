# Transaction & Operational Ledger - LogViewer

This document outlines the transaction lifecycle, state mutations, and operational audit trail for the LogViewer system.

---

## 1. Transaction Types & Life Cycle

The LogViewer system executes several types of state-altering transactions:

| Transaction Type | Trigger / Endpoint | Description | Idempotent | Side Effects |
|---|---|---|---|---|
| `TXN_LOAD_CONFIG` | Server Startup (`server/config.ts`) | Reads `config/log_sources.json` and builds the base source registry | Yes | Memory cache initialization |
| `TXN_OPEN_FILE` | `POST /api/sources/open` | Registers an arbitrary local filesystem path as a temporary custom source | Yes | Assigns custom base64 ID, stats file metadata |
| `TXN_CLOSE_FILE` | `DELETE /api/sources/:id` | Removes an opened ad-hoc file from the active session | Yes | Evicts source and cached index |
| `TXN_QUERY_LOGS` | `GET /api/logs/entries` | Executes search, regex matching, level filtering, and pagination | Yes | Computes duration metrics, updates read cache |
| `TXN_STREAM_CONNECT` | `GET /api/logs/stream` | Opens SSE channel for active live-tail monitoring | Yes | Spawns background polling timer |
| `TXN_PASTE_LOGS` | `POST /api/logs/paste` | Creates an ephemeral or named log source from user clipboard/raw text | Yes | Writes log file, registers custom source |
| `TXN_SORT_MARKERS` | `GET /api/logs/entries?sortBy=marker` | Reorders log stream by workflow marker name alphabetically | Yes | None |
| `TXN_CLEAR_LOG` | `POST /api/logs/clear` | Truncates target log file on disk to 0 bytes upon user confirmation | No | Modifies disk file, invalidates file cache |
| `TXN_DOWNLOAD_LOG` | `GET /api/logs/download` | Streams raw file content to the client browser for offline backup | Yes | None |

---

## 2. Event Ledger (Audit Log)

Each operation creates a structured transaction record conforming to the following schema:

```json
{
  "transactionId": "txn_64a9108b-212",
  "timestamp": "2026-09-02T00:01:10.104Z",
  "type": "TXN_OPEN_FILE",
  "actor": "local_user",
  "payload": {
    "sourceId": "custom-L3Zhci9sb2cvc3lz",
    "path": "/var/log/system.log",
    "sizeBytes": 1048576,
    "status": "SUCCESS"
  },
  "durationMs": 1.42
}
```

---

## 3. Concurrency & Cache Invalidation Policy

1. **Read-Through Invalidation**:
   - `fileCache` stores parsed entries keyed by absolute file path alongside `mtimeMs` and `size`.
   - On every query or SSE tick, `fs.statSync` verifies whether `mtimeMs` or `size` changed.
   - If changed, the cache entry is evicted and reparsed asynchronously.
2. **File Truncation (`TXN_CLEAR_LOG`)**:
   - When a clear transaction executes, `fs.writeFileSync(path, '', 'utf-8')` is followed by explicit cache clearance.
   - The SSE stream immediately detects `size === 0` and broadcasts a `file_changed` event to all listening browser tabs.
3. **Graceful Error Handling**:
   - Inexistent paths or permission errors reject with HTTP 400/404 without crashing the background process.
