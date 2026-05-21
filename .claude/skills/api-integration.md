---
name: api-integration
description: API integration patterns — HTTP client wrapper, request/response interceptors, authentication refresh, retry strategies, pagination helpers, webhook handling, third-party API clients, and error handling for external services
---

# API Integration

## HTTP Client Wrapper

### Fetch-Based Client

```typescript
interface HttpClientConfig {
    baseUrl: string;
    timeout?: number;
    headers?: Record<string, string>;
    retries?: number;
}

interface RequestConfig {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
    headers?: Record<string, string>;
    timeout?: number;
    signal?: AbortSignal;
}

class HttpClient {
    private interceptors: {
        request: Array<(config: RequestInit) => RequestInit>;
        response: Array<(response: Response) => Promise<Response>>;
    } = { request: [], response: [] };

    constructor(private config: HttpClientConfig) {}

    private buildUrl(path: string, query?: Record<string, unknown>): string {
        const url = new URL(path, this.config.baseUrl);
        if (query) {
            for (const [key, value] of Object.entries(query)) {
                if (value !== undefined) url.searchParams.set(key, String(value));
            }
        }
        return url.toString();
    }

    private async request<T>(config: RequestConfig): Promise<T> {
        const url = this.buildUrl(config.path, config.query as Record<string, unknown>);
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            config.timeout ?? this.config.timeout ?? 10_000
        );

        // Merge signals
        if (config.signal) {
            config.signal.addEventListener('abort', () => controller.abort());
        }

        let init: RequestInit = {
            method: config.method,
            headers: {
                'Content-Type': 'application/json',
                ...this.config.headers,
                ...config.headers,
            },
            signal: controller.signal,
        };

        if (config.body !== undefined) {
            init.body = JSON.stringify(config.body);
        }

        // Apply request interceptors
        for (const interceptor of this.interceptors.request) {
            init = interceptor(init);
        }

        try {
            let response = await fetch(url, init);

            // Apply response interceptors
            for (const interceptor of this.interceptors.response) {
                response = await interceptor(response);
            }

            if (!response.ok) {
                throw await this.handleError(response);
            }

            if (response.status === 204) return undefined as T;

            return await response.json() as T;
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                throw new ApiError('REQUEST_TIMEOUT', 'Request was aborted or timed out', 408);
            }
            throw err;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async handleError(response: Response): Promise<ApiError> {
        let body: unknown;
        try {
            body = await response.json();
        } catch {
            body = await response.text();
        }

        return new ApiError(
            body?.error?.code ?? 'UNKNOWN_ERROR',
            body?.error?.message ?? response.statusText,
            response.status,
            body
        );
    }

    // Convenience methods
    get<T>(path: string, query?: Record<string, string | number | boolean | undefined>, config?: Partial<RequestConfig>): Promise<T> {
        return this.request<T>({ method: 'GET', path, query, ...config });
    }

    post<T>(path: string, body?: unknown, config?: Partial<RequestConfig>): Promise<T> {
        return this.request<T>({ method: 'POST', path, body, ...config });
    }

    put<T>(path: string, body?: unknown, config?: Partial<RequestConfig>): Promise<T> {
        return this.request<T>({ method: 'PUT', path, body, ...config });
    }

    patch<T>(path: string, body?: unknown, config?: Partial<RequestConfig>): Promise<T> {
        return this.request<T>({ method: 'PATCH', path, body, ...config });
    }

    delete<T>(path: string, config?: Partial<RequestConfig>): Promise<T> {
        return this.request<T>({ method: 'DELETE', path, ...config });
    }

    // Interceptors
    addRequestInterceptor(fn: (config: RequestInit) => RequestInit): void {
        this.interceptors.request.push(fn);
    }

    addResponseInterceptor(fn: (response: Response) => Promise<Response>): void {
        this.interceptors.response.push(fn);
    }
}

class ApiError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status: number,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
    }
}
```

### Usage

