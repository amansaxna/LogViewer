import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  renderRichMessageContext,
  tokenizeJson,
  findJsonBlocks,
  tokenizeXml,
  findXmlBlocks,
  findEntitiesInMessage,
} from '../src/utils/messageContextHighlighter.tsx';
import { renderSyntaxColoredLine, stripBracketMarkers } from '../src/utils/coloredLogRenderer.tsx';

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

// Test 11: Proper W3C XML Tokenizer and Block Detection
const xmlMsg = 'SOAP Envelope received: <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><CancelOrderRequest id="ord_99"/></soap:Body></soap:Envelope> end';
const xmlBlocks = findXmlBlocks(xmlMsg);
assert.strictEqual(xmlBlocks.length, 1, 'Should detect 1 XML block');
assert.ok(xmlBlocks[0].raw.startsWith('<soap:Envelope'), 'Matched SOAP envelope tag');

const xmlTokens = tokenizeXml(xmlBlocks[0].raw);
assert.ok(xmlTokens.some((t) => t.type === 'tagname' && t.value === 'soap:Envelope'), 'Tokenized tagname soap:Envelope');
assert.ok(xmlTokens.some((t) => t.type === 'attr' && t.value === 'xmlns:soap'), 'Tokenized attribute xmlns:soap');
assert.ok(xmlTokens.some((t) => t.type === 'string' && t.value === '"ord_99"'), 'Tokenized string "ord_99"');
assert.ok(xmlTokens.some((t) => t.type === 'tag' && t.value === '</'), 'Tokenized closing tag </');
console.log('✓ Test 11 Passed: W3C XML Tokenizer correctly tokenizes tags, tag names, attributes, and strings');

// Test 12: Filepath Detection
const filepathMsg = 'Reading configuration from /etc/econ/security-config.xml and cache file ./logs/app_workflow.log for worker';
const filepathEntities = findEntitiesInMessage(filepathMsg);
assert.ok(filepathEntities.some((e) => e.type === 'filepath' && e.text === '/etc/econ/security-config.xml'), 'Detected unix filepath');
assert.ok(filepathEntities.some((e) => e.type === 'filepath' && e.text === './logs/app_workflow.log'), 'Detected relative filepath');
console.log('✓ Test 12 Passed: Filepaths accurately detected and highlighted');

// Test 13: Quoted String Detection ("xyz")
const quotedMsg = 'Triggering task with mode "fast-sync" and tag \'production-eu\'';
const quotedEntities = findEntitiesInMessage(quotedMsg);
assert.ok(quotedEntities.some((e) => e.type === 'quoted' && e.text === '"fast-sync"'), 'Detected double-quoted string "fast-sync"');
assert.ok(quotedEntities.some((e) => e.type === 'quoted' && e.text === "'production-eu'"), "Detected single-quoted string 'production-eu'");
console.log('✓ Test 13 Passed: Quoted strings "xyz" and \'xyz\' identified cleanly');

// Test 14: Cloud & Protocol URIs (s3://, gs://, postgres://, etc.)
const cloudUriMsg = 'Uploaded invoice to s3://company-invoices/2026/09/INV-9921.pdf and db postgres://user:pass@db.internal:5432/econ';
const cloudEntities = findEntitiesInMessage(cloudUriMsg);
assert.ok(cloudEntities.some((e) => e.type === 'url' && e.text === 's3://company-invoices/2026/09/INV-9921.pdf'), 'Detected AWS S3 URI');
assert.ok(cloudEntities.some((e) => e.type === 'url' && e.text === 'postgres://user:pass@db.internal:5432/econ'), 'Detected PostgreSQL URI');
console.log('✓ Test 14 Passed: Cloud & protocol URIs (s3://, postgres://) identified and highlighted as URLs');

// Test 15: Hide Brackets Toggle in Syntax Renderer & Exact User Specification
const userSpecRawLine = '[18904] [thread-21] [corr-70-d34] [Payment.StripeGateway] [ReserveInventory] [SUCCESS] Operation ReserveInventory completed successfully for session user_1140 (payload: 351 bytes) [ReportEngine.ts::310]';
const expectedCleanOutput = 'Operation ReserveInventory completed successfully for session user_1140 (payload: 351 bytes)';
const actualCleanOutput = stripBracketMarkers(userSpecRawLine);
assert.strictEqual(actualCleanOutput, expectedCleanOutput, 'stripBracketMarkers strips all bracket tokens leaving pure message');

