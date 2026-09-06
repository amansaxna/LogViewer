import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { getSources, registerCustomSource, removeCustomSource, findSourceById, getPresets, savePreset, deletePreset } from './config.ts';
import { queryLogs, getContextLines, clearFileCache } from './fileReader.ts';
import { LogLevel, LogQuery, LogPreset } from './types.ts';
import { metrics } from './metrics.ts';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// System Health Endpoint (Fast, lightweight check)
app.get('/api/health', (_req: Request, res: Response) => {
  try {
    const report = metrics.getHealthReport();
    res.json({
      status: report.status,
      healthScore: report.healthScore,
      isOptimal: report.isOptimal,
      vitals: report.vitals,
      eventLoop: report.eventLoop,
      cache: report.cache,
      querySla: report.querySla,
      diagnostics: report.diagnostics,
      timestamp: report.timestamp,
    });
  } catch (err: any) {
    metrics.recordError();
    res.status(500).json({ error: err.message || 'Failed to generate health report' });
  }
});

// Full System Metrics Telemetry Endpoint
app.get('/api/metrics', (_req: Request, res: Response) => {
  try {
    const report = metrics.getHealthReport();
    res.json(report);
  } catch (err: any) {
    metrics.recordError();
    res.status(500).json({ error: err.message || 'Failed to fetch metrics telemetry' });
  }
});

// Reset metrics counters
app.post('/api/metrics/reset', (_req: Request, res: Response) => {
  try {
    metrics.resetMetrics();
    res.json({ success: true, message: 'System metrics successfully reset' });
  } catch (err: any) {
    metrics.recordError();
    res.status(500).json({ error: err.message || 'Failed to reset metrics' });
  }
});

