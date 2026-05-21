/**
 * Three.js Renderer
 * WebGL renderer using Three.js for 3D scene rendering
 */

import * as THREE from 'three';
import { Camera3D } from './Camera3D';

export class ThreeJSRenderer {
	private renderer: THREE.WebGLRenderer;
	private camera3d: Camera3D;

	constructor(container: HTMLElement, width: number = 800, height: number = 600) {
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		this.renderer.setSize(width, height);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setClearColor(0x000000, 0);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		container.appendChild(this.renderer.domElement);

		this.camera3d = new Camera3D(width, height);

		console.log('[ThreeJSRenderer] Initialized');
	}

	get threeRenderer(): THREE.WebGLRenderer {
		return this.renderer;
	}

	get camera(): Camera3D {
		return this.camera3d;
	}

	get domElement(): HTMLCanvasElement {
		return this.renderer.domElement;
	}

	render(scene: THREE.Scene): void {
		this.camera3d.update();
		this.renderer.render(scene, this.camera3d.threeCamera);
	}

	resize(width: number, height: number): void {
		this.renderer.setSize(width, height);
		this.camera3d.setSize(width, height);
	}

	setClearColor(color: number, alpha: number = 1): void {
		this.renderer.setClearColor(color, alpha);
	}

	dispose(): void {
		this.renderer.dispose();
		this.renderer.domElement.remove();
		console.log('[ThreeJSRenderer] Disposed');
	}
}
