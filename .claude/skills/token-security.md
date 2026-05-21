---
name: token-security
description: Token security — JWT best practices, token storage, XSS/CSRF token protection, token rotation, token revocation, refresh token security, token leakage prevention, OAuth2 token handling, and token security testing for TypeScript/Node.js applications
---

# Token Security

## Token Types & Threats

```
Token Type         Lifetime      Storage              Threats
───────────────── ───────────── ──────────────────── ──────────────────────────
Access Token       5-15 min      Memory only (JS)     XSS, token theft, replay
Refresh Token      7-30 days     HttpOnly cookie       CSRF, database leak
ID Token (OIDC)    1 hour        Not stored by app     Leak via URL/log
CSRF Token         Per session   HttpOnly cookie       CSRF bypass
API Key            Infinite      Server only           Database leak, git commit
Session ID         Per session   HttpOnly cookie       Session hijacking, fixation
```

## JWT Structure & Security

### Token Composition

```typescript
// src/auth/tokens.ts
import jwt from 'jsonwebtoken';

interface AccessTokenPayload {
    sub: string;        // user ID
    role: string;       // user role
    sid: string;        // session ID (for revocation)
    iat: number;        // issued at
    exp: number;        // expiration
    jti: string;        // unique token ID (for replay protection)
}

interface RefreshTokenPayload {
    sub: string;        // user ID
    sid: string;        // session ID
    type: 'refresh';
    iat: number;
    exp: number;
    jti: string;
}

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

function generateTokenPair(userId: string, role: string, sessionId: string) {
    const jti = crypto.randomUUID();

    const accessToken = jwt.sign(
        { sub: userId, role, sid: sessionId, jti },
        process.env.JWT_SECRET!,
        {
            expiresIn: ACCESS_TOKEN_TTL,
            issuer: 'quotation-app',
            audience: 'quotation-app-api',
            subject: userId,
            jwtid: jti,
        }
    );

    const refreshToken = jwt.sign(
        { sub: userId, sid: sessionId, type: 'refresh', jti: crypto.randomUUID() },
        process.env.JWT_REFRESH_SECRET!,
        {
            expiresIn: REFRESH_TOKEN_TTL,
            issuer: 'quotation-app',
            audience: 'quotation-app-refresh',
            subject: userId,
            jwtid: crypto.randomUUID(),
        }
    );

    return { accessToken, refreshToken };
}
```

### JWT Signing Best Practices

```typescript
// Use asymmetric keys (RS256/ES256) for distributed systems
// Use symmetric (HS256) only when signer = verifier

// Option 1: Symmetric (single server)
const JWT_SECRET = process.env.JWT_SECRET!; // ≥32 chars, random

// Option 2: Asymmetric (microservices / third-party verification)
import { readFileSync } from 'fs';

const privateKey = readFileSync('keys/private.pem');
const publicKey = readFileSync('keys/public.pem');

// Sign with private key
const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

// Verify with public key (can be shared)
const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

// Generate key pair
// ssh-keygen -t rsa -b 4096 -m PEM -f jwt-private.pem
// openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
```

### Key Rotation

