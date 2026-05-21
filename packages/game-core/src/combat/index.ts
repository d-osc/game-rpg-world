/**
 * Combat Module
 * Turn-based and real-time combat systems
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

export { SkillSystem, skillSystem } from './SkillSystem';
export type { SkillExecutionResult, AppliedEffect, SkillTarget } from './SkillSystem';

export { LootSystem, lootSystem } from './LootSystem';
export type { LootResult, LootedItem } from './LootSystem';

// Real-time combat
export { DamageFormulas } from './DamageFormulas';
export { CooldownTracker } from './CooldownTracker';
export { WorldMonster, MonsterAIState } from './WorldMonster';
export type { CombatStats as RealtimeCombatStats, ActiveStatusEffect } from './WorldMonster';
export { RealtimeCombatSystem, realtimeCombatSystem } from './RealtimeCombatSystem';
export { MonsterRespawnManager } from './MonsterRespawnManager';
