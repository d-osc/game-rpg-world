/**
 * Main Entry Point
 * Three.js 3D renderer with HTML overlay for UI and MMO networking
 */

import { CreateStyle } from 'elit/style';
import { gameLoop, EnhancedSceneManager, ThreeJSRenderer } from '@rpg/game-engine';
import {
	SceneTestScene, MainMenuScene, CharacterCreationScene,
	WorldScene, CombatScene, InventoryScene, JobScene,
	CraftingScene, PauseMenuScene,
} from '@rpg/game-core';

// Inject styles
const css = new CreateStyle();
css.addTag('*', { margin: '0', padding: '0', boxSizing: 'border-box' });
css.addTag('html, body', {
	width: '100%', height: '100%', overflow: 'hidden',
	fontFamily: 'Arial, sans-serif', background: '#000',
});
css.addTag('#app', {
	display: 'none',
});
css.addClass('game-mount', {
	position: 'fixed', top: '0', left: '0',
	width: '100vw', height: '100vh',
	lineHeight: '0',
});
css.addClass('game-mount canvas', {
	width: '100%', height: '100%', display: 'block',
});
css.addClass('html-overlay', {
	position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
	overflow: 'hidden', pointerEvents: 'none', transition: 'opacity 0.3s',
});
css.addClass('html-overlay > *', {
	pointerEvents: 'auto',
});
css.addClass('transition-overlay', {
	position: 'absolute', inset: '0', background: '#000',
	pointerEvents: 'none', opacity: '0', transition: 'none',
});
css.inject();

// Loading state — show a simple centered text until game loads
const loadingDiv = document.createElement('div');
loadingDiv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.4em;background:#000;z-index:9999;font-family:Arial,sans-serif;';
loadingDiv.textContent = 'Loading...';
document.body.appendChild(loadingDiv);

// Setup game mount area
const gameMount = document.getElementById('game-mount')!;
gameMount.className = 'game-mount';

// Initialize Three.js renderer at full viewport size
const width = window.innerWidth;
const height = window.innerHeight;
const threeRenderer = new ThreeJSRenderer(gameMount, width, height);

// Create HTML overlay container
const overlayContainer = document.createElement('div');
overlayContainer.className = 'html-overlay';
gameMount.appendChild(overlayContainer);

// Create transition overlay
const transitionOverlay = document.createElement('div');
transitionOverlay.className = 'transition-overlay';
gameMount.appendChild(transitionOverlay);

// Setup scene manager
const sceneManager = EnhancedSceneManager.getInstance();
sceneManager.setThreeJSRenderer(threeRenderer);
sceneManager.setOverlayContainer(overlayContainer);
sceneManager.setTransitionElement(transitionOverlay);

// Register ALL scenes
sceneManager.addScene(new SceneTestScene());
sceneManager.addScene(new MainMenuScene());
sceneManager.addScene(new CharacterCreationScene());
sceneManager.addScene(new WorldScene());
sceneManager.addScene(new CombatScene());
sceneManager.addScene(new InventoryScene());
sceneManager.addScene(new JobScene());
sceneManager.addScene(new CraftingScene());
sceneManager.addScene(new PauseMenuScene());

// Game loop
gameLoop.onUpdate((deltaTime) => {
	sceneManager.update(deltaTime);
});

gameLoop.onRender(() => {
	sceneManager.render();
});

// Keep renderer fullscreen on window resize
window.addEventListener('resize', () => {
	threeRenderer.resize(window.innerWidth, window.innerHeight);
});

gameLoop.start();
console.log('[Main] Game loop started');

// Start at MainMenu for a playable game experience
sceneManager.switchTo('MainMenu', { type: 'fade', duration: 800 }).then(() => {
	loadingDiv.remove();
	console.log('[Main] Main menu loaded');
}).catch((error) => {
	console.error('[Main] Error loading main menu:', error);
	// Fallback to SceneTest if MainMenu fails
	sceneManager.switchTo('SceneTest', { type: 'none', duration: 0 }).then(() => {
		loadingDiv.remove();
	});
});
