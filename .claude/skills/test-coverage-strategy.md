---
name: test-coverage-strategy
description: Test coverage strategy and planning — coverage thresholds, coverage matrix, critical path analysis, risk-based testing, coverage enforcement, CI gate configuration, coverage reporting, uncovered code analysis, and pragmatic coverage goals for TypeScript/Node.js applications
---

# Test Coverage Strategy

## Coverage Philosophy

```
Coverage is a measure of what code RUNS during tests, not what code is CORRECT.
- 100% coverage ≠ bug-free
- 0% coverage = unknown quality
- Aim for high coverage on CRITICAL paths, not everywhere
- Coverage guides where to write tests, not when to stop
```

## Coverage Configuration

### Vitest Coverage Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',

            // Reporters
            reporter: [
                'text',              // Terminal summary
                'text-summary',      // Brief terminal output
                'lcov',              // For Coveralls/Codecov upload
                'html',              // Detailed HTML report
                'json-summary',      // For CI badge/checks
                'json',              // Detailed JSON for custom tooling
            ],

            // What to include in coverage
            include: [
                'src/**/*.ts',
            ],

            // What to exclude from coverage
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.spec.ts',
                'src/**/*.d.ts',
                'src/types/**',
                'src/test/**',
                'src/**/index.ts',       // Barrel re-exports
                'src/config/**',          // Config files
                'src/migrations/**',      // Database migrations
                'src/**/constants.ts',    // Pure constants
            ],

            // Coverage thresholds — enforced in CI
            thresholds: {
                // Global minimums
                statements: 80,
                branches: 70,
                functions: 80,
                lines: 80,

                // Per-file overrides for critical modules
                perFile: true,
            },

            // Clean coverage data between runs
            clean: true,

            // Report files that have no tests at all
            all: true,
        },
    },
});
```

### Tiered Thresholds

```typescript
// vitest.config.ts — risk-based thresholds
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.d.ts',
                'src/types/**',
                'src/test/**',
            ],
            thresholds: {
                // Global minimums — enforced everywhere
                statements: 70,
                branches: 60,
                functions: 70,
                lines: 70,

                // Per-file: strict enforcement
                perFile: true,
            },
        },
    },
});
```

```typescript
// src/test/coverage-thresholds.ts
// Custom per-directory thresholds (used in CI script)

interface CoverageThreshold {
    path: string;
    statements: number;
    branches: number;
    functions: number;
    lines: number;
}

const thresholds: CoverageThreshold[] = [
    // Tier 1: Critical business logic — highest coverage
    {
        path: 'src/services/quotation',
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
    },
    {
        path: 'src/services/auth',
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
    },
    {
        path: 'src/middleware',
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
    },
    {
        path: 'src/utils/validation',
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
    },

    // Tier 2: Standard business logic — good coverage
    {
        path: 'src/routes',
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
    },
    {
        path: 'src/repositories',
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
    },

    // Tier 3: Infrastructure / utilities — moderate coverage
    {
        path: 'src/utils',
        statements: 75,
        branches: 65,
        functions: 75,
        lines: 75,
    },
    {
        path: 'src/lib',
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
    },
];

export { thresholds };
```

## Coverage Matrix

### Test Type × Layer Matrix

```
                     Unit Tests    Integration    E2E
                    ───────────   ───────────   ──────
Pure Functions       ██████████    ░░░░░░░░░░    ░░░░
Utilities            ██████████    ░░░░░░░░░░    ░░░░
Validation           ██████████    ██████░░░░    ░░░░
Services             ████████░░    ██████████    ░░░░
Repositories         ░░░░░░░░░░    ██████████    ░░░░
Routes / API         ██████░░░░    ██████████    ░░░░
Middleware           ████████░░    ██████░░░░    ░░░░
Auth Flow            ██████░░░░    ██████████    ████
Quotation CRUD       ██████░░░░    ██████████    ████
User Journeys        ░░░░░░░░░░    ░░░░░░░░░░    ████
Error Handling       ██████████    ████████░░    ██░░
Edge Cases           ██████████    ██░░░░░░░░    ░░░░

█ = Primary coverage   ░ = Secondary/optional coverage
```

### What to Cover Where

```typescript
/**
 * UNIT TESTS — fast, isolated, no external dependencies
 *
 * Cover: pure functions, calculations, validation, transformations,
 *         error classes, data formatting, parsing
 *
 * Don't cover: database queries, HTTP calls, file I/O,
 *              third-party integrations, framework internals
 */
describe('calculateTotal', () => {
    // Test all branches of pure calculation logic
    it('calculates with no discount');
    it('calculates with percentage discount');
    it('handles zero discount');
    it('rounds to 2 decimal places');
    it('throws on negative values');
});

