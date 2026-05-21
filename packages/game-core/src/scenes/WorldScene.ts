/**
 * World Scene (3D)
 * Main exploration scene with real-time action RPG combat and multiplayer
 */

import * as THREE from 'three';
import { Scene, SceneType, Vector2, keyboard, mouse, MouseButton, EnhancedSceneManager, RemotePlayer3DRenderer } from '@rpg/game-engine';
import { Player } from '../entities/Player';
import { TiledMap, TiledMapLoader } from '../world/TiledMapLoader';
import { gameStateManager } from '../state/GameStateManager';
import { dataLoader, type SkillData, type MonsterData } from '../data/DataLoader';
import { RealtimeCombatSystem } from '../combat/RealtimeCombatSystem';
import { MonsterRespawnManager } from '../combat/MonsterRespawnManager';
import { WorldMonster } from '../combat/WorldMonster';
import { div, p, span } from './dom';
import { CreateStyle } from 'elit/style';
import type { ZoneStateData, PlayerPositionUpdate, PlayerEnterData, PlayerLeaveData } from '@rpg/shared';

export interface IClientNetwork {
	isConnected(): boolean;
	joinZone(zoneId: string): void;
	leaveZone(): void;
	sendPosition(x: number, y: number, anim: string): void;
	sendChat(message: string, channel?: string, targetId?: string): void;
	on(event: string, callback: Function): void;
	off(event: string, callback: Function): void;
}

// Element → color mapping
const ELEMENT_COLORS: Record<string, number> = {
	fire: 0xff4444, water: 0x4488ff, earth: 0x8b4513, neutral: 0xaaaaaa,
	wind: 0x88cc88, dark: 0x6633aa, light: 0xffee88,
};

interface DamageNumberSprite {
	sprite: THREE.Sprite;
	lifetime: number;
	maxLifetime: number;
}

export class WorldScene extends Scene {
	private player!: Player;
	private currentMap!: TiledMap;
	private inputDirection: Vector2 = Vector2.zero();
	private keyHandlers: Map<string, (e: KeyboardEvent) => void> = new Map();

	// 3D objects
	private threeScene: THREE.Scene | null = null;
	private playerMesh: THREE.Mesh | null = null;
	private playerShadow: THREE.Mesh | null = null;
	private dirIndicator: THREE.Mesh | null = null;
	private terrainGroup: THREE.Group | null = null;
	private playerHpBar: THREE.Mesh | null = null;
	private playerMpBar: THREE.Mesh | null = null;
	private isBuilt: boolean = false;

	// Camera orbit (mouse-controlled)
	private cameraYaw: number = 0; // radians, horizontal rotation
	private cameraPitch: number = 0.8; // radians, vertical tilt (~46°)
	private cameraDistance: number = 6;
	private isPointerLocked: boolean = false;
	private pointerLockChangeHandler: (() => void) | null = null;
	private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
	private mouseDownHandler: ((e: MouseEvent) => void) | null = null;
	private mouseUpHandler: ((e: MouseEvent) => void) | null = null;
	private wheelHandler: ((e: WheelEvent) => void) | null = null;
	private contextMenuHandler: ((e: Event) => void) | null = null;

	// Real-time combat
	private combatSystem!: RealtimeCombatSystem;
	private respawnManager!: MonsterRespawnManager;
	private monsterMeshes: Map<string, THREE.Group> = new Map();
	private damageNumbers: DamageNumberSprite[] = [];
	private playerSkills: SkillData[] = [];
	private hudEl: HTMLElement | null = null;

	// Jump state
	private jumpVelocity: number = 0;
	private isGrounded: boolean = true;
	private playerVisualY: number = 0.4; // default mesh Y

	// Multiplayer
	networkManager: IClientNetwork | null = null;
	private remotePlayerRenderer: RemotePlayer3DRenderer | null = null;

	private readonly TILE_SIZE = 32;

	constructor() {
		super('World');
		this.sceneType = SceneType.THREE_3D;
	}

	override async load(): Promise<void> {
		console.log('[WorldScene] Loading...');

		try {
			await dataLoader.loadAll();
		} catch (error) {
			console.error('[WorldScene] Failed to load game data:', error);
			return;
		}

		let playerState;
		try {
			playerState = gameStateManager.getPlayerState();
		} catch {
			const sm = EnhancedSceneManager.getInstance();
			await sm.switchTo('CharacterCreation', { type: 'fade', duration: 300, color: '#000000' });
			return;
		}
		if (!playerState) {
			const sm = EnhancedSceneManager.getInstance();
			await sm.switchTo('CharacterCreation', { type: 'fade', duration: 300, color: '#000000' });
			return;
		}

		this.player = new Player({
			position: new Vector2(playerState.position.x, playerState.position.y),
			speed: 150,
		});

		this.currentMap = TiledMapLoader.createTestMap();
		this.player.setPosition(this.currentMap.spawnPoint);

		this.setupRealtimeCombat();

		if (this.networkManager?.isConnected()) {
			this.networkManager.joinZone('forest');
		}

		console.log('[WorldScene] Loaded');
	}

	// ============================================================================
	// Real-Time Combat Setup
	// ============================================================================

