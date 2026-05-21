/**
 * RemotePlayer3DRenderer
 * Renders remote players as 3D meshes with name tags in a Three.js scene
 */

import * as THREE from 'three';

const LERP_FACTOR = 0.1;
const BODY_COLOR = 0x4488ff;
const NAME_COLOR = '#ffffff';

interface RemotePlayerEntry {
	playerId: string;
	username: string;
	bodyMesh: THREE.Mesh;
	shadowMesh: THREE.Mesh;
	nameSprite: THREE.Sprite;
	targetPos: { x: number; y: number };
	currentPos: { x: number; y: number };
	lastUpdate: number;
}

export class RemotePlayer3DRenderer {
	private threeScene: THREE.Scene;
	private players = new Map<string, RemotePlayerEntry>();
	private nameTextureCache = new Map<string, THREE.CanvasTexture>();

	constructor(threeScene: THREE.Scene) {
		this.threeScene = threeScene;
	}

	/**
	 * Add or update a remote player
	 */
	updatePlayer(playerId: string, username: string, x: number, y: number, _anim: string): void {
		let entry = this.players.get(playerId);
		if (entry) {
			entry.targetPos.x = x;
			entry.targetPos.y = y;
			entry.lastUpdate = Date.now();
			return;
		}

		// Create new player mesh
		const bodyGeo = new THREE.BoxGeometry(20, 28, 12);
		const bodyMat = new THREE.MeshLambertMaterial({ color: BODY_COLOR });
		const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
		bodyMesh.position.set(x, 14, y);
		bodyMesh.userData._remotePlayer = playerId;
		this.threeScene.add(bodyMesh);

		// Shadow
		const shadowGeo = new THREE.CircleGeometry(10, 16);
		const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
		const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
		shadowMesh.rotation.x = -Math.PI / 2;
		shadowMesh.position.set(x, 0.5, y);
		shadowMesh.userData._remotePlayer = playerId;
		this.threeScene.add(shadowMesh);

		// Name tag
		const nameSprite = this.createNameSprite(username);
		nameSprite.position.set(x, 32, y);
		nameSprite.userData._remotePlayer = playerId;
		this.threeScene.add(nameSprite);

		entry = {
			playerId,
			username,
			bodyMesh,
			shadowMesh,
			nameSprite,
			targetPos: { x, y },
			currentPos: { x, y },
			lastUpdate: Date.now(),
		};
		this.players.set(playerId, entry);
	}

	/**
	 * Remove a remote player
	 */
	removePlayer(playerId: string): void {
		const entry = this.players.get(playerId);
		if (!entry) return;

		this.threeScene.remove(entry.bodyMesh);
		this.threeScene.remove(entry.shadowMesh);
		this.threeScene.remove(entry.nameSprite);

		entry.bodyMesh.geometry.dispose();
		(entry.bodyMesh.material as THREE.Material).dispose();
		entry.shadowMesh.geometry.dispose();
		(entry.shadowMesh.material as THREE.Material).dispose();

		this.players.delete(playerId);
	}

	/**
	 * Interpolate positions each frame
	 */
	update(_dt: number): void {
		for (const entry of this.players.values()) {
			const dx = entry.targetPos.x - entry.currentPos.x;
			const dy = entry.targetPos.y - entry.currentPos.y;

			if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
				entry.currentPos.x += dx * LERP_FACTOR;
				entry.currentPos.y += dy * LERP_FACTOR;
			} else {
				entry.currentPos.x = entry.targetPos.x;
				entry.currentPos.y = entry.targetPos.y;
			}

			entry.bodyMesh.position.set(entry.currentPos.x, 14, entry.currentPos.y);
			entry.shadowMesh.position.set(entry.currentPos.x, 0.5, entry.currentPos.y);
			entry.nameSprite.position.set(entry.currentPos.x, 32, entry.currentPos.y);
		}
	}

	/**
	 * Remove all remote players
	 */
	clearAll(): void {
		for (const entry of this.players.values()) {
			this.threeScene.remove(entry.bodyMesh);
			this.threeScene.remove(entry.shadowMesh);
			this.threeScene.remove(entry.nameSprite);
			entry.bodyMesh.geometry.dispose();
			(entry.bodyMesh.material as THREE.Material).dispose();
			entry.shadowMesh.geometry.dispose();
			(entry.shadowMesh.material as THREE.Material).dispose();
		}
		this.players.clear();
	}

	getPlayerCount(): number {
		return this.players.size;
	}

	private createNameSprite(username: string): THREE.Sprite {
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 64;
		const ctx = canvas.getContext('2d')!;

		ctx.clearRect(0, 0, 256, 64);
		ctx.font = 'bold 28px Arial';
		ctx.textAlign = 'center';
		ctx.fillStyle = 'rgba(0,0,0,0.5)';
		ctx.fillRect(28, 10, 200, 40);
		ctx.fillStyle = NAME_COLOR;
		ctx.fillText(username, 128, 40);

		const texture = new THREE.CanvasTexture(canvas);
		texture.needsUpdate = true;
		this.nameTextureCache.set(username, texture);

		const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
		const sprite = new THREE.Sprite(mat);
		sprite.scale.set(50, 12.5, 1);

		return sprite;
	}
}
