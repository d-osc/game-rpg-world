---
name: state-management
description: Elit framework state management — createState, computed, reactive, reactiveAs, text, bindValue, bindChecked, createSharedState, SharedStateManager, effect, throttle, debounce, and reactive rendering patterns
---

# State Management (Elit)

## Imports

```typescript
// All state exports from 'elit/state'
import {
    // Core state
    createState,
    computed,
    effect,

    // Reactive rendering
    reactive,
    reactiveAs,
    text,

    // Form bindings
    bindValue,
    bindChecked,

    // Shared state (client-server sync via WebSocket)
    createSharedState,
    SharedState,
    SharedStateManager,
    sharedStateManager,

    // Utilities
    throttle,
    debounce,
    batchRender,
    renderChunked,
    createVirtualList,
    lazy,
    cleanupUnused,
} from 'elit/state';
```

## Core State API

### createState

```typescript
// Signature
function createState<T>(initial: T, options?: StateOptions): State<T>;

interface StateOptions {
    throttle?: number;  // ms — throttle subscriber notifications
    deep?: boolean;     // use JSON comparison for objects/arrays
}

interface State<T> {
    value: T;                                          // getter/setter
    subscribe(fn: (value: T) => void): () => void;     // returns unsubscribe fn
    destroy(): void;                                   // cleanup listeners
}

// Primitive state
const count = createState(0);
const name = createState('');
const active = createState(false);

// Object state
const user = createState({ name: 'John', email: 'john@test.com' }, { deep: true });

// Array state
const items = createState<string[]>([]);

// Throttled state (notify subscribers at most every 100ms)
const searchQuery = createState('', { throttle: 100 });
```

### Reading & Writing State

```typescript
const count = createState(0);

// Read
console.log(count.value); // 0

// Write — triggers subscribers
count.value = 5;

// Object updates — must replace entire value (or use deep)
const user = createState({ name: 'John', age: 30 }, { deep: true });
user.value = { ...user.value, age: 31 }; // spread for immutable update

// Deep comparison prevents unnecessary notifications
const config = createState({ theme: 'dark', lang: 'en' }, { deep: true });
config.value = { ...config.value }; // same values → no notification (deep check)
```

### Subscribe & Destroy

```typescript
const count = createState(0);

// Subscribe — returns unsubscribe function
const unsubscribe = count.subscribe((value) => {
    console.log('Count changed:', value);
});

count.value = 5; // logs: "Count changed: 5"
count.value = 10; // logs: "Count changed: 10"

// Unsubscribe
unsubscribe();
count.value = 15; // nothing logged

// Destroy — clears all listeners
count.destroy();
```

## Computed State

```typescript
// Signature
function computed<T extends any[], R>(
    states: { [K in keyof T]: State<T[K]> },
    fn: (...values: T) => R
): State<R>;

// Derive from a single state
const count = createState(5);
const doubled = computed([count], (n) => n * 2);
console.log(doubled.value); // 10

// Derive from multiple states
const firstName = createState('John');
const lastName = createState('Doe');
const fullName = computed(
    [firstName, lastName],
    (first, last) => `${first} ${last}`
);
console.log(fullName.value); // "John Doe"

firstName.value = 'Jane';
console.log(fullName.value); // "Jane Doe"

// Computed with complex logic
const items = createState<Item[]>([]);
const filter = createState('all');
const filteredItems = computed(
    [items, filter],
    (list, f) => f === 'all' ? list : list.filter(item => item.status === f)
);

const totalCount = computed([items], (list) => list.length);
const activeCount = computed([items], (list) => list.filter(i => i.active).length);
```

## Reactive Rendering

### reactive

```typescript
// Signature
function reactive<T>(
    state: State<T>,
    renderFn: (value: T) => VNode | Child | Child[]
): VNode;

// Auto-updating UI element
const count = createState(0);

const view = reactive(count, (n) => (
    <div>
        <h1>Count: {n}</h1>
        <button onclick={() => count.value = n + 1}>+1</button>
        <button onclick={() => count.value = n - 1}>-1</button>
    </div>
));

// With conditional rendering
const isVisible = createState(true);
const panel = reactive(isVisible, (show) =>
    show ? <div class="panel">Visible content</div> : null
);

// Reactive list rendering
const items = createState<string[]>(['Apple', 'Banana']);
const list = reactive(items, (list) => (
    <ul>
        {list.map(item => <li>{item}</li>)}
    </ul>
));
```

