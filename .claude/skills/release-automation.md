---
name: release-automation
description: Release automation — automated release workflows, release-it, semantic-release, GitHub Actions release pipeline, changelog generation, npm publish, Docker publish, release notes, rollback automation, and release checklist for TypeScript/Node.js projects
---

# Release Automation

## Release Strategies

```
Manual Tag Trigger    → Push git tag → CI builds, tests, publishes
Conventional Commits  → Merge to main → auto-detect version bump → auto release
Schedule-based        → Cron → release whatever is on develop
Manual Command        → Developer runs `npm run release` locally

Recommendation:
  Start with: Manual Tag Trigger (simple, predictable)
  Graduate to: Conventional Commits + semantic-release (full automation)
```

## Release Pipeline Architecture

```
Developer pushes tag v1.2.0
        │
        ▼
┌─── GitHub Actions ────────────────────────┐
│                                           │
│  1. Checkout code                         │
│  2. Setup Node.js + npm cache             │
│  3. npm ci (install from lockfile)        │
│  4. npm run lint                          │
│  5. npm run typecheck                     │
│  6. npm test                              │
│  7. npm run build                         │
│  8. Verify version matches tag            │
│  9. npm publish --tag <channel>           │
│  10. docker build + push                  │
│  11. Create GitHub Release + notes        │
│  12. Notify (Slack / Discord)             │
│                                           │
└───────────────────────────────────────────┘
```

## Full Release Workflow (GitHub Actions)

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+*'      # v1.2.0, v2.0.0-beta.1
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g., 1.2.0)'
        required: true

permissions:
  contents: write
  packages: write

env:
  NODE_VERSION: '20'
  REGISTRY: ghcr.io

