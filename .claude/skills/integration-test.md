---
name: integration-test
description: Integration testing with Vitest and Supertest — API endpoint testing, database integration, Redis integration, service layer testing, middleware testing, test database management, transaction rollback patterns, fixture seeding, and integration test best practices
---

# Integration Test (API, Database, Services)

## Test Database Setup

### Separate Test Database

```typescript
// src/test/db.ts
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from '../types/database';

export function createTestDb(): Kysely<Database> {
    return new Kysely<Database>({
        dialect: new PostgresDialect({
            pool: new Pool({
                host: process.env.DB_HOST ?? 'localhost',
                port: Number(process.env.DB_PORT ?? 5432),
                database: process.env.DB_NAME ?? 'quotation_test',
                user: process.env.DB_USER ?? 'test',
                password: process.env.DB_PASSWORD ?? 'test',
                max: 5,
            }),
        }),
    });
}

export async function migrateTestDb(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable('users')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('gen_random_uuid')))
        .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
        .addColumn('name', 'varchar(255)', (col) => col.notNull())
        .addColumn('password', 'varchar(255)', (col) => col.notNull())
        .addColumn('role', 'varchar(50)', (col) => col.notNull().defaultTo('user'))
        .addColumn('active', 'boolean', (col) => col.notNull().defaultTo(true))
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
        .execute();

    await db.schema
        .createTable('quotations')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('gen_random_uuid')))
        .addColumn('user_id', 'uuid', (col) => col.references('users.id').notNull())
        .addColumn('customer_name', 'varchar(255)', (col) => col.notNull())
        .addColumn('customer_email', 'varchar(255)')
        .addColumn('subtotal', 'decimal(12,2)', (col) => col.notNull())
        .addColumn('tax', 'decimal(12,2)', (col) => col.notNull())
        .addColumn('total', 'decimal(12,2)', (col) => col.notNull())
        .addColumn('status', 'varchar(50)', (col) => col.notNull().defaultTo('draft'))
        .addColumn('valid_until', 'timestamptz')
        .addColumn('notes', 'text')
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
        .execute();

    await db.schema
        .createTable('quotation_items')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('gen_random_uuid')))
        .addColumn('quotation_id', 'uuid', (col) => col.references('quotations.id').onDelete('cascade').notNull())
        .addColumn('name', 'varchar(255)', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('price', 'decimal(12,2)', (col) => col.notNull())
        .addColumn('quantity', 'integer', (col) => col.notNull())
        .addColumn('sort_order', 'integer', (col) => col.notNull().defaultTo(0))
        .execute();
}

export async function dropTestDb(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable('quotation_items').ifExists().execute();
    await db.schema.dropTable('quotations').ifExists().execute();
    await db.schema.dropTable('users').ifExists().execute();
}

// Clean all rows — faster than drop + recreate
export async function cleanTables(db: Kysely<Database>): Promise<void> {
    await db.deleteFrom('quotation_items').execute();
    await db.deleteFrom('quotations').execute();
    await db.deleteFrom('users').execute();
}
```

### Vitest Global Setup

```typescript
// src/test/global-setup.ts
import { createTestDb, migrateTestDb, dropTestDb } from './db';

let testDb: Kysely<Database>;

export async function setup() {
    testDb = createTestDb();
    await dropTestDb(testDb);     // clean slate
    await migrateTestDb(testDb);  // create tables
    return testDb;
}

export async function teardown() {
    await dropTestDb(testDb);
    await testDb.destroy();
}
```

```typescript
// vitest.config.ts — integration test config
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.integration.test.ts'],
        setupFiles: ['src/test/integration-setup.ts'],
        testTimeout: 30_000,
        hookTimeout: 60_000,
        // Run integration tests sequentially (DB state)
        pool: 'forks',
        poolOptions: { forks: { singleFork: true } },
    },
});
```

