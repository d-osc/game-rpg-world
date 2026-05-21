---
name: build-system
description: Build system configuration — TypeScript compiler (tsc), bundlers (esbuild, tsup, Rollup, Vite), tsconfig patterns, build targets, source maps, declaration files, monorepo builds, build optimization, and build scripts for TypeScript/Node.js projects
---

# Build System (tsc, Bundler)

## Tool Selection

```
tsc only       → Library packages, type checking, no bundling needed
esbuild        → Fastest bundler, good for Node.js servers and CLI tools
tsup           → esbuild wrapper with zero config, great for libraries
Vite           → Frontend + SSR, HMR, plugin ecosystem
Rollup         → Tree-shaking, library builds, many plugins
Webpack        → Legacy, large plugin ecosystem (avoid for new projects)

Recommendation:
  Node.js server  → esbuild (fast, simple)
  Library (npm)   → tsup (esbuild-based, includes types)
  Full-stack app  → Vite (frontend HMR + Node.js build)
  Type checking   → always tsc --noEmit (separate from build)
```

## TypeScript Compiler (tsc)

### tsconfig.json for Node.js Server

```json
// tsconfig.json
{
    "compilerOptions": {
        // Language & output
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "outDir": "./dist",
        "rootDir": "./src",

        // Strictness
        "strict": true,
        "noUncheckedIndexedAccess": true,
        "noImplicitOverride": true,
        "noPropertyAccessFromIndexSignature": true,
        "exactOptionalPropertyTypes": false,

        // Interop
        "esModuleInterop": true,
        "allowSyntheticDefaultImports": true,
        "resolveJsonModule": true,
        "isolatedModules": true,

        // Output quality
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "importHelpers": true,

        // What to check
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,

        // Paths
        "baseUrl": ".",
        "paths": {
            "@/*": ["./src/*"]
        }
    },
    "include": ["src/**/*.ts"],
    "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### tsconfig for Library Package

```json
// tsconfig.json — npm library
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "outDir": "./dist",
        "rootDir": "./src",

        "strict": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,

        "esModuleInterop": true,
        "isolatedModules": true,
        "skipLibCheck": true,

        // Emit both ESM + CJS
        "declarationDir": "./dist/types"
    },
    "include": ["src/**/*.ts"],
    "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

### Project References (Monorepo)

```json
// tsconfig.json — root (solution style)
{
    "files": [],
    "references": [
        { "path": "packages/shared/tsconfig.json" },
        { "path": "packages/server/tsconfig.json" },
        { "path": "packages/client/tsconfig.json" }
    ]
}
```

```json
// packages/server/tsconfig.json
{
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
        "outDir": "./dist",
        "rootDir": "./src",
        "composite": true
    },
    "include": ["src/**/*.ts"],
    "references": [
        { "path": "../shared/tsconfig.json" }
    ]
}
```

### Type-Check Only (no emit)

```bash
# Fast type checking without writing files
npx tsc --noEmit

# Watch mode
npx tsc --noEmit --watch

# In CI — fail on type errors
npx tsc --noEmit --pretty
```

```json
// package.json scripts
{
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "build": "npm run typecheck && npm run build:bundle"
}
```

## esbuild

### Server Build

```typescript
// esbuild.config.ts
import { build, context } from 'esbuild';
import { readdir } from 'fs/promises';
import { join } from 'path';

const isDev = process.argv.includes('--watch');

const sharedConfig = {
    entryPoints: ['src/server.ts'],
    bundle: true,
    platform: 'node' as const,
    target: 'node20',
    outdir: 'dist',
    format: 'esm' as const,
    sourcemap: true,
    // Keep node: imports external
    packages: 'external' as const,
    // Don't bundle node_modules
    external: [],
    // Tree shaking
    treeShaking: true,
    // Minify in production
    minify: !isDev,
    // Define env variables
    define: {
        'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
    },
    // Banner for ESM
    banner: {
        js: '// Build: ' + new Date().toISOString(),
    },
};

if (isDev) {
    // Watch mode with rebuild
    const ctx = await context(sharedConfig);
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    // Production build
    await build(sharedConfig);
    console.log('Build complete');
}
```

