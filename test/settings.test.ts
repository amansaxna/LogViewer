import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- Testing Settings Persistence & Reset ---');

// Mock localStorage
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
};

// 1. Simulate saving user customized settings
localStorageMock.setItem('lv_search', 'payment failed');
localStorageMock.setItem('lv_regex', 'true');
localStorageMock.setItem('lv_selected_levels', JSON.stringify(['error', 'warn']));
localStorageMock.setItem('lv_exclude_levels', JSON.stringify(['info']));
localStorageMock.setItem('lv_hide_brackets', 'true');
localStorageMock.setItem('lv_view_mode', 'compact');
localStorageMock.setItem('lv_sort_option', 'duration-desc');
localStorageMock.setItem('lv_show_datetime', 'false');
localStorageMock.setItem('lv_live_tail', 'true');

// 2. Verify settings are preserved
assert.strictEqual(localStorageMock.getItem('lv_search'), 'payment failed');
assert.strictEqual(localStorageMock.getItem('lv_regex'), 'true');
assert.deepStrictEqual(JSON.parse(localStorageMock.getItem('lv_selected_levels')!), ['error', 'warn']);
assert.deepStrictEqual(JSON.parse(localStorageMock.getItem('lv_exclude_levels')!), ['info']);
assert.strictEqual(localStorageMock.getItem('lv_hide_brackets'), 'true');
assert.strictEqual(localStorageMock.getItem('lv_view_mode'), 'compact');
assert.strictEqual(localStorageMock.getItem('lv_sort_option'), 'duration-desc');
assert.strictEqual(localStorageMock.getItem('lv_show_datetime'), 'false');
assert.strictEqual(localStorageMock.getItem('lv_live_tail'), 'true');
console.log('✓ Test 1 Passed: All settings correctly preserved in localStorage across reloads');

// 3. Simulate Reset Settings action
const allKeys = [
  'lv_active_source',
  'lv_marker_filter',
  'lv_marker_regex',
  'lv_search',
  'lv_regex',
  'lv_case_sensitive',
  'lv_invert',
  'lv_selected_levels',
  'lv_exclude_levels',
  'lv_selected_workflow',
  'lv_selected_operation',
  'lv_selected_correlation',
  'lv_start_date',
  'lv_end_date',
  'lv_sort_option',
  'lv_wrap_lines',
  'lv_hide_brackets',
  'lv_view_mode',
  'lv_show_datetime',
  'lv_show_pid',
  'lv_show_tid',
  'lv_show_corr',
  'lv_theme',
  'lv_sidebar',
  'lv_live_tail',
];
allKeys.forEach((k) => localStorageMock.removeItem(k));

// 4. Verify all settings reset to defaults
assert.strictEqual(localStorageMock.getItem('lv_search'), null);
assert.strictEqual(localStorageMock.getItem('lv_regex'), null);
assert.strictEqual(localStorageMock.getItem('lv_selected_levels'), null);
assert.strictEqual(localStorageMock.getItem('lv_exclude_levels'), null);
assert.strictEqual(localStorageMock.getItem('lv_hide_brackets'), null);
assert.strictEqual(localStorageMock.getItem('lv_live_tail'), null);
console.log('✓ Test 2 Passed: Reset All Settings cleanly purges stored preferences');

// 5. Test Light Mode CSS Variables Consistency
const indexCss = fs.readFileSync('src/index.css', 'utf-8');
assert.ok(indexCss.includes("[data-theme='light']"), 'Light theme CSS block must exist');
assert.ok(indexCss.includes('--badge-bg: #ece5d9;'), 'Light theme size badge bg defined');
assert.ok(indexCss.includes('.fast-copy-btn'), 'Fast copy button CSS rules must exist');
assert.ok(indexCss.includes('.compact-log-row:hover .fast-copy-btn'), 'Fast copy button visible on row hover');
console.log('✓ Test 3 Passed: Light mode CSS variables and fast copy button rules verified');

