---
name: typescript
description: Write, refactor, and debug TypeScript code — type system, generics, utility types, patterns, configuration, and best practices.
---

You are an expert TypeScript developer. When the user asks for help with TypeScript, follow these instructions.

## Type System Essentials

### Primitives & Literal Types

```ts
// Primitives
let str: string = 'hello';
let num: number = 42;
let bool: boolean = true;
let n: null = null;
let u: undefined = undefined;
let big: bigint = 100n;
let sym: symbol = Symbol('id');

// Literal types
type Direction = 'left' | 'right' | 'up' | 'down';
type StatusCode = 200 | 404 | 500;
type Truthy = true;

// Template literal types
type EventName = `on${Capitalize<string>}`;
type CSSValue = `${number}${'px' | 'rem' | 'em' | '%'}`;
```

### Objects, Interfaces & Types

```ts
// Interface — extendable, declarable multiple times (merged)
interface User {
  id: string;
  name: string;
  email?: string;                // optional
  readonly createdAt: Date;      // immutable at type level
}
interface Admin extends User {
  role: 'admin';
  permissions: string[];
}

// Type alias — unions, intersections, computed types
type Status = 'active' | 'inactive';
type Nullable<T> = T | null;
type UserOrAdmin = User | Admin;
type FullUser = User & { department: string };

// Index signatures
interface Dictionary<T> {
  [key: string]: T;
}

// Record utility
type UserRole = Record<string, string[]>;
```

### Functions

```ts
// Basic
function greet(name: string): string { return `Hello ${name}`; }

// Arrow
const add = (a: number, b: number): number => a + b;

// Optional & default params
function build(label: string, size?: number, count = 1): string { /* ... */ }

// Rest params
function sum(...nums: number[]): number { return nums.reduce((a, b) => a + b, 0); }

// Overloads
function parse(input: string): number;
function parse(input: number): string;
function parse(input: string | number): string | number { /* ... */ }

// Function type
type Callback = (data: unknown, error?: Error) => void;
type AsyncHandler = (req: Request) => Promise<Response>;

// Generic functions
function identity<T>(value: T): T { return value; }
function first<T>(arr: T[]): T | undefined { return arr[0]; }
function merge<A, B>(a: A, b: B): A & B { return { ...a, ...b }; }
```

### Generics

```ts
// Constrained generics
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] { return obj[key]; }

// Generic with default
interface PaginatedResult<T = unknown> {
  data: T[];
  total: number;
  page: number;
}

// Multiple constraints
function clone<T extends object & { id: string }>(item: T): T { /* ... */ }

// Generic classes
class Store<T> {
  private items: T[] = [];
  add(item: T): void { this.items.push(item); }
  getAll(): T[] { return [...this.items]; }
  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }
}

// Conditional types
type IsString<T> = T extends string ? true : false;
type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type FunctionReturn<T> = T extends (...args: any[]) => infer R ? R : never;
```

### Union & Intersection Patterns

```ts
// Discriminated unions
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handle(result: Result<number>) {
  if (result.success) {
    console.log(result.data); // narrowed to number
  } else {
    console.error(result.error);
  }
}

// Exhaustive check
type Shape = 'circle' | 'square' | 'triangle';
function area(shape: Shape): number {
  switch (shape) {
    case 'circle': return Math.PI;
    case 'square': return 1;
    case 'triangle': return 0.5;
    default: const _exhaustive: never = shape; return _exhaustive;
  }
}

// Type narrowing
function process(value: string | number) {
  if (typeof value === 'string') { /* string */ }
  if (typeof value === 'number') { /* number */ }
}

function handleElement(el: HTMLElement | SVGElement) {
  if (el instanceof HTMLElement) { /* HTML */ }
}

// 'in' narrowing
interface Fish { swim(): void }
interface Bird { fly(): void }
function move(animal: Fish | Bird) {
  if ('swim' in animal) { animal.swim(); }
}
```

## Utility Types

