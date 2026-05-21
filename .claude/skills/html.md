---
name: html
description: Write semantic, accessible HTML markup — document structure, forms, tables, multimedia, meta tags, SEO, and best practices.
---

You are an expert HTML developer. When the user asks for help with HTML, follow these instructions.

## Document Structure

```html
<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Page description for SEO">
    <meta name="theme-color" content="#ffffff">
    <meta name="color-scheme" content="light dark">
    <title>Page Title</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/styles.css">
    <script type="module" src="/src/main.js"></script>
  </head>
  <body>
    <header>
      <nav aria-label="Main navigation">
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
    <main>
      <h1>Page Heading</h1>
      <p>Content goes here.</p>
    </main>
    <footer>
      <p>&copy; 2024 Company</p>
    </footer>
  </body>
</html>
```

## Head — Meta Tags

```html
<!-- Essential -->
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- SEO -->
<title>Page Title — Site Name</title>
<meta name="description" content="Concise page description (150-160 chars)">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://example.com/page">

<!-- Open Graph (Facebook, LINE, etc.) -->
<meta property="og:type" content="website">
<meta property="og:title" content="Page Title">
<meta property="og:description" content="Page description">
<meta property="og:image" content="https://example.com/og-image.jpg">
<meta property="og:url" content="https://example.com/page">
<meta property="og:site_name" content="Site Name">
<meta property="og:locale" content="th_TH">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Page Title">
<meta name="twitter:description" content="Page description">
<meta name="twitter:image" content="https://example.com/card.jpg">

<!-- PWA -->
<meta name="theme-color" content="#ffffff">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/icon-192.png">

<!-- Preload / Prefetch -->
<link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/hero.jpg" as="image">
<link rel="prefetch" href="/next-page.html">
<link rel="dns-prefetch" href="https://cdn.example.com">
<link rel="preconnect" href="https://api.example.com" crossorigin>

<!-- Favicon -->
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<!-- Inline CSS for critical path -->
<style>body{margin:0;font-family:system-ui,sans-serif}</style>
```

## Semantic Elements

```html
<!-- Layout landmarks -->
<header>   <!-- Introductory content or navigation -->
<nav>      <!-- Navigation links -->
<main>     <!-- Primary page content (only one per page) -->
<aside>    <!-- Sidebar, tangentially related content -->
<section>  <!-- Thematic grouping with heading -->
<article>  <!-- Self-contained composition -->
<footer>   <!-- Footer of nearest sectioning content -->

<!-- Content grouping -->
<figure>
  <img src="photo.jpg" alt="Description">
  <figcaption>Photo caption</figcaption>
</figure>

<details>
  <summary>Click to expand</summary>
  <p>Hidden content revealed on click.</p>
</details>

<dialog id="modal">
  <h2>Dialog Title</h2>
  <p>Dialog content</p>
  <button onclick="document.getElementById('modal').close()">Close</button>
</dialog>

<mark>Highlighted text</mark>
<time datetime="2024-01-15">January 15, 2024</time>
<abbr title="HyperText Markup Language">HTML</abbr>
<address>Contact info</address>
<cite>Book Title</cite>
<code>console.log()</code>
<samp>Terminal output</samp>
<kbd>Ctrl</kbd>
<var>variable</var>
<data value="42">The Answer</data>

<!-- Quotations -->
<blockquote cite="https://source.com">
  <p>To be or not to be.</p>
  <footer>— Shakespeare, <cite>Hamlet</cite></footer>
</blockquote>
<q>The quick brown fox</q>
```

## Headings

```html
<!-- Only one <h1> per page. Maintain hierarchy, never skip levels. -->
<h1>Page Title</h1>
  <h2>Section</h2>
    <h3>Subsection</h3>
    <h3>Another Subsection</h3>
  <h2>Another Section</h2>
    <h3>Subsection</h3>
      <h4>Detail</h4>
```

## Text Content

