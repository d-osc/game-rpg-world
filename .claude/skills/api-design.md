---
name: api-design
description: Design, build, and document web APIs — RESTful conventions, request/response shapes, error handling, pagination, filtering, authentication, rate limiting, versioning, idempotency, and API documentation.
---

You are an expert API designer. When the user asks for help with API design, follow these instructions.

## Resource Naming

```
# Rules
- Use plural nouns: /users, /orders, /products
- Use kebab-case for multi-word: /user-profiles, /order-items
- Use nesting for ownership: /users/:id/orders (user's orders)
- Max 2 levels of nesting; deeper → use query params
- Never use verbs in URLs; use nouns + HTTP methods

# CRUD mapping
POST   /users          → Create user
GET    /users          → List users
GET    /users/:id      → Get user
PUT    /users/:id      → Replace user (full update)
PATCH  /users/:id      → Update user (partial)
DELETE /users/:id      → Delete user

# Nested resources
GET    /users/:id/orders              → User's orders
POST   /users/:id/orders              → Create order for user
GET    /users/:id/orders/:orderId     → Specific order

# Non-CRUD actions (use /actions or /verbs sparingly)
POST   /users/:id/activate            → Activate user
POST   /orders/:id/cancel             → Cancel order
POST   /payments/:id/refund           → Refund payment
POST   /auth/login                    → Login
POST   /auth/logout                   → Logout
POST   /auth/refresh                  → Refresh token
```

## URL Structure

```
# Base path with version
/api/v1/users

# Full URL convention
https://{host}/api/v1/{resource}[/{id}][/{sub-resource}]

# Query string for everything that's NOT resource identity
GET /api/v1/products?category=shoes&sort=-price&page=2&limit=20
GET /api/v1/orders?status=active&created_after=2024-01-01
GET /api/v1/users?role=admin&search=alice

# Avoid
GET /api/v1/getUsers           ← verb in URL
GET /api/v1/user               ← singular
GET /api/v1/Users              ← capitalized
GET /api/v1/user_list          ← underscore
POST /api/v1/users/create      ← redundant /create
```

## Request Design

### POST / Create

```json
// POST /api/v1/users
// Request
{
  "name": "Alice",
  "email": "alice@example.com",
  "role": "user"
}

// Response 201 Created
{
  "data": {
    "id": "usr_2x3y4z",
    "name": "Alice",
    "email": "alice@example.com",
    "role": "user",
    "createdAt": "2024-03-15T10:30:00Z",
    "updatedAt": "2024-03-15T10:30:00Z"
  }
}

// Location header for created resource
// Location: /api/v1/users/usr_2x3y4z
```

### PUT / Full Replace

```json
// PUT /api/v1/users/usr_2x3y4z
// Request (send ALL fields — missing fields are set to null/default)
{
  "name": "Alice Smith",
  "email": "alice.smith@example.com",
  "role": "admin"
}

// Response 200 OK
{
  "data": {
    "id": "usr_2x3y4z",
    "name": "Alice Smith",
    "email": "alice.smith@example.com",
    "role": "admin",
    "createdAt": "2024-03-15T10:30:00Z",
    "updatedAt": "2024-03-15T14:00:00Z"
  }
}
```

### PATCH / Partial Update

```json
// PATCH /api/v1/users/usr_2x3y4z
// Request (send only fields to change)
{
  "role": "admin"
}

// Response 200 OK (full resource returned)
{
  "data": {
    "id": "usr_2x3y4z",
    "name": "Alice",
    "email": "alice@example.com",
    "role": "admin",
    "createdAt": "2024-03-15T10:30:00Z",
    "updatedAt": "2024-03-15T14:00:00Z"
  }
}
```

### DELETE

```
// DELETE /api/v1/users/usr_2x3y4z

// Option 1: 204 No Content (no body)
// HTTP 204

// Option 2: 200 OK with confirmation
{
  "data": {
    "id": "usr_2x3y4z",
    "deleted": true
  }
}
```

## Response Envelope

### Single Resource

```json
{
  "data": {
    "id": "usr_2x3y4z",
    "type": "user",
    "name": "Alice",
    "email": "alice@example.com",
    "role": "user",
    "avatarUrl": null,
    "createdAt": "2024-03-15T10:30:00Z",
    "updatedAt": "2024-03-15T10:30:00Z"
  }
}
```

### Collection with Pagination

