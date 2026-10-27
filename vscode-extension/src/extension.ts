import * as vscode from 'vscode';
import * as path from 'node:path';
import { LogService } from './logService.ts';
import { LogViewerEditorProvider } from './editorProvider.ts';
import { getWebviewContent } from './webviewHtml.ts';

export function activate(context: vscode.ExtensionContext) {
  const logService = new LogService(context);

  // 1. Register Custom Editor Provider for *.log, *.log.*, *.txt
  const editorProvider = new LogViewerEditorProvider(context, logService);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      LogViewerEditorProvider.viewType,
      editorProvider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      }
    )
  );

  // 2. Command: Open LogViewer (Workspace Logs)
  const openWorkspaceLogsCommand = vscode.commands.registerCommand('logviewer.open', async () => {
    const panel = vscode.window.createWebviewPanel(
      'logviewer.workspace',
      'LogViewer',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          context.extensionUri,
          vscode.Uri.file(path.join(context.extensionUri.fsPath, 'dist')),
          vscode.Uri.file(path.join(context.extensionUri.fsPath, '..', 'dist')),
        ],
      }
    );

    panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

    // Initial scan of workspace
    await logService.scanWorkspace();
    const defaultSource = logService.getDefaultSource();
    if (defaultSource) {
      setTimeout(() => {
        panel.webview.postMessage({
          type: 'set-active-source',
          sourceId: defaultSource.id,
        });
      }, 300);
    }

    // Wire message bus
    const unsubscribes: (() => void)[] = [];

    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (!message || typeof message !== 'object') return;

        if (message.type === 'api-request') {
          const { requestId, endpoint, method, body } = message;
          try {
            const data = await logService.handleApiRequest(endpoint, method, body);
            panel.webview.postMessage({ type: 'api-response', requestId, data });
          } catch (err: any) {
            panel.webview.postMessage({ type: 'api-response', requestId, error: err.message });
          }
        }

        if (message.type === 'open-source-location') {
          await editorProvider.handleOpenSourceLocation(message.location, message.line);
        }

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
          panel.webview.postMessage({ type: 'api-response', requestId, data: pickedPath });
        }

        if (message.type === 'stream-subscribe') {
          const { sourceId } = message;
          const unsub = logService.subscribeTail(sourceId, (added) => {
            panel.webview.postMessage({
              type: 'stream-event',
              sourceId,
              data: { type: 'file_changed', addedLogs: added },
            });
          });
          unsubscribes.push(unsub);
        }
      },
      undefined,
      context.subscriptions
    );

    panel.onDidDispose(() => {
      unsubscribes.forEach((fn) => fn());
    });
  });

  // 3. Command: Open Current File in LogViewer
  const openCurrentFileCommand = vscode.commands.registerCommand('logviewer.openCurrentFile', async (uri?: vscode.Uri) => {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
      vscode.window.showInformationMessage('No active file to open in LogViewer.');
      return;
    }

    await vscode.commands.executeCommand('vscode.openWith', targetUri, LogViewerEditorProvider.viewType);
  });

  // 4. Command: Open Sources JSON Configuration
  const openSourcesConfigCommand = vscode.commands.registerCommand('logviewer.openSourcesConfig', async () => {
    const configPath = logService.getSourcesConfigPath(true);
    if (!configPath) {
      vscode.window.showInformationMessage('No active workspace folder to create log sources configuration.');
      return;
    }

    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      const initialConfig = {
        folders: [
          {
            path: './logs',
            category: 'Discovered Logs',
            recursive: true,
          },
        ],
        sources: [
          {
            id: 'default-app-log',
            name: 'Default Application Log',
            category: 'Application Logs',
            path: './logs/app_workflow.log',
            isDefault: true,
            description: 'Default primary log source loaded on workspace launch',
          },
        ],
      };
      fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), 'utf-8');
    }

    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
    await vscode.window.showTextDocument(doc);
  });

  // 5. Command: Open Presets JSON Configuration
  const openPresetsConfigCommand = vscode.commands.registerCommand('logviewer.openPresetsConfig', async () => {
    const configPath = logService.getPresetsConfigPath(true);
    if (!configPath) {
      vscode.window.showInformationMessage('No active workspace folder to create presets configuration.');
      return;
    }

    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({ presets: logService.getPresets() }, null, 2),
        'utf-8'
      );
    }

    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
    await vscode.window.showTextDocument(doc);
  });

  context.subscriptions.push(
    openWorkspaceLogsCommand,
    openCurrentFileCommand,
    openSourcesConfigCommand,
    openPresetsConfigCommand
  );
}

export function deactivate() {}
