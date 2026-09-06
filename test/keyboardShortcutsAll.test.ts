import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { LogEntry } from '../src/types.ts';

console.log('========================================================================');
console.log('🚀 Running Complete Keyboard Shortcuts & Multi-Selection Test Suite');
console.log('========================================================================\n');

// 1. Setup Mock Log Data (100 log entries with diverse levels, timestamps and messages)
const mockEntries: LogEntry[] = Array.from({ length: 100 }, (_, i) => ({
  id: `ent-${i + 1}`,
  lineNumber: i + 1,
  datetime: `2026-09-06T10:00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000Z`,
  timestamp: 1788698400000 + i * 1000,
  level: i % 10 === 0 ? 'error' : i % 5 === 0 ? 'warning' : 'info',
  message: `Operational service event payload line ${i + 1}`,
  raw: `2026-09-06 10:00:${String(i % 60).padStart(2, '0')} [INFO] Operational service event payload line ${i + 1}`,
  sourceId: 'src-alpha',
}));

// ========================================================================
// Section A: Multi-Selection & Navigation State Engine Simulation
// ========================================================================

interface NavState {
  selectedLineNumber: number | null;
  selectedEntryId: string | null;
  selectedLineNumbers: Set<number>;
  selectedEntryIds: Set<string>;
  selectionAnchorIndex: number | null;
  targetScrollIndex: number | null;
}

function createInitialState(): NavState {
  return {
    selectedLineNumber: null,
    selectedEntryId: null,
    selectedLineNumbers: new Set<number>(),
    selectedEntryIds: new Set<string>(),
    selectionAnchorIndex: null,
    targetScrollIndex: null,
  };
}