// Record Client-Side Crash, Error, or Flicker Incident
app.post('/api/metrics/client-event', (req: Request, res: Response) => {
  try {
    const { type, message, stack, panelId, context } = req.body;
    metrics.recordClientEvent({
      type: type || 'error',
      message: message || 'Unknown client error',
      stack,
      panelId,
      context,
    });
    res.json({ success: true, message: 'Client event recorded in telemetry engine' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to record client event' });
  }
});

// Clear active incident log
app.post('/api/metrics/clear-incidents', (_req: Request, res: Response) => {
  try {
    metrics.clearIncidents();
    res.json({ success: true, message: 'Incident log cleared' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear incidents' });
  }
});

// 1. Get all log sources
app.get('/api/sources', (_req: Request, res: Response) => {
  try {
    const sources = getSources();
    res.json({ sources });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch sources' });
  }
});

// 2. Open any local file by path
app.post('/api/sources/open', (req: Request, res: Response) => {
  try {
    const { path: filePath, name, category } = req.body;
    if (!filePath || typeof filePath !== 'string') {
      res.status(400).json({ error: 'File path is required' });
      return;
    }

    const source = registerCustomSource(filePath.trim(), name, category);
    res.json({ source, message: `Successfully opened ${source.name}` });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to open file' });
  }
});

// 2b. Upload / drop file content directly
app.post('/api/sources/upload', (req: Request, res: Response) => {
  try {
    const { name, content, category } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'File name is required' });
      return;
    }
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'File content must be a string' });
      return;
    }

    const uploadsDir = path.resolve(process.cwd(), 'logs', 'dropped');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Sanitize filename
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetPath = path.join(uploadsDir, safeName);

    fs.writeFileSync(targetPath, content, 'utf-8');
    clearFileCache(targetPath);

    const source = registerCustomSource(targetPath, name, category || 'Dropped Logs');
    res.json({ source, message: `Successfully loaded dropped file: ${name}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to process dropped file' });
  }
});

// 3. Close / remove a custom source
app.delete('/api/sources/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const removed = removeCustomSource(id);
  res.json({ success: removed });
});

// Presets API: Get all presets
app.get('/api/presets', (_req: Request, res: Response) => {
  try {
    const presets = getPresets();
    res.json({ presets });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch presets' });
  }
});

// Presets API: Save or update preset
app.post('/api/presets', (req: Request, res: Response) => {
  try {
    const { id, name, description, rules, isBuiltIn } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Preset name is required' });
      return;
    }

    const presetId = (id && typeof id === 'string' && id.trim())
      ? id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
      : `preset-${Date.now()}`;

    const preset: LogPreset = {
      id: presetId,
      name: name.trim(),
      description: description ? String(description).trim() : undefined,
      isBuiltIn: Boolean(isBuiltIn),
      rules: rules && typeof rules === 'object' ? rules : {},
    };

    const saved = savePreset(preset);
    res.json({ preset: saved, message: `Saved preset "${saved.name}"` });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to save preset' });
  }
});

// Presets API: Delete preset
app.delete('/api/presets/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deleted = deletePreset(id);
    if (!deleted) {
      res.status(404).json({ error: `Preset with id "${id}" not found` });
      return;
    }
    res.json({ success: true, message: `Deleted preset "${id}"` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete preset' });
  }
});

// 4. Query entries with filtering, search, pagination
app.get('/api/logs/entries', (req: Request, res: Response) => {
  try {
    const sourceIdsParam = req.query.sourceIds;
    let sourceIds: string[] | undefined;
    if (typeof sourceIdsParam === 'string') {
      sourceIds = sourceIdsParam.split(',').filter(Boolean);
    } else if (Array.isArray(sourceIdsParam)) {
      sourceIds = sourceIdsParam.map(String).filter(Boolean);
    }

    const sourceId = (req.query.sourceId as string) || (sourceIds && sourceIds[0]) || '';
    if (!sourceId && (!sourceIds || sourceIds.length === 0)) {
      res.status(400).json({ error: 'sourceId or sourceIds query parameter is required' });
      return;
    }

    const levelsParam = req.query.levels;
    let levels: LogLevel[] | undefined;
    if (typeof levelsParam === 'string') {
      levels = levelsParam.split(',').filter(Boolean) as LogLevel[];
    } else if (Array.isArray(levelsParam)) {
      levels = levelsParam.map(String).filter(Boolean) as LogLevel[];
    }

    const excludeLevelsParam = req.query.excludeLevels;
    let excludeLevels: LogLevel[] | undefined;
    if (typeof excludeLevelsParam === 'string') {
      excludeLevels = excludeLevelsParam.split(',').filter(Boolean) as LogLevel[];
    } else if (Array.isArray(excludeLevelsParam)) {
      excludeLevels = excludeLevelsParam.map(String).filter(Boolean) as LogLevel[];
    }

    const query: LogQuery = {
      sourceId,
      sourceIds,
      search: req.query.search as string | undefined,
      isRegex: req.query.isRegex === 'true' || req.query.regex === 'true',
      caseSensitive: req.query.caseSensitive === 'true',
      invert: req.query.invert === 'true',
      levels,
      excludeLevels,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      namespace: req.query.namespace as string | undefined,
      workflow: req.query.workflow as string | undefined,
      operation: req.query.operation as string | undefined,
      marker: req.query.marker as string | undefined,
      isMarkerRegex: req.query.isMarkerRegex === 'true' || req.query.markerRegex === 'true',
      correlationId: req.query.correlationId as string | undefined,
      pid: req.query.pid as string | undefined,
      tid: req.query.tid as string | undefined,
      sortBy: (req.query.sortBy as any) || 'time',
      direction: ((req.query.direction || req.query.sortDirection) as 'desc' | 'asc') || 'desc',
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 25000,
    };

    const result = queryLogs(query);
    res.json(result);
  } catch (err: any) {
    metrics.recordError();
    res.status(500).json({ error: err.message || 'Failed to query logs' });
  }
});

// 4b. Paste logs directly into session
app.post('/api/logs/paste', (req: Request, res: Response) => {
  try {
    const { text, name } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text content is required' });
      return;
    }

    const timestamp = Date.now();
    const fileName = `pasted_${timestamp}.log`;
    const targetPath = path.resolve(process.cwd(), 'logs', fileName);
    fs.writeFileSync(targetPath, text, 'utf-8');

    const source = registerCustomSource(
      targetPath,
      name || `Pasted Logs (${new Date().toLocaleTimeString()})`,
      'Pasted Logs'
    );
    res.json({ source, message: 'Logs saved and opened' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to process pasted logs' });
  }
});

// 4c. Server-Sent Events (SSE) Live Tail Stream
app.get('/api/logs/stream', (req: Request, res: Response) => {
  try {
    const sourceId = req.query.sourceId as string;
    if (!sourceId) {
      res.status(400).json({ error: 'sourceId query parameter is required' });
      return;
    }

    const source = findSourceById(sourceId);
    if (!source) {
      res.status(404).json({ error: 'Log source not found' });
      return;
    }

    const resolvedPath = path.isAbsolute(source.path)
      ? source.path
      : path.resolve(process.cwd(), source.path);

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: 'Log file not found on disk' });
      return;
    }

    // Set SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let lastSize = 0;
    let lastMtime = 0;
    try {
      const stats = fs.statSync(resolvedPath);
      lastSize = stats.size;
      lastMtime = stats.mtimeMs;
    } catch {}

    // Send initial connection handshake
    res.write(`data: ${JSON.stringify({ type: 'connected', sourceId, timestamp: Date.now() })}\n\n`);

    // High frequency file change detector (200ms)
    const watcherInterval = setInterval(() => {
      try {
        if (!fs.existsSync(resolvedPath)) return;
        const stats = fs.statSync(resolvedPath);
        if (stats.size !== lastSize || stats.mtimeMs !== lastMtime) {
          const sizeDiff = stats.size - lastSize;
          lastSize = stats.size;
          lastMtime = stats.mtimeMs;

          // Clear cache so queryLogs fetches fresh content
          clearFileCache(resolvedPath);

          const estimatedAdded = sizeDiff > 0 ? Math.max(1, Math.round(sizeDiff / 100)) : 1;
          res.write(
            `data: ${JSON.stringify({
              type: 'file_changed',
              sourceId,
              addedLogs: estimatedAdded,
              fileSize: stats.size,
              timestamp: Date.now(),
            })}\n\n`
          );
        }
      } catch {}
    }, 200);

    // Heartbeat ping every 10 seconds to keep connection open through proxies
    const pingInterval = setInterval(() => {
      res.write(': ping\n\n');
    }, 10000);

    req.on('close', () => {
      clearInterval(watcherInterval);
      clearInterval(pingInterval);
    });
  } catch (err: any) {
    metrics.recordError();
    res.status(500).json({ error: err.message || 'Live tail stream encountered an error' });
  }
});

// 5. Context lines for deep dive
app.get('/api/logs/context', (req: Request, res: Response) => {
  try {
    const sourceId = req.query.sourceId as string;
    const lineNumber = parseInt(req.query.lineNumber as string, 10);
    const radius = req.query.radius ? parseInt(req.query.radius as string, 10) : 10;

    if (!sourceId || isNaN(lineNumber)) {
      res.status(400).json({ error: 'sourceId and lineNumber are required' });
      return;
    }

    const context = getContextLines(sourceId, lineNumber, radius);
    res.json(context);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch context lines' });
  }
});

// 6. Real-time Live Tail stream via Server-Sent Events (SSE)
let activeStreamsCount = 0;

app.get('/api/logs/stream', (req: Request, res: Response) => {
  const sourceId = req.query.sourceId as string;
  if (!sourceId) {
    res.status(400).send('sourceId required');
    return;
  }

  const source = findSourceById(sourceId);
  if (!source) {
    res.status(404).send('Source not found');
    return;
  }

  const resolvedPath = path.isAbsolute(source.path)
    ? source.path
    : path.resolve(process.cwd(), source.path);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  activeStreamsCount++;
  metrics.setActiveStreams(activeStreamsCount);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'connected', sourceId })}\n\n`);

  let lastSize = 0;
  try {
    if (fs.existsSync(resolvedPath)) {
      lastSize = fs.statSync(resolvedPath).size;
    }
  } catch {}

  const pollInterval = setInterval(() => {
    try {
      if (!fs.existsSync(resolvedPath)) return;
      const stats = fs.statSync(resolvedPath);

      if (stats.size !== lastSize) {
        let addedLogs = 0;
        if (stats.size > lastSize && lastSize > 0) {
          try {
            const diff = stats.size - lastSize;
            const readLen = Math.min(diff, 256 * 1024);
            const buffer = Buffer.alloc(readLen);
            const fd = fs.openSync(resolvedPath, 'r');
            fs.readSync(fd, buffer, 0, readLen, lastSize);
            fs.closeSync(fd);
            const text = buffer.toString('utf-8');
            const lines = text.split('\n').filter((l) => l.trim().length > 0);
            addedLogs = Math.max(1, lines.length);
          } catch {
            addedLogs = 1;
          }
        }

        if (addedLogs > 0) {
          metrics.recordIngestion(addedLogs);
        }

        lastSize = stats.size;
        clearFileCache(resolvedPath);
        res.write(
          `data: ${JSON.stringify({
            type: 'file_changed',
            sourceId,
            size: stats.size,
            modifiedAt: stats.mtime.toISOString(),
            addedLogs,
          })}\n\n`
        );
      }
    } catch (err) {
      // file read err
    }
  }, 500);

  req.on('close', () => {
    clearInterval(pollInterval);
    activeStreamsCount = Math.max(0, activeStreamsCount - 1);
    metrics.setActiveStreams(activeStreamsCount);
  });
});