```typescript
// src/auth/key-rotation.ts

interface JwtKey {
    kid: string;       // Key ID
    key: string;       // Secret or PEM
    algorithm: string;
    createdAt: Date;
    expiresAt: Date;
}

class JwtKeyManager {
    private keys: JwtKey[] = [];
    private currentKeyId: string = '';

    constructor() {
        this.rotate();
    }

    rotate(): void {
        const kid = crypto.randomUUID();
        const key: JwtKey = {
            kid,
            key: this.generateSecret(),
            algorithm: 'HS256',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        };

        this.keys.push(key);
        this.currentKeyId = kid;

        // Clean up expired keys
        this.keys = this.keys.filter(k => k.expiresAt > new Date());

        // Keep at most 3 keys (current + 2 previous for verification)
        if (this.keys.length > 3) {
            this.keys = this.keys.slice(-3);
        }
    }

    getCurrentKey(): JwtKey {
        return this.keys.find(k => k.kid === this.currentKeyId)!;
    }

    getKeyById(kid: string): JwtKey | undefined {
        return this.keys.find(k => k.kid === kid);
    }

    sign(payload: object): string {
        const key = this.getCurrentKey();
        return jwt.sign(payload, key.key, {
            algorithm: key.algorithm as any,
            keyid: key.kid,
        });
    }

    verify(token: string): any {
        const decoded = jwt.decode(token, { complete: true });
        if (!decoded || typeof decoded === 'string') {
            throw new Error('Invalid token');
        }

        const kid = decoded.header.kid;
        const key = this.getKeyById(kid);
        if (!key) throw new Error('Unknown key ID');

        return jwt.verify(token, key.key, { algorithms: [key.algorithm as any] });
    }

    private generateSecret(): string {
        return require('crypto').randomBytes(64).toString('hex');
    }
}
```

## Token Storage Security

### Browser Storage Comparison

```
Storage Method          XSS    CSRF   Expires     Max Size
────────────────────── ────── ────── ─────────── ─────────
localStorage           VULN   Safe   Never       5MB
sessionStorage         VULN   Safe   Tab close   5MB
Cookie (HttpOnly)      Safe   VULN*  Configured  4KB
Cookie (JS accessible) VULN   VULN*  Configured  4KB
Memory (JS variable)   Safe   Safe   Page close  N/A
IndexedDB              VULN   Safe   Never       Large

* CSRF mitigated with SameSite attribute

RECOMMENDATION:
  Access Token  → Memory only (JS variable, not localStorage)
  Refresh Token → HttpOnly + Secure + SameSite cookie
  CSRF Token    → HttpOnly + Secure + SameSite cookie
```

### Secure Cookie Settings

```typescript
// src/auth/cookie.ts
import { Response } from 'express';

const REFRESH_COOKIE_NAME = 'refresh_token';
const CSRF_COOKIE_NAME = 'csrf_token';

interface CookieOptions {
    maxAge: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    path: string;
    domain?: string;
}

function getCookieOptions(isProduction: boolean): CookieOptions {
    return {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: isProduction,              // HTTPS only in production
        sameSite: isProduction ? 'strict' : 'lax',
        path: '/api/auth',                 // Only sent to auth endpoints
    };
}

function setRefreshCookie(res: Response, refreshToken: string): void {
    const options = getCookieOptions(process.env.NODE_ENV === 'production');
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, options);
}

function clearRefreshCookie(res: Response): void {
    const options = getCookieOptions(process.env.NODE_ENV === 'production');
    res.clearCookie(REFRESH_COOKIE_NAME, { ...options, maxAge: undefined });
}

// Login response — access token in body, refresh in cookie
function sendTokenResponse(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    setRefreshCookie(res, tokens.refreshToken);

    res.json({
        accessToken: tokens.accessToken,
        tokenType: 'Bearer',
        expiresIn: 15 * 60, // 15 minutes in seconds
    });
}
```

### CSRF Token Protection

```typescript
// src/auth/csrf.ts
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET!;

function generateCsrfToken(sessionId: string): string {
    const nonce = randomBytes(16).toString('hex');
    const hmac = createHmac('sha256', CSRF_SECRET)
        .update(`${sessionId}:${nonce}`)
        .digest('hex');
    return `${nonce}:${hmac}`;
}

function verifyCsrfToken(sessionId: string, token: string): boolean {
    const [nonce, hmac] = token.split(':');
    if (!nonce || !hmac) return false;

    const expected = createHmac('sha256', CSRF_SECRET)
        .update(`${sessionId}:${nonce}`)
        .digest('hex');

    try {
        return timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
    } catch {
        return false;
    }
}

// Middleware
function csrfProtection(req: Request, res: Response, next: NextFunction) {
    // Skip for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // Skip for API authenticated via Authorization header
    // (browsers don't send custom headers in CSRF attacks)
    if (req.headers.authorization) {
        return next();
    }

    const csrfToken = req.headers['x-csrf-token'] as string;
    const sessionId = req.session?.id;

    if (!csrfToken || !sessionId || !verifyCsrfToken(sessionId, csrfToken)) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    next();
}
```

