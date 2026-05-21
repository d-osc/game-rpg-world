---
name: versioning-strategy
description: Plan and manage versioning strategies — semantic versioning, API versioning, database migrations, config versioning, changelog automation, release workflows, and backward compatibility.
---

You are an expert in versioning and release management. When the user asks for help with versioning, follow these instructions.

## Semantic Versioning (SemVer)

```
Format: MAJOR.MINOR.PATCH[-PRERELEASE]+BUILD

MAJOR — breaking changes (incompatible API changes)
MINOR — new features (backward compatible)
PATCH — bug fixes (backward compatible)
PRERELEASE — alpha, beta, rc (e.g., -alpha.1, -beta.2, -rc.1)
BUILD — build metadata (e.g., +build.123)

Examples:
1.0.0        → first stable release
1.1.0        → new feature added
1.1.1        → bug fix
2.0.0        → breaking change
2.0.0-alpha.1 → early preview of v2
2.0.0-rc.1    → release candidate

What counts as a breaking change:
- Removing or renaming a public API
- Changing a function signature (params, return type)
- Changing behavior that consumers rely on
- Changing error types or error codes
- Raising minimum runtime version (Node, browser)
- Changing default values consumers depend on
- Removing a config option
- Changing database schema in a way that requires migration

What is NOT a breaking change:
- Adding a new optional parameter
- Adding a new export / function
- Adding a new config option (with sensible default)
- Fixing a bug (even if someone relied on the buggy behavior)
- Improving performance
- Adding a new error case (previously unhandled)
- Internal refactoring with same public behavior
```

### Version Bump Decision Tree

```
Did you change the public API?
├── No → PATCH (bug fix, internal change)
└── Yes
    ├── Added new functionality, backward compatible? → MINOR
    ├── Fixed a bug in public API, backward compatible? → PATCH
    └── Breaking change (removed/changed existing behavior)? → MAJOR

Special cases:
- New package or first stable release → 1.0.0
- 0.x.x → anything can change at any time (no stability guarantee)
- Pre-release → -alpha / -beta / -rc before MAJOR release
```

## API Versioning

### URL Path Versioning (most common)

```ts
// Simple, explicit, easy to understand
GET /api/v1/users
GET /api/v2/users

// Router setup
const v1 = new ServerRouter();
const v2 = new ServerRouter();

v1.get('/users', async (ctx) => {
  ctx.res.json({ users: await getUsersV1() });
});

v2.get('/users', async (ctx) => {
  ctx.res.json({ data: await getUsersV2(), pagination: { ... } });
});

app.use('/api/v1', v1);
app.use('/api/v2', v2);
```

### Header Versioning

```ts
// Cleaner URLs, version in Accept header
GET /api/users
Accept: application/vnd.myapp.v2+json

// Middleware
function versionedApi(versions: Record<number, Handler>): Handler {
  return async (ctx) => {
    const version = extractVersion(ctx.headers.accept);
    const handler = versions[version] ?? versions[1]; // default v1
    return handler(ctx);
  };
}

// Usage
app.get('/api/users', versionedApi({
  1: handleUsersV1,
  2: handleUsersV2,
}));
```

### Query Parameter Versioning

```ts
// Quick to implement, easy to test in browser
GET /api/users?version=2

function apiVersion(defaultVersion = 1) {
  return (ctx, next) => {
    ctx.apiVersion = Number(ctx.query.version) || defaultVersion;
    return next();
  };
}
```

### Versioning Strategy Comparison

```
                        URL Path    Header     Query Param
──────────────────────────────────────────────────────────
Visibility              ●●●●●      ●●         ●●●●
Caching (CDN)           ●●●●●      ●●●●●      ●●●●
Browser friendly        ●●●●●      ●●         ●●●●●
RESTful purity          ●●●        ●●●●●      ●●
Implementation ease     ●●●●●      ●●●        ●●●●●
Routing simplicity      ●●●●●      ●●         ●●●

Recommendation:
- Public APIs → URL path versioning (clearest for consumers)
- Internal APIs → header versioning (cleaner URLs)
- Quick prototypes → query param (fastest to implement)
```

