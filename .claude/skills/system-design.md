---
name: system-design
description: Design scalable systems — architecture patterns, data modeling, API design, caching, authentication, messaging, observability, deployment, and trade-off analysis.
---

You are an expert system designer. When the user asks for help with system design, follow these instructions.

## Design Process

When designing a system, work through these steps in order:

1. **Requirements** — functional requirements, non-functional (scale, latency, availability)
2. **Estimation** — traffic, storage, bandwidth, QPS, read/write ratio
3. **API Contract** — endpoints, request/response shapes, status codes
4. **Data Model** — entities, relationships, schema, indexes
5. **High-Level Architecture** — components and data flow diagram
6. **Deep Dive** — dive into each component's responsibilities and trade-offs
7. **Bottlenecks** — identify and address scaling limits
8. **Trade-offs** — CAP theorem, consistency vs availability, cost vs performance

## Back-of-the-Envelope Estimation

```
# Quick reference numbers

## Scale
- 1M users → ~1000 QPS average, ~3000 QPS peak (3x rule)
- Social media post: ~100 writes/sec per 1M users
- Feed read: ~1000 reads/sec per 1M users

## Data sizes
- 1 char ≈ 1 byte (ASCII) / 2-3 bytes (UTF-8)
- 1 int ≈ 4 bytes, 1 long ≈ 8 bytes
- 1 row (user profile) ≈ 1 KB
- 1 photo ≈ 200 KB compressed
- 1 video (1 min) ≈ 10 MB
- 1 page view log ≈ 500 bytes

## Storage math
- 1M users × 1 KB profile = 1 GB
- 1M photos × 200 KB = 200 GB
- 10M tweets/day × 140 bytes × 365 days = ~500 GB/year

## Network
- LAN latency: ~1 ms
- Same region: ~10 ms
- Cross-region: ~100 ms
- Disk seek: ~10 ms
- SSD read: ~0.1 ms
- Memory read: ~100 ns

## Throughput
- HDD: ~100 MB/s sequential
- SSD: ~500 MB/s sequential
- RAM: ~10 GB/s
- Gigabit network: ~100 MB/s

## Capacity planning
- Single DB server: ~10K QPS (read), ~1K QPS (write)
- Single cache server: ~100K QPS
- Single web server: ~10K RPS
- Load balancer: ~1M+ concurrent connections
```

## Architecture Patterns

### Monolith

```
┌──────────────────────────────────┐
│            Monolith               │
│  ┌──────┐ ┌──────┐ ┌──────────┐ │
│  │ Auth │ │Order │ │ Payment  │ │
│  └──────┘ └──────┘ └──────────┘ │
│  ┌──────────────────────────────┐│
│  │        Shared Database       ││
│  └──────────────────────────────┘│
└──────────────────────────────────┘

When to use:
- Small team, early-stage product
- Simple domain, low traffic
- Fast iteration speed matters
- Single deployment unit

Trade-offs:
+ Simple to develop, test, deploy
+ No network overhead between modules
+ Easy transactions across features
- Couples deployment (one bad module takes down all)
- Harder to scale individual components
- Tech stack locked to one choice
```

### Microservices

```
┌────────┐    ┌────────┐    ┌────────┐
│ Auth   │    │ Order  │    │Payment │
│Service │    │Service │    │Service │
└───┬────┘    └───┬────┘    └───┬────┘
    │             │              │
    ▼             ▼              ▼
┌───────┐    ┌───────┐    ┌───────┐
│User DB│    │OrderDB│    │Pay DB │
└───────┘    └───────┘    └───────┘

       ┌──────────────┐
       │  API Gateway  │
       └──────┬───────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌───────┐ ┌───────┐ ┌───────┐
│ Auth  │ │ Order │ │Payment│
└───────┘ └───────┘ └───────┘

When to use:
- Large team, multiple squads
- Different scale requirements per domain
- Need independent deployment
- Polyglot technology needs

Trade-offs:
+ Independent deployment and scaling
+ Technology freedom per service
+ Fault isolation
- Distributed system complexity
- Network latency between services
- Data consistency challenges (eventual consistency)
- Operational overhead (monitoring, tracing, deployment)
```

