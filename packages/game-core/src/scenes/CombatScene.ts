/**
 * Combat Scene (3D + HTML Overlay)
 * Turn-based combat with 3D battle arena and HTML UI overlay
 */

import * as THREE from 'three';
import { Scene, SceneType, keyboard, EnhancedSceneManager } from '@rpg/game-engine';
import {
	CombatManager,
	CombatState,
	CombatActionType,
	type CombatEntity,
	type CombatAction,
	type DamageResult,
} from '../combat/CombatManager';
import { skillSystem } from '../combat/SkillSystem';
import { lootSystem } from '../combat/LootSystem';
import { gameStateManager } from '../state/GameStateManager';
import { dataLoader, type SkillData } from '../data/DataLoader';
import type { MonsterData } from '../data/DataLoader';
import { div, p, button, span } from './dom';
import { CreateStyle } from 'elit/style';

interface MenuOption {
	text: string;
	action: () => void;
	enabled: boolean;
}

export class CombatScene extends Scene {
	private combatManager!: CombatManager;
	private player!: CombatEntity;
	private enemy!: CombatEntity;
	private enemyMonsterData!: MonsterData;
	private enemyLevel!: number;
	private combatStarted: boolean = false;

	private currentMenu: 'main' | 'skills' | 'items' = 'main';
	private selectedIndex: number = 0;
	private mainMenuOptions: MenuOption[] = [];
	private skillMenuOptions: MenuOption[] = [];
	private itemMenuOptions: MenuOption[] = [];

	private playerSkills: SkillData[] = [];
	private selectedSkill: SkillData | null = null;

	private combatLog: string[] = [];
	private readonly MAX_LOG_LINES = 5;

	private isAnimating: boolean = false;
	private animationTimer: number = 0;
	private readonly ANIMATION_DURATION = 0.5;

	private keyHandlers: Map<string, () => void> = new Map();
	private exitTimer: ReturnType<typeof setTimeout> | null = null;
	private aiActionTimer: ReturnType<typeof setTimeout> | null = null;

	// 3D objects
	private playerMesh: THREE.Mesh | null = null;
	private enemyMesh: THREE.Mesh | null = null;
	private arenaFloor: THREE.Mesh | null = null;
	private isBuilt: boolean = false;

	// HTML overlay elements
	private playerStatusEl: HTMLElement | null = null;
	private enemyStatusEl: HTMLElement | null = null;
	private logEl: HTMLElement | null = null;
	private menuEl: HTMLElement | null = null;
	private hintEl: HTMLElement | null = null;

	constructor() {
		super('Combat');
		this.sceneType = SceneType.THREE_3D;
	}

	override async load(): Promise<void> {
		console.log('[CombatScene] Loading...');
		await dataLoader.loadAll();
		this.combatManager = new CombatManager();
		this.combatManager.setSkillDataLookup((skillId: string) => dataLoader.getSkill(skillId));
		console.log('[CombatScene] Loaded');
	}

	startCombat(monsterData: MonsterData, monsterLevel: number): void {
		console.log(`[CombatScene] Starting combat with ${monsterData.name} (Lv.${monsterLevel})`);
		this.enemyMonsterData = monsterData;
		this.enemyLevel = monsterLevel;

		let playerState;
		try { playerState = gameStateManager.getPlayerState(); } catch {
			console.error('[CombatScene] No player state found');
			return;
		}
		if (!playerState) {
			console.error('[CombatScene] No player state found');
			return;
		}

		this.playerSkills = skillSystem.getPlayerSkills();
		console.log(`[CombatScene] Loaded ${this.playerSkills.length} player skills`);

		this.player = {
			id: 'player',
			name: playerState.name,
			level: playerState.level,
			stats: {
				hp: playerState.stats.hp,
				maxHp: playerState.stats.maxHp,
				mp: playerState.stats.mp,
				maxMp: playerState.stats.maxMp,
				atk: playerState.stats.atk,
				def: playerState.stats.def,
				spd: playerState.stats.spd,
				luck: playerState.stats.luck,
			},
			skills: this.playerSkills.map((s) => s.id),
			element: 'neutral',
			statusEffects: [],
			isPlayer: true,
		};

		this.enemy = {
			id: 'enemy',
			name: monsterData.name,
			level: monsterLevel,
			stats: {
				hp: monsterData.stats.hp,
				maxHp: monsterData.stats.hp,
				mp: monsterData.stats.mp,
				maxMp: monsterData.stats.mp,
				atk: monsterData.stats.atk,
				def: monsterData.stats.def,
				spd: monsterData.stats.spd,
				luck: 5,
			},
			skills: monsterData.skills || [],
			element: monsterData.element,
			statusEffects: [],
			isPlayer: false,
		};

		this.combatManager.initCombat(this.player, [this.enemy]);
		this.combatLog = [];
		this.addToLog(`A wild ${monsterData.name} appeared!`);
		this.setupMenus();
		this.combatStarted = true;
		this.isBuilt = false;

		// Remount overlay with updated data
		const sm = EnhancedSceneManager.getInstance();
		const overlay = (sm as any).overlayContainer as HTMLDivElement | null;
		if (overlay) {
			overlay.innerHTML = '';
			overlay.appendChild(this.renderHTML());
			this.onHTMLMounted(overlay.lastChild as HTMLElement);
		}
	}

