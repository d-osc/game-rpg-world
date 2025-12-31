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

export { AuctionHouseClient } from './AuctionHouseClient.ts';
export type {
	AuctionOrder,
	CreateOrderRequest,
	SearchRequest,
	AuctionHouseClientEvents,
} from './AuctionHouseClient.ts';

export { PlayerShopManager } from './PlayerShopManager.ts';
export type {
	ShopLocation,
	ShopItem,
	PlayerShop,
	AddItemRequest,
	PurchaseRequest,
	SearchShopsRequest,
	PlayerShopManagerEvents,
} from './PlayerShopManager.ts';
