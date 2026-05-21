/**
 * Enhanced Scene Manager
 * Supports scene stacks, overlays, and transitions
 * Dispatches rendering to Three.js 3D or HTML overlay based on SceneType
 */

import * as THREE from 'three';
import { Scene, SceneType } from './Scene';

export type TransitionType = 'none' | 'fade' | 'slide';

export interface SceneTransition {
	type: TransitionType;
	duration: number; // in milliseconds
	color?: string; // for fade transitions
}

export interface SceneStackEntry {
	scene: Scene;
	isPaused: boolean;
}

/**
 * Enhanced Scene Manager with Stack Support
 */
export class EnhancedSceneManager {
	private static instance: EnhancedSceneManager;

	private scenes: Map<string, Scene> = new Map();
	private sceneStack: SceneStackEntry[] = [];

	private isTransitioning: boolean = false;
	private transitionProgress: number = 0;
	private transitionDuration: number = 0;
	private transitionType: TransitionType = 'none';
	private transitionColor: string = '#000000';
	private transitionCallback: (() => void) | null = null;

	// Three.js resources (shared across all THREE_3D scenes)
	private threeScene: THREE.Scene | null = null;
	private threeJSRenderer: import('../renderer/ThreeJSRenderer').ThreeJSRenderer | null = null;

	// HTML overlay container
	private overlayContainer: HTMLDivElement | null = null;
	private currentOverlayEl: HTMLElement | null = null;

	// Transition overlay element (for CSS-based fades)
	private transitionEl: HTMLDivElement | null = null;

	private constructor() {}

	static getInstance(): EnhancedSceneManager {
		if (!EnhancedSceneManager.instance) {
			EnhancedSceneManager.instance = new EnhancedSceneManager();
		}
		return EnhancedSceneManager.instance;
	}

	// ========================================================================
	// Renderer Setup
	// ========================================================================

	setThreeJSRenderer(renderer: import('../renderer/ThreeJSRenderer').ThreeJSRenderer): void {
		this.threeJSRenderer = renderer;
		this.threeScene = new THREE.Scene();

		const ambient = new THREE.AmbientLight(0xffffff, 0.6);
		this.threeScene.add(ambient);

		const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
		dirLight.position.set(5, 10, 5);
		dirLight.castShadow = true;
		this.threeScene.add(dirLight);

		console.log('[SceneManager] ThreeJSRenderer set up');
	}

	setOverlayContainer(container: HTMLDivElement): void {
		this.overlayContainer = container;
		console.log('[SceneManager] Overlay container set');
	}

	setTransitionElement(el: HTMLDivElement): void {
		this.transitionEl = el;
		console.log('[SceneManager] Transition element set');
	}

	get threeSceneRef(): THREE.Scene | null {
		return this.threeScene;
	}

	// ========================================================================
	// Scene Registration
	// ========================================================================

	addScene(scene: Scene): void {
		if (this.scenes.has(scene.name)) {
			console.warn(`[SceneManager] Scene "${scene.name}" already registered`);
			return;
		}
		this.scenes.set(scene.name, scene);
		console.log(`[SceneManager] Registered scene: ${scene.name}`);
	}

	removeScene(name: string): void {
		const scene = this.scenes.get(name);
		if (!scene) {
			console.warn(`[SceneManager] Scene "${name}" not found`);
			return;
		}

		const inStack = this.sceneStack.some((entry) => entry.scene === scene);
		if (inStack) {
			console.warn(`[SceneManager] Cannot remove active scene "${name}". Pop it first.`);
			return;
		}

		scene.destroy();
		this.scenes.delete(name);
		console.log(`[SceneManager] Removed scene: ${name}`);
	}

	getScene(name: string): Scene | undefined {
		return this.scenes.get(name);
	}

	// ========================================================================
	// Scene Stack Management
	// ========================================================================

	async switchTo(
		name: string,
		transition: SceneTransition = { type: 'fade', duration: 300 }
	): Promise<void> {
		if (this.isTransitioning) { console.warn("[SceneManager] Transition in progress, ignoring switchTo()"); return; }
		const scene = this.scenes.get(name);
		if (!scene) {
			console.error(`[SceneManager] Scene "${name}" not found`);
			return;
		}

		if (transition.type !== 'none') {
			await this.startTransition(transition, async () => {
				await this.clearStack();
				await this.pushSceneToStack(scene);
			});
		} else {
			await this.clearStack();
			await this.pushSceneToStack(scene);
		}

		console.log(`[SceneManager] Switched to: ${name}`);
	}

