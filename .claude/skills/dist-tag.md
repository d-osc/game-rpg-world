---
name: dist-tag
description: npm dist-tag management — latest, beta, next, canary tags, publish workflows, tag-based install, promotion workflow, rollback, Docker image tagging, and release channel strategy for TypeScript/Node.js packages
---

# npm Dist-Tag (latest / beta / canary)

## What Are Dist-Tags

```
Dist-tags are named aliases for specific versions of an npm package.

Default tags:
  latest   → Stable release (npm install package → gets this)
  next     → Pre-release / beta channel
  canary   → Per-commit / PR build (ephemeral)

Custom tags:
  beta     → Beta channel
  alpha    → Alpha channel
  rc       → Release candidate
  dev      → Development build
  hotfix   → Emergency fix channel

How it works:
  npm install quotation-app            → installs dist-tag "latest"
  npm install quotation-app@beta       → installs dist-tag "beta"
  npm install quotation-app@2.0.0-rc.1 → installs specific version
  npm install quotation-app@next       → installs dist-tag "next"
```

## Tag Strategy

### Release Channels

```
Channel    Tag       Version Pattern        Who Installs It
───────── ───────── ────────────────────── ──────────────────
Stable     latest    1.2.0                  Production users
Beta       beta      2.0.0-beta.1           Early adopters
Alpha      alpha     2.0.0-alpha.3          Internal testing
RC         rc        2.0.0-rc.1             Pre-release QA
Canary     canary    2.0.0-canary.abc1234   CI/PR verification
Hotfix     latest    1.2.1                  Emergency fix (overwrites latest)

Tag Lifecycle:
  canary → alpha → beta → rc → latest

  canary: Created per PR/commit, short-lived, deleted after merge
  alpha:  Internal builds, frequent, low stability guarantee
  beta:   Feature-complete, external testers, semver-pre-release
  rc:     Release candidate, no known bugs, final verification
  latest: Production release, semver stable, permanent
```

## Publishing with Tags

### Manual Publish

```bash
# Publish to latest (default)
npm publish
# Equivalent to:
npm publish --tag latest

# Publish to beta channel
npm publish --tag beta
# Users install with: npm install quotation-app@beta

# Publish to alpha channel
npm publish --tag alpha

# Publish to rc channel
npm publish --tag rc

# Publish canary build (from CI)
npm publish --tag canary

# Publish to next (alias for beta)
npm publish --tag next

# Dry run — see what would be published
npm publish --dry-run --tag beta
```

### Publish from CI

```yaml
# .github/workflows/publish.yml
name: Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run build
      - run: npm test

      - name: Determine tag from version
        id: dist-tag
        run: |
          TAG=${GITHUB_REF#refs/tags/v}
          echo "version=$TAG" >> $GITHUB_OUTPUT

          if [[ "$TAG" == *"alpha"* ]]; then
            echo "tag=alpha" >> $GITHUB_OUTPUT
          elif [[ "$TAG" == *"beta"* ]]; then
            echo "tag=beta" >> $GITHUB_OUTPUT
          elif [[ "$TAG" == *"rc"* ]]; then
            echo "tag=rc" >> $GITHUB_OUTPUT
          else
            echo "tag=latest" >> $GITHUB_OUTPUT
          fi

      - name: Publish to npm
        run: npm publish --tag ${{ steps.dist-tag.outputs.tag }} --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Summary
        run: |
          echo "Published quotation-app@${{ steps.dist-tag.outputs.version }} to tag \`${{ steps.dist-tag.outputs.tag }}\`"
```

### Canary Build per PR

```yaml
# .github/workflows/canary.yml
name: Canary Build

on:
  pull_request:
    branches: [main]

jobs:
  canary:
    runs-on: ubuntu-latest
    if: github.event.pull_request.draft == false
    permissions:
      contents: read
      packages: write
      pull-requests: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run build
      - run: npm test

      - name: Set canary version
        run: |
          BASE_VERSION=$(jq -r .version package.json)
          PR_NUMBER=${{ github.event.pull_request.number }}
          SHORT_SHA=$(git rev-parse --short HEAD)
          CANARY_VERSION="${BASE_VERSION}-canary.pr${PR_NUMBER}.${SHORT_SHA}"
          jq --arg v "$CANARY_VERSION" '.version = $v' package.json > tmp.json && mv tmp.json package.json
          echo "canary_version=$CANARY_VERSION" >> $GITHUB_ENV

      - name: Publish canary
        run: npm publish --tag canary --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Comment on PR
        run: |
          gh pr comment ${{ github.event.pull_request.number }} --body "📦 Canary build published: \`quotation-app@${{ env.canary_version }}\`

          Install with:
          \`\`\`bash
          npm install quotation-app@${{ env.canary_version }}
          \`\`\`"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Tag Management Commands

### Viewing Tags

```bash
# View all dist-tags for a package
npm dist-tag ls quotation-app
# Output:
# beta: 2.0.0-beta.3
# canary: 2.0.0-canary.pr45.abc1234
# latest: 1.3.0
# rc: 2.0.0-rc.1

