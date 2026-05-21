---
name: semantic-versioning
description: Semantic Versioning automation and tooling — semver rules, conventional commits, automated version bumping, changelog generation, release-it, standard-version, git tagging, npm publishing, GitHub Releases, and release workflow for TypeScript/Node.js projects
---

# Semantic Versioning

## SemVer Rules (Quick Reference)

```
Format: MAJOR.MINOR.PATCH[-PRERELEASE]+BUILD

Given a version number MAJOR.MINOR.PATCH, increment the:

1. MAJOR version when you make incompatible API changes
2. MINOR version when you add functionality in a backward compatible manner
3. PATCH version when you make backward compatible bug fixes

Additional labels for pre-release and build metadata:
  1.0.0-alpha.1    → early development
  1.0.0-beta.2     → feature complete, testing
  1.0.0-rc.1       → release candidate
  1.0.0+build.123  → build metadata (ignored in precedence)

Precedence: 1.0.0-alpha < 1.0.0-beta < 1.0.0-rc < 1.0.0
```

## Conventional Commits

### Commit Message Format

```
<type>(<scope>): <subject>

[body]

[footer(s)]
```

```
Types:
  feat:     → MINOR bump (new feature)
  fix:      → PATCH bump (bug fix)
  docs:     → no bump (documentation)
  style:    → no bump (formatting, semicolons)
  refactor: → no bump (code restructure, no behavior change)
  perf:     → PATCH bump (performance improvement)
  test:     → no bump (adding tests)
  build:    → no bump (build system, deps)
  ci:       → no bump (CI configuration)
  chore:    → no bump (maintenance)
  revert:   → PATCH bump (revert a commit)

Breaking changes (MAJOR bump):
  feat!: new API         → breaking in subject
  feat!: new API         → breaking with !
  feat: new API          → breaking in footer

  BREAKING CHANGE: description
  BREAKING-CHANGE: description

Scopes (optional):
  feat(auth): add OAuth2 support
  fix(quotation): handle zero discount
  feat(api): add pagination to quotations
```

### Commit Examples

```
feat(quotation): add PDF export functionality
fix(auth): prevent session fixation on login
fix(quotation): handle zero discount in total calculation

feat(api)!: change quotation response shape

BREAKING CHANGE: quotation response now returns `items` as array
instead of `lineItems`. Update consumers to use `items`.

Closes #123

---

perf(queries): optimize quotation list with composite index
docs(api): update quotation endpoint examples
ci: add coverage threshold check to CI pipeline
build(deps): update vitest to v2.1.0
refactor(calc): extract discount logic to separate function
test(quotation): add edge case tests for zero discount
```

### Commitlint Configuration

```typescript
// commitlint.config.ts
import type { UserConfig } from '@commitlint/cli';

const Configuration: UserConfig = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        // Type enforcement
        'type-enum': [
            2,
            'always',
            [
                'feat', 'fix', 'docs', 'style', 'refactor',
                'perf', 'test', 'build', 'ci', 'chore', 'revert',
            ],
        ],
        'type-case': [2, 'always', 'lowerCase'],
        'type-empty': [2, 'never'],

        // Subject
        'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
        'subject-empty': [2, 'never'],
        'subject-full-stop': [2, 'never', '.'],
        'subject-max-length': [2, 'always', 72],

        // Body
        'body-leading-blank': [2, 'always'],
        'body-max-line-length': [2, 'always', 100],

        // Footer
        'footer-leading-blank': [2, 'always'],
        'footer-max-line-length': [2, 'always', 100],
    },
};

export default Configuration;
```

```json
// package.json
{
    "devDependencies": {
        "@commitlint/cli": "^19.0.0",
        "@commitlint/config-conventional": "^19.0.0",
        "husky": "^9.0.0"
    },
    "scripts": {
        "prepare": "husky"
    }
}
```

```bash
# Set up husky + commitlint
npx husky init
echo "npx --no -- commitlint --edit \$1" > .husky/commit-msg
```

## Version Bump Automation

### release-it (recommended)

```json
// .release-it.json
{
    "git": {
        "tagName": "v${version}",
        "commitMessage": "chore(release): v${version}",
        "tagAnnotation": "Release v${version}"
    },
    "github": {
        "release": true,
        "releaseName": "v${version}",
        "releaseNotes": "node scripts/release-notes.mjs"
    },
    "npm": {
        "publish": false
    },
    "hooks": {
        "before:bump": "npm run lint && npm run typecheck && npm test",
        "after:bump": "npm run build",
        "after:release": "echo Successfully released ${name} v${version}!"
    },
    "plugins": {
        "@release-it/conventional-changelog": {
            "preset": {
                "name": "conventionalcommits"
            },
            "infile": "CHANGELOG.md",
            "header": "# Changelog",
            "ignoreRecommendedBump": false,
            "strictSemVer": true
        }
    }
}
```

