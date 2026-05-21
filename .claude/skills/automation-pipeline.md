---
name: automation-pipeline
description: Automation pipelines — task orchestration, data pipelines, event-driven workflows, scheduled jobs, webhook automations, file processing pipelines, notification pipelines, and workflow engines for TypeScript/Node.js applications
---

# Automation Pipeline

## Pipeline Patterns

### Pattern Selection Guide

```
Simple sequential     → Promise chains / async functions
Fan-out / fan-in      → Promise.all / Promise.allSettled
Event-driven          → EventEmitter / Redis Pub-Sub
Scheduled recurring   → node-cron / cron jobs
Queue-based           → BullMQ / Redis queues
Stream processing     → Node.js streams / Readable pipelines
State machine         → XState / custom FSM
Workflow orchestration → Temporal / BullMQ flows
```

## Task Pipeline (Sequential)

### Pipeline Builder

```typescript
type StepResult<T> = { success: true; data: T } | { success: false; error: Error };

interface PipelineStep<TInput, TOutput> {
    name: string;
    run: (input: TInput) => Promise<TOutput>;
    rollback?: (input: TInput, output: TOutput) => Promise<void>;
    timeout?: number;
    retries?: number;
}

class Pipeline<T> {
    private steps: PipelineStep<any, any>[] = [];
    private executedSteps: { step: PipelineStep<any, any>; input: any; output: any }[] = [];

    addStep<TOut>(
        name: string,
        run: (input: T) => Promise<TOut>,
        options?: { rollback?: (input: T, output: TOut) => Promise<void>; timeout?: number; retries?: number }
    ): Pipeline<TOut> {
        this.steps.push({ name, run, ...options });
        return this as any;
    }

    async execute(initialInput: T): Promise<StepResult<any>> {
        let input: any = initialInput;

        for (const step of this.steps) {
            try {
                const output = await this.runWithRetry(step, input);
                this.executedSteps.push({ step, input, output });
                input = output;
            } catch (error) {
                // Rollback executed steps in reverse order
                await this.rollback();
                return { success: false, error: error as Error };
            }
        }

        return { success: true, data: input };
    }

    private async runWithRetry(step: PipelineStep<any, any>, input: any): Promise<any> {
        const maxRetries = step.retries ?? 0;
        const timeout = step.timeout ?? 30_000;
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await Promise.race([
                    step.run(input),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error(`Step "${step.name}" timed out`)), timeout)
                    ),
                ]);
            } catch (error) {
                lastError = error as Error;
                if (attempt < maxRetries) {
                    await this.delay(Math.pow(2, attempt) * 500);
                }
            }
        }

        throw lastError;
    }

    private async rollback(): Promise<void> {
        for (const { step, input, output } of [...this.executedSteps].reverse()) {
            if (step.rollback) {
                try {
                    await step.rollback(input, output);
                } catch {
                    // Log rollback failure but continue
                }
            }
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Usage: Quotation approval pipeline
const approvalPipeline = new Pipeline<{ quotationId: string }>()
    .addStep('validate', async (input) => {
        const quotation = await db.findQuotation(input.quotationId);
        if (!quotation) throw new Error('Quotation not found');
        if (quotation.status !== 'draft') throw new Error('Only draft quotations can be approved');
        return { ...input, quotation };
    })
    .addStep('calculate-total', async ({ quotation }) => {
        const total = calculateTotal(quotation.items, quotation.discount, quotation.taxRate);
        return { quotation, total };
    })
    .addStep('update-status', async ({ quotation, total }) => {
        const updated = await db.updateQuotation(quotation.id, {
            status: 'approved',
            total,
            approvedAt: new Date(),
        });
        return updated;
    }, {
        rollback: async (_, quotation) => {
            await db.updateQuotation(quotation.id, { status: 'draft' });
        },
    })
    .addStep('generate-pdf', async (quotation) => {
        const pdfUrl = await generatePdf(quotation);
        return { quotation, pdfUrl };
    })
    .addStep('notify-customer', async ({ quotation, pdfUrl }) => {
        await sendEmail({
            to: quotation.customerEmail,
            subject: `Quotation ${quotation.id} Approved`,
            template: 'quotation-approved',
            data: { quotation, pdfUrl },
        });
        return { quotation, pdfUrl, notified: true };
    });

const result = await approvalPipeline.execute({ quotationId: 'QT-001' });
```