jobs:
  # ── Job 1: Validate ─────────────────────
  validate:
    name: Validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Test
        run: npm test -- --coverage

      - name: Build
        run: npm run build

  # ── Job 2: Determine channel ─────────────
  metadata:
    name: Metadata
    runs-on: ubuntu-latest
    needs: validate
    outputs:
      version: ${{ steps.version.outputs.value }}
      channel: ${{ steps.channel.outputs.value }}
      prerelease: ${{ steps.prerelease.outputs.value }}
    steps:
      - uses: actions/checkout@v4

      - id: version
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "value=${{ inputs.version }}" >> $GITHUB_OUTPUT
          else
            TAG=${GITHUB_REF#refs/tags/v}
            echo "value=$TAG" >> $GITHUB_OUTPUT
          fi

      - id: channel
        run: |
          VERSION=${{ steps.version.outputs.value }}
          if [[ "$VERSION" == *"alpha"* ]]; then
            echo "value=alpha" >> $GITHUB_OUTPUT
          elif [[ "$VERSION" == *"beta"* ]]; then
            echo "value=beta" >> $GITHUB_OUTPUT
          elif [[ "$VERSION" == *"rc"* ]]; then
            echo "value=rc" >> $GITHUB_OUTPUT
          else
            echo "value=latest" >> $GITHUB_OUTPUT
          fi

      - id: prerelease
        run: |
          VERSION=${{ steps.version.outputs.value }}
          if [[ "$VERSION" == *"-"* ]]; then
            echo "value=true" >> $GITHUB_OUTPUT
          else
            echo "value=false" >> $GITHUB_OUTPUT
          fi

  # ── Job 3: Publish npm ───────────────────
  publish-npm:
    name: Publish npm
    runs-on: ubuntu-latest
    needs: [validate, metadata]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run build

      - name: Verify package.json version matches tag
        run: |
          PKG_VERSION=$(jq -r .version package.json)
          TAG_VERSION=${{ needs.metadata.outputs.version }}
          if [ "$PKG_VERSION" != "$TAG_VERSION" ]; then
            echo "::error::Version mismatch: package.json=$PKG_VERSION tag=$TAG_VERSION"
            exit 1
          fi

      - name: Publish dry run
        run: npm publish --dry-run --tag ${{ needs.metadata.outputs.channel }}

      - name: Publish
        run: npm publish --tag ${{ needs.metadata.outputs.channel }} --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  # ── Job 4: Publish Docker ────────────────
  publish-docker:
    name: Publish Docker
    runs-on: ubuntu-latest
    needs: [validate, metadata]
    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ github.repository }}
          tags: |
            type=semver,pattern={{version}},value=${{ needs.metadata.outputs.version }}
            type=semver,pattern={{major}}.{{minor}},value=${{ needs.metadata.outputs.version }}
            type=raw,value=latest,enable=${{ needs.metadata.outputs.channel == 'latest' }}
            type=raw,value=${{ needs.metadata.outputs.channel }},enable=${{ needs.metadata.outputs.channel != 'latest' }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            APP_VERSION=${{ needs.metadata.outputs.version }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ── Job 5: GitHub Release ────────────────
  github-release:
    name: GitHub Release
    runs-on: ubuntu-latest
    needs: [validate, metadata, publish-npm, publish-docker]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate release notes
        id: notes
        run: |
          VERSION=${{ needs.metadata.outputs.version }}
          PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")

          {
            echo "notes<<NOTES_EOF"

            if [ -n "$PREV_TAG" ]; then
              echo "## What's Changed"
              echo ""
              git log "${PREV_TAG}..HEAD" --pretty=format:"- %s (%h)" \
                --grep="^feat" --grep="^fix" --grep="^perf" --grep="BREAKING"

              echo ""
              echo ""
              echo "### Full Changelog"
              echo ""
              echo "[${PREV_TAG}...v${VERSION}](https://github.com/${{ github.repository }}/compare/${PREV_TAG}...v${VERSION})"
            else
              echo "Initial release"
            fi

            echo ""
            echo ""
            echo "### Installation"
            echo ""
            echo "\`\`\`bash"
            echo "npm install quotation-app@${VERSION}"
            echo "\`\`\`"

            echo ""
            echo "### Docker"
            echo ""
            echo "\`\`\`bash"
            echo "docker pull ${{ env.REGISTRY }}/${{ github.repository }}:${VERSION}"
            echo "\`\`\`"

            echo "NOTES_EOF"
          } >> $GITHUB_OUTPUT

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v${{ needs.metadata.outputs.version }}
          name: v${{ needs.metadata.outputs.version }}
          body: ${{ steps.notes.outputs.notes }}
          draft: false
          prerelease: ${{ needs.metadata.outputs.prerelease == 'true' }}

  # ── Job 6: Notify ────────────────────────
  notify:
    name: Notify
    runs-on: ubuntu-latest
    needs: [metadata, github-release]
    if: always()
    steps:
      - name: Notify Slack
        if: env.SLACK_WEBHOOK != ''
        run: |
          VERSION=${{ needs.metadata.outputs.version }}
          CHANNEL=${{ needs.metadata.outputs.channel }}
          STATUS="${{ needs.github-release.result }}"

          if [ "$STATUS" = "success" ]; then
            EMOJI="rocket"
            COLOR="good"
          else
            EMOJI="x"
            COLOR="danger"
          fi

          curl -s -X POST "$SLACK_WEBHOOK" \
            -H 'Content-type: application/json' \
            -d "{
              \"attachments\": [{
                \"color\": \"$COLOR\",
                \"title\": \"$EMOJI Release quotation-app v$VERSION\",
                \"fields\": [
                  {\"title\": \"Channel\", \"value\": \"$CHANNEL\", \"short\": true},
                  {\"title\": \"Status\", \"value\": \"$STATUS\", \"short\": true}
                ]
              }]
            }"
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

## release-it Setup

### Configuration

