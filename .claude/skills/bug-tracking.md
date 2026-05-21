---
name: bug-tracking
description: Bug tracking workflow and patterns — issue templates, reproduction steps, severity/priority classification, root cause analysis, regression tracking, GitHub Issues integration, bug triage, and debugging workflow for TypeScript/Node.js applications
---

# Bug Tracking

## Bug Report Template

### Standard Issue Template

```markdown
<!-- .github/ISSUE_TEMPLATE/bug_report.yml -->
name: Bug Report
description: Report a bug or unexpected behavior
labels: ["bug", "triage"]
body:
  - type: textarea
    id: description
    attributes:
      label: Description
      description: Clear description of the bug
      placeholder: "When I click X, Y happens instead of Z"
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      description: Detailed steps to reproduce the behavior
      placeholder: |
        1. Go to '...'
        2. Click on '...'
        3. Scroll down to '...'
        4. See error
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What did you expect to happen?
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
      description: What actually happened?
    validations:
      required: true

  - type: dropdown
    id: severity
    attributes:
      label: Severity
      description: How severe is this bug?
      options:
        - "S1 - Critical (system down, data loss)"
        - "S2 - High (major feature broken)"
        - "S3 - Medium (feature degraded)"
        - "S4 - Low (cosmetic, minor inconvenience)"
      default: 1
    validations:
      required: true

  - type: textarea
    id: environment
    attributes:
      label: Environment
      description: Where did this happen?
      placeholder: |
        - OS: [e.g. Windows 11, macOS 14]
        - Browser: [e.g. Chrome 120, Firefox 121]
        - Node version: [e.g. 20.10.0]
        - App version: [e.g. 1.2.3]
    validations:
      required: true

  - type: textarea
    id: logs
    attributes:
      label: Relevant Logs
      description: Paste any relevant error logs, stack traces, or screenshots
      render: shell

  - type: textarea
    id: context
    attributes:
      label: Additional Context
      description: Any other context, links, or references
```

### Minimal Bug Report (for developers)

```typescript
/**
 * Internal bug report structure
 */
interface BugReport {
    id: string;
    title: string;
    description: string;
    stepsToReproduce: string[];
    expectedResult: string;
    actualResult: string;
    severity: Severity;
    priority: Priority;
    environment: Environment;
    labels: string[];
    assignee?: string;
    relatedIssues?: string[];
    attachments?: Attachment[];
    createdAt: Date;
    updatedAt: Date;
}

type Severity = 'critical' | 'high' | 'medium' | 'low';
type Priority = 'P0' | 'P1' | 'P2' | 'P3';

interface Environment {
    os: string;
    browser?: string;
    nodeVersion?: string;
    appVersion: string;
    buildNumber?: string;
    database?: string;
}

interface Attachment {
    name: string;
    type: 'screenshot' | 'video' | 'log' | 'har' | 'trace';
    url: string;
}
```

## Severity & Priority Matrix

### Severity Classification

```
S1 - Critical
├── Application crash or data loss
├── Security vulnerability (auth bypass, injection)
├── Payment/transaction failure
├── Database corruption
└── All users affected, no workaround

S2 - High
├── Major feature non-functional
├── Significant performance degradation (>5x slower)
├── Affects large subset of users
├── Incorrect data displayed (financial, legal)
└── Workaround exists but is painful

S3 - Medium
├── Feature partially broken
├── Affects specific browsers/devices
├── Performance slightly degraded
├── Error messages unclear or missing
└── Reasonable workaround available

S4 - Low
├── Visual/cosmetic issues
├── Typo in UI copy
├── Minor UX friction
├── Edge case with minimal impact
└── Internal tooling inconvenience
```

### Priority vs Severity

```
                   SEVERITY
              Critical  High   Medium  Low
           ┌──────────┬──────┬───────┬─────┐
    Many   │   P0     │  P0  │  P1   │ P2  │
     Users │  FIX NOW │  P0  │  P1   │ P2  │
USERS ─────┼──────────┼──────┼───────┼─────┤
    Some   │   P0     │  P1  │  P2   │ P3  │
   Users   │          │      │       │     │
  ─────────┼──────────┼──────┼───────┼─────┤
    Few    │   P1     │  P2  │  P3   │ P3  │
   Users   │          │      │       │     │
           └──────────┴──────┴───────┴─────┘

P0 = Fix immediately (hotfix)
P1 = Fix this sprint
P2 = Fix next sprint
P3 = Backlog / fix when convenient
```

