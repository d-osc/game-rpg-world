---
name: web-mobile-design
description: Design and build mobile-first web applications — touch targets, bottom sheets, pull-to-refresh, swipe gestures, adaptive layouts, safe areas, PWA patterns, and native-feel mobile UI.
---

You are an expert in designing and building mobile-first web applications. When the user asks for help with mobile web UI, follow these instructions.

## Design Principles

- **Thumb zone** — primary actions within easy thumb reach (bottom 2/3 of screen)
- **Touch targets** — minimum 44x44px (iOS) / 48x48px (Android), 8px spacing between
- **Edge-to-edge** — use full width, respect safe areas with `env(safe-area-inset-*)`
- **Scroll momentum** — `-webkit-overflow-scrolling: touch`, smooth native-feel scroll
- **No hover states** — touch has no hover; use `@media (hover: hover)` for optional enhancements
- **Performance** — avoid heavy shadows, backdrop-filter on low-end; use `will-change` sparingly
- **Gesture-friendly** — swipe, pull, long-press; avoid tiny drag targets
- **Feedback** — tap highlights, haptic-like visual responses, skeleton loading

## Viewport & Safe Areas

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#ffffff">
```

```css
/* Safe area insets for notched devices */
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}

/* Apply to app shell */
.app {
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
  padding-left: var(--safe-left);
  padding-right: var(--safe-right);
}

/* Bottom bar must clear the home indicator */
.bottom-bar {
  padding-bottom: calc(var(--safe-bottom) + 8px);
}

/* Full-bleed content that respects safe area */
.full-bleed {
  margin-inline: calc(var(--safe-left) * -1);
  padding-inline: var(--safe-left);
}
```

## App Shell Layouts

### Tab Bar App (iOS style)

```html
<div class="app">
  <header class="app-header">
    <h1 class="app-title">App Name</h1>
  </header>
  <main class="app-content">
    <!-- Scrollable content -->
  </main>
  <nav class="tab-bar" aria-label="Main navigation">
    <a class="tab-item active" href="/">
      <svg class="tab-icon" width="24" height="24"><!-- home --></svg>
      <span class="tab-label">Home</span>
    </a>
    <a class="tab-item" href="/search">
      <svg class="tab-icon" width="24" height="24"><!-- search --></svg>
      <span class="tab-label">Search</span>
    </a>
    <a class="tab-item" href="/notifications">
      <svg class="tab-icon" width="24" height="24"><!-- bell --></svg>
      <span class="tab-label">Alerts</span>
      <span class="tab-badge">3</span>
    </a>
    <a class="tab-item" href="/profile">
      <svg class="tab-icon" width="24" height="24"><!-- user --></svg>
      <span class="tab-label">Profile</span>
    </a>
  </nav>
</div>
```

```css
.app {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100dvh;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app-header {
  padding: 12px 16px;
  padding-top: calc(var(--safe-top) + 12px);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.app-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
}

.app-content {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}

/* Tab bar */
.tab-bar {
  display: flex;
  justify-content: space-around;
  align-items: stretch;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding-bottom: var(--safe-bottom);
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex: 1;
  min-height: 50px;
  padding: 6px 0;
  text-decoration: none;
  color: var(--text-muted);
  font-size: 10px;
  position: relative;
  -webkit-tap-highlight-color: transparent;
}

.tab-item.active {
  color: var(--accent);
}

.tab-icon { width: 24px; height: 24px; }
.tab-label { font-weight: 500; }

.tab-badge {
  position: absolute;
  top: 4px;
  right: 50%;
  transform: translateX(14px);
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--danger);
  color: white;
  font-size: 11px;
  font-weight: 600;
  display: grid;
  place-items: center;
  line-height: 1;
}
```

### Navigation Bar App (Android / Material style)

```css
.app-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px;
  padding-top: calc(var(--safe-top) + 8px);
  background: var(--surface);
}

.nav-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--text);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.nav-btn:active { background: var(--hover); }

