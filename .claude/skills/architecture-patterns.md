---
name: architecture-patterns
description: Apply software architecture patterns — creational, structural, behavioral design patterns, SOLID principles, event-driven, CQRS, event sourcing, repository, unit of work, and layered architecture with practical TypeScript examples.
---

You are an expert software architect. When the user asks for help with architecture or design patterns, follow these instructions.

## SOLID Principles

### Single Responsibility (SRP)
```
A class/module should have one reason to change.

BAD — User class handles data, validation, AND email:
class User {
  save() { /* DB */ }
  validate() { /* rules */ }
  sendWelcomeEmail() { /* email */ }
}

GOOD — Split responsibilities:
class UserRepository { save(user) { /* DB */ } }
class UserValidator { validate(user) { /* rules */ } }
class EmailService { sendWelcome(user) { /* email */ } }
```

### Open/Closed (OCP)
```
Open for extension, closed for modification.

BAD — modify switch statement every time:
function calculatePrice(type) {
  if (type === 'regular') return price;
  if (type === 'premium') return price * 0.8;
  if (type === 'vip') return price * 0.6;
}

GOOD — extend via strategy:
const pricing = {
  regular: (p) => p,
  premium: (p) => p * 0.8,
  vip: (p) => p * 0.6,
};
function calculatePrice(tier, price) {
  return pricing[tier](price);
}
```

### Liskov Substitution (LSP)
```
Subtypes must be substitutable for their base types.

BAD — Square violates Rectangle contract:
class Rectangle {
  setWidth(w) { this.w = w; }
  setHeight(h) { this.h = h; }
  area() { return this.w * this.h; }
}
class Square extends Rectangle {
  setWidth(w) { this.w = this.h = w; }  // changes height too!
}

GOOD — separate abstractions:
class Shape { area() {} }
class Rectangle extends Shape { /* w, h independent */ }
class Square extends Shape { /* single side */ }
```

### Interface Segregation (ISP)
```
Clients should not depend on interfaces they don't use.

BAD — fat interface:
interface Worker { work(); eat(); sleep(); }
class Robot implements Worker {
  eat() { throw new Error('Robots do not eat'); }
}

GOOD — segregated:
interface Workable { work(); }
interface Eatable { eat(); }
class Robot implements Workable { work() { /* ... */ } }
class Human implements Workable, Eatable { work() {} eat() {} }
```

### Dependency Inversion (DIP)
```
Depend on abstractions, not concretions.

BAD — high level depends on low level:
class OrderService {
  private repo = new PostgresOrderRepo();   // tightly coupled
}

GOOD — depend on abstraction:
interface OrderRepository {
  findById(id: string): Promise<Order>;
  save(order: Order): Promise<void>;
}
class OrderService {
  constructor(private repo: OrderRepository) {}
}
// Inject: new OrderService(new PostgresOrderRepo())
// Test:   new OrderService(new MockOrderRepo())
```

## Creational Patterns

### Factory Method
```ts
// Delegate creation to subclasses or a dedicated function
interface Notification {
  send(message: string): Promise<void>;
}

class EmailNotification implements Notification {
  async send(message: string) { /* send email */ }
}

class SMSNotification implements Notification {
  async send(message: string) { /* send SMS */ }
}

function createNotification(type: 'email' | 'sms'): Notification {
  switch (type) {
    case 'email': return new EmailNotification();
    case 'sms':   return new SMSNotification();
  }
}

const notifier = createNotification('email');
await notifier.send('Hello');
```

### Abstract Factory
```ts
// Family of related objects
interface UIComponents {
  button(): Button;
  input(): Input;
  modal(): Modal;
}

class LightTheme implements UIComponents {
  button() { return new LightButton(); }
  input()  { return new LightInput(); }
  modal()  { return new LightModal(); }
}

class DarkTheme implements UIComponents {
  button() { return new DarkButton(); }
  input()  { return new DarkInput(); }
  modal()  { return new DarkModal(); }
}

function createTheme(mode: 'light' | 'dark'): UIComponents {
  return mode === 'light' ? new LightTheme() : new DarkTheme();
}
```