### API Lifecycle Management

```ts
// Version lifecycle: active → deprecated → sunset → removed

const API_VERSIONS = {
  v1: { status: 'deprecated', sunset: '2025-06-01', message: 'Use /api/v2' },
  v2: { status: 'active' },
};

// Deprecation middleware
function deprecationNotice(ctx, next) {
  const version = ctx.path.match(/\/api\/(v\d+)/)?.[1];
  const info = API_VERSIONS[version];
  if (info?.status === 'deprecated') {
    ctx.res.headers.set('Deprecation', 'true');
    ctx.res.headers.set('Sunset', info.sunset);
    ctx.res.headers.set('Link', `</api/v2>; rel="successor-version"`);
    ctx.res.headers.set('Warning', `299 - "${info.message}"`);
  }
  return next();
}

// Version schedule template
/*
Version   Status       Released    Deprecated   Sunset      Removed
v1        deprecated   2024-01     2025-01      2025-06     2025-09
v2        active       2025-01     -            -           -
v3        planned      2025-Q3     -            -           -

Rules:
- Active: fully supported, all features work
- Deprecated: still works, returns deprecation headers, 6-month minimum
- Sunset: still responds, may have reduced functionality, 3-month minimum
- Removed: returns 410 Gone with migration guide link
*/
```

## Database Migrations

### Migration File Naming

```
migrations/
├── 001_create_users.sql
├── 002_create_orders.sql
├── 003_add_email_to_users.sql
├── 004_create_indexes.sql
├── 005_add_status_to_orders.sql
└── 006_rename_user_name_to_full_name.sql

Naming convention:
{sequential_number}_{descriptive_snake_case}.sql

or timestamp-based:
20240115_103000_create_users.sql
20240116_143000_add_email_to_users.sql
```

### Migration Structure

```sql
-- 003_add_email_to_users.sql

-- Up migration (apply)
ALTER TABLE users ADD COLUMN email VARCHAR(255);
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Down migration (rollback)
-- DROP INDEX idx_users_email;
-- ALTER TABLE users DROP COLUMN email;
```

### Migration Patterns

```sql
-- ADD column (safe, non-breaking)
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
-- Default: NULL, always safe to add nullable column

-- ADD column with default (safe)
ALTER TABLE orders ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- ADD NOT NULL column (requires strategy)
-- Step 1: Add nullable
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);
-- Step 2: Backfill data
UPDATE users SET avatar_url = '/default-avatar.png' WHERE avatar_url IS NULL;
-- Step 3: Add NOT NULL constraint (separate migration)
ALTER TABLE users ALTER COLUMN avatar_url SET NOT NULL;

-- RENAME column (multi-step for zero downtime)
-- Step 1: Add new column
ALTER TABLE users ADD COLUMN full_name VARCHAR(200);
-- Step 2: Copy data
UPDATE users SET full_name = name;
-- Step 3: Update app to write to both columns
-- Step 4: Drop old column (after all servers migrated)
ALTER TABLE users DROP COLUMN name;

-- RENAME table (multi-step)
-- Step 1: Create view with old name
CREATE VIEW users_old AS SELECT * FROM people;
-- Step 2: Update app to use new name
-- Step 3: Drop view
DROP VIEW users_old;

-- REMOVE column (multi-step)
-- Step 1: Stop reading from column in app code
-- Step 2: Deploy code that no longer references column
-- Step 3: Drop column (separate migration after deploy)
ALTER TABLE users DROP COLUMN deprecated_field;

-- CHANGE column type (multi-step)
-- Step 1: Add new column with new type
ALTER TABLE orders ADD COLUMN total_new DECIMAL(12, 2);
-- Step 2: Migrate data
UPDATE orders SET total_new = total_old::numeric;
-- Step 3: Swap columns in app
-- Step 4: Drop old, rename new
ALTER TABLE orders DROP COLUMN total_old;
ALTER TABLE orders RENAME COLUMN total_new TO total;
```

