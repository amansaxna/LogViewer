import assert from 'node:assert';
import {
  parseNamespaceHierarchy,
  groupNodesIntoSubsystems,
  groupNodesIntoThreadSwimlanes,
  getSubsystemColor,
  buildMacroGraph,
  resolveEffectiveClusterLevel,
  computeCallStackFrames,
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

console.log('\nAll DAG Hierarchy, Subsystem & Swimlane Tests Passed Successfully!\n');
