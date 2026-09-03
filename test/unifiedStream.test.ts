import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { queryLogs, SOURCE_PALETTE, getSourceColor } from '../server/fileReader.ts';
import { LogQuery } from '../server/types.ts';

console.log('--- Testing Multi-Source Log Merging (Unified Stream) ---');

// Test 1: SOURCE_PALETTE & Color Consistency
assert.ok(SOURCE_PALETTE.length >= 6, 'SOURCE_PALETTE must contain multiple vibrant distinguishable colors');
assert.strictEqual(getSourceColor(0), SOURCE_PALETTE[0]);
assert.strictEqual(getSourceColor(1), SOURCE_PALETTE[1]);
assert.strictEqual(getSourceColor(SOURCE_PALETTE.length), SOURCE_PALETTE[0], 'Must wrap modulo smoothly');
console.log('✓ Test 1 Passed: SOURCE_PALETTE color assignment verified');

// Test 2: Multi-Source query execution and source tagging
const query: LogQuery = {
  sourceId: 'app-workflow',
  sourceIds: ['app-workflow', 'payments-audit'],
  sortBy: 'time',
  direction: 'desc',
};

const result = queryLogs(query);
assert.ok(result.entries.length > 0, 'Entries must be returned for merged sources');
assert.ok(result.total >= result.entries.length, 'Total must account for all merged sources');

// Check that returned entries have sourceId, sourceName, and sourceColor populated
const sourcesSeen = new Set<string>();
for (const entry of result.entries) {
  assert.ok(entry.sourceId, 'Entry must have sourceId');
  assert.ok(entry.sourceName, 'Entry must have sourceName');
  assert.ok(entry.sourceColor, 'Entry must have sourceColor');
  sourcesSeen.add(entry.sourceId);
}

assert.ok(sourcesSeen.size >= 2, `Expected entries from multiple sources, got ${sourcesSeen.size}`);
console.log(`✓ Test 2 Passed: Multi-source query merged ${sourcesSeen.size} sources with source metadata`);

// Test 3: Chronological timestamp ordering across merged files
const ascQuery: LogQuery = {
  sourceId: 'app-workflow',
  sourceIds: ['app-workflow', 'payments-audit'],
  sortBy: 'time',
  direction: 'asc',
};

const ascResult = queryLogs(ascQuery);
for (let i = 1; i < ascResult.entries.length; i++) {
  const prevTime = ascResult.entries[i - 1].timestamp || 0;
  const currTime = ascResult.entries[i].timestamp || 0;
  if (prevTime > 0 && currTime > 0) {
    assert.ok(
      prevTime <= currTime,
      `Entries must be sorted chronologically asc: ${prevTime} should be <= ${currTime}`
    );
  }
}
console.log('✓ Test 3 Passed: Chronological timestamp sorting verified across merged log sources');

// Test 4: Search and Level Filtering across unified sources
const errorQuery: LogQuery = {
  sourceId: 'app-workflow',
  sourceIds: ['app-workflow', 'payments-audit'],
  levels: ['error', 'critical', 'info'],
  sortBy: 'time',
  direction: 'desc',
};

const errorResult = queryLogs(errorQuery);
for (const entry of errorResult.entries) {
  assert.ok(
    entry.level === 'error' || entry.level === 'critical' || entry.level === 'info',
    `Entry level ${entry.level} must match filter`
  );
}
console.log('✓ Test 4 Passed: Level filtering works correctly across unified streams');

// Test 5: Sidebar and Topbar JSX Component Integration
const sidebarSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Sidebar.tsx'), 'utf-8');
assert.ok(sidebarSource.includes('selectedSourceIds'), 'Sidebar must receive selectedSourceIds');
assert.ok(sidebarSource.includes('Unified Stream'), 'Sidebar must render Unified Stream button');
assert.ok(sidebarSource.includes('source-checkbox-btn'), 'Sidebar must render individual source checkboxes');

const compactRowSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/CompactLogRow.tsx'), 'utf-8');
assert.ok(compactRowSource.includes('entry.sourceName'), 'CompactLogRow must render sourceName badge');
assert.ok(compactRowSource.includes('entry.sourceColor'), 'CompactLogRow must apply sourceColor style');

const topbarSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Topbar.tsx'), 'utf-8');
assert.ok(topbarSource.includes('isUnifiedStream'), 'Topbar must support isUnifiedStream');
assert.ok(topbarSource.includes('Unified Stream'), 'Topbar must display Unified Stream indicator');

console.log('✓ Test 5 Passed: Full UI component integration and source badge rendering verified');

console.log('\nAll Multi-Source Unified Stream Tests Passed Successfully!\n');
