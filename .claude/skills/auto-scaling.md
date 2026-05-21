---
name: auto-scaling
description: Auto-scaling strategies for Node.js applications — horizontal/vertical scaling, PM2 cluster mode, load balancer integration, container orchestration, database scaling (read replicas, connection pooling), stateless design, session management, and scaling patterns for production workloads
---

# Auto-Scaling (Horizontal, Vertical, Load Balancer)

## Scaling Strategies Overview

```
Vertical Scaling (Scale Up)
├─ Increase CPU, RAM on existing server
├─ Simpler — no code changes
├─ Limited by hardware ceiling
└─ Downtime during upgrade

Horizontal Scaling (Scale Out)
├─ Add more server instances
├─ Requires stateless design
├─ Load balancer distributes traffic
├─ No theoretical limit
└─ Zero-downtime scaling

Scaling Dimensions:
├─ Compute: more CPU cores or more instances
├─ Memory: larger heap or more caching nodes
├─ Database: read replicas, sharding, connection pooling
├─ I/O: more event loop capacity, worker threads
└─ Network: CDN, edge caching, geographic distribution
```

## Stateless Application Design

### Principle: No Server-Local State

```typescript
// BAD — stores state in process memory (breaks with multiple instances)
const sessionStore = new Map<string, SessionData>();
const rateLimitCounter = new Map<string, number>();
const tempFiles = new Map<string, Buffer>();

// GOOD — store state in shared external systems
import Redis from 'ioredis';
import { db } from './database';

// Session → Redis
const redis = new Redis(process.env.REDIS_URL!);

async function setSession(sessionId: string, data: SessionData): Promise<void> {
    await redis.set(`session:${sessionId}`, JSON.stringify(data), 'EX', 86400);
}

async function getSession(sessionId: string): Promise<SessionData | null> {
    const raw = await redis.get(`session:${sessionId}`);
    return raw ? JSON.parse(raw) : null;
}

// Rate limit → Redis
async function incrementRateLimit(ip: string): Promise<number> {
    const key = `ratelimit:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    return count;
}

// Temp data → Redis (with TTL)
async function storeTempData(key: string, data: unknown, ttlSeconds = 300): Promise<void> {
    await redis.set(`temp:${key}`, JSON.stringify(data), 'EX', ttlSeconds);
}

// File uploads → Object storage (S3, MinIO)
async function storeUpload(fileId: string, buffer: Buffer): Promise<string> {
    await s3.putObject({
        Bucket: 'uploads',
        Key: fileId,
        Body: buffer,
    });
    return `https://storage.example.com/uploads/${fileId}`;
}
```

### Sticky Sessions vs Shared Sessions

```typescript
// NEVER rely on sticky sessions — use shared session store

// Shared session store via Redis (works with any number of instances)
import session from 'express-session';
import connectRedis from 'connect-redis';

const RedisStore = connectRedis(session);

app.use(session({
    store: new RedisStore({
        client: redis,
        prefix: 'sess:',
        ttl: 86400, // 24 hours
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
    },
}));

// JWT stateless auth — no server-side session needed
// Token contains all required claims — any instance can verify
function verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
}
```

## PM2 Cluster Mode

### Single-Server Scaling

```javascript
// ecosystem.config.js
module.exports = {
    apps: [{
        name: 'quotation-app',
        script: 'dist/server.js',

        // Cluster mode — one process per CPU core
        instances: 'max',       // or specific number: 4
        exec_mode: 'cluster',

        // Auto-restart on memory leak
        max_memory_restart: '512M',

        // Environment
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000,
        },

        // Logging
        error_file: '/var/log/pm2/quotation-error.log',
        out_file: '/var/log/pm2/quotation-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,

        // Restart policy
        min_uptime: '10s',
        max_restarts: 10,
        restart_delay: 4000,

        // Graceful shutdown
        kill_timeout: 10000,
        listen_timeout: 15000,

        // Node.js flags
        node_args: [
            '--max-old-space-size=512',
            '--optimize-for-size',
        ],
    }],
};
```

### PM2 Cluster with Nginx

```nginx
# When using PM2 cluster mode on a single server
# Nginx proxies to the PM2 master which load-balances internally