# View tags for a specific scope
npm dist-tag ls @myorg/quotation-app

# View all published versions
npm view quotation-app versions --json

# View specific tag's version
npm view quotation-app@beta version
npm view quotation-app@latest version

# View who published
npm view quotation-app --json | jq '.versions' -r
```

### Modifying Tags

```bash
# Add a tag to an existing version
npm dist-tag add quotation-app@2.0.0-rc.1 rc

# Remove a tag
npm dist-tag rm quotation-app canary

# Move a tag to different version (promote)
npm dist-tag add quotation-app@2.0.0 latest
# This moves "latest" to point to 2.0.0

# Promote beta to latest
npm dist-tag add quotation-app@2.0.0-beta.3 latest
# Users doing `npm install quotation-app` now get 2.0.0-beta.3
# NOTE: Usually you publish the stable version without prerelease suffix instead

# Batch cleanup old canary tags
npm dist-tag ls quotation-app | grep canary | while read -r tag version; do
    npm dist-tag rm quotation-app "$tag"
done
```

## Promotion Workflow

### Promote Pre-release to Stable

```bash
# Step 1: Verify the pre-release version is good
npm view quotation-app@rc version
# → 2.0.0-rc.1

# Step 2: Publish the stable version (without prerelease suffix)
# Update package.json to 2.0.0 (remove -rc.1)
jq '.version = "2.0.0"' package.json > tmp.json && mv tmp.json package.json

# Step 3: Publish as latest
npm publish --tag latest

# Step 4: Verify
npm dist-tag ls quotation-app
# latest: 2.0.0
# rc: 2.0.0-rc.1 (old, still points to rc version)

# Step 5: Clean up old tags (optional)
npm dist-tag rm quotation-app rc
```

### Automated Promotion Script

```typescript
// scripts/promote.ts
// Promote a pre-release to a release channel
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

type Tag = 'latest' | 'beta' | 'alpha' | 'rc' | 'canary';

const args = process.argv.slice(2);
const targetTag = args[0] as Tag;
const sourceVersion = args[1]; // optional: specific version to promote

if (!targetTag || !['latest', 'beta', 'rc'].includes(targetTag)) {
    console.error('Usage: npx tsx scripts/promote.ts <latest|beta|rc> [version]');
    process.exit(1);
}

function run(cmd: string, args: string[]): string {
    return execFileSync(cmd, args, { encoding: 'utf-8' }).trim();
}

// Get current package name
const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const pkgName = pkg.name;

// Get version to promote
const version = sourceVersion ?? pkg.version;

console.log(`Promoting ${pkgName}@${version} to tag "${targetTag}"`);

// Dry run check
const currentTags = run('npm', ['dist-tag', 'ls', pkgName]);
console.log('\nCurrent tags:');
console.log(currentTags);

if (targetTag === 'latest' && version.includes('-')) {
    console.error(
        `\nERROR: Cannot promote pre-release "${version}" to "latest".\n` +
        `Publish a stable version (without prerelease suffix) instead.`
    );
    process.exit(1);
}

// Add the tag
run('npm', ['dist-tag', 'add', `${pkgName}@${version}`, targetTag]);
console.log(`\nDone: ${pkgName}@${version} is now tagged as "${targetTag}"`);
```

## Install by Tag

```bash
# Install from specific tag
npm install quotation-app@latest     # Stable
npm install quotation-app@beta       # Beta channel
npm install quotation-app@rc         # Release candidate
npm install quotation-app@canary     # PR build

# Install specific version
npm install quotation-app@2.0.0-beta.3

# Check what version a tag points to
npm view quotation-app@beta version

# Compare installed vs available
npm outdated quotation-app

# Update to latest from a tag
npm update quotation-app@beta
```

### package.json Tag References

```json
// Do NOT reference tags in package.json dependencies
// This is non-deterministic — tag can point to different versions

// ❌ BAD: tag reference
{
    "dependencies": {
        "quotation-app": "beta"
    }
}

// ✅ GOOD: specific version or range
{
    "dependencies": {
        "quotation-app": "^1.2.0"
    }
}

// ✅ GOOD: specific pre-release
{
    "dependencies": {
        "quotation-app": "2.0.0-beta.3"
    }
}
```

## Docker Image Tags

### Docker Tag Strategy (mirrors npm dist-tags)

```bash
# Build and tag
docker build -t quotation-app:1.2.0 .
docker tag quotation-app:1.2.0 quotation-app:latest
docker tag quotation-app:1.2.0 quotation-app:stable

# Pre-release tags
docker tag quotation-app:2.0.0-beta.1 quotation-app:beta

# Push to GHCR
docker push ghcr.io/org/quotation-app:1.2.0
docker push ghcr.io/org/quotation-app:latest
docker push ghcr.io/org/quotation-app:beta

# Pull by tag
docker pull ghcr.io/org/quotation-app:latest
docker pull ghcr.io/org/quotation-app:beta
```

### CI Docker Tagging

```yaml
# .github/workflows/docker-publish.yml
name: Docker Publish

