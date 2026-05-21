---
name: node.js
description: Build Node.js applications — runtime APIs, file system, streams, HTTP server, child processes, worker threads, events, clustering, performance, debugging, and best practices.
---

You are an expert Node.js developer. When the user asks for help with Node.js, follow these instructions.

## Runtime Essentials

### Process & Environment

```js
// Environment variables
process.env.NODE_ENV;              // 'development' | 'production' | 'test'
process.env.PORT;                   // custom env vars
process.env.USERNAME;               // system vars

// Arguments
process.argv;                       // ['/path/to/node', 'script.js', '--flag', 'value']
process.argv0;                      // '/path/to/node'

// Current working directory
process.cwd();                      // '/home/user/project'

// Script directory (ESM)
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Platform
process.platform;                   // 'win32' | 'darwin' | 'linux'
process.arch;                       // 'x64' | 'arm64'
process.pid;                        // process ID
process.ppid;                       // parent process ID
process.version;                    // 'v20.11.0'
process.versions;                   // { node: '20.11.0', v8: '12.4...', ... }

// Exit
process.exit(0);                    // 0 = success, 1 = failure
process.exitCode = 1;               // set code without forcing exit

// Signals
process.on('SIGTERM', () => gracefulShutdown());
process.on('SIGINT', () => gracefulShutdown());
process.on('SIGHUP', () => reloadConfig());

// Memory usage
const mem = process.memoryUsage();
mem.rss;          // Resident Set Size (total)
mem.heapTotal;    // V8 heap allocated
mem.heapUsed;     // V8 heap used
mem.external;     // C++ objects
mem.arrayBuffers; // ArrayBuffers

// Uptime
process.uptime();                   // seconds since process started
```

### Module Systems

```js
// ESM (recommended)
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import fs from 'node:fs';                    // default import
import { fileURLToPath } from 'node:url';

// Dynamic import
const module = await import('./heavy-module.js');

// package.json: "type": "module"

// CJS (legacy)
const fs = require('node:fs');
const { join } = require('node:path');
const module = require('./module');

// Node built-in prefix: 'node:' is recommended
import { readFileSync } from 'node:fs';       // explicit
import { readFileSync } from 'fs';             // also works
```

## File System (fs)

### Async Operations (always prefer these)

```js
import { readFile, writeFile, mkdir, rm, stat, readdir, copyFile, rename } from 'node:fs/promises';

// Read file
const text = await readFile('config.json', 'utf-8');
const buffer = await readFile('image.png');              // returns Buffer
const data = JSON.parse(await readFile('data.json', 'utf-8'));

// Write file
await writeFile('output.txt', 'Hello World', 'utf-8');
await writeFile('data.json', JSON.stringify(data, null, 2));

// Append
import { appendFile } from 'node:fs/promises';
await appendFile('log.txt', `${new Date().toISOString()} event\n`);

// Ensure directory exists
import { mkdir } from 'node:fs/promises';
await mkdir('output/subdir', { recursive: true });

// Delete file
import { unlink } from 'node:fs/promises';
await unlink('temp.txt');

// Delete directory
await rm('temp-dir', { recursive: true, force: true });

// Copy
await copyFile('src.txt', 'dest.txt');

// Move / rename
await rename('old.txt', 'new.txt');

// Check existence
import { access } from 'node:fs/promises';
try {
  await access('file.txt'); // throws if doesn't exist
  // file exists
} catch {
  // file doesn't exist
}

// Get stats
const info = await stat('file.txt');
info.isFile();
info.isDirectory();
info.size;               // bytes
info.mtime;              // Date
info.birthtime;          // Date (creation)

// List directory
const entries = await readdir('src');
const all = await readdir('src', { withFileTypes: true });
all.filter(e => e.isFile()).map(e => e.name);
all.filter(e => e.isDirectory()).map(e => e.name);

// Recursive listing
import { readdir } from 'node:fs/promises';
const files = await readdir('src', { recursive: true });

// Watch for changes
import { watch } from 'node:fs/promises';
const watcher = watch('src', { recursive: true });
for await (const event of watcher) {
  console.log(event.eventType, event.filename);
}

// Temp directory
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
const tempDir = await mkdtemp(join(tmpdir(), 'myapp-'));
// use tempDir, clean up when done
await rm(tempDir, { recursive: true, force: true });
```

