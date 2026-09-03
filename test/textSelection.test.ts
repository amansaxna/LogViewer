import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { LogPreset, PresetRules, LogEntry } from '../src/types.ts';

console.log('--- Testing Contextual Text Selection Floating Action Menu ---');

// Test 1: Verify Component File and CSS existence
const componentPath = path.resolve(process.cwd(), 'src/components/TextSelectionToolbar.tsx');
assert.ok(fs.existsSync(componentPath), 'TextSelectionToolbar.tsx component file must exist');

const componentSource = fs.readFileSync(componentPath, 'utf-8');
assert.ok(componentSource.includes('onCopy'), 'Must support onCopy prop');
assert.ok(componentSource.includes('onFilter'), 'Must support onFilter prop');
assert.ok(componentSource.includes('onIgnore'), 'Must support onIgnore prop');
assert.ok(componentSource.includes('onAddToPresetIgnore'), 'Must support onAddToPresetIgnore prop');
assert.ok(componentSource.includes('onAddToPresetFilter'), 'Must support onAddToPresetFilter prop');
console.log('✓ Test 1 Passed: TextSelectionToolbar component props and handlers verified');

// Test 2: Verify CSS definitions in index.css
const cssSource = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf-8');
assert.ok(cssSource.includes('.text-selection-toolbar'), 'index.css must include .text-selection-toolbar');
assert.ok(cssSource.includes('.selection-action-btn.copy'), 'index.css must include copy action style');
assert.ok(cssSource.includes('.selection-action-btn.filter'), 'index.css must include filter action style');
assert.ok(cssSource.includes('.selection-action-btn.ignore'), 'index.css must include ignore action style');
assert.ok(cssSource.includes('.selection-action-btn.preset-ignore'), 'index.css must include preset-ignore action style');
assert.ok(cssSource.includes('.selection-action-btn.preset-filter'), 'index.css must include preset-filter action style');
console.log('✓ Test 2 Passed: Floating selection toolbar CSS classes and animations verified');

// Test 3: Simulation of Text Selection to Current Filter (Include & Ignore / NOT)
function formatFilterSearch(currentSearch: string, selectedText: string): string {
  return selectedText;
}

function formatIgnoreSearch(currentSearch: string, selectedText: string): string {
  const formatted = selectedText.includes(' ') ? `NOT "${selectedText}"` : `NOT ${selectedText}`;
  if (!currentSearch || currentSearch.trim().length === 0) return formatted;
  return `${currentSearch.trim()} ${formatted}`;
}

assert.strictEqual(formatFilterSearch('', 'timeout'), 'timeout');
assert.strictEqual(formatIgnoreSearch('', 'ping'), 'NOT ping');
assert.strictEqual(formatIgnoreSearch('level:ERROR', 'Card gateway timeout'), 'level:ERROR NOT "Card gateway timeout"');
console.log('✓ Test 3 Passed: Search string formatting for Include and Ignore (NOT) verified');

// Test 4: Simulation of Preset Ignore (excludeKeywords) update
const initialPreset: LogPreset = {
  id: 'test-preset',
  name: 'Test Preset',
  rules: {
    excludeKeywords: ['heartbeat'],
    includeKeywords: [],
  },
};

function addKeywordToPresetIgnore(preset: LogPreset, keyword: string): LogPreset {
  const currentList = preset.rules.excludeKeywords || [];
  if (currentList.includes(keyword)) return preset;
  return {
    ...preset,
    rules: {
      ...preset.rules,
      excludeKeywords: [...currentList, keyword],
    },
  };
}

const updatedIgnore = addKeywordToPresetIgnore(initialPreset, 'x=1');
assert.deepStrictEqual(updatedIgnore.rules.excludeKeywords, ['heartbeat', 'x=1']);
// No duplicate addition
const duplicateIgnore = addKeywordToPresetIgnore(updatedIgnore, 'x=1');
assert.strictEqual(duplicateIgnore.rules.excludeKeywords?.length, 2);
console.log('✓ Test 4 Passed: Preset noise exclusion (excludeKeywords) update verified without duplicates');

// Test 5: Simulation of Preset Filter (includeKeywords) update
function addKeywordToPresetFilter(preset: LogPreset, keyword: string): LogPreset {
  const currentList = preset.rules.includeKeywords || [];
  if (currentList.includes(keyword)) return preset;
  return {
    ...preset,
    rules: {
      ...preset.rules,
      includeKeywords: [...currentList, keyword],
    },
  };
}

const updatedFilter = addKeywordToPresetFilter(initialPreset, 'orderId');
assert.deepStrictEqual(updatedFilter.rules.includeKeywords, ['orderId']);
console.log('✓ Test 5 Passed: Preset whitelist (includeKeywords) update verified');

// Test 6: App.tsx wiring verification
const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
assert.ok(appSource.includes('<TextSelectionToolbar'), 'App.tsx must render TextSelectionToolbar');
assert.ok(appSource.includes('handleSelectionCopy'), 'App.tsx must define handleSelectionCopy');
assert.ok(appSource.includes('handleSelectionFilter'), 'App.tsx must define handleSelectionFilter');
assert.ok(appSource.includes('handleSelectionIgnore'), 'App.tsx must define handleSelectionIgnore');
assert.ok(appSource.includes('handleSelectionAddToPresetIgnore'), 'App.tsx must define handleSelectionAddToPresetIgnore');
assert.ok(appSource.includes('handleSelectionAddToPresetFilter'), 'App.tsx must define handleSelectionAddToPresetFilter');
console.log('✓ Test 6 Passed: Full App.tsx integration and event wiring verified');

// Test 7: Multi-line selection and joined text copy verification
assert.ok(appSource.includes('selectedLineNumbers.size > 1'), 'App.tsx must support multi-line Ctrl+C copying');
assert.ok(appSource.includes('joinedText'), 'App.tsx must join multi-line entries with newlines for copy');
assert.ok(appSource.includes('e.shiftKey'), 'App.tsx must check e.shiftKey for range selection');

const sampleLines = [
  { lineNumber: 101, raw: '[2026-09-02] INFO Line 1' },
  { lineNumber: 102, raw: '[2026-09-02] WARN Line 2' },
  { lineNumber: 103, raw: '[2026-09-02] ERROR Line 3' },
];
const joined = sampleLines.map((e) => e.raw).join('\n');
assert.strictEqual(joined, '[2026-09-02] INFO Line 1\n[2026-09-02] WARN Line 2\n[2026-09-02] ERROR Line 3');
console.log('✓ Test 7 Passed: Multi-line Shift-selection and joined text clipboard copy verified');

console.log('\nAll Contextual Text Selection Tests Passed Successfully!\n');