```html
<p>Paragraph with <strong>bold (semantic importance)</strong>,
   <em>italic (stress emphasis)</em>,
   <b>bold (visual only)</b>,
   <i>italic (visual only)</i>,
   <u>unarticulated annotation</u>,
   <s>no longer accurate</s>,
   <small>side comment</small>,
   <del datetime="2024-01-01">deleted</del>,
   <ins datetime="2024-01-15">inserted</ins>,
   <sub>subscript</sub>,
   <sup>superscript</sup>,
   and <br>line break.</p>

<pre><code>Preformatted text
  preserves whitespace</code></pre>

<hr> <!-- Thematic break -->

<!-- Lists -->
<ul>
  <li>Unordered item</li>
  <li>Another item</li>
</ul>

<ol reversed start="10">
  <li>Ordered item</li>
  <li>Another item</li>
</ol>

<dl>
  <dt>Term</dt>
  <dd>Definition</dd>
  <dt>Another term</dt>
  <dd>Another definition</dd>
</dl>
```

## Links & Navigation

```html
<!-- Basic link -->
<a href="https://example.com">External Link</a>

<!-- Target -->
<a href="https://example.com" target="_blank" rel="noopener noreferrer">
  Opens in new tab
</a>

<!-- Internal -->
<a href="/about">About</a>
<a href="#section-id">Jump to section</a>
<a href="mailto:user@example.com">Email</a>
<a href="tel:+6621234567">Call</a>
<a href="/files/doc.pdf" download>Download PDF</a>

<!-- Navigation pattern -->
<nav aria-label="Main">
  <ul>
    <li><a href="/" aria-current="page">Home</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>

<!-- Breadcrumb -->
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li><a href="/products/shoes" aria-current="page">Shoes</a></li>
  </ol>
</nav>
```

## Images

```html
<!-- Basic -->
<img src="photo.jpg" alt="Description of image" width="800" height="600">

<!-- Responsive with srcset -->
<img
  src="photo-800.jpg"
  srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1200.jpg 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
  alt="Description"
  loading="lazy"
  decoding="async"
  width="800"
  height="600"
>

<!-- Picture with format fallback -->
<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.jpg" alt="Hero image" width="1200" height="600">
</picture>

<!-- Figure -->
<figure>
  <img src="chart.png" alt="Sales chart showing 30% growth">
  <figcaption>Figure 1: Sales growth Q1-Q4 2024</figcaption>
</figure>

<!-- Icon -->
<img src="icon.svg" alt="" width="24" height="24" aria-hidden="true">
```

## Forms

