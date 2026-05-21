---
name: docker
description: Docker containerization — multi-stage Dockerfile, Docker Compose, image optimization, container networking, volumes, health checks, logging, registry, production best practices, and deployment workflows
---

# Docker (Dockerfile, Compose, Production)

## Multi-Stage Dockerfile

### Node.js Application

```dockerfile
# syntax=docker/dockerfile:1

# === Stage 1: Build ===
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (layer caching)
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Prune devDependencies — only production deps needed in final image
RUN npm prune --production

# === Stage 2: Production ===
FROM node:20-alpine AS production

# Install security updates
RUN apk update && apk upgrade --no-cache && apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy built application from builder
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/server.js"]
```

### Minimal Image (distroless)

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --production

# distroless — no shell, no package manager, minimal attack surface
FROM gcr.io/distroless/nodejs20-debian12

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000

# No ENTRYPOINT needed — distroless-nodejs handles it
CMD ["dist/server.js"]
```

## .dockerignore

```dockerignore
# Dependencies
node_modules
npm-debug.log

# Build artifacts
dist
build
*.tsbuildinfo

# Development
.git
.github
.vscode
.idea
.claude

# Environment files (pass via docker run --env-file)
.env
.env.*
!.env.example

# Docker
Dockerfile
docker-compose*.yml
.docker

# Testing
coverage
test
tests
__tests__
*.test.ts
*.spec.ts

# Documentation
README.md
CHANGELOG.md
docs
LICENSE

# OS files
.DS_Store
Thumbs.db

# Misc
*.log
tmp
temp
```

## Docker Compose

### Development

```yaml
# docker-compose.yml
version: "3.9"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder    # use builder stage for dev (has devDependencies)
    ports:
      - "3000:3000"
    volumes:
      - .:/app                       # mount source for hot reload
      - app_node_modules:/app/node_modules  # prevent host overwrite
    environment:
      NODE_ENV: development
      PORT: 3000
      DATABASE_URL: postgres://postgres:postgres@db:5432/quotation_dev
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-secret-change-me
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    command: npm run dev

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: quotation_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru

  adminer:
    image: adminer
    ports:
      - "8080:8080"
    depends_on:
      - db
    profiles:
      - debug    # only start with: docker compose --profile debug up

volumes:
  postgres_data:
  redis_data:
  app_node_modules:
```

### Production

```yaml
# docker-compose.prod.yml
version: "3.9"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"    # bind to localhost only (Nginx proxies)
    env_file:
      - .env.production
    environment:
      NODE_ENV: production
      PORT: 3000
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
    networks:
      - app-network

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 1G
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --appendonly yes
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    networks:
      - app-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  app-network:
    driver: bridge
```

### Override Pattern

```yaml
# docker-compose.override.yml — auto-merged with docker-compose.yml
# Used for development customizations (gitignored)

version: "3.9"

services:
  app:
    command: npm run dev
    volumes:
      - .:/app
      - app_node_modules:/app/node_modules
    environment:
      NODE_ENV: development
    ports:
      - "9229:9229"    # Node.js debugger
```

## Container Commands

```bash
# Build
docker build -t quotation-app:latest .
docker build -t quotation-app:latest --build-arg NODE_ENV=production .
docker build --target production -t quotation-app:prod .

# Run
docker run -d --name quotation -p 3000:3000 quotation-app:latest
docker run -d --name quotation \
    -p 3000:3000 \
    --env-file .env.production \
    --restart unless-stopped \
    --memory=512m \
    --cpus=1.0 \
    quotation-app:latest

# Execute commands inside container
docker exec -it quotation sh
docker exec quotation node -e "console.log(process.env.NODE_ENV)"
docker exec quotation npm run migrate

# Logs
docker logs quotation
docker logs quotation -f              # follow
docker logs quotation --tail 100      # last 100 lines
docker logs quotation --since 1h      # last hour

# Stop and remove
docker stop quotation
docker rm quotation
docker stop quotation && docker rm quotation

# Inspect
docker inspect quotation
docker stats quotation                # resource usage
docker top quotation                  # processes inside container
```

## Docker Compose Commands

```bash
# Start services (detached)
docker compose up -d

# Start with production config
docker compose -f docker-compose.prod.yml up -d

# Start specific services only
docker compose up -d app db

# Rebuild and restart (after code changes)
docker compose up -d --build app

# View logs
docker compose logs
docker compose logs -f app            # follow app logs
docker compose logs --tail 50 db      # last 50 db logs

# Execute in running container
docker compose exec app sh
docker compose exec db psql -U postgres quotation_dev
docker compose exec app npm run migrate

