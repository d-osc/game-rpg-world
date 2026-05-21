---
name: caching-strategy
description: Caching strategies, patterns, and implementations — in-memory cache, Redis, HTTP caching, CDN, cache invalidation, cache-aside, write-through, write-behind, TTL strategies, and distributed caching
---

# Caching Strategy

## Cache Taxonomy

```
Where cache lives (fastest → slowest):
1. CPU L1/L2/L3          — hardware, transparent
2. In-process memory      — Map, LRU cache, TTL cache
3. Local out-of-process   — Redis on same host, memcached
4. Distributed cache      — Redis cluster, Memcached cluster
5. CDN / edge cache       — Cloudflare, Fastly, Varnish
6. Browser cache          — HTTP cache headers, Service Worker
7. Database buffer pool   — PostgreSQL shared_buffers

What to cache:
- Computed results (aggregations, rankings, recommendations)
- Frequently read, rarely written data (user profiles, config)
- Expensive operations (DB queries, API calls, rendering)
- Static assets (images, JS, CSS, fonts)
```

## In-Memory Caching

### Simple TTL Cache

```typescript
class TTLCache<V> {
    private store = new Map<string, { value: V; expiresAt: number }>();

    get(key: string): V | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    set(key: string, value: V, ttlMs: number): void {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    delete(key: string): boolean {
        return this.store.delete(key);
    }

    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    clear(): void {
        this.store.clear();
    }

    prune(): void {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (now > entry.expiresAt) this.store.delete(key);
        }
    }
}
```

### LRU Cache

```typescript
class LRUCache<V> {
    private capacity: number;
    private map = new Map<string, V>();

    constructor(capacity: number) {
        this.capacity = capacity;
    }

    get(key: string): V | undefined {
        if (!this.map.has(key)) return undefined;
        const value = this.map.get(key)!;
        this.map.delete(key);
        this.map.set(key, value);
        return value;
    }

    set(key: string, value: V): void {
        if (this.map.has(key)) this.map.delete(key);
        else if (this.map.size >= this.capacity) {
            const firstKey = this.map.keys().next().value;
            this.map.delete(firstKey);
        }
        this.map.set(key, value);
    }

    delete(key: string): boolean {
        return this.map.delete(key);
    }

    get size(): number {
        return this.map.size;
    }
}
```

### Memoization

```typescript
function memoize<Args extends unknown[], R>(
    fn: (...args: Args) => R,
    resolver?: (...args: Args) => string
): (...args: Args) => R {
    const cache = new Map<string, { value: R; expiresAt: number }>();
    const defaultTTL = 60_000;

    return (...args: Args): R => {
        const key = resolver ? resolver(...args) : JSON.stringify(args);
        const cached = cache.get(key);

        if (cached && Date.now() < cached.expiresAt) {
            return cached.value;
        }

        const value = fn(...args);
        cache.set(key, { value, expiresAt: Date.now() + defaultTTL });
        return value;
    };
}

const getUserById = memoize(
    async (id: string) => db.query('SELECT * FROM users WHERE id = $1', [id]),
    (id) => `user:${id}`
);
```

## Redis Caching

### Cache-Aside (Lazy Loading)

```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

async function getUser(id: string): Promise<User> {
    const cacheKey = `user:${id}`;

    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!user) throw new NotFoundError('User not found');

    await redis.set(cacheKey, JSON.stringify(user), 'EX', 300);
    return user;
}

async function updateUser(id: string, data: Partial<User>): Promise<User> {
    const user = await db.update('users', id, data);
    await redis.del(`user:${id}`);
    return user;
}
```

### Write-Through Cache

```typescript
async function writeThrough<T>(
    key: string,
    ttl: number,
    writeFn: () => Promise<T>
): Promise<T> {
    const value = await writeFn();
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
    return value;
}

await writeThrough(`user:${id}`, 300, async () => {
    return db.update('users', id, data);
});
```

### Write-Behind (Write-Back) Cache

