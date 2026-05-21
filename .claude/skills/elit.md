---
name: elit
description: Build, debug, and optimize Elit framework apps — UI components, state management, routing, styling, server-side code, desktop/mobile, WAPK packaging, process manager, native code generation, testing, and CLI usage.
---

You are an expert in the Elit framework (v3.6.7). When the user asks for help with Elit, follow these instructions.

## Module Import Map

Use the correct subpath for each concern:

| Import | Use for |
|--------|---------|
| `elit` | Client-side all-in-one entry (DOM, elements, state, styles, router, HMR) |
| `elit/el` | HTML, SVG, MathML element factories (`div`, `button`, `svgSvg`, etc.) |
| `elit/state` | Reactive state (`createState`, `computed`, `reactive`, `text`, `bindValue`, `bindChecked`, `createSharedState`) |
| `elit/dom` | DOM renderer (`render`, `renderToString`, `mount`, `dom`) |
| `elit/style` | CSS generation (`CreateStyle`, `styles`, `addClass`, `addTag`, `injectStyle`) |
| `elit/router` | Client-side routing (`createRouter`, `createRouterView`, `routerLink`) |
| `elit/server` | HTTP router, dev server, middleware, WebSocket, shared state (`ServerRouter`, `createDevServer`, `cors`, `logger`, `rateLimit`, `compress`, `security`) |
| `elit/desktop` | Desktop window APIs (`createWindow`, `createWindowServer`, `onMessage`, `windowQuit`, `windowSetTitle`) |
| `elit/native` | Native code generation (`renderNativeTree`, `renderAndroidCompose`, `renderSwiftUI`) |
| `elit/universal` | Universal bridge for cross-platform actions (`createUniversalBridgeProps`, `createUniversalLinkProps`) |
| `elit/build` | Programmatic build API (`build`) |
| `elit/database` | VM-backed file database (`Database`, `create`, `read`, `save`, `update`, `rename`, `remove`) |
| `elit/test` | Test runner (`runJestTests`) |
| `elit/hmr` | Client-side HMR (`hmr`) |

Advanced subpaths: `elit/http`, `elit/https`, `elit/ws`, `elit/wss`, `elit/fs`, `elit/path`, `elit/mime-types`, `elit/chokidar`, `elit/runtime`, `elit/pm`.

## Critical Rules

- Use `elit` or client subpaths (`elit/el`, `elit/state`, `elit/dom`, `elit/style`, `elit/router`) for browser UI code.
- Use `elit/server` for HTTP routes, WebSocket, middleware, dev/preview server, and server-side shared state.
- Use `elit/desktop` ONLY inside `elit desktop ...` runtime — those APIs are injected by the native desktop runtime.
- Use `elit/build` for programmatic bundling.
- Use `elit/database` for the VM-backed file database.
- Do NOT use `elit-server`. The current export is `elit/server`.
- Prefer subpath imports — they make environment boundaries obvious.
- `createRouterView(router, options)` returns a function. Render it inside `reactive(router.currentRoute, () => RouterView())`.
- Browser-facing code may import local `.ts` files during dev — Elit rewrites those imports.
- Only `VITE_` prefixed env variables are injected into client bundles.
- Do NOT use `/__elit_ws` for custom WebSocket endpoints — Elit reserves that path.

## Core APIs

### Element Factories (`elit/el`)

All HTML tags (`div`, `span`, `h1`–`h6`, `p`, `a`, `button`, `input`, `form`, `table`, `img`, `video`, etc.), SVG tags (`svgSvg`, `svgCircle`, `svgPath`, `svgRect`, `svgG`, etc.), and MathML tags (`mathMath`, `mathMfrac`, etc.) are available.

```ts
import { div, h1, button, input } from 'elit/el';

// Signature: elementFactory(props?: Props, ...children: Child[]): VNode
const el = div({ className: 'app' }, h1('Title'), button({ onclick: () => {} }, 'Click'));
```

Utility exports: `frag`, `el` (partial elements map), `createElementFactory(tag)`, `doc`, `getEl`, `getEls`, `getElId`, `getElClass`, `getElTag`, `getElName`, `createEl`, `createSvgEl`, `createMathEl`, `fragment`, `textNode`, `commentNode`.

### State Management (`elit/state`)