## Token Revocation

### Session-Based Revocation

```typescript
// src/auth/token-revocation.ts
import Redis from 'ioredis';

class TokenRevocationService {
    private redis: Redis;

    constructor(redisUrl: string) {
        this.redis = new Redis(redisUrl);
    }

    // Revoke a specific token
    async revokeToken(jti: string, ttlSeconds: number): Promise<void> {
        await this.redis.set(`revoked:${jti}`, '1', 'EX', ttlSeconds);
    }

    // Revoke all tokens for a session
    async revokeSession(sessionId: string): Promise<void> {
        await this.redis.set(`session_revoked:${sessionId}`, '1', 'EX', 30 * 24 * 60 * 60);
    }

    // Revoke all tokens for a user (force logout everywhere)
    async revokeAllUserTokens(userId: string): Promise<void> {
        await this.redis.set(`user_revoked:${userId}`, Date.now().toString(), 'EX', 30 * 24 * 60 * 60);
    }

    // Check if token is revoked
    async isTokenRevoked(jti: string, sessionId: string, userId: string): Promise<boolean> {
        const [tokenRevoked, sessionRevoked, userRevokedAt] = await Promise.all([
            this.redis.get(`revoked:${jti}`),
            this.redis.get(`session_revoked:${sessionId}`),
            this.redis.get(`user_revoked:${userId}`),
        ]);

        return tokenRevoked === '1' || sessionRevoked === '1' || userRevokedAt !== null;
    }
}
```

### Token Verification with Revocation Check

```typescript
// src/middleware/auth.ts
import jwt from 'jsonwebtoken';

function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.substring(7);

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!, {
            issuer: 'quotation-app',
            audience: 'quotation-app-api',
            algorithms: ['HS256'],
        }) as AccessTokenPayload;

        // Check revocation
        revocationService.isTokenRevoked(payload.jti, payload.sid, payload.sub)
            .then(revoked => {
                if (revoked) {
                    return res.status(401).json({ error: 'Token has been revoked' });
                }

                req.user = {
                    id: payload.sub,
                    role: payload.role,
                    sessionId: payload.sid,
                };

                next();
            })
            .catch(() => {
                res.status(500).json({ error: 'Token verification failed' });
            });

    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(401).json({ error: 'Authentication failed' });
    }
}
```

## Refresh Token Security

### Refresh Token Rotation

```typescript
// src/auth/refresh.ts

class RefreshTokenService {
    // On refresh: validate old token, issue new pair, invalidate old
    async rotateRefreshToken(oldRefreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }> {
        // 1. Verify the old refresh token
        let payload: RefreshTokenPayload;
        try {
            payload = jwt.verify(
                oldRefreshToken,
                process.env.JWT_REFRESH_SECRET!,
                { issuer: 'quotation-app', audience: 'quotation-app-refresh' }
            ) as RefreshTokenPayload;
        } catch {
            throw new UnauthorizedError('Invalid refresh token');
        }

        // 2. Check if already used (replay detection)
        const wasUsed = await this.redis.get(`refresh_used:${payload.jti}`);
        if (wasUsed) {
            // Possible theft! Revoke entire session
            await this.revocationService.revokeSession(payload.sid);
            throw new UnauthorizedError('Refresh token reuse detected — session revoked');
        }

        // 3. Mark old token as used
        const ttl = payload.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
            await this.redis.set(`refresh_used:${payload.jti}`, '1', 'EX', ttl);
        }

        // 4. Check if session is still valid
        const sessionRevoked = await this.revocationService.isTokenRevoked(
            payload.jti, payload.sid, payload.sub
        );
        if (sessionRevoked) {
            throw new UnauthorizedError('Session has been revoked');
        }

        // 5. Issue new token pair
        const newTokens = generateTokenPair(payload.sub, 'user', payload.sid);

        // 6. Store new refresh token hash for future validation
        await this.storeRefreshTokenHash(payload.sub, payload.sid, newTokens.refreshToken);

        return newTokens;
    }

    private async storeRefreshTokenHash(
        userId: string, sessionId: string, refreshToken: string
    ): Promise<void> {
        const hash = createHash('sha256').update(refreshToken).digest('hex');
        await this.redis.set(
            `refresh:${userId}:${sessionId}`,
            hash,
            'EX', 7 * 24 * 60 * 60 // 7 days
        );
    }

    private redis: any; // Redis client
    private revocationService: TokenRevocationService;
}
```

