---
name: javascript
description: Write, refactor, and debug JavaScript code — language features, DOM APIs, async patterns, modules, data structures, and best practices.
---

You are an expert JavaScript developer. When the user asks for help with JavaScript, follow these instructions.

## Variable Declarations

```js
// const by default, let when reassignment is needed, never var
const API_URL = 'https://api.example.com';
let currentPage = 1;

// Destructuring
const { name, email, ...rest } = user;
const [first, second, ...others] = items;
const { length } = 'hello';                    // 5
const { 0: head, length: len } = [1, 2, 3];   // head=1, len=3

// Swap
[a, b] = [b, a];

// Nested destructuring with rename and default
const { address: { city = 'Bangkok' } = {} } = user;

// Destructuring in function params
function greet({ name, age = 0, role = 'user' }) { /* ... */ }
```

## Strings

```js
// Template literals
const msg = `Hello ${name}, age ${age}`;

// Multiline
const html = `
  <div class="card">
    <h2>${title}</h2>
  </div>
`;

// Tagged templates
function highlight(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const val = values[i] ?? '';
    return result + str + (val ? `<mark>${val}</mark>` : '');
  }, '');
}
highlight`Hello ${name}, score ${score}`;

// Methods
'hello'.toUpperCase();                  // 'HELLO'
'Hello World'.toLowerCase();            // 'hello world'
'hello'.startsWith('he');               // true
'hello'.endsWith('llo');                // true
'hello'.includes('ell');                // true
'hello'.repeat(3);                      // 'hellohellohello'
'  trim  '.trim();                      // 'trim'
'hello'.slice(1, 3);                    // 'el'
'hello'.slice(-3);                      // 'llo'
'hello'.padStart(10, '.');              // '.....hello'
'hello'.padEnd(10, '.');                // 'hello.....'
'a,b,c'.split(',');                     // ['a', 'b', 'c']
'abc'.at(-1);                           // 'c'
String.fromCharCode(65);                // 'A'
```

## Arrays

```js
// Creation
const arr = [1, 2, 3];
const filled = new Array(5).fill(0);
const from = Array.from({ length: 5 }, (_, i) => i); // [0,1,2,3,4]
const fromSet = [...new Set([1, 2, 2, 3])];           // [1,2,3]

// Iterate
for (const item of arr) { /* ... */ }
for (const [i, item] of arr.entries()) { /* ... */ }

// Transform — non-mutating
const doubled = arr.map(x => x * 2);
const evens = arr.filter(x => x % 2 === 0);
const sum = arr.reduce((acc, x) => acc + x, 0);
const flat = nested.flat(Infinity);
const mapped = arr.flatMap(x => [x, x * 2]);
const found = arr.find(x => x > 2);        // first match or undefined
const idx = arr.findIndex(x => x > 2);     // index or -1
const last = arr.findLast(x => x > 2);     // last match
const has = arr.includes(3);               // boolean
const some = arr.some(x => x > 2);         // boolean
const every = arr.every(x => x > 0);       // boolean
const first3 = arr.slice(0, 3);
const last2 = arr.slice(-2);
const reversed = arr.toReversed();          // non-mutating reverse
const sorted = arr.toSorted((a, b) => a - b); // non-mutating sort
const spliced = arr.toSpliced(1, 1, 99);    // non-mutating splice
const withVal = arr.with(0, 99);            // non-mutating index replace

// Transform — mutating
arr.push(4);           // add to end, returns new length
arr.pop();             // remove from end, returns removed
arr.unshift(0);        // add to start
arr.shift();           // remove from start
arr.splice(1, 2);      // remove 2 items at index 1
arr.splice(1, 0, 'x'); // insert at index 1
arr.sort((a, b) => a - b);
arr.reverse();

// Grouping (ES2024)
const grouped = Object.groupBy(items, item => item.category);
const mapped2 = Map.groupBy(items, item => item.type);

// Destructuring
const [first, , third] = [1, 2, 3]; // skip second

// Spread / rest
const merged = [...arr1, ...arr2];
const [head, ...tail] = arr;
```

## Objects