### reactiveAs

```typescript
// Signature
function reactiveAs<T>(
    tagName: string,
    state: State<T>,
    renderFn: (value: T) => VNode | Child | Child[],
    props?: Props
): VNode;

// Render into a specific element type
const data = createState({ title: 'Hello', body: 'World' });
const article = reactiveAs('article', data, (d) => [
    <h2>{d.title}</h2>,
    <p>{d.body}</p>,
], { class: 'content' });

// Dynamic table rows
const rows = createState<User[]>([]);
const tbody = reactiveAs('tbody', rows, (users) =>
    users.map(u => (
        <tr>
            <td>{u.name}</td>
            <td>{u.email}</td>
        </tr>
    ))
);
```

### text

```typescript
// Signature
function text(state: State<any> | any): VNode | string;

// Reactive text node
const message = createState('Loading...');
const el = text(message); // returns reactive <span>
message.value = 'Done!';  // span auto-updates

// Non-state values pass through as strings
const plain = text('Static text'); // returns "Static text"
```

## Form Bindings

### bindValue

```typescript
// Signature
function bindValue<T extends string | number | string[]>(state: State<T>): Props;

// Text input
const username = createState('');
<input type="text" {...bindValue(username)} />;
// Equivalent to: <input type="text" value={username.value} onInput={(e) => username.value = e.target.value} />

// Number input
const age = createState(0);
<input type="number" {...bindValue(age)} />;

// Select multiple
const selectedIds = createState<string[]>([]);
<select multiple {...bindValue(selectedIds)}>
    <option value="a">A</option>
    <option value="b">B</option>
</select>;
```

### bindChecked

```typescript
// Signature
function bindChecked(state: State<boolean>): Props;

// Checkbox
const agreed = createState(false);
<label>
    <input type="checkbox" {...bindChecked(agreed)} />
    I agree to terms
</label>;

// Radio buttons (use separate states)
const mode = createState('light');
<label><input type="radio" name="mode" value="light" checked={mode.value === 'light'} onchange={() => mode.value = 'light'} /> Light</label>
<label><input type="radio" name="mode" value="dark" checked={mode.value === 'dark'} onchange={() => mode.value = 'dark'} /> Dark</label>
```

### Complete Form Example

```typescript
const formData = createState({
    name: '',
    email: '',
    role: 'member',
    active: true,
});

const nameState = computed([formData], (d) => d.name);
const emailState = computed([formData], (d) => d.email);
const activeState = computed([formData], (d) => d.active);

const form = (
    <form>
        <input type="text" placeholder="Name" {...bindValue(nameState)} />
        <input type="email" placeholder="Email" {...bindValue(emailState)} />
        <label>
            <input type="checkbox" {...bindChecked(activeState)} />
            Active
        </label>
    </form>
);
```

## Shared State (Client-Server Sync)

### createSharedState

```typescript
// Signature
function createSharedState<T>(
    key: string,
    defaultValue: T,
    wsUrl?: string
): SharedState<T>;

class SharedState<T> {
    readonly key: string;
    get value(): T;
    set value(newValue: T);
    get state(): State<T>;           // underlying local State
    onChange(callback: (newValue: T, oldValue: T) => void): () => void;
    update(updater: (current: T) => T): void;
    disconnect(): void;              // close WebSocket
    destroy(): void;                 // disconnect + destroy local state
}

// Create shared state — syncs with server via WebSocket
const counter = createSharedState('counter', 0);

// Read/write works like normal state
console.log(counter.value); // 0
counter.value = 5;          // syncs to server → broadcasts to all clients

// Update with function
counter.update(n => n + 1);

// Listen for changes (from any client or server)
const unsub = counter.onChange((newValue, oldValue) => {
    console.log(`Counter: ${oldValue} → ${newValue}`);
});

// Access underlying State for reactive rendering
const view = reactive(counter.state, (n) => <span>{n}</span>);

// Custom WebSocket URL
const gameState = createSharedState('game:board', [], 'wss://myserver.com/ws');

// Cleanup
counter.destroy();
```

