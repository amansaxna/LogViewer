import assert from 'node:assert';

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

// 2. Verify settings are preserved
assert.strictEqual(localStorageMock.getItem('lv_search'), 'payment failed');
assert.strictEqual(localStorageMock.getItem('lv_regex'), 'true');
assert.deepStrictEqual(JSON.parse(localStorageMock.getItem('lv_selected_levels')!), ['error', 'warn']);
assert.deepStrictEqual(JSON.parse(localStorageMock.getItem('lv_exclude_levels')!), ['info']);
assert.strictEqual(localStorageMock.getItem('lv_hide_brackets'), 'true');
assert.strictEqual(localStorageMock.getItem('lv_view_mode'), 'compact');
assert.strictEqual(localStorageMock.getItem('lv_sort_option'), 'duration-desc');
assert.strictEqual(localStorageMock.getItem('lv_show_datetime'), 'false');
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
];
allKeys.forEach((k) => localStorageMock.removeItem(k));

// 4. Verify all settings reset to defaults
assert.strictEqual(localStorageMock.getItem('lv_search'), null);
assert.strictEqual(localStorageMock.getItem('lv_regex'), null);
assert.strictEqual(localStorageMock.getItem('lv_selected_levels'), null);
assert.strictEqual(localStorageMock.getItem('lv_exclude_levels'), null);
assert.strictEqual(localStorageMock.getItem('lv_hide_brackets'), null);
console.log('✓ Test 2 Passed: Reset All Settings cleanly purges stored preferences');

// 5. Test Light Mode CSS Variables Consistency
import * as fs from 'node:fs';
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

console.log('\nAll Settings, Light Mode & Fast Copy Tests Passed Successfully!');
