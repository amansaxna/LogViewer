import fs from 'node:fs';
import path from 'node:path';
import { LogSource } from './types.ts';

const CONFIG_PATH = path.resolve(process.cwd(), 'config/log_sources.json');

// In-memory registry of custom opened log files during this session
const customSources: Map<string, LogSource> = new Map();

export function getSources(): LogSource[] {
  let standardSources: LogSource[] = [];

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      if (Array.isArray(data.sources)) {
        standardSources = data.sources;
      }
    } catch (err) {
      console.error('Failed to parse config/log_sources.json:', err);
    }
  }

  const allSources = [...standardSources, ...Array.from(customSources.values())];

  return allSources.map((source) => {
    const resolvedPath = path.isAbsolute(source.path)
      ? source.path
      : path.resolve(process.cwd(), source.path);

    let exists = false;
    let size = 0;
    let modifiedAt: string | undefined;

    try {
      if (fs.existsSync(resolvedPath)) {
        exists = true;
        const stats = fs.statSync(resolvedPath);
        size = stats.size;
        modifiedAt = stats.mtime.toISOString();
      }
    } catch {
      exists = false;
    }

    return {
      ...source,
      resolvedPath,
      exists,
      size,
      modifiedAt,
    };
  });
}

export function registerCustomSource(filePath: string, customName?: string, customCategory?: string): LogSource {
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File does not exist: ${resolvedPath}`);
  }

  const stats = fs.statSync(resolvedPath);
  const baseName = path.basename(resolvedPath);
  const id = `custom-${Buffer.from(resolvedPath).toString('base64url').slice(0, 16)}`;

  const source: LogSource = {
    id,
    name: customName || baseName,
    category: customCategory || 'Custom / Opened Files',
    path: resolvedPath,
    format: 'flat_file',
    description: `Opened local file: ${resolvedPath}`,
    isCustom: true,
    exists: true,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
  };

  customSources.set(id, source);
  return source;
}

export function removeCustomSource(id: string): boolean {
  return customSources.delete(id);
}

export function findSourceById(id: string): LogSource | undefined {
  const sources = getSources();
  return sources.find((s) => s.id === id);
}
