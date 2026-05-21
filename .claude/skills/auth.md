---
name: auth
description: Implement authentication and authorization — JWT, session management, OAuth2, password hashing, token refresh, RBAC, ABAC, CSRF protection, rate limiting, and security best practices for web apps and APIs.
---

You are an expert in authentication and authorization. When the user asks for help with auth, follow these instructions.

## Auth Architecture Overview

```
┌────────┐    ┌──────────┐    ┌────────────┐    ┌─────┐
│ Client │───▶│ Auth      │───▶│ Access     │───▶│ API │
│        │    │ Endpoint  │    │ Token (JWT)│    │     │
│        │◀───│ login     │◀───│ + Refresh  │◀───│     │
│        │    │ register  │    │   Token    │    │     │
└────────┘    └──────────┘    └────────────┘    └─────┘

Flows:
1. Registration: email + password → hash password → store user
2. Login: email + password → verify hash → issue tokens
3. API access: Bearer token → verify JWT → attach user to request
4. Refresh: refresh token → verify → issue new token pair
5. Logout: invalidate refresh token → clear client tokens
```

## Password Handling

### Hashing (bcrypt)

```ts
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // cost factor: 10-12 recommended

// Hash password (registration)
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password (login)
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Usage
const hashed = await hashPassword('user-password-123');  // store in DB
const valid = await verifyPassword('user-password-123', hashed); // true
```

### Password Requirements

```ts
interface PasswordPolicy {
  minLength: number;        // minimum 8 characters
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

const defaultPolicy: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

function validatePassword(password: string, policy = defaultPolicy): string[] {
  const errors: string[] = [];
  if (password.length < policy.minLength) {
    errors.push(`Must be at least ${policy.minLength} characters`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Must contain an uppercase letter');
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Must contain a lowercase letter');
  }
  if (policy.requireNumber && !/\d/.test(password)) {
    errors.push('Must contain a number');
  }
  if (policy.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Must contain a special character');
  }
  return errors;
}

// Check against common passwords
const commonPasswords = new Set(['password', '12345678', 'qwerty123', ...]);
function isCommonPassword(password: string): boolean {
  return commonPasswords.has(password.toLowerCase());
}
```

## JWT (JSON Web Tokens)

### Token Structure

```ts
import { sign, verify, decode } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET; // 256-bit random string
const ACCESS_TOKEN_EXPIRY = '15m';        // short-lived
const REFRESH_TOKEN_EXPIRY = '7d';        // long-lived

interface TokenPayload {
  sub: string;    // user ID
  role: string;   // user role
  email: string;
}

// Generate access token
function generateAccessToken(user: { id: string; role: string; email: string }): string {
  return sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY, issuer: 'myapp', audience: 'myapp-api' }
  );
}

// Generate refresh token
function generateRefreshToken(userId: string): string {
  return sign(
    { sub: userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY, issuer: 'myapp' }
  );
}

// Generate token pair
function generateTokenPair(user: { id: string; role: string; email: string }) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user.id),
    expiresIn: 900, // 15 minutes in seconds
  };
}
```

### Token Verification

```ts
import { verify, JwtPayload } from 'jsonwebtoken';

function verifyAccessToken(token: string): TokenPayload {
  try {
    const payload = verify(token, JWT_SECRET, {
      issuer: 'myapp',
      audience: 'myapp-api',
    });
    return payload as TokenPayload;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthError('TOKEN_EXPIRED', 'Access token has expired');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new AuthError('TOKEN_INVALID', 'Invalid access token');
    }
    throw new AuthError('TOKEN_INVALID', 'Token verification failed');
  }
}

function verifyRefreshToken(token: string): { sub: string } {
  try {
    const payload = verify(token, JWT_SECRET, { issuer: 'myapp' });
    if (payload.type !== 'refresh') {
      throw new AuthError('TOKEN_INVALID', 'Not a refresh token');
    }
    return { sub: payload.sub };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthError('TOKEN_EXPIRED', 'Refresh token has expired');
    }
    throw new AuthError('TOKEN_INVALID', 'Invalid refresh token');
  }
}
```

### Custom Error

```ts
class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
```

## Auth Endpoints

### Registration

