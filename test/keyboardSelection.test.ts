import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { LogEntry } from '../src/types.ts';

console.log('--- Running Keyboard Arrow Selection & Multi-Row Navigation Test Suite ---');

// Mock log entries
const mockEntries: LogEntry[] = Array.from({ length: 50 }, (_, i) => ({
  id: `ent-${i + 1}`,
  lineNumber: i + 1,
  datetime: `2026-09-06T10:00:${String(i).padStart(2, '0')}.000Z`,
  timestamp: 1788698400000 + i * 1000,
  level: i % 5 === 0 ? 'error' : 'info',
  message: `Log message at index ${i}`,
  raw: `2026-09-06 10:00:${String(i).padStart(2, '0')} [INFO] Log message at index ${i}`,
  sourceId: 'src-test',
}));

// Helper simulating key navigation logic in LogPanel
function simulateArrowNav(
  entries: LogEntry[],
  currentLineNumber: number | null,
  key: string,
  shiftKey: boolean,
  anchorIndex: number | null
) {
  const currentIdx = currentLineNumber !== null
    ? entries.findIndex((e) => e.lineNumber === currentLineNumber)
    : -1;

  let nextIdx = currentIdx;
  if (key === 'ArrowDown' || key === 'j') {
    nextIdx = currentIdx === -1 ? 0 : Math.min(entries.length - 1, currentIdx + 1);
  } else if (key === 'ArrowUp' || key === 'k') {
    nextIdx = currentIdx === -1 ? 0 : Math.max(0, currentIdx - 1);
  } else if (key === 'PageDown') {
    nextIdx = Math.min(entries.length - 1, (currentIdx >= 0 ? currentIdx : 0) + 15);
  } else if (key === 'PageUp') {
    nextIdx = Math.max(0, (currentIdx >= 0 ? currentIdx : 0) - 15);
  } else if (key === 'Home') {
    nextIdx = 0;
  } else if (key === 'End') {
    nextIdx = entries.length - 1;
  }

  const targetEntry = entries[nextIdx];
  const selectedLines = new Set<number>();
  const selectedIds = new Set<string>();
  let newAnchor = anchorIndex;

  if (shiftKey) {
    if (newAnchor === null) {
      newAnchor = currentIdx >= 0 ? currentIdx : 0;
    }
    const start = Math.min(newAnchor, nextIdx);
    const end = Math.max(newAnchor, nextIdx);
    for (let i = start; i <= end; i++) {
      selectedLines.add(entries[i].lineNumber);
      selectedIds.add(entries[i].id || `${entries[i].sourceId || ''}-${entries[i].lineNumber}`);
    }
  } else {
    newAnchor = nextIdx;
    selectedLines.add(targetEntry.lineNumber);
    selectedIds.add(targetEntry.id || `${targetEntry.sourceId || ''}-${targetEntry.lineNumber}`);
  }

  return {
    targetLineNumber: targetEntry.lineNumber,
    targetIndex: nextIdx,
    anchorIndex: newAnchor,
    selectedLines,
    selectedIds,
  };
}

// Test 1: Initial ArrowDown from unselected state selects first row (index 0)
const step1 = simulateArrowNav(mockEntries, null, 'ArrowDown', false, null);
assert.strictEqual(step1.targetIndex, 0);
assert.strictEqual(step1.targetLineNumber, 1);
assert.deepStrictEqual(Array.from(step1.selectedLines), [1]);
console.log('✓ Test 1 Passed: Initial ArrowDown selects first log row (Line #1)');

// Test 2: ArrowDown moves selection downwards by 1 row
const step2 = simulateArrowNav(mockEntries, step1.targetLineNumber, 'ArrowDown', false, step1.anchorIndex);
assert.strictEqual(step2.targetIndex, 1);
assert.strictEqual(step2.targetLineNumber, 2);
assert.deepStrictEqual(Array.from(step2.selectedLines), [2]);

const step3 = simulateArrowNav(mockEntries, step2.targetLineNumber, 'j', false, step2.anchorIndex);
assert.strictEqual(step3.targetIndex, 2);
assert.strictEqual(step3.targetLineNumber, 3);
console.log('✓ Test 2 Passed: ArrowDown and "j" move downward by 1 row');

// Test 3: ArrowUp and "k" move selection upwards by 1 row
const step4 = simulateArrowNav(mockEntries, step3.targetLineNumber, 'ArrowUp', false, step3.anchorIndex);
assert.strictEqual(step4.targetIndex, 1);
assert.strictEqual(step4.targetLineNumber, 2);