## Fan-out / Fan-in Pipeline

### Parallel Processing

```typescript
interface FanOutOptions<TInput, TOutput> {
    tasks: Array<{
        name: string;
        execute: (input: TInput) => Promise<TOutput>;
    }>;
    mode: 'all' | 'race' | 'allSettled';
    concurrency?: number;
}

async function fanOut<TInput, TOutput>(
    input: TInput,
    options: FanOutOptions<TInput, TOutput>
): Promise<TOutput[]> {
    const { tasks, mode, concurrency = Infinity } = options;

    if (concurrency >= tasks.length) {
        switch (mode) {
            case 'all':
                return Promise.all(tasks.map(t => t.execute(input)));
            case 'race':
                const result = await Promise.race(tasks.map(t => t.execute(input)));
                return [result];
            case 'allSettled': {
                const settled = await Promise.allSettled(tasks.map(t => t.execute(input)));
                return settled
                    .filter((r): r is PromiseFulfilledResult<TOutput> => r.status === 'fulfilled')
                    .map(r => r.value);
            }
        }
    }

    // Bounded concurrency
    const results: TOutput[] = [];
    for (let i = 0; i < tasks.length; i += concurrency) {
        const batch = tasks.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(t => t.execute(input)));
        results.push(...batchResults);
    }
    return results;
}

// Usage: Send quotation to multiple channels
const channels = await fanOut(quotation, {
    tasks: [
        { name: 'email', execute: (q) => sendEmailPdf(q) },
        { name: 'line', execute: (q) => sendLineNotification(q) },
        { name: 'webhook', execute: (q) => postWebhook(q) },
        { name: 'storage', execute: (q) => archiveToStorage(q) },
    ],
    mode: 'allSettled',
    concurrency: 2,
});
```

## Event-Driven Pipeline

### EventEmitter-based

```typescript
import { EventEmitter } from 'events';

// Typed events
interface PipelineEvents {
    'quotation:created': { quotationId: string; customerId: string };
    'quotation:approved': { quotationId: string; approvedBy: string };
    'quotation:rejected': { quotationId: string; reason: string };
    'quotation:sent': { quotationId: string; channel: string };
    'payment:received': { quotationId: string; amount: number };
}

class PipelineEventBus {
    private emitter = new EventEmitter();

    emit<K extends keyof PipelineEvents>(event: K, payload: PipelineEvents[K]): void {
        this.emitter.emit(event, payload);
    }

    on<K extends keyof PipelineEvents>(
        event: K,
        handler: (payload: PipelineEvents[K]) => Promise<void> | void
    ): void {
        this.emitter.on(event, handler);
    }

    once<K extends keyof PipelineEvents>(
        event: K,
        handler: (payload: PipelineEvents[K]) => Promise<void> | void
    ): void {
        this.emitter.once(event, handler);
    }

    removeAllListeners(event?: keyof PipelineEvents): void {
        this.emitter.removeAllListeners(event);
    }
}

// Register handlers
const bus = new PipelineEventBus();

bus.on('quotation:created', async ({ quotationId }) => {
    await generatePdf(quotationId);
});

bus.on('quotation:approved', async ({ quotationId, approvedBy }) => {
    await Promise.all([
        updateStatus(quotationId, 'approved'),
        logApproval(quotationId, approvedBy),
        sendApprovalNotification(quotationId),
    ]);
});

bus.on('payment:received', async ({ quotationId, amount }) => {
    await convertToInvoice(quotationId, amount);
});
```

### Redis Pub/Sub (cross-process)

