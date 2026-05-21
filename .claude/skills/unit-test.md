---
name: unit-test
description: Unit testing with Vitest — test structure, assertions, mocking (vi.fn, vi.spyOn, vi.mock), test doubles, async testing, error testing, parameterized tests, class/service testing, pure function testing, and unit test best practices
---

# Unit Test (Vitest)

## Vitest API

### Test Structure

```typescript
import { describe, it, test, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// describe — group related tests
describe('UserService', () => {

    // beforeAll — runs once before all tests in this describe
    beforeAll(() => {
        // expensive setup (DB connection, etc.)
    });

    // afterAll — runs once after all tests
    afterAll(() => {
        // cleanup
    });

    // beforeEach — runs before each test
    beforeEach(() => {
        vi.clearAllMocks();   // reset all mocks
    });

    // afterEach — runs after each test
    afterEach(() => {
        vi.restoreAllMocks(); // restore original implementations
    });

    // it or test — single test case
    it('creates a user', async () => {
        const user = await userService.create({ name: 'Alice', email: 'alice@test.com' });
        expect(user.name).toBe('Alice');
    });

    // Nested describe — organize by behavior
    describe('create', () => {
        it('creates with valid data', async () => { /* ... */ });
        it('rejects duplicate email', async () => { /* ... */ });
        it('hashes password', async () => { /* ... */ });
    });

    describe('findById', () => {
        it('returns user when found', async () => { /* ... */ });
        it('returns null when not found', async () => { /* ... */ });
    });
});

// Skip tests
it.skip('TODO: implement later', () => { /* ... */ });
describe.skip('broken feature', () => { /* ... */ });

// Only run specific test (useful for debugging)
it.only('this test runs alone', () => { /* ... */ });
describe.only('only this suite', () => { /* ... */ });

// Conditional skip
it.skipIf(process.env.CI)('only runs locally', () => { /* ... */ });
it.runIf(process.env.NODE_ENV === 'test')('only in test env', () => { /* ... */ });

// Concurrent execution (independent tests)
it.concurrent('test A', async () => { /* ... */ });
it.concurrent('test B', async () => { /* ... */ });

// Each — parameterized tests
it.each([
    [1, 1, 2],
    [1, 2, 3],
    [2, 3, 5],
])('add(%d, %d) = %d', (a, b, expected) => {
    expect(add(a, b)).toBe(expected);
});
```

### Assertions

```typescript
import { expect } from 'vitest';

// Equality
expect(value).toBe(42);                    // strict equality (===)
expect(value).toEqual({ name: 'Alice' });  // deep equality
expect(value).toStrictEqual({ x: 1 });     // strict deep equality (checks undefined, class)
expect(value).not.toBe(42);                // negation

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();
expect(value).toBeNaN();

// Numbers
expect(value).toBeGreaterThan(10);
expect(value).toBeGreaterThanOrEqual(10);
expect(value).toBeLessThan(20);
expect(value).toBeLessThanOrEqual(20);
expect(value).toBeCloseTo(0.3, 5);         // floating point comparison (5 decimal places)

// Strings
expect(str).toBe('hello');
expect(str).toContain('substring');
expect(str).toMatch(/pattern/);
expect(str).toHaveLength(5);
expect(str).toStartWith('hel');
expect(str).toEndWith('llo');

// Arrays
expect(arr).toContain('item');
expect(arr).toContainEqual({ name: 'Alice' });  // deep contains
expect(arr).toHaveLength(3);
expect([1, 2, 3]).toEqual(expect.arrayContaining([2, 3]));

// Objects
expect(obj).toHaveProperty('name');
expect(obj).toHaveProperty('address.city', 'Bangkok');
expect(obj).toMatchObject({ name: 'Alice', age: 30 });  // partial match
expect(obj).toEqual(expect.objectContaining({ name: 'Alice' }));

// Exceptions
expect(() => fn()).toThrow();
expect(() => fn()).toThrow('error message');
expect(() => fn()).toThrow(/pattern/);
expect(() => fn()).toThrow(Error);          // specific error class

// Async
await expect(promise).resolves.toBe(42);
await expect(promise).resolves.toMatchObject({ id: '123' });
await expect(promise).rejects.toThrow('Not found');
await expect(promise).rejects.toThrowError(Error);

// Functions / Mocks
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledOnce();
expect(mockFn).toHaveBeenCalledTimes(3);
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenLastCalledWith('last');
expect(mockFn).toHaveBeenNthCalledWith(2, 'second');
expect(mockFn).toHaveReturned();
expect(mockFn).toHaveReturnedTimes(3);
expect(mockFn).toHaveReturnedWith('value');
expect(mockFn).toHaveLastReturnedWith('last');
expect(mockFn).toHaveReturnedWith(expect.objectContaining({ id: '123' }));

// Snapshots
expect(value).toMatchSnapshot();
expect(value).toMatchInlineSnapshot(`"expected value"`);

// Type assertions (compile-time)
expectTypeOf(add(1, 2)).toBeNumber();
expectTypeOf(createUser()).toMatchTypeOf<User>();

// Custom message on failure
expect(value, 'subtotal should be positive').toBeGreaterThan(0);

// Asymmetric matchers
expect({ name: 'Alice', age: 30, role: 'admin' }).toEqual({
    name: expect.any(String),
    age: expect.any(Number),
    role: expect.stringContaining('admin'),
});
```