### Sync Operations (only for startup / CLI tools)

```js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const config = JSON.parse(readFileSync('config.json', 'utf-8'));
if (!existsSync('dist')) mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html, 'utf-8');
```

### FileHandle (lower-level control)

```js
import { open } from 'node:fs/promises';

const file = await open('large.txt', 'r');
const stat = await file.stat();
const buffer = Buffer.alloc(1024);
await file.read(buffer, 0, 1024, 0);  // offset, length, position
await file.close();

// Write with handle
const out = await open('output.txt', 'w');
await out.write('Hello\n');
await out.close();
```

## Streams

### Readable Stream

```js
import { createReadStream } from 'node:fs';

// Read file in chunks (memory efficient for large files)
const stream = createReadStream('large-file.txt', { encoding: 'utf-8', highWaterMark: 64 * 1024 });

stream.on('data', (chunk) => {
  console.log(`Received ${chunk.length} bytes`);
});

stream.on('end', () => console.log('Done'));
stream.on('error', (err) => console.error(err));

// Async iterator (cleaner)
for await (const chunk of createReadStream('data.txt', 'utf-8')) {
  process.stdout.write(chunk);
}

// Pipe to writable
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

createReadStream('input.txt')
  .pipe(createGzip())
  .pipe(createWriteStream('output.txt.gz'));
```

### Writable Stream

```js
import { createWriteStream } from 'node:fs';

const output = createWriteStream('log.txt', { flags: 'a' }); // append mode
output.write('Line 1\n');
output.write('Line 2\n');
output.end('Final line\n');

output.on('finish', () => console.log('Written'));
output.on('error', (err) => console.error(err));
```

### Transform Stream

```js
import { Transform } from 'node:stream';

const upperCase = new Transform({
  transform(chunk, encoding, callback) {
    callback(null, chunk.toString().toUpperCase());
  },
});

process.stdin.pipe(upperCase).pipe(process.stdout);
```

### Line-by-Line Processing

```js
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const rl = createInterface({
  input: createReadStream('data.csv'),
  crlfDelay: Infinity,
});

let lineCount = 0;
for await (const line of rl) {
  lineCount++;
  const columns = line.split(',');
  // process line
}
console.log(`Processed ${lineCount} lines`);
```

## Path

```js
import { join, resolve, dirname, basename, extname, relative, normalize, parse, sep } from 'node:path';

join('src', 'components', 'app.tsx');       // 'src/components/app.tsx' (build path)
resolve('src', '..', 'dist');                // '/home/user/project/dist' (absolute)
dirname('/home/user/file.txt');              // '/home/user'
basename('/home/user/file.txt');             // 'file.txt'
basename('/home/user/file.txt', '.txt');     // 'file'
extname('file.test.ts');                     // '.ts'
relative('/home/user', '/home/project');     // '../project'
normalize('/home/user/../user/./file');      // '/home/user/file'
parse('/home/user/file.txt');
// { root: '/', dir: '/home/user', base: 'file.txt', ext: '.txt', name: 'file' }
sep;                                         // '/' on Unix, '\\' on Windows

// Cross-platform safe paths
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path');
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'data', 'db.json');
```

## HTTP Server

### Basic Server

```js
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Request-Id', crypto.randomUUID());

  if (url.pathname === '/api/health' && req.method === 'GET') {
    res.statusCode = 200;
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }));
});

server.listen(3000, () => {
  console.log(`Server running on http://localhost:3000`);
});
```

### Request Body Parsing

```js
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('Invalid JSON')); }
      } else {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}
```

### Router Pattern

```js
class Router {
  #routes = [];

  on(method, path, handler) {
    this.#routes.push({ method, pattern: pathToRegex(path), handler });
    return this;
  }

  get(path, handler)    { return this.on('GET', path, handler); }
  post(path, handler)   { return this.on('POST', path, handler); }
  put(path, handler)    { return this.on('PUT', path, handler); }
  delete(path, handler) { return this.on('DELETE', path, handler); }

  handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    for (const route of this.#routes) {
      if (route.method !== req.method) continue;
      const match = url.pathname.match(route.pattern);
      if (match) {
        req.params = match.groups;
        req.query = Object.fromEntries(url.searchParams);
        return route.handler(req, res);
      }
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: { code: 'NOT_FOUND' } }));
  }
}

function pathToRegex(path) {
  return new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
}
```

### File Upload (Multipart)

```js
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function handleUpload(req, res) {
  const contentType = req.headers['content-type'] || '';
  const boundary = contentType.split('boundary=')[1];
  if (!boundary) { res.statusCode = 400; res.end('No boundary'); return; }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  // Parse multipart (simplified — use a library like busboy/formidable for production)
  const files = parseMultipart(body, boundary);
  for (const file of files) {
    const path = join(tmpdir(), file.filename);
    await writeFile(path, file.data);
  }

  res.end(JSON.stringify({ uploaded: files.map(f => f.filename) }));
}
```

## Child Processes

### Exec (shell command, buffered output)

```js
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// Run shell command
const { stdout, stderr } = await execAsync('ls -la');
console.log(stdout);

// Run specific binary (safer — no shell injection)
const execFileAsync = promisify(execFile);
const { stdout } = await execFileAsync('git', ['status', '--short']);
```

### Spawn (streaming output)

```js
import { spawn } from 'node:child_process';

const child = spawn('npm', ['run', 'build'], { stdio: 'inherit' });

child.on('close', (code) => {
  console.log(`Build exited with code ${code}`);
});

// Capture output
const child = spawn('node', ['worker.js']);
let output = '';
child.stdout.on('data', (chunk) => { output += chunk; });
child.stderr.on('data', (chunk) => { console.error(chunk.toString()); });
child.on('close', (code) => { console.log('Result:', output); });

// Pass env vars
const child = spawn('node', ['script.js'], {
  env: { ...process.env, NODE_ENV: 'production' },
  cwd: '/path/to/project',
});
```

### Fork (Node.js subprocess with IPC)

```js
import { fork } from 'node:child_process';

const worker = fork('worker.js');

worker.send({ type: 'process', data: items });
worker.on('message', (msg) => {
  if (msg.type === 'result') console.log('Result:', msg.data);
});
worker.on('exit', (code) => console.log(`Worker exited: ${code}`));
```

## Worker Threads

```js
// main.js
import { Worker } from 'node:worker_threads';

function runWorker(workerPath, data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

// CPU-intensive task in parallel
const results = await Promise.all([
  runWorker('./workers/hash.js', { algorithm: 'sha256', input: data1 }),
  runWorker('./workers/hash.js', { algorithm: 'sha512', input: data2 }),
]);

// worker.js
import { workerData, parentPort } from 'node:worker_threads';
import { createHash } from 'node:crypto';

const hash = createHash(workerData.algorithm).update(workerData.input).digest('hex');
parentPort.postMessage({ hash });
```

### Thread Pool for CPU Work

```js
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';

class WorkerPool {
  #workers = [];
  #queue = [];
  #active = new Map();

  constructor(workerPath, size = availableParallelism()) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(workerPath);
      worker.on('message', (result) => {
        const { resolve } = this.#active.get(worker);
        this.#active.delete(worker);
        resolve(result);
        this.#dispatch();
      });
      this.#workers.push(worker);
    }
  }

  execute(data) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ data, resolve, reject });
      this.#dispatch();
    });
  }

  #dispatch() {
    if (this.#queue.length === 0) return;
    const idle = this.#workers.find(w => !this.#active.has(w));
    if (!idle) return;
    const task = this.#queue.shift();
    this.#active.set(idle, task);
    idle.postMessage(task.data);
  }

  async terminate() {
    await Promise.all(this.#workers.map(w => w.terminate()));
  }
}
```

## Events

```js
import { EventEmitter } from 'node:events';

class TypedEmitter extends EventEmitter {
  on(event, listener) { return super.on(event, listener); }
  emit(event, ...args) { return super.emit(event, ...args); }
}

