import React from 'react';
import { Upload, FileCode2, Sparkles } from 'lucide-react';

interface FileDropOverlayProps {
  isDragging: boolean;
}

export const FileDropOverlay: React.FC<FileDropOverlayProps> = ({ isDragging }) => {
  if (!isDragging) return null;

  return (
    <div className="file-drop-overlay">
      <div className="file-drop-card">
        <div className="file-drop-icon-container">
          <Upload size={38} className="file-drop-icon" />
          <FileCode2 size={24} className="file-drop-subicon" />
        </div>

        <div className="file-drop-title">
          Drop Log File to Analyze
        </div>

        <div className="file-drop-subtitle">
          Supports <code>.log</code>, <code>.txt</code>, <code>.json</code>, <code>.jsonl</code>, <code>.xml</code>, <code>.out</code>
        </div>

        <div className="file-drop-badge">
          <Sparkles size={13} className="file-drop-badge-icon" />
          <span>Loads into active panel with instant parsing & syntax highlighting</span>
        </div>
      </div>
    </div>
  );
};