```ts
import { createState, computed, reactive, text, effect, bindValue, bindChecked, createSharedState } from 'elit/state';

// Create reactive state
const count = createState(0);
count.value = 5;

// Computed state from multiple sources
const label = computed([name, count], (n, c) => `${n}: ${c}`);

// Reactive rendering — re-renders when state changes
const el = reactive(count, (value) => span(`Count: ${value}`));

// Reactive with custom tag
const el2 = reactiveAs('span', count, (value) => text(value));

// Text node from state
const textNode = text(count); // updates when count changes

// Side effects
effect(() => { console.log(count.value); });

// Two-way input binding
input({ type: 'text', ...bindValue(name) });
input({ type: 'checkbox', ...bindChecked(checked) });

// Shared state (synced server ↔ client via WebSocket)
const shared = createSharedState('counter', 0, 'ws://localhost:3000');
shared.value++;
shared.onChange((val, old) => console.log(val));
```

Other exports: `throttle(fn, delay)`, `debounce(fn, delay)`, `lazy(loaderFn)`, `cleanupUnused(root)`, `batchRender(container, vNodes)`, `renderChunked(container, vNodes, chunkSize?, onProgress?)`, `createVirtualList(container, items, renderItem, itemHeight?, bufferSize?)`, `SharedState`, `SharedStateManager`, `sharedStateManager`.

### DOM Rendering (`elit/dom`)

```ts
import { render, renderToString, mount, dom } from 'elit/dom';

// Render a VNode into a container
render('app', appElement); // or render('#app', appElement)

// SSR string rendering
const html = renderToString(appElement, { pretty: true, indent: 2 });

// DomNode class with full API
const d = dom;
d.render('app', el);
d.renderToString(el);
d.renderToHTMLDocument(el, { title: 'App', lang: 'en' });
d.addStyle('body { margin: 0; }');
d.addMeta({ charset: 'UTF-8' });
d.renderJson('app', jsonData);
```

### Routing (`elit/router`)

Docs-style split used by `docs/src/router.ts` and `docs/src/main.ts`:

```ts
// src/router.ts
import { createRouter, createRouterView, type RouteParams } from 'elit';
import { HomePage, AboutPage, UserPage } from './pages/index.ts';

const routes = [
  { path: '/', component: () => HomePage(router) },
  { path: '/about', component: () => AboutPage(router) },
  { path: '/users/:id', component: (params: RouteParams) => UserPage(router, params.id) },
];

export const router = createRouter({
  mode: 'hash',
  base: '/',
  routes,
});

export const RouterView = createRouterView(router, { mode: 'hash', routes });
```

```ts
// src/main.ts
import { dom, div, main, reactive } from 'elit';
import { injectStyles } from './styles';
import { Header, Footer } from './components';
import { router, RouterView } from './router';
import { setupSeo } from './seo';
import './index.css';

injectStyles();
setupSeo(router);

const App = () =>
  div(
    Header(router),
    main(
      reactive(router.currentRoute, () => RouterView())
    ),
    Footer()
  );

dom.render('#app', App());
```

Modular import variant:

```ts
import { div, main, nav } from 'elit/el';
import { render } from 'elit/dom';
import { reactive } from 'elit/state';
import { createRouter, createRouterView, routerLink, type Route, type RouteParams } from 'elit/router';

function HomePage() { return div('Home'); }
function AboutPage() { return div('About'); }
function UserPage(id: string) { return div(`User ${id}`); }
function LoginPage() { return div('Login'); }
function AdminPage() { return div('Admin'); }
function NotFoundPage() { return div('404'); }
const isLoggedIn = () => Boolean(localStorage.getItem('token'));

const routes: Route[] = [
  { path: '/', component: () => HomePage() },
  { path: '/about', component: () => AboutPage() },
  { path: '/user/:id', component: (params: RouteParams) => UserPage(params.id) },
  {
    path: '/admin',
    component: () => AdminPage(),
    beforeEnter: () => isLoggedIn() ? true : '/login',
  },
  { path: '/login', component: () => LoginPage() },
];

const routerOptions = {
  mode: 'hash' as const, // default is 'history'; use 'hash' for static hosting
  base: '/',
  routes,
  notFound: () => NotFoundPage(),
};

export const router = createRouter(routerOptions);
export const RouterView = createRouterView(router, routerOptions);

const App = () =>
  div(
    nav(
      routerLink(router, { to: '/' }, 'Home'),
      routerLink(router, { to: '/about' }, 'About'),
    ),
    main(
      reactive(router.currentRoute, () => RouterView())
    ),
  );

render('#app', App());

// Navigation
router.push('/about');
router.replace('/about');
router.navigate('/user/123');
router.back();
router.forward();
router.go(-1);

// Guards
router.beforeEach((to, from) => {
  if (to.path.startsWith('/admin') && !isLoggedIn()) return '/login';
  return true; // return false to block, string to redirect, or void/true to continue
});

// Links
routerLink(router, { to: '/' }, 'Home');
```

