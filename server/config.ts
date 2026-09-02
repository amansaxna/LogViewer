import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LogSource, LogFolderConfig, LogPreset } from './types.ts';

const CONFIG_PATH = path.resolve(process.cwd(), 'config/log_sources.json');
const PRESETS_PATH = path.resolve(process.cwd(), 'config/presets.json');

// In-memory registry of custom opened log files during this session
const customSources: Map<string, LogSource> = new Map();

/**
 * Detects whether a filename represents a rotated archive of an active log file.
 */
export function detectRotation(filename: string): { isRotated: boolean; baseName: string; suffix: string } {
  // Pattern 1: name.log.1, name.log.2, name.log.2026-09-01
  const dotNumMatch = filename.match(/^(.+?\.log)\.(\d+|[\d-]+(?:\.\d+)?)$/i);
  if (dotNumMatch) {
    return {
      isRotated: true,
      baseName: dotNumMatch[1],
      suffix: `.${dotNumMatch[2]}`,
    };
  }

  // Pattern 2: name.2026-09-01.log or name-20260901.log
  const dateMatch = filename.match(/^(.+?)[._-](\d{4}[-_]?\d{2}[-_]?\d{2}(?:[._-]\d+)?)\.log$/i);
  if (dateMatch) {
    return {
      isRotated: true,
      baseName: `${dateMatch[1]}.log`,
      suffix: dateMatch[2],
    };
  }

  // Pattern 3: name.1.log
  const numBeforeLogMatch = filename.match(/^(.+?)\.(\d{1,4})\.log$/i);
  if (numBeforeLogMatch) {
    return {
      isRotated: true,
      baseName: `${numBeforeLogMatch[1]}.log`,
      suffix: `.${numBeforeLogMatch[2]}`,
    };
  }

  return {
    isRotated: false,
    baseName: filename,
    suffix: '',
  };
}

/**
 * Recursively scans a directory for log files and rotated archives.
 */
