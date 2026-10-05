import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  // Look for the built frontend in ../dist or ./dist/webview or root dist
  const candidatePaths = [
    path.join(extensionUri.fsPath, 'dist', 'index.html'),
    path.join(extensionUri.fsPath, '..', 'dist', 'index.html'),
  ];

  let indexPath: string | null = null;
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      indexPath = p;
      break;
    }
  }

  if (!indexPath) {
    return `<!DOCTYPE html>
    <html>
      <body style="font-family: sans-serif; padding: 24px; color: #fff; background: #0f172a;">
        <h2>LogViewer Build Not Found</h2>
        <p>Please run <code>npm run build</code> in the LogViewer root directory to compile the Webview bundle.</p>
      </body>
    </html>`;
  }

  const baseDir = path.dirname(indexPath);
  let html = fs.readFileSync(indexPath, 'utf-8');

  // Replace relative asset references like ./assets/... or /assets/... with webview URIs
  html = html.replace(/(?:src|href)=["'](?:\.?\/)?assets\/([^"']+)["']/g, (_match, filename) => {
    const fileOnDisk = vscode.Uri.file(path.join(baseDir, 'assets', filename));
    const webviewUri = webview.asWebviewUri(fileOnDisk);
    const attr = _match.startsWith('src=') ? 'src' : 'href';
    return `${attr}="${webviewUri.toString()}"`;
  });

  // Inject a small bootstrap script setting VS Code flag before app bundles execute
  const bootstrapScript = `
    <script>
      window.__lv_is_vscode = true;
    </script>
  `;

  html = html.replace('</head>', `${bootstrapScript}</head>`);

  return html;
}