```typescript
import Redis from 'ioredis';

class RedisPipeline {
    private publisher: Redis;
    private subscriber: Redis;

    constructor(redisUrl: string) {
        this.publisher = new Redis(redisUrl);
        this.subscriber = new Redis(redisUrl);
    }

    async publish(channel: string, data: unknown): Promise<void> {
        await this.publisher.publish(channel, JSON.stringify(data));
    }

    async subscribe(channel: string, handler: (data: any) => Promise<void>): Promise<void> {
        await this.subscriber.subscribe(channel);
        this.subscriber.on('message', async (ch, message) => {
            if (ch === channel) {
                try {
                    await handler(JSON.parse(message));
                } catch (error) {
                    console.error(`Pipeline handler error on ${channel}:`, error);
                }
            }
        });
    }
}

// Usage
const pipeline = new RedisPipeline(process.env.REDIS_URL!);

// Publisher (API server)
await pipeline.publish('quotation:approved', { quotationId: 'QT-001', approvedBy: 'user-123' });

// Subscriber (worker process)
await pipeline.subscribe('quotation:approved', async (data) => {
    await generatePdf(data.quotationId);
    await sendNotification(data.quotationId);
});
```

## Queue-Based Pipeline (BullMQ)

### Multi-Step Job Flow

```typescript
import { FlowProducer, Queue, Worker } from 'bullmq';

const redisConnection = { host: 'localhost', port: 6379 };

// Define queues
const validationQueue = new Queue('validation', { connection: redisConnection });
const pdfQueue = new Queue('pdf-generation', { connection: redisConnection });
const emailQueue = new Queue('email-delivery', { connection: redisConnection });

// Flow producer — orchestrates multi-step pipeline
const flowProducer = new FlowProducer({ connection: redisConnection });

async function startQuotationPipeline(quotationId: string) {
    const flow = await flowProducer.add({
        name: 'quotation-pipeline',
        queueName: 'validation',
        data: { quotationId },
        children: [
            {
                name: 'generate-pdf',
                queueName: 'pdf-generation',
                data: { quotationId },
                children: [
                    {
                        name: 'send-email',
                        queueName: 'email-delivery',
                        data: { quotationId },
                    },
                ],
            },
        ],
    });

    return flow.job.id;
}

// Workers
const validationWorker = new Worker('validation', async (job) => {
    const { quotationId } = job.data;
    const quotation = await db.findQuotation(quotationId);
    if (!quotation) throw new Error('Quotation not found');

    // Validate items, totals, customer data
    validateQuotation(quotation);
    return { quotationId, valid: true };
}, { connection: redisConnection });

const pdfWorker = new Worker('pdf-generation', async (job) => {
    const { quotationId } = job.data;
    const pdfUrl = await generatePdf(quotationId);
    return { quotationId, pdfUrl };
}, { connection: redisConnection });

const emailWorker = new Worker('email-delivery', async (job) => {
    const { quotationId } = job.data;
    const quotation = await db.findQuotation(quotationId);
    await sendEmail({
        to: quotation.customerEmail,
        subject: `Quotation ${quotationId}`,
        template: 'quotation-ready',
    });
    return { quotationId, sent: true };
}, { connection: redisConnection });
```

## Scheduled Pipeline

### Cron-Based Automation