### Migration Tracker

```sql
-- Track applied migrations
CREATE TABLE schema_migrations (
  version     VARCHAR(255) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  applied_at  TIMESTAMPTZ DEFAULT NOW(),
  checksum    VARCHAR(64),        -- detect drift
  execution_ms INTEGER           -- performance tracking
);
```

### Migration Runner

```ts
interface Migration {
  version: string;
  name: string;
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
}

class MigrationRunner {
  constructor(private db: Database) {}

  async pending(): Promise<Migration[]> {
    const applied = await this.db.query('SELECT version FROM schema_migrations');
    const appliedSet = new Set(applied.map(r => r.version));
    return allMigrations.filter(m => !appliedSet.has(m.version));
  }

  async up(): Promise<string[]> {
    const pending = await this.pending();
    const applied: string[] = [];
    for (const migration of pending) {
      await this.db.transaction(async (tx) => {
        await migration.up(tx);
        await tx.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name]
        );
      });
      applied.push(migration.version);
    }
    return applied;
  }

  async down(steps = 1): Promise<string[]> {
    const applied = await this.db.query(
      'SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT $1',
      [steps]
    );
    const rolled: string[] = [];
    for (const { version } of applied) {
      const migration = allMigrations.find(m => m.version === version);
      if (!migration) throw new Error(`Migration ${version} not found`);
      await this.db.transaction(async (tx) => {
        await migration.down(tx);
        await tx.query('DELETE FROM schema_migrations WHERE version = $1', [version]);
      });
      rolled.push(version);
    }
    return rolled;
  }
}
```

## Config Versioning

```ts
// Version your config schema to handle evolution
interface AppConfigV1 {
  version: 1;
  port: number;
  database: string;
}

interface AppConfigV2 {
  version: 2;
  port: number;
  database: { url: string; pool: number };  // nested database config
  cache?: { url: string; ttl: number };     // new: optional cache
}

interface AppConfigV3 {
  version: 3;
  port: number;
  database: { url: string; pool: number; ssl: boolean };  // new: ssl option
  cache: { url: string; ttl: number };                    // now required
  rateLimit: { window: number; max: number };             // new: rate limiting
}

type AppConfig = AppConfigV1 | AppConfigV2 | AppConfigV3;

// Migration chain: always migrate from any older version to current
function migrateConfig(config: AppConfig): AppConfigV3 {
  // v1 → v2
  if (config.version === 1) {
    config = {
      version: 2,
      port: config.port,
      database: { url: config.database, pool: 10 },
    };
  }

  // v2 → v3
  if (config.version === 2) {
    config = {
      version: 3,
      port: config.port,
      database: { ...config.database, ssl: false },
      cache: config.cache ?? { url: 'redis://localhost:6379', ttl: 300 },
      rateLimit: { window: 60, max: 100 },
    };
  }

  return config;
}
```

## Package Versioning

### package.json Exports

```json
{
  "name": "my-lib",
  "version": "2.3.1",
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./server": {
      "types": "./dist/server/index.d.ts",
      "import": "./dist/server/index.mjs",
      "require": "./dist/server/index.cjs"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Peer Dependencies Versioning

```json
{
  "peerDependencies": {
    "react": ">=18.0.0",
    "typescript": ">=5.0.0"
  },
  "peerDependenciesMeta": {
    "typescript": { "optional": true }
  }
}

// Ranges:
"react": "18.0.0"       → exact version
"react": "^18.0.0"      → >=18.0.0, <19.0.0 (compatible)
"react": "~18.2.0"      → >=18.2.0, <18.3.0 (patch-level)
"react": ">=18.0.0"     → any 18+
"react": ">=18.0.0 <19" → any 18.x
```

## Changelog

### Keep a Changelog Format

```markdown
# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [2.3.1] - 2024-03-15