```js
// Creation
const obj = { name: 'Alice', age: 30 };
const fromEntries = Object.fromEntries([['a', 1], ['b', 2]]);

// Access
obj.name;                          // dot notation
obj['full name'];                  // bracket notation (for special chars / dynamic keys)

// Computed property names
const key = 'color';
const obj2 = { [key]: 'red', [`${key}Code`]: '#ff0000' };

// Shorthand
const name = 'Alice';
const user = { name, age: 30 };   // same as { name: name }

// Methods
const obj3 = {
  greet() { return 'hello'; },           // shorthand method
  arrow: () => 'arrow',                  // arrow (no own `this`)
  get label() { return `${this.name}`; }, // getter
  set label(v) { this.name = v; },       // setter
};

// Iterate
for (const key in obj) { if (Object.hasOwn(obj, key)) { /* ... */ } }
for (const [key, value] of Object.entries(obj)) { /* ... */ }
Object.keys(obj);       // ['name', 'age']
Object.values(obj);     // ['Alice', 30]
Object.entries(obj);    // [['name','Alice'], ['age',30]]

// Merge / clone
const merged = { ...obj1, ...obj2 };
const clone = { ...obj };
const deepClone = structuredClone(obj);

// Check
Object.hasOwn(obj, 'name');       // true (preferred over hasOwnProperty)
'name' in obj;                    // true (checks prototype chain too)
Object.keys(obj).length === 0;    // check empty

// Freeze / seal
Object.freeze(obj);    // no add, delete, or modify
Object.seal(obj);      // no add or delete, modify allowed

// Spread / rest
const { name, ...rest } = obj;
```

## Functions

```js
// Declaration (hoisted)
function greet(name) { return `Hello ${name}`; }

// Expression (not hoisted)
const greet = function(name) { return `Hello ${name}`; };

// Arrow (lexical this)
const greet = (name) => `Hello ${name}`;
const add = (a, b) => a + b;
const noop = () => {};

// Default parameters
function fetch(url, { method = 'GET', headers = {} } = {}) { /* ... */ }

// Rest parameters
function sum(...nums) { return nums.reduce((a, b) => a + b, 0); }

// Closure
function counter(initial = 0) {
  let count = initial;
  return {
    increment: () => ++count,
    decrement: () => --count,
    value: () => count,
  };
}

// Higher-order
const withLogging = (fn) => (...args) => {
  console.log(`Called with`, args);
  return fn(...args);
};

// Currying
const multiply = (a) => (b) => a * b;
const double = multiply(2);

// IIFE
(() => { const private = true; /* ... */ })();

// Immediately invoked async
(async () => {
  const data = await fetchData();
  console.log(data);
})();
```

## Async / Promises

```js
// Promise basics
const promise = new Promise((resolve, reject) => {
  setTimeout(() => resolve('done'), 1000);
});

promise
  .then(result => console.log(result))
  .catch(error => console.error(error))
  .finally(() => console.log('cleanup'));

// Async/await
async function fetchUser(id) {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// Parallel
const [users, posts] = await Promise.all([
  fetch('/api/users').then(r => r.json()),
  fetch('/api/posts').then(r => r.json()),
]);

// Race — first to settle wins
const fastest = await Promise.race([
  fetch('/cdn/data').then(r => r.json()),
  fetch('/api/data').then(r => r.json()),
]);

// Timeout pattern
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms)
  );
  return Promise.race([promise, timeout]);
}

// All settled — never rejects
const results = await Promise.allSettled([tryA(), tryB(), tryC()]);
const succeeded = results.filter(r => r.status === 'fulfilled').map(r => r.value);
const failed = results.filter(r => r.status === 'rejected').map(r => r.reason);

// Promise helpers
Promise.resolve(42);        // resolved promise
Promise.reject(new Error()); // rejected promise

// Sequential execution
async function sequential(urls) {
  const results = [];
  for (const url of urls) {
    results.push(await fetch(url).then(r => r.json()));
  }
  return results;
}

// Retry pattern
async function retry(fn, attempts = 3, delay = 1000) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
}
```

## Classes

```js
class EventEmitter {
  #listeners = new Map();

  on(event, handler) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this.#listeners.get(event)?.delete(handler);
  }

  emit(event, ...args) {
    this.#listeners.get(event)?.forEach(fn => fn(...args));
  }

  once(event, handler) {
    const wrapped = (...args) => {
      handler(...args);
      this.off(event, wrapped);
    };
    this.on(event, wrapped);
  }
}

// Inheritance
class TypedEmitter extends EventEmitter {
  emit(event, detail) { super.emit(event, detail); }
}

// Static members
class MathUtils {
  static PI = 3.14159;
  static clamp(val, min, max) { return Math.min(Math.max(val, min), max); }
}

// Private fields & methods (native)
class Counter {
  #count = 0;
  get value() { return this.#count; }
  #validate(n) { if (n < 0) throw new Error('negative'); }
  increment(n = 1) { this.#validate(n); this.#count += n; }
}
```

## Modules