```typescript
// src/test/integration-setup.ts
import { beforeAll, afterAll, afterEach } from 'vitest';
import { createTestDb, migrateTestDb, cleanTables } from './db';
import { db } from '../database';

let testDb: Kysely<Database>;

beforeAll(async () => {
    testDb = createTestDb();
    await migrateTestDb(testDb);
});

afterEach(async () => {
    await cleanTables(testDb);
});

afterAll(async () => {
    await testDb.destroy();
});
```

## API Endpoint Testing

### App Factory

```typescript
// src/app.ts
import express from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { quotationRoutes } from './routes/quotations';
import { authRoutes } from './routes/auth';

export function createApp() {
    const app = express();

    app.use(cors());
    app.use(express.json());

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/quotations', authMiddleware, quotationRoutes);

    // Health check
    app.get('/health', (_req, res) => {
        res.json({ status: 'healthy' });
    });

    // Error handler — must be last
    app.use(errorHandler);

    return app;
}
```

### Full CRUD Tests

```typescript
// src/routes/quotations.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { createTestDb, migrateTestDb, cleanTables, dropTestDb } from '../test/db';
import { hashPassword } from '../services/auth';
import { createAccessToken } from '../services/jwt';

describe('Quotations API (Integration)', () => {
    const app = createApp();
    let db: Kysely<Database>;
    let authToken: string;
    let userId: string;

    beforeAll(async () => {
        db = createTestDb();
        await migrateTestDb(db);
    });

    afterAll(async () => {
        await dropTestDb(db);
        await db.destroy();
    });

    beforeEach(async () => {
        await cleanTables(db);

        // Seed test user
        const [user] = await db.insertInto('users')
            .values({
                email: 'test@example.com',
                name: 'Test User',
                password: await hashPassword('password123'),
                role: 'admin',
            })
            .returningAll()
            .execute();

        userId = user.id;
        authToken = createAccessToken({ id: user.id, email: user.email, role: user.role });
    });

    // --- POST /api/quotations ---
    describe('POST /api/quotations', () => {
        const validPayload = {
            customerName: 'Acme Corp',
            customerEmail: 'billing@acme.com',
            items: [
                { name: 'Web Development', price: 50000, quantity: 1 },
                { name: 'UI Design', price: 30000, quantity: 2 },
            ],
            taxRate: 0.07,
            validUntil: '2030-12-31',
            notes: 'Thank you for your business',
        };

        it('creates quotation with calculated totals', async () => {
            const res = await request(app)
                .post('/api/quotations')
                .set('Authorization', `Bearer ${authToken}`)
                .send(validPayload)
                .expect(201);

            expect(res.body).toMatchObject({
                id: expect.any(String),
                customerName: 'Acme Corp',
                subtotal: 110000,   // 50000 + 30000*2
                tax: 7700,          // 110000 * 0.07
                total: 117700,      // 110000 + 7700
                status: 'draft',
                items: expect.arrayContaining([
                    expect.objectContaining({ name: 'Web Development', price: 50000 }),
                    expect.objectContaining({ name: 'UI Design', price: 30000, quantity: 2 }),
                ]),
            });

            // Verify persisted in database
            const rows = await db.selectFrom('quotations').selectAll().execute();
            expect(rows).toHaveLength(1);
            expect(Number(rows[0].total)).toBe(117700);
        });

        it('returns 400 for missing customer name', async () => {
            const res = await request(app)
                .post('/api/quotations')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ ...validPayload, customerName: '' })
                .expect(400);

            expect(res.body.error).toBeDefined();
        });

        it('returns 400 for empty items', async () => {
            const res = await request(app)
                .post('/api/quotations')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ ...validPayload, items: [] })
                .expect(400);

            expect(res.body.error).toMatch(/item/i);
        });

        it('returns 400 for negative price', async () => {
            const res = await request(app)
                .post('/api/quotations')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    ...validPayload,
                    items: [{ name: 'Bad', price: -100, quantity: 1 }],
                })
                .expect(400);
        });

        it('returns 401 without auth token', async () => {
            await request(app)
                .post('/api/quotations')
                .send(validPayload)
                .expect(401);
        });

        it('returns 401 with expired token', async () => {
            const expiredToken = createAccessToken(
                { id: userId, email: 'test@example.com', role: 'admin' },
                { expiresIn: '0s' },
            );

            await request(app)
                .post('/api/quotations')
                .set('Authorization', `Bearer ${expiredToken}`)
                .send(validPayload)
                .expect(401);
        });
    });

    // --- GET /api/quotations ---
    describe('GET /api/quotations', () => {
        it('returns paginated quotations', async () => {
            // Seed 15 quotations
            for (let i = 0; i < 15; i++) {
                await db.insertInto('quotations').values({
                    userId,
                    customerName: `Customer ${i}`,
                    subtotal: 1000,
                    tax: 70,
                    total: 1070,
                    status: 'draft',
                }).execute();
            }

            const res = await request(app)
                .get('/api/quotations?page=1&limit=10')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.data).toHaveLength(10);
            expect(res.body.pagination).toMatchObject({
                page: 1,
                limit: 10,
                total: 15,
                totalPages: 2,
            });
        });

        it('filters by status', async () => {
            await db.insertInto('quotations').values({
                userId, customerName: 'A', subtotal: 1000, tax: 70, total: 1070, status: 'draft',
            }).execute();
            await db.insertInto('quotations').values({
                userId, customerName: 'B', subtotal: 2000, tax: 140, total: 2140, status: 'sent',
            }).execute();

            const res = await request(app)
                .get('/api/quotations?status=sent')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].status).toBe('sent');
        });

        it('searches by customer name', async () => {
            await db.insertInto('quotations').values([
                { userId, customerName: 'Acme Corp', subtotal: 1000, tax: 70, total: 1070, status: 'draft' },
                { userId, customerName: 'Beta Inc', subtotal: 2000, tax: 140, total: 2140, status: 'draft' },
                { userId, customerName: 'Acme Ltd', subtotal: 3000, tax: 210, total: 3210, status: 'draft' },
            ]).execute();

            const res = await request(app)
                .get('/api/quotations?search=acme')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.data).toHaveLength(2);
        });

        it('sorts by created_at descending by default', async () => {
            await db.insertInto('quotations').values([
                { userId, customerName: 'First', subtotal: 100, tax: 7, total: 107, status: 'draft', createdAt: new Date('2026-01-01') },
                { userId, customerName: 'Second', subtotal: 200, tax: 14, total: 214, status: 'draft', createdAt: new Date('2026-02-01') },
            ]).execute();

            const res = await request(app)
                .get('/api/quotations')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.data[0].customerName).toBe('Second');
        });
    });

    // --- GET /api/quotations/:id ---
    describe('GET /api/quotations/:id', () => {
        it('returns quotation with items', async () => {
            const [quotation] = await db.insertInto('quotations').values({
                userId, customerName: 'Acme Corp', subtotal: 5000, tax: 350, total: 5350,
                status: 'draft', customerEmail: 'billing@acme.com',
            }).returningAll().execute();

            await db.insertInto('quotation_items').values([
                { quotationId: quotation.id, name: 'Service A', price: 3000, quantity: 1, sortOrder: 0 },
                { quotationId: quotation.id, name: 'Service B', price: 1000, quantity: 2, sortOrder: 1 },
            ]).execute();

            const res = await request(app)
                .get(`/api/quotations/${quotation.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toMatchObject({
                id: quotation.id,
                customerName: 'Acme Corp',
                items: expect.arrayContaining([
                    expect.objectContaining({ name: 'Service A', quantity: 1 }),
                    expect.objectContaining({ name: 'Service B', quantity: 2 }),
                ]),
            });
        });

        it('returns 404 for non-existent id', async () => {
            await request(app)
                .get('/api/quotations/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });
    });

    // --- PUT /api/quotations/:id ---
    describe('PUT /api/quotations/:id', () => {
        it('updates draft quotation and recalculates totals', async () => {
            const [quotation] = await db.insertInto('quotations').values({
                userId, customerName: 'Acme Corp', subtotal: 1000, tax: 70, total: 1070, status: 'draft',
            }).returningAll().execute();

            await db.insertInto('quotation_items').values({
                quotationId: quotation.id, name: 'Old Item', price: 1000, quantity: 1, sortOrder: 0,
            }).execute();

            const res = await request(app)
                .put(`/api/quotations/${quotation.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    customerName: 'Acme Corp Updated',
                    items: [
                        { name: 'New Item A', price: 2000, quantity: 3 },
                        { name: 'New Item B', price: 500, quantity: 2 },
                    ],
                    taxRate: 0.07,
                })
                .expect(200);

            expect(res.body.customerName).toBe('Acme Corp Updated');
            expect(res.body.subtotal).toBe(7000);
            expect(res.body.total).toBe(7490);
        });

        it('rejects update on sent quotation', async () => {
            const [quotation] = await db.insertInto('quotations').values({
                userId, customerName: 'Acme', subtotal: 1000, tax: 70, total: 1070, status: 'sent',
            }).returningAll().execute();

            await request(app)
                .put(`/api/quotations/${quotation.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ customerName: 'Updated' })
                .expect(422);
        });
    });

    // --- DELETE /api/quotations/:id ---
    describe('DELETE /api/quotations/:id', () => {
        it('deletes draft quotation and its items', async () => {
            const [quotation] = await db.insertInto('quotations').values({
                userId, customerName: 'Delete Me', subtotal: 100, tax: 7, total: 107, status: 'draft',
            }).returningAll().execute();

            await db.insertInto('quotation_items').values({
                quotationId: quotation.id, name: 'Item', price: 100, quantity: 1, sortOrder: 0,
            }).execute();

            await request(app)
                .delete(`/api/quotations/${quotation.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(204);

            // Verify deleted from DB
            const quotes = await db.selectFrom('quotations').where('id', '=', quotation.id).execute();
            expect(quotes).toHaveLength(0);

            const items = await db.selectFrom('quotation_items').where('quotation_id', '=', quotation.id).execute();
            expect(items).toHaveLength(0);
        });

        it('cannot delete sent quotation', async () => {
            const [quotation] = await db.insertInto('quotations').values({
                userId, customerName: 'Sent', subtotal: 100, tax: 7, total: 107, status: 'sent',
            }).returningAll().execute();

            await request(app)
                .delete(`/api/quotations/${quotation.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(422);
        });
    });
});
```

## Auth Flow Integration Test

```typescript
// src/routes/auth.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { createTestDb, migrateTestDb, cleanTables, dropTestDb } from '../test/db';

describe('Auth API (Integration)', () => {
    const app = createApp();
    let db: Kysely<Database>;

    beforeAll(async () => {
        db = createTestDb();
        await migrateTestDb(db);
    });

    afterAll(async () => {
        await dropTestDb(db);
        await db.destroy();
    });

    beforeEach(async () => {
        await cleanTables(db);
    });

    describe('POST /api/auth/register', () => {
        it('registers new user and returns tokens', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Alice',
                    email: 'alice@example.com',
                    password: 'SecurePass123!',
                })
                .expect(201);

            expect(res.body).toMatchObject({
                user: { name: 'Alice', email: 'alice@example.com', role: 'user' },
                accessToken: expect.any(String),
                refreshToken: expect.any(String),
            });

            // Verify user in database
            const users = await db.selectFrom('users').where('email', '=', 'alice@example.com').execute();
            expect(users).toHaveLength(1);
            expect(users[0].name).toBe('Alice');
            // Password should be hashed, not plaintext
            expect(users[0].password).not.toBe('SecurePass123!');
        });

        it('rejects duplicate email', async () => {
            await request(app).post('/api/auth/register').send({
                name: 'Alice', email: 'alice@example.com', password: 'Pass123!',
            }).expect(201);

            const res = await request(app).post('/api/auth/register').send({
                name: 'Alice2', email: 'alice@example.com', password: 'Pass456!',
            }).expect(409);

            expect(res.body.error).toMatch(/email.*exist/i);
        });

        it('validates password strength', async () => {
            const res = await request(app).post('/api/auth/register').send({
                name: 'Alice', email: 'alice@example.com', password: 'short',
            }).expect(400);

            expect(res.body.errors).toBeDefined();
        });

        it('validates email format', async () => {
            await request(app).post('/api/auth/register').send({
                name: 'Alice', email: 'not-an-email', password: 'Pass123!',
            }).expect(400);
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            await request(app).post('/api/auth/register').send({
                name: 'Alice', email: 'alice@example.com', password: 'Pass123!',
            });
        });

        it('logs in with correct credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'alice@example.com', password: 'Pass123!' })
                .expect(200);

            expect(res.body.accessToken).toBeDefined();
            expect(res.body.refreshToken).toBeDefined();
        });

        it('rejects wrong password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'alice@example.com', password: 'wrong!' })
                .expect(401);

            expect(res.body.error).toBeDefined();
        });

        it('rejects non-existent email', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({ email: 'nobody@example.com', password: 'Pass123!' })
                .expect(401);
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('rotates refresh token', async () => {
            const registerRes = await request(app).post('/api/auth/register').send({
                name: 'Alice', email: 'alice@example.com', password: 'Pass123!',
            });

            const oldRefresh = registerRes.body.refreshToken;

            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: oldRefresh })
                .expect(200);

            expect(res.body.accessToken).toBeDefined();
            expect(res.body.refreshToken).toBeDefined();
            expect(res.body.refreshToken).not.toBe(oldRefresh);

            // Old refresh token should no longer work
            await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: oldRefresh })
                .expect(401);
        });
    });
});
```

## Middleware Integration Tests

```typescript
// src/middleware/auth.integration.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authMiddleware, optionalAuth } from './auth';
import { createAccessToken } from '../services/jwt';

