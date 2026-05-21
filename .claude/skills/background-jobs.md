---
name: background-jobs
description: Background job processing, queue systems, worker patterns, job scheduling, retry strategies, dead letter queues, priority queues, and task distribution patterns
---

# Background Jobs / Queue

## When to Use Background Jobs

```
Use background jobs when:
- Task takes longer than 200ms (email, PDF generation, image processing)
- Task can be deferred (analytics, notifications, search indexing)
- Task needs retry logic (third-party API calls, webhooks)
- Task needs to run on a schedule (reports, cleanup, data sync)
- Task must not block the HTTP response (file uploads, bulk imports)

Keep in the request path when:
- User needs immediate feedback (validation, simple CRUD)
- Result is needed for the response (auth, search with low latency)
- Task is idempotent and fast (< 100ms)
```

## Queue Architecture

```
Producer → Queue → Worker → Result/Callback
                         → Dead Letter Queue (on failure)

Components:
- Producer    — Creates jobs and pushes to queue
- Queue       — Ordered storage (Redis list, BullMQ, RabbitMQ, SQS)
- Worker      — Consumes jobs, runs business logic
- Scheduler   — Triggers jobs on cron/timer
- Monitor     — Dashboard for job status, metrics, failures
```

## BullMQ (Redis-Based)

### Job Queue Setup

```typescript
import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

// Define queue
const emailQueue = new Queue('emails', { connection });
const reportQueue = new Queue('reports', { connection });

// Job data type
interface EmailJob {
    to: string;
    subject: string;
    template: string;
    data: Record<string, unknown>;
}

interface ReportJob {
    userId: string;
    reportType: 'monthly' | 'annual';
    format: 'pdf' | 'csv';
    dateRange: { from: string; to: string };
}
```

### Producer: Adding Jobs

```typescript
// Simple job
await emailQueue.add('send-welcome', {
    to: 'user@example.com',
    subject: 'Welcome!',
    template: 'welcome',
    data: { name: 'John' },
});

// Delayed job
await emailQueue.add('send-reminder', emailData, {
    delay: 24 * 60 * 60 * 1000, // 24 hours
});

// Scheduled / recurring job
await reportQueue.add('monthly-report', reportData, {
    repeat: { pattern: '0 2 1 * *' }, // cron: 2am on 1st of each month
});

// Priority job
await emailQueue.add('urgent-notification', emailData, {
    priority: 1, // lower number = higher priority
});

// Job with specific options
await reportQueue.add('generate-report', reportData, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,   // keep last 1000 completed
    removeOnFail: 5000,       // keep last 5000 failed
    ttl: 30 * 60 * 1000,      // job expires after 30 min if not processed
});
```

### Worker: Processing Jobs

```typescript
const emailWorker = new Worker<EmailJob>('emails', async (job) => {
    const { to, subject, template, data } = job.data;

    // Report progress for long jobs
    await job.updateProgress(10);

    const html = await renderTemplate(template, data);
    await job.updateProgress(50);

    await sendEmail({ to, subject, html });
    await job.updateProgress(100);

    return { sent: true, messageId: generateId() };
}, {
    connection,
    concurrency: 10,      // process 10 jobs simultaneously
    limiter: {
        max: 50,           // max 50 jobs
        duration: 1000,    // per second (rate limiting)
    },
});

// Listen to events
emailWorker.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed:`, result);
});

emailWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
});

emailWorker.on('progress', (job, progress) => {
    console.log(`Job ${job.id} progress: ${progress}%`);
});