### Builder
```ts
// Step-by-step construction of complex objects
class QueryBuilder {
  private parts: string[] = [];
  private params: any[] = [];

  select(columns: string): this {
    this.parts.push(`SELECT ${columns}`);
    return this;
  }

  from(table: string): this {
    this.parts.push(`FROM ${table}`);
    return this;
  }

  where(condition: string, ...params: any[]): this {
    this.parts.push(`WHERE ${condition}`);
    this.params.push(...params);
    return this;
  }

  orderBy(column: string, dir: 'ASC' | 'DESC' = 'ASC'): this {
    this.parts.push(`ORDER BY ${column} ${dir}`);
    return this;
  }

  limit(n: number): this {
    this.parts.push(`LIMIT ${n}`);
    return this;
  }

  build(): { sql: string; params: any[] } {
    return { sql: this.parts.join(' '), params: this.params };
  }
}

const { sql, params } = new QueryBuilder()
  .select('*')
  .from('users')
  .where('active = ?', true)
  .orderBy('created_at', 'DESC')
  .limit(10)
  .build();
```

### Singleton
```ts
// Single shared instance (use sparingly — prefer DI)
class Database {
  private static instance: Database | null = null;

  private constructor(private url: string) {}

  static getInstance(url?: string): Database {
    if (!Database.instance && url) {
      Database.instance = new Database(url);
    }
    return Database.instance!;
  }
}

const db = Database.getInstance('postgres://localhost/mydb');
```

### Prototype
```ts
// Clone existing objects instead of creating new
interface Cloneable<T> {
  clone(): T;
}

class Template implements Cloneable<Template> {
  constructor(
    public name: string,
    public layout: Layout,
    public styles: Styles,
  ) {}

  clone(): Template {
    return new Template(
      this.name,
      structuredClone(this.layout),
      structuredClone(this.styles),
    );
  }
}

const base = new Template('base', defaultLayout, defaultStyles);
const custom = base.clone();
custom.name = 'custom';
```

## Structural Patterns

### Adapter
```ts
// Convert one interface to another
interface HttpClient {
  get(url: string): Promise<Response>;
}

class FetchAdapter implements HttpClient {
  async get(url: string): Promise<Response> {
    const res = await fetch(url);
    return { data: res.json(), status: res.status };
  }
}

class LegacyApiAdapter implements HttpClient {
  constructor(private legacy: LegacyApi) {}
  async get(url: string): Promise<Response> {
    const result = await thislegacy.fetch(url);
    return { data: JSON.parse(result.body), status: result.code };
  }
}
```

### Decorator
```ts
// Add behavior without modifying the original
interface Logger {
  log(message: string): void;
}

class ConsoleLogger implements Logger {
  log(message: string) { console.log(message); }
}

class TimestampLogger implements Logger {
  constructor(private logger: Logger) {}
  log(message: string) {
    this.logger.log(`[${new Date().toISOString()}] ${message}`);
  }
}

class JsonLogger implements Logger {
  constructor(private logger: Logger) {}
  log(message: string) {
    this.logger.log(JSON.stringify({ message, timestamp: Date.now() }));
  }
}

// Stack decorators
const logger = new JsonLogger(new TimestampLogger(new ConsoleLogger()));
```

### Facade
```ts
// Simplified interface to a complex subsystem
class OrderFacade {
  constructor(
    private orderRepo: OrderRepository,
    private payment: PaymentService,
    private inventory: InventoryService,
    private notification: NotificationService,
  ) {}

  async placeOrder(items: Item[], userId: string): Promise<Order> {
    // Complex workflow simplified behind one method
    const reserved = await this.inventory.reserve(items);
    const order = await this.orderRepo.create({ items, userId });
    await this.payment.charge(order.total, userId);
    await this.inventory.confirm(reserved.id);
    await this.notification.sendOrderConfirmation(order);
    return order;
  }
}

// Usage — consumer doesn't know about reserve/confirm/notify
const order = await facade.placeOrder(items, 'user_123');
```

### Proxy
```ts
// Control access to an object
class CachedApiProxy {
  private cache = new Map<string, { data: any; expiry: number }>();
  private ttl = 60_000; // 1 minute

  constructor(private api: ApiClient) {}

  async get<T>(url: string): Promise<T> {
    const cached = this.cache.get(url);
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T;
    }

    const data = await this.api.get<T>(url);
    this.cache.set(url, { data, expiry: Date.now() + this.ttl });
    return data;
  }

  invalidate(url: string) {
    this.cache.delete(url);
  }
}
```

