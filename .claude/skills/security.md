---
name: security
description: Web application security — input validation, sanitization, authentication, authorization, CSRF, XSS, SQL injection prevention, security headers, JWT/session management, password hashing, CSP, HTTPS, file upload security, secrets management, and OWASP Top 10 defenses
---

# Security (OWASP Top 10, Auth, Headers)

## Input Validation & Sanitization

### Validation Layer

```typescript
// Validate at system boundaries — never trust client input
interface ValidationRule<T> {
    type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'date' | 'array' | 'object';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: T) => boolean;
    message?: string;
}

function validate<T>(value: unknown, rules: ValidationRule<T>): { valid: boolean; error?: string } {
    if (value === undefined || value === null) {
        return rules.required
            ? { valid: false, error: rules.message ?? 'Field is required' }
            : { valid: true };
    }

    switch (rules.type) {
        case 'string': {
            if (typeof value !== 'string') return { valid: false, error: 'Must be a string' };
            if (rules.minLength && value.length < rules.minLength) {
                return { valid: false, error: `Minimum ${rules.minLength} characters` };
            }
            if (rules.maxLength && value.length > rules.maxLength) {
                return { valid: false, error: `Maximum ${rules.maxLength} characters` };
            }
            if (rules.pattern && !rules.pattern.test(value)) {
                return { valid: false, error: rules.message ?? 'Invalid format' };
            }
            break;
        }
        case 'number': {
            const num = Number(value);
            if (isNaN(num)) return { valid: false, error: 'Must be a number' };
            if (rules.min !== undefined && num < rules.min) return { valid: false, error: `Minimum ${rules.min}` };
            if (rules.max !== undefined && num > rules.max) return { valid: false, error: `Maximum ${rules.max}` };
            break;
        }
        case 'email': {
            if (typeof value !== 'string') return { valid: false, error: 'Must be a string' };
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(value)) return { valid: false, error: 'Invalid email format' };
            break;
        }
        case 'url': {
            try { new URL(String(value)); } catch { return { valid: false, error: 'Invalid URL' }; }
            break;
        }
    }

    if (rules.custom && !rules.custom(value as T)) {
        return { valid: false, error: rules.message ?? 'Validation failed' };
    }

    return { valid: true };
}

// Usage — validate request body fields
function validateUserInput(body: Record<string, unknown>) {
    const errors: string[] = [];

    const nameResult = validate(body.name, {
        type: 'string', required: true, minLength: 1, maxLength: 100,
    });
    if (!nameResult.valid) errors.push(`name: ${nameResult.error}`);

    const emailResult = validate(body.email, {
        type: 'email', required: true, maxLength: 255,
    });
    if (!emailResult.valid) errors.push(`email: ${emailResult.error}`);

    const ageResult = validate(body.age, {
        type: 'number', min: 0, max: 150,
    });
    if (!ageResult.valid) errors.push(`age: ${ageResult.error}`);

    return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
```

### HTML Sanitization

```typescript
// Sanitize user input before rendering in HTML context
// NEVER use innerHTML with unsanitized user input

// Escape HTML entities
function escapeHtml(str: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    };
    return str.replace(/[&<>"'/]/g, (char) => map[char]);
}

// Escape for JavaScript string context
function escapeJs(str: string): string {
    return str.replace(/[\\'"<>\n\r  ]/g, (char) => {
        const code = char.charCodeAt(0);
        return `\\u${code.toString(16).padStart(4, '0')}`;
    });
}

// Safe attribute value
function escapeAttr(str: string): string {
    return str.replace(/[&<>"']/g, (char) => {
        const map: Record<string, string> = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;',
        };
        return map[char];
    });
}

// Elit framework auto-escapes text content — use text() for reactive values
import { text, reactive } from 'elit/state';

const userInput = createState('<script>alert("xss")</script>');

// SAFE: text() escapes HTML entities
const safeView = reactive(userInput, (val) => (
    <div class="user-content">
        <p>{text(val)}</p>
    </div>
));
// Renders as: &lt;script&gt;alert("xss")&lt;/script&gt;
```

### URL Sanitization

```typescript
// Prevent open redirect attacks
function safeRedirect(url: string, allowedHosts: string[]): string {
    // Block javascript: and data: schemes
    if (/^(javascript|data|vbscript):/i.test(url.trim())) {
        return '/';
    }

    // Allow relative URLs
    if (url.startsWith('/') && !url.startsWith('//')) {
        return url;
    }

    // Validate absolute URLs against allowlist
    try {
        const parsed = new URL(url);
        if (!allowedHosts.includes(parsed.hostname)) {
            return '/';
        }
        return url;
    } catch {
        return '/';
    }
}

// Prevent path traversal
function sanitizePath(input: string): string {
    return input
        .replace(/\.\./g, '')          // remove parent directory references
        .replace(/[\\\/]+/g, '/')      // normalize slashes
        .replace(/[^\w\-\.\/]/g, '');  // only allow safe chars
}
```

