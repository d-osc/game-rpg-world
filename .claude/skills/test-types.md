---
name: test-types
description: Testing strategies for Node.js/TypeScript applications — unit testing, integration testing, E2E testing, API testing, snapshot testing, test fixtures, mocking patterns, code coverage, TDD workflow, and testing with Vitest/Jest
---

# Test Types (Unit, Integration, E2E)

## Testing Stack Setup

```bash
# Install testing dependencies
npm install -D vitest @vitest/coverage-v8 @vitest/ui
npm install -D supertest @types/supertest
npm install -D happy-dom       # DOM environment for component tests
npm install -D msw             # Mock Service Worker for API mocking
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/types/**'],
            thresholds: {
                statements: 80,
                branches: 75,
                functions: 80,
                lines: 80,
            },
        },
        setupFiles: ['src/test/setup.ts'],
        testTimeout: 10_000,
        hookTimeout: 30_000,
    },
});
```

```typescript
// src/test/setup.ts — global test setup
import { beforeAll, afterAll, afterEach } from 'vitest';

// Reset mocks between tests
afterEach(() => {
    // Clear any global state
});

// Suppress console.error in tests (optional)
const originalError = console.error;
beforeAll(() => {
    console.error = (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].includes('Warning:')) return;
        originalError.call(console, ...args);
    };
});
afterAll(() => {
    console.error = originalError;
});
```

```json
// package.json scripts
{
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:unit": "vitest run src/**/*.test.ts --exclude '**/integration/**'",
    "test:integration": "vitest run src/**/integration/**/*.test.ts",
    "test:e2e": "vitest run src/**/e2e/**/*.test.ts"
}
```

## Unit Testing

### Pure Function Tests

```typescript
// src/utils/calculations.ts
export function calculateSubtotal(items: { price: number; quantity: number }[]): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function calculateTax(subtotal: number, rate: number): number {
    return Math.round(subtotal * rate * 100) / 100;
}

export function calculateTotal(
    items: { price: number; quantity: number }[],
    taxRate: number,
    discount: number = 0,
): number {
    const subtotal = calculateSubtotal(items);
    const tax = calculateTax(subtotal - discount, taxRate);
    return Math.round((subtotal - discount + tax) * 100) / 100;
}

export function formatCurrency(amount: number, currency = 'THB'): string {
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
    }).format(amount);
}
```

```typescript
// src/utils/calculations.test.ts
import { describe, it, expect } from 'vitest';
import { calculateSubtotal, calculateTax, calculateTotal, formatCurrency } from './calculations';

describe('calculateSubtotal', () => {
    it('calculates subtotal for multiple items', () => {
        const items = [
            { price: 100, quantity: 2 },
            { price: 50, quantity: 3 },
        ];
        expect(calculateSubtotal(items)).toBe(350);
    });

    it('returns 0 for empty array', () => {
        expect(calculateSubtotal([])).toBe(0);
    });

    it('handles zero quantity', () => {
        expect(calculateSubtotal([{ price: 100, quantity: 0 }])).toBe(0);
    });
});

describe('calculateTax', () => {
    it('calculates 7% VAT', () => {
        expect(calculateTax(1000, 0.07)).toBe(70);
    });

    it('rounds to 2 decimal places', () => {
        expect(calculateTax(333, 0.07)).toBe(23.31);
    });
});

describe('calculateTotal', () => {
    it('calculates total with tax', () => {
        const items = [{ price: 1000, quantity: 1 }];
        // subtotal=1000, tax=70 (7%), total=1070
        expect(calculateTotal(items, 0.07)).toBe(1070);
    });

    it('applies discount before tax', () => {
        const items = [{ price: 1000, quantity: 1 }];
        // subtotal=1000, discount=100, taxable=900, tax=63, total=963
        expect(calculateTotal(items, 0.07, 100)).toBe(963);
    });

    it('handles zero discount', () => {
        const items = [{ price: 500, quantity: 2 }];
        expect(calculateTotal(items, 0.07, 0)).toBe(1070);
    });
});

describe('formatCurrency', () => {
    it('formats THB by default', () => {
        const result = formatCurrency(1234.56);
        expect(result).toContain('1,234.56');
    });

    it('formats USD', () => {
        const result = formatCurrency(100, 'USD');
        expect(result).toContain('100.00');
    });
});
```