describe('authMiddleware', () => {
    const app = express();
    app.use(express.json());
    app.get('/protected', authMiddleware, (req: any, res) => {
        res.json({ userId: req.user.id, role: req.user.role });
    });
    app.get('/optional', optionalAuth, (req: any, res) => {
        res.json({ user: req.user ?? null });
    });

    it('allows valid Bearer token', async () => {
        const token = createAccessToken({ id: 'user-1', email: 'a@b.com', role: 'admin' });

        const res = await request(app)
            .get('/protected')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(res.body.userId).toBe('user-1');
        expect(res.body.role).toBe('admin');
    });

    it('rejects missing Authorization header', async () => {
        await request(app).get('/protected').expect(401);
    });

    it('rejects malformed Authorization header', async () => {
        await request(app)
            .get('/protected')
            .set('Authorization', 'Token abc123')
            .expect(401);
    });

    it('rejects expired token', async () => {
        const expired = createAccessToken(
            { id: 'user-1', email: 'a@b.com', role: 'admin' },
            { expiresIn: '0s' },
        );

        // Small delay to ensure token is expired
        await new Promise(r => setTimeout(r, 100));

        await request(app)
            .get('/protected')
            .set('Authorization', `Bearer ${expired}`)
            .expect(401);
    });

    it('optionalAuth sets user if token present', async () => {
        const token = createAccessToken({ id: 'user-1', email: 'a@b.com', role: 'admin' });

        const res = await request(app)
            .get('/optional')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(res.body.user).toMatchObject({ id: 'user-1' });
    });

    it('optionalAuth passes without token', async () => {
        const res = await request(app)
            .get('/optional')
            .expect(200);

        expect(res.body.user).toBeNull();
    });
});
```

## Service Layer Integration Tests

```typescript
// src/services/quotation.service.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, migrateTestDb, cleanTables, dropTestDb } from '../test/db';
import { QuotationService } from './quotation.service';
import { QuotationRepository } from '../repositories/quotation.repository';
import { hashPassword } from './auth';