## Bug Triage Workflow

### Triage Process

```typescript
interface TriageDecision {
    issue: string;
    action: TriageAction;
    reason: string;
}

type TriageAction =
    | { type: 'accept'; severity: Severity; priority: Priority; assignee: string }
    | { type: 'duplicate'; originalIssue: string }
    | { type: 'need-info'; requestedInfo: string[] }
    | { type: 'reject'; reason: string }
    | { type: 'convert'; targetType: 'feature' | 'task' | 'discussion' };

/**
 * Automated triage rules
 */
const triageRules: TriageRule[] = [
    // Auto-label based on keywords
    {
        match: /crash|segfault|panic|OOM|data loss/i,
        addLabels: ['severity:critical'],
        setPriority: 'P0',
    },
    {
        match: /security|vulnerability|XSS|injection|CSRF/i,
        addLabels: ['severity:critical', 'security'],
        setPriority: 'P0',
    },
    {
        match: /regression/i,
        addLabels: ['regression'],
        // Find the commit that introduced it
    },
    {
        match: /typo|spelling|grammar|capitalization/i,
        addLabels: ['severity:low', 'good-first-issue'],
        setPriority: 'P3',
    },
];
```

### Triage Checklist

```markdown
## Triage Checklist (for each incoming bug)

1. **Reproduce** — Can you reproduce the issue?
   - [ ] Reproduced locally
   - [ ] Reproduced on staging
   - [ ] Cannot reproduce (ask reporter for more info)

2. **Classify**
   - [ ] Severity assigned (S1–S4)
   - [ ] Priority assigned (P0–P3)
   - [ ] Component/area labeled
   - [ ] Is this a regression? (did it work before?)

3. **Assign**
   - [ ] Assign to appropriate developer
   - [ ] Set milestone/sprint
   - [ ] Link related issues/PRs

4. **Communicate**
   - [ ] Comment on issue with triage outcome
   - [ ] Notify assignee
   - [ ] If S1/S2: notify team lead, create incident channel
```

## GitHub Issues Integration

### Label System

```yaml
# .github/labels.yml — sync with `gh label sync`
# or create manually:

# Type labels
- name: "bug"
  color: "d73a4a"
  description: "Something isn't working"

- name: "feature"
  color: "0075ca"
  description: "New feature or request"

- name: "enhancement"
  color: "a2eeef"
  description: "Improvement to existing feature"

- name: "documentation"
  color: "0075ca"
  description: "Documentation improvements"

# Severity labels
- name: "severity:critical"
  color: "b60205"
  description: "S1 — System down, data loss"

- name: "severity:high"
  color: "d93f0b"
  description: "S2 — Major feature broken"

- name: "severity:medium"
  color: "fbca04"
  description: "S3 — Feature degraded"

- name: "severity:low"
  color: "0e8a16"
  description: "S4 — Cosmetic, minor"

# Status labels
- name: "status:triage"
  color: "ededed"
  description: "Awaiting triage"

- name: "status:confirmed"
  color: "bfe3c7"
  description: "Reproduced and confirmed"

- name: "status:in-progress"
  color: "1d76db"
  description: "Currently being worked on"

- name: "status:blocked"
  color: "c5def5"
  description: "Blocked by another issue"

- name: "status:needs-review"
  color: "fef2c0"
  description: "Fix implemented, needs review"

# Special labels
- name: "regression"
  color: "e99695"
  description: "Worked before, now broken"

- name: "security"
  color: "b60205"
  description: "Security-related issue"

- name: "good-first-issue"
  color: "c7def8"
  description: "Good for newcomers"

- name: "wontfix"
  color: "ffffff"
  description: "This will not be worked on"
```

### GitHub CLI Commands

```bash
# Create a bug from CLI
gh issue create \
    --title "Bug: quotation total miscalculated when discount is 0" \
    --body "$(cat <<'EOF'
## Description
When creating a quotation with a discount of 0, the total shows NaN instead of the subtotal.

## Steps to Reproduce
1. Navigate to /quotations/new
2. Add items totaling 10,000 THB
3. Set discount to 0
4. Click "Create Quotation"

## Expected
Total: 10,000 THB

## Actual
Total: NaN

## Severity
S2 - High (data integrity issue)

## Environment
- Chrome 120, Windows 11
- App v1.2.3
EOF
)" \
    --label "bug,severity:high,status:triage"

# List bugs by severity
gh issue list --label "bug" --label "severity:critical"
gh issue list --label "bug" --label "severity:high"

# List all open bugs sorted by update time
gh issue list --label "bug" --state open --sort updated

# Close a bug with a linked PR
gh issue close 123 --comment "Fixed in #456"

# Reopen a regression
gh issue reopen 123 --comment "Regressed in commit abc123, reopening"
```

