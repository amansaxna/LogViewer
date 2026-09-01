import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { TraceData } from '../types.ts';

interface TraceViewerProps {
  trace: TraceData;
}

export const TraceViewer: React.FC<TraceViewerProps> = ({ trace }) => {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(trace.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="trace-container">
      <div className="trace-header" onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isOpen ? <ChevronDown size={16} color="#fb7185" /> : <ChevronRight size={16} color="#fb7185" />}
          <span className="trace-title">{trace.title || 'Stack Trace / Execution Trace'}</span>
        </div>
        <button className="btn-secondary" onClick={handleCopy} style={{ padding: '3px 8px', fontSize: '0.72rem' }}>
          {copied ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy Trace'}
        </button>
      </div>

      {isOpen && (
        <div className="trace-frames-list">
          {trace.frames.length > 0 ? (
            trace.frames.map((frame, idx) => (
              <div key={idx} className="trace-frame-row">
                <span className="trace-frame-fn">{frame.text}</span>
                {frame.file && (
                  <span className="trace-frame-loc">
                    {frame.file}:{frame.line || 1}
                  </span>
                )}
              </div>
            ))
          ) : (
            <pre style={{ margin: 0, padding: 8, fontSize: '0.78rem', color: '#fda4af', whiteSpace: 'pre-wrap' }}>
              {trace.raw}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