## Mocking

### vi.fn — Function Mock

```typescript
import { vi, expect } from 'vitest';

// Create mock function
const mockFn = vi.fn();
mockFn('hello');
expect(mockFn).toHaveBeenCalledWith('hello');

// With implementation
const add = vi.fn((a: number, b: number) => a + b);
expect(add(2, 3)).toBe(5);
expect(add).toHaveReturnedWith(5);

// Return value
const getOne = vi.fn().mockReturnValue(1);
expect(getOne()).toBe(1);

// Return value once (then falls through)
const fn = vi.fn()
    .mockReturnValueOnce('first call')
    .mockReturnValueOnce('second call')
    .mockReturnValue('default');
expect(fn()).toBe('first call');
expect(fn()).toBe('second call');
expect(fn()).toBe('default');
expect(fn()).toBe('default'); // continues returning default

// Resolve / reject (async)
const fetchUser = vi.fn().mockResolvedValue({ id: '1', name: 'Alice' });
const result = await fetchUser('1');
expect(result.name).toBe('Alice');

const failingFn = vi.fn().mockRejectedValue(new Error('Network error'));
await expect(failingFn()).rejects.toThrow('Network error');

// Sequential async returns
const api = vi.fn()
    .mockResolvedValueOnce({ status: 'pending' })
    .mockResolvedValueOnce({ status: 'processing' })
    .mockResolvedValueOnce({ status: 'completed' });

// Implementation that reads from a map
const db = {
    findById: vi.fn((id: string) => {
        const records: Record<string, any> = {
            '1': { id: '1', name: 'Alice' },
            '2': { id: '2', name: 'Bob' },
        };
        return Promise.resolve(records[id] ?? null);
    }),
};
const user = await db.findById('1');
expect(user.name).toBe('Alice');
```

### vi.spyOn — Spy on Object Methods

```typescript
import { vi, expect, beforeEach } from 'vitest';
import { UserService } from './user-service';
import { db } from './database';

describe('UserService', () => {
    let service: UserService;

    beforeEach(() => {
        service = new UserService();
        vi.restoreAllMocks();
    });

    it('calls db.insert when creating user', async () => {
        const insertSpy = vi.spyOn(db, 'insert').mockResolvedValue([{ id: '1' }] as any);

        await service.create({ name: 'Alice', email: 'alice@test.com' });

        expect(insertSpy).toHaveBeenCalledOnce();
        expect(insertSpy).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Alice', email: 'alice@test.com' }),
        );
    });

    it('spy preserves original implementation', async () => {
        // spyOn without mock — original still runs (for integration-like unit tests)
        const logSpy = vi.spyOn(console, 'log');

        service.notify('hello');

        expect(logSpy).toHaveBeenCalledWith('hello');
        // console.log actually ran (output visible in test)
    });

    it('mockImplementation replaces behavior', () => {
        const spy = vi.spyOn(service, 'validateEmail')
            .mockImplementation((email: string) => email.endsWith('@test.com'));

        expect(service.validateEmail('user@test.com')).toBe(true);
        expect(service.validateEmail('user@other.com')).toBe(false);
    });

    it('mockReturnValue for simple spies', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);

        // deterministic random
        expect(Math.random()).toBe(0.5);
        expect(Math.random()).toBe(0.5);
    });
});
```

