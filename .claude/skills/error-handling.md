---
name: error-handling
description: Error handling strategies, custom error classes, error propagation, result type pattern, error boundaries, logging, recovery patterns, and defensive programming in TypeScript
---

# Error Handling

## Custom Error Classes

```typescript
// Base application error
class AppError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly statusCode: number,
        public readonly isOperational: boolean = true,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Specific error types
class NotFoundError extends AppError {
    constructor(resource: string, id?: string) {
        super(
            id ? `${resource} with id '${id}' not found` : `${resource} not found`,
            'NOT_FOUND',
            404
        );
    }
}

class ValidationError extends AppError {
    constructor(
        message: string,
        public readonly fields: Record<string, string[]>
    ) {
        super(message, 'VALIDATION_ERROR', 400, true, { fields });
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 'UNAUTHORIZED', 401);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 'FORBIDDEN', 403);
    }
}

class ConflictError extends AppError {
    constructor(resource: string, field: string, value: string) {
        super(`${resource} with ${field} '${value}' already exists`, 'CONFLICT', 409);
    }
}

class RateLimitError extends AppError {
        super(message, 'RATE_LIMITED', 429, true, { retryAfterMs });
    }
}

class InternalError extends AppError {
    constructor(message = 'Internal server error', cause?: Error) {
        super(message, 'INTERNAL_ERROR', 500, false);
        if (cause) this.cause = cause;
    }
}
```

### Error Type Guard

```typescript
function isAppError(err: unknown): err is AppError {
    return err instanceof AppError;
}

function isOperationalError(err: unknown): boolean {
    if (err instanceof AppError) return err.isOperational;
    return false;
}

// Usage
try {
    await riskyOperation();
} catch (err) {
    if (isAppError(err)) {
        // Known error — safe to expose to client
        res.status(err.statusCode).json({ error: err.code, message: err.message });
    } else {
        // Unknown error — log and return generic message
        logger.error(err);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
    }
}
```

## Result Type Pattern (No Throwing)

```typescript
// Prefer Result type over throwing for expected failures
type Result<T, E = string> =
    | { ok: true; value: T }
    | { ok: false; error: E };

function ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

// Usage in functions that can fail predictably
function parseAge(input: string): Result<number, string> {
    const num = Number(input);
    if (isNaN(num)) return err('Invalid number');
    if (num < 0 || num > 150) return err('Age out of range');
    return ok(num);
}

function divide(a: number, b: number): Result<number, string> {
    if (b === 0) return err('Division by zero');
    return ok(a / b);
}

// Compose results
const ageResult = parseAge(userInput);
if (!ageResult.ok) {
    return res.status(400).json({ error: ageResult.error });
}

// Pattern matching
function formatResult<T>(result: Result<T, string>): string {
    return result.ok ? `Success: ${result.value}` : `Error: ${result.error}`;
}
```

### Result with Error Object

```typescript
interface AppResultError {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
}

type AppResult<T> = Result<T, AppResultError>;

// Database operation
async function findUser(id: string): Promise<AppResult<User>> {
    try {
        const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        if (!user) return err({ code: 'NOT_FOUND', message: 'User not found' });
        return ok(user);
    } catch (e) {
        return err({ code: 'DB_ERROR', message: 'Failed to fetch user' });
    }
}

// Validation
function validateEmail(email: string): AppResult<string> {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return err({ code: 'REQUIRED', message: 'Email is required', fields: { email: ['Required'] } });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return err({ code: 'INVALID_FORMAT', message: 'Invalid email format', fields: { email: ['Invalid format'] } });
    }
    return ok(trimmed);
}

// Chain results
async function updateUserEmail(userId: string, email: string): Promise<AppResult<User>> {
    const validated = validateEmail(email);
    if (!validated.ok) return validated;

    const user = await findUser(userId);
    if (!user.ok) return user;

    return ok(await db.update('users', userId, { email: validated.value }));
}
```

## Express Error Middleware