### SharedStateManager

```typescript
// Singleton instance for managing multiple shared states
const manager = sharedStateManager;

// Create (or get existing) shared state
const counter = manager.create('counter', 0);
const users = manager.create('users', [] as User[]);

// Get existing
const existing = manager.get<User[]>('users');

// Delete
manager.delete('counter');

// Clear all
manager.clear();

// You can also create a new manager instance
const myManager = new SharedStateManager();
```

### Server-Side Shared State

```typescript
// Server creates shared states that clients can subscribe to
import { devServer } from 'elit/dev';

// In dev server config or API handler
server.state.create('counter', {
    initial: 0,
    persist: true,
    validate: (v) => typeof v === 'number' && v >= 0,
});

server.state.create('activeUsers', {
    initial: [] as string[],
});

// Get and modify from server API
server.api.get('/api/increment', (ctx) => {
    const counter = server.state.get('counter');
    counter.update(n => n + 1);
    ctx.res.json({ count: counter.value });
});

// Subscribe to changes on server
const counter = server.state.get<number>('counter');
counter.onChange((newValue, oldValue) => {
    console.log(`Server counter: ${oldValue} → ${newValue}`);
});
```

## Utilities

### throttle & debounce

```typescript
// Throttle — fire at most once per delay ms
const throttledSearch = throttle((query: string) => {
    console.log('Searching:', query);
}, 300);

// Debounce — fire after delay ms of no calls
const debouncedSave = debounce((data: any) => {
    console.log('Saving:', data);
}, 500);

// Use with state
const searchQuery = createState('');
searchQuery.subscribe(throttledSearch);

// Use with DOM events
<input
    type="text"
    onInput={debounce((e) => {
        searchQuery.value = e.target.value;
    }, 200)}
/>;
```

### batchRender

```typescript
// Efficiently render many VNodes at once (uses DocumentFragment + chunking)
const items = Array.from({ length: 5000 }, (_, i) => (
    <div class="item">Item {i}</div>
));
batchRender('#container', items);
// Uses requestAnimationFrame chunking for > 3000 nodes
```

### renderChunked

```typescript
// Render with progress callback
renderChunked(
    '#container',
    vNodes,
    5000,  // chunk size
    (current, total) => {
        console.log(`Progress: ${current}/${total}`);
    }
);
```

### createVirtualList

```typescript
// Virtual scrolling for large lists — only renders visible items
const controller = createVirtualList(
    document.getElementById('list')!,
    largeArray,                              // data items
    (item, index) => <div>{item.name}</div>, // render function
    50,   // item height in px
    5     // buffer items above/below viewport
);

// Cleanup
controller.destroy();
```

### lazy

```typescript
// Lazy load a component
const HeavyChart = lazy(async () => {
    const module = await import('./components/Chart');
    return module.Chart;
});

// First call triggers load, subsequent calls use cached component
const chart = await HeavyChart({ data: myData });
```

### cleanupUnused

```typescript
// Remove orphaned reactive DOM elements
const removed = cleanupUnused(document.getElementById('app')!);
console.log(`Cleaned up ${removed} unused elements`);
```

## Patterns

### Counter Component

```typescript
import { createState, reactive } from 'elit/state';

function Counter() {
    const count = createState(0);
    const label = computed([count], (n) => n === 0 ? 'Zero' : String(n));

    return (
        <div class="counter">
            <h2>Count: {text(label)}</h2>
            <button onclick={() => count.value++}>+</button>
            <button onclick={() => count.value--}>-</button>
            <button onclick={() => count.value = 0}>Reset</button>
        </div>
    );
}
```

### Todo List