.nav-title {
  flex: 1;
  font-size: 20px;
  font-weight: 500;
}

.nav-actions {
  display: flex;
  gap: 4px;
}
```

## Bottom Sheet

```html
<div class="bottom-sheet-overlay" id="sheet-overlay" hidden></div>
<div class="bottom-sheet" id="sheet" role="dialog" aria-modal="true" hidden>
  <div class="sheet-handle" aria-hidden="true"></div>
  <div class="sheet-header">
    <h2 class="sheet-title">Options</h2>
    <button class="sheet-close" aria-label="Close">&times;</button>
  </div>
  <div class="sheet-body">
    <button class="sheet-action">
      <span class="sheet-action-icon">📤</span>
      <span>Share</span>
    </button>
    <button class="sheet-action">
      <span class="sheet-action-icon">📋</span>
      <span>Copy Link</span>
    </button>
    <button class="sheet-action">
      <span class="sheet-action-icon">✏️</span>
      <span>Edit</span>
    </button>
    <button class="sheet-action destructive">
      <span class="sheet-action-icon">🗑️</span>
      <span>Delete</span>
    </button>
  </div>
</div>
```

```css
.bottom-sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
  opacity: 0;
  transition: opacity 200ms;
}
.bottom-sheet-overlay.visible { opacity: 1; }

.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 101;
  background: var(--surface);
  border-radius: 16px 16px 0 0;
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
  padding-bottom: var(--safe-bottom);
}
.bottom-sheet.open {
  transform: translateY(0);
}

.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--text-muted);
  opacity: 0.3;
  margin: 8px auto 4px;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
}

.sheet-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
}

.sheet-close {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--hover);
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 18px;
  cursor: pointer;
}

.sheet-body {
  padding: 0 8px 20px;
  overflow-y: auto;
}

.sheet-action {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  border: none;
  background: transparent;
  border-radius: 12px;
  font-size: 16px;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.sheet-action:active { background: var(--hover); }
.sheet-action.destructive { color: var(--danger); }

.sheet-action-icon { font-size: 20px; width: 28px; text-align: center; }
```

```js
function openSheet() {
  const overlay = document.getElementById('sheet-overlay');
  const sheet = document.getElementById('sheet');
  overlay.hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    sheet.classList.add('open');
  });
}

function closeSheet() {
  const overlay = document.getElementById('sheet-overlay');
  const sheet = document.getElementById('sheet');
  overlay.classList.remove('visible');
  sheet.classList.remove('open');
  setTimeout(() => {
    overlay.hidden = true;
    sheet.hidden = true;
  }, 300);
}
```

## Pull to Refresh

```js
function initPullToRefresh(container, onRefresh) {
  let startY = 0;
  let pulling = false;
  const threshold = 80;
  const indicator = document.createElement('div');
  indicator.className = 'pull-indicator';
  indicator.innerHTML = '<div class="pull-spinner"></div>';
  container.prepend(indicator);

  container.addEventListener('touchstart', (e) => {
    if (container.scrollTop === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const diff = e.touches[0].clientY - startY;
    if (diff < 0) { pulling = false; return; }
    const pull = Math.min(diff * 0.5, threshold);
    indicator.style.transform = `translateY(${pull}px)`;
    indicator.style.opacity = pull / threshold;
  }, { passive: true });

  container.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;
    const currentPull = parseFloat(indicator.style.transform.match(/\d+/)?.[0] ?? 0);
    if (currentPull >= threshold * 0.8) {
      indicator.classList.add('loading');
      await onRefresh();
      indicator.classList.remove('loading');
    }
    indicator.style.transform = '';
    indicator.style.opacity = '';
  });
}
```

```css
.pull-indicator {
  display: grid;
  place-items: center;
  height: 0;
  overflow: hidden;
  opacity: 0;
  transition: opacity 200ms;
}

.pull-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
}