/**
 * INTEGRATION TESTS — real database, real HTTP, real services
 *
 * Cover: API endpoints, database queries, auth flows,
 *         middleware chains, service-to-service interactions
 *
 * Don't cover: browser interactions, visual rendering,
 *              cross-browser quirks
 */
describe('POST /api/quotations', () => {
    it('creates quotation with valid data');
    it('returns 400 for invalid input');
    it('returns 401 without auth');
    it('persists items to database');
    it('calculates and stores total');
});

/**
 * E2E TESTS — full browser, real user interactions
 *
 * Cover: critical user journeys, cross-page flows,
 *         visual regression, accessibility
 *
 * Don't cover: edge cases, error branches,
 *              individual function behavior
 */
describe('Quotation approval flow', () => {
    it('admin can approve a draft quotation');
    it('customer receives email after approval');
});
```

## Risk-Based Coverage Priorities

### Priority Map

```typescript
interface RiskAssessment {
    module: string;
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
    reasons: string[];
    targetCoverage: number;
    testTypes: string[];
}

const riskMap: RiskAssessment[] = [
    {
        module: 'src/services/auth',
        riskLevel: 'critical',
        reasons: [
            'Security — authentication bypass = full system compromise',
            'Handles passwords and tokens',
            'Regulatory requirements (data protection)',
        ],
        targetCoverage: 95,
        testTypes: ['unit', 'integration', 'e2e'],
    },
    {
        module: 'src/services/quotation',
        riskLevel: 'critical',
        reasons: [
            'Core business logic — incorrect totals = revenue loss',
            'Financial calculations',
            'Multi-step approval workflow',
        ],
        targetCoverage: 90,
        testTypes: ['unit', 'integration'],
    },
    {
        module: 'src/middleware',
        riskLevel: 'high',
        reasons: [
            'Security — authorization checks',
            'Rate limiting — abuse prevention',
            'Runs on every request',
        ],
        targetCoverage: 90,
        testTypes: ['unit', 'integration'],
    },
    {
        module: 'src/utils/validation',
        riskLevel: 'high',
        reasons: [
            'Input validation — first line of defense',
            'Data integrity',
        ],
        targetCoverage: 90,
        testTypes: ['unit'],
    },
    {
        module: 'src/routes',
        riskLevel: 'medium',
        reasons: [
            'HTTP handling — wrong status codes',
            'Request/response shape',
        ],
        targetCoverage: 80,
        testTypes: ['integration'],
    },
    {
        module: 'src/utils/format',
        riskLevel: 'low',
        reasons: ['Display formatting only'],
        targetCoverage: 70,
        testTypes: ['unit'],
    },
];
```

### Coverage Heatmap

```typescript
// Script to generate coverage heatmap for a module
interface FileCoverage {
    path: string;
    statements: number;
    branches: number;
    functions: number;
    lines: number;
    uncoveredLines: number[];
}