### Event-Driven

```
┌──────┐  publish  ┌─────────────┐  subscribe  ┌──────┐
│Order │──────────▶│  Message     │────────────▶│Email │
│Service│          │  Broker      │             │Service│
└──────┘          │ (Kafka/Rabbit)│            └──────┘
                  └──────┬──────┘
                         │ subscribe
                    ┌────▼────┐
                    │Analytics │
                    │Service   │
                    └─────────┘

When to use:
- Decoupled processing (fire and forget)
- Async workflows (order → payment → shipping)
- Event sourcing / CQRS
- Real-time data pipelines
- Need to replay events

Patterns:
- Point-to-point: one producer, one consumer
- Pub/sub: one producer, many consumers
- Event sourcing: state = fold(events)
- Saga: distributed transaction via choreography or orchestration

Trade-offs:
+ Loose coupling between services
+ Async processing, better throughput
+ Natural audit trail (event log)
+ Easy to add new consumers
- Eventually consistent (not immediately)
- Event ordering guarantees are complex
- Debugging distributed flows is harder
- Need message broker infrastructure
```

### Layered (Clean Architecture)

```
┌──────────────────────────────────────┐
│              Presentation             │  HTTP handlers, CLI, UI
│          (Controllers / Views)        │
├──────────────────────────────────────┤
│             Application               │  Use cases, orchestration
│          (Services / Commands)        │
├──────────────────────────────────────┤
│               Domain                  │  Business rules, entities
│          (Models / Rules)             │
├──────────────────────────────────────┤
│            Infrastructure             │  DB, external APIs, email
│          (Repositories / Gateways)    │
└──────────────────────────────────────┘

Dependency rule: outer layers depend on inner layers, never the reverse.

When to use:
- Complex business domains
- Need to swap infrastructure (DB, external APIs)
- Long-lived applications with evolving requirements
- Want testable business logic independent of frameworks
```

## API Design

### RESTful API Conventions

```
# Resource naming — plural nouns, kebab-case
GET    /api/v1/users              # List users
GET    /api/v1/users/:id          # Get user
POST   /api/v1/users              # Create user
PUT    /api/v1/users/:id          # Replace user
PATCH  /api/v1/users/:id          # Partial update
DELETE /api/v1/users/:id          # Delete user

# Nested resources
GET    /api/v1/users/:id/orders          # User's orders
POST   /api/v1/users/:id/orders          # Create order for user
GET    /api/v1/users/:id/orders/:orderId  # Specific order

# Filtering, sorting, pagination
GET /api/v1/products?category=shoes&sort=-price&page=2&limit=20
GET /api/v1/orders?status=active&created_after=2024-01-01

# Actions (non-CRUD)
POST /api/v1/users/:id/activate
POST /api/v1/orders/:id/cancel
POST /api/v1/payments/:id/refund
```

### Response Shapes

```json
// Single resource
{
  "data": {
    "id": "usr_1a2b3c",
    "type": "user",
    "name": "Alice",
    "email": "alice@example.com",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}

// Collection with pagination
{
  "data": [
    { "id": "usr_1a2b3c", "name": "Alice" },
    { "id": "usr_4d5e6f", "name": "Bob" }
  ],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": [
      { "field": "email", "message": "Cannot be empty" }
    ]
  }
}
```

### Status Codes

```
200 OK                    # Successful GET, PUT, PATCH, DELETE
201 Created               # Successful POST
204 No Content            # Successful DELETE or empty response
400 Bad Request           # Validation error, malformed input
401 Unauthorized          # Missing or invalid auth token
403 Forbidden             # Authenticated but not authorized
404 Not Found             # Resource does not exist
409 Conflict              # Duplicate resource, version conflict
422 Unprocessable Entity  # Semantic validation failure
429 Too Many Requests     # Rate limited
500 Internal Server Error # Unexpected server error
502 Bad Gateway           # Upstream service failure
503 Service Unavailable   # Temporary overload / maintenance
```

### API Versioning

```
# URL path versioning (simple, most common)
GET /api/v1/users
GET /api/v2/users

# Header versioning
GET /api/users
Accept: application/vnd.myapp.v2+json

# Query parameter
GET /api/users?version=2
```