upstream app_backend {
    # PM2 cluster handles internal load balancing
    # All instances share the same port
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 443 ssl http2;
    server_name quotation.example.com;

    location / {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }
}
```

### Graceful Restart (Zero Downtime)

```bash
# Reload all instances one by one (zero downtime)
pm2 reload quotation-app

# Specific number of instances
pm2 scale quotation-app 8    # scale to 8 instances
pm2 scale quotation-app +2   # add 2 more instances
pm2 scale quotation-app -1   # remove 1 instance
```

```typescript
// Application must handle SIGINT for graceful shutdown
process.on('SIGINT', () => {
    logger.info('Graceful shutdown initiated');
    server.close(() => {
        logger.info('All connections closed');
        db.destroy().then(() => process.exit(0));
    });
    // Force exit after timeout
    setTimeout(() => process.exit(1), 10000);
});
```

## Multi-Server Horizontal Scaling

### Nginx Load Balancer

```nginx
# /etc/nginx/sites-available/quotation-lb

upstream app_backend {
    # Load balancing algorithm
    least_conn;    # route to least busy server

    # Backend servers
    server 10.0.1.10:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3000 max_fails=3 fail_timeout=30s;

    # Backup server (only used when all primaries are down)
    server 10.0.1.20:3000 backup;

    keepalive 64;
}

server {
    listen 443 ssl http2;
    server_name quotation.example.com;

    # SSL config
    ssl_certificate     /etc/letsencrypt/live/quotation.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/quotation.example.com/privkey.pem;

    # Health check endpoint for load balancer
    location /lb-health {
        proxy_pass http://app_backend/health;
        proxy_connect_timeout 2s;
    }

    location / {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Next upstream on error
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_next_upstream_timeout 10s;
        proxy_next_upstream_tries 3;
    }
}
```

### DNS Round Robin (Simple)

```
# Multiple A records pointing to different servers
quotation.example.com.  A  10.0.1.10
quotation.example.com.  A  10.0.1.11
quotation.example.com.  A  10.0.1.12

# DNS TTL — how long clients cache the IP
# Lower TTL = faster failover but more DNS queries
quotation.example.com.  60  A  10.0.1.10
```

## Container Orchestration Scaling

### Docker Compose Scale

```yaml
# docker-compose.prod.yml
version: "3.9"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    deploy:
      replicas: 3               # run 3 instances
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    environment:
      NODE_ENV: production
      PORT: 3000
    expose:
      - "3000"
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - app
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

```nginx
# nginx.conf — dynamic upstream for Docker Compose
# Docker DNS resolves "app" to all container IPs

upstream app_backend {
    server app:3000;    # Docker Compose service name → resolves to all replicas
    keepalive 64;
}
```

```bash
# Scale to N instances
docker compose up -d --scale app=5

# Check running instances
docker compose ps app
```

### Kubernetes HPA (Reference)