const bus = new TypedEmitter();

bus.on('order:created', (order) => {
  console.log('New order:', order.id);
  sendConfirmation(order);
});

bus.on('order:created', (order) => {
  updateAnalytics(order);
});

bus.emit('order:created', { id: 'ord_123', total: 99.99 });

// Once
bus.once('ready', () => console.log('First ready'));

// Remove listener
const handler = (data) => console.log(data);
bus.on('data', handler);
bus.off('data', handler);

// Error handling (MUST handle or process crashes)
bus.on('error', (err) => console.error('Event error:', err));
```

### AbortController for Cancellation

```js
const controller = new AbortController();
const { signal } = controller;

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

// Use with fetch
try {
  const res = await fetch(url, { signal });
  const data = await res.json();
} catch (err) {
  if (err.name === 'AbortError') console.log('Request cancelled');
}

// Use with fs
import { readFile } from 'node:fs/promises';
await readFile('large.txt', { signal });

// Use with child_process
import { execAsync } from './utils.js';
const child = spawn('npm', ['run', 'build'], { signal });
```

## Crypto

```js
import { createHash, randomBytes, randomUUID, createHmac, createCipheriv, createDecipheriv } from 'node:crypto';

// Hash
const hash = createHash('sha256').update('hello').digest('hex');

// HMAC
const hmac = createHmac('sha256', 'secret').update('message').digest('hex');

// Random values
randomUUID();                           // '550e8400-e29b-41d4-a716-446655440000'
randomBytes(16).toString('hex');        // 32-char hex string
randomBytes(8).toString('base64url');   // URL-safe base64

// AES encryption
const key = randomBytes(32);            // 256-bit key
const iv = randomBytes(16);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update('secret data', 'utf-8'), cipher.final()]);
const authTag = cipher.getAuthTag();

// AES decryption
const decipher = createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(authTag);
const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8');

// Password hashing (use bcrypt or argon2 in production)
import { scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scryptAsync = promisify(scrypt);
const derived = await scryptAsync('password', 'salt', 64);
```

## URL & Query String

```js
// Parse URL
const url = new URL('https://example.com/api/users?page=2&sort=name');
url.protocol;   // 'https:'
url.hostname;   // 'example.com'
url.pathname;   // '/api/users'
url.searchParams.get('page');   // '2'
url.searchParams.get('sort');   // 'name'
url.searchParams.has('page');   // true

// Build URL
const params = new URLSearchParams({ page: 2, limit: 20, q: 'hello world' });
const fullUrl = `https://api.example.com/search?${params}`;
// 'https://api.example.com/search?page=2&limit=20&q=hello+world'

// URL resolution
new URL('/api/users', 'https://example.com').href;   // 'https://example.com/api/users'
new URL('../other', 'https://example.com/a/b/c').href; // 'https://example.com/a/other'
```

## Timers

```js
// One-shot
const id = setTimeout(() => console.log('done'), 1000);
clearTimeout(id);

// Interval
const id2 = setInterval(() => console.log('tick'), 1000);
clearInterval(id2);

// Immediate (next event loop iteration)
const id3 = setImmediate(() => console.log('immediate'));
clearImmediate(id3);

// Async-compatible timer
import { setTimeout as sleep } from 'node:timers/promises';
await sleep(1000);        // non-blocking wait
await sleep(5000, 'val'); // resolves with 'val' after 5s

// With AbortController
const controller = new AbortController();
await sleep(10000, undefined, { signal: controller.signal });
controller.abort(); // cancels the sleep
```

## Performance

### Profiling

```js
// Measure execution time
import { performance } from 'node:perf_hooks';

const start = performance.now();
await doWork();
const elapsed = performance.now() - start;
console.log(`Took ${elapsed.toFixed(2)}ms`);

// HTTP server timing middleware
function timingMiddleware(req, res, next) {
  const start = performance.now();
  res.on('finish', () => {
    const ms = (performance.now() - start).toFixed(2);
    console.log(`${req.method} ${req.url} ${res.statusCode} ${ms}ms`);
  });
  next();
}
```

### Event Loop Monitoring

```js
import { monitorEventLoopDelay } from 'node:perf_hooks';

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

// Check periodically
setInterval(() => {
  console.log(`Event loop delay — p50: ${histogram.percentile(50).toFixed(2)}ms, p99: ${histogram.percentile(99).toFixed(2)}ms`);
}, 10_000);
```

### Clustering (utilize all CPU cores)

```js
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';
import { createServer } from 'node:http';

if (cluster.isPrimary) {
  const numCPUs = availableParallelism();
  console.log(`Primary ${process.pid} forking ${numCPUs} workers`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code) => {
    console.log(`Worker ${worker.process.pid} died (${code}). Restarting...`);
    cluster.fork();
  });
} else {
  const server = createServer((req, res) => {
    res.end(`Hello from worker ${process.pid}`);
  });
  server.listen(3000);
  console.log(`Worker ${process.pid} started`);
}
```

## Utilities

### readline (CLI input)

```js
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = createInterface({ input, output });

