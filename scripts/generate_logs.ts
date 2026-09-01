import fs from 'node:fs';
import path from 'node:path';

const LOG_FILE = path.resolve(process.cwd(), 'logs/app_workflow.log');

const NAMESPACES = [
  'Auth.TokenProvider',
  'Auth.SessionManager',
  'Catalog.Inventory',
  'Catalog.SearchEngine',
  'Order.Checkout',
  'Order.Validator',
  'Payment.StripeGateway',
  'Payment.PayPalVault',
  'Payment.RiskEngine',
  'Warehouse.Dispatcher',
  'Warehouse.SyncWorker',
  'Notification.Email',
  'Notification.SMS',
  'Reports.Telemetry',
  'Database.PoolManager',
  'Security.Firewall',
  'Security.AuditLogger',
];

const WORKFLOWS = [
  'WF:UserLogin',
  'WF:OrderCheckout',
  'WF:StockSync',
  'WF:MonthlyReport',
  'WF:WebhookDispatch',
  'WF:PasswordReset',
  'WF:RefundProcess',
  'WF:InventoryAudit',
];

const OPERATIONS = [
  'POST /api/auth/token',
  'GET /api/products/search',
  'POST /api/checkout/finalize',
  'POST /api/payment/charge',
  'ValidateCart',
  'ReserveInventory',
  'CaptureFunds',
  'RollbackInventory',
  'SendReceiptEmail',
  'SyncStockLevels',
  'HealthCheck',
  'RateLimitCheck',
  'AuditRecordWrite',
  'PurgeStaleSessions',
  'DispatchPartnerEvent',
  'CompileMonthlyMetrics',
];

const STATUSES = [
  { status: 'SUCCESS', level: 'info', weight: 70 },
  { status: 'INFO', level: 'info', weight: 12 },
  { status: 'WARN', level: 'warning', weight: 8 },
  { status: 'FAILED', level: 'error', weight: 6 },
  { status: 'PENDING', level: 'notice', weight: 3 },
  { status: 'CRITICAL', level: 'critical', weight: 1 },
];

const FILE_LOCATIONS = [
  'AuthTokenProvider.ts::88',
  'SessionStore.ts::42',
  'InventoryCatalog.ts::201',
  'CartValidator.ts::56',
  'WarehouseDispatcher.ts::112',
  'StripeGateway.ts::345',
  'OrderService.ts::420',
  'MailerService.ts::78',
  'SyncWorker.ts::140',
  'PaymentVault.go::78',
  'RiskAnalyzer.py::114',
  'PoolManager.ts::95',
  'WebhookClient.ts::198',
  'ReportEngine.ts::310',
  'RateLimiter.ts::84',
];

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomStatus(): { status: string; level: string } {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const s of STATUSES) {
    cumulative += s.weight;
    if (rand <= cumulative) return s;
  }
  return STATUSES[0];
}

function pad(num: number, size = 2): string {
  let s = num.toString();
  while (s.length < size) s = '0' + s;
  return s;
}

function generateLines(count = 5200): string {
  const lines: string[] = [];
  let currentTime = new Date('2026-09-02T00:00:00.000Z').getTime();

  for (let i = 1; i <= count; i++) {
    // advance time by 10ms to 450ms
    currentTime += Math.floor(Math.random() * 440) + 10;
    const dateObj = new Date(currentTime);
    const dateStr = `${dateObj.getUTCFullYear()}-${pad(dateObj.getUTCMonth() + 1)}-${pad(dateObj.getUTCDate())} ${pad(dateObj.getUTCHours())}:${pad(dateObj.getUTCMinutes())}:${pad(dateObj.getUTCSeconds())}.${pad(dateObj.getUTCMilliseconds(), 3)}`;

    const pid = 18900 + (i % 8);
    const tid = `thread-${pad((i % 24) + 1)}`;
    const namespace = getRandom(NAMESPACES);
    const wfBase = getRandom(WORKFLOWS);
    const workflow = `${wfBase}-${1000 + (i % 200)}`;
    const operation = getRandom(OPERATIONS);
    const { status, level } = getRandomStatus();
    const duration = `${Math.floor(Math.random() * 350) + 2}ms`;
    const location = getRandom(FILE_LOCATIONS);

    // Dynamic message
    let message = '';
    if (status === 'SUCCESS') {
      message = `Operation ${operation} completed successfully for session user_${1000 + (i % 500)} (payload: ${Math.floor(Math.random() * 800) + 20} bytes)`;
    } else if (status === 'WARN') {
      message = `High response latency detected during ${operation}: threshold 200ms exceeded`;
    } else if (status === 'FAILED') {
      message = `Operation ${operation} failed: connection reset by peer downstream`;
    } else if (status === 'CRITICAL') {
      message = `Fatal security or resource exception during ${operation}: immediate intervention needed`;
    } else if (status === 'PENDING') {
      message = `Transaction queued for two-phase commit verification`;
    } else {
      message = `Telemetry checkpoint: worker alive, memory footprint nominal`;
    }

    // Every ~150 lines, test edge cases (missing brackets or partial fields)
    if (i % 140 === 0) {
      // Partial format: no datetime
      lines.push(`[${pid}] [${tid}] [${namespace}] [${operation}] [${status}] ${message} [${location}]`);
    } else if (i % 180 === 0) {
      // Raw log line without brackets
      lines.push(`[INFO] Daemon background flush finished for partition ${(i % 16) + 1} in 3.4ms`);
    } else {
      // Standard full flat file line:
      // [Datetime] [Process ID] [Thread ID] [Namespace] [WorkflowMarkers] [operations] [Status] [Duration] Message [FileName::LineNumner]
      lines.push(`[${dateStr}] [${pid}] [${tid}] [${namespace}] [${workflow}] [${operation}] [${status}] [${duration}] ${message} [${location}]`);
    }

    // If FAILED or CRITICAL, add occasional realistic stack trace
    if ((status === 'FAILED' || status === 'CRITICAL') && i % 3 === 0) {
      lines.push(`    Trace: ServiceException: Failed to execute operation ${operation}`);
      lines.push(`        at HttpClient.execute (/app/dist/HttpClient.js:142:15)`);
      lines.push(`        at async ${namespace.replace('.', '')}.dispatch (/app/dist/${location.split('::')[0]}:${location.split('::')[1]}:12)`);
      lines.push(`        at async WorkerPool.processJob (/app/dist/WorkerPool.js:230:9)`);
    }
  }

  return lines.join('\n');
}

console.log('Generating 5,200 log lines...');
const content = generateLines(5200);
fs.writeFileSync(LOG_FILE, content, 'utf-8');
console.log(`Successfully written 5,200 lines to ${LOG_FILE} (Size: ${(content.length / 1024 / 1024).toFixed(2)} MB)`);
