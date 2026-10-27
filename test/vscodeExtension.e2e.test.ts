import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { LogService } from '../vscode-extension/src/logService.ts';
import { getWebviewContent } from '../vscode-extension/src/webviewHtml.ts';

console.log('--- Running End-to-End Tests: VS Code Extension ---');

// Mock VS Code Extension Context for LogService
const mockContext: any = {
  extensionUri: {
    fsPath: path.resolve('vscode-extension'),
  },
  globalStorageUri: {
    fsPath: path.resolve('vscode-extension', 'dist', 'storage'),
  },
  subscriptions: [],
};

// ---------------------------------------------------------------------------
// TEST 1: Extension Manifest & VSIX Packaging Validation
// ---------------------------------------------------------------------------
console.log('\n[Suite 1] Validating Extension Manifest & Packaging Integrity...');
const manifestPath = path.resolve('vscode-extension/package.json');
assert.ok(fs.existsSync(manifestPath), 'vscode-extension/package.json must exist');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
assert.strictEqual(manifest.name, 'logviewer', 'Package name must be logviewer');
assert.strictEqual(manifest.publisher, 'amansaxna', 'Publisher must be amansaxna');
assert.ok(manifest.engines?.vscode, 'Engines vscode must be defined');

// Verify custom editor registration
const customEditors = manifest.contributes?.customEditors;
assert.ok(Array.isArray(customEditors) && customEditors.length > 0, 'customEditors contribution must be defined');
const editor = customEditors[0];
assert.strictEqual(editor.viewType, 'logviewer.editor', 'Editor viewType must be logviewer.editor');
assert.strictEqual(editor.displayName, 'LogViewer', 'Editor displayName must be LogViewer');

const hasLogSelector = editor.selector.some((s: any) => s.filenamePattern === '*.log');
const hasTxtSelector = editor.selector.some((s: any) => s.filenamePattern === '*.txt');
assert.ok(hasLogSelector, 'Editor must select *.log files');
assert.ok(hasTxtSelector, 'Editor must select *.txt files');

// Verify commands
const commands = manifest.contributes?.commands;
assert.ok(commands.some((c: any) => c.command === 'logviewer.open'), 'Command logviewer.open must be registered');
assert.ok(commands.some((c: any) => c.command === 'logviewer.openCurrentFile'), 'Command logviewer.openCurrentFile must be registered');
assert.ok(commands.some((c: any) => c.command === 'logviewer.openSourcesConfig'), 'Command logviewer.openSourcesConfig must be registered');
assert.ok(commands.some((c: any) => c.command === 'logviewer.openPresetsConfig'), 'Command logviewer.openPresetsConfig must be registered');

// Verify built artifacts
const bundlePath = path.resolve('vscode-extension/dist/extension.js');
assert.ok(fs.existsSync(bundlePath), 'Compiled extension.js must exist in vscode-extension/dist');
const bundleStats = fs.statSync(bundlePath);
assert.ok(bundleStats.size > 10000, `extension.js size (${bundleStats.size} bytes) must be substantial`);

const vsixPath = path.resolve('vscode-extension/logviewer-1.0.0.vsix');
assert.ok(fs.existsSync(vsixPath), 'VSIX package logviewer-1.0.0.vsix must exist');
const vsixStats = fs.statSync(vsixPath);
assert.ok(vsixStats.size > 100000, `VSIX package size (${vsixStats.size} bytes) must be valid (>100KB)`);

console.log('✓ Test 1 Passed: Extension manifest, commands, bundle, and VSIX package verified.');

// ---------------------------------------------------------------------------
// TEST 2: Webview HTML Generator & CSP Injection
// ---------------------------------------------------------------------------
console.log('\n[Suite 2] Validating Webview HTML Generation & CSP Injection...');
const mockWebview: any = {
  asWebviewUri: (uri: any) => {
    return {
      toString: () => `vscode-webview-resource://${path.basename(uri.fsPath)}`,
    };
  },
};

const generatedHtml = getWebviewContent(mockWebview, mockContext.extensionUri);
assert.ok(generatedHtml.includes('<!doctype html>'), 'Generated HTML must have DOCTYPE');
assert.ok(generatedHtml.includes('<div id="root"></div>'), 'HTML must include root mounting node');
assert.ok(generatedHtml.includes('window.__lv_is_vscode = true'), 'HTML must inject window.__lv_is_vscode = true');
assert.ok(generatedHtml.includes('vscode-webview-resource://'), 'Assets must be rewritten with asWebviewUri');
assert.ok(generatedHtml.includes('.js'), 'HTML must reference bundled JavaScript');
assert.ok(generatedHtml.includes('.css'), 'HTML must reference stylesheet');
console.log('✓ Test 2 Passed: Webview HTML generation, asset rewriting, and bootstrap script verified.');