### Multiple Entry Points

```typescript
// esbuild.config.ts — build multiple targets
import { build } from 'esbuild';

await Promise.all([
    // Main server
    build({
        entryPoints: ['src/server.ts'],
        bundle: true,
        platform: 'node',
        target: 'node20',
        outdir: 'dist',
        format: 'esm',
        sourcemap: true,
        packages: 'external',
        treeShaking: true,
        minify: true,
    }),

    // CLI tool
    build({
        entryPoints: ['src/cli.ts'],
        bundle: true,
        platform: 'node',
        target: 'node20',
        outdir: 'dist',
        format: 'esm',
        sourcemap: true,
        packages: 'external',
        treeShaking: true,
        minify: false, // keep readable for CLI
        banner: {
            js: '#!/usr/bin/env node',
        },
    }),

    // Migration runner
    build({
        entryPoints: ['src/migrate.ts'],
        bundle: true,
        platform: 'node',
        target: 'node20',
        outdir: 'dist',
        format: 'esm',
        sourcemap: true,
        packages: 'external',
    }),
]);
```

### esbuild Plugins

```typescript
// esbuild-plugins/copy.ts — copy non-TS files
import { Plugin } from 'esbuild';
import { cp } from 'fs/promises';

export function copyPlugin(files: Array<{ from: string; to: string }>): Plugin {
    return {
        name: 'copy',
        setup(build) {
            build.onEnd(async () => {
                for (const { from, to } of files) {
                    await cp(from, to, { recursive: true });
                }
            });
        },
    };
}

// esbuild-plugins/externals.ts — auto-external node_modules
import { Plugin } from 'esbuild';
import { readFileSync } from 'fs';

export function autoExternal(): Plugin {
    return {
        name: 'auto-external',
        setup(build) {
            const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
            const deps = [
                ...Object.keys(pkg.dependencies ?? {}),
                ...Object.keys(pkg.peerDependencies ?? {}),
            ];

            build.onResolve({ filter: /.*/ }, (args) => {
                if (deps.some(d => args.path === d || args.path.startsWith(d + '/'))) {
                    return { path: args.path, external: true };
                }
                return null;
            });
        },
    };
}

// Usage
import { build } from 'esbuild';
import { copyPlugin } from './esbuild-plugins/copy';
import { autoExternal } from './esbuild-plugins/externals';

await build({
    entryPoints: ['src/server.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outdir: 'dist',
    format: 'esm',
    sourcemap: true,
    plugins: [
        autoExternal(),
        copyPlugin([
            { from: 'src/templates', to: 'dist/templates' },
            { from: 'src/public', to: 'dist/public' },
        ]),
    ],
});
```

## tsup

### Library Build

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,                    // Generate .d.ts files
    sourcemap: true,
    clean: true,                  // Clean dist before build
    splitting: false,
    treeshake: true,
    minify: false,                // Libraries should be readable
    target: 'node20',
    platform: 'node',

    // External packages
    external: [/^node:/],

    // esbuild options
    esbuildOptions(options) {
        options.banner = {
            js: '// Generated by tsup\n',
        };
    },
});
```

### Multiple Entry Points

```typescript
// tsup.config.ts — library with multiple exports
import { defineConfig } from 'tsup';

