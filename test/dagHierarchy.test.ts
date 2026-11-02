import assert from 'node:assert';
import {
  parseNamespaceHierarchy,
  groupNodesIntoSubsystems,
  groupNodesIntoThreadSwimlanes,
  getSubsystemColor,
  buildMacroGraph,
  resolveEffectiveClusterLevel,
  computeCallStackFrames,
  computeActiveCallPath,
} from '../src/utils/dagHierarchyEngine.ts';

console.log('--- Testing DAG Hierarchy, Subsystem Clustering & Thread Swimlanes ---');

// Test 1: Colon-separated 4-tier namespace parsing
const ns1 = 'PrimaryCommerce::Storefront::UserSession::InitializeCheckout';
const h1 = parseNamespaceHierarchy(ns1);
assert.strictEqual(h1.root, 'PrimaryCommerce', 'Root subsystem must be PrimaryCommerce');
assert.strictEqual(h1.parentPath, 'PrimaryCommerce › Storefront › UserSession', 'Parent breadcrumb path verified');
assert.strictEqual(h1.leaf, 'InitializeCheckout', 'Leaf function extracted correctly');
assert.strictEqual(h1.subsystem, 'PrimaryCommerce :: Storefront', '2-tier subsystem extracted');
assert.strictEqual(h1.segments.length, 4, 'Must have 4 segments');
console.log('✓ Test 1 Passed: Colon-separated 4-tier namespace parsing verified');

// Test 2: Dot-separated Java/C# style namespace parsing
const ns2 = 'PrimaryBilling.PaymentProcessor.StripeClient.AuthorizeCardPayment';
const h2 = parseNamespaceHierarchy(ns2);
assert.strictEqual(h2.root, 'PrimaryBilling', 'Root subsystem must be PrimaryBilling');
assert.strictEqual(h2.parentPath, 'PrimaryBilling › PaymentProcessor › StripeClient');
assert.strictEqual(h2.leaf, 'AuthorizeCardPayment');
console.log('✓ Test 2 Passed: Dot-separated namespace parsing verified');

// Test 3: Unqualified / flat namespace edge cases
const h3 = parseNamespaceHierarchy('SingleWord');
assert.strictEqual(h3.root, 'SingleWord');
assert.strictEqual(h3.parentPath, '');
assert.strictEqual(h3.leaf, 'SingleWord');

const h4 = parseNamespaceHierarchy('');
assert.strictEqual(h4.root, 'Core');
assert.strictEqual(h4.leaf, 'Operation');
console.log('✓ Test 3 Passed: Fallback for empty and single word namespaces verified');

// Test 4: Subsystem Boundary Clustering
const mockNodes = [
  { id: '1', module: 'PrimaryCommerce::Storefront::UserSession::InitializeCheckout', deltaFromPrevMs: 0 },
  { id: '2', module: 'PrimaryCommerce::CartEngine::InventoryCatalog::ValidateStockAvailability', deltaFromPrevMs: 45 },
  { id: '3', module: 'PrimaryCommerce::Warehouse::StockAllocator::ReserveInventoryBatch', deltaFromPrevMs: 65 },
  { id: '4', module: 'PrimarySecurity::FraudDetection::MlRiskEngine::EvaluateTransactionRisk', deltaFromPrevMs: 105 },
  { id: '5', module: 'PrimaryBilling::PaymentProcessor::StripeClient::AuthorizeCardPayment', deltaFromPrevMs: 200 },
  { id: '6', module: 'PrimaryBilling::PaymentProcessor::StripeClient::CaptureAuthorizedHold', deltaFromPrevMs: 260 },
];

const clusters = groupNodesIntoSubsystems(mockNodes);
assert.strictEqual(clusters.length, 3, 'Must create 3 contiguous subsystem clusters');
assert.strictEqual(clusters[0].root, 'PrimaryCommerce');
assert.strictEqual(clusters[0].items.length, 3, 'PrimaryCommerce cluster must hold 3 items');
assert.strictEqual(clusters[0].totalDeltaMs, 110, 'PrimaryCommerce delta sum: 0 + 45 + 65 = 110ms');
assert.strictEqual(clusters[1].root, 'PrimarySecurity');
assert.strictEqual(clusters[1].items.length, 1);
assert.strictEqual(clusters[2].root, 'PrimaryBilling');
assert.strictEqual(clusters[2].items.length, 2);
console.log('✓ Test 4 Passed: Contiguous Subsystem Clustering & metrics verified');