```ts
// POST /api/v1/auth/register
interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

async function register(req: RegisterRequest) {
  // 1. Validate input
  if (!req.name || !req.email || !req.password) {
    throw new AuthError('VALIDATION_ERROR', 'All fields required', 400);
  }

  // 2. Validate password strength
  const errors = validatePassword(req.password);
  if (errors.length > 0) {
    throw new AuthError('VALIDATION_ERROR', errors.join(', '), 400);
  }

  // 3. Check if user exists
  const existing = await userRepo.findByEmail(req.email);
  if (existing) {
    throw new AuthError('ALREADY_EXISTS', 'Email already registered', 409);
  }

  // 4. Hash password and create user
  const hashedPassword = await hashPassword(req.password);
  const user = await userRepo.create({
    name: req.name,
    email: req.email,
    password: hashedPassword,
    role: 'user',
  });

  // 5. Issue tokens
  const tokens = generateTokenPair(user);

  // 6. Store refresh token
  await refreshTokenStore.save(user.id, tokens.refreshToken);

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    ...tokens,
  };
}
```

### Login

```ts
// POST /api/v1/auth/login
interface LoginRequest {
  email: string;
  password: string;
}

async function login(req: LoginRequest) {
  // 1. Find user
  const user = await userRepo.findByEmail(req.email);
  if (!user) {
    // Don't reveal whether email exists — use generic message
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // 2. Verify password
  const valid = await verifyPassword(req.password, user.password);
  if (!valid) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // 3. Check account status
  if (user.status === 'suspended') {
    throw new AuthError('ACCOUNT_SUSPENDED', 'Account is suspended', 403);
  }

  // 4. Issue tokens
  const tokens = generateTokenPair(user);

  // 5. Store refresh token
  await refreshTokenStore.save(user.id, tokens.refreshToken);

  // 6. Update last login
  await userRepo.updateLastLogin(user.id);

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    ...tokens,
  };
}
```

### Token Refresh

```ts
// POST /api/v1/auth/refresh
interface RefreshRequest {
  refreshToken: string;
}

async function refresh(req: RefreshRequest) {
  // 1. Verify refresh token signature
  const { sub: userId } = verifyRefreshToken(req.refreshToken);

  // 2. Check if refresh token exists in store (not revoked)
  const stored = await refreshTokenStore.find(userId, req.refreshToken);
  if (!stored) {
    throw new AuthError('TOKEN_REVOKED', 'Refresh token has been revoked');
  }

  // 3. Rotate: revoke old refresh token
  await refreshTokenStore.revoke(userId, req.refreshToken);

  // 4. Get user
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new AuthError('NOT_FOUND', 'User not found');
  }

  // 5. Issue new token pair
  const tokens = generateTokenPair(user);
  await refreshTokenStore.save(user.id, tokens.refreshToken);

  return tokens;
}
```

### Logout

```ts
// POST /api/v1/auth/logout
async function logout(userId: string, refreshToken?: string) {
  if (refreshToken) {
    // Revoke specific refresh token
    await refreshTokenStore.revoke(userId, refreshToken);
  } else {
    // Revoke all refresh tokens (logout everywhere)
    await refreshTokenStore.revokeAll(userId);
  }
}
```

### Refresh Token Store

```ts
// Store refresh tokens in DB for revocation capability
interface RefreshTokenStore {
  save(userId: string, token: string): Promise<void>;
  find(userId: string, token: string): Promise<boolean>;
  revoke(userId: string, token: string): Promise<void>;
  revokeAll(userId: string): Promise<void>;
  cleanExpired(): Promise<number>;
}

// PostgreSQL implementation
class PostgresRefreshTokenStore implements RefreshTokenStore {
  constructor(private db: Database) {}

  async save(userId: string, token: string): Promise<void> {
    const hash = await hashToken(token);
    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [userId, hash]
    );
  }

  async find(userId: string, token: string): Promise<boolean> {
    const hash = await hashToken(token);
    const row = await this.db.query(
      `SELECT 1 FROM refresh_tokens
       WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW() AND revoked = false`,
      [userId, hash]
    );
    return !!row;
  }

  async revoke(userId: string, token: string): Promise<void> {
    const hash = await hashToken(token);
    await this.db.query(
      `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND token_hash = $2`,
      [userId, hash]
    );
  }

  async revokeAll(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`,
      [userId]
    );
  }

  async cleanExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = true`
    );
    return result.rowCount;
  }
}

// Hash the token before storing — never store plaintext tokens
async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}
```

## Auth Middleware

