import { copyWithToast } from '../utils/copyNotifier.ts';

export interface VsCodeApi {
  postMessage: (message: any) => void;
  setState: (state: any) => void;
  getState: () => any;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
    __vscodeApi?: VsCodeApi;
    __lv_is_vscode?: boolean;
  }
}

let vscodeApiInstance: VsCodeApi | null = null;

export function getVsCodeApi(): VsCodeApi | null {
  if (typeof window === 'undefined') return null;
  if (vscodeApiInstance) return vscodeApiInstance;
  if (window.__vscodeApi) {
    vscodeApiInstance = window.__vscodeApi;
    return vscodeApiInstance;
  }
  if (typeof window.acquireVsCodeApi === 'function') {
    try {
      vscodeApiInstance = window.acquireVsCodeApi();
      window.__vscodeApi = vscodeApiInstance;
      return vscodeApiInstance;
    } catch {
      return null;
    }
  }
  return null;
}

export function isVsCode(): boolean {
  return getVsCodeApi() !== null;
}

let reqCounter = 0;
const pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timer: any }>();
const streamSubscribers = new Map<string, Set<(data: any) => void>>();

// Listen for messages from VS Code Extension Host
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'api-response' && msg.requestId) {
      const handler = pendingRequests.get(msg.requestId);
      if (handler) {
        clearTimeout(handler.timer);
        pendingRequests.delete(msg.requestId);
        if (msg.error) {
          handler.reject(new Error(msg.error));
        } else {
          handler.resolve(msg.data);
        }
      }
    } else if (msg.type === 'stream-event' && msg.sourceId) {
      const subs = streamSubscribers.get(msg.sourceId);
      if (subs) {
        subs.forEach((cb) => {
          try {
            cb(msg.data);
          } catch (e) {
            console.error('Error in stream callback:', e);
          }
        });
      }
    } else if (msg.type === 'set-active-source' && msg.sourceId) {
      window.dispatchEvent(new CustomEvent('vscode-set-active-source', { detail: msg }));
    }
  });
}

/**
 * Universal API fetch that seamlessly dispatches to VS Code Extension Host (via IPC postMessage)
 * or to standard HTTP fetch in the browser.
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options?: { method?: string; body?: any; headers?: any }
): Promise<T> {
  const vscode = getVsCodeApi();
  if (vscode) {
    return new Promise<T>((resolve, reject) => {
      const requestId = `req_${++reqCounter}_${Date.now()}`;
      const timer = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error(`Timeout waiting for response from VS Code extension for ${endpoint}`));
      }, 30000);

      pendingRequests.set(requestId, { resolve, reject, timer });
      vscode.postMessage({
        type: 'api-request',
        requestId,
        endpoint,
        method: options?.method || 'GET',
        body: options?.body,
      });
    });
  }

  // Web fallback: standard HTTP fetch
  const fetchOptions: RequestInit = {
    method: options?.method || 'GET',
    headers: options?.headers || (options?.body ? { 'Content-Type': 'application/json' } : undefined),
  };
  if (options?.body) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const res = await window.fetch(endpoint, fetchOptions);
  if (!res.ok) {
    let errMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const data = await res.json();
      if (data && data.error) errMessage = data.error;
    } catch {}
    throw new Error(errMessage);
  }
  return res.json() as Promise<T>;
}

/**
 * Universal live tail subscription (VS Code IPC event stream or Web EventSource).
 */
export function subscribeLogStream(
  sourceId: string,
  onEntry: (entry: any) => void,
  onError?: (err: any) => void
): () => void {
  const vscode = getVsCodeApi();
  if (vscode) {
    if (!streamSubscribers.has(sourceId)) {
      streamSubscribers.set(sourceId, new Set());
      vscode.postMessage({ type: 'stream-subscribe', sourceId });
    }
    const set = streamSubscribers.get(sourceId)!;
    set.add(onEntry);

    return () => {
      set.delete(onEntry);
      if (set.size === 0) {
        streamSubscribers.delete(sourceId);
        vscode.postMessage({ type: 'stream-unsubscribe', sourceId });
      }
    };
  }

  // Web fallback: Server-Sent Events
  const es = new EventSource(`/api/logs/stream?sourceId=${encodeURIComponent(sourceId)}`);
  es.onmessage = (event) => {
    try {
      const entry = JSON.parse(event.data);
      onEntry(entry);
    } catch (err) {
      console.error('Failed to parse SSE event:', err);
    }
  };
  if (onError) {
    es.onerror = onError;
  }
  return () => {
    es.close();
  };
}

/**
 * Opens a code location (file and line) in VS Code editor, or copies to clipboard with toast in browser.
 */
export function openSourceLocation(location: string, line?: number) {
  if (!location) return;
  const vscode = getVsCodeApi();
  if (vscode) {
    vscode.postMessage({
      type: 'open-source-location',
      location,
      line,
    });
  } else {
    copyWithToast(line ? `${location}:${line}` : location, 'Code Location');
  }
}

/**
 * Triggers native VS Code file open dialog or returns null in browser.
 */
export async function chooseFileNative(): Promise<string | null> {
  const vscode = getVsCodeApi();
  if (vscode) {
    return new Promise((resolve) => {
      const requestId = `file_pick_${++reqCounter}_${Date.now()}`;
      const timer = setTimeout(() => {
        pendingRequests.delete(requestId);
        resolve(null);
      }, 60000);

      pendingRequests.set(requestId, { resolve, reject: () => resolve(null), timer });
      vscode.postMessage({
        type: 'choose-file',
        requestId,
      });
    });
  }
  return null;
}
