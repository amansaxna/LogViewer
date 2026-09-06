import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';
import { reportReactError } from '../utils/clientTelemetry.ts';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught render exception:', error, errorInfo);
    reportReactError(error, { componentStack: errorInfo.componentStack || undefined });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            background: 'var(--bg-card, #0f172a)',
            color: 'var(--text-primary, #f8fafc)',
            gap: 16,
            minHeight: 200,
            borderRadius: 6,
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
            }}
          >
            <AlertOctagon size={24} />
          </div>

          <div style={{ textAlign: 'center', maxWidth: 440 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ef4444', marginBottom: 6 }}>
              {this.props.fallbackTitle || 'Component Render Interrupted'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.4 }}>
              {this.state.error?.message || 'An unexpected rendering error was caught and isolated.'}
            </p>
          </div>

          <button
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <RefreshCw size={12} />
            Recover View
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
