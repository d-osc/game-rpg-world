---
name: project-structure
description: Plan, organize, and scaffold project directory structures — file naming, folder conventions, module boundaries, layering, and architecture patterns for web apps, APIs, libraries, and monorepos.
---

You are an expert software architect. When the user asks for help with project structure, follow these instructions.

## Core Principles

- **Group by feature, not by type** — keep related files together; avoid deep `controllers/`, `services/`, `models/` hierarchies
- **Flat over nested** — max 3–4 levels deep; if you need deeper, the module is too big
- **Colocation** — tests, styles, and types live next to the code they test/style/describe
- **Explicit imports** — avoid magic path aliases when a relative path is clear
- **Single responsibility per directory** — each folder owns one domain or feature
- **Entry points at the root** — `index.ts`, `main.ts`, `app.ts` at the top of each module
- **Config at project root** — `tsconfig.json`, `package.json`, `.env`, build configs

## File Naming Conventions

```
# General
index.ts              # Module entry / re-export barrel
config.ts             # Module-specific config
types.ts              # Shared type definitions for the module
constants.ts          # Constants and enums
utils.ts              # Pure utility functions
helpers.ts            # Domain-specific helpers
validators.ts         # Validation logic

# Feature files (pick one convention and stay consistent)
user-profile.ts       # kebab-case (preferred for web projects)
userProfile.ts        # camelCase
UserProfile.ts        # PascalCase (C# / Java style)

# React components
Button.tsx            # PascalCase for components
Button.test.tsx       # Test colocated
Button.module.css     # Styles colocated
useClickOutside.ts    # Hooks prefixed with `use`

# Test files (pick one)
button.test.ts        # .test.ts suffix (Jest / Vitest)
button.spec.ts        # .spec.ts suffix (Jasmine / Mocha style)

# Generated / build output (always gitignored)
dist/                 # Build output
build/                # Alternative build output
coverage/             # Test coverage
*.generated.ts        # Explicitly generated files
```

## Web App (Frontend)

```
my-app/
├── public/                    # Static assets served as-is
│   ├── favicon.svg
│   ├── robots.txt
│   └── og-image.png
├── src/
│   ├── main.ts                # App entry point
│   ├── app.ts                 # Root component / app shell
│   ├── router.ts              # Route definitions
│   ├── config.ts              # Client-side config (env vars)
│   │
│   ├── features/              # Feature modules (primary grouping)
│   │   ├── auth/
│   │   │   ├── index.ts       # Feature public API
│   │   │   ├── types.ts
│   │   │   ├── login-form.tsx
│   │   │   ├── login-form.test.tsx
│   │   │   ├── auth-service.ts
│   │   │   ├── auth-service.test.ts
│   │   │   └── use-auth.ts    # Hook / composable
│   │   │
│   │   ├── dashboard/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   ├── dashboard.tsx
│   │   │   ├── dashboard.test.tsx
│   │   │   ├── stats-card.tsx
│   │   │   └── use-dashboard.ts
│   │   │
│   │   └── settings/
│   │       ├── index.ts
│   │       ├── types.ts
│   │       └── settings.tsx
│   │
│   ├── components/            # Shared UI components
│   │   ├── ui/                # Primitive / design system components
│   │   │   ├── button.tsx
│   │   │   ├── button.test.tsx
│   │   │   ├── input.tsx
│   │   │   ├── modal.tsx
│   │   │   ├── select.tsx
│   │   │   └── toast.tsx
│   │   └── layout/            # Layout components
│   │       ├── app-shell.tsx
│   │       ├── sidebar.tsx
│   │       ├── header.tsx
│   │       └── footer.tsx
│   │
│   ├── hooks/                 # Shared hooks / composables
│   │   ├── use-debounce.ts
│   │   ├── use-local-storage.ts
│   │   └── use-media-query.ts
│   │
│   ├── lib/                   # External lib wrappers & utilities
│   │   ├── api-client.ts      # HTTP client wrapper
│   │   ├── query-client.ts    # Query/cache setup
│   │   └── analytics.ts       # Analytics wrapper
│   │
│   ├── styles/                # Global styles & tokens
│   │   ├── tokens.css         # Design tokens (colors, spacing, etc.)
│   │   ├── reset.css          # CSS reset
│   │   └── global.css         # Global styles
│   │
│   └── types/                 # Shared TypeScript types
│       ├── api.ts             # API response/request types
│       ├── env.d.ts           # Env variable type declarations
│       └── global.d.ts        # Global type augmentations
│
├── index.html                 # HTML entry
├── package.json
├── tsconfig.json
├── elit.config.ts             # Build / dev server config
├── .env                       # Environment variables
├── .env.local                 # Local overrides (gitignored)
├── .gitignore
└── README.md
```

