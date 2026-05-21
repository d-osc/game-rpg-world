---
name: backward-compatibility
description: Backward compatibility patterns — API versioning, deprecation strategies, migration guides, feature flags, adapter patterns, database schema evolution, graceful degradation, compatibility layers, and breaking change management for TypeScript/Node.js applications
---

# Backward Compatibility

## Breaking Change Classification

### What Is a Breaking Change

```
API Breaking Changes:
- Removing or renaming an endpoint
- Changing HTTP method (GET → POST)
- Changing request body shape (field renamed/removed)
- Changing response body shape
- Changing error response format
- Changing authentication mechanism
- Adding required fields to request
- Removing fields from response
- Changing status codes (200 → 201)
- Changing pagination format
- Changing rate limit behavior

Database Breaking Changes:
- Dropping a column
- Renaming a column
- Changing column type (INT → TEXT)
- Adding NOT NULL without default
- Removing a table
- Changing foreign key constraints
- Changing index behavior

Non-Breaking (Safe) Changes:
- Adding a new endpoint
- Adding optional fields to request
- Adding new fields to response
- Adding new enum values (if consumers handle unknown)
- Adding new query parameters (optional)
- Adding new response headers
- Improving error messages (same codes)
- Performance improvements
- Bug fixes that match documented behavior
```

## API Versioning Strategies

### URL Path Versioning (Recommended)

```typescript
// Simple, explicit, cacheable
// /api/v1/quotations
// /api/v2/quotations

// Router structure
// src/routes/
//   v1/
//     quotations.ts
//     customers.ts
//   v2/
//     quotations.ts
//     customers.ts

import { Router } from 'elit/router';

const app = Router();

// Mount versioned routes
app.use('/api/v1', v1Routes);
app.use('/api/v2', v2Routes);

// Default to latest
app.use('/api', v2Routes);
```

### Header Versioning

```typescript
// Accept: application/vnd.quotation.v2+json
// X-API-Version: 2

function getVersion(req: Request): number {
    const headerVersion = req.headers['x-api-version'];
    if (headerVersion) return parseInt(headerVersion as string);

    const accept = req.headers.accept ?? '';
    const match = accept.match(/vnd\.quotation\.v(\d+)\+json/);
    if (match) return parseInt(match[1]);

    return 2; // default to latest
}

// Version middleware
function versionMiddleware(versions: Record<number, Handler>): Handler {
    return (req, res, next) => {
        const version = getVersion(req);
        const handler = versions[version];

        if (!handler) {
            return res.status(400).json({
                error: `API version ${version} is not supported`,
                supportedVersions: Object.keys(versions).map(Number),
            });
        }

        handler(req, res, next);
    };
}

// Usage
app.get('/api/quotations', versionMiddleware({
    1: v1ListQuotations,
    2: v2ListQuotations,
}));
```

### Response Shape Adapter

```typescript
// Adapters transform new internal format to old API shape
interface QuotationV1 {
    id: string;
    customerName: string;
    lineItems: Array<{ desc: string; qty: number; price: number }>;
    totalAmount: number;
    status: string;
}

interface QuotationV2 {
    id: string;
    customer: { id: string; name: string; email: string };
    items: Array<{ id: string; description: string; quantity: number; unitPrice: number; total: number }>;
    subtotal: number;
    discount: { type: string; value: number; amount: number };
    tax: { rate: number; amount: number };
    total: number;
    currency: string;
    status: string;
    createdAt: string;
    updatedAt: string;
}

function adaptV2ToV1(v2: QuotationV2): QuotationV1 {
    return {
        id: v2.id,
        customerName: v2.customer.name,
        lineItems: v2.items.map(item => ({
            desc: item.description,
            qty: item.quantity,
            price: item.unitPrice,
        })),
        totalAmount: v2.total,
        status: v2.status,
    };
}

// In route handler
async function v1ListQuotations(req: Request, res: Response) {
    const quotations = await quotationService.list(req.query);
    // Return V1 shape
    res.json(quotations.map(adaptV2ToV1));
}

async function v2ListQuotations(req: Request, res: Response) {
    const quotations = await quotationService.list(req.query);
    // Return V2 shape (native)
    res.json(quotations);
}
```

## Deprecation Strategy

### Deprecation Lifecycle

```
1. Announce    → Add deprecation notice, update docs
2. Soft deprecate → Add Sunset header, log warnings
3. Hard deprecate → Return 299 with warning message
4. Remove      → Return 410 Gone with migration guide

Timeline example:
  v1 deprecated when v2 ships
  v1 soft-deprecated for 6 months
  v1 returns 299 for 3 months
  v1 removed after 9 months total
```