### Validation Tests

```typescript
// src/validators/quotation.validator.ts
export interface ValidationError {
    field: string;
    message: string;
}

export function validateQuotation(data: {
    customerName?: string;
    items?: { name?: string; price?: number; quantity?: number }[];
    validUntil?: string;
}): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!data.customerName?.trim()) {
        errors.push({ field: 'customerName', message: 'Customer name is required' });
    } else if (data.customerName.length > 200) {
        errors.push({ field: 'customerName', message: 'Customer name too long (max 200)' });
    }

    if (!data.items?.length) {
        errors.push({ field: 'items', message: 'At least one item is required' });
    } else {
        data.items.forEach((item, i) => {
            if (!item.name?.trim()) {
                errors.push({ field: `items[${i}].name`, message: 'Item name is required' });
            }
            if (item.price === undefined || item.price < 0) {
                errors.push({ field: `items[${i}].price`, message: 'Valid price is required' });
            }
            if (!item.quantity || item.quantity < 1) {
                errors.push({ field: `items[${i}].quantity`, message: 'Quantity must be ≥ 1' });
            }
        });
    }

    if (data.validUntil) {
        const date = new Date(data.validUntil);
        if (isNaN(date.getTime()) || date <= new Date()) {
            errors.push({ field: 'validUntil', message: 'Must be a future date' });
        }
    }

    return errors;
}
```

```typescript
// src/validators/quotation.validator.test.ts
import { describe, it, expect } from 'vitest';
import { validateQuotation } from './quotation.validator';

describe('validateQuotation', () => {
    const validData = {
        customerName: 'Acme Corp',
        items: [{ name: 'Widget', price: 100, quantity: 5 }],
        validUntil: '2030-12-31',
    };

    it('returns no errors for valid data', () => {
        expect(validateQuotation(validData)).toEqual([]);
    });

    it('requires customer name', () => {
        const errors = validateQuotation({ ...validData, customerName: '' });
        expect(errors).toContainEqual({
            field: 'customerName',
            message: 'Customer name is required',
        });
    });

    it('requires at least one item', () => {
        const errors = validateQuotation({ ...validData, items: [] });
        expect(errors).toContainEqual({
            field: 'items',
            message: 'At least one item is required',
        });
    });

    it('validates item price is non-negative', () => {
        const errors = validateQuotation({
            ...validData,
            items: [{ name: 'Widget', price: -10, quantity: 5 }],
        });
        expect(errors).toContainEqual({
            field: 'items[0].price',
            message: 'Valid price is required',
        });
    });

    it('validates quantity is at least 1', () => {
        const errors = validateQuotation({
            ...validData,
            items: [{ name: 'Widget', price: 100, quantity: 0 }],
        });
        expect(errors.some(e => e.field === 'items[0].quantity')).toBe(true);
    });

    it('validates validUntil is a future date', () => {
        const errors = validateQuotation({ ...validData, validUntil: '2020-01-01' });
        expect(errors.some(e => e.field === 'validUntil')).toBe(true);
    });

    it('returns multiple errors at once', () => {
        const errors = validateQuotation({ customerName: '', items: [] });
        expect(errors.length).toBeGreaterThanOrEqual(2);
    });
});
```

## Mocking Patterns

### Module Mocking