## Full-Stack App (Frontend + Backend)

```
my-app/
├── public/                    # Static assets
│   └── favicon.svg
├── src/
│   ├── main.ts                # Client entry
│   │
│   ├── features/              # Feature modules (shared concept)
│   │   ├── auth/
│   │   │   ├── index.ts
│   │   │   ├── types.ts       # Shared types (client + server)
│   │   │   ├── login-form.tsx # UI
│   │   │   ├── auth-api.ts    # Client API calls
│   │   │   └── use-auth.ts    # Client state
│   │   │
│   │   └── products/
│   │       ├── index.ts
│   │       ├── types.ts
│   │       ├── product-list.tsx
│   │       └── product-api.ts
│   │
│   ├── components/            # Shared UI components
│   ├── hooks/                 # Shared hooks
│   ├── styles/                # Global styles
│   └── types/                 # Shared types
│
├── server/                    # Server code
│   ├── index.ts               # Server entry
│   ├── routes/                # API route modules
│   │   ├── auth.ts
│   │   └── products.ts
│   ├── middleware/             # Server middleware
│   │   ├── auth.ts
│   │   └── error-handler.ts
│   ├── db/                    # Database layer
│   │   ├── schema.ts          # Table / model definitions
│   │   ├── migrations/        # DB migrations
│   │   └── seed.ts            # Seed data
│   ├── services/              # Business logic
│   │   ├── auth-service.ts
│   │   └── product-service.ts
│   └── utils/                 # Server utilities
│       ├── logger.ts
│       └── validator.ts
│
├── shared/                    # Code shared between client & server
│   ├── types/
│   │   ├── api.ts             # API contracts
│   │   └── models.ts          # Domain models
│   ├── constants.ts           # Shared constants
│   └── validators/            # Shared validation logic
│       ├── auth.ts
│       └── product.ts
│
├── testing/
│   ├── unit/                  # Unit tests
│   │   ├── auth.test.ts
│   │   └── products.test.ts
│   ├── integration/           # Integration tests
│   │   └── api.test.ts
│   └── e2e/                   # End-to-end tests
│       └── app.test.ts
│
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.server.json       # Server-specific TS config
├── elit.config.ts
├── .env
├── .env.local
├── .gitignore
└── README.md
```

## API-Only Backend

```
api/
├── src/
│   ├── index.ts               # Server entry (creates app, starts listening)
│   ├── app.ts                 # App setup (middleware, routes registration)
│   │
│   ├── routes/                # Route handlers (thin — delegate to services)
│   │   ├── index.ts           # Route registration barrel
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   └── products.ts
│   │
│   ├── services/              # Business logic
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   └── product.ts
│   │
│   ├── db/                    # Data access layer
│   │   ├── client.ts          # DB connection / client
│   │   ├── schema.ts          # Schema definitions
│   │   ├── migrations/
│   │   │   ├── 001_create_users.ts
│   │   │   └── 002_create_products.ts
│   │   └── repositories/      # Data access (queries)
│   │       ├── user-repo.ts
│   │       └── product-repo.ts
│   │
│   ├── middleware/             # Express / server middleware
│   │   ├── auth.ts            # Authentication
│   │   ├── cors.ts
│   │   ├── rate-limit.ts
│   │   ├── error-handler.ts
│   │   └── request-logger.ts
│   │
│   ├── types/                 # Shared types
│   │   ├── api.ts             # Request/response types
│   │   ├── env.ts             # Env variable types
│   │   └── models.ts          # Domain model types
│   │
│   └── utils/                 # Pure utilities
│       ├── hash.ts
│       ├── jwt.ts
│       ├── validator.ts
│       └── pagination.ts
│
├── testing/
│   ├── unit/
│   ├── integration/
│   └── fixtures/              # Test data
│       ├── users.ts
│       └── products.ts
│
├── package.json
├── tsconfig.json
├── .env
├── .env.example               # Template for env vars (committed)
├── .env.local                 # Local secrets (gitignored)
├── .gitignore
└── README.md
```