### Composite
```ts
// Treat individual and group uniformly
interface FileSystemItem {
  name: string;
  size(): number;
  print(indent?: string): void;
}

class File implements FileSystemItem {
  constructor(public name: string, private bytes: number) {}
  size() { return this.bytes; }
  print(indent = '') { console.log(`${indent}- ${this.name} (${this.bytes}B)`); }
}

class Folder implements FileSystemItem {
  private children: FileSystemItem[] = [];
  constructor(public name: string) {}

  add(item: FileSystemItem) { this.children.push(item); return this; }

  size() { return this.children.reduce((sum, c) => sum + c.size(), 0); }

  print(indent = '') {
    console.log(`${indent}+ ${this.name}/`);
    this.children.forEach(c => c.print(indent + '  '));
  }
}

const root = new Folder('src')
  .add(new Folder('components').add(new File('app.tsx', 2400)))
  .add(new File('main.ts', 800));

root.print();     // prints tree
console.log(root.size());  // 3200
```

## Behavioral Patterns

### Strategy
```ts
// Swap algorithms at runtime
interface SortStrategy {
  sort<T>(items: T[], compare: (a: T, b: T) => number): T[];
}

class QuickSort implements SortStrategy {
  sort<T>(items: T[], compare: (a: T, b: T) => number): T[] {
    if (items.length <= 1) return items;
    const pivot = items[0];
    const left = items.slice(1).filter(i => compare(i, pivot) < 0);
    const right = items.slice(1).filter(i => compare(i, pivot) >= 0);
    return [...this.sort(left, compare), pivot, ...this.sort(right, compare)];
  }
}

class NaturalSort implements SortStrategy {
  sort<T>(items: T[], compare: (a: T, b: T) => number): T[] {
    return [...items].sort(compare);
  }
}

class Sorter<T> {
  constructor(private strategy: SortStrategy) {}

  setStrategy(strategy: SortStrategy) { this.strategy = strategy; }

  sort(items: T[], compare: (a: T, b: T) => number): T[] {
    return this.strategy.sort(items, compare);
  }
}
```

### Observer
```ts
// Publish-subscribe for state changes
type Listener<T> = (data: T) => void;

class Observable<T> {
  private listeners = new Set<Listener<T>>();

  subscribe(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  next(data: T): void {
    this.listeners.forEach(fn => fn(data));
  }
}

const searchTerm = new Observable<string>();
const unsub = searchTerm.subscribe(term => fetchResults(term));
searchTerm.next('hello');
unsub(); // stop listening
```

### Command
```ts
// Encapsulate actions as objects (undo/redo, queue, log)
interface Command {
  execute(): void;
  undo(): void;
}

class AddTextCommand implements Command {
  constructor(
    private editor: Editor,
    private position: number,
    private text: string,
  ) {}

  execute() { this.editor.insert(this.position, this.text); }
  undo() { this.editor.delete(this.position, this.text.length); }
}

class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  execute(command: Command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
  }

  undo() {
    const command = this.undoStack.pop();
    if (command) { command.undo(); this.redoStack.push(command); }
  }

  redo() {
    const command = this.redoStack.pop();
    if (command) { command.execute(); this.undoStack.push(command); }
  }
}
```

### Iterator
```ts
// Traverse a collection without exposing its structure
class TreeNode<T> {
  constructor(public value: T, public children: TreeNode<T>[] = []) {}

  *[Symbol.iterator](): Generator<T> {
    yield this.value;
    for (const child of this.children) {
      yield* child;
    }
  }
}

const tree = new TreeNode('root', [
  new TreeNode('a', [new TreeNode('a1'), new TreeNode('a2')]),
  new TreeNode('b'),
]);

for (const value of tree) console.log(value);
// root, a, a1, a2, b
```