	private setupCombatEvents(): void {
		this.combatManager.on('state-changed', (state) => {
			console.log(`[CombatScene] State changed: ${state}`);
		});

		this.combatManager.on('turn-start', (actorId) => {
			const entity = actorId === 'player' ? this.player : this.enemy;
			if (!entity) return;
			this.addToLog(`${entity.name}'s turn!`);
			if (!entity.isPlayer) {
				this.aiActionTimer = setTimeout(() => this.executeAIAction(), 1000);
			}
		});

		this.combatManager.on('action-executed', (action, result) => {
			const actor = action.actorId === 'player' ? this.player : this.enemy;
			if (!actor) return;
			const target = action.targetId === 'player' ? this.player : this.enemy;
			if (!target) return;

			if (action.type === CombatActionType.ATTACK) {
				let message = `${actor.name} attacks ${target.name}!`;
				if (result.isCritical) message += ' Critical hit!';
				this.addToLog(message);
				this.addToLog(`${target.name} takes ${result.damage} damage!`);
			} else if (action.type === CombatActionType.SKILL) {
				const skillData = action.skillId ? dataLoader.getSkill(action.skillId) : null;
				const skillName = skillData?.name || action.skillId || 'Unknown Skill';
				let message = `${actor.name} uses ${skillName}!`;
				if (result.isCritical) message += ' Critical hit!';
				this.addToLog(message);
				this.addToLog(`${target.name} takes ${result.damage} damage!`);
				if (result.isWeak) this.addToLog('It is super effective!');
				if (result.isResisted) this.addToLog('It is not very effective...');
				if ((result as any).statusInflicted) this.addToLog(`${target.name} is afflicted with ${(result as any).statusInflicted}!`);
			} else if (action.type === CombatActionType.FLEE) {
				this.addToLog(`${actor.name} fled from battle!`);
			}

			const playerState = gameStateManager.getPlayerState();
			const playerEntity = this.combatManager.getEntity('player');
			if (playerState && playerEntity) {
				playerState.stats.hp = playerEntity.stats.hp;
				playerState.stats.mp = playerEntity.stats.mp;
			}

			this.isAnimating = true;
			this.animationTimer = 0;
			this.updateUI();
		});

		this.combatManager.on('entity-defeated', (entityId) => {
			const entity = entityId === 'player' ? this.player : this.enemy;
			if (!entity) return;
			this.addToLog(`${entity.name} was defeated!`);

			if (entityId === 'player') {
				const playerState = gameStateManager.getPlayerState();
				if (playerState) {
					playerState.stats.hp = entity.stats.hp;
					playerState.stats.mp = entity.stats.mp;
				}
			}
		});

		this.combatManager.on('combat-end', (result) => {
			if (result === 'victory') this.onVictory();
			else if (result === 'defeat') this.onDefeat();
			else if (result === 'fled') this.onFled();
		});
	}

	private setupMenus(): void {
		this.mainMenuOptions = [
			{ text: 'Attack', action: () => this.onAttack(), enabled: true },
			{ text: 'Skills', action: () => this.onSkillsMenu(), enabled: this.player.skills.length > 0 },
			{ text: 'Items', action: () => this.onItemsMenu(), enabled: false },
			{ text: 'Flee', action: () => this.onFlee(), enabled: true },
		];

		this.skillMenuOptions = this.playerSkills.map((skill) => ({
			text: `${skill.name} (MP: ${skill.mpCost})`,
			action: () => this.onUseSkill(skill),
			enabled: skillSystem.canUseSkill(this.player, skill),
		}));
		this.skillMenuOptions.push({ text: 'Back', action: () => this.onBackToMain(), enabled: true });

		this.itemMenuOptions = [{ text: 'Back', action: () => this.onBackToMain(), enabled: true }];
	}

