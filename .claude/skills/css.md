---
name: css
description: Write modern CSS — layouts, selectors, custom properties, responsive design, animations, container queries, layers, and best practices.
---

You are an expert CSS developer. When the user asks for help with CSS, follow these instructions.

## Selectors

```css
/* Basic */
element { }
.class { }
#id { }
* { }

/* Combinators */
ancestor descendant { }      /* descendant */
parent > child { }           /* direct child */
element + adjacent { }       /* next sibling */
element ~ general { }        /* all following siblings */

/* Attribute selectors */
[attr] { }                          /* has attribute */
[attr="value"] { }                  /* exact match */
[attr^="prefix"] { }                /* starts with */
[attr$="suffix"] { }                /* ends with */
[attr*="contains"] { }              /* contains */
[attr~="word"] { }                  /* contains word */
[attr|="en"] { }                    /* exact or starts with en- */

/* Pseudo-classes */
:first-child {}
:last-child {}
:only-child {}
:nth-child(odd) {}              /* 2n+1 */
:nth-child(even) {}             /* 2n */
:nth-child(3) {}                /* 3rd */
:nth-child(3n) {}               /* every 3rd */
:nth-child(-n+3) {}             /* first 3 */
:nth-last-child(3) {}
:first-of-type {}
:last-of-type {}
:nth-of-type(2) {}
:only-of-type {}
:not(.class) {}
:is(header, main, footer) {}    /* matches any — forgiving selector */
:where(header, main) {}         /* same as :is but 0 specificity */
:has(> img) {}                  /* parent selector */
:has(+ .adjacent) {}            /* has adjacent sibling */
:root {}
:empty {}
:target {}
:focus {}
:focus-visible {}               /* keyboard focus ring only */
:focus-within {}                /* descendant focus */
:hover {}
:active {}
:visited {}
:disabled {}
:enabled {}
:checked {}
:required {}
:optional {}
:valid {}
:invalid {}
:read-only {}
:read-write {}
:placeholder-shown {}
:defined {}                     /* custom element defined */
:modal {}                       /* dialog[open] */
:fullscreen {}
:scope {}
:lang(th) {}

/* Pseudo-elements */
::before {}
::after {}
::first-line {}
::first-letter {}
::selection {}
::placeholder {}
::marker {}                     /* list item marker */
::backdrop {}                   /* dialog/modal backdrop */
::spelling-error {}
::grammar-error {}

/* Nesting (native CSS nesting) */
.card {
  background: white;
  & .title { font-size: 1.25rem; }
  & > p { margin: 0; }
  &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  &::after { content: ''; display: block; }
  @media (width >= 768px) { padding: 2rem; }
}
```

## Custom Properties (Variables)

```css
:root {
  /* Colors */
  --color-primary: #3b82f6;
  --color-primary-light: #93bbfd;
  --color-primary-dark: #1d4ed8;
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-text-muted: #6b7280;
  --color-border: #e5e7eb;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* Spacing scale */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;

  /* Typography */
  --font-sans: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'Fira Code', ui-monospace, monospace;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 2rem;
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* Sizing */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.1);

  /* Transitions */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
}

/* Scoped variables */
.dark {
  --color-bg: #111827;
  --color-text: #f9fafb;
  --color-border: #374151;
}

/* Fallback values */
color: var(--color-primary, #3b82f6);
```

## Box Model & Spacing