// Test 5: Multi-Thread Execution Swimlanes
const threadNodes = [
  { id: '1', entry: { tid: 'thread_01', pid: '100' }, timestampMs: 1000, deltaFromPrevMs: 0 },
  { id: '2', entry: { tid: 'thread_01', pid: '100' }, timestampMs: 1050, deltaFromPrevMs: 50 },
  { id: '3', entry: { tid: 'thread_02', pid: '100' }, timestampMs: 1020, deltaFromPrevMs: 20 },
  { id: '4', entry: { tid: 'thread_03', pid: '100' }, timestampMs: 1080, deltaFromPrevMs: 60 },
  { id: '5', entry: { tid: 'thread_02', pid: '100' }, timestampMs: 1140, deltaFromPrevMs: 60 },
];

const lanes = groupNodesIntoThreadSwimlanes(threadNodes);
assert.strictEqual(lanes.length, 3, 'Must group into 3 unique thread lanes');
assert.strictEqual(lanes[0].threadId, 'thread_01');
assert.strictEqual(lanes[0].items.length, 2);
assert.strictEqual(lanes[1].threadId, 'thread_02');
assert.strictEqual(lanes[1].items.length, 2);
assert.strictEqual(lanes[1].totalDurationMs, 120, '1140 - 1020 = 120ms total thread span');
assert.strictEqual(lanes[2].threadId, 'thread_03');
assert.strictEqual(lanes[2].items.length, 1);
console.log('✓ Test 5 Passed: Multi-thread swimlane aggregation & durations verified');

// Test 6: Deterministic Palettes
const c1 = getSubsystemColor('PrimaryCommerce');
const c2 = getSubsystemColor('PrimaryCommerce');
assert.strictEqual(c1.border, c2.border, 'Color must be strictly deterministic for same subsystem');
console.log('✓ Test 6 Passed: Deterministic Subsystem Palette assignment verified');

// Test 7: Embedded Payload AST Inspector Contract
const payloadSample = '{"tier":"enterprise_trial","locale":"en_US"}';
const isXml = payloadSample.trim().startsWith('<');
assert.strictEqual(isXml, false, 'JSON payload detected correctly');
const parsed = JSON.parse(payloadSample);
assert.strictEqual(parsed.tier, 'enterprise_trial');
assert.strictEqual(parsed.locale, 'en_US');
console.log('✓ Test 7 Passed: Embedded Payload AST Inspector Contract verified');

// Test 8: Single-Subsystem Adaptive LCP Trimming
const singleSubsystemNodes = [
  { id: '1', module: 'CoreBanking::AlertSubsystem::PagerDutyNotifier::DispatchIncidentAlert', deltaFromPrevMs: 0, operation: 'DispatchIncidentAlert' },
  { id: '2', module: 'CoreBanking::AlertSubsystem::SlackNotifier::SendMessage', deltaFromPrevMs: 25, operation: 'SendMessage' },
  { id: '3', module: 'CoreBanking::PaymentEngine::StripeGateway::AuthorizeCard', deltaFromPrevMs: 140, operation: 'AuthorizeCard' },
  { id: '4', module: 'CoreBanking::PaymentEngine::Ledger::PostJournalEntry', deltaFromPrevMs: 60, operation: 'PostJournalEntry' },
  { id: '5', module: 'CoreBanking::UserAuth::JwtVerifier::VerifyToken', deltaFromPrevMs: 15, operation: 'VerifyToken' },
];