	private setupInput(): void {
		this.cleanupKeyboard();
		const bindings: [string, () => void][] = [
			['ArrowUp', () => this.navigateUp()],
			['ArrowDown', () => this.navigateDown()],
			['KeyW', () => this.navigateUp()],
			['KeyS', () => this.navigateDown()],
			['Enter', () => this.selectOption()],
			[' ', () => this.selectOption()],
			['Escape', () => this.onBackToMain()],
		];
		for (const [key, handler] of bindings) {
			this.keyHandlers.set(key, handler);
			keyboard.onKeyDown(key, handler);
		}
	}

	private navigateUp(): void {
		if (!this._isActive) return;
		const options = this.getCurrentMenuOptions();
		if (options.length === 0 || !options.some(o => o.enabled)) return;
		do {
			this.selectedIndex = (this.selectedIndex - 1 + options.length) % options.length;
		} while (!options[this.selectedIndex]!.enabled);
		this.updateUI();
	}

	private navigateDown(): void {
		if (!this._isActive) return;
		const options = this.getCurrentMenuOptions();
		if (options.length === 0 || !options.some(o => o.enabled)) return;
		do {
			this.selectedIndex = (this.selectedIndex + 1) % options.length;
		} while (!options[this.selectedIndex]!.enabled);
		this.updateUI();
	}

	private selectOption(): void {
		if (!this._isActive) return;
		const options = this.getCurrentMenuOptions();
		if (options.length === 0) return;
		const option = options[this.selectedIndex];
		if (option && option.enabled) option.action();
	}

	private getCurrentMenuOptions(): MenuOption[] {
		switch (this.currentMenu) {
			case 'main': return this.mainMenuOptions;
			case 'skills': return this.skillMenuOptions;
			case 'items': return this.itemMenuOptions;
			default: return [];
		}
	}

	private onAttack(): void {
		this.combatManager.submitAction({ actorId: 'player', type: CombatActionType.ATTACK, targetId: 'enemy' });
	}

	private onSkillsMenu(): void {
		this.currentMenu = 'skills';
		this.selectedIndex = 0;
		this.updateUI();
	}

	private onUseSkill(skill: SkillData): void {
		if (!skillSystem.canUseSkill(this.player, skill)) {
			this.addToLog(`Not enough MP to use ${skill.name}!`);
			return;
		}
		this.combatManager.submitAction({
			actorId: 'player', type: CombatActionType.SKILL, targetId: this.enemy.id, skillId: skill.id,
		});
		this.currentMenu = 'main';
		this.selectedIndex = 0;
	}

	private onItemsMenu(): void {
		this.currentMenu = 'items';
		this.selectedIndex = 0;
	}

	private onFlee(): void {
		this.combatManager.submitAction({ actorId: 'player', type: CombatActionType.FLEE, targetId: 'player' });
	}

	private onBackToMain(): void {
		if (!this._isActive) return;
		const state = this.combatManager.getState();
		if (state === CombatState.VICTORY || state === CombatState.DEFEAT || state === CombatState.FLED) {
			this.exitCombat();
			return;
		}
		this.currentMenu = 'main';
		this.selectedIndex = 0;
		this.updateUI();
	}

	private executeAIAction(): void {
		const enemySkills = skillSystem.getMonsterSkills(this.enemy.skills);
		const useSkill = Math.random() < 0.7 && enemySkills.length > 0;

		if (useSkill) {
			const skill = skillSystem.selectAISkill(this.enemy, enemySkills);
			if (skill) {
				this.combatManager.submitAction({
					actorId: this.enemy.id, type: CombatActionType.SKILL, targetId: 'player', skillId: skill.id,
				});
				return;
			}
		}
		this.combatManager.submitAction({ actorId: 'enemy', type: CombatActionType.ATTACK, targetId: 'player' });
	}

	private addToLog(message: string): void {
		this.combatLog.push(message);
		if (this.combatLog.length > this.MAX_LOG_LINES) this.combatLog.shift();
	}