## Authentication

### Password Hashing

```typescript
import { hash, compare, genSalt } from 'bcrypt';

const SALT_ROUNDS = 12;

// Hash password on registration
async function hashPassword(plaintext: string): Promise<string> {
    const salt = await genSalt(SALT_ROUNDS);
    return hash(plaintext, salt);
}

// Verify password on login
async function verifyPassword(plaintext: string, hashed: string): Promise<boolean> {
    return compare(plaintext, hashed);
}

// Usage in registration
async function register(email: string, password: string) {
    // Validate password strength
    if (password.length < 8) throw new Error('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password)) throw new Error('Password must contain uppercase');
    if (!/[a-z]/.test(password)) throw new Error('Password must contain lowercase');
    if (!/[0-9]/.test(password)) throw new Error('Password must contain a number');
    if (!/[^A-Za-z0-9]/.test(password)) throw new Error('Password must contain a special character');

    const hashed = await hashPassword(password);
    // Store hashed password — NEVER store plaintext
    await db.insert({ email, password: hashed }).into('users');
}
```

### JWT Token Management

```typescript
import { sign, verify, decode } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

interface TokenPayload {
    sub: string;    // user ID
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}

// Generate access token
function createAccessToken(user: { id: string; email: string; role: string }): string {
    return sign(
        { sub: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL, issuer: 'quotation-app' },
    );
}

// Generate refresh token
function createRefreshToken(userId: string): string {
    return sign(
        { sub: userId, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_TTL, issuer: 'quotation-app' },
    );
}

// Verify and decode token
function verifyToken(token: string): TokenPayload {
    return verify(token, JWT_SECRET, {
        issuer: 'quotation-app',
    }) as TokenPayload;
}

// Token rotation — issue new refresh token on each use
async function rotateRefreshToken(oldToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = verifyToken(oldToken);
    if (payload.type !== 'refresh') throw new Error('Invalid token type');

    // Invalidate old refresh token in store
    await revokeRefreshToken(oldToken);

    const user = await getUserById(payload.sub);
    return {
        accessToken: createAccessToken(user),
        refreshToken: createRefreshToken(user.id),
    };
}
```

### Session-Based Auth

```typescript
import { randomBytes } from 'crypto';
import { expressSession } from 'express-session';

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,      // not accessible via JS
        secure: true,        // HTTPS only
        sameSite: 'strict',  // CSRF protection
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
    },
};

// Generate CSRF token for session
function generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
}

// Store CSRF token in session
function setCsrfToken(session: Record<string, unknown>): string {
    const token = generateCsrfToken();
    session.csrfToken = token;
    return token;
}

// Validate CSRF token
function validateCsrfToken(session: Record<string, unknown>, token: string): boolean {
    const stored = session.csrfToken;
    if (!stored || typeof stored !== 'string') return false;
    return timingSafeEqual(stored, token);
}
```

### Timing-Safe Comparison

```typescript
import { timingSafeEqual } from 'crypto';

// Constant-time string comparison — prevents timing attacks
function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    return timingSafeEqual(bufA, bufB);
}

// Use for: API keys, tokens, CSRF tokens, webhook signatures
function validateApiKey(provided: string, expected: string): boolean {
    return safeEqual(provided, expected);
}
```

## Authorization

### Role-Based Access Control (RBAC)

```typescript
type Role = 'admin' | 'manager' | 'user' | 'viewer';

const PERMISSIONS: Record<Role, string[]> = {
    admin:   ['read', 'write', 'delete', 'manage_users', 'manage_settings'],
    manager: ['read', 'write', 'delete'],
    user:    ['read', 'write'],
    viewer:  ['read'],
};

function hasPermission(role: Role, permission: string): boolean {
    return PERMISSIONS[role]?.includes(permission) ?? false;
}

// Express middleware
function requirePermission(permission: string) {
    return (req: any, res: any, next: any) => {
        const user = req.user; // set by auth middleware
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        if (!hasPermission(user.role, permission)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
}

// Resource-level authorization
function canAccessResource(user: { id: string; role: Role }, resource: { ownerId: string }): boolean {
    // Admins can access everything
    if (user.role === 'admin') return true;
    // Users can access their own resources
    return user.id === resource.ownerId;
}
```

### Auth Middleware

