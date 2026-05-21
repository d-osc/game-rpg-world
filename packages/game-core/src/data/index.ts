/**
 * Data Module
 * Game data loading and management
 */

export { DataLoader, dataLoader } from './DataLoader';
export type {
	MonsterStats,
	ItemDrop,
	MonsterSprite,
	MonsterData,
	ItemStats,
	ItemEffect,
	ItemData,
	// JobSkill - exported from ./jobs/index
	// PassiveAbility - exported from ./jobs/index
	JobData,
	SkillEffect,
	SkillData,
	RecipeMaterial,
	RecipeData,
	// NPCData - exported from ./world/index
	ContinentData,
	GameData,
} from './DataLoader';
