// @rpg/game-core - Core game logic (RPG systems)

// ECS
export * from './systems/index.ts';
export * from './components/index.ts';

// Game systems
export * from './combat/index.ts';
export * from './jobs/index.ts';
export * from './world/index.ts';
export * from './inventory/index.ts';
export * from './economy/index.ts';
export * from './entities/index.ts';

// Scenes
export * from './scenes/index.ts';

// UI
export * from './ui/index.ts';

// Utils
export * from './utils/index.ts';

// Examples - not exported by default to avoid unnecessary dependencies
// Import directly from '@rpg/game-core/examples' if needed

console.log('[@rpg/game-core] Loaded');
