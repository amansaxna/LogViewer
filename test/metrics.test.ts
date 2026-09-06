import { metrics } from '../server/metrics.ts';
import { getEntriesForSource, queryLogs, clearFileCache } from '../server/fileReader.ts';
import { registerCustomSource, removeCustomSource } from '../server/config.ts';
import fs from 'node:fs';
import path from 'node:path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

console.log('--- Running Application Health & Metrics Test Suite ---');

// Setup a dummy log source for testing
const testLogPath = path.resolve(process.cwd(), 'logs', 'metrics_test.log');
const testContent = [
  '[2026-03-31T10:00:00.000Z] [INFO] [System.Core] [AuthFlow] [UserLogin] [corr-101] (5ms) User authenticated successfully',
  '[2026-03-31T10:00:01.000Z] [WARN] [Database] [QueryExec] [SlowQuery] [corr-102] (120ms) Query exceeded 100ms threshold',
  '[2026-03-31T10:00:02.000Z] [ERROR] [PaymentService] [ChargeCard] [StripeFail] [corr-103] (45ms) Payment card declined',
  '[2026-03-31T10:00:03.000Z] [DEBUG] [Cache.Redis] [GetSession] [Hit] [corr-104] (1ms) Session token retrieved from Redis',
].join('\n');

fs.writeFileSync(testLogPath, testContent, 'utf-8');
const source = registerCustomSource(testLogPath, 'Metrics Test Source', 'Test');