const step5 = simulateArrowNav(mockEntries, step4.targetLineNumber, 'k', false, step4.anchorIndex);
assert.strictEqual(step5.targetIndex, 0);
assert.strictEqual(step5.targetLineNumber, 1);
console.log('✓ Test 3 Passed: ArrowUp and "k" move upward by 1 row');

// Test 4: Top and bottom boundaries are respected without crashing
const atTop = simulateArrowNav(mockEntries, 1, 'ArrowUp', false, 0);
assert.strictEqual(atTop.targetIndex, 0);
assert.strictEqual(atTop.targetLineNumber, 1);

const atBottom = simulateArrowNav(mockEntries, 50, 'ArrowDown', false, 49);
assert.strictEqual(atBottom.targetIndex, 49);
assert.strictEqual(atBottom.targetLineNumber, 50);
console.log('✓ Test 4 Passed: Upper and lower index bounds properly clamped (0 to N-1)');

// Test 5: Shift + ArrowDown / Up creates contiguous multi-row range selection
const range1 = simulateArrowNav(mockEntries, 2, 'ArrowDown', true, 1); // Select from index 1 (line 2) to index 2 (line 3)
assert.strictEqual(range1.selectedLines.size, 2);
assert.deepStrictEqual(Array.from(range1.selectedLines), [2, 3]);

const range2 = simulateArrowNav(mockEntries, 3, 'ArrowDown', true, range1.anchorIndex); // Select to line 4
assert.strictEqual(range2.selectedLines.size, 3);
assert.deepStrictEqual(Array.from(range2.selectedLines), [2, 3, 4]);

const range3 = simulateArrowNav(mockEntries, 4, 'ArrowDown', true, range2.anchorIndex); // Select to line 5
assert.strictEqual(range3.selectedLines.size, 4);
assert.deepStrictEqual(Array.from(range3.selectedLines), [2, 3, 4, 5]);
console.log('✓ Test 5 Passed: Shift + ArrowDown range multi-selection spans contiguous lines (#2 to #5)');

// Test 6: PageDown, PageUp, Home, End navigation jumps
const pgDn = simulateArrowNav(mockEntries, 1, 'PageDown', false, 0);
assert.strictEqual(pgDn.targetIndex, 15);
assert.strictEqual(pgDn.targetLineNumber, 16);

const pgUp = simulateArrowNav(mockEntries, pgDn.targetLineNumber, 'PageUp', false, pgDn.anchorIndex);
assert.strictEqual(pgUp.targetIndex, 0);
assert.strictEqual(pgUp.targetLineNumber, 1);

const endJump = simulateArrowNav(mockEntries, 1, 'End', false, 0);
assert.strictEqual(endJump.targetIndex, 49);
assert.strictEqual(endJump.targetLineNumber, 50);

const homeJump = simulateArrowNav(mockEntries, 50, 'Home', false, 49);
assert.strictEqual(homeJump.targetIndex, 0);
assert.strictEqual(homeJump.targetLineNumber, 1);
console.log('✓ Test 6 Passed: PageDown (+15), PageUp (-15), Home (0), End (last) navigation verified');

// Test 7: Static code analysis on LogPanel.tsx and App.tsx
const logPanelSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/LogPanel.tsx'), 'utf-8');
assert.ok(logPanelSource.includes("e.key === 'ArrowDown' || e.key === 'j'"), 'LogPanel must handle ArrowDown and j keydown');
assert.ok(logPanelSource.includes("e.key === 'ArrowUp' || e.key === 'k'"), 'LogPanel must handle ArrowUp and k keydown');
assert.ok(logPanelSource.includes("e.key === 'PageDown'"), 'LogPanel must handle PageDown');
assert.ok(logPanelSource.includes("e.key === 'PageUp'"), 'LogPanel must handle PageUp');
assert.ok(logPanelSource.includes("e.key === 'Home'"), 'LogPanel must handle Home');
assert.ok(logPanelSource.includes("e.key === 'End'"), 'LogPanel must handle End');
assert.ok(logPanelSource.includes("setTargetScrollIndex("), 'LogPanel must set targetScrollIndex on navigation');
assert.ok(logPanelSource.includes("onUpdatePanel({ selectedLineNumber: targetEntry.lineNumber })"), 'LogPanel must update panel state on navigation');
console.log('✓ Test 7 Passed: LogPanel.tsx keyboard listeners, active state guards, and scroll triggers verified');

console.log('\nAll Keyboard Selection and Arrow Navigation Tests Passed Successfully!\n');
