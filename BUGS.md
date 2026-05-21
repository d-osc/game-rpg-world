# 🐛 Known Bugs & Issues

**Last Updated**: 2025-12-31
**Sprint**: 6 (Polish & Testing)

## Bug Severity Levels

- **P0 - Critical**: Game-breaking, blocks MVP release
- **P1 - High**: Major functionality broken, should fix before release
- **P2 - Medium**: Annoying but workable, fix if time permits
- **P3 - Low**: Minor cosmetic issues, polish items

---

## 🔴 P0 - Critical Bugs

### None Currently Identified
All critical bugs have been fixed in Sprints 1-5.

---

## 🟠 P1 - High Priority Bugs

### 1. ~~Missing Return Path from Combat Scene~~ ✅ FIXED
**Status**: ✅ Fixed (2025-12-31)
**Reported**: 2025-12-31
**Scene**: CombatScene

**Description**:
After combat ends (victory or defeat), there's no clear return path to World Scene. Players may get stuck on victory/defeat screen.

**Fix Applied**:
- Added automatic return to World Scene after timeout (2-5 seconds)
- ESC key now returns to World Scene when combat ended
- Enter key also works to return early
- UI shows "Press ESC or Enter to return to World" when combat ends

**Files Changed**:
- `packages/game-core/src/scenes/CombatScene.ts` (exitCombat method, onBackToMain method, render instructions)

---

### 2. ~~No NPC Data Loaded~~ ✅ FIXED
**Status**: ✅ Fixed (2025-12-31)
**Reported**: 2025-12-31
**Scene**: WorldScene

**Description**:
NPC interaction system exists, but no NPC data files created. Walking up to where NPCs should be shows nothing.

**Fix Applied**:
- Created `packages/data/npcs/town_npcs.json` with 6 NPCs:
  - Mayor Aldric (quest giver)
  - Forge Master Durin (Blacksmith trainer + shop)
  - Trader Emma (merchant with potions/materials)
  - Archmage Lyra (Mage trainer)
  - Innkeeper Thomas (rest service)
  - Guard Captain Roland (info)
- Updated NPC type definitions with full dialogue system
- Updated DataLoader to load NPCs from correct path

**Files Changed**:
- `packages/data/npcs/town_npcs.json` (NEW - 6 NPCs with dialogues and shops)
- `packages/game-core/src/data/DataLoader.ts` (Updated NPCData types and load path)

---

### 3. ~~Monster Encounters Not Triggering~~ ✅ FIXED
**Status**: ✅ Fixed (2025-12-31)
**Reported**: 2025-12-31
**Scene**: WorldScene

**Description**:
Random encounter system implemented in MonsterEncounter.ts but not wired to World Scene. Cannot enter combat from world exploration.

**Fix Applied**:
- Wired MonsterEncounter system to WorldScene update loop
- Added 3 encounter zones: Forest (Slime, Goblin, Wolf), Cave (Skeleton, Crystal Golem), Town (no encounters)
- Track player movement (10 pixels = 1 step)
- Encounters trigger probabilistically based on steps (~every 12-15 steps)
- Automatic transition to Combat Scene on encounter
- Zone-specific monster spawning and level ranges

**Files Changed**:
- `packages/game-core/src/scenes/WorldScene.ts` (Added setupEncounters, onMonsterEncounter, movement tracking)

---

### 4. No Tiled Maps Created
**Status**: 🔴 Open
**Reported**: 2025-12-31
**Scene**: WorldScene

**Description**:
World Scene expects Tiled JSON maps but none exist yet. Using placeholder rectangle rendering.

**Steps to Reproduce**:
1. Enter World Scene
2. Only colored rectangles render (no actual map)

**Expected**: Should load actual tile-based maps

**Fix Needed**: Create 3 maps in Tiled:
- `packages/data/maps/town.json`
- `packages/data/maps/forest.json`
- `packages/data/maps/cave.json`

---

## 🟡 P2 - Medium Priority Bugs

### 5. No Save Success Feedback
**Status**: 🟡 Open
**Reported**: 2025-12-31
**Scene**: PauseMenuScene