### Bearer Token Extraction

```ts
function extractBearerToken(authHeader: string | undefined): string {
  if (!authHeader) {
    throw new AuthError('UNAUTHORIZED', 'Authorization header required');
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthError('UNAUTHORIZED', 'Invalid authorization header format');
  }
  if (!parts[1]) {
    throw new AuthError('UNAUTHORIZED', 'Token is empty');
  }
  return parts[1];
}
```

### Authenticate Middleware

```ts
import type { Request, Response, NextFunction } from 'express';

// Extend request type
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; email: string };
    }
  }
}

function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({
        error: { code: err.code, message: err.message, details: [] }
      });
    }
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication failed', details: [] }
    });
  }
}

// Optional auth — attach user if token present, don't fail if missing
function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
  } catch {
    // No user attached — route handler checks req.user
  }
  next();
}
```

## Authorization

### Role-Based Access Control (RBAC)

```ts
type Role = 'user' | 'editor' | 'admin' | 'superadmin';

const ROLE_HIERARCHY: Record<Role, number> = {
  user: 0,
  editor: 1,
  admin: 2,
  superadmin: 3,
};

// Check minimum role
function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', details: [] }
      });
    }
    if (ROLE_HIERARCHY[req.user.role as Role] < ROLE_HIERARCHY[minRole]) {
      return res.status(403).json({
        error: { code: 'INSUFFICIENT_ROLE', message: `${minRole} role required`, details: [] }
      });
    }
    next();
  };
}

// Usage
app.delete('/api/v1/users/:id', authenticate, requireRole('admin'), deleteUser);
app.get('/api/v1/admin/settings', authenticate, requireRole('superadmin'), getSettings);
```

### Permission-Based (Fine-Grained)

```ts
type Permission =
  | 'users:read' | 'users:write' | 'users:delete'
  | 'posts:read' | 'posts:write' | 'posts:delete' | 'posts:publish'
  | 'settings:read' | 'settings:write';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  user:   ['posts:read', 'posts:write'],
  editor: ['posts:read', 'posts:write', 'posts:delete', 'posts:publish'],
  admin:  ['users:read', 'users:write', 'users:delete', 'posts:read', 'posts:write', 'posts:delete', 'posts:publish', 'settings:read'],
  superadmin: ['users:read', 'users:write', 'users:delete', 'posts:read', 'posts:write', 'posts:delete', 'posts:publish', 'settings:read', 'settings:write'],
};

function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', details: [] }
      });
    }
    const allowed = ROLE_PERMISSIONS[req.user.role as Role] ?? [];
    if (!allowed.includes(permission)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: `Permission '${permission}' required`, details: [] }
      });
    }
    next();
  };
}

// Usage
app.get('/api/v1/users', authenticate, requirePermission('users:read'), listUsers);
app.post('/api/v1/users', authenticate, requirePermission('users:write'), createUser);
app.delete('/api/v1/users/:id', authenticate, requirePermission('users:delete'), deleteUser);
```

### Resource Ownership

```ts
// Only allow access to own resources (unless admin)
function requireOwner(getResourceOwnerId: (req: Request) => Promise<string>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', details: [] }
      });
    }
    // Admins bypass ownership check
    if (ROLE_HIERARCHY[req.user.role as Role] >= ROLE_HIERARCHY.admin) {
      return next();
    }
    const ownerId = await getResourceOwnerId(req);
    if (req.user.id !== ownerId) {
      return res.status(403).json({
        error: { code: 'RESOURCE_OWNERSHIP_REQUIRED', message: 'You do not own this resource', details: [] }
      });
    }
    next();
  };
}

// Usage
app.put('/api/v1/users/:id/profile',
  authenticate,
  requireOwner((req) => req.params.id),
  updateProfile
);

app.delete('/api/v1/posts/:id',
  authenticate,
  requireOwner((req) => getPostAuthorId(req.params.id)),
  deletePost
);
```

## OAuth 2.0

### Authorization Code Flow (Server-Side Apps)