describe('QuotationService (Integration)', () => {
    let db: Kysely<Database>;
    let repo: QuotationRepository;
    let service: QuotationService;
    let userId: string;

    beforeAll(async () => {
        db = createTestDb();
        await migrateTestDb(db);
        repo = new QuotationRepository(db);
        service = new QuotationService(repo);
    });

    afterAll(async () => {
        await dropTestDb(db);
        await db.destroy();
    });

    beforeEach(async () => {
        await cleanTables(db);

        const [user] = await db.insertInto('users').values({
            email: 'test@example.com',
            name: 'Test',
            password: await hashPassword('pass'),
            role: 'admin',
        }).returningAll().execute();

        userId = user.id;
    });

    describe('createWithItems', () => {
        it('creates quotation and items in single transaction', async () => {
            const result = await service.createWithItems(userId, {
                customerName: 'Acme Corp',
                taxRate: 0.07,
                items: [
                    { name: 'Service A', price: 5000, quantity: 2 },
                    { name: 'Service B', price: 3000, quantity: 1 },
                ],
            });

            expect(result.quotation.subtotal).toBe(13000);
            expect(result.quotation.tax).toBe(910);
            expect(result.quotation.total).toBe(13910);
            expect(result.items).toHaveLength(2);
        });

        it('rolls back all items if one is invalid', async () => {
            await expect(
                service.createWithItems(userId, {
                    customerName: 'Test',
                    taxRate: 0.07,
                    items: [
                        { name: 'Valid', price: 100, quantity: 1 },
                        { name: '', price: -50, quantity: 0 }, // invalid
                    ],
                }),
            ).rejects.toThrow();

            // Verify nothing was created
            const count = await db.selectFrom('quotations').select(db.fn.count('id').as('count')).execute();
            expect(Number(count[0].count)).toBe(0);
        });
    });

    describe('updateStatus', () => {
        it('follows valid status transitions', async () => {
            const { quotation } = await service.createWithItems(userId, {
                customerName: 'Test',
                taxRate: 0.07,
                items: [{ name: 'Item', price: 100, quantity: 1 }],
            });

            // draft → sent
            const sent = await service.updateStatus(quotation.id, 'sent');
            expect(sent.status).toBe('sent');

            // sent → accepted
            const accepted = await service.updateStatus(quotation.id, 'accepted');
            expect(accepted.status).toBe('accepted');
        });

        it('rejects invalid transitions', async () => {
            const { quotation } = await service.createWithItems(userId, {
                customerName: 'Test',
                taxRate: 0.07,
                items: [{ name: 'Item', price: 100, quantity: 1 }],
            });

            // draft → accepted (must go through "sent" first)
            await expect(
                service.updateStatus(quotation.id, 'accepted'),
            ).rejects.toThrow();
        });
    });
});
```

## Redis Integration Tests

```typescript
// src/cache/cache.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import Redis from 'ioredis';
import { CacheService } from './cache-service';