function generateHeatmap(files: FileCoverage[]): string {
    const lines: string[] = [];

    lines.push('| File | Stmts | Branch | Funcs | Lines | Status |');
    lines.push('|------|-------|--------|-------|-------|--------|');

    for (const file of files.sort((a, b) => a.lines - b.lines)) {
        const avg = (file.statements + file.branches + file.functions + file.lines) / 4;
        const status = avg >= 90 ? 'OK' : avg >= 70 ? 'WARN' : 'FAIL';
        lines.push(
            `| ${file.path} | ${file.statements}% | ${file.branches}% | ${file.functions}% | ${file.lines}% | ${status} |`
        );
    }

    return lines.join('\n');
}
```

## CI Coverage Gates

### GitHub Actions Coverage Enforcement

```yaml
# .github/workflows/coverage.yml
name: Coverage

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  coverage:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: quotation_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgres://test:test@localhost:5432/quotation_test
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - run: npm ci
      - run: npm run migrate

      # Run tests with coverage
      - name: Run tests with coverage
        run: npm run test:coverage

      # Check thresholds — fail CI if below minimum
      - name: Check coverage thresholds
        run: |
          npx vitest run --coverage 2>&1 | tee coverage-output.txt

          # Extract coverage numbers
          STMTS=$(grep -oP 'All files\s+\|\s+\K[\d.]+' coverage-output.txt | head -1)
          echo "Statement coverage: $STMTS%"

          # Fail if below threshold
          if (( $(echo "$STMTS < 80" | bc -l) )); then
            echo "::error::Coverage $STMTS% is below 80% threshold"
            exit 1
          fi

      # Upload coverage report
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          token: ${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: false

      # Archive HTML report as artifact
      - name: Upload coverage HTML report
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

      # Post coverage comment on PR
      - name: Comment coverage on PR
        if: github.event_name == 'pull_request'
        uses: romeovs/lcov-reporter-action@v0.4.0
        with:
          lcov-file: coverage/lcov.info
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### PR Coverage Check Bot

```typescript
// scripts/check-pr-coverage.ts
// Run in CI to compare PR coverage against base branch
import { execFileSync } from 'child_process';
import fs from 'fs';

interface CoverageSummary {
    total: {
        lines: { pct: number };
        statements: { pct: number };
        functions: { pct: number };
        branches: { pct: number };
    };
}

function getCoverage(): CoverageSummary {
    const raw = fs.readFileSync('coverage/coverage-summary.json', 'utf-8');
    return JSON.parse(raw);
}

function formatDelta(current: number, base: number): string {
    const delta = current - base;
    if (delta > 0) return `+${delta.toFixed(1)}%`;
    if (delta < 0) return `${delta.toFixed(1)}% ⚠️`;
    return '0%';
}

const current = getCoverage();

const baseCoveragePath = 'coverage-base/coverage-summary.json';
let comment = '## Coverage Report\n\n';
comment += '| Metric | Coverage | Threshold |\n';
comment += '|--------|----------|----------|\n';
comment += `| Statements | ${current.total.statements.pct}% | ≥80% |\n`;
comment += `| Branches | ${current.total.branches.pct}% | ≥70% |\n`;
comment += `| Functions | ${current.total.functions.pct}% | ≥80% |\n`;
comment += `| Lines | ${current.total.lines.pct}% | ≥80% |\n`;

if (fs.existsSync(baseCoveragePath)) {
    const base: CoverageSummary = JSON.parse(fs.readFileSync(baseCoveragePath, 'utf-8'));
    comment += '\n### Change from base branch\n\n';
    comment += '| Metric | Delta |\n';
    comment += '|--------|-------|\n';
    comment += `| Statements | ${formatDelta(current.total.statements.pct, base.total.statements.pct)} |\n`;
    comment += `| Branches | ${formatDelta(current.total.branches.pct, base.total.branches.pct)} |\n`;
    comment += `| Functions | ${formatDelta(current.total.functions.pct, base.total.functions.pct)} |\n`;
    comment += `| Lines | ${formatDelta(current.total.lines.pct, base.total.lines.pct)} |\n`;
}

const linesDelta = fs.existsSync(baseCoveragePath)
    ? current.total.lines.pct - JSON.parse(fs.readFileSync(baseCoveragePath, 'utf-8')).total.lines.pct
    : 0;

if (linesDelta < -1) {
    comment += '\n> ⚠️ **Line coverage decreased by more than 1%. Please add tests for new code.**\n';
}

console.log(comment);

// Post as PR comment (uses gh CLI — safe: no user input in args)
if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
    const prNumber = process.env.PR_NUMBER;
    if (prNumber) {
        execFileSync('gh', ['pr', 'comment', prNumber, '--body', comment], {
            stdio: 'inherit',
        });
    }
}
```

## Uncovered Code Analysis

### Finding Coverage Gaps

```bash
# Find files with NO tests at all
npx vitest run --coverage 2>&1 | grep -E "^\s*\S+\.ts\s+\|\s+0"

# Find files below threshold
npx vitest run --coverage 2>&1 | awk -F'|' 'NR>3 && $2+0 < 80 {print $1, $2}'

# List uncovered lines in a specific file
npx vitest run --coverage --reporter=verbose 2>&1 | grep "Uncovered"

# Open HTML report for detailed view
open coverage/index.html
```

### Coverage Gap Priority Template

```markdown
## Coverage Gap Analysis

### Critical Gaps (fix immediately)
| File | Coverage | Uncovered Lines | Risk |
|------|----------|-----------------|------|
| src/services/auth.ts | 45% | 67-120 | Auth bypass possible |
| src/middleware/authorize.ts | 30% | 15-42 | Unauthorized access |

### High Priority (fix this sprint)
| File | Coverage | Uncovered Lines | Risk |
|------|----------|-----------------|------|
| src/services/quotation.ts | 60% | 89-134 | Incorrect totals |
| src/routes/quotations.ts | 55% | 23-67 | Wrong HTTP responses |

### Medium Priority (fix next sprint)
| File | Coverage | Uncovered Lines | Risk |
|------|----------|-----------------|------|
| src/repositories/user.ts | 65% | 34-56 | Data integrity |
| src/utils/format.ts | 50% | 12-28 | Display only |

### Low Priority (backlog)
| File | Coverage | Uncovered Lines | Risk |
|------|----------|-----------------|------|
| src/config/logger.ts | 40% | 15-30 | Logging config |
| src/types/** | N/A | N/A | Type definitions |
```

## Writing Tests for Coverage

### Covering Branches

```typescript
// src/utils/status.ts
export function getQuotationStatusText(status: string): string {
    switch (status) {
        case 'draft': return 'Draft';
        case 'pending_review': return 'Pending Review';
        case 'approved': return 'Approved';
        case 'rejected': return 'Rejected';
        case 'expired': return 'Expired';
        case 'cancelled': return 'Cancelled';
        default: return 'Unknown';
    }
}

// src/utils/status.test.ts — covers all branches
describe('getQuotationStatusText', () => {
    // Each case = one branch
    it.each([
        ['draft', 'Draft'],
        ['pending_review', 'Pending Review'],
        ['approved', 'Approved'],
        ['rejected', 'Rejected'],
        ['expired', 'Expired'],
        ['cancelled', 'Cancelled'],
    ])('returns "%s" for status "%s"', (status, expected) => {
        expect(getQuotationStatusText(status)).toBe(expected);
    });

    // Default branch
    it('returns "Unknown" for unrecognized status', () => {
        expect(getQuotationStatusText('unknown_status')).toBe('Unknown');
    });
});
```

### Covering Error Paths

```typescript
// src/services/quotation.ts
async function approveQuotation(id: string, userId: string) {
    const quotation = await db.findQuotation(id);
    if (!quotation) throw new NotFoundError('Quotation', id);       // Branch 1
    if (quotation.status !== 'draft') throw new ConflictError(       // Branch 2
        'Only draft quotations can be approved'
    );
    const user = await db.findUser(userId);
    if (!user.roles.includes('admin')) throw new ForbiddenError(     // Branch 3
        'Only admins can approve quotations'
    );

    return db.updateQuotation(id, {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
    });
}

// src/services/quotation.test.ts — cover all branches including errors
describe('approveQuotation', () => {
    it('approves a draft quotation when user is admin', async () => {
        // Happy path
    });

    it('throws NotFoundError when quotation does not exist', async () => {
        // Branch 1
    });

    it('throws ConflictError when quotation is not draft', async () => {
        // Branch 2 — test each non-draft status
    });

    it('throws ForbiddenError when user is not admin', async () => {
        // Branch 3
    });
});
```

### Covering Async Edge Cases

```typescript
describe('fetchWithRetry', () => {
    it('returns result on first attempt', async () => {});
    it('retries on network error and succeeds', async () => {});
    it('retries on 5xx and succeeds', async () => {});
    it('throws after max retries exceeded', async () => {});
    it('respects AbortSignal timeout', async () => {});
    it('does not retry on 4xx errors', async () => {});
});
```

## Coverage Badges & Reporting

### README Badge

```markdown
<!-- README.md -->
[![Coverage](https://codecov.io/gh/org/quotation-app/branch/main/graph/badge.svg)](https://codecov.io/gh/org/quotation-app)
```

### Custom Coverage Badge Script

```typescript
// scripts/coverage-badge.ts
import fs from 'fs';

interface BadgeConfig {
    label: string;
    value: number;
    thresholds: { green: number; yellow: number };
}

function generateBadge({ label, value, thresholds }: BadgeConfig): string {
    const color = value >= thresholds.green ? 'brightgreen'
        : value >= thresholds.yellow ? 'yellow'
        : 'red';

    return `https://img.shields.io/badge/${label}-${value}%25-${color}?style=flat-square`;
}