Router rules:

- Import from `elit/router` for modular code, or from `elit` when matching the Elit docs/templates.
- `createRouterView(router, options)` returns a function. Call `RouterView()` inside `reactive(router.currentRoute, () => RouterView())`.
- Keep the route list passed to `createRouter(...)` and `createRouterView(...)` in sync. `createRouter` needs `mode`, `base`, and `routes`; `createRouterView` mainly needs the same `routes` plus optional `notFound`.
- Route components receive a merged params object: path params plus query values. Use `RouteParams` for `params`.
- Passing `router` into page/header components is valid. Route callbacks can reference `router` even when `routes` is declared before `router`, because callbacks run after the router is initialized.
- Guards are synchronous and return `false`, a redirect path string, `true`, or `void`. Do not use a `next()` callback.
- `router.currentRoute` is a state object. Read the current path from `router.currentRoute.value.path`.
- Use `history` mode only when the server falls back to the app shell for every client route. Use `hash` mode for static hosting or docs-style deployments.
- Call `router.destroy()` when tearing down a mounted app to remove the `popstate` listener.

### Styling (`elit/style`)

```ts
import { CreateStyle, styles, addClass, addTag, addId, addVar, keyframe, mediaDark, mediaMinWidth, injectStyle } from 'elit/style';

// Singleton instance
styles.addClass('app', { display: 'grid', placeItems: 'center' });
styles.inject('app-styles');

// Class instance
const css = new CreateStyle();
css.addClass('btn', { padding: '12px', borderRadius: '8px' });
css.addPseudoClass('hover', { opacity: 0.9 }, '.btn');
css.addVar('--primary', '#007bff');
css.keyframe('fadeIn', { '0%': { opacity: 0 }, '100%': { opacity: 1 } });
css.mediaDark({ 'body': { background: '#111', color: '#eee' } });
css.mediaMinWidth('768px', { '.container': { maxWidth: '960px' } });
css.fontFace({ fontFamily: 'MyFont', src: 'url(/font.woff2)', fontWeight: '400' });
css.container('(min-width: 400px)', { '.card': { padding: '16px' } });
css.layer('base', { 'body': { margin: 0 } });
css.inject();
```

Available methods: `addVar`, `var`, `addTag`, `addClass`, `addId`, `addPseudoClass`, `addPseudoElement`, `addAttribute`, `attrEquals`, `attrContainsWord`, `descendant`, `child`, `adjacentSibling`, `generalSibling`, `multiple`, `addName`, `nesting`, `keyframe`, `keyframeFromTo`, `fontFace`, `import`, `media`, `mediaScreen`, `mediaPrint`, `mediaMinWidth`, `mediaMaxWidth`, `mediaDark`, `mediaLight`, `mediaReducedMotion`, `container`, `addContainer`, `supports`, `layerOrder`, `layer`, `add`, `important`, `resolveNativeStyles`, `resolveClassStyles`, `render`, `inject`, `clear`.

### Server (`elit/server`)

```ts
import { ServerRouter, createDevServer, cors, logger, rateLimit, compress, security, bodyLimit, cacheControl, json, html, text, status } from 'elit/server';

// Router
const api = new ServerRouter();
api.use(cors());
api.use(logger());
api.get('/api/hello', async (ctx) => { ctx.res.json({ message: 'Hello' }); });
api.post('/api/data', async (ctx) => { ctx.res.json({ body: ctx.body }); });
api.put('/api/:id', async (ctx) => { /* ... */ });
api.delete('/api/:id', async (ctx) => { /* ... */ });

// Dev server
const server = createDevServer({ port: 3000, root: '.', open: false, logging: true });

// Response helpers
json(res, data, status?);
html(res, data, status?);
text(res, data, status?);
status(res, code, message?);
```

WebSocket endpoints in config:
```ts
{ ws: [{ path: '/ws', handler: ({ ws, query }) => { ws.on('message', msg => ws.send(msg.toString())); } }] }
```

Shared state on server:
```ts
const counter = server.state.create('counter', { initial: 0 });
counter.value = 10;
counter.update(v => v + 1);
```

### Desktop (`elit/desktop`)