# Stop and remove
docker compose down
docker compose down -v                # also remove volumes (WARNING: deletes data)

# Pull latest images
docker compose pull

# Scale (only for stateless services)
docker compose up -d --scale app=3

# Resource usage
docker compose top
docker compose stats
```

## Image Optimization

### Layer Caching

```dockerfile
# GOOD — dependency layer cached unless package.json changes
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# BAD — every code change invalidates npm install
COPY . .
RUN npm ci
RUN npm run build

# Verify layer caching
docker build --no-cache -t quotation-app .    # full rebuild
docker build -t quotation-app .                # use cache
docker history quotation-app:latest            # view layers
```

### Image Size Reduction

```bash
# Check image size
docker images quotation-app

# Compare image sizes
docker images | grep -E "quotation|node|alpine"

# Squash layers (experimental)
DOCKER_BUILDKIT=1 docker build --squash -t quotation-app .

# Multi-stage already reduces size significantly
# Alpine base: ~50MB (vs ~1GB for full node image)
# Distroless: ~30MB (no shell, minimal)

# Inspect layer contents
docker create --name inspect quotation-app:latest
docker cp inspect:/app ./inspect-output
docker rm inspect
```

### BuildKit Features

```dockerfile
# syntax=docker/dockerfile:1

# Build-time secrets (npm private packages)
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci

# Build cache (persist between builds)
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# SSH agent forwarding (private git repos)
RUN --mount=type=ssh \
    npm ci
```

```bash
# Build with secrets
docker build --secret id=npmrc,src=.npmrc -t quotation-app .

# Build with SSH
docker build --ssh default -t quotation-app .

# Build with cache
DOCKER_BUILDKIT=1 docker build -t quotation-app .
```

## Volumes & Data

### Volume Types

```yaml
services:
  app:
    volumes:
      # Named volume (managed by Docker)
      - app_data:/app/data

      # Bind mount (host path)
      - ./logs:/app/logs

      # Read-only mount
      - ./config:/app/config:ro

      # Anonymous volume (prevent host overwrite)
      - /app/node_modules

      # tmpfs (in-memory, fast, ephemeral)
      - type: tmpfs
        target: /app/tmp
        tmpfs:
          size: 100M

volumes:
  app_data:
    driver: local
```

### Volume Operations

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect quotation-starter_app_data

# Remove unused volumes
docker volume prune

# Backup a volume
docker run --rm -v quotation-starter_postgres_data:/data -v $(pwd):/backup \
    alpine tar czf /backup/postgres_backup.tar.gz -C /data .

# Restore a volume
docker run --rm -v quotation-starter_postgres_data:/data -v $(pwd):/backup \
    alpine sh -c "cd /data && tar xzf /backup/postgres_backup.tar.gz"
```

## Networking

```yaml
# Custom network with aliases
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true    # no external access

services:
  app:
    networks:
      - frontend
      - backend

  db:
    networks:
      - backend    # only accessible from backend network

  nginx:
    networks:
      - frontend
    ports:
      - "80:80"
      - "443:443"
```

```bash
# Network operations
docker network ls
docker network inspect quotation-starter_backend
docker network create --driver bridge my-network
docker network rm my-network
docker network prune    # remove unused
```

## Health Checks

```dockerfile
# In Dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

```yaml
# In docker-compose.yml
services:
  app:
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3
```

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' quotation
docker inspect --format='{{json .State.Health}}' quotation | jq
```

## Logging

### Logging Drivers

```yaml
# docker-compose.yml — JSON file driver with rotation
services:
  app:
    logging:
      driver: json-file
      options:
        max-size: "10m"      # rotate at 10MB
        max-file: "5"        # keep 5 files
        tag: "quotation-app" # log tag
```

```bash
# View container logs
docker compose logs app --tail 100 -f

# Export logs
docker logs quotation > app.log 2>&1

# System-wide log management
docker system df                        # disk usage
docker system prune                     # clean unused resources
docker system prune -a --volumes        # aggressive cleanup (removes stopped containers, unused images, volumes)
```

### Structured Logging in Node.js

```typescript
// Use JSON logging — easy to parse by log aggregators
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
});

// Docker captures stdout → json-file driver → log aggregator
logger.info({ port: 3000, env: 'production' }, 'Server started');
logger.error({ err, requestId }, 'Request failed');
```

## Registry & Deployment

### Push to Registry

