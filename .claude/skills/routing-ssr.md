---
name: routing-ssr
description: Elit framework client-side routing, SSR, and render context — createRouter, createRouterView, routerLink, navigation guards, route params, history/hash modes, renderToString, renderToHTMLDocument, and render context APIs
---

# Routing / SSR (Elit)

## Critical Rules

- Elit UI code uses element factories from `elit/el`, not JSX. Translate any JSX-shaped examples into `div(...)`, `main(...)`, `nav(...)`, and other element factories before writing code.
- `createRouterView(router, options)` returns a view function. Render it from `reactive(router.currentRoute, () => RouterView())` or `reactive(router.currentRoute, () => routerView())`.
- Navigation guards do not use a `next()` callback. Return `false` to block, a string path to redirect, or `true`/`void` to continue.

## Imports

```typescript
// Router
import {
    createRouter,
    createRouterView,
    routerLink,
} from 'elit/router';

// Types
import type {
    Router,
    Route,
    RouteParams,
    RouteLocation,
    RouterOptions,
    RouterLinkProps,
} from 'elit/router';

// SSR / render context (from elit/state — renderToString is exported there)
import { createState, reactive, text } from 'elit/state';

// Render context (for desktop/mobile targets)
import {
    captureRenderedVNode,
    getCapturedRenderedVNode,
    clearCapturedRenderedVNode,
    detectRenderRuntimeTarget,
    setRenderRuntimeTarget,
    restoreRenderRuntimeTarget,
    setDesktopRenderOptions,
    getDesktopRenderOptions,
} from 'elit/render-context';
```

## Router Setup

### createRouter

```typescript
// Signature
interface RouterOptions {
    mode?: 'history' | 'hash';   // default: 'history'
    base?: string;                // base path (e.g., '/app')
    routes: Route[];
    notFound?: (params: RouteParams) => VNode | Child;
}

interface Router {
    currentRoute: State<RouteLocation>;  // reactive current route
    mode: 'history' | 'hash';
    navigate(path: string, replace?: boolean): void;
    push(path: string): void;
    replace(path: string): void;
    back(): void;
    forward(): void;
    go(delta: number): void;
    beforeEach(guard: NavigationGuard): void;
    destroy(): void;
}

interface Route {
    path: string;                                           // e.g., '/users/:id'
    component: (params: RouteParams) => VNode | Child;      // render function
    beforeEnter?: (to: RouteLocation, from: RouteLocation | null) => boolean | string | void;
}

interface RouteLocation {
    path: string;
    params: RouteParams;
    query: Record<string, string>;
    hash: string;
}

// Create router with routes
const router = createRouter({
    mode: 'history',
    base: '',
    routes: [
        { path: '/', component: () => HomePage() },
        { path: '/about', component: () => AboutPage() },
        { path: '/users', component: () => UsersPage() },
        { path: '/users/:id', component: (params) => UserDetailPage({ userId: params.id }) },
        { path: '/settings/*', component: (params) => SettingsPage({ rest: params['*'] }) },
    ],
    notFound: () => NotFoundPage(),
});
```

### History vs Hash Mode

```typescript
// History mode (default) — clean URLs: /users/123
// Requires server-side fallback to index.html for all routes
const router = createRouter({
    mode: 'history',
    routes: [...],
});

// Hash mode — URLs with #: /#/users/123
// Works without server config, good for static hosting
const router = createRouter({
    mode: 'hash',
    routes: [...],
});

// With base path (e.g., app served from /app/)
const router = createRouter({
    mode: 'history',
    base: '/app',
    routes: [...],
});
```

### Route Patterns

```typescript
const routes: Route[] = [
    // Static path
    { path: '/', component: () => HomePage() },

    // Dynamic parameter — :paramName
    { path: '/users/:id', component: (params) => UserPage({ id: params.id }) },

    // Multiple parameters
    {
        path: '/orgs/:orgId/projects/:projectId',
        component: (params) => ProjectPage({
            orgId: params.orgId,
            projectId: params.projectId,
        }),
    },

    // Wildcard — catches everything after prefix into params['*']
    {
        path: '/docs/*',
        component: (params) => DocsPage({ path: params['*'] }),
    },

    // Catch-all
    { path: '*', component: () => NotFoundPage() },
];
```

## Router View

### createRouterView