```ts
// Partial / Required / Readonly
type PartialUser = Partial<User>;           // all fields optional
type RequiredUser = Required<User>;         // all fields required
type ReadonlyUser = Readonly<User>;         // all fields readonly

// Pick / Omit
type UserPreview = Pick<User, 'id' | 'name'>;
type UserWithoutId = Omit<User, 'id'>;

// Record
type UserMap = Record<string, User>;

// Exclude / Extract
type NonNullable<T> = Exclude<T, null | undefined>;
type StringOrNumber = Extract<string | number | boolean, string | number>;

// NonNullable
type Definite<T> = NonNullable<T>;

// ReturnType / Parameters / ConstructorParameters
type FnReturn = ReturnType<() => string>;                    // string
type FnParams = Parameters<(a: number, b: string) => void>;  // [number, string]
type CtorParams = ConstructorParameters<Date>;

// Awaited
type Unwrapped = Awaited<Promise<Promise<string>>>; // string

// NoInfer (TS 5.4+)
function createFSM<TState extends string>(initial: NoInfer<TState>, states: TState[]): void;

// satisfies operator (TS 4.9+)
const palette = {
  red: [255, 0, 0],
  green: '#00ff00',
  blue: [0, 0, 255],
} satisfies Record<string, string | number[]>;
// palette.green is typed as string, not string | number[]
```

## Advanced Patterns

### Mapped Types

```ts
// Transform all properties
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

// Remove readonly
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// Make specific keys optional
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Make specific keys required
type Require<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// Deep partial
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// Deep readonly
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};
```

### Conditional Type Patterns

```ts
// Infer from function
type FirstArg<T> = T extends (first: infer F, ...rest: any[]) => any ? F : never;

// Extract promise value
type PromiseValue<T> = T extends Promise<infer V> ? V : T;

// Tuple manipulation
type Head<T extends any[]> = T extends [infer H, ...any[]] ? H : never;
type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never;
type Last<T extends any[]> = T extends [...any[], infer L] ? L : never;

// String manipulation
type Trim<S extends string> = S extends ` ${infer Rest}` | `${infer Rest} ` ? Trim<Rest> : S;
```

### Type Guards

```ts
// Custom type guard
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Asserts
function assertDefined<T>(value: T | undefined | null, msg?: string): asserts value is T {
  if (value == null) throw new Error(msg ?? 'Expected defined value');
}

// Assertion function
function assertString(value: unknown): asserts value is string {
  if (typeof value !== 'string') throw new TypeError('Expected string');
}

// Using in filter
const items: (string | null)[] = ['a', null, 'b'];
const strings = items.filter((x): x is string => x !== null);
```

### const Assertions & Enums

```ts
// const assertion
const config = {
  port: 3000,
  host: 'localhost',
} as const;
// type: { readonly port: 3000; readonly host: "localhost" }

// Enum
enum Direction { Up, Down, Left, Right }
enum HttpStatus { OK = 200, NotFound = 404 }

// Prefer union types over enums for simplicity
type Status = 'pending' | 'active' | 'done';
```

### Decorators (Stage 3 — TS 5.0+)

```ts
function logged(originalMethod: any, context: ClassMethodDecoratorContext) {
  function replacementMethod(this: any, ...args: any[]) {
    console.log(`Calling ${String(context.name)} with ${args}`);
    return originalMethod.call(this, ...args);
  }
  return replacementMethod;
}

class Calculator {
  @logged
  add(a: number, b: number) { return a + b; }
}
```

### Namespaces & Modules

```ts
// Namespace
namespace Validators {
  export function isEmail(value: string): boolean { return /@/.test(value); }
  export function isUrl(value: string): boolean { return /^https?:/.test(value); }
}

// Module augmentation
declare module 'express' {
  interface Request {
    userId?: string;
  }
}

// Declaration file (.d.ts)
declare function myLib(options: MyLib.Options): MyLib.Instance;
declare namespace MyLib {
  interface Options { debug?: boolean; }
  interface Instance { start(): void; stop(): void; }
}
```

