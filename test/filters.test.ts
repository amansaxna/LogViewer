import assert from 'node:assert';
import { queryLogs, parseTimestamp, parseEndTimestamp, getEntryTimestamp } from '../server/fileReader.ts';

console.log('--- Testing Advanced Filtering: Marker, Datetime, PID, TID, Smart Search ---');

// Test 1: Timestamp parsing
const ts1 = parseTimestamp('2026-09-02 03:05:00.000');
assert.ok(!isNaN(ts1), 'Should parse standard timestamp with space');

const ts2 = parseTimestamp('2026-09-02T03:05:00.000Z');
assert.ok(!isNaN(ts2), 'Should parse ISO timestamp with Z');

const ts3 = parseTimestamp('2026-09-02');
assert.ok(!isNaN(ts3), 'Should parse YYYY-MM-DD');

const endTs = parseEndTimestamp('2026-09-02');
assert.ok(!isNaN(endTs), 'Should parse end timestamp');
assert.ok(endTs > ts3, 'End of day timestamp should be greater than start of day');
console.log('✓ Test 1 Passed: Timestamp parsing handles all formats');

// Test 2: Filter by Datetime range on app-workflow
const dateRangeResult = queryLogs({
  sourceId: 'app-workflow',
  startDate: '2026-09-02 00:00:00',
  endDate: '2026-09-02 01:00:00',
});
assert.ok(dateRangeResult.entries.length > 0, 'Should find entries in the 1 hour window');
for (const entry of dateRangeResult.entries) {
  const ts = getEntryTimestamp(entry);
  assert.ok(!isNaN(ts), 'Entry must have valid timestamp');
  assert.ok(ts >= parseTimestamp('2026-09-02 00:00:00'));
  assert.ok(ts <= parseEndTimestamp('2026-09-02 01:00:00'));
}
console.log(`✓ Test 2 Passed: Datetime range filter returned ${dateRangeResult.entries.length} entries`);

// Test 3: Filter by PID (query param and raw bracket matching)
const pidResult = queryLogs({
  sourceId: 'app-workflow',
  pid: '18902',
});
assert.ok(pidResult.entries.length > 0, 'Should find entries with PID 18902');
for (const entry of pidResult.entries) {
  const hasPid = (entry.pid && entry.pid.includes('18902')) || entry.raw.includes('18902');
  assert.ok(hasPid, 'Entry must match PID 18902');
}
console.log(`✓ Test 3 Passed: PID filter returned ${pidResult.entries.length} entries for PID 18902`);

// Test 4: Filter by TID
const tidResult = queryLogs({
  sourceId: 'app-workflow',
  tid: 'thread-11',
});
assert.ok(tidResult.entries.length > 0, 'Should find entries with TID thread-11');
for (const entry of tidResult.entries) {
  const hasTid = (entry.tid && entry.tid.includes('thread-11')) || entry.raw.includes('thread-11');
  assert.ok(hasTid, 'Entry must match TID thread-11');
}
console.log(`✓ Test 4 Passed: TID filter returned ${tidResult.entries.length} entries for thread-11`);

// Test 5: Marker Search (plain text with bracket stripping)
const markerResult = queryLogs({
  sourceId: 'app-workflow',
  marker: '[InventoryAudit]',
});
assert.ok(markerResult.entries.length > 0, 'Should find entries for marker [InventoryAudit]');
for (const entry of markerResult.entries) {
  const raw = entry.raw.toLowerCase();
  const wf = (entry.workflow || '').toLowerCase();
  assert.ok(raw.includes('inventoryaudit') || wf.includes('inventoryaudit'), 'Must match InventoryAudit');
}
console.log(`✓ Test 5 Passed: Marker search returned ${markerResult.entries.length} matches for [InventoryAudit]`);

// Test 6: Marker Regex Search
const markerRegexResult = queryLogs({
  sourceId: 'app-workflow',
  marker: 'InventoryAudit-\\d{4}',
  isMarkerRegex: true,
});
assert.ok(markerRegexResult.entries.length > 0, 'Should find entries matching regex InventoryAudit-\\d{4}');
console.log(`✓ Test 6 Passed: Marker regex search returned ${markerRegexResult.entries.length} matches`);

// Test 7: Smart Search Syntax (e.g. "pid:18902 audit")
const smartSearchResult = queryLogs({
  sourceId: 'app-workflow',
  search: 'pid:18902 audit',
});
assert.ok(smartSearchResult.entries.length > 0, 'Smart search should extract pid:18902 and search for audit');
for (const entry of smartSearchResult.entries) {
  const hasPid = (entry.pid && entry.pid.includes('18902')) || entry.raw.includes('18902');
  assert.ok(hasPid, 'Must match PID 18902');
  const hasAudit = entry.raw.toLowerCase().includes('audit') || entry.message.toLowerCase().includes('audit');
  assert.ok(hasAudit, 'Must match keyword audit');
}
console.log(`✓ Test 7 Passed: Smart search extracted pid:18902 and keyword "audit" (${smartSearchResult.entries.length} matches)`);

// Test 8: Multi-Source Combined Querying Performance & Accuracy
const multiSourceResult = queryLogs({
  sourceId: 'app-workflow',
  sourceIds: ['app-workflow', 'system-errors', 'payment-audit'],
  marker: 'audit',
});
assert.ok(multiSourceResult.entries.length > 0, 'Multi-source query should return merged results');
assert.ok(multiSourceResult.durationMs < 50, `Multi-source query must be fast (took ${multiSourceResult.durationMs}ms)`);
console.log(`✓ Test 8 Passed: Multi-source query returned ${multiSourceResult.entries.length} entries in ${multiSourceResult.durationMs}ms`);

console.log('All Filter, Marker, Datetime, PID, and TID Tests Passed Successfully!');
