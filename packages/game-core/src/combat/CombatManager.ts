/**
 * CombatManager
 * Turn-based combat system (Pokemon-style)
 */

import { EventEmitter } from '../utils/EventEmitter';

export enum CombatState {
	INIT = 'INIT',
	TURN_START = 'TURN_START',
	ACTION_SELECT = 'ACTION_SELECT',
	ACTION_EXECUTE = 'ACTION_EXECUTE',
	TURN_END = 'TURN_END',
	VICTORY = 'VICTORY',
	DEFEAT = 'DEFEAT',
	FLED = 'FLED',
}

export enum CombatActionType {
	ATTACK = 'ATTACK',
	SKILL = 'SKILL',
	ITEM = 'ITEM',
	FLEE = 'FLEE',
}

export interface CombatStats {
	hp: number;
	maxHp: number;
	mp: number;
	maxMp: number;
	atk: number;
	def: number;
	spd: number;
	luck: number;
}

export interface StatusEffect {
	type: string;
	value: number;
	duration: number;
	turnsLeft: number;
}

export interface CombatEntity {
	id: string;
	name: string;
	level: number;
	stats: CombatStats;
	skills: string[];
	element?: string;
	statusEffects: StatusEffect[];
	isPlayer: boolean;
}

export interface CombatAction {
	actorId: string;
	type: CombatActionType;
	targetId: string;
	skillId?: string;
	itemId?: string;
}

export interface DamageResult {
	damage: number;
	isCritical: boolean;
	isResisted: boolean;
	isWeak: boolean;
	statusInflicted?: string;
}

export interface CombatEvents {
	'state-changed': (state: CombatState) => void;
	'turn-start': (actorId: string) => void;
	'action-executed': (action: CombatAction, result: DamageResult) => void;
	'entity-damaged': (entityId: string, damage: number) => void;
	'entity-defeated': (entityId: string) => void;
	'status-applied': (entityId: string, status: StatusEffect) => void;
	'combat-end': (result: 'victory' | 'defeat' | 'fled') => void;
}

export class CombatManager extends EventEmitter<CombatEvents> {
	private state: CombatState = CombatState.INIT;
	private entities: Map<string, CombatEntity> = new Map();
	private turnOrder: string[] = [];
	private currentTurnIndex: number = 0;
	private pendingAction: CombatAction | null = null;
	private turnCount: number = 0;

	// Element effectiveness chart
	private elementChart: Map<string, { weak: string[]; resist: string[] }> = new Map([
		['fire', { weak: ['earth'], resist: ['water'] }],
		['water', { weak: ['fire'], resist: ['earth'] }],
		['earth', { weak: ['water'], resist: ['fire'] }],
		['neutral', { weak: [], resist: [] }],
	]);

	constructor() {
		super();
	}

	/**
	 * Initialize combat
	 */
	initCombat(player: CombatEntity, enemies: CombatEntity[]): void {
		this.reset();

		// Add entities
		this.entities.set(player.id, player);
		enemies.forEach((enemy) => this.entities.set(enemy.id, enemy));

		// Calculate turn order based on speed
		this.calculateTurnOrder();

		// Start combat
		this.state = CombatState.TURN_START;
		this.emit('state-changed', this.state);
		this.startTurn();
	}

	/**
	 * Calculate turn order based on speed stat
	 */
	private calculateTurnOrder(): void {
		this.turnOrder = Array.from(this.entities.values())
			.sort((a, b) => {
				// Higher speed goes first
				if (b.stats.spd !== a.stats.spd) {
					return b.stats.spd - a.stats.spd;
				}
				// Tie-breaker: higher luck
				return b.stats.luck - a.stats.luck;
			})
			.map((entity) => entity.id);
	}

	/**
	 * Start a new turn
	 */
	private startTurn(): void {
		this.turnCount++;

		// Process status effects at turn start
		this.processStatusEffects();

		// Get current actor
		const actorId = this.turnOrder[this.currentTurnIndex];
		const actor = this.entities.get(actorId);

		if (!actor) {
			this.nextTurn();
			return;
		}

		// Skip turn if actor is defeated
		if (actor.stats.hp <= 0) {
			this.nextTurn();
			return;
		}

		this.state = CombatState.ACTION_SELECT;
		this.emit('state-changed', this.state);
		this.emit('turn-start', actorId);
	}