```typescript
// src/services/email.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external module
vi.mock('./email-provider', () => ({
    sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-123' }),
}));

import { sendEmail } from './email-provider';
import { sendQuotationEmail } from './email-service';

describe('sendQuotationEmail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sends quotation to customer', async () => {
        await sendQuotationEmail({
            to: 'customer@example.com',
            quotationId: 'q-001',
            customerName: 'Acme Corp',
            total: 10700,
        });

        expect(sendEmail).toHaveBeenCalledOnce();
        expect(sendEmail).toHaveBeenCalledWith({
            to: 'customer@example.com',
            subject: expect.stringContaining('Q-001'),
            template: 'quotation',
            data: expect.objectContaining({
                customerName: 'Acme Corp',
                total: 10700,
            }),
        });
    });

    it('throws on send failure', async () => {
        vi.mocked(sendEmail).mockRejectedValueOnce(new Error('SMTP down'));

        await expect(
            sendQuotationEmail({
                to: 'customer@example.com',
                quotationId: 'q-001',
                customerName: 'Acme',
                total: 100,
            }),
        ).rejects.toThrow('Failed to send quotation email');
    });
});
```

### Database Mock (Repository Pattern)

```typescript
// src/repositories/quotation.repository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a mock repository
function createMockQuotationRepo() {
    let store = new Map<string, any>();
    let idCounter = 1;

    return {
        findById: vi.fn((id: string) => Promise.resolve(store.get(id) ?? null)),
        findAll: vi.fn(() => Promise.resolve(Array.from(store.values()))),
        create: vi.fn((data: any) => {
            const item = { ...data, id: `q-${idCounter++}`, createdAt: new Date() };
            store.set(item.id, item);
            return Promise.resolve(item);
        }),
        update: vi.fn((id: string, data: any) => {
            const existing = store.get(id);
            if (!existing) return Promise.resolve(null);
            const updated = { ...existing, ...data, updatedAt: new Date() };
            store.set(id, updated);
            return Promise.resolve(updated);
        }),
        delete: vi.fn((id: string) => {
            const existed = store.has(id);
            store.delete(id);
            return Promise.resolve(existed);
        }),
        _store: store,    // expose for test assertions
        _reset: () => { store.clear(); idCounter = 1; },
    };
}

describe('QuotationService', () => {
    let repo: ReturnType<typeof createMockQuotationRepo>;
    let service: QuotationService;

    beforeEach(() => {
        repo = createMockQuotationRepo();
        service = new QuotationService(repo as any);
    });

    it('creates a quotation', async () => {
        const quotation = await service.create({
            customerName: 'Acme Corp',
            items: [{ name: 'Widget', price: 100, quantity: 5 }],
            taxRate: 0.07,
        });

        expect(quotation.id).toBeDefined();
        expect(quotation.total).toBe(535);
        expect(repo.create).toHaveBeenCalledOnce();
    });

    it('finds quotation by id', async () => {
        const created = await service.create({
            customerName: 'Test',
            items: [{ name: 'Item', price: 10, quantity: 1 }],
            taxRate: 0.07,
        });

        const found = await service.findById(created.id);
        expect(found).toEqual(created);
    });

    it('returns null for non-existent quotation', async () => {
        const found = await service.findById('non-existent');
        expect(found).toBeNull();
    });
});
```

### Timer Mocking

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Token expiry', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('token expires after TTL', () => {
        const cache = new TokenCache(3600_000); // 1 hour TTL
        cache.set('key', 'value');

        expect(cache.get('key')).toBe('value');

        // Advance time by 1 hour + 1ms
        vi.advanceTimersByTime(3600_001);

        expect(cache.get('key')).toBeNull();
    });
});
```

## Integration Testing

### API Endpoint Tests

```typescript
// src/routes/quotations.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db } from '../database';
import { redis } from '../redis';

