# RPG Game - Testing Guide

**Version:** 1.0.0
**Last Updated:** 2025-12-31

## Table of Contents
1. [Testing Strategy](#testing-strategy)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [End-to-End Testing](#end-to-end-testing)
5. [Performance Testing](#performance-testing)
6. [Security Testing](#security-testing)
7. [User Acceptance Testing](#user-acceptance-testing)
8. [Test Coverage](#test-coverage)

---

## Testing Strategy

### Test Pyramid
```
        /\
       /E2E\       (Few)
      /------\
     /  API   \    (Some)
    /----------\
   / Unit Tests \  (Many)
  /--------------\
```

### Testing Levels
1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test module interactions
3. **E2E Tests**: Test complete user flows
4. **Performance Tests**: Test scalability and speed
5. **Security Tests**: Test for vulnerabilities

---

## Unit Testing

### Game Engine Tests

**Test: Vector2 Math**
```typescript
// packages/game-engine/src/math/__tests__/Vector2.test.ts
import { Vector2 } from '../Vector2';

describe('Vector2', () => {
  test('should add vectors correctly', () => {
    const v1 = new Vector2(1, 2);
    const v2 = new Vector2(3, 4);
    const result = v1.add(v2);

    expect(result.x).toBe(4);
    expect(result.y).toBe(6);
  });

  test('should calculate magnitude', () => {
    const v = new Vector2(3, 4);
    expect(v.magnitude()).toBe(5);
  });

  test('should normalize vector', () => {
    const v = new Vector2(3, 4);
    const normalized = v.normalize();

    expect(normalized.magnitude()).toBeCloseTo(1);
  });
});
```

**Test: Collision Detection**
```typescript
// packages/game-engine/src/physics/__tests__/CollisionDetection.test.ts
import { AABB } from '../AABB';
import { CollisionDetection } from '../CollisionDetection';

describe('CollisionDetection', () => {
  test('should detect AABB collision', () => {
    const box1 = new AABB(0, 0, 10, 10);
    const box2 = new AABB(5, 5, 10, 10);

    expect(CollisionDetection.testAABB(box1, box2)).toBe(true);
  });

  test('should detect no collision', () => {
    const box1 = new AABB(0, 0, 10, 10);
    const box2 = new AABB(20, 20, 10, 10);

    expect(CollisionDetection.testAABB(box1, box2)).toBe(false);
  });
});
```

### Combat System Tests

**Test: Damage Calculation**
```typescript
// packages/game-core/src/combat/__tests__/CombatManager.test.ts
import { CombatManager } from '../CombatManager';

describe('CombatManager', () => {
  test('should calculate damage correctly', () => {
    const attacker = { atk: 50, level: 10 };
    const defender = { def: 20, level: 10 };

    const damage = CombatManager.calculateDamage(attacker, defender);

    expect(damage).toBeGreaterThan(0);
    expect(damage).toBeLessThan(attacker.atk * 2);
  });

  test('should apply element effectiveness', () => {
    const fireSkill = { element: 'fire', power: 100 };
    const waterEnemy = { element: 'water', def: 10 };

    const damage = CombatManager.calculateSkillDamage(fireSkill, waterEnemy);

    // Fire is weak against water
    expect(damage).toBeLessThan(100);
  });

  test('should handle critical hits', () => {
    const attacker = { atk: 50, luck: 100 }; // High luck
    let criticalHit = false;

    // Run 100 times to ensure critical happens
    for (let i = 0; i < 100; i++) {
      const result = CombatManager.attack(attacker, { def: 10 });
      if (result.critical) {
        criticalHit = true;
        break;
      }
    }

    expect(criticalHit).toBe(true);
  });
});
```

### Inventory Tests

**Test: Inventory Management**
```typescript
// packages/game-core/src/inventory/__tests__/InventoryManager.test.ts
import { InventoryManager } from '../InventoryManager';

describe('InventoryManager', () => {
  let inventory: InventoryManager;

  beforeEach(() => {
    inventory = new InventoryManager(100, 500); // 100 slots, 500 weight
  });

  test('should add item to inventory', () => {
    const item = { id: 'sword', weight: 5, stackable: false };
    const result = inventory.addItem(item, 1);

    expect(result).toBe(true);
    expect(inventory.hasItem('sword')).toBe(true);
  });

  test('should reject item if inventory full', () => {
    const heavyItem = { id: 'boulder', weight: 600, stackable: false };
    const result = inventory.addItem(heavyItem, 1);

    expect(result).toBe(false);
  });

  test('should stack items correctly', () => {
    const potion = { id: 'potion', weight: 0.1, stackable: true, maxStack: 99 };

    inventory.addItem(potion, 50);
    inventory.addItem(potion, 30);

    expect(inventory.getItemCount('potion')).toBe(80);
  });
});
```

---

## Integration Testing

### API Integration Tests

**Test: Authentication Flow**
```typescript
// apps/server/__tests__/integration/auth.test.ts
import request from 'supertest';
import { app } from '../src/index';

describe('Auth API', () => {
  test('should register new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('token');
  });

  test('should reject duplicate username', async () => {
    // Register first time
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'duplicate',
        email: 'user1@example.com',
        password: 'Pass123!',
      });

    // Try to register again
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'duplicate',
        email: 'user2@example.com',
        password: 'Pass123!',
      });

    expect(response.status).toBe(400);
  });

  test('should login with valid credentials', async () => {
    // Register
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'logintest',
        email: 'login@example.com',
        password: 'Pass123!',
      });

    // Login
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'logintest',
        password: 'Pass123!',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

**Test: Save/Load System**
```typescript
describe('Save System', () => {
  let token: string;

  beforeAll(async () => {
    // Register and login
    const authResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'savetest',
        email: 'save@example.com',
        password: 'Pass123!',
      });

    token = authResponse.body.token;
  });

  test('should save player data', async () => {
    const saveData = {
      position: { x: 100, y: 200 },
      level: 5,
      exp: 1500,
      gold: 500,
      inventory: [{ id: 'sword', quantity: 1 }],
    };

    const response = await request(app)
      .post('/api/save')
      .set('Authorization', `Bearer ${token}`)
      .send(saveData);

    expect(response.status).toBe(200);
  });

  test('should load player data', async () => {
    const response = await request(app)
      .get('/api/save')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('position');
    expect(response.body).toHaveProperty('level');
  });
});
```

### WebRTC P2P Tests

**Test: Peer Connection**
```typescript
describe('WebRTC P2P', () => {
  test('should establish peer connection', async () => {
    const peer1 = new PeerManager('player1');
    const peer2 = new PeerManager('player2');

    await peer1.connect();
    await peer2.connect();

    const connected = await peer1.connectToPeer('player2');

    expect(connected).toBe(true);
  });

  test('should sync state between peers', async () => {
    const peer1 = new PeerManager('player1');
    const peer2 = new PeerManager('player2');

    await peer1.connect();
    await peer2.connect();
    await peer1.connectToPeer('player2');

    const receivedData = new Promise((resolve) => {
      peer2.on('peer-data', (data) => resolve(data));
    });

    peer1.broadcast({ type: 'position', x: 100, y: 200 });

    const data = await receivedData;
    expect(data).toMatchObject({ type: 'position', x: 100, y: 200 });
  });
});
```

---

## End-to-End Testing

### Playwright E2E Tests

**Test: Complete User Flow**
```typescript
// apps/web/__tests__/e2e/gameplay.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Gameplay Flow', () => {
  test('should complete tutorial', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Start game
    await page.click('button:has-text("Start Game")');

    // Tutorial welcome
    await expect(page.locator('.tutorial-panel')).toBeVisible();
    await page.click('button:has-text("Continue")');

    // Movement tutorial
    await page.keyboard.press('w');
    await page.keyboard.press('a');
    await page.keyboard.press('s');
    await page.keyboard.press('d');

    // Wait for tutorial completion
    await expect(page.locator('text=Tutorial Complete')).toBeVisible({ timeout: 10000 });
  });

  test('should engage in combat', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Skip tutorial
    await page.click('button:has-text("Skip Tutorial")');

    // Find and click monster
    await page.click('.monster-sprite');

    // Combat UI should appear
    await expect(page.locator('.combat-ui')).toBeVisible();

    // Attack
    await page.click('button:has-text("Attack")');

    // Wait for combat resolution
    await expect(page.locator('text=Victory')).toBeVisible({ timeout: 30000 });
  });

  test('should trade with another player', async ({ page }) => {
    // This requires two browser contexts
    const context2 = await page.context().browser()!.newContext();
    const page2 = await context2.newPage();

    // Player 1 setup
    await page.goto('http://localhost:5173');
    await page.click('button:has-text("Skip Tutorial")');

    // Player 2 setup
    await page2.goto('http://localhost:5173');
    await page2.click('button:has-text("Skip Tutorial")');

    // Initiate trade (Player 1)
    await page.click('.player-2');
    await page.click('button:has-text("Trade")');

    // Accept trade (Player 2)
    await page2.click('button:has-text("Accept Trade")');

    // Confirm both sides
    await page.click('button:has-text("Confirm")');
    await page2.click('button:has-text("Confirm")');

    // Verify trade completed
    await expect(page.locator('text=Trade Successful')).toBeVisible();
  });
});
```

---

## Performance Testing

### Load Testing with Artillery

**artillery.yml:**
```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10  # 10 users per second
    - duration: 120
      arrivalRate: 50  # Ramp up to 50 users/sec
    - duration: 60
      arrivalRate: 100 # Peak load
  processor: './test-functions.js'

