---
name: input-validation
description: Input validation and sanitization — Zod schemas, validation middleware, request body/query/params validation, custom validators, error formatting, file upload validation, SQL injection prevention, XSS sanitization, validation testing, and defensive boundary patterns for TypeScript/Node.js applications
---

# Input Validation

## Validation Philosophy

```
Rules:
1. Validate at EVERY system boundary (API, CLI, database, external API)
2. Never trust client input — even from your own frontend
3. Validate early, reject fast — before business logic
4. Whitelist allowed input — never blacklist dangerous input
5. Transform AND validate — coerce types, then check constraints
6. Return clear errors — tell the user exactly what's wrong

Boundaries:
  HTTP Request → Validate body, query, params, headers
  Database Read → Validate shapes from raw SQL results
  External API  → Validate response before using it
  CLI Input     → Validate arguments and flags
  File Upload   → Validate type, size, content
```

## Zod Schemas

### Setup

```bash
npm install zod
```

### Primitive Validators

```typescript
import { z } from 'zod';

// String
const name = z.string().min(1).max(200).trim();
const email = z.string().email().toLowerCase();
const phone = z.string().regex(/^\+?[0-9]{9,15}$/, 'Invalid phone number');
const url = z.string().url();
const uuid = z.string().uuid();
const currency = z.enum(['THB', 'USD', 'EUR', 'JPY', 'GBP']);
const status = z.enum(['draft', 'pending_review', 'approved', 'rejected', 'expired', 'cancelled']);
const thaiText = z.string().regex(/^[฀-๿\sA-Za-z0-9.,()-]+$/);

// Number
const price = z.number().nonnegative().max(99_999_999).finite();
const percent = z.number().min(0).max(100);
const quantity = z.number().int().positive().max(99999);
const taxRate = z.number().min(0).max(100).default(7);

// Date
const isoDate = z.string().datetime();
const dateObject = z.date();
const futureDate = z.date().min(new Date(), 'Date must be in the future');

// Boolean
const flag = z.boolean();

// Nullable / Optional
const optionalName = z.string().min(1).max(200).optional();
const nullableNotes = z.string().max(5000).nullable();
const notesOrNull = z.string().max(5000).nullish(); // null | undefined

// Coercion (transform input type)
const numFromString = z.coerce.number(); // "42" → 42
const boolFromString = z.coerce.boolean(); // "true" → true
const dateFromString = z.coerce.date(); // "2024-01-01" → Date
```

### Object Schemas

```typescript
// src/schemas/quotation.schema.ts
import { z } from 'zod';

const QuotationItemSchema = z.object({
    description: z.string().min(1, 'Item description is required').max(500),
    quantity: z.coerce.number().int().positive('Quantity must be at least 1').max(99999),
    unitPrice: z.coerce.number().nonnegative('Price cannot be negative').max(99_999_999),
}).strict(); // Reject unknown fields

const CreateQuotationSchema = z.object({
    customerId: z.string().uuid('Invalid customer ID'),
    items: z.array(QuotationItemSchema).min(1, 'At least one item is required').max(100),
    discountPercent: z.coerce.number().min(0).max(100).default(0),
    discountFixed: z.coerce.number().nonnegative().max(99_999_999).default(0),
    taxRate: z.coerce.number().min(0).max(100).default(7),
    currency: z.enum(['THB', 'USD', 'EUR']).default('THB'),
    notes: z.string().max(2000).optional(),
    validUntil: z.coerce.date().optional(),
}).strict().refine(
    (data) => !(data.discountPercent > 0 && data.discountFixed > 0),
    { message: 'Cannot use both percentage and fixed discount', path: ['discountPercent'] }
);

type CreateQuotationInput = z.infer<typeof CreateQuotationSchema>;

const UpdateQuotationSchema = z.object({
    customerId: z.string().uuid().optional(),
    items: z.array(QuotationItemSchema).min(1).max(100).optional(),
    discountPercent: z.coerce.number().min(0).max(100).optional(),
    discountFixed: z.coerce.number().nonnegative().max(99_999_999).optional(),
    taxRate: z.coerce.number().min(0).max(100).optional(),
    notes: z.string().max(2000).nullable().optional(),
    status: z.enum(['draft', 'pending_review']).optional(),
}).strict();

type UpdateQuotationInput = z.infer<typeof UpdateQuotationSchema>;
```