describe('Quotations API', () => {
    let authToken: string;

    beforeAll(async () => {
        // Run migrations on test database
        await db.migrate.latest();
        // Create test user and get token
        authToken = await createTestUserAndGetToken();
    });

    afterAll(async () => {
        await db.migrate.rollback();
        await db.destroy();
        await redis.quit();
    });

    beforeEach(async () => {
        // Clean tables between tests
        await db('quotation_items').del();
        await db('quotations').del();
    });

    // --- POST /api/quotations ---
    describe('POST /api/quotations', () => {
        it('creates a new quotation', async () => {
            const response = await request(app)
                .post('/api/quotations')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    customerName: 'Acme Corp',
                    items: [
                        { name: 'Widget A', price: 100, quantity: 5 },
                        { name: 'Widget B', price: 200, quantity: 3 },
                    ],
                    taxRate: 0.07,
                    validUntil: '2030-12-31',
                })
                .expect(201);

            expect(response.body).toMatchObject({
                id: expect.any(String),
                customerName: 'Acme Corp',
                subtotal: 1100,
                tax: 77,
                total: 1177,
                status: 'draft',
            });
        });

        it('validates required fields', async () => {
            const response = await request(app)
                .post('/api/quotations')
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect(400);

            expect(response.body.errors).toBeDefined();
            expect(response.body.errors.length).toBeGreaterThan(0);
        });

        it('requires authentication', async () => {
            await request(app)
                .post('/api/quotations')
                .send({ customerName: 'Test' })
                .expect(401);
        });
    });

    // --- GET /api/quotations ---
    describe('GET /api/quotations', () => {
        it('returns paginated list', async () => {
            // Seed data
            await seedQuotations(25);

            const response = await request(app)
                .get('/api/quotations?page=1&limit=10')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.data).toHaveLength(10);
            expect(response.body.pagination).toMatchObject({
                page: 1,
                limit: 10,
                total: 25,
                totalPages: 3,
            });
        });

        it('filters by status', async () => {
            await seedQuotation({ status: 'draft' });
            await seedQuotation({ status: 'sent' });
            await seedQuotation({ status: 'accepted' });

            const response = await request(app)
                .get('/api/quotations?status=draft')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.data.every((q: any) => q.status === 'draft')).toBe(true);
        });
    });

    // --- GET /api/quotations/:id ---
    describe('GET /api/quotations/:id', () => {
        it('returns quotation by id', async () => {
            const created = await seedQuotation();

            const response = await request(app)
                .get(`/api/quotations/${created.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.id).toBe(created.id);
        });

        it('returns 404 for non-existent', async () => {
            await request(app)
                .get('/api/quotations/non-existent')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });
    });

    // --- PATCH /api/quotations/:id/status ---
    describe('PATCH /api/quotations/:id/status', () => {
        it('transitions draft → sent', async () => {
            const quotation = await seedQuotation({ status: 'draft' });

            const response = await request(app)
                .patch(`/api/quotations/${quotation.id}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'sent' })
                .expect(200);

            expect(response.body.status).toBe('sent');
        });

        it('rejects invalid transition', async () => {
            const quotation = await seedQuotation({ status: 'accepted' });

            await request(app)
                .patch(`/api/quotations/${quotation.id}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'draft' })
                .expect(422);
        });
    });
});

// Test helpers
async function createTestUserAndGetToken(): Promise<string> {
    const user = await db('users').insert({
        email: 'test@example.com',
        name: 'Test User',
        password: await hashPassword('password123'),
        role: 'admin',
    }).returning('*');

    return createAccessToken(user[0]);
}

async function seedQuotation(overrides: Record<string, unknown> = {}) {
    const [quotation] = await db('quotations').insert({
        customerName: 'Test Customer',
        subtotal: 1000,
        tax: 70,
        total: 1070,
        status: 'draft',
        userId: 'test-user-id',
        ...overrides,
    }).returning('*');

    return quotation;
}

async function seedQuotations(count: number) {
    const quotations = Array.from({ length: count }, (_, i) => ({
        customerName: `Customer ${i + 1}`,
        subtotal: 1000,
        tax: 70,
        total: 1070,
        status: 'draft',
        userId: 'test-user-id',
    }));
    return db('quotations').insert(quotations).returning('*');
}
```

### Database Integration Tests

```typescript
// src/repositories/quotation.repository.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../database';
import { QuotationRepository } from './quotation.repository';

describe('QuotationRepository (Integration)', () => {
    let repo: QuotationRepository;

    beforeAll(async () => {
        await db.migrate.latest();
        repo = new QuotationRepository(db);
    });

    afterAll(async () => {
        await db.migrate.rollback();
        await db.destroy();
    });

    beforeEach(async () => {
        await db('quotation_items').del();
        await db('quotations').del();
    });

    it('creates quotation with items in transaction', async () => {
        const quotation = await repo.createWithItems({
            customerName: 'Acme Corp',
            taxRate: 0.07,
            validUntil: '2030-12-31',
            items: [
                { name: 'Widget', price: 100, quantity: 5 },
                { name: 'Gadget', price: 200, quantity: 3 },
            ],
        });

        // Verify quotation
        expect(quotation.id).toBeDefined();
        expect(quotation.subtotal).toBe(1100);

        // Verify items were created
        const items = await db('quotation_items').where('quotationId', quotation.id);
        expect(items).toHaveLength(2);
    });

    it('rolls back on item creation failure', async () => {
        // Force an error with invalid item data
        await expect(
            repo.createWithItems({
                customerName: 'Acme',
                taxRate: 0.07,
                items: [{ name: 'Valid', price: 100, quantity: 1 }, { name: '' } as any],
            }),
        ).rejects.toThrow();

        // Verify no quotation was created
        const count = await db('quotations').count('* as count').first();
        expect(Number(count!.count)).toBe(0);
    });

    it('finds quotations with pagination', async () => {
        // Seed 25 quotations
        for (let i = 0; i < 25; i++) {
            await repo.create({
                customerName: `Customer ${i}`,
                taxRate: 0.07,
            });
        }

        const page1 = await repo.findAll({ page: 1, limit: 10 });
        expect(page1.data).toHaveLength(10);
        expect(page1.total).toBe(25);

        const page3 = await repo.findAll({ page: 3, limit: 10 });
        expect(page3.data).toHaveLength(5);
    });
});
```

## E2E Testing

### Full Flow E2E Test

```typescript
// src/e2e/quotation-flow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db } from '../database';

describe('Quotation Flow (E2E)', () => {
    let adminToken: string;
    let userToken: string;
    let quotationId: string;

    beforeAll(async () => {
        await db.migrate.latest();
        // Create admin and regular user
        adminToken = await createTestUser({ role: 'admin', email: 'admin@test.com' });
        userToken = await createTestUser({ role: 'user', email: 'user@test.com' });
    });

    afterAll(async () => {
        await db.migrate.rollback();
        await db.destroy();
    });

    it('completes full quotation lifecycle', async () => {
        // 1. Create quotation
        const createRes = await request(app)
            .post('/api/quotations')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                customerName: 'Acme Corp',
                items: [
                    { name: 'Service A', price: 5000, quantity: 2 },
                    { name: 'Service B', price: 3000, quantity: 1 },
                ],
                taxRate: 0.07,
                validUntil: '2030-12-31',
            })
            .expect(201);

        quotationId = createRes.body.id;
        expect(createRes.body.status).toBe('draft');
        expect(createRes.body.total).toBe(13930); // (10000+3000)*1.07

        // 2. View quotation
        const getRes = await request(app)
            .get(`/api/quotations/${quotationId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(getRes.body.id).toBe(quotationId);

        // 3. Update quotation
        const updateRes = await request(app)
            .put(`/api/quotations/${quotationId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                items: [
                    { name: 'Service A', price: 5000, quantity: 2 },
                    { name: 'Service B', price: 3000, quantity: 1 },
                    { name: 'Service C', price: 1500, quantity: 2 },
                ],
            })
            .expect(200);

        expect(updateRes.body.total).toBe(17145); // (10000+3000+3000)*1.07

        // 4. Send quotation (draft → sent)
        const sendRes = await request(app)
            .patch(`/api/quotations/${quotationId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'sent' })
            .expect(200);

        expect(sendRes.body.status).toBe('sent');

        // 5. Accept quotation (sent → accepted)
        const acceptRes = await request(app)
            .patch(`/api/quotations/${quotationId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'accepted' })
            .expect(200);

        expect(acceptRes.body.status).toBe('accepted');

        // 6. List shows the quotation
        const listRes = await request(app)
            .get('/api/quotations?status=accepted')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(listRes.body.data.some((q: any) => q.id === quotationId)).toBe(true);

        // 7. Regular user cannot access admin's quotation (if RBAC enforces)
        await request(app)
            .get(`/api/quotations/${quotationId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(403); // or 404 depending on access control design
    });
});
```

## Test Fixtures & Helpers

### Shared Test Utilities

```typescript
// src/test/helpers.ts
import request from 'supertest';
import { db } from '../database';
import { hashPassword } from '../services/auth';
import { createAccessToken } from '../services/jwt';

export async function createTestUser(overrides: {
    role?: string;
    email?: string;
} = {}): Promise<string> {
    const [user] = await db('users').insert({
        email: overrides.email ?? `test-${Date.now()}@example.com`,
        name: 'Test User',
        password: await hashPassword('password123'),
        role: overrides.role ?? 'user',
    }).returning('*');

    return createAccessToken(user);
}

export function createTestQuotationData(overrides: Record<string, unknown> = {}) {
    return {
        customerName: 'Test Customer',
        items: [
            { name: 'Item A', price: 100, quantity: 2 },
            { name: 'Item B', price: 200, quantity: 1 },
        ],
        taxRate: 0.07,
        validUntil: '2030-12-31',
        ...overrides,
    };
}

export async function createTestQuotation(token: string, data?: Record<string, unknown>) {
    const response = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${token}`)
        .send(createTestQuotationData(data));

    return response.body;
}
```

### Test Database Setup

```typescript
// src/test/db-helper.ts
import { db } from '../database';

export async function setupTestDb() {
    await db.migrate.latest();
    return db;
}

export async function teardownTestDb() {
    await db.migrate.rollback();
    await db.destroy();
}

export async function cleanTables(tables: string[]) {
    // Disable FK checks, truncate, re-enable
    await db.raw('SET CONSTRAINTS ALL DEFERRED');
    for (const table of tables) {
        await db.raw(`TRUNCATE TABLE "${table}" CASCADE`);
    }
    await db.raw('SET CONSTRAINTS ALL IMMEDIATE');
}
```

## Snapshot Testing

```typescript
// src/renderers/quotation-pdf.test.ts
import { describe, it, expect } from 'vitest';
import { renderQuotationHtml } from './quotation-renderer';

describe('renderQuotationHtml', () => {
    it('renders quotation HTML snapshot', () => {
        const html = renderQuotationHtml({
            id: 'Q-2026-001',
            customerName: 'Acme Corp',
            items: [
                { name: 'Widget A', price: 100, quantity: 5 },
            ],
            subtotal: 500,
            tax: 35,
            total: 535,
            date: '2026-04-23',
            validUntil: '2030-12-31',
        });

        expect(html).toMatchSnapshot();
    });

    it('matches inline snapshot for simple output', () => {
        const result = formatQuotationNumber('Q', 42);
        expect(result).toMatchInlineSnapshot('"Q-000042"');
    });
});
```

## Code Coverage

### Coverage Configuration

```typescript
// vitest.config.ts — coverage settings
{
    coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'html', 'json-summary'],
        include: ['src/**/*.ts'],
        exclude: [
            'src/**/*.test.ts',
            'src/**/*.d.ts',
            'src/types/**',
            'src/test/**',
            'src/migrations/**',
        ],
        thresholds: {
            statements: 80,
            branches: 75,
            functions: 80,
            lines: 80,
        },
        // Per-file thresholds
        perFile: true,
    },
}
```

### Coverage Commands

```bash
# Run tests with coverage report
npm run test:coverage

# Open HTML coverage report
open coverage/index.html

# Check coverage in CI
npm run test:coverage -- --reporter=json-summary
# Then check coverage/coverage-summary.json for thresholds
```

### CI Coverage Check

```yaml
# .github/workflows/ci.yml
- name: Test with coverage
    run: npm run test:coverage

- name: Check coverage thresholds
    run: |
        COVERAGE=$(cat coverage/coverage-summary.json)
        LINES=$(echo "$COVERAGE" | jq '.total.lines.pct')
        if (( $(echo "$LINES < 80" | bc -l) )); then
            echo "Coverage $LINES% is below 80% threshold"
            exit 1
        fi

- name: Upload coverage to Codecov
    uses: codecov/codecov-action@v4
    with:
        files: ./coverage/lcov.info
        token: ${{ secrets.CODECOV_TOKEN }}
```

## TDD Workflow

```
Red → Green → Refactor

1. RED    — Write a failing test that defines expected behavior
2. GREEN  — Write minimal code to make the test pass
3. REFACTOR — Clean up the code while keeping tests green

Example TDD cycle:

# Step 1: RED — write failing test
it('calculates discount percentage', () => {
    expect(calculateDiscount(1000, 10)).toBe(100); // fails — function doesn't exist
});

# Step 2: GREEN — implement minimum
function calculateDiscount(total: number, percent: number): number {
    return total * percent / 100;
}

# Step 3: REFACTOR — improve (if needed)
// Already clean — no refactor needed

# Add edge cases (back to RED)
it('clamps discount to not exceed total', () => {
    expect(calculateDiscount(100, 150)).toBe(100); // fails
});

# GREEN — add clamping
function calculateDiscount(total: number, percent: number): number {
    return Math.min(total, total * percent / 100);
}
```

## Test Organization

```
src/
├── utils/
│   ├── calculations.ts
│   └── calculations.test.ts          # Unit test — same directory
├── validators/
│   ├── quotation.validator.ts
│   └── quotation.validator.test.ts   # Unit test
├── services/
│   ├── email.service.ts
│   └── email.service.test.ts         # Unit test with mocks
├── repositories/
│   ├── quotation.repository.ts
│   └── quotation.repository.integration.test.ts  # Integration test
├── routes/
│   └── quotations.test.ts            # API integration test
├── e2e/
│   └── quotation-flow.test.ts        # E2E test
└── test/
    ├── setup.ts                       # Global setup
    └── helpers.ts                     # Shared test utilities
```

## Code Style Rules

- Write tests alongside the code they test — keep `.test.ts` files in the same directory.
- Follow the Arrange-Act-Assert pattern — set up data, call function, verify results.
- Test one behavior per test case — use `describe` blocks to group related tests.
- Use descriptive test names — "returns 404 for non-existent quotation" not "test1".
- Use `beforeEach` to reset state between tests — never rely on test execution order.
- Mock external dependencies (email, payment gateway) — don't send real emails in tests.
- Use a real database for integration tests — run migrations before, rollback after.
- Clean database tables between tests — use `beforeEach` to truncate or rollback.
- Test edge cases: empty input, null, undefined, boundary values, large numbers.
- Use snapshot testing sparingly — for HTML/PDF rendering, not for business logic.
- Set coverage thresholds in CI — block merges that drop coverage below target.
- Create test helpers for common operations (create user, seed data, get auth token).
- Run unit tests in CI on every push — run integration/E2E on PR merge or schedule.
- Use `vi.useFakeTimers()` for time-dependent tests — don't rely on real time.
- Keep E2E tests minimal and focused on critical user flows — they're slow and brittle.