## Data Modeling

### Entity Relationships

```
# One-to-One
User ──1:1── Profile

# One-to-Many
User ──1:N── Order      (user has many orders)
Order ──1:N── OrderItem (order has many items)

# Many-to-Many
Student ──M:N── Course   (via enrollment table)

# Polymorphic
Comment → can belong to Post, Video, or Photo
```

### Schema Design Patterns

```sql
-- Users table
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  password    VARCHAR(255) NOT NULL,  -- bcrypt hash
  role        VARCHAR(20) DEFAULT 'user',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Soft delete pattern
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
-- Query: SELECT * FROM users WHERE deleted_at IS NULL;

-- Orders table
CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  status      VARCHAR(20) DEFAULT 'pending',
  total       DECIMAL(10,2) NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Order items
CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  quantity    INT NOT NULL CHECK (quantity > 0),
  unit_price  DECIMAL(10,2) NOT NULL,
  subtotal    DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- Audit log
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  table_name  VARCHAR(50) NOT NULL,
  record_id   UUID NOT NULL,
  action      VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
  old_data    JSONB,
  new_data    JSONB,
  changed_by  UUID,
  changed_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### NoSQL Patterns

```
# Document (MongoDB) — embed what you read together
{
  "_id": "order_123",
  "userId": "user_456",
  "status": "shipped",
  "items": [                          # Embed items (read together)
    { "productId": "prod_1", "qty": 2, "price": 29.99 },
    { "productId": "prod_2", "qty": 1, "price": 49.99 }
  ],
  "shippingAddress": { ... }          # Embed snapshot (won't change)
}

# Key-Value (Redis) patterns
user:123                    → { name, email }       # Hash
session:abc                 → { userId, expires }   # Hash with TTL
rate_limit:1.2.3.4          → 47                    # Counter with TTL
queue:email                 → [msg1, msg2, ...]     # List

# When to use NoSQL vs SQL
SQL:
- Relational data, joins needed
- Transactions required
- Structured schema, rarely changes
- Complex queries, aggregations

NoSQL:
- Document/JSON-heavy data
- Schema evolves frequently
- Massive read/write throughput
- Simple access patterns (key-based lookups)
```

## Caching

### Cache Strategies

```
# 1. Cache-Aside (Lazy Loading) — most common
Application checks cache first → miss → fetch from DB → write to cache → return
App → GET cache(key) → miss → GET db(key) → SET cache(key, value) → return

TTL: Set appropriate expiry to prevent stale data
Invalidation: Delete cache key on write

# 2. Write-Through
Write to cache AND DB simultaneously. Cache never stale.
Trade-off: Higher write latency.

# 3. Write-Behind (Write-Back)
Write to cache → async write to DB. Fast writes.
Trade-off: Risk of data loss on crash before DB write.

# 4. Refresh-Ahead
Auto-refresh cache before TTL expires. Users never see cache miss.
Trade-off: May refresh unused data.
```

### What to Cache

```
# Cache these (high read, low write)
- User sessions / profiles
- Product catalog / categories
- Configuration / feature flags
- Computed aggregations (top products, counts)
- Static assets (CDN: images, JS, CSS)
- API responses (public or per-user)
- Database query results (frequent queries)

# Do NOT cache these
- Rapidly changing data (real-time counters)
- Sensitive data without encryption
- Data that must be immediately consistent
- Very large items that rarely get cache hits
- One-time data (single-use tokens)
```

### Cache Key Design

```
# Namespaced, descriptive keys
user:123:profile
user:123:orders:page:2
product:456:details
config:feature-flags

# Include version for cache busting
user:123:profile:v2

# TTL guidelines
session tokens:     15 min - 1 hour
user profile:       5 - 15 min
product catalog:    1 - 5 min
static config:      1 hour
public pages:       5 - 30 min
```

## Authentication & Authorization

### Auth Patterns

```
# 1. Session-based (server-side state)
Client → POST /login → Server creates session → Set-Cookie: session_id
Client → GET /resource + Cookie → Server validates session

