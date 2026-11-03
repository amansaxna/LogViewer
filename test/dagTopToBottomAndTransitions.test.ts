import assert from 'node:assert';
import {
  parseNamespaceHierarchy,
  computeGroupTransitions,
  getSubsystemColor,
} from '../src/utils/dagHierarchyEngine.ts';

console.log('--- Testing DAG Top-to-Bottom Direction & Animated Group Transitions ---');

// Test 1: Multi-step, multi-service enterprise trace transitions
const enterpriseSteps = [
  { index: 0, module: 'ApiGateway::HttpListener::HandleRequest', operation: 'POST /checkout', deltaFromPrevMs: 0, level: 'info' },
  { index: 1, module: 'AuthService::JwtValidator::VerifyToken', operation: 'VerifyToken', deltaFromPrevMs: 14, level: 'info' },
  { index: 2, module: 'AuthService::Permissions::CheckScopes', operation: 'CheckScopes', deltaFromPrevMs: 22, level: 'info' },
  { index: 3, module: 'OrderService::InventoryValidator::CheckStock', operation: 'CheckStock', deltaFromPrevMs: 85, level: 'info', isHotspot: true },
  { index: 4, module: 'PaymentEngine::StripeGateway::Charge', operation: 'ChargeCard', deltaFromPrevMs: 310, level: 'error', hasTrace: true },
  { index: 5, module: 'NotificationHub::EmailService::SendReceipt', operation: 'SendEmail', deltaFromPrevMs: 40, level: 'info' },
  { index: 6, module: 'ApiGateway::HttpListener::ReturnResponse', operation: 'HTTP 200 OK', deltaFromPrevMs: 12, level: 'info' },
].map((s) => ({
  ...s,
  hierarchy: parseNamespaceHierarchy(s.module),
}));

const result = computeGroupTransitions(enterpriseSteps);

assert.strictEqual(result.totalSteps, 7, 'Must have 7 steps in trace');
assert.strictEqual(result.groups.length, 5, 'Must have 5 unique groups: ApiGateway, AuthService, OrderService, PaymentEngine, NotificationHub');

// Check groups
const groupNames = result.groups.map((g) => g.name);
assert.deepStrictEqual(groupNames, ['ApiGateway', 'AuthService', 'OrderService', 'PaymentEngine', 'NotificationHub']);

// Check transition details from Step 1 to Last
assert.strictEqual(result.transitions[0].fromGroup, 'ApiGateway');
assert.strictEqual(result.transitions[0].toGroup, 'ApiGateway');
assert.strictEqual(result.transitions[0].isCrossGroup, false);

assert.strictEqual(result.transitions[1].fromGroup, 'ApiGateway');
assert.strictEqual(result.transitions[1].toGroup, 'AuthService');
assert.strictEqual(result.transitions[1].isCrossGroup, true);

// Step 2 is within AuthService (not cross-group)
assert.strictEqual(result.transitions[2].fromGroup, 'AuthService');
assert.strictEqual(result.transitions[2].toGroup, 'AuthService');
assert.strictEqual(result.transitions[2].isCrossGroup, false);

// Step 3 transitions AuthService -> OrderService
assert.strictEqual(result.transitions[3].fromGroup, 'AuthService');
assert.strictEqual(result.transitions[3].toGroup, 'OrderService');
assert.strictEqual(result.transitions[3].isCrossGroup, true);
assert.strictEqual(result.transitions[3].isHotspot, true);

// Step 4 transitions OrderService -> PaymentEngine (with error)
assert.strictEqual(result.transitions[4].fromGroup, 'OrderService');
assert.strictEqual(result.transitions[4].toGroup, 'PaymentEngine');
assert.strictEqual(result.transitions[4].isCrossGroup, true);
assert.strictEqual(result.transitions[4].level, 'error');
assert.strictEqual(result.transitions[4].hasTrace, true);

// Step 6 transitions NotificationHub -> ApiGateway (loop back)
assert.strictEqual(result.transitions[6].fromGroup, 'NotificationHub');
assert.strictEqual(result.transitions[6].toGroup, 'ApiGateway');
assert.strictEqual(result.transitions[6].isCrossGroup, true);

console.log('✓ Test 1 Passed: Enterprise multi-service group transitions from Step 1 -> Last calculated correctly');

// Test 2: Edge aggregation and self-loop verification
const authSelfLoop = result.edges.find((e) => e.isSelfLoop && e.fromGroup === 'AuthService');
assert.ok(authSelfLoop, 'Must have identified self-loop edge for consecutive steps in AuthService');
assert.strictEqual(authSelfLoop?.fromGroup, 'AuthService');
assert.strictEqual(authSelfLoop?.toGroup, 'AuthService');

const crossEdges = result.edges.filter((e) => !e.isSelfLoop);
assert.strictEqual(crossEdges.length, 5, 'Must have 5 cross-group directed transition edges');
console.log('✓ Test 2 Passed: Transition edges and self-loops accurately extracted');

// Test 3: Single-subsystem fallback to leaf operations
const singleModuleSteps = [
  { index: 0, module: 'CheckoutModule::ValidateCart', operation: 'ValidateCart', deltaFromPrevMs: 0 },
  { index: 1, module: 'CheckoutModule::ApplyDiscount', operation: 'ApplyDiscount', deltaFromPrevMs: 10 },
  { index: 2, module: 'CheckoutModule::CalculateTax', operation: 'CalculateTax', deltaFromPrevMs: 15 },
].map((s) => ({
  ...s,
  hierarchy: parseNamespaceHierarchy(s.module),
}));

const singleResult = computeGroupTransitions(singleModuleSteps);
assert.strictEqual(singleResult.groups.length, 3, 'When all steps share one root namespace, must dynamically group by leaf operations or 2-tier sub-namespaces');
assert.strictEqual(singleResult.transitions[1].fromGroup, 'CheckoutModule :: ValidateCart');
assert.strictEqual(singleResult.transitions[1].toGroup, 'CheckoutModule :: ApplyDiscount');
console.log('✓ Test 3 Passed: Single-subsystem gracefully falls back to operation-level groups');

// Test 4: Palette assignment & error flagging
const paymentGroup = result.groups.find((g) => g.name === 'PaymentEngine');
assert.ok(paymentGroup, 'PaymentEngine group must exist');
assert.strictEqual(paymentGroup?.hasError, true, 'PaymentEngine group must have hasError flag set');
assert.ok(paymentGroup?.color.border, 'Group color border must be populated');
assert.ok(paymentGroup?.initials.length >= 2, 'Initials must be generated');
console.log('✓ Test 4 Passed: Group theme colors, initials & error status assigned');

// Test 5: Empty trace & single-step edge cases
const emptyResult = computeGroupTransitions([]);
assert.strictEqual(emptyResult.totalSteps, 0);
assert.strictEqual(emptyResult.groups.length, 0);

const singleStepResult = computeGroupTransitions([
  { index: 0, module: 'Init::Start', operation: 'Start', hierarchy: parseNamespaceHierarchy('Init::Start') },
]);
assert.strictEqual(singleStepResult.totalSteps, 1);
assert.strictEqual(singleStepResult.groups.length, 1);
assert.strictEqual(singleStepResult.transitions.length, 1);
console.log('✓ Test 5 Passed: Empty and single-step boundary conditions handled safely');

console.log('\nAll DAG Top-to-Bottom & Animated Group Transition Tests Passed!\n');