```typescript
import { div, main, nav } from 'elit/el';
import { render } from 'elit/dom';
import { reactive } from 'elit/state';

// Signature
function createRouterView(router: Router, options: RouterOptions): () => VNode;

// Creates a view function that renders the matched route component.
// Call it from reactive(router.currentRoute, ...) so route changes re-render.
const routerView = createRouterView(router, { routes });

// Use in app layout
const App = () =>
    div(
        { class: 'app' },
        nav(
            { class: 'sidebar' },
            routerLink(router, { to: '/' }, 'Home'),
            routerLink(router, { to: '/users' }, 'Users'),
            routerLink(router, { to: '/settings' }, 'Settings'),
        ),
        main(
            { class: 'content' },
            reactive(router.currentRoute, () => routerView()),
        ),
    );

// Render app
render('#app', App());
```

### Reactive Router View

```typescript
// RouterView is a view function, not a standalone reactive node.
// Wrap routerView() in reactive(router.currentRoute, ...) inside the layout.
import { div, header, h1, main, nav } from 'elit/el';
import { render } from 'elit/dom';
import { reactive } from 'elit/state';

const router = createRouter({ routes });
const routerView = createRouterView(router, { routes });

// Navigation updates router.currentRoute. reactive(...) re-renders the view.

const App = () =>
    div(
        header(
            h1('My App'),
            nav(
                routerLink(router, { to: '/' }, 'Home'),
                routerLink(router, { to: '/about' }, 'About'),
            ),
        ),
        main(
            reactive(router.currentRoute, () => routerView()),
        ),
    );

render('#app', App());
```

## Navigation

### Programmatic Navigation

```typescript
// Push — add to history
router.push('/users/123');

// Replace — overwrite current history entry
router.replace('/login');

// Navigate with replace option
router.navigate('/dashboard', true);

// Browser history
router.back();
router.forward();
router.go(-2); // go back 2 entries

// Navigate with query and hash
router.push('/search?q=hello#results');
// Accessible via: router.currentRoute.value.query.q → "hello"
//                  router.currentRoute.value.hash → "#results"
```

### routerLink

```typescript
// Signature
function routerLink(router: Router, props: RouterLinkProps, ...children: Child[]): VNode;

// Basic usage
routerLink(router, { to: '/about' }, 'About Us')

// With additional props (class, style, etc.)
routerLink(router, { to: '/users', class: 'nav-link' }, 'Users')

// Dynamic link
routerLink(router, { to: `/users/${userId}` }, 'View Profile')

// In a navigation component
const Nav = () => (
    <nav class="main-nav">
        {routerLink(router, { to: '/', class: 'nav-item' }, 'Home')}
        {routerLink(router, { to: '/products', class: 'nav-item' }, 'Products')}
        {routerLink(router, { to: '/cart', class: 'nav-item' }, 'Cart')}
    </nav>
);

// Active link styling
const NavLink = (props: { to: string; label: string }) => {
    const isActive = router.currentRoute.value.path === props.to;
    return routerLink(
        router,
        {
            to: props.to,
            class: ['nav-link', isActive && 'active'].filter(Boolean),
        },
        props.label
    );
};
```

## Navigation Guards

### Global beforeEach

```typescript
// Signature
type NavigationGuard = (
    to: RouteLocation,
    from: RouteLocation | null
) => boolean | string | void;

// Return values:
//   undefined/true → allow navigation
//   false          → block navigation
//   string         → redirect to that path

// Auth guard — redirect unauthenticated users
router.beforeEach((to, from) => {
    const isAuthenticated = checkAuth();
    if (!isAuthenticated && to.path !== '/login') {
        return '/login'; // redirect
    }
});

// Role guard
router.beforeEach((to, from) => {
    const user = getCurrentUser();
    if (to.path.startsWith('/admin') && user?.role !== 'admin') {
        return '/forbidden';
    }
});
```

### Per-Route beforeEnter

```typescript
const routes: Route[] = [
    {
        path: '/dashboard',
        component: () => DashboardPage(),
        beforeEnter: (to, from) => {
            if (!isAuthenticated()) return '/login';
        },
    },
    {
        path: '/admin',
        component: () => AdminPage(),
        beforeEnter: (to, from) => {
            if (getCurrentUser()?.role !== 'admin') return '/forbidden';
        },
    },
    {
        path: '/editor/:id',
        component: (params) => EditorPage({ id: params.id }),
        beforeEnter: (to, from) => {
            const hasUnsaved = checkUnsavedChanges();
            if (hasUnsaved && !confirm('Discard unsaved changes?')) {
                return false; // block navigation
            }
        },
    },
];
```