Trade-offs:
+ Simple to implement
+ Easy to revoke (delete session server-side)
- Requires sticky sessions or shared session store
- Not ideal for mobile / API consumers
- CSRF vulnerability (need CSRF tokens)

# 2. JWT (stateless tokens)
Client → POST /login → Server returns JWT
Client → GET /resource + Authorization: Bearer <jwt>
Server → Verify JWT signature (no DB lookup)

Token structure:
Header:    { "alg": "HS256", "typ": "JWT" }
Payload:   { "sub": "user_123", "role": "admin", "exp": 1705312800 }
Signature: HMAC(Header.Payload, secret)

Trade-offs:
+ Stateless, no server-side session store
+ Easy to scale (any server can verify)
+ Mobile / API friendly
- Cannot revoke without blacklist (defeats statelessness)
- Token size larger than session ID
- Token contains stale data until expiry

Best practice: Short-lived access token (15 min) + long-lived refresh token (7 days)

# 3. OAuth 2.0 (third-party auth)
Authorization Code Flow (server-side apps):
1. Client redirects to auth provider
2. User grants permission
3. Auth provider redirects back with code
4. Client exchanges code for access token

PKCE extension for mobile/SPA (no client secret exposed)

# 4. API Keys
Client → API request + X-API-Key: abc123
Server → Lookup key, validate permissions

Trade-offs:
+ Simple, no token expiry management
+ Easy to rotate
- No user context (service-to-service only)
- Key in every request (interceptable)
```

### Authorization Models

```
# Role-Based Access Control (RBAC)
User → Role → Permissions
admin    → [read, write, delete, manage_users]
editor   → [read, write]
viewer   → [read]

# Attribute-Based Access Control (ABAC)
Rule: Allow if user.department == resource.department AND user.level >= resource.requiredLevel
More flexible than RBAC but more complex.

# Permission check pattern
function can(user, action, resource) {
  const permissions = getPermissions(user.role);
  return permissions.includes(`${action}:${resource.type}`);
}

can(user, 'write', { type: 'post', ownerId: user.id })  // true
can(user, 'delete', { type: 'post', ownerId: 'other' })  // false if not admin
```

## Database Scaling

```
# Vertical Scaling (scale up)
- Bigger CPU, more RAM, faster disk
- Simple, no code changes
- Ceiling: hardware limits, cost grows exponentially

# Horizontal Scaling (scale out)

## Read Replicas
┌──────┐     ┌──────────┐
│ App  │────▶│ Primary   │  (writes)
│      │     │   DB      │
│      │     └──┬───┬────┘
│      │        │   │  (replication)
│      │     ┌──▼┐ ┌▼──┐
│      │◀────│R1 │ │R2 │  (reads)
└──────┘     └───┘ └───┘

## Sharding (Partitioning)
Shard key decides which shard holds the data

Hash-based: hash(user_id) % num_shards → shard_0, shard_1, shard_2
Range-based: users A-M → shard_0, N-Z → shard_1

## Connection Pooling
App → Connection Pool (pgbouncer / proxy) → Database
Prevents connection exhaustion (max ~100 connections per DB)

## Indexing Strategy
- Index columns used in WHERE, JOIN, ORDER BY
- Composite index order: equality columns first, range columns last
- Avoid over-indexing: each index slows writes
- Use EXPLAIN to verify query plans
```

## Messaging & Asynchronous Processing

```
# Message Broker Comparison

RabbitMQ:
+ Simple pub/sub and work queues
+ Message acknowledgment, routing
+ Good for task queues, event notification
- Lower throughput than Kafka
- Messages deleted after acknowledged

Kafka:
+ Extremely high throughput
+ Durable log (replay events)
+ Good for event streaming, data pipelines
- More complex setup
- Overkill for simple task queues

Redis (as queue):
+ Simple, fast, already in stack
+ Good for lightweight task queues
- No persistence guarantees
- Limited features vs dedicated broker

# Queue Patterns

# Work Queue (competing consumers)
Producer → [task1, task2, task3] → Worker 1 (processes task1)
                                  → Worker 2 (processes task2)

# Pub/Sub (fan-out)
Producer → [event] → Subscriber A (sends email)
                    → Subscriber B (updates analytics)
                    → Subscriber C (invalidates cache)

