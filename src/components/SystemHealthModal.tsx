import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Layers,
  MemoryStick as Memory,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { ApplicationHealthReport, HealthStatus, IncidentRecord } from '../types.ts';
import { copyWithToast } from '../utils/copyNotifier.ts';

interface SystemHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearCache?: () => void;
}

export const SystemHealthModal: React.FC<SystemHealthModalProps> = ({
  isOpen,
  onClose,
  onClearCache,
}) => {
  const [report, setReport] = useState<ApplicationHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'incidents' | 'file_loading' | 'stability' | 'cache' | 'event_loop' | 'vitals' | 'raw'
  >('overview');
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(3);
  const [copied, setCopied] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/metrics');
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error('Failed to fetch health metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetMetrics = async () => {
    try {
      await fetch('/api/metrics/reset', { method: 'POST' });
      await fetchMetrics();
    } catch (err) {
      console.error('Failed to reset metrics:', err);
    }
  };

  const handleClearIncidents = async () => {
    try {
      await fetch('/api/metrics/clear-incidents', { method: 'POST' });
      await fetchMetrics();
      copyWithToast('Incidents log cleared', 'Incidents Reset');
    } catch (err) {
      console.error('Failed to clear incidents:', err);
    }
  };

  const handleExportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!report) return;
    const rows = [
      ['Metric Section', 'Metric Name', 'Value', 'Unit / Note'],
      ['Health', 'Status', report.status, 'Overall system state'],
      ['Health', 'Score', report.healthScore.toString(), '0 - 100 Scale'],
      ['Health', 'Timestamp', report.timestamp, 'UTC ISO String'],
      ['Stability', 'Server Crashes', `${report.stability?.serverCrashesCount || 0}`, 'count'],
      ['Stability', 'Client Errors', `${report.stability?.clientErrorsCount || 0}`, 'count'],
      ['Stability', 'Stream Drops', `${report.stability?.streamDropsCount || 0}`, 'count'],
      ['Stability', 'Stream Reconnects', `${report.stability?.streamReconnectionsCount || 0}`, 'count'],
      ['Stability', 'Aborted Queries', `${report.stability?.abortedQueriesCount || 0}`, 'count'],
      ['Stability', 'Flicker Bursts', `${report.stability?.flickerBurstCount || 0}`, 'count'],
      ['File Loading', 'Total Attempts', `${report.fileLoading?.totalAttempts || 0}`, 'count'],
      ['File Loading', 'Successful Loads', `${report.fileLoading?.successfulLoads || 0}`, 'count'],
      ['File Loading', 'Failed Loads', `${report.fileLoading?.failedLoads || 0}`, 'count'],
      ['File Loading', 'Failure Rate', `${report.fileLoading?.failureRatePercent || 0}`, '%'],
      ['File Loading', 'Avg Load Time', `${report.fileLoading?.avgLoadTimeMs || 0}`, 'ms'],
      ['File Loading', 'P95 Load Time', `${report.fileLoading?.p95LoadTimeMs || 0}`, 'ms'],
      ['File Loading', 'Malformed Lines', `${report.fileLoading?.malformedLinesCount || 0}`, 'count'],
      ['Vitals', 'Heap Used', report.vitals.heapUsedMb.toString(), 'MB'],
      ['Vitals', 'Heap Total', report.vitals.heapTotalMb.toString(), 'MB'],
      ['Vitals', 'Heap Limit', report.vitals.heapLimitMb.toString(), 'MB'],
      ['Vitals', 'Heap Usage', report.vitals.heapUsagePercent.toString(), '%'],
      ['Vitals', 'RSS', report.vitals.rssMb.toString(), 'MB'],
      ['Vitals', 'CPU User Time', report.vitals.cpuUserSeconds.toString(), 'seconds'],
      ['Vitals', 'CPU System Time', report.vitals.cpuSystemSeconds.toString(), 'seconds'],
      ['Event Loop', 'P50 Latency', report.eventLoop.p50Ms.toString(), 'ms'],
      ['Event Loop', 'P95 Latency', report.eventLoop.p95Ms.toString(), 'ms'],
      ['Event Loop', 'P99 Latency', report.eventLoop.p99Ms.toString(), 'ms'],
      ['Event Loop', 'Max Latency', report.eventLoop.maxMs.toString(), 'ms'],
      ['Cache', 'Total Lookups', report.cache.totalLookups.toString(), 'count'],
      ['Cache', 'Hits', report.cache.hits.toString(), 'count'],
      ['Cache', 'Misses', report.cache.misses.toString(), 'count'],
      ['Cache', 'Hit Ratio', report.cache.hitRatioPercent.toString(), '%'],
      ['Cache', 'LRU Evictions', report.cache.evictions.toString(), 'count'],
      ['Cache', 'Cached Sources', report.cache.cachedSourcesCount.toString(), 'count'],
      ['Cache', 'Cached Entries', report.cache.cachedEntriesTotal.toString(), 'count'],
      ['Cache', 'Estimated Memory', report.cache.estimatedMemoryMb.toString(), 'MB'],
      ['Query SLA', 'Total Queries', report.querySla.totalQueries.toString(), 'count'],
      ['Query SLA', 'Throughput', report.querySla.throughputQps.toString(), 'QPS'],
      ['Query SLA', 'Avg Latency', report.querySla.avgDurationMs.toString(), 'ms'],
      ['Query SLA', 'P50 Latency', report.querySla.p50Ms.toString(), 'ms'],
      ['Query SLA', 'P95 Latency', report.querySla.p95Ms.toString(), 'ms'],
      ['Query SLA', 'P99 Latency', report.querySla.p99Ms.toString(), 'ms'],
      ['Query SLA', 'Slow Queries (>50ms)', report.querySla.slowQueriesCount.toString(), 'count'],
      ['Query SLA', 'Critical Queries (>200ms)', report.querySla.criticalQueriesCount.toString(), 'count'],
      ['Query SLA', 'Error Rate', report.querySla.errorRatePercent.toString(), '%'],
      ['Storage', 'Telemetry Directory', report.storage?.directory || 'logs/telemetry', 'Local disk path'],
      ['Storage', 'Current File', report.storage?.currentFile || '', 'Active JSONL file'],
      ['Storage', 'Current File Size', `${report.storage?.currentFileSizeMb || 0}`, 'MB'],
      ['Storage', 'Max Capped Size', `${report.storage?.maxCapMb || 1024}`, 'MB (1GB)'],
    ];

    const csvContent = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry-report-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (isOpen) {
      fetchMetrics();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || autoRefreshSec <= 0) return;
    const interval = setInterval(() => {
      fetchMetrics();
    }, autoRefreshSec * 1000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefreshSec]);

  if (!isOpen) return null;

  const renderStatusBadge = (status?: HealthStatus) => {
    const s = (status || 'OPTIMAL').toLowerCase();
    return (
      <span className={`health-status-badge ${s}`}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: s === 'critical' ? '#f43f5e' : s === 'degraded' ? '#f59e0b' : '#22c55e',
          }}
        />
        {status || 'OPTIMAL'}
      </span>
    );
  };

  const incidentsCount = report?.incidents?.length || 0;
  const crashesCount = report?.stability?.serverCrashesCount || 0;
  const clientErrorsCount = report?.stability?.clientErrorsCount || 0;
  const failedLoadsCount = report?.fileLoading?.failedLoads || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="health-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 940, width: '95vw' }}
      >
        {/* Header */}
        <div className="health-header">
          <div className="health-header-left">
            <div className="health-header-icon-box">
              <Activity size={20} />
            </div>
            <div>
              <div className="health-header-title-row">
                <h2 className="health-header-title">Application Health & Analytics Observability</h2>
                {report && renderStatusBadge(report.status)}
              </div>
              <p className="health-header-sub">
                Crash diagnostics, non-loading file tracking, render flicker index, event loop lag, and memory SLAs
              </p>
            </div>
          </div>

          <div className="health-header-controls">
            {/* Auto Refresh Toggle */}
            <div className="health-auto-group">
              <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Auto:</span>
              {[
                { label: 'Off', val: 0 },
                { label: '1s', val: 1 },
                { label: '3s', val: 3 },
                { label: '5s', val: 5 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setAutoRefreshSec(opt.val)}
                  className={`health-auto-opt ${autoRefreshSec === opt.val ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Export JSON & CSV */}
            <button
              type="button"
              onClick={handleExportJson}
              disabled={!report}
              title="Export Telemetry Report (JSON)"
              className="btn-secondary"
              style={{ padding: '5px 8px', fontSize: '0.74rem', gap: 4 }}
            >
              <Download size={12} color="#38bdf8" />
              <span>JSON</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!report}
              title="Export Performance Metrics (CSV)"
              className="btn-secondary"
              style={{ padding: '5px 8px', fontSize: '0.74rem', gap: 4 }}
            >
              <FileSpreadsheet size={12} color="#4ade80" />
              <span>CSV</span>
            </button>

            {/* Manual Refresh */}
            <button
              type="button"
              onClick={fetchMetrics}
              disabled={loading}
              title="Refresh Telemetry Now"
              className="btn-secondary"
              style={{ padding: '5px 8px' }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Reset Stats */}
            <button
              type="button"
              onClick={handleResetMetrics}
              title="Reset Metrics Counters"
              className="btn-secondary"
              style={{ padding: '5px 8px', fontSize: '0.74rem', gap: 4 }}
            >
              <RotateCcw size={12} color="#f59e0b" />
              <span>Reset</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="btn-icon"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="health-tabs-bar">
          {[
            { id: 'overview', label: 'Overview', icon: Sparkles },
            {
              id: 'incidents',
              label: `Incidents (${incidentsCount})`,
              icon: ShieldAlert,
              badge: incidentsCount > 0 ? incidentsCount : undefined,
              badgeColor: crashesCount > 0 ? '#f43f5e' : '#f59e0b',
            },
            {
              id: 'file_loading',
              label: `File Loading (${failedLoadsCount > 0 ? `${failedLoadsCount} fail` : '100%'})`,
              icon: HardDrive,
            },
            {
              id: 'stability',
              label: 'Stability & Flicker',
              icon: AlertOctagon,
            },
            { id: 'cache', label: 'Cache & Memory', icon: Database },
            { id: 'event_loop', label: 'Event Loop & SLA', icon: Clock },
            { id: 'vitals', label: 'System Vitals', icon: Memory },
            { id: 'raw', label: 'Raw Telemetry', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`health-tab-btn ${isActive ? 'active' : ''}`}
                style={{ position: 'relative' }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: tab.badgeColor || '#f43f5e',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      borderRadius: 10,
                      padding: '1px 5px',
                      marginLeft: 2,
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="health-body">
          {!report && loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
              <p style={{ fontSize: '0.85rem' }}>Calculating real-time telemetry and health vitals...</p>
            </div>
          )}

          {report && (
            <>
              {/* Diagnostic Alerts Banner */}
              {report.diagnostics && report.diagnostics.length > 0 && (
                <div className="health-diag-list">
                  {report.diagnostics.map((diag, idx) => (
                    <div key={idx} className={`health-diag-card ${diag.type}`}>
                      {diag.type === 'critical' ? (
                        <ShieldAlert size={16} color="#f43f5e" style={{ flexShrink: 0, marginTop: 2 }} />
                      ) : diag.type === 'warning' ? (
                        <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                      ) : (
                        <CheckCircle2 size={16} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 700 }}>{diag.message}</div>
                        <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>{diag.recommendation}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <>
                  {/* KPI Cards Grid */}
                  <div className="health-kpi-grid">
                    {/* Health Score */}
                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Health Index</span>
                        <Zap size={14} color="#f59e0b" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val">{report.healthScore}</span>
                        <span className="health-kpi-unit">/ 100</span>
                      </div>
                      <div className="health-kpi-footer">
                        Status: <strong style={{ color: 'var(--text-primary)' }}>{report.status}</strong>
                      </div>
                    </div>

                    {/* Crashes & Incidents */}
                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>System Incidents</span>
                        <ShieldAlert size={14} color="#f43f5e" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span
                          className="health-kpi-val"
                          style={{ color: incidentsCount === 0 ? '#22c55e' : '#f43f5e' }}
                        >
                          {incidentsCount}
                        </span>
                        <span className="health-kpi-unit">active</span>
                      </div>
                      <div className="health-kpi-footer">
                        {crashesCount} server crashes · {clientErrorsCount} client errors
                      </div>
                    </div>

                    {/* File Load SLA */}
                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>File Load Success</span>
                        <HardDrive size={14} color="#38bdf8" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span
                          className="health-kpi-val"
                          style={{
                            color: (report.fileLoading?.failureRatePercent || 0) === 0 ? '#22c55e' : '#f43f5e',
                          }}
                        >
                          {100 - (report.fileLoading?.failureRatePercent || 0)}%
                        </span>
                      </div>
                      <div className="health-kpi-footer">
                        Avg: {report.fileLoading?.avgLoadTimeMs || 0}ms · Fails: {report.fileLoading?.failedLoads || 0}
                      </div>
                    </div>

                    {/* Event Loop P95 Lag */}
                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Event Loop P95</span>
                        <Clock size={14} color="#a855f7" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span
                          className="health-kpi-val"
                          style={{ color: report.eventLoop.p95Ms > 30 ? '#f59e0b' : '#22c55e' }}
                        >
                          {report.eventLoop.p95Ms}
                        </span>
                        <span className="health-kpi-unit">ms</span>
                      </div>
                      <div className="health-kpi-footer">
                        Mean: {report.eventLoop.meanMs}ms · Max: {report.eventLoop.maxMs}ms
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Storage Status Card */}
                  {report.storage && (
                    <div className="health-section-box">
                      <div className="health-section-title-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <HardDrive size={15} color="#38bdf8" />
                          <span className="health-section-title">Telemetry Disk Persistence (1GB Cap)</span>
                        </div>
                        <span className="health-pill" style={{ color: '#38bdf8' }}>
                          Auto-Snapshots (10s)
                        </span>
                      </div>
                      <div className="health-storage-grid">
                        <div className="health-storage-item">
                          <span className="label">Today's File:</span>
                          <span className="value mono">{report.storage.currentFile.split('/').pop() || 'metrics_today.jsonl'}</span>
                        </div>
                        <div className="health-storage-item">
                          <span className="label">Current File Size:</span>
                          <span className="value highlight">{report.storage.currentFileSizeMb} MB</span>
                        </div>
                        <div className="health-storage-item">
                          <span className="label">Total Directory Size:</span>
                          <span className="value highlight">{report.storage.totalDirSizeMb} MB</span>
                        </div>
                        <div className="health-storage-item">
                          <span className="label">Max Disk Cap:</span>
                          <span className="value">{report.storage.maxCapMb} MB (1.00 GB)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: INCIDENTS & CRASHES */}
              {activeTab === 'incidents' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        System Incident & Crash Feed
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Live stream of intercepted crashes, React rendering issues, file load failures, and flicker bursts
                      </p>
                    </div>
                    {incidentsCount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearIncidents}
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.74rem', gap: 4, color: '#f43f5e' }}
                      >
                        <Trash2 size={12} />
                        <span>Clear Log</span>
                      </button>
                    )}
                  </div>

                  {incidentsCount === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={36} color="#22c55e" style={{ margin: '0 auto 10px auto' }} />
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Zero Active Incidents</div>
                      <p style={{ fontSize: '0.78rem', marginTop: 4 }}>
                        No crashes, failed file reads, or UI render thrashing detected.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {report.incidents.map((inc) => {
                        const isSelected = selectedIncidentId === inc.id;
                        const isCritical = inc.severity === 'critical';
                        const isError = inc.severity === 'error';
                        return (
                          <div
                            key={inc.id}
                            onClick={() => setSelectedIncidentId(isSelected ? null : inc.id)}
                            style={{
                              background: isCritical
                                ? 'rgba(244, 63, 94, 0.08)'
                                : isError
                                ? 'rgba(239, 68, 68, 0.05)'
                                : 'var(--bg-card)',
                              border: `1px solid ${
                                isCritical ? '#f43f5e' : isError ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'
                              }`,
                              borderRadius: 6,
                              padding: '10px 12px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    backgroundColor: isCritical ? '#f43f5e' : isError ? '#ef4444' : '#f59e0b',
                                    color: '#ffffff',
                                  }}
                                >
                                  {inc.category}
                                </span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {inc.message}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {new Date(inc.timestamp).toLocaleTimeString()}
                              </span>
                            </div>

                            {isSelected && inc.details && (
                              <div
                                style={{
                                  marginTop: 10,
                                  padding: 8,
                                  background: 'rgba(0, 0, 0, 0.3)',
                                  borderRadius: 4,
                                  fontSize: '0.72rem',
                                  fontFamily: 'var(--font-mono)',
                                  color: 'var(--text-secondary)',
                                  whiteSpace: 'pre-wrap',
                                  overflowX: 'auto',
                                  maxHeight: 200,
                                }}
                              >
                                {JSON.stringify(inc.details, null, 2)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: FILE LOADING */}
              {activeTab === 'file_loading' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="health-kpi-grid">
                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Load Attempts</span>
                        <HardDrive size={14} color="#38bdf8" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val">{report.fileLoading?.totalAttempts || 0}</span>
                      </div>
                      <div className="health-kpi-footer">
                        Success: <span style={{ color: '#22c55e' }}>{report.fileLoading?.successfulLoads || 0}</span> · Failed:{' '}
                        <span style={{ color: '#f43f5e' }}>{report.fileLoading?.failedLoads || 0}</span>
                      </div>
                    </div>

                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Avg Load Latency</span>
                        <Clock size={14} color="#a855f7" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val">{report.fileLoading?.avgLoadTimeMs || 0}</span>
                        <span className="health-kpi-unit">ms</span>
                      </div>
                      <div className="health-kpi-footer">P95: {report.fileLoading?.p95LoadTimeMs || 0}ms</div>
                    </div>

                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Malformed Lines</span>
                        <AlertTriangle size={14} color="#f59e0b" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val">{report.fileLoading?.malformedLinesCount || 0}</span>
                        <span className="health-kpi-unit">lines</span>
                      </div>
                      <div className="health-kpi-footer">Skipped or formatted lines during parse</div>
                    </div>
                  </div>

                  {report.fileLoading?.slowestLoadedFile && (
                    <div className="health-section-box">
                      <div className="health-section-title-row">
                        <span className="health-section-title">Slowest File Cold Load</span>
                        <span className="health-pill" style={{ color: '#f59e0b' }}>
                          {report.fileLoading.slowestLoadedFile.durationMs} ms
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div><strong>Path:</strong> <code style={{ color: '#38bdf8' }}>{report.fileLoading.slowestLoadedFile.path}</code></div>
                        <div><strong>Entries Parsed:</strong> {report.fileLoading.slowestLoadedFile.linesCount.toLocaleString()} lines</div>
                        <div><strong>File Size:</strong> {(report.fileLoading.slowestLoadedFile.sizeBytes / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                    </div>
                  )}

                  {report.fileLoading?.recentFailures && report.fileLoading.recentFailures.length > 0 && (
                    <div className="health-section-box">
                      <div className="health-section-title-row">
                        <span className="health-section-title" style={{ color: '#f43f5e' }}>Recent File Read Failures</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {report.fileLoading.recentFailures.map((fail, i) => (
                          <div
                            key={i}
                            style={{
                              padding: 8,
                              background: 'rgba(244, 63, 94, 0.08)',
                              borderRadius: 4,
                              border: '1px solid rgba(244, 63, 94, 0.2)',
                              fontSize: '0.75rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f43f5e', fontWeight: 600 }}>
                              <span>[{fail.reason}] {fail.sourceId}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {new Date(fail.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', marginTop: 2, wordBreak: 'break-all' }}>{fail.error}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: STABILITY & FLICKER */}
              {activeTab === 'stability' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="health-kpi-grid">
                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Server Crashes</span>
                        <ShieldAlert size={14} color="#f43f5e" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span
                          className="health-kpi-val"
                          style={{ color: (report.stability?.serverCrashesCount || 0) === 0 ? '#22c55e' : '#f43f5e' }}
                        >
                          {report.stability?.serverCrashesCount || 0}
                        </span>
                      </div>
                      <div className="health-kpi-footer">Uncaught exceptions trapped</div>
                    </div>

                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Client Errors</span>
                        <AlertOctagon size={14} color="#f59e0b" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span
                          className="health-kpi-val"
                          style={{ color: (report.stability?.clientErrorsCount || 0) === 0 ? '#22c55e' : '#f59e0b' }}
                        >
                          {report.stability?.clientErrorsCount || 0}
                        </span>
                      </div>
                      <div className="health-kpi-footer">Browser errors intercepted</div>
                    </div>

                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Flicker Bursts</span>
                        <Sparkles size={14} color="#38bdf8" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span
                          className="health-kpi-val"
                          style={{ color: (report.stability?.flickerBurstCount || 0) === 0 ? '#22c55e' : '#f59e0b' }}
                        >
                          {report.stability?.flickerBurstCount || 0}
                        </span>
                      </div>
                      <div className="health-kpi-footer">Render thrashing events</div>
                    </div>

                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Aborted Queries</span>
                        <RotateCcw size={14} color="#c084fc" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val">{report.stability?.abortedQueriesCount || 0}</span>
                      </div>
                      <div className="health-kpi-footer">Cancelled in-flight queries</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: CACHE & MISSES */}
              {activeTab === 'cache' && (
                <>
                  <div className="health-kpi-grid">
                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Total Cache Hits</span>
                        <Database size={14} color="#22c55e" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val" style={{ color: '#22c55e' }}>
                          {report.cache.hits.toLocaleString()}
                        </span>
                      </div>
                      <div className="health-kpi-footer">
                        Ratio: <strong>{report.cache.hitRatioPercent}%</strong>
                      </div>
                    </div>

                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Total Cache Misses</span>
                        <AlertTriangle size={14} color="#f43f5e" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val" style={{ color: '#f43f5e' }}>
                          {report.cache.misses.toLocaleString()}
                        </span>
                      </div>
                      <div className="health-kpi-footer">
                        Evictions: {report.cache.evictions}
                      </div>
                    </div>

                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Active Log Sources</span>
                        <Layers size={14} color="#38bdf8" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val">{report.cache.cachedSourcesCount}</span>
                      </div>
                      <div className="health-kpi-footer">
                        {report.cache.cachedEntriesTotal.toLocaleString()} lines in RAM
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 6: EVENT LOOP & SLA */}
              {activeTab === 'event_loop' && (
                <>
                  <div className="health-kpi-grid">
                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Median Lag (P50)</span>
                        <Clock size={14} color="#38bdf8" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val">{report.eventLoop.p50Ms}</span>
                        <span className="health-kpi-unit">ms</span>
                      </div>
                    </div>

                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Tail Lag (P99)</span>
                        <Clock size={14} color="#f59e0b" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val">{report.eventLoop.p99Ms}</span>
                        <span className="health-kpi-unit">ms</span>
                      </div>
                    </div>

                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Query Throughput</span>
                        <Zap size={14} color="#22c55e" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val">{report.querySla.throughputQps}</span>
                        <span className="health-kpi-unit">QPS</span>
                      </div>
                      <div className="health-kpi-footer">
                        {report.querySla.totalQueries.toLocaleString()} total queries
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 7: VITALS & MEMORY */}
              {activeTab === 'vitals' && (
                <>
                  <div className="health-kpi-grid">
                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Heap Used</span>
                        <Memory size={14} color="#38bdf8" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val">{report.vitals.heapUsedMb}</span>
                        <span className="health-kpi-unit">MB</span>
                      </div>
                      <div className="health-kpi-footer">
                        Total: {report.vitals.heapTotalMb} MB · Limit: {report.vitals.heapLimitMb} MB
                      </div>
                    </div>

                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Resident Memory (RSS)</span>
                        <Database size={14} color="#c084fc" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val">{report.vitals.rssMb}</span>
                        <span className="health-kpi-unit">MB</span>
                      </div>
                      <div className="health-kpi-footer">
                        Usage: {report.vitals.heapUsagePercent}% of Heap
                      </div>
                    </div>

                    <div className="health-kpi-card">
                      <div className="health-kpi-head">
                        <span>Uptime</span>
                        <Activity size={14} color="#22c55e" />
                      </div>
                      <div className="health-kpi-val-row">
                        <span className="health-kpi-val">
                          {Math.floor(report.vitals.uptimeSeconds / 60)}m {report.vitals.uptimeSeconds % 60}s
                        </span>
                      </div>
                      <div className="health-kpi-footer">
                        Active handles: {report.vitals.activeHandles}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 8: RAW JSON TELEMETRY */}
              {activeTab === 'raw' && (
                <div className="health-raw-wrap">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Full Telemetry Payload Snapshot
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        copyWithToast(JSON.stringify(report, null, 2), 'Telemetry JSON copied');
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.72rem', gap: 4 }}
                    >
                      <Copy size={12} />
                      <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="health-raw-code">{JSON.stringify(report, null, 2)}</pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="health-footer">
          <div className="health-footer-left">
            <span>Last Snapshot: {report ? new Date(report.timestamp).toLocaleTimeString() : '---'}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>Observability Engine: Online</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-primary"
            style={{ padding: '6px 16px', fontSize: '0.8rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