```html
<form action="/api/submit" method="POST" novalidate>
  <!-- Text input -->
  <label for="name">Full Name <span aria-hidden="true">*</span></label>
  <input type="text" id="name" name="name" required
         autocomplete="name" placeholder="John Doe">

  <!-- Email -->
  <label for="email">Email</label>
  <input type="email" id="email" name="email" required
         autocomplete="email" placeholder="user@example.com">

  <!-- Password -->
  <label for="password">Password</label>
  <input type="password" id="password" name="password" required
         minlength="8" autocomplete="new-password">

  <!-- Search -->
  <label for="search">Search</label>
  <input type="search" id="search" name="q"
         placeholder="Search..." autocomplete="off">

  <!-- Tel -->
  <label for="phone">Phone</label>
  <input type="tel" id="phone" name="phone"
         pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
         placeholder="081-234-5678">

  <!-- Number -->
  <label for="age">Age</label>
  <input type="number" id="age" name="age" min="1" max="120" step="1">

  <!-- Date -->
  <label for="dob">Date of Birth</label>
  <input type="date" id="dob" name="dob" min="1900-01-01" max="2024-12-31">

  <!-- Time -->
  <input type="time" id="meeting" name="meeting" min="09:00" max="18:00">

  <!-- Datetime local -->
  <input type="datetime-local" id="event" name="event">

  <!-- Month / Week -->
  <input type="month" id="month" name="month">
  <input type="week" id="week" name="week">

  <!-- URL -->
  <input type="url" id="website" name="website"
         placeholder="https://example.com">

  <!-- Color -->
  <input type="color" id="theme" name="theme" value="#3b82f6">

  <!-- Range -->
  <label for="volume">Volume: <output for="volume">50</output></label>
  <input type="range" id="volume" name="volume" min="0" max="100" value="50">

  <!-- File -->
  <label for="avatar">Upload photo</label>
  <input type="file" id="avatar" name="avatar"
         accept="image/png,image/jpeg" capture="environment">

  <!-- Multiple files -->
  <input type="file" name="docs" multiple accept=".pdf,.doc,.docx">

  <!-- Hidden -->
  <input type="hidden" name="token" value="abc123">

  <!-- Textarea -->
  <label for="message">Message</label>
  <textarea id="message" name="message" rows="5" cols="40"
            maxlength="500" placeholder="Write your message..."></textarea>

  <!-- Select -->
  <label for="country">Country</label>
  <select id="country" name="country" required>
    <option value="">Select a country</option>
    <optgroup label="Southeast Asia">
      <option value="TH">Thailand</option>
      <option value="VN">Vietnam</option>
      <option value="MY">Malaysia</option>
    </optgroup>
    <optgroup label="East Asia">
      <option value="JP">Japan</option>
      <option value="KR">South Korea</option>
    </optgroup>
  </select>

  <!-- Multi-select -->
  <select id="tags" name="tags" multiple size="5">
    <option value="html">HTML</option>
    <option value="css">CSS</option>
    <option value="js">JavaScript</option>
  </select>

  <!-- Checkbox -->
  <fieldset>
    <legend>Preferences</legend>
    <label>
      <input type="checkbox" name="newsletter" checked>
      Subscribe to newsletter
    </label>
    <label>
      <input type="checkbox" name="terms" required>
      I agree to the terms
    </label>
  </fieldset>

  <!-- Radio -->
  <fieldset>
    <legend>Shipping Method</legend>
    <label>
      <input type="radio" name="shipping" value="standard" checked>
      Standard (3-5 days)
    </label>
    <label>
      <input type="radio" name="shipping" value="express">
      Express (1-2 days)
    </label>
  </fieldset>

  <!-- Datalist (suggestions) -->
  <label for="city">City</label>
  <input type="text" id="city" name="city" list="cities">
  <datalist id="cities">
    <option value="Bangkok">
    <option value="Chiang Mai">
    <option value="Phuket">
  </datalist>

  <!-- Output -->
  <output for="a b" name="result">0</output>

  <!-- Progress -->
  <label for="upload">Upload progress</label>
  <progress id="upload" value="70" max="100">70%</progress>

  <!-- Meter -->
  <meter min="0" max="100" low="25" high="75" optimum="50" value="60">60/100</meter>

  <!-- Buttons -->
  <button type="submit">Submit</button>
  <button type="reset">Reset</button>
  <button type="button" onclick="handleClick()">Custom Action</button>

  <!-- Disabled fieldset -->
  <fieldset disabled>
    <legend>Locked Section</legend>
    <input type="text" name="locked" value="Cannot edit">
  </fieldset>
</form>
```

## Tables

```html
<table>
  <caption>Q1 2024 Sales Report</caption>
  <colgroup>
    <col>
    <col>
    <col span="2" class="numbers">
  </colgroup>
  <thead>
    <tr>
      <th scope="col">Product</th>
      <th scope="col">Q1</th>
      <th scope="col">Q2</th>
      <th scope="col">Total</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Widget A</th>
      <td>1,200</td>
      <td>1,500</td>
      <td>2,700</td>
    </tr>
    <tr>
      <th scope="row">Widget B</th>
      <td>800</td>
      <td>950</td>
      <td>1,750</td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <th scope="row">Total</th>
      <td>2,000</td>
      <td>2,450</td>
      <td>4,450</td>
    </tr>
  </tfoot>
</table>
```

## Audio & Video