```yaml
# k8s/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
    name: quotation-app
spec:
    replicas: 3
    selector:
        matchLabels:
            app: quotation-app
    template:
        metadata:
            labels:
                app: quotation-app
        spec:
            containers:
                - name: app
                  image: ghcr.io/org/quotation-app:latest
                  ports:
                      - containerPort: 3000
                  resources:
                      requests:
                          cpu: 250m
                          memory: 128Mi
                      limits:
                          cpu: "1"
                          memory: 512Mi
                  readinessProbe:
                      httpGet:
                          path: /ready
                          port: 3000
                      initialDelaySeconds: 5
                      periodSeconds: 10
                  livenessProbe:
                      httpGet:
                          path: /live
                          port: 3000
                      initialDelaySeconds: 15
                      periodSeconds: 20
                  env:
                      - name: NODE_ENV
                        value: production
                      - name: PORT
                        value: "3000"
                      - name: DATABASE_URL
                        valueFrom:
                            secretKeyRef:
                                name: quotation-secrets
                                key: database-url
---
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
    name: quotation-app-hpa
spec:
    scaleTargetRef:
        apiVersion: apps/v1
        kind: Deployment
        name: quotation-app
    minReplicas: 3
    maxReplicas: 20
    behavior:
        scaleUp:
            stabilizationWindowSeconds: 60
            policies:
                - type: Pods
                  value: 2
                  periodSeconds: 60
        scaleDown:
            stabilizationWindowSeconds: 300
            policies:
                - type: Pods
                  value: 1
                  periodSeconds: 120
    metrics:
        - type: Resource
          resource:
              name: cpu
              target:
                  type: Utilization
                  averageUtilization: 70
        - type: Resource
          resource:
              name: memory
              target:
                  type: Utilization
                  averageUtilization: 80
```

## Database Scaling

### Read Replicas

```typescript
// Primary for writes, replicas for reads
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

// Write connection — primary database
const writeDb = new Kysely<Database>({
    dialect: new PostgresDialect({
        pool: new Pool({
            host: 'db-primary.internal',
            port: 5432,
            database: 'quotation_prod',
            user: 'app_write',
            password: process.env.DB_WRITE_PASSWORD,
            max: 20,
            idleTimeoutMillis: 30000,
        }),
    }),
});

// Read connection — replica(s) via load balancer
const readDb = new Kysely<Database>({
    dialect: new PostgresDialect({
        pool: new Pool({
            host: 'db-replica.internal',    // HAProxy or PgBouncer
            port: 5432,
            database: 'quotation_prod',
            user: 'app_read',
            password: process.env.DB_READ_PASSWORD,
            max: 40,    // more connections for reads
            idleTimeoutMillis: 30000,
        }),
    }),
});

// Usage pattern
class QuotationRepository {
    // Write → primary
    async create(data: NewQuotation): Promise<Quotation> {
        return writeDb.insertInto('quotations')
            .values(data)
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async update(id: string, data: Partial<Quotation>): Promise<Quotation> {
        return writeDb.updateTable('quotations')
            .set({ ...data, updatedAt: new Date() })
            .where('id', '=', id)
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    // Read → replica
    async findById(id: string): Promise<Quotation | undefined> {
        return readDb.selectFrom('quotations')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();
    }

    async list(filters: QuotationFilters): Promise<Quotation[]> {
        return readDb.selectFrom('quotations')
            .selectAll()
            .limit(filters.limit ?? 50)
            .offset(filters.offset ?? 0)
            .execute();
    }
}
```

### Connection Pooling (PgBouncer)

```ini
; /etc/pgbouncer/pgbouncer.ini

[databases]
quotation_prod = host=127.0.0.1 port=5432 dbname=quotation_prod

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Pool mode — transaction is best for web apps
pool_mode = transaction

; Connection limits
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3

; Timeouts
server_idle_timeout = 300
client_idle_timeout = 600
client_login_timeout = 15
query_timeout = 30
query_wait_timeout = 60

; Logging
log_connections = 0
log_disconnections = 0
log_pooler_errors = 1
stats_period = 60
```

```bash
# Connect through PgBouncer (port 6432 instead of 5432)
psql -h localhost -p 6432 -U app_user quotation_prod
```

### Database Sharding (Conceptual)

```typescript
// Shard router — route queries to correct database by shard key
interface ShardConfig {
    shardKey: string;           // field used for sharding (e.g., orgId)
    shards: {
        range: [number, number]; // hash range
        connectionString: string;
    }[];
}

class ShardRouter {
    private shards: Map<string, Kysely<Database>> = new Map();

    constructor(config: ShardConfig) {
        for (const shard of config.shards) {
            this.shards.set(shard.connectionString, createDb(shard.connectionString));
        }
    }

    // Consistent hashing — same key always routes to same shard
    getShard(keyValue: string): Kysely<Database> {
        const hash = this.hash(keyValue);
        const shardIndex = hash % this.shards.size;
        const connectionStrings = Array.from(this.shards.keys());
        return this.shards.get(connectionStrings[shardIndex])!;
    }

    private hash(key: string): number {
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            hash = ((hash << 5) - hash) + key.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }
}
```

