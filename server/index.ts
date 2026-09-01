import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { getSources, registerCustomSource, removeCustomSource, findSourceById } from './config.ts';
import { queryLogs, getContextLines, clearFileCache } from './fileReader.ts';
import { LogLevel, LogQuery } from './types.ts';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors());
app.use(express.json());

// 1. Get all log sources
app.get('/api/sources', (_req: Request, res: Response) => {
  try {
    const sources = getSources();
    res.json({ sources });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch sources' });
  }
});

// 2. Open any local file
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

// 3. Close / remove a custom source
app.delete('/api/sources/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const removed = removeCustomSource(id);
  res.json({ success: removed });
});

// 4. Query entries with filtering, search, pagination
app.get('/api/logs/entries', (req: Request, res: Response) => {
  try {
    const sourceId = req.query.sourceId as string;
    if (!sourceId) {
      res.status(400).json({ error: 'sourceId query parameter is required' });
      return;
    }

    const levelsParam = req.query.levels;
    let levels: LogLevel[] | undefined;
    if (typeof levelsParam === 'string') {
      levels = levelsParam.split(',').filter(Boolean) as LogLevel[];
    } else if (Array.isArray(levelsParam)) {
      levels = levelsParam.map(String).filter(Boolean) as LogLevel[];
    }

    const query: LogQuery = {
      sourceId,
      search: req.query.search as string | undefined,
      isRegex: req.query.isRegex === 'true',
      caseSensitive: req.query.caseSensitive === 'true',
      invert: req.query.invert === 'true',
      levels,
      namespace: req.query.namespace as string | undefined,
      workflow: req.query.workflow as string | undefined,
      operation: req.query.operation as string | undefined,
      marker: req.query.marker as string | undefined,
      sortBy: (req.query.sortBy as any) || 'time',
      direction: (req.query.direction as 'desc' | 'asc') || 'desc',
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 25000,
    };

    const result = queryLogs(query);
    res.json(result);
  } catch (err: any) {
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
        lastSize = stats.size;
        clearFileCache(resolvedPath);
        res.write(`data: ${JSON.stringify({ type: 'file_changed', sourceId, size: stats.size, modifiedAt: stats.mtime.toISOString() })}\n\n`);
      }
    } catch (err) {
      // file read err
    }
  }, 1000);

  req.on('close', () => {
    clearInterval(pollInterval);
  });
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

app.listen(PORT, () => {
  console.log(`[LogViewer Server] Running on http://localhost:${PORT}`);
});