```js
// Named exports
export const API_URL = '/api';
export function fetchUser(id) { /* ... */ }
export class User { /* ... */ }

// Default export
export default function App() { /* ... */ }

// Named imports
import { fetchUser, User } from './api.js';

// Default import
import App from './App.js';

// Namespace import
import * as api from './api.js';

// Renamed import
import { fetchUser as getUser } from './api.js';

// Side-effect import
import './polyfills.js';

// Dynamic import
const module = await import('./heavy-module.js');

// Re-export
export { fetchUser } from './api.js';
export { default as App } from './App.js';
export * from './utils.js';
```

## Iterators & Generators

```js
// Generator
function* range(start, end) {
  for (let i = start; i < end; i++) yield i;
}
for (const n of range(0, 5)) console.log(n); // 0,1,2,3,4

// Infinite generator
function* naturalNumbers() {
  let n = 0;
  while (true) yield n++;
}
const nums = naturalNumbers();
nums.next(); // { value: 0, done: false }

// Yield delegation
function* concat(...iterables) {
  for (const iter of iterables) yield* iter;
}

// Custom iterable
class Range {
  #start; #end;
  constructor(start, end) { this.#start = start; this.#end = end; }
  *[Symbol.iterator]() {
    for (let i = this.#start; i < this.#end; i++) yield i;
  }
}
for (const n of new Range(1, 4)) console.log(n); // 1,2,3

// Async generator
async function* paginate(url) {
  let page = 1;
  while (true) {
    const res = await fetch(`${url}?page=${page++}`);
    const items = await res.json();
    if (items.length === 0) break;
    yield items;
  }
}
for await (const page of paginate('/api/items')) {
  console.log(page);
}
```

## Map, Set, WeakMap, WeakSet

```js
// Map
const map = new Map();
map.set('key', 'value');
map.set(obj, 'object key');
map.get('key');
map.has('key');
map.delete('key');
map.size;
map.clear();
for (const [key, value] of map) { /* ... */ }

// Set
const set = new Set([1, 2, 3, 2]);
set.add(4);
set.has(3);
set.delete(1);
set.size;
const unique = [...new Set(duplicates)];

// WeakMap — keys must be objects, no iteration
const cache = new WeakMap();
cache.set(element, computedValue);
cache.get(element);

// WeakSet — values must be objects
const visited = new WeakSet();
visited.add(obj);
visited.has(obj);
```

## Error Handling

```js
// Custom error
class AppError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

// Usage
try {
  const user = await fetchUser(id);
  if (!user) throw new NotFoundError('User');
} catch (err) {
  if (err instanceof AppError) {
    console.error(`[${err.code}] ${err.message}`);
  } else {
    console.error('Unexpected:', err);
  }
} finally {
  cleanup();
}

// Error.cause chain
const dbError = new Error('Connection failed', { cause: new Error('ECONNREFUSED') });
```

## Proxies & Reflect

```js
// Reactive object
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key) {
      track(target, key);
      return Reflect.get(target, key);
    },
    set(target, key, value) {
      const old = Reflect.get(target, key);
      Reflect.set(target, key, value);
      if (old !== value) trigger(target, key);
      return true;
    },
  });
}

// Validate property assignment
function validated(obj, schema) {
  return new Proxy(obj, {
    set(target, key, value) {
      if (schema[key] && !schema[key](value)) throw new TypeError(`Invalid ${key}`);
      return Reflect.set(target, key, value);
    },
  });
}
```

## RegExp

```js
// Create
const re = /pattern/flags;
const re2 = new RegExp('pattern', 'flags');

// Flags: g (global), i (case-insensitive), m (multiline), s (dotAll), u (unicode), y (sticky)

// Methods
/test/.test('hello test');             // true
'2024-01-15'.match(/(\d{4})-(\d{2})-(\d{2})/);
// ['2024-01-15', '2024', '01', '15', index: 0, ...]

'hello world'.replace(/(\w+)/g, (_, word) => word.toUpperCase());
// 'HELLO WORLD'

'a1b2c3'.replaceAll(/\d/g, '#');      // 'a#b#c#'
```

## Math & Number

```js
Math.max(...arr);
Math.min(...arr);
Math.floor(4.9);     // 4
Math.ceil(4.1);      // 5
Math.round(4.5);     // 5
Math.trunc(-4.9);    // -4
Math.random();       // 0 <= x < 1
Math.abs(-5);        // 5
Math.pow(2, 10);     // 1024
Math.sqrt(16);       // 4
Math.hypot(3, 4);    // 5
Math.sign(-42);      // -1
Math.clamp?.(5, 0, 3); // not native — use Math.min(Math.max(val, min), max)

Number.isInteger(4);        // true
Number.isFinite(Infinity);  // false
Number.isNaN(NaN);          // true
Number.parseInt('42px');    // 42
Number.parseFloat('3.14');  // 3.14
(255).toString(16);         // 'ff'
(3.14159).toFixed(2);       // '3.14'

// Random integer in range
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
```