```json
{
  "data": [
    { "id": "usr_2x3y4z", "name": "Alice", "email": "alice@example.com" },
    { "id": "usr_5a6b7c", "name": "Bob", "email": "bob@example.com" }
  ],
  "pagination": {
    "page": 2,
    "perPage": 20,
    "total": 156,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

### Cursor-Based Pagination

```json
{
  "data": [
    { "id": "usr_2x3y4z", "name": "Alice" },
    { "id": "usr_5a6b7c", "name": "Bob" }
  ],
  "pagination": {
    "nextCursor": "eyJpZCI6InVzcl81YTZiN2MifQ==",
    "prevCursor": "eyJpZCI6InVzcl8xeTJ6M3cifQ==",
    "hasNext": true,
    "hasPrev": false,
    "perPage": 20
  }
}
```

### Empty Collection

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 0,
    "totalPages": 0,
    "hasNext": false,
    "hasPrev": false
  }
}
```

## Error Design

### Error Response Shape

```json
// Always use this exact shape for errors
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address",
        "value": "not-an-email"
      },
      {
        "field": "name",
        "message": "Must be between 2 and 100 characters",
        "value": "A"
      }
    ]
  }
}
```

### Error Code System

```
# Use uppercase SNAKE_CASE, grouped by domain

# Validation (400)
VALIDATION_ERROR          — Generic validation failure
INVALID_EMAIL              — Email format invalid
INVALID_PHONE              — Phone format invalid
INVALID_DATE_RANGE         — Start date after end date
FIELD_REQUIRED             — Required field missing
FIELD_TOO_LONG             — String exceeds max length
FIELD_TOO_SHORT            — String below min length
INVALID_ENUM_VALUE         — Value not in allowed set

# Authentication (401)
UNAUTHORIZED               — No token provided
TOKEN_EXPIRED               — JWT expired
TOKEN_INVALID               — JWT signature invalid
TOKEN_REVOKED               — Token was revoked
INVALID_CREDENTIALS         — Wrong email or password

# Authorization (403)
FORBIDDEN                   — No permission for this action
INSUFFICIENT_ROLE           — Role too low
RESOURCE_OWNERSHIP_REQUIRED — Must own the resource
ACCOUNT_SUSPENDED           — Account is suspended

# Resource (404, 409, 410)
NOT_FOUND                   — Resource does not exist
ALREADY_EXISTS              — Duplicate resource
CONFLICT                    — State conflict (edit collision)
VERSION_CONFLICT            — Optimistic lock failure
GONE                        — Resource permanently deleted

# Rate Limiting (429)
RATE_LIMITED                — Too many requests
QUOTA_EXCEEDED              — Monthly/daily quota exceeded

# Server (500, 502, 503)
INTERNAL_ERROR              — Unexpected server error
SERVICE_UNAVAILABLE         — Dependency down (DB, external API)
UPSTREAM_TIMEOUT             — External service timeout
MAINTENANCE_MODE             — Planned maintenance
```

### Error Per Status Code

```json
// 400 Bad Request
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Invalid email format", "value": "bad" }
    ]
  }
}

// 401 Unauthorized
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Access token has expired",
    "details": []
  }
}

// 403 Forbidden
{
  "error": {
    "code": "INSUFFICIENT_ROLE",
    "message": "Admin role required",
    "details": []
  }
}

// 404 Not Found
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "details": [
      { "field": "id", "message": "No user with this ID exists", "value": "usr_invalid" }
    ]
  }
}

// 409 Conflict
{
  "error": {
    "code": "ALREADY_EXISTS",
    "message": "A user with this email already exists",
    "details": [
      { "field": "email", "message": "Already registered", "value": "alice@example.com" }
    ]
  }
}

// 422 Unprocessable Entity
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Resource was modified by another client",
    "details": [
      { "field": "version", "message": "Expected 3 but current is 5", "value": 3 }
    ]
  }
}

// 429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "details": []
  }
}
// Include rate limit headers:
// X-RateLimit-Limit: 100
// X-RateLimit-Remaining: 0
// X-RateLimit-Reset: 1705312800

// 500 Internal Server Error (never leak stack traces in production)
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "details": []
  }
}
// Log the real error server-side with request ID
// Include: X-Request-Id: req_abc123 in response headers
```

## Filtering, Sorting & Search

### Filtering

```
# Equality filter
GET /api/v1/products?category=shoes&brand=nike

# Range filters
GET /api/v1/products?price_min=50&price_max=200
GET /api/v1/orders?created_after=2024-01-01&created_before=2024-12-31

# Multi-value (comma-separated)
GET /api/v1/products?category=shoes,bags
GET /api/v1/orders?status=pending,processing

# Boolean
GET /api/v1/users?active=true
GET /api/v1/products?in_stock=true

# Nested resource filter
GET /api/v1/orders?user_id=usr_2x3y4z&status=shipped
```