// Graceful shutdown
async function shutdown() {
    await emailWorker.close();
    await reportWorker.close();
    await connection.quit();
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

### Retry & Error Handling

```typescript
const worker = new Worker('reports', async (job) => {
    const result = await generateReport(job.data);

    if (!result.success) {
        // Throw to trigger retry
        throw new Error(`Report generation failed: ${result.error}`);
    }

    return result;
}, {
    connection,
    attempts: 5,
    backoff: {
        type: 'exponential',
        delay: 2000, // 2s, 4s, 8s, 16s, 32s
    },
});

// Custom retry logic based on error type
const apiWorker = new Worker('api-calls', async (job) => {
    try {
        return await callExternalAPI(job.data);
    } catch (err) {
        if (err.status === 429) {
            // Rate limited — retry after header value
            throw new RateLimitError(err.retryAfter);
        }
        if (err.status >= 500) {
            // Server error — retryable
            throw err;
        }
        if (err.status >= 400 && err.status < 500) {
            // Client error — don't retry
            throw new UnrecoverableError(err.message);
        }
        throw err;
    }
}, {
    connection,
    attempts: 3,
    backoff: (attemptsMade, err) => {
        if (err instanceof RateLimitError) {
            return err.retryAfter * 1000;
        }
        return Math.min(attemptsMade * 5000, 60_000);
    },
});
```

### Dead Letter Queue

```typescript
// Failed jobs flow to DLQ after max attempts
const dlqQueue = new Queue('emails:dlq', { connection });

const worker = new Worker<EmailJob>('emails', async (job) => {
    await sendEmail(job.data);
}, {
    connection,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
});

// Move failed jobs to DLQ
worker.on('failed', async (job, err) => {
    if (job?.attemptsMade === job?.opts?.attempts) {
        await dlqQueue.add('failed-email', {
            ...job.data,
            originalJobId: job.id,
            error: err.message,
            failedAt: new Date().toISOString(),
        });

        console.error(`Job ${job.id} moved to DLQ:`, err.message);
    }
});

// Process DLQ manually or on schedule
const dlqWorker = new Worker('emails:dlq', async (job) => {
    const { originalJobId, error, ...emailData } = job.data;

    // Option 1: Retry with different config
    await sendEmail(emailData);

    // Option 2: Notify ops team
    // await notifyOpsTeam({ originalJobId, error, emailData });
});

// Query DLQ for monitoring
async function getDLQStats() {
    const [failed, delayed, waiting] = await Promise.all([
        dlqQueue.getFailed(),
        dlqQueue.getDelayed(),
        dlqQueue.getWaiting(),
    ]);

    return {
        failed: failed.length,
        delayed: delayed.length,
        waiting: waiting.length,
    };
}
```

## Job Patterns

### Fan-Out (One-to-Many)

```typescript
// Split one task into many parallel sub-tasks
async function processBulkImport(job: Job<ImportJob>) {
    const { fileUrl, userId } = job.data;
    const records = await parseCSV(fileUrl);
    const batchSize = 100;

    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        await importQueue.add('import-batch', {
            records: batch,
            userId,
            parentJobId: job.id,
        }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
        });

        await job.updateProgress(Math.round((i / records.length) * 100));
    }

    return { totalRecords: records.length, batchesCreated: Math.ceil(records.length / batchSize) };
}
```

### Parent-Child (Flow / Pipeline)

```typescript
import { FlowProducer } from 'bullmq';

const flowProducer = new FlowProducer({ connection });

// Define a pipeline: generate → upload → notify
const flow = await flowProducer.add({
    name: 'report-pipeline',
    queueName: 'reports',
    data: { userId: '123', month: '2025-04' },
    children: [
        {
            name: 'upload-report',
            queueName: 'uploads',
            data: { destination: 's3://reports/' },
            children: [
                {
                    name: 'send-notification',
                    queueName: 'emails',
                    data: { to: 'user@example.com', template: 'report-ready' },
                },
            ],
        },
    ],
});

// Parent completes → children run in order
// All children must succeed for parent to complete
```

### Priority Queue

```typescript
const jobQueue = new Queue('jobs', { connection });

// High priority (1 = highest)
await jobQueue.add('critical-alert', alertData, { priority: 1 });
await jobQueue.add('user-notification', notifData, { priority: 5 });
await jobQueue.add('analytics-event', analyticsData, { priority: 10 }); // lowest

const worker = new Worker('jobs', async (job) => {
    switch (job.name) {
        case 'critical-alert': return handleAlert(job.data);
        case 'user-notification': return handleNotification(job.data);
        case 'analytics-event': return handleAnalytics(job.data);
    }
}, {
    connection,
    concurrency: 5,
});
```

### Rate-Limited Worker

```typescript
// Worker that respects external API rate limits
const worker = new Worker('api-calls', async (job) => {
    const response = await callExternalAPI(job.data);

    if (response.status === 429) {
        const retryAfter = Number(response.headers['retry-after'] ?? 60);
        // Pause the worker for the rate limit window
        await worker.rateLimit(retryAfter * 1000);
        // Move job back to wait (will be retried after rate limit)
        throw new Error(`Rate limited, retrying after ${retryAfter}s`);
    }

    return response.data;
}, {
    connection,
    limiter: {
        max: 10,         // max 10 jobs
        duration: 1000,  // per second
    },
});
```

## Scheduling

### Cron-Based Scheduling

```typescript
import { QueueScheduler } from 'bullmq';

// Repeatable jobs with cron
const scheduler = new Queue('scheduled', { connection });

// Every day at 2am
await scheduler.add('daily-cleanup', {}, {
    repeat: { pattern: '0 2 * * *' },
});

// Every Monday at 9am
await scheduler.add('weekly-report', {}, {
    repeat: { pattern: '0 9 * * 1' },
});

// Every 15 minutes
await scheduler.add('health-check', {}, {
    repeat: { pattern: '*/15 * * * *' },
});

// Remove a repeatable job
await scheduler.removeRepeatableByKey('daily-cleanup::::* * * * *');
```

### Custom Scheduler

```typescript
interface ScheduledJob {
    name: string;
    pattern: string;
    handler: () => Promise<void>;
}

class JobScheduler {
    private timers: ReturnType<typeof setInterval>[] = [];

    constructor(
        private queue: Queue,
        private jobs: ScheduledJob[]
    ) {}

    async start(): Promise<void> {
        for (const job of this.jobs) {
            await this.queue.add(job.name, {}, {
                repeat: { pattern: job.pattern },
            });
        }
    }

    async stop(): Promise<void> {
        const repeatableJobs = await this.queue.getRepeatableJobs();
        for (const rj of repeatableJobs) {
            await this.queue.removeRepeatableByKey(rj.key);
        }
    }
}

const scheduler = new JobScheduler(scheduledQueue, [
    {
        name: 'sync-user-data',
        pattern: '0 */6 * * *', // every 6 hours
        handler: syncUsers,
    },
    {
        name: 'generate-invoices',
        pattern: '0 0 1 * *', // 1st of month
        handler: generateInvoices,
    },
    {
        name: 'cleanup-expired-sessions',
        pattern: '0 3 * * *', // daily at 3am
        handler: cleanupSessions,
    },
]);

await scheduler.start();
```

## Job State & Monitoring

### Job Status Tracking

```typescript
interface JobStatus {
    id: string;
    name: string;
    state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';
    progress: number;
    attemptsMade: number;
    data: unknown;
    result?: unknown;
    failedReason?: string;
    timestamp: number;
    processedOn?: number;
    finishedOn?: number;
}

async function getJobStatus(queue: Queue, jobId: string): Promise<JobStatus | null> {
    const job = await queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();

    return {
        id: job.id!,
        name: job.name,
        state,
        progress: job.progress as number,
        attemptsMade: job.attemptsMade,
        data: job.data,
        result: job.returnvalue,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
    };
}

// Poll job status from API
app.get('/api/jobs/:id', async (req, res) => {
    const status = await getJobStatus(reportQueue, req.params.id);
    if (!status) return res.status(404).json({ error: 'Job not found' });
    res.json(status);
});
```

### Queue Metrics

```typescript
async function getQueueMetrics(queue: Queue) {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.getPausedCount(),
    ]);

    return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
        total: waiting + active + delayed + paused,
    };
}

// Health check endpoint
app.get('/health/queues', async (_req, res) => {
    const metrics = await getQueueMetrics(reportQueue);

    const isHealthy = metrics.failed < 100 && metrics.total < 10000;

    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'degraded',
        metrics,
    });
});
```

## Lightweight In-Process Queue

### Simple Task Queue (No Redis)

```typescript
interface Task<T = unknown> {
    id: string;
    data: T;
    attempts: number;
    maxAttempts: number;
    createdAt: Date;
    runAt: Date;
}

class InProcessQueue<T = unknown> {
    private queue: Task<T>[] = [];
    private processing = false;
    private concurrency: number;
    private activeCount = 0;

    constructor(
        private handler: (data: T) => Promise<void>,
        opts: { concurrency?: number } = {}
    ) {
        this.concurrency = opts.concurrency ?? 1;
    }

    async add(data: T, opts: { delay?: number; maxAttempts?: number } = {}): Promise<string> {
        const task: Task<T> = {
            id: crypto.randomUUID(),
            data,
            attempts: 0,
            maxAttempts: opts.maxAttempts ?? 3,
            createdAt: new Date(),
            runAt: opts.delay ? new Date(Date.now() + opts.delay) : new Date(),
        };

        this.queue.push(task);
        this.queue.sort((a, b) => a.runAt.getTime() - b.runAt.getTime());

        this.process();

        return task.id;
    }

    private process(): void {
        if (this.processing) return;

        while (this.activeCount < this.concurrency && this.queue.length > 0) {
            const task = this.queue[0];
            if (task.runAt > new Date()) break;

            this.queue.shift();
            this.activeCount++;
            this.processing = true;

            this.runTask(task).finally(() => {
                this.activeCount--;
                this.processing = false;
                this.process();
            });
        }
    }

    private async runTask(task: Task<T>): Promise<void> {
        task.attempts++;

        try {
            await this.handler(task.data);
        } catch (err) {
            if (task.attempts < task.maxAttempts) {
                const delay = Math.min(task.attempts * 5000, 60_000);
                task.runAt = new Date(Date.now() + delay);
                this.queue.push(task);
                this.queue.sort((a, b) => a.runAt.getTime() - b.runAt.getTime());
            } else {
                console.error(`Task ${task.id} failed after ${task.attempts} attempts:`, err);
            }
        }
    }

    get size(): number {
        return this.queue.length;
    }
}

// Usage
const emailQueue = new InProcessQueue<EmailJob>(
    async (data) => { await sendEmail(data); },
    { concurrency: 3 }
);

await emailQueue.add({ to: 'user@example.com', subject: 'Hi', template: 'welcome', data: {} });
```

### Worker Thread Pool

```typescript
import { Worker } from 'worker_threads';

interface WorkerTask {
    id: string;
    resolve: (value: unknown) => void;
    reject: (err: Error) => void;
}

class ThreadPool {
    private workers: Worker[] = [];
    private taskQueue: WorkerTask[] = [];
    private available: Worker[] = [];

    constructor(
        private scriptPath: string,
        poolSize: number
    ) {
        for (let i = 0; i < poolSize; i++) {
            const worker = new Worker(scriptPath);
            worker.on('message', (msg) => this.handleMessage(msg));
            worker.on('error', (err) => this.handleError(err));
            this.workers.push(worker);
            this.available.push(worker);
        }
    }

    run<T>(data: unknown): Promise<T> {
        return new Promise((resolve, reject) => {
            const task: WorkerTask = {
                id: crypto.randomUUID(),
                resolve: resolve as (value: unknown) => void,
                reject,
            };

            const worker = this.available.shift();
            if (worker) {
                worker.postMessage({ id: task.id, data });
                (worker as any).__task = task;
            } else {
                this.taskQueue.push(task);
            }
        });
    }

    private handleMessage(msg: { id: string; result?: unknown; error?: string }): void {
        const worker = this.workers.find(w => (w as any).__task?.id === msg.id);
        if (!worker) return;

        const task: WorkerTask = (worker as any).__task;
        delete (worker as any).__task;

        if (msg.error) {
            task.reject(new Error(msg.error));
        } else {
            task.resolve(msg.result);
        }

        const nextTask = this.taskQueue.shift();
        if (nextTask) {
            worker.postMessage({ id: nextTask.id, data: undefined });
            (worker as any).__task = nextTask;
        } else {
            this.available.push(worker);
        }
    }

    private handleError(err: Error): void {
        console.error('Worker error:', err);
    }

    async close(): Promise<void> {
        for (const worker of this.workers) {
            await worker.terminate();
        }
    }
}

// Usage
const pool = new ThreadPool('./workers/image-processor.js', 4);
const result = await pool.run<ImageResult>({ imagePath: '/uploads/photo.jpg' });
```

## Message Queue (Pub/Sub Pattern)

```typescript
import { Redis } from 'ioredis';

class MessageBus {
    private publisher: Redis;
    private subscriber: Redis;
    private handlers = new Map<string, Set<(data: unknown) => void>>();

    constructor(redisUrl: string) {
        this.publisher = new Redis(redisUrl);
        this.subscriber = new Redis(redisUrl);

        this.subscriber.on('message', (channel, message) => {
            const handlers = this.handlers.get(channel);
            if (!handlers) return;

            const data = JSON.parse(message);
            for (const handler of handlers) {
                handler(data);
            }
        });
    }

    async publish(channel: string, data: unknown): Promise<void> {
        await this.publisher.publish(channel, JSON.stringify(data));
    }

    async subscribe(channel: string, handler: (data: unknown) => void): Promise<void> {
        if (!this.handlers.has(channel)) {
            this.handlers.set(channel, new Set());
            await this.subscriber.subscribe(channel);
        }
        this.handlers.get(channel)!.add(handler);
    }

    async unsubscribe(channel: string, handler: (data: unknown) => void): Promise<void> {
        this.handlers.get(channel)?.delete(handler);
        if (this.handlers.get(channel)?.size === 0) {
            this.handlers.delete(channel);
            await this.subscriber.unsubscribe(channel);
        }
    }
}

// Usage: decouple services
const bus = new MessageBus(process.env.REDIS_URL!);

// Order service publishes
await bus.publish('order:created', { orderId: '123', userId: '456' });

// Notification service subscribes
await bus.subscribe('order:created', async (data) => {
    await sendOrderConfirmation((data as any).orderId);
});

// Analytics service subscribes
await bus.subscribe('order:created', async (data) => {
    await trackOrderCreated((data as any).orderId);
});
```

## Idempotency

```typescript
// Ensure jobs produce the same result even if processed multiple times
class IdempotentJobProcessor {
    constructor(
        private redis: Redis,
        private ttl: number = 86_400_000 // 24h
    ) {}

    async process<T>(
        idempotencyKey: string,
        fn: () => Promise<T>
    ): Promise<T> {
        const lockKey = `idempotency:lock:${idempotencyKey}`;
        const resultKey = `idempotency:result:${idempotencyKey}`;

        // Check for cached result
        const cached = await this.redis.get(resultKey);
        if (cached) return JSON.parse(cached) as T;

        // Acquire lock
        const acquired = await this.redis.set(lockKey, '1', 'PX', 30_000, 'NX');
        if (!acquired) {
            // Another worker is processing — wait and retry
            await new Promise(r => setTimeout(r, 1000));
            return this.process(idempotencyKey, fn);
        }

        try {
            const result = await fn();
            await this.redis.set(resultKey, JSON.stringify(result), 'PX', this.ttl);
            return result;
        } finally {
            await this.redis.del(lockKey);
        }
    }
}
```

## Code Style Rules

- Use BullMQ for Redis-based queues — mature, typed, actively maintained.
- Always set `attempts` and `backoff` on jobs — never let a job silently fail once.
- Use exponential backoff for retries — fixed delay causes thundering herd.
- Move permanently failed jobs to a dead letter queue — never silently drop them.
- Set `removeOnComplete` and `removeOnFail` to prevent unbounded Redis growth.
- Use job names to distinguish job types within the same queue.
- Keep job payloads small — store references (URLs, IDs) not large data blobs.
- Report progress for long-running jobs — clients can poll or subscribe.
- Use idempotency keys for jobs that must not produce duplicate effects.
- Handle `SIGTERM`/`SIGINT` to close workers gracefully — don't abandon in-progress jobs.
- Use separate queues for different priorities — don't mix critical and low-priority jobs.
- Monitor queue depth, failure rate, and processing latency — set alerts on backpressure.
- Rate-limit workers that call external APIs — respect `Retry-After` headers.
- Use worker thread pool for CPU-intensive jobs (image processing, PDF generation).
- For simple in-process tasks, use the lightweight in-process queue — no Redis needed.