export default defineConfig([
    {
        entry: {
            index: 'src/index.ts',
            utils: 'src/utils/index.ts',
            types: 'src/types/index.ts',
        },
        format: ['esm', 'cjs'],
        dts: true,
        sourcemap: true,
        clean: true,
        treeshake: true,
        target: 'node20',
    },
]);
```

```json
// package.json — exports map
{
    "name": "quotation-lib",
    "version": "1.0.0",
    "type": "module",
    "main": "./dist/index.cjs",
    "module": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
        ".": {
            "import": "./dist/index.js",
            "require": "./dist/index.cjs",
            "types": "./dist/index.d.ts"
        },
        "./utils": {
            "import": "./dist/utils.js",
            "require": "./dist/utils.cjs",
            "types": "./dist/utils.d.ts"
        },
        "./types": {
            "import": "./dist/types.js",
            "require": "./dist/types.cjs",
            "types": "./dist/types.d.ts"
        }
    },
    "files": ["dist"]
}
```

## Vite (Node.js / SSR)

### Vite Node.js Build

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        outDir: 'dist',
        target: 'node20',
        lib: {
            entry: 'src/server.ts',
            formats: ['es'],
            fileName: () => 'server.js',
        },
        rollupOptions: {
            external: [
                /^node:/,
                /^@?[\w-]+/,  // node_modules
            ],
        },
        sourcemap: true,
        minify: 'esbuild',
    },
    ssr: {
        noExternal: ['quotation-lib'], // Bundle specific deps
    },
});
```

### Vite Dev Server (SSR)

```typescript
// vite.config.ts — development SSR
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [],

    server: {
        port: 3000,
        host: true,
    },

    build: {
        outDir: 'dist',
        target: 'node20',
        sourcemap: true,
    },

    resolve: {
        alias: {
            '@': '/src',
        },
    },
});
```

## Build Scripts

### package.json Scripts

```json
{
    "scripts": {
        "dev": "tsx watch src/server.ts",
        "build": "npm run build:clean && npm run build:types && npm run build:bundle",
        "build:clean": "rm -rf dist",
        "build:types": "tsc --emitDeclarationOnly --outDir dist/types",
        "build:bundle": "node esbuild.config.ts",
        "build:tsc": "tsc",
        "build:tsup": "tsup",
        "typecheck": "tsc --noEmit",
        "start": "node dist/server.js",
        "start:prod": "NODE_ENV=production node dist/server.js"
    }
}
```

### Build with Version Injection

```typescript
// scripts/build.ts
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';

// Read version from package.json
const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const version = pkg.version;
const buildTime = new Date().toISOString();
const commitHash = process.env.GIT_SHA ?? 'dev';

// Generate version file
writeFileSync('src/generated/version.ts', `\
// Auto-generated — do not edit
export const VERSION = "${version}";
export const BUILD_TIME = "${buildTime}";
export const COMMIT_HASH = "${commitHash}";
`);

await build({
    entryPoints: ['src/server.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outdir: 'dist',
    format: 'esm',
    sourcemap: true,
    packages: 'external',
    treeShaking: true,
    minify: true,
    define: {
        'process.env.APP_VERSION': `"${version}"`,
    },
});
```

## Source Maps

### Configuration

```typescript
// esbuild — always enable sourcemaps
{
    sourcemap: true,           // Generate .map files
    sourcesContent: false,     // Don't embed source (smaller files)
}

// tsconfig.json
{
    "compilerOptions": {
        "sourceMap": true,
        "declarationMap": true    // For "go to definition" in .d.ts
    }
}
```

### Using Source Maps in Production

```typescript
// src/server.ts — at the very top, before other imports
import { install } from 'source-map-support';
install();

// Or without dependency:
import { enableSourceMapSupport } from './utils/source-map.js';
enableSourceMapSupport();

// In package.json
{
    "dependencies": {
        "source-map-support": "^0.5.21"
    }
}

// Docker / PM2 — ensure source maps are loaded
// NODE_OPTIONS=--enable-source-maps
```

```bash
# Run with source maps
NODE_OPTIONS=--enable-source-maps node dist/server.js

# Or in Dockerfile
ENV NODE_OPTIONS=--enable-source-maps
```

## Build Optimization

### Tree Shaking