### vi.mock — Module Mocking

```typescript
import { vi, expect, describe, it, beforeEach } from 'vitest';

// Static mock — hoisted to top of file (runs before imports)
vi.mock('../email', () => ({
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
    sendTemplate: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../database', () => ({
    db: {
        selectFrom: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({ id: '1', name: 'Alice' }),
        insertInto: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: '1' }),
    },
}));

// Import after vi.mock (mocks are hoisted)
import { sendEmail } from '../email';
import { UserService } from './user-service';

describe('UserService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sends welcome email after registration', async () => {
        const service = new UserService();
        await service.register({ name: 'Alice', email: 'alice@test.com', password: 'Pass123!' });

        expect(sendEmail).toHaveBeenCalledOnce();
        expect(sendEmail).toHaveBeenCalledWith({
            to: 'alice@test.com',
            subject: expect.stringContaining('Welcome'),
            template: 'welcome',
            data: expect.objectContaining({ name: 'Alice' }),
        });
    });
});
```

### Dynamic Module Mocking

```typescript
import { vi, expect, describe, it } from 'vitest';

// Use factory for dynamic mocks
vi.mock('../config', async () => {
    const actual = await vi.importActual<typeof import('../config')>('../config');
    return {
        ...actual,
        getDbUrl: () => 'postgres://test:test@localhost:5432/test_db',
        isProduction: () => false,
    };
});

// Mock only specific export
vi.mock('../logger', async () => {
    const actual = await vi.importActual<typeof import('../logger')>('../logger');
    return {
        ...actual,
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            child: vi.fn().mockReturnValue({ info: vi.fn(), error: vi.fn() }),
        },
    };
});
```

### vi.stub — Environment & Globals

```typescript
import { vi, expect, describe, it, afterEach } from 'vitest';

describe('Environment stubs', () => {
    afterEach(() => {
        vi.unstubAllEnvironments();
        vi.unstubAllGlobals();
    });

    it('stubs process.env', () => {
        vi.stubEnv('NODE_ENV', 'test');
        vi.stubEnv('JWT_SECRET', 'test-secret');

        expect(process.env.NODE_ENV).toBe('test');
        expect(process.env.JWT_SECRET).toBe('test-secret');
    });

    it('stubs Date', () => {
        const fixedDate = new Date('2026-01-15T10:30:00Z');
        vi.setSystemTime(fixedDate);

        expect(new Date()).toEqual(fixedDate);
        expect(Date.now()).toBe(fixedDate.getTime());

        vi.useRealTimers(); // restore
    });

    it('stubs global fetch', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ message: 'hello' }),
        }));

        const res = await fetch('/api/test');
        const data = await res.json();
        expect(data.message).toBe('hello');
    });
});
```

## Test Doubles

```typescript
// Fake — working implementation (e.g., in-memory database)
class FakeUserRepository {
    private users = new Map<string, User>();

    async findById(id: string): Promise<User | null> {
        return this.users.get(id) ?? null;
    }

    async create(data: NewUser): Promise<User> {
        const user = { ...data, id: crypto.randomUUID(), createdAt: new Date() };
        this.users.set(user.id, user);
        return user;
    }

    async findByEmail(email: string): Promise<User | null> {
        for (const user of this.users.values()) {
            if (user.email === email) return user;
        }
        return null;
    }

    async delete(id: string): Promise<boolean> {
        return this.users.delete(id);
    }

    // Test helper — seed data
    seed(users: User[]) {
        for (const u of users) this.users.set(u.id, u);
    }
}

// Usage — fake gives real behavior without external dependencies
describe('UserService with FakeRepo', () => {
    let repo: FakeUserRepository;
    let service: UserService;

    beforeEach(() => {
        repo = new FakeUserRepository();
        service = new UserService(repo);
    });

    it('prevents duplicate email registration', async () => {
        await repo.create({ email: 'alice@test.com', name: 'Alice', password: 'hashed' });

        await expect(
            service.register({ email: 'alice@test.com', name: 'Alice2', password: 'Pass!' }),
        ).rejects.toThrow('Email already registered');
    });
});
```

