---
name: monitoring
description: Application monitoring and observability — structured logging (pino), metrics collection, health checks, alerting, APM, distributed tracing, log aggregation, uptime monitoring, error tracking, dashboard patterns, and observability for Node.js applications
---

# Monitoring (Logs, Metrics, Alerting)

## Structured Logging

### Pino (Node.js)

```typescript
import pino from 'pino';

// Create logger
const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    // Pretty print in development
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    // Base fields included in every log
    base: {
        service: 'quotation-app',
        version: process.env.APP_VERSION ?? '0.0.0',
        env: process.env.NODE_ENV,
    },
    // Timestamp format
    timestamp: pino.stdTimeFunctions.isoTime,
    // Custom log levels
    customLevels: {
        fatal: 60,
        error: 50,
        warn: 40,
        info: 30,
        debug: 20,
        trace: 10,
        audit: 35,
    },
});

// Basic logging
logger.info('Server started');
logger.info({ port: 3000, host: '0.0.0.0' }, 'Server listening');
logger.warn({ memoryUsage: process.memoryUsage() }, 'High memory usage');
logger.error({ err: new Error('DB connection failed') }, 'Database error');
logger.debug({ query, duration }, 'Query executed');

// Child logger with context
const requestLogger = logger.child({ requestId: 'req-123', userId: 'user-456' });
requestLogger.info({ action: 'create_quotation' }, 'Quotation created');
// Output: { requestId: "req-123", userId: "user-456", action: "create_quotation", msg: "Quotation created", ... }
```

### Request Logging Middleware

```typescript
import { randomUUID } from 'crypto';
import pino from 'pino';
import type { Request, Response, NextFunction } from 'express';

const logger = pino();

// Attach request-scoped logger and log request/response
function requestLogger(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] as string ?? randomUUID();
    const start = performance.now();

    // Child logger with request context
    req.log = logger.child({
        requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
    });

    // Log request
    req.log.info({
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
    }, 'Incoming request');

    // Log response on finish
    res.on('finish', () => {
        const duration = performance.now() - start;
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

        req.log[level]({
            statusCode: res.statusCode,
            duration: Math.round(duration),
            contentLength: res.get('content-length'),
        }, 'Request completed');
    });

    // Set response header
    res.setHeader('X-Request-Id', requestId);
    next();
}

// Sanitize body — remove sensitive fields
function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
    if (!body || typeof body !== 'object') return body;
    const sensitive = ['password', 'token', 'secret', 'creditCard', 'ssn'];
    const sanitized = { ...body };
    for (const key of sensitive) {
        if (key in sanitized) sanitized[key] = '[REDACTED]';
    }
    return sanitized;
}

// Usage
app.use(requestLogger);
```

### Log Correlation (Distributed Tracing)

```typescript
// Propagate trace IDs across services
function createTraceLogger(traceId: string, spanId: string) {
    return logger.child({ traceId, spanId });
}

// Extract trace from incoming headers
function extractTrace(req: Request): { traceId: string; spanId: string } {
    return {
        traceId: req.headers['x-trace-id'] as string ?? randomUUID(),
        spanId: randomUUID(),
    };
}

// Forward trace to outgoing requests
function fetchWithTrace(url: string, traceId: string, spanId: string, options: RequestInit = {}) {
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'X-Trace-Id': traceId,
            'X-Parent-Span-Id': spanId,
        },
    });
}
```

## Health Checks

### Basic Health Endpoint