```typescript
import { createState, computed, reactive, text } from 'elit/state';

interface Todo { id: number; text: string; done: boolean; }

function TodoApp() {
    const todos = createState<Todo[]>([]);
    const input = createState('');
    const filter = createState<'all' | 'active' | 'done'>('all');

    const filtered = computed([todos, filter], (list, f) => {
        if (f === 'active') return list.filter(t => !t.done);
        if (f === 'done') return list.filter(t => t.done);
        return list;
    });

    const remaining = computed([todos], (list) =>
        list.filter(t => !t.done).length
    );

    function addTodo() {
        const val = input.value.trim();
        if (!val) return;
        todos.value = [...todos.value, { id: Date.now(), text: val, done: false }];
        input.value = '';
    }

    function toggle(id: number) {
        todos.value = todos.value.map(t =>
            t.id === id ? { ...t, done: !t.done } : t
        );
    }

    function remove(id: number) {
        todos.value = todos.value.filter(t => t.id !== id);
    }

    return (
        <div class="todo-app">
            <form onsubmit={(e) => { e.preventDefault(); addTodo(); }}>
                <input type="text" {...bindValue(input)} placeholder="Add todo..." />
                <button type="submit">Add</button>
            </form>

            <div class="filters">
                <button onclick={() => filter.value = 'all'}>All</button>
                <button onclick={() => filter.value = 'active'}>Active</button>
                <button onclick={() => filter.value = 'done'}>Done</button>
            </div>

            {reactive(filtered, (items) => items.map(t => (
                <div class="todo-item">
                    <input type="checkbox" checked={t.done} onchange={() => toggle(t.id)} />
                    <span style={t.done ? 'text-decoration:line-through' : ''}>{t.text}</span>
                    <button onclick={() => remove(t.id)}>x</button>
                </div>
            )))}

            <p>{text(computed([remaining], (n) => `${n} item${n !== 1 ? 's' : ''} left`))}</p>
        </div>
    );
}
```

### Real-Time Collaboration (Shared State)

```typescript
import { createSharedState, reactive, text } from 'elit/state';

// Shared document — all clients see updates in real time
const document_ = createSharedState('doc:1', {
    title: 'Untitled',
    content: '',
    lastEditBy: '',
});

// UI
const editor = (
    <div class="editor">
        <input type="text" {...bindValue(
            computed([document_.state], (d) => d.title)
        )} />

        <textarea
            {...bindValue(
                computed([document_.state], (d) => d.content)
            )}
        />

        {reactive(document_.state, (doc) => (
            <small>Last edited by: {doc.lastEditBy}</small>
        ))}
    </div>
);

// Listen for remote changes
document_.onChange((newDoc, oldDoc) => {
    console.log('Document updated:', newDoc.lastEditBy);
});
```

### Search with Debounce

```typescript
import { createState, reactive, debounce, text } from 'elit/state';

const query = createState('');
const results = createState<string[]>([]);
const loading = createState(false);

const search = debounce(async (q: string) => {
    if (!q.trim()) { results.value = []; return; }
    loading.value = true;
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    results.value = await res.json();
    loading.value = false;
}, 300);

query.subscribe((q) => search(q));

const searchView = (
    <div>
        <input
            type="search"
            placeholder="Search..."
            onInput={(e) => { query.value = e.target.value; }}
        />
        {reactive(loading, (isLoading) =>
            isLoading ? <div class="spinner" /> : null
        )}
        {reactive(results, (items) => items.map(item => (
            <div class="result">{item}</div>
        )))}
    </div>
);
```

## Code Style Rules

- Use `createState` for all mutable reactive data — never mutate DOM directly.
- Always call `destroy()` on states when the component unmounts — prevent memory leaks.
- Use `computed` for derived values — never recalculate in render functions.
- Use `reactive` to wrap state-dependent VNodes — it handles DOM updates via requestAnimationFrame.
- Use `bindValue` / `bindChecked` for two-way form binding — don't wire `onInput` manually.
- Use `{ deep: true }` option when state holds objects/arrays that change properties internally.
- Use `{ throttle: N }` option for high-frequency updates (mouse, scroll, resize).
- Use `createSharedState` for data that must sync across client and server in real time.
- Use `throttle` for rate-limited callbacks, `debounce` for delay-until-idle callbacks.
- Use `batchRender` or `renderChunked` for rendering 1000+ elements at once.
- Use `createVirtualList` for lists with 10,000+ items — only visible rows render.
- Use `lazy` for code-splitting heavy components (charts, editors, maps).
- Call `cleanupUnused` periodically in long-lived apps to free orphaned reactive DOM nodes.
- Never read `.value` inside `reactive` render functions — the value is passed as argument.
- Prefer immutable state updates (`[...arr, newItem]` not `arr.push(newItem)`) for change detection.
