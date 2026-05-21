/**
 * SkillSystem
 * Loads skills from data and executes skill effects in combat
 */

import { dataLoader, type SkillData } from '../data/DataLoader';
import { gameStateManager } from '../state/GameStateManager';
import { jobManager } from '../jobs/JobManager';
import type { CombatEntity } from './CombatManager';

// ============================================================================
// Type Definitions
// ============================================================================

export interface SkillExecutionResult {
	success: boolean;
	damage?: number;
	healing?: number;
	mpCost: number;
	criticalHit?: boolean;
	effects?: AppliedEffect[];
	message: string;
}

export interface AppliedEffect {
	type: string;
	value?: number;
	duration?: number;
	chance?: number;
}

export interface SkillTarget {
	entity: CombatEntity;
	isAlly: boolean;
}

// ============================================================================
// SkillSystem Class
// ============================================================================

export class SkillSystem {
	/**
	 * Get all skills available to the player
	 */
	getPlayerSkills(): SkillData[] {
		const skills: SkillData[] = [];

		// Get skills from all learned jobs via JobManager
		for (const learnedJob of jobManager.getAllLearnedJobs()) {
			for (const skillId of learnedJob.unlockedSkills) {
				const skill = dataLoader.getSkill(skillId);
				if (skill && !skills.find((s) => s.id === skill.id)) {
					skills.push(skill);
				}
			}
		}

		return skills;
	}

	/**
	 * Get skills for a monster
	 */
	getMonsterSkills(monsterSkillIds: string[]): SkillData[] {
		const skills: SkillData[] = [];

		for (const skillId of monsterSkillIds) {
			const skill = dataLoader.getSkill(skillId);
			if (skill) {
				skills.push(skill);
			}
		}

		return skills;
	}

	/**
	 * Check if entity has enough MP to use skill
	 */
	canUseSkill(entity: CombatEntity, skill: SkillData): boolean {
		return entity.stats.mp >= skill.mpCost;
	}

	/**
	 * Execute a skill
	 */
	executeSkill(
		skill: SkillData,
		user: CombatEntity,
		targets: SkillTarget[]
	): SkillExecutionResult[] {
		const results: SkillExecutionResult[] = [];

		// Consume MP once for the skill (not per target)
		user.stats.mp = Math.max(0, user.stats.mp - skill.mpCost);

		for (const { entity: target, isAlly } of targets) {
			const result = this.executeSingleTarget(skill, user, target, isAlly);
			results.push(result);
		}

		return results;
	}

	/**
	 * Execute skill on a single target
	 */
	private executeSingleTarget(
		skill: SkillData,
		user: CombatEntity,
		target: CombatEntity,
		isAlly: boolean
	): SkillExecutionResult {
		const result: SkillExecutionResult = {
			success: false,
			mpCost: skill.mpCost,
			message: '',
		};

		// Check accuracy
		const hitChance = skill.accuracy / 100;
		const hitRoll = Math.random();

		if (hitRoll > hitChance) {
			result.success = false;
			result.message = `${user.name}'s ${skill.name} missed!`;
			return result;
		}

		result.success = true;

		// Calculate damage or healing
		if (skill.type === 'physical' || skill.type === 'magic') {
			// Damage skill
			const { damage, isCrit } = this.calculateDamage(skill, user, target);
			result.damage = damage;
			result.criticalHit = isCrit;

			// Apply damage
			target.stats.hp = Math.max(0, target.stats.hp - damage);

			if (isCrit) {
				result.message = `${user.name} used ${skill.name}! Critical hit! ${damage} damage!`;
			} else {
				result.message = `${user.name} used ${skill.name}! ${damage} damage!`;
			}
		} else if (skill.type === 'healing') {
			// Healing skill
			const healing = this.calculateHealing(skill, user);
			result.healing = healing;

			// Apply healing
			target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healing);

			result.message = `${user.name} used ${skill.name}! Restored ${healing} HP!`;
		} else if (skill.type === 'support') {
			// Support skill (buff/debuff)
			result.message = `${user.name} used ${skill.name}!`;
		}

		// Apply additional effects
		result.effects = this.applySkillEffects(skill, user, target);