### Refresh Endpoint

```typescript
// src/routes/auth.ts

// POST /api/auth/refresh
async function refreshToken(req: Request, res: Response) {
    // Get refresh token from HttpOnly cookie
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token' });
    }

    try {
        const tokens = await refreshService.rotateRefreshToken(refreshToken);

        // Set new refresh cookie
        setRefreshCookie(res, tokens.refreshToken);

        res.json({
            accessToken: tokens.accessToken,
            tokenType: 'Bearer',
            expiresIn: 15 * 60,
        });
    } catch (error) {
        // Clear cookie on failure
        clearRefreshCookie(res);
        res.status(401).json({ error: (error as Error).message });
    }
}

// POST /api/auth/logout
async function logout(req: AuthenticatedRequest, res: Response) {
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
        try {
            const payload = jwt.decode(refreshToken) as RefreshTokenPayload;
            if (payload?.sid) {
                await revocationService.revokeSession(payload.sid);
            }
        } catch {
            // Token invalid, just clear cookie
        }
    }

    clearRefreshCookie(res);
    res.json({ message: 'Logged out' });
}

// POST /api/auth/logout-all
async function logoutAll(req: AuthenticatedRequest, res: Response) {
    await revocationService.revokeAllUserTokens(req.user!.id);
    clearRefreshCookie(res);
    res.json({ message: 'Logged out from all devices' });
}
```

## Token Leakage Prevention

### Prevent Token in URL

```typescript
// NEVER put tokens in URLs — they leak via:
// - Browser history
// - Referer headers
// - Server access logs
// - Proxy logs

// ❌ BAD: Token in query string
// GET /api/quotations?token=eyJhbG...

// ✅ GOOD: Token in Authorization header
// GET /api/quotations
// Authorization: Bearer eyJhbG...

// Middleware to reject tokens in query params
function rejectUrlTokens(req: Request, res: Response, next: NextFunction) {
    if (req.query.token || req.query.access_token || req.query.refresh_token) {
        return res.status(400).json({
            error: 'Tokens must not be passed in URL parameters',
        });
    }
    next();
}
```

### Log Redaction

```typescript
// src/utils/log-redact.ts
import pino from 'pino';

const sensitiveKeys = [
    'password', 'token', 'authorization', 'cookie',
    'secret', 'apiKey', 'access_token', 'refresh_token',
    'creditCard', 'ssn',
];

function redactObject(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') return obj;

    const redacted = { ...(obj as Record<string, unknown>) };

    for (const key of Object.keys(redacted)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()))) {
            redacted[key] = '[REDACTED]';
        } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
            redacted[key] = redactObject(redacted[key]);
        }
    }

    return redacted;
}

const logger = pino({
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.token',
            'req.body.refreshToken',
        ],
        censor: '[REDACTED]',
    },
});
```

### Response Header Stripping

