---
name: dependency-management
description: Dependency management — npm/pnpm package management, lockfiles, version pinning, dependency audit, outdated detection, security vulnerabilities, bundle analysis, dependency update strategy, and package maintenance for TypeScript/Node.js projects
---

# Dependency Management

## Package Manager Selection

```
npm   — Default, ubiquitous, good for most projects
pnpm  — Fast, disk-efficient, strict node_modules, good for monorepos
yarn  — berry (v4) has PnP, workspaces; classic (v1) is legacy

Recommendation for this project: npm (shipped with Node.js, zero config)
```

### npm Configuration

```ini
# .npmrc — project-level config

# Strict semver for saves
save-exact=true

# Audit on install
audit=true

# Fund messages off
fund=false

# Package lock is required
package-lock=true

# Engine strictness
engine-strict=true

# Registry (use private registry if available)
# registry=https://registry.npmjs.org/

# Ignore scripts from dependencies (security)
ignore-scripts=false
```

```json
// package.json — engine constraints
{
    "engines": {
        "node": ">=20.0.0",
        "npm": ">=10.0.0"
    }
}
```

## Dependency Categories

### What Goes Where

```
dependencies          → Required at runtime (express, pg, ioredis, bcrypt)
devDependencies       → Only for development (vitest, typescript, eslint, tsx)
peerDependencies      → Expected from consumer (plugin host, framework)
optionalDependencies  → Graceful degradation (fsevents, cpu-features)
bundledDependencies   → Embedded in publish output

Rules:
- Never put dev tools in dependencies (bloats production)
- Never put runtime libs in devDependencies (missing in production)
- Use peerDependencies for plugin systems
- Type packages (@types/*) always in devDependencies
```

### Common Dependency Tiers

```json
{
    "dependencies": {
        "express": "^4.18.0",
        "pg": "^8.12.0",
        "ioredis": "^5.4.0",
        "bcrypt": "^5.1.0",
        "jsonwebtoken": "^9.0.0",
        "zod": "^3.23.0",
        "pino": "^9.0.0",
        "dotenv": "^16.4.0"
    },
    "devDependencies": {
        "typescript": "^5.5.0",
        "vitest": "^2.0.0",
        "@vitest/coverage-v8": "^2.0.0",
        "supertest": "^7.0.0",
        "@types/express": "^4.17.0",
        "@types/node": "^20.14.0",
        "eslint": "^9.0.0",
        "tsx": "^4.16.0"
    }
}
```

## Version Ranges

### Range Syntax

```
Exact:        1.2.3            → Only 1.2.3
Caret (^):    ^1.2.3           → >=1.2.3 <2.0.0  (compatible)
Tilde (~):    ~1.2.3           → >=1.2.3 <1.3.0  (patch only)
Range:        >=1.2.3 <2.0.0   → Explicit range
Or:           1.x || 2.x       → Either major
Latest:       * or ""           → Any version
Tag:          next || beta      → npm dist-tag

Recommended:
  ^1.2.3  for most dependencies  (get patches + minor features)
  ~1.2.3  for critical libs     (only patches, no surprises)
  1.2.3   for fragile packages  (exact, must test before bump)
```

### When to Pin Versions

```
Pin exact (1.2.3) when:
- Build tooling with known incompatibilities (esbuild, webpack)
- Native modules (bcrypt, sharp, node-gyp)
- Pre-release versions (2.0.0-beta.1)
- Known breaking semver offender packages

Use caret (^1.2.3) when:
- Well-maintained packages with good semver discipline
- Types packages (@types/*)
- Utility libraries (lodash, date-fns, zod)

Use tilde (~1.2.3) when:
- Security-critical packages
- Database drivers
- Packages with history of accidental breaking changes
```

## Lockfile Management

### package-lock.json

```
RULES:
1. ALWAYS commit package-lock.json to git
2. NEVER manually edit package-lock.json
3. NEVER npm install without generating lockfile changes
4. Delete node_modules + package-lock.json only as last resort

Why lockfiles matter:
- Ensures every developer gets identical dependency tree
- Ensures CI gets identical dependency tree
- Ensures production gets identical dependency tree
- Prevents "works on my machine" bugs
- Prevents supply chain drift
```

### Lockfile Verification

```yaml
# .github/workflows/verify-lockfile.yml
name: Verify Lockfile

on:
  pull_request:
    paths:
      - 'package.json'
      - 'package-lock.json'

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Verify lockfile is up to date
        run: |
          npm install --package-lock-only
          git diff --exit-code package-lock.json

      - name: Check for duplicate dependencies
        run: npx npm Dedupe --dry-run
```