```typescript
import { Request, Response, NextFunction } from 'express';

// Central error handler — must have 4 parameters
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
    // Log all errors
    logger.error({
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        userId: (req as any).user?.id,
        requestId: req.headers['x-request-id'],
    });

    if (isAppError(err)) {
        res.status(err.statusCode).json({
            error: err.code,
            message: err.message,
            ...(err.details && { details: err.details }),
        });
        return;
    }

    // Prisma known errors
    if (err.name === 'PrismaClientKnownRequestError') {
        const prismaErr = err as any;
        if (prismaErr.code === 'P2002') {
            res.status(409).json({
                error: 'CONFLICT',
                message: 'A record with this value already exists',
            });
            return;
        }
        if (prismaErr.code === 'P2025') {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Record not found' });
            return;
        }
    }

    // JSON parse error
    if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
        res.status(400).json({ error: 'INVALID_JSON', message: 'Malformed JSON in request body' });
        return;
    }

    // Unknown error — never leak internals
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
}

// 404 handler — place after all routes
function notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
        error: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
    });
}

// Register: error handlers MUST be last
app.use(notFoundHandler);
app.use(errorHandler);
```

### Async Route Wrapper

```typescript
// Avoid try/catch in every route handler
function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Usage — errors bubble to errorHandler middleware
app.get('/api/users/:id', asyncHandler(async (req, res) => {
    const user = await findUser(req.params.id);
    if (!user) throw new NotFoundError('User', req.params.id);
    res.json(user);
}));

app.post('/api/users', asyncHandler(async (req, res) => {
    const validated = validateCreateUser(req.body);
    if (!validated.ok) throw new ValidationError('Invalid input', validated.error.fields ?? {});

    const user = await createUser(validated.value);
    res.status(201).json(user);
}));
```

## Error Propagation

### Async Error Boundaries

```typescript
// Wrap promise to never throw — returns [error, result] tuple
async function safeAsync<T>(
    promise: Promise<T>
): Promise<[null, T] | [Error, null]> {
    try {
        const result = await promise;
        return [null, result];
    } catch (err) {
        return [err instanceof Error ? err : new Error(String(err)), null];
    }
}

// Usage — no try/catch needed
const [dbErr, user] = await safeAsync(db.query('SELECT * FROM users WHERE id = $1', [id]));
if (dbErr) {
    logger.error('Database query failed', dbErr);
    throw new InternalError('Failed to fetch user', dbErr);
}

// Parallel safe calls
const [err1, orders] = await safeAsync(getOrders(userId));
const [err2, profile] = await safeAsync(getProfile(userId));

if (err1 || err2) {
    throw new InternalError('Failed to fetch user data');
}
```

### Error Causality Chain

```typescript
// Preserve error chain when wrapping errors
class DatabaseError extends AppError {
    constructor(operation: string, cause: Error) {
        super(`Database operation '${operation}' failed`, 'DB_ERROR', 500, false);
        this.cause = cause;
    }
}

class ExternalAPIError extends AppError {
    constructor(service: string, cause: Error) {
        super(`External service '${service}' unavailable`, 'EXTERNAL_ERROR', 502, true);
        this.cause = cause;
    }
}

// Usage
try {
    await db.query('INSERT INTO orders ...', [...]);
} catch (err) {
    throw new DatabaseError('create_order', err as Error);
}

// Log with full chain
function logErrorChain(err: Error): void {
    let current: Error | undefined = err;
    let depth = 0;

    while (current) {
        logger.error({
            depth,
            name: current.name,
            message: current.message,
            stack: current.stack,
        });
        current = current.cause as Error | undefined;
        depth++;
    }
}
```

## Validation Error Handling