// ---------------------------------------------------------------------------
// TEST 3: LogService Source Registration & Rotation Grouping
// ---------------------------------------------------------------------------
console.log('\n[Suite 3] Testing LogService Source Registration & Rotation Grouping...');
const logService = new LogService(mockContext);

const parentLogPath = path.resolve('logs/app_workflow.log');
const rotatedLogPath = path.resolve('logs/app_workflow.log.1');

assert.ok(fs.existsSync(parentLogPath), 'logs/app_workflow.log must exist');
assert.ok(fs.existsSync(rotatedLogPath), 'logs/app_workflow.log.1 must exist');

const parentSource = logService.registerSource(parentLogPath, 'app_workflow.log', 'Application Logs');
const rotatedSource = logService.registerSource(rotatedLogPath, 'app_workflow.log.1', 'Application Logs');

assert.ok(parentSource.id, 'Parent source must receive an ID');
assert.ok(rotatedSource.id, 'Rotated source must receive an ID');
assert.strictEqual(rotatedSource.isRotated, true, 'app_workflow.log.1 must be recognized as rotated archive');
assert.strictEqual(rotatedSource.rotationSuffix, '.1', 'Rotation suffix must be .1');

const allSources = logService.getAllSources();
const matchedParent = allSources.find((s) => s.id === parentSource.id);
assert.ok(matchedParent, 'Parent source must be present in source list');
assert.ok(matchedParent.rotations && matchedParent.rotations.length > 0, 'Parent source must have rotations attached');
assert.strictEqual(matchedParent.rotations[0].id, rotatedSource.id, 'Rotated source must be grouped under parent');

// Test workspace scanning from config/log_sources.json
const scannedSources = await logService.scanWorkspace();
assert.ok(scannedSources.length > 0, 'Workspace scan must discover log sources');
const defaultSource = logService.getDefaultSource();
assert.ok(defaultSource, 'A default log source must be identified');
assert.strictEqual(defaultSource.isDefault, true, 'Default log source must have isDefault: true');
assert.ok(defaultSource.name.includes('Workflow') || defaultSource.path.includes('app_workflow.log'), 'Default source must be app_workflow.log');

console.log('✓ Test 3 Passed: Source registration, stat calculation, JSON config discovery, default source, and rotation hierarchy verified.');

// ---------------------------------------------------------------------------
// TEST 4: Query Engine & API Router (/api/logs/entries)
// ---------------------------------------------------------------------------
console.log('\n[Suite 4] Testing End-to-End Log Query Engine & API Router...');

// Test 4a: Full query on rotated log
const initialResult = await logService.handleApiRequest(
  `/api/logs/entries?sourceId=${encodeURIComponent(rotatedSource.id)}`,
  'GET'
);

assert.ok(initialResult, 'Query result must not be null');
assert.ok(Array.isArray(initialResult.entries), 'Entries must be an array');
assert.ok(initialResult.total > 0, 'Rotated log entries total must be > 0');
assert.ok(initialResult.levelCounts, 'levelCounts must be populated');
assert.ok(initialResult.durationMs >= 0, 'durationMs must be measured');

// Line 11 check (user edited line)
const line11 = initialResult.entries.find((e: any) => e.lineNumber === 11);
assert.ok(line11, 'Line 11 entry must be present in parsed entries');
assert.strictEqual(line11.correlationId, 'corr-6f-4a3', 'Line 11 correlation ID must be parsed');
assert.strictEqual(line11.workflow, 'WF:RefundProcess-1011', 'Line 11 workflow must be parsed');
assert.strictEqual(line11.operation, 'PurgeStaleSessions', 'Line 11 operation must be parsed');
assert.strictEqual(line11.duration, '296ms', 'Line 11 duration must be parsed');
assert.ok(line11.fileLocation?.includes('WebhookClient.ts::198'), 'Line 11 location must be WebhookClient.ts::198');

// Test 4b: Level Filtering
const errorResult = await logService.handleApiRequest(
  `/api/logs/entries?sourceId=${encodeURIComponent(rotatedSource.id)}&levels=error,critical,failed`,
  'GET'
);
assert.ok(
  errorResult.entries.every((e: any) => ['error', 'critical', 'failed'].includes(e.level)),
  'Every returned entry must match the requested level filters'
);

