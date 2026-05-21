---
name: e2e-playwright
description: End-to-end testing with Playwright — browser automation, page object model, multi-browser testing, visual comparison, network interception, authentication state, API testing, test fixtures, parallel execution, CI integration, and E2E best practices
---

# E2E Test (Playwright)

## Setup

### Install

```bash
# Install Playwright
npm init playwright@latest

# Or manually
npm install -D @playwright/test
npx playwright install

# Install specific browsers only
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit
```

### Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    // Test directory
    testDir: './e2e',

    // Test patterns
    testMatch: '**/*.spec.ts',

    // Parallel execution
    fullyParallel: true,

    // Fail build on CI if you accidentally left test.only
    forbidOnly: !!process.env.CI,

    // Retry failed tests on CI
    retries: process.env.CI ? 2 : 0,

    // Parallel workers
    workers: process.env.CI ? 2 : undefined, // undefined = auto (half of CPU cores)

    // Timeout per test
    timeout: 30_000,

    // Timeout for expect assertions
    expect: {
        timeout: 5_000,
    },

    // Reporter
    reporter: process.env.CI
        ? [['github'], ['html', { open: 'never' }], ['list']]
        : [['html', { open: 'on-failure' }], ['list']],

    // Shared settings for all tests
    use: {
        // Base URL
        baseURL: process.env.BASE_URL ?? 'http://localhost:3000',

        // Browser context
        headless: true,
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,

        // Action timeouts
        actionTimeout: 10_000,
        navigationTimeout: 15_000,

        // Artifacts
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
    },

    // Browser projects
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
        // Mobile emulation
        {
            name: 'mobile-chrome',
            use: { ...devices['Pixel 5'] },
        },
        {
            name: 'mobile-safari',
            use: { ...devices['iPhone 13'] },
        },
        // Tablet
        {
            name: 'tablet',
            use: { ...devices['iPad Pro'] },
        },
    ],

    // Start dev server before tests
    webServer: {
        command: 'npm run dev',
        port: 3000,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
```

```json
// package.json scripts
{
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:chromium": "playwright test --project=chromium",
    "test:e2e:mobile": "playwright test --project=mobile-chrome --project=mobile-safari",
    "test:e2e:report": "playwright show-report"
}
```

## Test Structure

### Basic Test

```typescript
// e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
    test('homepage loads successfully', async ({ page }) => {
        await page.goto('/');

        // Verify page title
        await expect(page).toHaveTitle(/Quotation/);

        // Verify main heading
        await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();

        // Verify navigation
        await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    });

    test('navigates to login page', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('link', { name: 'Login' }).click();

        await expect(page).toHaveURL(/.*login/);
        await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    });

    test('404 page for unknown routes', async ({ page }) => {
        await page.goto('/this-page-does-not-exist');

        await expect(page.getByText(/not found|404/i)).toBeVisible();
    });
});
```

### Auth Flow E2E

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test('registers a new user', async ({ page }) => {
        await page.goto('/register');

        // Fill registration form
        await page.getByLabel(/name/i).fill('Test User');
        await page.getByLabel(/email/i).fill(`e2e-${Date.now()}@example.com`);
        await page.getByLabel(/^password$/i).fill('SecurePass123!');
        await page.getByLabel(/confirm password/i).fill('SecurePass123!');

        // Submit
        await page.getByRole('button', { name: /register|sign up/i }).click();

        // Verify redirect to dashboard
        await expect(page).toHaveURL(/.*dashboard/);
        await expect(page.getByText(/welcome.*test user/i)).toBeVisible();
    });

    test('logs in with existing credentials', async ({ page }) => {
        // Seed user via API
        await page.request.post('/api/auth/register', {
            data: {
                name: 'E2E User',
                email: 'e2e-login@example.com',
                password: 'TestPass123!',
            },
        });

        await page.goto('/login');

        await page.getByLabel(/email/i).fill('e2e-login@example.com');
        await page.getByLabel(/password/i).fill('TestPass123!');
        await page.getByRole('button', { name: /sign in|login/i }).click();

        await expect(page).toHaveURL(/.*dashboard/);
    });

    test('shows error on wrong password', async ({ page }) => {
        await page.goto('/login');

        await page.getByLabel(/email/i).fill('e2e-login@example.com');
        await page.getByLabel(/password/i).fill('wrong-password');
        await page.getByRole('button', { name: /sign in|login/i }).click();

        await expect(page.getByText(/invalid.*credentials|incorrect/i)).toBeVisible();
        // Should stay on login page
        await expect(page).toHaveURL(/.*login/);
    });

    test('logs out', async ({ page }) => {
        // Login via API and set auth state
        const loginRes = await page.request.post('/api/auth/login', {
            data: { email: 'e2e-login@example.com', password: 'TestPass123!' },
        });
        const { accessToken } = await loginRes.json();

        // Set auth cookie/token
        await page.goto('/');
        await page.evaluate((token) => {
            localStorage.setItem('auth_token', token);
        }, accessToken);

        await page.goto('/dashboard');
        await expect(page.getByText(/dashboard/i)).toBeVisible();

        // Logout
        await page.getByRole('button', { name: /logout|sign out/i }).click();

        await expect(page).toHaveURL(/.*login/);
    });
});
```