```typescript
const api = new HttpClient({
    baseUrl: process.env.API_BASE_URL!,
    timeout: 15_000,
    headers: { 'X-App-Version': '1.0.0' },
});

// Simple requests
const users = await api.get<User[]>('/users', { active: true, limit: 50 });
const user = await api.get<User>('/users/123');
const created = await api.post<User>('/users', { name: 'John', email: 'john@test.com' });
const updated = await api.patch<User>('/users/123', { name: 'Jane' });
await api.delete('/users/123');
```

## Authentication Interceptor

### Bearer Token Injection

```typescript
// Automatically attach auth token to every request
api.addRequestInterceptor((init) => {
    const token = getAccessToken();
    if (token) {
        (init.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
    return init;
});
```

### Token Refresh on 401

```typescript
let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

api.addResponseInterceptor(async (response) => {
    const originalRequest = response;

    if (response.status !== 401) {
        return response;
    }

    // Clone URL and method from the failed request for retry
    if (isRefreshing) {
        // Wait for the refresh to complete, then retry
        await new Promise<void>(resolve => pendingRequests.push(resolve));
        // Re-fetch with new token — caller should implement retry
        return response;
    }

    isRefreshing = true;

    try {
        const newToken = await refreshAccessToken();
        setAccessToken(newToken);

        // Retry all pending requests
        pendingRequests.forEach(resolve => resolve());
        pendingRequests = [];

        // Retry original request — build a new fetch
        // The caller should handle this by re-invoking
        return response;
    } catch (refreshErr) {
        pendingRequests = [];
        onAuthExpired();
        throw new ApiError('TOKEN_EXPIRED', 'Session expired. Please log in again.', 401);
    } finally {
        isRefreshing = false;
    }
});

// Token storage helpers
let accessToken: string | null = null;
let refreshToken: string | null = null;

function getAccessToken(): string | null { return accessToken; }
function setAccessToken(token: string): void { accessToken = token; }

async function refreshAccessToken(): Promise<string> {
    const response = await fetch(`${process.env.API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) throw new Error('Token refresh failed');

    const data = await response.json();
    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
    return accessToken;
}

function onAuthExpired(): void {
    accessToken = null;
    refreshToken = null;
    window.location.href = '/login';
}
```

## Third-Party API Client

### Generic Provider Pattern

```typescript
interface ProviderConfig {
    baseUrl: string;
    apiKey?: string;
    timeout?: number;
    rateLimit?: { maxRequests: number; perMs: number };
}

abstract class ThirdPartyClient {
    protected client: HttpClient;

    constructor(config: ProviderConfig) {
        this.client = new HttpClient({
            baseUrl: config.baseUrl,
            timeout: config.timeout ?? 30_000,
        });

        if (config.apiKey) {
            this.client.addRequestInterceptor((init) => {
                (init.headers as Record<string, string>)['Authorization'] = `Bearer ${config.apiKey}`;
                return init;
            });
        }
    }

    protected async safeCall<T>(
        fn: () => Promise<T>,
        context: string
    ): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
        try {
            const data = await fn();
            return { ok: true, data };
        } catch (err) {
            const message = err instanceof ApiError
                ? `${context}: ${err.message} (${err.status})`
                : `${context}: ${err instanceof Error ? err.message : 'Unknown error'}`;
            logger.error(message);
            return { ok: false, error: message };
        }
    }
}
```

### Payment Provider (Stripe-Like)

```typescript
class PaymentClient extends ThirdPartyClient {
    constructor(apiKey: string) {
        super({ baseUrl: 'https://api.payment.com/v1', apiKey });
    }

    async createCharge(params: {
        amount: number;
        currency: string;
        customerId: string;
        description?: string;
        metadata?: Record<string, string>;
    }) {
        return this.safeCall(
            () => this.client.post<Charge>('/charges', {
                amount: Math.round(params.amount * 100), // cents
                currency: params.currency,
                customer: params.customerId,
                description: params.description,
                metadata: params.metadata,
            }),
            'Create charge'
        );
    }