function processKeydown(state: NavState, entries: LogEntry[], event: {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): NavState {
  const nextState: NavState = {
    selectedLineNumber: state.selectedLineNumber,
    selectedEntryId: state.selectedEntryId,
    selectedLineNumbers: new Set(state.selectedLineNumbers),
    selectedEntryIds: new Set(state.selectedEntryIds),
    selectionAnchorIndex: state.selectionAnchorIndex,
    targetScrollIndex: state.targetScrollIndex,
  };

  const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
  const isShiftOnly = event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;

  // 1. Ctrl+A / Cmd+A: Select All Visible Logs
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && (event.key === 'a' || event.key === 'A')) {
    if (entries.length > 0) {
      const allLines = new Set<number>();
      const allIds = new Set<string>();
      for (const it of entries) {
        allLines.add(it.lineNumber);
        allIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
      }
      nextState.selectedLineNumbers = allLines;
      nextState.selectedEntryIds = allIds;
      nextState.selectionAnchorIndex = 0;
      nextState.selectedLineNumber = entries[0].lineNumber;
      nextState.selectedEntryId = entries[0].id || `${entries[0].sourceId || ''}-${entries[0].lineNumber}`;
      return nextState;
    }
  }

  // 2. Escape: Clear selection
  if (!hasModifier && event.key === 'Escape') {
    nextState.selectedLineNumber = null;
    nextState.selectedEntryId = null;
    nextState.selectedLineNumbers = new Set();
    nextState.selectedEntryIds = new Set();
    nextState.selectionAnchorIndex = null;
    return nextState;
  }

  // Determine current index
  let currentIdx = -1;
  if (state.selectedEntryId) {
    currentIdx = entries.findIndex((e) => (e.id || `${e.sourceId || ''}-${e.lineNumber}`) === state.selectedEntryId);
  }
  if (currentIdx === -1 && state.selectedLineNumber !== null) {
    currentIdx = entries.findIndex((e) => e.lineNumber === state.selectedLineNumber);
  }
  if (currentIdx === -1 && state.selectionAnchorIndex !== null) {
    currentIdx = state.selectionAnchorIndex;
  }

  // 3. ArrowDown / j / J
  if ((!hasModifier || isShiftOnly) && (event.key === 'ArrowDown' || event.key === 'j' || event.key === 'J')) {
    if (entries.length === 0) return nextState;
    const nextIdx = currentIdx === -1 ? 0 : Math.min(entries.length - 1, currentIdx + 1);
    const targetEntry = entries[nextIdx];
    const entryKey = targetEntry.id || `${targetEntry.sourceId || ''}-${targetEntry.lineNumber}`;
    nextState.selectedLineNumber = targetEntry.lineNumber;
    nextState.selectedEntryId = entryKey;
    nextState.targetScrollIndex = nextIdx;

    if (event.shiftKey) {
      if (nextState.selectionAnchorIndex === null) {
        nextState.selectionAnchorIndex = currentIdx >= 0 ? currentIdx : 0;
      }
      const start = Math.min(nextState.selectionAnchorIndex, nextIdx);
      const end = Math.max(nextState.selectionAnchorIndex, nextIdx);
      const newEntryIds = new Set<string>();
      const newLines = new Set<number>();
      for (let i = start; i <= end; i++) {
        const it = entries[i];
        newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
        newLines.add(it.lineNumber);
      }
      nextState.selectedEntryIds = newEntryIds;
      nextState.selectedLineNumbers = newLines;
    } else {
      nextState.selectionAnchorIndex = nextIdx;
      nextState.selectedEntryIds = new Set([entryKey]);
      nextState.selectedLineNumbers = new Set([targetEntry.lineNumber]);
    }
    return nextState;
  }

  // 4. ArrowUp / k / K
  if ((!hasModifier || isShiftOnly) && (event.key === 'ArrowUp' || event.key === 'k' || event.key === 'K')) {
    if (entries.length === 0) return nextState;
    const prevIdx = currentIdx === -1 ? 0 : Math.max(0, currentIdx - 1);
    const targetEntry = entries[prevIdx];
    const entryKey = targetEntry.id || `${targetEntry.sourceId || ''}-${targetEntry.lineNumber}`;
    nextState.selectedLineNumber = targetEntry.lineNumber;
    nextState.selectedEntryId = entryKey;
    nextState.targetScrollIndex = prevIdx;

    if (event.shiftKey) {
      if (nextState.selectionAnchorIndex === null) {
        nextState.selectionAnchorIndex = currentIdx >= 0 ? currentIdx : 0;
      }
      const start = Math.min(nextState.selectionAnchorIndex, prevIdx);
      const end = Math.max(nextState.selectionAnchorIndex, prevIdx);
      const newEntryIds = new Set<string>();
      const newLines = new Set<number>();
      for (let i = start; i <= end; i++) {
        const it = entries[i];
        newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
        newLines.add(it.lineNumber);
      }
      nextState.selectedEntryIds = newEntryIds;
      nextState.selectedLineNumbers = newLines;
    } else {
      nextState.selectionAnchorIndex = prevIdx;
      nextState.selectedEntryIds = new Set([entryKey]);
      nextState.selectedLineNumbers = new Set([targetEntry.lineNumber]);
    }
    return nextState;
  }

  // 5. PageDown (+15)
  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'PageDown') {
    if (entries.length === 0) return nextState;
    const nextIdx = Math.min(entries.length - 1, (currentIdx >= 0 ? currentIdx : 0) + 15);
    const targetEntry = entries[nextIdx];
    const entryKey = targetEntry.id || `${targetEntry.sourceId || ''}-${targetEntry.lineNumber}`;
    nextState.selectedLineNumber = targetEntry.lineNumber;
    nextState.selectedEntryId = entryKey;
    nextState.targetScrollIndex = nextIdx;

    if (event.shiftKey) {
      if (nextState.selectionAnchorIndex === null) {
        nextState.selectionAnchorIndex = currentIdx >= 0 ? currentIdx : 0;
      }
      const start = Math.min(nextState.selectionAnchorIndex, nextIdx);
      const end = Math.max(nextState.selectionAnchorIndex, nextIdx);
      const newEntryIds = new Set<string>();
      const newLines = new Set<number>();
      for (let i = start; i <= end; i++) {
        const it = entries[i];
        newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
        newLines.add(it.lineNumber);
      }
      nextState.selectedEntryIds = newEntryIds;
      nextState.selectedLineNumbers = newLines;
    } else {
      nextState.selectionAnchorIndex = nextIdx;
      nextState.selectedEntryIds = new Set([entryKey]);
      nextState.selectedLineNumbers = new Set([targetEntry.lineNumber]);
    }
    return nextState;
  }

  // 6. PageUp (-15)
  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'PageUp') {
    if (entries.length === 0) return nextState;
    const prevIdx = Math.max(0, (currentIdx >= 0 ? currentIdx : 0) - 15);
    const targetEntry = entries[prevIdx];
    const entryKey = targetEntry.id || `${targetEntry.sourceId || ''}-${targetEntry.lineNumber}`;
    nextState.selectedLineNumber = targetEntry.lineNumber;
    nextState.selectedEntryId = entryKey;
    nextState.targetScrollIndex = prevIdx;

    if (event.shiftKey) {
      if (nextState.selectionAnchorIndex === null) {
        nextState.selectionAnchorIndex = currentIdx >= 0 ? currentIdx : 0;
      }
      const start = Math.min(nextState.selectionAnchorIndex, prevIdx);
      const end = Math.max(nextState.selectionAnchorIndex, prevIdx);
      const newEntryIds = new Set<string>();
      const newLines = new Set<number>();
      for (let i = start; i <= end; i++) {
        const it = entries[i];
        newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
        newLines.add(it.lineNumber);
      }
      nextState.selectedEntryIds = newEntryIds;
      nextState.selectedLineNumbers = newLines;
    } else {
      nextState.selectionAnchorIndex = prevIdx;
      nextState.selectedEntryIds = new Set([entryKey]);
      nextState.selectedLineNumbers = new Set([targetEntry.lineNumber]);
    }
    return nextState;
  }

  // 7. Home (index 0)
  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'Home') {
    if (entries.length === 0) return nextState;
    const targetEntry = entries[0];
    const entryKey = targetEntry.id || `${targetEntry.sourceId || ''}-${targetEntry.lineNumber}`;
    nextState.selectedLineNumber = targetEntry.lineNumber;
    nextState.selectedEntryId = entryKey;
    nextState.targetScrollIndex = 0;

    if (event.shiftKey) {
      if (nextState.selectionAnchorIndex === null) {
        nextState.selectionAnchorIndex = currentIdx >= 0 ? currentIdx : 0;
      }
      const start = 0;
      const end = Math.max(nextState.selectionAnchorIndex, 0);
      const newEntryIds = new Set<string>();
      const newLines = new Set<number>();
      for (let i = start; i <= end; i++) {
        const it = entries[i];
        newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
        newLines.add(it.lineNumber);
      }
      nextState.selectedEntryIds = newEntryIds;
      nextState.selectedLineNumbers = newLines;
    } else {
      nextState.selectionAnchorIndex = 0;
      nextState.selectedEntryIds = new Set([entryKey]);
      nextState.selectedLineNumbers = new Set([targetEntry.lineNumber]);
    }
    return nextState;
  }

  // 8. End (last index)
  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'End') {
    if (entries.length === 0) return nextState;
    const lastIdx = entries.length - 1;
    const targetEntry = entries[lastIdx];
    const entryKey = targetEntry.id || `${targetEntry.sourceId || ''}-${targetEntry.lineNumber}`;
    nextState.selectedLineNumber = targetEntry.lineNumber;
    nextState.selectedEntryId = entryKey;
    nextState.targetScrollIndex = lastIdx;

    if (event.shiftKey) {
      if (nextState.selectionAnchorIndex === null) {
        nextState.selectionAnchorIndex = currentIdx >= 0 ? currentIdx : 0;
      }
      const start = Math.min(nextState.selectionAnchorIndex, lastIdx);
      const end = lastIdx;
      const newEntryIds = new Set<string>();
      const newLines = new Set<number>();
      for (let i = start; i <= end; i++) {
        const it = entries[i];
        newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
        newLines.add(it.lineNumber);
      }
      nextState.selectedEntryIds = newEntryIds;
      nextState.selectedLineNumbers = newLines;
    } else {
      nextState.selectionAnchorIndex = lastIdx;
      nextState.selectedEntryIds = new Set([entryKey]);
      nextState.selectedLineNumbers = new Set([targetEntry.lineNumber]);
    }
    return nextState;
  }

  return nextState;
}