```bash
# Docker Hub
docker login
docker tag quotation-app:latest username/quotation-app:latest
docker tag quotation-app:latest username/quotation-app:1.0.0
docker push username/quotation-app:latest
docker push username/quotation-app:1.0.0

# GitHub Container Registry
docker login ghcr.io -u USERNAME -p GITHUB_TOKEN
docker tag quotation-app:latest ghcr.io/org/quotation-app:latest
docker push ghcr.io/org/quotation-app:latest

# Private registry
docker tag quotation-app:latest registry.example.com/quotation-app:latest
docker push registry.example.com/quotation-app:latest
```

### Deploy from Registry

```bash
# SSH into server and pull latest
ssh quotation-prod

# Pull latest image
docker compose -f docker-compose.prod.yml pull app

# Rolling restart (pull → stop old → start new)
docker compose -f docker-compose.prod.yml up -d --no-deps --build app

# Remove old images
docker image prune -f
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}

      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: deploy
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /var/www/quotation-app
            docker compose -f docker-compose.prod.yml pull app
            docker compose -f docker-compose.prod.yml up -d --no-deps app
            docker image prune -f
```

## PostgreSQL Backup in Docker

```bash
# One-off backup
docker compose exec db pg_dump -U postgres quotation_prod | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup_20260423.sql.gz | docker compose exec -T db psql -U postgres quotation_prod

# Automated backup container
docker run --rm \
    -v postgres_data:/var/lib/postgresql/data \
    -v $(pwd)/backups:/backups \
    alpine sh -c "pg_dump -U postgres quotation_prod | gzip > /backups/backup_$(date +%Y%m%d).sql.gz"
```

## Debugging

```bash
# Shell into running container
docker compose exec app sh

# If container crashed — start with shell override
docker compose run --rm app sh

# View processes
docker top quotation
docker compose top

# Resource usage
docker stats --no-stream

# Inspect container config
docker inspect quotation | jq '.[0].Config.Env'
docker inspect quotation | jq '.[0].NetworkSettings.Ports'

# Check health
docker inspect --format='{{.State.Health.Status}}' quotation
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' quotation

# Follow container events
docker events --filter container=quotation

# Diff filesystem changes
docker diff quotation

# Export filesystem (debug layer issues)
docker export quotation | tar -tvf - | grep node_modules
```

## Production Checklist

```bash
# Security scan
docker scout cves quotation-app:latest
docker scout recommendations quotation-app:latest

# Image signing (cosign)
cosign sign --key cosign.key ghcr.io/org/quotation-app:latest

# Verify signature
cosign verify --key cosign.pub ghcr.io/org/quotation-app:latest
```

## Common Patterns

### Wait-for-Service Script

```bash
#!/bin/sh
# wait-for.sh — wait for a service to be ready
set -e

host="$1"
port="$2"
shift 2
cmd="$@"

until nc -z "$host" "$port" 2>/dev/null; do
    echo "Waiting for $host:$port..."
    sleep 1
done

echo "$host:$port is ready"
exec $cmd
```

```yaml
# Use in docker-compose.yml
services:
  app:
    command: ["./wait-for.sh", "db", "5432", "node", "dist/server.js"]
    depends_on:
      - db
```

### Initialization Container

```yaml
services:
  migrate:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    command: npm run migrate
    environment:
      DATABASE_URL: postgres://postgres:postgres@db:5432/quotation_dev
    depends_on:
      db:
        condition: service_healthy

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    depends_on:
      migrate:
        condition: service_completed_successfully
```

## Code Style Rules

- Always use multi-stage builds — build in one stage, copy only artifacts to minimal runtime image.
- Use `node:alpine` or `distroless` as final base — avoid full Debian/Ubuntu Node images.
- Copy `package.json` and `package-lock.json` before source code — leverage Docker layer caching.
- Use `npm ci` (not `npm install`) in Dockerfiles for deterministic builds.
- Run containers as non-root user — create a dedicated user with `adduser` in the Dockerfile.
- Include a `.dockerignore` — exclude `node_modules`, `.git`, `.env`, test files, and docs.
- Pin image versions (`node:20.11-alpine` not `node:alpine`) — prevent unexpected breakage.
- Set `NODE_ENV=production` in the final stage — enables Node.js optimizations.
- Use `dumb-init` or `tini` as PID 1 — proper signal handling for graceful shutdown.
- Define `HEALTHCHECK` in Dockerfile or Compose — enables orchestrator health monitoring.
- Use named volumes for persistent data (database, uploads) — never store in container filesystem.
- Configure log rotation (`max-size`, `max-file`) — prevent disk exhaustion from container logs.
- Bind application ports to `127.0.0.1` in production — use Nginx as public-facing reverse proxy.
- Use `docker compose` (V2) not `docker-compose` (V1) — V2 is integrated into Docker CLI.
- Use `--no-deps` when restarting a single service — avoid restarting dependencies unnecessarily.