## Dependency Audit

### Security Auditing

```bash
# Check for known vulnerabilities
npm audit

# Fix automatically fixable vulnerabilities
npm audit fix

# Fix breaking changes (may upgrade major versions)
npm audit fix --force

# Get detailed JSON report
npm audit --json

# Production dependencies only
npm audit --omit=dev

# Continuous monitoring in CI
npm audit --audit-level=high
```

### CI Audit Workflow

```yaml
# .github/workflows/audit.yml
name: Security Audit

on:
  schedule:
    - cron: '7 6 * * 1'    # Weekly Monday 6:07am
  pull_request:
    paths:
      - 'package.json'
      - 'package-lock.json'

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run npm audit
        run: |
          npm audit --audit-level=high --omit=dev || true

          # Get count of vulnerabilities
          HIGH=$(npm audit --json | jq '.metadata.vulnerabilities.high // 0')
          CRITICAL=$(npm audit --json | jq '.metadata.vulnerabilities.critical // 0')

          if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
            echo "::error::$CRITICAL critical and $HIGH high vulnerabilities found"
            exit 1
          fi

      - name: Check for known issues
        run: npx better-npm-audit audit --level=high || true
```

## Outdated Dependencies

### Detection

```bash
# Check all outdated packages
npm outdated

# Check only production dependencies
npm outdated --omit=dev

# Check specific package
npm outdated express

# JSON output for scripts
npm outdated --json || true
```

### Update Strategy

```bash
# Safe: update only patch versions (1.2.3 → 1.2.4)
npm update --save

# Update specific package
npm update express

# Bump specific package to latest
npm install express@latest

# Bump specific package to specific version
npm install express@4.19.0

# Check what would update (dry run)
npm update --dry-run
```

### Batch Update Script

```typescript
// scripts/update-deps.ts
import { execFileSync } from 'child_process';

interface OutdatedPkg {
    current: string;
    wanted: string;
    latest: string;
    dependent: string;
    type: string; // dev, prod, etc
}

function getOutdated(): Record<string, OutdatedPkg> {
    try {
        const output = execFileSync('npm', ['outdated', '--json'], { encoding: 'utf-8' });
        return JSON.parse(output);
    } catch (error: any) {
        // npm outdated exits with code 1 when packages are outdated
        if (error.stdout) return JSON.parse(error.stdout);
        return {};
    }
}

function categorize(outdated: Record<string, OutdatedPkg>) {
    const safe: string[] = [];    // patch only
    const moderate: string[] = []; // minor
    const risky: string[] = [];    // major

    for (const [name, info] of Object.entries(outdated)) {
        const [curMajor] = info.current.split('.').map(Number);
        const [latMajor] = info.latest.split('.').map(Number);

        if (latMajor > curMajor) {
            risky.push(`${name}: ${info.current} → ${info.latest}`);
        } else if (info.wanted !== info.current) {
            moderate.push(`${name}: ${info.current} → ${info.wanted}`);
        }
    }

    return { safe, moderate, risky };
}

const outdated = getOutdated();
const { safe, moderate, risky } = categorize(outdated);

console.log('=== Dependency Update Report ===\n');

if (safe.length) {
    console.log('Patch updates (safe — npm update):');
    safe.forEach(s => console.log(`  ${s}`));
    console.log();
}

if (moderate.length) {
    console.log('Minor updates (test after):');
    moderate.forEach(m => console.log(`  ${m}`));
    console.log();
}

if (risky.length) {
    console.log('Major updates (test thoroughly + check changelog):');
    risky.forEach(r => console.log(`  ${r}`));
    console.log();
}

console.log(`Total: ${safe.length + moderate.length + risky.length} packages outdated`);
```

## Dependency Update Automation

### Dependabot Configuration

```yaml
# .github/dependabot.yml
version: 2

updates:
  # Enable version updates for npm
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: '06:00'
    open-pull-requests-limit: 10
    reviewers:
      - dev-team
    labels:
      - dependencies
    commit-message:
      prefix: chore
      prefix-development: chore
      include: scope
    groups:
      dev-dependencies:
        patterns:
          - '@types/*'
          - 'vitest'
          - '@vitest/*'
          - 'eslint'
          - 'typescript'
          - 'tsx'
        update-types:
          - minor
          - patch
      production-dependencies:
        patterns:
          - '*'
        exclude-patterns:
          - '@types/*'
          - 'vitest'
          - '@vitest/*'
          - 'eslint'
          - 'typescript'
          - 'tsx'
        update-types:
          - patch
    ignore:
      # Ignore major version bumps for these (manual review)
      - dependency-name: express
        update-types: ['version-update:semver-major']
      - dependency-name: bcrypt
        update-types: ['version-update:semver-major']
      - dependency-name: jsonwebtoken
        update-types: ['version-update:semver-major']

  # Enable version updates for GitHub Actions
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
    labels:
      - dependencies
      - ci
```

