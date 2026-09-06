// Client-side observability & crash telemetry reporter

interface ClientTelemetryEvent {
  type: 'error' | 'unhandled_rejection' | 'flicker_detected' | 'file_load_failed' | 'stream_interrupted' | 'react_error';
  message: string;
  stack?: string;
  panelId?: string;
  context?: any;
}

let isInitialized = false;
const recentEventsBuffer: string[] = [];
const MAX_BUFFER = 20;

// Throttled sender
let pendingReports: ClientTelemetryEvent[] = [];
let reportTimeout: any = null;

function flushReports() {
  if (pendingReports.length === 0) return;
  const toSend = [...pendingReports];
  pendingReports = [];

  toSend.forEach((ev) => {
    try {
      fetch('/api/metrics/client-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ev),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  });
}

function queueReport(event: ClientTelemetryEvent) {
  const hash = `${event.type}:${event.message}:${event.panelId || ''}`;
  if (recentEventsBuffer.includes(hash)) {
    return; // deduplicate rapid repeating errors
  }
  recentEventsBuffer.push(hash);
  if (recentEventsBuffer.length > MAX_BUFFER) {
    recentEventsBuffer.shift();
  }

  pendingReports.push(event);
  if (!reportTimeout) {
    reportTimeout = setTimeout(() => {
      reportTimeout = null;
      flushReports();
    }, 200);
  }
}

export function initClientTelemetry() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // 1. Unhandled Global Errors
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    // Ignore benign browser/extension errors
    if (
      msg.includes('ResizeObserver') ||
      msg.includes('Script error') ||
      event.filename?.includes('chrome-extension://') ||
      event.filename?.includes('moz-extension://')
    ) {
      return;
    }

    queueReport({
      type: 'error',
      message: msg || 'Unknown Global Window Error',
      stack: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  // 2. Unhandled Promise Rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason?.message || String(reason || '');

    // Ignore intentional network cancellations and benign aborts
    if (
      reason?.name === 'AbortError' ||
      msg.includes('aborted') ||
      msg.includes('signal is aborted') ||
      msg.includes('user aborted')
    ) {
      return;
    }

    queueReport({
      type: 'unhandled_rejection',
      message: msg || 'Unhandled Promise Rejection',
      stack: reason?.stack,
    });
  });
}

export function reportReactError(error: Error, errorInfo: { componentStack?: string }) {
  queueReport({
    type: 'react_error',
    message: error.message || 'React Component Render Crash',
    stack: error.stack,
    context: {
      componentStack: errorInfo.componentStack,
    },
  });
}

export function reportFlickerDetected(panelId: string, count: number, reason: string) {
  queueReport({
    type: 'flicker_detected',
    panelId,
    message: `${count} rapid queries in <800ms (${reason})`,
    context: { count, reason },
  });
}

export function reportStreamInterrupted(panelId?: string, reason?: string) {
  queueReport({
    type: 'stream_interrupted',
    panelId,
    message: reason || 'Live stream dropped or stalled',
    context: { reason },
  });
}

export function reportFileLoadFailed(sourceId: string, path: string, reason: string) {
  queueReport({
    type: 'file_load_failed',
    message: `Failed to load log source "${sourceId}"`,
    context: { sourceId, path, reason },
  });
}