## Root Cause Analysis

### RCA Template

```markdown
## Root Cause Analysis — Issue #<number>

### Summary
<One sentence describing the bug and root cause>

### Timeline
| Time | Event |
|------|-------|
| 2024-01-15 09:00 | Bug reported by user |
| 2024-01-15 09:15 | Triage confirmed S2 |
| 2024-01-15 09:30 | Root cause identified |
| 2024-01-15 10:00 | Fix deployed to staging |
| 2024-01-15 10:30 | Fix deployed to production |

### Root Cause
<What caused the bug — be specific>

### Why It Happened (5 Whys)
1. **Why** did the total show NaN?
   → Division by zero in discount calculation
2. **Why** was there division by zero?
   → Discount percentage formula divides by discount value
3. **Why** didn't the formula handle zero?
   → No input validation on discount field
4. **Why** was validation missing?
   → Edge case not covered in original spec
5. **Why** wasn't this caught in testing?
   → No test case for discount = 0

### Impact
- Users affected: ~50
- Duration: 4 hours
- Data loss: None
- Revenue impact: Minimal

### Fix
- PR #456: Add zero-check in discount calculation
- Added test case for discount = 0

### Prevention
- [ ] Add schema validation for discount field (Zod)
- [ ] Add integration test for edge cases (0, negative, >100)
- [ ] Add E2E test for quotation creation with zero discount
- [ ] Add defensive coding guideline to team docs
```

### Automated Error Context Collection

```typescript
interface ErrorContext {
    error: {
        name: string;
        message: string;
        stack: string;
    };
    request: {
        method: string;
        url: string;
        path: string;
        query: Record<string, unknown>;
        headers: Record<string, string>;
        body?: unknown;
    };
    user: {
        id?: string;
        role?: string;
    };
    environment: {
        nodeVersion: string;
        appVersion: string;
        hostname: string;
        pid: number;
        memory: NodeJS.MemoryUsage;
    };
    timing: {
        timestamp: string;
        uptime: number;
    };
}

function collectErrorContext(
    error: Error,
    req?: { method: string; url: string; headers: Record<string, string>; body?: unknown; query?: Record<string, unknown> }
): ErrorContext {
    return {
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack ?? '',
        },
        request: req ? {
            method: req.method,
            url: req.url,
            path: new URL(req.url, 'http://localhost').pathname,
            query: req.query ?? {},
            headers: sanitizeHeaders(req.headers),
            body: sanitizeBody(req.body),
        } : undefined!,
        user: { id: undefined, role: undefined },
        environment: {
            nodeVersion: process.version,
            appVersion: process.env.APP_VERSION ?? 'unknown',
            hostname: require('os').hostname(),
            pid: process.pid,
            memory: process.memoryUsage(),
        },
        timing: {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        },
    };
}

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    const sensitive = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];
    for (const key of sensitive) {
        if (sanitized[key]) sanitized[key] = '[REDACTED]';
    }
    return sanitized;
}

function sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;
    const sanitized = { ...(body as Record<string, unknown>) };
    const sensitive = ['password', 'token', 'secret', 'creditCard'];
    for (const key of sensitive) {
        if (sanitized[key]) sanitized[key] = '[REDACTED]';
    }
    return sanitized;
}
```

## Regression Tracking

### Regression Detection

```typescript
interface Regression {
    issueId: string;
    originalFix: string;       // PR or commit that fixed it originally
    breakingChange: string;    // PR or commit that re-introduced it
    detectedBy: 'test' | 'user' | 'monitoring';
    detectedAt: Date;
}

// Regression test tagging pattern
describe('Regression', () => {
    // Tag with original issue number for traceability
    it('[#123] should handle zero discount without NaN', () => {
        const total = calculateTotal({ subtotal: 10000, discount: 0 });
        expect(total).toBe(10000);
    });

    it('[#456] should not duplicate items on double-submit', async () => {
        const [res1, res2] = await Promise.all([
            request(app).post('/api/quotations').send(validPayload),
            request(app).post('/api/quotations').send(validPayload),
        ]);
        // Only one should succeed
        const created = [res1, res2].filter(r => r.status === 201);
        expect(created).toHaveLength(1);
    });
});
```