```typescript
// Stub — returns canned responses
function createEmailStub(overrides: Partial<EmailService> = {}): EmailService {
    return {
        send: vi.fn().mockResolvedValue({ success: true, messageId: 'stub-msg' }),
        sendTemplate: vi.fn().mockResolvedValue({ success: true }),
        ...overrides,
    };
}

// Usage — inject stub into service
const emailStub = createEmailStub({
    send: vi.fn().mockRejectedValue(new Error('SMTP down')), // simulate failure
});
```

## Async Testing

```typescript
describe('Async patterns', () => {
    it('awaits promise result', async () => {
        const result = await fetchData('api/users');
        expect(result).toHaveLength(3);
    });

    it('tests rejected promise', async () => {
        await expect(fetchData('api/error')).rejects.toThrow('Not found');
    });

    it('tests resolved promise with matcher', async () => {
        await expect(fetchData('api/user/1')).resolves.toMatchObject({
            id: '1',
            name: 'Alice',
        });
    });

    it('handles concurrent operations', async () => {
        const [users, orders, quotes] = await Promise.all([
            fetchUsers(),
            fetchOrders(),
            fetchQuotations(),
        ]);

        expect(users).toBeDefined();
        expect(orders).toBeDefined();
        expect(quotes).toBeDefined();
    });

    it('tests with setTimeout', async () => {
        vi.useFakeTimers();

        const callback = vi.fn();
        setTimeout(callback, 1000);

        vi.advanceTimersByTime(500);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(500);
        expect(callback).toHaveBeenCalledOnce();

        vi.useRealTimers();
    });

    it('tests with setInterval', () => {
        vi.useFakeTimers();

        const callback = vi.fn();
        const id = setInterval(callback, 100);

        vi.advanceTimersByTime(350);
        expect(callback).toHaveBeenCalledTimes(3);

        clearInterval(id);
        vi.useRealTimers();
    });
});
```

## Error Testing

```typescript
describe('Error handling', () => {
    it('throws on invalid input', () => {
        expect(() => parseDate('not-a-date')).toThrow('Invalid date format');
    });

    it('throws specific error class', () => {
        expect(() => validateAge(-1)).toThrow(ValidationError);
    });

    it('error has correct properties', () => {
        try {
            validateQuotation({ items: [] });
            expect.unreachable('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ValidationError);
            expect((err as ValidationError).fields).toContainEqual({
                field: 'items',
                message: 'At least one item required',
            });
        }
    });

    it('async function rejects', async () => {
        await expect(
            userService.create({ email: '', name: '', password: 'short' }),
        ).rejects.toThrow('Validation failed');
    });

    it('captures error details from rejected promise', async () => {
        try {
            await failingOperation();
            expect.unreachable('Should have thrown');
        } catch (err) {
            expect((err as AppError).statusCode).toBe(503);
            expect((err as AppError).code).toBe('SERVICE_UNAVAILABLE');
        }
    });

    it('handles Error.cause chain', () => {
        try {
            wrapDatabaseError();
        } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            expect((err as Error).cause).toBeInstanceOf(DatabaseError);
        }
    });
});
```

## Parameterized Tests