### Query / Pagination Schema

```typescript
// src/schemas/pagination.schema.ts
const PaginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['createdAt', 'updatedAt', 'total', 'status']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
});

const QuotationFilterSchema = PaginationSchema.extend({
    status: z.enum(['draft', 'pending_review', 'approved', 'rejected', 'expired', 'cancelled']).optional(),
    search: z.string().max(200).optional(),
    customerId: z.string().uuid().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    minTotal: z.coerce.number().nonnegative().optional(),
    maxTotal: z.coerce.number().nonnegative().optional(),
}).refine(
    (data) => {
        if (data.minTotal !== undefined && data.maxTotal !== undefined) {
            return data.minTotal <= data.maxTotal;
        }
        return true;
    },
    { message: 'minTotal must be less than or equal to maxTotal', path: ['minTotal'] }
);

type QuotationFilter = z.infer<typeof QuotationFilterSchema>;
```

### Auth Schemas

```typescript
// src/schemas/auth.schema.ts
const RegisterSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(200),
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128)
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string(),
}).strict().refine(
    (data) => data.password === data.confirmPassword,
    { message: 'Passwords do not match', path: ['confirmPassword'] }
);

const LoginSchema = z.object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(1, 'Password is required'),
}).strict();

const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string()
        .min(8).max(128)
        .regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
    confirmPassword: z.string(),
}).strict().refine(
    (data) => data.newPassword === data.confirmPassword,
    { message: 'Passwords do not match', path: ['confirmPassword'] }
);
```

## Validation Middleware

### Generic Validator

```typescript
// src/middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

interface ValidationSchemas {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
    headers?: ZodSchema;
}

function validate(schemas: ValidationSchemas) {
    return (req: Request, res: Response, next: NextFunction) => {
        const errors: Record<string, unknown[]> = {};

        for (const [target, schema] of Object.entries(schemas)) {
            const result = schema.safeParse(req[target as keyof Request]);

            if (!result.success) {
                errors[target] = formatZodErrors(result.error);
            } else {
                // Replace with validated + transformed data
                (req as any)[target] = result.data;
            }
        }

        if (Object.keys(errors).length > 0) {
            return res.status(422).json({
                error: 'Validation failed',
                details: errors,
            });
        }

        next();
    };
}

function formatZodErrors(error: ZodError): unknown[] {
    return error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
    }));
}

export { validate };
```

### Route Usage

```typescript
import { Router } from 'elit/router';
import { validate } from '../middleware/validate';
import { CreateQuotationSchema, UpdateQuotationSchema } from '../schemas/quotation.schema';
import { PaginationSchema, QuotationFilterSchema } from '../schemas/pagination.schema';
import { LoginSchema, RegisterSchema } from '../schemas/auth.schema';

const router = Router();

// Auth
router.post('/auth/register', validate({ body: RegisterSchema }), register);
router.post('/auth/login', validate({ body: LoginSchema }), login);

// Quotation CRUD
router.post('/quotations',
    authenticate,
    validate({ body: CreateQuotationSchema }),
    createQuotation
);

router.get('/quotations',
    authenticate,
    validate({ query: QuotationFilterSchema }),
    listQuotations
);

router.get('/quotations/:id',
    authenticate,
    validate({ params: z.object({ id: z.string().uuid() }) }),
    getQuotation
);

router.patch('/quotations/:id',
    authenticate,
    validate({
        params: z.object({ id: z.string().uuid() }),
        body: UpdateQuotationSchema,
    }),
    updateQuotation
);

router.delete('/quotations/:id',
    authenticate,
    validate({ params: z.object({ id: z.string().uuid() }) }),
    deleteQuotation
);
```