### Deprecation Headers

```typescript
// Middleware to add deprecation headers
function deprecated(version: string, sunset: string, migration: string) {
    return (_req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', new Date(sunset).toUTCString());
        res.setHeader('X-Deprecated-Version', version);
        res.setHeader('Link', `<${migration}>; rel="deprecation"; type="text/html"`);
        next();
    };
}

// Apply to v1 routes
app.use('/api/v1', deprecated('v1', '2025-12-01', 'https://docs.example.com/migration/v1-to-v2'));

// Response header examples:
// Deprecation: true
// Sunset: Sat, 01 Dec 2025 00:00:00 GMT
// X-Deprecated-Version: v1
// Link: <https://docs.example.com/migration/v1-to-v2>; rel="deprecation"; type="text/html"
```

### Deprecation Logging

```typescript
import pino from 'pino';
const logger = pino();

const deprecationWarnings = new Map<string, number>();

function logDeprecation(endpoint: string, version: string, caller?: string) {
    const key = `${endpoint}:${caller ?? 'unknown'}`;
    const count = deprecationWarnings.get(key) ?? 0;

    // Only log once per caller per endpoint (avoid spam)
    if (count === 0) {
        logger.warn({
            type: 'deprecation',
            endpoint,
            version,
            caller,
        }, `Deprecated ${version} endpoint ${endpoint} was called`);
    }

    deprecationWarnings.set(key, count + 1);
}

// Usage in deprecated handler
async function v1GetQuotation(req: Request, res: Response) {
    const caller = req.headers['x-client-id'] as string;
    logDeprecation('GET /api/v1/quotations/:id', 'v1', caller);

    // ... handler logic
}
```

## Database Schema Evolution

### Non-Breaking Schema Changes

```sql
-- SAFE: Add nullable column
ALTER TABLE quotations ADD COLUMN notes TEXT;

-- SAFE: Add column with default
ALTER TABLE quotations ADD COLUMN currency TEXT NOT NULL DEFAULT 'THB';

-- SAFE: Add new table
CREATE TABLE quotation_tags (
    quotation_id UUID REFERENCES quotations(id),
    tag TEXT NOT NULL,
    PRIMARY KEY (quotation_id, tag)
);

-- SAFE: Add index
CREATE INDEX idx_quotations_status ON quotations(status);

-- SAFE: Widen column type
ALTER TABLE quotations ALTER COLUMN notes TYPE TEXT;

-- SAFE: Add check constraint (validates existing data)
ALTER TABLE quotations ADD CONSTRAINT chk_total_positive CHECK (total >= 0);
```

### Breaking Schema Changes (Require Migration)

```sql
-- BREAKING: Rename column → multi-step migration

-- Step 1: Add new column (keep old)
ALTER TABLE quotations ADD COLUMN customer_id UUID;

-- Step 2: Backfill data
UPDATE quotations SET customer_id = (
    SELECT id FROM customers WHERE customers.name = quotations.customer_name
);

-- Step 3: Add NOT NULL (after data backfilled)
ALTER TABLE quotations ALTER COLUMN customer_id SET NOT NULL;

-- Step 4: Add foreign key
ALTER TABLE quotations
    ADD CONSTRAINT fk_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id);

-- Step 5: Update application to use new column

-- Step 6 (later release): Drop old column
-- Only after all code reads from customer_id
ALTER TABLE quotations DROP COLUMN customer_name;
```

### Migration Template

```typescript
// migrations/004_add_customer_id.ts
import type { Migration } from './types';

export const up: Migration = async (db) => {
    // Step 1: Add new column (nullable first)
    await db.query(`
        ALTER TABLE quotations ADD COLUMN customer_id UUID;
    `);

    // Step 2: Backfill
    await db.query(`
        UPDATE quotations q
        SET customer_id = c.id
        FROM customers c
        WHERE q.customer_name = c.name;
    `);

    // Step 3: Make non-null (after verification)
    await db.query(`
        ALTER TABLE quotations ALTER COLUMN customer_id SET NOT NULL;
    `);

    // Step 4: Add foreign key
    await db.query(`
        ALTER TABLE quotations
            ADD CONSTRAINT fk_quotation_customer
            FOREIGN KEY (customer_id) REFERENCES customers(id);
    `);

    // Step 5: Add index
    await db.query(`
        CREATE INDEX idx_quotations_customer_id ON quotations(customer_id);
    `);
};

export const down: Migration = async (db) => {
    await db.query(`DROP INDEX IF EXISTS idx_quotations_customer_id`);
    await db.query(`ALTER TABLE quotations DROP CONSTRAINT IF EXISTS fk_quotation_customer`);
    await db.query(`ALTER TABLE quotations DROP COLUMN IF EXISTS customer_id`);
};
```

