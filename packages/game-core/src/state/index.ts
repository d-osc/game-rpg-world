/**
 * State Module
 * Global game state management
 */

export { GameStateManager, gameStateManager } from './GameStateManager';
export type {
	PlayerStats,
	PlayerState,
	WorldState,
	// CombatState - exported from ./combat/index (as enum, not interface)
	SaveData,
} from './GameStateManager';