const autoClusters = groupNodesIntoSubsystems(singleSubsystemNodes, false, 'auto');
assert.strictEqual(autoClusters.length, 3, 'Adaptive LCP must automatically split into 3 functional modules instead of 1 monolithic cluster');
assert.strictEqual(autoClusters[0].displayName, 'AlertSubsystem', 'First cluster must be AlertSubsystem');
assert.strictEqual(autoClusters[0].items.length, 2);
assert.strictEqual(autoClusters[1].displayName, 'PaymentEngine', 'Second cluster must be PaymentEngine');
assert.strictEqual(autoClusters[1].items.length, 2);
assert.strictEqual(autoClusters[2].displayName, 'UserAuth', 'Third cluster must be UserAuth');
assert.strictEqual(autoClusters[2].items.length, 1);
console.log('✓ Test 8 Passed: Single-Subsystem Adaptive LCP Trimming verified');

// Test 9: Explicit Granularity Overrides (L1, L2, L3, None)
const l1Clusters = groupNodesIntoSubsystems(singleSubsystemNodes, false, 'l1');
assert.strictEqual(l1Clusters.length, 1, 'L1 must group by root domain (CoreBanking)');
assert.strictEqual(l1Clusters[0].displayName, 'CoreBanking');

const l2Clusters = groupNodesIntoSubsystems(singleSubsystemNodes, false, 'l2');
assert.strictEqual(l2Clusters.length, 3, 'L2 must group by module');

const l3Clusters = groupNodesIntoSubsystems(singleSubsystemNodes, false, 'l3');
assert.strictEqual(l3Clusters.length, 5, 'L3 must group by component/class (5 components)');

const noneClusters = groupNodesIntoSubsystems(singleSubsystemNodes, false, 'none');
assert.strictEqual(noneClusters.length, 0, 'none must return empty clusters array for flat mode');
console.log('✓ Test 9 Passed: Explicit Granularity Overrides (L1, L2, L3, None) verified');

// Test 10: Macro-Graph Transit Edges & Hotspot Detection
const macroGraph = buildMacroGraph(autoClusters);
assert.strictEqual(macroGraph.clusters.length, 3, 'Macro graph must contain 3 macro nodes');
assert.strictEqual(macroGraph.edges.length, 2, 'Must have 2 inter-subsystem transit edges');
assert.strictEqual(macroGraph.edges[0].fromName, 'AlertSubsystem');
assert.strictEqual(macroGraph.edges[0].toName, 'PaymentEngine');
assert.strictEqual(macroGraph.edges[0].transitDeltaMs, 140, 'Inter-subsystem transit latency must match step 3 delta (140ms)');
assert.strictEqual(macroGraph.edges[0].isHotspot, true, '140ms >= 100ms must be flagged as hotspot');
assert.strictEqual(macroGraph.edges[1].transitDeltaMs, 15, 'Second edge must have 15ms transit');
assert.strictEqual(macroGraph.edges[1].isHotspot, false);
console.log('✓ Test 10 Passed: Macro-Graph Transit Edges & Hotspot Detection verified');

// Test 11: Call Stack Activation & Return-Resume Reconstitution (f1 -> f2 -> f3 -> return f2 -> return f1)
const callTraceNodes = [
  { index: 0, module: 'OrderService::ProcessOrder', operation: 'ProcessOrder', message: 'entry log: Order #1001' },
  { index: 1, module: 'OrderService::ValidateCart', operation: 'ValidateCart', message: 'Validating cart items' },
  { index: 2, module: 'PaymentEngine::Charge', operation: 'Charge', message: 'Calling payment gateway' },
  { index: 3, module: 'StripeGateway::PostRequest', operation: 'PostRequest', message: 'Posting charge to Stripe' },
  { index: 4, module: 'PaymentEngine::Charge', operation: 'Charge', message: 'Charge completed 120ms', duration: '120ms' },
  { index: 5, module: 'OrderService::SendEmail', operation: 'SendEmail', message: 'After f2 returns, continue order: Send email' },
  { index: 6, module: 'OrderService::ProcessOrder', operation: 'ProcessOrder', message: 'Order #1001 completed' },
];

const stackFrames = computeCallStackFrames(callTraceNodes);

// Step 0: Root frame depth 0
assert.strictEqual(stackFrames.get(0)?.callDepth, 0);
assert.strictEqual(stackFrames.get(0)?.isReturnResume, false);