## Page Object Model (POM)

### Base Page

```typescript
// e2e/pages/base.page.ts
import type { Page, Locator, Expect } from '@playwright/test';

export class BasePage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // Navigation helpers
    async goto(path: string) {
        await this.page.goto(path);
        await this.page.waitForLoadState('networkidle');
    }

    // Common locators
    get toast() { return this.page.getByRole('alert'); }
    get loadingSpinner() { return this.page.getByTestId('loading-spinner'); }

    // Wait for loading to finish
    async waitForLoading() {
        await expect(this.loadingSpinner).not.toBeVisible({ timeout: 10_000 });
    }

    // Screenshot helper
    async screenshot(name: string) {
        await this.page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });
    }
}
```

### Login Page

```typescript
// e2e/pages/login.page.ts
import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly submitButton: Locator;
    readonly errorMessage: Locator;
    readonly registerLink: Locator;

    constructor(page: Page) {
        super(page);
        this.emailInput = page.getByLabel(/email/i);
        this.passwordInput = page.getByLabel(/^password$/i);
        this.submitButton = page.getByRole('button', { name: /sign in|login/i });
        this.errorMessage = page.getByRole('alert');
        this.registerLink = page.getByRole('link', { name: /register|sign up/i });
    }

    async goto() {
        await super.goto('/login');
    }

    async login(email: string, password: string) {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.submitButton.click();
    }

    async loginSuccessfully(email: string, password: string) {
        await this.login(email, password);
        await expect(this.page).toHaveURL(/.*dashboard/, { timeout: 10_000 });
    }
}
```

### Quotations List Page