### Renovate Alternative

```json
// renovate.json
{
    "$schema": "https://docs.renovatebot.com/renovate-schema.json",
    "extends": [
        "config:recommended"
    ],
    "schedule": ["before 6am on Monday"],
    "labels": ["dependencies"],
    "commitMessagePrefix": "chore(deps):",
    "prConcurrentLimit": 5,
    "prHourlyLimit": 2,
    "separateMajorMinor": true,
    "packageRules": [
        {
            "matchUpdateTypes": ["patch"],
            "groupName": "patch updates",
            "automerge": true
        },
        {
            "matchDepTypes": ["devDependencies"],
            "matchUpdateTypes": ["minor", "patch"],
            "groupName": "dev deps (non-major)",
            "automerge": true
        },
        {
            "matchDepTypes": ["dependencies"],
            "matchUpdateTypes": ["minor"],
            "groupName": "prod deps (minor)",
            "automerge": false
        },
        {
            "matchUpdateTypes": ["major"],
            "groupName": "major updates",
            "automerge": false,
            "reviewers": ["dev-team"]
        },
        {
            "matchPackagePatterns": ["@types/*"],
            "groupName": "type definitions",
            "automerge": true
        }
    ]
}
```

## Bundle Analysis

### Checking Dependency Size

```bash
# Analyze bundle size
npx bundlewatch --config bundlewatch.config.js

# Check what a package adds
npx cost-of-modules --include-dev

# Tree-shaking check
npx agadoo dist/index.js

# Find duplicate dependencies
npx npm Dedupe --dry-run
npx find-duplicate-dependencies
```

```javascript
// bundlewatch.config.js
module.exports = {
    files: [
        {
            path: 'dist/server.js',
            maxSize: '500KB',
        },
        {
            path: 'dist/public/assets/*.js',
            maxSize: '300KB',
        },
    ],
    ci: {
        trackBranches: ['main'],
        repoBranchBase: 'main',
    },
};
```

### Dependency Count Check

```typescript
// scripts/check-deps.ts
import { readFileSync } from 'fs';

interface PkgJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

const pkg: PkgJson = JSON.parse(readFileSync('package.json', 'utf-8'));

const prodCount = Object.keys(pkg.dependencies ?? {}).length;
const devCount = Object.keys(pkg.devDependencies ?? {}).length;

console.log(`Production dependencies: ${prodCount}`);
console.log(`Dev dependencies: ${devCount}`);
console.log(`Total: ${prodCount + devCount}`);

// Warn if too many production deps
if (prodCount > 30) {
    console.warn(`WARNING: ${prodCount} production dependencies is a lot. Consider reducing.`);
}

// List production deps
console.log('\nProduction dependencies:');
for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
    console.log(`  ${name}: ${version}`);
}
```

## Dependency Hygiene

### Adding a New Dependency Checklist

```markdown
## Before Adding a New Package

1. Do I really need it?
   - Can I implement it in <50 lines?
   - Is it a one-time use or core functionality?
   - Does the stdlib or existing dep already cover it?

2. Is the package trustworthy?
   - Weekly downloads > 10K?
   - GitHub stars > 500?
   - Recently updated (within 6 months)?
   - Has it had security issues?
   - Is the license compatible (MIT, Apache-2.0, ISC)?

3. What does it cost?
   - Bundle size (check bundlephobia.com)
   - Number of transitive dependencies
   - Native modules (node-gyp, platform-specific)

4. Is there a lighter alternative?
   - lodash → native Array/Object methods
   - moment → date-fns or Temporal
   - axios → fetch (built-in)
   - uuid → crypto.randomUUID()
```

### Removing Dependencies

```bash
# Remove a dependency
npm uninstall express

# Remove a dev dependency
npm uninstall -D vitest

# Check what depends on a package
npm ls express

# Find unused dependencies
npx depcheck

# Remove all unused (review output first!)
npx depcheck --json | jq '.dependencies[]' | xargs npm uninstall
```