# Dead Letter Queue (DLQ)
Failed messages → DLQ for inspection and retry
Prevents poison messages from blocking the queue

# Idempotency
Each message should be safe to process multiple times
Use idempotency key: message ID or (entity ID + action)
```

## Observability

```
# The Three Pillars

## 1. Logging (what happened)
Structured logs: { timestamp, level, service, traceId, message, metadata }
Levels: DEBUG → INFO → WARN → ERROR → FATAL
Centralized: send all logs to one place (ELK, Loki, CloudWatch)

## 2. Metrics (numbers over time)
Infrastructure: CPU, memory, disk, network
Application: request rate, error rate, latency, queue depth
Business: signups, orders, revenue

Key metrics:
- RED: Rate, Errors, Duration (for services)
- USE: Utilization, Saturation, Errors (for resources)

## 3. Tracing (request flow across services)
[Client] → [API Gateway] → [Auth Service] → [Order Service] → [DB]
  0ms        2ms              5ms               12ms            15ms

Trace ID flows through all services
Span = one operation in one service
Use: Jaeger, Zipkin, AWS X-Ray, OpenTelemetry

# Health Checks
GET /health     → { "status": "ok" }
GET /ready      → checks DB, cache, external deps are reachable
Used by load balancers and orchestrators to route traffic
```

## Deployment & Infrastructure

```
# Deployment Strategies

## Rolling Update
Gradually replace old instances with new ones.
Zero downtime, but old and new versions coexist briefly.

## Blue-Green
Two identical environments. Switch traffic from blue to green.
Instant rollback (switch back). Double infrastructure cost.

## Canary
Route small % of traffic to new version. Monitor. Gradually increase.
Low risk, but needs traffic splitting capability.

# Container & Orchestration
Docker: package app + dependencies into immutable image
Kubernetes: orchestrate containers at scale
  - Auto-scaling (HPA: horizontal pod autoscaler)
  - Service discovery
  - Rolling deployments
  - Self-healing (restart failed pods)

# Infrastructure as Code
Terraform / Pulumi: define cloud resources declaratively
  - Version controlled
  - Reproducible environments
  - Easy teardown and rebuild

# CI/CD Pipeline
Push → Build → Test → Deploy (staging) → Approve → Deploy (prod)
  │       │        │
  │       │        └── unit, integration, e2e, security scan
  │       └── compile, lint, bundle, docker build
  └── triggered by git push / merge to main
```

## Security Checklist

```
# Input Handling
- Validate and sanitize ALL user input (server-side)
- Use parameterized queries (prevent SQL injection)
- Set Content-Security-Policy headers (prevent XSS)
- Escape output in HTML templates
- Validate file uploads: type, size, scan for malware

# Authentication
- Hash passwords with bcrypt (cost factor ≥ 12) or argon2
- Never store plaintext passwords
- Use HTTPS everywhere (HSTS header)
- Short-lived tokens + refresh token rotation
- Rate limit login attempts (brute force protection)
- Multi-factor authentication for sensitive operations

# Authorization
- Principle of least privilege
- Validate ownership: user can only access their own resources
- Don't expose internal IDs in URLs if guessable (use UUIDs)

# API Security
- Rate limiting (per user / IP)
- CORS: restrict allowed origins
- Input size limits (prevent DoS)
- API versioning (graceful deprecation)
- Log security events (login, permission changes)

# Data Protection
- Encrypt data at rest (database encryption)
- Encrypt data in transit (TLS 1.2+)
- Sensitive data in environment variables, not code
- PII: minimize collection, anonymize where possible
- GDPR / data retention: auto-delete old data

# Infrastructure
- Keep dependencies updated (security patches)
- Container images: use minimal base, scan for CVEs
- Network segmentation: DB not publicly accessible
- Secret management: Vault, AWS Secrets Manager, not .env in prod
```

## Load Balancing

```
# Algorithms
Round Robin:       sequential distribution
Least Connections:  route to fewest active connections
IP Hash:           same client IP → same server (session affinity)
Weighted:          route proportionally based on server capacity
Least Response Time: route to fastest-responding server

