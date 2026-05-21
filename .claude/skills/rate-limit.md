---
name: rate-limit
description: Rate limiting strategies and implementations — fixed window, sliding window, token bucket, leaky bucket, sliding log, distributed rate limiting, backoff strategies, retry patterns, and client-side rate limit handling
---

# Rate Limit Handling

## Core Algorithms

### Fixed Window Counter

```typescript
// Simple but has burst problem at window boundaries
// e.g., 100 requests at 11:59:59 + 100 requests at 12:00:01 = 200 in 2 seconds

interface FixedWindowRateLimiter {
    increment(key: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }>;
}

class RedisFixedWindowLimiter implements FixedWindowRateLimiter {
    constructor(
        private redis: Redis,
        private limit: number,
        private windowSeconds: number
    ) {}

    async increment(key: string) {
        const windowKey = `rl:${key}:${Math.floor(Date.now() / 1000 / this.windowSeconds)}`;
        const pipeline = this.redis.pipeline();
        pipeline.incr(windowKey);
        pipeline.expire(windowKey, this.windowSeconds);
        const results = await pipeline.exec()!;
        const count = Number(results[0][1]);

        const allowed = count <= this.limit;
        const remaining = Math.max(0, this.limit - count);
        const resetAt = (Math.floor(Date.now() / 1000 / this.windowSeconds) + 1) * this.windowSeconds * 1000;

        return { allowed, remaining, resetAt };
    }
}
```

### Sliding Window Log

```typescript
// Accurate but memory-intensive — stores every request timestamp
// O(n) memory per key where n = requests in window

class SlidingWindowLogLimiter {
    constructor(
        private redis: Redis,
        private limit: number,
        private windowMs: number
    ) {}

    async increment(key: string) {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        const setKey = `rl:log:${key}`;

        const pipeline = this.redis.pipeline();
        pipeline.zremrangebyscore(setKey, '-inf', windowStart);
        pipeline.zcard(setKey);
        pipeline.zadd(setKey, now, `${now}:${Math.random()}`);
        pipeline.pexpire(setKey, this.windowMs);

        const results = await pipeline.exec()!;
        const count = Number(results[1][1]);

        const allowed = count < this.limit;
        const remaining = Math.max(0, this.limit - count - 1);

        if (!allowed) {
            await this.redis.zrem(setKey, `${now}:${Math.random()}`);
            return { allowed: false, remaining: 0, resetAt: windowStart + this.windowMs };
        }

        return { allowed: true, remaining, resetAt: windowStart + this.windowMs };
    }
}
```

### Sliding Window Counter (Hybrid)

```typescript
// Best balance of accuracy and memory efficiency
// Weighted average of current and previous window

class SlidingWindowCounterLimiter {
    constructor(
        private redis: Redis,
        private limit: number,
        private windowMs: number
    ) {}

    async increment(key: string) {
        const now = Date.now();
        const windowMs = this.windowMs;
        const currentWindow = Math.floor(now / windowMs);
        const previousWindow = currentWindow - 1;
        const elapsedRatio = (now % windowMs) / windowMs;

        const currentKey = `rl:sw:${key}:${currentWindow}`;
        const previousKey = `rl:sw:${key}:${previousWindow}`;

        const pipeline = this.redis.pipeline();
        pipeline.get(previousKey);
        pipeline.incr(currentKey);
        pipeline.expire(currentKey, Math.ceil(windowMs / 1000) * 2);

        const results = await pipeline.exec()!;
        const previousCount = Number(results[0][1] ?? 0);
        const currentCount = Number(results[1][1]);

        const weightedCount = Math.floor(previousCount * (1 - elapsedRatio)) + currentCount;

        const allowed = weightedCount <= this.limit;
        const remaining = Math.max(0, this.limit - weightedCount);
        const resetAt = (currentWindow + 1) * windowMs;

        return { allowed, remaining, resetAt };
    }
}
```

### Token Bucket

