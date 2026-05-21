---
name: cicd
description: CI/CD with GitHub Actions — workflow syntax, build & test pipelines, deployment workflows, Docker registry, environment secrets, matrix builds, reusable workflows, caching, and release automation
---

# CI/CD (GitHub Actions)

## Workflow Basics

### Anatomy of a Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
    paths-ignore:
      - "**.md"
      - "docs/**"
      - ".gitignore"
  pull_request:
    branches: [main]

# Cancel in-progress runs for the same branch/PR
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

env:
  NODE_VERSION: "20"

jobs:
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm    # auto-cache node_modules from npm ci

      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
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

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgres://test:test@localhost:5432/quotation_test
      REDIS_URL: redis://localhost:6379
      JWT_SECRET: test-secret
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci
      - run: npm run migrate
      - run: npm run test:coverage

      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci
      - run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 3
```

## Build & Test Pipeline

### Matrix Build

```yaml
jobs:
  test-matrix:
    name: Test (Node ${{ matrix.node-version }}, ${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false   # run all combinations even if one fails
      matrix:
        node-version: [18, 20, 22]
        os: [ubuntu-latest]
        include:
          - node-version: 20
            os: windows-latest
          - node-version: 20
            os: macos-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm

      - run: npm ci
      - run: npm run build
      - run: npm test
```

### E2E Tests

```yaml
  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist

      - name: Start application
        run: npm run start &
        env:
          PORT: 3000
          NODE_ENV: test

      - name: Wait for app ready
        run: npx wait-on http://localhost:3000/health --timeout 30000

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-results
          path: test-results/
```

### Lint & Format Check

```yaml
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci

      - name: ESLint
        run: npm run lint

      - name: Prettier check
        run: npx prettier --check "src/**/*.{ts,tsx,css,json}"

      - name: Type check
        run: npx tsc --noEmit

      - name: Check for unused exports
        run: npx ts-prune src/
```

## Docker Build & Push

### Build and Push to GHCR

```yaml
  docker:
    name: Docker Build & Push
    runs-on: ubuntu-latest
    needs: [test, build]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha,prefix=
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            BUILD_DATE=${{ github.event.head_commit.timestamp }}
            VCS_REF=${{ github.sha }}
```

### Docker Hub

```yaml
  docker-hub:
    name: Push to Docker Hub
    runs-on: ubuntu-latest
    needs: [test]
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - uses: actions/checkout@v4

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            myuser/quotation-app:latest
            myuser/quotation-app:${{ github.ref_name }}
```

## Deployment Workflows

### Deploy to VPS (SSH)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:    # manual trigger
    inputs:
      environment:
        description: "Environment"
        type: choice
        options:
          - staging
          - production
        default: staging

jobs:
  deploy:
    name: Deploy to ${{ github.event.inputs.environment || 'production' }}
    runs-on: ubuntu-latest
    environment:
      name: ${{ github.event.inputs.environment || 'production' }}
      url: ${{ vars.APP_URL }}
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/quotation-app
            git pull origin main
            npm ci --production
            npm run build
            pm2 reload quotation-app
            sleep 5
            curl -sf http://localhost:3000/health || exit 1
            echo "Deploy completed successfully"

      - name: Notify success
        if: success()
        run: echo "Deploy to ${{ github.event.inputs.environment || 'production' }} succeeded"

      - name: Notify failure
        if: failure()
        run: |
          echo "Deploy failed!"
          # Add Slack/Discord notification here
```

### Deploy with Docker

```yaml
  deploy-docker:
    name: Deploy (Docker)
    runs-on: ubuntu-latest
    needs: docker
    environment: production
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/quotation-app

            # Pull latest image
            docker compose -f docker-compose.prod.yml pull app

            # Restart with zero downtime
            docker compose -f docker-compose.prod.yml up -d --no-deps app

            # Clean old images
            docker image prune -f

            # Health check
            sleep 10
            curl -sf http://localhost:3000/health || exit 1

            echo "Docker deploy completed"
```

### Deploy to Vercel

```yaml
  deploy-vercel:
    name: Deploy to Vercel
    runs-on: ubuntu-latest
    needs: [test, build]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Install Vercel CLI
        run: npm i -g vercel@latest

      - name: Pull Vercel environment
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

## Environment Secrets & Variables

### Setup

```
# GitHub → Repo → Settings → Secrets and variables → Actions

# Secrets (encrypted, not visible after save)
SERVER_HOST          # server IP or hostname
SERVER_USER          # SSH username
SSH_PRIVATE_KEY      # SSH private key (full content)
DOCKERHUB_TOKEN      # Docker Hub access token
VERCEL_TOKEN         # Vercel deployment token
SLACK_WEBHOOK        # Slack notification webhook
DB_PASSWORD          # production database password
JWT_SECRET           # production JWT secret

# Variables (plaintext, for non-sensitive config)
APP_URL              # https://quotation.example.com
DOCKER_IMAGE         # ghcr.io/org/quotation-app
NODE_VERSION         # 20

# Environments — separate secrets per environment
# production → production secrets
# staging → staging secrets
```

### Use in Workflows

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production    # required to access env secrets
    steps:
      - name: Use secrets
        env:
          DB_URL: ${{ secrets.DATABASE_URL }}
          API_KEY: ${{ secrets.API_KEY }}
        run: |
          echo "Deploying to ${{ vars.APP_URL }}"

      - name: Mask sensitive output
        run: |
          echo "::add-mask::${{ secrets.API_KEY }}"
          echo "API_KEY=***" >> "$GITHUB_ENV"
```

## Caching Strategies

### npm Cache

```yaml
      # Method 1: Built-in cache via setup-node
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm    # caches ~/.npm based on lockfile hash

      - run: npm ci

      # Method 2: Manual cache
      - name: Cache node_modules
        uses: actions/cache@v4
        with:
          path: |
            ~/.npm
            node_modules
          key: nm-${{ runner.os }}-node${{ env.NODE_VERSION }}-${{ hashFiles('package-lock.json') }}
          restore-keys: |
            nm-${{ runner.os }}-node${{ env.NODE_VERSION }}-

      - run: npm ci
```

### Build Cache

```yaml
      - name: Cache build output
        uses: actions/cache@v4
        with:
          path: |
            dist/
            .tsbuildinfo
          key: build-${{ runner.os }}-${{ hashFiles('src/**', 'tsconfig.json') }}
          restore-keys: |
            build-${{ runner.os }}-

      - run: npm run build
```

### Docker Layer Cache

```yaml
      # GHA cache — recommended for most cases
      - name: Build with cache
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: myapp:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Reusable Workflows

### Caller Workflow

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [develop]

jobs:
  deploy:
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: staging
      docker_tag: sha-${{ github.sha }}
    secrets: inherit
```

### Reusable Workflow

```yaml
# .github/workflows/reusable-deploy.yml
name: Reusable Deploy

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      docker_tag:
        required: true
        type: string
    secrets:
      SERVER_HOST:
        required: true
      SSH_PRIVATE_KEY:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - name: Deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/quotation-app
            docker compose -f docker-compose.prod.yml pull app
            docker compose -f docker-compose.prod.yml up -d --no-deps app
```

## Release Automation

### Semantic Versioning

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  packages: write

jobs:
  release:
    name: Create Release
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.semantic.outputs.version }}
      published: ${{ steps.semantic.outputs.new_release_published }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0    # full history for semantic-release

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci

      - name: Semantic Release
        id: semantic
        uses: cycjimmy/semantic-release-action@v4
        with:
          semantic_version: 22
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  docker-release:
    name: Docker Release
    needs: release
    if: needs.release.outputs.published == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ needs.release.outputs.version }}