```typescript
import type { Request, Response } from 'express';

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    checks: {
        database: HealthCheck;
        redis: HealthCheck;
        memory: HealthCheck;
        disk?: HealthCheck;
    };
}

interface HealthCheck {
    status: 'up' | 'down';
    latencyMs?: number;
    details?: Record<string, unknown>;
    error?: string;
}

async function healthCheck(_req: Request, res: Response) {
    const checks: HealthStatus['checks'] = {
        database: await checkDatabase(),
        redis: await checkRedis(),
        memory: checkMemory(),
    };

    const allUp = Object.values(checks).every(c => c.status === 'up');
    const anyDown = Object.values(checks).some(c => c.status === 'down');

    const status: HealthStatus['status'] = allUp
        ? 'healthy'
        : anyDown
            ? 'unhealthy'
            : 'degraded';

    const response: HealthStatus = {
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.APP_VERSION ?? '0.0.0',
        checks,
    };

    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(response);
}

async function checkDatabase(): Promise<HealthCheck> {
    const start = performance.now();
    try {
        await db.raw('SELECT 1');
        return { status: 'up', latencyMs: Math.round(performance.now() - start) };
    } catch (err: any) {
        return { status: 'down', error: err.message };
    }
}

async function checkRedis(): Promise<HealthCheck> {
    const start = performance.now();
    try {
        await redis.ping();
        return { status: 'up', latencyMs: Math.round(performance.now() - start) };
    } catch (err: any) {
        return { status: 'down', error: err.message };
    }
}

function checkMemory(): HealthCheck {
    const usage = process.memoryUsage();
    const maxHeap = 512 * 1024 * 1024; // 512MB threshold
    return {
        status: usage.heapUsed < maxHeap ? 'up' : 'down',
        details: {
            heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
            rssMB: Math.round(usage.rss / 1024 / 1024),
            externalMB: Math.round(usage.external / 1024 / 1024),
        },
    };
}

// Routes
app.get('/health', healthCheck);
app.get('/ready', async (_req, res) => {
    // Readiness — is app ready to receive traffic?
    const db = await checkDatabase();
    if (db.status === 'down') return res.status(503).json({ ready: false });
    res.json({ ready: true });
});
app.get('/live', (_req, res) => {
    // Liveness — is the process alive? (no external deps)
    res.json({ alive: true, uptime: process.uptime() });
});
```

## Metrics Collection

### Custom Metrics (Prometheus Format)

```typescript
// Simple in-process metrics — expose as /metrics endpoint
class Metrics {
    private counters: Map<string, number> = new Map();
    private gauges: Map<string, number> = new Map();
    private histograms: Map<string, number[]> = new Map();

    // Counter — monotonically increasing (requests, errors, bytes)
    increment(name: string, value = 1, labels?: Record<string, string>): void {
        const key = this.labelKey(name, labels);
        this.counters.set(key, (this.counters.get(key) ?? 0) + value);
    }

    // Gauge — can go up or down (active connections, queue size)
    gauge(name: string, value: number, labels?: Record<string, string>): void {
        const key = this.labelKey(name, labels);
        this.gauges.set(key, value);
    }

    // Histogram — observe a value (request duration, response size)
    observe(name: string, value: number, labels?: Record<string, string>): void {
        const key = this.labelKey(name, labels);
        const values = this.histograms.get(key) ?? [];
        values.push(value);
        this.histograms.set(key, values);
    }

    // Timing helper
    async measure<T>(name: string, fn: () => Promise<T>, labels?: Record<string, string>): Promise<T> {
        const start = performance.now();
        try {
            const result = await fn();
            this.observe(`${name}_duration_ms`, performance.now() - start, labels);
            this.increment(`${name}_total`, 1, { ...labels, status: 'success' });
            return result;
        } catch (err) {
            this.observe(`${name}_duration_ms`, performance.now() - start, labels);
            this.increment(`${name}_total`, 1, { ...labels, status: 'error' });
            throw err;
        }
    }

    // Export in Prometheus exposition format
    export(): string {
        const lines: string[] = [];

        for (const [key, value] of this.counters) {
            lines.push(`# TYPE ${key.split('{')[0]} counter`);
            lines.push(`${key} ${value}`);
        }

        for (const [key, value] of this.gauges) {
            lines.push(`# TYPE ${key.split('{')[0]} gauge`);
            lines.push(`${key} ${value}`);
        }

        for (const [key, values] of this.histograms) {
            const name = key.split('{')[0];
            const sum = values.reduce((a, b) => a + b, 0);
            const count = values.length;
            const avg = count > 0 ? sum / count : 0;
            const p50 = this.percentile(values, 50);
            const p95 = this.percentile(values, 95);
            const p99 = this.percentile(values, 99);

            lines.push(`# TYPE ${name} summary`);
            lines.push(`${name}_sum ${Math.round(sum)}`);
            lines.push(`${name}_count ${count}`);
            lines.push(`${name}_avg ${Math.round(avg)}`);
            lines.push(`${name}{quantile="0.5"} ${Math.round(p50)}`);
            lines.push(`${name}{quantile="0.95"} ${Math.round(p95)}`);
            lines.push(`${name}{quantile="0.99"} ${Math.round(p99)}`);
        }

        return lines.join('\n');
    }

    private labelKey(name: string, labels?: Record<string, string>): string {
        if (!labels || Object.keys(labels).length === 0) return name;
        const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
        return `${name}{${labelStr}}`;
    }

    private percentile(sorted: number[], p: number): number {
        const arr = [...sorted].sort((a, b) => a - b);
        const idx = Math.ceil((p / 100) * arr.length) - 1;
        return arr[idx] ?? 0;
    }
}

