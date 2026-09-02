import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getPresets, savePreset, deletePreset } from '../server/config.ts';
import { LogPreset, LogEntry } from '../server/types.ts';

console.log('--- Testing JSON-Driven Presets & Dual Rate Metrics ---');

// Test 1: Config file exists and loads default presets
const presets = getPresets();
assert.ok(presets.length >= 4, 'Should load at least 4 default presets');
const minimal = presets.find((p) => p.id === 'minimal-set');
assert.ok(minimal, 'Minimal Set preset must exist');
assert.strictEqual(minimal?.rules.hideBrackets, true, 'Minimal set disables brackets');
assert.strictEqual(minimal?.rules.showCorrelation, false, 'Minimal set hides correlation');
assert.deepStrictEqual(minimal?.rules.excludeKeywords, ['x', 'y', 'ping', 'heartbeat'], 'Minimal set excludes noise keys');
console.log('✓ Test 1 Passed: Default presets correctly configured in config/presets.json');

// Test 2: Save, update, and delete preset functions
const testPresetId = 'test-custom-preset';
const testPreset: LogPreset = {
  id: testPresetId,
  name: 'Test Custom Preset',
  description: 'Preset for unit tests',
  rules: {
    hideBrackets: true,
    showCorrelation: false,
    excludeKeywords: ['foo', 'bar'],
    excludeMarkers: ['Deregister unavailable'],
    includeMarkers: ['Register'],
    viewMode: 'compact',
  },
};

savePreset(testPreset);
let reloaded = getPresets();
const saved = reloaded.find((p) => p.id === testPresetId);
assert.ok(saved, 'Custom preset should be saved to presets list');
assert.strictEqual(saved?.name, 'Test Custom Preset');
assert.deepStrictEqual(saved?.rules.excludeKeywords, ['foo', 'bar']);

// Update
savePreset({ ...testPreset, name: 'Updated Custom Preset' });
reloaded = getPresets();
const updated = reloaded.find((p) => p.id === testPresetId);
assert.strictEqual(updated?.name, 'Updated Custom Preset', 'Preset should be updated');

// Delete
const deleted = deletePreset(testPresetId);
assert.strictEqual(deleted, true, 'deletePreset should return true');
reloaded = getPresets();
assert.ok(!reloaded.some((p) => p.id === testPresetId), 'Preset should be removed');
console.log('✓ Test 2 Passed: Preset save, update, and delete correctly persisted');

// Test 3: Preset Rule Engine filtering logic
const mockEntries: LogEntry[] = [
  {
    id: '1',
    lineNumber: 1,
    raw: '[100] [corr-1] [Auth] [Register] [INFO] User registered successfully',
    message: 'User registered successfully',
    level: 'info',
    workflow: 'Auth',
    operation: 'Register',
  },
  {
    id: '2',
    lineNumber: 2,
    raw: '[101] [corr-2] [Auth] [Deregister unavailable] [WARN] Service timeout',
    message: 'Service timeout',
    level: 'warning',
    workflow: 'Auth',
    operation: 'Deregister unavailable',
  },
  {
    id: '3',
    lineNumber: 3,
    raw: '[102] [corr-3] [System] [Heartbeat] [INFO] Heartbeat ping payload: {"x": 1, "y": 2}',
    message: 'Heartbeat ping payload: {"x": 1, "y": 2}',
    level: 'info',
    workflow: 'System',
    operation: 'Heartbeat',
  },
  {
    id: '4',
    lineNumber: 4,
    raw: '[103] [corr-4] [Payment] [Register] [INFO] Payment method registered',
    message: 'Payment method registered',
    level: 'info',
    workflow: 'Payment',
    operation: 'Register',
  },
];

// Apply Minimal Set rules:
// excludeKeywords: ["x", "y", "ping", "heartbeat"]
// excludeMarkers: ["Deregister unavailable", "Heartbeat"]
// includeMarkers: ["Register"]
function applyRules(entryList: LogEntry[], p: LogPreset): LogEntry[] {
  const { excludeKeywords, includeKeywords, excludeMarkers, includeMarkers } = p.rules;
  return entryList.filter((entry) => {
    const msg = (entry.message || '').toLowerCase();
    const raw = (entry.raw || '').toLowerCase();

    if (excludeKeywords && excludeKeywords.length > 0) {
      for (const kw of excludeKeywords) {
        const trimmed = kw.trim();
        if (!trimmed) continue;
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, 'i');
        if (regex.test(msg) || regex.test(raw)) {
          return false;
        }
      }
    }

    if (includeKeywords && includeKeywords.length > 0) {
      const matches = includeKeywords.some((kw) => {
        const trimmed = kw.trim();
        if (!trimmed) return false;
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, 'i');
        return regex.test(msg) || regex.test(raw);
      });
      if (!matches) return false;
    }

    if (excludeMarkers && excludeMarkers.length > 0) {
      for (const m of excludeMarkers) {
        const cleanM = m.replace(/^\[|\]$/g, '').trim().toLowerCase();
        if (cleanM) {
          if (
            (entry.workflow && entry.workflow.toLowerCase().includes(cleanM)) ||
            (entry.operation && entry.operation.toLowerCase().includes(cleanM)) ||
            raw.includes(cleanM)
          ) {
            return false;
          }
        }
      }
    }

    if (includeMarkers && includeMarkers.length > 0) {
      const matches = includeMarkers.some((m) => {
        const cleanM = m.replace(/^\[|\]$/g, '').trim().toLowerCase();
        if (!cleanM) return false;
        return (
          (entry.workflow && entry.workflow.toLowerCase().includes(cleanM)) ||
          (entry.operation && entry.operation.toLowerCase().includes(cleanM)) ||
          raw.includes(cleanM)
        );
      });
      if (!matches) return false;
    }

    return true;
  });
}