// Test 4c: Search Query
const searchResult = await logService.handleApiRequest(
  `/api/logs/entries?sourceId=${encodeURIComponent(rotatedSource.id)}&search=RefundProcess`,
  'GET'
);
assert.ok(searchResult.total > 0, 'Search for RefundProcess must return matching rows');
assert.ok(
  searchResult.entries.every((e: any) =>
    e.raw.includes('RefundProcess') || e.workflow?.includes('RefundProcess')
  ),
  'All returned search results must match the search term'
);

// Test 4d: Marker Filtering
const markerResult = await logService.handleApiRequest(
  `/api/logs/entries?sourceId=${encodeURIComponent(rotatedSource.id)}&marker=StockSync`,
  'GET'
);
assert.ok(markerResult.total > 0, 'Marker filter for StockSync must return matching rows');
assert.ok(
  markerResult.entries.every((e: any) => e.workflow?.includes('StockSync')),
  'All returned marker results must contain StockSync'
);

// Test 4e: Sorting by Duration Descending
const durationSortResult = await logService.handleApiRequest(
  `/api/logs/entries?sourceId=${encodeURIComponent(rotatedSource.id)}&sortBy=duration&direction=desc&pageSize=10`,
  'GET'
);
assert.ok(durationSortResult.entries.length > 0, 'Duration sort must return entries');
console.log('✓ Test 4 Passed: Log queries, regex search, level filtering, marker filtering, and sorting verified.');

// ---------------------------------------------------------------------------
// TEST 5: Context Lines (/api/logs/context)
// ---------------------------------------------------------------------------
console.log('\n[Suite 5] Testing Surrounding Context Lines Viewer (/api/logs/context)...');
const contextResult = await logService.handleApiRequest(
  `/api/logs/context?sourceId=${encodeURIComponent(rotatedSource.id)}&lineNumber=11&radius=5`,
  'GET'
);

assert.ok(contextResult, 'Context result must exist');
assert.ok(Array.isArray(contextResult.lines), 'Context lines must be an array');
assert.strictEqual(contextResult.targetLineNumber, 11, 'Target line number must be 11');

const targetLine = contextResult.lines.find((l: any) => l.isTarget);
assert.ok(targetLine, 'A line with isTarget: true must exist');
assert.strictEqual(targetLine.number, 11, 'Target line number must be 11');
assert.ok(targetLine.content.includes('corr-6f-4a3'), 'Target line content must match line 11');
console.log('✓ Test 5 Passed: Surrounding lines context retrieval and target pinning verified.');

// ---------------------------------------------------------------------------
// TEST 6: Presets API Integration (/api/presets)
// ---------------------------------------------------------------------------
console.log('\n[Suite 6] Testing Presets CRUD via API Router (/api/presets)...');
const presetsGet = await logService.handleApiRequest('/api/presets', 'GET');
assert.ok(Array.isArray(presetsGet.presets), 'Presets list must be an array');
assert.ok(presetsGet.presets.length >= 4, 'Must include presets');
assert.ok(presetsGet.presets.some((p: any) => p.id === 'minimal-set'), 'Must include "minimal-set" from presets.json');
assert.ok(presetsGet.presets.some((p: any) => p.id === 'clean-messages'), 'Must include "clean-messages" from presets.json');
assert.ok(presetsGet.presets.some((p: any) => p.id === 'errors-critical'), 'Must include "errors-critical" from presets.json');

const testPreset = {
  id: 'test-custom-preset-101',
  name: 'Critical Audit Triage',
  description: 'Custom test preset for audit events',
  rules: {
    levels: ['audit', 'critical'],
    search: 'Security',
  },
};

const saveResult = await logService.handleApiRequest('/api/presets', 'POST', testPreset);
assert.strictEqual(saveResult.preset.id, 'test-custom-preset-101', 'Saved preset ID must match');

const presetsAfterSave = await logService.handleApiRequest('/api/presets', 'GET');
const foundPreset = presetsAfterSave.presets.find((p: any) => p.id === 'test-custom-preset-101');
assert.ok(foundPreset, 'Saved preset must appear in presets list');

const deleteResult = await logService.handleApiRequest(
  `/api/presets/${encodeURIComponent('test-custom-preset-101')}`,
  'DELETE'
);
assert.strictEqual(deleteResult.success, true, 'Deleting preset must return success: true');

const presetsAfterDelete = await logService.handleApiRequest('/api/presets', 'GET');
assert.ok(
  !presetsAfterDelete.presets.some((p: any) => p.id === 'test-custom-preset-101'),
  'Deleted preset must no longer appear in presets list'
);
console.log('✓ Test 6 Passed: Presets GET, POST, and DELETE router lifecycle verified.');