```ts
import { createWindow, createWindowServer, onMessage, windowEval, windowQuit, windowSetTitle, windowMinimize, windowMaximize, windowUnmaximize, windowDrag, windowSetPosition, windowSetSize, windowSetAlwaysOnTop } from 'elit/desktop';

createWindow({
  title: 'App',
  width: 960,
  height: 640,
  center: true,
  decorations: true,
  devtools: true,
  html: '<!doctype html>...',
  icon: './icon.png',
});

onMessage((msg) => { if (msg === 'ready') windowSetTitle('My App'); });
```

### Native Code Generation (`elit/native`)

```ts
import { renderNativeTree, renderAndroidCompose, renderSwiftUI, materializeNativeTree } from 'elit/native';

const tree = renderNativeTree(screen, { platform: 'android' });
const compose = renderAndroidCompose(screen, { packageName: 'com.example', functionName: 'HomeScreen', includePreview: true });
const swift = renderSwiftUI(screen, { structName: 'HomeScreen', includePreview: true });
```

### Database (`elit/database`)

```ts
import { Database } from 'elit/database';

const db = new Database({ dir: './databases', language: 'ts' });
db.create('users', `export const users = [];`);
db.save('users', `export const users = [{ name: 'Alice' }];`);
db.read('users');
db.update('users', 'users', `export const users = [];`);
db.rename('users', 'people');
db.remove('people');
await db.execute(`import { users } from '@db/users'; console.log(users.length);`);
```

Standalone helpers: `create(dbName, code, options?)`, `read(dbName, options?)`, `save(dbName, code, options?)`, `update(dbName, fnName, code, options?)`, `rename(old, new, options?)`, `remove(dbName, fnName?, options?)`.

### Universal Bridge (`elit/universal`)

```ts
import { createUniversalBridgeProps, createUniversalLinkProps, isExternalUniversalDestination, mergeUniversalProps } from 'elit/universal';

// Cross-platform click handling
button(createUniversalBridgeProps({ action: 'navigate', route: '/detail' }), 'Go');
a(createUniversalLinkProps('/external', { desktopMessage: 'open-external' }), 'External');
```

### Testing (`elit/test`)

```ts
import { runJestTests } from 'elit/test';

await runJestTests({ include: ['testing/**/*.test.ts'], watch: false, coverage: { enabled: true, provider: 'v8' } });
```

## CLI Commands

```bash
npx elit dev                                    # Dev server
npx elit dev --port 3000 --host 0.0.0.0 --no-open
npx elit build --entry ./src/main.ts --out-dir dist --format esm --sourcemap
npx elit preview                                # Preview server
npx elit test                                   # Run tests
npx elit test --watch --coverage --coverage-reporter text,html
npx elit test --file ./test.test.ts --describe "Suite" --it "case"
npx elit desktop ./src/main.ts                  # Desktop mode
npx elit desktop run --mode native
npx elit desktop build --platform windows --release
npx elit mobile init                            # Mobile scaffolding
npx elit mobile run android
npx elit mobile doctor --json
npx elit native generate android ./screen.ts --name HomeScreen --package com.example
npx elit native generate ios ./screen.ts --out ./HomeScreen.swift
npx elit pm start --script "npm start" --name my-app
npx elit pm start --file ./app.ts --runtime bun --watch
npx elit pm list|stop|restart|delete|logs|save|resurrect
npx elit wapk pack .                            # Package app
npx elit wapk run ./app.wapk                    # Run packaged app
npx elit wapk inspect|extract|patch
```

## Config File (`elit.config.ts`)

```ts
import { defineConfig } from 'elit/config';

export default defineConfig({
  dev: { port: 3000, root: '.', open: true, logging: true, clients: [{ root: '.', basePath: '', ssr: () => documentShell, api, ws: [{ path: '/ws', handler: ({ ws }) => { ws.on('message', m => ws.send(m.toString())) } }] }] },
  build: [{ entry: './src/main.ts', outDir: './dist', outFile: 'main.js', format: 'esm', sourcemap: true, copy: [{ from: './public/index.html', to: './index.html' }] }],
  preview: { root: './dist', port: 4173 },
  test: { include: ['testing/unit/**/*.test.ts'] },
  desktop: { mode: 'native', native: { entry: './src/main.ts' }, runtime: 'quickjs', platform: 'windows' },
  mobile: { cwd: '.', appId: 'com.elit.app', appName: 'Elit', webDir: 'dist', mode: 'hybrid', icon: './icon.png', permissions: ['android.permission.INTERNET'] },
  pm: { dataDir: '.elit/pm', apps: [{ name: 'api', script: 'npm start', runtime: 'node' }] },
  wapk: { name: 'my-app', version: '1.0.0', runtime: 'bun', entry: './src/server.ts', lock: { password: 'secret' } },
});
```

## Common Patterns