## Custom Validators

### Reusable Zod Extensions

```typescript
// src/schemas/extensions.ts
import { z, RefinementCtx } from 'zod';

// Phone number (Thai + international)
const PhoneSchema = z.string().regex(
    /^(\+66|0)[0-9]{8,9}$/,
    'Invalid Thai phone number (e.g., 0812345678 or +66812345678)'
);

// Strong password
const StrongPasswordSchema = z.string()
    .min(8, 'At least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Requires uppercase')
    .regex(/[a-z]/, 'Requires lowercase')
    .regex(/[0-9]/, 'Requires number')
    .regex(/[^A-Za-z0-9]/, 'Requires special character');

// Date range
function dateRangeSchema(startField: string, endField: string) {
    return z.object({
        [startField]: z.coerce.date(),
        [endField]: z.coerce.date(),
    }).refine(
        (data) => data[startField] < data[endField],
        { message: `${startField} must be before ${endField}`, path: [endField] }
    );
}

// Money amount (no negative, reasonable max)
const MoneySchema = z.number()
    .nonnegative()
    .max(99_999_999)
    .multipleOf(0.01, 'Max 2 decimal places');

// Percentage
const PercentageSchema = z.number().min(0).max(100);

// Safe HTML (basic — use DOMPurify for full)
const SafeTextSchema = z.string()
    .max(5000)
    .transform(val => val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''))
    .transform(val => val.replace(/<[^>]*>/g, '')); // Strip all tags

// Non-empty trimmed string
const NonEmptyString = z.string().trim().min(1);

// CSV of UUIDs
const UuidListSchema = z.string()
    .transform(val => val.split(',').map(s => s.trim()))
    .pipe(z.array(z.string().uuid()).min(1).max(50));

// JSON string
function jsonSchema<T extends z.ZodType>(schema: T) {
    return z.string()
        .transform((val, ctx): z.infer<T> => {
            try {
                return JSON.parse(val);
            } catch {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Invalid JSON string',
                });
                return z.NEVER;
            }
        })
        .pipe(schema);
}

// File upload
interface FileConstraint {
    maxSize: number;        // bytes
    mimeTypes: string[];    // allowed MIME types
}

function fileSchema(constraints: FileConstraint) {
    return z.object({
        fieldname: z.string(),
        originalname: z.string().max(255),
        mimetype: z.string().refine(
            (type) => constraints.mimeTypes.includes(type),
            `File type must be one of: ${constraints.mimeTypes.join(', ')}`
        ),
        size: z.number().max(
            constraints.maxSize,
            `File size must be less than ${Math.round(constraints.maxSize / 1024 / 1024)}MB`
        ),
    });
}

const ImageUploadSchema = fileSchema({
    maxSize: 5 * 1024 * 1024, // 5MB
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
});

const PdfUploadSchema = fileSchema({
    maxSize: 10 * 1024 * 1024, // 10MB
    mimeTypes: ['application/pdf'],
});

export {
    PhoneSchema, StrongPasswordSchema, dateRangeSchema,
    MoneySchema, PercentageSchema, SafeTextSchema,
    NonEmptyString, UuidListSchema, jsonSchema,
    fileSchema, ImageUploadSchema, PdfUploadSchema,
};
```

## Error Formatting

### Structured Validation Errors

