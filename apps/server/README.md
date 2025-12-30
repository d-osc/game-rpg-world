# RPG Game Server

Elit-based backend server for authentication, save/load, and multiplayer coordination.

## Features

### ✅ Implemented
- **Authentication System**
  - User registration with validation
  - Login/logout with JWT tokens
  - Session management
  - Password hashing with bcrypt

- **Database Integration**
  - PostgreSQL connection pool
  - Complete database schema
  - Transaction support
  - Audit logging

- **Save/Load System**
  - Player profile management
  - Inventory persistence
  - Job system data
  - Skills tracking
  - Auto-save, manual save, checkpoints
  - Save history with snapshots

### ⏳ Planned (Phase 3+)
- WebSocket signaling for P2P
- Auction house API
- Player matchmaking
- Anti-cheat validation
- Global chat

## Setup

### Prerequisites
- Bun runtime
- PostgreSQL database

### Installation

1. Install dependencies:
```bash
cd apps/server
bun install
```

2. Setup environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials and JWT secret
```

3. Create database:
```bash
createdb rpg_game
```

4. Initialize database schema:
```bash
bun run src/database/init.ts
```

### Running the Server

Development (with auto-reload):
```bash
bun run dev
```

Production:
```bash
bun run start
```

## API Endpoints

### Health Check
```
GET /health
```

### Authentication

**Register**
```
POST /api/auth/register
Content-Type: application/json

{
  "username": "player1",
  "email": "player1@example.com",
  "password": "securepassword123"
}
```

**Login**
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "player1",
  "password": "securepassword123"
}
```

**Logout** (requires authentication)
```
POST /api/auth/logout
Authorization: Bearer <token>
```

### Save/Load (All require authentication)

**Load Save**
```
GET /api/save
Authorization: Bearer <token>
```

**Save Data**
```
POST /api/save
Authorization: Bearer <token>
Content-Type: application/json

{
  "saveType": "auto", // "auto", "manual", or "checkpoint"
  "saveData": {
    "profile": { ... },
    "jobs": [ ... ],
    "inventory": [ ... ],
    "skills": [ ... ]
  }
}
```

**Get Save History**
```
GET /api/save/history
Authorization: Bearer <token>
```

**Load Specific Snapshot**
```
GET /api/save/snapshot/:saveId
Authorization: Bearer <token>
```

## Database Schema

### Tables
- **players** - User accounts and authentication
- **player_profiles** - Game state and stats
- **player_jobs** - Multi-job system data
- **player_inventory** - Inventory with slot-based system
- **player_skills** - Skills learned from jobs
- **game_saves** - Save snapshots
- **sessions** - JWT token sessions
- **audit_logs** - Security and anti-cheat
- **transactions** - Economy tracking

See [schema.sql](./src/database/schema.sql) for complete schema.

## Architecture

### Modules

**Database** (`src/database/`)
- Connection pool management
- Query helpers
- Transaction support
- Schema initialization

**Auth** (`src/auth/`)
- AuthService: Registration, login, token management
- Middleware: Route protection
- JWT token generation and verification

**Save** (`src/save/`)
- SaveService: Load/save player data
- Snapshot management
- Auto-save cleanup

## Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with configurable expiration
- Session tracking and invalidation
- SQL injection prevention with parameterized queries
- Input validation on all endpoints
- Audit logging for security events

## Development

### Database Migrations

Re-initialize schema:
```bash
bun run src/database/init.ts
```

### Testing Connection

```bash
bun run src/database/config.ts
```

## Environment Variables

See [.env.example](./.env.example) for all available configuration options.

## Next Phase: WebSocket Integration

Phase 2 focuses on setting up the core authentication and save/load systems. Phase 3 will add:
- WebSocket signaling server for P2P connections
- Zone-based peer discovery
- Real-time communication infrastructure

---

**Status:** Phase 2 in progress
**Last Updated:** 2025-12-31
