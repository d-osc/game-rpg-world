/**
 * Economy Module
 * Crafting, trading, and currency management
 */

export { CraftingManager } from './CraftingManager.ts';
export type {
	CraftingRecipe,
	CraftingMaterial,
	CraftingProgress,
	CraftingResult,
	CraftingManagerEvents,
} from './CraftingManager.ts';

export { TradingManager } from './TradingManager.ts';
export type {
	TradeItem,
	TradeOffer,
	Trade,
	TradingManagerEvents,
} from './TradingManager.ts';