### Sorting

```
# Ascending (default)
GET /api/v1/products?sort=price

# Descending (prefix with -)
GET /api/v1/products?sort=-price

# Multi-field sort
GET /api/v1/products?sort=-price,name

# Sort with default
Default sort: -created_at (newest first)
```

### Search

```
# Full-text search
GET /api/v1/products?search=running+shoes

# Search specific fields
GET /api/v1/users?name=alice

# Combined
GET /api/v1/products?search=shoes&category=sports&sort=-price&page=1&limit=20
```

### Field Selection (Sparse Fieldsets)

```
# Return only requested fields
GET /api/v1/users?fields=id,name,email

# Useful for list views (fewer fields = faster)
GET /api/v1/products?fields=id,name,price,thumbnailUrl
```

## Pagination

### Offset-Based

```ts
// GET /api/v1/users?page=2&limit=20

interface PaginationParams {
  page?: number;     // default: 1
  limit?: number;    // default: 20, max: 100
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Implementation
function paginate(query: PaginationParams, total: number) {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(100, Math.max(1, query.limit ?? 20));
  const totalPages = Math.ceil(total / perPage);
  return {
    offset: (page - 1) * perPage,
    limit: perPage,
    pagination: {
      page,
      perPage,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

// Pros: can jump to any page, simple
// Cons: slow for large offsets, inconsistent with real-time data
```

### Cursor-Based

```ts
// GET /api/v1/users?cursor=eyJpZCI6MTAwfQ==&limit=20

interface CursorParams {
  cursor?: string;   // base64 encoded cursor
  limit?: number;    // default: 20, max: 100
}

interface CursorResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    prevCursor: string | null;
    hasNext: boolean;
    hasPrev: boolean;
    perPage: number;
  };
}

// Implementation
function encodeCursor(values: Record<string, any>): string {
  return Buffer.from(JSON.stringify(values)).toString('base64');
}

function decodeCursor(cursor: string): Record<string, any> {
  return JSON.parse(Buffer.from(cursor, 'base64').toString());
}

// Usage with ordered query
const { limit, cursor } = params;
const where = cursor
  ? { id: { gt: decodeCursor(cursor).lastId } }
  : {};
const items = await db.findMany({ where, take: limit + 1 });
const hasNext = items.length > limit;
const data = hasNext ? items.slice(0, -1) : items;

// Pros: consistent results, fast even at deep pages
// Cons: cannot jump to arbitrary page, cursor is opaque
```

### When to Use Which

```
Use offset when:                    Use cursor when:
- Need page numbers in UI            - Infinite scroll / "load more"
- Need to jump to specific page       - Real-time data (items shift)
- Admin dashboards / reports          - Mobile feed / timeline
- Total count is important            - Large datasets (>100K rows)
- SEO needs (paginated URLs)          - Consistent pagination matters
```

## Authentication & Authorization

### Bearer Token (JWT)

```ts
// Request header
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Middleware
function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'No token provided', details: [] }
    });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: { code: 'TOKEN_EXPIRED', message: 'Token has expired', details: [] }
      });
    }
    return res.status(401).json({
      error: { code: 'TOKEN_INVALID', message: 'Invalid token', details: [] }
    });
  }
}
```

### Token Refresh Flow

```
// Login
POST /api/v1/auth/login
{ "email": "alice@example.com", "password": "secret" }
→ { "data": { "accessToken": "...", "refreshToken": "...", "expiresIn": 900 } }

// Refresh (before access token expires)
POST /api/v1/auth/refresh
{ "refreshToken": "..." }
→ { "data": { "accessToken": "...", "refreshToken": "...", "expiresIn": 900 } }

// Token rotation: each refresh returns a NEW refresh token
// Old refresh token is invalidated (prevents replay)

// Token expiry recommendations:
accessToken:   15 minutes
refreshToken:  7 days (rotate on each use)
```

### API Key (Service-to-Service)

```ts
// Header
X-API-Key: ak_live_abc123def456

// Or query param (less secure, for WebSocket/server-side only)
GET /api/v1/data?api_key=ak_live_abc123def456

// Middleware
function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'API key required', details: [] }
    });
  }
  const client = validateApiKey(key);
  if (!client) {
    return res.status(401).json({
      error: { code: 'TOKEN_INVALID', message: 'Invalid API key', details: [] }
    });
  }
  req.client = client;
  next();
}
```

### Permission-Based Authorization