```json
// .release-it.json
{
    "hooks": {
        "before:bump": [
            "npm run lint",
            "npm run typecheck",
            "npm test"
        ],
        "after:bump": "npm run build",
        "after:release": "echo Released ${name} v${version}!"
    },
    "git": {
        "tagName": "v${version}",
        "commitMessage": "chore(release): v${version}",
        "tagAnnotation": "Release v${version}",
        "pushArgs": ["--follow-tags"]
    },
    "github": {
        "release": true,
        "releaseName": "v${version}",
        "autoGenerate": true
    },
    "npm": {
        "publish": true,
        "tag": "latest"
    },
    "plugins": {
        "@release-it/conventional-changelog": {
            "preset": "conventionalcommits",
            "infile": "CHANGELOG.md"
        }
    }
}
```

```json
// package.json
{
    "devDependencies": {
        "release-it": "^17.0.0",
        "@release-it/conventional-changelog": "^8.0.0"
    },
    "scripts": {
        "release": "release-it",
        "release:minor": "release-it minor",
        "release:major": "release-it major",
        "release:patch": "release-it patch",
        "release:alpha": "release-it --preRelease=alpha --npm.tag=alpha",
        "release:beta": "release-it --preRelease=beta --npm.tag=beta",
        "release:rc": "release-it --preRelease=rc --npm.tag=rc",
        "release:dry": "release-it --dry-run"
    }
}
```

### release-it Workflow

```bash
# Interactive — shows changes, asks for confirmation
npm run release

# Auto-detect version bump from conventional commits
npm run release -- --only-version

# Specific bump type
npm run release:patch    # 1.2.0 → 1.2.1
npm run release:minor    # 1.2.0 → 1.3.0
npm run release:major    # 1.2.0 → 2.0.0

# Pre-release
npm run release:alpha    # 2.0.0-alpha.0
npm run release:beta     # 2.0.0-beta.0
npm run release:rc       # 2.0.0-rc.0

# Dry run — see what would happen
npm run release:dry
```

## semantic-release Setup

### Full Automation (Conventional Commits → Release)

```json
// package.json
{
    "devDependencies": {
        "semantic-release": "^24.0.0",
        "@semantic-release/commit-analyzer": "^13.0.0",
        "@semantic-release/release-notes-generator": "^14.0.0",
        "@semantic-release/changelog": "^6.0.0",
        "@semantic-release/npm": "^12.0.0",
        "@semantic-release/github": "^10.0.0",
        "@semantic-release/git": "^10.0.0",
        "conventional-changelog-conventionalcommits": "^7.0.0"
    },
    "scripts": {
        "release": "semantic-release",
        "release:dry": "semantic-release --dry-run"
    }
}
```

```json
// .releaserc.json
{
    "branches": [
        "main",
        { "name": "beta", "prerelease": true },
        { "name": "alpha", "prerelease": true }
    ],
    "repositoryUrl": "https://github.com/org/quotation-app",
    "plugins": [
        [
            "@semantic-release/commit-analyzer",
            {
                "preset": "conventionalcommits",
                "releaseRules": [
                    { "type": "feat", "release": "minor" },
                    { "type": "fix", "release": "patch" },
                    { "type": "perf", "release": "patch" },
                    { "type": "docs", "release": false },
                    { "type": "style", "release": false },
                    { "type": "refactor", "release": "patch" },
                    { "type": "test", "release": false },
                    { "type": "build", "release": false },
                    { "type": "ci", "release": false },
                    { "breaking": true, "release": "major" }
                ]
            }
        ],
        [
            "@semantic-release/release-notes-generator",
            {
                "preset": "conventionalcommits"
            }
        ],
        [
            "@semantic-release/changelog",
            {
                "changelogFile": "CHANGELOG.md",
                "changelogTitle": "# Changelog"
            }
        ],
        [
            "@semantic-release/npm",
            {
                "npmPublish": true,
                "tarballDir": "dist"
            }
        ],
        [
            "@semantic-release/github",
            {
                "assets": [
                    { "path": "dist/*.tgz", "label": "Package" }
                ]
            }
        ],
        [
            "@semantic-release/git",
            {
                "assets": [
                    "CHANGELOG.md",
                    "package.json",
                    "package-lock.json"
                ],
                "message": "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}"
            }
        ]
    ]
}
```