// Helper simulating mouse click selection (with Shift / Ctrl / Normal)
function processRowClick(
  state: NavState,
  entries: LogEntry[],
  line: number,
  isShift: boolean,
  isCtrlOrMeta: boolean
): NavState {
  const nextState: NavState = {
    selectedLineNumber: state.selectedLineNumber,
    selectedEntryId: state.selectedEntryId,
    selectedLineNumbers: new Set(state.selectedLineNumbers),
    selectedEntryIds: new Set(state.selectedEntryIds),
    selectionAnchorIndex: state.selectionAnchorIndex,
    targetScrollIndex: state.targetScrollIndex,
  };

  const clickedIdx = entries.findIndex((e) => e.lineNumber === line);
  if (clickedIdx === -1) return nextState;

  const target = entries[clickedIdx];
  const entryKey = target.id || `${target.sourceId || ''}-${target.lineNumber}`;
  nextState.targetScrollIndex = clickedIdx;

  if (isShift) {
    if (nextState.selectionAnchorIndex === null) {
      nextState.selectionAnchorIndex = clickedIdx;
    }
    const start = Math.min(nextState.selectionAnchorIndex, clickedIdx);
    const end = Math.max(nextState.selectionAnchorIndex, clickedIdx);
    const newEntryIds = new Set<string>();
    const newLines = new Set<number>();
    for (let i = start; i <= end; i++) {
      const it = entries[i];
      newEntryIds.add(it.id || `${it.sourceId || ''}-${it.lineNumber}`);
      newLines.add(it.lineNumber);
    }
    nextState.selectedEntryIds = newEntryIds;
    nextState.selectedLineNumbers = newLines;
    nextState.selectedEntryId = entryKey;
    nextState.selectedLineNumber = line;
  } else if (isCtrlOrMeta) {
    const newEntryIds = new Set(nextState.selectedEntryIds);
    const newLines = new Set(nextState.selectedLineNumbers);
    if (newEntryIds.has(entryKey) || newLines.has(line)) {
      newEntryIds.delete(entryKey);
      newLines.delete(line);
      if (newLines.size === 0) {
        nextState.selectedEntryId = null;
        nextState.selectionAnchorIndex = null;
        nextState.selectedLineNumber = null;
      } else {
        const remainingLine = Array.from(newLines)[newLines.size - 1];
        nextState.selectedEntryId = Array.from(newEntryIds)[newEntryIds.size - 1];
        nextState.selectedLineNumber = remainingLine;
      }
    } else {
      newEntryIds.add(entryKey);
      newLines.add(line);
      nextState.selectedEntryId = entryKey;
      nextState.selectionAnchorIndex = clickedIdx;
      nextState.selectedLineNumber = line;
    }
    nextState.selectedEntryIds = newEntryIds;
    nextState.selectedLineNumbers = newLines;
  } else {
    nextState.selectionAnchorIndex = clickedIdx;
    nextState.selectedEntryIds = new Set([entryKey]);
    nextState.selectedLineNumbers = new Set([line]);
    nextState.selectedEntryId = entryKey;
    nextState.selectedLineNumber = line;
  }

  return nextState;
}