```typescript
describe('calculateTax', () => {
    // Table-driven tests with it.each
    it.each([
        { subtotal: 100, rate: 0.07, expected: 7 },
        { subtotal: 1000, rate: 0.07, expected: 70 },
        { subtotal: 333, rate: 0.07, expected: 23.31 },
        { subtotal: 0, rate: 0.07, expected: 0 },
        { subtotal: 100, rate: 0, expected: 0 },
        { subtotal: 1.99, rate: 0.10, expected: 0.20 },
    ])('subtotal=$subtotal, rate=$rate → $expected', ({ subtotal, rate, expected }) => {
        expect(calculateTax(subtotal, rate)).toBe(expected);
    });
});

describe('formatQuotationStatus', () => {
    it.each([
        ['draft', 'Draft'],
        ['sent', 'Sent'],
        ['accepted', 'Accepted'],
        ['rejected', 'Rejected'],
        ['expired', 'Expired'],
    ])('status "%s" → "%s"', (input, expected) => {
        expect(formatQuotationStatus(input)).toBe(expected);
    });
});

describe('isValidEmail', () => {
    it.each([
        { email: 'user@example.com', valid: true },
        { email: 'user.name@example.co', valid: true },
        { email: 'user+tag@example.com', valid: true },
        { email: '', valid: false },
        { email: 'no-at-sign', valid: false },
        { email: '@no-local.com', valid: false },
        { email: 'user@', valid: false },
        { email: 'user@.com', valid: false },
        { email: 'user @space.com', valid: false },
    ])('email "$email" → valid=$valid', ({ email, valid }) => {
        expect(isValidEmail(email)).toBe(valid);
    });
});

describe('fizzbuzz', () => {
    it.each([
        [1, '1'],
        [3, 'Fizz'],
        [5, 'Buzz'],
        [15, 'FizzBuzz'],
        [7, '7'],
    ])('fizzbuzz(%d) = %s', (input, expected) => {
        expect(fizzbuzz(input)).toBe(expected);
    });
});
```

## Testing Classes & Services

```typescript
// src/services/quotation.service.ts
export class QuotationService {
    constructor(
        private repo: QuotationRepository,
        private emailService: EmailService,
        private config: { taxRate: number; quotationPrefix: string },
    ) {}

    async create(data: CreateQuotationInput): Promise<Quotation> {
        this.validateInput(data);

        const subtotal = data.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const tax = calculateTax(subtotal, this.config.taxRate);

        const quotation = await this.repo.create({
            customerName: data.customerName,
            subtotal,
            tax,
            total: subtotal + tax,
            status: 'draft',
            items: data.items,
        });

        return quotation;
    }

    async send(id: string): Promise<Quotation> {
        const quotation = await this.repo.findById(id);
        if (!quotation) throw new NotFoundError('Quotation not found');
        if (quotation.status !== 'draft') throw new ValidationError('Only draft quotations can be sent');

        const updated = await this.repo.update(id, { status: 'sent', sentAt: new Date() });

        await this.emailService.send({
            to: quotation.customerEmail,
            subject: `Quotation ${quotation.id}`,
            template: 'quotation',
            data: { quotation },
        });

        return updated;
    }

    private validateInput(data: CreateQuotationInput): void {
        if (!data.customerName?.trim()) throw new ValidationError('Customer name required');
        if (!data.items?.length) throw new ValidationError('At least one item required');
    }
}
```