```typescript
import cron from 'node-cron';

interface ScheduledJob {
    name: string;
    schedule: string; // cron expression
    handler: () => Promise<void>;
    enabled: boolean;
}

const scheduledJobs: ScheduledJob[] = [
    {
        name: 'expire-draft-quotations',
        schedule: '0 */6 * * *', // every 6 hours
        handler: async () => {
            const expired = await db.findQuotations({
                status: 'draft',
                createdAt: { $lt: daysAgo(30) },
            });

            for (const q of expired) {
                await db.updateQuotation(q.id, { status: 'expired', expiredAt: new Date() });
                await sendExpirationNotification(q);
            }

            logger.info({ count: expired.length }, 'Expired draft quotations');
        },
        enabled: true,
    },
    {
        name: 'daily-sales-report',
        schedule: '0 8 * * 1-5', // weekdays at 8am
        handler: async () => {
            const report = await generateSalesReport('yesterday');
            await sendEmail({
                to: process.env.REPORT_EMAIL!,
                subject: `Daily Sales Report — ${report.date}`,
                template: 'daily-report',
                data: report,
            });
        },
        enabled: true,
    },
    {
        name: 'cleanup-temp-files',
        schedule: '0 2 * * *', // daily at 2am
        handler: async () => {
            const deleted = await cleanupTempFiles(olderThanHours(24));
            logger.info({ deleted }, 'Cleaned up temp files');
        },
        enabled: true,
    },
    {
        name: 'sync-customer-data',
        schedule: '30 0 * * *', // daily at 00:30
        handler: async () => {
            await syncCustomersFromExternalSystem();
        },
        enabled: process.env.ENABLE_CRM_SYNC === 'true',
    },
];

function startScheduler(): void {
    for (const job of scheduledJobs) {
        if (!job.enabled) continue;

        if (!cron.validate(job.schedule)) {
            logger.error({ job: job.name, schedule: job.schedule }, 'Invalid cron schedule');
            continue;
        }

        cron.schedule(job.schedule, async () => {
            const start = Date.now();
            try {
                logger.info({ job: job.name }, 'Scheduled job started');
                await job.handler();
                logger.info({ job: job.name, duration: Date.now() - start }, 'Scheduled job completed');
            } catch (error) {
                logger.error({ job: job.name, error, duration: Date.now() - start }, 'Scheduled job failed');
            }
        });
    }
}

function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

function olderThanHours(n: number): Date {
    const d = new Date();
    d.setHours(d.getHours() - n);
    return d;
}
```

## Webhook Automation Pipeline

### Outgoing Webhooks

```typescript
interface WebhookConfig {
    url: string;
    secret: string;
    events: string[];
    headers?: Record<string, string>;
    retry?: { maxAttempts: number; backoffMs: number };
}

class WebhookDispatcher {
    private configs: Map<string, WebhookConfig[]> = new Map();

    register(event: string, config: WebhookConfig): void {
        const existing = this.configs.get(event) ?? [];
        existing.push(config);
        this.configs.set(event, existing);
    }

    async dispatch(event: string, payload: unknown): Promise<void> {
        const configs = this.configs.get(event) ?? [];
        await Promise.allSettled(
            configs.map(config => this.sendWithRetry(config, event, payload))
        );
    }

    private async sendWithRetry(config: WebhookConfig, event: string, payload: unknown): Promise<void> {
        const { maxAttempts = 3, backoffMs = 1000 } = config.retry ?? {};
        const signature = this.sign(config.secret, payload);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await fetch(config.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Webhook-Signature': signature,
                        'X-Webhook-Event': event,
                        'X-Webhook-Timestamp': new Date().toISOString(),
                        ...config.headers,
                    },
                    body: JSON.stringify({ event, data: payload, timestamp: Date.now() }),
                    signal: AbortSignal.timeout(10_000),
                });

                if (!response.ok) {
                    throw new Error(`Webhook returned ${response.status}`);
                }

                return;
            } catch (error) {
                if (attempt === maxAttempts - 1) {
                    logger.error({ event, url: config.url, error }, 'Webhook delivery failed');
                    throw error;
                }
                await this.delay(backoffMs * Math.pow(2, attempt));
            }
        }
    }

    private sign(secret: string, payload: unknown): string {
        const crypto = require('crypto');
        return crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Usage
const webhooks = new WebhookDispatcher();

webhooks.register('quotation.approved', {
    url: 'https://external-system.example.com/webhooks',
    secret: process.env.WEBHOOK_SECRET!,
    events: ['quotation.approved'],
    retry: { maxAttempts: 3, backoffMs: 2000 },
});

// Trigger from business logic
await webhooks.dispatch('quotation.approved', {
    quotationId: 'QT-001',
    total: 15000,
    customerEmail: 'customer@example.com',
});
```

### Incoming Webhook Handler

