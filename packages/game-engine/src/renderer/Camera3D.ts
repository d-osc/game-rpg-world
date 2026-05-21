/**
 * Camera3D
 * 3D camera using Three.js PerspectiveCamera with follow/shake support
 */

import * as THREE from 'three';
import { Vector2 } from '../math/Vector2';

export class Camera3D {
	threeCamera: THREE.PerspectiveCamera;
	private target: { x: number; y: number } | null = null;
	private smoothing: number = 0.1;
	private _followOffset: THREE.Vector3 = new THREE.Vector3(0, 12, 10);
	private _lookAtOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

	private shakeIntensity: number = 0;
	private shakeDuration: number = 0;
	private shakeOffset: THREE.Vector3 = new THREE.Vector3();

	private width: number;
	private height: number;

	constructor(width: number = 800, height: number = 600) {
		this.width = width;
		this.height = height;
		this.threeCamera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
		this.threeCamera.position.set(0, 12, 10);
		this.threeCamera.lookAt(0, 0, 0);
	}

	follow(target: { x: number; y: number }, smoothing: number = 0.1): void {
		this.target = target;
		this.smoothing = smoothing;
	}

	setFollowOffset(offset: THREE.Vector3): void {
		this._followOffset.copy(offset);
	}

	setLookAtOffset(offset: THREE.Vector3): void {
		this._lookAtOffset.copy(offset);
	}

	shake(intensity: number, duration: number): void {
		this.shakeIntensity = intensity;
		this.shakeDuration = duration;
	}

	update(deltaTime?: number): void {
		if (this.target) {
			const dt = deltaTime ?? 1 / 60;
			const factor = 1 - Math.pow(this.smoothing, dt * 60);

			const targetX = this.target.x + this._followOffset.x;
			const targetY = this._followOffset.y;
			const targetZ = this.target.y + this._followOffset.z;

			this.threeCamera.position.x += (targetX - this.threeCamera.position.x) * factor;
			this.threeCamera.position.y += (targetY - this.threeCamera.position.y) * factor;
			this.threeCamera.position.z += (targetZ - this.threeCamera.position.z) * factor;

			this.threeCamera.lookAt(
				this.target.x + this._lookAtOffset.x,
				this._lookAtOffset.y,
				this.target.y + this._lookAtOffset.z
			);
		}

		if (this.shakeDuration > 0) {
			this.shakeDuration -= (deltaTime ?? 1 / 60);
			const angle = Math.random() * Math.PI * 2;
			const dist = Math.random() * this.shakeIntensity;
			this.shakeOffset.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
			this.threeCamera.position.add(this.shakeOffset);

			if (this.shakeDuration <= 0) {
				this.shakeDuration = 0;
				this.shakeIntensity = 0;
			}
		}
	}

	setSize(width: number, height: number): void {
		this.width = width;
		this.height = height;
		this.threeCamera.aspect = width / height;
		this.threeCamera.updateProjectionMatrix();
	}

	setFOV(fov: number): void {
		this.threeCamera.fov = fov;
		this.threeCamera.updateProjectionMatrix();
	}

	reset(): void {
		this.threeCamera.position.set(0, 12, 10);
		this.threeCamera.lookAt(0, 0, 0);
		this.target = null;
		this.shakeIntensity = 0;
		this.shakeDuration = 0;
	}
}
