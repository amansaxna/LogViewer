import fs from 'node:fs';
import path from 'node:path';

// Parse CLI Arguments
const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return defaultValue;
}

const TARGET_RATE = parseInt(getArg('rate', '100'), 10); // lines per second
const MAX_SIZE_MB = parseFloat(getArg('max-size-mb', '1024')); // default 1 GB = 1024 MB
const MAX_SIZE_BYTES = Math.floor(MAX_SIZE_MB * 1024 * 1024);
const LOG_FILE = path.resolve(process.cwd(), getArg('file', 'logs/stream_100lps.log'));
const BATCH_INTERVAL_MS = parseInt(getArg('batch-ms', '100'), 10); // batch tick duration

// Calculate batch size
const LINES_PER_BATCH = Math.max(1, Math.round((TARGET_RATE * BATCH_INTERVAL_MS) / 1000));

// Ensure parent directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Ensure source registered in config/log_sources.json
const sourcesConfigPath = path.resolve(process.cwd(), 'config/log_sources.json');
try {
  if (fs.existsSync(sourcesConfigPath)) {
    const raw = fs.readFileSync(sourcesConfigPath, 'utf-8');
    const config = JSON.parse(raw);
    const relativeLogPath = './' + path.relative(process.cwd(), LOG_FILE);
    const sourceExists = config.sources?.some((s: any) => s.path === relativeLogPath || s.id === 'stream-100lps');
    if (!sourceExists && Array.isArray(config.sources)) {
      config.sources.push({
        id: 'stream-100lps',
        name: `Live Stream (${TARGET_RATE} lines/s · 1GB Cap)`,
        category: 'Live Streams',
        path: relativeLogPath,
        format: 'flat_file',
        description: `High-throughput continuous log stream emitting ${TARGET_RATE} lines/sec capped at ${MAX_SIZE_MB}MB`,
      });
      fs.writeFileSync(sourcesConfigPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log(`[StreamService] Registered log source in config/log_sources.json`);
    }
  }
} catch (e) {
  // Ignored if config not writable
}

// Log Generation Metadata & Dictionaries
const NAMESPACES = [
  'Auth.TokenProvider',
  'Auth.SessionManager',
  'Payment.StripeGateway',
  'Payment.RiskEngine',
  'Catalog.SearchEngine',
  'Order.CheckoutService',
  'Warehouse.SyncWorker',
  'Notification.Dispatcher',
  'Database.PoolManager',
  'Security.Firewall',
  'Network.IngressRouter',
  'Cache.RedisCluster',
];

const WORKFLOWS = [
  'AuthFlow',
  'OrderCheckout',
  'StripePayment',
  'StockSync',
  'WebhookEvent',
  'RiskAudit',
  'InvoiceGen',
  'HealthCheck',
];

const OPERATIONS = [
  'POST /api/v1/auth/token',
  'POST /api/v1/checkout/pay',
  'GET /api/v1/catalog/items',
  'PUT /api/v1/warehouse/reserve',
  'ExecutePayment',
  'ValidateCartToken',
  'SyncInventoryLevels',
  'FlushSessionStore',
  'DatabasePoolAcquire',
  'EmitTelemetryCheckpoint',
];

const STATUS_LEVELS: { status: string; level: string; weight: number }[] = [
  { status: 'SUCCESS', level: 'info', weight: 65 },
  { status: 'INFO', level: 'info', weight: 15 },
  { status: 'WARN', level: 'warning', weight: 10 },
  { status: 'FAILED', level: 'error', weight: 7 },
  { status: 'CRITICAL', level: 'critical', weight: 2 },
  { status: 'AUDIT', level: 'audit', weight: 1 },
];

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomStatus(): { status: string; level: string } {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const s of STATUS_LEVELS) {
    cumulative += s.weight;
    if (rand <= cumulative) return s;
  }
  return STATUS_LEVELS[0];
}

function pad(num: number, size = 2): string {
  let s = num.toString();
  while (s.length < size) s = '0' + s;
  return s;
}

let lineSequence = 0;
let totalLinesWritten = 0;
let totalTruncations = 0;
let lastReportTime = Date.now();
let linesSinceLastReport = 0;
let currentActualRate = 0;

