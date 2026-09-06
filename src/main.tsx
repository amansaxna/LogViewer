import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initClientTelemetry } from './utils/clientTelemetry.ts';
import './index.css';

// Initialize global crash and telemetry hooks
initClientTelemetry();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary fallbackTitle="LogViewer Application Error">
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

