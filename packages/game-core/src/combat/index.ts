/**
 * Combat Module
 * Turn-based combat system
 */

export { CombatManager, CombatState, CombatActionType } from './CombatManager';
export type {
	CombatStats,
	StatusEffect,
	CombatEntity,
	CombatAction,
	DamageResult,
	CombatEvents,
} from './CombatManager';

export { CombatAI, AIPattern } from './CombatAI';

export {
	CombatAnimationManager,
	DamageNumber,
	AttackAnimation,
	SkillAnimation,
} from './CombatAnimations';
export type { DamageNumberConfig, CombatAnimationConfig } from './CombatAnimations';

export { CombatSync, DeterministicRNG } from './CombatSync';
export type {
	CombatSyncMessage,
	CombatInitData,
	CombatActionData,
	CombatResultData,
	CombatEndData,
	CombatSyncEvents,
} from './CombatSync';
