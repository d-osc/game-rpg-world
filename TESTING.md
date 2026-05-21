# 🧪 RPG Game - Testing Guide (MVP)

**Version:** MVP (Sprint 5 Complete)
**Last Updated:** 2025-12-31
**Progress:** 83% Complete (Sprints 1-5 Done)

## 🎯 MVP Testing Focus

This guide focuses on **manual testing** of the 8 implemented scenes for MVP validation. Automated tests (unit, integration, E2E) will be added in post-MVP phases.

## Table of Contents
1. [Quick Start Testing](#quick-start-testing)
2. [Scene-by-Scene Testing](#scene-by-scene-testing)
3. [Integration Testing Checklist](#integration-testing-checklist)
4. [Known Issues & Bugs](#known-issues--bugs)
5. [Performance Testing](#performance-testing)
6. [User Acceptance Testing](#user-acceptance-testing)
7. [Future Testing Plans](#future-testing-plans)

---

## Quick Start Testing

### 1. Run the Game
```bash
cd apps/web
bun run dev
```

### 2. Access SceneTestScene
Open [http://localhost:5173](http://localhost:5173) - The game should load directly into SceneTestScene.

### 3. Navigate Through Scenes
Use keyboard shortcuts to test each scene:
- **1**: Main Menu
- **2**: Character Creation
- **3**: World Scene
- **4**: Combat Scene
- **5**: Inventory Scene
- **6**: Job Scene
- **7**: Crafting Scene
- **8**: Pause Menu (overlay)
- **9**: Pop overlay

---

## Scene-by-Scene Testing

### 1️⃣ Main Menu Scene
**Access**: Press `1` in SceneTestScene

**Test Cases**:
- [ ] Title "Epic Quest RPG" displays correctly
- [ ] Four menu options visible: New Game, Continue, Settings, Exit
- [ ] Arrow keys navigate menu (selection highlight changes)
- [ ] Enter key selects menu item
- [ ] "New Game" transitions to Character Creation
- [ ] "Continue" shows message if no save exists
- [ ] "Settings" shows placeholder message
- [ ] "Exit" closes game (browser only)

**Expected Behavior**:
- Menu selection highlights in yellow
- Smooth navigation with no lag
- Clear visual feedback on selection

---

### 2️⃣ Character Creation Scene
**Access**: Press `2` in SceneTestScene or "New Game" from Main Menu

**Test Cases**:
- [ ] Title "Create Your Character" displays
- [ ] Input prompt for character name
- [ ] Starting job selection (4 options: Warrior, Mage, Ranger, Artisan)
- [ ] Job descriptions display correctly
- [ ] Arrow keys navigate jobs
- [ ] Enter confirms selection after name entered
- [ ] Creates new player with selected job
- [ ] Transitions to World Scene after creation

**Test Input**:
- Name: "TestHero"
- Job: Try each of the 4 starting jobs

**Expected Behavior**:
- Name input accepts alphanumeric characters
- Job descriptions show bonuses (e.g., Warrior: +5 STR)
- Confirmation creates player with correct stats

---

### 3️⃣ World Scene
**Access**: Press `3` in SceneTestScene

**Test Cases**:
- [ ] Map loads and displays (town/forest/cave)
- [ ] Player sprite renders at starting position
- [ ] Arrow keys/WASD move player
- [ ] Camera follows player smoothly
- [ ] Collision detection prevents walking through walls
- [ ] Zone transitions work (walk to edge of map)
- [ ] NPCs render on map
- [ ] Monsters spawn in hunting zones
- [ ] Interacting with NPC (walk up + Enter) shows dialogue
- [ ] Encountering monster triggers Combat Scene
- [ ] ESC opens Pause Menu overlay

**Movement Test**:
- Move in all 8 directions (N, NE, E, SE, S, SW, W, NW)
- Try to walk through walls (should block)
- Walk to map edge (should transition or block)

**Expected Behavior**:
- Smooth 60 FPS movement
- No sprite tearing or flickering
- Collision detection accurate to tile boundaries

---

### 4️⃣ Combat Scene
**Access**: Press `4` in SceneTestScene or encounter monster in World Scene

**Test Cases**:

**Combat Initialization**:
- [ ] Player and enemy sprites display
- [ ] HP/MP bars render correctly
- [ ] Combat log shows "Battle Start" message
- [ ] Turn order determined by speed stat

**Combat Actions**:
- [ ] "Attack" button executes basic attack
- [ ] "Skill" button opens skill selection menu
- [ ] "Item" button opens usable items list
- [ ] "Flee" button attempts escape (may fail)

**Attack Test**:
- [ ] Damage calculation displays in log
- [ ] HP bars update visually
- [ ] Critical hits show "Critical!" message
- [ ] Enemy AI responds with attack

**Skill Test**:
- [ ] Skills list shows all learned skills
- [ ] MP cost displays correctly
- [ ] Cannot use skill if MP insufficient
- [ ] Skill effects apply (damage/heal/buff/debuff)
- [ ] Status effects display (poison, burn, etc.)

**Item Test**:
- [ ] Only consumables shown in item list
- [ ] Using potion heals HP
- [ ] Item removed from inventory after use

**Victory/Defeat**:
- [ ] Victory screen shows on enemy HP = 0
- [ ] EXP and gold rewards display
- [ ] Loot drops added to inventory
- [ ] Level up message if threshold reached
- [ ] Defeat screen shows on player HP = 0
- [ ] Return to World Scene after combat

**Test Combat**: Fight Slime (easiest), Goblin, Wolf, Skeleton

**Expected Behavior**:
- Turn-based combat flows smoothly
- Damage calculations accurate
- No infinite loops or freezes
- Combat log scrolls properly

---

### 5️⃣ Inventory Scene
**Access**: Press `5` in SceneTestScene or `I` from Pause Menu

**Test Cases**:

**View Modes**:
- [ ] Tab switches between Inventory and Equipment views
- [ ] Current view indicator updates

**Inventory View**:
- [ ] All items display with icons (placeholders)
- [ ] Item names, quantities, weights shown
- [ ] Rarity colors display (Common=white, Rare=blue, Epic=purple, Legendary=gold)
- [ ] Filter buttons cycle types (All, Weapon, Armor, Consumable, Material)
- [ ] Press F to cycle filters
- [ ] Slots and weight tracking display (e.g., "50/100 slots, 125.5/500 kg")

**Item Actions**:
- [ ] Select consumable → "Use" option enabled
- [ ] Using potion heals HP/MP and removes item
- [ ] Select equipment → "Equip" option enabled
- [ ] Equipping weapon/armor moves to Equipment view
- [ ] "Drop" option removes item from inventory
- [ ] Confirmation dialog for drop (future)

**Equipment View**:
- [ ] 6 equipment slots display: Weapon, Head, Body, Hands, Legs, Feet
- [ ] Equipped items show in correct slots
- [ ] Stat bonuses display (e.g., Iron Sword: +10 ATK)
- [ ] "Unequip" option removes item to inventory
- [ ] Stats recalculate on equip/unequip

**Scrolling**:
- [ ] Arrow keys navigate item list
- [ ] List scrolls when >10 items
- [ ] Scroll offset updates correctly

**Test Items**: Add various items via DataLoader (potions, swords, armor, materials)

**Expected Behavior**:
- Inventory updates in real-time
- No duplicate items
- Weight calculations accurate
- Stat bonuses apply immediately

---

### 6️⃣ Job Scene
**Access**: Press `6` in SceneTestScene or `J` from Pause Menu

**Test Cases**:

**View Modes** (Tab to switch):
- [ ] "Learned Jobs" view
- [ ] "Skills" view (when job selected)
- [ ] "Available Jobs" view

**Learned Jobs View**:
- [ ] All learned jobs display with levels
- [ ] Current EXP and next level shown
- [ ] Job bonuses listed (e.g., Warrior: +10 STR, +5 VIT)
- [ ] Select job → view skills

**Skills View**:
- [ ] All skills for selected job display
- [ ] Skill details: Name, Type, MP Cost, Description
- [ ] Skill effects shown (e.g., "Deals 150% ATK damage")
- [ ] Unlocked skills highlighted
- [ ] Locked skills grayed out with level requirement

**Available Jobs View**:
- [ ] Jobs not yet learned display
- [ ] Certificate requirement shown (e.g., "Requires: Blacksmith Certificate")
- [ ] "Learn Job" option if certificate in inventory
- [ ] Learning job consumes certificate
- [ ] Job moves to Learned Jobs list
- [ ] Stats recalculate with new bonuses

**Test Jobs**:
1. Start with Warrior
2. Learn Blacksmith (add certificate via debug)
3. View Blacksmith skills
4. Learn Mage (add certificate)
5. Check stat bonuses stack

**Expected Behavior**:
- Multi-job system works (can learn unlimited jobs)
- Stats bonuses stack correctly
- Skills from all jobs available in combat
- No class restrictions

---

### 7️⃣ Crafting Scene
**Access**: Press `7` in SceneTestScene or `C` from Pause Menu

**Test Cases**:

**Recipe Browsing**:
- [ ] All recipes display with names
- [ ] Craftable recipes highlighted in green
- [ ] Non-craftable recipes grayed out
- [ ] Filter by category (F key): All, Weapon, Armor, Consumable, Material
- [ ] Recipe details show on selection

**Recipe Details**:
- [ ] Output item name and quantity
- [ ] Required materials list with owned/needed counts
- [ ] Job requirement shown (e.g., "Requires: Blacksmith Lv.5")
- [ ] Crafting time displayed (e.g., "Time: 3s")

**Crafting Process**:
- [ ] "Craft" option enabled only if craftable
- [ ] Crafting starts with progress bar
- [ ] Progress bar animates from 0% to 100%
- [ ] Crafting time matches recipe (wait 3 seconds)
- [ ] Success message displays
- [ ] Crafted item added to inventory
- [ ] Materials consumed from inventory
- [ ] Recipe list updates (may become non-craftable)

**Test Recipes**:
1. Iron Sword (Requires: Iron Ore x3, Wood x1, Blacksmith Lv.1)
2. Health Potion (Requires: Herb x2, Water x1)
3. Leather Armor (Requires: Leather x5, Thread x2, Artisan Lv.3)

**Expected Behavior**:
- Progress bar smooth animation
- Crafting cannot be interrupted (future: add cancel)
- Materials deducted correctly
- Job level requirements enforced
- Auto-save after crafting

---

### 8️⃣ Pause Menu Scene
**Access**: Press `8` in SceneTestScene or `ESC` from World Scene

**Test Cases**:

**Overlay Behavior**:
- [ ] Pause menu renders over current scene (semi-transparent background)
- [ ] Current scene still visible but dimmed
- [ ] Current scene paused (no updates)

**Menu Options**:
- [ ] "Resume" returns to game
- [ ] "Inventory" switches to Inventory Scene
- [ ] "Jobs" switches to Job Scene
- [ ] "Crafting" switches to Crafting Scene
- [ ] "Settings" shows placeholder
- [ ] "Save Game" saves to localStorage
- [ ] "Main Menu" returns to Main Menu (confirm dialog future)

**Navigation**:
- [ ] Arrow keys navigate menu
- [ ] Enter selects option
- [ ] ESC closes pause menu (Resume)

**Expected Behavior**:
- Pause menu is an overlay (not a scene switch)
- Game state preserved when pausing
- Transitions to other scenes work from pause menu

---

## Integration Testing Checklist

### Complete Game Flow Test

**Scenario: New Player Journey**

1. **Main Menu** → New Game
2. **Character Creation** → Create "TestHero" as Warrior
3. **World Scene** → Explore town, talk to NPC
4. **Combat** → Fight Slime, win, gain EXP + items
5. **Pause Menu** → Open with ESC
6. **Inventory** → Check loot, equip weapon
7. **Jobs** → View Warrior skills
8. **Crafting** → Craft Health Potion (if materials)
9. **Save** → Save game from Pause Menu
10. **Exit** → Close game
11. **Continue** → Load saved game from Main Menu
12. **Verify** → Character state restored

**Expected Result**: ✅ All systems work together seamlessly

---

### Data Flow Test

**Test Save/Load System**:

1. Create character, gain 3 levels, collect 10 items
2. Learn 2 jobs, equip 3 items, craft 1 item
3. Save game
4. Refresh browser (or close/reopen)
5. Load game
6. Verify:
   - [ ] Character level = 3
   - [ ] Inventory has 10 items
   - [ ] 2 jobs learned
   - [ ] 3 items equipped
   - [ ] Crafted item exists

---

### Manager Integration Test

**Test All Managers Work Together**:

1. **InventoryManager + CombatManager**:
   - Use consumable in combat → HP heals

2. **JobManager + CombatManager**:
   - Learn Mage → Use "Fireball" skill in combat

3. **CraftingManager + InventoryManager**:
   - Craft Iron Sword → Appears in inventory → Equip

4. **WorldManager + CombatManager**:
   - Spawn monster → Fight → Loot → Add to inventory

**Expected Result**: ✅ No conflicts, data syncs correctly

---

## Known Issues & Bugs

### 🐛 Current Bugs (To Be Fixed in Sprint 6)

1. **Missing Sprites**: All graphics are placeholders (colored rectangles)
2. **No Maps**: Tiled maps not created yet (town, forest, cave)
3. **No NPCs**: NPC interaction system exists but no NPC data
4. **No Monster Encounters**: Encounter system not wired to World Scene
5. **Combat AI Simple**: AI only uses basic attack
6. **No Sound**: No audio system implemented
7. **No Animations**: Character sprites static (no walk/attack animations)
8. **Save/Load UI**: No visual feedback on save success
9. **No Tutorials**: No in-game help or tutorials
10. **Balance Issues**: Monster stats, item prices, EXP curves not balanced

### ⚠️ Known Limitations (MVP Scope)

1. **Single-player only**: No multiplayer (WebRTC P2P in future)
2. **localStorage only**: No server backend (future: PostgreSQL)
3. **No Auction House**: UI exists but no backend
4. **No Player Shops**: System framework only
5. **No Quests**: Quest system not implemented
6. **1 Continent**: Limited to single continent (future: expand)
7. **Browser only**: Desktop/mobile apps not built yet

## Performance Testing

### FPS Monitoring

**Test Scenarios**:

1. **Idle Performance**:
   - Stand still in World Scene
   - Monitor FPS (should be 60 FPS)
   - CPU usage should be <10%

2. **Movement Performance**:
   - Move continuously for 2 minutes
   - FPS should remain stable at 60
   - No memory leaks (check DevTools)

3. **Combat Performance**:
   - Fight 10 consecutive battles
   - Monitor FPS during animations
   - Check for slowdowns

4. **Inventory Performance**:
   - Add 100 items to inventory
   - Open Inventory Scene
   - Scrolling should be smooth
   - Filter changes instant

**Tools**:
- Chrome DevTools → Performance tab
- Firefox Developer Tools → Performance
- FPS counter: `Ctrl+Shift+I` → Rendering → FPS meter

**Benchmarks**:
- **FPS**: 60 (stable)
- **Frame time**: <16.67ms
- **Memory**: <100MB
- **Load time**: <2 seconds

---

### Memory Leak Testing

**Test**: Run game for 30 minutes

**Steps**:
1. Open DevTools → Memory → Take snapshot
2. Play game normally (explore, combat, craft)
3. Take snapshot every 5 minutes (6 snapshots total)
4. Compare snapshot sizes

**Expected**: Memory should plateau, not continuously increase

**Red Flags**:
- Snapshot size increases by >20MB every 5 minutes
- Detached DOM nodes accumulate
- Event listeners not cleaned up

---

### Load Time Testing

**Measure**:
- Initial page load
- Scene transitions
- Data loading

**Targets**:
- Page load: <2 seconds
- Scene switch: <500ms
- Data load: <200ms

---

## User Acceptance Testing

### MVP Acceptance Criteria

**The game is ready for beta testing when**:

#### ✅ Core Functionality
- [ ] Can create new character
- [ ] Can explore world (move, navigate)
- [ ] Can engage in combat (turn-based)
- [ ] Can manage inventory (add, remove, equip)
- [ ] Can view and learn jobs
- [ ] Can craft items
- [ ] Can save and load game

#### ✅ Game Flow
- [ ] Main Menu → Character Creation → World → Combat works
- [ ] Pause Menu accessible from World Scene
- [ ] All UI scenes accessible (Inventory, Jobs, Crafting)
- [ ] Scene transitions smooth (no crashes)
- [ ] Return paths work (back to previous scene)

#### ✅ Data Persistence
- [ ] Save game stores character state
- [ ] Load game restores character state
- [ ] Inventory persists across sessions
- [ ] Jobs and equipment persist
- [ ] No data corruption

#### ✅ Stability
- [ ] No game-breaking bugs
- [ ] No infinite loops or freezes
- [ ] No crash on scene transitions
- [ ] Consistent 60 FPS performance
- [ ] Works in Chrome, Firefox, Safari

#### ✅ User Experience
- [ ] Controls are responsive
- [ ] Navigation is intuitive
- [ ] Visual feedback on actions
- [ ] No confusing UI states
- [ ] Error messages are helpful

---

### Beta Testing Plan

**Phase 1: Internal Testing (1 week)**
- Team plays through entire game flow
- Document all bugs in GitHub Issues
- Test on multiple browsers/OS
- Performance profiling

**Phase 2: Closed Beta (2 weeks)**
- Invite 10-20 testers
- Collect feedback via Google Forms
- Monitor Discord for bug reports
- Fix critical bugs

**Phase 3: Open Beta (4 weeks)**
- Public release
- Gather analytics (play time, drop-off points)
- Iterate based on feedback
- Prepare for v1.0 launch

---

### User Feedback Form

**Questions for Beta Testers**:

1. **Overall Experience** (1-5 stars)
2. **What did you enjoy most?** (open text)
3. **What frustrated you?** (open text)
4. **How intuitive were the controls?** (1-5 scale)
5. **Did you encounter any bugs?** (yes/no + description)
6. **How balanced did combat feel?** (too easy / just right / too hard)
7. **Would you recommend this game to a friend?** (yes/no)
8. **Any suggestions for improvement?** (open text)

---

## Future Testing Plans

### Post-MVP Testing (To Be Implemented)

These automated tests will be added after MVP launch:

#### 1. Unit Testing
- **Framework**: Vitest
- **Target Coverage**: >80%
- **Test Files**: `__tests__/` folders
- **Focus**: Combat calculations, inventory logic, job system

#### 2. Integration Testing
- **Framework**: Vitest + Testing Library
- **Focus**: Manager interactions, data flow
- **API Tests**: Server endpoints (when backend added)

#### 3. End-to-End Testing
- **Framework**: Playwright
- **Focus**: Complete user flows
- **Scenarios**: Registration, gameplay, trading

#### 4. Security Testing
- **Tools**: OWASP ZAP, npm audit
- **Focus**: XSS, SQL injection, authentication
- **Required**: Before multiplayer launch

#### 5. Load Testing
- **Tools**: Artillery, Apache Bench
- **Focus**: Server performance
- **Required**: Before scaling to 100+ users

---

## Test Checklist (MVP Release)

Before launching MVP beta:

- [ ] All 8 scenes load without errors
- [ ] Complete game flow tested (Main Menu → Combat → Save → Load)
- [ ] Save/Load verified on 3 browsers (Chrome, Firefox, Safari)
- [ ] Performance testing shows 60 FPS stable
- [ ] No memory leaks detected (30-minute test)
- [ ] All known bugs documented in GitHub Issues
- [ ] Critical bugs fixed (P0 issues)
- [ ] Scene navigation tested (all transitions work)
- [ ] Inventory, Jobs, Crafting scenes functional
- [ ] Combat system works (attack, skills, items, flee)
- [ ] Data persistence verified (localStorage)
- [ ] README.md updated with current status
- [ ] STATUS.md reflects accurate progress
- [ ] TESTING.md complete with all test cases

---

## Test Report Template

Use this template to document test results:

```markdown
# Test Report - [Date]

**Tester**: [Name]
**Build Version**: MVP Sprint 5
**Browser**: [Chrome/Firefox/Safari] [Version]
**OS**: [Windows/Mac/Linux]

## Test Results

### Scene Navigation
- Main Menu: ✅ Pass / ❌ Fail
- Character Creation: ✅ Pass / ❌ Fail
- World Scene: ✅ Pass / ❌ Fail
- Combat Scene: ✅ Pass / ❌ Fail
- Inventory Scene: ✅ Pass / ❌ Fail
- Job Scene: ✅ Pass / ❌ Fail
- Crafting Scene: ✅ Pass / ❌ Fail
- Pause Menu: ✅ Pass / ❌ Fail

### Performance
- FPS: [Average] (Target: 60)
- Load Time: [Seconds] (Target: <2s)
- Memory: [MB] (Target: <100MB)

### Bugs Found
1. [Description] - Severity: [Critical/High/Medium/Low]
2. [Description] - Severity: [Critical/High/Medium/Low]

### Feedback
[Open text feedback]

### Recommendation
- [ ] Ready for beta release
- [ ] Needs fixes before release
```

---

**For testing questions or bug reports, create an issue on GitHub.**

---

## Testing Strategy (Legacy - For Future Reference)

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