## Feature Flags for Compatibility

### Runtime Compatibility Toggle

```typescript
interface FeatureFlags {
    // API versioning flags
    useV2ResponseFormat: boolean;
    useNewPaginationFormat: boolean;
    includeTaxBreakdown: boolean;

    // Feature flags
    enableDiscountSupport: boolean;
    enablePdfExport: boolean;
    enableMultiCurrency: boolean;
}

// Default flags
const defaultFlags: FeatureFlags = {
    useV2ResponseFormat: true,
    useNewPaginationFormat: false,
    includeTaxBreakdown: false,
    enableDiscountSupport: true,
    enablePdfExport: false,
    enableMultiCurrency: false,
};

// Per-client overrides
class FeatureFlagService {
    private flags: Map<string, Partial<FeatureFlags>> = new Map();

    async getFlags(clientId?: string): Promise<FeatureFlags> {
        if (clientId) {
            const overrides = this.flags.get(clientId);
            if (overrides) return { ...defaultFlags, ...overrides };
        }
        return { ...defaultFlags };
    }

    setClientFlags(clientId: string, flags: Partial<FeatureFlags>): void {
        this.flags.set(clientId, flags);
    }
}

// Usage in route
async function listQuotations(req: Request, res: Response) {
    const clientId = req.headers['x-client-id'] as string;
    const flags = await flagService.getFlags(clientId);

    let quotations = await quotationService.list(req.query);

    // Adapt response based on flags
    if (!flags.useV2ResponseFormat) {
        quotations = quotations.map(adaptV2ToV1);
    }

    if (!flags.useNewPaginationFormat) {
        // Old format: { items: [], total: 100 }
        // New format: { data: [], meta: { total: 100 } }
        return res.json({
            items: quotations.data,
            total: quotations.meta.total,
        });
    }

    res.json(quotations);
}
```

## Adapter Pattern

### Request Adapter

```typescript
// Adapt old request format to new internal format
interface CreateQuotationV1Request {
    customerName: string;
    lineItems: Array<{ desc: string; qty: number; price: number }>;
    discount?: number;
}

interface CreateQuotationV2Request {
    customerId: string;
    items: Array<{ description: string; quantity: number; unitPrice: number }>;
    discount?: { type: 'percentage' | 'fixed'; value: number };
    taxRate?: number;
    currency?: string;
}

function adaptV1RequestToV2(v1: CreateQuotationV1Request): CreateQuotationV2Request {
    return {
        customerId: v1.customerName, // Will be resolved by service
        items: v1.lineItems.map(item => ({
            description: item.desc,
            quantity: item.qty,
            unitPrice: item.price,
        })),
        discount: v1.discount
            ? { type: 'fixed', value: v1.discount }
            : undefined,
    };
}

// Route handler for v1
async function v1CreateQuotation(req: Request, res: Response) {
    const v2Body = adaptV1RequestToV2(req.body);
    const quotation = await quotationService.create(v2Body);
    res.status(201).json(adaptV2ToV1(quotation));
}
```

### Repository Adapter

```typescript
// Old repository interface
interface IQuotationRepositoryV1 {
    findAll(): Promise<QuotationV1[]>;
    findById(id: string): Promise<QuotationV1 | null>;
    create(data: CreateQuotationV1Request): Promise<QuotationV1>;
    update(id: string, data: Partial<CreateQuotationV1Request>): Promise<QuotationV1>;
    delete(id: string): Promise<void>;
}

// New repository interface
interface IQuotationRepositoryV2 {
    list(filters: QuotationFilters): Promise<PaginatedResult<QuotationV2>>;
    get(id: string): Promise<QuotationV2 | null>;
    save(data: CreateQuotationV2Request): Promise<QuotationV2>;
    patch(id: string, data: Partial<CreateQuotationV2Request>): Promise<QuotationV2>;
    remove(id: string): Promise<void>;
}

// Adapter: make V2 repo work where V1 is expected
class QuotationRepositoryAdapter implements IQuotationRepositoryV1 {
    constructor(private v2Repo: IQuotationRepositoryV2) {}

    async findAll(): Promise<QuotationV1[]> {
        const result = await this.v2Repo.list({ limit: 1000 });
        return result.data.map(adaptV2ToV1);
    }

    async findById(id: string): Promise<QuotationV1 | null> {
        const quotation = await this.v2Repo.get(id);
        return quotation ? adaptV2ToV1(quotation) : null;
    }

    async create(data: CreateQuotationV1Request): Promise<QuotationV1> {
        const v2Data = adaptV1RequestToV2(data);
        const quotation = await this.v2Repo.save(v2Data);
        return adaptV2ToV1(quotation);
    }

    async update(id: string, data: Partial<CreateQuotationV1Request>): Promise<QuotationV1> {
        const v2Data = adaptV1RequestToV2(data as CreateQuotationV1Request);
        const quotation = await this.v2Repo.patch(id, v2Data);
        return adaptV2ToV1(quotation);
    }

    async delete(id: string): Promise<void> {
        await this.v2Repo.remove(id);
    }
}
```