	/**
	 * Submit action for current actor
	 */
	submitAction(action: CombatAction): void {
		if (this.state !== CombatState.ACTION_SELECT) {
			console.warn('[CombatManager] Cannot submit action in current state');
			return;
		}

		const currentActorId = this.turnOrder[this.currentTurnIndex];
		if (action.actorId !== currentActorId) {
			console.warn('[CombatManager] Action submitted by wrong actor');
			return;
		}

		this.pendingAction = action;
		this.executeAction();
	}

	/**
	 * Execute the pending action
	 */
	private executeAction(): void {
		if (!this.pendingAction) return;

		this.state = CombatState.ACTION_EXECUTE;
		this.emit('state-changed', this.state);

		const action = this.pendingAction;
		const actor = this.entities.get(action.actorId);
		const target = this.entities.get(action.targetId);

		if (!actor || !target) {
			this.endTurn();
			return;
		}

		let result: DamageResult = {
			damage: 0,
			isCritical: false,
			isResisted: false,
			isWeak: false,
		};

		switch (action.type) {
			case CombatActionType.ATTACK:
				result = this.executeAttack(actor, target);
				break;
			case CombatActionType.SKILL:
				if (action.skillId) {
					result = this.executeSkill(actor, target, action.skillId);
				}
				break;
			case CombatActionType.ITEM:
				// TODO: Implement item usage
				break;
			case CombatActionType.FLEE:
				this.executeFlee(actor);
				return;
		}

		this.emit('action-executed', action, result);

		// Apply damage
		if (result.damage > 0) {
			this.applyDamage(target.id, result.damage);
		}

		// Check for combat end
		if (this.checkCombatEnd()) {
			return;
		}

		this.endTurn();
	}

	/**
	 * Execute basic attack
	 */
	private executeAttack(actor: CombatEntity, target: CombatEntity): DamageResult {
		const baseDamage = this.calculateBaseDamage(actor.stats.atk, target.stats.def);
		const isCritical = this.rollCritical(actor.stats.luck);
		let damage = baseDamage;

		if (isCritical) {
			damage = Math.floor(damage * 1.5);
		}

		return {
			damage,
			isCritical,
			isResisted: false,
			isWeak: false,
		};
	}

	/**
	 * Execute skill
	 */
	private executeSkill(
		actor: CombatEntity,
		target: CombatEntity,
		skillId: string,
	): DamageResult {
		// TODO: Load skill data from JSON
		// For now, use placeholder values
		const skillPower = 70;
		const skillElement = 'fire';
		const mpCost = 10;

		// Check MP
		if (actor.stats.mp < mpCost) {
			return { damage: 0, isCritical: false, isResisted: false, isWeak: false };
		}

		// Consume MP
		actor.stats.mp -= mpCost;

		// Calculate damage
		let baseDamage = this.calculateBaseDamage(
			actor.stats.atk + skillPower,
			target.stats.def,
		);
		const isCritical = this.rollCritical(actor.stats.luck);

		// Element effectiveness
		const { isWeak, isResisted } = this.checkElementEffectiveness(
			skillElement,
			target.element || 'neutral',
		);

		if (isWeak) baseDamage = Math.floor(baseDamage * 1.5);
		if (isResisted) baseDamage = Math.floor(baseDamage * 0.5);
		if (isCritical) baseDamage = Math.floor(baseDamage * 1.5);

		return {
			damage: baseDamage,
			isCritical,
			isResisted,
			isWeak,
		};
	}

	/**
	 * Execute flee attempt
	 */
	private executeFlee(actor: CombatEntity): void {
		// 50% base flee chance + (speed / 10)%
		const fleeChance = 0.5 + actor.stats.spd / 1000;
		const success = Math.random() < fleeChance;

		if (success) {
			this.state = CombatState.FLED;
			this.emit('state-changed', this.state);
			this.emit('combat-end', 'fled');
		} else {
			// Flee failed, end turn
			this.endTurn();
		}
	}

	/**
	 * Calculate base damage
	 */
	private calculateBaseDamage(atk: number, def: number): number {
		// Formula: (ATK * 2 - DEF) * random(0.85, 1.0)
		const rawDamage = Math.max(1, atk * 2 - def);
		const variance = 0.85 + Math.random() * 0.15;
		return Math.floor(rawDamage * variance);
	}