## Library / Package

```
my-lib/
├── src/
│   ├── index.ts               # Public API entry — re-exports everything
│   ├── core.ts                # Core logic
│   ├── types.ts               # Public type definitions
│   ├── utils.ts               # Internal utilities
│   │
│   └── modules/               # Sub-modules
│       ├── a/
│       │   ├── index.ts       # Module public API
│       │   ├── a.ts
│       │   └── a.test.ts
│       └── b/
│           ├── index.ts
│           └── b.ts
│
├── dist/                      # Build output (gitignored)
│   ├── index.js
│   ├── index.mjs
│   ├── index.cjs
│   ├── index.d.ts
│   └── ...
│
├── testing/
│   └── ...
│
├── package.json               # Must include "main", "module", "types", "exports"
├── tsconfig.json
├── tsconfig.build.json        # Build-specific config (stricter)
├── .gitignore
├── LICENSE
└── README.md
```

`package.json` exports map:
```json
{
  "name": "my-lib",
  "version": "1.0.0",
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./modules/a": {
      "types": "./dist/modules/a/index.d.ts",
      "import": "./dist/modules/a/index.mjs",
      "require": "./dist/modules/a/index.cjs"
    }
  },
  "files": ["dist"]
}
```

## Monorepo

```
monorepo/
├── apps/
│   ├── web/                   # Web application
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── mobile/                # Mobile app
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── api/                   # API server
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/                  # Shared packages
│   ├── ui/                    # Shared component library
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── config/                # Shared config (tsconfig, eslint, etc.)
│   │   ├── tsconfig.base.json
│   │   ├── eslint.base.js
│   │   └── package.json
│   │
│   ├── types/                 # Shared types
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── utils/                 # Shared utilities
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── package.json               # Root workspace config
├── tsconfig.json              # Root tsconfig (references)
├── pnpm-workspace.yaml        # Or npm/yarn workspaces config
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── .gitignore
└── README.md
```

Root `package.json`:
```json
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "lint": "npm run lint --workspaces",
    "dev:web": "npm run dev --workspace=apps/web",
    "dev:api": "npm run dev --workspace=apps/api"
  }
}
```

## Feature Module Anatomy

Every feature module should have this internal structure:

```
feature-name/
├── index.ts              # Public API — re-exports what other modules can use
├── types.ts              # Types for this feature
├── feature.tsx           # Main component / implementation
├── feature.test.ts       # Tests
├── sub-component.tsx     # Private sub-components (not exported from index)
├── use-feature.ts        # Hook / composable / state
├── feature-api.ts        # API calls (if full-stack)
├── feature-service.ts    # Business logic (if full-stack)
├── constants.ts          # Feature-specific constants
└── utils.ts              # Feature-specific utilities
```

`index.ts` controls the public surface:
```ts
// Only export what other modules need
export { FeatureName } from './feature';
export type { FeatureProps, FeatureData } from './types';
export { useFeature } from './use-feature';
// Do NOT export internal helpers, sub-components, or API details
```

## Module Dependency Rules

```
┌─────────────────────────────────────────┐
│                 app.ts                   │  ← Entry point, wires everything
├─────────────────────────────────────────┤
│              features/                   │  ← Business features, depends on components, lib
├──────────┬──────────┬───────────────────┤
│components│  hooks/  │     lib/          │  ← Shared UI, shared hooks, lib wrappers
├──────────┴──────────┴───────────────────┤
│            types/  styles/               │  ← Shared types & tokens (no dependencies)
└─────────────────────────────────────────┘

Rules:
- features/ can import from components/, hooks/, lib/, types/, styles/
- components/ can import from types/, styles/ (NOT from features/)
- hooks/ can import from lib/, types/ (NOT from features/, components/)
- lib/ can import from types/ (NOT from features/, components/, hooks/)
- types/ and styles/ import NOTHING from the project
- Never import across features directly — use shared types/events/API
```

## Config File Patterns

```
project/
├── .editorconfig                    # Editor formatting rules
├── .gitignore                       # Git ignore rules
├── .env.example                     # Env var template (committed)
├── .env                             # Default env vars (committed, non-secret)
├── .env.local                       # Local overrides (gitignored)
├── .env.production                  # Production env vars
├── .env.staging                     # Staging env vars
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript config
├── elit.config.ts                   # Build / dev config (if using Elit)
├── jest.config.ts                   # Test config (or vitest.config.ts)
├── .prettierrc                      # Formatter config (or prettier key in package.json)
├── .eslintrc.json                   # Linter config (or eslint key in package.json)
└── .github/
    └── workflows/
        └── ci.yml                   # CI pipeline
```

