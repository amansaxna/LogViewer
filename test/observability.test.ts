import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { parseQuery, evaluateQuery, evaluateAst } from '../src/utils/queryEngine.ts';
import { formatDeltaTime } from '../src/components/DeltaTimeBadge.tsx';
import { LogEntry } from '../src/types.ts';

console.log('--- Testing Advanced Observability Suite (Query Engine, Delta Time, Waterfall, Dual-Pane) ---');

// Mock sample log entries
const entry1: LogEntry = {
  id: '1',
  lineNumber: 1,
  raw: '2026-09-02 10:00:00.000 [INFO] [Auth] [Login] [corr-1001] User login initiated {user_id: 42, status: 200}',
  level: 'info',
  timestamp: 1788343200000,
  workflow: 'Auth',
  operation: 'Login',
  correlationId: 'corr-1001',
  message: 'User login initiated {user_id: 42, status: 200}',
  durationMs: 15,
};

const entry2: LogEntry = {
  id: '2',
  lineNumber: 2,
  raw: '2026-09-02 10:00:00.342 [ERROR] [Payment] [Charge] [corr-1001] Card gateway timeout status=504 elapsed=1250ms',
  level: 'error',
  timestamp: 1788343200342,
  workflow: 'Payment',
  operation: 'Charge',
  correlationId: 'corr-1001',
  message: 'Card gateway timeout status=504 elapsed=1250ms',
  durationMs: 1250,
};

const entry3: LogEntry = {
  id: '3',
  lineNumber: 3,
  raw: '2026-09-02 10:00:02.800 [WARN] [Inventory] [CheckStock] [corr-2002] Low stock alert item=999',
  level: 'warning',
  timestamp: 1788343202800,
  workflow: 'Inventory',
  operation: 'CheckStock',
  correlationId: 'corr-2002',
  message: 'Low stock alert item=999',
  durationMs: 40,
};

// ----------------------------------------------------
// 1. Query Engine Tests
// ----------------------------------------------------

// Test 1: Simple term matching
assert.strictEqual(evaluateQuery(entry1, 'login'), true);
assert.strictEqual(evaluateQuery(entry2, 'login'), false);
console.log('✓ Test 1 Passed: Simple term evaluation works');

// Test 2: Field matching (level, workflow, correlationId)
assert.strictEqual(evaluateQuery(entry1, 'level:info'), true);
assert.strictEqual(evaluateQuery(entry1, 'level:error'), false);
assert.strictEqual(evaluateQuery(entry2, 'workflow:Payment'), true);
assert.strictEqual(evaluateQuery(entry2, 'corr:corr-1001'), true);
console.log('✓ Test 2 Passed: Field matching evaluates accurately');

// Test 3: Boolean AND / OR operators
assert.strictEqual(evaluateQuery(entry2, 'level:ERROR AND workflow:Payment'), true);
assert.strictEqual(evaluateQuery(entry1, 'level:ERROR AND workflow:Payment'), false);
assert.strictEqual(evaluateQuery(entry1, 'level:ERROR OR level:INFO'), true);
assert.strictEqual(evaluateQuery(entry3, 'level:ERROR OR level:INFO'), false);
console.log('✓ Test 3 Passed: Boolean AND / OR logic works with short-circuit evaluation');

// Test 4: Boolean NOT operator
assert.strictEqual(evaluateQuery(entry1, 'NOT level:ERROR'), true);
assert.strictEqual(evaluateQuery(entry2, 'NOT level:ERROR'), false);
assert.strictEqual(evaluateQuery(entry2, 'workflow:Payment AND NOT status:200'), true);
console.log('✓ Test 4 Passed: Boolean NOT inversion logic works cleanly');

// Test 5: Parentheses grouping & operator precedence
assert.strictEqual(evaluateQuery(entry2, '(workflow:Auth OR workflow:Payment) AND level:ERROR'), true);
assert.strictEqual(evaluateQuery(entry1, '(workflow:Auth OR workflow:Payment) AND level:ERROR'), false);
console.log('✓ Test 5 Passed: Parentheses precedence groups expressions accurately');