```typescript
// esbuild tree shaking
await build({
    treeShaking: true,
    // Mark side-effect-free packages
    // (check package.json "sideEffects" field)
});

// In your package.json
{
    "sideEffects": false,
    // Or specify files with side effects:
    "sideEffects": ["src/polyfills.ts", "*.css"]
}
```

### Bundle Size Analysis

```typescript
// esbuild.metafile — analyze bundle
await build({
    metafile: true,     // Generate build metadata
    // ... other options
});

// Then analyze:
// npx esbuild-visualizer --metadata dist/meta.json --open
```

```bash
# Analyze what's in the bundle
npx esbuild --bundle --metafile=meta.json src/server.ts
npx esbuild-visualizer --metadata=meta.json --filename=stats.html

# Check bundle size
ls -lh dist/*.js
du -sh dist/
```

### Conditional Exports

```typescript
// Conditional code elimination at build time
// src/config/env.ts
export const IS_PROD = process.env.NODE_ENV === 'production';
export const IS_DEV = process.env.NODE_ENV !== 'production';

// esbuild will tree-shake unreachable branches when using define:
await build({
    define: {
        'process.env.NODE_ENV': '"production"',
    },
});

// In code:
if (IS_DEV) {
    // This entire block gets removed in production build
    debugLogger.log('Development mode');
}
```

## Docker Multi-Stage Build

```dockerfile
# Dockerfile — build stages
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production
FROM gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV NODE_OPTIONS=--enable-source-maps

CMD ["dist/server.js"]
```

## Build Cache

### esbuild Incremental

```typescript
// esbuild.config.ts — incremental builds
import { build, context } from 'esbuild';

// For CI: one-shot build with caching
const result = await build({
    entryPoints: ['src/server.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outdir: 'dist',
    format: 'esm',
    sourcemap: true,
    packages: 'external',
    treeShaking: true,
    minify: true,
    metafile: true,
    logLevel: 'info',
});

// Print build summary
console.log('Build complete:');
for (const [path, info] of Object.entries(result.metafile.outputs)) {
    console.log(`  ${path}: ${(info.bytes / 1024).toFixed(1)}KB`);
}
```

### GitHub Actions Build Cache

```yaml
# .github/workflows/build.yml
name: Build

on:
  push:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Build
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 5
```

## Watching & Development

### tsx for Development

```bash
# Run TypeScript directly (no build step)
npx tsx src/server.ts

# Watch mode — restart on changes
npx tsx watch src/server.ts

# With clear screen on restart
npx tsx watch --clear-screen=false src/server.ts
```

```json
// package.json
{
    "scripts": {
        "dev": "tsx watch src/server.ts",
        "dev:inspect": "tsx watch --inspect src/server.ts"
    }
}
```

### esbuild Watch

```typescript
// esbuild.config.ts — development watch
import { context } from 'esbuild';
import { exec } from 'child_process';

const ctx = await context({
    entryPoints: ['src/server.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outdir: 'dist',
    format: 'esm',
    sourcemap: true,
    packages: 'external',
});

// Rebuild on change, then restart server
let serverProcess: ReturnType<typeof exec> | null = null;

ctx.watch().then(() => {
    console.log('Watching for changes...');
});

// Optional: Live reload
// Use with: node --watch dist/server.js
```

## Code Style Rules

- Always separate type checking (`tsc --noEmit`) from bundling — never rely on tsc for production output
- Use esbuild for Node.js server builds (fast, tree-shaking, ESM support)
- Use tsup for library builds (handles types, CJS + ESM dual output)
- Enable sourcemaps in all builds — never deploy without them
- Inject version/build metadata at build time, not runtime
- Externalize all node_modules in server builds — don't bundle dependencies
- Run type checking in CI as a separate step from the build
- Keep build config in TypeScript (`esbuild.config.ts`) not JS — type safety
- Use `metafile: true` to track bundle size in CI
- In Docker, use multi-stage builds — never include dev dependencies in production image