    async refund(chargeId: string, amount?: number) {
        return this.safeCall(
            () => this.client.post<Refund>('/refunds', {
                charge: chargeId,
                amount: amount ? Math.round(amount * 100) : undefined,
            }),
            'Refund charge'
        );
    }

    async getCustomer(customerId: string) {
        return this.safeCall(
            () => this.client.get<Customer>(`/customers/${customerId}`),
            'Get customer'
        );
    }
}
```

### Email Provider (Resend-Like)

```typescript
class EmailClient extends ThirdPartyClient {
    constructor(apiKey: string) {
        super({ baseUrl: 'https://api.email.com/v1', apiKey });
    }

    async send(params: {
        to: string | string[];
        from: string;
        subject: string;
        html?: string;
        text?: string;
        replyTo?: string;
        headers?: Record<string, string>;
    }) {
        return this.safeCall(
            () => this.client.post<{ id: string }>('/emails', params),
            'Send email'
        );
    }

    async sendTemplate(params: {
        to: string | string[];
        from: string;
        templateId: string;
        templateData: Record<string, unknown>;
    }) {
        return this.safeCall(
            () => this.client.post<{ id: string }>('/emails', {
                to: params.to,
                from: params.from,
                template: params.templateId,
                data: params.templateData,
            }),
            'Send template email'
        );
    }
}
```

### Storage Provider (S3-Like)

```typescript
class StorageClient extends ThirdPartyClient {
    constructor(
        apiKey: string,
        private bucket: string,
        private publicUrl: string
    ) {
        super({ baseUrl: 'https://api.storage.com/v1', apiKey });
    }

    async upload(key: string, file: File | Buffer, contentType: string) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('key', key);
        formData.append('bucket', this.bucket);
        formData.append('contentType', contentType);

        return this.safeCall(
            () => this.client.post<{ url: string }>('/upload', formData as any),
            'Upload file'
        );
    }

    async delete(key: string) {
        return this.safeCall(
            () => this.client.delete(`/objects/${this.bucket}/${key}`),
            'Delete file'
        );
    }

    getUrl(key: string): string {
        return `${this.publicUrl}/${this.bucket}/${key}`;
    }
}
```

## Pagination Helpers

### Cursor-Based Pagination

```typescript
interface CursorPage<T> {
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
}

async function paginateCursor<T>(
    fetchFn: (cursor?: string) => Promise<CursorPage<T>>,
    onPage?: (items: T[]) => void | Promise<void>,
    maxPages?: number
): Promise<T[]> {
    const allItems: T[] = [];
    let cursor: string | undefined;
    let pageCount = 0;

    do {
        const page = await fetchFn(cursor);
        allItems.push(...page.data);

        await onPage?.(page.data);

        cursor = page.nextCursor ?? undefined;
        pageCount++;
    } while (cursor && (!maxPages || pageCount < maxPages));

    return allItems;
}

// Usage
const allUsers = await paginateCursor(
    (cursor) => api.get<CursorPage<User>>('/users', { cursor, limit: 100 }),
    (users) => console.log(`Fetched ${users.length} users`),
    50 // max 50 pages
);
```

### Offset-Based Pagination

```typescript
interface OffsetPage<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}