```typescript
const writeBehindQueue: Map<string, { data: unknown; timer: ReturnType<typeof setTimeout> }> = new Map();

async function writeBehind(
    key: string,
    data: unknown,
    persistFn: (data: unknown) => Promise<void>,
    flushDelayMs = 5000
): Promise<void> {
    await redis.set(key, JSON.stringify(data), 'EX', 300);

    const existing = writeBehindQueue.get(key);
    if (existing) clearTimeout(existing.timer);

    const timer = setTimeout(async () => {
        writeBehindQueue.delete(key);
        try {
            await persistFn(data);
        } catch (err) {
            console.error(`Write-behind flush failed for ${key}:`, err);
        }
    }, flushDelayMs);

    writeBehindQueue.set(key, { data, timer });
}

async function flushWriteBehindQueue(): Promise<void> {
    for (const [, entry] of writeBehindQueue) {
        clearTimeout(entry.timer);
    }
}
```

### Read-Through Cache

```typescript
async function readThrough<T>(
    key: string,
    ttl: number,
    fetchFn: () => Promise<T>
): Promise<T> {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;

    const value = await fetchFn();
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
    return value;
}

const products = await readThrough('products:featured', 600, async () => {
    return db.query('SELECT * FROM products WHERE featured = true LIMIT 20');
});
```

## Cache Invalidation

### Strategies

```
1. TTL-based        — Set expiration, let it expire naturally. Simple but stale.
2. Explicit delete   — Delete cache key on write. Always consistent.
3. Event-driven      — Publish event on write, subscribers invalidate. Decoupled.
4. Version key       — Append version to cache key. Never stale, old entries expire.
5. Tag-based         — Group keys by tag, invalidate all keys in a tag at once.
```

### Tag-Based Invalidation

```typescript
async function setWithTags(
    key: string,
    value: unknown,
    ttl: number,
    tags: string[]
): Promise<void> {
    const pipeline = redis.pipeline();

    pipeline.set(key, JSON.stringify(value), 'EX', ttl);

    for (const tag of tags) {
        pipeline.sadd(`tag:${tag}`, key);
        pipeline.expire(`tag:${tag}`, ttl + 60);
    }

    await pipeline.exec();
}

async function invalidateTag(tag: string): Promise<void> {
    const keys = await redis.smembers(`tag:${tag}`);
    if (keys.length === 0) return;

    const pipeline = redis.pipeline();
    pipeline.del(...keys);
    pipeline.del(`tag:${tag}`);
    await pipeline.exec();
}

await setWithTags('product:123', product, 300, ['products', 'category:electronics']);
await setWithTags('products:featured', featured, 600, ['products', 'homepage']);

await invalidateTag('products');
```

### Event-Driven Invalidation

```typescript
async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const product = await db.update('products', id, data);

    await redis.publish('cache:invalidate', JSON.stringify({
        keys: [`product:${id}`],
        tags: ['products', `category:${product.category_id}`],
    }));

    return product;
}

const subscriber = redis.duplicate();
await subscriber.subscribe('cache:invalidate');

subscriber.on('message', async (_channel, message) => {
    const { keys, tags } = JSON.parse(message);

    if (keys?.length) await redis.del(...keys);
    for (const tag of tags ?? []) {
        await invalidateTag(tag);
    }
});
```

## HTTP Caching

### Response Headers

```typescript
// Immutable static assets — cache forever
app.get('/assets/*', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Vary', 'Accept-Encoding');
});

// API responses — short cache with revalidation
app.get('/api/products', (_req, res) => {
    res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
    res.setHeader('Vary', 'Authorization');
    res.json(products);
});

// User-specific data — private, must revalidate
app.get('/api/me', (_req, res) => {
    res.setHeader('Cache-Control', 'private, no-cache');
    res.json(user);
});

// ETag-based conditional requests
app.get('/api/products/:id', (req, res) => {
    const etag = `"${hash(product.updated_at)}"`;

    if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json(product);
});

// Last-Modified-based conditional requests
app.get('/api/articles/:id', (req, res) => {
    const lastModified = article.updated_at.toUTCString();

    if (req.headers['if-modified-since'] === lastModified) {
        return res.status(304).end();
    }

    res.setHeader('Last-Modified', lastModified);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(article);
});
```

### Cache-Control Directives Reference

```
max-age=<seconds>         — Cache lifetime
s-maxage=<seconds>        — Cache lifetime for shared caches (CDN) only
no-cache                  — Must revalidate before use (not "don't cache")
no-store                  — Never cache anything
private                   — Only browser may cache (not CDN)
public                    — Any cache may store the response
immutable                 — Content will never change, skip revalidation
stale-while-revalidate=<s> — Serve stale while fetching fresh in background
stale-if-error=<seconds>  — Serve stale if origin is unreachable
must-revalidate           — Must verify stale entries before use
no-transform              — Don't modify response body
```