```typescript
// Best for bursty traffic with sustained average rate
// Allows short bursts up to bucket capacity, refills over time

class TokenBucketLimiter {
    constructor(
        private redis: Redis,
        private capacity: number,      // max tokens (burst size)
        private refillRate: number,     // tokens added per second
    ) {}

    async consume(key: string, tokens = 1) {
        const script = `
            local key = KEYS[1]
            local capacity = tonumber(ARGV[1])
            local refill_rate = tonumber(ARGV[2])
            local tokens_requested = tonumber(ARGV[3])
            local now = tonumber(ARGV[4])

            local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
            local current_tokens = tonumber(bucket[1])
            local last_refill = tonumber(bucket[2])

            if current_tokens == nil then
                current_tokens = capacity
                last_refill = now
            end

            local elapsed = math.max(0, now - last_refill)
            local refill = elapsed * refill_rate / 1000
            current_tokens = math.min(capacity, current_tokens + refill)
            last_refill = now

            if current_tokens >= tokens_requested then
                current_tokens = current_tokens - tokens_requested
                redis.call('HMSET', key, 'tokens', current_tokens, 'last_refill', last_refill)
                redis.call('PEXPIRE', key, math.ceil(capacity / refill_rate * 1000) + 1000)
                return {1, math.floor(current_tokens)}
            else
                redis.call('HMSET', key, 'tokens', current_tokens, 'last_refill', last_refill)
                redis.call('PEXPIRE', key, math.ceil(capacity / refill_rate * 1000) + 1000)
                local wait_ms = math.ceil((tokens_requested - current_tokens) / refill_rate * 1000)
                return {0, wait_ms}
            end
        `;

        const result = await this.redis.eval(
            script, 1, `rl:tb:${key}`,
            this.capacity, this.refillRate, tokens, Date.now()
        ) as [number, number];

        if (result[0] === 1) {
            return { allowed: true, remaining: result[1] };
        }

        return { allowed: false, retryAfterMs: result[1] };
    }
}
```

### Leaky Bucket

```typescript
// Smooths request rate to a constant output rate
// Good for downstream API protection

class LeakyBucketLimiter {
    constructor(
        private redis: Redis,
        private capacity: number,      // queue size (max backlog)
        private leakRate: number,       // requests processed per second
    ) {}

    async add(key: string): Promise<{ allowed: boolean; queueSize: number }> {
        const script = `
            local key = KEYS[1]
            local capacity = tonumber(ARGV[1])
            local leak_rate = tonumber(ARGV[2])
            local now = tonumber(ARGV[3])

            local bucket = redis.call('HMGET', key, 'level', 'last_leak')
            local level = tonumber(bucket[1])
            local last_leak = tonumber(bucket[2])

            if level == nil then
                level = 0
                last_leak = now
            end

            local elapsed = math.max(0, now - last_leak)
            local leaked = elapsed * leak_rate / 1000
            level = math.max(0, level - leaked)
            last_leak = now

            if level < capacity then
                level = level + 1
                redis.call('HMSET', key, 'level', level, 'last_leak', last_leak)
                redis.call('PEXPIRE', key, math.ceil(capacity / leak_rate * 1000) + 1000)
                return {1, math.ceil(level)}
            else
                redis.call('HMSET', key, 'level', level, 'last_leak', last_leak)
                redis.call('PEXPIRE', key, math.ceil(capacity / leak_rate * 1000) + 1000)
                return {0, math.ceil(level)}
            end
        `;

        const result = await this.redis.eval(
            script, 1, `rl:lb:${key}`,
            this.capacity, this.leakRate, Date.now()
        ) as [number, number];

        return { allowed: result[0] === 1, queueSize: result[1] };
    }
}
```

## Algorithm Comparison

```
Algorithm            Accuracy  Memory    Burst Support  Best For
──────────────────────────────────────────────────────────────────
Fixed Window         Low       O(1)      No             Simple APIs, low precision needs
Sliding Window Log   High      O(n)      No             Strict per-request accuracy
Sliding Window Ctr   Medium    O(1)      No             Good balance, general purpose
Token Bucket         Medium    O(1)      Yes            APIs with burst + sustained rate
Leaky Bucket         Medium    O(1)      No             Smoothing, downstream protection

Recommendation:
- Default: Sliding Window Counter (good accuracy, O(1) memory)
- APIs with burst patterns: Token Bucket
- Protecting downstream services: Leaky Bucket
- Strict accuracy required: Sliding Window Log (if memory allows)
```

## Middleware Implementation

### Express Middleware