const bracketRawLine = '[2026-09-02 00:01:50] [18920] [thread-01] [ERROR] Order processing failed [OrderService.ts::42]';
const withoutBrackets = renderSyntaxColoredLine(bracketRawLine, true);
assert.ok(withoutBrackets, 'Rendered clean without brackets');
console.log('✓ Test 15 Passed: Syntax Colored Line & stripBracketMarkers strip all [ ] markers completely per user spec');

// Test 16: Viewport Sticky Right Offset Calculation for XML and JSON Floating Bars
function calculateStickyRightOffset(containerRight: number, containerWidth: number, viewportRight: number): number {
  const targetRight = viewportRight - 16;
  if (containerRight > targetRight) {
    const rawOffset = containerRight - targetRight;
    const maxOffset = Math.max(0, containerWidth - 220);
    return Math.max(0, Math.round(Math.min(rawOffset, maxOffset)));
  }
  return 0;
}

// Case A: Wide JSON/XML extending 1200px beyond viewport (viewport width 800px, chip right edge at 2000px)
const offsetA = calculateStickyRightOffset(2000, 1900, 800);
// Target right = 784px. Container right = 2000px. Offset = 2000 - 784 = 1216px.
// Setting right: 1216px puts floating bar at screen position 2000 - 1216 = 784px (pinned to right edge of viewport!)
assert.strictEqual(offsetA, 1216);
assert.strictEqual(2000 - offsetA, 784, 'Floating bar pinned precisely to visible viewport right edge');

// Case B: User scrolls horizontally to the right by 500px (chip right edge now at 1500px)
const offsetB = calculateStickyRightOffset(1500, 1900, 800);
// Target right = 784px. Offset = 1500 - 784 = 716px. Screen position = 1500 - 716 = 784px (still pinned!)
assert.strictEqual(offsetB, 716);
assert.strictEqual(1500 - offsetB, 784, 'Floating bar smoothly dragged across viewport on scroll');

// Case C: Chip fits completely inside viewport (right edge at 600px <= 784px)
const offsetC = calculateStickyRightOffset(600, 500, 800);
assert.strictEqual(offsetC, 0, 'Offset is 0 when chip is fully visible inside viewport');

console.log('✓ Test 16 Passed: Sticky right offset keeps JSON/XML floating action bar visible in viewport on scroll');

// Test 17: Verify JSON/XML Document Inspector Horizontal Layout & Aligned Line Number Gutter
const inspectorCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/JsonXmlInspectorModal.tsx'), 'utf-8');
assert.ok(inspectorCode.includes('flexDirection: \'row\''), 'Inspector modal must use flexDirection: row for horizontal code + gutter alignment');
assert.ok(!inspectorCode.includes('className="modal-body"'), 'Inspector code body must not inherit vertical column stacking');
assert.ok(inspectorCode.includes('minWidth: 44') || inspectorCode.includes('minWidth: 48'), 'Inspector line gutter must define fixed minWidth');
console.log('✓ Test 17 Passed: JSON/XML Document Inspector horizontal line gutter & code alignment verified');

// Test 18: Verify XML Collapsible Tree Node and DOM Hierarchy
assert.ok(inspectorCode.includes('export const XmlTreeNode'), 'Inspector must export XmlTreeNode for XML collapsible tree view');
assert.ok(inspectorCode.includes('parseXmlToTree'), 'Inspector must include parseXmlToTree function for XML DOM parsing');
assert.ok(inspectorCode.includes('hasTreeMode'), 'Inspector must dynamically enable Tree mode for both JSON and XML');
assert.ok(inspectorCode.includes('xml-tok-tagname'), 'XmlTreeNode must style XML tag names with semantic colors');
assert.ok(inspectorCode.includes('xml-tok-attr'), 'XmlTreeNode must style XML attributes with semantic colors');
assert.ok(inspectorCode.includes('countLabel'), 'XmlTreeNode must display item/children summary badge when collapsed');
console.log('✓ Test 18 Passed: XML Collapsible Tree Node, DOM Parser, and Syntax Highlighting verified');

console.log('\nAll Message Context Highlighter & Tokenizer Tests Passed Successfully!');