## Redis Scaling

### Redis Sentinel (HA)

```bash
# /etc/redis/sentinel.conf
sentinel monitor quotation-master 10.0.1.10 6379 2
sentinel down-after-milliseconds quotation-master 5000
sentinel failover-timeout quotation-master 10000
sentinel parallel-syncs quotation-master 1

# sentinel monitor quotation-master 10.0.1.11 6379 2
# sentinel monitor quotation-master 10.0.1.12 6379 2
```

```typescript
// Connect via Sentinel — auto-failover
import Redis from 'ioredis';

const redis = new Redis({
    sentinels: [
        { host: '10.0.1.10', port: 26379 },
        { host: '10.0.1.11', port: 26379 },
        { host: '10.0.1.12', port: 26379 },
    ],
    name: 'quotation-master',
    password: process.env.REDIS_PASSWORD,
    sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,
});
```

### Redis Cluster (Sharding)

```typescript
// Redis Cluster — data sharded across multiple nodes
const redis = new Redis.Cluster([
    { host: '10.0.1.10', port: 6379 },
    { host: '10.0.1.11', port: 6379 },
    { host: '10.0.1.12', port: 6379 },
    { host: '10.0.1.13', port: 6379 },
    { host: '10.0.1.14', port: 6379 },
    { host: '10.0.1.15', port: 6379 },
], {
    redisOptions: {
        password: process.env.REDIS_PASSWORD,
    },
    scaleReads: 'slave',    // read from replicas
});
```

## Auto-Scaling Logic

### Custom Scaling Controller

```typescript
// Metric-based auto-scaling (for environments without K8s HPA)
interface ScalingConfig {
    minInstances: number;
    maxInstances: number;
    scaleUpThreshold: number;     // CPU% or request rate
    scaleDownThreshold: number;
    cooldownSeconds: number;
    checkIntervalSeconds: number;
}

class AutoScaler {
    private lastScaleTime = 0;
    private currentInstances: number;

    constructor(
        private config: ScalingConfig,
        private getMetric: () => Promise<number>,        // returns current metric value
        private setInstances: (n: number) => Promise<void>, // scales to N instances
    ) {
        this.currentInstances = config.minInstances;
    }

    async start(): Promise<void> {
        setInterval(() => this.check(), this.config.checkIntervalSeconds * 1000);
    }

    private async check(): Promise<void> {
        const now = Date.now();
        const cooldownMs = this.config.cooldownSeconds * 1000;

        if (now - this.lastScaleTime < cooldownMs) return;

        const metric = await this.getMetric();
        let targetInstances = this.currentInstances;

        if (metric > this.config.scaleUpThreshold) {
            // Scale up — add 50% more instances (rounded up)
            targetInstances = Math.min(
                Math.ceil(this.currentInstances * 1.5),
                this.config.maxInstances,
            );
        } else if (metric < this.config.scaleDownThreshold) {
            // Scale down — remove 25% of instances (rounded down)
            targetInstances = Math.max(
                Math.floor(this.currentInstances * 0.75),
                this.config.minInstances,
            );
        }

        if (targetInstances !== this.currentInstances) {
            logger.info({
                metric,
                current: this.currentInstances,
                target: targetInstances,
                reason: targetInstances > this.currentInstances ? 'scale_up' : 'scale_down',
            }, 'Auto-scaling triggered');

            await this.setInstances(targetInstances);
            this.currentInstances = targetInstances;
            this.lastScaleTime = now;
        }
    }
}

// Usage — scale based on CPU usage
const scaler = new AutoScaler(
    {
        minInstances: 2,
        maxInstances: 10,
        scaleUpThreshold: 70,    // >70% CPU → scale up
        scaleDownThreshold: 30,  // <30% CPU → scale down
        cooldownSeconds: 300,    // 5 min between scaling actions
        checkIntervalSeconds: 60, // check every minute
    },
    async () => {
        // Get average CPU across instances
        const cpuUsage = await getAverageCpuUsage();
        return cpuUsage;
    },
    async (n) => {
        // Scale infrastructure (cloud API, PM2, Docker, etc.)
        await scaleInstances(n);
    },
);
```