### Git Bisect for Finding Regressions

```bash
# Find the commit that introduced a bug
git bisect start
git bisect bad HEAD          # Current commit is broken
git bisect good v1.2.0       # This version was working

# Git will checkout a middle commit
# Test it, then mark:
git bisect good              # If it works
# or
git bisect bad               # If it's broken

# Repeat until git finds the culprit
# Git will output: "<commit-hash> is the first bad commit"

# When done:
git bisect reset
```

## Debugging Workflow

### Systematic Debugging Approach

```typescript
// 1. Capture the bug — write a failing test first
describe('Bug #123: Zero discount causes NaN total', () => {
    it('should calculate total correctly with zero discount', () => {
        // This test FAILS before the fix
        const result = calculateTotal({
            subtotal: 10000,
            discountPercent: 0,
        });
        expect(result).toBe(10000);
        expect(result).not.toBeNaN();
    });
});

// 2. Debug logging for production issues
import pino from 'pino';

const logger = pino();

function calculateTotal(params: { subtotal: number; discountPercent: number }) {
    const { subtotal, discountPercent } = params;

    logger.debug({ subtotal, discountPercent }, 'calculateTotal input');

    // The bug: division by zero when discountPercent is 0
    // const discount = subtotal * (100 / discountPercent); // WRONG

    // The fix:
    const discount = discountPercent > 0
        ? subtotal * (discountPercent / 100)
        : 0;

    const total = subtotal - discount;

    logger.debug({ discount, total }, 'calculateTotal output');
    return total;
}

// 3. Performance debugging — identify slow operations
async function debugSlowQuery() {
    const start = performance.now();

    const result = await db.query('SELECT * FROM quotations WHERE ...');

    const duration = performance.now() - start;
    if (duration > 1000) {
        logger.warn({
            query: 'SELECT quotations',
            duration,
            threshold: 1000,
        }, 'Slow query detected');
    }

    return result;
}
```

### Debug Endpoints (dev/staging only)

```typescript
import { Router } from 'elit/router';

const debugRouter = Router();

// Only enable in non-production
if (process.env.NODE_ENV !== 'production') {
    // Health details
    debugRouter.get('/debug/health', async (req, res) => {
        res.json({
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            env: process.env.NODE_ENV,
            version: process.env.APP_VERSION,
            connections: {
                database: await checkDbConnection(),
                redis: await checkRedisConnection(),
            },
        });
    });

    // Recent errors
    debugRouter.get('/debug/errors', (req, res) => {
        res.json({
            recentErrors: errorStore.getRecent(50),
            errorRate: errorStore.getRate('5m'),
        });
    });

    // Feature flags / config
    debugRouter.get('/debug/config', (req, res) => {
        res.json({
            publicConfig: getSafeConfig(),
            // Never expose secrets
        });
    });
}
```

## Bug Prevention

### Pre-commit Hooks

```yaml
# .github/workflows/bug-prevention.yml
name: Bug Prevention

on: [push, pull_request]

jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx tsc --noEmit

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx eslint . --max-warnings 0

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test -- --coverage
      - name: Check coverage thresholds
        run: |
          npx nyc check-coverage --lines 80 --functions 80 --branches 70

  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx vitest run --grep "Regression"
```

### Input Validation (prevent entire bug categories)

```typescript
import { z } from 'zod';

// Prevent bugs by validating at the boundary
const CreateQuotationSchema = z.object({
    customerName: z.string().min(1).max(200),
    items: z.array(z.object({
        description: z.string().min(1).max(500),
        quantity: z.number().positive().max(99999),
        unitPrice: z.number().nonnegative().max(99999999),
    })).min(1).max(100),
    discountPercent: z.number().min(0).max(100).default(0),
    taxRate: z.number().min(0).max(100).default(7),
    notes: z.string().max(2000).optional(),
});

type CreateQuotationInput = z.infer<typeof CreateQuotationSchema>;

// Usage in route handler
async function handleCreateQuotation(req: Request, res: Response) {
    const parsed = CreateQuotationSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: parsed.error.flatten(),
        });
    }

    // parsed.data is now type-safe and validated
    const quotation = await createQuotation(parsed.data);
    res.status(201).json(quotation);
}
```