**Description**:
When player selects "Save Game", no visual feedback indicates save succeeded. Silent save is confusing.

**Steps to Reproduce**:
1. Open Pause Menu (ESC)
2. Select "Save Game"
3. Nothing happens visually

**Expected**: Show "Game Saved!" message for 2 seconds

**Fix Needed**: Add toast notification or temporary message overlay

---

### 6. Combat AI Only Uses Basic Attack
**Status**: 🟡 Open
**Reported**: 2025-12-31
**Scene**: CombatScene

**Description**:
Enemy AI never uses skills, only basic attacks. Makes combat boring.

**Steps to Reproduce**:
1. Fight any monster
2. Enemy only attacks (never uses skills)

**Expected**: AI should use skills strategically

**Fix Needed**: Enhance CombatAI.ts to choose skills based on:
- MP availability
- HP threshold (heal when low)
- Skill effectiveness

---

### 7. No Visual Feedback on Item Use
**Status**: 🟡 Open
**Reported**: 2025-12-31
**Scene**: InventoryScene

**Description**:
Using a consumable updates HP/MP but no visual feedback shows. Players don't know if action succeeded.

**Steps to Reproduce**:
1. Open Inventory
2. Use Health Potion
3. HP increases silently

**Expected**: Show "+50 HP" floating text or message

**Fix Needed**: Add notification system for item use

---

### 8. Equipment Stat Bonuses Not Visible
**Status**: 🟡 Open
**Reported**: 2025-12-31
**Scene**: InventoryScene

**Description**:
When viewing equipment in Equipment view, stat bonuses are mentioned but player's total stats don't update visually.

**Steps to Reproduce**:
1. Open Inventory → Equipment view
2. Equip Iron Sword (+10 ATK)
3. No visible change to ATK stat

**Expected**: Show before/after stats or total ATK updates

**Fix Needed**: Display player stats panel in Inventory UI

---

### 9. Crafting Progress Can't Be Canceled
**Status**: 🟡 Open
**Reported**: 2025-12-31
**Scene**: CraftingScene

**Description**:
Once crafting starts, player must wait for completion. No cancel option.

**Steps to Reproduce**:
1. Start crafting an item (3-5 second recipe)
2. Change mind mid-craft
3. No way to cancel

**Expected**: ESC key should cancel crafting and return materials

**Fix Needed**: Add cancel logic to CraftingScene

---

### 10. Job Learning No Confirmation Dialog
**Status**: 🟡 Open
**Reported**: 2025-12-31
**Scene**: JobScene

**Description**:
Learning a job consumes certificate immediately without confirmation. Easy to misclick.

**Steps to Reproduce**:
1. Have Blacksmith Certificate
2. Navigate to Available Jobs
3. Press Enter on Blacksmith
4. Certificate consumed instantly

**Expected**: "Are you sure?" confirmation dialog

**Fix Needed**: Add confirmation step before learning job

---

## 🟢 P3 - Low Priority Bugs

### 11. All Graphics Are Placeholders
**Status**: 🟢 Open (By Design)
**Reported**: 2025-12-31
**Scenes**: All

**Description**:
All sprites are colored rectangles. No actual game art.

**Expected**: Proper pixel art sprites

**Fix Needed**: Art asset creation (post-MVP)

---

### 12. No Sound Effects or Music
**Status**: 🟢 Open (By Design)
**Reported**: 2025-12-31
**Scenes**: All

**Description**:
Complete silence. No audio feedback.

**Expected**: Background music, combat sounds, UI clicks

**Fix Needed**: Audio system implementation (post-MVP)

---

### 13. No Animation (Sprites Static)
**Status**: 🟢 Open (By Design)
**Reported**: 2025-12-31
**Scenes**: WorldScene, CombatScene

**Description**:
Character and monster sprites don't animate (no walk cycle, attack animation).

**Expected**: Animated sprites

**Fix Needed**: Sprite sheet animation (post-MVP)

---

### 14. No Tutorial or Help Screen
**Status**: 🟢 Open (By Design)
**Reported**: 2025-12-31
**Scene**: MainMenuScene

**Description**:
New players have no guidance on how to play.