.loading .pull-spinner {
  animation: spin 600ms linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
```

## Swipe Actions

```js
function initSwipe(element, { threshold = 60, onSwipeLeft, onSwipeRight } = {}) {
  let startX = 0, currentX = 0, swiping = false;

  element.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    currentX = startX;
    swiping = true;
  }, { passive: true });

  element.addEventListener('touchmove', (e) => {
    if (!swiping) return;
    currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    element.style.transform = `translateX(${diff}px)`;
  }, { passive: true });

  element.addEventListener('touchend', () => {
    if (!swiping) return;
    swiping = false;
    const diff = currentX - startX;
    element.style.transform = '';

    if (diff < -threshold) onSwipeLeft?.();
    if (diff > threshold) onSwipeRight?.();
  });
}
```

Usage — swipe to delete:
```js
initSwipe(listItem, {
  threshold: 80,
  onSwipeLeft: () => deleteItem(item),
  onSwipeRight: () => archiveItem(item),
});
```

## List Patterns

### List Item

```html
<ul class="list" role="list">
  <li class="list-item" role="listitem">
    <img class="list-avatar" src="avatar.jpg" alt="" width="44" height="44">
    <div class="list-content">
      <span class="list-title">Contact Name</span>
      <span class="list-subtitle">Last message preview...</span>
    </div>
    <span class="list-meta">
      <span class="list-time">2m</span>
      <span class="list-badge">2</span>
    </span>
  </li>
  <li class="list-item" role="listitem">
    <div class="list-icon">📁</div>
    <div class="list-content">
      <span class="list-title">Documents</span>
      <span class="list-subtitle">12 files</span>
    </div>
    <svg class="list-chevron" width="16" height="16"><!-- chevron --></svg>
  </li>
</ul>
```

```css
.list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  min-height: 56px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 120ms;
}
.list-item:active { background: var(--hover); }

.list-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.list-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  font-size: 22px;
  background: var(--hover);
  border-radius: 12px;
  flex-shrink: 0;
}

.list-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.list-title {
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.list-time {
  font-size: 12px;
  color: var(--text-muted);
}

.list-badge {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--accent);
  color: white;
  font-size: 12px;
  font-weight: 600;
  display: grid;
  place-items: center;
  line-height: 1;
}