	private onVictory(): void {
		this.addToLog('Victory!');
		const playerEntity = this.combatManager.getEntity('player');
		if (playerEntity) {
			const ps = gameStateManager.getPlayerState();
			if (ps) { ps.stats.hp = playerEntity.stats.hp; ps.stats.mp = playerEntity.stats.mp; }
		}
		const playerState = gameStateManager.getPlayerState();
		if (!playerState) { console.error('[CombatScene] No player state found'); return; }
		const loot = lootSystem.generateLootWithLuck(this.enemyMonsterData, this.enemyLevel, playerState.stats.luck);
		lootSystem.applyLoot(loot);
		for (const message of lootSystem.formatLootMessage(loot)) this.addToLog(message);
		this.updateUI();
		this.exitTimer = setTimeout(() => this.exitCombat(), 5000);
	}

	private onDefeat(): void {
		this.addToLog('You were defeated...');
		const playerState = gameStateManager.getPlayerState();
		if (playerState) {
			playerState.stats.hp = Math.floor(playerState.stats.maxHp / 2);
			gameStateManager.saveGame();
		}
		this.updateUI();
		this.exitTimer = setTimeout(() => this.exitCombat(), 3000);
	}

	private onFled(): void {
		this.addToLog('Escaped safely!');
		this.updateUI();
		this.exitTimer = setTimeout(() => this.exitCombat(), 2000);
	}

	private async exitCombat(): Promise<void> {
		console.log('[CombatScene] Exiting combat, returning to World Scene');
		const sceneManager = EnhancedSceneManager.getInstance();
		await sceneManager.switchTo('World', { type: 'fade', duration: 500, color: '#000000' });
	}

	override update(deltaTime: number): void {
		if (!this.combatStarted) return;

		if (this.isAnimating) {
			this.animationTimer += deltaTime;
			if (this.animationTimer >= this.ANIMATION_DURATION) {
				this.isAnimating = false;
				this.animationTimer = 0;
			}
		}

		if (this.playerMesh && this.isAnimating) {
			this.playerMesh.position.x = -2 + Math.sin(this.animationTimer * 20) * 0.3;
		}
		if (this.enemyMesh && this.isAnimating) {
			this.enemyMesh.position.x = 2 + Math.sin(this.animationTimer * 20) * -0.3;
		}
	}

	// ========================================================================
	// 3D Scene
	// ========================================================================

	private buildScene(threeScene: THREE.Scene): void {
		if (this.isBuilt) return;
		this.isBuilt = true;

		const toRemove: THREE.Object3D[] = [];
		threeScene.traverse((child) => {
			if (child.userData._sceneOwner === this.name) toRemove.push(child);
		});
		for (const obj of toRemove) threeScene.remove(obj);

		// Arena floor
		const floorGeo = new THREE.PlaneGeometry(12, 8);
		const floorMat = new THREE.MeshLambertMaterial({ color: 0x3d2817 });
		this.arenaFloor = new THREE.Mesh(floorGeo, floorMat);
		this.arenaFloor.rotation.x = -Math.PI / 2;
		this.arenaFloor.receiveShadow = true;
		this.arenaFloor.userData._sceneOwner = this.name;
		threeScene.add(this.arenaFloor);

		// Arena borders
		const borderMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
		const borderGeo = new THREE.BoxGeometry(12.4, 0.5, 0.2);
		for (const z of [-4, 4]) {
			const wall = new THREE.Mesh(borderGeo, borderMat);
			wall.position.set(0, 0.25, z);
			wall.userData._sceneOwner = this.name;
			threeScene.add(wall);
		}
		const sideGeo = new THREE.BoxGeometry(0.2, 0.5, 8.4);
		for (const x of [-6, 6]) {
			const wall = new THREE.Mesh(sideGeo, borderMat);
			wall.position.set(x, 0.25, 0);
			wall.userData._sceneOwner = this.name;
			threeScene.add(wall);
		}

		// Player character (green box)
		const playerGeo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
		const playerMat = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
		this.playerMesh = new THREE.Mesh(playerGeo, playerMat);
		this.playerMesh.position.set(-2, 0.6, 0);
		this.playerMesh.castShadow = true;
		this.playerMesh.userData._sceneOwner = this.name;
		threeScene.add(this.playerMesh);

		// Enemy character (red box)
		const enemyGeo = new THREE.BoxGeometry(1, 1.4, 1);
		const enemyMat = new THREE.MeshLambertMaterial({ color: 0xf44336 });
		this.enemyMesh = new THREE.Mesh(enemyGeo, enemyMat);
		this.enemyMesh.position.set(2, 0.7, 0);
		this.enemyMesh.castShadow = true;
		this.enemyMesh.userData._sceneOwner = this.name;
		threeScene.add(this.enemyMesh);

		console.log('[CombatScene] 3D battle arena built');
	}