// ========================================================================
// TEST 1: ArrowDown, 'j', and 'J' step navigation
// ========================================================================
console.log('Testing Navigation Shortcuts (ArrowDown / ArrowUp / j / k)...');
let state = createInitialState();

// First ArrowDown from unselected state selects index 0 (line 1)
state = processKeydown(state, mockEntries, { key: 'ArrowDown' });
assert.strictEqual(state.selectedLineNumber, 1);
assert.strictEqual(state.selectedLineNumbers.size, 1);
assert.ok(state.selectedLineNumbers.has(1));

// 'j' moves down to line 2
state = processKeydown(state, mockEntries, { key: 'j' });
assert.strictEqual(state.selectedLineNumber, 2);
assert.ok(state.selectedLineNumbers.has(2));

// 'J' moves down to line 3 (case-insensitivity)
state = processKeydown(state, mockEntries, { key: 'J' });
assert.strictEqual(state.selectedLineNumber, 3);
assert.ok(state.selectedLineNumbers.has(3));

// ArrowUp moves up to line 2
state = processKeydown(state, mockEntries, { key: 'ArrowUp' });
assert.strictEqual(state.selectedLineNumber, 2);

// 'k' moves up to line 1
state = processKeydown(state, mockEntries, { key: 'k' });
assert.strictEqual(state.selectedLineNumber, 1);

// 'K' at index 0 stays clamped at line 1
state = processKeydown(state, mockEntries, { key: 'K' });
assert.strictEqual(state.selectedLineNumber, 1);
console.log('✓ Navigation step shortcuts (ArrowDown, ArrowUp, j, J, k, K) verified');

// ========================================================================
// TEST 2: Multi-Row Range Selection via Shift + Arrows & Shift + j/k
// ========================================================================
console.log('Testing Shift-Range Multi-Selection (Shift+ArrowDown, Shift+j, Shift+k)...');
state = processRowClick(state, mockEntries, 5, false, false); // Select line 5 as anchor
assert.strictEqual(state.selectionAnchorIndex, 4);
assert.strictEqual(state.selectedLineNumber, 5);

// Shift + ArrowDown expands to line 6 (now lines 5, 6 selected)
state = processKeydown(state, mockEntries, { key: 'ArrowDown', shiftKey: true });
assert.strictEqual(state.selectedLineNumbers.size, 2);
assert.deepStrictEqual(Array.from(state.selectedLineNumbers), [5, 6]);

// Shift + j expands to line 7 (lines 5, 6, 7 selected)
state = processKeydown(state, mockEntries, { key: 'j', shiftKey: true });
assert.strictEqual(state.selectedLineNumbers.size, 3);
assert.deepStrictEqual(Array.from(state.selectedLineNumbers), [5, 6, 7]);

// Shift + J expands to line 8 (lines 5, 6, 7, 8 selected)
state = processKeydown(state, mockEntries, { key: 'J', shiftKey: true });
assert.strictEqual(state.selectedLineNumbers.size, 4);
assert.deepStrictEqual(Array.from(state.selectedLineNumbers), [5, 6, 7, 8]);

// Shift + k shrinks selection back to line 7
state = processKeydown(state, mockEntries, { key: 'k', shiftKey: true });
assert.strictEqual(state.selectedLineNumbers.size, 3);
assert.deepStrictEqual(Array.from(state.selectedLineNumbers), [5, 6, 7]);

// Shift + ArrowUp twice expands above anchor to line 3 (lines 3, 4, 5 selected)
state = processKeydown(state, mockEntries, { key: 'ArrowUp', shiftKey: true }); // to line 6
state = processKeydown(state, mockEntries, { key: 'ArrowUp', shiftKey: true }); // to line 5 (only line 5)
state = processKeydown(state, mockEntries, { key: 'ArrowUp', shiftKey: true }); // to line 4 (lines 4, 5)
assert.strictEqual(state.selectedLineNumbers.size, 2);
assert.deepStrictEqual(Array.from(state.selectedLineNumbers), [4, 5]);

state = processKeydown(state, mockEntries, { key: 'ArrowUp', shiftKey: true }); // to line 3 (lines 3, 4, 5)
assert.strictEqual(state.selectedLineNumbers.size, 3);
assert.deepStrictEqual(Array.from(state.selectedLineNumbers), [3, 4, 5]);
console.log('✓ Shift-range multi-selection bi-directional expansion and contraction verified');

// ========================================================================
// TEST 3: Mouse Multi-Selection (Shift+Click and Ctrl/Cmd+Click toggling)
// ========================================================================
console.log('Testing Mouse Multi-Selection (Shift+Click range & Ctrl+Click toggles)...');
state = createInitialState();