```typescript
import { createHmac } from 'crypto';

function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    const expected = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    // Use timing-safe comparison
    const { timingSafeEqual } = require('crypto');
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Route handler
async function handleIncomingWebhook(req: Request, res: Response) {
    const signature = req.headers['x-webhook-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawBody, signature, process.env.WEBHOOK_SECRET!)) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, data } = req.body;

    switch (event) {
        case 'payment.completed':
            await handlePaymentCompleted(data);
            break;
        case 'customer.updated':
            await syncCustomerData(data);
            break;
        default:
            logger.warn({ event }, 'Unknown webhook event');
    }

    // Always return 200 quickly — process async
    res.status(200).json({ received: true });
}
```

## File Processing Pipeline

### Stream-Based Processing

```typescript
import { Readable, Transform, Writable, pipeline } from 'stream';
import { promisify } from 'util';
import fs from 'fs';
import csv from 'csv-parse';
import { z } from 'zod';

const pipelineAsync = promisify(pipeline);

// CSV import pipeline
const ImportRowSchema = z.object({
    customerName: z.string().min(1),
    email: z.string().email(),
    itemName: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().nonnegative(),
});

type ImportRow = z.infer<typeof ImportRowSchema>;

interface ImportResult {
    total: number;
    succeeded: number;
    failed: number;
    errors: Array<{ row: number; message: string }>;
}

async function importCsvPipeline(filePath: string): Promise<ImportResult> {
    const result: ImportResult = { total: 0, succeeded: 0, failed: 0, errors: [] };
    let rowNumber = 0;

    // Step 1: Read file
    const fileStream = fs.createReadStream(filePath);

    // Step 2: Parse CSV
    const csvParser = csv({ columns: true, skip_empty_lines: true, trim: true });

    // Step 3: Validate rows
    const validator = new Transform({
        objectMode: true,
        transform(row: Record<string, string>, _, callback) {
            rowNumber++;
            result.total++;

            const parsed = ImportRowSchema.safeParse(row);
            if (!parsed.success) {
                result.failed++;
                result.errors.push({
                    row: rowNumber,
                    message: parsed.error.issues.map(i => i.message).join(', '),
                });
                return callback();
            }

            this.push(parsed.data);
            callback();
        },
    });

    // Step 4: Batch and insert
    const BATCH_SIZE = 50;
    let batch: ImportRow[] = [];

    const batchInserter = new Writable({
        objectMode: true,
        write(row: ImportRow, _, callback) {
            batch.push(row);

            if (batch.length >= BATCH_SIZE) {
                const toInsert = [...batch];
                batch = [];
                insertBatch(toInsert)
                    .then(count => {
                        result.succeeded += count;
                        callback();
                    })
                    .catch(error => {
                        result.failed += toInsert.length;
                        result.errors.push({ row: -1, message: error.message });
                        callback();
                    });
            } else {
                callback();
            }
        },
        final(callback) {
            if (batch.length > 0) {
                insertBatch(batch)
                    .then(count => {
                        result.succeeded += count;
                        callback();
                    })
                    .catch(callback);
            } else {
                callback();
            }
        },
    });

    await pipelineAsync(fileStream, csvParser, validator, batchInserter);
    return result;
}

async function insertBatch(rows: ImportRow[]): Promise<number> {
    // Batch insert into database
    await db.insertRows('quotation_items', rows);
    return rows.length;
}
```

## Notification Pipeline

### Multi-Channel Notification