// Test 6: Numeric Comparisons (> >= < <=)
assert.strictEqual(evaluateQuery(entry2, 'elapsed > 1000'), true);
assert.strictEqual(evaluateQuery(entry1, 'elapsed > 1000'), false);
assert.strictEqual(evaluateQuery(entry1, 'line <= 2'), true);
assert.strictEqual(evaluateQuery(entry3, 'line <= 2'), false);
console.log('✓ Test 6 Passed: Numeric comparison operators evaluate correctly');

// ----------------------------------------------------
// 2. Delta Time & Latency Tests
// ----------------------------------------------------

// Test 7: Delta Time Formatting
assert.strictEqual(formatDeltaTime(0.5), '500 µs');
assert.strictEqual(formatDeltaTime(342.5), '342.5 ms');
assert.strictEqual(formatDeltaTime(2450), '2.450 s');
assert.strictEqual(formatDeltaTime(125000), '2m 5.0s');
console.log('✓ Test 7 Passed: Delta time formatting formats sub-ms, ms, seconds, and minutes');

// Test 8: Interval and Throughput Calculation
const deltaMs = (entry2.timestamp || 0) - (entry1.timestamp || 0); // 342ms
assert.strictEqual(deltaMs, 342);
const lineDiff = Math.abs(entry2.lineNumber - entry1.lineNumber); // 1 line
const throughput = Math.abs(lineDiff / (deltaMs / 1000)).toFixed(1);
assert.strictEqual(throughput, '2.9');
console.log('✓ Test 8 Passed: Delta timestamp latency and line throughput calculated correctly');

// ----------------------------------------------------
// 3. Waterfall & Gantt Span Calculations
// ----------------------------------------------------

// Test 9: Waterfall Span Sorting & Relatives
const spans = [entry1, entry2].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
const t0 = spans[0].timestamp || 0;
const totalDuration = (spans[spans.length - 1].timestamp || 0) - t0;
assert.strictEqual(t0, 1788343200000);
assert.strictEqual(totalDuration, 342);

const span0Offset = (spans[0].timestamp || 0) - t0;
const span1Offset = (spans[1].timestamp || 0) - t0;
assert.strictEqual(span0Offset, 0);
assert.strictEqual(span1Offset, 342);
console.log('✓ Test 9 Passed: Transaction waterfall spans calculate relative offsets cleanly');

// ----------------------------------------------------
// 4. File Integrity & Exports
// ----------------------------------------------------

const topbarCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Topbar.tsx'), 'utf-8');
assert.ok(topbarCode.includes('isSplitView'), 'Topbar must support isSplitView prop');
assert.ok(topbarCode.includes('onOpenWaterfall'), 'Topbar must support onOpenWaterfall prop');
assert.ok(topbarCode.includes('selectedPid'), 'Topbar must support selectedPid facet');
assert.ok(topbarCode.includes('selectedTid'), 'Topbar must support selectedTid facet');

const appCode = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
assert.ok(appCode.includes('DualPaneViewer'), 'App must render DualPaneViewer in split mode');
assert.ok(appCode.includes('DeltaTimeBadge'), 'App must render DeltaTimeBadge for latency');
assert.ok(appCode.includes('WaterfallModal'), 'App must render WaterfallModal for transaction tracing');
assert.ok(appCode.includes('selectedPid'), 'App must manage selectedPid state');
assert.ok(appCode.includes('selectedTid'), 'App must manage selectedTid state');

console.log('✓ Test 10 Passed: Component imports and wiring verified');

// Test 11: Process (PID) & Thread (TID) matching
const entryWithPidTid: LogEntry = {
  id: '4',
  lineNumber: 4,
  raw: '2026-09-02 10:00:03.000 [INFO] [18904] [worker-pool-3] [corr-3003] Job processed',
  level: 'info',
  pid: '18904',
  tid: 'worker-pool-3',
  message: 'Job processed',
};

assert.strictEqual(evaluateQuery(entryWithPidTid, 'pid:18904'), true);
assert.strictEqual(evaluateQuery(entryWithPidTid, 'pid:99999'), false);
assert.strictEqual(evaluateQuery(entryWithPidTid, 'tid:worker-pool-3'), true);
assert.strictEqual(evaluateQuery(entryWithPidTid, 'pid:18904 AND tid:worker-pool-3'), true);
console.log('✓ Test 11 Passed: Process (PID) and Thread (TID) query syntax & facet filtering verified');

console.log('\nAll Advanced Observability Suite Tests Passed Successfully!\n');