### semantic-release CI Workflow

```yaml
# .github/workflows/semantic-release.yml
name: Semantic Release

on:
  push:
    branches: [main, beta, alpha]

permissions:
  contents: write
  issues: write
  pull-requests: write
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GH_PAT }}
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - run: npm ci
      - run: npm run build

      - name: Release
        run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GH_PAT }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Release Checklist

### Pre-Release Checklist Script

```typescript
// scripts/release-check.ts
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

function run(cmd: string, args: string[]): string {
    return execFileSync(cmd, args, { encoding: 'utf-8' }).trim();
}

interface CheckResult {
    name: string;
    pass: boolean;
    message: string;
}

const checks: CheckResult[] = [];

// 1. Working tree clean
const status = run('git', ['status', '--porcelain']);
checks.push({
    name: 'Clean working tree',
    pass: status === '',
    message: status ? `Uncommitted changes: ${status.split('\n').length} files` : 'OK',
});

// 2. On main branch
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
checks.push({
    name: 'On main branch',
    pass: branch === 'main',
    message: `Current branch: ${branch}`,
});

// 3. Up to date with remote
run('git', ['fetch', 'origin']);
const localHash = run('git', ['rev-parse', 'main']);
const remoteHash = run('git', ['rev-parse', 'origin/main']);
checks.push({
    name: 'Up to date with remote',
    pass: localHash === remoteHash,
    message: localHash === remoteHash ? 'OK' : 'Run git pull first',
});

// 4. Version in package.json is valid semver
const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;
checks.push({
    name: 'Valid semver in package.json',
    pass: semverRegex.test(pkg.version),
    message: `Version: ${pkg.version}`,
});

// 5. No duplicate version tag
const existingTags = run('git', ['tag', '-l', `v${pkg.version}`]);
checks.push({
    name: 'Version tag does not exist',
    pass: existingTags === '',
    message: existingTags ? `Tag v${pkg.version} already exists` : 'OK',
});

// 6. Tests pass
try {
    run('npm', ['test']);
    checks.push({ name: 'Tests pass', pass: true, message: 'OK' });
} catch {
    checks.push({ name: 'Tests pass', pass: false, message: 'Tests failed' });
}

// 7. Type check passes
try {
    run('npx', ['tsc', '--noEmit']);
    checks.push({ name: 'Type check', pass: true, message: 'OK' });
} catch {
    checks.push({ name: 'Type check', pass: false, message: 'Type errors found' });
}

// 8. Lint passes
try {
    run('npm', ['run', 'lint']);
    checks.push({ name: 'Lint', pass: true, message: 'OK' });
} catch {
    checks.push({ name: 'Lint', pass: false, message: 'Lint errors found' });
}

// 9. Build succeeds
try {
    run('npm', ['run', 'build']);
    checks.push({ name: 'Build', pass: true, message: 'OK' });
} catch {
    checks.push({ name: 'Build', pass: false, message: 'Build failed' });
}

// 10. No known vulnerabilities
try {
    const audit = run('npm', ['audit', '--audit-level=high', '--omit=dev']);
    checks.push({ name: 'Security audit', pass: true, message: 'No high/critical vulnerabilities' });
} catch {
    checks.push({ name: 'Security audit', pass: false, message: 'High/critical vulnerabilities found' });
}

// Print results
console.log('\n=== Release Checklist ===\n');
for (const check of checks) {
    const icon = check.pass ? '[PASS]' : '[FAIL]';
    console.log(`  ${icon} ${check.name}: ${check.message}`);
}

const failed = checks.filter(c => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);

if (failed.length > 0) {
    console.error('\nFix the failing checks before releasing.');
    process.exit(1);
}

