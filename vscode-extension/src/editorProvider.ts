import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { LogService } from './logService.ts';
import { getWebviewContent } from './webviewHtml.ts';

export class LogViewerEditorProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'logviewer.editor';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logService: LogService
  ) {}

  public async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    return { uri, dispose: () => {} };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // 1. Register the opened file as a log source
    const filePath = document.uri.fsPath;
    const source = this.logService.registerSource(filePath, path.basename(filePath), 'Opened Log File');

    // 2. Also scan workspace logs in background to populate sidebar
    this.logService.scanWorkspace().catch((err) => {
      console.warn('Error scanning workspace logs:', err);
    });

    // 3. Configure Webview options
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.context.extensionUri,
        vscode.Uri.file(path.join(this.context.extensionUri.fsPath, 'dist')),
        vscode.Uri.file(path.join(this.context.extensionUri.fsPath, '..', 'dist')),
      ],
    };

    // 4. Set HTML
    webviewPanel.webview.html = getWebviewContent(webviewPanel.webview, this.context.extensionUri);

    // 5. Wire message bus
    const unsubscribes: (() => void)[] = [];

    webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        if (!message || typeof message !== 'object') return;

        // API Request delegation
        if (message.type === 'api-request') {
          const { requestId, endpoint, method, body } = message;
          try {
            const data = await this.logService.handleApiRequest(endpoint, method, body);
            webviewPanel.webview.postMessage({
              type: 'api-response',
              requestId,
              data,
            });
          } catch (err: any) {
            webviewPanel.webview.postMessage({
              type: 'api-response',
              requestId,
              error: err.message || 'API request failed',
            });
          }
        }

        // Jump to source code location
        if (message.type === 'open-source-location') {
          const { location, line: explicitLine } = message;
          await this.handleOpenSourceLocation(location, explicitLine);
        }

        // Native File Picker Dialog
        if (message.type === 'choose-file') {
          const { requestId } = message;
          const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Open Log File',
            filters: {
              'Log Files': ['log', 'txt', 'json', 'xml'],
              'All Files': ['*'],
            },
          });
          const pickedPath = uris && uris.length > 0 ? uris[0].fsPath : null;
          webviewPanel.webview.postMessage({
            type: 'api-response',
            requestId,
            data: pickedPath,
          });
        }

        // Live stream subscription
        if (message.type === 'stream-subscribe') {
          const { sourceId } = message;
          const unsub = this.logService.subscribeTail(sourceId, (added) => {
            webviewPanel.webview.postMessage({
              type: 'stream-event',
              sourceId,
              data: { type: 'file_changed', addedLogs: added },
            });
          });
          unsubscribes.push(unsub);
        }
      },
      undefined,
      this.context.subscriptions
    );

    webviewPanel.onDidDispose(() => {
      unsubscribes.forEach((fn) => fn());
    });

    // Notify the webview of the active source ID after initialization
    setTimeout(() => {
      webviewPanel.webview.postMessage({
        type: 'set-active-source',
        sourceId: source.id,
      });
    }, 300);
  }

  /**
   * Resolves file and line number and opens the document side-by-side in VS Code.
   */
  public async handleOpenSourceLocation(location: string, explicitLine?: number): Promise<void> {
    if (!location) return;

    let targetFile = location;
    let targetLine = explicitLine || 1;

    // Parse [FileName.ts::LineNumber] or FileName.ts:LineNumber
    const match = location.match(/^(.+?)(?:::|:)(\d+)$/);
    if (match) {
      targetFile = match[1].trim();
      targetLine = parseInt(match[2], 10);
    }

    // Strip leading brackets if any
    targetFile = targetFile.replace(/^[\[\(]+|[\]\)]+$/g, '').trim();

    try {
      let targetUri: vscode.Uri | null = null;

      if (path.isAbsolute(targetFile) && fs.existsSync(targetFile)) {
        targetUri = vscode.Uri.file(targetFile);
      } else {
        const baseName = path.basename(targetFile);
        const results = await vscode.workspace.findFiles(`**/${baseName}`, '**/node_modules/**', 10);

        if (results.length > 0) {
          // If multiple matches, check for matching directory segments
          const exactMatch = results.find((r) => r.fsPath.endsWith(targetFile.replace(/^[./\\]+/, '')));
          targetUri = exactMatch || results[0];
        }
      }

      if (targetUri) {
        const doc = await vscode.workspace.openTextDocument(targetUri);
        await vscode.window.showTextDocument(doc, {
          selection: new vscode.Range(Math.max(0, targetLine - 1), 0, Math.max(0, targetLine - 1), 0),
          viewColumn: vscode.ViewColumn.Beside,
          preview: true,
        });
      } else {
        vscode.window.showInformationMessage(`Could not find "${targetFile}" in the current workspace.`);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to open code location: ${err.message}`);
    }
  }
}