## Date

```js
const now = new Date();
const date = new Date('2024-01-15T10:30:00Z');
const date2 = new Date(2024, 0, 15); // month is 0-indexed

date.getFullYear();
date.getMonth();       // 0-11
date.getDate();        // 1-31
date.getDay();         // 0-6 (Sun-Sat)
date.getHours();
date.getMinutes();
date.getSeconds();
date.getTime();        // unix timestamp ms

date.toISOString();    // '2024-01-15T10:30:00.000Z'
date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

// Timestamp
Date.now();            // ms since epoch

// Duration
const diffMs = end - start;
const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
```

## JSON

```js
JSON.stringify(obj);
JSON.stringify(obj, null, 2);           // pretty print
JSON.stringify(obj, ['name', 'age']);   // only these keys
JSON.stringify(obj, (key, val) => {     // replacer
  if (typeof val === 'bigint') return val.toString();
  return val;
});

JSON.parse(str);
JSON.parse(str, (key, val) => {        // reviver
  if (key.endsWith('_at')) return new Date(val);
  return val;
});
```

## Console

```js
console.log('message');
console.error('error');
console.warn('warning');
console.info('info');
console.table([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
console.group('Section');
console.groupEnd();
console.time('operation');
console.timeEnd('operation');
console.trace('trace');
console.assert(condition, 'Assertion failed');
console.clear();
```

## DOM Essentials

```js
// Select
document.getElementById('app');
document.querySelector('.card');
document.querySelectorAll('.item');  // NodeList

// Create & modify
const el = document.createElement('div');
el.textContent = 'Hello';
el.innerHTML = '<span>HTML</span>';
el.className = 'card active';
el.classList.add('visible');
el.classList.remove('hidden');
el.classList.toggle('open');
el.classList.contains('open');
el.setAttribute('data-id', '42');
el.getAttribute('data-id');
el.dataset.id;              // '42'
el.style.color = 'red';
el.style.backgroundColor = '#fff';

// Insert
parent.appendChild(child);
parent.insertBefore(newNode, refNode);
parent.append(child1, child2, 'text');
parent.prepend(header);
parent.before(sibling);
parent.after(sibling);
el.replaceWith(newEl);

// Remove
el.remove();
parent.removeChild(child);

// Events
el.addEventListener('click', handler);
el.removeEventListener('click', handler);
el.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  const { target, currentTarget } = e;
});

// Event delegation
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  handleAction(action);
});
```

## Timers

```js
// One-time
const id = setTimeout(() => console.log('done'), 1000);
clearTimeout(id);

// Repeating
const id2 = setInterval(() => console.log('tick'), 1000);
clearInterval(id2);

// requestAnimationFrame
let rafId;
function animate() {
  // render frame
  rafId = requestAnimationFrame(animate);
}
rafId = requestAnimationFrame(animate);
cancelAnimationFrame(rafId);
```

## Structured Clone & Deep Operations

```js
// Deep clone (handles Date, Map, Set, RegExp, ArrayBuffer, etc.)
const clone = structuredClone(original);

// Shallow merge
const merged = { ...a, ...b };
const mergedArr = [...a, ...b];

// Deep merge (manual)
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      target[key] = deepMerge(target[key] ?? {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
```

## Code Style Rules

- Use `const` by default. Use `let` only when reassignment is needed. Never use `var`.
- Prefer arrow functions for callbacks and short helpers.
- Use template literals over string concatenation.
- Use destructuring for cleaner parameter handling.
- Use optional chaining (`?.`) and nullish coalescing (`??`) over manual checks.
- Prefer `for...of` for arrays, `for...in` for object keys.
- Use `Object.hasOwn()` over `Object.prototype.hasOwnProperty.call()`.
- Use `structuredClone()` for deep cloning.
- Use private fields (`#field`) over underscore convention.
- Use `class` with getters/setters for encapsulation.
- Prefer `Promise.all` / `allSettled` for parallel async work.
- Handle errors with `try/catch` in async code; always catch promise rejections.
- Use `===` (strict equality) only. Never `==`.
- Use descriptive variable names. Avoid single-letter names except in short lambdas (`x`, `i`).
- Return early to reduce nesting.