console.log('\nReady to release!');
```

```json
// package.json
{
    "scripts": {
        "release:check": "npx tsx scripts/release-check.ts"
    }
}
```

## Rollback Automation

### Automated Rollback Workflow

```yaml
# .github/workflows/rollback.yml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      target_version:
        description: 'Version to rollback to (e.g., 1.1.0)'
        required: true
      reason:
        description: 'Reason for rollback'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Validate target version exists
        run: |
          VERSION=${{ inputs.target_version }}
          npm view quotation-app@$VERSION version || {
            echo "::error::Version $VERSION not found on npm"
            exit 1
          }

      - name: Update npm latest tag
        run: |
          VERSION=${{ inputs.target_version }}
          npm dist-tag add quotation-app@$VERSION latest
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Update Docker latest tag
        run: |
          IMAGE=ghcr.io/${{ github.repository }}
          VERSION=${{ inputs.target_version }}
          docker pull $IMAGE:$VERSION
          docker tag $IMAGE:$VERSION $IMAGE:latest
          docker push $IMAGE:latest

      - name: Create GitHub Issue
        run: |
          gh issue create \
            --title "Rollback to v${{ inputs.target_version }}" \
            --body "## Rollback Report

          - **Rolled back to:** v${{ inputs.target_version }}
          - **Reason:** ${{ inputs.reason }}
          - **Rolled back by:** @${{ github.actor }}
          - **Time:** $(date -u +'%Y-%m-%d %H:%M UTC')

          ### Action Items
          - [ ] Investigate root cause
          - [ ] Write RCA
          - [ ] Add regression test
          - [ ] Fix and re-release" \
            --label "rollback,incident"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Release Notification

### Multi-Channel Notification

```typescript
// scripts/notify-release.ts
interface ReleaseInfo {
    version: string;
    channel: string;
    changelog: string;
    repository: string;
}

async function notifySlack(info: ReleaseInfo, webhook: string): Promise<void> {
    const color = info.channel === 'latest' ? 'good' : 'warning';
    await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            attachments: [{
                color,
                title: `quotation-app v${info.version}`,
                title_link: `https://github.com/${info.repository}/releases/tag/v${info.version}`,
                fields: [
                    { title: 'Channel', value: info.channel, short: true },
                    { title: 'Version', value: info.version, short: true },
                ],
                text: info.changelog.substring(0, 1000),
            }],
        }),
    });
}

async function notifyDiscord(info: ReleaseInfo, webhook: string): Promise<void> {
    await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: `**quotation-app v${info.version}** (${info.channel}) released!`,
            embeds: [{
                description: info.changelog.substring(0, 2000),
                color: info.channel === 'latest' ? 0x00ff00 : 0xffaa00,
            }],
        }),
    });
}
```

## Release Directory Structure

```
.github/
├── workflows/
│   ├── release.yml            # Main release pipeline
│   ├── canary.yml             # Per-PR canary builds
│   ├── rollback.yml           # Rollback workflow
│   └── semantic-release.yml   # Auto release from commits
├── dependabot.yml

scripts/
├── release-check.ts           # Pre-release checklist
├── release-notes.mjs          # Generate release notes
├── promote.ts                 # Promote channel
├── rollback.ts                # Rollback script
├── notify-release.ts          # Release notifications
└── bump-version.ts            # Version bump utility

CHANGELOG.md                   # Auto-generated
.release-it.json               # release-it config
.releaserc.json                # semantic-release config
```

## Code Style Rules

- Never release from a dirty working tree — all changes must be committed
- Always run full CI (lint, typecheck, test, build) before publishing
- Package.json version must match the git tag — fail CI if mismatch
- Use `npm publish --dry-run` before actual publish to verify package contents
- Generate CHANGELOG.md automatically from conventional commits — never edit manually
- Create GitHub Release with auto-generated notes for every publish
- Prerelease versions must be marked as GitHub prerelease
- Include rollback workflow that can be triggered manually from GitHub Actions UI
- Notify team on release (Slack/Discord) — include version, channel, and changelog
- Tag Docker images with both version and channel (`1.2.0` + `latest` or `beta`)