```json
// package.json scripts
{
    "release": "release-it",
    "release:minor": "release-it minor",
    "release:major": "release-it major",
    "release:alpha": "release-it --preRelease=alpha",
    "release:beta": "release-it --preRelease=beta",
    "release:rc": "release-it --preRelease=rc",
    "release:dry": "release-it --dry-run"
}
```

### Manual Version Bump Script

```typescript
// scripts/bump-version.ts
import { readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';

interface SemVer {
    major: number;
    minor: number;
    patch: number;
    prerelease?: string;
    build?: string;
}

function parse(version: string): SemVer {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?(?:\+([\w.]+))?$/);
    if (!match) throw new Error(`Invalid semver: ${version}`);
    return {
        major: parseInt(match[1]),
        minor: parseInt(match[2]),
        patch: parseInt(match[3]),
        prerelease: match[4],
        build: match[5],
    };
}

function format(v: SemVer): string {
    let result = `${v.major}.${v.minor}.${v.patch}`;
    if (v.prerelease) result += `-${v.prerelease}`;
    if (v.build) result += `+${v.build}`;
    return result;
}

function bump(current: string, type: 'major' | 'minor' | 'patch', prerelease?: string): string {
    const v = parse(current);

    switch (type) {
        case 'major':
            v.major++;
            v.minor = 0;
            v.patch = 0;
            break;
        case 'minor':
            v.minor++;
            v.patch = 0;
            break;
        case 'patch':
            v.patch++;
            break;
    }

    v.prerelease = prerelease;
    return format(v);
}

function determineBumpType(): 'major' | 'minor' | 'patch' {
    // Read commits since last tag
    const lastTag = execFileSync('git', ['describe', '--tags', '--abbrev=0'], { encoding: 'utf-8' }).trim();
    const commits = execFileSync('git', ['log', `${lastTag}..HEAD`, '--pretty=format:%s'], { encoding: 'utf-8' });

    if (commits.includes('BREAKING CHANGE') || commits.match(/^[a-z]+(\([^)]*\))?!:/m)) {
        return 'major';
    }
    if (commits.includes('feat')) {
        return 'minor';
    }
    return 'patch';
}

// Read current version from package.json
const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const currentVersion = pkg.version;

const bumpType = process.argv[2] as 'major' | 'minor' | 'patch' | 'auto' || 'auto';
const prerelease = process.argv[3]; // optional: 'alpha', 'beta', 'rc'

const type = bumpType === 'auto' ? determineBumpType() : bumpType;
const newVersion = bump(currentVersion, type, prerelease);

console.log(`Bumping: ${currentVersion} → ${newVersion} (${type})`);

// Update package.json
pkg.version = newVersion;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

console.log(`Version updated to ${newVersion}`);
```

## Changelog Generation

### Conventional Changelog

```typescript
// scripts/release-notes.mjs
// Generates release notes for release-it

import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';

function getCommitsSinceTag(tag) {
    const output = execFileSync('git', ['log', `${tag}..HEAD`, '--pretty=format:%H||%s||%b'], { encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean).map(line => {
        const [hash, subject, body] = line.split('||');
        return { hash: hash.substring(0, 7), subject, body };
    });
}

function categorizeCommits(commits) {
    const categories = {
        breaking: [],
        features: [],
        fixes: [],
        perf: [],
        other: [],
    };

    for (const commit of commits) {
        const msg = commit.subject;

        if (msg.includes('BREAKING CHANGE') || commit.body?.includes('BREAKING CHANGE') || msg.match(/^[a-z]+(\([^)]*\))?!:/)) {
            categories.breaking.push(commit);
        } else if (msg.startsWith('feat')) {
            categories.features.push(commit);
        } else if (msg.startsWith('fix')) {
            categories.fixes.push(commit);
        } else if (msg.startsWith('perf')) {
            categories.perf.push(commit);
        } else {
            categories.other.push(commit);
        }
    }

    return categories;
}

function formatCommit(commit) {
    // Extract scope
    const scopeMatch = commit.subject.match(/^[a-z]+\(([^)]+)\)?:\s*(.+)/);
    const scope = scopeMatch?.[1] ? `[${scopeMatch[1]}] ` : '';
    const desc = scopeMatch?.[2] || commit.subject;
    return `- ${scope}${desc} (${commit.hash})`;
}

const lastTag = execFileSync('git', ['describe', '--tags', '--abbrev=0'], { encoding: 'utf-8'}).trim();
const commits = getCommitsSinceTag(lastTag);
const cats = categorizeCommits(commits);

let notes = '';

if (cats.breaking.length) {
    notes += '### BREAKING CHANGES\n\n';
    notes += cats.breaking.map(formatCommit).join('\n') + '\n\n';
}

if (cats.features.length) {
    notes += '### Features\n\n';
    notes += cats.features.map(formatCommit).join('\n') + '\n\n';
}

if (cats.fixes.length) {
    notes += '### Bug Fixes\n\n';
    notes += cats.fixes.map(formatCommit).join('\n') + '\n\n';
}

if (cats.perf.length) {
    notes += '### Performance\n\n';
    notes += cats.perf.map(formatCommit).join('\n') + '\n\n';
}

process.stdout.write(notes.trim());
```

