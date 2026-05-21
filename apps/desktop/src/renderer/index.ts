/**
 * Desktop Renderer Entry Point
 * Three.js 3D renderer with HTML overlay for UI
 */

import { div } from 'elit/el';
import { createState, reactive } from 'elit/state';
import { render } from 'elit/dom';
import { CreateStyle } from 'elit/style';
import { gameLoop, EnhancedSceneManager, ThreeJSRenderer } from '@rpg/game-engine';
import { SceneTestScene } from '@rpg/game-core';

const css = new CreateStyle();
css.addTag('*', { margin: '0', padding: '0', boxSizing: 'border-box' });
css.addTag('body', {
	background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
	display: 'flex', flexDirection: 'column',
	alignItems: 'center', justifyContent: 'center',
	minHeight: '100vh', padding: '20px',
	fontFamily: 'Arial, sans-serif',
});
css.addClass('game-mount', {
	position: 'relative', display: 'inline-block', lineHeight: '0',
	width: '1280px', height: '720px',
});
css.addClass('game-mount canvas', {
	borderRadius: '8px', border: '3px solid rgba(255,255,255,0.3)',
	boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
});
css.addClass('html-overlay', {
	position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
	overflow: 'hidden', pointerEvents: 'none', transition: 'opacity 0.3s',
});
css.addClass('html-overlay > *', { pointerEvents: 'auto' });
css.addClass('transition-overlay', {
	position: 'absolute', inset: '0', background: '#000',
	pointerEvents: 'none', opacity: '0', borderRadius: '8px',
});
css.inject();

const loading = createState(true);

render('#app', div(
	reactive(loading, (isVisible) =>
		isVisible ? div({ style: 'color:#fff;text-align:center;font-size:1.2em;margin-top:20px;' }, 'Loading...') : div()
	),
));

const gameMount = document.getElementById('game-mount')!;
gameMount.className = 'game-mount';

const threeRenderer = new ThreeJSRenderer(gameMount, 1280, 720);

const overlayContainer = document.createElement('div');
overlayContainer.className = 'html-overlay';
gameMount.appendChild(overlayContainer);

const transitionOverlay = document.createElement('div');
transitionOverlay.className = 'transition-overlay';
gameMount.appendChild(transitionOverlay);

const sceneManager = EnhancedSceneManager.getInstance();
sceneManager.setThreeJSRenderer(threeRenderer);
sceneManager.setOverlayContainer(overlayContainer);
sceneManager.setTransitionElement(transitionOverlay);

gameLoop.onUpdate((deltaTime) => {
	sceneManager.update(deltaTime);
});

gameLoop.onRender(() => {
	sceneManager.render();
});

gameLoop.start();
console.log('[Desktop] Game loop started');

const testScene = new SceneTestScene();
sceneManager.addScene(testScene);

sceneManager.switchTo('SceneTest', { type: 'none', duration: 0 }).then(() => {
	loading.value = false;
	console.log('[Desktop] Game ready!');
}).catch((error) => {
	console.error('[Desktop] Error loading scene:', error);
});
