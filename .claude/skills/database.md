---
name: database
description: Database design, SQL, query optimization, schema migrations, indexing strategies, ACID transactions, connection pooling, ORMs, and data modeling patterns
---

# Database

## SQL

### Query Fundamentals

```sql
-- SELECT with all clauses in order
SELECT
    u.id,
    u.name,
    COUNT(o.id) AS order_count,
    SUM(o.total) AS total_spent
FROM users u
INNER JOIN orders o ON o.user_id = u.id
WHERE u.active = true
    AND o.created_at >= '2025-01-01'
    AND u.region IN ('NA', 'EU')
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 5
ORDER BY total_spent DESC
LIMIT 50 OFFSET 0;
```

### Subqueries vs CTEs

```sql
-- Prefer CTEs over subqueries for readability
WITH active_users AS (
    SELECT id, name, region
    FROM users
    WHERE active = true
        AND last_login_at > NOW() - INTERVAL '30 days'
),
user_stats AS (
    SELECT
        au.id,
        au.name,
        COUNT(o.id) AS order_count,
        COALESCE(SUM(o.total), 0) AS total_spent
    FROM active_users au
    LEFT JOIN orders o ON o.user_id = au.id
    GROUP BY au.id, au.name
)
SELECT * FROM user_stats
WHERE order_count > 0
ORDER BY total_spent DESC;

-- Recursive CTE for hierarchical data
WITH RECURSIVE category_tree AS (
    SELECT id, name, parent_id, 0 AS depth
    FROM categories
    WHERE parent_id IS NULL

    UNION ALL

    SELECT c.id, c.name, c.parent_id, ct.depth + 1
    FROM categories c
    INNER JOIN category_tree ct ON ct.id = c.parent_id
)
SELECT * FROM category_tree ORDER BY depth, name;
```

### Window Functions

```sql
-- ROW_NUMBER, RANK, DENSE_RANK
SELECT
    name,
    department,
    salary,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS row_num,
    RANK() OVER (ORDER BY salary DESC) AS rank,
    DENSE_RANK() OVER (ORDER BY salary DESC) AS dense_rank,
    PERCENT_RANK() OVER (ORDER BY salary) AS pct_rank
FROM employees;

-- Running totals and moving averages
SELECT
    date,
    revenue,
    SUM(revenue) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total,
    AVG(revenue) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS moving_avg_7d,
    LAG(revenue, 1) OVER (ORDER BY date) AS prev_day_revenue,
    LEAD(revenue, 1) OVER (ORDER BY date) AS next_day_revenue
FROM daily_sales;

-- First/last value in partition
SELECT DISTINCT
    department,
    FIRST_VALUE(name) OVER (PARTITION BY department ORDER BY salary DESC) AS highest_paid,
    LAST_VALUE(name) OVER (
        PARTITION BY department ORDER BY salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS lowest_paid
FROM employees;

-- NTH_VALUE and NTILE
SELECT
    name,
    score,
    NTILE(4) OVER (ORDER BY score DESC) AS quartile,
    NTH_VALUE(name, 3) OVER (ORDER BY score DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS third_place
FROM exam_results;
```

### JSON Operations

```sql
-- PostgreSQL JSONB
SELECT
    id,
    data->>'name' AS name,
    data->'address'->>'city' AS city,
    data#>>'{address,zip}' AS zip
FROM events
WHERE data @> '{"type": "purchase"}'::jsonb;

-- Create indexes on JSONB
CREATE INDEX idx_events_data ON events USING GIN (data jsonb_path_ops);

-- JSONB modification
UPDATE users
SET preferences = jsonb_set(preferences, '{theme}', '"dark"')
WHERE id = 1;

UPDATE users
SET preferences = preferences - 'deprecated_key' || '{"new_key": "value"}'::jsonb
WHERE id = 1;
```

## Schema Design

### Normalization (1NF → 3NF)

```
1NF — Atomic values, no repeating groups, primary key
2NF — 1NF + no partial dependencies on composite keys
3NF — 2NF + no transitive dependencies

Denormalize deliberately for read performance.
Normalize by default for write integrity.
```

### Table Design Patterns