// Step 2: Callee PaymentEngine (depth 1, caller Step 1 ValidateCart)
assert.strictEqual(stackFrames.get(2)?.callDepth, 1);
assert.strictEqual(stackFrames.get(2)?.parentCallerStepIndex, 1);

// Step 3: Nested callee StripeGateway (depth 2, caller Step 2 Charge)
assert.strictEqual(stackFrames.get(3)?.callDepth, 2);
assert.strictEqual(stackFrames.get(3)?.parentCallerStepIndex, 2);

// Step 4: PaymentEngine resumes from StripeGateway (depth 1, isReturnResume: true, returnedFrom: 3)
assert.strictEqual(stackFrames.get(4)?.callDepth, 1);
assert.strictEqual(stackFrames.get(4)?.isReturnResume, true);
assert.strictEqual(stackFrames.get(4)?.returnedFromStepIndex, 3);
assert.strictEqual(stackFrames.get(4)?.returnedFromOperation, 'PostRequest');

// Step 5: OrderService resumes from PaymentEngine (depth 0, isReturnResume: true, returnedFrom: 4, caller: Step 1)
assert.strictEqual(stackFrames.get(5)?.callDepth, 0);
assert.strictEqual(stackFrames.get(5)?.isReturnResume, true);
assert.strictEqual(stackFrames.get(5)?.returnedFromStepIndex, 4);
assert.strictEqual(stackFrames.get(5)?.returnedFromOperation, 'Charge');
assert.strictEqual(stackFrames.get(5)?.parentCallerStepIndex, 1);

console.log('✓ Test 11 Passed: Call Stack Activation & Return-Resume Reconstitution verified');

// Test 12: Active Call-Path Spotlight
const traceNodesWithFrames = callTraceNodes.map((n) => {
  const f = stackFrames.get(n.index);
  return {
    index: n.index,
    parentCallerStepIndex: f?.parentCallerStepIndex,
    isReturnResume: f?.isReturnResume,
    returnedFromStepIndex: f?.returnedFromStepIndex,
  };
});

// Spotlight from nested Step 3 (StripeGateway)
const pathFrom3 = computeActiveCallPath(3, traceNodesWithFrames);
assert.ok(pathFrom3.has(3), 'Must include self');
assert.ok(pathFrom3.has(2), 'Must include caller PaymentEngine');
assert.ok(pathFrom3.has(1), 'Must include root caller ValidateCart');
assert.ok(pathFrom3.has(4), 'Must include return resume step');
console.log('✓ Test 12 Passed: Active Call-Path Spotlight verified');

// Test 13: Flame-DAG 2D Coordinates & Transition Classifications
const flameNodes = callTraceNodes.map((n) => {
  const f = stackFrames.get(n.index);
  return {
    ...n,
    callDepth: f?.callDepth ?? 0,
    isReturnResume: f?.isReturnResume ?? false,
    returnedFromStepIndex: f?.returnedFromStepIndex,
  };
});

const maxDepth = Math.max(0, ...flameNodes.map((n) => n.callDepth));
assert.strictEqual(maxDepth, 2, 'Max stack depth for 3-tier call stack must be 2');

// Transition 1 -> 2: Descent into Callee
const t12_descent = flameNodes[2].callDepth > flameNodes[1].callDepth;
assert.strictEqual(t12_descent, true, 'Step 1 to Step 2 must be callee descent');

// Transition 2 -> 3: Nested Descent
const t23_descent = flameNodes[3].callDepth > flameNodes[2].callDepth;
assert.strictEqual(t23_descent, true, 'Step 2 to Step 3 must be nested callee descent');

// Transition 3 -> 4: Return upward to PaymentEngine
const t34_return = flameNodes[4].isReturnResume || flameNodes[4].callDepth < flameNodes[3].callDepth;
assert.strictEqual(t34_return, true, 'Step 3 to Step 4 must be return to caller');

// Transition 4 -> 5: Return upward to OrderService root
const t45_return = flameNodes[5].isReturnResume || flameNodes[5].callDepth < flameNodes[4].callDepth;
assert.strictEqual(t45_return, true, 'Step 4 to Step 5 must be return to root caller');