### Deduplication

```bash
# Check for duplicate packages in node_modules
npx npm Dedupe --dry-run

# Actually deduplicate
npx npm Dedupe

# Check dependency tree
npm ls --depth=0

# Full tree
npm ls

# Find specific package in tree
npm ls express --all
```

## Transitive Dependencies

### Understanding the Dependency Tree

```bash
# View full dependency tree
npm ls --all

# Find why a package is installed
npm ls bcrypt --all

# Check for conflicting versions
npx npm Dedupe --dry-run 2>&1 | grep "ERESOLVE"

# View what a package brings in
npm info express dependencies
npm info express peerDependencies
```

### Resolution Overrides

```json
// package.json — override specific transitive dependencies
{
    "overrides": {
        // Fix vulnerability in transitive dependency
        "glob@<9": "^9.0.0",

        // Force specific version for all consumers
        "lodash": "^4.17.21",

        // Nested override (specific parent)
        "eslint": {
            "glob": "^10.0.0"
        }
    }
}
```

## License Compliance

```bash
# Check all licenses
npx license-checker --summary

# Fail on non-approved licenses
npx license-checker --failOn "GPL-3.0;AGPL-3.0"

# Generate license report
npx license-checker --csv > licenses.csv

# Check only production dependencies
npx license-checker --production --summary
```

```typescript
// scripts/check-licenses.ts
import { execFileSync } from 'child_process';

const ALLOWED_LICENSES = [
    'MIT', 'MIT License',
    'Apache-2.0', 'Apache License 2.0',
    'ISC', 'ISC License',
    'BSD-2-Clause', 'BSD-3-Clause',
    '0BSD',
    'CC0-1.0',
    'Unlicense',
];

const output = execFileSync('npx', ['license-checker', '--json', '--production'], { encoding: 'utf-8' });
const packages = JSON.parse(output);

const violations: string[] = [];

for (const [path, info] of Object.entries(packages)) {
    const licenses = (info as any).licenses;
    const licenseList = Array.isArray(licenses) ? licenses : [licenses];

    for (const license of licenseList) {
        if (!ALLOWED_LICENSES.includes(license)) {
            violations.push(`${(info as any).name}: ${license}`);
        }
    }
}

if (violations.length > 0) {
    console.error('License violations found:');
    violations.forEach(v => console.error(`  - ${v}`));
    process.exit(1);
}

console.log('All licenses compliant');
```

## CI Dependency Workflow

```yaml
# .github/workflows/deps.yml
name: Dependencies

on:
  schedule:
    - cron: '17 6 * * 1'    # Weekly Monday 6:17am
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install
        run: npm ci

      - name: Security audit
        run: npm audit --audit-level=high --omit=dev

      - name: Check for outdated
        run: npm outdated || true

      - name: Check licenses
        run: npx license-checker --failOn "GPL-3.0;AGPL-3.0"

      - name: Check for unused deps
        run: npx depcheck || true

      - name: Deduplicate check
        run: npx npm Dedupe --dry-run || true

      - name: Generate report
        run: |
          echo "## Dependency Report" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### Security Audit" >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY
          npm audit --omit=dev 2>&1 >> $GITHUB_STEP_SUMMARY || true
          echo '```' >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### Outdated Packages" >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY
          npm outdated 2>&1 >> $GITHUB_STEP_SUMMARY || true
          echo '```' >> $GITHUB_STEP_SUMMARY
```

## Node Modules Cleanup

```bash
# Clean install from scratch
rm -rf node_modules package-lock.json
npm install

# Quick reinstall (keeps lockfile)
rm -rf node_modules
npm ci

# Find largest node_modules
du -sh node_modules
du -sh node_modules/* | sort -rh | head -20

# Nuclear option (clear npm cache too)
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## Code Style Rules

- Always commit package-lock.json — never gitignore it
- Use `npm ci` in CI (not `npm install`) for deterministic installs
- Run `npm audit` in CI — fail on high/critical vulnerabilities
- Pin exact versions for native modules and fragile packages
- Use caret (^) ranges for well-maintained packages with good semver
- Never add a dependency when native JS/Node.js API suffices (<50 lines of code)
- Run `npx depcheck` before releases to find unused dependencies
- Group dev dependency updates for auto-merge in Dependabot/Renovate
- Review major version bumps manually — never auto-merge major updates
- Check license compliance for all production dependencies before adding
- Keep production dependencies minimal — every dep is attack surface
