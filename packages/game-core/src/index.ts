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

console.log('[@rpg/game-core] Loaded');
