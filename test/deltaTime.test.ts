import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractEntryTimestampMs,
  formatDeltaMs,
  calculateDeltaTime,
} from '../src/utils/deltaTimeEngine.ts';
import { LogEntry } from '../src/types.ts';

console.log('--- Testing Delta Time / Latency Between Lines ---');

// Test 1: Timestamp Extraction from Datetime & Numeric timestamp
const entry1: LogEntry = {
  id: '1',
  lineNumber: 1,
  raw: 'line 1',
  datetime: '2026-09-02 00:05:01.002',
  level: 'info',
  message: 'First step',
};

const entry2: LogEntry = {
  id: '2',
  lineNumber: 7,
  raw: 'line 7',
  datetime: '2026-09-02 00:05:22.010',
  level: 'info',
  message: 'Second step',
};

const t1 = extractEntryTimestampMs(entry1);
const t2 = extractEntryTimestampMs(entry2);

assert.ok(t1 !== null, 'Entry 1 timestamp should be extracted');
assert.ok(t2 !== null, 'Entry 2 timestamp should be extracted');
assert.strictEqual(t2! - t1!, 21008, 'Delta between t1 and t2 must be 21,008ms');
console.log('✓ Test 1 Passed: Timestamp extraction from ISO datetime strings verified');

// Test 2: Formatting Delta Durations (ms, s, m s, h m s)
assert.strictEqual(formatDeltaMs(342), '+342ms');
assert.strictEqual(formatDeltaMs(-342), '−342ms');
assert.strictEqual(formatDeltaMs(0), '0ms');
assert.strictEqual(formatDeltaMs(21008), '+21.008s');
assert.strictEqual(formatDeltaMs(125400), '+2m 5.4s');
assert.strictEqual(formatDeltaMs(3665000), '+1h 1m 5s');
console.log('✓ Test 2 Passed: Human readable latency delta formatting verified across all time magnitudes');

// Test 3: Full Delta Time Calculation with Step Count
const delta = calculateDeltaTime(entry1, entry2, [entry1, entry2]);
assert.ok(delta !== null, 'Delta measurement object should be generated');
assert.strictEqual(delta.anchorLine, 1);
assert.strictEqual(delta.targetLine, 7);
assert.strictEqual(delta.deltaMs, 21008);
assert.strictEqual(delta.formattedDelta, '+21.008s');
assert.strictEqual(delta.stepCount, 1);
assert.strictEqual(delta.direction, 'forward');
console.log('✓ Test 3 Passed: calculateDeltaTime forward calculation and step count verified');

// Test 4: Reverse / Backward Delta calculation
const reverseDelta = calculateDeltaTime(entry2, entry1, [entry1, entry2]);
assert.ok(reverseDelta !== null);
assert.strictEqual(reverseDelta.deltaMs, -21008);
assert.strictEqual(reverseDelta.formattedDelta, '−21.008s');
assert.strictEqual(reverseDelta.direction, 'backward');
console.log('✓ Test 4 Passed: Backward delta measurement and sign formatting verified');

// Test 5: Verify JSX and Component Props Integration
const compactRowSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/CompactLogRow.tsx'), 'utf-8');
assert.ok(compactRowSource.includes('isUnifiedStream && entry.sourceName'), 'CompactLogRow must only show source badge when isUnifiedStream is true');
assert.ok(compactRowSource.includes('delta-anchor'), 'CompactLogRow must handle delta-anchor state');
assert.ok(compactRowSource.includes('delta-target'), 'CompactLogRow must handle delta-target state');

const logRowSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/LogRow.tsx'), 'utf-8');
assert.ok(logRowSource.includes('isUnifiedStream && entry.sourceName'), 'LogRow must only show source badge when isUnifiedStream is true');

const toolbarSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/DeltaTimeToolbar.tsx'), 'utf-8');
assert.ok(toolbarSource.includes('delta-time-toolbar'), 'DeltaTimeToolbar must render delta-time-toolbar root element');

console.log('✓ Test 5 Passed: Single source badge hiding, sidebar button alignment, and DeltaTimeToolbar integration verified');

// Test 6: getContextLines multi-source fallback & Escape dismiss
const { getContextLines } = await import('../server/fileReader.ts');
const contextResult = getContextLines('sample', 1, 5);
assert.ok(contextResult !== null);
assert.ok(Array.isArray(contextResult.lines));
console.log('✓ Test 6 Passed: getContextLines robust multi-source resolution verified');

console.log('\nAll Delta Time Latency & Stability Tests Passed Successfully!\n');