```typescript
interface FieldError {
    field: string;
    rules: string[];
}

interface ValidationOutput {
    valid: boolean;
    errors: FieldError[];
}

function validate<T extends Record<string, unknown>>(
    data: T,
    rules: Record<keyof T, Array[(value: unknown) => string | null]>
): ValidationOutput {
    const errors: FieldError[] = [];

    for (const [field, fieldRules] of Object.entries(rules) as [keyof T, Array[(v: unknown) => string | null>][]) {
        const fieldErrors: string[] = [];

        for (const rule of fieldRules) {
            const error = rule(data[field]);
            if (error) fieldErrors.push(error);
        }

        if (fieldErrors.length > 0) {
            errors.push({ field: field as string, rules: fieldErrors });
        }
    }

    return { valid: errors.length === 0, errors };
}

// Rules
const required = (label: string) => (v: unknown) =>
    v == null || v === '' ? `${label} is required` : null;

const minLength = (min: number, label: string) => (v: unknown) =>
    typeof v === 'string' && v.length < min ? `${label} must be at least ${min} characters` : null;

const maxLength = (max: number, label: string) => (v: unknown) =>
    typeof v === 'string' && v.length > max ? `${label} must be at most ${max} characters` : null;

const pattern = (regex: RegExp, msg: string) => (v: unknown) =>
    typeof v === 'string' && !regex.test(v) ? msg : null;

// Usage
const result = validate(req.body, {
    name: [required('Name'), minLength(2, 'Name'), maxLength(100, 'Name')],
    email: [required('Email'), pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format')],
    age: [(v) => v != null && (typeof v !== 'number' || v < 0 || v > 150) ? 'Age must be 0-150' : null],
});

if (!result.valid) {
    const fields: Record<string, string[]> = {};
    for (const e of result.errors) fields[e.field] = e.rules;
    throw new ValidationError('Validation failed', fields);
}
```

## Logging Errors

```typescript
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    formatters: {
        level: (label) => ({ level: label }),
    },
    redact: ['req.headers.authorization', 'req.body.password', '*.token'],
});

// Structured error logging
function logError(err: Error, context?: Record<string, unknown>): void {
    const payload: Record<string, unknown> = {
        name: err.name,
        message: err.message,
        stack: err.stack,
        ...context,
    };

    if (isAppError(err)) {
        payload.code = err.code;
        payload.statusCode = err.statusCode;
        payload.isOperational = err.isOperational;
        if (err.details) payload.details = err.details;
    }

    if (err.cause instanceof Error) {
        payload.cause = {
            name: err.cause.name,
            message: err.cause.message,
        };
    }

    logger.error(payload);
}

// Request-scoped logging
function requestLogger(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] ?? crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

        logger[level]({
            requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
        });
    });

    next();
}
```

## Recovery Patterns

### Circuit Breaker

```typescript
class CircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private state: 'closed' | 'open' | 'half-open' = 'closed';

    constructor(
        private threshold: number = 5,
        private resetTimeoutMs: number = 30_000,
        private halfOpenAttempts: number = 1
    ) {}

    async run<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'open') {
            if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
                this.state = 'half-open';
            } else {
                throw new Error('Circuit breaker is open');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (err) {
            this.onFailure();
            throw err;
        }
    }

    private onSuccess(): void {
        this.failures = 0;
        this.state = 'closed';
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.threshold) {
            this.state = 'open';
        }
    }

    get status() {
        return { state: this.state, failures: this.threshold };
    }
}

// Usage — wrap unreliable external calls
const paymentBreaker = new CircuitBreaker(3, 60_000);

const result = await paymentBreaker.run(() => processPayment(order));
```

### Retry with Backoff

```typescript
interface RetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitter: boolean;
    retryIf: (err: Error) => boolean;
}

const defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30_000,
    jitter: true,
    retryIf: () => true,
};

async function retry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const opts = { ...defaultRetryConfig, ...config };

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));

            if (attempt === opts.maxAttempts || !opts.retryIf(error)) {
                throw error;
            }

            const baseDelay = Math.min(opts.baseDelayMs * Math.pow(2, attempt - 1), opts.maxDelayMs);
            const delay = opts.jitter ? baseDelay * (0.5 + Math.random() * 0.5) : baseDelay;

            logger.warn(`Attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${Math.round(delay)}ms`, {
                error: error.message,
            });

            await new Promise(r => setTimeout(r, delay));
        }
    }

    throw new Error('Max retries exceeded');
}

// Usage
const data = await retry(
    () => fetchExternalAPI(url),
    {
        maxAttempts: 5,
        retryIf: (err) => err.message.includes('503') || err.message.includes('timeout'),
    }
);
```

### Bulkhead (Concurrency Limit)

