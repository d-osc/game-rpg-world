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