const name = await rl.question('What is your name? ');
console.log(`Hello, ${name}!`);

const confirm = await rl.question('Continue? (y/n) ');
if (confirm.toLowerCase() !== 'y') process.exit(0);

rl.close();
```

### OS Info

```js
import { tmpdir, hostname, platform, arch, totalmem, freemem, cpus, uptime, availableParallelism } from 'node:os';

tmpdir();                  // '/tmp' or 'C:\\Users\\...\\AppData\\Local\\Temp'
hostname();                // 'my-machine'
platform();                // 'win32' | 'darwin' | 'linux'
arch();                    // 'x64' | 'arm64'
totalmem();                // total RAM in bytes
freemem();                 // free RAM in bytes
cpus().length;             // number of logical cores
availableParallelism();    // threads available for worker pool
uptime();                  // system uptime in seconds
```

### Console Utilities

```js
// Measure time
console.time('operation');
await doWork();
console.timeEnd('operation');    // operation: 142.5ms

// Table display
console.table([
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
]);

// Grouping
console.group('API Request');
console.log('Method: GET');
console.log('URL: /api/users');
console.groupEnd();

// Assert (only logs if false)
console.assert(response.status === 200, `Expected 200, got ${response.status}`);

// Count
console.count('request');    // request: 1
console.count('request');    // request: 2
console.countReset('request');
```

## Error Handling Patterns

```js
// Uncaught exceptions — last resort
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Do NOT continue — state may be corrupted
  process.exit(1);
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Async error wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Usage
app.get('/api/users', asyncHandler(async (req, res) => {
  const users = await db.query('SELECT * FROM users');
  res.json({ data: users });
}));

// Graceful shutdown
const connections = new Set();
server.on('connection', (conn) => {
  connections.add(conn);
  conn.on('close', () => connections.delete(conn));
});

async function gracefulShutdown() {
  console.log('Shutting down...');
  server.close(); // stop accepting new connections
  for (const conn of connections) conn.destroy();
  await db.close();
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

## Code Style Rules

- Use ESM (`import`/`export`) with `"type": "module"` in package.json.
- Prefix built-in imports with `node:` (`import { readFileSync } from 'node:fs'`).
- Always use async fs methods (`node:fs/promises`). Only use sync at startup.
- Use streams for large files (>1MB). Never `readFile` a 500MB file into memory.
- Use `AbortController` for cancellable async operations.
- Use `worker_threads` for CPU-heavy work (crypto, compression, image processing).
- Use `cluster` to utilize all CPU cores for HTTP servers.
- Handle `unhandledRejection` and `uncaughtException` at process level.
- Implement graceful shutdown: stop accepting connections, drain requests, close DB.
- Use `URL` and `URLSearchParams` for URL parsing, not string manipulation.
- Use `crypto.randomUUID()` for IDs, not `Math.random()`.
- Use `path.join()` for file paths — never string concatenation with `/`.
- Set `NODE_ENV=production` in production — enables V8 optimizations.
- Use `--inspect` flag for debugging, not console.log in production.
- Pin Node.js version in `package.json` `engines` field.
- Use `node:` prefix for built-in modules to make them explicit.