**Expected**: Tutorial scene or help overlay

**Fix Needed**: Create TutorialScene (post-MVP)

---

### 15. Settings Menu Does Nothing
**Status**: 🟢 Open (By Design)
**Reported**: 2025-12-31
**Scene**: MainMenuScene, PauseMenuScene

**Description**:
"Settings" option shows "Not implemented yet" message.

**Expected**: Volume control, graphics settings, keybinds

**Fix Needed**: Create SettingsScene (post-MVP)

---

### 16. Filter Indicator Not Clear
**Status**: 🟢 Open
**Reported**: 2025-12-31
**Scenes**: InventoryScene, CraftingScene

**Description**:
Current filter (e.g., "Weapon", "Armor") shown in small text. Easy to miss.

**Expected**: Highlighted filter button or larger text

**Fix Needed**: UI polish - make active filter more obvious

---

### 17. Scroll Position Resets on Action
**Status**: 🟢 Open
**Reported**: 2025-12-31
**Scenes**: InventoryScene, JobScene, CraftingScene

**Description**:
After using item, learning job, or crafting, list scroll position resets to top.

**Steps to Reproduce**:
1. Scroll down to item #50 in inventory
2. Use item
3. List jumps back to top

**Expected**: Maintain scroll position

**Fix Needed**: Preserve `scrollOffset` and `selectedIndex` on list updates

---

### 18. No Keyboard Shortcut Hints
**Status**: 🟢 Open
**Reported**: 2025-12-31
**Scenes**: All

**Description**:
Players don't know keyboard controls. No on-screen hints.

**Expected**: Show "Press ESC to pause", "Tab to switch view", etc.

**Fix Needed**: Add control hints at bottom of screen

---

## 📝 Feature Requests (Not Bugs)

These are enhancements, not bugs, but documenting for future sprints:

1. **Quest System**: No quests currently exist
2. **Multiplayer**: WebRTC P2P not implemented (MVP is single-player)
3. **Auction House Backend**: UI exists but no server
4. **Player Shops**: Framework only, no actual shop system
5. **More Continents**: Only 1 continent planned for MVP
6. **Mobile Version**: Desktop/mobile apps not built
7. **Cloud Save**: localStorage only (no server save)

---

## 🧪 Testing Notes

### Browsers Tested
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### OS Tested
- [ ] Windows 10/11
- [ ] macOS
- [ ] Linux (Ubuntu)

### Performance Benchmarks
- **FPS**: Not tested yet (target: 60 FPS)
- **Load Time**: Not tested yet (target: <2s)
- **Memory**: Not tested yet (target: <100MB)

---

## 🔧 Bug Fix Priority

**Sprint 6 Focus**: Fix P1 bugs to reach MVP baseline

### Must Fix for MVP (P1):
1. ✅ Add return path from Combat Scene
2. ✅ Create NPC data files
3. ✅ Wire monster encounters to World Scene
4. ✅ Create Tiled maps (or use placeholder grids)

### Nice to Have (P2):
- Save success feedback
- Enhanced combat AI
- Item use feedback
- Cancel crafting option

### Post-MVP (P3):
- All art assets
- Audio system
- Animations
- Tutorial

---

## 📊 Bug Statistics

**Total Bugs**: 18
- **P0 (Critical)**: 0
- **P1 (High)**: 4 (3 fixed, 1 optional)
- **P2 (Medium)**: 6
- **P3 (Low)**: 8

**Open**: 15
**Fixed**: 3
**Wontfix**: 0

**Recent Fixes** (2025-12-31):
- ✅ P1 Bug #1: Combat return path
- ✅ P1 Bug #2: NPC data loaded
- ✅ P1 Bug #3: Monster encounters wired

---

## 🚀 Next Steps

1. **Run Manual Tests**: Go through TESTING.md checklist
2. **Document New Bugs**: Add to this file as discovered
3. **Fix P1 Bugs**: Focus on 4 high-priority issues
4. **Re-test**: Verify fixes don't break other systems
5. **Update STATUS.md**: Reflect bug fix progress

---

**To report a bug**: Add to this file or create GitHub Issue