```typescript
// src/utils/validation-errors.ts
import { ZodError } from 'zod';

interface FieldError {
    field: string;
    message: string;
    value?: unknown;
    constraint: string;
}

function formatValidationErrors(error: ZodError): FieldError[] {
    return error.issues.map(issue => ({
        field: issue.path.join('.') || '_root',
        message: issue.message,
        constraint: issue.code,
    }));
}

function formatValidationResponse(error: ZodError, target: string) {
    const errors = formatValidationErrors(error);

    return {
        error: 'Validation failed',
        target,
        errors,
        errorCount: errors.length,
    };
}

// Response example:
// {
//   "error": "Validation failed",
//   "target": "body",
//   "errorCount": 2,
//   "errors": [
//     { "field": "items[0].quantity", "message": "Quantity must be at least 1", "constraint": "too_small" },
//     { "field": "discountPercent", "message": "Cannot exceed 100", "constraint": "too_big" }
//   ]
// }
```

### Custom Error Messages

```typescript
// src/schemas/messages.ts
import { z } from 'zod';
import { z as zod } from 'zod';

const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
    switch (issue.code) {
        case z.ZodIssueCode.invalid_type:
            if (issue.received === 'undefined') {
                return { message: 'This field is required' };
            }
            return { message: `Expected ${issue.expected}, received ${issue.received}` };

        case z.ZodIssueCode.too_small:
            if (issue.type === 'string') {
                return { message: `Must be at least ${issue.minimum} characters` };
            }
            if (issue.type === 'number') {
                return { message: `Must be at least ${issue.minimum}` };
            }
            break;

        case z.ZodIssueCode.too_big:
            if (issue.type === 'string') {
                return { message: `Must be at most ${issue.maximum} characters` };
            }
            if (issue.type === 'number') {
                return { message: `Must be at most ${issue.maximum}` };
            }
            break;

        case z.ZodIssueCode.invalid_string:
            if (issue.validation === 'email') {
                return { message: 'Invalid email address' };
            }
            if (issue.validation === 'uuid') {
                return { message: 'Invalid ID format' };
            }
            break;

        case z.ZodIssueCode.invalid_enum_value':
            return {
                message: `Must be one of: ${issue.options.join(', ')}`,
            };
    }

    return { message: issue.message ?? 'Invalid value' };
};

z.setErrorMap(customErrorMap);
```

## SQL Injection Prevention

### Parameterized Queries

```typescript
// ✅ SAFE: Parameterized queries
async function findQuotation(id: string) {
    const result = await db.query(
        'SELECT * FROM quotations WHERE id = $1',
        [id]
    );
    return result.rows[0];
}

async function searchQuotations(query: string, status: string) {
    const result = await db.query(
        'SELECT * FROM quotations WHERE (title ILIKE $1) AND status = $2 ORDER BY created_at DESC',
        [`%${query}%`, status]
    );
    return result.rows;
}

async function updateQuotation(id: string, data: { status: string; total: number }) {
    const result = await db.query(
        'UPDATE quotations SET status = $1, total = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
        [data.status, data.total, id]
    );
    return result.rows[0];
}

// ❌ NEVER DO: String concatenation
// const query = `SELECT * FROM quotations WHERE id = '${id}'`;
// const query = `SELECT * FROM quotations WHERE title LIKE '%${search}%'`;
```

### Query Builder Safety

```typescript
// Dynamic queries with safe parameterization
interface FilterParams {
    status?: string;
    customerId?: string;
    dateFrom?: Date;
    dateTo?: Date;
}

function buildQuotationQuery(filters: FilterParams) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filters.status);
    }

    if (filters.customerId) {
        conditions.push(`customer_id = $${paramIndex++}`);
        params.push(filters.customerId);
    }

    if (filters.dateFrom) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(filters.dateTo);
    }

    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    return {
        query: `SELECT * FROM quotations ${whereClause} ORDER BY created_at DESC`,
        params,
    };
}

// Column names — whitelist only
const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'total', 'status'] as const;
type SortColumn = typeof ALLOWED_SORT_COLUMNS[number];

function validateSortColumn(column: string): SortColumn {
    const valid = ALLOWED_SORT_COLUMNS.find(c => c === column);
    if (!valid) throw new Error(`Invalid sort column: ${column}`);
    return valid;
}
```