```typescript
import { verifyToken } from './jwt';

// Bearer token extraction
function extractBearerToken(header: string): string | null {
    if (!header.startsWith('Bearer ')) return null;
    const token = header.slice(7).trim();
    return token || null;
}

// Express auth middleware
function authMiddleware(req: any, res: any, next: any) {
    const token = extractBearerToken(req.headers.authorization ?? '');
    if (!token) {
        return res.status(401).json({ error: 'Missing authorization token' });
    }

    try {
        const payload = verifyToken(token);
        req.user = { id: payload.sub, email: payload.email, role: payload.role };
        next();
    } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Optional auth — sets user if token present, doesn't block
function optionalAuth(req: any, _res: any, next: any) {
    const token = extractBearerToken(req.headers.authorization ?? '');
    if (token) {
        try {
            const payload = verifyToken(token);
            req.user = { id: payload.sub, email: payload.email, role: payload.role };
        } catch { /* ignore invalid tokens for optional auth */ }
    }
    next();
}
```

## CSRF Protection

```typescript
import { randomBytes } from 'crypto';
import { timingSafeEqual } from 'crypto';

// Double-submit cookie pattern
function generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
}

// Set CSRF token cookie (on login or page load)
function setCsrfCookie(res: any, token: string): void {
    res.cookie('csrf-token', token, {
        httpOnly: false,    // MUST be readable by JS for header submission
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
    });
}

// Validate CSRF — compare cookie value with header value
function validateCsrf(req: any): boolean {
    const cookieToken = req.cookies['csrf-token'];
    const headerToken = req.headers['x-csrf-token'];
    if (!cookieToken || !headerToken) return false;
    return safeEqual(cookieToken, headerToken);
}

// CSRF middleware — skip for safe methods
function csrfGuard(req: any, res: any, next: any) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    if (!validateCsrf(req)) {
        return res.status(403).json({ error: 'CSRF token mismatch' });
    }
    next();
}

// Client-side: send CSRF token in header
async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const csrfToken = getCookie('csrf-token');
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'X-CSRF-Token': csrfToken ?? '',
        },
    });
}

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}
```

## Security Headers

### Helmet-Style Middleware

```typescript
// Set security headers on all responses
function securityHeaders(req: any, res: any, next: any) {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // XSS protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '0'); // disabled — can introduce vulnerabilities

    // Force HTTPS
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // Content Security Policy
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'", // restrict further if possible
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; '));

    next();
}
```

### Content Security Policy (CSP)

```typescript
// Nonce-based CSP — generate unique nonce per request
import { randomBytes } from 'crypto';

function cspWithNonce(req: any, res: any, next: any) {
    const nonce = randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;

    res.setHeader('Content-Security-Policy', [
        `default-src 'self'`,
        `script-src 'self' 'nonce-${nonce}'`,
        `style-src 'self' 'nonce-${nonce}'`,
        `img-src 'self' data: https:`,
        `font-src 'self'`,
        `connect-src 'self'`,
        `frame-ancestors 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
    ].join('; '));

    next();
}

// Use nonce in Elit SSR output
import { renderToHTMLDocument } from 'elit';

function renderSecurePage(nonce: string) {
    return renderToHTMLDocument(app, {
        head: `
            <style nonce="${nonce}">
                body { margin: 0; font-family: system-ui; }
            </style>
        `,
        scripts: [
            { src: '/bundle.js', defer: true, attrs: { nonce } },
        ],
    });
}
```

## SQL Injection Prevention

```typescript
// NEVER concatenate user input into SQL strings

// BAD — SQL injection vulnerable
function getUserBad(id: string) {
    const query = `SELECT * FROM users WHERE id = '${id}'`;
    // id = "1'; DROP TABLE users; --" → catastrophic
}

// GOOD — parameterized queries
import { db } from './database';

// Kysely (type-safe query builder)
async function getUser(id: string) {
    return db.selectFrom('users')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
}

// Raw parameterized queries (pg)
async function searchUsers(query: string) {
    const result = await pool.query(
        'SELECT id, name, email FROM users WHERE name ILIKE $1 LIMIT 50',
        [`%${query}%`], // parameterized — safe
    );
    return result.rows;
}

// Whitelist column names for dynamic ORDER BY / column selection
function safeColumnName(input: string, allowed: string[]): string {
    if (!allowed.includes(input)) {
        throw new Error(`Invalid column: ${input}`);
    }
    return input;
}

// Usage
const sortCol = safeColumnName(req.query.sort, ['name', 'email', 'created_at']);
const users = await db.selectFrom('users')
    .selectAll()
    .orderBy(sortCol, 'asc')
    .execute();