## Classes

```ts
class EventEmitter<T extends Record<string, any[]>> {
  private listeners = new Map<keyof T, Set<(...args: any[]) => void>>();

  on<K extends keyof T>(event: K, handler: (...args: T[K]) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    this.listeners.get(event)?.forEach(fn => fn(...args));
  }
}

// Usage
const bus = new EventEmitter<{
  click: [x: number, y: number];
  data: [payload: unknown];
}>();
bus.on('click', (x, y) => console.log(x, y));
bus.emit('click', 10, 20);
```

### Abstract Class

```ts
abstract class Animal {
  constructor(public name: string) {}
  abstract speak(): string;
  move(distance: number): string { return `${this.name} moved ${distance}m`; }
}

class Dog extends Animal {
  speak(): string { return `${this.name} barks`; }
}
```

## Error Handling

```ts
// Custom errors
class AppError extends Error {
  constructor(message: string, public code: string, public statusCode: number) {
    super(message);
    this.name = this.constructor.name;
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

// Type-safe error catching
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

try {
  // ...
} catch (err) {
  if (isError(err)) console.error(err.message);
}
```

## Async Patterns

```ts
// Async/await
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new AppError('Fetch failed', 'FETCH_ERROR', res.status);
  return res.json();
}

// Promise utilities
const [users, posts] = await Promise.all([fetchUsers(), fetchPosts()]);
const fastest = await Promise.race([fetchFromCDN(), fetchFromAPI()]);
const results = await Promise.allSettled([tryA(), tryB()]);
const fulfilled = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');

// Async generator
async function* paginate(url: string): AsyncGenerator<Item[]> {
  let page = 1;
  while (true) {
    const items = await fetchPage(url, page++);
    if (items.length === 0) break;
    yield items;
  }
}

// Type-safe event emitter with async
type Events = { data: [string]; error: [Error] };
async function processAsync(events: EventEmitter<Events>) {
  for await (const chunk of paginate('/api/items')) {
    events.emit('data', JSON.stringify(chunk));
  }
}
```

## Iterators & Generators

```ts
function* range(start: number, end: number): Generator<number> {
  for (let i = start; i < end; i++) yield i;
}

function* map<T, R>(iter: Iterable<T>, fn: (item: T) => R): Generator<R> {
  for (const item of iter) yield fn(item);
}

// Iterable class
class NumberRange implements Iterable<number> {
  constructor(private start: number, private end: number) {}
  *[Symbol.iterator](): Generator<number> {
    for (let i = this.start; i < this.end; i++) yield i;
  }
}
```

## tsconfig Best Practices

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

Key strict flags:
- `strict: true` — enables all strict checks
- `noUncheckedIndexedAccess` — array/object index returns `T | undefined`
- `exactOptionalPropertyTypes` — `undefined` is not assignable to optional props

## Code Style Rules

- Use `interface` for object shapes that may be extended. Use `type` for unions, intersections, and computed types.
- Prefer `unknown` over `any`. Narrow with type guards.
- Use `as const` for literal objects and arrays that should be inferred narrowly.
- Use `satisfies` to validate a value against a type without widening.
- Use branded types for domain IDs: `type UserId = string & { readonly __brand: unique symbol }`.
- Use `readonly` arrays when contents shouldn't mutate: `readonly number[]`.
- Use `ReadonlyMap` / `ReadonlySet` for immutable collections.
- Avoid non-null assertion (`!`). Use type guards or default values instead.
- Use `enum` only when you need runtime reverse mapping. Prefer union types otherwise.
- Use template literal types for string patterns: `` `rgb(${number}, ${number}, ${number})` ``.
- Use `never` for exhaustive checks in switch statements.
- Use `infer` to extract types from generic structures.
- Export types alongside values they relate to.
- Use `/** JSDoc */` for public API documentation.