describe('CacheService (Integration)', () => {
    let redis: Redis;
    let cache: CacheService;

    beforeAll(async () => {
        redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379/15'); // use DB 15 for tests
        await redis.flushdb();
        cache = new CacheService(redis);
    });

    afterEach(async () => {
        await redis.flushdb();
    });

    afterAll(async () => {
        await redis.flushdb();
        await redis.quit();
    });

    it('stores and retrieves a value', async () => {
        await cache.set('user:1', { name: 'Alice', role: 'admin' });
        const result = await cache.get('user:1');
        expect(result).toEqual({ name: 'Alice', role: 'admin' });
    });

    it('returns null for non-existent key', async () => {
        const result = await cache.get('non-existent');
        expect(result).toBeNull();
    });

    it('expires after TTL', async () => {
        await cache.set('temp', 'data', 1); // 1 second TTL
        expect(await cache.get('temp')).toBe('data');

        await new Promise(r => setTimeout(r, 1100));
        expect(await cache.get('temp')).toBeNull();
    });

    it('deletes a key', async () => {
        await cache.set('del-me', 'data');
        await cache.delete('del-me');
        expect(await cache.get('del-me')).toBeNull();
    });

    it('invalidates by tag', async () => {
        await cache.set('quote:1', { id: 1 }, { tags: ['quotes', 'user:1'] });
        await cache.set('quote:2', { id: 2 }, { tags: ['quotes', 'user:1'] });
        await cache.set('quote:3', { id: 3 }, { tags: ['quotes', 'user:2'] });

        await cache.invalidateTag('user:1');

        expect(await cache.get('quote:1')).toBeNull();
        expect(await cache.get('quote:2')).toBeNull();
        expect(await cache.get('quote:3')).toEqual({ id: 3 }); // different tag
    });
});
```

## Test Fixtures & Seeders

```typescript
// src/test/fixtures.ts
import type { Kysely } from 'kysely';
import { hashPassword } from '../services/auth';