```

## File Upload Security

```typescript
import { createHash } from 'crypto';
import { extname, basename } from 'path';

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface SecureUploadOptions {
    maxFileSize: number;
    allowedMimeTypes: Set<string>;
    allowedExtensions: Set<string>;
    uploadDir: string;
}

function validateUpload(
    file: { name: string; size: number; type: string; data: Buffer },
    options: SecureUploadOptions,
): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > options.maxFileSize) {
        return { valid: false, error: `File too large (max ${options.maxFileSize / 1024 / 1024}MB)` };
    }

    // Check MIME type from header (can be spoofed — verify content too)
    if (!options.allowedMimeTypes.has(file.type)) {
        return { valid: false, error: 'File type not allowed' };
    }

    // Check extension
    const ext = extname(file.name).toLowerCase();
    if (!options.allowedExtensions.has(ext)) {
        return { valid: false, error: 'File extension not allowed' };
    }

    // Check for double extensions (e.g., image.php.png)
    const base = basename(file.name, ext);
    if (base.includes('.')) {
        return { valid: false, error: 'Invalid file name' };
    }

    return { valid: true };
}

// Generate safe filename — never use user-provided filename
function safeFilename(originalName: string): string {
    const ext = extname(originalName).toLowerCase();
    const hash = createHash('sha256')
        .update(`${originalName}-${Date.now()}-${Math.random()}`)
        .digest('hex')
        .slice(0, 16);
    return `${hash}${ext}`;
}

// Verify file content matches extension (magic bytes)
function verifyImageMagicBytes(buffer: Buffer): boolean {
    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) return true;
    return false;
}
```

## Secrets Management

```typescript
// NEVER hardcode secrets in source code
// NEVER commit .env files to version control

// Environment variables — validated at startup
interface AppConfig {
    jwtSecret: string;
    dbUrl: string;
    encryptionKey: string;
    allowedOrigins: string[];
}

function loadConfig(): AppConfig {
    const required = ['JWT_SECRET', 'DATABASE_URL', 'ENCRYPTION_KEY', 'ALLOWED_ORIGINS'];

    for (const key of required) {
        if (!process.env[key]) {
            throw new Error(`Missing required environment variable: ${key}`);
        }
    }

    return {
        jwtSecret: process.env.JWT_SECRET!,
        dbUrl: process.env.DATABASE_URL!,
        encryptionKey: process.env.ENCRYPTION_KEY!,
        allowedOrigins: process.env.ALLOWED_ORIGINS!.split(','),
    };
}