### Fixed
- Crash when email contains unicode characters
- Memory leak in long-running WebSocket connections

## [2.3.0] - 2024-03-10

### Added
- `createSharedState()` for server-client state sync
- WebSocket endpoint configuration in `elit.config.ts`
- Dark mode support via `prefers-color-scheme`

### Changed
- `render()` now accepts `#selector` in addition to element id string
- Updated `ServerRouter` to support Express-style `(req, res)` handlers

### Deprecated
- `createStore()` → use `createState()` instead (removed in 3.0)

### Removed
- Dropped Node 16 support (minimum is now Node 18)

### Security
- Patched XSS vulnerability in `renderToString()` with unescaped input

## [2.2.0] - 2024-02-01
...
```

### CHANGELOG Categories

```
Added:      new features
Changed:    changes to existing functionality
Deprecated: features to be removed in future releases
Removed:    features removed in this release
Fixed:      bug fixes
Security:   vulnerability fixes
```

### Auto-generate from Conventional Commits

```
# Commit message format
type(scope): description [breaking]

Types:
feat:     new feature          → MINOR
fix:      bug fix              → PATCH
docs:     documentation
style:    formatting
refactor: code restructure
perf:     performance
test:     adding tests
chore:    build/tooling
ci:       CI changes

Breaking changes:
feat!: new API that replaces old one       → MAJOR
feat(api)!: changed response format        → MAJOR
feat: new endpoint (#123)

BREAKING CHANGE: the response format of /api/users has changed from
{ users: [] } to { data: [], pagination: {} }. See migration guide.

# Examples
feat(auth): add OAuth2 support
fix(cache): prevent stale data on concurrent writes
feat(api)!: change user response shape
docs: update API versioning guide
chore: bump dependencies
```

## Release Workflow

### Branch Strategy

```
main (stable, always deployable)
├── develop (integration branch)
│   ├── feature/auth-v2        → merged when ready
│   ├── feature/new-api        → merged when ready
│   └── fix/login-bug          → merged when ready
├── release/2.3.0              → cut from develop, only bug fixes
└── hotfix/2.2.1               → cut from main, critical fix

Flow:
1. Feature branches merge into develop
2. When ready, cut release/X.Y.Z from develop
3. Bug fixes go to release branch (cherry-picked to develop)
4. Release branch merges to main AND develop
5. Tag main with version: v2.3.0
6. Hotfix: cut from main → merge to main AND develop

For small teams / simpler flow:
main → all PRs go here
  - Use feature flags instead of long-lived branches
  - Tag releases: v1.0.0, v1.1.0
  - Hotfix: commit to main, tag v1.1.1
```

### Release Checklist

```
Pre-release:
[ ] All tests pass on CI
[ ] CHANGELOG.md updated with all changes
[ ] package.json version bumped
[ ] Breaking changes documented with migration guide
[ ] API deprecation headers set for sunset versions
[ ] Database migrations tested (up and down)
[ ] Documentation updated for new features
[ ] Dependencies audited for vulnerabilities

Release:
[ ] Create release branch or tag
[ ] Run full test suite (unit + integration + e2e)
[ ] Build production bundle
[ ] Deploy to staging → smoke test
[ ] Deploy to production
[ ] Create git tag: v2.3.0
[ ] Create GitHub release with changelog
[ ] Publish to npm (if library)
[ ] Announce release

Post-release:
[ ] Monitor error rates and performance
[ ] Verify deployment health
[ ] Update internal docs
[ ] Close completed milestone
```

### Git Tagging

```bash
# Annotated tag (recommended — includes message and author)
git tag -a v2.3.0 -m "Release v2.3.0: OAuth2 support, performance improvements"

# Lightweight tag (just a pointer)
git tag v2.3.0

# Push tags
git push origin v2.3.0
git push origin --tags  # push all tags

# List tags
git tag -l "v2.*"

# Checkout specific version
git checkout v2.3.0
```

## Backward Compatibility

### Safe Evolution Rules

```ts
// RULE 1: Add optional parameters (safe)
// Before
function search(query: string): Result[]
// After
function search(query: string, options?: { limit?: number }): Result[]

// RULE 2: Add new fields to response (safe)
// Before
type User = { id: string; name: string }
// After
type User = { id: string; name: string; avatarUrl?: string }

// RULE 3: Add new enum values (safe if clients handle unknown)
// Before
type Status = 'active' | 'inactive'
// After
type Status = 'active' | 'inactive' | 'suspended'

// RULE 4: Broaden accepted types (safe)
// Before
function setAge(age: number): void
// After
function setAge(age: number | string): void  // accepts both

// RULE 5: Relax constraints (safe)
// Before
function createUser(name: string, email: string): User  // both required
// After
function createUser(name: string, email?: string): User  // email optional
```

### Unsafe Changes (Require MAJOR bump)

```ts
// DANGEROUS: Remove or rename a parameter
// Before
function search(query: string, limit: number): Result[]
// After
function search(query: string, maxResults: number): Result[]  // RENAMED

// DANGEROUS: Change return type
// Before
function getUser(id: string): User
// After
function getUser(id: string): Promise<User>  // now async

// DANGEROUS: Tighten constraints
// Before
function setName(name: string): void   // accepts any string
// After
function setName(name: string): void   // now throws if empty

// DANGEROUS: Change error type
// Before
throw new Error('Not found')
// After
throw new NotFoundError('User not found')  // different class

// DANGEROUS: Remove a field from response
// Before
type User = { id: string; name: string; email: string }
// After
type User = { id: string; name: string }  // email removed
```

### Deprecation Pattern

```ts
// Step 1: Mark deprecated, add alternative
/**
 * @deprecated Use `search(query, options)` instead. Will be removed in v3.0.
 */
function searchAll(query: string): Result[] {
  return search(query, { limit: Infinity });
}

function search(query: string, options?: { limit?: number }): Result[] {
  // new implementation
}

// Step 2: Runtime warning
function searchAll(query: string): Result[] {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('searchAll() is deprecated. Use search() instead.');
  }
  return search(query, { limit: Infinity });
}