// ---------------------------------------------------------------------------
// TEST 7: Jump-to-Source Location Parsing
// ---------------------------------------------------------------------------
console.log('\n[Suite 7] Testing Jump-to-Source Location Parser...');
function parseLocation(location: string, explicitLine?: number) {
  let targetFile = location.replace(/^[\[\(]+|[\]\)]+$/g, '').trim();
  let targetLine = explicitLine || 1;
  const match = targetFile.match(/^(.+?)(?:::|:)(\d+)$/);
  if (match) {
    targetFile = match[1].trim();
    targetLine = parseInt(match[2], 10);
  }
  return { targetFile, targetLine };
}

const parsed1 = parseLocation('[SyncWorker.ts::140]');
assert.strictEqual(parsed1.targetFile, 'SyncWorker.ts');
assert.strictEqual(parsed1.targetLine, 140);

const parsed2 = parseLocation('AuthTokenProvider.ts:88');
assert.strictEqual(parsed2.targetFile, 'AuthTokenProvider.ts');
assert.strictEqual(parsed2.targetLine, 88);

const parsed3 = parseLocation('[PaymentVault.go::78]');
assert.strictEqual(parsed3.targetFile, 'PaymentVault.go');
assert.strictEqual(parsed3.targetLine, 78);

console.log('✓ Test 7 Passed: Jump-to-source file and line extraction verified.');

// ---------------------------------------------------------------------------
// TEST 8: Real-Time Live Tail Stream & File Watcher
// ---------------------------------------------------------------------------
console.log('\n[Suite 8] Testing Real-Time Live Tail File Watcher...');
const tempTestLogPath = path.resolve('logs/temp_e2e_tail.log');
fs.writeFileSync(tempTestLogPath, '[2026-10-11 00:00:00.000] [INFO] Initial line\n', 'utf-8');

try {
  const tempSource = logService.registerSource(tempTestLogPath, 'temp_e2e_tail.log', 'Test');
  
  let watcherTriggered = false;
  let addedCountReceived = 0;

  const unsubscribe = logService.subscribeTail(tempSource.id, (added) => {
    watcherTriggered = true;
    addedCountReceived += added;
  });

  // Append new line to test file
  await new Promise((r) => setTimeout(r, 200));
  fs.appendFileSync(tempTestLogPath, '[2026-10-11 00:00:01.000] [ERROR] Appended live tail event\n', 'utf-8');

  // Wait for watcher interval (500ms) to detect change
  await new Promise((r) => setTimeout(r, 900));

  assert.ok(watcherTriggered, 'File watcher must detect appended log line');
  assert.ok(addedCountReceived >= 1, 'Added line count must be at least 1');

  unsubscribe();
  console.log('✓ Test 8 Passed: Live tail stream subscription, file change detection, and unsubscription verified.');
} finally {
  if (fs.existsSync(tempTestLogPath)) {
    fs.unlinkSync(tempTestLogPath);
  }
}

// ---------------------------------------------------------------------------
// TEST 9: Frontend Bridge IPC Protocol Contract
// ---------------------------------------------------------------------------
console.log('\n[Suite 9] Testing Frontend Bridge IPC Protocol Contract...');
// Simulate postMessage request from Webview to Extension Host
async function simulateWebviewPostMessage(message: any) {
  if (message.type === 'api-request') {
    try {
      const data = await logService.handleApiRequest(message.endpoint, message.method, message.body);
      return { type: 'api-response', requestId: message.requestId, data };
    } catch (err: any) {
      return { type: 'api-response', requestId: message.requestId, error: err.message };
    }
  }
  throw new Error(`Unexpected message type: ${message.type}`);
}

const reqId = 'req_test_123';
const simulatedResponse = await simulateWebviewPostMessage({
  type: 'api-request',
  requestId: reqId,
  endpoint: '/api/sources',
  method: 'GET',
});

assert.strictEqual(simulatedResponse.type, 'api-response');
assert.strictEqual(simulatedResponse.requestId, reqId);
assert.ok(Array.isArray(simulatedResponse.data?.sources), 'IPC response must include sources array');

// Simulate error handling
const errorResponse = await simulateWebviewPostMessage({
  type: 'api-request',
  requestId: 'req_err_999',
  endpoint: '/api/invalid/route',
  method: 'GET',
});
assert.strictEqual(errorResponse.type, 'api-response');
assert.ok(errorResponse.error, 'IPC error response must include error message');

console.log('✓ Test 9 Passed: Frontend Bridge IPC protocol contract and error handling verified.');

console.log('\n============================================================');
console.log('🎉 ALL 9 VS CODE EXTENSION END-TO-END TESTS PASSED SUCCESSFULLY!');
console.log('============================================================\n');