// Encrypt sensitive data at rest
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function encrypt(plaintext: string, key: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(encoded: string, key: string): string {
    const data = Buffer.from(encoded, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
}
```

## CORS Configuration

```typescript
import type { Request, Response, NextFunction } from 'express';

// Strict CORS — only allow specific origins
function corsMiddleware(allowedOrigins: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const origin = req.headers.origin;

        if (origin && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        }

        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24h preflight cache

        // Handle preflight
        if (req.method === 'OPTIONS') {
            return res.status(204).end();
        }

        next();
    };
}

// Never use Access-Control-Allow-Origin: * with credentials
// Never reflect origin header without validation
```

## Request Logging & Audit

```typescript
// Log security-relevant events
interface SecurityEvent {
    type: 'auth_success' | 'auth_failure' | 'access_denied' | 'suspicious_input' | 'rate_limited';
    userId?: string;
    ip: string;
    path: string;
    method: string;
    userAgent?: string;
    timestamp: string;
    details?: Record<string, unknown>;
}

function logSecurityEvent(event: SecurityEvent): void {
    // Use structured logging — pino or similar
    console.log(JSON.stringify({
        level: 'security',
        ...event,
        timestamp: new Date().toISOString(),
    }));
}

// Log failed authentication attempts
function logAuthFailure(ip: string, email: string, reason: string): void {
    logSecurityEvent({
        type: 'auth_failure',
        ip,
        path: '/auth/login',
        method: 'POST',
        details: { email, reason },
        timestamp: new Date().toISOString(),
    });
}

// Log access denied
function logAccessDenied(userId: string, resource: string, action: string): void {
    logSecurityEvent({
        type: 'access_denied',
        userId,
        ip: '', // filled by middleware
        path: resource,
        method: action,
        timestamp: new Date().toISOString(),
    });
}
```

## Dependency Security

```typescript
// Audit dependencies regularly
// Run: npm audit
// Run: npx better-npm-audit audit
// Check for known vulnerabilities

// Pin dependency versions — avoid floating ranges
// GOOD:
//   "some-package": "1.2.3"
// AVOID:
//   "some-package": "^1.2.3"  (may pull patched version with breaking changes)
//   "some-package": "*"       (completely unpinned)

// Review dependency tree for suspicious packages
// Run: npm ls
// Check for typosquatting (e.g., "loDash" instead of "lodash")

// Lock file integrity — commit package-lock.json
// Run: npm ci (not npm install) in CI/CD for reproducible builds
```

## Secure Elit Patterns

### Frontend Auth State

```typescript
import { createState, reactive, computed } from 'elit/state';

interface AuthUser {
    id: string;
    email: string;
    role: 'admin' | 'manager' | 'user' | 'viewer';
}

// Auth state — never store tokens in reactive state visible to devtools
const currentUser = createState<AuthUser | null>(null);
const isAuthenticated = computed([currentUser], (u) => u !== null);

// Store tokens in httpOnly cookies (server sets them) — not localStorage
// If using localStorage (less secure), clear on logout
function logout(): void {
    currentUser.value = null;
    // Clear any client-side tokens
    localStorage.removeItem('csrf-token');
    // Server call to invalidate refresh token
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}

// Permission check in UI (for show/hide — always enforce server-side too)
function canEdit(): boolean {
    const user = currentUser.value;
    if (!user) return false;
    return ['admin', 'manager', 'user'].includes(user.role);
}
```

### Secure API Client

```typescript
// Centralized API client with auth and CSRF
class SecureApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private getCsrfToken(): string {
        return getCookie('csrf-token') ?? '';
    }

    async request<T>(path: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}${path}`;

        const response = await fetch(url, {
            ...options,
            credentials: 'include', // send cookies
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.getCsrfToken(),
                ...options.headers,
            },
        });

        if (response.status === 401) {
            // Token expired — redirect to login
            currentUser.value = null;
            router.push('/login');
            throw new Error('Session expired');
        }

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error ?? `Request failed: ${response.status}`);
        }

        return response.json();
    }

    get<T>(path: string) {
        return this.request<T>(path);
    }

    post<T>(path: string, body: unknown) {
        return this.request<T>(path, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    put<T>(path: string, body: unknown) {
        return this.request<T>(path, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    }

    delete<T>(path: string) {
        return this.request<T>(path, { method: 'DELETE' });
    }
}
```

## OWASP Top 10 Checklist

| # | Risk | Mitigation |
|---|------|-----------|
| A01 | Broken Access Control | RBAC, resource ownership checks, deny by default |
| A02 | Cryptographic Failures | bcrypt for passwords, AES-256-GCM for data, TLS in transit |
| A03 | Injection | Parameterized SQL queries, input validation, HTML escaping |
| A04 | Insecure Design | Threat modeling, secure defaults, principle of least privilege |
| A05 | Security Misconfiguration | Security headers, disable debug in prod, no default credentials |
| A06 | Vulnerable Components | `npm audit`, pin versions, update regularly |
| A07 | Auth Failures | Strong password policy, rate limiting, MFA, secure session management |
| A08 | Data Integrity Failures | Verify dependency integrity, signed commits, CSP with nonces |
| A09 | Logging & Monitoring | Structured security logs, alert on anomalies, audit trail |
| A10 | SSRF | URL allowlisting, block internal IPs, validate redirects |

## Code Style Rules

- Always validate and sanitize input at system boundaries (HTTP requests, WebSocket messages, file uploads).
- Use parameterized queries for all database operations — never concatenate user input into SQL.
- Hash passwords with bcrypt (12+ rounds) — never store plaintext or use MD5/SHA for passwords.
- Store JWT secrets and encryption keys in environment variables — never hardcode secrets.
- Set security headers on all responses: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `CSP`.
- Use `timingSafeEqual` for all token/key comparisons — never use `===` for secrets (timing attacks).
- Use `httpOnly`, `secure`, `sameSite=strict` cookies for session tokens.
- Implement CSRF protection (double-submit cookie or Synchronizer Token Pattern).
- Validate file uploads: check size, MIME type, extension, and magic bytes — generate safe filenames.
- Use Elit's `text()` for reactive content — it auto-escapes HTML and prevents XSS.
- Enforce authorization server-side — frontend permission checks are for UX only, never for security.
- Log all authentication events (success/failure) and authorization failures for audit.
- Run `npm audit` regularly and pin dependency versions in `package.json`.
- Use `Content-Security-Policy` with nonces for inline scripts — avoid `'unsafe-inline'` and `'unsafe-eval'`.
- Encrypt sensitive data at rest (AES-256-GCM) and enforce HTTPS in transit.
- Follow principle of least privilege — grant minimum permissions needed for each role.
