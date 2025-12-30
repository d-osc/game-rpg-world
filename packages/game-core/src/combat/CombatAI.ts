/**
 * CombatAI
 * AI logic for enemy combat decisions
 */

import type {
	CombatEntity,
	CombatAction,
	CombatActionType,
} from './CombatManager.ts';

export enum AIPattern {
	RANDOM = 'random', // Random actions
	AGGRESSIVE = 'aggressive', // Always attack strongest target
	DEFENSIVE = 'defensive', // Use defensive skills when low HP
	TACTICAL = 'tactical', // Smart decision making
}

export class CombatAI {
	/**
	 * Decide action for AI entity
	 */
	static decideAction(
		actor: CombatEntity,
		allies: CombatEntity[],
		enemies: CombatEntity[],
		pattern: AIPattern = AIPattern.RANDOM,
	): CombatAction {
		switch (pattern) {
			case AIPattern.RANDOM:
				return this.randomAction(actor, enemies);
			case AIPattern.AGGRESSIVE:
				return this.aggressiveAction(actor, enemies);
			case AIPattern.DEFENSIVE:
				return this.defensiveAction(actor, allies, enemies);
			case AIPattern.TACTICAL:
				return this.tacticalAction(actor, allies, enemies);
			default:
				return this.randomAction(actor, enemies);
		}
	}

	/**
	 * Random action
	 */
	private static randomAction(
		actor: CombatEntity,
		enemies: CombatEntity[],
	): CombatAction {
		const availableActions: CombatActionType[] = ['ATTACK'];

		// Add skills if has MP
		if (actor.stats.mp >= 10 && actor.skills.length > 0) {
			availableActions.push('SKILL');
		}

		// Random action type
		const actionType =
			availableActions[Math.floor(Math.random() * availableActions.length)];

		// Random target
		const target = enemies[Math.floor(Math.random() * enemies.length)];

		const action: CombatAction = {
			actorId: actor.id,
			type: actionType,
			targetId: target.id,
		};

		// If skill, pick random skill
		if (actionType === 'SKILL' && actor.skills.length > 0) {
			action.skillId = actor.skills[Math.floor(Math.random() * actor.skills.length)];
		}

		return action;
	}

	/**
	 * Aggressive action - always attack strongest enemy
	 */
	private static aggressiveAction(
		actor: CombatEntity,
		enemies: CombatEntity[],
	): CombatAction {
		// Target enemy with highest attack
		const target = enemies.reduce((prev, current) =>
			current.stats.atk > prev.stats.atk ? current : prev,
		);

		// Use strongest offensive skill if has MP
		if (actor.stats.mp >= 10 && actor.skills.length > 0) {
			// Prefer offensive skills (contains "attack", "slash", "fire", etc.)
			const offensiveSkills = actor.skills.filter(
				(skill) =>
					skill.includes('attack') ||
					skill.includes('slash') ||
					skill.includes('fire') ||
					skill.includes('smash') ||
					skill.includes('fang'),
			);

			if (offensiveSkills.length > 0) {
				return {
					actorId: actor.id,
					type: 'SKILL',
					targetId: target.id,
					skillId: offensiveSkills[0],
				};
			}
		}

		// Default to attack
		return {
			actorId: actor.id,
			type: 'ATTACK',
			targetId: target.id,
		};
	}

	/**
	 * Defensive action - use defensive skills when low HP
	 */
	private static defensiveAction(
		actor: CombatEntity,
		allies: CombatEntity[],
		enemies: CombatEntity[],
	): CombatAction {
		const hpPercent = actor.stats.hp / actor.stats.maxHp;

		// If low HP, use defensive/healing skill
		if (hpPercent < 0.3 && actor.stats.mp >= 10) {
			const defensiveSkills = actor.skills.filter(
				(skill) =>
					skill.includes('barrier') ||
					skill.includes('heal') ||
					skill.includes('shield') ||
					skill.includes('protect'),
			);

			if (defensiveSkills.length > 0) {
				return {
					actorId: actor.id,
					type: 'SKILL',
					targetId: actor.id, // Target self
					skillId: defensiveSkills[0],
				};
			}
		}

		// Otherwise, attack weakest enemy
		const target = enemies.reduce((prev, current) =>
			current.stats.hp < prev.stats.hp ? current : prev,
		);

		return {
			actorId: actor.id,
			type: 'ATTACK',
			targetId: target.id,
		};
	}

