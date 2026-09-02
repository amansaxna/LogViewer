import assert from 'node:assert';
import { parseLogLines, parseSingleLine } from '../server/parser.ts';

console.log('--- Testing Log Parser ---');

// Test 1: Full flat file line format with Correlation ID
const fullLine = '[2026-09-02 00:01:10.104] [18920] [thread-10] [corr-9f2b4c1a] [Auth.Service] [WF:UserLogin-1002] [POST /api/auth/token] [SUCCESS] [42ms] User authentication verified for amansaxena [AuthTokenProvider.ts::88]';
const parsed1 = parseSingleLine(fullLine, 1);

assert.strictEqual(parsed1.datetime, '2026-09-02 00:01:10.104');
assert.strictEqual(parsed1.pid, '18920');
assert.strictEqual(parsed1.tid, 'thread-10');
assert.strictEqual(parsed1.correlationId, 'corr-9f2b4c1a');
assert.strictEqual(parsed1.namespace, 'Auth.Service');
assert.strictEqual(parsed1.workflow, 'WF:UserLogin-1002');
assert.strictEqual(parsed1.operation, 'POST /api/auth/token');
assert.strictEqual(parsed1.status, 'SUCCESS');
assert.strictEqual(parsed1.duration, '42ms');
assert.strictEqual(parsed1.message, 'User authentication verified for amansaxena');
assert.strictEqual(parsed1.fileLocation, 'AuthTokenProvider.ts::88');
assert.strictEqual(parsed1.level, 'info');
console.log('✓ Test 1 Passed: Full flat file format with Correlation ID');

// Test 2: Partial brackets (missing datetime, missing workflow, missing duration)
const partialLine = '[9102] [Risk.Engine] [FlagAccount] [INFO] Flagged account for manual KYC review [RiskAnalyzer.py::130]';
const parsed2 = parseSingleLine(partialLine, 2);

assert.strictEqual(parsed2.pid, '9102');
assert.strictEqual(parsed2.namespace, 'Risk.Engine');
assert.strictEqual(parsed2.operation, 'FlagAccount');
assert.strictEqual(parsed2.status, 'INFO');
assert.strictEqual(parsed2.message, 'Flagged account for manual KYC review');
assert.strictEqual(parsed2.fileLocation, 'RiskAnalyzer.py::130');
assert.strictEqual(parsed2.level, 'info');
console.log('✓ Test 2 Passed: Partial bracketed tokens');

// Test 3: Line without any brackets or timestamps
const rawLine = 'Starting worker daemon version 2.4.0-prod...';
const parsed3 = parseSingleLine(rawLine, 3);
assert.strictEqual(parsed3.message, rawLine);
assert.strictEqual(parsed3.level, 'info');
console.log('✓ Test 3 Passed: Markerless raw line');

// Test 4: Multi-line log with Stack Trace
const multiLineLog = `[2026-09-02 00:01:50.120] [18920] [thread-09] [External.Webhook] [WF:WebhookDispatch-1120] [DispatchPartnerEvent] [ERROR] [1520ms] Webhook delivery failed after 3 retries [WebhookClient.ts::198]
    Trace: HttpRequestException: Connection timeout after 1500ms
        at HttpClient.execute (/app/dist/HttpClient.js:142:15)
        at async WebhookClient.dispatch (/app/dist/WebhookClient.js:89:12)`;

const parsedMulti = parseLogLines(multiLineLog);
assert.strictEqual(parsedMulti.length, 1);
assert.strictEqual(parsedMulti[0].level, 'error');
assert.ok(parsedMulti[0].trace);
assert.strictEqual(parsedMulti[0].trace?.title, 'Trace: HttpRequestException: Connection timeout after 1500ms');
assert.strictEqual(parsedMulti[0].trace?.frames.length, 3);
console.log('✓ Test 4 Passed: Multi-line log with stack trace extraction');

// Test 5: [AUDIT] log level parsing
const auditLine = '[2026-09-02 03:00:00.000] [PID:4421] [TID:8812] [corr-audit-99] [Security.Audit] [AUDIT] User permissions modified by admin [SecurityManager.ts::42]';
const parsedAudit = parseSingleLine(auditLine, 5);
assert.strictEqual(parsedAudit.level, 'audit');
assert.strictEqual(parsedAudit.status, 'AUDIT');
assert.strictEqual(parsedAudit.correlationId, 'corr-audit-99');
assert.strictEqual(parsedAudit.pid, '4421');
assert.strictEqual(parsedAudit.tid, '8812');
console.log('✓ Test 5 Passed: [AUDIT] level parsed and classified correctly');

// Test 6: XML Log File parsing
const sampleXmlFile = `<?xml version="1.0" encoding="UTF-8"?>
<log>
  <record>
    <date>2026-09-02T04:15:00.120Z</date>
    <level>WARNING</level>
    <class>com.econ.orders.OrderDispatch</class>
    <thread>worker-4</thread>
    <message>High latency detected on upstream endpoint</message>
  </record>
  <record>
    <date>2026-09-02T04:15:03.880Z</date>
    <level>ERROR</level>
    <class>com.econ.db.TransactionCoordinator</class>
    <thread>pool-8</thread>
    <message>Database connection failed</message>
  </record>
</log>`;

const parsedXml = parseLogLines(sampleXmlFile);
assert.strictEqual(parsedXml.length, 2, 'Parsed 2 XML log records');
assert.strictEqual(parsedXml[0].level, 'warning');
assert.strictEqual(parsedXml[0].workflow, 'com.econ.orders.OrderDispatch');
assert.strictEqual(parsedXml[0].tid, 'worker-4');
assert.strictEqual(parsedXml[0].message, 'High latency detected on upstream endpoint');
assert.strictEqual(parsedXml[1].level, 'error');
assert.strictEqual(parsedXml[1].workflow, 'com.econ.db.TransactionCoordinator');
console.log('✓ Test 6 Passed: Native XML log file detected, identified, and parsed into structured LogEntries');

console.log('All Parser Tests Passed Successfully!');