export async function seedUser(db: Kysely<Database>, overrides: Record<string, unknown> = {}) {
    const defaults = {
        email: `test-${Date.now()}@example.com`,
        name: 'Test User',
        password: await hashPassword('password123'),
        role: 'user',
    };

    const [user] = await db.insertInto('users')
        .values({ ...defaults, ...overrides })
        .returningAll()
        .execute();

    return user;
}

export async function seedQuotation(
    db: Kysely<Database>,
    userId: string,
    overrides: Record<string, unknown> = {},
) {
    const defaults = {
        userId,
        customerName: 'Test Customer',
        subtotal: 1000,
        tax: 70,
        total: 1070,
        status: 'draft',
    };

    const [quotation] = await db.insertInto('quotations')
        .values({ ...defaults, ...overrides })
        .returningAll()
        .execute();

    return quotation;
}

export async function seedQuotationWithItems(
    db: Kysely<Database>,
    userId: string,
    items: { name: string; price: number; quantity: number }[],
    overrides: Record<string, unknown> = {},
) {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const tax = Math.round(subtotal * 0.07 * 100) / 100;

    const [quotation] = await db.insertInto('quotations')
        .values({
            userId,
            customerName: 'Test Customer',
            subtotal,
            tax,
            total: Math.round((subtotal + tax) * 100) / 100,
            status: 'draft',
            ...overrides,
        })
        .returningAll()
        .execute();

    await db.insertInto('quotation_items')
        .values(items.map((item, i) => ({
            quotationId: quotation.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            sortOrder: i,
        })))
        .execute();

    return quotation;
}