```typescript
class Bulkhead {
    private active = 0;
    private queue: Array<() => void> = [];

    constructor(private maxConcurrent: number) {}

    async run<T>(fn: () => Promise<T>): Promise<T> {
        if (this.active >= this.maxConcurrent) {
            await new Promise<void>(resolve => this.queue.push(resolve));
        }

        this.active++;
        try {
            return await fn();
        } finally {
            this.active--;
            this.queue.shift()?.();
        }
    }
}

// Limit concurrent calls to a resource
const dbBulkhead = new Bulkhead(10);
const result = await dbBulkhead.run(() => db.query('SELECT ...'));
```

### Fallback

```typescript
async function withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    retryIf: (err: Error) => boolean = () => true
): Promise<T> {
    try {
        return await primary();
    } catch (err) {
        if (retryIf(err as Error)) {
            logger.warn('Primary failed, using fallback', { error: (err as Error).message });
            return await fallback();
        }
        throw err;
    }
}

// Usage — cache fallback
const user = await withFallback(
    () => db.query('SELECT * FROM users WHERE id = $1', [id]),
    () => redis.get(`user:${id}`).then(JSON.parse),
);
```

## Defensive Programming

### Assertions

```typescript
function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertNonNull<T>(value: T | null | undefined, message: string): T {
    if (value == null) throw new Error(`Expected non-null: ${message}`);
    return value;
}

function assertString(value: unknown, field: string): string {
    if (typeof value !== 'string') throw new Error(`Expected string for ${field}`);
    return value;
}

// Usage
assert(user.role === 'admin', 'User must be admin');
const config = assertNonNull(appConfig, 'App config must be loaded');
```

### Timeout Wrapper

```typescript
function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    message = 'Operation timed out'
): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${message} (${ms}ms)`)), ms)
    );

    return Promise.race([promise, timeout]);
}

// Usage
const result = await withTimeout(
    db.query('SELECT ...'),
    5000,
    'Database query timed out'
);
```

### Safe JSON Parse

```typescript
function safeJsonParse<T>(input: string): Result<T, string> {
    try {
        return ok(JSON.parse(input) as T);
    } catch {
        return err('Invalid JSON');
    }
}

const data = safeJsonParse<Config>(rawString);
if (!data.ok) throw new ValidationError('Invalid configuration', { json: [data.error] });
```

## Error Response Format

```typescript
// Standard error response envelope
interface ErrorResponse {
    error: {
        code: string;           // e.g., 'VALIDATION_ERROR'
        message: string;        // Human-readable
        details?: unknown;      // Additional context (field errors, etc.)
        requestId?: string;     // For support lookup
        timestamp: string;
    };
}

// Success + Error union for API responses
type ApiResponse<T> =
    | { success: true; data: T }
    | { success: false; error: ErrorResponse['error'] };

// Helper to format
function successResponse<T>(data: T): ApiResponse<T> {
    return { success: true, data };
}

function errorResponse(
    code: string,
    message: string,
    details?: unknown,
    requestId?: string
): ApiResponse<never> {
    return {
        success: false,
        error: { code, message, details, requestId, timestamp: new Date().toISOString() },
    };
}
```

## Code Style Rules

- Extend `AppError` for all application errors — never throw raw `Error` in business logic.
- Use `isOperational` flag to distinguish expected vs unexpected errors.
- Use Result type for predictable failures (validation, not found) — reserve exceptions for unexpected errors.
- Always wrap async route handlers with `asyncHandler` — unhandled promise rejections crash processes.
- Preserve error causality with `cause` — never swallow the original error.
- Log errors with structured context (requestId, userId, path) — not just the message.
- Redact sensitive fields from logs (passwords, tokens, PII).
- Use circuit breakers for external service calls — fail fast when downstream is degraded.
- Use retry with exponential backoff and jitter for transient failures.
- Set timeouts on all I/O operations — network calls, DB queries, file reads.
- Validate input at system boundaries — never trust external data.
- Use the `[error, result]` tuple pattern when you want error handling without try/catch nesting.
- Never expose internal error details (stack traces, SQL, file paths) to clients.
- Centralize error formatting in middleware — keep route handlers clean.
- Use assertions for invariants that should never be false in production.