const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf-8'));
const lines = Math.round(summary.total.lines.pct);

const badgeUrl = generateBadge({
    label: 'coverage',
    value: lines,
    thresholds: { green: 80, yellow: 60 },
});

console.log(`Coverage: ${lines}%`);
console.log(`Badge: ${badgeUrl}`);
```

## Incremental Coverage Strategy

### Growing Coverage Over Time

```markdown
## Coverage Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Vitest coverage with v8 provider
- [ ] Configure CI coverage gate at 50% global minimum
- [ ] Write tests for all pure functions (utils, calculations)
- [ ] Target: 50% global coverage

### Phase 2: Critical Paths (Week 3-4)
- [ ] Auth service: login, register, token refresh
- [ ] Quotation CRUD: create, read, update, delete
- [ ] Validation: all Zod schemas
- [ ] Raise CI gate to 65%
- [ ] Target: 65% global, 90% auth/quotation

### Phase 3: Integration (Week 5-6)
- [ ] API endpoint tests with Supertest
- [ ] Middleware tests (auth, rate limit, error handler)
- [ ] Database query tests
- [ ] Raise CI gate to 75%
- [ ] Target: 75% global, 85% routes/services

### Phase 4: E2E & Edge Cases (Week 7-8)
- [ ] Playwright smoke tests for critical flows
- [ ] Error path coverage (timeouts, network failures)
- [ ] Edge cases (empty inputs, boundary values)
- [ ] Raise CI gate to 80%
- [ ] Target: 80% global, 90% critical modules
```

### New Code Coverage Rule

```yaml
# .github/workflows/diff-coverage.yml
name: Diff Coverage