```typescript
import { Request, Response, NextFunction } from 'express';

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt?: number;
    retryAfterMs?: number;
}

interface RateLimiter {
    check(key: string): Promise<RateLimitResult>;
}

function rateLimitMiddleware(limiter: RateLimiter, keyFn: (req: Request) => string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const key = keyFn(req);
        const result = await limiter.check(key);

        res.setHeader('X-RateLimit-Remaining', result.remaining);

        if (result.resetAt) {
            res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
        }

        if (!result.allowed) {
            res.setHeader('Retry-After', Math.ceil((result.retryAfterMs ?? 1000) / 1000));
            res.status(429).json({
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Please retry later.',
                retryAfter: Math.ceil((result.retryAfterMs ?? 1000) / 1000),
            });
            return;
        }

        next();
    };
}

// Per-IP rate limiting
app.use('/api/', rateLimitMiddleware(
    new SlidingWindowCounterLimiter(redis, 100, 60_000),
    (req) => req.ip ?? 'unknown'
));

// Per-user rate limiting (authenticated)
app.use('/api/', authMiddleware, rateLimitMiddleware(
    new TokenBucketLimiter(redis, 50, 10),
    (req) => `user:${(req as any).user.id}`
));

// Per-endpoint + per-user
app.use('/api/search', rateLimitMiddleware(
    new SlidingWindowCounterLimiter(redis, 20, 60_000),
    (req) => `search:${(req as any).user.id}`
));

// Strict limit for expensive operations
app.use('/api/reports/generate', rateLimitMiddleware(
    new RedisFixedWindowLimiter(redis, 5, 3600),
    (req) => `report:${(req as any).user.id}`
));
```

### Tiered Rate Limiting

```typescript
interface RateLimitTier {
    name: string;
    limits: { windowMs: number; maxRequests: number }[];
}

const TIERS: Record<string, RateLimitTier> = {
    free: {
        name: 'free',
        limits: [
            { windowMs: 60_000, maxRequests: 30 },
            { windowMs: 3_600_000, maxRequests: 500 },
        ],
    },
    pro: {
        name: 'pro',
        limits: [
            { windowMs: 60_000, maxRequests: 120 },
            { windowMs: 3_600_000, maxRequests: 5000 },
        ],
    },
    enterprise: {
        name: 'enterprise',
        limits: [
            { windowMs: 60_000, maxRequests: 600 },
            { windowMs: 3_600_000, maxRequests: 100_000 },
        ],
    },
};

function tieredRateLimit(redis: Redis) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        const tier = TIERS[user.plan] ?? TIERS.free;

        let blocked = false;
        let minRemaining = Infinity;
        let resetAt = 0;

        for (const limit of tier.limits) {
            const limiter = new SlidingWindowCounterLimiter(redis, limit.maxRequests, limit.windowMs);
            const result = await limiter.increment(`${tier.name}:${user.id}:${limit.windowMs}`);

            if (!result.allowed) blocked = true;
            minRemaining = Math.min(minRemaining, result.remaining);
            resetAt = Math.max(resetAt, result.resetAt);
        }

        res.setHeader('X-RateLimit-Limit', tier.name);
        res.setHeader('X-RateLimit-Remaining', minRemaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));

        if (blocked) {
            res.setHeader('Retry-After', Math.ceil((resetAt - Date.now()) / 1000));
            res.status(429).json({ error: 'Too Many Requests' });
            return;
        }

        next();
    };
}
```

## Distributed Rate Limiting

### Redis Lua Script (Atomic)

```lua
-- Atomic sliding window counter with Lua
-- Ensures consistency across multiple app instances

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local current_window = math.floor(now / window)
local previous_window = current_window - 1
local elapsed_ratio = (now % window) / window

local current_key = key .. ':' .. current_window
local previous_key = key .. ':' .. previous_window

local previous_count = tonumber(redis.call('GET', previous_key) or '0')
local current_count = tonumber(redis.call('INCR', current_key))

if current_count == 1 then
    redis.call('EXPIRE', current_key, math.ceil(window / 1000) * 2)
end

local weighted = math.floor(previous_count * (1 - elapsed_ratio)) + current_count

if weighted <= limit then
    return {1, limit - weighted, (current_window + 1) * window}
else
    return {0, 0, (current_window + 1) * window}
end
```

### Rate Limit Headers (Standard)

```
Standard response headers:
X-RateLimit-Limit       — Maximum requests allowed in the window
X-RateLimit-Remaining   — Requests remaining in current window
X-RateLimit-Reset       — Unix timestamp when the window resets

On 429 response, also include:
Retry-After             — Seconds until client should retry

RFC 6585 — HTTP 429 Too Many Requests
RFC 7231 — Retry-After header
```

## Client-Side Rate Limit Handling

### Retry with Exponential Backoff

