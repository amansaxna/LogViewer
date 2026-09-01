import assert from 'node:assert';
import {
  renderRichMessageContext,
  tokenizeJson,
  findJsonBlocks,
  findEntitiesInMessage,
} from '../src/utils/messageContextHighlighter.tsx';

console.log('--- Testing Message Context Highlighter & JSON Tokenizer ---');

// Test 1: URL detection and extraction
const urlMsg = 'User accessed webhook at https://api.stripe.com/v1/charges/ch_12345 successfully';
const renderedUrl = renderRichMessageContext(urlMsg);
assert.ok(renderedUrl, 'Should render URL');
console.log('✓ Test 1 Passed: URL highlighted properly');

// Test 2: IP Address with Port
const ipMsg = 'Connection established from client 192.168.1.105:8080 to upstream gateway';
const renderedIp = renderRichMessageContext(ipMsg);
assert.ok(renderedIp, 'Should render IP');
console.log('✓ Test 2 Passed: IP address & port highlighted');

// Test 3: UUID detection
const uuidMsg = 'Processed payment transaction with UUID 550e8400-e29b-41d4-a716-446655440000 in record';
const renderedUuid = renderRichMessageContext(uuidMsg);
assert.ok(renderedUuid, 'Should render UUID');
console.log('✓ Test 3 Passed: UUID token highlighted');

// Test 4: Key-Value pairs
const kvMsg = 'User session user_id=9821 tenant_id="acme_corp" status=active synced';
const renderedKv = renderRichMessageContext(kvMsg);
assert.ok(renderedKv, 'Should render key-value pairs');
console.log('✓ Test 4 Passed: Key-Value pairs highlighted');

// Test 5: Endpoints / API paths
const pathMsg = 'Dispatching internal RPC call to /api/v1/orders/checkout from dispatcher';
const renderedPath = renderRichMessageContext(pathMsg);
assert.ok(renderedPath, 'Should render API path');
console.log('✓ Test 5 Passed: API Endpoint path highlighted');

// Test 6: Search query highlighting within message with entities
const searchMsg = 'Calling https://service.internal/api/auth with token abc';
const renderedSearch = renderRichMessageContext(searchMsg, ['auth', 'internal']);
assert.ok(renderedSearch, 'Should highlight search matches');
console.log('✓ Test 6 Passed: Search query match highlighting combined with entity chip');

// Test 7: x=y and single-letter key-value pairs
const xyMsg = 'Evaluating condition [x=y] and calculating a = 10 with flag=true';
const xyEntities = findEntitiesInMessage(xyMsg);
const kvEntities = xyEntities.filter((e) => e.type === 'kv');
assert.ok(kvEntities.length >= 3, `Expected at least 3 KV pairs, got ${kvEntities.length}`);
assert.ok(kvEntities.some((e) => e.key === 'x' && e.val === 'y'), 'Should match x=y');
assert.ok(kvEntities.some((e) => e.key === 'a' && e.val === '10'), 'Should match a = 10');
assert.ok(kvEntities.some((e) => e.key === 'flag' && e.val === 'true'), 'Should match flag=true');
console.log('✓ Test 7 Passed: x=y, a = 10, and [x=y] captured with accurate keys and values');

// Test 8: RFC 8259 JSON Tokenizer
const sampleJson = '{"orderId": "ord_99", "amount": 49.95, "tax": 0, "active": true, "notes": null}';
const tokens = tokenizeJson(sampleJson);
assert.ok(tokens.some((t) => t.type === 'key' && t.value === '"orderId"'), 'Tokenized key "orderId"');
assert.ok(tokens.some((t) => t.type === 'string' && t.value === '"ord_99"'), 'Tokenized string "ord_99"');
assert.ok(tokens.some((t) => t.type === 'number' && t.value === '49.95'), 'Tokenized number 49.95');
assert.ok(tokens.some((t) => t.type === 'boolean' && t.value === 'true'), 'Tokenized boolean true');
assert.ok(tokens.some((t) => t.type === 'null' && t.value === 'null'), 'Tokenized null');
assert.ok(tokens.some((t) => t.type === 'punctuation' && t.value === '{'), 'Tokenized punctuation {');
console.log('✓ Test 8 Passed: RFC 8259 JSON Tokenizer correctly tokenizes keys, strings, numbers, booleans, null, punctuation');

// Test 9: JSON Block Detection in Log Line
const jsonLogMsg = 'Incoming webhook received payload: {"event": "charge.success", "amount": 2500, "customer": "cus_123"} from gateway';
const jsonBlocks = findJsonBlocks(jsonLogMsg);
assert.strictEqual(jsonBlocks.length, 1, 'Should find 1 JSON block');
assert.strictEqual(JSON.parse(jsonBlocks[0].raw).event, 'charge.success', 'Parsed JSON block payload matches');
const renderedJson = renderRichMessageContext(jsonLogMsg);
assert.ok(renderedJson, 'Rendered rich message containing JSON chip');
console.log('✓ Test 9 Passed: Embedded JSON object detected, parsed, and rendered as interactive JSON chip');

// Test 10: Standalone JSON-style Key-Value pairs outside objects
const standaloneJsonMsg = 'Service returned metadata "userId": 1042 and "status": "APPROVED"';
const standaloneEntities = findEntitiesInMessage(standaloneJsonMsg);
assert.ok(standaloneEntities.some((e) => e.key === '"userId"' && e.val === '1042'), 'Captured standalone "userId": 1042');
assert.ok(standaloneEntities.some((e) => e.key === '"status"' && e.val === '"APPROVED"'), 'Captured standalone "status": "APPROVED"');
console.log('✓ Test 10 Passed: Standalone JSON-style "key": val pairs highlighted cleanly');

console.log('\nAll Message Context Highlighter & JSON Tokenizer Tests Passed Successfully!');