// Bulk seeder for pagination / list tests
export async function seedManyQuotations(
    db: Kysely<Database>,
    userId: string,
    count: number,
    overrides: Record<string, unknown> = {},
) {
    const values = Array.from({ length: count }, (_, i) => ({
        userId,
        customerName: `Customer ${i + 1}`,
        subtotal: 1000 * (i + 1),
        tax: 70 * (i + 1),
        total: 1070 * (i + 1),
        status: 'draft',
        ...overrides,
    }));

    return db.insertInto('quotations').values(values).returningAll().execute();
}
```

## Code Style Rules

- Use a dedicated test database — never run integration tests against production or development databases.
- Clean all tables in `beforeEach` — start each test with a known empty state.
- Use `beforeAll` to migrate schema and `afterAll` to tear down — avoid per-test migrations for speed.
- Test the full request-response cycle with Supertest — verify HTTP status, body, headers, and database state.
- Verify database state after mutations — don't trust the response alone; query the DB directly.
- Test error responses as thoroughly as success responses — 400, 401, 403, 404, 409, 422, 500.
- Test authentication and authorization in integration tests — verify tokens work and expired/rejected tokens don't.
- Use seed fixtures for common test data — `seedUser`, `seedQuotation` reduce boilerplate.
- Test pagination with enough seeded data — seed 25+ records, verify page sizes and totals.
- Test database transactions — verify rollbacks when one operation in a batch fails.
- Test status transitions — verify valid paths work and invalid transitions are rejected.
- Run integration tests sequentially (single fork) — avoid database contention between parallel tests.
- Use a separate Redis database (e.g., DB 15) for tests — flush between tests, never conflict with dev.
- Set longer timeouts for integration tests — database operations are slower than unit tests (30s default).
- Create the Express app via a factory function — enables injecting different configs for testing.