```typescript
// e2e/pages/quotations.page.ts
import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class QuotationsPage extends BasePage {
    readonly heading: Locator;
    readonly createButton: Locator;
    readonly searchInput: Locator;
    readonly statusFilter: Locator;
    readonly quotationRows: Locator;
    readonly emptyState: Locator;
    readonly pagination: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', { name: /quotations/i });
        this.createButton = page.getByRole('button', { name: /create|new.*quotation/i });
        this.searchInput = page.getByPlaceholder(/search/i);
        this.statusFilter = page.getByLabel(/status/i);
        this.quotationRows = page.getByTestId('quotation-row');
        this.emptyState = page.getByText(/no quotations/i);
        this.pagination = page.getByRole('navigation', { name: /pagination/i });
    }

    async goto() {
        await super.goto('/quotations');
        await this.waitForLoading();
    }

    async getQuotationByCustomer(name: string): Promise<Locator> {
        return this.page.getByTestId('quotation-row').filter({ hasText: name });
    }

    async searchFor(query: string) {
        await this.searchInput.fill(query);
        await this.page.waitForResponse(resp => resp.url().includes('/api/quotations') && resp.status() === 200);
    }

    async filterByStatus(status: string) {
        await this.statusFilter.selectOption(status);
        await this.page.waitForResponse(resp => resp.url().includes('/api/quotations') && resp.status() === 200);
    }

    async clickCreateNew() {
        await this.createButton.click();
        await expect(this.page).toHaveURL(/.*quotations\/new/);
    }

    async getQuotationCount(): Promise<number> {
        return this.quotationRows.count();
    }

    async clickQuotation(customerName: string) {
        await this.getQuotationByCustomer(customerName).click();
    }

    async goToPage(pageNum: number) {
        await this.pagination.getByRole('button', { name: String(pageNum) }).click();
        await this.waitForLoading();
    }
}
```

### Create Quotation Page

```typescript
// e2e/pages/create-quotation.page.ts
import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class CreateQuotationPage extends BasePage {
    readonly customerNameInput: Locator;
    readonly customerEmailInput: Locator;
    readonly validUntilInput: Locator;
    readonly notesInput: Locator;
    readonly addItemButton: Locator;
    readonly submitButton: Locator;
    readonly totalDisplay: Locator;

    constructor(page: Page) {
        super(page);
        this.customerNameInput = page.getByLabel(/customer name/i);
        this.customerEmailInput = page.getByLabel(/customer email/i);
        this.validUntilInput = page.getByLabel(/valid until/i);
        this.notesInput = page.getByLabel(/notes/i);
        this.addItemButton = page.getByRole('button', { name: /add item/i });
        this.submitButton = page.getByRole('button', { name: /create|save/i });
        this.totalDisplay = page.getByTestId('total-display');
    }

    async goto() {
        await super.goto('/quotations/new');
    }

    async fillCustomerInfo(data: { name: string; email?: string; validUntil?: string; notes?: string }) {
        await this.customerNameInput.fill(data.name);
        if (data.email) await this.customerEmailInput.fill(data.email);
        if (data.validUntil) await this.validUntilInput.fill(data.validUntil);
        if (data.notes) await this.notesInput.fill(data.notes);
    }

    async addItem(item: { name: string; price: number; quantity: number }, index: number) {
        if (index > 0) await this.addItemButton.click();

        const itemRow = this.page.getByTestId(`item-row-${index}`);
        await itemRow.getByLabel(/item name/i).fill(item.name);
        await itemRow.getByLabel(/price/i).fill(String(item.price));
        await itemRow.getByLabel(/quantity/i).fill(String(item.quantity));
    }

    async submit() {
        await this.submitButton.click();
    }

    async getTotal(): Promise<string> {
        return this.totalDisplay.innerText();
    }
}
```

### Using Page Objects