```typescript
// Remove server version and powered-by headers
function securityHeaders(req: Request, res: Response, next: NextFunction) {
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    // Prevent token caching
    if (req.path.startsWith('/api/auth')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
    }

    next();
}
```

## OAuth2 Token Security

### Authorization Code Flow with PKCE

```typescript
// src/auth/oauth.ts
import { createHash, randomBytes } from 'crypto';

// Generate PKCE challenge
function generatePkce(): { verifier: string; challenge: string } {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256')
        .update(verifier)
        .digest('base64url');

    return { verifier, challenge };
}

// OAuth2 authorization URL
function getAuthorizationUrl(state: string) {
    const { verifier, challenge } = generatePkce();

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.OAUTH_CLIENT_ID!,
        redirect_uri: process.env.OAUTH_REDIRECT_URI!,
        scope: 'openid profile email',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
    });

    return {
        url: `${process.env.OAUTH_AUTH_URL}?${params}`,
        verifier, // Store in session for later verification
    };
}

// Exchange code for tokens
async function exchangeCode(code: string, codeVerifier: string) {
    const response = await fetch(process.env.OAUTH_TOKEN_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.OAUTH_REDIRECT_URI!,
            client_id: process.env.OAUTH_CLIENT_ID!,
            client_secret: process.env.OAUTH_CLIENT_SECRET!,
            code_verifier: codeVerifier,
        }),
    });

    if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
    }

    const tokens = await response.json();
    // tokens: { access_token, id_token, refresh_token, expires_in, token_type }

    // Validate ID token
    const idToken = jwt.decode(tokens.id_token, { complete: true });
    // Verify issuer, audience, nonce, expiration

    return tokens;
}
```

## Token Security Testing

### Test: Token Validation

```typescript
// tests/auth/token-security.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import jwt from 'jsonwebtoken';

describe('Token Security', () => {
    describe('Access token validation', () => {
        it('rejects missing token', async () => {
            await request(app).get('/api/quotations').expect(401);
        });

        it('rejects malformed token', async () => {
            await request(app)
                .get('/api/quotations')
                .set('Authorization', 'Bearer not-a-token')
                .expect(401);
        });

        it('rejects expired token', async () => {
            const expiredToken = jwt.sign(
                { sub: 'user-1', role: 'staff', sid: 'sess-1', jti: 'jti-1' },
                process.env.JWT_SECRET!,
                { expiresIn: '-1s', issuer: 'quotation-app', audience: 'quotation-app-api' }
            );

            const res = await request(app)
                .get('/api/quotations')
                .set('Authorization', `Bearer ${expiredToken}`)
                .expect(401);

            expect(res.body.code).toBe('TOKEN_EXPIRED');
        });

        it('rejects token with wrong issuer', async () => {
            const badToken = jwt.sign(
                { sub: 'user-1', role: 'staff' },
                process.env.JWT_SECRET!,
                { expiresIn: '15m', issuer: 'wrong-app', audience: 'quotation-app-api' }
            );

            await request(app)
                .get('/api/quotations')
                .set('Authorization', `Bearer ${badToken}`)
                .expect(401);
        });

        it('rejects token with wrong secret', async () => {
            const badToken = jwt.sign(
                { sub: 'user-1', role: 'staff' },
                'wrong-secret',
                { expiresIn: '15m', issuer: 'quotation-app', audience: 'quotation-app-api' }
            );

            await request(app)
                .get('/api/quotations')
                .set('Authorization', `Bearer ${badToken}`)
                .expect(401);
        });
    });

    describe('Revoked token', () => {
        it('rejects revoked token', async () => {
            const token = createTestToken({ jti: 'revoked-jti' });
            await revokeToken('revoked-jti');

            await request(app)
                .get('/api/quotations')
                .set('Authorization', `Bearer ${token}`)
                .expect(401);
        });

        it('rejects token from revoked session', async () => {
            const token = createTestToken({ sid: 'revoked-session' });
            await revokeSession('revoked-session');

            await request(app)
                .get('/api/quotations')
                .set('Authorization', `Bearer ${token}`)
                .expect(401);
        });
    });

    describe('Refresh token rotation', () => {
        it('issues new token pair on refresh', async () => {
            const { refreshToken } = await login();

            const res = await request(app)
                .post('/api/auth/refresh')
                .set('Cookie', `refresh_token=${refreshToken}`)
                .expect(200);

            expect(res.body.accessToken).toBeDefined();
            expect(res.headers['set-cookie']).toBeDefined();
        });

        it('rejects reused refresh token', async () => {
            const { refreshToken } = await login();

            // First refresh — succeeds
            await request(app)
                .post('/api/auth/refresh')
                .set('Cookie', `refresh_token=${refreshToken}`)
                .expect(200);

            // Second refresh with same token — must fail
            await request(app)
                .post('/api/auth/refresh')
                .set('Cookie', `refresh_token=${refreshToken}`)
                .expect(401);
        });

        it('clears cookie on invalid refresh', async () => {
            const res = await request(app)
                .post('/api/auth/refresh')
                .set('Cookie', 'refresh_token=invalid')
                .expect(401);

            // Cookie should be cleared
            const cookies = res.headers['set-cookie'];
            expect(cookies).toBeDefined();
        });
    });

    describe('Token leakage prevention', () => {
        it('rejects tokens in query params', async () => {
            await request(app)
                .get('/api/quotations?token=some-token')
                .expect(400);
        });

        it('sets no-cache headers on auth endpoints', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@test.com', password: 'password' });

            expect(res.headers['cache-control']).toContain('no-store');
        });
    });
});
```

