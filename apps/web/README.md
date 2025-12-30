# RPG Game - Web Demo

Phase 1.5: First Playable Demo

## What This Demo Shows

This is the **first playable demo** of the custom game engine, integrating all core systems built in Phase 1:

- ✅ **Player Entity** - Blue circle that represents the player
- ✅ **Movement System** - WASD/Arrow key controls with smooth 8-directional movement
- ✅ **Map System** - Tiled map loading and rendering (checkerboard demo map)
- ✅ **Camera System** - Smooth camera following the player
- ✅ **Input System** - Keyboard input handling
- ✅ **Game Loop** - RequestAnimationFrame-based game loop
- ✅ **Scene Management** - Scene lifecycle (load, update, render)
- ✅ **Debug Overlay** - Press F3 to see FPS, position, velocity

## How to Run

### Option 1: Using Bun (Recommended)

```bash
# From project root
cd apps/web
bun run dev
```

Then open http://localhost:3000 in your browser.

### Option 2: Using a Simple HTTP Server

Since the code uses ES modules, you need a local server:

```bash
# Using Python
cd apps/web
python -m http.server 8000

# Using Node.js http-server
cd apps/web
npx http-server -p 8000

# Using PHP
cd apps/web
php -S localhost:8000
```

Then open http://localhost:8000 in your browser.

### Option 3: Using Vite

```bash
# From project root
cd apps/web
bun add -D vite
bunx vite
```

## Controls

- **WASD** or **Arrow Keys** - Move the player
- **F3** - Toggle debug information overlay

## What You'll See

- A blue circle (the player) on a green checkerboard map
- The player moves in 8 directions based on your input
- A white line indicates the direction the player is facing
- The camera smoothly follows the player
- A debug overlay shows:
  - FPS (frames per second)
  - Player position
  - Player velocity
  - Movement state
  - Current animation state
  - Camera position

## Architecture

This demo uses:

- **@rpg/game-engine** - Custom 2D game engine (Phase 1)
  - GameLoop, Time, Scene management
  - Canvas2D Renderer with Camera
  - Input system (Keyboard)
  - Math utilities (Vector2, AABB)

- **@rpg/game-core** - Game logic layer (Phase 1.5)
  - Player entity
  - MovementSystem
  - TiledMapLoader
  - DemoScene

## Next Steps

Phase 2 will add:
- Elit server integration
- Authentication system
- Save/load functionality
- PostgreSQL database
- WebSocket connections

---

**Phase 1.5 Complete!** 🎉

All custom game engine systems are now validated and working together.