```sql
-- Main entity table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'member', 'viewer')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_created_at ON users (created_at DESC);

-- Audit-friendly design: separate soft-delete from active status
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX idx_users_active ON users (id) WHERE deleted_at IS NULL;

-- Junction table for many-to-many
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- Polymorphic association (use with caution)
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    body TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id),
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('post', 'page', 'product')),
    target_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_comments_target ON comments (target_type, target_id);

-- Temporal / versioned table (SCD Type 2)
CREATE TABLE product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMPTZ,
    CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE INDEX idx_product_prices_current ON product_prices (product_id)
    WHERE valid_to IS NULL;

-- Tree / adjacency list
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE (parent_id, name)
);
CREATE INDEX idx_categories_parent ON categories (parent_id);

-- Materialized path for fast tree queries
ALTER TABLE categories ADD COLUMN path TEXT;
CREATE INDEX idx_categories_path ON categories (path text_pattern_ops);
-- path example: '/root/electronics/laptops/'
```

### Enumerated Types

```sql
-- Prefer CHECK constraints over ENUM types for flexibility
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    priority SMALLINT NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 5)
);

-- Use ENUM only when values are truly fixed and rarely change
CREATE TYPE payment_method AS ENUM ('credit_card', 'debit_card', 'bank_transfer', 'cash');
```

## Indexing Strategies

### Index Types and When to Use

```sql
-- B-tree (default) — equality, range, ORDER BY, pattern matching with left-anchored LIKE
CREATE INDEX idx_orders_date ON orders (created_at DESC);

-- Hash — simple equality only (rarely needed, B-tree handles this well)
CREATE INDEX idx_sessions_token ON sessions USING HASH (token);

-- GIN — full-text search, JSONB containment, arrays, trigrams
CREATE INDEX idx_products_search ON products USING GIN (to_tsvector('english', name || ' ' || description));
CREATE INDEX idx_tags_array ON articles USING GIN (tags);

-- GiST — geometric data, range types, full-text search
CREATE INDEX idx_locations_coords ON stores USING GiST (coordinates);

-- BRIN — very large tables with naturally ordered data (time-series)
CREATE INDEX idx_logs_timestamp ON logs USING BRIN (created_at) WITH (pages_per_range = 32);

-- Partial index — index only relevant rows
CREATE INDEX idx_orders_unfulfilled ON orders (created_at DESC)
    WHERE status IN ('pending', 'confirmed');

-- Covering index — include columns to avoid table lookup (INCLUDE)
CREATE INDEX idx_users_email_covering ON users (email) INCLUDE (name, role);

-- Expression index
CREATE INDEX idx_users_email_lower ON users (LOWER(email));

-- Composite index — column order matters (most selective / filtered first)
CREATE INDEX idx_orders_user_status ON orders (user_id, status);
```

### Index Design Rules

```
1. Index columns used in WHERE, JOIN ON, ORDER BY, GROUP BY
2. Put equality columns before range columns in composite indexes
3. Favor highly selective indexes (many distinct values)
4. Avoid indexing columns with low cardinality (boolean, gender)
5. Use partial indexes to reduce size when querying a subset
6. Monitor and remove unused indexes
7. Each index slows writes — index deliberately, not defensively
```

### Check Index Usage

```sql
-- PostgreSQL: find unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- PostgreSQL: EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM orders WHERE user_id = 'abc' AND status = 'pending';

-- Look for:
--   Seq Scan → missing index or index not used
--   Index Scan → index used correctly
--   Bitmap Heap Scan → index used, then heap lookup
--   high cost → needs optimization
```

## Transactions & ACID

### Transaction Patterns

```sql
-- Basic transaction
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

-- Rollback on error
BEGIN;
SAVEPOINT before_insert;
INSERT INTO orders (user_id, total) VALUES (1, 99.99);
-- if error:
ROLLBACK TO SAVEPOINT before_insert;
COMMIT;

-- Serializable isolation for critical operations
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;
```

### Isolation Levels

```
Read Uncommitted — sees uncommitted changes (rarely useful)
Read Committed   — default in PostgreSQL; sees committed changes within statement
Repeatable Read  — snapshot at first read; prevents non-repeatable reads
Serializable     — strictest; prevents phantom reads; may serialize failures

Practical choice:
- Default (Read Committed) for most operations
- Repeatable Read for reports that need consistency across multiple reads
- Serializable only for critical concurrent operations (e.g., balance transfers)
```

### Distributed Transactions (Two-Phase Commit)