```css
/* Box sizing — always use border-box */
*, *::before, *::after {
  box-sizing: border-box;
}

/* Margin & padding */
margin: 0;                          /* all sides */
margin: 0 auto;                     /* horizontal center block */
margin: 1rem 2rem;                  /* vertical horizontal */
margin: 1rem 2rem 3rem;             /* top horizontal bottom */
margin: 1rem 2rem 3rem 4rem;        /* top right bottom left */
margin-inline: auto;                /* logical center */
margin-block: 1rem;
padding: 1rem;

/* Logical properties */
margin-block-start: 1rem;           /* margin-top in horizontal writing */
margin-block-end: 1rem;             /* margin-bottom */
margin-inline-start: 1rem;          /* margin-left in LTR */
margin-inline-end: 1rem;            /* margin-right */
padding-block: 1rem 2rem;
padding-inline: 1rem 2rem;
inset: 0;                           /* top/right/bottom/left all 0 */
inset-block-start: 0;
inset-inline-start: 0;

/* Width & height */
width: 100%;
max-width: 1200px;
min-width: 320px;
min-height: 100vh;
height: 100dvh;                     /* dynamic viewport height */

/* Overflow */
overflow: hidden;
overflow: auto;
overflow-x: hidden;
overflow-y: auto;
text-overflow: ellipsis;            /* needs overflow:hidden + white-space:nowrap */

/* Gap (for flex/grid) */
gap: 1rem;
gap: 1rem 2rem;                     /* row column */
row-gap: 1rem;
column-gap: 1rem;
```

## Typography

```css
body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

h1, h2, h3, h4, h5, h6 {
  line-height: var(--leading-tight);
  text-wrap: balance;               /* balanced line breaks */
}

p {
  text-wrap: pretty;                /* avoids orphans */
}

.text-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Font properties */
font-size: 1.5rem;
font-weight: 400;                   /* 100-900 */
font-style: italic;
font-variant-numeric: tabular-nums; /* aligned numbers */
letter-spacing: 0.025em;
word-spacing: 0.1em;
text-transform: uppercase;
text-decoration: underline;
text-decoration-color: var(--color-primary);
text-decoration-thickness: 2px;
text-underline-offset: 4px;
text-align: center;                 /* start | end | left | right | justify */
vertical-align: middle;
white-space: nowrap;
white-space: pre-wrap;
word-break: break-word;
overflow-wrap: break-word;
hyphens: auto;
```

## Colors & Gradients

```css
/* Named, hex, rgb, hsl */
color: red;
color: #3b82f6;
color: #3b82f680;                   /* hex with alpha */
color: rgb(59 130 246);
color: rgb(59 130 246 / 0.5);       /* rgb with alpha */
color: hsl(217 91% 60%);
color: hsl(217 91% 60% / 0.8);

/* currentColor */
border: 1px solid currentColor;
color: inherit;

/* Linear gradient */
background: linear-gradient(to right, #3b82f6, #8b5cf6);
background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);

/* Radial gradient */
background: radial-gradient(circle at center, #3b82f6, transparent);
background: radial-gradient(ellipse at top left, #3b82f6 0%, transparent 70%);

/* Conic gradient */
background: conic-gradient(from 0deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6);

/* Color mixing (modern) */
color: color-mix(in srgb, #3b82f6 50%, white);

/* Relative color syntax */
color: hsl(from var(--color-primary) h s calc(l + 10%));

/* Accent color (form controls) */
accent-color: var(--color-primary);
```

## Flexbox

```css
.container {
  display: flex;
  flex-direction: row;              /* row | column | row-reverse | column-reverse */
  flex-wrap: wrap;                  /* nowrap | wrap | wrap-reverse */
  justify-content: flex-start;      /* flex-start | flex-end | center | space-between | space-around | space-evenly */
  align-items: stretch;             /* stretch | flex-start | flex-end | center | baseline */
  align-content: flex-start;        /* multi-line alignment */
  gap: 1rem;
}

.item {
  flex: 1;                          /* flex-grow: 1, flex-shrink: 1, flex-basis: 0% */
  flex: 0 0 200px;                  /* don't grow, don't shrink, 200px */
  flex: 1 1 auto;                   /* grow, shrink, auto basis */
  align-self: center;               /* override align-items for this item */
  order: -1;                        /* reorder */
  flex-grow: 1;
  flex-shrink: 0;
  flex-basis: auto;
}

/* Center everything */
.center {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Sticky footer */
.page {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
.page main { flex: 1; }
```

## Grid