### PM2 Programmatic Scaling

```typescript
import { connect, launchBus } from 'pm2';

function scalePM2(processName: string, instances: number): Promise<void> {
    return new Promise((resolve, reject) => {
        connect((err) => {
            if (err) return reject(err);
            // pm2.scale is not a standard API; use ecosystem or CLI
            // Alternative: adjust ecosystem and restart
            resolve();
        });
    });
}

// Bash equivalent in deploy script:
// pm2 scale quotation-app <n>
```

### DigitalOcean / AWS Auto-Scale

```typescript
// Example: Scale DigitalOcean droplets via API
async function scaleDroplets(count: number): Promise<void> {
    const response = await fetch('https://api.digitalocean.com/v2/droplets', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.DO_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: 'quotation-app',
            region: 'sgp1',
            size: 's-2vcpu-4gb',
            image: 'quotation-app-snapshot-id',
            count,           // number of droplets to create
            tags: ['quotation', 'app'],
            user_data: await getCloudInitScript(),
        }),
    });
}

async function getCloudInitScript(): Promise<string> {
    return `#!/bin/bash
    cd /var/www/quotation-app
    git pull origin main
    npm ci --production
    npm run build
    pm2 start ecosystem.config.js --env production
    pm2 save
    `;
}
```

## Caching for Scale

### Multi-Layer Cache to Reduce Load

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

// In-memory L1 cache + Redis L2
class TieredCache<T> {
    private l1 = new Map<string, { data: T; expires: number }>();
    private l1MaxSize: number;
    private l1TtlMs: number;
    private l2TtlSeconds: number;

    constructor(options: { maxSize?: number; l1TtlMs?: number; l2TtlSeconds?: number } = {}) {
        this.l1MaxSize = options.maxSize ?? 100;
        this.l1TtlMs = options.l1TtlMs ?? 5000;        // 5s in-process
        this.l2TtlSeconds = options.l2TtlSeconds ?? 60; // 60s in Redis
    }

    async get(key: string): Promise<T | null> {
        // L1 — in-process
        const l1Entry = this.l1.get(key);
        if (l1Entry && l1Entry.expires > Date.now()) {
            return l1Entry.data;
        }

        // L2 — Redis
        const raw = await redis.get(`cache:${key}`);
        if (raw) {
            const data = JSON.parse(raw) as T;
            this.setL1(key, data);
            return data;
        }

        return null;
    }

    async set(key: string, data: T): Promise<void> {
        this.setL1(key, data);
        await redis.set(`cache:${key}`, JSON.stringify(data), 'EX', this.l2TtlSeconds);
    }

    private setL1(key: string, data: T): void {
        if (this.l1.size >= this.l1MaxSize) {
            const firstKey = this.l1.keys().next().value;
            if (firstKey) this.l1.delete(firstKey);
        }
        this.l1.set(key, { data, expires: Date.now() + this.l1TtlMs });
    }
}

// Usage — cache expensive queries
const quotationCache = new TieredCache<Quotation[]>({ maxSize: 200, l1TtlMs: 10000 });