```typescript
// e2e/quotation-crud.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { QuotationsPage } from './pages/quotations.page';
import { CreateQuotationPage } from './pages/create-quotation.page';

test.describe('Quotation CRUD', () => {
    let loginPage: LoginPage;
    let quotationsPage: QuotationsPage;
    let createPage: CreateQuotationPage;

    test.beforeEach(async ({ page }) => {
        loginPage = new LoginPage(page);
        quotationsPage = new QuotationsPage(page);
        createPage = new CreateQuotationPage(page);

        // Login via API (faster than UI login)
        const res = await page.request.post('/api/auth/login', {
            data: { email: 'e2e@example.com', password: 'TestPass123!' },
        });
        const { accessToken } = await res.json();
        await page.evaluate((token) => localStorage.setItem('auth_token', token), accessToken);
    });

    test('creates a new quotation', async ({ page }) => {
        await quotationsPage.goto();
        await quotationsPage.clickCreateNew();

        await createPage.fillCustomerInfo({
            name: 'Acme Corp',
            email: 'billing@acme.com',
            validUntil: '2030-12-31',
        });

        await createPage.addItem({ name: 'Web Development', price: '50000', quantity: '1' }, 0);
        await createPage.addItem({ name: 'UI Design', price: '30000', quantity: '2' }, 1);

        // Verify total calculated
        const total = await createPage.getTotal();
        expect(total).toContain('117,700');

        await createPage.submit();

        // Verify redirect and new quotation visible
        await expect(page).toHaveURL(/.*quotations/);
        await expect(page.getByText('Acme Corp')).toBeVisible();
    });

    test('searches quotations', async ({ page }) => {
        // Seed via API
        await page.request.post('/api/quotations', {
            data: {
                customerName: 'Alpha Corp',
                items: [{ name: 'Service', price: 100, quantity: 1 }],
                taxRate: 0.07,
            },
        });
        await page.request.post('/api/quotations', {
            data: {
                customerName: 'Beta Inc',
                items: [{ name: 'Service', price: 200, quantity: 1 }],
                taxRate: 0.07,
            },
        });

        await quotationsPage.goto();
        await expect(quotationsPage.quotationRows).toHaveCount(2);

        await quotationsPage.searchFor('Alpha');
        await expect(quotationsPage.quotationRows).toHaveCount(1);
        await expect(quotationsPage.getQuotationByCustomer('Alpha Corp')).toBeVisible();
    });

    test('filters by status', async ({ page }) => {
        await quotationsPage.goto();

        await quotationsPage.filterByStatus('sent');
        // Verify only sent quotations shown
        const rows = quotationsPage.quotationRows;
        const count = await rows.count();
        for (let i = 0; i < count; i++) {
            await expect(rows.nth(i).getByText(/sent/i)).toBeVisible();
        }
    });

    test('deletes a quotation', async ({ page }) => {
        const res = await page.request.post('/api/quotations', {
            data: {
                customerName: 'Delete Me Corp',
                items: [{ name: 'Item', price: 100, quantity: 1 }],
                taxRate: 0.07,
            },
        });
        const { id } = await res.json();

        await quotationsPage.goto();
        await expect(quotationsPage.getQuotationByCustomer('Delete Me Corp')).toBeVisible();

        // Click delete button
        await quotationsPage.getQuotationByCustomer('Delete Me Corp')
            .getByRole('button', { name: /delete/i })
            .click();

        // Confirm in dialog
        await page.getByRole('button', { name: /confirm/i }).click();

        // Verify removed
        await expect(quotationsPage.getQuotationByCustomer('Delete Me Corp')).not.toBeVisible();
    });

    test('shows empty state when no quotations', async ({ page }) => {
        await quotationsPage.goto();
        await expect(quotationsPage.emptyState).toBeVisible();
        await expect(quotationsPage.createButton).toBeVisible();
    });
});
```

## Authentication State

### Save & Reuse Auth State

```typescript
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
    // Login via UI (one-time setup)
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('e2e@example.com');
    await page.getByLabel(/password/i).fill('TestPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for auth to complete
    await page.waitForURL(/.*dashboard/);

    // Save authentication state (cookies, localStorage)
    await page.context().storageState({ path: authFile });
});
```

```typescript
// playwright.config.ts — add setup project
projects: [
    // Setup project — runs first
    {
        name: 'setup',
        testMatch: /.*\.setup\.ts/,
    },
    // Tests that require auth
    {
        name: 'authenticated',
        testMatch: /.*\.spec\.ts/,
        use: {
            storageState: 'e2e/.auth/user.json',
        },
        dependencies: ['setup'],
    },
    // Tests that don't require auth (login, register)
    {
        name: 'public',
        testMatch: /.*public\.spec\.ts/,
    },
],
```

### Multiple Auth Roles

