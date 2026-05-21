---
name: performance
description: Web performance optimization — lazy loading, code splitting, bundle optimization, image optimization, critical rendering path, Core Web Vitals (LCP, INP, CLS), prefetching, caching strategies, and performance profiling
---

# Performance (Lazy Load, Bundle Split)

## Lazy Loading

### Route-Level Code Splitting

```typescript
// Lazy load page components — only downloaded when route is visited
import { lazy } from 'elit/state';

const HomePage = lazy(async () => {
    const mod = await import('./pages/home');
    return mod.HomePage;
});

const UsersPage = lazy(async () => {
    const mod = await import('./pages/users');
    return mod.UsersPage;
});

const SettingsPage = lazy(async () => {
    const mod = await import('./pages/settings');
    return mod.SettingsPage;
});

// Use in routes — each page is a separate chunk
const routes = [
    { path: '/', component: () => HomePage() },
    { path: '/users', component: () => UsersPage() },
    { path: '/settings', component: () => SettingsPage() },
];
```

### Component-Level Lazy Loading

```typescript
// Heavy components loaded on demand
import { lazy } from 'elit/state';

const Chart = lazy(async () => {
    const mod = await import('./components/Chart');
    return mod.Chart;
});

const Map = lazy(async () => {
    const mod = await import('./components/Map');
    return mod.Map;
});

const PDFViewer = lazy(async () => {
    const mod = await import('./components/PDFViewer');
    return mod.PDFViewer;
});

// Usage — component loads when first rendered
const dashboard = (
    <div>
        <h1>Dashboard</h1>
        {await Chart({ data: salesData })}
    </div>
);
```

### Image Lazy Loading

```typescript
// Native lazy loading (no JS needed)
const ImageGallery = (images: { src: string; alt: string }[]) => (
    <div class="gallery">
        {images.map(img => (
            <img
                src={img.src}
                alt={img.alt}
                loading="lazy"            // native lazy load
                decoding="async"          // non-blocking decode
                width={800}
                height={600}              // prevent layout shift
            />
        ))}
    </div>
);

// Responsive images with srcset
const ResponsiveImage = ({ base }: { base: string }) => (
    <img
        src={`${base}-800.jpg`}
        srcset={`
            ${base}-400.jpg 400w,
            ${base}-800.jpg 800w,
            ${base}-1200.jpg 1200w
        `}
        sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
        alt=""
        loading="lazy"
        decoding="async"
    />
);
```

### Intersection Observer Lazy Loading

```typescript
// Lazy load content when it enters viewport
function createLazyLoader(
    placeholder: VNode,
    loadFn: () => Promise<VNode>
): () => VNode {
    let loaded = false;
    let content: VNode | null = null;

    return () => {
        if (loaded && content) return content;

        // Set up observer after mount
        setTimeout(() => {
            const el = document.querySelector('.lazy-section:last-child');
            if (!el) return;

            const observer = new IntersectionObserver(async (entries) => {
                if (entries[0].isIntersecting && !loaded) {
                    loaded = true;
                    observer.disconnect();
                    content = await loadFn();
                    // Re-render the section with loaded content
                    el.textContent = '';
                    renderToDOM(content, el as HTMLElement);
                }
            }, { rootMargin: '200px' }); // start loading 200px before visible

            observer.observe(el);
        }, 0);

        return (
            <div class="lazy-section">
                {placeholder}
            </div>
        );
    };
}

// Usage
const loadAnalytics = createLazyLoader(
    <div class="skeleton">Loading analytics...</div>,
    async () => {
        const mod = await import('./sections/Analytics');
        return mod.AnalyticsSection();
    }
);
```

## Bundle Splitting

### Dynamic Import Patterns

```typescript
// 1. Route-based splitting (most impactful)
const routes = [
    { path: '/', component: lazy(() => import('./pages/Home')) },
    { path: '/admin', component: lazy(() => import('./pages/Admin')) },
    { path: '/reports', component: lazy(() => import('./pages/Reports')) },
];

// 2. Feature-based splitting
const chatWidget = lazy(() => import('./features/chat/ChatWidget'));
const videoPlayer = lazy(() => import('./features/video/VideoPlayer'));
const codeEditor = lazy(() => import('./features/editor/CodeEditor'));

// 3. Library splitting — load heavy libs on demand
async function exportToPDF(data: Report): Promise<void> {
    // jspdf (300KB+) only loaded when user clicks "Export PDF"
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.text(data.title, 10, 10);
    doc.save('report.pdf');
}

async function showChart(): Promise<void> {
    // chart.js (200KB+) only loaded when needed
    const { Chart } = await import('chart.js');
    new Chart(ctx, config);
}

// 4. Conditional polyfill loading
async function loadPolyfills(): Promise<void> {
    if (!('IntersectionObserver' in window)) {
        await import('intersection-observer');
    }
    if (!('ResizeObserver' in window)) {
        await import('resize-observer-polyfill');
    }
}
```