```typescript
// src/services/quotation.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuotationService } from './quotation.service';

function createMocks() {
    const repo = {
        findById: vi.fn(),
        findAll: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    };

    const emailService = {
        send: vi.fn().mockResolvedValue({ success: true }),
    };

    const config = { taxRate: 0.07, quotationPrefix: 'Q' };

    const service = new QuotationService(
        repo as any,
        emailService as any,
        config,
    );

    return { repo, emailService, config, service };
}

describe('QuotationService', () => {
    let mocks: ReturnType<typeof createMocks>;

    beforeEach(() => {
        mocks = createMocks();
    });

    describe('create', () => {
        it('calculates totals and creates via repo', async () => {
            mocks.repo.create.mockResolvedValue({
                id: 'Q-001',
                customerName: 'Acme',
                subtotal: 1100,
                tax: 77,
                total: 1177,
                status: 'draft',
            });

            const result = await mocks.service.create({
                customerName: 'Acme Corp',
                items: [
                    { name: 'A', price: 100, quantity: 5 },
                    { name: 'B', price: 200, quantity: 3 },
                ],
            });

            expect(result.total).toBe(1177);
            expect(mocks.repo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    subtotal: 1100,
                    tax: 77,
                    total: 1177,
                    status: 'draft',
                }),
            );
        });

        it('throws on empty customer name', async () => {
            await expect(
                mocks.service.create({ customerName: '', items: [{ name: 'A', price: 100, quantity: 1 }] }),
            ).rejects.toThrow('Customer name required');

            expect(mocks.repo.create).not.toHaveBeenCalled();
        });

        it('throws on empty items', async () => {
            await expect(
                mocks.service.create({ customerName: 'Acme', items: [] }),
            ).rejects.toThrow('At least one item required');
        });
    });

    describe('send', () => {
        it('sends draft quotation and emails customer', async () => {
            mocks.repo.findById.mockResolvedValue({
                id: 'Q-001',
                status: 'draft',
                customerName: 'Acme',
                customerEmail: 'acme@test.com',
            });
            mocks.repo.update.mockResolvedValue({
                id: 'Q-001',
                status: 'sent',
                sentAt: expect.any(Date),
            });

            const result = await mocks.service.send('Q-001');

            expect(result.status).toBe('sent');
            expect(mocks.repo.update).toHaveBeenCalledWith('Q-001', expect.objectContaining({ status: 'sent' }));
            expect(mocks.emailService.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: 'acme@test.com' }),
            );
        });

        it('throws if quotation not found', async () => {
            mocks.repo.findById.mockResolvedValue(null);

            await expect(mocks.service.send('non-existent')).rejects.toThrow('Quotation not found');
            expect(mocks.emailService.send).not.toHaveBeenCalled();
        });

        it('throws if quotation is not draft', async () => {
            mocks.repo.findById.mockResolvedValue({ id: 'Q-001', status: 'sent' });

            await expect(mocks.service.send('Q-001')).rejects.toThrow('Only draft quotations can be sent');
            expect(mocks.repo.update).not.toHaveBeenCalled();
        });
    });
});
```

## Pure Function Testing Patterns

```typescript
// src/utils/quotation-number.ts
export function generateQuotationNumber(prefix: string, sequence: number): string {
    if (!prefix.match(/^[A-Z]{1,4}$/)) throw new Error('Invalid prefix');
    if (sequence < 1 || !Number.isInteger(sequence)) throw new Error('Invalid sequence');
    const year = new Date().getFullYear();
    const padded = String(sequence).padStart(6, '0');
    return `${prefix}-${year}-${padded}`;
}

export function parseQuotationNumber(qn: string): { prefix: string; year: number; sequence: number } | null {
    const match = qn.match(/^([A-Z]{1,4})-(\d{4})-(\d{6})$/);
    if (!match) return null;
    return { prefix: match[1], year: parseInt(match[2]), sequence: parseInt(match[3]) };
}

export function determineStatusTransition(
    current: QuotationStatus,
    target: QuotationStatus,
): boolean {
    const allowed: Record<QuotationStatus, QuotationStatus[]> = {
        draft: ['sent', 'cancelled'],
        sent: ['accepted', 'rejected', 'cancelled'],
        accepted: ['invoiced', 'cancelled'],
        rejected: [],
        invoiced: ['paid', 'cancelled'],
        paid: [],
        cancelled: [],
        expired: [],
    };
    return allowed[current]?.includes(target) ?? false;
}
```