```

### Manual Release with Tag

```yaml
  # Triggered by pushing a version tag: git tag v1.2.0 && git push --tags
  release-tag:
    name: Release from Tag
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Extract version
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/v}" >> "$GITHUB_OUTPUT"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          tag_name: ${{ github.ref_name }}
          name: Release ${{ github.ref_name }}
          generate_release_notes: true
          draft: false
          prerelease: ${{ contains(github.ref_name, '-rc') || contains(github.ref_name, '-beta') }}
```

## Notifications

### Slack Notification

```yaml
  notify:
    name: Notify
    runs-on: ubuntu-latest
    needs: [test, deploy]
    if: always()    # run even if previous jobs fail
    steps:
      - name: Slack notification
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "${{ needs.deploy.result == 'success' && '✅' || '❌' }} Deploy ${{ github.ref_name }}: ${{ needs.deploy.result }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*${{ needs.deploy.result == 'success' && '✅ Deploy succeeded' || '❌ Deploy failed' }}*\nBranch: `${{ github.ref_name }}`\nCommit: `${{ github.sha }}`\nAuthor: ${{ github.actor }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### Discord Notification

```yaml
      - name: Discord notification
        if: always()
        run: |
          STATUS="${{ needs.deploy.result }}"
          COLOR=$(( STATUS == "success" )) && "3066993" || "15158332"
          curl -sf "$DISCORD_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
              \"embeds\": [{
                \"title\": \"Deploy: ${STATUS}\",
                \"color\": ${COLOR},
                \"fields\": [
                  {\"name\": \"Branch\", \"value\": \"${{ github.ref_name }}\", \"inline\": true},
                  {\"name\": \"Commit\", \"value\": \"${{ github.sha }}\", \"inline\": true},
                  {\"name\": \"Author\", \"value\": \"${{ github.actor }}\", \"inline\": true}
                ]
              }]
            }"
        env:
          DISCORD_WEBHOOK: ${{ secrets.DISCORD_WEBHOOK }}
```