	/**
	 * Tactical action - smart decision making
	 */
	private static tacticalAction(
		actor: CombatEntity,
		allies: CombatEntity[],
		enemies: CombatEntity[],
	): CombatAction {
		const hpPercent = actor.stats.hp / actor.stats.maxHp;
		const mpPercent = actor.stats.mp / actor.stats.maxMp;

		// 1. If very low HP and has defensive skill, use it
		if (hpPercent < 0.25 && mpPercent >= 0.2) {
			const defensiveSkills = actor.skills.filter(
				(skill) =>
					skill.includes('barrier') || skill.includes('heal') || skill.includes('veil'),
			);

			if (defensiveSkills.length > 0) {
				return {
					actorId: actor.id,
					type: 'SKILL',
					targetId: actor.id,
					skillId: defensiveSkills[0],
				};
			}
		}

		// 2. If any enemy is low HP, finish them off
		const weakEnemy = enemies.find((e) => e.stats.hp / e.stats.maxHp < 0.2);
		if (weakEnemy) {
			return {
				actorId: actor.id,
				type: 'ATTACK',
				targetId: weakEnemy.id,
			};
		}

		// 3. If has good MP, use offensive skill on strongest enemy
		if (mpPercent >= 0.3) {
			const target = enemies.reduce((prev, current) =>
				current.stats.atk > prev.stats.atk ? current : prev,
			);

			const offensiveSkills = actor.skills.filter(
				(skill) =>
					!skill.includes('barrier') &&
					!skill.includes('heal') &&
					!skill.includes('howl') &&
					!skill.includes('veil'),
			);

			if (offensiveSkills.length > 0) {
				return {
					actorId: actor.id,
					type: 'SKILL',
					targetId: target.id,
					skillId: offensiveSkills[0],
				};
			}
		}

		// 4. Default: attack enemy with highest attack
		const target = enemies.reduce((prev, current) =>
			current.stats.atk > prev.stats.atk ? current : prev,
		);

		return {
			actorId: actor.id,
			type: 'ATTACK',
			targetId: target.id,
		};
	}

	/**
	 * Calculate flee success chance
	 */
	static calculateFleeChance(actor: CombatEntity, enemies: CombatEntity[]): number {
		const avgEnemySpeed =
			enemies.reduce((sum, e) => sum + e.stats.spd, 0) / enemies.length;
		const speedDiff = actor.stats.spd - avgEnemySpeed;

		// Base 50% + speed difference
		let chance = 0.5 + speedDiff / 100;

		// Clamp between 10% and 90%
		return Math.max(0.1, Math.min(0.9, chance));
	}

	/**
	 * Evaluate target priority
	 */
	static evaluateTargetPriority(
		targets: CombatEntity[],
		criteria: 'weakest' | 'strongest' | 'lowest_hp' | 'highest_threat',
	): CombatEntity {
		switch (criteria) {
			case 'weakest':
				return targets.reduce((prev, current) =>
					current.stats.def < prev.stats.def ? current : prev,
				);
			case 'strongest':
				return targets.reduce((prev, current) =>
					current.stats.atk > prev.stats.atk ? current : prev,
				);
			case 'lowest_hp':
				return targets.reduce((prev, current) =>
					current.stats.hp < prev.stats.hp ? current : prev,
				);
			case 'highest_threat':
				// Threat = ATK * (HP / maxHP)
				return targets.reduce((prev, current) => {
					const prevThreat = prev.stats.atk * (prev.stats.hp / prev.stats.maxHp);
					const currentThreat =
						current.stats.atk * (current.stats.hp / current.stats.maxHp);
					return currentThreat > prevThreat ? current : prev;
				});
			default:
				return targets[0];
		}
	}

	/**
	 * Should use skill?
	 */
	static shouldUseSkill(
		actor: CombatEntity,
		mpThreshold: number = 0.3,
	): boolean {
		const mpPercent = actor.stats.mp / actor.stats.maxMp;
		return mpPercent >= mpThreshold && actor.skills.length > 0;
	}

	/**
	 * Filter skills by type
	 */
	static filterSkills(
		skills: string[],
		type: 'offensive' | 'defensive' | 'support',
	): string[] {
		const patterns = {
			offensive: [
				'attack',
				'slash',
				'fire',
				'smash',
				'fang',
				'bite',
				'stab',
				'earthquake',
			],
			defensive: ['barrier', 'heal', 'shield', 'protect', 'guard'],
			support: ['howl', 'veil', 'buff', 'boost', 'aura', 'tactics'],
		};

		return skills.filter((skill) =>
			patterns[type].some((pattern) => skill.includes(pattern)),
		);
	}
}