```typescript
// src/utils/quotation-number.test.ts
import { describe, it, expect } from 'vitest';
import { generateQuotationNumber, parseQuotationNumber, determineStatusTransition } from './quotation-number';

describe('generateQuotationNumber', () => {
    it('generates with prefix and sequence', () => {
        vi.setSystemTime(new Date('2026-04-23'));
        const result = generateQuotationNumber('QT', 42);
        expect(result).toBe('QT-2026-000042');
        vi.useRealTimers();
    });

    it('pads sequence to 6 digits', () => {
        expect(generateQuotationNumber('Q', 1)).toMatch(/-\d{6}$/);
    });

    it.each([
        { prefix: '', seq: 1, desc: 'empty prefix' },
        { prefix: 'abc', seq: 1, desc: 'lowercase prefix' },
        { prefix: 'TOOLONGPREFIX', seq: 1, desc: 'prefix too long' },
        { prefix: 'QT', seq: 0, desc: 'zero sequence' },
        { prefix: 'QT', seq: -1, desc: 'negative sequence' },
        { prefix: 'QT', seq: 1.5, desc: 'non-integer sequence' },
    ])('throws on invalid input: $desc', ({ prefix, seq }) => {
        expect(() => generateQuotationNumber(prefix, seq)).toThrow();
    });
});

describe('parseQuotationNumber', () => {
    it('parses valid quotation number', () => {
        expect(parseQuotationNumber('QT-2026-000042')).toEqual({
            prefix: 'QT',
            year: 2026,
            sequence: 42,
        });
    });

    it.each([
        'invalid',
        'QT-2026',
        'QT-2026-42',      // not padded
        'qt-2026-000042',  // lowercase
        'QT-26-000042',    // 2-digit year
        '',
    ])('returns null for invalid: "%s"', (input) => {
        expect(parseQuotationNumber(input)).toBeNull();
    });
});

describe('determineStatusTransition', () => {
    it.each([
        { from: 'draft', to: 'sent', allowed: true },
        { from: 'draft', to: 'cancelled', allowed: true },
        { from: 'draft', to: 'accepted', allowed: false },
        { from: 'sent', to: 'accepted', allowed: true },
        { from: 'sent', to: 'rejected', allowed: true },
        { from: 'accepted', to: 'invoiced', allowed: true },
        { from: 'paid', to: 'cancelled', allowed: false },
        { from: 'cancelled', to: 'draft', allowed: false },
    ])('from "$from" to "$to" → $allowed', ({ from, to, allowed }) => {
        expect(determineStatusTransition(from, to)).toBe(allowed);
    });
});
```

## Test Organization Patterns

### One Test per Behavior

```typescript
describe('QuotationStatus', () => {
    // GOOD — one test per behavior
    it('allows draft → sent', () => { /* ... */ });
    it('allows draft → cancelled', () => { /* ... */ });
    it('rejects draft → accepted', () => { /* ... */ });
    it('rejects draft → paid', () => { /* ... */ });

    // BAD — multiple assertions on different behaviors
    it('validates all transitions', () => {
        expect(canTransition('draft', 'sent')).toBe(true);
        expect(canTransition('draft', 'accepted')).toBe(false);
        expect(canTransition('sent', 'accepted')).toBe(true);
        // If first assertion fails, we don't know about the others
    });
});
```

### Arrange-Act-Assert Pattern

```typescript
it('calculates total with discount', () => {
    // Arrange — set up test data
    const items = [
        { name: 'Widget', price: 100, quantity: 5 },
        { name: 'Gadget', price: 200, quantity: 3 },
    ];
    const taxRate = 0.07;
    const discount = 100;

    // Act — call the function under test
    const result = calculateTotal(items, taxRate, discount);

    // Assert — verify the result
    expect(result.subtotal).toBe(1100);
    expect(result.tax).toBe(70);
    expect(result.discount).toBe(100);
    expect(result.total).toBe(1070);
});
```

## Code Style Rules

- Write one test per behavior — a test that asserts 5 unrelated things should be 5 tests.
- Use `describe` to group tests by function/method — nest for happy/sad paths.
- Follow Arrange-Act-Assert — clear three-phase structure in every test.
- Use `vi.clearAllMocks()` in `beforeEach` — prevent test pollution from leftover mock state.
- Use `vi.restoreAllMocks()` in `afterEach` — restore spied objects to original implementations.
- Use `vi.fn()` for simple mock functions — use `vi.spyOn()` for existing object methods.
- Use `vi.mock()` for module-level mocking — hoisted before imports, works for dependency injection.
- Use fakes (in-memory implementations) over mocks for repositories — real behavior, less brittle.
- Use `it.each` for parameterized tests — cover many inputs without repeating test structure.
- Name tests descriptively — "returns 404 for non-existent quotation" not "test not found".
- Test edge cases: empty, null, undefined, zero, negative, boundary values, very large inputs.
- Use `expect.unreachable()` to fail if code reaches unexpected line — catch missed throws.
- Use `vi.useFakeTimers()` for time-dependent tests — never rely on real time or `setTimeout` in tests.
- Use `vi.setSystemTime()` for fixed-date tests — `new Date()` returns deterministic value.
- Keep unit tests fast (under 100ms each) — mock external deps, no network, no filesystem, no real DB.