async function getQuotations(orgId: string): Promise<Quotation[]> {
    const cacheKey = `quotations:${orgId}`;
    const cached = await quotationCache.get(cacheKey);
    if (cached) return cached;

    const results = await db.selectFrom('quotations')
        .selectAll()
        .where('orgId', '=', orgId)
        .execute();

    await quotationCache.set(cacheKey, results);
    return results;
}
```

## Monitoring for Scaling Decisions

```typescript
// Metrics that inform scaling decisions
function collectScalingMetrics(): void {
    // Request rate — requests per second
    const rps = getCount('http_requests_total') / 60; // per minute → per second

    // Average response time
    const avgLatency = getAverage('http_request_duration_ms');

    // Error rate
    const errorRate = getCount('http_responses_total', { status: '5xx' }) /
        getCount('http_responses_total');

    // Active connections
    const activeConns = getGauge('http_active_connections');

    // Queue depth (if using job queue)
    const queueDepth = getGauge('job_queue_depth');

    // Database connections in use
    const dbConnections = getGauge('db_active_connections');

    // CPU and memory per instance
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();

    logger.info({
        scaling: {
            rps: Math.round(rps),
            avgLatencyMs: Math.round(avgLatency),
            errorRate: errorRate.toFixed(4),
            activeConnections: activeConns,
            queueDepth,
            dbConnections,
            cpuUserMs: cpuUsage.user,
            heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        },
    }, 'Scaling metrics snapshot');
}

// Every 30 seconds
setInterval(collectScalingMetrics, 30_000);
```

## Capacity Planning

```
# Estimate resource requirements

Per Instance (2 CPU, 4GB RAM):
├─ Node.js process: ~256MB heap
├─ Max concurrent requests: ~1000 (I/O bound)
├─ Max request rate: ~500 req/s (depends on response time)
├─ Max WebSocket connections: ~10,000
└─ CPU: 70-80% utilization at peak

Example: 10,000 concurrent users
├─ Assume 10% active at any time = 1,000 active
├─ Assume 5 req/s per active user = 5,000 req/s total
├─ With 500 req/s per instance → need 10 instances
├─ Add 50% headroom → 15 instances
├─ Min: 10, Max: 20 (auto-scale range)

Database:
├─ Primary: 1 instance (handle all writes)
├─ Read replicas: 2-3 (handle read load)
├─ Connection pool: 20-50 per app instance
└─ PgBouncer in transaction mode for pooling

Redis:
├─ Single master for cache/session (or Sentinel for HA)
├─ Cluster for high-throughput pub/sub or large datasets
└─ Max 10GB per instance for most use cases

Cost estimate (example):
├─ 3x App servers (2CPU/4GB): $60/mo
├─ 1x DB primary + 2x replicas: $90/mo
├─ 1x Redis managed: $15/mo
├─ 1x Load balancer: $12/mo
└─ Total: ~$177/mo (scales with traffic)
```

## Code Style Rules

- Design applications stateless from the start — store session, cache, and temp data in Redis or database, never in process memory.
- Use JWT for authentication in scaled environments — no server-side session needed, any instance can verify tokens.
- Use PM2 cluster mode for single-server scaling — one process per CPU core with zero code changes.
- Place Nginx or a load balancer in front of multiple app instances — handle TLS termination, static files, and routing at the proxy level.
- Use `proxy_next_upstream` in Nginx — retry on another instance if one fails mid-request.
- Separate read and write database connections — route reads to replicas to reduce primary load.
- Use PgBouncer in transaction pooling mode — multiplex thousands of app connections onto dozens of database connections.
- Configure connection pools per instance — total connections = instances × pool_size, must not exceed database max_connections.
- Use Redis Sentinel for high availability — automatic failover when primary goes down.
- Implement three-tier caching (in-process L1 → Redis L2 → database) — reduce database load at scale.
- Set auto-scaling thresholds with cooldown periods — prevent thrashing between scale-up and scale-down.
- Monitor CPU, memory, request rate, and error rate — use these metrics to drive scaling decisions.
- Plan capacity with headroom — target 50% utilization at peak, scale up when approaching 70%.
- Always implement graceful shutdown — drain connections before instance termination in scaled environments.
- Test scaling by load testing — verify the application works correctly with multiple instances before production.