## Token Security Checklist

```markdown
## Token Security Checklist

### Access Token
- [ ] Short lifetime (5-15 minutes)
- [ ] Stored in memory only — never localStorage
- [ ] Sent via Authorization header — never in URL
- [ ] Includes jti for revocation tracking
- [ ] Includes sid for session-level revocation
- [ ] Verified on every request (signature + expiration + issuer + audience)
- [ ] Checked against revocation list

### Refresh Token
- [ ] Long lifetime (7-30 days) but rotated on every use
- [ ] Stored in HttpOnly + Secure + SameSite=Strict cookie
- [ ] Cookie path restricted to /api/auth
- [ ] One-time use — old token invalidated after rotation
- [ ] Reuse detection triggers full session revocation
- [ ] Hash stored in Redis/DB for server-side validation

### CSRF Protection
- [ ] SameSite cookie attribute set
- [ ] CSRF token for cookie-based authentication
- [ ] Timing-safe comparison for CSRF validation
- [ ] Bearer token auth bypasses CSRF (browsers can't add custom headers)

### General
- [ ] JWT secrets ≥ 256 bits, rotated periodically
- [ ] Tokens logged with redaction ([REDACTED])
- [ ] Cache-Control: no-store on auth responses
- [ ] Rate limiting on login and refresh endpoints
- [ ] Force logout revokes all sessions
- [ ] PKCE for OAuth2 authorization code flow
```

## Code Style Rules

- Access tokens must have short TTL (≤15 minutes) — never long-lived
- Refresh tokens must be stored in HttpOnly + Secure + SameSite cookies — never in localStorage
- Every refresh token use must rotate — old token invalidated, reuse triggers session revocation
- Include `jti` (unique ID) in all tokens for revocation tracking
- Verify JWT issuer, audience, and algorithm — never accept `alg: none`
- Use timing-safe comparison for all token/CSRF validation to prevent timing attacks
- Redact tokens from all logs — use pino redact paths or custom redaction
- Set `Cache-Control: no-store` on all auth-related responses
- Rate limit login and refresh endpoints to prevent brute force and token abuse
- Use asymmetric keys (RS256) when multiple services verify tokens