### Vite Bundle Optimization

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        rollupOptions: {
            output: {
                // Manual chunk splitting
                manualChunks: {
                    // Vendor chunks
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-charts': ['chart.js'],

                    // Feature chunks
                    'feature-admin': ['./src/pages/Admin'],
                    'feature-reports': ['./src/pages/Reports'],
                },
            },
        },

        // Chunk size warning threshold
        chunkSizeWarningLimit: 1000,

        // CSS code splitting
        cssCodeSplit: true,

        // Source maps for production debugging
        sourcemap: 'hidden',

        // Minification
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
            },
        },
    },
});
```

### Preload / Prefetch

```typescript
// Prefetch likely-next routes when idle
function prefetchOnIdle(importFn: () => Promise<any>): void {
    requestIdleCallback(() => {
        importFn(); // trigger download but don't execute
    });
}

// After home page loads, prefetch likely next pages
prefetchOnIdle(() => import('./pages/Dashboard'));
prefetchOnIdle(() => import('./pages/Profile'));

// Preload on hover
function preloadOnHover(linkEl: HTMLElement, importFn: () => Promise<any>): void {
    linkEl.addEventListener('mouseenter', () => {
        importFn();
    }, { once: true });
}

// Link prefetch with <link rel="prefetch">
function addPrefetch(url: string): void {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.as = 'script';
    document.head.appendChild(link);
}
```

## Critical Rendering Path

### Inline Critical CSS

```typescript
// Inline above-the-fold CSS in <head>, load rest asynchronously
const criticalCSS = `
    body { margin: 0; font-family: system-ui, sans-serif; }
    .app-shell { min-height: 100vh; }
    .header { height: 64px; display: flex; align-items: center; }
    .skeleton { background: #f0f0f0; border-radius: 4px; }
`;

// Use in SSR output
const html = renderToHTMLDocument(app, {
    head: `
        <style>${criticalCSS}</style>
        <link rel="preload" href="/styles.css" as="style"
              onload="this.onload=null;this.rel='stylesheet'">
        <noscript><link rel="stylesheet" href="/styles.css"></noscript>
    `,
    scripts: [
        { src: '/bundle.js', defer: true },
    ],
});
```

### Script Loading Strategies

```typescript
// defer — execute after HTML parsed, before DOMContentLoaded
// Use for: main application bundle
// <script src="app.js" defer></script>

// async — download in parallel, execute ASAP
// Use for: analytics, chat widgets, non-critical scripts
// <script src="analytics.js" async></script>

// preload — download early, execute when parsed
// <link rel="preload" href="critical.js" as="script">

// In Elit SSR output
const html = renderToHTMLDocument(app, {
    scripts: [
        // Critical: inline small bootstrap script
        { content: `window.__INITIAL_STATE__ = ${JSON.stringify(initialState)}` },
        // Main bundle: deferred
        { src: '/bundle.js', defer: true },
        // Analytics: async (non-blocking)
        { src: '/analytics.js', async: true },
    ],
});
```

## Core Web Vitals

### LCP (Largest Contentful Paint) — Target < 2.5s

```
What affects LCP:
1. Server response time (TTFB)
2. Render-blocking resources (CSS, JS)
3. Image load time
4. Client-side rendering

Optimizations:
- Preload the LCP image with <link rel="preload">
- Use srcset for responsive images
- Inline critical CSS
- Use fetchpriority="high" on hero images
- Avoid client-side rendering for above-the-fold content (use SSR)
- Optimize server response time (CDN, edge caching)
```

```typescript
// Preload hero image
<link rel="preload" as="image" href="/hero.webp" type="image/webp" />

// High-priority fetch for LCP image
<img
    src="/hero.webp"
    alt="Hero"
    fetchpriority="high"
    decoding="async"
    width={1200}
    height={600}