## XSS Prevention

### Output Encoding

```typescript
import { text } from 'elit';

// Elit's text() function auto-escapes HTML entities
// Use text() for all user-provided content in templates

// Manual escaping when needed
function escapeHtml(str: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
    };
    return str.replace(/[&<>"']/g, char => map[char]);
}

// Sanitize for HTML attribute context
function escapeAttr(str: string): string {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Sanitize for URL context
function sanitizeUrl(url: string): string {
    const allowed = ['http://', 'https://', 'mailto:', 'tel:'];
    const trimmed = url.trim().toLowerCase();
    if (allowed.some(prefix => trimmed.startsWith(prefix))) {
        return url;
    }
    return '#'; // Block javascript:, data: URLs
}
```

### Content Security Policy

```typescript
// Generate CSP nonce per request
import { randomBytes } from 'crypto';

function cspNonce(): string {
    return randomBytes(16).toString('base64');
}

function cspHeaders(nonce: string): Record<string, string> {
    return {
        'Content-Security-Policy': [
            `default-src 'self'`,
            `script-src 'self' 'nonce-${nonce}'`,
            `style-src 'self' 'nonce-${nonce}'`,
            `img-src 'self' data: https:`,
            `font-src 'self'`,
            `connect-src 'self'`,
            `frame-ancestors 'none'`,
            `base-uri 'self'`,
            `form-action 'self'`,
        ].join('; '),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '0', // Deprecated, but prevents legacy browser attacks
        'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
}
```

## File Upload Validation

### Multer + Zod

```typescript
import multer from 'multer';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 5;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES,
        fields: 20,
        fieldSize: 1024 * 100, // 100KB per field
    },
    fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
            return cb(new Error(`File type ${file.mimetype} is not allowed`));
        }
        cb(null, true);
    },
});

// Validate file content (not just extension/mimetype)
async function validateImageContent(buffer: Buffer): Promise<boolean> {
    // Check magic bytes (file signature)
    const magic = buffer.toString('hex', 0, 4);

    const signatures: Record<string, string[]> = {
        'image/jpeg': ['ffd8ffe0', 'ffd8ffe1'],
        'image/png': ['89504e47'],
        'image/webp': ['52494646'], // RIFF + WEBP
    };

    return Object.values(signatures).flat().includes(magic);
}

// Route
router.post(
    '/quotations/:id/attachments',
    authenticate,
    upload.array('files', MAX_FILES),
    validate({ params: z.object({ id: z.string().uuid() }) }),
    uploadAttachments
);
```

## Validation Testing

### Schema Tests

```typescript
// tests/schemas/quotation.schema.test.ts
import { describe, it, expect } from 'vitest';
import { CreateQuotationSchema, UpdateQuotationSchema } from '../../src/schemas/quotation.schema';

describe('CreateQuotationSchema', () => {
    const validInput = {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        items: [
            { description: 'Widget', quantity: 10, unitPrice: 100 },
        ],
    };

    it('accepts valid input', () => {
        const result = CreateQuotationSchema.safeParse(validInput);
        expect(result.success).toBe(true);
    });

    it('rejects empty items', () => {
        const result = CreateQuotationSchema.safeParse({
            ...validInput,
            items: [],
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toContain('At least one item');
        }
    });

    it('rejects negative price', () => {
        const result = CreateQuotationSchema.safeParse({
            ...validInput,
            items: [{ description: 'X', quantity: 1, unitPrice: -10 }],
        });
        expect(result.success).toBe(false);
    });

    it('rejects zero quantity', () => {
        const result = CreateQuotationSchema.safeParse({
            ...validInput,
            items: [{ description: 'X', quantity: 0, unitPrice: 100 }],
        });
        expect(result.success).toBe(false);
    });

    it('rejects both discount types simultaneously', () => {
        const result = CreateQuotationSchema.safeParse({
            ...validInput,
            discountPercent: 10,
            discountFixed: 500,
        });
        expect(result.success).toBe(false);
    });

    it('applies defaults', () => {
        const result = CreateQuotationSchema.safeParse(validInput);
        if (result.success) {
            expect(result.data.taxRate).toBe(7);
            expect(result.data.discountPercent).toBe(0);
            expect(result.data.currency).toBe('THB');
        }
    });

    it('coerces string numbers', () => {
        const result = CreateQuotationSchema.safeParse({
            ...validInput,
            items: [{ description: 'X', quantity: '10', unitPrice: '100' }],
        });
        expect(result.success).toBe(true);
    });

    it('rejects unknown fields (strict mode)', () => {
        const result = CreateQuotationSchema.safeParse({
            ...validInput,
            unknownField: 'value',
        });
        expect(result.success).toBe(false);
    });

    it('trims whitespace from description', () => {
        const result = CreateQuotationSchema.safeParse({
            ...validInput,
            items: [{ description: '  Widget  ', quantity: 1, unitPrice: 100 }],
        });
        if (result.success) {
            expect(result.data.items[0].description).toBe('Widget');
        }
    });
});
```

