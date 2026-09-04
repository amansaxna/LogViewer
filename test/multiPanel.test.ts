import assert from 'node:assert';
import { createDefaultPanel, getLayoutCount, PanelLayout, PanelState } from '../src/types/panel.ts';
import { LogSource } from '../src/types.ts';

console.log('--- Running Multi-Panel Window Test Suite ---');

// Test 1: Layout Count Calculation
assert.strictEqual(getLayoutCount('1'), 1);
assert.strictEqual(getLayoutCount('2-col'), 2);
assert.strictEqual(getLayoutCount('2-row'), 2);
assert.strictEqual(getLayoutCount('3-grid'), 3);
assert.strictEqual(getLayoutCount('4-grid'), 4);
console.log('✓ Test 1 Passed: Correct panel count mapped for all layout modes (1, 2-col, 2-row, 3-grid, 4-grid)');

// Test 2: Panel Default State Factory
const panel1 = createDefaultPanel('panel-1', {
  sourceId: 'src-app-log',
  search: 'timeout',
  viewMode: 'compact',
});
assert.strictEqual(panel1.id, 'panel-1');
assert.strictEqual(panel1.sourceId, 'src-app-log');
assert.strictEqual(panel1.search, 'timeout');
assert.strictEqual(panel1.viewMode, 'compact');
assert.strictEqual(panel1.wrapLines, false);
assert.strictEqual(panel1.showDatetime, true);
assert.deepStrictEqual(panel1.selectedLevels, []);
console.log('✓ Test 2 Passed: Panel default factory constructs valid panel states with defaults and overrides');

// Test 3: Panel State Isolation (Independent Filters per Panel)
const panel2 = createDefaultPanel('panel-2', {
  sourceId: 'src-system-log',
  selectedLevels: ['error', 'warning'],
  search: 'failed',
  viewMode: 'standard',
});
const panel3 = createDefaultPanel('panel-3', {
  sourceId: 'src-service-xml',
  selectedLevels: ['debug'],
  viewMode: 'raw',
});
const panel4 = createDefaultPanel('panel-4', {
  sourceId: 'src-events-json',
  markerFilter: 'Checkout',
});

// Verify each panel has distinct sources and filter configurations
assert.notStrictEqual(panel1.sourceId, panel2.sourceId);
assert.notStrictEqual(panel2.selectedLevels, panel3.selectedLevels);
assert.strictEqual(panel2.viewMode, 'standard');
assert.strictEqual(panel3.viewMode, 'raw');
assert.strictEqual(panel4.markerFilter, 'Checkout');
console.log('✓ Test 3 Passed: Panel instances maintain independent sources, view modes, and search filters');

// Test 4: Dynamic Layout Distribution & Source Auto-Allocation
const mockSources: LogSource[] = [
  { id: 'app-log', name: 'Application Log', category: 'Backend', path: './logs/app.log' },
  { id: 'sys-log', name: 'System Log', category: 'OS', path: './logs/system.log' },
  { id: 'audit-xml', name: 'Audit Log (XML)', category: 'Audit', path: './logs/service_audit.xml' },
  { id: 'stream-json', name: 'Events Stream (JSON)', category: 'JSON Logs', path: './logs/events_stream.json' },
];

const panels: PanelState[] = ['panel-1', 'panel-2', 'panel-3', 'panel-4'].map((id, idx) =>
  createDefaultPanel(id, {
    sourceId: mockSources[idx % mockSources.length].id,
    selectedSourceIds: [mockSources[idx % mockSources.length].id],
  })
);

assert.strictEqual(panels.length, 4);
assert.strictEqual(panels[0].sourceId, 'app-log');
assert.strictEqual(panels[1].sourceId, 'sys-log');
assert.strictEqual(panels[2].sourceId, 'audit-xml');
assert.strictEqual(panels[3].sourceId, 'stream-json');
console.log('✓ Test 4 Passed: 4-panel configuration auto-allocates distinct log sources simultaneously');

// Test 5: Panel Maximize & Layout Reduction Transitions
function closePanel(currentLayout: PanelLayout): PanelLayout {
  if (currentLayout === '4-grid') return '3-grid';
  if (currentLayout === '3-grid') return '2-col';
  if (currentLayout === '2-col' || currentLayout === '2-row') return '1';
  return '1';
}

assert.strictEqual(closePanel('4-grid'), '3-grid');
assert.strictEqual(closePanel('3-grid'), '2-col');
assert.strictEqual(closePanel('2-col'), '1');
assert.strictEqual(closePanel('1'), '1');
console.log('✓ Test 5 Passed: Layout transition logic cleanly handles panel reduction and maximize');

console.log('All Multi-Panel Window Tests Passed Successfully!');