/>
```

### INP (Interaction to Next Paint) — Target < 200ms

```
What affects INP:
1. Long JavaScript tasks blocking the main thread
2. Event handler execution time
3. Rendering updates after interaction

Optimizations:
- Break long tasks into smaller chunks with requestIdleCallback/scheduler
- Use Web Workers for CPU-intensive work
- Debounce/throttle frequent events (scroll, resize, input)
- Use CSS animations instead of JS for visual feedback
- Minimize DOM reads during event handlers
```

```typescript
// Break long tasks into chunks
function processLargeArray<T>(
    items: T[],
    fn: (item: T) => void,
    chunkSize = 50
): Promise<void> {
    return new Promise((resolve) => {
        let i = 0;
        function processChunk() {
            const end = Math.min(i + chunkSize, items.length);
            for (; i < end; i++) {
                fn(items[i]);
            }
            if (i < items.length) {
                requestAnimationFrame(processChunk);
            } else {
                resolve();
            }
        }
        processChunk();
    });
}

// Use scheduler API for yielding (modern browsers)
async function yieldToMain(): Promise<void> {
    if ('scheduler' in window) {
        return (window as any).scheduler.yield();
    }
    return new Promise(resolve => setTimeout(resolve, 0));
}

// Heavy computation with yielding
async function processWithYielding(data: Item[]): Promise<void> {
    for (let i = 0; i < data.length; i++) {
        processItem(data[i]);
        if (i % 100 === 0) await yieldToMain();
    }
}
```

### CLS (Cumulative Layout Shift) — Target < 0.1

```
What causes CLS:
1. Images/iframes without dimensions
2. Late-loading fonts (FOIT/FOUT)
3. Dynamic content injected above existing content
4. Web fonts causing reflow

Optimizations:
- Always set width/height on images and video
- Use font-display: swap with size-adjust
- Reserve space for dynamic content (skeleton screens)
- Avoid inserting content above existing content
- Use CSS contain: layout for isolated sections
```

```typescript
// Reserve space for images
<img
    src="photo.jpg"
    width={800}     // always set dimensions
    height={600}
    loading="lazy"
    style="aspect-ratio: 4/3; width: 100%; height: auto;"
/>

// Font loading without layout shift
// @font-face {
//   font-family: 'MyFont';
//   src: url('/fonts/myfont.woff2') format('woff2');
//   font-display: swap;
//   ascent-override: 90%;
//   descent-override: 10%;
//   line-gap-override: 0%;
//   size-adjust: 100%;
// }

// Skeleton placeholder (reserves exact space)
const SkeletonCard = () => (
    <div class="card skeleton" style="height: 200px;">
        <div class="skeleton-line" style="width: 60%; height: 20px;" />
        <div class="skeleton-line" style="width: 40%; height: 16px;" />
    </div>
);
```

## Virtual Scrolling

```typescript
import { createVirtualList } from 'elit/state';

// Only render visible rows — handles 100k+ items
const controller = createVirtualList(
    document.getElementById('table-body')!,
    largeDataSet,
    (item, index) => (
        <tr>
            <td>{index + 1}</td>
            <td>{item.name}</td>
            <td>{item.value}</td>
        </tr>
    ),
    48,    // row height in pixels
    10     // buffer rows above/below viewport
);

// Cleanup when component unmounts
controller.destroy();
```

## Debounce & Throttle

```typescript
import { throttle, debounce } from 'elit/state';

// Throttle: fire at most once per interval
const handleScroll = throttle(() => {
    const scrollTop = window.scrollY;
    updateVisibleElements(scrollTop);
}, 16); // ~60fps

// Debounce: fire after silence
const handleSearch = debounce((query: string) => {
    fetchSearchResults(query);
}, 300);

const handleResize = debounce(() => {
    recalculateLayout();
}, 150);

// Attach with passive flag for better scroll perf
window.addEventListener('scroll', handleScroll, { passive: true });
window.addEventListener('resize', handleResize, { passive: true });
```

## Image Optimization

```typescript
// Serve modern formats with fallback
const OptimizedImage = ({ src, alt, width, height }: ImageProps) => (
    <picture>
        <source srcset={`${src}.avif`} type="image/avif" />
        <source srcset={`${src}.webp`} type="image/webp" />
        <img
            src={`${src}.jpg`}
            alt={alt}
            width={width}
            height={height}
            loading="lazy"
            decoding="async"
            style={`aspect-ratio: ${width}/${height}; width: 100%; height: auto;`}
        />
    </picture>
);

