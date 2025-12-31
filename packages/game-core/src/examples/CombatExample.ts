/**
 * CombatExample
 * Example of how to use the combat system with animations and P2P sync
 */

import {
	CombatManager,
	CombatAnimationManager,
	CombatSync,
	DeterministicRNG,
	CombatAI,
	AIPattern,
} from '../combat/index';
import type { CombatEntity, CombatAction } from '../combat/index';
import { CombatUI } from '../ui/CombatUI';

export class CombatExample {
	private combat: CombatManager;
	private animations: CombatAnimationManager;
	private sync: CombatSync | null = null;
	private rng: DeterministicRNG | null = null;
	private ui: CombatUI;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;

	constructor(
		canvas: HTMLCanvasElement,
		uiContainer: HTMLElement,
		isPvP: boolean = false,
		playerId?: string,
	) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d')!;

		// Create combat manager
		this.combat = new CombatManager();

		// Create animation manager
		this.animations = new CombatAnimationManager();

		// Create UI
		this.ui = new CombatUI(this.combat, {
			container: uiContainer,
			onActionSelected: (action) => this.handlePlayerAction(action),
		});

		// Setup combat events
		this.setupCombatEvents();

		// Setup P2P sync if PvP
		if (isPvP && playerId) {
			this.setupPvPCombat(playerId);
		}
	}

	/**
	 * Setup PvP combat with sync
	 */
	private setupPvPCombat(playerId: string): void {
		const combatId = `combat-${Date.now()}`;
		const seed = Date.now();

		this.sync = new CombatSync(combatId, playerId, seed);
		this.rng = new DeterministicRNG(seed);

		// Setup sync events
		this.sync.on('sync-received', (message) => {
			console.log('[CombatExample] Sync received:', message.type);
		});

		this.sync.on('desync-detected', (error) => {
			console.error('[CombatExample] Desync detected:', error);
			alert(`Combat desync: ${error}`);
		});

		this.sync.on('combat-validated', () => {
			console.log('[CombatExample] Combat validated');
		});

		// Set send callback (should be connected to NetworkManager)
		this.sync.setSendCallback((data) => {
			console.log('[CombatExample] Would send to peer:', data);
			// TODO: Integrate with NetworkManager
			// networkManager.broadcast(data);
		});
	}

	/**
	 * Setup combat event handlers
	 */
	private setupCombatEvents(): void {
		// Action executed - add animations
		this.combat.on('action-executed', (action, result) => {
			const actor = this.combat.getEntity(action.actorId);
			const target = this.combat.getEntity(action.targetId);

			if (!actor || !target) return;

			// Get positions (for demo, use placeholder positions)
			const actorPos = this.getEntityPosition(action.actorId);
			const targetPos = this.getEntityPosition(action.targetId);

			// Add attack/skill animation
			if (action.type === 'ATTACK') {
				this.animations.addAttackAnimation(
					actorPos.x,
					actorPos.y,
					targetPos.x,
					targetPos.y,
				);
			} else if (action.type === 'SKILL' && action.skillId) {
				this.animations.addSkillAnimation(targetPos.x, targetPos.y, action.skillId);
			}

			// Add damage number after delay
			setTimeout(() => {
				this.animations.addDamageNumber({
					x: targetPos.x,
					y: targetPos.y - 30,
					damage: result.damage,
					isCritical: result.isCritical,
					isWeak: result.isWeak,
					isResisted: result.isResisted,
				});
			}, 200);

			// Send result to peer if PvP
			if (this.sync && actor.isPlayer) {
				this.sync.sendResult(this.combat.getTurnCount(), result, {
					hp: target.stats.hp,
					mp: target.stats.mp,
				});
			}
		});

		// Turn start - trigger AI if enemy turn
		this.combat.on('turn-start', (actorId) => {
			const actor = this.combat.getEntity(actorId);
			if (!actor || actor.isPlayer) return;

			// AI decision (delayed to allow UI update)
			setTimeout(() => {
				const allies = this.combat.getAllEntities().filter((e) => !e.isPlayer && e.stats.hp > 0);
				const enemies = this.combat.getAllEntities().filter((e) => e.isPlayer && e.stats.hp > 0);

				// Determine AI pattern from monster data
				let pattern = AIPattern.RANDOM;
				// TODO: Load from monster JSON

				const action = CombatAI.decideAction(actor, allies, enemies, pattern);
				this.combat.submitAction(action);
			}, 1000);
		});
	}

	/**
	 * Handle player action
	 */
	private handlePlayerAction(action: CombatAction): void {
		const actor = this.combat.getEntity(action.actorId);
		if (!actor) return;

		// Send action to peer if PvP
		if (this.sync) {
			this.sync.sendAction(this.combat.getTurnCount(), action, {
				hp: actor.stats.hp,
				mp: actor.stats.mp,
			});
		}

		// Submit to combat manager
		this.combat.submitAction(action);
	}

	/**
	 * Get entity screen position (placeholder)
	 */
	private getEntityPosition(entityId: string): { x: number; y: number } {
		const entity = this.combat.getEntity(entityId);
		if (!entity) return { x: 0, y: 0 };

		// Simple positioning based on player/enemy
		if (entity.isPlayer) {
			return { x: 200, y: 300 };
		} else {
			return { x: 600, y: 300 };
		}
	}

	/**
	 * Start combat
	 */
	startCombat(player: CombatEntity, enemies: CombatEntity[]): void {
		this.combat.initCombat(player, enemies);

		// Send init to peer if PvP
		if (this.sync) {
			this.sync.sendCombatInit([player, ...enemies]);
		}
	}

	/**
	 * Update (call every frame)
	 */
	update(deltaTime: number): void {
		// Update animations
		this.animations.update(deltaTime);

		// Render animations on canvas
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.animations.render(this.ctx);
	}

	/**
	 * Handle received sync message from peer
	 */
	handleSyncMessage(message: any): void {
		if (this.sync && message.type === 'combat-sync') {
			this.sync.handleMessage(message.data);
		}
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.combat.destroy();
		this.animations.clear();
		this.sync?.destroy();
		this.ui.destroy();
	}
}