// Step 3: Keep working for at least one MAJOR version
// Step 4: Remove in next MAJOR version
```

## Versioning for Different Artifacts

```
Artifact              Version Strategy         Where
──────────────────────────────────────────────────────────
Library/package       SemVer (package.json)     npm registry
API                   URL path + SemVer         /api/v1, /api/v2
Database schema       Sequential migrations     schema_migrations table
Config file           Embedded version field     version: 3
Docker image          Tag from git tag           myapp:v2.3.0
Documentation         Git branch/tag             docs-v2
Mobile app            SemVer + build number      2.3.0 (build 42)
Browser extension     SemVer + auto-update       manifest.json
WAPK archive          SemVer in wapk config      wapk.version
```

## Code Style Rules

- Follow SemVer strictly. Consumers depend on version numbers to gauge risk.
- Document every breaking change with a migration guide in CHANGELOG.
- Use conventional commits for automated changelog and version bumping.
- Deprecate before removing. Keep deprecated APIs working for at least one MAJOR version.
- Version your database schema separately from app code. Migrations are irreversible in production.
- Version your config file schema. Add a `version` field and migrate forward.
- Add NOT NULL columns in steps: nullable → backfill → NOT NULL constraint.
- Rename columns in steps: add new → copy data → migrate reads → migrate writes → drop old.
- Never modify a released migration. Write a new one to fix it.
- Tag every release in git. Annotated tags with changelog summary.
- Use `exports` map in package.json for explicit public API surface.
- Set deprecation headers on API routes before removing them.
- Test migrations both ways: UP and DOWN. Down must be reliable.
- Pin dependency versions in production. Use lockfiles.
- Breaking changes go in MAJOR releases. Group breaking changes to reduce MAJOR frequency.