const metrics = new Metrics();

// Metrics endpoint (Prometheus scraping)
app.get('/metrics', (_req, res) => {
    res.type('text/plain').send(metrics.export());
});
```

### Application Metrics Middleware

```typescript
// Track HTTP metrics automatically
function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
    const start = performance.now();

    // Track active connections
    metrics.gauge('http_active_connections', 1);
    metrics.increment('http_requests_total', 1, {
        method: req.method,
        path: normalizePath(req.path),
    });

    res.on('finish', () => {
        const duration = performance.now() - start;
        metrics.gauge('http_active_connections', -1);
        metrics.observe('http_request_duration_ms', duration, {
            method: req.method,
            path: normalizePath(req.path),
            status: String(res.statusCode),
        });
        metrics.increment('http_responses_total', 1, {
            method: req.method,
            status: String(res.statusCode),
        });
    });

    next();
}

function normalizePath(path: string): string {
    // Replace dynamic segments for consistent metric labels
    return path
        .replace(/\/\d+/g, '/:id')
        .replace(/\/[a-f0-9-]{36}/g, '/:uuid');
    // /users/123/quotes → /users/:id/quotes
}

app.use(metricsMiddleware);
```

### Business Metrics

```typescript
// Track domain-specific events
function trackQuotationCreated(data: { userId: string; totalItems: number; totalValue: number }) {
    metrics.increment('quotation_created_total', 1);
    metrics.observe('quotation_items_count', data.totalItems);
    metrics.observe('quotation_value', data.totalValue);
    logger.info({
        event: 'quotation_created',
        userId: data.userId,
        totalItems: data.totalItems,
        totalValue: data.totalValue,
    }, 'Quotation created');
}

function trackUserRegistration(method: 'email' | 'google' | 'github') {
    metrics.increment('user_registered_total', 1, { method });
    logger.info({ event: 'user_registered', method }, 'User registered');
}

function trackPaymentProcessed(data: { amount: number; currency: string; gateway: string; status: 'success' | 'failed' }) {
    metrics.increment('payment_processed_total', 1, {
        gateway: data.gateway,
        status: data.status,
        currency: data.currency,
    });
    metrics.observe('payment_amount', data.amount, { currency: data.currency });
    logger.info({ event: 'payment_processed', ...data }, 'Payment processed');
}
```

## Alerting

### Alert Rules (Config)

```typescript
// Define alerting thresholds
interface AlertRule {
    name: string;
    condition: () => boolean | Promise<boolean>;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    cooldown: number; // seconds between alerts
    channels: ('log' | 'webhook' | 'email')[];
}