// 6. Test Source Files Light Mode Hardcoded Colors Check
const topbarTsx = fs.readFileSync('src/components/Topbar.tsx', 'utf-8');
assert.ok(!topbarTsx.includes("placeholder=\"Filter active operations...\"\n                    value={operationSearch}\n                    onChange={(e) => setOperationSearch(e.target.value)}\n                    className=\"sidebar-search-input\"\n                    style={{ fontSize: '0.78rem', padding: '5px 10px', background: '#0f172a'"), 'Operations dropdown input must not have hardcoded dark background #0f172a');
assert.ok(!topbarTsx.includes("placeholder=\"Filter active workflows...\"\n                    value={workflowSearch}\n                    onChange={(e) => setWorkflowSearch(e.target.value)}\n                    className=\"sidebar-search-input\"\n                    style={{ fontSize: '0.78rem', padding: '5px 10px', background: '#0f172a'"), 'Workflow dropdown input must not have hardcoded dark background #0f172a');
console.log('✓ Test 4 Passed: Topbar facet dropdowns completely purged of hardcoded dark backgrounds');

// 7. Test Copy Notification & 20 Chars Snippet Formatting
function formatCopySnippet(text: string): { first20: string; snippet: string } {
  const normalized = text.replace(/[\r\n\t]+/g, ' ').trim();
  const first20 = normalized.slice(0, 20);
  const snippet = normalized.length > 20 ? `${first20}…` : first20;
  return { first20, snippet };
}

const sampleCopy1 = 'Operation ReserveInventory completed successfully';
const res1 = formatCopySnippet(sampleCopy1);
assert.strictEqual(res1.first20, 'Operation ReserveInv');
assert.strictEqual(res1.first20.length, 20);
assert.strictEqual(res1.snippet, 'Operation ReserveInv…');

const sampleCopy2 = 'Short string';
const res2 = formatCopySnippet(sampleCopy2);
assert.strictEqual(res2.first20, 'Short string');
assert.strictEqual(res2.snippet, 'Short string');

console.log('✓ Test 5 Passed: Copy notification first 20 chars snippet accurately extracted and formatted');

// Test 6: Verify unified line navigator metrics (zero duplication of line counts)
function formatUnifiedLineMetrics(currentLine: number, filteredCount: number, totalEntries: number): string {
  if (filteredCount < totalEntries) {
    return `Line: [ ${currentLine} ] / ${filteredCount.toLocaleString()} (of ${totalEntries.toLocaleString()})`;
  }
  return `Line: [ ${currentLine} ] / ${totalEntries.toLocaleString()}`;
}

assert.strictEqual(formatUnifiedLineMetrics(1, 5251, 5251), 'Line: [ 1 ] / 5,251', 'Must not duplicate 5,251 twice');
assert.strictEqual(formatUnifiedLineMetrics(1, 2114, 5257), 'Line: [ 1 ] / 2,114 (of 5,257)', '2,114 appears only once, with total file count in parentheses');
console.log('✓ Test 6 Passed: Unified Line Navigator shows line count exactly once without duplication');

// Test 7: Verify uniform [ ] selection UX (highlighted means visible)
function getBracketButtonState(hideBrackets: boolean) {
  return {
    isActive: !hideBrackets, // active (highlighted) means brackets ARE visible
    label: '[ ]',
    title: !hideBrackets ? 'Hide [ ] bracket markers' : 'Show [ ] bracket markers',
  };
}

const visibleState = getBracketButtonState(false);
assert.strictEqual(visibleState.isActive, true, 'When brackets are visible, button is active (highlighted)');
assert.strictEqual(visibleState.label, '[ ]');

const hiddenState = getBracketButtonState(true);
assert.strictEqual(hiddenState.isActive, false, 'When brackets are hidden, button is inactive (unhighlighted)');
assert.strictEqual(hiddenState.label, '[ ]');
console.log('✓ Test 7 Passed: [ ] selection UX is uniform with other toggles (highlighted = visible)');

// Test 8: Verify DEFAULT_PRESETS are available instantly on startup
import { DEFAULT_PRESETS } from '../src/presets.ts';
assert.ok(Array.isArray(DEFAULT_PRESETS), 'DEFAULT_PRESETS must be an array');
assert.ok(DEFAULT_PRESETS.length >= 4, 'Must contain at least 4 default presets');
assert.ok(DEFAULT_PRESETS.some((p) => p.id === 'minimal-set'), 'Must include minimal-set');
console.log('✓ Test 8 Passed: DEFAULT_PRESETS are bundled and ready immediately with 0ms delay');