// Endpoint to append logs (useful for live tailing test & simulation)
app.post('/api/logs/append', (req: Request, res: Response) => {
  try {
    const { sourceId, lines } = req.body;
    const source = findSourceById(sourceId);
    if (!source) {
      res.status(404).json({ error: 'Source not found' });
      return;
    }
    const resolvedPath = path.isAbsolute(source.path)
      ? source.path
      : path.resolve(process.cwd(), source.path);

    const logLines = Array.isArray(lines) ? lines : [lines || ''];
    const content = logLines.join('\n') + '\n';
    fs.appendFileSync(resolvedPath, content, 'utf-8');
    metrics.recordIngestion(logLines.length);
    clearFileCache(resolvedPath);
    res.json({ success: true, count: logLines.length });
  } catch (err: any) {
    metrics.recordError();
    res.status(500).json({ error: err.message || 'Failed to append logs' });
  }
});

// 7. Clear log file content
app.post('/api/logs/clear', (req: Request, res: Response) => {
  try {
    const { sourceId } = req.body;
    const source = findSourceById(sourceId);
    if (!source) {
      res.status(404).json({ error: 'Source not found' });
      return;
    }

    const resolvedPath = path.isAbsolute(source.path)
      ? source.path
      : path.resolve(process.cwd(), source.path);

    if (fs.existsSync(resolvedPath)) {
      fs.writeFileSync(resolvedPath, '', 'utf-8');
      clearFileCache(resolvedPath);
    }

    res.json({ success: true, message: `Cleared ${source.name}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear file' });
  }
});

// 8. Download raw log file
app.get('/api/logs/download', (req: Request, res: Response) => {
  try {
    const sourceId = req.query.sourceId as string;
    const source = findSourceById(sourceId);
    if (!source) {
      res.status(404).send('Source not found');
      return;
    }

    const resolvedPath = path.isAbsolute(source.path)
      ? source.path
      : path.resolve(process.cwd(), source.path);

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).send('File not found on disk');
      return;
    }

    res.download(resolvedPath, path.basename(resolvedPath));
  } catch (err: any) {
    res.status(500).send(err.message || 'Failed to download file');
  }
});

// Serve frontend in production
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`[LogViewer Server] Running on http://localhost:${PORT}`);
});

// Instant graceful process termination on restart/kill to prevent port lockups
const handleShutdown = (_signal: string) => {
  metrics.stopDiskLogger();
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => {
    process.exit(0);
  }, 250).unref();
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