### State
```ts
// Change behavior when internal state changes
interface OrderState {
  cancel(order: Order): void;
  pay(order: Order): void;
  ship(order: Order): void;
}

class PendingState implements OrderState {
  cancel(order: Order) { order.setState(new CancelledState()); }
  pay(order: Order) { order.setState(new PaidState()); }
  ship() { throw new Error('Cannot ship unpaid order'); }
}

class PaidState implements OrderState {
  cancel(order: Order) { order.refund(); order.setState(new CancelledState()); }
  pay() { throw new Error('Already paid'); }
  ship(order: Order) { order.setState(new ShippedState()); }
}

class ShippedState implements OrderState {
  cancel() { throw new Error('Cannot cancel shipped order'); }
  pay() { throw new Error('Already paid'); }
  ship() { throw new Error('Already shipped'); }
}

class Order {
  private state: OrderState = new PendingState();

  setState(state: OrderState) { this.state = state; }
  cancel() { this.state.cancel(this); }
  pay()    { this.state.pay(this); }
  ship()   { this.state.ship(this); }
}
```

### Middleware / Chain of Responsibility
```ts
// Pass request through a chain of handlers
type Middleware = (ctx: Context, next: () => void) => void;

function compose(middlewares: Middleware[]): Middleware {
  return (ctx, next) => {
    let index = -1;
    function dispatch(i: number) {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      const fn = i < middlewares.length ? middlewares[i] : next;
      if (!fn) return;
      fn(ctx, () => dispatch(i + 1));
    }
    dispatch(0);
  };
}

// Usage
const app = compose([
  (ctx, next) => { ctx.log = []; ctx.log.push('auth'); next(); },
  (ctx, next) => { ctx.log.push('cors'); next(); },
  (ctx, next) => { ctx.log.push('handler'); ctx.body = 'ok'; },
]);

app({} as Context, () => {});
// ctx.log = ['auth', 'cors', 'handler']
```

### Template Method
```ts
// Define algorithm skeleton, let subclasses override steps
abstract class DataImporter {
  async import(filePath: string): Promise<number> {
    const raw = await this.read(filePath);
    const parsed = this.parse(raw);
    const validated = this.validate(parsed);
    const count = await this.save(validated);
    this.cleanup(filePath);
    return count;
  }

  protected abstract read(path: string): Promise<string>;
  protected abstract parse(raw: string): any[];
  protected validate(items: any[]): any[] { return items.filter(Boolean); }
  protected abstract save(items: any[]): Promise<number>;
  protected cleanup(path: string) { /* optional override */ }
}

class CsvImporter extends DataImporter {
  protected async read(path: string) { return fs.readFile(path, 'utf-8'); }
  protected parse(raw: string) { return raw.split('\n').map(line => parseCsvLine(line)); }
  protected async save(items: any[]) { await db.batchInsert('products', items); return items.length; }
}
```

## Architectural Patterns

### Repository Pattern
```ts
// Abstract data access behind a collection-like interface
interface UserRepository {
  findById(id: string): Promise<User | null>;
  findMany(filter: UserFilter): Promise<User[]>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}

class PostgresUserRepository implements UserRepository {
  constructor(private db: Database) {}

  async findById(id: string) {
    const row = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
    return row ? this.toDomain(row) : null;
  }

  async findMany(filter: UserFilter) {
    const { sql, params } = this.buildQuery(filter);
    const rows = await this.db.query(sql, params);
    return rows.map(this.toDomain);
  }

  async save(user: User) {
    await this.db.query(
      `INSERT INTO users (id, name, email) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = $2, email = $3`,
      [user.id, user.name, user.email]
    );
  }

  async delete(id: string) {
    await this.db.query('DELETE FROM users WHERE id = $1', [id]);
  }

  private toDomain(row: any): User {
    return new User(row.id, row.name, row.email);
  }
}
```

### Unit of Work
```ts
// Track changes and commit atomically
class UnitOfWork {
  private newEntities: Entity[] = [];
  private dirtyEntities: Entity[] = [];
  private deletedEntities: Entity[] = [];

  registerNew(entity: Entity) { this.newEntities.push(entity); }
  registerDirty(entity: Entity) { this.dirtyEntities.push(entity); }
  registerDeleted(entity: Entity) { this.deletedEntities.push(entity); }

  async commit() {
    await this.transaction(async (tx) => {
      for (const e of this.newEntities)    await tx.insert(e);
      for (const e of this.dirtyEntities)  await tx.update(e);
      for (const e of this.deletedEntities) await tx.delete(e);
    });
    this.clear();
  }

  clear() {
    this.newEntities = [];
    this.dirtyEntities = [];
    this.deletedEntities = [];
  }
}
```

