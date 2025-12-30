/**
 * Combat Module
 * Turn-based combat system
 */

export { CombatManager, CombatState, CombatActionType } from './CombatManager.ts';
export type {
	CombatStats,
	StatusEffect,
	CombatEntity,
	CombatAction,
	DamageResult,
	CombatEvents,
} from './CombatManager.ts';

export { CombatAI, AIPattern } from './CombatAI.ts';

export {
	CombatAnimationManager,
	DamageNumber,
	AttackAnimation,
	SkillAnimation,
} from './CombatAnimations.ts';
export type { DamageNumberConfig, CombatAnimationConfig } from './CombatAnimations.ts';

export { CombatSync, DeterministicRNG } from './CombatSync.ts';
export type {
	CombatSyncMessage,
	CombatInitData,
	CombatActionData,
	CombatResultData,
	CombatEndData,
	CombatSyncEvents,
} from './CombatSync.ts';
