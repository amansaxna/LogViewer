# LogViewer for Visual Studio Code

A lightning-fast, high-performance structured log visualizer and debugging cockpit for Visual Studio Code.

![LogViewer](https://raw.githubusercontent.com/amansaxna/LogViewer/main/dist/Viewer.png)

## Features

- ⚡ **High-Performance Virtual Scrolling**: Smoothly render 100,000+ log lines at 60 FPS powered by TanStack Virtual.
- 🎯 **Jump-to-Source Code Navigation (Killer Feature)**:
  - Click on any trailing code location badge `[FileName.ext::LineNumber]` or stack trace frame.
  - Instantly opens the exact source code file and highlights the line number in an adjacent editor split!
- 🔍 **Permissive Flat & Structured Log Parser**:
  - Automatically identifies bracketed markers: Datetime, PID, TID, Correlation ID, Namespace, Workflow, Operation, Duration, and Severity Level.
  - Gracefully handles markerless plain logs, multi-line stack traces, JSON logs, and XML logs.
- 📂 **Native Custom Editor (`*.log`, `*.txt`)**:
  - Right-click any log file $\to$ **Open With... $\to$ LogViewer**.
  - Or click the command in the editor title bar or explorer context menu.
- 🗂️ **Workspace Auto-Discovery**:
  - Automatically scans workspace folders for log files and presents them in a collapsible sidebar.
  - Supports log rotation detection (`.log.1`, `.log.2`, date-based rotations `YYYY-MM-DD.log`).
- ⏱️ **Live Tail & Velocity Metrics**:
  - Real-time file change observation with live stream indicator and dual velocity rates (current / average logs per second).
- 🏷️ **Rule Engine & Presets**:
  - Pre-configured triage presets: *Errors & Crashes*, *Slow Operations (>500ms)*, *Security & Auth*, *Warnings & Retries*.
  - Full support for custom regex, search invert, keyword filters, and column toggles.
- 🎨 **Native Theme Harmony**:
  - Adapts to VS Code light and dark themes while maintaining high-contrast severity badges and rich syntax highlighting.

---

## How to Use

### 1. Open Current File in LogViewer
- Right-click any `.log` or `.txt` file in the Explorer and select **Open Current File in LogViewer**.
- Or use the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`): `LogViewer: Open Current File`.

### 2. Open Workspace Logs
- In the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`), select:
  `LogViewer: Open LogViewer (Workspace Logs)`
- All `.log` files in the current workspace folders will be auto-discovered in the sidebar.

### 3. Click to Jump to Code
- Whenever a log line has a location like `[AuthTokenProvider.ts::88]` or a stack trace frame, simply **click on the location token**.
- VS Code will search the workspace and open the file at that exact line side-by-side with your logs.

---

## Building & Packaging

```bash
# Build webview bundle and compile extension
npm run build:ext

# Package as .vsix extension for distribution or local install
npm run package:ext
```

To install locally in VS Code:
```bash
code --install-extension vscode-extension/logviewer-1.0.0.vsix
```