	private setupRealtimeCombat(): void {
		this.combatSystem = new RealtimeCombatSystem();

		this.respawnManager = new MonsterRespawnManager();
		this.respawnManager.initializeZone(
			['slime', 'goblin', 'wolf'],
			[1, 5],
			this.currentMap.getWidth(),
			this.currentMap.getHeight(),
			8,
		);

		// Wire combat events
		this.combatSystem.on('monster-damaged', (id, dmg, crit) => {
			const monster = this.combatSystem.getMonsters().find(m => m.id === id);
			if (monster) this.updateMonsterHpBar(monster);
		});

		this.combatSystem.on('monster-killed', (id, loot) => {
			console.log(`[WorldScene] Killed ${id}: +${loot.exp} XP, +${loot.gold} Gold`);
			this.removeMonsterFromScene(id);
			const monster = this.combatSystem.getMonsters().find(m => m.id === id);
			if (monster) {
				this.respawnManager.queueRespawn(monster.monsterData, monster.level, monster.spawnPosition);
			}
			this.updateHUD();
		});

		this.combatSystem.on('player-damaged', () => {
			this.updateHUD();
		});

		this.combatSystem.on('player-healed', () => {
			this.updateHUD();
		});

		this.combatSystem.on('damage-number', (pos, damage, isCrit, isHeal) => {
			this.spawnDamageNumber(pos, damage, isCrit, isHeal);
		});

		// Load player skills
		this.loadPlayerSkills();

		// Spawn initial monsters
		const initialSpawns = this.respawnManager.generateInitialSpawns();
		for (const spawn of initialSpawns) {
			const monster = this.combatSystem.spawnMonster(spawn.monsterData, spawn.level, spawn.position);
			// 3D mesh will be created in buildScene / addMonsterToScene
			if (this.threeScene) {
				this.addMonsterToScene(monster);
			}
		}

		console.log(`[WorldScene] Real-time combat initialized with ${initialSpawns.length} monsters`);
	}

	private loadPlayerSkills(): void {
		const playerState = gameStateManager.getPlayerState();
		if (!playerState) return;

		// Get skills from learned jobs
		const allSkills = dataLoader.getAllSkills();
		// For now, pick up to 4 skills that match the player's level
		this.playerSkills = allSkills
			.filter(s => s.type !== 'healing' || playerState.level >= 2)
			.slice(0, 4);
	}

	// ============================================================================
	// Input
	// ============================================================================

	private setupInput(): void {
		this.cleanupKeyboard();
		this.heldKeys.clear();

		// Use direct document listeners (works with pointer lock)
		const onKeyDown = (e: KeyboardEvent) => {
			if (!this._isActive) return;
			const key = e.key.toLowerCase();
			if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','1','2','3','4'].includes(key)) {
				e.preventDefault();
			}
			this.heldKeys.add(key);
			this.recalcDirection();

			if (key === ' ') this.onPlayerJump();
			if (key === '1') this.onPlayerSkill(0);
			if (key === '2') this.onPlayerSkill(1);
			if (key === '3') this.onPlayerSkill(2);
			if (key === '4') this.onPlayerSkill(3);
			if (key === 'escape') this.onPause();
		};

		const onKeyUp = (e: KeyboardEvent) => {
			const key = e.key.toLowerCase();
			this.heldKeys.delete(key);
			this.recalcDirection();
		};

