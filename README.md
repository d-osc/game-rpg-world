# RPG - 2D Multiplayer RPG Game

A 2D multiplayer RPG game with turn-based combat (Pokemon-style), multi-job system, open world, and complex economy.

**Current Status:** 🎮 **Phase 3 Complete - P2P Networking Ready!**

## 🎯 Quick Start - Play the Demo!

```bash
# Install dependencies
bun install

# Run the demo
cd apps/web
bun run dev
```

Open http://localhost:5173 and use **WASD** or **Arrow Keys** to move!

## ✨ What's Working Now

### Phase 3: P2P Networking ✅
- ✅ **WebSocket Signaling**: Server with JWT authentication on port 3001
- ✅ **WebRTC P2P**: Mesh networking between players in same zone
- ✅ **Zone Discovery**: Automatic peer discovery when joining zones
- ✅ **Data Channels**: Low-latency (unordered, no retransmit) for game data
- ✅ **StateSync**: Position synchronization framework with interpolation
- ✅ **NetworkManager**: High-level coordinator for signaling + WebRTC
- ✅ **Auto-Reconnect**: Exponential backoff on disconnection
- ✅ **Chat System**: P2P text chat with ChatManager and ChatUI
- ✅ **RemotePlayerRenderer**: Render remote players with name tags and interpolation

### Phase 2: Backend Server ✅
- ✅ **Elit Server**: Full HTTP server with routing and error handling
- ✅ **PostgreSQL Database**: Complete schema with 9 tables
- ✅ **Authentication**: User registration, login, JWT tokens, session management
- ✅ **Save/Load System**: Player data persistence with history and snapshots
- ✅ **Security**: Password hashing (bcrypt), JWT verification, audit logging
- ✅ **API Endpoints**: Register, login, logout, save, load, history

### Phase 1.5: First Playable Demo ✅
- ✅ Player movement with WASD/Arrow controls
- ✅ Smooth camera following the player
- ✅ Map rendering system (Tiled format support)
- ✅ Debug overlay (press F3)
- ✅ All custom engine systems integrated and validated

### Phase 1: Custom Game Engine ✅
- ✅ **Core Systems**: GameLoop, Time management, Scene management
- ✅ **Renderer**: Canvas2D renderer with camera (follow, zoom, shake)
- ✅ **Physics**: AABB collision, Quadtree spatial partitioning, RigidBody
- ✅ **Assets**: Image/audio/JSON loading, TextureAtlas, SpriteManager
- ✅ **Input**: Keyboard, Mouse, Touch with gesture recognition
- ✅ **Animation**: Sprite animations, state machine, Tweening (20+ easing functions)

### Phase 0: Project Setup ✅
- ✅ Bun + TypeScript monorepo
- ✅ ESLint + Prettier
- ✅ Complete project structure

## 🏗️ Tech Stack

- **Runtime**: Bun + TypeScript
- **Framework**: Elit@3.0.9 (for server & UI)
- **Game Engine**: Custom-built 2D engine (fully functional!)
- **ECS**: bitECS
- **Desktop**: Electron (planned)
- **Mobile**: Capacitor (planned)
- **Networking**: WebRTC (P2P) + Elit Server (Hybrid)
- **Database**: PostgreSQL (server), IndexedDB (client)

## 📁 Project Structure