function generateLogLine(): string {
  lineSequence++;
  const now = new Date();
  const dateStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}.${pad(now.getUTCMilliseconds(), 3)}`;
  
  const pid = 24000 + (lineSequence % 12);
  const tid = `worker-${pad((lineSequence % 32) + 1)}`;
  const correlationId = `corr-${((lineSequence % 128) + 200).toString(16)}-${((lineSequence * 19) % 65535).toString(16)}`;
  const namespace = getRandom(NAMESPACES);
  const workflow = `${getRandom(WORKFLOWS)}-${1000 + (lineSequence % 500)}`;
  const operation = getRandom(OPERATIONS);
  const { status, level } = getRandomStatus();
  const duration = `${Math.floor(Math.random() * 85) + 1}ms`;
  const location = `${namespace.replace('.', '')}.ts::${(lineSequence % 450) + 20}`;

  let message = '';
  if (status === 'SUCCESS') {
    message = `Operation ${operation} succeeded for client_${1000 + (lineSequence % 300)} (payload: {"bytes": ${Math.floor(Math.random() * 1200) + 40}, "status": 200, "cacheHit": ${lineSequence % 3 === 0}})`;
  } else if (status === 'WARN') {
    message = `Latency advisory: ${operation} execution exceeded SLA threshold (took ${duration})`;
  } else if (status === 'FAILED') {
    message = `Downstream dependency failure during ${operation}: connection timeout from host 10.0.${lineSequence % 255}.${(lineSequence * 3) % 255}`;
  } else if (status === 'CRITICAL') {
    message = `EMERGENCY: Payment gateway connection refused on port 443 during ${operation}`;
  } else if (status === 'AUDIT') {
    message = `SECURITY AUDIT: User identity token verified with scopes ["read:orders", "write:checkout"]`;
  } else {
    message = `Heartbeat checkpoint: system healthy, memory nominal`;
  }

  // Format line standard:
  return `[${dateStr}] [${pid}] [${tid}] [${correlationId}] [${namespace}] [${workflow}] [${operation}] [${status}] [${duration}] ${message} [${location}]`;
}

// Truncation Management (Cap at 1 GB)
function checkAndTruncateFileIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const stats = fs.statSync(LOG_FILE);
    if (stats.size >= MAX_SIZE_BYTES) {
      totalTruncations++;
      const currentMb = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`\n⚠️  [StreamService] File size (${currentMb} MB) reached max cap (${MAX_SIZE_MB} MB).`);
      console.log(`🔄 [StreamService] Truncating log file to start fresh cycle while maintaining stream...`);

      // Truncate file cleanly
      fs.truncateSync(LOG_FILE, 0);

      // Write truncation header line
      const headerLine = `[${new Date().toISOString()}] [INFO] [System.Truncator] [LogRoll-1GB] [FileTruncate] [corr-roll-${totalTruncations}] (0ms) Log file reached 1GB threshold (${currentMb} MB) - truncated to 0MB for continuous streaming [log_stream_service.ts::1]\n`;
      fs.appendFileSync(LOG_FILE, headerLine, 'utf-8');
      console.log(`✅ [StreamService] Truncation #${totalTruncations} complete.\n`);
    }
  } catch (err) {
    console.error(`[StreamService] Truncation error:`, err);
  }
}

// Banner
console.log('='.repeat(78));
console.log(`🚀 [LogStreamService] Continuous High-Throughput Log Writer`);
console.log(`📍 Target File       : ${LOG_FILE}`);
console.log(`⚡ Target Rate       : ${TARGET_RATE} lines/second (${LINES_PER_BATCH} lines every ${BATCH_INTERVAL_MS}ms)`);
console.log(`📦 Max File Cap      : ${MAX_SIZE_MB} MB (${(MAX_SIZE_BYTES / 1024 / 1024 / 1024).toFixed(2)} GB) with auto-truncation`);
console.log('='.repeat(78));

// Batch writer loop
const writeInterval = setInterval(() => {
  try {
    const batchLines: string[] = [];
    for (let i = 0; i < LINES_PER_BATCH; i++) {
      batchLines.push(generateLogLine());
    }

    const payload = batchLines.join('\n') + '\n';
    fs.appendFileSync(LOG_FILE, payload, 'utf-8');

    totalLinesWritten += LINES_PER_BATCH;
    linesSinceLastReport += LINES_PER_BATCH;

    // Check size cap every ~50 batches
    if (totalLinesWritten % (LINES_PER_BATCH * 50) === 0) {
      checkAndTruncateFileIfNeeded();
    }
  } catch (err) {
    console.error(`[StreamService] Write error:`, err);
  }
}, BATCH_INTERVAL_MS);

// Telemetry reporter loop (every 1 second)
const reportInterval = setInterval(() => {
  const now = Date.now();
  const elapsedSec = (now - lastReportTime) / 1000;
  if (elapsedSec >= 0.9) {
    currentActualRate = Math.round(linesSinceLastReport / elapsedSec);
    linesSinceLastReport = 0;
    lastReportTime = now;

    let fileSizeMb = '0.00';
    let percentCap = '0.0%';
    try {
      if (fs.existsSync(LOG_FILE)) {
        const bytes = fs.statSync(LOG_FILE).size;
        fileSizeMb = (bytes / 1024 / 1024).toFixed(2);
        percentCap = ((bytes / MAX_SIZE_BYTES) * 100).toFixed(2) + '%';
      }
    } catch {}

    process.stdout.write(
      `\r⚡ Rate: ${currentActualRate} lines/s | Total Written: ${totalLinesWritten.toLocaleString()} lines | Size: ${fileSizeMb} MB / ${MAX_SIZE_MB} MB (${percentCap}) | Truncations: ${totalTruncations} `
    );
  }
}, 1000);

// Graceful Shutdown
function handleShutdown() {
  clearInterval(writeInterval);
  clearInterval(reportInterval);
  console.log(`\n\n🛑 [StreamService] Stopped. Total lines written: ${totalLinesWritten.toLocaleString()}`);
  process.exit(0);
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