on:
  pull_request:
    branches: [main]

jobs:
  diff-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for diff

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - run: npm ci
      - run: npm run test:coverage

      - name: Check diff coverage
        run: |
          # Get list of changed .ts files (excluding tests)
          CHANGED_FILES=$(git diff --name-only origin/main...HEAD \
            | grep 'src/.*\.ts$' \
            | grep -v '\.test\.' \
            | grep -v '\.spec\.' \
            | grep -v '/types/' \
            | grep -v '\.d\.ts' \
            | paste -sd "," -)

          if [ -z "$CHANGED_FILES" ]; then
            echo "No source files changed"
            exit 0
          fi

          echo "Changed files: $CHANGED_FILES"

          # Check coverage for changed files only
          # New/changed code must have ≥80% coverage
          npx vitest run --coverage --changed origin/main 2>&1 | tee diff-coverage.txt

          echo ""
          echo "## Diff Coverage Report" >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY
          grep -A 50 "Coverage report" diff-coverage.txt >> $GITHUB_STEP_SUMMARY || true
          echo '```' >> $GITHUB_STEP_SUMMARY
```

## Coverage Anti-Patterns

### What NOT to Do

```typescript
// ❌ BAD: Writing tests just to hit coverage
describe('all branches covered but meaningless', () => {
    it('works', () => {
        // This test runs the code but doesn't assert anything meaningful
        calculateTotal(items, 0.07, 0);
    });
});

// ✅ GOOD: Tests with meaningful assertions
describe('calculateTotal', () => {
    it('returns correct total with standard tax rate', () => {
        const result = calculateTotal(
            [{ price: 100, quantity: 2 }],
            0.07,
            0,
        );
        expect(result).toBe(214); // 200 + 7% tax = 214
    });
});

// ❌ BAD: Testing implementation details
it('calls calculateSubtotal then calculateTax then subtracts discount', () => {
    vi.spyOn(utils, 'calculateSubtotal').mockReturnValue(100);
    vi.spyOn(utils, 'calculateTax').mockReturnValue(7);
    // This tests HOW, not WHAT
});

// ✅ GOOD: Testing observable behavior
it('calculates total = subtotal - discount + tax', () => {
    const result = calculateTotal([{ price: 100, quantity: 1 }], 0.07, 10);
    expect(result).toBe(96.3); // (100 - 10) + 7% = 96.3
});

// ❌ BAD: Excluding code from coverage to inflate numbers
// coverage: exclude src/services/auth.ts

// ✅ GOOD: Write the missing tests, or accept lower coverage honestly
```

### Coverage Exclusion Rules

```typescript
// vitest.config.ts
coverage: {
    exclude: [
        // Legitimate exclusions:
        'src/**/*.test.ts',         // Test files themselves
        'src/**/*.d.ts',            // Type declarations
        'src/types/**',             // Pure type files
        'src/test/**',              // Test utilities
        'src/migrations/**',        // DB migrations
        'src/**/index.ts',          // Re-export barrels

        // NEVER exclude:
        // src/services/**     — business logic must be tested
        // src/routes/**       — API handlers must be tested
        // src/middleware/**   — security must be tested
        // src/utils/**        — shared logic must be tested
    ],
}
```

## Code Style Rules

- Coverage thresholds must be enforced in CI — failing coverage must fail the build
- New code in PRs must meet ≥80% coverage (diff coverage check)
- Critical modules (auth, quotation, validation) must maintain ≥90% coverage
- Never write tests solely to increase coverage — every test must assert meaningful behavior
- Use `it.each` for parameterized tests that cover multiple branches efficiently
- Error paths (catch blocks, thrown errors) must be explicitly tested, not just happy paths
- Coverage HTML report must be generated and archived as CI artifact for review
- Exclude only type declarations, test files, and migrations from coverage — never business logic
- Track coverage trend over time — set alerts if coverage drops below threshold
- Use risk-based prioritization: test security and financial code first, formatting code last