```typescript
interface RetryOptions {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitter?: boolean;
    retryableStatuses: number[];
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
    maxRetries: 5,
    baseDelayMs: 1000,
    maxDelayMs: 30_000,
    jitter: true,
    retryableStatuses: [429, 502, 503, 504],
};

async function fetchWithRetry(
    url: string,
    options?: RequestInit,
    retryOpts: Partial<RetryOptions> = {}
): Promise<Response> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...retryOpts };
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);

            if (!opts.retryableStatuses.includes(response.status)) {
                return response;
            }

            if (response.status === 429) {
                const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
                await delay(retryAfter ?? calculateBackoff(attempt, opts));
                continue;
            }

            lastError = new Error(`HTTP ${response.status}`);
            await delay(calculateBackoff(attempt, opts));
        } catch (err) {
            lastError = err as Error;
            if (attempt < opts.maxRetries) {
                await delay(calculateBackoff(attempt, opts));
            }
        }
    }

    throw lastError ?? new Error('Max retries exceeded');
}

function calculateBackoff(attempt: number, opts: RetryOptions): number {
    const backoff = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt),
        opts.maxDelayMs
    );

    if (opts.jitter) {
        return backoff * (0.5 + Math.random() * 0.5);
    }

    return backoff;
}

function parseRetryAfter(value: string | null): number | null {
    if (!value) return null;

    const seconds = Number(value);
    if (!isNaN(seconds)) return seconds * 1000;

    const date = new Date(value);
    if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());

    return null;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Client-Side Rate Limiter (Throttle Local Requests)

```typescript
class ClientRateLimiter {
    private queue: Array<() => void> = [];
    private activeCount = 0;
    private timestamps: number[] = [];

    constructor(
        private maxConcurrent: number,
        private maxPerSecond: number
    ) {}

    async acquire(): Promise<void> {
        while (this.activeCount >= this.maxConcurrent) {
            await new Promise<void>(resolve => this.queue.push(resolve));
        }

        const now = Date.now();
        this.timestamps = this.timestamps.filter(t => now - t < 1000);

        if (this.timestamps.length >= this.maxPerSecond) {
            const oldestInWindow = this.timestamps[0];
            const waitMs = 1000 - (now - oldestInWindow);
            await delay(Math.max(0, waitMs));
        }

        this.activeCount++;
        this.timestamps.push(Date.now());
    }

    release(): void {
        this.activeCount--;
        const next = this.queue.shift();
        if (next) next();
    }

    async run<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }
}

const limiter = new ClientRateLimiter(5, 10);

const results = await Promise.all(
    ids.map(id => limiter.run(() => fetch(`/api/users/${id}`)))
);
```

### Batch + Queue Pattern

```typescript
class BatchProcessor<T, R> {
    private queue: Array<{ input: T; resolve: (value: R) => void; reject: (err: Error) => void }> = [];
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private processBatch: (items: T[]) => Promise<R[]>,
        private maxBatchSize: number,
        private flushIntervalMs: number,
        private rateLimiter: ClientRateLimiter
    ) {}

    add(input: T): Promise<R> {
        return new Promise((resolve, reject) => {
            this.queue.push({ input, resolve, reject });

            if (this.queue.length >= this.maxBatchSize) {
                this.flush();
            } else if (!this.timer) {
                this.timer = setTimeout(() => this.flush(), this.flushIntervalMs);
            }
        });
    }

    private async flush(): Promise<void> {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        const batch = this.queue.splice(0, this.maxBatchSize);
        if (batch.length === 0) return;

        const inputs = batch.map(b => b.input);

        try {
            await this.rateLimiter.acquire();
            const results = await this.processBatch(inputs);
            batch.forEach((b, i) => b.resolve(results[i]));
        } catch (err) {
            batch.forEach(b => b.reject(err as Error));
        } finally {
            this.rateLimiter.release();
        }
    }
}
```

## Advanced Patterns

### Adaptive Rate Limiting

```typescript
class AdaptiveRateLimiter {
    private currentLimit: number;
    private minLimit: number;
    private maxLimit: number;

    constructor(
        private baseLimit: number,
        private redis: Redis
    ) {
        this.currentLimit = baseLimit;
        this.minLimit = Math.floor(baseLimit * 0.1);
        this.maxLimit = Math.floor(baseLimit * 1.5);
    }

    async check(key: string): Promise<RateLimitResult> {
        const health = await this.getSystemHealth();

        if (health.avgResponseMs > 2000) {
            this.currentLimit = Math.max(this.minLimit, Math.floor(this.currentLimit * 0.8));
        } else if (health.avgResponseMs < 200) {
            this.currentLimit = Math.min(this.maxLimit, Math.floor(this.currentLimit * 1.1));
        }

        const limiter = new SlidingWindowCounterLimiter(this.redis, this.currentLimit, 60_000);
        return limiter.increment(key);
    }