```sql
-- PostgreSQL prepared transactions
BEGIN;
UPDATE local_table SET val = 1 WHERE id = 1;
PREPARE TRANSACTION 'txn_001';
-- coordinator confirms all participants ready
COMMIT PREPARED 'txn_001';
-- or: ROLLBACK PREPARED 'txn_001';
```

## Query Optimization

### Common Optimization Techniques

```sql
-- Avoid SELECT * — specify columns
SELECT id, name, email FROM users WHERE active = true;

-- Use LIMIT with ORDER BY for pagination
SELECT id, name FROM users ORDER BY created_at DESC LIMIT 20 OFFSET 40;

-- Prefer EXISTS over IN for subqueries
SELECT u.id, u.name
FROM users u
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id
);

-- Use UNION ALL instead of UNION when duplicates are acceptable
SELECT name, 'employee' AS type FROM employees
UNION ALL
SELECT name, 'contractor' AS type FROM contractors;

-- Batch INSERT instead of row-by-row
INSERT INTO products (name, price) VALUES
    ('Widget A', 9.99),
    ('Widget B', 19.99),
    ('Widget C', 29.99);

-- UPSERT pattern
INSERT INTO products (id, name, price)
VALUES (1, 'Widget', 9.99)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    updated_at = NOW();

-- Cursor-based pagination for large datasets
SELECT id, name, created_at
FROM products
WHERE created_at < '2025-04-01T00:00:00Z'
ORDER BY created_at DESC
LIMIT 20;
```

### N+1 Query Problem

```typescript
// BAD: N+1 queries
const users = await db.query('SELECT id, name FROM users');
for (const user of users) {
    user.orders = await db.query(
        'SELECT id, total FROM orders WHERE user_id = $1',
        [user.id]
    );
}

// GOOD: Single query with JOIN or two batched queries
const users = await db.query(`
    SELECT u.id, u.name, o.id AS order_id, o.total
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.id
    WHERE u.active = true
`);

// GOOD: Two queries + in-memory join (better for large results)
const users = await db.query('SELECT id, name FROM users WHERE active = true');
const userIds = users.map(u => u.id);
const orders = await db.query(
    'SELECT id, user_id, total FROM orders WHERE user_id = ANY($1)',
    [userIds]
);
```

## Connection Pooling

### Pool Configuration

```typescript
import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.DB_HOST,
    port: 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,

    // Pool sizing: connections = ((core_count * 2) + effective_spindle_count)
    max: 20,                 // max connections in pool
    min: 5,                  // min idle connections to maintain
    idleTimeoutMillis: 30000, // close idle connections after 30s
    connectionTimeoutMillis: 5000, // fail fast if no connection available

    // SSL for production
    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true, ca: process.env.DB_CA_CERT }
        : false,
});

// Always use pool.query() or pool.connect() — never new Client()
export async function query(text: string, params: unknown[]) {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
        console.warn(`Slow query (${duration}ms):`, text.slice(0, 100));
    }

    return result;
}

// Transaction helper
export async function withTransaction<T>(
    fn: (client: PoolClient) => Promise<T>
): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    await pool.end();
    process.exit(0);
});
```

## ORMs and Query Builders

### When to Use What

```
Raw SQL        — Complex queries, performance-critical paths, DB-specific features
Query Builder  — Dynamic queries, composable filters, type safety without full ORM
ORM            — CRUD-heavy apps, rapid development, team convention consistency

Prefer query builders (Knex, Kysely) over heavy ORMs for new projects.
Use raw SQL for anything the ORM makes harder, not easier.
```

### Query Builder (Kysely)

```typescript
import { Kysely, sql } from 'kysely';

interface Database {
    users: {
        id: string;
        name: string;
        email: string;
        created_at: Date;
    };
    orders: {
        id: string;
        user_id: string;
        total: number;
        status: string;
        created_at: Date;
    };
}

const db = new Kysely<Database>({ /* dialect config */ });

// Type-safe queries
const users = await db
    .selectFrom('users')
    .select(['id', 'name', 'email'])
    .where('created_at', '>', sql`NOW() - INTERVAL '30 days'`)
    .orderBy('created_at', 'desc')
    .limit(20)
    .execute();

// Joins
const result = await db
    .selectFrom('orders')
    .innerJoin('users', 'users.id', 'orders.user_id')
    .select([
        'orders.id',
        'orders.total',
        'users.name as user_name',
        db.fn.count('orders.id').as('order_count'),
    ])
    .groupBy(['users.id', 'orders.id'])
    .having(db.fn.count('orders.id'), '>', 1)
    .execute();

// Dynamic filters
function buildUserQuery(filters: UserFilters) {
    let query = db.selectFrom('users').selectAll();

    if (filters.role) query = query.where('role', '=', filters.role);
    if (filters.search) {
        query = query.where('name', 'ilike', `%${filters.search}%`);
    }
    if (filters.createdAfter) {
        query = query.where('created_at', '>=', filters.createdAfter);
    }

    return query;
}
```