.list-chevron {
  color: var(--text-muted);
  opacity: 0.3;
  flex-shrink: 0;
}
```

### Section Headers (Grouped List)

```css
.list-section-title {
  padding: 24px 16px 8px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
```

## Cards & Feed

### Feed Card

```html
<article class="feed-card">
  <div class="feed-header">
    <img class="feed-avatar" src="user.jpg" alt="" width="36" height="36">
    <div class="feed-user">
      <span class="feed-name">Username</span>
      <span class="feed-handle">@handle · 2h</span>
    </div>
    <button class="feed-more" aria-label="More">⋮</button>
  </div>
  <div class="feed-body">
    <p>Post content goes here with text and maybe a link.</p>
    <img class="feed-image" src="post.jpg" alt="Post image" loading="lazy" width="400" height="300">
  </div>
  <div class="feed-actions">
    <button class="feed-action" aria-label="Like">
      <svg width="20" height="20"><!-- heart --></svg>
      <span>24</span>
    </button>
    <button class="feed-action" aria-label="Comment">
      <svg width="20" height="20"><!-- comment --></svg>
      <span>8</span>
    </button>
    <button class="feed-action" aria-label="Share">
      <svg width="20" height="20"><!-- share --></svg>
    </button>
    <button class="feed-action" aria-label="Bookmark">
      <svg width="20" height="20"><!-- bookmark --></svg>
    </button>
  </div>
</article>
```

```css
.feed-card {
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

.feed-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.feed-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.feed-user {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.feed-name { font-size: 15px; font-weight: 600; }
.feed-handle { font-size: 13px; color: var(--text-muted); }

.feed-more {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  cursor: pointer;
}
.feed-more:active { background: var(--hover); }

.feed-body {
  font-size: 15px;
  line-height: 1.45;
  margin-bottom: 12px;
}
.feed-body p { margin: 0 0 10px; }

.feed-image {
  width: 100%;
  border-radius: 12px;
  object-fit: cover;
  max-height: 400px;
}

.feed-actions {
  display: flex;
  justify-content: space-between;
  max-width: 400px;
}

.feed-action {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  padding: 8px;
  border-radius: 50%;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.feed-action:active { background: var(--hover); }
```

### Product Card (Grid)

```css
.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 12px 16px;
}

.product-card {
  background: var(--surface);
  border-radius: 12px;
  overflow: hidden;
}

.product-image {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.product-info {
  padding: 10px;
}

.product-name {
  font-size: 14px;
  font-weight: 500;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-price {
  font-size: 15px;
  font-weight: 600;
  color: var(--accent);
  margin-top: 4px;
}
```

## Form Patterns

### Floating Label Input

```html
<div class="field">
  <input class="field-input" type="text" id="email" placeholder=" " required>
  <label class="field-label" for="email">Email</label>
</div>
```

```css
.field {
  position: relative;
  margin-bottom: 16px;
}

.field-input {
  width: 100%;
  height: 56px;
  padding: 20px 16px 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  font-size: 16px; /* prevent iOS zoom */
  color: var(--text);
  outline: none;
  transition: border-color 150ms;
}
.field-input:focus { border-color: var(--accent); }

.field-label {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--text-muted);
  pointer-events: none;
  transition: all 150ms;
  transform-origin: left;
}

.field-input:focus + .field-label,
.field-input:not(:placeholder-shown) + .field-label {
  top: 14px;
  transform: translateY(0) scale(0.75);
  color: var(--accent);
}
```

### Search Bar

```html
<div class="search-bar">
  <svg class="search-icon" width="18" height="18"><!-- search --></svg>
  <input class="search-input" type="search" placeholder="Search..." enterkeyhint="search">
  <button class="search-clear" aria-label="Clear" hidden>✕</button>
</div>
```

```css
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 44px;
  background: var(--hover);
  border-radius: 12px;
}

.search-icon { color: var(--text-muted); flex-shrink: 0; }

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 16px;
  color: var(--text);
  outline: none;
}
.search-input::placeholder { color: var(--text-muted); }

.search-clear {
  width: 24px;
  height: 24px;
  border: none;
  background: var(--text-muted);
  color: white;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 12px;
  cursor: pointer;
}
```

### Full-Width Mobile Button

```css
.btn-mobile {
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 120ms;
}
.btn-mobile:active { opacity: 0.7; }

.btn-primary {
  background: var(--accent);
  color: white;
}

.btn-secondary {
  background: transparent;
  border: 1.5px solid var(--border);
  color: var(--text);
}
```

## Navigation Patterns

### Screen Header with Back

```html
<header class="screen-header">
  <button class="back-btn" aria-label="Go back">
    <svg width="24" height="24"><!-- chevron left --></svg>
  </button>
  <h1 class="screen-title">Settings</h1>
  <button class="header-action" aria-label="Done">Done</button>
</header>
```

```css
.screen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px;
  padding-top: calc(var(--safe-top) + 8px);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  min-height: 52px;
}

.screen-title {
  flex: 1;
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  margin: 0;
}

.back-btn,
.header-action {
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: var(--accent);
  font-size: 16px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.back-btn:active,
.header-action:active { background: var(--hover); }
```

### Stepper / Progress

```html
<div class="stepper" role="progressbar" aria-valuenow="2" aria-valuemin="1" aria-valuemax="4">
  <div class="step active" aria-current="step">
    <div class="step-dot">1</div>
    <span class="step-label">Info</span>
  </div>
  <div class="step-line active"></div>
  <div class="step active">
    <div class="step-dot">2</div>
    <span class="step-label">Details</span>
  </div>
  <div class="step-line"></div>
  <div class="step">
    <div class="step-dot">3</div>
    <span class="step-label">Review</span>
  </div>
  <div class="step-line"></div>
  <div class="step">
    <div class="step-dot">4</div>
    <span class="step-label">Done</span>
  </div>
</div>
```

```css
.stepper {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 0;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--border);
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface);
}

