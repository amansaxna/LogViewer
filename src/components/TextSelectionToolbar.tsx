import React, { useEffect, useRef } from 'react';
import { Copy, Search, Ban, ShieldAlert, Sliders, X } from 'lucide-react';

interface TextSelectionToolbarProps {
  selectedText: string;
  position: { x: number; y: number } | null;
  onCopy: (text: string) => void;
  onFilter: (text: string) => void;
  onIgnore: (text: string) => void;
  onAddToPresetIgnore: (text: string) => void;
  onAddToPresetFilter: (text: string) => void;
  onClose: () => void;
  activePresetName?: string | null;
}

export const TextSelectionToolbar: React.FC<TextSelectionToolbarProps> = ({
  selectedText,
  position,
  onCopy,
  onFilter,
  onIgnore,
  onAddToPresetIgnore,
  onAddToPresetFilter,
  onClose,
  activePresetName,
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!position || !selectedText || selectedText.trim().length === 0) {
    return null;
  }

  // Display snippet (truncate if too long)
  const displaySnippet = selectedText.length > 20
    ? `${selectedText.slice(0, 20)}…`
    : selectedText;

  // Clamp coordinates inside window viewport
  const left = Math.max(12, Math.min(window.innerWidth - 440, position.x - 180));
  const top = Math.max(10, position.y - 46);

  return (
    <div
      ref={toolbarRef}
      className="text-selection-toolbar"
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
      onMouseDown={(e) => {
        // Prevent selection from clearing when clicking inside toolbar
        e.stopPropagation();
      }}
    >
      <div className="selection-badge" title={selectedText}>
        <span>&ldquo;{displaySnippet}&rdquo;</span>
      </div>

      <div className="selection-divider" />

      {/* Copy */}
      <button
        type="button"
        className="selection-action-btn copy"
        onClick={() => onCopy(selectedText)}
        data-tooltip="Copy text to clipboard"
      >
        <Copy size={12} />
        <span>Copy</span>
      </button>

      {/* Filter by Text */}
      <button
        type="button"
        className="selection-action-btn filter"
        onClick={() => onFilter(selectedText)}
        data-tooltip="Filter current feed with this string"
      >
        <Search size={12} />
        <span>Filter</span>
      </button>

      {/* Exclude / Ignore */}
      <button
        type="button"
        className="selection-action-btn ignore"
        onClick={() => onIgnore(selectedText)}
        data-tooltip="Exclude this string from current feed (NOT query)"
      >
        <Ban size={12} />
        <span>Exclude</span>
      </button>

      <div className="selection-divider" />

      {/* Add to Preset Ignore */}
      <button
        type="button"
        className="selection-action-btn preset-ignore"
        onClick={() => onAddToPresetIgnore(selectedText)}
        data-tooltip={
          activePresetName
            ? `Add to ignore list in Preset "${activePresetName}"`
            : 'Add to preset ignore list'
        }
      >
        <ShieldAlert size={12} />
        <span>Preset Ignore</span>
      </button>

      {/* Add to Preset Filter */}
      <button
        type="button"
        className="selection-action-btn preset-filter"
        onClick={() => onAddToPresetFilter(selectedText)}
        data-tooltip={
          activePresetName
            ? `Add to include list in Preset "${activePresetName}"`
            : 'Add to preset filter whitelist'
        }
      >
        <Sliders size={12} />
        <span>Preset Filter</span>
      </button>

      <button
        type="button"
        className="selection-close-btn"
        onClick={onClose}
        title="Dismiss menu (Esc)"
      >
        <X size={11} />
      </button>
    </div>
  );
};