```html
<!-- Video -->
<video controls width="800" height="450"
       poster="/poster.jpg" preload="metadata"
       crossorigin="anonymous">
  <source src="video.mp4" type="video/mp4">
  <source src="video.webm" type="video/webm">
  <track kind="subtitles" src="subs.th.vtt" srclang="th" label="Thai">
  <track kind="captions" src="caps.en.vtt" srclang="en" label="English">
  Your browser does not support video.
</video>

<!-- Audio -->
<audio controls preload="metadata">
  <source src="audio.mp3" type="audio/mpeg">
  <source src="audio.ogg" type="audio/ogg">
  Your browser does not support audio.
</audio>
```

## Iframe & Embed

```html
<!-- Iframe -->
<iframe
  src="https://example.com/embed"
  width="800" height="450"
  title="Embedded content description"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin"
  allow="accelerometer; autoplay; encrypted-media"
  referrerpolicy="no-referrer"
></iframe>

<!-- YouTube embed -->
<iframe
  width="560" height="315"
  src="https://www.youtube.com/embed/VIDEO_ID"
  title="Video title"
  allow="accelerometer; autoplay; encrypted-media; gyroscope"
  allowfullscreen
></iframe>

<!-- Google Maps -->
<iframe
  title="Office location"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
  src="https://www.google.com/maps/embed?..."
></iframe>
```

## SVG Inline

```html
<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
     xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
  <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>

<!-- SVG as icon with accessible label -->
<svg role="img" aria-label="Checkmark" width="24" height="24" viewBox="0 0 24 24">
  <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2"/>
</svg>

<!-- SVG sprite reference -->
<svg width="24" height="24" aria-hidden="true">
  <use href="/icons.svg#icon-check"/>
</svg>
```

## Canvas

```html
<canvas id="myCanvas" width="800" height="600">
  Fallback text for browsers without canvas support.
</canvas>
```

## Template & Slot

```html
<!-- Reusable template (not rendered until cloned) -->
<template id="card-template">
  <div class="card">
    <slot name="title">Default Title</slot>
    <slot name="body">Default content</slot>
  </div>
</template>

<!-- Web component usage -->
<my-card>
  <span slot="title">Card Title</span>
  <p slot="body">Card content</p>
</my-card>
```

## Accessibility (a11y)

```html
<!-- Landmark roles (use native elements instead of role when possible) -->
<header role="banner">
<nav role="navigation" aria-label="Main">
<main role="main">
<aside role="complementary">
<footer role="contentinfo">

<!-- aria-current for active page/link -->
<a href="/" aria-current="page">Home</a>

<!-- aria-expanded for toggles -->
<button aria-expanded="false" aria-controls="menu">Toggle Menu</button>
<ul id="menu" hidden>...</ul>

<!-- aria-label for icon buttons -->
<button aria-label="Close dialog">✕</button>

<!-- aria-describedby for form help -->
<label for="password">Password</label>
<input type="password" id="password" aria-describedby="pwd-help">
<small id="pwd-help">Minimum 8 characters</small>

<!-- aria-live for dynamic content -->
<div aria-live="polite" id="status">Loading...</div>
<div aria-live="assertive" role="alert" id="error"></div>

<!-- Skip to content -->
<a href="#main" class="sr-only">Skip to main content</a>

<!-- Screen reader only -->
<span class="sr-only">Visually hidden but read by screen readers</span>

<!-- aria-hidden for decorative elements -->
<span aria-hidden="true"> decorative icon </span>

<!-- Role for custom components -->
<div role="tablist">
  <button role="tab" aria-selected="true" aria-controls="panel-1">Tab 1</button>
  <button role="tab" aria-selected="false" aria-controls="panel-2">Tab 2</button>
</div>
<div role="tabpanel" id="panel-1">Content 1</div>
<div role="tabpanel" id="panel-2" hidden>Content 2</div>

<!-- Listbox pattern -->
<div role="listbox" aria-label="Select color">
  <div role="option" aria-selected="true">Red</div>
  <div role="option" aria-selected="false">Blue</div>
</div>

<!-- Dialog -->
<dialog role="dialog" aria-labelledby="dialog-title" aria-modal="true">
  <h2 id="dialog-title">Confirm Action</h2>
  <p>Are you sure?</p>
  <button>Cancel</button>
  <button>Confirm</button>
</dialog>
```

