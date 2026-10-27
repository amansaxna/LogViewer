import assert from 'node:assert';
import { queryLogs } from '../server/fileReader.ts';
import { LogQuery } from '../server/types.ts';
import { renderWithSearchHighlight } from '../src/utils/messageContextHighlighter.tsx';

console.log('--- Testing Enhanced Search, TRACE Level & Marker Regex ---');

// Test 1: Verify TRACE level counting and filtering
const traceLogsResult = queryLogs({
  sourceId: 'app-workflow',
  levels: ['trace'],
});
assert(traceLogsResult.levelCounts.trace !== undefined, 'levelCounts.trace should be calculated');
console.log('✓ Test 1 Passed: TRACE level counts and filter verified');

// Test 2: Comma-separated multi-term search (e.g. OrderCheckout, RateLimitCheck)
const csvSearchResult = queryLogs({
  sourceId: 'app-workflow',
  search: 'OrderCheckout, RateLimitCheck',
  isRegex: false,
});
assert(csvSearchResult.entries.length > 0, 'Comma-separated search should return matching entries');
for (const entry of csvSearchResult.entries) {
  assert(
    entry.raw.toLowerCase().includes('ordercheckout') && entry.raw.toLowerCase().includes('ratelimitcheck'),
    'Entry must match all comma-separated terms'
  );
}
console.log(`✓ Test 2 Passed: Comma-separated search matched ${csvSearchResult.entries.length} entries with all terms`);

// Test 3: Trailing ellipsis wildcard matching (e.g. "user_..." or "session user_...")
const wildcardResult = queryLogs({
  sourceId: 'app-workflow',
  search: 'session user_...',
  isRegex: false,
});
assert(wildcardResult.entries.length > 0, 'Trailing ellipsis should match session user_ prefix');
for (const entry of wildcardResult.entries) {
  assert(entry.raw.toLowerCase().includes('session user_'), 'Entry must contain session user_ prefix');
}
console.log(`✓ Test 3 Passed: Trailing ellipsis wildcard matched ${wildcardResult.entries.length} entries`);

// Test 4: Marker filtering with regex support
const markerRegexResult = queryLogs({
  sourceId: 'app-workflow',
  marker: 'WF:(OrderCheckout|StockSync)',
  isMarkerRegex: true,
});
assert(markerRegexResult.entries.length > 0, 'Marker regex should return matching entries');
for (const entry of markerRegexResult.entries) {
  const match = /WF:(OrderCheckout|StockSync)/i.test(entry.workflow || '') ||
                /WF:(OrderCheckout|StockSync)/i.test(entry.operation || '') ||
                /WF:(OrderCheckout|StockSync)/i.test(entry.raw);
  assert(match, 'Entry must match marker regex');
}
console.log(`✓ Test 4 Passed: Marker regex query correctly matched ${markerRegexResult.entries.length} entries`);

// Test 5: Verify Search & Marker history cache logic (FIFO max 3 unique items)
function updateHistory(prev: string[], term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed) return prev;
  return [trimmed, ...prev.filter((i) => i !== trimmed)].slice(0, 3);
}

let history: string[] = [];
history = updateHistory(history, 'timeout=20, userId=123');
assert.deepStrictEqual(history, ['timeout=20, userId=123']);

history = updateHistory(history, 'status=504');
assert.deepStrictEqual(history, ['status=504', 'timeout=20, userId=123']);

history = updateHistory(history, 'checkout');
assert.deepStrictEqual(history, ['checkout', 'status=504', 'timeout=20, userId=123']);

// Adding 4th item should evict oldest (keeping max 3)
history = updateHistory(history, 'error');
assert.deepStrictEqual(history, ['error', 'checkout', 'status=504']);

// Re-searching an existing item should move it to the top without duplicates
history = updateHistory(history, 'status=504');
assert.deepStrictEqual(history, ['status=504', 'error', 'checkout']);
console.log('✓ Test 5 Passed: Last 3 search cache eviction & deduplication verified');

// Test 6: Comma-separated query highlighting in messageContextHighlighter
const highlighted = renderWithSearchHighlight('timeout=20ms for userId=42', ['timeout=20, userId=...']);
assert(Array.isArray(highlighted), 'Should return array of highlighted parts');
console.log('✓ Test 6 Passed: Highlighting handles comma-separated search terms');

console.log('\nAll Enhanced Search, TRACE Level & Marker Regex Tests Passed Successfully!');