```css
/* Basic grid */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto;
  gap: 1rem;
}

/* Responsive without media query */
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

/* Fixed + fluid columns */
.sidebar-layout {
  display: grid;
  grid-template-columns: 250px 1fr;
  grid-template-rows: auto 1fr auto;
  min-height: 100dvh;
}

/* Named areas */
.app-layout {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-columns: 250px 1fr;
  grid-template-rows: auto 1fr auto;
  min-height: 100dvh;
}
.app-header  { grid-area: header; }
.app-sidebar { grid-area: sidebar; }
.app-main    { grid-area: main; }
.app-footer  { grid-area: footer; }

/* Span items */
.item {
  grid-column: 1 / -1;             /* full width */
  grid-column: span 2;             /* span 2 columns */
  grid-row: span 3;
}

/* Alignment */
justify-items: start;               /* start | end | center | stretch */
align-items: start;
justify-content: center;            /* distribute extra space */
align-content: center;
place-items: center;                /* align-items + justify-items */

/* Subgrid */
.subgrid {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  gap: 1rem;
}
```

## Position

```css
.static    { position: static; }
.relative  { position: relative; top: 0; left: 0; }
.absolute  { position: absolute; inset: 0; }
.sticky    { position: sticky; top: 0; z-index: 10; }
.fixed     { position: fixed; top: 0; left: 0; width: 100%; z-index: 50; }

/* Center absolute */
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

/* Sticky header */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg);
}
```

## Responsive Design

```css
/* Mobile first media queries */
@media (min-width: 640px)  { /* sm */ }
@media (min-width: 768px)  { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }

/* Range syntax */
@media (640px <= width < 1024px) { /* between 640 and 1024 */ }

/* Max-width (desktop first) */
@media (max-width: 767px) { /* below md */ }

/* Height */
@media (min-height: 600px) { }

/* Orientation */
@media (orientation: portrait) { }
@media (orientation: landscape) { }

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #111827;
    --color-text: #f9fafb;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* High contrast */
@media (prefers-contrast: high) { }
@media (forced-colors: active) { }

/* Print */
@media print {
  nav, footer { display: none; }
  body { color: black; background: white; }
}

/* Hover capability */
@media (hover: hover) {
  .card:hover { transform: translateY(-2px); }
}

/* Responsive font sizing */
h1 { font-size: clamp(2rem, 5vw, 3.5rem); }
p  { font-size: clamp(1rem, 2vw, 1.125rem); }

/* Responsive container */
.container {
  width: 100%;
  max-width: 1200px;
  margin-inline: auto;
  padding-inline: var(--space-md);
}
```

## Container Queries

```css
/* Define a containment context */
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

/* Query the container's inline size */
@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}

@container card (min-width: 600px) {
  .card-title { font-size: 1.5rem; }
}

/* Style queries (check container custom properties) */
@container style(--layout: horizontal) {
  .card { display: flex; }
}
```

## Cascade Layers

```css
/* Define layer order (first = lowest priority) */
@layer reset, base, components, utilities;

@layer reset {
  *, *::before, *::after { box-sizing: border-box; margin: 0; }
}

@layer base {
  body { font-family: var(--font-sans); line-height: 1.5; }
  h1, h2, h3 { line-height: 1.2; }
}

@layer components {
  .card { border-radius: var(--radius-lg); }
  .btn { padding: var(--space-sm) var(--space-md); }
}

@layer utilities {
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

/* Unlayered styles always win over layered styles */
```

## Transitions

```css
.transition {
  transition: all 300ms var(--ease-default);
  transition-property: background-color, transform;
  transition-duration: 300ms;
  transition-timing-function: var(--ease-default);
  transition-delay: 0ms;
}

/* Hover lift */
.card {
  transition: transform var(--duration-fast) var(--ease-out),
              box-shadow var(--duration-fast) var(--ease-out);
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

/* Fade in on load */
.fade-in {
  animation: fadeIn 300ms var(--ease-out) forwards;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

## Animations

```css
@keyframes slideIn {
  from { transform: translateX(-100%); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-25%); }
}

.element {
  animation: slideIn 300ms var(--ease-out) forwards;
  animation-name: slideIn;
  animation-duration: 300ms;
  animation-timing-function: ease-out;
  animation-delay: 0ms;
  animation-iteration-count: 1;
  animation-direction: normal;
  animation-fill-mode: forwards;
  animation-play-state: running;
}