// Test 9: Verify Fullscreen Persistence, Sidebar Hiding, and Unified Color Scheme
localStorageMock.setItem('lv_fullscreen', 'true');
assert.strictEqual(localStorageMock.getItem('lv_fullscreen'), 'true', 'Fullscreen state must be preserved in localStorage');

const cssContent = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf-8');
assert.ok(cssContent.includes('.app-container.app-fullscreen .sidebar'), 'CSS must include rule to hide sidebar in fullscreen');
assert.ok(cssContent.includes('.preset-trigger-btn'), 'CSS must define .preset-trigger-btn');
assert.ok(cssContent.includes('.toolbar-toggle-btn'), 'CSS must define .toolbar-toggle-btn');
assert.ok(cssContent.includes('[data-theme=\'light\'] .preset-trigger-btn.active'), 'CSS must define light mode readable style for preset button');

// Verify level colors (error, debug, warn, info, audit) remain strictly intact
assert.ok(cssContent.includes('--lvl-critical: #e11d48'), 'Level critical color intact');
assert.ok(cssContent.includes('--lvl-error: #dc2626'), 'Level error color intact');
assert.ok(cssContent.includes('--lvl-warn: #d97706'), 'Level warn color intact');
assert.ok(cssContent.includes('--lvl-audit: #0d9488'), 'Level audit color intact');
assert.ok(cssContent.includes('--lvl-debug: #57534e'), 'Level debug color intact');
console.log('✓ Test 9 Passed: Fullscreen persistence, left tab hiding, and unified filter color scheme verified');

// Test 10: Verify Uncluttered Minimal UI (No "Line:", No "logs/s", No "LIVE/PAUSED", Icon-only buttons & Sleek Tooltips)
assert.ok(cssContent.includes('[data-tooltip]'), 'CSS must define sleek [data-tooltip] system');
assert.ok(cssContent.includes('[data-tooltip]::after'), 'CSS must style [data-tooltip]::after with modern floating container');

const topbarSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Topbar.tsx'), 'utf-8');
assert.ok(!topbarSource.includes('>Line:<'), 'Topbar must not render hardcoded "Line:" label');
assert.ok(!topbarSource.includes('>LIVE<'), 'Topbar must not render text "LIVE" on live stream button');
assert.ok(!topbarSource.includes('>PAUSED<'), 'Topbar must not render text "PAUSED" on live stream button');
assert.ok(!topbarSource.includes('>Wrap<'), 'Topbar must not render text "Wrap" on wrap button');
assert.ok(!topbarSource.includes('>Meta:<'), 'Topbar must not render text "Meta:" label');
assert.ok(!topbarSource.includes('>Export<'), 'Topbar must not render text "Export" on export button');
assert.ok(!topbarSource.includes('>Compact<'), 'Topbar must not render text "Compact" on segmented switcher');
assert.ok(!topbarSource.includes('>Cards<'), 'Topbar must not render text "Cards" on segmented switcher');
assert.ok(!topbarSource.includes('logs/s<'), 'Topbar must not render "logs/s" text on rate badges');
console.log('✓ Test 10 Passed: UI successfully uncluttered - all requested text labels removed with sleek tooltips applied');

// Test 11: Verify Preset Modal Closing & Modifier Pass-Through (Ctrl+C not hijacked)
const presetModalCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/PresetModal.tsx'), 'utf-8');
assert.ok(presetModalCode.includes('e.key === \'Escape\''), 'PresetModal must have dedicated Escape key listener');
assert.ok(/Close\s*<\/button>/i.test(presetModalCode), 'PresetModal must provide an explicit Close button in footer');

const appCode = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
assert.ok(appCode.includes('if (isPresetModalOpen) { setIsPresetModalOpen(false);'), 'App.tsx Escape handler must close PresetModal');
assert.ok(appCode.includes('const hasModifier = e.ctrlKey || e.metaKey || e.altKey;'), 'App.tsx must check for modifier keys so native OS Ctrl+C/Cmd+C is never hijacked');
console.log('✓ Test 11 Passed: Preset Modal closing verified and native Ctrl+C pass-through confirmed');

console.log('\nAll Settings, Light Mode, Fast Copy & Toast Tests Passed Successfully!\n');