## Useful Patterns

### Conditional Steps

```yaml
      # Run only on main branch
      - name: Production-only step
        if: github.ref == 'refs/heads/main'
        run: echo "This only runs on main"

      # Run only on PRs
      - name: PR-only step
        if: github.event_name == 'pull_request'
        run: echo "This only runs on PRs"

      # Run only on version tags
      - name: Release-only step
        if: startsWith(github.ref, 'refs/tags/v')
        run: echo "This only runs on version tags"

      # Run only if previous step failed
      - name: On failure
        if: failure()
        run: echo "Previous step failed"

      # Run always (even if previous steps failed)
      - name: Always run
        if: always()
        run: echo "This always runs"

      # Check file changes
      - name: Check changes
        id: changes
        uses: dorny/paths-filter@v3
        with:
          filters: |
            src:
              - 'src/**'
            docker:
              - 'Dockerfile'
              - 'docker-compose*.yml'

      - name: Build if src changed
        if: steps.changes.outputs.src == 'true'
        run: npm run build
```

### Job Outputs

```yaml
  build:
    outputs:
      version: ${{ steps.version.outputs.value }}
      artifact: ${{ steps.build.outputs.name }}
    steps:
      - name: Get version
        id: version
        run: echo "value=$(node -p 'require("./package.json").version')" >> "$GITHUB_OUTPUT"

      - name: Build
        id: build
        run: echo "name=dist-${{ steps.version.outputs.value }}" >> "$GITHUB_OUTPUT"

  deploy:
    needs: build
    steps:
      - run: echo "Deploying version ${{ needs.build.outputs.version }}"
```

### Security Scan

```yaml
  security:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: npm audit
        run: npm audit --audit-level=high
        continue-on-error: true

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: .
          severity: HIGH,CRITICAL
          exit-code: "1"
```

### Database Migration

```yaml
  migrate:
    name: Run Migrations
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci

      - name: Run migrations
        run: npm run migrate:prod
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## Workflow Triggers Reference

```yaml
on:
  # Push to branches
  push:
    branches: [main, develop]
    paths: ["src/**", "package.json"]          # only when these paths change
    paths-ignore: ["**.md", "docs/**"]          # ignore these paths
    tags: ["v*"]                                 # version tags

  # Pull request events
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

  # Manual trigger
  workflow_dispatch:
    inputs:
      environment:
        description: "Environment"
        type: choice
        options: [staging, production]
      skip_tests:
        description: "Skip tests"
        type: boolean
        default: false

  # Schedule (cron — UTC)
  schedule:
    - cron: "0 2 * * *"       # daily at 2 AM UTC
    - cron: "0 0 * * 0"       # weekly on Sunday

  # Trigger from another workflow
  workflow_call:
    inputs:
      deploy_env:
        type: string
        required: true

  # On release published
  release:
    types: [published]
```

## Code Style Rules

- Use `concurrency` groups to cancel in-progress runs on the same branch — save CI minutes.
- Use `paths-ignore` to skip CI for docs, markdown, and config-only changes.
- Always pin action versions with `@v4` (major) or `@sha` — avoid `@main` or `@master`.
- Use `actions/setup-node` with `cache: npm` — automatic dependency caching.
- Use service containers for databases and Redis — no need for external test services.
- Store secrets in GitHub Environments (not repo-level) — enable per-environment protection rules.
- Use reusable workflows for shared deploy logic — avoid duplicating deployment steps.
- Use Docker BuildKit cache (`type=gha`) — faster image builds across runs.
- Always run `npm ci` (not `npm install`) — deterministic builds from lockfile.
- Set `fail-fast: false` for matrix builds — see all failures, not just the first.
- Use `if: always()` for notification and cleanup steps — run even when jobs fail.
- Use `permissions: contents: read` as default — grant write access only where needed.
- Separate CI (test/lint) from CD (deploy) — use different workflows or environment gates.
- Use `github.sha` as Docker tag for traceability — map deployed image to exact commit.
- Add health checks after deployment — fail the workflow if the app doesn't respond.