### CHANGELOG.md Format

```markdown
# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.3.0] - 2024-01-15

### Features
- [quotation] Add PDF export functionality (#89)
- [api] Add pagination to quotations endpoint (#91)
- [auth] Add OAuth2 Google login support (#93)

### Bug Fixes
- [quotation] Handle zero discount in total calculation (#95)
- [auth] Prevent session fixation on login (#97)
- [pdf] Fix Thai character rendering in PDF (#98)

### Performance
- [queries] Optimize quotation list with composite index (#96)

### BREAKING CHANGES
- [api] Quotation response shape changed: `lineItems` → `items`
  Migration: Update consumers to use `items` field (#92)

## [1.2.1] - 2024-01-08

### Bug Fixes
- [quotation] Fix discount calculation for percentage discounts (#88)

## [1.2.0] - 2024-01-01

### Features
- [quotation] Add discount support (fixed and percentage)
- [notifications] Add email notifications for quotation status changes

## [1.1.0] - 2024-12-20

### Features
- [auth] Add password reset flow
- [ui] Add quotation search and filtering

### Bug Fixes
- [auth] Fix token refresh when token is expired but refresh token is valid

## [1.0.0] - 2024-12-01

### Features
- Initial release with core quotation management
- User authentication with JWT
- Customer management
- Quotation CRUD with item management
```

## Git Tagging

### Tag Strategy

```bash
# Annotated tags (recommended — includes tagger info and message)
git tag -a v1.2.0 -m "Release v1.2.0: Add discount support"

# Lightweight tags (commit pointer only)
git tag v1.2.0

# Pre-release tags
git tag -a v2.0.0-alpha.1 -m "Release v2.0.0-alpha.1: Early preview"
git tag -a v2.0.0-beta.1 -m "Release v2.0.0-beta.1: Feature complete"
git tag -a v2.0.0-rc.1 -m "Release v2.0.0-rc.1: Release candidate"

# List tags
git tag -l                # All tags
git tag -l "v1.*"         # Filter by pattern
git tag -l --sort=-v:refname  # Sort by semver (newest first)

# Show tag details
git show v1.2.0

# Delete tag
git tag -d v1.2.0
git push origin :refs/tags/v1.2.0

# Push tags
git push origin v1.2.0    # Single tag
git push origin --tags     # All tags

# Checkout specific version
git checkout v1.2.0
```

### Tag Protection Rules

```yaml
# GitHub: Settings → Tags → Rules
# Protect tags matching: v*
# Allow only: Administrators and release workflow

# .github/workflows/protect-tags.yml
name: Protect Release Tags

on:
  push:
    tags:
      - 'v*'

jobs:
  validate-tag:
    runs-on: ubuntu-latest
    steps:
      - name: Validate tag format
        run: |
          TAG=${GITHUB_REF#refs/tags/}
          echo "Tag: $TAG"

          # Must match semver pattern
          if ! [[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$ ]]; then
            echo "ERROR: Tag $TAG does not follow semver format"
            exit 1
          fi

          # Must match package.json version
          PKG_VERSION=$(jq -r .version package.json)
          if [[ "$TAG" != "v$PKG_VERSION" ]]; then
            echo "ERROR: Tag $TAG does not match package.json version $PKG_VERSION"
            exit 1
          fi

          echo "Tag $TAG is valid"
```

## GitHub Releases