/* Multiple animations */
.spinner {
  animation: spin 1s linear infinite;
}

/* Staggered animation with custom property */
.list-item {
  animation: fadeIn 300ms var(--ease-out) both;
  animation-delay: calc(var(--i, 0) * 100ms);
}

/* Scroll-driven animations */
@keyframes reveal {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}
.reveal {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}

/* View transitions */
::view-transition-old(root) {
  animation: 150ms var(--ease-out) both fade-out;
}
::view-transition-new(root) {
  animation: 150ms var(--ease-in) both fade-in;
}
```

## Transforms

```css
.transform {
  transform: translateX(10px) translateY(5px) scale(1.05) rotate(5deg);
  transform-origin: center center;
}

/* Individual transform properties (modern) */
.element {
  translate: 10px 5px;
  rotate: 5deg;
  scale: 1.05;
}

/* 3D */
.cube {
  transform: perspective(800px) rotateY(45deg);
  transform-style: preserve-3d;
  backface-visibility: hidden;
}
```

## Borders & Outlines

```css
border: 1px solid var(--color-border);
border-width: 0 0 2px 0;
border-radius: var(--radius-md);
border-radius: 50%;                 /* circle for square element */

/* Outline (doesn't affect layout) */
outline: 2px solid var(--color-primary);
outline-offset: 2px;

/* Focus ring */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* No outline (provide alternative) */
button:focus:not(:focus-visible) {
  outline: none;
}
```

## Backgrounds

```css
background-color: var(--color-bg);
background-image: url('/pattern.svg');
background-size: cover;             /* cover | contain | 100px 200px */
background-position: center;        /* top | bottom | left | right | center | 50% 50% */
background-repeat: no-repeat;       /* repeat | repeat-x | repeat-y | no-repeat */
background-attachment: fixed;       /* scroll | fixed | local */
background-origin: padding-box;
background-clip: padding-box;

/* Shorthand */
background: var(--color-bg) url('/img.jpg') center / cover no-repeat;

/* Multiple backgrounds */
background:
  linear-gradient(to bottom, transparent, rgba(0,0,0,0.8)),
  url('/hero.jpg') center / cover;

/* Gradient text */
.gradient-text {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
}

/* Object fit for images/video */
img { object-fit: cover; object-position: center; }
```

## Filters & Effects

```css
.blur { filter: blur(4px); }
.brightness { filter: brightness(1.2); }
.contrast { filter: contrast(1.1); }
.grayscale { filter: grayscale(100%); }
.sepia { filter: sepia(80%); }
.saturate { filter: saturate(1.5); }
.hue-rotate { filter: hue-rotate(90deg); }
.invert { filter: invert(100%); }
.drop-shadow { filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1)); }

/* Backdrop filter (for glass effect) */
.glass {
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  background: rgba(255, 255, 255, 0.7);
}

/* Mix blend mode */
.overlay { mix-blend-mode: multiply; }
.text-on-image { mix-blend-mode: difference; color: white; }
```

## Scroll

```css
/* Smooth scroll */
html { scroll-behavior: smooth; }

/* Scroll snap */
.carousel {
  scroll-snap-type: x mandatory;
  overflow-x: auto;
}
.carousel-item {
  scroll-snap-align: start;
  flex-shrink: 0;
}

/* Vertical snap */
.page-scroll {
  scroll-snap-type: y proximity;
}
.page-section {
  scroll-snap-align: start;
}

/* Scrollbar styling */
.scrollable {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}
.scrollable::-webkit-scrollbar { width: 6px; }
.scrollable::-webkit-scrollbar-track { background: transparent; }
.scrollable::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-full);
}