const alertRules: AlertRule[] = [
    {
        name: 'high_error_rate',
        condition: async () => {
            const errorCount = getCount('http_responses_total', { status: '5xx' });
            const totalCount = getCount('http_responses_total');
            return totalCount > 100 && (errorCount / totalCount) > 0.05; // >5% error rate
        },
        message: 'Error rate exceeds 5% in the last 5 minutes',
        severity: 'critical',
        cooldown: 300,
        channels: ['log', 'webhook'],
    },
    {
        name: 'high_memory',
        condition: () => {
            const mem = process.memoryUsage();
            return mem.heapUsed > 400 * 1024 * 1024; // >400MB
        },
        message: 'Heap memory usage exceeds 400MB',
        severity: 'warning',
        cooldown: 600,
        channels: ['log'],
    },
    {
        name: 'slow_responses',
        condition: async () => {
            const p95 = getPercentile('http_request_duration_ms', 95);
            return p95 > 2000; // p95 > 2 seconds
        },
        message: 'P95 response time exceeds 2 seconds',
        severity: 'warning',
        cooldown: 300,
        channels: ['log'],
    },
    {
        name: 'database_latency',
        condition: async () => {
            const start = performance.now();
            await db.raw('SELECT 1');
            return performance.now() - start > 500; // >500ms
        },
        message: 'Database latency exceeds 500ms',
        severity: 'critical',
        cooldown: 300,
        channels: ['log', 'webhook'],
    },
];

// Alert runner
class AlertManager {
    private lastFired: Map<string, number> = new Map();

    async checkAll(): Promise<void> {
        for (const rule of alertRules) {
            try {
                const triggered = await rule.condition();
                const lastFire = this.lastFired.get(rule.name) ?? 0;
                const now = Date.now();

                if (triggered && (now - lastFire) > rule.cooldown * 1000) {
                    this.lastFired.set(rule.name, now);
                    await this.fireAlert(rule);
                }
            } catch (err) {
                logger.error({ err, rule: rule.name }, 'Alert check failed');
            }
        }
    }

    private async fireAlert(rule: AlertRule): Promise<void> {
        logger.warn({
            alert: rule.name,
            severity: rule.severity,
            message: rule.message,
        }, `ALERT: ${rule.message}`);

        if (rule.channels.includes('webhook')) {
            await this.sendWebhook(rule);
        }
    }

    private async sendWebhook(rule: AlertRule): Promise<void> {
        const webhookUrl = process.env.ALERT_WEBHOOK_URL;
        if (!webhookUrl) return;

        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alert: rule.name,
                    severity: rule.severity,
                    message: rule.message,
                    timestamp: new Date().toISOString(),
                    service: 'quotation-app',
                }),
            });
        } catch (err) {
            logger.error({ err }, 'Failed to send alert webhook');
        }
    }
}

// Run alerts every 30 seconds
const alertManager = new AlertManager();
setInterval(() => alertManager.checkAll(), 30_000);
```

### Slack/Discord Alert

```typescript
async function sendSlackAlert(
    webhookUrl: string,
    alert: { name: string; severity: string; message: string },
): Promise<void> {
    const emoji = alert.severity === 'critical' ? ':rotating_light:' : ':warning:';
    const color = alert.severity === 'critical' ? 'danger' : 'warning';

    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: `${emoji} ALERT: ${alert.name}`,
            attachments: [{
                color,
                fields: [
                    { title: 'Alert', value: alert.name, short: true },
                    { title: 'Severity', value: alert.severity, short: true },
                    { title: 'Message', value: alert.message, short: false },
                    { title: 'Time', value: new Date().toISOString(), short: true },
                    { title: 'Service', value: 'quotation-app', short: true },
                ],
            }],
        }),
    });
}

async function sendDiscordAlert(
    webhookUrl: string,
    alert: { name: string; severity: string; message: string },
): Promise<void> {
    const color = alert.severity === 'critical' ? 15158332 : 16776960;

    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            embeds: [{
                title: `ALERT: ${alert.name}`,
                description: alert.message,
                color,
                fields: [
                    { name: 'Severity', value: alert.severity, inline: true },
                    { name: 'Service', value: 'quotation-app', inline: true },
                    { name: 'Time', value: new Date().toISOString(), inline: true },
                ],
            }],
        }),
    });
}
```

## Error Tracking

### Error Capture

```typescript
// Global error handlers
process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — process will exit');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled rejection');
});