### CQRS (Command Query Responsibility Segregation)
```ts
// Separate read models from write models

// Write side — commands
interface Command {}
class CreateOrder implements Command {
  constructor(public userId: string, public items: Item[]) {}
}
class CancelOrder implements Command {
  constructor(public orderId: string) {}
}

class OrderCommandHandler {
  constructor(private repo: OrderRepository, private events: EventBus) {}

  async handle(cmd: CreateOrder) {
    const order = Order.create(cmd.userId, cmd.items);
    await this.repo.save(order);
    this.events.publish(new OrderCreated(order));
  }

  async handle(cmd: CancelOrder) {
    const order = await this.repo.findById(cmd.orderId);
    order.cancel();
    await this.repo.save(order);
    this.events.publish(new OrderCancelled(cmd.orderId));
  }
}

// Read side — queries (optimized for reads, different model)
interface Query {}
class GetOrderById implements Query {
  constructor(public id: string) {}
}
class GetOrdersByUser implements Query {
  constructor(public userId: string, public page: number) {}
}

class OrderQueryHandler {
  constructor(private readDb: ReadDatabase) {}

  async handle(q: GetOrderById): Promise<OrderView | null> {
    return this.readDb.query('SELECT * FROM order_views WHERE id = $1', [q.id]);
  }

  async handle(q: GetOrdersByUser): Promise<PaginatedResult<OrderView>> {
    return this.readDb.query(
      'SELECT * FROM order_views WHERE user_id = $1 LIMIT 20 OFFSET $2',
      [q.userId, (q.page - 1) * 20]
    );
  }
}

// Trade-offs:
// + Read and write models scale independently
// + Read queries optimized without affecting write logic
// + Clear separation of concerns
// - Eventual consistency between write and read models
// - More complex infrastructure (event bus, read model sync)
```

### Event Sourcing
```ts
// Store events, not state. Rebuild state by replaying events.

// Events (immutable facts)
interface Event {
  type: string;
  aggregateId: string;
  data: any;
  timestamp: Date;
}

class AccountCreated implements Event {
  type = 'ACCOUNT_CREATED';
  constructor(public aggregateId: string, public data: { ownerId: string }, public timestamp = new Date()) {}
}

class MoneyDeposited implements Event {
  type = 'MONEY_DEPOSITED';
  constructor(public aggregateId: string, public data: { amount: number }, public timestamp = new Date()) {}
}

class MoneyWithdrawn implements Event {
  type = 'MONEY_WITHDRAWN';
  constructor(public aggregateId: string, public data: { amount: number }, public timestamp = new Date()) {}
}

// Aggregate — applies events to build state
class Account {
  id!: string;
  ownerId!: string;
  balance = 0;
  private changes: Event[] = [];

  static create(id: string, ownerId: string): Account {
    const account = new Account();
    account.apply(new AccountCreated(id, { ownerId }));
    return account;
  }

  deposit(amount: number) {
    if (amount <= 0) throw new Error('Amount must be positive');
    this.apply(new MoneyDeposited(this.id, { amount }));
  }

  withdraw(amount: number) {
    if (amount > this.balance) throw new Error('Insufficient funds');
    this.apply(new MoneyWithdrawn(this.id, { amount }));
  }

  // Apply event and update state
  private apply(event: Event) {
    switch (event.type) {
      case 'ACCOUNT_CREATED':
        this.id = event.aggregateId;
        this.ownerId = event.data.ownerId;
        break;
      case 'MONEY_DEPOSITED':
        this.balance += event.data.amount;
        break;
      case 'MONEY_WITHDRAWN':
        this.balance -= event.data.amount;
        break;
    }
    this.changes.push(event);
  }

  // Rebuild from event history
  static fromEvents(events: Event[]): Account {
    const account = new Account();
    for (const event of events) account.apply(event);
    account.changes = []; // loaded, not new
    return account;
  }

  getUncommittedChanges(): Event[] { return this.changes; }
}

// Event store
class EventStore {
  async save(aggregateId: string, events: Event[]): Promise<void> {
    // Append events to store (never update/delete)
    await db.insert('events', events.map(e => ({
      aggregate_id: aggregateId,
      type: e.type,
      data: JSON.stringify(e.data),
      timestamp: e.timestamp,
    })));
  }

  async load(aggregateId: string): Promise<Event[]> {
    return db.query('SELECT * FROM events WHERE aggregate_id = $1 ORDER BY timestamp', [aggregateId]);
  }
}

// Usage
const account = Account.create('acc_1', 'user_123');
account.deposit(100);
account.withdraw(30);
// account.balance === 70
await eventStore.save('acc_1', account.getUncommittedChanges());

// Rebuild later
const events = await eventStore.load('acc_1');
const restored = Account.fromEvents(events);
// restored.balance === 70

// Trade-offs:
// + Complete audit trail (every state change recorded)
// + Time travel (rebuild state at any point in time)
// + Natural fit for CQRS (events populate read models)
// - Eventual consistency
// - Event schema evolution is challenging
// - Large event history needs snapshots
```

