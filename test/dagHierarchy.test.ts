import assert from 'node:assert';
import {
  parseNamespaceHierarchy,
  groupNodesIntoSubsystems,
  groupNodesIntoThreadSwimlanes,
  getSubsystemColor,
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

console.log('\nAll DAG Hierarchy, Subsystem & Swimlane Tests Passed Successfully!\n');