### Guard Execution Order

```
1. Global beforeEach guards (in registration order)
2. Per-route beforeEnter guard
3. Navigation proceeds → currentRoute updates → view re-renders

If any guard returns false or a redirect string, navigation stops.
```

## Accessing Route Info

```typescript
// Current route is reactive state
const route = router.currentRoute;

// Read current values
route.value.path      // "/users/123"
route.value.params    // { id: "123" }
route.value.query     // { tab: "profile" }
route.value.hash      // "#bio"

// Subscribe to route changes
route.subscribe((location) => {
    console.log('Navigated to:', location.path);
});

// Use in components with reactive
const Breadcrumbs = () => reactive(router.currentRoute, (loc) => (
    <div class="breadcrumbs">
        <span>{loc.path}</span>
        {loc.params.id && <span> / {loc.params.id}</span>}
    </div>
));
```

## SSR (Server-Side Rendering)

### renderToString

```typescript
// Convert VNode tree to HTML string (works without DOM)
import { renderToString, renderToHTMLDocument } from 'elit';

// Render a component to HTML string
const html = renderToString(<div class="app"><h1>Hello</h1></div>);
// Result: '<div class="app"><h1>Hello</h1></div>'

// Pretty-printed output
const pretty = renderToString(
    <div><h1>Title</h1><p>Content</p></div>,
    { pretty: true, indent: 0 }
);
```

### renderToHTMLDocument

```typescript
// Generate a complete HTML document
const doc = renderToHTMLDocument(
    <div id="app"><h1>Hello SSR</h1></div>,
    {
        title: 'My App',
        lang: 'en',
        meta: [
            { name: 'description', content: 'My application' },
            { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
        ],
        links: [
            { rel: 'stylesheet', href: '/styles.css' },
        ],
        styles: [
            { href: '/global.css' },
            { content: 'body { margin: 0; }' },
        ],
        scripts: [
            { src: '/bundle.js', defer: true },
            { content: 'window.__INITIAL_STATE__ = JSON.parse(...)' },
        ],
        head: '<link rel="icon" href="/favicon.ico">',
        bodyAttrs: { class: 'dark-mode' },
        pretty: true,
    }
);

// Result: complete HTML document string
```

### SSR with Dev Server

```typescript
import { devServer } from 'elit/dev';

const server = await devServer({
    port: 3000,
    root: './public',
    ssr: () => {
        // This function runs on server for each request
        const app = AppLayout();
        return renderToHTMLDocument(app, {
            title: 'My App',
            scripts: [{ src: '/client.js' }],
        });
    },
    api: {
        get: {
            '/api/data': (ctx) => {
                ctx.res.json({ message: 'Hello from API' });
            },
        },
    },
});
```

### Hydration Pattern

```typescript
// Server renders HTML, client hydrates
// server-side (ssr function):
ssr: () => {
    const router = createRouter({ routes });
    const routerView = createRouterView(router, { routes });
    const app = (
        <div id="app">
            <nav>{/* ... */}</nav>
            <main>{routerView()}</main>
        </div>
    );
    return renderToHTMLDocument(app, {
        title: 'My App',
        scripts: [{ src: '/client.js' }],
    });
}

// client-side (client.js):
import { render } from 'elit';
import { createRouter, createRouterView } from 'elit/router';

const router = createRouter({ routes });
const routerView = createRouterView(router, { routes });

const app = (
    <div id="app">
        <nav>{/* ... */}</nav>
        <main>{routerView()}</main>
    </div>
);

render('#app', app);
```

## Render Context (Desktop/Mobile)

### Runtime Target Detection

```typescript
// Detect current render environment
const target = detectRenderRuntimeTarget();
// Returns: 'web' | 'desktop' | 'mobile' | 'unknown'

// Explicitly set render target
setRenderRuntimeTarget('desktop');

// Restore previous target
restoreRenderRuntimeTarget('web');
```

### Captured Render (Desktop/Mobile)

```typescript
// Capture VNode for desktop/mobile rendering
captureRenderedVNode('root', myVNode, 'desktop');

// Retrieve captured render
const captured = getCapturedRenderedVNode();
// { rootElement: 'root', target: 'desktop', vNode: myVNode }

// Clear
clearCapturedRenderedVNode();
```