async function paginateOffset<T>(
    fetchFn: (page: number, pageSize: number) => Promise<OffsetPage<T>>,
    pageSize = 50,
    onPage?: (items: T[], page: number) => void | Promise<void>
): Promise<T[]> {
    const allItems: T[] = [];
    let page = 1;
    let total = Infinity;

    while (allItems.length < total) {
        const result = await fetchFn(page, pageSize);
        allItems.push(...result.data);
        total = result.total;

        await onPage?.(result.data, page);
        page++;
    }

    return allItems;
}
```

## Webhook Handling

### Webhook Receiver

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

interface WebhookConfig {
    secret: string;
    toleranceMs?: number; // timestamp tolerance (default 5 min)
}

function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    const expected = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    try {
        return timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expected)
        );
    } catch {
        return false;
    }
}

function verifyWebhookTimestamp(
    timestamp: string,
    toleranceMs = 5 * 60 * 1000
): boolean {
    const ts = Number(timestamp);
    if (isNaN(ts)) return false;
    return Math.abs(Date.now() - ts) < toleranceMs;
}

// Express middleware for webhook verification
function webhookAuth(config: WebhookConfig) {
    return (req: Request, res: Response, next: NextFunction) => {
        const signature = req.headers['x-webhook-signature'] as string;
        const timestamp = req.headers['x-webhook-timestamp'] as string;

        if (!signature || !timestamp) {
            return res.status(401).json({ error: 'Missing webhook headers' });
        }

        if (!verifyWebhookTimestamp(timestamp, config.toleranceMs)) {
            return res.status(401).json({ error: 'Webhook timestamp expired' });
        }

        const rawBody = JSON.stringify(req.body);
        if (!verifyWebhookSignature(rawBody, signature, config.secret)) {
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        next();
    };
}

// Webhook route handler
app.post('/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    webhookAuth({ secret: process.env.WEBHOOK_SECRET! }),
    async (req, res) => {
        const event = req.body;

        try {
            switch (event.type) {
                case 'payment.succeeded':
                    await handlePaymentSucceeded(event.data);
                    break;
                case 'payment.failed':
                    await handlePaymentFailed(event.data);
                    break;
                case 'subscription.created':
                    await handleSubscriptionCreated(event.data);
                    break;
                default:
                    logger.info(`Unhandled webhook event: ${event.type}`);
            }

            res.json({ received: true });
        } catch (err) {
            logger.error('Webhook handler failed:', err);
            res.status(500).json({ error: 'Handler failed' });
        }
    }
);
```

### Webhook Sender

```typescript
class WebhookSender {
    constructor(
        private url: string,
        private secret: string,
        private client: HttpClient
    ) {}

    async send(event: string, data: unknown, options?: {
        idempotencyKey?: string;
        maxRetries?: number;
    }): Promise<void> {
        const payload = JSON.stringify({
            id: crypto.randomUUID(),
            type: event,
            timestamp: Date.now(),
            data,
        });

        const timestamp = String(Date.now());
        const signature = createHmac('sha256', this.secret)
            .update(payload)
            .digest('hex');

        const maxRetries = options?.maxRetries ?? 3;
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.client.post(this.url, JSON.parse(payload), {
                    headers: {
                        'X-Webhook-Signature': signature,
                        'X-Webhook-Timestamp': timestamp,
                        'X-Webhook-ID': crypto.randomUUID(),
                        ...(options?.idempotencyKey && {
                            'X-Idempotency-Key': options.idempotencyKey,
                        }),
                    },
                });
                return;
            } catch (err) {
                lastError = err as Error;
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }

        throw lastError ?? new Error('Webhook delivery failed');
    }
}
```

## Request/Response Logging

```typescript
interface RequestLog {
    method: string;
    url: string;
    status: number;
    duration: number;
    requestId: string;
}

// Request logging interceptor
api.addRequestInterceptor((init) => {
    const requestId = crypto.randomUUID();
    (init.headers as Record<string, string>)['X-Request-ID'] = requestId;
    (init as any).__startTime = Date.now();
    (init as any).__requestId = requestId;
    return init;
});

// Response logging interceptor
api.addResponseInterceptor(async (response) => {
    const init = response as any;
    const duration = Date.now() - (init.__startTime ?? Date.now());
    const level = response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info';

    logger[level]({
        method: (init as any).__method ?? 'UNKNOWN',
        url: response.url,
        status: response.status,
        duration,
        requestId: (init as any).__requestId,
    });

    return response;
});
```

## Retry with Exponential Backoff