```typescript
interface Notification {
    userId: string;
    title: string;
    message: string;
    channels: ('email' | 'line' | 'sms' | 'push' | 'in-app')[];
    data?: Record<string, unknown>;
    priority: 'low' | 'normal' | 'high' | 'urgent';
}

interface NotificationChannel {
    name: string;
    send: (notification: Notification) => Promise<boolean>;
}

class NotificationPipeline {
    private channels: Map<string, NotificationChannel> = new Map();

    registerChannel(channel: NotificationChannel): void {
        this.channels.set(channel.name, channel);
    }

    async send(notification: Notification): Promise<void> {
        const results = await Promise.allSettled(
            notification.channels.map(async (channelName) => {
                const channel = this.channels.get(channelName);
                if (!channel) {
                    throw new Error(`Unknown channel: ${channelName}`);
                }
                return channel.send(notification);
            })
        );

        const failures = results
            .map((r, i) => ({ channel: notification.channels[i], result: r }))
            .filter(r => r.result.status === 'rejected');

        if (failures.length > 0) {
            logger.warn({
                notification: notification.title,
                failedChannels: failures.map(f => f.channel),
            }, 'Some notification channels failed');
        }

        // Always store in-app notification
        await this.storeInAppNotification(notification);
    }

    private async storeInAppNotification(notification: Notification): Promise<void> {
        await db.insert('notifications', {
            userId: notification.userId,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            read: false,
            createdAt: new Date(),
        });
    }
}

// Register channels
const notifier = new NotificationPipeline();

notifier.registerChannel({
    name: 'email',
    send: async (n) => {
        await sendEmail({ to: await getUserEmail(n.userId), subject: n.title, template: 'notification', data: n });
        return true;
    },
});

notifier.registerChannel({
    name: 'line',
    send: async (n) => {
        const lineId = await getUserLineId(n.userId);
        if (!lineId) return false;
        await pushLineMessage(lineId, n.message);
        return true;
    },
});

notifier.registerChannel({
    name: 'sms',
    send: async (n) => {
        const phone = await getUserPhone(n.userId);
        if (!phone) return false;
        await sendSms(phone, n.message);
        return true;
    },
});

// Usage
await notifier.send({
    userId: 'user-123',
    title: 'Quotation Approved',
    message: 'Your quotation QT-001 has been approved',
    channels: ['email', 'line', 'in-app'],
    priority: 'normal',
    data: { quotationId: 'QT-001' },
});
```

## Data Sync Pipeline

### ETL (Extract → Transform → Load)

```typescript
interface SyncResult {
    extracted: number;
    transformed: number;
    loaded: number;
    errors: number;
    duration: number;
}

class DataSyncPipeline<TSource, TTransformed> {
    constructor(
        private extract: () => Promise<TSource[]>,
        private transform: (source: TSource) => TTransformed | null,
        private load: (items: TTransformed[]) => Promise<number>,
        private options?: { batchSize?: number; concurrency?: number }
    ) {}

    async run(): Promise<SyncResult> {
        const start = Date.now();
        const result: SyncResult = { extracted: 0, transformed: 0, loaded: 0, errors: 0, duration: 0 };

        // Extract
        const raw = await this.extract();
        result.extracted = raw.length;

        // Transform
        const transformed: TTransformed[] = [];
        for (const item of raw) {
            try {
                const t = this.transform(item);
                if (t !== null) {
                    transformed.push(t);
                }
            } catch {
                result.errors++;
            }
        }
        result.transformed = transformed.length;

        // Load in batches
        const batchSize = this.options?.batchSize ?? 100;
        for (let i = 0; i < transformed.length; i += batchSize) {
            const batch = transformed.slice(i, i + batchSize);
            try {
                const loaded = await this.load(batch);
                result.loaded += loaded;
            } catch {
                result.errors += batch.length;
            }
        }

        result.duration = Date.now() - start;
        return result;
    }
}

// Usage: Sync products from external catalog
const productSync = new DataSyncPipeline(
    // Extract
    async () => {
        const response = await fetch('https://catalog-api.example.com/products');
        return response.json();
    },
    // Transform
    (externalProduct) => ({
        externalId: externalProduct.id,
        name: externalProduct.product_name,
        price: parseFloat(externalProduct.unit_price),
        sku: externalProduct.item_code,
        updatedAt: new Date(),
    }),
    // Load
    async (products) => {
        const result = await db.upsertMany('products', products, { conflictKey: 'externalId' });
        return products.length;
    },
    { batchSize: 50 }
);

const syncResult = await productSync.run();
logger.info(syncResult, 'Product sync completed');
```

## Pipeline Monitoring

### Execution Tracking