### Vary Header

```
Vary: Accept-Encoding    — Separate cache entries per encoding
Vary: Authorization       — Separate cache entries per auth token
Vary: Accept-Language     — Separate cache entries per language
Vary: *                   — Don't cache at all
```

## CDN Caching

### Edge Cache Strategy

```typescript
// Surrogate-Key for CDN purging (Fastly, Cloudflare)
app.get('/api/products/:id', (req, res) => {
    res.setHeader('Surrogate-Key', `product-${req.params.id} products category-${product.category_id}`);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.json(product);
});

// Purge CDN cache via API
async function purgeCDN(keys: string[]): Promise<void> {
    await fetch('https://api.fastly.com/service/{id}/purge', {
        method: 'POST',
        headers: {
            'Fastly-Key': process.env.FASTLY_API_KEY!,
            'Surrogate-Key': keys.join(' '),
        },
    });
}
```

## Distributed Caching Patterns

### Thundering Herd (Cache Stampede) Protection

```typescript
async function getWithStampedeProtection<T>(
    key: string,
    ttl: number,
    fetchFn: () => Promise<T>
): Promise<T> {
    const lockKey = `lock:${key}`;

    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;

    const acquired = await redis.set(lockKey, '1', 'EX', 10, 'NX');
    if (acquired) {
        try {
            const value = await fetchFn();
            await redis.set(key, JSON.stringify(value), 'EX', ttl);
            return value;
        } finally {
            await redis.del(lockKey);
        }
    }

    // Wait for the lock holder to populate cache
    await new Promise(r => setTimeout(r, 100));
    const retry = await redis.get(key);
    if (retry) return JSON.parse(retry) as T;

    return fetchFn();
}
```

### Early Expiration (Refresh Ahead)

```typescript
async function getWithRefreshAhead<T>(
    key: string,
    ttl: number,
    fetchFn: () => Promise<T>,
    refreshAtRatio = 0.8
): Promise<T> {
    const raw = await redis.get(key);

    if (raw) {
        const entry = JSON.parse(raw) as { value: T; setAt: number };
        const age = Date.now() - entry.setAt;
        const ttlMs = ttl * 1000;

        if (age > ttlMs * refreshAtRatio) {
            fetchFn().then(fresh => {
                redis.set(key, JSON.stringify({ value: fresh, setAt: Date.now() }), 'EX', ttl);
            }).catch(() => {});
        }

        return entry.value;
    }

    const value = await fetchFn();
    await redis.set(key, JSON.stringify({ value, setAt: Date.now() }), 'EX', ttl);
    return value;
}
```

### Circuit Breaker for Cache

```typescript
async function getWithFallback<T>(
    key: string,
    ttl: number,
    fetchFn: () => Promise<T>
): Promise<T> {
    try {
        const cached = await redis.get(key);
        if (cached) return JSON.parse(cached) as T;
    } catch (err) {
        console.warn('Cache unavailable, falling back to DB:', err);
    }

    const value = await fetchFn();

    try {
        await redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
        console.warn('Cache write failed:', err);
    }

    return value;
}
```

## TTL Strategy

### Choosing TTL Values

```
Data type                     TTL         Strategy
─────────────────────────────────────────────────────
Authentication tokens          15 min      Short, refresh on access
User session                   30 min      Medium, extend on activity
User profile                   5 min       Short, explicit invalidation on update
Product catalog                15 min      Medium, invalidate on price/stock change
Search results                 2 min       Very short, ranking changes frequently
Homepage / featured            10 min      Medium, tag-based invalidation
Static assets                  1 year      Content-hash filename, immutable
Config / feature flags         1 min       Very short, must reflect changes quickly
Rate limit counters            sliding     Use Redis INCR + EX
Aggregations / analytics       1 hour      Long, accept eventual consistency
Recommendations                30 min      Medium, accept slight staleness
```

### Jitter for TTL

```typescript
function ttlWithJitter(baseTtl: number, jitterRatio = 0.1): number {
    const jitter = baseTtl * jitterRatio * Math.random();
    return Math.floor(baseTtl + jitter);
}

await redis.set(key, JSON.stringify(value), 'EX', ttlWithJitter(300));
```

## Application-Level Patterns

### Request-Level Cache