    private async getSystemHealth() {
        return { avgResponseMs: 500, errorRate: 0.01 };
    }
}
```

### Rate Limit per Action Type

```typescript
const ACTION_LIMITS = {
    login:          { max: 5,   windowMs: 15 * 60_000 },   // 5 per 15 min
    register:       { max: 3,   windowMs: 60 * 60_000 },    // 3 per hour
    passwordReset:  { max: 3,   windowMs: 60 * 60_000 },    // 3 per hour
    search:         { max: 30,  windowMs: 60_000 },          // 30 per min
    fileUpload:     { max: 10,  windowMs: 60 * 60_000 },    // 10 per hour
    apiCall:        { max: 100, windowMs: 60_000 },          // 100 per min
    webhook:        { max: 1000, windowMs: 60_000 },         // 1000 per min
} as const;

type Action = keyof typeof ACTION_LIMITS;

function actionRateLimit(action: Action, redis: Redis) {
    const config = ACTION_LIMITS[action];
    const limiter = new SlidingWindowCounterLimiter(redis, config.max, config.windowMs);

    return async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        const key = `${action}:${user?.id ?? req.ip}`;
        const result = await limiter.increment(key);

        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

        if (!result.allowed) {
            res.setHeader('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000));
            res.status(429).json({
                error: 'Too Many Requests',
                action,
                retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
            });
            return;
        }

        next();
    };
}

app.post('/auth/login', actionRateLimit('login', redis));
app.post('/auth/register', actionRateLimit('register', redis));
app.post('/auth/forgot-password', actionRateLimit('passwordReset', redis));
```

### Anonymous + Authenticated Dual Limits

```typescript
function dualRateLimit(redis: Redis) {
    const anonymousLimiter = new SlidingWindowCounterLimiter(redis, 30, 60_000);
    const authenticatedLimiter = new SlidingWindowCounterLimiter(redis, 100, 60_000);

    return async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        let result: RateLimitResult;

        if (user) {
            result = await authenticatedLimiter.increment(`user:${user.id}`);
        } else {
            result = await anonymousLimiter.increment(`ip:${req.ip}`);
        }

        res.setHeader('X-RateLimit-Remaining', result.remaining);

        if (!result.allowed) {
            res.setHeader('Retry-After', Math.ceil((result.resetAt! - Date.now()) / 1000));
            res.status(429).json({ error: 'Too Many Requests' });
            return;
        }

        next();
    };
}
```

## Monitoring & Alerting

```typescript
interface RateLimitMetrics {
    totalRequests: number;
    allowedRequests: number;
    rejectedRequests: number;
    rejectionRate: number;
    topLimitedKeys: Array<{ key: string; count: number }>;
}

class RateLimitMonitor {
    private allowed = new Map<string, number>();
    private rejected = new Map<string, number>();

    record(key: string, allowed: boolean): void {
        const map = allowed ? this.allowed : this.rejected;
        map.set(key, (map.get(key) ?? 0) + 1);
    }

    getMetrics(): RateLimitMetrics {
        let totalAllowed = 0;
        let totalRejected = 0;

        for (const count of this.allowed.values()) totalAllowed += count;
        for (const count of this.rejected.values()) totalRejected += count;

        const total = totalAllowed + totalRejected;

        const topLimitedKeys = [...this.rejected.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([key, count]) => ({ key, count }));

        return {
            totalRequests: total,
            allowedRequests: totalAllowed,
            rejectedRequests: totalRejected,
            rejectionRate: total > 0 ? totalRejected / total : 0,
            topLimitedKeys,
        };
    }

    reset(): void {
        this.allowed.clear();
        this.rejected.clear();
    }
}
```

## Code Style Rules

- Use Redis Lua scripts for atomic distributed rate limiting — avoid race conditions.
- Always return rate limit headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`) even on success.
- Return `Retry-After` header on 429 responses — clients need to know when to retry.
- Use sliding window counter as default — best accuracy-to-memory ratio.
- Use token bucket when burst support is needed (e.g., file uploads, batch jobs).
- Apply rate limits per-user for authenticated routes, per-IP for anonymous routes.
- Set stricter limits on expensive endpoints (search, report generation, file upload).
- Use separate limits per action type — login should not share quota with search.
- Implement exponential backoff with jitter on the client side — avoid thundering herd on retry.
- Respect `Retry-After` header from server responses — don't guess the retry time.
- Monitor rejection rates — high rejection rate may indicate limits are too low or an attack.
- Use adaptive rate limiting when downstream system capacity varies.
- Never rate limit health check or readiness endpoints.
- Log 429 responses with enough context to identify abuse patterns.