// Background image with progressive loading
const ProgressiveImage = ({ thumb, full, alt }: { thumb: string; full: string; alt: string }) => {
    const loaded = createState(false);

    return (
        <div class="img-wrapper" style={`background-image: url(${thumb}); background-size: cover;`}>
            <img
                src={full}
                alt={alt}
                loading="lazy"
                onload={() => { loaded.value = true; }}
                style={loaded.value ? 'opacity: 1; transition: opacity 0.3s' : 'opacity: 0'}
            />
        </div>
    );
};
```

## Performance Measurement

### Web Vitals Measurement

```typescript
// Measure Core Web Vitals in production
function measurePerformance(): void {
    // LCP
    new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log('LCP:', lastEntry.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // INP
    new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            const eventEntry = entry as PerformanceEntry & { duration: number };
            console.log('INP:', eventEntry.duration);
        }
    }).observe({ type: 'event', buffered: true });

    // CLS
    let clsValue = 0;
    new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            const layoutShift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
            if (!layoutShift.hadRecentInput) {
                clsValue += layoutShift.value;
            }
        }
        console.log('CLS:', clsValue);
    }).observe({ type: 'layout-shift', buffered: true });

    // TTFB
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (nav) {
        console.log('TTFB:', nav.responseStart - nav.requestStart);
        console.log('DOM Complete:', nav.domComplete);
    }
}
```

### Custom Performance Marks

```typescript
function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const startMark = `${label}-start`;
    const endMark = `${label}-end`;

    performance.mark(startMark);

    return fn().finally(() => {
        performance.mark(endMark);
        performance.measure(label, startMark, endMark);

        const measure = performance.getEntriesByName(label)[0];
        console.log(`${label}: ${Math.round(measure.duration)}ms`);

        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(label);
    });
}

// Usage
const data = await measureAsync('fetch-users', () =>
    fetch('/api/users').then(r => r.json())
);
```

## Memory Management

```typescript
import { cleanupUnused } from 'elit/state';

// Periodic cleanup of orphaned reactive DOM nodes
setInterval(() => {
    const appRoot = document.getElementById('app');
    if (appRoot) cleanupUnused(appRoot);
}, 30_000);

// Destroy states when components unmount
function createComponent() {
    const count = createState(0);
    const name = createState('');

    return {
        view: (
            <div>
                <p>Count: {text(count)}</p>
                <input type="text" {...bindValue(name)} />
            </div>
        ),
        destroy: () => {
            count.destroy();
            name.destroy();
        },
    };
}

// Object pool for large/repeated allocations
class ObjectPool<T> {
    private pool: T[] = [];

    constructor(
        private factory: () => T,
        private reset: (obj: T) => void,
        private maxSize: number = 100
    ) {}

    acquire(): T {
        return this.pool.pop() ?? this.factory();
    }

    release(obj: T): void {
        if (this.pool.length < this.maxSize) {
            this.reset(obj);
            this.pool.push(obj);
        }
    }
}
```

## Code Style Rules

- Lazy load all route components — never bundle every page into the initial chunk.
- Use `loading="lazy"` on all images below the fold — use `fetchpriority="high"` on hero images.
- Always set `width` and `height` on images to prevent CLS.
- Use `font-display: swap` with `size-adjust` to prevent font-induced layout shifts.
- Split heavy libraries (PDF, charts, editors) into separate chunks loaded on demand.
- Use `createVirtualList` for lists with 1000+ items — never render all DOM nodes.
- Throttle scroll/resize handlers at 16ms (60fps); debounce search input at 200-300ms.
- Prefetch likely-next routes during idle time using `requestIdleCallback`.
- Preload critical resources (hero image, main font, critical CSS) with `<link rel="preload">`.
- Use `{ passive: true }` on scroll/touch event listeners for better scroll performance.
- Break long tasks (>50ms) into smaller chunks using `requestAnimationFrame` or `scheduler.yield()`.
- Use Web Workers for CPU-intensive operations (image processing, data parsing, encryption).
- Use `renderChunked` instead of `render` for 1000+ VNodes at once.
- Call `destroy()` on State objects when components unmount — prevent memory leaks.
- Measure Core Web Vitals in production — LCP < 2.5s, INP < 200ms, CLS < 0.1.