```ts
// Route-level permission check
function requirePermission(permission: string) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', details: [] }
      });
    }
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: `Permission '${permission}' required`, details: [] }
      });
    }
    next();
  };
}

// Resource ownership check
function requireOwner(getOwnerId: (req) => Promise<string>) {
  return async (req, res, next) => {
    if (req.user.role === 'admin') return next(); // admins can do anything
    const ownerId = await getOwnerId(req);
    if (req.user.id !== ownerId) {
      return res.status(403).json({
        error: { code: 'RESOURCE_OWNERSHIP_REQUIRED', message: 'You do not own this resource', details: [] }
      });
    }
    next();
  };
}

// Usage
app.delete('/api/v1/users/:id',
  authenticate,
  requireOwner((req) => getUserOwnerId(req.params.id)),
  deleteUser
);

app.get('/api/v1/admin/users',
  authenticate,
  requirePermission('users:read'),
  listAllUsers
);
```

## Rate Limiting

```ts
// Sliding window rate limiter
function rateLimit(options: {
  windowMs: number;    // time window in ms
  max: number;         // max requests per window
  keyFn?: (req) => string;  // identity function (default: IP)
}) {
  return async (req, res, next) => {
    const key = options.keyFn?.(req) ?? req.ip;
    const { count, resetTime, remaining } = await incrementCounter(key, options.windowMs);

    // Set headers
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

    if (count > options.max) {
      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          details: [{ field: 'retryAfter', message: `Retry after ${Math.ceil(options.windowMs / 1000)}s` }]
        }
      });
    }
    next();
  };
}

// Per-route limits
app.get('/api/v1/users', rateLimit({ windowMs: 60_000, max: 100 }), listUsers);
app.post('/api/v1/auth/login', rateLimit({ windowMs: 15 * 60_000, max: 10 }), login);

// Per-user limits (authenticated)
app.get('/api/v1/search',
  authenticate,
  rateLimit({
    windowMs: 60_000,
    max: 60,
    keyFn: (req) => `user:${req.user.id}`,
  }),
  search
);
```

## Idempotency

```ts
// For POST requests that must be safe to retry
function idempotency(ttlMs = 24 * 60 * 60 * 1000) {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'];
    if (!key) return next();

    // Check if we already processed this request
    const cached = await cache.get(`idem:${key}`);
    if (cached) {
      return res.status(cached.status).json(cached.body);
    }

    // Intercept response to cache it
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      cache.set(`idem:${key}`, { status: res.statusCode, body }, ttlMs);
      return originalJson(body);
    };
    next();
  };
}

// Client usage
POST /api/v1/orders
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
{ "productId": "prod_123", "quantity": 2 }
// If network fails and client retries with same key → same result, no duplicate order
```

## Bulk Operations

```json
// POST /api/v1/products/bulk
{
  "operations": [
    { "action": "create", "data": { "name": "Widget A", "price": 29.99 } },
    { "action": "update", "id": "prod_123", "data": { "price": 24.99 } },
    { "action": "delete", "id": "prod_456" }
  ]
}

// Response 207 Multi-Status
{
  "data": {
    "results": [
      { "action": "create", "status": 201, "data": { "id": "prod_789", "name": "Widget A" } },
      { "action": "update", "status": 200, "data": { "id": "prod_123", "price": 24.99 } },
      { "action": "delete", "status": 404, "error": { "code": "NOT_FOUND", "message": "Product not found" } }
    ],
    "summary": {
      "total": 3,
      "succeeded": 2,
      "failed": 1
    }
  }
}
```

## Webhooks

### Webhook Registration

```json
// POST /api/v1/webhooks
{
  "url": "https://example.com/webhooks",
  "events": ["order.created", "order.shipped", "payment.completed"],
  "secret": "whsec_abc123..."
}

// Response
{
  "data": {
    "id": "wh_1a2b3c",
    "url": "https://example.com/webhooks",
    "events": ["order.created", "order.shipped", "payment.completed"],
    "active": true,
    "createdAt": "2024-03-15T10:30:00Z"
  }
}
```

### Webhook Delivery

```json
// POST to registered URL
// Headers:
// X-Webhook-Id: wh_1a2b3c
// X-Webhook-Event: order.created
// X-Webhook-Signature: sha256=abc123...
// X-Webhook-Timestamp: 1705312800

{
  "id": "evt_x1y2z3",
  "type": "order.created",
  "timestamp": "2024-03-15T10:30:00Z",
  "data": {
    "id": "ord_abc",
    "userId": "usr_123",
    "total": 99.99,
    "items": [...]
  }
}
```

