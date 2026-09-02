import React, { useEffect, useState } from 'react';
import { Check, X, Copy } from 'lucide-react';
import { CopyToastDetail } from '../utils/copyNotifier.ts';

export const CopyToast: React.FC = () => {
  const [toasts, setToasts] = useState<CopyToastDetail[]>([]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<CopyToastDetail>;
      if (!customEvent.detail) return;

      const newToast = customEvent.detail;
      setToasts((prev) => [...prev.slice(-2), newToast]); // keep max 3 visible

      // Auto dismiss after 2800ms
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== newToast.id));
      }, 2800);
    };

    window.addEventListener('app-copy-toast', handleToast);
    return () => window.removeEventListener('app-copy-toast', handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="copy-toast-container"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="copy-toast-item"
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'var(--toast-bg, rgba(15, 23, 42, 0.95))',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1.5px solid #10b981',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.35)',
            color: 'var(--text-primary)',
            minWidth: 280,
            maxWidth: 420,
            animation: 'copyToastSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Glowing Checkmark Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff',
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.7)',
              flexShrink: 0,
            }}
          >
            <Check size={14} strokeWidth={3} />
          </div>

          {/* Toast Message & First 20 Chars Snippet */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#10b981',
                }}
              >
                {toast.label}
              </span>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                ({toast.fullLength} char{toast.fullLength === 1 ? '' : 's'})
              </span>
            </div>

            {/* Quoted Snippet in Mono Pill */}
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.79rem',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                background: 'var(--bg-surface, rgba(255, 255, 255, 0.06))',
                padding: '2px 7px',
                borderRadius: 4,
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              }}
              title={toast.first20}
            >
              <span style={{ color: '#10b981', fontWeight: 600 }}>"</span>
              <span>{toast.snippet}</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>"</span>
            </div>
          </div>

          {/* Dismiss Button */}
          <button
            onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              flexShrink: 0,
              marginLeft: 4,
              transition: 'color 0.15s ease',
            }}
            title="Dismiss"
          >
            <X size={14} />
          </button>

          {/* Progress Shrinking Timer Line */}
          <div
            className="copy-toast-progress"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: 2.5,
              background: 'linear-gradient(90deg, #10b981, #34d399)',
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.8)',
              animation: 'copyToastProgress 2.8s linear forwards',
            }}
          />
        </div>
      ))}
    </div>
  );
};