	override render3D(scene: THREE.Scene, camera: THREE.Camera): void {
		if (!this.combatStarted) return;
		this.buildScene(scene);

		const cam = camera as THREE.PerspectiveCamera;
		cam.position.set(0, 8, 7);
		cam.lookAt(0, 0, 0);
	}

	// ========================================================================
	// HTML Overlay UI
	// ========================================================================

	private setupStyles(): void {
		const css = new CreateStyle();
		css.addClass('cb-overlay', {
			position: 'absolute', inset: '0', pointerEvents: 'none',
			fontFamily: 'Arial, sans-serif', color: '#fff', fontSize: '14px',
		});
		css.addClass('cb-status', {
			position: 'absolute', top: '10px', width: '200px', padding: '8px 10px',
			background: 'rgba(0,0,0,0.8)', border: '2px solid #8B4513', borderRadius: '8px',
			pointerEvents: 'auto',
		});
		css.addClass('cb-status-right', { right: '10px' });
		css.addClass('cb-status-left', { left: '10px' });
		css.addClass('cb-name', { fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' });
		css.addClass('cb-bar-bg', {
			width: '100%', height: '14px', background: '#333',
			borderRadius: '7px', margin: '2px 0', overflow: 'hidden', position: 'relative',
		});
		css.addClass('cb-bar-fill', { height: '100%', borderRadius: '7px', transition: 'width 0.3s' });
		css.addClass('cb-bar-hp', { background: '#4CAF50' });
		css.addClass('cb-bar-hp-low', { background: '#f44336' });
		css.addClass('cb-bar-mp', { background: '#2196F3' });
		css.addClass('cb-bar-text', {
			position: 'absolute', top: '0', left: '0', right: '0', bottom: '0',
			display: 'flex', alignItems: 'center', justifyContent: 'center',
			fontSize: '10px', fontWeight: 'bold',
		});
		css.addClass('cb-log', {
			position: 'absolute', bottom: '90px', left: '10px', right: '10px', height: '100px',
			background: 'rgba(0,0,0,0.8)', border: '2px solid #8B4513', borderRadius: '8px',
			padding: '8px 10px', overflowY: 'auto', pointerEvents: 'auto',
		});
		css.addClass('cb-log-line', { margin: '2px 0', lineHeight: '1.4' });
		css.addClass('cb-menu', {
			position: 'absolute', bottom: '10px', left: '10px', right: '10px', height: '70px',
			background: 'rgba(0,0,0,0.8)', border: '2px solid #8B4513', borderRadius: '8px',
			padding: '6px 10px', pointerEvents: 'auto',
		});
		css.addClass('cb-menu-title', { fontSize: '12px', color: '#aaa', marginBottom: '4px' });
		css.addClass('cb-menu-options', { display: 'flex', gap: '10px', flexWrap: 'wrap' });
		css.addClass('cb-opt', {
			padding: '4px 12px', background: '#16213e', border: '1px solid #333',
			borderRadius: '4px', cursor: 'pointer', fontSize: '14px', transition: 'all 0.15s',
		});
		css.addClass('cb-opt-selected', { background: '#533483', border: '2px solid #FFD700', fontWeight: 'bold' });
		css.addClass('cb-opt-disabled', { color: '#666', cursor: 'not-allowed' });
		css.addClass('cb-hint', {
			position: 'absolute', bottom: '10px', right: '20px', fontSize: '11px', color: '#aaa',
		});
		css.inject();
	}

	private renderStatusBars(entity: CombatEntity): HTMLElement {
		const hpPercent = entity.stats.maxHp > 0 ? Math.max(0, entity.stats.hp / entity.stats.maxHp) : 0;
		const hpColor = hpPercent > 0.3 ? 'cb-bar-hp' : 'cb-bar-hp-low';
		const mpPercent = entity.stats.maxMp > 0 ? Math.max(0, entity.stats.mp / entity.stats.maxMp) : 0;

		const hpBarBg = div({ className: 'cb-bar-bg' },
			div({ className: `cb-bar-fill ${hpColor}`, style: `width:${hpPercent * 100}%` }),
			div({ className: 'cb-bar-text' }, `HP: ${entity.stats.hp}/${entity.stats.maxHp}`),
		);
		const mpBarBg = div({ className: 'cb-bar-bg' },
			div({ className: 'cb-bar-fill cb-bar-mp', style: `width:${mpPercent * 100}%` }),
			div({ className: 'cb-bar-text' }, `MP: ${entity.stats.mp}/${entity.stats.maxMp}`),
		);

		return div({},
			div({ className: 'cb-name' }, `${entity.name} Lv.${entity.level}`),
			hpBarBg,
			mpBarBg,
		);
	}

	private updateUI(): void {
		if (!this.playerStatusEl) return;

		// Update player status
		this.playerStatusEl.innerHTML = '';
		this.playerStatusEl.appendChild(this.renderStatusBars(this.player));

		// Update enemy status
		if (this.enemyStatusEl) {
			this.enemyStatusEl.innerHTML = '';
			this.enemyStatusEl.appendChild(this.renderStatusBars(this.enemy));
		}

		// Update log
		if (this.logEl) {
			this.logEl.innerHTML = '';
			for (const msg of this.combatLog) {
				this.logEl.appendChild(div({ className: 'cb-log-line' }, msg));
			}
			this.logEl.scrollTop = this.logEl.scrollHeight;
		}

		// Update menu
		if (this.menuEl) {
			const state = this.combatManager.getState();
			const combatEnded = state === CombatState.VICTORY || state === CombatState.DEFEAT || state === CombatState.FLED;

			this.menuEl.innerHTML = '';
			const title = this.currentMenu === 'main' ? 'Choose Action:' :
			              this.currentMenu === 'skills' ? 'Select Skill:' : 'Select Item:';
			this.menuEl.appendChild(div({ className: 'cb-menu-title' }, title));

			const optionsDiv = div({ className: 'cb-menu-options' });
			const options = this.getCurrentMenuOptions();
			options.forEach((opt, i) => {
				const cls = 'cb-opt' + (i === this.selectedIndex && opt.enabled ? ' cb-opt-selected' : '') + (!opt.enabled ? ' cb-opt-disabled' : '');
				optionsDiv.appendChild(button({ className: cls, onClick: () => opt.enabled && opt.action() }, opt.text));
			});
			this.menuEl.appendChild(optionsDiv);

			if (this.hintEl) {
				this.hintEl.textContent = combatEnded
					? 'Press ESC or Enter to return'
					: '↑↓: Navigate | Enter: Select | ESC: Back';
			}
		}
	}

	override renderHTML(): HTMLElement {
		this.setupStyles();

		this.playerStatusEl = div({ className: 'cb-status cb-status-left' });
		this.enemyStatusEl = div({ className: 'cb-status cb-status-right' });
		this.logEl = div({ className: 'cb-log' });
		this.menuEl = div({ className: 'cb-menu' });
		this.hintEl = div({ className: 'cb-hint' });

		const root = div({ className: 'cb-overlay' },
			this.playerStatusEl,
			this.enemyStatusEl,
			this.logEl,
			this.menuEl,
			this.hintEl,
		);

		if (this.combatStarted) {
			this.playerStatusEl.appendChild(this.renderStatusBars(this.player));
			this.enemyStatusEl.appendChild(this.renderStatusBars(this.enemy));
			this.updateUI();
		}

		return root;
	}

	override onHTMLMounted(el: HTMLElement): void {
		this.setupInput();
		this.setupCombatEvents();
		if (this.combatStarted) this.updateUI();
	}

	override onEnter(): void {
		super.onEnter();
		console.log('[CombatScene] Entered');
	}

	override onExit(): void {
		if (this.exitTimer) { clearTimeout(this.exitTimer); this.exitTimer = null; }
		if (this.aiActionTimer) { clearTimeout(this.aiActionTimer); this.aiActionTimer = null; }
		if (this.combatManager) this.combatManager.removeAllListeners();
		this.cleanupKeyboard();
		super.onExit();
		console.log('[CombatScene] Exited');
	}

	private cleanupKeyboard(): void {
		for (const [key, handler] of this.keyHandlers) {
			keyboard.removeKeyDownListener(key, handler);
		}
		this.keyHandlers.clear();
	}

	override destroy(): void {
		if (this.exitTimer) { clearTimeout(this.exitTimer); this.exitTimer = null; }
		if (this.aiActionTimer) { clearTimeout(this.aiActionTimer); this.aiActionTimer = null; }
		this.cleanupKeyboard();
		if (this.combatManager) this.combatManager.destroy();
		this.onExit();
	}
}