// Express error middleware
function errorTracker(err: Error, req: any, res: any, _next: any) {
    const errorId = randomUUID();

    logger.error({
        errorId,
        err,
        method: req.method,
        path: req.path,
        body: sanitizeBody(req.body),
        userId: req.user?.id,
        requestId: req.headers['x-request-id'],
    }, `Unhandled error: ${err.message}`);

    // Send to external error tracker (Sentry, etc.)
    // captureException(err, { tags: { errorId } });

    res.status(500).json({
        error: 'Internal server error',
        errorId,
        requestId: req.headers['x-request-id'],
    });
}
```

## Process Monitoring

### System Metrics Collection

```typescript
// Collect and expose process metrics
function collectProcessMetrics(): void {
    // Memory
    const mem = process.memoryUsage();
    metrics.gauge('process_heap_used_bytes', mem.heapUsed);
    metrics.gauge('process_heap_total_bytes', mem.heapTotal);
    metrics.gauge('process_rss_bytes', mem.rss);
    metrics.gauge('process_external_bytes', mem.external);

    // CPU
    const cpuUsage = process.cpuUsage();
    metrics.gauge('process_cpu_user_ms', cpuUsage.user);
    metrics.gauge('process_cpu_system_ms', cpuUsage.system);

    // Event loop lag
    const start = performance.now();
    setImmediate(() => {
        const lag = performance.now() - start;
        metrics.observe('event_loop_lag_ms', lag);
    });

    // Active handles (timers, sockets, servers)
    metrics.gauge('process_active_handles', (process as any)._getActiveHandles().length);
    metrics.gauge('process_active_requests', (process as any)._getActiveRequests().length);

    // GC stats (if --expose-gc flag)
    if (global.gc) {
        const before = process.memoryUsage().heapUsed;
        global.gc();
        const after = process.memoryUsage().heapUsed;
        metrics.observe('gc_freed_bytes', before - after);
    }
}

// Collect every 10 seconds
setInterval(collectProcessMetrics, 10_000);
```

### GC Monitoring

```typescript
// Monitor garbage collection (Node.js 20+)
import { performance } from 'perf_hooks';

function monitorGC(): void {
    const obs = new performance.Observer((list) => {
        for (const entry of list.getEntries()) {
            metrics.observe('gc_duration_ms', entry.duration, {
                kind: (entry as any).kind === 'major' ? 'major' : 'minor',
            });
        }
    });
    obs.observe({ type: 'gc', buffered: true });
}
```

## Dashboard JSON (Grafana Reference)

```json
{
    "dashboard": {
        "title": "Quotation App Dashboard",
        "panels": [
            {
                "title": "Request Rate",
                "type": "timeseries",
                "targets": [{ "expr": "rate(http_requests_total[5m])" }]
            },
            {
                "title": "Error Rate",
                "type": "timeseries",
                "targets": [{ "expr": "rate(http_responses_total{status=~\"5..\"}[5m])" }]
            },
            {
                "title": "P95 Latency",
                "type": "stat",
                "targets": [{ "expr": "histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))" }]
            },
            {
                "title": "Memory Usage",
                "type": "gauge",
                "targets": [{ "expr": "process_heap_used_bytes / 1024 / 1024" }],
                "fieldConfig": { "defaults": { "unit": "MB", "max": 512 } }
            },
            {
                "title": "Active Connections",
                "type": "stat",
                "targets": [{ "expr": "http_active_connections" }]
            },
            {
                "title": "Event Loop Lag",
                "type": "timeseries",
                "targets": [{ "expr": "event_loop_lag_ms" }]
            }
        ]
    }
}
```

## Log Aggregation

### Log Format for Aggregators

```typescript
// JSON logs — parseable by ELK, Loki, Datadog, CloudWatch
const logger = pino({
    formatters: {
        level(label) {
            return { level: label };
        },
    },
    serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
    },
});

// Example output:
// {"level":"info","timestamp":"2026-04-23T10:30:00.000Z","service":"quotation-app","requestId":"abc-123","method":"GET","path":"/api/quotes","statusCode":200,"duration":45,"msg":"Request completed"}
```

### Log Queries (Loki LogQL)

```text
# All errors from quotation-app
{service="quotation-app"} |= "error" | json | level="error"

# Slow requests (>1 second)
{service="quotation-app"} | json | duration > 1000

# Error rate by path
sum(rate({service="quotation-app"} | json | level="error" [5m])) by (path)

