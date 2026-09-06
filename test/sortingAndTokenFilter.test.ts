import assert from 'node:assert';
import { queryLogs } from '../server/fileReader.ts';
import { renderSyntaxColoredLine, SyntaxColoredOptions } from '../src/utils/coloredLogRenderer.tsx';
import React from 'react';

console.log('--- Testing Sorting & Raw Mode Metadata Token Filtering ---');

// 1. Test Sorting Options in queryLogs
const sourceId = 'app-workflow';

// Test 1: time-asc (ascending order, line 1 first)
const resTimeAsc = queryLogs({ sourceId, sortBy: 'time', direction: 'asc', pageSize: 10 });
assert(resTimeAsc.entries.length > 0, 'Should return entries for time-asc');
assert.strictEqual(resTimeAsc.entries[0].lineNumber, 1, 'First entry in time-asc should be line 1');
assert(resTimeAsc.entries[1].lineNumber > resTimeAsc.entries[0].lineNumber, 'Lines should increase in time-asc');
console.log('✓ Test 1 Passed: time-asc returns oldest logs first (Line #1 at top)');

// Test 2: time-desc (descending order, newest log first)
const resTimeDesc = queryLogs({ sourceId, sortBy: 'time', direction: 'desc', pageSize: 10 });
assert(resTimeDesc.entries.length > 0, 'Should return entries for time-desc');
assert(resTimeDesc.entries[0].lineNumber > 100, 'First entry in time-desc should be at or near bottom of file');
assert(resTimeDesc.entries[0].lineNumber > resTimeDesc.entries[1].lineNumber, 'Lines should decrease in time-desc');
console.log('✓ Test 2 Passed: time-desc returns newest logs first (Line #max at top)');

// Test 3: line-asc vs line-desc
const resLineAsc = queryLogs({ sourceId, sortBy: 'line', direction: 'asc', pageSize: 10 });
const resLineDesc = queryLogs({ sourceId, sortBy: 'line', direction: 'desc', pageSize: 10 });
assert.strictEqual(resLineAsc.entries[0].lineNumber, 1, 'Line asc starts at line 1');
assert(resLineDesc.entries[0].lineNumber > 100, 'Line desc starts at highest line number');
console.log('✓ Test 3 Passed: line-asc and line-desc ordering verified');

// Test 4: marker-asc and marker-desc
const resMarkerAsc = queryLogs({ sourceId, sortBy: 'marker', direction: 'asc', pageSize: 20 });
const resMarkerDesc = queryLogs({ sourceId, sortBy: 'marker', direction: 'desc', pageSize: 20 });
assert(resMarkerAsc.entries.length > 0 && resMarkerDesc.entries.length > 0);
const firstAscMarker = (resMarkerAsc.entries[0].workflow || '').toLowerCase();
const firstDescMarker = (resMarkerDesc.entries[0].workflow || '').toLowerCase();
assert(firstAscMarker <= firstDescMarker, 'Ascending marker should precede or equal descending marker alphabetically');
console.log('✓ Test 4 Passed: marker-asc and marker-desc sorting verified');

// 2. Test renderSyntaxColoredLine token filtering
const rawSample = '[2026-09-04 20:47:16.574] [24006] [worker-19] [corr-11a-5d69] [Payment.RiskEngine] [ProcessPayment] [SUCCESS] [12ms] Payment processed successfully [ReportEngine.ts::310]';

// Helper to extract text from React elements tree
function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) {
    const props = node.props as any;
    if (props && props.children) {
      return extractText(props.children);
    }
  }
  return '';
}

// Test 5: Default (all visible)
const renderedAll = extractText(renderSyntaxColoredLine(rawSample, {
  showDatetime: true,
  showPid: true,
  showTid: true,
  showCorrelation: true,
  hideBrackets: false,
}));
assert(renderedAll.includes('2026-09-04 20:47:16.574'), 'Should include datetime');
assert(renderedAll.includes('24006'), 'Should include PID');
assert(renderedAll.includes('worker-19'), 'Should include TID');
assert(renderedAll.includes('corr-11a-5d69'), 'Should include Correlation ID');
assert(renderedAll.includes('Payment.RiskEngine'), 'Should include Namespace');
console.log('✓ Test 5 Passed: All tokens rendered when all toggles are active');

// Test 6: Timestamp removed (showDatetime: false)
const renderedNoTime = extractText(renderSyntaxColoredLine(rawSample, {
  showDatetime: false,
  showPid: true,
  showTid: true,
  showCorrelation: true,
  hideBrackets: false,
}));
assert(!renderedNoTime.includes('2026-09-04 20:47:16.574'), 'Datetime should NOT be rendered when showDatetime is false');
assert(renderedNoTime.includes('24006'), 'PID should still be rendered');
assert(renderedNoTime.includes('worker-19'), 'TID should still be rendered');
assert(renderedNoTime.includes('corr-11a-5d69'), 'Correlation should still be rendered');
console.log('✓ Test 6 Passed: Datetime cleanly removed when showDatetime is false');

// Test 7: User screenshot case (Time: off, PID: off, TID: off, Corr: on)
const renderedUserCase = extractText(renderSyntaxColoredLine(rawSample, {
  showDatetime: false,
  showPid: false,
  showTid: false,
  showCorrelation: true,
  hideBrackets: false,
}));
assert(!renderedUserCase.includes('2026-09-04 20:47:16.574'), 'Datetime must be hidden');
assert(!renderedUserCase.includes('24006'), 'PID must be hidden');
assert(!renderedUserCase.includes('worker-19'), 'TID must be hidden');
assert(renderedUserCase.includes('[corr-11a-5d69]'), 'Correlation ID must be shown with brackets');
assert(renderedUserCase.includes('[Payment.RiskEngine]'), 'Namespace must be shown');
assert(renderedUserCase.includes('Payment processed successfully'), 'Message body must be shown');
console.log('✓ Test 7 Passed: Exact user scenario verified: Timestamp, PID, and TID stripped; Correlation & message kept');

// Test 8: All metadata toggled off
const renderedNoMeta = extractText(renderSyntaxColoredLine(rawSample, {
  showDatetime: false,
  showPid: false,
  showTid: false,
  showCorrelation: false,
  hideBrackets: false,
}));
assert(!renderedNoMeta.includes('2026-09-04'), 'No timestamp');
assert(!renderedNoMeta.includes('24006'), 'No PID');
assert(!renderedNoMeta.includes('worker-19'), 'No TID');
assert(!renderedNoMeta.includes('corr-11a-5d69'), 'No Correlation ID');
assert(renderedNoMeta.includes('[Payment.RiskEngine]'), 'Namespace retained');
console.log('✓ Test 8 Passed: All metadata tokens cleanly stripped when all toggles are disabled');

console.log('\nAll Sorting and Metadata Token Filtering Tests Passed Successfully!\n');