// 1. Normal click on line 10
state = processRowClick(state, mockEntries, 10, false, false);
assert.strictEqual(state.selectedLineNumbers.size, 1);
assert.ok(state.selectedLineNumbers.has(10));
assert.strictEqual(state.selectionAnchorIndex, 9);

// 2. Shift+Click on line 15 -> selects lines 10 to 15 (6 lines)
state = processRowClick(state, mockEntries, 15, true, false);
assert.strictEqual(state.selectedLineNumbers.size, 6);
assert.deepStrictEqual(Array.from(state.selectedLineNumbers), [10, 11, 12, 13, 14, 15]);

// 3. Ctrl+Click on line 20 -> adds line 20 (now 7 lines selected)
state = processRowClick(state, mockEntries, 20, false, true);
assert.strictEqual(state.selectedLineNumbers.size, 7);
assert.ok(state.selectedLineNumbers.has(20));

// 4. Ctrl+Click on line 12 -> deselects line 12 (now 6 lines selected)
state = processRowClick(state, mockEntries, 12, false, true);
assert.strictEqual(state.selectedLineNumbers.size, 6);
assert.strictEqual(state.selectedLineNumbers.has(12), false);
assert.ok(state.selectedLineNumbers.has(10));
assert.ok(state.selectedLineNumbers.has(11));
assert.ok(state.selectedLineNumbers.has(13));
assert.ok(state.selectedLineNumbers.has(14));
assert.ok(state.selectedLineNumbers.has(15));
assert.ok(state.selectedLineNumbers.has(20));
console.log('✓ Mouse Shift+Click ranges and Ctrl/Cmd+Click item toggling verified');

// ========================================================================
// TEST 4: Select All (Ctrl+A / Cmd+A) & Clear (Escape)
// ========================================================================
console.log('Testing Select All (Ctrl+A / Cmd+A) and Deselect (Escape)...');
state = processKeydown(state, mockEntries, { key: 'a', ctrlKey: true });
assert.strictEqual(state.selectedLineNumbers.size, 100);
assert.strictEqual(state.selectedEntryIds.size, 100);
assert.strictEqual(state.selectionAnchorIndex, 0);

// Escape clears all
state = processKeydown(state, mockEntries, { key: 'Escape' });
assert.strictEqual(state.selectedLineNumbers.size, 0);
assert.strictEqual(state.selectedEntryIds.size, 0);
assert.strictEqual(state.selectedLineNumber, null);
assert.strictEqual(state.selectionAnchorIndex, null);

// Cmd+A on Mac behaves identically
state = processKeydown(state, mockEntries, { key: 'A', metaKey: true });
assert.strictEqual(state.selectedLineNumbers.size, 100);
console.log('✓ Ctrl+A / Cmd+A and Escape selection workflows verified');

// ========================================================================
// TEST 5: Jump Keys (PageDown, PageUp, Home, End) with and without Shift
// ========================================================================
console.log('Testing Jump Navigation (PageDown, PageUp, Home, End)...');
state = createInitialState();
state = processRowClick(state, mockEntries, 1, false, false);

// PageDown jumps 15 logs down (to line 16)
state = processKeydown(state, mockEntries, { key: 'PageDown' });
assert.strictEqual(state.selectedLineNumber, 16);
assert.strictEqual(state.selectedLineNumbers.size, 1);

// Shift + PageDown expands range by 15 logs (lines 16 to 31)
state = processKeydown(state, mockEntries, { key: 'PageDown', shiftKey: true });
assert.strictEqual(state.selectedLineNumbers.size, 16); // 16 to 31 = 16 items
assert.ok(state.selectedLineNumbers.has(16));
assert.ok(state.selectedLineNumbers.has(31));

// PageUp jumps 15 logs up without range selection
state = processKeydown(state, mockEntries, { key: 'PageUp' });
assert.strictEqual(state.selectedLineNumber, 16);
assert.strictEqual(state.selectedLineNumbers.size, 1);

// End jumps to last log (line 100)
state = processKeydown(state, mockEntries, { key: 'End' });
assert.strictEqual(state.selectedLineNumber, 100);
assert.strictEqual(state.selectedLineNumbers.size, 1);

// Home jumps to top log (line 1)
state = processKeydown(state, mockEntries, { key: 'Home' });
assert.strictEqual(state.selectedLineNumber, 1);
assert.strictEqual(state.selectedLineNumbers.size, 1);

// Shift + End from line 1 selects all 100 logs
state = processKeydown(state, mockEntries, { key: 'End', shiftKey: true });
assert.strictEqual(state.selectedLineNumbers.size, 100);

// Shift + Home from line 100 selects all 100 logs
state = processRowClick(state, mockEntries, 100, false, false);
state = processKeydown(state, mockEntries, { key: 'Home', shiftKey: true });
assert.strictEqual(state.selectedLineNumbers.size, 100);
console.log('✓ PageDown (+15), PageUp (-15), Home, End jump and range expansions verified');