### Middleware Integration Test

```typescript
// tests/integration/validation.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('Validation Middleware', () => {
    describe('POST /api/quotations', () => {
        it('returns 422 for invalid body', async () => {
            const res = await request(app)
                .post('/api/quotations')
                .set('Authorization', 'Bearer test-token')
                .send({ items: [] }) // missing customerId, empty items
                .expect(422);

            expect(res.body.error).toBe('Validation failed');
            expect(res.body.errors).toBeInstanceOf(Array);
        });

        it('returns specific field errors', async () => {
            const res = await request(app)
                .post('/api/quotations')
                .set('Authorization', 'Bearer test-token')
                .send({
                    customerId: 'not-a-uuid',
                    items: [{ description: '', quantity: -1, unitPrice: 'abc' }],
                })
                .expect(422);

            const fields = res.body.errors.map((e: any) => e.field);
            expect(fields).toContain('customerId');
            expect(fields).toContain('items[0].quantity');
        });

        it('accepts valid input', async () => {
            await request(app)
                .post('/api/quotations')
                .set('Authorization', 'Bearer test-token')
                .send({
                    customerId: '550e8400-e29b-41d4-a716-446655440000',
                    items: [{ description: 'Widget', quantity: 10, unitPrice: 100 }],
                })
                .expect(201);
        });
    });

    describe('GET /api/quotations', () => {
        it('returns 422 for invalid query params', async () => {
            const res = await request(app)
                .get('/api/quotations?limit=999&sort=invalid')
                .set('Authorization', 'Bearer test-token')
                .expect(422);
        });

        it('applies default pagination', async () => {
            const res = await request(app)
                .get('/api/quotations')
                .set('Authorization', 'Bearer test-token')
                .expect(200);

            // Defaults applied: page=1, limit=20, sort=createdAt, order=desc
        });
    });
});
```

## Code Style Rules

- Validate ALL external input at the boundary using Zod — body, query, params, headers
- Use `.strict()` on object schemas to reject unknown fields
- Use `z.coerce` to transform string inputs to correct types before validation
- Add `.refine()` for cross-field validation (e.g., date ranges, discount conflict)
- Return 422 (not 400) for validation errors with structured field-level messages
- Use parameterized queries ($1, $2) for ALL database operations — never concatenate SQL
- Whitelist sort columns and enum values — never pass user input directly to SQL ORDER BY
- Sanitize URLs by checking protocol prefix (block javascript:, data: URLs)
- Validate file uploads by MIME type AND magic bytes — never trust the extension
- Set `multer.limits` for file size and count to prevent denial of service
- Write schema tests for every validation rule — valid input, each invalid case, defaults, coercion