.step.active .step-dot {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
}

.step-label {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
.step.active .step-label { color: var(--accent); font-weight: 600; }

.step-line {
  flex: 1;
  height: 2px;
  background: var(--border);
  margin: 0 4px;
  margin-bottom: 22px;
}
.step-line.active { background: var(--accent); }
```

## Toast / Snackbar

```html
<div class="toast" id="toast" role="alert" aria-live="assertive" hidden>
  <span class="toast-message">Item saved successfully</span>
  <button class="toast-action">Undo</button>
</div>
```

```css
.toast {
  position: fixed;
  bottom: calc(var(--safe-bottom) + 72px);
  left: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--text);
  color: var(--bg);
  border-radius: 12px;
  font-size: 14px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  z-index: 200;
  transform: translateY(calc(100% + var(--safe-bottom)));
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
}
.toast.visible {
  transform: translateY(0);
}

.toast-message { flex: 1; }

.toast-action {
  border: none;
  background: transparent;
  color: var(--accent);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  -webkit-tap-highlight-color: transparent;
}
.toast-action:active { opacity: 0.7; }
```

```js
function showToast(message, action, duration = 4000) {
  const toast = document.getElementById('toast');
  toast.querySelector('.toast-message').textContent = message;
  if (action) {
    const btn = toast.querySelector('.toast-action');
    btn.textContent = action.label;
    btn.onclick = () => { action.fn(); hideToast(); };
  }
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(hideToast, duration);
}

function hideToast() {
  const toast = document.getElementById('toast');
  toast.classList.remove('visible');
  setTimeout(() => { toast.hidden = true; }, 300);
}
```

## Skeleton Loading

```css
.skeleton {
  background: linear-gradient(90deg, var(--hover) 25%, var(--surface) 50%, var(--hover) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  to { background-position: -200% 0; }
}

/* Card skeleton */
.skeleton-card {
  padding: 16px;
  display: flex;
  gap: 12px;
}
.skeleton-card .skeleton-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  flex-shrink: 0;
}
.skeleton-card .skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.skeleton-card .skeleton-line {
  height: 14px;
}
.skeleton-card .skeleton-line:last-child {
  width: 60%;
}

/* List skeleton */
.skeleton-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}
```

## Adaptive & Responsive

```css
/* Mobile base (< 640px) — single column, full-width elements */

/* Small tablet / large phone */
@media (min-width: 480px) {
  .product-grid { grid-template-columns: repeat(3, 1fr); }
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .app { max-width: 768px; margin: 0 auto; }

  /* Side-by-side layout */
  .detail-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
}

/* Desktop — use web-desktop-design skill patterns */
@media (min-width: 1024px) {
  .mobile-only { display: none; }
}

/* Touch vs pointer */
@media (hover: none) and (pointer: coarse) {
  /* Touch device — larger targets */
  .list-item { min-height: 56px; }
}
@media (hover: hover) and (pointer: fine) {
  /* Pointer device — can use hover effects */
  .list-item:hover { background: var(--hover); }
}
```

## Touch & Gesture Utilities

```css
/* Prevent callout on long-press */
.no-callout {
  -webkit-touch-callout: none;
}

/* Prevent text selection on interactive elements */
.no-select {
  -webkit-user-select: none;
  user-select: none;
}

/* Smooth touch scrolling */
.scroll-touch {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}

/* Disable pinch zoom on specific element */
.no-zoom {
  touch-action: manipulation; /* allow scroll & tap, disable pinch/zoom */
}

/* Horizontal scroll snap */
.scroll-h {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  gap: 12px;
  padding: 0 16px;
  scrollbar-width: none;
}
.scroll-h::-webkit-scrollbar { display: none; }