// ========================================================================
// TEST 6: Multi-Row Copy (Ctrl+C / Cmd+C) Formatting Engine
// ========================================================================
console.log('Testing Multi-Row Copy Formatting (Ctrl+C / Cmd+C)...');

function formatCopyPayload(entries: LogEntry[], selectedLines: Set<number>, singleLine: number | null): {
  text: string;
  summary: string;
} {
  if (selectedLines.size > 1) {
    const selectedEntries = entries.filter((e) => selectedLines.has(e.lineNumber));
    if (selectedEntries.length > 0) {
      const joinedText = selectedEntries.map((e) => e.raw || e.message).join('\n');
      const firstLine = selectedEntries[0].lineNumber;
      const lastLine = selectedEntries[selectedEntries.length - 1].lineNumber;
      return {
        text: joinedText,
        summary: `${selectedEntries.length} lines (#${firstLine}–#${lastLine})`,
      };
    }
  } else if (singleLine !== null) {
    const entry = entries.find((e) => e.lineNumber === singleLine);
    if (entry) {
      return {
        text: entry.raw || entry.message,
        summary: `Line #${entry.lineNumber}`,
      };
    }
  }
  return { text: '', summary: '' };
}

// Single line copy
const copySingle = formatCopyPayload(mockEntries, new Set([5]), 5);
assert.strictEqual(copySingle.summary, 'Line #5');
assert.strictEqual(copySingle.text, mockEntries[4].raw);

// Multi-line range copy (lines 10, 11, 12, 13)
const copyMulti = formatCopyPayload(mockEntries, new Set([10, 11, 12, 13]), 13);
assert.strictEqual(copyMulti.summary, '4 lines (#10–#13)');
const linesInCopy = copyMulti.text.split('\n');
assert.strictEqual(linesInCopy.length, 4);
assert.strictEqual(linesInCopy[0], mockEntries[9].raw);
assert.strictEqual(linesInCopy[3], mockEntries[12].raw);
console.log('✓ Multi-row formatted copy payload generator verified');

// ========================================================================
// TEST 7: Search Navigation Engine ('/' focus, 'n' next, 'Shift+n' / 'N' prev)
// ========================================================================
console.log('Testing Search Shortcuts (/ focus, n next match, Shift+n / N prev match)...');

function searchMatches(entries: LogEntry[], query: string): number[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const matchIndices: number[] = [];
  entries.forEach((e, idx) => {
    if (e.message.toLowerCase().includes(q) || e.raw.toLowerCase().includes(q)) {
      matchIndices.push(idx);
    }
  });
  return matchIndices;
}

function cycleMatch(matchIndices: number[], currentIndex: number, direction: 'next' | 'prev'): number {
  if (matchIndices.length === 0) return -1;
  const currentPos = matchIndices.indexOf(currentIndex);
  if (direction === 'next') {
    if (currentPos === -1) return matchIndices[0];
    return matchIndices[(currentPos + 1) % matchIndices.length];
  } else {
    if (currentPos === -1) return matchIndices[matchIndices.length - 1];
    return matchIndices[(currentPos - 1 + matchIndices.length) % matchIndices.length];
  }
}

// Find all entries with 'line 1' (e.g. line 1, line 10..19, line 100)
const matches = searchMatches(mockEntries, 'line 1');
assert.ok(matches.length > 5, 'Must find multiple search matches');

let currentMatchIdx = -1;
// 'n': First jump to match 0
currentMatchIdx = cycleMatch(matches, currentMatchIdx, 'next');
assert.strictEqual(currentMatchIdx, matches[0]);

// 'n': Second jump to match 1
currentMatchIdx = cycleMatch(matches, currentMatchIdx, 'next');
assert.strictEqual(currentMatchIdx, matches[1]);

// 'N' or 'Shift+n': Jump back to match 0
currentMatchIdx = cycleMatch(matches, currentMatchIdx, 'prev');
assert.strictEqual(currentMatchIdx, matches[0]);

// 'Shift+n' at match 0 wraps around to last match
currentMatchIdx = cycleMatch(matches, currentMatchIdx, 'prev');
assert.strictEqual(currentMatchIdx, matches[matches.length - 1]);
console.log('✓ Search cycling and wrap-around (n / Shift+n) verified');

// ========================================================================
// TEST 8: Layout, View & Telemetry Modal Key Handlers
// ========================================================================
console.log('Testing Layout, View and Modal Shortcuts...');

interface AppViewOptions {
  panelLayout: '1' | '2-col' | '2-row' | '3-grid' | '4-grid';
  viewMode: 'compact' | 'standard' | 'raw';
  wrapLines: boolean;
  isLiveTail: boolean;
  isSidebarCollapsed: boolean;
  isFullscreen: boolean;
  isHealthModalOpen: boolean;
  isShortcutsModalOpen: boolean;
  isGoToLineModalOpen: boolean;
}