## Migration Patterns

### Safe Migration Rules

```
ADD column     — Safe. Default: NULL or set default in separate statement.
DROP column    — Deploy code that stops reading it first, then drop in next release.
RENAME column  — Add new column → backfill → swap in code → drop old.
CHANGE type    — Add new column with new type → backfill → swap → drop old.
ADD index      — Use CONCURRENTLY to avoid locking the table.
ADD constraint — Add as NOT VALID, then VALIDATE separately.
```

### Migration Template

```sql
-- Migration: 001_create_users_table
-- Created at: 2025-04-23

-- Up
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX CONCURRENTLY idx_users_email ON users (email);

-- Down
-- DROP TABLE users;
```

### Data Migrations

```sql
-- Backfill in batches to avoid locking
DO $$
DECLARE
    batch_size INT := 1000;
    affected INT := 1;
BEGIN
    WHILE affected > 0 LOOP
        UPDATE products
        SET normalized_name = LOWER(TRIM(name))
        WHERE normalized_name IS NULL
        LIMIT batch_size;

        GET DIAGNOSTICS affected = ROW_COUNT;
        COMMIT;
        PERFORM pg_sleep(0.1); -- pause between batches
    END LOOP;
END $$;
```

## Data Modeling Patterns

### Common Patterns

```sql
-- Soft delete
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
-- Query: SELECT * FROM users WHERE deleted_at IS NULL;

-- Polymorphic — use type discriminator
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EAV (Entity-Attribute-Value) — flexible schema, poor query performance
-- Use JSONB columns instead when possible
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'
);
-- Query: SELECT * FROM products WHERE attributes @> '{"color": "red"}';

-- Time-series partitioning
CREATE TABLE metrics (
    id BIGSERIAL,
    metric_name VARCHAR(100) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (recorded_at);

CREATE TABLE metrics_2025_q1 PARTITION OF metrics
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE metrics_2025_q2 PARTITION OF metrics
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');

-- Optimistic locking
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- UPDATE documents SET title = $1, version = version + 1
--   WHERE id = $2 AND version = $3;
-- If rowcount = 0, someone else modified it — retry or conflict
```

## Backup and Recovery

```bash
# pg_dump single database
pg_dump -Fc -f backup.dump dbname

# pg_dumpall (all databases + roles)
pg_dumpall -f cluster_backup.sql

# Point-in-time recovery (requires WAL archiving)
# postgresql.conf:
#   wal_level = replica
#   archive_mode = on
#   archive_command = 'cp %p /var/lib/postgresql/archive/%f'

# Restore from dump
pg_restore -d dbname backup.dump

# Parallel dump/restore for large databases
pg_dump -j 4 -Fd -f backup_dir/ dbname
pg_restore -j 4 -d dbname backup_dir/
```

## Code Style Rules

- Use parameterized queries always — never interpolate values into SQL strings.
- Specify columns explicitly in SELECT — avoid `SELECT *`.
- Use CTEs for complex queries — prefer readability over micro-optimization.
- Index deliberately — measure before and after with `EXPLAIN ANALYZE`.
- Keep transactions short — acquire late, release early.
- Use connection pooling in all environments, including serverless.
- Use `ON DELETE CASCADE` for dependent records, `SET NULL` for optional associations.
- Default to `TIMESTAMPTZ` over `TIMESTAMP` — always store time in UTC.
- Use `UUID` over auto-increment for public-facing IDs (prevents enumeration).
- Use `CONCURRENTLY` when adding indexes on existing tables in production.
- Always write `up` and `down` migrations — every migration must be reversible.
- Run migrations at deploy time, not at application startup.
- Batch large data changes — never update millions of rows in one transaction.
- Use `LIMIT` with `OFFSET` for small pages; use cursor-based pagination for large datasets.
- Monitor slow queries in production — log anything over a threshold (e.g., 500ms).
