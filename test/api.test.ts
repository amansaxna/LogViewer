import assert from 'node:assert';

const BASE_URL = 'http://localhost:3001';

async function runApiTests() {
  console.log('--- Starting API Integration Tests ---');

  // Test 1: Fetch Sources
  const sourcesRes = await fetch(`${BASE_URL}/api/sources`);
  assert.strictEqual(sourcesRes.status, 200, 'GET /api/sources should return 200');
  const sourcesData = await sourcesRes.json();
  assert.ok(Array.isArray(sourcesData.sources), 'Sources should be an array');
  assert.ok(sourcesData.sources.length >= 4, 'Should have at least 4 default sources');
  console.log(`✓ Test 1 Passed: Found ${sourcesData.sources.length} sources`);

  // Test 2: Query Entries from default source
  const entriesRes = await fetch(`${BASE_URL}/api/logs/entries?sourceId=app-workflow`);
  assert.strictEqual(entriesRes.status, 200, 'GET /api/logs/entries should return 200');
  const entriesData = await entriesRes.json();
  assert.ok(entriesData.entries.length > 0, 'Should return entries');
  assert.ok(entriesData.total > 0, 'Total should be positive');
  assert.ok(entriesData.levelCounts.all > 0, 'Level counts all should match');
  console.log(`✓ Test 2 Passed: Fetched ${entriesData.entries.length} entries for app-workflow`);

  // Test 3: Filter by Level (ERROR)
  const errorEntriesRes = await fetch(`${BASE_URL}/api/logs/entries?sourceId=app-workflow&levels=error`);
  const errorData = await errorEntriesRes.json();
  assert.ok(errorData.entries.length > 0, 'Should find error entries');
  for (const entry of errorData.entries) {
    assert.strictEqual(entry.level, 'error', 'Every filtered entry should be error level');
  }
  console.log(`✓ Test 3 Passed: Level filter returned ${errorData.entries.length} error entries`);

  // Test 4: Search filter
  const searchRes = await fetch(`${BASE_URL}/api/logs/entries?sourceId=app-workflow&search=Stripe`);
  const searchData = await searchRes.json();
  assert.ok(searchData.entries.length > 0, 'Should find Stripe entries');
  for (const entry of searchData.entries) {
    const rawMatches = entry.raw.toLowerCase().includes('stripe');
    assert.ok(rawMatches, 'Entry should contain Stripe keyword');
  }
  console.log(`✓ Test 4 Passed: Search filter returned ${searchData.entries.length} matches for "Stripe"`);

  // Test 5: Context Lines
  const contextRes = await fetch(`${BASE_URL}/api/logs/context?sourceId=app-workflow&lineNumber=5&radius=2`);
  assert.strictEqual(contextRes.status, 200, 'GET /api/logs/context should return 200');
  const contextData = await contextRes.json();
  assert.strictEqual(contextData.lines.length, 5, 'Should return 5 lines (target +/- 2)');
  const targetLine = contextData.lines.find((l: any) => l.isTarget);
  assert.ok(targetLine, 'Target line should be flagged with isTarget: true');
  assert.strictEqual(targetLine.number, 5);
  console.log(`✓ Test 5 Passed: Context lines retrieved around line #5`);

  // Test 6: Open Arbitrary File
  const openRes = await fetch(`${BASE_URL}/api/sources/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: './logs/system_errors.log',
      name: 'Custom Errors Copy',
      category: 'Custom Files',
    }),
  });
  assert.strictEqual(openRes.status, 200, 'POST /api/sources/open should return 200');
  const openData = await openRes.json();
  assert.ok(openData.source.id.startsWith('custom-'), 'Source ID should start with custom-');
  console.log(`✓ Test 6 Passed: Opened custom arbitrary file with id ${openData.source.id}`);

  // Test 7: Remove Custom Source
  const removeRes = await fetch(`${BASE_URL}/api/sources/${openData.source.id}`, {
    method: 'DELETE',
  });
  assert.strictEqual(removeRes.status, 200, 'DELETE /api/sources/:id should return 200');
  const removeData = await removeRes.json();
  assert.strictEqual(removeData.success, true);
  console.log('✓ Test 7 Passed: Successfully removed custom source');

  // Test 8: Marker filter (RefundProcess)
  const markerRes = await fetch(`${BASE_URL}/api/logs/entries?sourceId=app-workflow&marker=RefundProcess`);
  assert.strictEqual(markerRes.status, 200);
  const markerData = await markerRes.json();
  assert.ok(markerData.entries.length > 0, 'Should find entries with RefundProcess marker');
  for (const entry of markerData.entries) {
    assert.ok(entry.workflow?.toLowerCase().includes('refundprocess'));
  }
  console.log(`✓ Test 8 Passed: Marker filter returned ${markerData.entries.length} matches for RefundProcess`);

  // Test 9: Sort by Marker
  const sortMarkerRes = await fetch(`${BASE_URL}/api/logs/entries?sourceId=app-workflow&sortBy=marker&direction=asc`);
  assert.strictEqual(sortMarkerRes.status, 200);
  const sortMarkerData = await sortMarkerRes.json();
  assert.ok(sortMarkerData.entries.length > 1);
  const firstMarker = sortMarkerData.entries[0].workflow || '';
  const secondMarker = sortMarkerData.entries[1].workflow || '';
  assert.ok(firstMarker <= secondMarker, 'Markers should be in ascending alphabetical order');
  console.log(`✓ Test 9 Passed: Sort by marker verified (${firstMarker} <= ${secondMarker})`);

  // Test 10: Paste Logs endpoint
  const pasteRes = await fetch(`${BASE_URL}/api/logs/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: '[2026-09-02 00:30:00.000] [1001] [thread-01] [App.Auth] [WF:Login-1] [AuthToken] [SUCCESS] [10ms] Pasted login event [Auth.ts::10]',
      name: 'Pasted Test Event',
    }),
  });
  assert.strictEqual(pasteRes.status, 200);
  const pasteData = await pasteRes.json();
  assert.ok(pasteData.source.id.startsWith('custom-'));
  console.log(`✓ Test 10 Passed: Successfully pasted logs and registered source ${pasteData.source.id}`);

  // Test 11: Workflow and Operation active counts
  const countsRes = await fetch(`${BASE_URL}/api/logs/entries?sourceId=app-workflow`);
  assert.strictEqual(countsRes.status, 200);
  const countsData = await countsRes.json();
  assert.ok(countsData.workflowCounts && Object.keys(countsData.workflowCounts).length > 0, 'Should have workflow counts');
  assert.ok(countsData.operationCounts && Object.keys(countsData.operationCounts).length > 0, 'Should have operation counts');
  console.log(`✓ Test 11 Passed: Discovered ${Object.keys(countsData.workflowCounts).length} workflows and ${Object.keys(countsData.operationCounts).length} operations`);

  // Test 12: Filter by Workflow and Operation
  const filterWfRes = await fetch(`${BASE_URL}/api/logs/entries?sourceId=app-workflow&workflow=OrderCheckout&operation=ReserveInventory`);
  assert.strictEqual(filterWfRes.status, 200);
  const filterWfData = await filterWfRes.json();
  assert.ok(filterWfData.entries.length > 0, 'Should return matching entries for OrderCheckout + ReserveInventory');
  for (const entry of filterWfData.entries) {
    assert.ok(entry.workflow?.includes('OrderCheckout'));
    assert.ok(entry.operation?.includes('ReserveInventory'));
  }
  console.log(`✓ Test 12 Passed: Filter by OrderCheckout + ReserveInventory returned ${filterWfData.entries.length} entries`);

  // Test 13: Datetime range filtering
  const dateRes = await fetch(`${BASE_URL}/api/logs/entries?sourceId=app-workflow&startDate=2026-09-02T00:00:00.000Z&endDate=2026-09-02T00:00:02.000Z`);
  assert.strictEqual(dateRes.status, 200);
  const dateData = await dateRes.json();
  assert.ok(dateData.entries.length > 0, 'Should return entries within datetime range');
  console.log(`✓ Test 13 Passed: Datetime range filter returned ${dateData.entries.length} entries between 00:00:00 and 00:00:02`);

  // Test 14: Correlation ID aggregation
  const corrCountsRes = await fetch(`${BASE_URL}/api/logs/entries?sourceId=app-workflow`);
  assert.strictEqual(corrCountsRes.status, 200);
  const corrCountsData = await corrCountsRes.json();
  assert.ok(corrCountsData.correlationCounts, 'Should return correlationCounts');
  const corrKeys = Object.keys(corrCountsData.correlationCounts);
  assert.ok(corrKeys.length > 0, 'Should have discovered correlation IDs');
  console.log(`✓ Test 14 Passed: Discovered ${corrKeys.length} active correlation IDs in document`);

  // Test 15: Filter by specific Correlation ID
  const testCorrId = corrKeys[0];
  const expectedCount = corrCountsData.correlationCounts[testCorrId];
  const filterCorrRes = await fetch(`${BASE_URL}/api/logs/entries?sourceId=app-workflow&correlationId=${encodeURIComponent(testCorrId)}`);
  assert.strictEqual(filterCorrRes.status, 200);
  const filterCorrData = await filterCorrRes.json();
  assert.strictEqual(filterCorrData.entries.length, expectedCount);
  for (const entry of filterCorrData.entries) {
    assert.strictEqual(entry.correlationId, testCorrId);
  }
  // Test 16: Recursive folder discovery
  const discSourcesRes = await fetch(`${BASE_URL}/api/sources`);
  const discSourcesData = await discSourcesRes.json();
  const sourcesList = discSourcesData.sources;
  const ordersSource = sourcesList.find((s: any) => s.path.includes('orders.log'));
  assert.ok(ordersSource, 'Should have discovered nested orders.log in logs/microservices/');
  console.log(`✓ Test 16 Passed: Recursive folder discovery located nested log "${ordersSource.name}"`);

  // Test 17: Rotated log grouping and querying
  const appWorkflowSource = sourcesList.find((s: any) => s.id === 'app-workflow');
  assert.ok(appWorkflowSource, 'app-workflow source exists');
  assert.ok(appWorkflowSource.rotations && appWorkflowSource.rotations.length >= 2, 'app-workflow should have grouped rotated archives');
  const rot1 = appWorkflowSource.rotations[0];
  const rotRes = await fetch(`${BASE_URL}/api/logs/entries?sourceId=${encodeURIComponent(rot1.id)}`);
  assert.strictEqual(rotRes.status, 200);
  const rotData = await rotRes.json();
  assert.ok(rotData.entries.length > 0, 'Should return entries from rotated log archive');
  console.log(`✓ Test 17 Passed: Rotated archive "${rot1.name}" correctly grouped and loaded ${rotData.entries.length} archived entries`);

  // Test 18: Live stream append endpoint
  const appendRes = await fetch(`${BASE_URL}/api/logs/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceId: 'app-workflow',
      lines: [
        '[2026-09-02 03:00:00.000] [PID:999] [TID:111] [corr-stream-test] [Stream.Live] [SPEED] [Process] [SUCCESS] [5ms] Real-time stream rate verified [stream.ts::42]',
      ],
    }),
  });
  assert.strictEqual(appendRes.status, 200);
  const appendData = await appendRes.json();
  assert.strictEqual(appendData.success, true);
  assert.strictEqual(appendData.count, 1);
  console.log(`✓ Test 18 Passed: Appended new live entry for real-time rate monitoring`);

  console.log('\nAll 18 API Integration Tests Passed Successfully!');
}

runApiTests().catch((err) => {
  console.error('API Test Failure:', err);
  process.exit(1);
});