on:
  push:
    tags: ['v*']

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Determine tags
        id: meta
        run: |
          TAG=${GITHUB_REF#refs/tags/v}
          IMAGE=ghcr.io/${{ github.repository }}

          # Always tag with version
          echo "tags=$IMAGE:$TAG" >> $GITHUB_OUTPUT

          if [[ "$TAG" == *"alpha"* ]]; then
            echo "tags=$IMAGE:$TAG,$IMAGE:alpha" >> $GITHUB_OUTPUT
          elif [[ "$TAG" == *"beta"* ]]; then
            echo "tags=$IMAGE:$TAG,$IMAGE:beta" >> $GITHUB_OUTPUT
          elif [[ "$TAG" == *"rc"* ]]; then
            echo "tags=$IMAGE:$TAG,$IMAGE:rc" >> $GITHUB_OUTPUT
          else
            echo "tags=$IMAGE:$TAG,$IMAGE:latest,$IMAGE:stable" >> $GITHUB_OUTPUT
          fi

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          build-args: |
            APP_VERSION=${{ steps.meta.outputs.version }}
```

## Rollback

### Rollback latest to Previous Version

```bash
# View version history
npm view quotation-app versions --json

# Rollback latest to previous stable
npm dist-tag add quotation-app@1.1.0 latest

# Verify
npm dist-tag ls quotation-app
# latest: 1.1.0

# If the bad version was already installed by users
# They need to run: npm update quotation-app
```

### Automated Rollback Script

```typescript
// scripts/rollback.ts
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const pkgName = pkg.name;

function run(cmd: string, args: string[]): string {
    return execFileSync(cmd, args, { encoding: 'utf-8' }).trim();
}

// Get all published versions
const allVersions: string[] = JSON.parse(
    run('npm', ['view', pkgName, 'versions', '--json'])
);

// Get stable versions only (no prerelease suffix)
const stableVersions = allVersions.filter(v => !v.includes('-'));
const previousStable = stableVersions[stableVersions.length - 2];

if (!previousStable) {
    console.error('No previous stable version found');
    process.exit(1);
}

console.log(`Rolling back ${pkgName} "latest" from ${pkg.version} to ${previousStable}`);
run('npm', ['dist-tag', 'add', `${pkgName}@${previousStable}`, 'latest']);
console.log('Rollback complete');
```

## Tag Cleanup

### Scheduled Canary Cleanup

```yaml
# .github/workflows/cleanup-tags.yml
name: Cleanup Canary Tags

on:
  schedule:
    - cron: '17 2 * * 0'    # Weekly Sunday 2:17am
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Remove old canary tags
        run: |
          TAGS=$(npm dist-tag ls quotation-app 2>/dev/null | grep canary || true)

          if [ -z "$TAGS" ]; then
            echo "No canary tags found"
            exit 0
          fi

          echo "Canary tags found:"
          echo "$TAGS"

          # Remove all canary tags
          echo "$TAGS" | while read -r line; do
            TAG=$(echo "$line" | cut -d: -f1 | xargs)
            echo "Removing tag: $TAG"
            npm dist-tag rm quotation-app "$TAG" || true
          done

          echo "Cleanup complete"
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Version + Tag Decision Tree

```
Is this a production release?
├── YES → Is it a hotfix?
│         ├── YES → npm publish --tag latest (overwrites latest)
│         └── NO  → npm publish (tag=latest, default)
│                   Version: 1.3.0 (stable)
│
└── NO → What stage?
          ├── Alpha → npm publish --tag alpha
          │         Version: 2.0.0-alpha.1
          │
          ├── Beta → npm publish --tag beta
          │        Version: 2.0.0-beta.1
          │
          ├── RC → npm publish --tag rc
          │       Version: 2.0.0-rc.1
          │
          └── Canary (CI) → npm publish --tag canary
                            Version: 2.0.0-canary.pr42.abc1234
```

## GHCR / Docker Tag Summary

```
Event                     npm Tag    Docker Tags
───────────────────────── ───────── ───────────────────────
v1.3.0 tag pushed         latest     :1.3.0, :latest, :stable
v2.0.0-beta.1 tag pushed  beta       :2.0.0-beta.1, :beta
v2.0.0-rc.1 tag pushed    rc         :2.0.0-rc.1, :rc
PR #42 merged             canary     :canary-pr42-abc1234
main branch push          —          :main-<sha>, :edge
```

## Code Style Rules

- Every stable release must be published with `--tag latest` (the default)
- Pre-release versions must include a prerelease suffix: `-alpha.N`, `-beta.N`, `-rc.N`
- Never promote a version with prerelease suffix to `latest` — publish a clean semver instead
- Use `canary` tag for per-PR builds — clean up canary tags weekly
- Always verify `npm whoami` and correct package before publishing
- Include `npm publish --dry-run` step in CI before actual publish
- Docker image tags must mirror npm dist-tags for consistency
- Rollback `latest` by retagging, never by unpublishing (npm prevents it after 72h)
- Document which tag to install in README: `npm install pkg` (stable) vs `npm install pkg@beta` (preview)
- Use `--access public` for scoped packages (`@org/pkg`) on first publish