```ts
// Step 1: Redirect user to provider
function getAuthorizationUrl(provider: OAuthProvider, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: provider.clientId,
    redirect_uri: provider.redirectUri,
    scope: provider.scopes.join(' '),
    state,
  });
  return `${provider.authUrl}?${params}`;
}

// Step 2: Handle callback — exchange code for tokens
async function handleOAuthCallback(
  provider: OAuthProvider,
  code: string,
): Promise<{ accessToken: string; refreshToken: string; profile: UserProfile }> {
  // Exchange authorization code for tokens
  const tokenRes = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      redirect_uri: provider.redirectUri,
    }),
  });

  const tokens = await tokenRes.json();

  // Fetch user profile from provider
  const profileRes = await fetch(provider.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const providerProfile = await profileRes.json();

  // Find or create user in your system
  let user = await userRepo.findByProviderId(provider.name, providerProfile.id);
  if (!user) {
    user = await userRepo.createFromOAuth(provider.name, providerProfile);
  }

  // Issue your own tokens
  const appTokens = generateTokenPair(user);
  await refreshTokenStore.save(user.id, appTokens.refreshToken);

  return { ...appTokens, profile: user };
}

// State parameter — prevent CSRF
function generateState(): string {
  return crypto.randomUUID();
}
// Store state in session/cookie, verify on callback
```

### Provider Configs

```ts
interface OAuthProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

const providers: Record<string, OAuthProvider> = {
  google: {
    name: 'google',
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: `${process.env.APP_URL}/api/v1/auth/google/callback`,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
  github: {
    name: 'github',
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    redirectUri: `${process.env.APP_URL}/api/v1/auth/github/callback`,
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['user:email'],
  },
};
```

### Routes

```ts
// Start OAuth flow
app.get('/api/v1/auth/:provider', (req, res) => {
  const provider = providers[req.params.provider];
  if (!provider) return res.status(400).json({ error: { code: 'INVALID_PROVIDER' } });
  const state = generateState();
  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 600000, sameSite: 'lax' });
  res.redirect(getAuthorizationUrl(provider, state));
});

// Handle callback
app.get('/api/v1/auth/:provider/callback', async (req, res) => {
  const provider = providers[req.params.provider];
  const state = req.cookies.oauth_state;
  if (!state || state !== req.query.state) {
    return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'CSRF state mismatch' } });
  }
  res.clearCookie('oauth_state');
  const result = await handleOAuthCallback(provider, req.query.code);
  // Redirect to frontend with tokens
  res.redirect(`/auth/callback?access_token=${result.accessToken}&refresh_token=${result.refreshToken}`);
});
```

## Security Protections

### Rate Limiting on Auth Endpoints

```ts
// Stricter limits for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                    // 10 attempts per window
  keyFn: (req) => req.ip,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,                     // 5 login attempts per 15 min
  keyFn: (req) => `${req.ip}:${req.body?.email}`, // per IP + email
});

app.post('/api/v1/auth/login', loginLimiter, loginHandler);
app.post('/api/v1/auth/register', authLimiter, registerHandler);
app.post('/api/v1/auth/refresh', authLimiter, refreshHandler);
```

### Account Lockout

```ts
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

async function checkLockout(user: User): Promise<void> {
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const remaining = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
    throw new AuthError('ACCOUNT_LOCKED', `Account locked. Try again in ${remaining} minutes`, 423);
  }
}

async function handleFailedLogin(user: User): Promise<void> {
  const attempts = (user.failedLoginAttempts ?? 0) + 1;
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await userRepo.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: new Date(Date.now() + LOCKOUT_DURATION),
    });
  } else {
    await userRepo.update(user.id, { failedLoginAttempts: attempts });
  }
}

async function handleSuccessfulLogin(user: User): Promise<void> {
  await userRepo.update(user.id, { failedLoginAttempts: 0, lockedUntil: null });
}
```

### CSRF Protection

```ts
import { randomBytes } from 'node:crypto';

// Generate CSRF token
function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

// Double-submit cookie pattern
app.get('/api/v1/auth/csrf', (req, res) => {
  const token = generateCsrfToken();
  res.cookie('csrf_token', token, {
    httpOnly: false,   // readable by JS for header submission
    secure: true,
    sameSite: 'strict',
    path: '/api',
  });
  res.json({ csrfToken: token });
});

// Verify CSRF on state-changing requests
function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookieToken = req.cookies.csrf_token;
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || cookieToken !== headerToken) {
    return res.status(403).json({
      error: { code: 'CSRF_FAILED', message: 'CSRF token mismatch', details: [] }
    });
  }
  next();
}
```

### Cookie Security

