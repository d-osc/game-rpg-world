# RPG - 2D Multiplayer RPG Game

A 2D multiplayer RPG game with turn-based combat (Pokemon-style), multi-job system, open world, and complex economy.

## Tech Stack

- **Runtime**: Bun + TypeScript
- **Framework**: Elit@3.0.9
- **Game Engine**: Custom-built
- **ECS**: bitECS
- **Networking**: WebRTC (P2P) + Elit Server (Hybrid)
- **Database**: PostgreSQL (server), IndexedDB (client)

## Project Structure

```
rpg/
├── packages/          # Shared libraries
│   ├── shared/        # Shared types, constants, utils
│   ├── game-engine/   # Custom 2D game engine
│   ├── game-core/     # Core game logic (RPG systems)
│   ├── networking/    # P2P networking layer
│   └── data/          # Game data (JSON)
│
├── apps/              # Applications
│   ├── web/           # Web browser client
│   ├── server/        # Elit backend server
│   ├── desktop/       # Electron desktop app
│   └── mobile/        # Capacitor mobile app
│
├── tools/             # Development tools
└── scripts/           # Build scripts
```

## Development

```bash
# Install dependencies
bun install

# Run web client
bun run dev

# Run server
bun run dev:server

# Type check
bun run type-check

# Lint
bun run lint

# Format
bun run format
```

## Features (Planned)

- ✅ Phase 0: Project Setup (COMPLETED)
- ⏳ Phase 1: Custom Game Engine Foundation
- ⏳ Phase 2: Server + Auth
- ⏳ Phase 3: P2P Networking
- ⏳ Phase 4: Turn-based Combat
- ⏳ Phase 5: Inventory System
- ⏳ Phase 6: Multi-Job System
- ⏳ Phase 7: World & Maps
- ⏳ Phase 8: Economy (Crafting & Trading)
- ⏳ Phase 9: Auction House
- ⏳ Phase 10: Player Shops
- ⏳ Phase 11: PvP Arena
- ⏳ Phase 12: Desktop App
- ⏳ Phase 13: Mobile App
- ⏳ Phase 14: Polish & Balance
- ⏳ Phase 15: Testing & Launch

## Documentation

- [Project Plan](./.claude/plans/humble-swinging-manatee.md)
- [Project Status](./PROJECT_STATUS.md)

## License

Private project
