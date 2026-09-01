import assert from 'node:assert';
import { parseLogLines, parseSingleLine } from '../server/parser.ts';

console.log('--- Testing Log Parser ---');

// Test 1: Full flat file line format
const fullLine = '[2026-09-02 00:01:10.104] [18920] [thread-10] [Auth.Service] [WF:UserLogin-1002] [POST /api/auth/token] [SUCCESS] [42ms] User authentication verified for amansaxena [AuthTokenProvider.ts::88]';
const parsed1 = parseSingleLine(fullLine, 1);

assert.strictEqual(parsed1.datetime, '2026-09-02 00:01:10.104');
assert.strictEqual(parsed1.pid, '18920');
assert.strictEqual(parsed1.tid, 'thread-10');
assert.strictEqual(parsed1.namespace, 'Auth.Service');
assert.strictEqual(parsed1.workflow, 'WF:UserLogin-1002');
assert.strictEqual(parsed1.operation, 'POST /api/auth/token');
assert.strictEqual(parsed1.status, 'SUCCESS');
assert.strictEqual(parsed1.duration, '42ms');
assert.strictEqual(parsed1.message, 'User authentication verified for amansaxena');
assert.strictEqual(parsed1.fileLocation, 'AuthTokenProvider.ts::88');
assert.strictEqual(parsed1.level, 'info');
console.log('✓ Test 1 Passed: Full flat file format');

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

console.log('All Parser Tests Passed Successfully!');