	/**
	 * Roll for critical hit
	 */
	private rollCritical(luck: number): boolean {
		// Base 5% + (luck / 10)% crit chance
		const critChance = 0.05 + luck / 1000;
		return Math.random() < critChance;
	}

	/**
	 * Check element effectiveness
	 */
	private checkElementEffectiveness(
		attackElement: string,
		defenseElement: string,
	): { isWeak: boolean; isResisted: boolean } {
		const elementData = this.elementChart.get(attackElement);
		if (!elementData) {
			return { isWeak: false, isResisted: false };
		}

		return {
			isWeak: elementData.weak.includes(defenseElement),
			isResisted: elementData.resist.includes(defenseElement),
		};
	}

	/**
	 * Apply damage to entity
	 */
	private applyDamage(entityId: string, damage: number): void {
		const entity = this.entities.get(entityId);
		if (!entity) return;

		entity.stats.hp = Math.max(0, entity.stats.hp - damage);
		this.emit('entity-damaged', entityId, damage);

		if (entity.stats.hp <= 0) {
			this.emit('entity-defeated', entityId);
		}
	}

	/**
	 * Process status effects
	 */
	private processStatusEffects(): void {
		this.entities.forEach((entity) => {
			entity.statusEffects = entity.statusEffects.filter((effect) => {
				effect.turnsLeft--;

				// Apply effect
				if (effect.type === 'poison') {
					const damage = Math.floor(entity.stats.maxHp * 0.1);
					this.applyDamage(entity.id, damage);
				} else if (effect.type === 'burn') {
					const damage = Math.floor(entity.stats.maxHp * 0.05);
					this.applyDamage(entity.id, damage);
				}

				// Remove if expired
				return effect.turnsLeft > 0;
			});
		});
	}

	/**
	 * End current turn
	 */
	private endTurn(): void {
		this.state = CombatState.TURN_END;
		this.emit('state-changed', this.state);

		this.pendingAction = null;
		this.nextTurn();
	}

	/**
	 * Move to next turn
	 */
	private nextTurn(): void {
		this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;

		// Start new turn
		this.state = CombatState.TURN_START;
		this.emit('state-changed', this.state);
		this.startTurn();
	}

	/**
	 * Check if combat has ended
	 */
	private checkCombatEnd(): boolean {
		const alivePlayers = Array.from(this.entities.values()).filter(
			(e) => e.isPlayer && e.stats.hp > 0,
		);
		const aliveEnemies = Array.from(this.entities.values()).filter(
			(e) => !e.isPlayer && e.stats.hp > 0,
		);

		if (alivePlayers.length === 0) {
			this.state = CombatState.DEFEAT;
			this.emit('state-changed', this.state);
			this.emit('combat-end', 'defeat');
			return true;
		}

		if (aliveEnemies.length === 0) {
			this.state = CombatState.VICTORY;
			this.emit('state-changed', this.state);
			this.emit('combat-end', 'victory');
			return true;
		}

		return false;
	}

	/**
	 * Get current state
	 */
	getState(): CombatState {
		return this.state;
	}

	/**
	 * Get current actor
	 */
	getCurrentActor(): CombatEntity | null {
		const actorId = this.turnOrder[this.currentTurnIndex];
		return this.entities.get(actorId) || null;
	}

	/**
	 * Get entity by ID
	 */
	getEntity(id: string): CombatEntity | null {
		return this.entities.get(id) || null;
	}

	/**
	 * Get all entities
	 */
	getAllEntities(): CombatEntity[] {
		return Array.from(this.entities.values());
	}

	/**
	 * Get turn order
	 */
	getTurnOrder(): string[] {
		return [...this.turnOrder];
	}

	/**
	 * Get turn count
	 */
	getTurnCount(): number {
		return this.turnCount;
	}

	/**
	 * Reset combat
	 */
	private reset(): void {
		this.entities.clear();
		this.turnOrder = [];
		this.currentTurnIndex = 0;
		this.pendingAction = null;
		this.turnCount = 0;
		this.state = CombatState.INIT;
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.reset();
		this.removeAllListeners();
	}
}