/**
 * Usage Example:
 *
 * ```typescript
 * import { CombatExample } from '@rpg/game-core';
 *
 * // Create canvas for animations
 * const canvas = document.createElement('canvas');
 * canvas.width = 800;
 * canvas.height = 600;
 * document.body.appendChild(canvas);
 *
 * // Create combat instance
 * const combat = new CombatExample(canvas, document.body, false);
 *
 * // Define player
 * const player: CombatEntity = {
 *   id: 'player-1',
 *   name: 'Hero',
 *   level: 5,
 *   stats: {
 *     hp: 100,
 *     maxHp: 100,
 *     mp: 50,
 *     maxMp: 50,
 *     atk: 20,
 *     def: 15,
 *     spd: 18,
 *     luck: 12,
 *   },
 *   skills: ['slash', 'fireball'],
 *   element: 'neutral',
 *   statusEffects: [],
 *   isPlayer: true,
 * };
 *
 * // Define enemy
 * const enemy: CombatEntity = {
 *   id: 'enemy-1',
 *   name: 'Goblin',
 *   level: 3,
 *   stats: {
 *     hp: 80,
 *     maxHp: 80,
 *     mp: 15,
 *     maxMp: 15,
 *     atk: 15,
 *     def: 8,
 *     spd: 18,
 *     luck: 10,
 *   },
 *   skills: ['slash', 'quick_stab'],
 *   element: 'neutral',
 *   statusEffects: [],
 *   isPlayer: false,
 * };
 *
 * // Start combat
 * combat.startCombat(player, [enemy]);
 *
 * // Game loop
 * let lastTime = 0;
 * function gameLoop(currentTime: number) {
 *   const deltaTime = (currentTime - lastTime) / 1000;
 *   lastTime = currentTime;
 *
 *   combat.update(deltaTime);
 *
 *   requestAnimationFrame(gameLoop);
 * }
 * requestAnimationFrame(gameLoop);
 *
 * // For PvP combat:
 * const pvpCombat = new CombatExample(canvas, document.body, true, 'player-123');
 *
 * // Handle network messages
 * networkManager.on('peer-data', (peerId, data) => {
 *   if (data.type === 'combat-sync') {
 *     pvpCombat.handleSyncMessage(data);
 *   }
 * });
 * ```
 */
