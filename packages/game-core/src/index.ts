// @rpg/game-core - Core game logic (RPG systems)

// ECS
export * from './systems/index';
export * from './components/index';

// Game systems
export * from './combat/index';
export * from './jobs/index';
export * from './world/index';
export * from './inventory/index';
export * from './economy/index';
export * from './entities/index';

// Scenes
export * from './scenes/index';

// UI
export * from './ui/index';

// Utils
export * from './utils/index';

// Examples - not exported by default to avoid unnecessary dependencies
// Import directly from '@rpg/game-core/examples' if needed

console.log('[@rpg/game-core] Loaded');