	async push(
		name: string,
		pauseBelow: boolean = true,
		transition: SceneTransition = { type: 'none', duration: 0 }
	): Promise<void> {
		if (this.isTransitioning) { console.warn("[SceneManager] Transition in progress, ignoring push()"); return; }
		const scene = this.scenes.get(name);
		if (!scene) {
			console.error(`[SceneManager] Scene "${name}" not found`);
			return;
		}

		if (pauseBelow && this.sceneStack.length > 0) {
			this.sceneStack[this.sceneStack.length - 1]!.isPaused = true;
		}

		if (transition.type !== 'none') {
			await this.startTransition(transition, async () => {
				await this.pushSceneToStack(scene);
			});
		} else {
			await this.pushSceneToStack(scene);
		}

		console.log(`[SceneManager] Pushed scene: ${name}`);
	}

	async pop(
		transition: SceneTransition = { type: 'none', duration: 0 }
	): Promise<void> {
		if (this.isTransitioning) { console.warn("[SceneManager] Transition in progress, ignoring pop()"); return; }
		if (this.sceneStack.length === 0) {
			console.warn('[SceneManager] Cannot pop: stack is empty');
			return;
		}

		const topEntry = this.sceneStack[this.sceneStack.length - 1]!;

		if (transition.type !== 'none') {
			await this.startTransition(transition, () => {
				this.popSceneFromStack();
			});
		} else {
			this.popSceneFromStack();
		}

		console.log(`[SceneManager] Popped scene: ${topEntry.scene.name}`);
	}

	private async clearStack(): Promise<void> {
		while (this.sceneStack.length > 0) {
			const entry = this.sceneStack.pop()!;
			this.cleanupScene(entry.scene);
			entry.scene.onExit();
		}
		this.clearOverlay();
		this.clearThreeScene();
	}

	private async pushSceneToStack(scene: Scene): Promise<void> {
		try {
			if (!scene.isInitialized) {
				await scene.load();
				(scene as any)._isInitialized = true;
			}

			this.sceneStack.push({ scene, isPaused: false });
			scene.onEnter();

			// Mount HTML overlay if needed
			if (scene.sceneType === SceneType.HTML_OVERLAY) {
				this.mountOverlay(scene);
			}
			// THREE_3D scenes can also have HTML overlay UI (e.g., combat UI)
			if (scene.sceneType === SceneType.THREE_3D && scene.renderHTML) {
				this.mountOverlay(scene);
			}
		} catch (error) {
			console.error('[SceneManager] Failed to load/enter scene:', scene.name, error);
			this.isTransitioning = false;
			this.transitionCallback = null;
		}
	}

	private popSceneFromStack(): void {
		if (this.sceneStack.length === 0) return;

		const entry = this.sceneStack.pop()!;
		this.cleanupScene(entry.scene);
		entry.scene.onExit();

		this.clearOverlay();

		if (this.sceneStack.length > 0) {
			const top = this.sceneStack[this.sceneStack.length - 1]!;
			top.isPaused = false;

			if (top.scene.sceneType === SceneType.HTML_OVERLAY) {
				this.mountOverlay(top.scene);
			}
			if (top.scene.sceneType === SceneType.THREE_3D && top.scene.renderHTML) {
				this.mountOverlay(top.scene);
			}
		}
	}

	private cleanupScene(scene: Scene): void {
		if (scene.sceneType === SceneType.THREE_3D && this.threeScene) {
			const toRemove: THREE.Object3D[] = [];
			this.threeScene.traverse((child) => {
				if (child.userData._sceneOwner === scene.name) {
					toRemove.push(child);
				}
			});
			for (const obj of toRemove) {
				this.threeScene!.remove(obj);
			}
		}
	}

	private clearOverlay(): void {
		if (this.currentOverlayEl && this.overlayContainer) {
			this.currentOverlayEl.remove();
			this.currentOverlayEl = null;
		}
	}

