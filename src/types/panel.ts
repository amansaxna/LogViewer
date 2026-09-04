import { LogLevel, SortOption } from '../types.ts';

export type PanelLayout = '1' | '2-col' | '2-row' | '3-grid' | '4-grid';

export interface PanelState {
  id: string;
  sourceId: string | null;
  selectedSourceIds: string[];
  search: string;
  isRegex: boolean;
  caseSensitive: boolean;
  invert: boolean;
  markerFilter: string;
  isMarkerRegex: boolean;
  selectedLevels: LogLevel[];
  excludeLevels: LogLevel[];
  selectedWorkflow: string | null;
  selectedOperation: string | null;
  selectedCorrelation: string | null;
  startDate: string | null;
  endDate: string | null;
  sortOption: SortOption;
  viewMode: 'compact' | 'standard' | 'raw';
  wrapLines: boolean;
  hideBrackets: boolean;
  showDatetime: boolean;
  showPid: boolean;
  showTid: boolean;
  showCorrelation: boolean;
  selectedLineNumber: number | null;
}

export function createDefaultPanel(id: string, initial?: Partial<PanelState>): PanelState {
  return {
    id,
    sourceId: initial?.sourceId ?? null,
    selectedSourceIds: initial?.selectedSourceIds ?? [],
    search: initial?.search ?? '',
    isRegex: initial?.isRegex ?? false,
    caseSensitive: initial?.caseSensitive ?? false,
    invert: initial?.invert ?? false,
    markerFilter: initial?.markerFilter ?? '',
    isMarkerRegex: initial?.isMarkerRegex ?? false,
    selectedLevels: initial?.selectedLevels ?? [],
    excludeLevels: initial?.excludeLevels ?? [],
    selectedWorkflow: initial?.selectedWorkflow ?? null,
    selectedOperation: initial?.selectedOperation ?? null,
    selectedCorrelation: initial?.selectedCorrelation ?? null,
    startDate: initial?.startDate ?? null,
    endDate: initial?.endDate ?? null,
    sortOption: initial?.sortOption ?? 'time-asc',
    viewMode: initial?.viewMode ?? 'compact',
    wrapLines: initial?.wrapLines ?? false,
    hideBrackets: initial?.hideBrackets ?? false,
    showDatetime: initial?.showDatetime ?? true,
    showPid: initial?.showPid ?? true,
    showTid: initial?.showTid ?? true,
    showCorrelation: initial?.showCorrelation ?? true,
    selectedLineNumber: initial?.selectedLineNumber ?? null,
    ...initial,
  };
}

export function getLayoutCount(layout: PanelLayout): number {
  switch (layout) {
    case '1':
      return 1;
    case '2-col':
    case '2-row':
      return 2;
    case '3-grid':
      return 3;
    case '4-grid':
      return 4;
    default:
      return 1;
  }
}