## Graceful Degradation

### Response Fallback

```typescript
// Service with fallback for missing features
class QuotationService {
    async generatePdf(quotationId: string): Promise<{ url: string; format: string }> {
        const quotation = await this.repo.get(quotationId);

        // Try PDF generation, fall back to HTML
        try {
            if (this.pdfService.isAvailable()) {
                const url = await this.pdfService.generate(quotation);
                return { url, format: 'pdf' };
            }
        } catch (error) {
            logger.warn({ error }, 'PDF generation failed, falling back to HTML');
        }

        // Fallback: generate HTML view
        const htmlUrl = await this.htmlService.generateView(quotation);
        return { url: htmlUrl, format: 'html' };
    }
}

// API response indicates actual format
// { url: "...", format: "pdf" } or { url: "...", format: "html" }
```

### Version Negotiation

```typescript
function negotiateVersion(
    clientVersions: string[],
    serverVersions: string[]
): string | null {
    // Server prefers latest, client may request specific
    for (const sv of serverVersions) {
        if (clientVersions.includes(sv)) return sv;
    }
    return null;
}

// Middleware
function versionNegotiation(availableVersions: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const acceptVersion = req.headers['accept-version'] as string;

        if (!acceptVersion) {
            // Default to latest
            res.locals.apiVersion = availableVersions[0];
            return next();
        }

        const clientVersions = acceptVersion.split(',').map(v => v.trim());
        const negotiated = negotiateVersion(clientVersions, availableVersions);

        if (!negotiated) {
            return res.status(406).json({
                error: 'No supported API version found',
                clientRequested: clientVersions,
                serverSupported: availableVersions,
            });
        }

        res.locals.apiVersion = negotiated;
        res.setHeader('X-API-Version', negotiated);
        next();
    };
}

app.use('/api', versionNegotiation(['2', '1']));
```

## Migration Guide Template

```markdown
# Migration Guide: v1 → v2

## Overview
API v2 introduces structured customer data, item-level totals, and
tax/discount breakdowns. This guide helps you migrate from v1 to v2.

## Timeline
- **Now**: v2 available, v1 deprecated
- **2025-06-01**: v1 returns `Deprecation: true` header
- **2025-09-01**: v1 returns `299` status with warning
- **2025-12-01**: v1 removed (`410 Gone`)

## Breaking Changes

### 1. Customer field → customer object
```diff
- "customerName": "Acme Corp"
+ "customer": {
+     "id": "cust_123",
+     "name": "Acme Corp",
+     "email": "billing@acme.com"
+ }
```

### 2. lineItems → items (renamed and restructured)
```diff
- "lineItems": [
-     { "desc": "Widget", "qty": 10, "price": 100 }
- ]
+ "items": [
+     {
+         "id": "item_456",
+         "description": "Widget",
+         "quantity": 10,
+         "unitPrice": 100,
+         "total": 1000
+     }
+ ]
```

### 3. totalAmount → total + breakdown
```diff
- "totalAmount": 10700
+ "subtotal": 10000,
+ "discount": { "type": "percentage", "value": 0, "amount": 0 },
+ "tax": { "rate": 0.07, "amount": 700 },
+ "total": 10700,
+ "currency": "THB"
```

### 4. Pagination format changed
```diff
  GET /api/v1/quotations?page=1&limit=20
- { "items": [...], "total": 100 }
+ { "data": [...], "meta": { "total": 100, "page": 1, "limit": 20, "pages": 5 } }
```

## Step-by-Step Migration

### Step 1: Update base URL
Change `/api/v1/` to `/api/v2/` in all API calls.

### Step 2: Update response parsing
Update field names in your code:
| v1 Field | v2 Field |
|----------|----------|
| `customerName` | `customer.name` |
| `lineItems` | `items` |
| `lineItems[].desc` | `items[].description` |
| `lineItems[].qty` | `items[].quantity` |
| `lineItems[].price` | `items[].unitPrice` |
| `totalAmount` | `total` |

### Step 3: Handle pagination
Update pagination parsing from flat to nested meta object.

### Step 4: Test
Use the v2 sandbox at `sandbox.api.example.com/v2/` for testing.

## Need Help?
Contact: api-support@example.com
Docs: https://docs.example.com/api/v2
```