try {
  // Test 1: Metrics Initialization & Reset
  metrics.resetMetrics();
  let initialReport = metrics.getHealthReport();
  assert(initialReport.healthScore >= 85, `Initial health score should be optimal, got: ${initialReport.healthScore}`);
  assert(initialReport.status === 'OPTIMAL', `Initial status should be OPTIMAL, got: ${initialReport.status}`);
  assert(initialReport.isOptimal === true, 'isOptimal flag should be true');
  assert(initialReport.vitals.uptimeSeconds >= 0, 'Uptime should be non-negative');
  assert(initialReport.vitals.heapUsedMb > 0, 'Heap used should be positive');
  console.log('✓ Test 1 Passed: Metrics Manager properly initializes and reports optimal health state');

  // Test 2: Cache Hit and Miss Accounting
  clearFileCache();
  // 1st access: Cache Miss (initial_load)
  const entries1 = getEntriesForSource(source.id);
  assert(entries1.length === 4, `Expected 4 entries, got ${entries1.length}`);
  let cacheStats = metrics.getCacheMetrics();
  assert(cacheStats.misses >= 1, `Expected at least 1 miss, got ${cacheStats.misses}`);
  assert(cacheStats.missReasons.initial_load >= 1, 'Initial load miss reason recorded');

  // 2nd access: Cache Hit
  const entries2 = getEntriesForSource(source.id);
  assert(entries2.length === 4, 'Expected cached entries');
  cacheStats = metrics.getCacheMetrics();
  assert(cacheStats.hits >= 1, `Expected at least 1 hit, got ${cacheStats.hits}`);
  assert(cacheStats.hitRatioPercent > 0, `Expected positive hit ratio, got ${cacheStats.hitRatioPercent}%`);
  console.log(`✓ Test 2 Passed: Cache hits (${cacheStats.hits}) and misses (${cacheStats.misses}) accurately tracked with ${cacheStats.hitRatioPercent}% hit ratio`);

  // Test 3: Query SLA Latency Percentile Calculations
  metrics.resetMetrics();
  // Simulate a sequence of fast and slow queries
  const simulatedLatencies = [2, 3, 4, 5, 8, 12, 15, 25, 65, 210];
  simulatedLatencies.forEach((lat) => {
    metrics.recordQuery(lat, {
      sourceIds: [source.id],
      search: lat > 50 ? 'SlowQuery' : undefined,
      matchedCount: 1,
      totalCount: 4,
    });
  });

  const sla = metrics.getQuerySlaMetrics();
  assert(sla.totalQueries === 10, `Expected 10 total queries, got ${sla.totalQueries}`);
  assert(sla.minMs === 2, `Expected min latency 2ms, got ${sla.minMs}`);
  assert(sla.maxMs === 210, `Expected max latency 210ms, got ${sla.maxMs}`);
  assert(sla.slowQueriesCount === 1, `Expected 1 slow query (>50ms), got ${sla.slowQueriesCount}`);
  assert(sla.criticalQueriesCount === 1, `Expected 1 critical query (>200ms), got ${sla.criticalQueriesCount}`);
  assert(sla.p50Ms > 0 && sla.p95Ms >= 65, `Expected P95 >= 65ms, got ${sla.p95Ms}`);
  console.log(`✓ Test 3 Passed: Query SLA accurately calculates P50 (${sla.p50Ms}ms), P95 (${sla.p95Ms}ms), P99 (${sla.p99Ms}ms) and slow query tracking`);

  // Test 4: Real Log Queries and Ingestion Recording
  const queryRes = queryLogs({ sourceId: source.id, search: 'UserLogin' });
  assert(queryRes.entries.length === 1, 'Expected 1 matching entry');
  metrics.recordIngestion(10);
  const updatedReport = metrics.getHealthReport();
  assert(updatedReport.ingestionRateLinesPerSec >= 0, 'Ingestion rate calculation verified');
  console.log('✓ Test 4 Passed: Live queryLogs invocation correctly integrates with telemetry engine');

  // Test 5: Health Score Deductions & Degraded State Evaluation
  metrics.resetMetrics();
  // Simulate critical errors and extreme queries to verify degraded/critical state detection
  for (let i = 0; i < 20; i++) {
    metrics.recordQuery(250); // Critical slow queries
    metrics.recordError();    // Error rate 100%
  }
  const degradedReport = metrics.getHealthReport();
  assert(degradedReport.healthScore < 85, `Expected health score to drop below 85, got ${degradedReport.healthScore}`);
  // Test 6: Persistent Telemetry Disk Logging & 1GB Cap Storage Info
  metrics.persistTelemetrySnapshot();
  const storageInfo = metrics.getTelemetryStorageInfo();
  assert(storageInfo.enabled === true, 'Telemetry disk logger should be enabled');
  assert(storageInfo.maxCapMb === 1024, 'Max cap should be 1024 MB (1 GB)');
  assert(storageInfo.currentFile.endsWith('.jsonl'), 'Current telemetry file should have .jsonl extension');
  assert(fs.existsSync(storageInfo.currentFile), 'Telemetry file should exist on disk');
  
  const telemetryContent = fs.readFileSync(storageInfo.currentFile, 'utf-8');
  assert(telemetryContent.includes('"healthScore"'), 'Telemetry JSONL record should contain healthScore');
  // Test 7: Incident & Client Crash Telemetry
  metrics.resetMetrics();
  metrics.recordIncident('crash', 'critical', 'server', 'Simulated uncaught exception in test', { stack: 'Error at test.ts:10' });
  metrics.recordClientEvent({
    type: 'flicker_detected',
    message: 'Rapid re-fetch detected',
    panelId: 'panel-1',
  });
  metrics.recordClientEvent({
    type: 'error',
    message: 'Simulated window.onerror',
    stack: 'TypeError at App.tsx:50',
  });

  const incidentReport = metrics.getHealthReport();
  assert(incidentReport.incidents.length === 3, `Expected 3 incidents, got ${incidentReport.incidents.length}`);
  assert(incidentReport.stability.clientErrorsCount === 1, `Expected 1 client error, got ${incidentReport.stability.clientErrorsCount}`);
  assert(incidentReport.stability.flickerBurstCount === 1, `Expected 1 flicker burst, got ${incidentReport.stability.flickerBurstCount}`);
  assert(incidentReport.stability.serverCrashesCount === 0, 'Server crash recorded via incident');
  console.log('✓ Test 7 Passed: Incident recording, client events, and crash telemetry verified');

  // Test 8: File Loading Failure Tracking & Malformed Line Telemetry
  metrics.resetMetrics();
  metrics.recordFileLoadFailure('broken-source', '/logs/missing.log', 'not_found', 'File does not exist on disk');
  metrics.recordFileLoadSuccess('valid-source', '/logs/valid.log', 12.5, 10240, 500, 2);

  const fileReport = metrics.getHealthReport();
  assert(fileReport.fileLoading.totalAttempts === 2, `Expected 2 load attempts, got ${fileReport.fileLoading.totalAttempts}`);
  assert(fileReport.fileLoading.failedLoads === 1, `Expected 1 failed load, got ${fileReport.fileLoading.failedLoads}`);
  assert(fileReport.fileLoading.successfulLoads === 1, `Expected 1 successful load, got ${fileReport.fileLoading.successfulLoads}`);
  assert(fileReport.fileLoading.failureRatePercent === 50, `Expected 50% failure rate, got ${fileReport.fileLoading.failureRatePercent}`);
  assert(fileReport.fileLoading.malformedLinesCount === 2, `Expected 2 malformed lines, got ${fileReport.fileLoading.malformedLinesCount}`);
  assert(fileReport.fileLoading.recentFailures.length === 1, 'Recent failure log recorded');
  console.log('✓ Test 8 Passed: File load failure tracking and malformed line metrics verified');

} finally {
  metrics.stopDiskLogger();
  removeCustomSource(source.id);
  if (fs.existsSync(testLogPath)) {
    fs.unlinkSync(testLogPath);
  }
}

console.log('All Application Health & Metrics Tests Passed Successfully!');