```typescript
interface PipelineExecution {
    pipelineName: string;
    executionId: string;
    status: 'running' | 'completed' | 'failed';
    startedAt: Date;
    completedAt?: Date;
    steps: StepExecution[];
}

interface StepExecution {
    stepName: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: Date;
    completedAt?: Date;
    input?: unknown;
    output?: unknown;
    error?: string;
}

class PipelineTracker {
    private executions: Map<string, PipelineExecution> = new Map();

    start(name: string): string {
        const id = `${name}-${Date.now()}`;
        this.executions.set(id, {
            pipelineName: name,
            executionId: id,
            status: 'running',
            startedAt: new Date(),
            steps: [],
        });
        return id;
    }

    startStep(executionId: string, stepName: string): void {
        const execution = this.executions.get(executionId);
        if (!execution) return;
        execution.steps.push({
            stepName,
            status: 'running',
            startedAt: new Date(),
        });
    }

    completeStep(executionId: string, stepName: string, output?: unknown): void {
        const execution = this.executions.get(executionId);
        if (!execution) return;
        const step = execution.steps.find(s => s.stepName === stepName && s.status === 'running');
        if (step) {
            step.status = 'completed';
            step.completedAt = new Date();
            step.output = output;
        }
    }

    failStep(executionId: string, stepName: string, error: string): void {
        const execution = this.executions.get(executionId);
        if (!execution) return;
        const step = execution.steps.find(s => s.stepName === stepName && s.status === 'running');
        if (step) {
            step.status = 'failed';
            step.completedAt = new Date();
            step.error = error;
        }
    }

    complete(executionId: string): void {
        const execution = this.executions.get(executionId);
        if (!execution) return;
        execution.status = 'completed';
        execution.completedAt = new Date();
    }

    fail(executionId: string): void {
        const execution = this.executions.get(executionId);
        if (!execution) return;
        execution.status = 'failed';
        execution.completedAt = new Date();
    }

    getExecution(executionId: string): PipelineExecution | undefined {
        return this.executions.get(executionId);
    }

    getRecentExecutions(pipelineName: string, limit = 10): PipelineExecution[] {
        return [...this.executions.values()]
            .filter(e => e.pipelineName === pipelineName)
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
            .slice(0, limit);
    }
}
```

## Pipeline Directory Structure

```
src/
├── pipelines/
│   ├── index.ts                  # Pipeline registry & startup
│   ├── quotation-approval.ts     # Quotation approval flow
│   ├── data-sync.ts              # External system sync
│   ├── notification.ts           # Multi-channel notifications
│   ├── csv-import.ts             # File import pipeline
│   ├── report-generation.ts      # Scheduled report pipeline
│   └── webhook/
│       ├── dispatcher.ts         # Outgoing webhook sender
│       ├── handler.ts            # Incoming webhook handler
│       └── verify.ts             # Signature verification
├── workers/
│   ├── validation.worker.ts
│   ├── pdf-generation.worker.ts
│   └── email-delivery.worker.ts
├── scheduler/
│   ├── index.ts                  # Start all scheduled jobs
│   └── jobs/
│       ├── expire-drafts.ts
│       ├── daily-report.ts
│       └── cleanup-temp.ts
└── shared/
    ├── pipeline-runner.ts        # Generic pipeline executor
    ├── pipeline-tracker.ts       # Execution monitoring
    └── retry.ts                  # Retry utilities
```

## Code Style Rules

- Every pipeline step must have a name for logging and debugging
- Use rollback handlers for steps that modify state (database writes, file creation)
- Set timeouts on every step — no step should run indefinitely
- Use `Promise.allSettled` (not `Promise.all`) when dispatching to multiple independent channels
- Pipeline failures must be logged with full context (input, step name, error, duration)
- Batch database operations — never insert rows one at a time in a pipeline
- Verify webhook signatures with timing-safe comparison to prevent timing attacks
- Always respond to incoming webhooks with 200 quickly — process heavy work async
- Use the PipelineTracker to record execution metadata for monitoring dashboards
- Scheduled jobs must be idempotent — safe to run multiple times if previous run was interrupted