`.env.example` pattern:
```
# App
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=

# Auth
JWT_SECRET=
JWT_EXPIRY=7d

# External APIs
API_KEY=
```

## Test Structure

```
testing/
├── unit/                    # Fast, isolated tests
│   ├── features/
│   │   ├── auth/
│   │   │   ├── auth-service.test.ts
│   │   │   └── login-form.test.tsx
│   │   └── products/
│   │       └── product-service.test.ts
│   ├── components/
│   │   ├── button.test.tsx
│   │   └── input.test.tsx
│   └── utils/
│       └── format.test.ts
│
├── integration/             # Tests with real DB / API
│   ├── auth.test.ts
│   └── products.test.ts
│
├── e2e/                     # Full user flow tests
│   ├── login-flow.test.ts
│   └── checkout-flow.test.ts
│
├── fixtures/                # Test data factories
│   ├── user.ts              # export const createUser = (overrides?) => ({...})
│   └── product.ts
│
└── helpers/                 # Test utilities
    ├── setup.ts             # Global test setup
    ├── teardown.ts
    └── matchers.ts          # Custom assertions
```

## Common Antipatterns to Avoid

```
# AVOID: Type-based grouping (scales poorly)
src/
├── controllers/
│   ├── user-controller.ts
│   ├── product-controller.ts
│   └── order-controller.ts
├── services/
│   ├── user-service.ts
│   ├── product-service.ts
│   └── order-service.ts
├── models/
│   ├── user-model.ts
│   ├── product-model.ts
│   └── order-model.ts

# PREFER: Feature-based grouping
src/
├── features/
│   ├── user/
│   │   ├── user-controller.ts
│   │   ├── user-service.ts
│   │   ├── user-model.ts
│   │   └── types.ts
│   ├── product/
│   │   ├── product-controller.ts
│   │   ├── product-service.ts
│   │   ├── product-model.ts
│   │   └── types.ts
│   └── order/
│       ├── order-controller.ts
│       ├── order-service.ts
│       ├── order-model.ts
│       └── types.ts
```

```
# AVOID: Barrel files that re-export everything deeply
// src/features/index.ts — DON'T do this
export * from './auth';
export * from './dashboard';
export * from './settings';
// This defeats tree-shaking and makes dependencies invisible

# PREFER: Direct imports from feature modules
import { LoginForm } from './features/auth';
import { Dashboard } from './features/dashboard';

# OR: Thin barrel with only what's needed for routing
// src/features/index.ts
export { LoginForm } from './auth';
export { Dashboard } from './dashboard';
export { Settings } from './settings';
```

```
# AVOID: Deep nesting
src/app/modules/admin/pages/dashboard/components/widgets/Widget.tsx

# PREFER: Flat feature modules
src/features/admin-dashboard/widget.tsx
```

```
# AVOID: Mixed concerns in one file
// user.ts — controller + service + DB query + validation all in one

# PREFER: Separate by responsibility within the feature
// features/user/
//   user-route.ts      — HTTP handler
//   user-service.ts    — Business logic
//   user-repo.ts       — DB queries
//   user-validator.ts  — Input validation
```

## Code Style Rules

- Group by feature first; group by type only within a feature.
- Keep `index.ts` as a thin public API barrel — never `export *`.
- Max 3–4 directory levels. If deeper, split the module.
- Colocate tests next to the source file (`foo.test.ts` next to `foo.ts`).
- Colocate component-specific styles next to the component.
- Keep `shared/` or `lib/` minimal — most code lives in features.
- Every feature module has an `index.ts` that defines its public API.
- Never let a feature import directly from another feature's internals.
- Put env vars in `.env.example` (committed template) and `.env.local` (gitignored).
- Put build config at project root (`tsconfig.json`, `elit.config.ts`, etc.).
- Use `dist/` for build output — always gitignored.
- Use `public/` for static assets — served as-is, not processed by bundler.
- Shared types go in `types/` or `shared/types/` — not scattered across features.
- Migrations are numbered sequentially and committed: `001_create_users.ts`.
- Use `constants.ts` for magic values — not inline strings and numbers.