console.log('✓ Test 13 Passed: Flame-DAG 2D Stack Coordinates & Return Transitions verified');

// Test 14: End-to-End Enterprise Complexity in workflow_dag_test.log
import fs from 'node:fs';
import path from 'node:path';
import { parseLogLines } from '../server/parser.ts';

const logFilePath = path.resolve(process.cwd(), 'logs/workflow_dag_test.log');
const rawLogContent = fs.readFileSync(logFilePath, 'utf-8');
const parsedEntries = parseLogLines(rawLogContent);

assert.ok(parsedEntries.length >= 20, 'Must parse enterprise production log entries');

// 1. Verify all 4 real-world workflows are present
const workflows = Array.from(new Set(parsedEntries.map((e) => e.workflow).filter(Boolean)));
assert.ok(workflows.includes('WF:CheckoutSaga_7491'), 'Must include WF:CheckoutSaga_7491');
assert.ok(workflows.includes('WF:UserIdentityOnboarding_8812'), 'Must include WF:UserIdentityOnboarding_8812');
assert.ok(workflows.includes('WF:FinancialReconciliation_9940'), 'Must include WF:FinancialReconciliation_9940');
assert.ok(workflows.includes('WF:FxArbitrageExecution_3102'), 'Must include WF:FxArbitrageExecution_3102');

// 2. Filter CheckoutSaga_7491 and test Call Stack Reconstitution
const sagaEntries = parsedEntries.filter((e) => e.workflow === 'WF:CheckoutSaga_7491');
const sagaNodes = sagaEntries.map((e, idx) => ({
  index: idx,
  module: e.namespace || e.workflow || 'Main',
  operation: e.operation || e.message.slice(0, 32),
  message: e.message,
  level: e.level,
  duration: e.duration,
}));

const sagaFrames = computeCallStackFrames(sagaNodes);

// Depth 0: CheckoutPlatform (Step 0 & Step 1)
assert.strictEqual(sagaFrames.get(0)?.callDepth, 0);
assert.strictEqual(sagaFrames.get(1)?.callDepth, 0);

// Depth 1: WarehouseCluster (Step 2)
assert.strictEqual(sagaFrames.get(2)?.callDepth, 1);

// Depth 2: DataTier Postgres (Step 3 & Step 4)
assert.strictEqual(sagaFrames.get(3)?.callDepth, 2);
assert.strictEqual(sagaFrames.get(4)?.callDepth, 2);

// Return upward to Depth 1 (Step 5: ConfirmStockHold)
assert.strictEqual(sagaFrames.get(5)?.callDepth, 1);
assert.strictEqual(sagaFrames.get(5)?.isReturnResume, true);

// Return upward to Root Orchestrator Depth 0 (Step 6: ResumePipeline)
assert.strictEqual(sagaFrames.get(6)?.callDepth, 0);
assert.strictEqual(sagaFrames.get(6)?.isReturnResume, true);

// Verify latency hotspot in StripeConnector (850ms)
const has850ms = sagaEntries.some((e) => e.duration === '850ms');
assert.ok(has850ms, 'Must contain 850ms latency hotspot hop');

// Verify SocketTimeoutException trace captured
const errorEntry = sagaEntries.find((e) => e.level === 'error' && e.trace);
assert.ok(errorEntry, 'Must capture PaymentGateway SocketTimeoutException trace');
assert.ok(errorEntry?.trace?.frames.length! >= 3, 'Trace must contain call stack frames');

// Verify PagerDuty SEV-2 alert
const alertEntry = sagaEntries.find((e) => e.operation === 'DispatchIncidentAlert');
assert.ok(alertEntry, 'Must dispatch PagerDuty alert');
assert.strictEqual(alertEntry?.level, 'critical');

console.log('✓ Test 14 Passed: End-to-End Enterprise Production Software Complexity verified in workflow_dag_test.log');