### Minimal Browser App

```ts
import { div, h1, button } from 'elit/el';
import { createState, reactive } from 'elit/state';
import { render } from 'elit/dom';

const count = createState(0);
render('app', div(h1('Hello'), reactive(count, v => button({ onclick: () => count.value++ }, `Count: ${v}`))));
```

### SSR Document Shell

```ts
import { html, head, body, title, meta, div, script } from 'elit/el';
export const documentShell = html(head(title('App'), meta({ charset: 'UTF-8' })), body(div({ id: 'app' }), script({ type: 'module', src: '/src/main.ts' })));
```

### Server with API + WebSocket

```ts
import { ServerRouter, cors } from 'elit/server';
const api = new ServerRouter();
api.use(cors());
api.get('/api/data', async (ctx) => ctx.res.json({ items: [] }));
```

### Desktop App

```ts
import { createWindow, onMessage, windowSetTitle, windowQuit } from 'elit/desktop';
onMessage((msg) => { if (msg === 'ready') { windowSetTitle('App'); windowQuit(); } });
createWindow({ title: 'App', width: 800, height: 600, html: '<!doctype html><html><body><h1>Hello</h1></body></html>' });
```

## Element Factory Reference

HTML (130+): `a`, `abbr`, `address`, `area`, `article`, `aside`, `audio`, `b`, `base`, `bdi`, `bdo`, `blockquote`, `body`, `br`, `button`, `canvas`, `caption`, `cite`, `code`, `col`, `colgroup`, `data`, `datalist`, `dd`, `del`, `details`, `dfn`, `dialog`, `div`, `dl`, `dt`, `em`, `embed`, `fieldset`, `figcaption`, `figure`, `footer`, `form`, `h1`–`h6`, `head`, `header`, `hr`, `html`, `i`, `iframe`, `img`, `input`, `ins`, `kbd`, `label`, `legend`, `li`, `link`, `main`, `map`, `mark`, `menu`, `meta`, `meter`, `nav`, `noscript`, `object`, `ol`, `optgroup`, `option`, `output`, `p`, `param`, `picture`, `portal`, `pre`, `progress`, `q`, `rp`, `rt`, `ruby`, `s`, `samp`, `script`, `section`, `select`, `slot`, `small`, `source`, `span`, `strong`, `style`, `sub`, `summary`, `sup`, `table`, `tbody`, `td`, `template`, `textarea`, `tfoot`, `th`, `thead`, `time`, `title`, `tr`, `track`, `u`, `ul`, `varElement`, `video`, `wbr`.

SVG (40+): `svgSvg`, `svgCircle`, `svgRect`, `svgPath`, `svgLine`, `svgPolyline`, `svgPolygon`, `svgEllipse`, `svgG`, `svgText`, `svgTspan`, `svgDefs`, `svgLinearGradient`, `svgRadialGradient`, `svgStop`, `svgPattern`, `svgMask`, `svgClipPath`, `svgUse`, `svgSymbol`, `svgMarker`, `svgImage`, `svgForeignObject`, `svgAnimate`, `svgAnimateTransform`, `svgAnimateMotion`, `svgSet`, `svgFilter`, `svgFeBlend`, `svgFeColorMatrix`, `svgFeComponentTransfer`, `svgFeComposite`, `svgFeConvolveMatrix`, `svgFeDiffuseLighting`, `svgFeDisplacementMap`, `svgFeFlood`, `svgFeGaussianBlur`, `svgFeMorphology`, `svgFeOffset`, `svgFeSpecularLighting`, `svgFeTile`, `svgFeTurbulence`.

MathML (12): `mathMath`, `mathMi`, `mathMn`, `mathMo`, `mathMs`, `mathMtext`, `mathMrow`, `mathMfrac`, `mathMsqrt`, `mathMroot`, `mathMsub`, `mathMsup`.

## Good Defaults for Generated Code

- Prefer `elit/el`, `elit/state`, `elit/dom` in new examples.
- Keep server code on `elit/server` and browser code on client subpaths.
- Use `ServerRouter` for APIs.
- Use `createState` + `reactive` for UI updates before adding abstractions.
- Use `CreateStyle` or `elit/style` for injected CSS.
- Use `elit.config.ts` when the project needs SSR, APIs, preview, workers, or proxy rules.
- `build` may be a single object or an array (all builds run sequentially).
- `dev.clients` is the most flexible setup for SSR, API routes, multiple apps, or per-client proxy rules.
- Environment files load order: `.env.{mode}.local`, `.env.{mode}`, `.env.local`, `.env`.