export function scanFolderRecursively(
  dirPath: string,
  category = 'Discovered Logs',
  recursive = true,
  visited = new Set<string>()
): LogSource[] {
  const resolvedDir = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath);
  if (!fs.existsSync(resolvedDir) || visited.has(resolvedDir)) {
    return [];
  }
  visited.add(resolvedDir);

  const results: LogSource[] = [];

  try {
    const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(resolvedDir, entry.name);

      // Skip temp files, hidden files, node_modules, .git, etc.
      if (entry.name.startsWith('pasted_') || entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory() && recursive) {
        if (
          entry.name !== 'node_modules' &&
          entry.name !== '.git' &&
          entry.name !== 'dist' &&
          entry.name !== '.gemini'
        ) {
          results.push(...scanFolderRecursively(fullPath, category, recursive, visited));
        }
      } else if (entry.isFile()) {
        const rot = detectRotation(entry.name);
        const isLog =
          entry.name.endsWith('.log') ||
          entry.name.endsWith('.txt') ||
          entry.name.endsWith('.jsonl') ||
          entry.name.endsWith('.out') ||
          rot.isRotated;

        if (isLog) {
          const stats = fs.statSync(fullPath);
          const hash = crypto.createHash('md5').update(fullPath).digest('hex').slice(0, 10);
          const id = `disc-${hash}`;

          // Create human-friendly name
          const displayName = entry.name
            .replace(/[._-]log(\.\d+)?$/i, '')
            .replace(/[._-]/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

          results.push({
            id,
            name: `${displayName} (${entry.name})`,
            category,
            path: fullPath,
            format: 'flat_file',
            description: `Discovered file: ${fullPath}`,
            exists: true,
            size: stats.size,
            modifiedAt: stats.mtime.toISOString(),
            isRotated: rot.isRotated,
            rotationSuffix: rot.suffix,
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${resolvedDir}:`, err);
  }

  return results;
}

/**
 * Returns all configured, discovered, and custom log sources.
 * Automatically scans folders recursively and attaches rotated archives to parent sources.
 */
export function getSources(): LogSource[] {
  let standardSources: LogSource[] = [];
  let configuredFolders: LogFolderConfig[] = [];

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      if (Array.isArray(data.sources)) {
        standardSources = data.sources;
      }
      if (Array.isArray(data.folders)) {
        configuredFolders = data.folders;
      }
    } catch (err) {
      console.error('Failed to parse config/log_sources.json:', err);
    }
  }

  // 1. Process configured standard sources
  const resolvedStandard: LogSource[] = standardSources.map((source) => {
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
      path: resolvedPath,
      exists,
      size,
      modifiedAt,
      rotations: [],
    };
  });

  // 2. Discover sources from configured folders
  const discoveredMap = new Map<string, LogSource>();
  const knownPaths = new Set<string>(resolvedStandard.map((s) => s.path));

  for (const folder of configuredFolders) {
    const discovered = scanFolderRecursively(
      folder.path,
      folder.category || 'Discovered Logs',
      folder.recursive !== false
    );

    for (const disc of discovered) {
      if (!knownPaths.has(disc.path)) {
        discoveredMap.set(disc.path, disc);
        knownPaths.add(disc.path);
      }
    }
  }

  // Also check if any standard source was declared with isFolder: true or points to a folder
  for (const source of resolvedStandard) {
    if (source.isFolder || (source.exists && fs.statSync(source.path).isDirectory())) {
      const discovered = scanFolderRecursively(
        source.path,
        source.category || 'Discovered Logs',
        source.recursive !== false
      );
      for (const disc of discovered) {
        if (!knownPaths.has(disc.path)) {
          discoveredMap.set(disc.path, disc);
          knownPaths.add(disc.path);
        }
      }
    }
  }

  // 3. Map base filenames to parent sources to attach rotations
  const baseNameToParent = new Map<string, LogSource>();
  for (const source of resolvedStandard) {
    baseNameToParent.set(path.basename(source.path), source);
  }
  for (const disc of discoveredMap.values()) {
    if (!disc.isRotated) {
      baseNameToParent.set(path.basename(disc.path), disc);
    }
  }

  // 4. Attach rotated files to their parents
  const unattachedDiscovered: LogSource[] = [];

  for (const disc of discoveredMap.values()) {
    const filename = path.basename(disc.path);
    const rotInfo = detectRotation(filename);

    if (rotInfo.isRotated && baseNameToParent.has(rotInfo.baseName)) {
      const parent = baseNameToParent.get(rotInfo.baseName)!;
      disc.id = `${parent.id}-rot-${rotInfo.suffix.replace(/[^a-zA-Z0-9_-]/g, '')}`;
      disc.isRotated = true;
      disc.rotationParentId = parent.id;
      disc.rotationSuffix = rotInfo.suffix;
      disc.name = filename; // Clean rotation name (e.g. app_workflow.log.1)
      parent.rotations = parent.rotations || [];
      parent.rotations.push(disc);
    } else {
      unattachedDiscovered.push(disc);
    }
  }

  // Sort each parent's rotations by modification time or suffix descending
  for (const parent of baseNameToParent.values()) {
    if (parent.rotations && parent.rotations.length > 0) {
      parent.rotations.sort((a, b) => (b.modifiedAt || '').localeCompare(a.modifiedAt || ''));
    }
  }

  // 5. Combine: standard sources + unattached discovered files + custom sources
  const customList = Array.from(customSources.values()).map((cs) => {
    const stats = fs.statSync(cs.path);
    return {
      ...cs,
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      rotations: [],
    };
  });

  return [...resolvedStandard, ...unattachedDiscovered, ...customList];
}

export function registerCustomSource(
  filePath: string,
  customName?: string,
  customCategory?: string
): LogSource {
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File does not exist: ${resolvedPath}`);
  }

  const stats = fs.statSync(resolvedPath);
  const baseName = path.basename(resolvedPath);
  const hash = crypto.createHash('md5').update(resolvedPath).digest('hex').slice(0, 10);
  const id = `custom-${hash}`;

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
    rotations: [],
  };

  customSources.set(id, source);
  return source;
}

export function removeCustomSource(id: string): boolean {
  return customSources.delete(id);
}

/**
 * Finds a source by ID across standard sources, discovered sources, custom sources, and rotation children.
 */
export function findSourceById(id: string): LogSource | undefined {
  const sources = getSources();

  for (const source of sources) {
    if (source.id === id) return source;
    if (source.rotations) {
      const match = source.rotations.find((r) => r.id === id);
      if (match) return match;
    }
  }

  return undefined;
}

/**
 * Loads all presets from config/presets.json.
 */
export function getPresets(): LogPreset[] {
  if (!fs.existsSync(PRESETS_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(PRESETS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.presets) ? parsed.presets : [];
  } catch (err) {
    console.error('Failed to read config/presets.json:', err);
    return [];
  }
}

/**
 * Creates or updates a preset in config/presets.json.
 */
export function savePreset(preset: LogPreset): LogPreset {
  const current = getPresets();
  const existingIdx = current.findIndex((p) => p.id === preset.id);

  if (existingIdx >= 0) {
    current[existingIdx] = { ...preset };
  } else {
    current.push(preset);
  }

  fs.writeFileSync(PRESETS_PATH, JSON.stringify({ presets: current }, null, 2), 'utf-8');
  return preset;
}

/**
 * Deletes a preset by ID from config/presets.json.
 */
export function deletePreset(id: string): boolean {
  const current = getPresets();
  const filtered = current.filter((p) => p.id !== id);
  if (filtered.length === current.length) {
    return false;
  }
  fs.writeFileSync(PRESETS_PATH, JSON.stringify({ presets: filtered }, null, 2), 'utf-8');
  return true;
}

