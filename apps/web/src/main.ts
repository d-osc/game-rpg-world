/**
 * Main Entry Point
 * Initialize game engine and start demo
 */

import { gameLoop, sceneManager } from '@rpg/game-engine';
import { DemoScene } from '@rpg/game-core/scenes/DemoScene';

// Wait for DOM to be ready
window.addEventListener('DOMContentLoaded', () => {
  console.log('[Main] Initializing game...');

  // Create canvas
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('[Main] Canvas element not found!');
    return;
  }

  // Set canvas size
  canvas.width = 800;
  canvas.height = 600;

  // Get rendering context
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[Main] Failed to get 2D context!');
    return;
  }

  // Create and register demo scene
  const demoScene = new DemoScene();
  sceneManager.addScene(demoScene);

  // Load and switch to demo scene
  sceneManager.switchTo('DemoScene').then(() => {
    console.log('[Main] Demo scene loaded');

    // Setup game loop callbacks
    gameLoop.onUpdate((deltaTime) => {
      sceneManager.update(deltaTime);
    });

    gameLoop.onRender((deltaTime) => {
      sceneManager.render(ctx);
    });

    // Start game loop
    gameLoop.start();

    console.log('[Main] Game started!');
    console.log('[Main] Use WASD or Arrow keys to move');
    console.log('[Main] Press F3 to toggle debug info');
  });
});
