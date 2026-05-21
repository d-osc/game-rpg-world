/**
 * Mobile App Main Entry Point
 * Uses elit for DOM structure, state, and styling
 */

import { canvas, div } from 'elit/el';
import { createState, reactive } from 'elit/state';
import { render } from 'elit/dom';
import { CreateStyle } from 'elit/style';
import { gameLoop, EnhancedSceneManager } from '@rpg/game-engine';
import { SceneTestScene } from '@rpg/game-core';
import { MobileGame } from './index';

// Inject mobile styles
const css = new CreateStyle();
css.addTag('*', { margin: '0', padding: '0', boxSizing: 'border-box' });
css.addTag('html, body', {
  width: '100%', height: '100%', overflow: 'hidden',
  background: '#000', touchAction: 'none',
  webkitTouchCallout: 'none', webkitUserSelect: 'none', userSelect: 'none',
});
css.inject();

// Loading state
const loading = createState(true);

// Build the app shell
const gameCanvas = canvas({ id: 'game-canvas' }) as unknown as HTMLCanvasElement;

const loadingOverlay = reactive(loading, (isVisible) =>
  isVisible
    ? div(
        { style: 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-family:Arial;text-align:center;' },
        div({ style: 'border:3px solid rgba(255,255,255,0.3);border-top:3px solid #fff;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:20px auto;' }),
        div('Loading...')
      )
    : div()
);

const app = div({ id: 'app' }, gameCanvas, loadingOverlay);

render('#app', app);

// Full viewport canvas
const resizeCanvas = () => {
  gameCanvas.width = window.innerWidth;
  gameCanvas.height = window.innerHeight;
};
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100));

const ctx = gameCanvas.getContext('2d');
if (!ctx) {
  console.error('[Mobile] Failed to get 2D context!');
  throw new Error('Canvas 2D not supported');
}

// Get scene manager
const sceneManager = EnhancedSceneManager.getInstance();

// Setup game loop
gameLoop.onUpdate((deltaTime) => {
  sceneManager.update(deltaTime);
});

gameLoop.onRender(() => {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
  sceneManager.render(ctx);
});

gameLoop.start();
console.log('[Mobile] Game loop started');

// Register test scene
const testScene = new SceneTestScene();
sceneManager.addScene(testScene);

sceneManager.switchTo('SceneTest', { type: 'none', duration: 0 }).then(() => {
  loading.value = false;
  console.log('[Mobile] Game ready!');
}).catch((error) => {
  console.error('[Mobile] Error loading scene:', error);
});

// Initialize mobile controls overlay
const mobileGame = new MobileGame(document.body);
console.log('[Mobile] Touch controls initialized');
