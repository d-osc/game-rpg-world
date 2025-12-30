// @rpg/game-engine - Custom 2D Game Engine

// Core
export * from './core/GameLoop.ts';
export * from './core/Time.ts';
export * from './core/Scene.ts';

// Renderer
export * from './renderer/Canvas2DRenderer.ts';
export * from './renderer/Camera.ts';
export * from './renderer/RemotePlayerRenderer.ts';

// Physics
export * from './physics/index.ts';

// Input
export * from './input/index.ts';

// Assets
export * from './assets/index.ts';

// Animation
export * from './animation/index.ts';

// Math
export * from './math/Vector2.ts';
export * from './math/Rectangle.ts';

console.log('[@rpg/game-engine] Loaded');