## Bug Metrics & Dashboard

### Key Metrics

```typescript
interface BugMetrics {
    // Counts
    openBugs: number;
    closedThisWeek: number;
    newThisWeek: number;

    // By severity
    criticalOpen: number;
    highOpen: number;
    mediumOpen: number;
    lowOpen: number;

    // Time metrics
    meanTimeToTriage: number;      // hours
    meanTimeToResolution: number;   // hours
    meanTimeToFirstResponse: number; // hours

    // Quality metrics
    regressionRate: number;         // % of fixes that cause new bugs
    reopenedRate: number;           // % of closed bugs reopened
    bugEscapeRate: number;          // bugs found in prod vs total found
}

// GitHub Actions: weekly bug metrics report
/*
name: Bug Metrics
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9am

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - name: Generate metrics
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          echo "## Bug Report - $(date +%Y-%m-%d)" >> report.md
          echo "" >> report.md

          OPEN=$(gh issue list --label bug --state open --json number -q 'length')
          CRITICAL=$(gh issue list --label bug --label severity:critical --state open --json number -q 'length')
          HIGH=$(gh issue list --label bug --label severity:high --state open --json number -q 'length')

          echo "| Metric | Count |" >> report.md
          echo "|--------|-------|" >> report.md
          echo "| Open Bugs | $OPEN |" >> report.md
          echo "| Critical | $CRITICAL |" >> report.md
          echo "| High | $HIGH |" >> report.md

          # Post to Slack or create a GitHub issue
*/
```

## Incident Response (S1/S2 Bugs)

### Incident Playbook

```markdown
## S1/S2 Incident Response

### Immediate (0–15 min)
1. Acknowledge the report
2. Create incident channel: #inc-YYYY-MM-DD-short-desc
3. Assign incident commander
4. Assess blast radius (how many users affected?)
5. Post status: "We are investigating reports of..."

### Short-term (15–60 min)
1. Identify root cause
2. Decide: fix forward OR rollback
3. If rollback:
   - git revert <commit>
   - deploy previous known-good version
4. If fix forward:
   - Create hotfix branch
   - Write failing test
   - Fix the bug
   - Deploy to staging → verify → production
5. Post update: "We have identified the issue and are deploying a fix"

### Follow-up (1–24 hours)
1. Confirm fix resolved the issue
2. Post status: "The issue has been resolved"
3. Write Root Cause Analysis
4. Schedule post-mortem meeting
5. Create prevention tasks (tests, monitoring, alerts)
6. Close incident channel

### Post-mortem (within 1 week)
1. Blameless review of timeline
2. What happened, why, impact
3. What went well in the response
4. What could be improved
5. Action items with owners and deadlines
```

### Hotfix Branch Workflow

```bash
# Create hotfix from production tag
git checkout -b hotfix/issue-123-zero-discount v1.2.3

# Make the minimal fix
# ... edit files ...

# Add regression test
# ... write test ...

# Run full test suite
npm test

# Commit and push
git add -A
git commit -m "fix: handle zero discount in total calculation (#123)"
git push origin hotfix/issue-123-zero-discount

# Create PR targeting main
gh pr create \
    --title "fix: handle zero discount in total calculation" \
    --body "Fixes #123

## Summary
- Add zero-check in discount calculation
- Add regression test for discount = 0

## Test Plan
- [x] Unit test passes
- [x] Integration test passes
- [x] Manual test on staging" \
    --label "bug,severity:high,hotfix"

# After merge, also merge into develop
git checkout develop
git merge hotfix/issue-123-zero-discount
```

## Code Style Rules

- Every bug fix MUST include a regression test tagged with the issue number
- Bug reports must follow the template: description, steps, expected, actual, severity, environment
- Use Zod schema validation at API boundaries to prevent entire classes of bugs
- S1/S2 bugs require a Root Cause Analysis within 24 hours of resolution
- Never deploy a hotfix without a corresponding test
- Use structured error context collection for production debugging — never log sensitive data (passwords, tokens, PII)
- Label all GitHub issues with severity and status labels during triage
- Debug endpoints must be gated behind `NODE_ENV !== 'production'` check
- Include `git bisect` as a standard tool for finding regression-introducing commits
- Track bug metrics weekly: open count, MTTR, regression rate, escape rate