# Requests per minute
sum(rate({service="quotation-app"} | json | level="info" [1m]))

# Top paths by error count
topk(10, sum(count_over_time({service="quotation-app"} | json | level="error" [1h])) by (path))
```

## Uptime Monitoring

### External Health Check (Cron)

```typescript
// External monitor — check if the app is reachable
async function externalHealthCheck(url: string): Promise<{
    up: boolean;
    latencyMs: number;
    statusCode?: number;
    error?: string;
}> {
    const start = performance.now();
    try {
        const res = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(10_000), // 10s timeout
        });
        const latency = performance.now() - start;

        return {
            up: res.ok,
            latencyMs: Math.round(latency),
            statusCode: res.status,
        };
    } catch (err: any) {
        return {
            up: false,
            latencyMs: Math.round(performance.now() - start),
            error: err.message,
        };
    }
}

// Run periodically
setInterval(async () => {
    const result = await externalHealthCheck('https://quotation.example.com/health');
    if (!result.up) {
        logger.error({ result }, 'External health check failed');
        // sendAlert('app_down', result);
    }
}, 60_000);
```

### Uptime Robot (External Service)

```
# Configure at uptimerobot.com or similar service

Monitor Type: HTTP(s)
URL: https://quotation.example.com/health
Interval: 5 minutes
Expected Status: 200
Keyword: "healthy"

Alert contacts:
  - Email: admin@example.com
  - Slack: webhook URL
  - SMS: +66-xxx-xxx-xxxx

# For multi-region monitoring, use:
# - UptimeRobot (free tier: 50 monitors)
# - Pingdom
# - Better Stack (status page)
# - AWS CloudWatch Synthetics
```

## Graceful Shutdown

```typescript
// Track connections for graceful shutdown
let activeConnections = 0;
const connections = new Set<any>();

server.on('connection', (socket) => {
    activeConnections++;
    connections.add(socket);
    socket.on('close', () => {
        activeConnections--;
        connections.delete(socket);
    });
});

async function gracefulShutdown(signal: string) {
    logger.info({ signal, activeConnections }, 'Shutting down gracefully');

    // Stop accepting new connections
    server.close();

    // Wait for active connections to finish (max 30s)
    const timeout = setTimeout(() => {
        logger.warn({ activeConnections }, 'Force closing remaining connections');
        for (const socket of connections) {
            socket.destroy();
        }
        process.exit(1);
    }, 30_000);

    // Check periodically if all connections are done
    await new Promise<void>((resolve) => {
        const check = setInterval(() => {
            if (activeConnections === 0) {
                clearInterval(check);
                resolve();
            }
        }, 1000);
    });

    clearTimeout(timeout);

    // Close database connections
    await db.destroy();
    await redis.quit();

    logger.info('Shutdown complete');
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

## Code Style Rules

- Use structured JSON logging (pino) — never use `console.log` in production.
- Include `requestId` in all request-scoped logs — enables log correlation across services.
- Sanitize sensitive fields (passwords, tokens) before logging — never log secrets.
- Implement three health endpoints: `/live` (liveness), `/ready` (readiness), `/health` (full status).
- Track HTTP metrics automatically via middleware — request count, latency, error rate by path.
- Use `performance.now()` for timing — more precise than `Date.now()`.
- Normalize dynamic path segments in metrics — `/users/123` → `/users/:id` for consistent labels.
- Set alert thresholds with cooldown periods — prevent alert fatigue from repeated triggers.
- Track business metrics (quotations created, payments processed) — not just technical metrics.
- Monitor event loop lag — if consistently >100ms, investigate blocking operations.
- Use `SIGTERM` handler for graceful shutdown — close DB connections, drain requests, then exit.
- Export metrics in Prometheus format — standard scraping format for Grafana dashboards.
- Correlate logs with trace IDs across services — propagate `X-Trace-Id` in all requests.
- Use external uptime monitoring — don't rely solely on self-monitoring.
- Log at appropriate levels: `debug` (development), `info` (operations), `warn` (degraded), `error` (failures), `fatal` (unrecoverable).