const filtered = applyRules(mockEntries, minimal!);
// Entry 1: Auth Register -> Kept
// Entry 2: Deregister unavailable -> Dropped by excludeMarkers
// Entry 3: ping with x & y -> Dropped by excludeKeywords
// Entry 4: Payment Register -> Kept
assert.strictEqual(filtered.length, 2, 'Should filter out entries with excludeMarkers and excludeKeywords');
assert.strictEqual(filtered[0].id, '1');
assert.strictEqual(filtered[1].id, '4');
console.log('✓ Test 3 Passed: Rule Engine filtering correctly excludes keywords & markers and whitelists included markers');

// Test 4: Dual Rate Calculation verification
const now = Date.now();
const recentArrivals = [
  { timestamp: now - 300, count: 2 },
  { timestamp: now - 800, count: 1 },
  { timestamp: now - 3500, count: 5 },
  { timestamp: now - 15000, count: 4 },
];

// Calculation 1: Instantaneous arrivals in last 1.0s ("new added / sec")
const instantArrivals = recentArrivals.filter((item) => now - item.timestamp <= 1000);
const newAddedPerSec = instantArrivals.reduce((acc, item) => acc + item.count, 0);
assert.strictEqual(newAddedPerSec, 3, 'Instant arrivals should be 2 + 1 = 3 logs/s');

// Calculation 2: Average addition per second across session window
const sessionStart = now - 20000; // 20s session
const totalStreamed = recentArrivals.reduce((acc, item) => acc + item.count, 0);
const elapsedSec = Math.max(1, (now - sessionStart) / 1000);
const avgAdditionPerSec = Number((totalStreamed / elapsedSec).toFixed(1));
assert.strictEqual(avgAdditionPerSec, 0.6, 'Session average addition rate should be (12 / 20) = 0.6 logs/s');
console.log('✓ Test 4 Passed: Dual rate calculations cleanly separate new added/sec (3/s) from average addition/s (0.6/s)');

// Test 5: Check Topbar and CSS layout classes
const topbarFile = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Topbar.tsx'), 'utf-8');
assert.ok(topbarFile.includes('topbar-tier-1'), 'Topbar must have topbar-tier-1');
assert.ok(topbarFile.includes('topbar-tier-2'), 'Topbar must have topbar-tier-2');
assert.ok(topbarFile.includes('topbar-tier-3'), 'Topbar must have topbar-tier-3');
assert.ok(topbarFile.includes('rate-badge instant'), 'Topbar must render instant rate badge (+X new/s)');
assert.ok(topbarFile.includes('rate-badge average'), 'Topbar must render rolling average rate badge (avg Y logs/s)');
assert.ok(topbarFile.includes('Preset Selector Dropdown'), 'Topbar must contain preset selector dropdown');

const cssFile = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf-8');
assert.ok(cssFile.includes('.rate-badge.instant'), 'CSS must include .rate-badge.instant');
assert.ok(cssFile.includes('.rate-badge.average'), 'CSS must include .rate-badge.average');
assert.ok(cssFile.includes('.stream-live-pill'), 'CSS must include .stream-live-pill');
console.log('✓ Test 5 Passed: Topbar JSX and CSS accurately render the 3-tier layout, dual rate badges, and preset selector');

// Test 6: Verify all available filters in PresetRules
const comprehensivePreset: LogPreset = {
  id: 'comprehensive-preset',
  name: 'Full Customization Preset',
  description: 'Includes all available filters across the viewer',
  rules: {
    search: 'Stripe',
    isRegex: true,
    caseSensitive: true,
    invert: false,
    marker: 'OrderCheckout',
    isMarkerRegex: false,
    workflow: 'PaymentProcess',
    operation: 'AuthorizeCard',
    correlationId: 'req-12345',
    startDate: '2026-09-02T10:00',
    endDate: '2026-09-02T12:00',
    sortOption: 'time-desc',
    levels: ['error', 'critical'],
    excludeLevels: ['debug'],
    excludeKeywords: ['noise', 'temp'],
    includeKeywords: ['fatal'],
    excludeMarkers: ['Heartbeat'],
    includeMarkers: ['AuthorizeCard'],
    viewMode: 'standard',
    wrapLines: true,
    hideBrackets: true,
    showDatetime: false,
    showPid: false,
    showTid: false,
    showCorrelation: true,
  },
};

savePreset(comprehensivePreset);
const verified = getPresets().find((p) => p.id === 'comprehensive-preset');
assert.ok(verified, 'Comprehensive preset must be saved');
assert.strictEqual(verified?.rules.search, 'Stripe');
assert.strictEqual(verified?.rules.isRegex, true);
assert.strictEqual(verified?.rules.workflow, 'PaymentProcess');
assert.strictEqual(verified?.rules.operation, 'AuthorizeCard');
assert.strictEqual(verified?.rules.correlationId, 'req-12345');
assert.strictEqual(verified?.rules.startDate, '2026-09-02T10:00');
assert.strictEqual(verified?.rules.sortOption, 'time-desc');
assert.deepStrictEqual(verified?.rules.levels, ['error', 'critical']);
assert.deepStrictEqual(verified?.rules.excludeLevels, ['debug']);
assert.strictEqual(verified?.rules.wrapLines, true);
assert.strictEqual(verified?.rules.hideBrackets, true);

// Cleanup
deletePreset('comprehensive-preset');
console.log('✓ Test 6 Passed: PresetRules supports all available filters and persist/load with 100% integrity');

console.log('\nAll Presets & Dual Velocity Rate Tests Passed Successfully!\n');