## Global Attributes

```html
<!-- Common global attributes -->
<div
  id="unique-id"
  class="class-one class-two"
  style="color: red;"
  title="Tooltip text"
  lang="th"
  dir="ltr"
  translate="no"
  hidden
  tabindex="0"
  draggable="true"
  contenteditable="true"
  spellcheck="true"
  role="button"
  aria-label="Description"
  aria-disabled="true"
  data-id="42"
  data-action="submit"
>
  Content
</div>

<!-- data-* attributes accessed via JS: el.dataset.id, el.dataset.action -->
```

## Script Loading Strategies

```html
<!-- Classic — blocks parsing -->
<script src="app.js"></script>

<!-- Defer — download in parallel, execute after parse (recommended) -->
<script src="app.js" defer></script>

<!-- Async — download in parallel, execute immediately (for analytics, ads) -->
<script src="analytics.js" async></script>

<!-- Module — deferred by default, strict mode -->
<script type="module" src="app.js"></script>

<!-- Nomodule fallback for older browsers -->
<script type="module" src="app.modern.js"></script>
<script nomodule src="app.legacy.js"></script>

<!-- Inline module -->
<script type="module">
  import { init } from './app.js';
  init();
</script>

<!-- Inline classic -->
<script>
  // Runs immediately, blocks parsing
  console.log('hello');
</script>
```

## Common Patterns

### Responsive Layout Shell

```html
<!doctype html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a href="#main" class="sr-only">Skip to content</a>
  <header>
    <nav aria-label="Main">
      <a href="/" aria-current="page">Home</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </nav>
  </header>
  <main id="main">
    <h1>Welcome</h1>
  </main>
  <footer>
    <p>&copy; 2024 Company</p>
  </footer>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

### Card Component

```html
<article class="card">
  <img src="photo.jpg" alt="Card image description"
       width="400" height="250" loading="lazy">
  <div class="card-body">
    <h2 class="card-title">Card Title</h2>
    <p class="card-text">Card description text.</p>
    <a href="/detail" class="card-link">Read more</a>
  </div>
</article>
```

### Accordion / FAQ

```html
<section aria-label="FAQ">
  <details>
    <summary>What is HTML?</summary>
    <p>HTML is the standard markup language for web pages.</p>
  </details>
  <details>
    <summary>What is CSS?</summary>
    <p>CSS describes how HTML elements are displayed.</p>
  </details>
</section>
```

## Code Style Rules

- Always use `<!doctype html>` (lowercase) as first line.
- Always declare `<html lang="...">` with the correct language code.
- Always include `<meta charset="UTF-8">` and viewport meta.
- Use semantic elements (`<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<footer>`) over `<div>`.
- Only one `<h1>` per page. Maintain heading hierarchy without skipping levels.
- Always add `alt` on `<img>`. Use empty `alt=""` + `aria-hidden="true"` for decorative images.
- Always pair `<label>` with form controls using `for`/`id` or wrapping.
- Use `loading="lazy"` on below-fold images and iframes.
- Always set `width` and `height` on `<img>` to prevent layout shift.
- Use `<button>` for actions, `<a>` for navigation. Never use `<div>` as clickable.
- Use `type="module"` for modern JS. Use `defer` for classic scripts.
- Use `rel="noopener noreferrer"` on `target="_blank"` links.
- Use `<strong>` for importance, `<em>` for emphasis, not `<b>`/`<i>`.
- Use `<figure>` + `<figcaption>` for images with captions.
- Use `<time datetime="...">` for machine-readable dates.
- Prefer `<picture>` + `source` for responsive images with format fallback.
- Use `aria-label`, `aria-labelledby`, `aria-describedby` for screen readers.
- Add skip-to-content link as the first focusable element.
- Use `hidden` attribute instead of `style="display:none"`.