```ts
// Set tokens in secure cookies (alternative to localStorage)
function setAuthCookies(res: Response, tokens: TokenPair) {
  res.cookie('access_token', tokens.accessToken, {
    httpOnly: true,       // no JS access
    secure: true,         // HTTPS only
    sameSite: 'strict',   // CSRF protection
    path: '/api',
    maxAge: 15 * 60 * 1000,  // 15 min
  });

  res.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/v1/auth/refresh', // only sent to refresh endpoint
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', { path: '/api' });
  res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
}
```

### Security Headers

```ts
// Apply to all responses
function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // modern approach: disable XSS filter
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

app.use(securityHeaders);
```

## Password Reset Flow

```ts
// Step 1: Request reset
// POST /api/v1/auth/forgot-password
async function forgotPassword(email: string) {
  const user = await userRepo.findByEmail(email);
  if (!user) return; // don't reveal whether email exists

  const token = randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(token, 10);
  await passwordResetStore.save(user.id, tokenHash, '15 minutes');

  // Send email with reset link
  const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
  await emailService.sendPasswordReset(user.email, resetUrl);
}

// Step 2: Verify and reset
// POST /api/v1/auth/reset-password
async function resetPassword(token: string, newPassword: string) {
  const errors = validatePassword(newPassword);
  if (errors.length > 0) {
    throw new AuthError('VALIDATION_ERROR', errors.join(', '), 400);
  }

  const reset = await passwordResetStore.findValid(token);
  if (!reset) {
    throw new AuthError('TOKEN_INVALID', 'Invalid or expired reset token');
  }

  const hashedPassword = await hashPassword(newPassword);
  await userRepo.updatePassword(reset.userId, hashedPassword);
  await passwordResetStore.markUsed(reset.id);
  await refreshTokenStore.revokeAll(reset.userId); // logout everywhere
}
```

## Email Verification

```ts
// After registration, send verification email
async function sendVerificationEmail(userId: string, email: string) {
  const token = randomBytes(32).toString('hex');
  await verificationStore.save(userId, token, '24 hours');
  const url = `${process.env.APP_URL}/verify-email?token=${token}`;
  await emailService.sendVerification(email, url);
}

// Verify email
async function verifyEmail(token: string) {
  const record = await verificationStore.findValid(token);
  if (!record) throw new AuthError('TOKEN_INVALID', 'Invalid or expired verification token');
  await userRepo.updateEmailVerified(record.userId, true);
  await verificationStore.markUsed(record.id);
}
```

## Session vs JWT Decision

```
                        Sessions             JWT
────────────────────────────────────────────────────────
Server state            Yes (store)          No (stateless)
Scalability             Needs shared store   Any server verifies
Revoke immediately      Yes (delete session) No (until expiry)
Token size              Small (session ID)   Larger (payload + sig)
Mobile friendly         No (cookies)         Yes (bearer token)
Logout everywhere       Easy                 Need token store
CSRF vulnerability      Yes (need CSRF token) No (bearer header)
DB lookup per request   Yes                  No (verify signature)

Recommendation:
- Server-rendered apps → Sessions + cookies
- SPAs / mobile / APIs → JWT + refresh tokens
- High-security (banking) → Sessions (immediate revocation)
- Microservices → JWT (stateless verification)
```

## Code Style Rules

- Always hash passwords with bcrypt (cost 10-12) or argon2. Never store plaintext.
- Use generic error messages on login failure ("Invalid email or password"). Never reveal which field is wrong.
- Short-lived access tokens (15 min) + long-lived refresh tokens (7 days) with rotation.
- Store refresh token hashes in DB, not plaintext. Revoke on logout.
- Rate limit auth endpoints aggressively: 5-10 attempts per 15 minutes per IP+email.
- Use HTTPS everywhere. Set `Secure` flag on all cookies.
- Set `HttpOnly`, `Secure`, `SameSite=Strict` on auth cookies.
- Validate `state` parameter in OAuth flows to prevent CSRF.
- Never expose JWT secret in client-side code or URL parameters.
- Implement account lockout after N failed login attempts.
- Send password reset tokens to email — never return them in API responses.
- Verify email before granting full access to reduce spam accounts.
- Apply security headers globally (HSTS, X-Frame-Options, CSP, etc.).
- Log auth events (login, logout, password change, failed attempts) with IP and user agent.
- Use `timingSafeEqual` for comparing tokens to prevent timing attacks.
