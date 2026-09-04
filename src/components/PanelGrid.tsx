import React from 'react';
import { PanelLayout, PanelState, getLayoutCount } from '../types/panel.ts';
import { LogSource, LogPreset } from '../types.ts';
import { LogPanel } from './LogPanel.tsx';

interface PanelGridProps {
  layout: PanelLayout;
  panels: PanelState[];
  activePanelId: string;
  onSelectActivePanel: (id: string) => void;
  sources: LogSource[];
  activePreset: LogPreset | null;
  onUpdatePanel: (id: string, updates: Partial<PanelState>) => void;
  onClosePanel: (id: string) => void;
  onMaximizePanel: (id: string) => void;
  onSplitPanel: (fromId: string) => void;
  onViewContext: (lineNumber: number, sourceId?: string) => void;
}

export const PanelGrid: React.FC<PanelGridProps> = ({
  layout,
  panels,
  activePanelId,
  onSelectActivePanel,
  sources,
  activePreset,
  onUpdatePanel,
  onClosePanel,
  onMaximizePanel,
  onSplitPanel,
  onViewContext,
}) => {
  const visibleCount = getLayoutCount(layout);
  const visiblePanels = panels.slice(0, visibleCount);

  return (
    <div className={`panel-grid-container panel-grid-${layout}`}>
      {visiblePanels.map((panel, idx) => {
        const isActive = panel.id === activePanelId || (idx === 0 && !panels.some((p) => p.id === activePanelId));

        return (
          <div
            key={panel.id}
            className={`panel-grid-cell panel-cell-${idx + 1}`}
          >
            <LogPanel
              panel={panel}
              panelIndex={idx}
              isActive={isActive}
              onFocus={() => onSelectActivePanel(panel.id)}
              sources={sources}
              activePreset={activePreset}
              totalPanels={visibleCount}
              onUpdatePanel={(updates) => onUpdatePanel(panel.id, updates)}
              onClosePanel={() => onClosePanel(panel.id)}
              onMaximizePanel={() => onMaximizePanel(panel.id)}
              onSplitPanel={() => onSplitPanel(panel.id)}
              onViewContext={onViewContext}
            />
          </div>
        );
      })}
    </div>
  );
};