### Desktop Render Options

```typescript
// Configure desktop rendering
setDesktopRenderOptions({
    width: 1200,
    height: 800,
    title: 'My Desktop App',
});

const opts = getDesktopRenderOptions();
clearDesktopRenderOptions();
```

## Complete App Example

### Full SPA with Routing

```typescript
import { render, createState, reactive, text, bindValue } from 'elit/state';
import {
    createRouter,
    createRouterView,
    routerLink,
} from 'elit/router';
import type { Route, Router } from 'elit/router';

// --- Page Components ---

function HomePage() {
    return (
        <div class="page home">
            <h1>Welcome Home</h1>
            <p>This is the home page.</p>
            {routerLink(router, { to: '/users', class: 'btn' }, 'View Users')}
        </div>
    );
}

function UsersPage() {
    const search = createState('');
    const users = [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
        { id: '2', name: 'Bob', email: 'bob@test.com' },
        { id: '3', name: 'Charlie', email: 'charlie@test.com' },
    ];

    const filtered = reactive(search, (q) => {
        const lower = q.toLowerCase();
        return users.filter(u =>
            u.name.toLowerCase().includes(lower) ||
            u.email.toLowerCase().includes(lower)
        );
    });

    return (
        <div class="page users">
            <h1>Users</h1>
            <input type="search" placeholder="Search users..." {...bindValue(search)} />
            {filtered}
        </div>
    );
}

function UserDetailPage(params: { id: string }) {
    return (
        <div class="page user-detail">
            <h1>User {params.id}</h1>
            {routerLink(router, { to: '/users', class: 'back-link' }, 'Back to Users')}
        </div>
    );
}

function NotFoundPage() {
    return (
        <div class="page not-found">
            <h1>404</h1>
            <p>Page not found</p>
            {routerLink(router, { to: '/' }, 'Go Home')}
        </div>
    );
}

// --- Routes ---

const routes: Route[] = [
    { path: '/', component: () => HomePage() },
    { path: '/users', component: () => UsersPage() },
    { path: '/users/:id', component: (params) => UserDetailPage({ id: params.id }) },
];

// --- Router ---

const router = createRouter({
    mode: 'history',
    routes,
    notFound: () => NotFoundPage(),
});

// Auth guard
router.beforeEach((to, _from) => {
    document.title = `My App — ${to.path}`;
});

// --- App Layout ---

const routerView = createRouterView(router, { routes });

const App = () => {
    const currentPath = reactive(router.currentRoute, (loc) => loc.path);

    return (
        <div class="app-layout">
            <header class="app-header">
                <h1 class="logo">My App</h1>
                <nav class="main-nav">
                    {routerLink(router, { to: '/', class: 'nav-link' }, 'Home')}
                    {routerLink(router, { to: '/users', class: 'nav-link' }, 'Users')}
                </nav>
            </header>
            <main class="app-content">
                {routerView()}
            </main>
            <footer class="app-footer">
                <small>Current path: {text(currentPath)}</small>
            </footer>
        </div>
    );
};

// --- Mount ---

render('#app', App());
```

## Code Style Rules

- Use `history` mode for apps with server-side support; `hash` mode for static hosting.
- Define routes as a typed `Route[]` array — keep route config centralized.
- Use `routerLink()` for all internal navigation — never use raw `<a href>` for app routes.
- Use `beforeEach` for global guards (auth, logging); `beforeEnter` for route-specific logic.
- Return a redirect string from guards instead of calling `navigate()` inside them.
- Always provide a `notFound` handler — never leave users with a blank screen.
- Destroy the router on app teardown to remove `popstate` listener and prevent memory leaks.
- Use `reactive(router.currentRoute, ...)` for route-dependent UI (active nav, breadcrumbs).
- For SSR, use `renderToHTMLDocument()` to generate full page HTML with scripts and meta tags.
- Pass initial state via `<script>` tag in SSR output, read it on client for hydration.
- Use `renderToString()` for generating HTML fragments (emails, partial responses).
- Use `captureRenderedVNode()` when targeting desktop/mobile runtimes instead of browser DOM.
- Keep route component functions pure — don't store mutable state outside `createState`.
- Extract page components into separate files for large apps — import and reference in routes.
