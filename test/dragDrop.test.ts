import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { registerCustomSource, findSourceById, removeCustomSource } from '../server/config.ts';
import { queryLogs } from '../server/fileReader.ts';

console.log('--- Running Drag & Drop File Upload Test Suite ---');

// Test 1: Upload / Drop File Processing & Custom Source Registration
const testDropDir = path.resolve(process.cwd(), 'logs', 'dropped');
if (!fs.existsSync(testDropDir)) {
  fs.mkdirSync(testDropDir, { recursive: true });
}

const sampleDroppedContent = `[2026-09-04 10:45:00.120] [101] [202] [corr-drop-001] [DropService] [ProcessFile] [INFO] [200] [12ms] Successfully processed drag-dropped file.
[2026-09-04 10:45:01.340] [101] [202] [corr-drop-001] [DropService] [Validate] [WARN] [400] [25ms] Minor schema warning detected.
[2026-09-04 10:45:02.500] [101] [202] [corr-drop-001] [DropService] [Complete] [SUCCESS] [200] [8ms] Completed dropped log processing.`;

const testFilePath = path.join(testDropDir, 'test_drag_drop.log');
fs.writeFileSync(testFilePath, sampleDroppedContent, 'utf-8');

const source = registerCustomSource(testFilePath, 'test_drag_drop.log', 'Dropped Logs');
assert.ok(source);
assert.strictEqual(source.name, 'test_drag_drop.log');
assert.strictEqual(source.category, 'Dropped Logs');
console.log('✓ Test 1 Passed: Dropped log file registered as custom log source');

// Test 2: Query Dropped File Log Entries
const queryResult = queryLogs({
  sourceId: source.id,
  sourceIds: [source.id],
  levels: [],
  excludeLevels: [],
  page: 1,
  pageSize: 50,
});

assert.strictEqual(queryResult.total, 3);
assert.strictEqual(queryResult.entries.length, 3);
assert.strictEqual(queryResult.entries[0].correlationId, 'corr-drop-001');
assert.strictEqual(queryResult.entries[0].namespace, 'DropService');
assert.strictEqual(queryResult.entries[0].workflow, 'Complete');
console.log('✓ Test 2 Passed: Dropped file parsed and queried with structured log entries');

// Test 3: Clean up test custom source
const removed = removeCustomSource(source.id);
assert.strictEqual(removed, true);
if (fs.existsSync(testFilePath)) {
  fs.unlinkSync(testFilePath);
}
console.log('✓ Test 3 Passed: Dropped source cleaned up');

console.log('All Drag & Drop Tests Passed Successfully!');