### Automated Release Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for changelog

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - run: npm ci

      - name: Verify version matches tag
        run: |
          TAG=${GITHUB_REF#refs/tags/}
          PKG_VERSION=$(jq -r .version package.json)
          echo "Tag: $TAG, Package: v$PKG_VERSION"
          [[ "$TAG" == "v$PKG_VERSION" ]] || exit 1

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Generate release notes
        id: notes
        run: |
          TAG=${GITHUB_REF#refs/tags/}
          PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")

          if [ -n "$PREV_TAG" ]; then
            NOTES=$(git log "$PREV_TAG"..HEAD --pretty=format:"- %s (%h)" \
              --grep="^feat" --grep="^fix" --grep="^perf" --grep="BREAKING")
          else
            NOTES=$(git log --pretty=format:"- %s (%h)" -20)
          fi

          # Save to file for multiline GITHUB_OUTPUT
          echo "$NOTES" > release-notes.txt
          echo "file=release-notes.txt" >> $GITHUB_OUTPUT

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          body_path: ${{ steps.notes.outputs.file }}
          draft: false
          prerelease: ${{ contains(github.ref, '-alpha') || contains(github.ref, '-beta') || contains(github.ref, '-rc') }}
          generate_release_notes: true

      - name: Build Docker image
        run: |
          TAG=${GITHUB_REF#refs/tags/}
          docker build -t quotation-app:$TAG .
          docker tag quotation-app:$TAG quotation-app:latest

      - name: Push to GHCR
        run: |
          TAG=${GITHUB_REF#refs/tags/}
          echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker tag quotation-app:$TAG ghcr.io/${{ github.repository }}:$TAG
          docker tag quotation-app:latest ghcr.io/${{ github.repository }}:latest
          docker push ghcr.io/${{ github.repository }}:$TAG
          docker push ghcr.io/${{ github.repository }}:latest
```

### Manual Release via CLI

```bash
# Using gh CLI to create a release
gh release create v1.2.0 \
    --title "v1.2.0: Discount Support" \
    --notes "$(cat <<'EOF'
## Features
- Add discount support (fixed and percentage)
- Add email notifications for quotation status changes

## Bug Fixes
- Fix discount calculation for percentage discounts

## Migration
No database migration required for this release.
EOF
)" \
    --target main

# Create a draft release
gh release create v2.0.0-rc.1 --draft --prerelease \
    --title "v2.0.0-rc.1" \
    --notes "Release candidate for v2.0.0"

# Upload build artifacts to release
gh release upload v1.2.0 ./dist/quotation-app.zip

# List releases
gh release list --limit 10

# View release notes
gh release view v1.2.0
```

## npm Package Versioning

### package.json Version Fields

```json
{
    "name": "quotation-app",
    "version": "1.2.0",
    "private": true
}
```

```typescript
// src/version.ts — expose version at runtime
import { readFileSync } from 'fs';
import { join } from 'path';

let _version: string | undefined;

export function getVersion(): string {
    if (!_version) {
        const pkg = JSON.parse(
            readFileSync(join(import.meta.dirname, '../package.json'), 'utf-8')
        );
        _version = pkg.version;
    }
    return _version;
}

// Health endpoint
// GET /health → { status: "ok", version: "1.2.0", ... }
```

### Version in Build Pipeline

```dockerfile
# Dockerfile — inject version at build time
ARG APP_VERSION=0.0.0

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV APP_VERSION=$APP_VERSION
RUN npm run build

# Runtime
FROM gcr.io/distroless/nodejs20-debian12
COPY --from=builder /app/dist /app/dist
ENV APP_VERSION=$APP_VERSION
CMD ["dist/server.js"]
```

```bash
# Build with version
docker build --build-arg APP_VERSION=1.2.0 -t quotation-app:v1.2.0 .
```

```yaml
# GitHub Actions — inject git tag as version
- name: Build Docker image
  run: |
    TAG=${GITHUB_REF#refs/tags/}
    VERSION=${TAG#v}
    docker build --build-arg APP_VERSION=$VERSION -t quotation-app:$TAG .
```

## Pre-release Workflow

### Alpha → Beta → RC → Stable

```
Development Flow:
  main ──────┬─────────────────────── merge → stable release
  develop ───┼── 2.0.0-alpha.1 ──→ 2.0.0-beta.1 ──→ 2.0.0-rc.1 ──→ 2.0.0
              │
              ├── Feature branches merge into develop
              └── Pre-release tags on develop branch

Pre-release bumping:
  2.0.0-alpha.1 → 2.0.0-alpha.2  (more features)
  2.0.0-alpha.3 → 2.0.0-beta.1   (feature freeze)
  2.0.0-beta.2  → 2.0.0-rc.1     (ready for release)
  2.0.0-rc.1    → 2.0.0           (stable)
```

```bash
# release-it pre-release commands
npm run release:alpha    # → 2.0.0-alpha.1
npm run release:alpha    # → 2.0.0-alpha.2
npm run release:beta     # → 2.0.0-beta.1
npm run release:rc       # → 2.0.0-rc.1

# Final stable release
npm run release          # → 2.0.0
```

### Branch Protection for Releases

```yaml
# .github/workflows/pr-version-check.yml
name: Version Check

on:
  pull_request:
    branches: [main]

jobs:
  check-version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check if version was bumped
        run: |
          CURRENT=$(jq -r .version package.json)
          MAIN_VERSION=$(git show origin/main:package.json | jq -r .version)

          echo "Current: $CURRENT, Main: $MAIN_VERSION"

          if [ "$CURRENT" = "$MAIN_VERSION" ]; then
            echo "::warning::Version in package.json was not bumped"
            echo "Consider bumping the version if this PR introduces new features or fixes"
          fi

          # Verify version is valid semver
          if ! [[ "$CURRENT" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$ ]]; then
            echo "::error::Invalid semver format: $CURRENT"
            exit 1
          fi
```

## Version Comparison Utilities

```typescript
// src/utils/semver.ts

export function compareVersions(a: string, b: string): -1 | 0 | 1 {
    const pa = parseSemVer(a);
    const pb = parseSemVer(b);

    // Compare major.minor.patch
    for (const key of ['major', 'minor', 'patch'] as const) {
        if (pa[key] > pb[key]) return 1;
        if (pa[key] < pb[key]) return -1;
    }

    // No prerelease > with prerelease (1.0.0 > 1.0.0-alpha)
    if (!pa.prerelease && pb.prerelease) return 1;
    if (pa.prerelease && !pb.prerelease) return -1;
    if (pa.prerelease && pb.prerelease) {
        return pa.prerelease.localeCompare(pb.prerelease) as -1 | 0 | 1;
    }

    return 0;
}

export function isVersionInRange(version: string, min: string, max?: string): boolean {
    return compareVersions(version, min) >= 0 && (!max || compareVersions(version, max) <= 0);
}

interface ParsedSemVer {
    major: number;
    minor: number;
    patch: number;
    prerelease?: string;
}

function parseSemVer(version: string): ParsedSemVer {
    const [core, prerelease] = version.split('-');
    const [major, minor, patch] = core.split('.').map(Number);
    return { major, minor, patch, prerelease };
}
```

## Monorepo Versioning

### Changeset-based Versioning

```json
// package.json
{
    "devDependencies": {
        "@changesets/cli": "^2.27.0"
    },
    "scripts": {
        "changeset": "changeset",
        "version": "changeset version",
        "release": "npm run build && changeset publish"
    }
}
```

```typescript
// .changeset/config.json
{
    "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
    "changelog": "@changesets/cli/changelog",
    "commit": false,
    "fixed": [],
    "linked": [],
    "access": "restricted",
    "baseBranch": "main",
    "updateInternalDependencies": "patch",
    "ignore": []
}
```

```bash
# Workflow:
# 1. After a feature, create a changeset
npx changeset
# → Select change type: major | minor | patch
# → Write description

# 2. Before release, version all packages
npx changeset version

# 3. Publish
npm run release
```

### Changeset Example

```markdown
<!-- .changeset/happy-dog-123.md -->
---
"quotation-app": minor
---

Add PDF export for quotations
```

## Code Style Rules

- All commit messages MUST follow Conventional Commits format (feat/fix/breaking)
- Use commitlint + husky to enforce commit format in CI and locally
- Never manually edit CHANGELOG.md — generate it from conventional commits via release-it or changesets
- Git tags MUST follow `v` prefix format: `v1.2.0` (not `1.2.0`)
- Pre-release versions use hyphen: `v2.0.0-alpha.1`, `v2.0.0-beta.2`, `v2.0.0-rc.1`
- Version in `package.json` must match the git tag when a release is created
- Run full test suite before any version bump — tests must pass
- Use `release-it` for automated releases: it handles bump, changelog, tag, and GitHub Release
- Mark pre-releases as GitHub pre-releases so consumers can opt-in
- Protect `v*` tags in GitHub — only CI/release workflow should push tags