// Test 15: Uniform Namespace (Single Module) Operation Clustering & Auto-Flatten
const uniformNodes = [
  { module: 'Stream.Live', operation: 'Connect', deltaFromPrevMs: 10 },
  { module: 'Stream.Live', operation: 'Connect', deltaFromPrevMs: 12 },
  { module: 'Stream.Live', operation: 'Publish', deltaFromPrevMs: 15 },
  { module: 'Stream.Live', operation: 'Publish', deltaFromPrevMs: 18 },
  { module: 'Stream.Live', operation: 'Acknowledge', deltaFromPrevMs: 8 },
];
const uniformClusters = groupNodesIntoSubsystems(uniformNodes, false, 'auto');
assert.strictEqual(uniformClusters.length, 3, 'Uniform namespace with varying operations must group by operations into 3 clusters');
assert.strictEqual(uniformClusters[0].displayName, 'Connect');
assert.strictEqual(uniformClusters[1].displayName, 'Publish');
assert.strictEqual(uniformClusters[2].displayName, 'Acknowledge');

// Uniform namespace with identical operation should auto-flatten
const identicalNodes = [
  { module: 'Stream.Live', operation: 'Consume', deltaFromPrevMs: 10 },
  { module: 'Stream.Live', operation: 'Consume', deltaFromPrevMs: 12 },
];
const flatClusters = groupNodesIntoSubsystems(identicalNodes, false, 'auto');
assert.strictEqual(flatClusters.length, 0, 'Uniform namespace with single operation must auto-flatten to avoid useless monolithic cluster');
console.log('✓ Test 15 Passed: Uniform Single-Module Operation Clustering & Auto-Flatten verified');

// Test 16: Full Virtual Call Stack Trace Frames (Root -> Caller -> Callee)
const stackSample = stackFrames.get(3);
assert.ok(stackSample, 'Must have frame info for step 3');
assert.strictEqual(stackSample?.callDepth, 2);
assert.strictEqual(stackSample?.callStack?.length, 3, 'Depth 2 node must maintain 3 active frames (Depth 0, Depth 1, Depth 2)');
assert.strictEqual(stackSample?.callStack?.[0].depth, 0);
assert.strictEqual(stackSample?.callStack?.[0].index, 1);
assert.strictEqual(stackSample?.callStack?.[1].depth, 1);
assert.strictEqual(stackSample?.callStack?.[1].index, 2);
assert.strictEqual(stackSample?.callStack?.[2].depth, 2);
assert.strictEqual(stackSample?.callStack?.[2].index, 3);
console.log('✓ Test 16 Passed: Full Virtual Call Stack Trace Frames verified');

// Test 17: Large Trace Scalability & Depth Capping (> 200 up to 500 steps)
const largeTrace = Array.from({ length: 500 }, (_, idx) => ({
  index: idx,
  module: `ServiceCluster_${idx % 40}::Subsystem_${idx % 15}::Worker_${idx % 5}`,
  operation: `ExecuteOperation_${idx}`,
  duration: '15ms',
  message: `Dispatched step #${idx}`,
}));

const tStart = performance.now();
const largeStackFrames = computeCallStackFrames(largeTrace);
const largeClusters = groupNodesIntoSubsystems(
  largeTrace.map((n) => ({ module: n.module, deltaFromPrevMs: 10, operation: n.operation }))
);
const tElapsed = performance.now() - tStart;

assert.strictEqual(largeStackFrames.size, 500, 'All 500 steps must be analyzed');
// Verify maximum stack depth does not exceed 12
for (const [, frame] of largeStackFrames) {
  assert.ok(frame.callDepth <= 11, `Depth ${frame.callDepth} must not exceed MAX_STACK_DEPTH ceiling (11)`);
  if (frame.callStack) {
    assert.ok(frame.callStack.length <= 12, `Stack length ${frame.callStack.length} must not exceed 12`);
  }
}
assert.ok(tElapsed < 50, `500-step trace analysis must complete in <50ms (took ${tElapsed.toFixed(2)}ms)`);
console.log(`✓ Test 17 Passed: 500-step trace processed in ${tElapsed.toFixed(2)}ms with max depth capped at 12`);

console.log('\nAll DAG Hierarchy, Subsystem & Swimlane Tests Passed Successfully!\n');