function processGlobalShortcut(
  options: AppViewOptions,
  event: { key: string; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }
): AppViewOptions {
  const next = { ...options };
  const hasModifier = event.ctrlKey || event.metaKey || event.altKey;

  // 'g' / 'G': Go to line
  if (!hasModifier && (event.key === 'g' || event.key === 'G')) {
    next.isGoToLineModalOpen = true;
    return next;
  }
  // '?': Shortcuts modal
  if (!hasModifier && event.key === '?') {
    next.isShortcutsModalOpen = true;
    return next;
  }
  // 'w' / 'W': Toggle word wrap
  if (!hasModifier && (event.key === 'w' || event.key === 'W')) {
    next.wrapLines = !next.wrapLines;
    return next;
  }
  // 'c' / 'C': Toggle compact / standard view
  if (!hasModifier && (event.key === 'c' || event.key === 'C')) {
    next.viewMode = next.viewMode === 'compact' ? 'standard' : 'compact';
    return next;
  }
  // 't' / 'T': Toggle live tail
  if (!hasModifier && (event.key === 't' || event.key === 'T')) {
    next.isLiveTail = !next.isLiveTail;
    return next;
  }
  // '[': Toggle left panel
  if (!hasModifier && event.key === '[') {
    next.isSidebarCollapsed = !next.isSidebarCollapsed;
    return next;
  }
  // 'F11': Toggle fullscreen
  if (event.key === 'F11') {
    next.isFullscreen = !next.isFullscreen;
    return next;
  }
  // Shift + H: Health modal
  if (event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && (event.key === 'h' || event.key === 'H')) {
    next.isHealthModalOpen = !next.isHealthModalOpen;
    return next;
  }
  // Alt + 1/2/3/4 Layout switching
  if (event.altKey && !event.ctrlKey && !event.metaKey) {
    if (event.key === '1') {
      next.panelLayout = '1';
      return next;
    }
    if (event.key === '2') {
      next.panelLayout = next.panelLayout === '2-col' ? '2-row' : '2-col';
      return next;
    }
    if (event.key === '3') {
      next.panelLayout = '3-grid';
      return next;
    }
    if (event.key === '4') {
      next.panelLayout = '4-grid';
      return next;
    }
  }

  return next;
}

let appState: AppViewOptions = {
  panelLayout: '1',
  viewMode: 'compact',
  wrapLines: false,
  isLiveTail: false,
  isSidebarCollapsed: false,
  isFullscreen: false,
  isHealthModalOpen: false,
  isShortcutsModalOpen: false,
  isGoToLineModalOpen: false,
};

// Toggle word wrap ('w')
appState = processGlobalShortcut(appState, { key: 'w' });
assert.strictEqual(appState.wrapLines, true);
appState = processGlobalShortcut(appState, { key: 'W' });
assert.strictEqual(appState.wrapLines, false);

// Toggle view mode ('c')
appState = processGlobalShortcut(appState, { key: 'c' });
assert.strictEqual(appState.viewMode, 'standard');
appState = processGlobalShortcut(appState, { key: 'C' });
assert.strictEqual(appState.viewMode, 'compact');

// Toggle live tail ('t')
appState = processGlobalShortcut(appState, { key: 't' });
assert.strictEqual(appState.isLiveTail, true);

// Toggle sidebar ('[')
appState = processGlobalShortcut(appState, { key: '[' });
assert.strictEqual(appState.isSidebarCollapsed, true);

// Toggle fullscreen ('F11')
appState = processGlobalShortcut(appState, { key: 'F11' });
assert.strictEqual(appState.isFullscreen, true);

// Go to line ('g')
appState = processGlobalShortcut(appState, { key: 'g' });
assert.strictEqual(appState.isGoToLineModalOpen, true);

// Health modal ('Shift+H')
appState = processGlobalShortcut(appState, { key: 'H', shiftKey: true });
assert.strictEqual(appState.isHealthModalOpen, true);

// Shortcuts modal ('?')
appState = processGlobalShortcut(appState, { key: '?' });
assert.strictEqual(appState.isShortcutsModalOpen, true);

// Layout switching (Alt + 1, 2, 3, 4)
appState = processGlobalShortcut(appState, { key: '2', altKey: true });
assert.strictEqual(appState.panelLayout, '2-col');
appState = processGlobalShortcut(appState, { key: '2', altKey: true });
assert.strictEqual(appState.panelLayout, '2-row');
appState = processGlobalShortcut(appState, { key: '3', altKey: true });
assert.strictEqual(appState.panelLayout, '3-grid');
appState = processGlobalShortcut(appState, { key: '4', altKey: true });
assert.strictEqual(appState.panelLayout, '4-grid');
appState = processGlobalShortcut(appState, { key: '1', altKey: true });
assert.strictEqual(appState.panelLayout, '1');
console.log('✓ All view toggles, modal triggers, and multi-panel layout shortcuts verified');

// ========================================================================
// TEST 9: Static Verification of Shortcuts Modal vs Implementation Source Code
// ========================================================================
console.log('Verifying codebase contract alignment across source files...');

const modalSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/KeyboardShortcutsModal.tsx'), 'utf-8');
const logPanelSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/LogPanel.tsx'), 'utf-8');
const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');

