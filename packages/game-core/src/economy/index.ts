/**
 * Economy Module
 * Crafting, trading, and currency management
 */

export { CraftingManager } from './CraftingManager';
export type {
	CraftingRecipe,
	CraftingMaterial,
	CraftingProgress,
	CraftingResult,
	CraftingManagerEvents,
} from './CraftingManager';

export { TradingManager } from './TradingManager';
export type {
	TradeItem,
	TradeOffer,
	Trade,
	TradingManagerEvents,
} from './TradingManager';

export { AuctionHouseClient } from './AuctionHouseClient';
export type {
	AuctionOrder,
	CreateOrderRequest,
	SearchRequest,
	AuctionHouseClientEvents,
} from './AuctionHouseClient';

export { PlayerShopManager } from './PlayerShopManager';
export type {
	ShopLocation,
	ShopItem,
	PlayerShop,
	AddItemRequest,
	PurchaseRequest,
	SearchShopsRequest,
	PlayerShopManagerEvents,
} from './PlayerShopManager';