```
rpg/
├── packages/
│   ├── shared/           # Shared types, constants, utils
│   ├── game-engine/      # ✅ Custom 2D game engine (COMPLETE!)
│   │   ├── core/         # GameLoop, Time, Scene
│   │   ├── renderer/     # Canvas2D renderer, Camera
│   │   ├── physics/      # AABB, Collision, Quadtree, RigidBody
│   │   ├── assets/       # AssetLoader, TextureAtlas, SpriteManager, AudioManager
│   │   ├── input/        # Keyboard, Mouse, Touch
│   │   ├── animation/    # SpriteAnimation, Animator, Tween
│   │   └── math/         # Vector2, Rectangle
│   ├── game-core/        # ✅ Core game logic (Player, Movement, Maps)
│   │   ├── entities/     # Player entity
│   │   ├── systems/      # MovementSystem
│   │   ├── world/        # TiledMapLoader
│   │   └── scenes/       # DemoScene
│   ├── networking/       # ✅ P2P networking layer (COMPLETE!)
│   │   ├── webrtc/       # PeerManager, WebRTC connections
│   │   ├── signaling/    # SignalingClient
│   │   ├── sync/         # StateSync
│   │   └── peer-manager/ # NetworkManager
│   └── data/             # Game data (JSON)
│
├── apps/
│   ├── web/              # ✅ Web browser client (WORKING!)
│   ├── server/           # ✅ Elit backend server (COMPLETE!)
│   │   ├── auth/         # Authentication (JWT, bcrypt)
│   │   ├── database/     # PostgreSQL config & schema
│   │   ├── save/         # Save/load system
│   │   └── signaling/    # WebSocket signaling (Phase 3)
│   ├── desktop/          # Electron desktop app (planned)
│   └── mobile/           # Capacitor mobile app (planned)
│
└── tools/                # Development tools
```

## 🎮 Development Commands

```bash
# Install dependencies
bun install

# Run web demo (client)
cd apps/web
bun run dev
# Open http://localhost:5173

# Run backend server
cd apps/server
bun run dev
# Server runs on http://localhost:3000

# Setup database (first time only)
cd apps/server
cp .env.example .env  # Edit with your PostgreSQL credentials
createdb rpg_game
bun run src/database/init.ts

# Type check all packages
bun run type-check

# Lint code
bun run lint

# Format code
bun run format
```

## 📊 Progress (29% Complete)

### Completed Phases ✅

- **Phase 0**: Project Setup (1 week) ✅
- **Phase 1**: Custom Game Engine Foundation (5 weeks) ✅
  - Week 1: Core Engine Architecture ✅
  - Week 2: Rendering Engine ✅
  - Week 3: Math & Physics Foundation ✅
  - Week 4: Asset Management ✅
  - Week 5: Input & Animation ✅
- **Phase 1.5**: First Playable Demo (1 week) ✅
- **Phase 2**: Elit Server + Auth (2 weeks) ✅
- **Phase 3**: P2P Networking (3 weeks) ✅

### Upcoming Phases ⏳

- **Phase 4**: Turn-based Combat System (4 weeks) - NEXT
- **Phase 5**: Inventory & Items (2 weeks)
- **Phase 6**: Multi-Job System (2 weeks)
- **Phase 7**: World & Maps (3 weeks)
- **Phase 8**: Economy - Crafting & Trading (3 weeks)
- **Phase 9**: Auction House (2 weeks)
- **Phase 10**: Player Shops (2 weeks)
- **Phase 11**: PvP Arena (2 weeks)
- **Phase 12**: Desktop App (2 weeks)
- **Phase 13**: Mobile App (4 weeks)
- **Phase 14**: Polish & Balance (5 weeks)
- **Phase 15**: Testing & Launch (4 weeks)

**Total Duration:** ~47 weeks (12 months)
**Current Progress:** 5/17 phases (29%)

## 🎨 Custom Game Engine Features

Our custom-built engine includes:

### Core Systems
- **GameLoop**: RequestAnimationFrame-based with FPS tracking
- **Time**: Delta time, FPS counter, time scaling
- **Scene**: Scene management with lifecycle (load, update, render, destroy)

### Rendering
- **Canvas2D Renderer**: Optimized 2D rendering
- **Camera**: Follow target, zoom, shake effects, bounds
- **Layers**: Background, entity, UI layer support
- **Sprite Manager**: Batching, caching, transformations