		return result;
	}

	/**
	 * Calculate damage for a skill
	 */
	private calculateDamage(
		skill: SkillData,
		user: CombatEntity,
		target: CombatEntity
	): { damage: number; isCrit: boolean } {
		let baseDamage = 0;

		if (skill.type === 'physical') {
			// Physical damage: (ATK * power) - DEF
			baseDamage = user.stats.atk * (skill.power / 100) - target.stats.def * 0.5;
		} else if (skill.type === 'magic') {
			// Magic damage: (INT * power) - (DEF * 0.3)
			baseDamage = user.stats.luck * (skill.power / 100) - target.stats.def * 0.3;
		}

		// Minimum damage
		baseDamage = Math.max(1, baseDamage);

		// Check for critical hit
		const critBoost = skill.effects.find((e) => e.type === 'crit_boost');
		const baseCritChance = 0.05; // 5% base crit
		const critChance = critBoost ? baseCritChance + critBoost.value : baseCritChance;

		const isCrit = Math.random() < critChance;
		const finalDamage = isCrit ? Math.floor(baseDamage * 1.5) : Math.floor(baseDamage);

		return { damage: finalDamage, isCrit };
	}

	/**
	 * Calculate healing for a skill
	 */
	private calculateHealing(skill: SkillData, user: CombatEntity): number {
		// Healing: power as base, can be affected by user's stats
		const baseHealing = skill.power;
		const statBonus = user.stats.luck * 0.2; // Bonus from INT stat

		return Math.floor(baseHealing + statBonus);
	}

	/**
	 * Apply additional skill effects (status effects, buffs, debuffs)
	 */
	private applySkillEffects(
		skill: SkillData,
		user: CombatEntity,
		target: CombatEntity
	): AppliedEffect[] {
		const appliedEffects: AppliedEffect[] = [];

		for (const effect of skill.effects) {
			// Skip crit_boost as it's handled in damage calculation
			if (effect.type === 'crit_boost') continue;

			// Check if effect applies (based on chance if specified)
			const effectChance = (effect as any).chance ?? 1.0;
			if (Math.random() > effectChance) continue;

			// Apply the effect
			switch (effect.type) {
				case 'burn':
				case 'poison':
				case 'freeze':
				case 'stun':
					// Status effects - would be applied to entity's status array
					appliedEffects.push({
						type: effect.type,
						duration: (effect as any).duration ?? 3,
					});
					break;

				case 'atk_up':
				case 'atk_down':
				case 'def_up':
				case 'def_down':
				case 'spd_up':
				case 'spd_down':
					// Stat modifications
					appliedEffects.push({
						type: effect.type,
						value: effect.value,
						duration: (effect as any).duration ?? 3,
					});
					break;

				case 'hp_drain':
					// Drain HP from target to user
					const drainAmount = Math.floor((target.stats.maxHp * effect.value) / 100);
					user.stats.hp = Math.min(user.stats.maxHp, user.stats.hp + drainAmount);
					appliedEffects.push({
						type: effect.type,
						value: drainAmount,
					});
					break;

				case 'mp_drain':
					// Drain MP from target to user
					const mpDrainAmount = Math.floor((target.stats.maxMp * effect.value) / 100);
					target.stats.mp = Math.max(0, target.stats.mp - mpDrainAmount);
					user.stats.mp = Math.min(user.stats.maxMp, user.stats.mp + mpDrainAmount);
					appliedEffects.push({
						type: effect.type,
						value: mpDrainAmount,
					});
					break;

				default:
					// Unknown effect type
					console.warn(`[SkillSystem] Unknown effect type: ${effect.type}`);
					break;
			}
		}

		return appliedEffects;
	}

	/**
	 * Get skill targets based on skill target type
	 */
	getSkillTargets(
		skill: SkillData,
		userIsPlayer: boolean,
		playerEntity: CombatEntity,
		enemyEntities: CombatEntity[],
		user?: CombatEntity
	): SkillTarget[] {
		const targets: SkillTarget[] = [];

		switch (skill.target) {
			case 'single':
				// Single target (default to first enemy or player)
				if (userIsPlayer) {
					// Player targeting enemy
					if (enemyEntities.length > 0) {
						targets.push({ entity: enemyEntities[0]!, isAlly: false });
					}
				} else {
					// Enemy targeting player
					targets.push({ entity: playerEntity, isAlly: false });
				}
				break;

			case 'all_enemies':
				// All enemies
				if (userIsPlayer) {
					// Player targeting all enemies
					for (const enemy of enemyEntities) {
						targets.push({ entity: enemy, isAlly: false });
					}
				} else {
					// Enemy targeting player (only one player in current implementation)
					targets.push({ entity: playerEntity, isAlly: false });
				}
				break;

			case 'all_allies':
				// All allies
				if (userIsPlayer) {
					// Player targeting self (no party members yet)
					targets.push({ entity: playerEntity, isAlly: true });
				} else {
					// Enemy targeting all allies (all enemies)
					for (const enemy of enemyEntities) {
						targets.push({ entity: enemy, isAlly: true });
					}
				}
				break;

			case 'self':
				// Self only
				if (userIsPlayer) {
					targets.push({ entity: playerEntity, isAlly: true });
				} else if (user) {
					targets.push({ entity: user, isAlly: true });
				} else {
					const self = enemyEntities.find((e) => e.isPlayer === false);
					if (self) {
						targets.push({ entity: self, isAlly: true });
					}
				}
				break;

			case 'random':
				// Random enemy
				if (userIsPlayer && enemyEntities.length > 0) {
					const randomIndex = Math.floor(Math.random() * enemyEntities.length);
					targets.push({ entity: enemyEntities[randomIndex]!, isAlly: false });
				} else {
					targets.push({ entity: playerEntity, isAlly: false });
				}
				break;

			case 'single_ally':
				if (userIsPlayer) {
					targets.push({ entity: playerEntity, isAlly: true });
				} else if (user) {
					targets.push({ entity: user, isAlly: true });
				} else {
					const self = enemyEntities.find((e) => e.isPlayer === false);
					if (self) {
						targets.push({ entity: self, isAlly: true });
					}
				}
				break;

			default:
				console.warn(`[SkillSystem] Unknown target type: ${skill.target}`);
				break;
		}

		return targets;
	}

	/**
	 * Get a random skill for AI to use
	 */
	selectAISkill(entity: CombatEntity, availableSkills: SkillData[]): SkillData | null {
		// Filter skills that can be used (enough MP)
		const usableSkills = availableSkills.filter((skill) =>
			this.canUseSkill(entity, skill)
		);

		if (usableSkills.length === 0) {
			return null;
		}

		// Simple AI: randomly select from usable skills
		// More advanced AI could consider:
		// - HP threshold for healing
		// - Status effects
		// - Enemy weaknesses
		// - Skill power vs MP cost efficiency

		const randomIndex = Math.floor(Math.random() * usableSkills.length);
		return usableSkills[randomIndex] ?? null;
	}

	/**
	 * Get skill description with actual values
	 */
	getSkillDescription(skill: SkillData): string {
		let description = skill.description;

		// Add MP cost
		description += `\nMP Cost: ${skill.mpCost}`;

		// Add power if applicable
		if (skill.power > 0) {
			description += `\nPower: ${skill.power}`;
		}

		// Add accuracy
		description += `\nAccuracy: ${skill.accuracy}%`;

		// Add target info
		const targetText = {
			single: 'Single Enemy',
			all_enemies: 'All Enemies',
			all_allies: 'All Allies',
			self: 'Self',
			random: 'Random Enemy',
		}[skill.target] || skill.target;
		description += `\nTarget: ${targetText}`;

		// Add element
		if (skill.element !== 'neutral') {
			description += `\nElement: ${skill.element}`;
		}

		// Add effects
		if (skill.effects.length > 0) {
			description += '\nEffects: ';
			const effectDescs = skill.effects.map((effect) => {
				if (effect.type === 'burn' || effect.type === 'poison') {
					return `${effect.type} (${(effect as any).chance * 100}% chance)`;
				} else if (effect.type === 'crit_boost') {
					return `+${effect.value * 100}% crit chance`;
				} else if (effect.type.includes('_up') || effect.type.includes('_down')) {
					return `${effect.type.replace('_', ' ')} ${effect.value * 100}%`;
				}
				return effect.type;
			});
			description += effectDescs.join(', ');
		}

		return description;
	}
}

// Export singleton instance
export const skillSystem = new SkillSystem();