### Dependency Injection
```ts
// Container-based DI
type Factory<T> = () => T;

class Container {
  private factories = new Map<string, Factory<any>>();
  private singletons = new Map<string, any>();

  register<T>(key: string, factory: Factory<T>): void {
    this.factories.set(key, factory);
  }

  singleton<T>(key: string, factory: Factory<T>): void {
    const wrapped: Factory<T> = () => {
      if (!this.singletons.has(key)) this.singletons.set(key, factory());
      return this.singletons.get(key);
    };
    this.factories.set(key, wrapped);
  }

  resolve<T>(key: string): T {
    const factory = this.factories.get(key);
    if (!factory) throw new Error(`No registration for ${key}`);
    return factory();
  }
}

// Setup
const container = new Container();
container.singleton('db', () => new Database(process.env.DATABASE_URL));
container.register('userRepo', () => new PostgresUserRepository(container.resolve('db')));
container.register('authService', () => new AuthService(container.resolve('userRepo')));

// Usage
const auth = container.resolve<AuthService>('authService');
```

### Plugin Architecture
```ts
// Extensible system via plugins
interface Plugin {
  name: string;
  install(api: PluginApi): void;
}

interface PluginApi {
  addCommand(name: string, handler: () => void): void;
  addMiddleware(fn: Middleware): void;
  onEvent(event: string, handler: (data: any) => void): void;
}

class PluginManager implements PluginApi {
  private commands = new Map<string, () => void>();
  private middlewares: Middleware[] = [];
  private listeners = new Map<string, Set<(data: any) => void>>();

  register(plugin: Plugin) {
    plugin.install(this);
  }

  addCommand(name: string, handler: () => void) { this.commands.set(name, handler); }
  addMiddleware(fn: Middleware) { this.middlewares.push(fn); }
  onEvent(event: string, handler: (data: any) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }

  execute(name: string) { this.commands.get(name)?.(); }
}

// Plugin example
const analyticsPlugin: Plugin = {
  name: 'analytics',
  install(api) {
    api.onEvent('order:created', (order) => trackPurchase(order));
    api.addCommand('show-analytics', () => openDashboard());
  },
};
```

## Pattern Selection Guide

```
Problem                              Pattern
──────────────────────────────────────────────────────
Create objects flexibly              Factory Method / Builder
Swap algorithms at runtime           Strategy
Decouple sender from receiver         Observer / Pub-Sub
Add behavior without modifying        Decorator
Simplify complex subsystem            Facade
Control access to an object           Proxy
Treat individual & group same        Composite
Undo/redo operations                  Command
Change behavior based on state        State
Traverse collection uniformly        Iterator
Step-by-step algorithm skeleton       Template Method
Chain handlers for request            Middleware
Abstract data access                  Repository
Atomic change tracking               Unit of Work
Separate reads from writes            CQRS
Full audit trail / time travel       Event Sourcing
Swap implementations easily           Dependency Injection
Extensible system                     Plugin Architecture
```

## Code Style Rules

- Prefer composition over inheritance. Delegate to objects, don't extend hierarchies.
- Start simple. Apply patterns when the code demands it, not preemptively.
- A pattern should solve a real problem in your codebase, not a hypothetical one.
- Name the pattern in code only if it adds clarity. Don't force pattern names on simple code.
- SOLID principles guide design; patterns are implementation tools.
- Dependency Injection makes code testable. Inject interfaces, not classes.
- Favor immutable events over mutable state when correctness matters.
- Use the Repository pattern to keep domain logic independent of database details.
- Middleware patterns work well for cross-cutting concerns (auth, logging, caching).
- Three similar lines of code are better than one premature abstraction.