```typescript
async function fetchWithRetry<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        baseDelay?: number;
        maxDelay?: number;
        retryable?: (err: Error) => boolean;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 30_000,
        retryable = (err) => {
            if (err instanceof ApiError) {
                return err.status >= 500 || err.status === 429;
            }
            return true;
        },
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err as Error;

            if (attempt === maxRetries || !retryable(lastError)) {
                throw lastError;
            }

            // Respect Retry-After header for 429
            if (err instanceof ApiError && err.status === 429) {
                const retryAfter = Number((err.details as any)?.retryAfter ?? 60);
                await new Promise(r => setTimeout(r, retryAfter * 1000));
                continue;
            }

            const delay = Math.min(
                baseDelay * Math.pow(2, attempt),
                maxDelay
            ) * (0.5 + Math.random() * 0.5); // jitter

            logger.warn(`Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    throw lastError ?? new Error('Retry failed');
}
```

## Rate Limit Aware Client

```typescript
class RateLimitAwareClient {
    private lastRequestTime = 0;
    private minInterval: number;

    constructor(
        private client: HttpClient,
        requestsPerSecond: number
    ) {
        this.minInterval = 1000 / requestsPerSecond;
    }

    private async waitIfNeeded(): Promise<void> {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        if (elapsed < this.minInterval) {
            await new Promise(r => setTimeout(r, this.minInterval - elapsed));
        }
        this.lastRequestTime = Date.now();
    }

    async get<T>(path: string, query?: Record<string, unknown>): Promise<T> {
        await this.waitIfNeeded();
        return this.client.get<T>(path, query as any);
    }

    async post<T>(path: string, body?: unknown): Promise<T> {
        await this.waitIfNeeded();
        return this.client.post<T>(path, body);
    }
}

// Usage: respect provider rate limits
const github = new RateLimitAwareClient(
    new HttpClient({ baseUrl: 'https://api.github.com' }),
    10 // 10 requests per second
);
```

## API Composition (Backend-for-Frontend)

```typescript
// Aggregate data from multiple services in a single endpoint
class UserProfileService {
    constructor(
        private userApi: HttpClient,
        private orderApi: HttpClient,
        private paymentApi: HttpClient,
    ) {}

    async getProfile(userId: string): Promise<UserProfile> {
        // Parallel independent requests
        const [user, orders, wallet] = await Promise.all([
            fetchWithRetry(() => this.userApi.get<User>(`/users/${userId}`)),
            fetchWithRetry(() => this.orderApi.get<Order[]>('/orders', { userId, limit: 10 })),
            fetchWithRetry(() => this.paymentApi.get<Wallet>(`/wallets/${userId}`)),
        ]);

        return {
            user,
            recentOrders: orders,
            wallet,
        };
    }

    async getDashboard(userId: string): Promise<Dashboard> {
        // Sequential dependent requests
        const user = await this.userApi.get<User>(`/users/${userId}`);
        const preferences = await this.userApi.get<Preferences>(`/users/${userId}/preferences`);

        // Then parallel dependent requests
        const [stats, notifications] = await Promise.all([
            this.userApi.get<Stats>('/stats', { userId, period: preferences.defaultPeriod }),
            this.userApi.get<Notification[]>('/notifications', { userId, unread: true }),
        ]);

        return { user, stats, notifications };
    }
}
```

## Code Style Rules

- Wrap all HTTP calls in a client class — never call `fetch` directly in business logic.
- Use interceptors for cross-cutting concerns (auth, logging, error transformation).
- Handle token refresh in a response interceptor — retry once on 401.
- Set timeouts on all outgoing requests — default 10-15 seconds.
- Use `AbortSignal` for request cancellation (user navigated away, component unmounted).
- Verify webhook signatures with `timingSafeEqual` — never use plain string comparison.
- Retry on 5xx and 429 with exponential backoff and jitter — don't retry 4xx.
- Respect `Retry-After` header on 429 responses.
- Use idempotency keys for POST/PUT requests that might be retried.
- Use pagination helpers to abstract cursor vs offset pagination from callers.
- Log request method, URL, status, duration, and requestId — not request/response bodies (PII risk).
- Use `safeCall` wrapper for third-party APIs — never let provider errors crash your app.
- Rate-limit outgoing calls to respect provider quotas — use `RateLimitAwareClient`.
- Aggregate multiple API calls in a service layer — don't call 5 APIs from a route handler.
- Store secrets (API keys, webhook secrets) in environment variables, never in code.