// 1. Navigation shortcuts present
assert.ok(modalSrc.includes("['↓', 'j']"), 'Shortcuts modal must include down navigation');
assert.ok(modalSrc.includes("['↑', 'k']"), 'Shortcuts modal must include up navigation');
assert.ok(modalSrc.includes("['Shift', '↓']"), 'Shortcuts modal must include Shift+down range selection');
assert.ok(modalSrc.includes("['Shift', '↑']"), 'Shortcuts modal must include Shift+up range selection');
assert.ok(modalSrc.includes("['PgDn']"), 'Shortcuts modal must include PgDn');
assert.ok(modalSrc.includes("['PgUp']"), 'Shortcuts modal must include PgUp');
assert.ok(modalSrc.includes("['Home']"), 'Shortcuts modal must include Home');
assert.ok(modalSrc.includes("['End']"), 'Shortcuts modal must include End');
assert.ok(modalSrc.includes("['Ctrl', 'a']"), 'Shortcuts modal must include Ctrl+a / Cmd+a select all');

// 2. Action and inspection shortcuts present
assert.ok(modalSrc.includes("['Enter', 'Space']"), 'Shortcuts modal must include Enter/Space');
assert.ok(modalSrc.includes("['Ctrl', 'c']"), 'Shortcuts modal must include Ctrl+c');
assert.ok(modalSrc.includes("['d']"), 'Shortcuts modal must include d');
assert.ok(modalSrc.includes("['g']"), 'Shortcuts modal must include g');
assert.ok(modalSrc.includes("['Esc']"), 'Shortcuts modal must include Esc');

// 3. Search shortcuts present
assert.ok(modalSrc.includes("['/']"), 'Shortcuts modal must include /');
assert.ok(modalSrc.includes("['n']"), 'Shortcuts modal must include n');
assert.ok(modalSrc.includes("['Shift', 'n']"), 'Shortcuts modal must include Shift+n');

// 4. View and layout shortcuts present
assert.ok(modalSrc.includes("['[']"), 'Shortcuts modal must include [');
assert.ok(modalSrc.includes("['F11']"), 'Shortcuts modal must include F11');
assert.ok(modalSrc.includes("['w']"), 'Shortcuts modal must include w');
assert.ok(modalSrc.includes("['t']"), 'Shortcuts modal must include t');
assert.ok(modalSrc.includes("['Alt', '1']"), 'Shortcuts modal must include Alt+1');
assert.ok(modalSrc.includes("['Alt', '2']"), 'Shortcuts modal must include Alt+2');
assert.ok(modalSrc.includes("['Alt', '3']"), 'Shortcuts modal must include Alt+3');
assert.ok(modalSrc.includes("['Alt', '4']"), 'Shortcuts modal must include Alt+4');
assert.ok(modalSrc.includes("['Shift', 'h']"), 'Shortcuts modal must include Shift+h');
assert.ok(modalSrc.includes("['Alt', 'r']"), 'Shortcuts modal must include Alt+r');
assert.ok(modalSrc.includes("['?']"), 'Shortcuts modal must include ?');

// 5. Handlers present in source code
assert.ok(logPanelSrc.includes("key === 'a' || e.key === 'A'"), 'LogPanel must handle Ctrl/Cmd+A select all');
assert.ok(logPanelSrc.includes("key === 'c' || e.key === 'C'"), 'LogPanel must handle Ctrl/Cmd+C copy');
assert.ok(logPanelSrc.includes("key === 'Escape'"), 'LogPanel must handle Escape deselect');
assert.ok(logPanelSrc.includes("key === 'PageDown'"), 'LogPanel must handle PageDown');
assert.ok(logPanelSrc.includes("key === 'PageUp'"), 'LogPanel must handle PageUp');
assert.ok(logPanelSrc.includes("key === 'Home'"), 'LogPanel must handle Home');
assert.ok(logPanelSrc.includes("key === 'End'"), 'LogPanel must handle End');
assert.ok(appSrc.includes("setIsGoToLineModalOpen(true)"), 'App must handle g shortcut');
assert.ok(appSrc.includes("handleNextMatch()"), 'App must handle n shortcut');
assert.ok(appSrc.includes("handlePrevMatch()"), 'App must handle Shift+n shortcut');
assert.ok(appSrc.includes("setIsShortcutsOpen(true)"), 'App must handle ? shortcut');
assert.ok(appSrc.includes("setIsHealthModalOpen"), 'App must handle Shift+H shortcut');
assert.ok(appSrc.includes("handleResetSettings()"), 'App must handle Alt+r shortcut');
assert.ok(appSrc.includes("setPanelLayout('1')"), 'App must handle Alt+1 shortcut');
assert.ok(appSrc.includes("setPanelLayout('3-grid')"), 'App must handle Alt+3 shortcut');
assert.ok(appSrc.includes("setPanelLayout('4-grid')"), 'App must handle Alt+4 shortcut');

console.log('✓ Full source code static analysis and keyboard listener contract matches verified');
console.log('\n========================================================================');
console.log('🎉 ALL KEYBOARD SHORTCUTS & MULTI-SELECTION TESTS PASSED (100% SUCCESS)');
console.log('========================================================================\n');