```typescript
// e2e/auth.setup.ts
import { test as setup } from '@playwright/test';

const adminFile = 'e2e/.auth/admin.json';
const userFile = 'e2e/.auth/user.json';

setup('authenticate as admin', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('AdminPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/.*dashboard/);
    await page.context().storageState({ path: adminFile });
});

setup('authenticate as user', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('user@example.com');
    await page.getByLabel(/password/i).fill('UserPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/.*dashboard/);
    await page.context().storageState({ path: userFile });
});
```

```typescript
// playwright.config.ts — role-based projects
projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
        name: 'admin',
        testDir: './e2e/admin',
        use: { storageState: 'e2e/.auth/admin.json' },
        dependencies: ['setup'],
    },
    {
        name: 'user',
        testDir: './e2e/user',
        use: { storageState: 'e2e/.auth/user.json' },
        dependencies: ['setup'],
    },
],
```

## Network Interception

### Mock API Responses

```typescript
import { test, expect } from '@playwright/test';

test('shows error state when API fails', async ({ page }) => {
    // Mock API to return 500
    await page.route('**/api/quotations**', (route) => {
        route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
        });
    });

    await page.goto('/quotations');

    await expect(page.getByText(/something went wrong|error/i)).toBeVisible();
});

test('shows empty state when no data', async ({ page }) => {
    await page.route('**/api/quotations**', (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [], pagination: { total: 0 } }),
        });
    });

    await page.goto('/quotations');

    await expect(page.getByText(/no quotations/i)).toBeVisible();
});

test('verifies request payload on create', async ({ page }) => {
    let requestBody: any;

    await page.route('**/api/quotations', async (route) => {
        if (route.request().method() === 'POST') {
            requestBody = route.request().postDataJSON();
        }
        // Continue to real API
        await route.continue();
    });

    await page.goto('/quotations/new');
    await page.getByLabel(/customer name/i).fill('Test Corp');
    await page.getByTestId('item-name-0').fill('Widget');
    await page.getByTestId('item-price-0').fill('100');
    await page.getByTestId('item-qty-0').fill('5');
    await page.getByRole('button', { name: /create/i }).click();

    expect(requestBody).toMatchObject({
        customerName: 'Test Corp',
        items: [{ name: 'Widget', price: 100, quantity: 5 }],
    });
});
```

### Wait for API Responses

```typescript
test('updates list after creating quotation', async ({ page }) => {
    await page.goto('/quotations');

    // Wait for the API response after clicking create
    const responsePromise = page.waitForResponse(resp =>
        resp.url().includes('/api/quotations') && resp.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create/i }).click();
    // ... fill form ...
    await page.getByRole('button', { name: /submit/i }).click();

    const response = await responsePromise;
    expect(response.status()).toBe(201);
});
```

## Visual Testing

### Screenshot Comparison

```typescript
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
    test('login page matches snapshot', async ({ page }) => {
        await page.goto('/login');
        await expect(page).toHaveScreenshot('login-page.png', {
            maxDiffPixelRatio: 0.01,
            threshold: 0.2,
        });
    });

    test('quotation list matches snapshot', async ({ page }) => {
        await page.goto('/quotations');
        await page.waitForLoadState('networkidle');

        // Full page screenshot
        await expect(page).toHaveScreenshot('quotation-list.png', {
            fullPage: true,
            maxDiffPixelRatio: 0.02,
        });
    });

    test('component snapshot', async ({ page }) => {
        await page.goto('/quotations');

        const header = page.getByRole('banner');
        await expect(header).toHaveScreenshot('header.png');
    });

    test('matches snapshot per viewport', async ({ page }) => {
        await page.goto('/quotations');

        await expect(page).toHaveScreenshot('quotations-desktop.png');
    });
});

// Mobile snapshot
test.describe('Mobile Visual', () => {
    test.use({ ...devices['iPhone 13'] });

    test('mobile layout', async ({ page }) => {
        await page.goto('/quotations');
        await expect(page).toHaveScreenshot('quotations-mobile.png');
    });
});
```