## Compatibility Testing

### Contract Tests

```typescript
// tests/compat/v1-v2.contract.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('API Compatibility', () => {
    describe('V1 shape is preserved', () => {
        it('GET /api/v1/quotations returns V1 shape', async () => {
            const res = await request(app)
                .get('/api/v1/quotations')
                .set('Authorization', 'Bearer test-token')
                .expect(200);

            for (const item of res.body.items ?? res.body) {
                expect(item).toHaveProperty('id');
                expect(item).toHaveProperty('customerName');
                expect(item).toHaveProperty('lineItems');
                expect(item).toHaveProperty('totalAmount');
                expect(item).toHaveProperty('status');

                // Must NOT have V2 fields
                expect(item).not.toHaveProperty('customer');
                expect(item).not.toHaveProperty('items');
                expect(item).not.toHaveProperty('subtotal');
            }
        });

        it('POST /api/v1/quotations accepts V1 request', async () => {
            const res = await request(app)
                .post('/api/v1/quotations')
                .set('Authorization', 'Bearer test-token')
                .send({
                    customerName: 'Test Corp',
                    lineItems: [
                        { desc: 'Item 1', qty: 2, price: 100 },
                    ],
                })
                .expect(201);

            expect(res.body).toHaveProperty('customerName');
            expect(res.body).toHaveProperty('lineItems');
        });
    });

    describe('V1 and V2 produce equivalent data', () => {
        it('same quotation returns equivalent totals', async () => {
            const [v1Res, v2Res] = await Promise.all([
                request(app)
                    .get('/api/v1/quotations/qt-001')
                    .set('Authorization', 'Bearer test-token'),
                request(app)
                    .get('/api/v2/quotations/qt-001')
                    .set('Authorization', 'Bearer test-token'),
            ]);

            // V1 totalAmount should equal V2 total
            expect(v1Res.body.totalAmount).toBe(v2Res.body.total);

            // V1 customerName should equal V2 customer.name
            expect(v1Res.body.customerName).toBe(v2Res.body.customer.name);
        });
    });
});
```

### Deprecation Header Tests

```typescript
describe('Deprecation headers', () => {
    it('V1 endpoints include deprecation headers', async () => {
        const res = await request(app)
            .get('/api/v1/quotations')
            .set('Authorization', 'Bearer test-token');

        expect(res.headers['deprecation']).toBe('true');
        expect(res.headers['sunset']).toBeDefined();
        expect(res.headers['x-deprecated-version']).toBe('v1');
    });

    it('V2 endpoints do NOT include deprecation headers', async () => {
        const res = await request(app)
            .get('/api/v2/quotations')
            .set('Authorization', 'Bearer test-token');

        expect(res.headers['deprecation']).toBeUndefined();
    });
});
```

## Sunset Workflow

### Removing a Deprecated API

```typescript
// Phase 1: Soft deprecation (month 0)
// Add headers, log warnings, update docs
app.get('/api/v1/quotations', deprecated('v1', '2025-12-01', '/docs/migration'), v1Handler);

// Phase 2: Warning response (month 6)
// Add warning to response body
async function v1HandlerWithWarning(req: Request, res: Response) {
    const result = await v1Handler(req, res, () => {});
    res.json({
        ...result,
        _warning: 'API v1 is deprecated and will be removed on 2025-12-01. Please migrate to v2.',
        _migrationGuide: 'https://docs.example.com/migration/v1-to-v2',
    });
}

// Phase 3: Removal (month 9)
// Return 410 Gone with migration info
app.use('/api/v1', (_req: Request, res: Response) => {
    res.status(410).json({
        error: 'API v1 has been removed',
        message: 'This API version is no longer available. Please use v2.',
        migrationGuide: 'https://docs.example.com/migration/v1-to-v2',
        currentVersion: 'v2',
    });
});
```

## Code Style Rules

- Never remove an API endpoint without a deprecation period of at least 6 months
- Always add `Deprecation: true` and `Sunset` headers to deprecated endpoints
- Use adapter pattern to keep old API shapes working against new internal models
- Multi-step database migrations: add new → backfill → update code → drop old (never skip steps)
- Write contract tests verifying old response shapes are preserved
- Every breaking change must include a migration guide with before/after examples
- Use feature flags for gradual rollout of new response formats
- Version routers in separate directories (v1/, v2/) for clear separation
- Log deprecation warnings server-side to track which clients still use old versions
- Never change field names in the same version — add new field, deprecate old, remove in next version