```typescript
class RequestCache {
    private cache = new Map<string, Promise<unknown>>();

    async get<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
        if (this.cache.has(key)) return this.cache.get(key) as Promise<T>;

        const promise = fetchFn();
        this.cache.set(key, promise);
        return promise;
    }
}

app.use((req, _res, next) => {
    req.cache = new RequestCache();
    next();
});

const user = await req.cache.get(`user:${userId}`, () => getUser(userId));
```

### Precomputed Cache (Materialized Views)

```typescript
async function refreshDashboardCache(): Promise<void> {
    const pipeline = redis.pipeline();

    const [totalRevenue, activeUsers, topProducts] = await Promise.all([
        db.query('SELECT SUM(total) FROM orders WHERE created_at > NOW() - INTERVAL $1', ['30 days']),
        db.query('SELECT COUNT(DISTINCT user_id) FROM sessions WHERE created_at > NOW() - INTERVAL $1', ['1 day']),
        db.query('SELECT id, name, SUM(qty) as sold FROM order_items GROUP BY id ORDER BY sold DESC LIMIT 10'),
    ]);

    pipeline.set('dashboard:revenue', JSON.stringify(totalRevenue), 'EX', 600);
    pipeline.set('dashboard:active_users', JSON.stringify(activeUsers), 'EX', 300);
    pipeline.set('dashboard:top_products', JSON.stringify(topProducts), 'EX', 1800);

    await pipeline.exec();
}

setInterval(refreshDashboardCache, 5 * 60_000);
```

### Multi-Layer Cache

```typescript
class MultiLayerCache<V> {
    constructor(
        private l1: TTLCache<V>,
        private l2: Redis,
        private ttl: { l1: number; l2: number }
    ) {}

    async get(key: string, fetchFn: () => Promise<V>): Promise<V> {
        const l1Value = this.l1.get(key);
        if (l1Value !== undefined) return l1Value;

        const l2Value = await this.l2.get(key);
        if (l2Value) {
            const parsed = JSON.parse(l2Value) as V;
            this.l1.set(key, parsed, this.ttl.l1);
            return parsed;
        }

        const value = await fetchFn();
        this.l1.set(key, value, this.ttl.l1);
        await this.l2.set(key, JSON.stringify(value), 'EX', this.ttl.l2);
        return value;
    }

    async invalidate(key: string): Promise<void> {
        this.l1.delete(key);
        await this.l2.del(key);
    }
}
```

## Monitoring & Observability

```typescript
interface CacheMetrics {
    hitRate: number;           // hits / (hits + misses) — target > 90%
    missRate: number;
    averageLatency: number;
    evictionRate: number;
    memoryUsage: number;
    errorRate: number;
}

class InstrumentedCache<V> {
    private hits = 0;
    private misses = 0;

    async get(key: string, fetchFn: () => Promise<V>): Promise<V> {
        const cached = await this.cache.get(key);
        if (cached !== undefined) {
            this.hits++;
            return cached;
        }

        this.misses++;
        const value = await fetchFn();
        await this.cache.set(key, value);
        return value;
    }

    get hitRate(): number {
        const total = this.hits + this.misses;
        return total === 0 ? 0 : this.hits / total;
    }
}

// Redis INFO command for server-level metrics
// redis-cli INFO stats    → keyspace_hits, keyspace_misses
// redis-cli INFO memory   → used_memory, maxmemory
// redis-cli INFO clients  → connected_clients
```

## Code Style Rules

- Default to cache-aside for simplicity — only use write-through/write-behind when consistency demands it.
- Always set a TTL — unbounded caches grow forever and cause memory issues.
- Add jitter to TTLs to avoid synchronized expiration causing stampedes.
- Use tag-based invalidation for related cache entries that must be invalidated together.
- Handle cache failures gracefully — cache unavailable should not break the application.
- Use pipeline/multi for bulk Redis operations — avoid round trips.
- Monitor hit rate — if below 80%, investigate working set size, TTL, or key strategy.
- Cache at the right granularity — cache the computed result, not the raw query, when possible.
- Never cache sensitive data (passwords, tokens, PII) without encryption.
- Use `NX` flag for lock acquisition — never assume you are the only writer.
- Keep cache keys consistent and namespaced: `entity:id` or `feature:param1:param2`.
- Consider read-through pattern to centralize cache logic outside business code.
- Use ETag/Last-Modified for HTTP APIs to save bandwidth on unchanged responses.
- Precompute expensive aggregations on a schedule rather than caching on-demand.