## API Testing with Playwright

```typescript
// e2e/api/quotations-api.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Quotations API', () => {
    let authToken: string;

    test.beforeAll(async ({ request }) => {
        const res = await request.post('/api/auth/login', {
            data: { email: 'e2e@example.com', password: 'TestPass123!' },
        });
        const body = await res.json();
        authToken = body.accessToken;
    });

    test('POST /api/quotations creates quotation', async ({ request }) => {
        const res = await request.post('/api/quotations', {
            headers: { Authorization: `Bearer ${authToken}` },
            data: {
                customerName: 'API Test Corp',
                items: [
                    { name: 'Service A', price: 10000, quantity: 2 },
                    { name: 'Service B', price: 5000, quantity: 1 },
                ],
                taxRate: 0.07,
            },
        });

        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body).toMatchObject({
            customerName: 'API Test Corp',
            subtotal: 25000,
            total: 26750,
            status: 'draft',
        });
        expect(body.id).toBeDefined();
    });

    test('GET /api/quotations returns list', async ({ request }) => {
        const res = await request.get('/api/quotations', {
            headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.pagination).toBeDefined();
    });

    test('GET /api/quotations/:id returns quotation', async ({ request }) => {
        // Create first
        const createRes = await request.post('/api/quotations', {
            headers: { Authorization: `Bearer ${authToken}` },
            data: { customerName: 'Test', items: [{ name: 'X', price: 100, quantity: 1 }], taxRate: 0.07 },
        });
        const { id } = await createRes.json();

        // Fetch
        const res = await request.get(`/api/quotations/${id}`, {
            headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.id).toBe(id);
    });

    test('DELETE /api/quotations/:id deletes quotation', async ({ request }) => {
        const createRes = await request.post('/api/quotations', {
            headers: { Authorization: `Bearer ${authToken}` },
            data: { customerName: 'Delete Me', items: [{ name: 'X', price: 100, quantity: 1 }], taxRate: 0.07 },
        });
        const { id } = await createRes.json();

        const deleteRes = await request.delete(`/api/quotations/${id}`, {
            headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(deleteRes.status()).toBe(204);

        // Verify gone
        const getRes = await request.get(`/api/quotations/${id}`, {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        expect(getRes.status()).toBe(404);
    });
});
```

## Test Fixtures

### Custom Fixtures

```typescript
// e2e/fixtures.ts
import { test as base, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { QuotationsPage } from './pages/quotations.page';
import { CreateQuotationPage } from './pages/create-quotation.page';

type Fixtures = {
    loginPage: LoginPage;
    quotationsPage: QuotationsPage;
    createQuotationPage: CreateQuotationPage;
    authenticatedPage: void;
};

export const test = base.extend<Fixtures>({
    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },

    quotationsPage: async ({ page }, use) => {
        await use(new QuotationsPage(page));
    },

    createQuotationPage: async ({ page }, use) => {
        await use(new CreateQuotationPage(page));
    },

    authenticatedPage: async ({ page }, use) => {
        const res = await page.request.post('/api/auth/login', {
            data: { email: 'e2e@example.com', password: 'TestPass123!' },
        });
        const { accessToken } = await res.json();
        await page.evaluate((token) => localStorage.setItem('auth_token', token), accessToken);
        await use();
    },
});

export { expect };
```

```typescript
// e2e/using-fixtures.spec.ts
import { test, expect } from './fixtures';

test.describe('With fixtures', () => {
    test('authenticated user can see quotations', async ({
        page,
        quotationsPage,
        authenticatedPage,
    }) => {
        await quotationsPage.goto();
        await expect(quotationsPage.heading).toBeVisible();
    });
});
```

## Accessibility Testing