		document.addEventListener('keydown', onKeyDown);
		document.addEventListener('keyup', onKeyUp);
		this.keyHandlers.set('_docKeyDown', onKeyDown as any);
		this.keyHandlers.set('_docKeyUp', onKeyUp as any);
		console.log('[WorldScene] Keyboard listeners attached');
	}

	private cleanupKeyboard(): void {
		const kd = this.keyHandlers.get('_docKeyDown');
		const ku = this.keyHandlers.get('_docKeyUp');
		if (kd) document.removeEventListener('keydown', kd as any);
		if (ku) document.removeEventListener('keyup', ku as any);
		this.keyHandlers.clear();
		this.heldKeys.clear();
	}

	private updateInputDirection(): void {
		if (!this._isActive) return;
		let rawX = 0;
		let rawY = 0;

		if (keyboard.isKeyDown('w') || keyboard.isKeyDown('arrowup')) rawY -= 1;
		if (keyboard.isKeyDown('s') || keyboard.isKeyDown('arrowdown')) rawY += 1;
		if (keyboard.isKeyDown('a') || keyboard.isKeyDown('arrowleft')) rawX -= 1;
		if (keyboard.isKeyDown('d') || keyboard.isKeyDown('arrowright')) rawX += 1;

		if (rawX === 0 && rawY === 0) {
			this.inputDirection = Vector2.zero();
			return;
		}

		// Rotate input by camera yaw so W = forward relative to camera
		const cos = Math.cos(this.cameraYaw);
		const sin = Math.sin(this.cameraYaw);
		const worldX = rawX * cos + rawY * sin;
		const worldY = -rawX * sin + rawY * cos;

		this.inputDirection = new Vector2(worldX, worldY);
	}

	// Track held keys ourselves (immune to pointer-lock blur resets)
	private heldKeys: Set<string> = new Set();

	private recalcDirection(): void {
		let rawX = 0;
		let rawY = 0;
		if (this.heldKeys.has('w') || this.heldKeys.has('arrowup')) rawY -= 1;
		if (this.heldKeys.has('s') || this.heldKeys.has('arrowdown')) rawY += 1;
		if (this.heldKeys.has('a') || this.heldKeys.has('arrowleft')) rawX -= 1;
		if (this.heldKeys.has('d') || this.heldKeys.has('arrowright')) rawX += 1;

		if (rawX === 0 && rawY === 0) {
			this.inputDirection = Vector2.zero();
			return;
		}

		const cos = Math.cos(this.cameraYaw);
		const sin = Math.sin(this.cameraYaw);
		this.inputDirection = new Vector2(
			rawX * cos + rawY * sin,
			-rawX * sin + rawY * cos,
		);
	}

	private onPause(): void {
		if (!this._isActive) return;
		const sceneManager = EnhancedSceneManager.getInstance();
		sceneManager.push('PauseMenu', true, { type: 'fade', duration: 200 });
	}

	// ============================================================================
	// Mouse Camera (Right-click drag to orbit, scroll to zoom)
	// ============================================================================

	private setupMouseCamera(): void {
		this.cleanupMouseCamera();

		// Left click: lock pointer if not locked, else attack with left hand
		this.mouseDownHandler = (e: MouseEvent) => {
			if (!this._isActive) return;
			if (!this.isPointerLocked) {
				if (e.button === 0) {
					const el = document.getElementById('game-mount') || document.body;
					el.requestPointerLock();
				}
				return;
			}
			// Pointer is locked — attack
			if (e.button === 0) {
				this.onPlayerAttack('left');
			} else if (e.button === 2) {
				this.onPlayerAttack('right');
			}
		};

		// Mouse move controls camera when pointer is locked
		this.mouseMoveHandler = (e: MouseEvent) => {
			if (!this.isPointerLocked) return;
			const sensitivity = 0.003;
			this.cameraYaw -= e.movementX * sensitivity;
			this.cameraPitch = Math.max(0.15, Math.min(1.5, this.cameraPitch + e.movementY * sensitivity));
		};

		// Scroll to zoom
		this.wheelHandler = (e: WheelEvent) => {
			e.preventDefault();
			this.cameraDistance = Math.max(2.5, Math.min(15, this.cameraDistance + e.deltaY * 0.005));
		};

		// Track pointer lock state
		this.pointerLockChangeHandler = () => {
			this.isPointerLocked = document.pointerLockElement != null;
		};

		this.contextMenuHandler = (e: Event) => e.preventDefault();

		document.addEventListener('mousedown', this.mouseDownHandler);
		document.addEventListener('mousemove', this.mouseMoveHandler);
		document.addEventListener('wheel', this.wheelHandler, { passive: false });
		document.addEventListener('contextmenu', this.contextMenuHandler);
		document.addEventListener('pointerlockchange', this.pointerLockChangeHandler);
	}

	private cleanupMouseCamera(): void {
		if (this.mouseDownHandler) document.removeEventListener('mousedown', this.mouseDownHandler);
		if (this.mouseMoveHandler) document.removeEventListener('mousemove', this.mouseMoveHandler);
		if (this.wheelHandler) document.removeEventListener('wheel', this.wheelHandler);
		if (this.contextMenuHandler) document.removeEventListener('contextmenu', this.contextMenuHandler);
		if (this.pointerLockChangeHandler) document.removeEventListener('pointerlockchange', this.pointerLockChangeHandler);
		this.isPointerLocked = false;
		if (document.pointerLockElement) document.exitPointerLock();
	}

	private onPlayerAttack(hand: 'left' | 'right'): void {
		if (!this._isActive || !this.combatSystem) return;
		this.combatSystem.playerAttack(this.player.position, this.player.direction, hand);
	}

	private onPlayerJump(): void {
		if (!this._isActive) return;
		if (!this.isGrounded) return;
		this.jumpVelocity = 8;
		this.isGrounded = false;
	}

	private onPlayerSkill(slot: number): void {
		if (!this._isActive || !this.combatSystem) return;
		const skill = this.playerSkills[slot];
		if (!skill) return;
		this.combatSystem.playerUseSkill(skill.id, this.player.position, this.player.direction);
		this.updateHUD();
	}

	// ============================================================================
	// Update Loop
	// ============================================================================

	override update(deltaTime: number): void {
		if (!this._isActive) return;

		// Recalculate direction every frame (camera may have rotated while keys held)
		this.recalcDirection();

		// Player movement
		this.player.move(this.inputDirection);
		const oldPosition = this.player.position.clone();
		this.player.update(deltaTime);

		if (this.checkMapCollision()) {
			this.player.setPosition(oldPosition);
			this.player.stop();
		}

		// Update 3D player mesh position
		const s = 1 / this.TILE_SIZE;
		if (this.playerMesh) {
			this.playerMesh.position.x = this.player.position.x * s;
			this.playerMesh.position.z = this.player.position.y * s;

			// Jump physics
			if (!this.isGrounded) {
				this.jumpVelocity -= 20 * deltaTime;
				this.playerVisualY += this.jumpVelocity * deltaTime;
				if (this.playerVisualY <= 0.4) {
					this.playerVisualY = 0.4;
					this.jumpVelocity = 0;
					this.isGrounded = true;
				}
			}
			this.playerMesh.position.y = this.playerVisualY;
		}

		// Direction indicator
		if (this.dirIndicator && this.player.direction.length() > 0) {
			this.dirIndicator.position.x = (this.player.position.x + this.player.direction.x * 20) * s;
			this.dirIndicator.position.z = (this.player.position.y + this.player.direction.y * 20) * s;
			this.dirIndicator.visible = true;
		} else if (this.dirIndicator) {
			this.dirIndicator.visible = false;
		}

		// Shadow
		if (this.playerShadow) {
			this.playerShadow.position.x = this.player.position.x * s;
			this.playerShadow.position.z = this.player.position.y * s;
		}

		// Player HP/MP bars
		this.updatePlayerBars();

		// Combat system update
		if (this.combatSystem) {
			this.combatSystem.update(deltaTime, this.player.position);
			this.syncMonsterMeshes();
			this.updateDamageNumbers(deltaTime);

			// Respawn check
			const respawned = this.respawnManager.update(Date.now(), this.combatSystem.getAliveMonsterCount());
			if (respawned && this.threeScene) {
				const monster = this.combatSystem.spawnMonster(respawned.monsterData, respawned.level, respawned.position);
				this.addMonsterToScene(monster);
			}
		}

		// Multiplayer
		if (this.networkManager?.isConnected()) {
			const anim = this.inputDirection.length() > 0 ? 'walk' : 'idle';
			this.networkManager.sendPosition(this.player.position.x * s, this.player.position.y * s, anim);
		}
		this.remotePlayerRenderer?.update(deltaTime);

		// Save position to state
		const playerState = gameStateManager.getPlayerState();
		if (playerState) {
			playerState.position.x = this.player.position.x;
			playerState.position.y = this.player.position.y;
		}
	}

	private checkMapCollision(): boolean {
		if (
			this.player.position.x < 0 ||
			this.player.position.x >= this.currentMap.getWidth() ||
			this.player.position.y < 0 ||
			this.player.position.y >= this.currentMap.getHeight()
		) {
			return true;
		}
		return this.currentMap.hasCollision(this.player.position.x, this.player.position.y);
	}

	// ============================================================================
	// 3D Scene Building
	// ============================================================================

	private buildScene(threeScene: THREE.Scene): void {
		if (this.isBuilt) return;
		this.isBuilt = true;
		this.threeScene = threeScene;

		const mapWidth = this.currentMap.data.width;
		const mapHeight = this.currentMap.data.height;
		const s = 1 / this.TILE_SIZE;

		// Terrain
		this.terrainGroup = new THREE.Group();
		this.terrainGroup.userData._sceneOwner = this.name;
		for (let y = 0; y < mapHeight; y++) {
			for (let x = 0; x < mapWidth; x++) {
				const isLight = (x + y) % 2 === 0;
				const color = isLight ? 0x4a7c59 : 0x3d6b4a;
				const geo = new THREE.PlaneGeometry(1, 1);
				const mat = new THREE.MeshLambertMaterial({ color });
				const tile = new THREE.Mesh(geo, mat);
				tile.rotation.x = -Math.PI / 2;
				tile.position.set(x + 0.5, 0, y + 0.5);
				tile.receiveShadow = true;
				tile.userData._sceneOwner = this.name;
				this.terrainGroup.add(tile);
			}
		}
		threeScene.add(this.terrainGroup);

		// Grid
		const grid = new THREE.GridHelper(Math.max(mapWidth, mapHeight), Math.max(mapWidth, mapHeight), 0x000000, 0x000000);
		grid.position.set(mapWidth / 2, 0.01, mapHeight / 2);
		(grid.material as THREE.Material).opacity = 0.1;
		(grid.material as THREE.Material).transparent = true;
		grid.userData._sceneOwner = this.name;
		threeScene.add(grid);

		// Player shadow
		const shadowGeo = new THREE.CircleGeometry(0.4, 16);
		const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
		this.playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
		this.playerShadow.rotation.x = -Math.PI / 2;
		this.playerShadow.position.y = 0.02;
		this.playerShadow.userData._sceneOwner = this.name;
		threeScene.add(this.playerShadow);

		// Player body
		const bodyGeo = new THREE.BoxGeometry(0.6, 0.8, 0.6);
		const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
		this.playerMesh = new THREE.Mesh(bodyGeo, bodyMat);
		this.playerMesh.position.y = 0.4;
		this.playerMesh.castShadow = true;
		this.playerMesh.userData._sceneOwner = this.name;
		threeScene.add(this.playerMesh);

		// Player HP bar background
		const hpBgGeo = new THREE.PlaneGeometry(0.8, 0.08);
		const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
		const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
		hpBg.position.y = 1.0;
		hpBg.userData._sceneOwner = this.name;
		threeScene.add(hpBg);
		// HP bar fill
		const hpFillGeo = new THREE.PlaneGeometry(0.8, 0.08);
		const hpFillMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, side: THREE.DoubleSide });
		this.playerHpBar = new THREE.Mesh(hpFillGeo, hpFillMat);
		this.playerHpBar.position.y = 1.0;
		this.playerHpBar.position.z = 0.001;
		this.playerHpBar.userData._sceneOwner = this.name;
		threeScene.add(this.playerHpBar);
		// MP bar
		const mpFillGeo = new THREE.PlaneGeometry(0.8, 0.05);
		const mpFillMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, side: THREE.DoubleSide });
		this.playerMpBar = new THREE.Mesh(mpFillGeo, mpFillMat);
		this.playerMpBar.position.y = 0.88;
		this.playerMpBar.position.z = 0.001;
		this.playerMpBar.userData._sceneOwner = this.name;
		threeScene.add(this.playerMpBar);

		// Direction indicator
		const indicatorGeo = new THREE.SphereGeometry(0.1, 8, 8);
		const indicatorMat = new THREE.MeshBasicMaterial({ color: 0xFFC107 });
		this.dirIndicator = new THREE.Mesh(indicatorGeo, indicatorMat);
		this.dirIndicator.position.y = 0.4;
		this.dirIndicator.userData._sceneOwner = this.name;
		threeScene.add(this.dirIndicator);

		// Remote players
		this.remotePlayerRenderer = new RemotePlayer3DRenderer(threeScene);
		this.setupNetworkListeners();

		// Spawn monsters that were queued during load()
		if (this.combatSystem) {
			for (const monster of this.combatSystem.getMonsters()) {
				this.addMonsterToScene(monster);
			}
		}

		// Set initial positions
		const px = this.player.position.x * s;
		const pz = this.player.position.y * s;
		if (this.playerMesh) { this.playerMesh.position.x = px; this.playerMesh.position.z = pz; }
		if (this.playerShadow) { this.playerShadow.position.x = px; this.playerShadow.position.z = pz; }

		console.log('[WorldScene] 3D scene built');
	}

	private updatePlayerBars(): void {
		const s = 1 / this.TILE_SIZE;
		const px = this.player.position.x * s;
		const pz = this.player.position.y * s;

		try {
			const ps = gameStateManager.getPlayerState();
			if (ps && this.playerHpBar) {
				const hpRatio = ps.stats.hp / ps.stats.maxHp;
				this.playerHpBar.scale.x = Math.max(0.01, hpRatio);
				this.playerHpBar.position.x = px - (1 - hpRatio) * 0.4;
				this.playerHpBar.position.z = pz + 0.001;
				(this.playerHpBar.material as THREE.MeshBasicMaterial).color.setHex(
					hpRatio > 0.3 ? 0x44ff44 : 0xff4444
				);
			}
			if (ps && this.playerMpBar) {
				const mpRatio = ps.stats.mp / ps.stats.maxMp;
				this.playerMpBar.scale.x = Math.max(0.01, mpRatio);
				this.playerMpBar.position.x = px - (1 - mpRatio) * 0.4;
				this.playerMpBar.position.z = pz + 0.001;
			}
		} catch {}
	}

	// ============================================================================
	// Monster 3D Rendering
	// ============================================================================

	private addMonsterToScene(monster: WorldMonster): void {
		if (!this.threeScene) return;

		const s = 1 / this.TILE_SIZE;
		const group = new THREE.Group();
		group.userData._sceneOwner = this.name;
		group.userData.monsterId = monster.id;

		// Body
		const element = monster.monsterData.element || 'neutral';
		const color = ELEMENT_COLORS[element] ?? 0xaaaaaa;
		const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
		const bodyMat = new THREE.MeshLambertMaterial({ color });
		const body = new THREE.Mesh(bodyGeo, bodyMat);
		body.position.y = 0.35;
		body.userData._sceneOwner = this.name;
		group.add(body);

		// HP bar background
		const hpBgGeo = new THREE.PlaneGeometry(0.7, 0.06);
		const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
		const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
		hpBg.position.y = 0.9;
		hpBg.userData._sceneOwner = this.name;
		group.add(hpBg);

		// HP bar fill
		const hpFillGeo = new THREE.PlaneGeometry(0.7, 0.06);
		const hpFillMat = new THREE.MeshBasicMaterial({ color: 0xff4444, side: THREE.DoubleSide });
		const hpFill = new THREE.Mesh(hpFillGeo, hpFillMat);
		hpFill.position.y = 0.9;
		hpFill.position.z = 0.001;
		hpFill.userData._sceneOwner = this.name;
		hpFill.userData.isHpBar = true;
		group.add(hpFill);

		// Name label
		const nameSprite = this.createTextSprite(`${monster.monsterData.name} Lv.${monster.level}`, '#ffffff', 20);
		nameSprite.position.y = 1.15;
		nameSprite.scale.set(1.2, 0.4, 1);
		nameSprite.userData._sceneOwner = this.name;
		group.add(nameSprite);

		// Position
		group.position.x = monster.position.x * s;
		group.position.z = monster.position.y * s;

		this.threeScene.add(group);
		this.monsterMeshes.set(monster.id, group);
	}

	private removeMonsterFromScene(monsterId: string): void {
		const group = this.monsterMeshes.get(monsterId);
		if (group && this.threeScene) {
			this.threeScene.remove(group);
			group.traverse((child) => {
				if (child instanceof THREE.Mesh) {
					child.geometry.dispose();
					if (child.material instanceof THREE.Material) child.material.dispose();
				}
			});
			this.monsterMeshes.delete(monsterId);
		}
	}

	private syncMonsterMeshes(): void {
		const s = 1 / this.TILE_SIZE;
		const deadIds: string[] = [];

		for (const [id, group] of this.monsterMeshes) {
			const monster = this.combatSystem.getMonsters().find(m => m.id === id);
			if (!monster || !monster.isAlive()) {
				deadIds.push(id);
				continue;
			}

			// Update position
			group.position.x = monster.position.x * s;
			group.position.z = monster.position.y * s;

			// Face direction
			if (monster.direction.length() > 0) {
				const angle = Math.atan2(monster.direction.x, monster.direction.y);
				group.rotation.y = angle;
			}
		}

		for (const id of deadIds) {
			this.removeMonsterFromScene(id);
		}
	}

	private updateMonsterHpBar(monster: WorldMonster): void {
		const group = this.monsterMeshes.get(monster.id);
		if (!group) return;

		group.traverse((child) => {
			if (child.userData.isHpBar && child instanceof THREE.Mesh) {
				const ratio = Math.max(0.01, monster.stats.hp / monster.stats.maxHp);
				child.scale.x = ratio;
				const barWidth = 0.7;
				child.position.x = -(1 - ratio) * barWidth / 2;
				(child.material as THREE.MeshBasicMaterial).color.setHex(
					ratio > 0.5 ? 0xff4444 : ratio > 0.25 ? 0xff8800 : 0xff0000
				);
			}
		});
	}

	// ============================================================================
	// Damage Numbers
	// ============================================================================

	private spawnDamageNumber(pos: { x: number; y: number }, damage: number, isCrit: boolean, isHeal: boolean): void {
		if (!this.threeScene) return;

		const s = 1 / this.TILE_SIZE;
		const canvas = document.createElement('canvas');
		canvas.width = 128;
		canvas.height = 64;
		const ctx = canvas.getContext('2d')!;
		ctx.font = `bold ${isCrit ? 44 : 36}px monospace`;
		ctx.textAlign = 'center';

		const text = isHeal ? `+${damage}` : `-${damage}`;
		const color = isHeal ? '#44ff44' : isCrit ? '#ff4444' : '#ffffff';

		ctx.strokeStyle = '#000000';
		ctx.lineWidth = 4;
		ctx.strokeText(text, 64, 45);
		ctx.fillStyle = color;
		ctx.fillText(text, 64, 45);

		const texture = new THREE.CanvasTexture(canvas);
		const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
		const sprite = new THREE.Sprite(spriteMat);
		sprite.position.set(pos.x * s, 1.5, pos.y * s);
		sprite.scale.set(1, 0.5, 1);
		sprite.userData._sceneOwner = this.name;
		this.threeScene.add(sprite);

		this.damageNumbers.push({ sprite, lifetime: 0, maxLifetime: 1.5 });
	}

	private updateDamageNumbers(deltaTime: number): void {
		for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
			const dn = this.damageNumbers[i]!;
			dn.lifetime += deltaTime;
			const progress = dn.lifetime / dn.maxLifetime;

			// Float up
			dn.sprite.position.y += deltaTime * 2;
			// Fade out
			(dn.sprite.material as THREE.SpriteMaterial).opacity = 1 - progress;

			if (dn.lifetime >= dn.maxLifetime) {
				this.threeScene?.remove(dn.sprite);
				dn.sprite.material.dispose();
				(dn.sprite.material as THREE.SpriteMaterial).map?.dispose();
				this.damageNumbers.splice(i, 1);
			}
		}
	}

	// ============================================================================
	// HUD Overlay
	// ============================================================================

	override renderHTML(): HTMLElement {
		const css = new CreateStyle();
		css.addClass('ws-hud', {
			position: 'absolute', inset: '0', pointerEvents: 'none',
			fontFamily: 'Arial, sans-serif', color: '#fff',
		});
		css.addClass('ws-stats', {
			position: 'absolute', top: '15px', left: '15px',
		});
		css.addClass('ws-stat-bar', {
			width: '200px', height: '16px', background: '#333',
			borderRadius: '3px', margin: '3px 0', overflow: 'hidden', position: 'relative',
		});
		css.addClass('ws-stat-fill', {
			height: '100%', borderRadius: '3px', transition: 'width 0.2s',
		});
		css.addClass('ws-stat-text', {
			position: 'absolute', inset: '0', display: 'flex', alignItems: 'center',
			justifyContent: 'center', fontSize: '11px', fontWeight: 'bold',
			textShadow: '1px 1px 2px #000',
		});
		css.addClass('ws-skills', {
			position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)',
			display: 'flex', gap: '8px',
		});
		css.addClass('ws-skill-slot', {
			width: '50px', height: '50px', background: '#16213e', border: '2px solid #555',
			borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
			fontSize: '11px', textAlign: 'center', position: 'relative', overflow: 'hidden',
			pointerEvents: 'auto', cursor: 'pointer',
		});
		css.addClass('ws-skill-cd', {
			position: 'absolute', bottom: '0', left: '0', width: '100%',
			background: 'rgba(0,0,0,0.7)', transition: 'height 0.1s',
		});
		css.addClass('ws-skill-key', {
			position: 'absolute', top: '2px', right: '4px', fontSize: '10px', color: '#aaa',
		});
		css.addClass('ws-loot-toast', {
			position: 'absolute', top: '15px', right: '15px', fontSize: '13px',
			textAlign: 'right', lineHeight: '1.6',
		});
		css.addClass('ws-crosshair', {
			position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)',
			pointerEvents: 'none',
		});
		css.addClass('ws-lock-hint', {
			position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
			fontSize: '16px', color: '#ccc', textShadow: '1px 1px 3px #000',
			pointerEvents: 'auto', cursor: 'pointer', padding: '10px 20px',
			background: 'rgba(0,0,0,0.5)', borderRadius: '8px',
		});
		css.inject();

		this.hudEl = div({ className: 'ws-hud' },
			this.renderStatsPanel(),
			this.renderSkillBar(),
			div({ className: 'ws-loot-toast', id: 'ws-loot' }),
			// Crosshair (center of screen)
			div({ className: 'ws-crosshair', id: 'ws-crosshair' },
				div({ style: 'width:2px;height:2px;background:#fff;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,0.5),0 0 6px rgba(255,255,255,0.3)' }),
			),
			// Lock hint (shown when not locked)
			div({ className: 'ws-lock-hint', id: 'ws-lock-hint', onClick: () => (document.getElementById('game-mount') || document.body).requestPointerLock() }, 'Click to play'),
		) as HTMLElement;

		return this.hudEl;
	}

	private renderStatsPanel(): HTMLElement {
		const ps = gameStateManager.getPlayerState();
		const hp = ps?.stats.hp ?? 100;
		const maxHp = ps?.stats.maxHp ?? 100;
		const mp = ps?.stats.mp ?? 30;
		const maxMp = ps?.stats.maxMp ?? 30;

		return div({ className: 'ws-stats' },
			div({ className: 'ws-stat-bar' },
				div({ className: 'ws-stat-fill', style: `width:${hp / maxHp * 100}%;background:#44ff44` }),
				span({ className: 'ws-stat-text' }, `HP ${hp}/${maxHp}`),
			),
			div({ className: 'ws-stat-bar' },
				div({ className: 'ws-stat-fill', style: `width:${mp / maxMp * 100}%;background:#4488ff` }),
				span({ className: 'ws-stat-text' }, `MP ${mp}/${maxMp}`),
			),
			p({ style: 'font-size:13px;margin-top:6px;color:#ffd700' }, `Lv.${ps?.level ?? 1} | Gold: ${ps?.gold ?? 0}`),
		) as HTMLElement;
	}

	private renderSkillBar(): HTMLElement {
		const bar = div({ className: 'ws-skills' });

		// Left hand attack slot
		bar.appendChild(div({ className: 'ws-skill-slot' },
			span({}, 'L-ATK'),
			span({ className: 'ws-skill-key' }, 'LMB'),
		));

		// Right hand attack slot
		bar.appendChild(div({ className: 'ws-skill-slot' },
			span({}, 'R-ATK'),
			span({ className: 'ws-skill-key' }, 'RMB'),
		));

		// Jump slot
		bar.appendChild(div({ className: 'ws-skill-slot' },
			span({}, 'JUMP'),
			span({ className: 'ws-skill-key' }, 'SPC'),
		));

		// Skill slots 1-4
		for (let i = 0; i < 4; i++) {
			const skill = this.playerSkills[i];
			const label = skill ? skill.name.slice(0, 5) : '-';
			bar.appendChild(div({ className: 'ws-skill-slot', 'data-slot': String(i) },
				span({}, label),
				span({ className: 'ws-skill-key' }, String(i + 1)),
				div({ className: 'ws-skill-cd', style: 'height:0%' }),
			));
		}

		return bar as HTMLElement;
	}

	private updateHUD(): void {
		if (!this.hudEl) return;

		// Update stats panel
		const statsPanel = this.hudEl.querySelector('.ws-stats');
		if (statsPanel) {
			const ps = gameStateManager.getPlayerState();
			if (ps) {
				const bars = statsPanel.querySelectorAll('.ws-stat-fill');
				if (bars[0]) {
					const hpRatio = ps.stats.hp / ps.stats.maxHp * 100;
					(bars[0] as HTMLElement).style.width = `${hpRatio}%`;
					(bars[0] as HTMLElement).style.background = hpRatio > 30 ? '#44ff44' : '#ff4444';
				}
				if (bars[1]) {
					(bars[1] as HTMLElement).style.width = `${ps.stats.mp / ps.stats.maxMp * 100}%`;
				}
				const texts = statsPanel.querySelectorAll('.ws-stat-text');
				if (texts[0]) texts[0].textContent = `HP ${ps.stats.hp}/${ps.stats.maxHp}`;
				if (texts[1]) texts[1].textContent = `MP ${ps.stats.mp}/${ps.stats.maxMp}`;

				const infoP = statsPanel.querySelector('p');
				if (infoP) infoP.textContent = `Lv.${ps.level} | Gold: ${ps.gold}`;
			}
		}

		// Update skill cooldowns
		const slots = this.hudEl.querySelectorAll('.ws-skill-slot');
		for (let i = 0; i < 4; i++) {
			const skill = this.playerSkills[i];
			if (!skill) continue;
			const slot = slots[i + 1]; // +1 because index 0 is ATK
			if (!slot) continue;
			const cdEl = slot.querySelector('.ws-skill-cd') as HTMLElement;
			if (cdEl && this.combatSystem) {
				const remaining = this.combatSystem.getSkillCooldownRemaining(skill.id);
				const total = (skill.cooldown ?? 3) * 1000;
				if (remaining > 0) {
					cdEl.style.height = `${(remaining / total) * 100}%`;
				} else {
					cdEl.style.height = '0%';
				}
			}
		}

		// Show/hide crosshair and lock hint
		const crosshair = document.getElementById('ws-crosshair');
		const lockHint = document.getElementById('ws-lock-hint');
		if (crosshair) crosshair.style.display = this.isPointerLocked ? 'block' : 'none';
		if (lockHint) lockHint.style.display = this.isPointerLocked ? 'none' : 'block';
	}

	private createTextSprite(text: string, color: string, fontSize: number): THREE.Sprite {
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 64;
		const ctx = canvas.getContext('2d')!;
		ctx.font = `bold ${fontSize}px Arial`;
		ctx.textAlign = 'center';
		ctx.strokeStyle = '#000000';
		ctx.lineWidth = 3;
		ctx.strokeText(text, 128, 40);
		ctx.fillStyle = color;
		ctx.fillText(text, 128, 40);
		const texture = new THREE.CanvasTexture(canvas);
		const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
		return new THREE.Sprite(mat);
	}

	// ============================================================================
	// Network
	// ============================================================================

	private setupNetworkListeners(): void {
		const nm = this.networkManager;
		if (!nm) return;

		nm.on('zone-state', (data: ZoneStateData) => {
			this.remotePlayerRenderer?.clearAll();
			for (const p of data.players) {
				this.remotePlayerRenderer?.updatePlayer(p.playerId, p.username, p.x, p.y, p.anim);
			}
		});

		nm.on('player-entered', (data: PlayerEnterData) => {
			this.remotePlayerRenderer?.updatePlayer(data.playerId, data.username, data.x, data.y, data.anim);
		});

		nm.on('player-left', (data: PlayerLeaveData) => {
			this.remotePlayerRenderer?.removePlayer(data.playerId);
		});

		nm.on('position-update', (updates: PlayerPositionUpdate[]) => {
			for (const u of updates) {
				this.remotePlayerRenderer?.updatePlayer(u.playerId, '', u.x, u.y, u.anim);
			}
		});
	}

	// ============================================================================
	// Render & Lifecycle
	// ============================================================================

	override render3D(scene: THREE.Scene, camera: THREE.Camera): void {
		this.buildScene(scene);

		const threeCam = camera as THREE.PerspectiveCamera;
		const s = 1 / this.TILE_SIZE;
		const targetX = this.player.position.x * s;
		const targetZ = this.player.position.y * s;

		// Rotate player mesh to face movement direction
		if (this.playerMesh && this.player.direction.length() > 0) {
			const dir = this.player.direction;
			this.playerMesh.rotation.y = Math.atan2(dir.x, dir.y);
		}

		// Orbit camera around player using mouse-controlled yaw/pitch/distance
		const camX = targetX + Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;
		const camY = Math.sin(this.cameraPitch) * this.cameraDistance;
		const camZ = targetZ + Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;

		const lerp = 0.1;
		threeCam.position.x += (camX - threeCam.position.x) * lerp;
		threeCam.position.y += (camY - threeCam.position.y) * lerp;
		threeCam.position.z += (camZ - threeCam.position.z) * lerp;
		threeCam.lookAt(targetX, this.playerVisualY + 0.4, targetZ);

		this.updateHUD();
	}

	override onHTMLMounted(el: HTMLElement): void {
		this.updateHUD();
	}

	override onEnter(): void {
		super.onEnter();
		this.setupInput();
		this.setupMouseCamera();
		this.inputDirection = Vector2.zero();

		const playerState = gameStateManager.getPlayerState();
		if (playerState && this.player) {
			this.player.setPosition(new Vector2(playerState.position.x, playerState.position.y));
		}

		if (this.combatSystem) {
			this.combatSystem.syncPlayerStats();
		}
	}

	override onExit(): void {
		super.onExit();
		this.cleanupKeyboard();
		this.cleanupMouseCamera();

		const playerState = gameStateManager.getPlayerState();
		if (playerState && this.player) {
			playerState.position.x = this.player.position.x;
			playerState.position.y = this.player.position.y;
		}

		gameStateManager.saveGame();
	}

	override destroy(): void {
		this.cleanupKeyboard();
		this.remotePlayerRenderer?.clearAll();
		this.combatSystem?.clearAll();
		this.monsterMeshes.clear();
		this.damageNumbers = [];
		this.onExit();
	}
}