### Webhook Signature Verification

```ts
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: string,
): boolean {
  // Prevent replay attacks (reject if older than 5 minutes)
  const age = Date.now() / 1000 - Number(timestamp);
  if (age > 300) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expected}`)
  );
}
```

## Common Headers

```
# Request headers
Authorization: Bearer <token>           # Auth token
X-API-Key: <key>                        # API key (service-to-service)
X-Request-Id: <uuid>                    # Trace request across services
Idempotency-Key: <uuid>                 # Idempotent POST requests
Accept: application/json                # Expected response format
Content-Type: application/json          # Request body format
Accept-Language: th                     # Preferred language
If-None-Match: "etag_value"             # Conditional GET (cache)
If-Modified-Since: <date>               # Conditional GET (cache)

# Response headers
Content-Type: application/json          # Response format
X-Request-Id: <uuid>                    # Echo request ID for tracing
X-RateLimit-Limit: 100                  # Rate limit ceiling
X-RateLimit-Remaining: 95               # Requests left in window
X-RateLimit-Reset: 1705312800           # Window reset (unix timestamp)
ETag: "hash_value"                      # Cache validation
Cache-Control: max-age=300              # Client cache duration
Location: /api/v1/users/usr_123         # Resource URI (201 responses)
Link: </api/v1/users?page=3>; rel="next"  # Pagination links
Deprecation: true                       # API deprecation notice
Sunset: Sat, 01 Jun 2025 00:00:00 GMT   # API removal date
```

## Validation

```ts
// Input validation at API boundary
interface CreateUserRequest {
  name: string;          // 2-100 chars, required
  email: string;         // valid email, required
  role?: string;         // 'user' | 'admin', default: 'user'
  phone?: string;        // E.164 format, optional
}

function validateCreateUser(body: unknown): CreateUserRequest {
  if (!body || typeof body !== 'object') throw ValidationError('body required');

  const { name, email, role, phone } = body as any;

  if (!name || typeof name !== 'string') throw ValidationError('name required');
  if (name.length < 2 || name.length > 100) throw ValidationError('name must be 2-100 chars');

  if (!email || typeof email !== 'string') throw ValidationError('email required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw ValidationError('invalid email format');

  if (role && !['user', 'admin'].includes(role)) throw ValidationError('role must be user or admin');

  if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone)) throw ValidationError('invalid phone format');

  return { name, email, role: role ?? 'user', phone };
}
```

## API Documentation Template

```markdown
## Create User

Creates a new user account.

### Request

`POST /api/v1/users`

#### Headers
| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer token |
| Content-Type | Yes | application/json |

#### Body
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | 2-100 characters |
| email | string | Yes | Valid email address |
| role | string | No | `user` or `admin`. Default: `user` |

### Response

#### 201 Created
```json
{
  "data": {
    "id": "usr_2x3y4z",
    "name": "Alice",
    "email": "alice@example.com",
    "role": "user",
    "createdAt": "2024-03-15T10:30:00Z"
  }
}
```

#### 400 Validation Error
#### 401 Unauthorized
#### 403 Forbidden
#### 409 Already Exists

### Example
```bash
curl -X POST https://api.example.com/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
```
```

## Code Style Rules

- Use plural nouns for resource names: `/users`, `/orders`, not `/user`.
- Use kebab-case for multi-word paths: `/user-profiles`, not `/userProfiles`.
- Nest at most 2 levels. Deeper relationships → use query params or separate endpoints.
- Return consistent envelope: `{ "data": ..., "pagination": ... }` or `{ "error": ... }`.
- Always return full resource after PUT/PATCH (client shouldn't need a follow-up GET).
- Use proper HTTP status codes. Never return 200 with error body.
- Validate all input at the API boundary before it reaches business logic.
- Use idempotency keys for POST endpoints that create resources or trigger actions.
- Include `X-Request-Id` in every response for distributed tracing.
- Set rate limit headers even on successful responses (`X-RateLimit-*`).
- Use cursor-based pagination for feeds, offset-based for admin panels.
- Sign webhooks with HMAC-SHA256. Include timestamp to prevent replay.
- Never expose internal IDs (auto-increment integers). Use UUIDs or prefixed IDs (`usr_`, `ord_`).
- Version APIs from day one (`/api/v1/`). Plan migration path before deprecating.
- Return `204 No Content` for DELETE when no body is needed.
- Use `Location` header on `201 Created` responses.
- Include `ETag` / `Cache-Control` headers for cacheable responses.
- Document every endpoint with: description, request, response (all status codes), example curl.