	private clearThreeScene(): void {
		if (!this.threeScene) return;
		const toRemove: THREE.Object3D[] = [];
		this.threeScene.traverse((child) => {
			if (child.userData._sceneOwner) {
				toRemove.push(child);
			}
		});
		for (const obj of toRemove) {
			this.threeScene!.remove(obj);
		}
	}

	private mountOverlay(scene: Scene): void {
		this.clearOverlay();
		if (!this.overlayContainer || !scene.renderHTML) return;

		const el = scene.renderHTML();
		this.currentOverlayEl = el;
		this.overlayContainer.appendChild(el);

		if (scene.onHTMLMounted) {
			scene.onHTMLMounted(el);
		}
	}

	// ========================================================================
	// Transitions
	// ========================================================================

	private startTransition(
		transition: SceneTransition,
		callback: () => void | Promise<void>
	): Promise<void> {
		return new Promise((resolve) => {
			this.isTransitioning = true;
			this.transitionProgress = 0;
			this.transitionDuration = transition.duration;
			this.transitionType = transition.type;
			this.transitionColor = transition.color || '#000000';

			// Start CSS fade out
			this.applyTransitionOpacity(1);

			this.transitionCallback = async () => {
				await callback();
				this.transitionCallback = null;
			};

			const checkComplete = () => {
				if (!this.isTransitioning) {
					resolve();
				} else {
					requestAnimationFrame(checkComplete);
				}
			};
			checkComplete();
		});
	}

	private applyTransitionOpacity(opacity: number): void {
		if (this.transitionEl) {
			this.transitionEl.style.opacity = String(opacity);
		}
	}

	// ========================================================================
	// Update & Render
	// ========================================================================

	update(deltaTime: number): void {
		if (this.isTransitioning) {
			if (this.transitionDuration > 0) {
				this.transitionProgress += (deltaTime * 1000) / this.transitionDuration;
			} else {
				this.transitionProgress = 1;
			}

			if (this.transitionProgress >= 0.5 && this.transitionCallback) {
				const cb = this.transitionCallback;
				this.transitionCallback = null;
				Promise.resolve(cb()).catch((err: any) => {
					console.error('[SceneManager] Transition error:', err);
					this.transitionProgress = 1.0;
					this.isTransitioning = false;
				});
			}

			// CSS-based transition: fade out then fade in
			if (this.transitionProgress < 0.5) {
				this.applyTransitionOpacity(this.transitionProgress * 2);
			} else {
				this.applyTransitionOpacity((1 - this.transitionProgress) * 2);
			}

			if (this.transitionProgress >= 1.0) {
				this.transitionProgress = 1.0;
				this.isTransitioning = false;
				this.applyTransitionOpacity(0);
			}
		}

		for (const entry of this.sceneStack) {
			if (!entry.isPaused && entry.scene.isActive) {
				entry.scene.update(deltaTime);
			}
		}
	}

	/**
	 * Render all scenes in stack — dispatches to Three.js or HTML overlay
	 */
	render(): void {
		for (const entry of this.sceneStack) {
			if (!entry.scene.isActive) continue;

			const scene = entry.scene;
			switch (scene.sceneType) {
				case SceneType.CANVAS_2D:
					// Canvas2D no longer supported — no-op
					break;

				case SceneType.THREE_3D:
					if (scene.render3D && this.threeScene && this.threeJSRenderer) {
						scene.render3D(this.threeScene, this.threeJSRenderer.camera.threeCamera);
						this.threeJSRenderer.render(this.threeScene);
					}
					break;

				case SceneType.HTML_OVERLAY:
					// HTML overlay is managed via DOM — nothing to render
					break;
			}
		}
	}

	// ========================================================================
	// Getters
	// ========================================================================

	get currentScene(): Scene | null {
		if (this.sceneStack.length === 0) return null;
		return this.sceneStack[this.sceneStack.length - 1]!.scene;
	}

	get stackDepth(): number {
		return this.sceneStack.length;
	}

	get transitioning(): boolean {
		return this.isTransitioning;
	}

	getStack(): Scene[] {
		return this.sceneStack.map((entry) => entry.scene);
	}
}

export const enhancedSceneManager = EnhancedSceneManager.getInstance();