### Physics
- **AABB**: Axis-aligned bounding box collisions
- **Collision Detection**: Multiple algorithms (AABB, Circle, Raycast, Sweep)
- **Quadtree**: Spatial partitioning for efficient collision
- **RigidBody**: Physics simulation with 3 integration methods

### Assets
- **AssetLoader**: Images, audio, JSON, fonts with progress tracking
- **TextureAtlas**: Sprite sheet support with JSON parsing
- **SpriteSheet**: Grid-based sprite sheets
- **AudioManager**: Sound effects, music, volume control, crossfade

### Input
- **Keyboard**: Full keyboard state tracking
- **Mouse**: Button states, position, wheel, pointer lock
- **Touch**: Multi-touch, gestures (tap, double-tap, pinch, swipe)

### Animation
- **SpriteAnimation**: Frame-based animation system
- **Animator**: Animation state machine with transitions
- **Tween**: Property interpolation with 20+ easing functions

## 🎯 Game Features (Planned)

### Core Gameplay
- **Turn-Based Combat**: Pokemon-style combat system
- **Multi-Job System**: Learn unlimited jobs via certificates
- **Open World**: Multiple continents with towns and hunting zones
- **Player Freedom**: Explore, fight, craft, trade at your own pace

### Economy
- **In-Game Currency**: Earned through gameplay, server-validated
- **P2P Trading**: Face-to-face trading between players
- **Auction House**: Centralized marketplace
- **Crafting**: Job-based crafting system
- **Player Shops**: Open your own shop on the map

### Multiplayer
- **Hybrid P2P + Server**: Best of both worlds
- **P2P**: Real-time gameplay, combat, trading, local chat
- **Server**: Auction house, matchmaking, anti-cheat, global chat
- **PvP Arena**: Ranked matchmaking with leaderboard

## 📚 Documentation

- [Project Plan](./.claude/plans/humble-swinging-manatee.md) - Detailed implementation plan
- [Project Status](./PROJECT_STATUS.md) - Detailed progress tracking
- [Web Demo README](./apps/web/README.md) - How to run the playable demo

## 🚀 Recent Achievements

**Phase 3 Complete (2025-12-31):**
- WebSocket signaling server with JWT authentication on port 3001
- Complete WebRTC P2P mesh networking between peers
- Zone-based peer discovery system
- Low-latency data channels (unordered, no retransmit)
- StateSync framework with position synchronization
- NetworkManager coordinator for signaling + WebRTC
- Auto-reconnect with exponential backoff
- P2P chat system with ChatManager and ChatUI
- RemotePlayerRenderer with interpolation and name tags
- Integration example with NetworkingExample.ts
- Ready for real-time multiplayer gameplay

**Phase 2 Complete (2025-12-31):**
- Complete backend server infrastructure with Elit
- PostgreSQL database with comprehensive schema (9 tables)
- Full authentication system (register, login, JWT, sessions)
- Save/load system with history and snapshots
- Security features: bcrypt password hashing, JWT verification, audit logging
- All API endpoints documented and tested
- Server ready for Phase 3 P2P networking

**Phase 1.5 Complete (2025-12-31):**
- Created first playable demo with player movement
- Integrated all custom engine systems
- Validated GameLoop, Scene, Renderer, Input, and Camera
- Complete Tiled map loading and rendering
- Debug overlay with FPS and stats

**Phase 1 Complete (2025-12-31):**
- Built complete custom 2D game engine from scratch
- 20+ engine files, ~5000 lines of code
- All core systems working: Core, Renderer, Physics, Assets, Input, Animation

## 🎮 Try It Now!

```bash
git clone <repo-url>
cd rpg
bun install
cd apps/web
bun run dev
```

Visit http://localhost:5173 and start playing!

**Controls:**
- **WASD** or **Arrow Keys** - Move player
- **F3** - Toggle debug info

## 📝 License

Private project

---

**Status:** P2P Networking complete! 🎉
**Next:** Phase 4 - Turn-based Combat System