```typescript
// e2e/a11y.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
    test('login page has no obvious a11y violations', async ({ page }) => {
        await page.goto('/login');

        // Check heading hierarchy
        const h1 = page.getByRole('heading', { level: 1 });
        await expect(h1).toHaveCount(1);

        // All images have alt text
        const images = page.getByRole('img');
        const imgCount = await images.count();
        for (let i = 0; i < imgCount; i++) {
            await expect(images.nth(i)).toHaveAttribute('alt', /.+/);
        }

        // Form inputs have labels
        const inputs = page.getByRole('textbox');
        const inputCount = await inputs.count();
        for (let i = 0; i < inputCount; i++) {
            const input = inputs.nth(i);
            const label = await input.getAttribute('aria-label') ?? await input.getAttribute('aria-labelledby');
            const hasLabel = label || (await page.locator(`label[for="${await input.getAttribute('id')}"]`).count() > 0);
            expect(hasLabel).toBeTruthy();
        }

        // Buttons have accessible names
        const buttons = page.getByRole('button');
        const btnCount = await buttons.count();
        for (let i = 0; i < btnCount; i++) {
            const name = await buttons.nth(i).innerText();
            expect(name.trim().length).toBeGreaterThan(0);
        }

        // Check color contrast (basic)
        const bodyColor = await page.evaluate(() => {
            const style = getComputedStyle(document.body);
            return { color: style.color, bgColor: style.backgroundColor };
        });
        expect(bodyColor.color).toBeDefined();
    });
});
```

## CI Integration

### GitHub Actions

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]

jobs:
    e2e:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - uses: actions/setup-node@v4
              with:
                  node-version: 20
                  cache: npm

            - run: npm ci
            - run: npx playwright install --with-deps

            - name: Run E2E tests
              run: npx playwright test

            - name: Upload test results
              if: always()
              uses: actions/upload-artifact@v4
              with:
                  name: playwright-report
                  path: playwright-report/
                  retention-days: 7

            - name: Upload screenshots
              if: failure()
              uses: actions/upload-artifact@v4
              with:
                  name: playwright-screenshots
                  path: e2e/screenshots/
                  retention-days: 3
```

## Directory Structure

```
e2e/
├── pages/                        # Page Object Model
│   ├── base.page.ts
│   ├── login.page.ts
│   ├── quotations.page.ts
│   └── create-quotation.page.ts
├── api/                          # API-only tests
│   └── quotations-api.spec.ts
├── auth.setup.ts                 # Auth state setup
├── fixtures.ts                   # Custom test fixtures
├── smoke.spec.ts                 # Smoke tests
├── auth.spec.ts                  # Auth flow tests
├── quotation-crud.spec.ts        # CRUD operations
├── visual.spec.ts                # Visual regression
├── a11y.spec.ts                  # Accessibility
└── .auth/                        # Saved auth state (gitignored)
    ├── admin.json
    └── user.json
```

## Code Style Rules

- Use Page Object Model for all multi-step flows — encapsulate page interactions in reusable classes.
- Use `getByRole`, `getByLabel`, `getByText` over CSS selectors — resilient to markup changes.
- Use `data-testid` only when no semantic selector works — `getByTestId('submit-btn')`.
- Save authentication state in setup files — avoid login-before-every-test overhead.
- Use `waitForResponse` to sync with API calls — don't use arbitrary `waitForTimeout`.
- Run auth setup as a dependency project — runs once before all authenticated tests.
- Intercept network for error/empty state testing — mock API responses without changing backend.
- Set `fullyParallel: true` — Playwright tests run in isolated browser contexts, safe to parallelize.
- Use `retries: 2` on CI — flaky tests get a second chance without failing the build.
- Capture screenshots and videos on failure — `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`.
- Test on multiple viewports — at least desktop and mobile in CI.
- Seed test data via API calls — faster and more reliable than UI-driven setup.
- Keep E2E tests focused on critical user flows — don't duplicate unit/integration test coverage.
- Use `test.describe` to group related tests — clear structure in test reports.