/* Hide scrollbar but keep scrollable */
.hide-scrollbar {
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.hide-scrollbar::-webkit-scrollbar { display: none; }

/* Overscroll behavior */
.modal {
  overscroll-behavior: contain;     /* prevent scroll chaining */
}

/* Scroll margin (for sticky headers) */
section {
  scroll-margin-top: 80px;
}
```

## Visibility & Display

```css
/* Display */
display: block;
display: inline;
display: inline-block;
display: flex;
display: inline-flex;
display: grid;
display: inline-grid;
display: none;
display: contents;                  /* wrapper disappears, children participate */

/* Visibility */
visibility: visible;
visibility: hidden;                 /* hides but keeps space */

/* Opacity (can animate, keeps space) */
opacity: 0;
opacity: 1;

/* Clip to hide visually but keep accessible */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

## Modern Layout Utilities

```css
/* Aspect ratio */
.video { aspect-ratio: 16 / 9; }
.avatar { aspect-ratio: 1; border-radius: 50%; object-fit: cover; }

/* Fit content sizing */
.sidebar { width: fit-content; }
.sidebar { width: min(250px, 30%); }
.sidebar { width: max(200px, 20%); }
.sidebar { width: clamp(200px, 25%, 300px); }

/* Text columns */
.text-columns {
  columns: 2;
  column-gap: 2rem;
  column-rule: 1px solid var(--color-border);
}

/* Counter */
.steps { counter-reset: step; }
.step::before {
  counter-increment: step;
  content: counter(step) ". ";
  font-weight: bold;
}
```

## Common Patterns

### Reset

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select {
  font: inherit;
  color: inherit;
}

p, h1, h2, h3, h4, h5, h6 {
  overflow-wrap: break-word;
}
```

### Responsive Grid

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: var(--space-lg);
}
```

### Stack / Flow

```css
/* Vertical stack with consistent spacing */
.stack > * + * {
  margin-block-start: var(--space-md);
}
```

### Centered Container

```css
.container {
  width: 100%;
  max-width: 1200px;
  margin-inline: auto;
  padding-inline: var(--space-md);
}
```

### Card

```css
.card {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: box-shadow var(--duration-fast) var(--ease-out);
}
.card:hover {
  box-shadow: var(--shadow-md);
}
```

### Button Variants

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}
.btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}
.btn-primary:hover { background: var(--color-primary-dark); }

.btn-outline {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}
.btn-outline:hover { background: var(--color-border); }
```

### Glass Effect

```css
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-lg);
}
```

### Skeleton Loading

```css
.skeleton {
  background: linear-gradient(90deg, var(--color-border) 25%, var(--color-bg) 50%, var(--color-border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}
@keyframes shimmer {
  to { background-position: -200% 0; }
}
```

### Dark Mode Toggle

```css
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #111827;
    --color-text: #f9fafb;
  }
}

/* Or class-based toggle */
[data-theme="dark"] {
  --color-bg: #111827;
  --color-text: #f9fafb;
}
```

## Code Style Rules

- Use custom properties for all repeated values (colors, spacing, typography, shadows).
- Use logical properties (`margin-inline`, `padding-block`, `inset-inline-start`) for RTL support.
- Mobile-first: write base styles for smallest screens, use `min-width` media queries to enhance.
- Use `clamp()` for responsive typography instead of multiple breakpoints.
- Use `auto-fill`/`auto-fit` with `minmax()` for responsive grids without media queries.
- Use `:focus-visible` over `:focus` for keyboard-only focus rings.
- Use `prefers-reduced-motion` to disable animations for accessibility.
- Use CSS nesting instead of preprocessors when native support is available.
- Use `@layer` to organize specificity: reset, base, components, utilities.
- Use `container queries` over media queries for component-level responsiveness.
- Always pair `display: flex/grid` with `gap` instead of margin-based spacing.
- Use `position: sticky` instead of `position: fixed` when possible.
- Use `aspect-ratio` instead of padding-trick for media sizing.
- Use `text-wrap: balance` on headings and `text-wrap: pretty` on paragraphs.
- Avoid `!important` — use `@layer` or increase specificity instead.
- Avoid `float` for layout — use flexbox or grid.
- Avoid `z-index` wars — use stacking context with `isolation: isolate`.
- Avoid magic numbers — use design tokens / custom properties.