.scroll-h > * {
  scroll-snap-align: start;
  flex-shrink: 0;
}

/* Tap highlight override */
button, a {
  -webkit-tap-highlight-color: transparent;
}
```

### Horizontal Scroll Cards (Stories / Categories)

```html
<div class="scroll-h">
  <div class="story">
    <div class="story-ring">
      <img src="avatar1.jpg" alt="" width="56" height="56">
    </div>
    <span class="story-name">Alice</span>
  </div>
  <div class="story">
    <div class="story-ring">
      <img src="avatar2.jpg" alt="" width="56" height="56">
    </div>
    <span class="story-name">Bob</span>
  </div>
  <!-- more stories -->
</div>
```

```css
.story {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 72px;
}

.story-ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  padding: 2px;
  background: linear-gradient(135deg, #f59e0b, #ef4444, #ec4899);
}

.story-ring img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--bg);
}

.story-name {
  font-size: 11px;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

## Image Lightbox

```css
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.95);
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 200ms;
}
.lightbox.visible { opacity: 1; }

.lightbox img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.lightbox-close {
  position: fixed;
  top: calc(var(--safe-top) + 12px);
  right: 12px;
  width: 44px;
  height: 44px;
  border: none;
  background: rgba(255,255,255,0.15);
  color: white;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 22px;
  cursor: pointer;
}
```

## PWA Meta Tags

```html
<!-- PWA -->
<meta name="theme-color" content="#ffffff">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/icon-192.png">
<link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png">

<!-- Splash screen (iOS) -->
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="apple-touch-startup-image" href="/splash-750x1334.png"
      media="(device-width: 375px) and (device-height: 667px)">
```

## Design Tokens

```css
:root {
  --bg: #ffffff;
  --surface: #f5f5f5;
  --surface-raised: #ffffff;
  --hover: rgba(0, 0, 0, 0.05);
  --border: #e5e5e5;

  --text: #1a1a1a;
  --text-secondary: #666666;
  --text-muted: #999999;

  --accent: #007aff;
  --accent-hover: #0066d6;
  --danger: #ff3b30;
  --success: #34c759;
  --warning: #ff9500;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  --font: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-size: 16px;  /* prevent iOS zoom on inputs */

  --header-h: 52px;
  --tab-h: 50px;
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000;
    --surface: #1c1c1e;
    --surface-raised: #2c2c2e;
    --hover: rgba(255, 255, 255, 0.08);
    --border: #38383a;
    --text: #ffffff;
    --text-secondary: #98989f;
    --text-muted: #636366;
  }
}
```

## Code Style Rules

- Use `font-size: 16px` on inputs to prevent iOS auto-zoom on focus.
- Minimum touch target 44x44px; 8px gap between adjacent targets.
- Use `-webkit-tap-highlight-color: transparent` on all interactive elements.
- Use `100dvh` for full height (not `100vh` — avoids mobile browser chrome issues).
- Use `overscroll-behavior-y: contain` to prevent pull-to-refresh on inner scroll areas.
- Use `env(safe-area-inset-*)` for notch / home indicator clearance.
- Use `position: fixed` sparingly — virtual keyboard changes viewport on mobile.
- Use `touch-action: manipulation` to remove 300ms tap delay.
- Use native `<dialog>` for modals — handles backdrop and Escape key.
- Use `loading="lazy"` on below-fold images; set explicit `width` and `height`.
- Use `enterkeyhint` on inputs: `search`, `next`, `done`, `send`, `go`.
- Use `inputmode` for virtual keyboard type: `numeric`, `tel`, `email`, `url`.
- Use skeleton loading over spinners for content areas.
- Use `@media (prefers-color-scheme: dark)` for dark mode support.
- Use `@media (prefers-reduced-motion: reduce)` to disable animations.
- Avoid `position: sticky` inside `overflow: auto` containers on iOS < 15.
- Avoid `backdrop-filter` on low-end devices — use solid fallback colors.
- Test with virtual keyboard open — ensure forms are not hidden behind it.