# Health Checks
Active:  LB periodically sends HTTP/TCP probe to each server
Passive: LB detects unhealthy server from failed responses

# SSL/TLS Termination
Client ──HTTPS──▶ Load Balancer ──HTTP──▶ Server
LB handles TLS overhead, servers handle plain HTTP internally

# Layer 4 vs Layer 7
L4 (Transport): TCP/UDP, fast, no content inspection
L7 (Application): HTTP headers, cookies, path-based routing
```

## Common Design Patterns

### Rate Limiter

```
# Token Bucket
- Bucket holds N tokens (max capacity)
- Tokens refill at rate R per second
- Each request consumes 1 token
- If bucket empty → reject (429)
- Allows burst up to N, then steady rate R

# Sliding Window Counter
- Track requests in current time window
- Use Redis: INCR key + EXPIRE
- If count > limit → reject

# Implementation layers
- IP-based: protect against abuse
- User-based: fair usage per user
- Endpoint-based: protect expensive operations
```

### Pagination

```
# Offset-based (traditional)
GET /api/users?page=2&limit=20
SELECT * FROM users LIMIT 20 OFFSET 20;

Trade-offs:
+ Simple, can jump to any page
- Slow for large offsets (scans and discards rows)
- Inconsistent results if data changes between pages

# Cursor-based (scalable)
GET /api/users?cursor=eyJpZCI6MTAwfQ&limit=20
SELECT * FROM users WHERE id > 100 ORDER BY id LIMIT 20;

Trade-offs:
+ Consistent results, fast even at deep pages
+ Works well with real-time data
- Cannot jump to arbitrary page
- Cursor must be opaque to client (base64 encoded)
```

### Idempotency

```
# Make operations safe to retry

# Unique request ID
Client sends: Idempotency-Key: <uuid>
Server stores: key → result for TTL (24h)
On duplicate: return stored result, don't re-execute

# Natural idempotency
PUT /users/:id   → always same result
DELETE /users/:id → 204 even if already deleted
POST /payments   → needs idempotency key (not naturally idempotent)

# Database level
UPSERT / INSERT ON CONFLICT DO NOTHING
Optimistic locking: UPDATE ... WHERE version = :expectedVersion
```

## Trade-off Quick Reference

```
# CAP Theorem (distributed systems — pick 2 of 3)
Consistency:     all nodes see same data
Availability:    every request gets a response
Partition tolerance: system works despite network failures

In practice: choose CP (consistent) or AP (available) when partition occurs

# Consistency vs Latency
Strong consistency → higher latency (must confirm all replicas)
Eventual consistency → lower latency (may serve stale data)

# Reliability vs Cost
More replicas, multi-region → higher reliability, higher cost
Single server → lower cost, single point of failure

# Normalization vs Denormalization
Normalized (3NF) → less duplication, harder queries, more joins
Denormalized → faster reads, data duplication, complex updates

# Pull vs Push
Pull (client requests data): simpler, but latency per request
Push (server sends data): real-time, but connection management overhead

# Batch vs Stream
Batch: process data in chunks on schedule → simpler, higher throughput
Stream: process data as it arrives → lower latency, more complex
```

## Code Style Rules

- Start with requirements and constraints before jumping to architecture.
- Estimate scale first — architecture for 1K users differs from 1M users.
- Favor simplicity over cleverness. Monolith first, extract services when needed.
- Design for failure: every external call can fail, every network can partition.
- Use managed services when possible (DB, cache, queue, auth) — reduce ops burden.
- Make systems observable from day one: structured logs, metrics, distributed traces.
- Define API contracts before implementation (request/response shapes, status codes).
- Version APIs from the start. Plan for breaking changes.
- Cache aggressively, invalidate carefully. Know your consistency requirements.
- Use UUIDs for public IDs (not auto-increment integers — they're guessable).
- Always consider the read/write ratio when choosing data stores and indexes.
- Document architectural decisions: what, why, and what alternatives were considered.
- Design idempotent operations — networks retry, queues redeliver.
- Use feature flags for gradual rollouts, not big-bang deployments.
- Security is not a layer — it's baked into every component.