scenarios:
  - name: 'User Registration and Login'
    flow:
      - post:
          url: '/api/auth/register'
          json:
            username: '{{ $randomString() }}'
            email: '{{ $randomString() }}@test.com'
            password: 'TestPass123!'
      - post:
          url: '/api/auth/login'
          json:
            username: '{{ username }}'
            password: 'TestPass123!'
          capture:
            - json: '$.token'
              as: 'token'

  - name: 'Gameplay Actions'
    flow:
      - get:
          url: '/api/save'
          headers:
            Authorization: 'Bearer {{ token }}'
      - post:
          url: '/api/save'
          headers:
            Authorization: 'Bearer {{ token }}'
          json:
            position: { x: 100, y: 200 }
            level: 5
```

**Run Load Test:**
```bash
npm install -g artillery
artillery run artillery.yml
```

### Stress Testing

**Test Server Under Load:**
```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test API endpoint
ab -n 10000 -c 100 http://localhost:3000/api/health

# Results should show:
# - Requests per second > 1000
# - Mean response time < 50ms
# - No failed requests
```

---

## Security Testing

### Vulnerability Scanning

**1. Dependency Audit:**
```bash
# Check for known vulnerabilities
npm audit
bun audit

# Fix vulnerabilities
npm audit fix
```

**2. OWASP ZAP Scan:**
```bash
# Install OWASP ZAP
# Run automated scan
zap-cli quick-scan -s all http://localhost:3000
```

**3. SQL Injection Test:**
```typescript
test('should prevent SQL injection', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({
      username: "admin' OR '1'='1",
      password: "anything",
    });

  expect(response.status).toBe(401); // Should fail, not succeed
});
```

**4. XSS Test:**
```typescript
test('should sanitize user input', async () => {
  const response = await request(app)
    .post('/api/chat/send')
    .set('Authorization', `Bearer ${token}`)
    .send({
      message: '<script>alert("XSS")</script>',
    });

  expect(response.body.message).not.toContain('<script>');
});
```

**5. Rate Limiting Test:**
```typescript
test('should enforce rate limits', async () => {
  const requests = [];

  // Send 200 requests rapidly
  for (let i = 0; i < 200; i++) {
    requests.push(request(app).get('/api/health'));
  }

  const responses = await Promise.all(requests);
  const tooManyRequests = responses.filter(r => r.status === 429);

  expect(tooManyRequests.length).toBeGreaterThan(0);
});
```

---

## User Acceptance Testing

### Test Plan

**Test Scenarios:**

1. **New Player Experience**
   - [ ] Can register account
   - [ ] Can login successfully
   - [ ] Tutorial guides through basic features
   - [ ] Can move character
   - [ ] Can engage in first combat

2. **Core Gameplay**
   - [ ] Can explore different zones
   - [ ] Can battle various monsters
   - [ ] Can use skills and items
   - [ ] Can level up and gain exp
   - [ ] Can manage inventory

3. **Job System**
   - [ ] Can obtain job certificates
   - [ ] Can learn multiple jobs
   - [ ] Can use skills from all learned jobs
   - [ ] Stats update correctly

4. **Economy**
   - [ ] Can earn and spend gold
   - [ ] Can craft items
   - [ ] Can trade with other players
   - [ ] Can use auction house
   - [ ] Can create player shop

5. **Multiplayer**
   - [ ] Can see other players
   - [ ] Can communicate via chat
   - [ ] Can engage in P2P combat
   - [ ] Can join PvP arena

6. **Mobile**
   - [ ] Touch controls work properly
   - [ ] Virtual joystick is responsive
   - [ ] Haptic feedback works
   - [ ] App doesn't crash on background

7. **Desktop**
   - [ ] App installs correctly
   - [ ] Fullscreen mode works
   - [ ] Auto-update works
   - [ ] Settings persist

---

## Test Coverage

### Coverage Goals

- **Unit Tests**: >80% coverage
- **Integration Tests**: >60% coverage
- **E2E Tests**: Critical paths covered
- **Security Tests**: OWASP Top 10 addressed

### Run Coverage

```bash
# Install coverage tool
npm install -g nyc

# Run tests with coverage
nyc npm test

# Generate HTML report
nyc report --reporter=html

# View report
open coverage/index.html
```

### CI/CD Integration

**GitHub Actions (.github/workflows/test.yml):**
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: rpg_test
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run unit tests
        run: bun test

      - name: Run integration tests
        run: bun test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Test Checklist

Before release:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E tests cover critical paths
- [ ] Performance tests meet benchmarks
- [ ] Security audit complete
- [ ] No high/critical vulnerabilities
- [ ] UAT feedback addressed
- [ ] Test coverage >80%
- [ ] Load testing passed
- [ ] Mobile apps tested on real devices
- [ ] Desktop apps tested on all OS
- [ ] Database migrations tested
- [ ] Rollback procedures tested

---

**For questions about testing, contact the QA team or check the documentation.**
