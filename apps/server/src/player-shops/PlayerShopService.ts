/**
 * PlayerShopService
 * Server-side player shop management using elit/database
 */

import { Collection } from '../database/config.ts';

const shops = new Collection<any>('player_shops');
const shopItems = new Collection<any>('player_shop_items');
const shopTransactions = new Collection<any>('player_shop_transactions');

export interface ShopLocation {
	zone_id: string;
	x: number;
	y: number;
}

export interface ShopItem {
	item_id: string;
	quantity: number;
	price_per_unit: number;
}

export interface PlayerShop {
	id: number;
	owner_id: string;
	owner_name: string;
	shop_name: string;
	description: string;
	zone_id: string;
	x: number;
	y: number;
	is_open: boolean;
	created_at: string;
	updated_at: string;
	items?: ShopItem[];
}

export interface CreateShopRequest {
	owner_id: string;
	owner_name: string;
	shop_name: string;
	description: string;
	zone_id: string;
	x: number;
	y: number;
}

export interface AddItemRequest {
	item_id: string;
	quantity: number;
	price_per_unit: number;
}

export interface PurchaseRequest {
	buyer_id: string;
	buyer_name: string;
	item_id: string;
	quantity: number;
}

export interface SearchShopsRequest {
	zone_id?: string;
	owner_id?: string;
	item_id?: string;
	search_name?: string;
	is_open?: boolean;
	limit?: number;
	offset?: number;
}

export interface PurchaseResult {
	success: boolean;
	totalCost?: number;
	error?: string;
}

export class PlayerShopService {
	private readonly MAX_SHOPS_PER_PLAYER = 1;
	private readonly MAX_ITEMS_PER_SHOP = 100;
	private readonly SHOP_NAME_MIN_LENGTH = 3;
	private readonly SHOP_NAME_MAX_LENGTH = 50;
	private readonly DESCRIPTION_MAX_LENGTH = 200;
	private nextId = 1;

	async initialize(): Promise<void> {
		const all = shops.getAll();
		if (all.length > 0) {
			this.nextId = Math.max(...all.map((s: any) => s.id)) + 1;
		}
		console.log('[PlayerShopService] Database ready');
	}

	async createShop(request: CreateShopRequest): Promise<{ success: boolean; shopId?: number; error?: string }> {
		if (
			!request.shop_name ||
			request.shop_name.length < this.SHOP_NAME_MIN_LENGTH ||
			request.shop_name.length > this.SHOP_NAME_MAX_LENGTH
		) {
			return {
				success: false,
				error: `Shop name must be between ${this.SHOP_NAME_MIN_LENGTH} and ${this.SHOP_NAME_MAX_LENGTH} characters`,
			};
		}

		if (request.description && request.description.length > this.DESCRIPTION_MAX_LENGTH) {
			return {
				success: false,
				error: `Description cannot exceed ${this.DESCRIPTION_MAX_LENGTH} characters`,
			};
		}

		try {
			const existingShop = shops.find((s: any) => s.owner_id === request.owner_id);
			if (existingShop.length >= this.MAX_SHOPS_PER_PLAYER) {
				return {
					success: false,
					error: `You can only have ${this.MAX_SHOPS_PER_PLAYER} shop at a time`,
				};
			}

			const shopId = this.nextId++;
			const now = new Date().toISOString();
			shops.insert({
				id: shopId,
				owner_id: request.owner_id,
				owner_name: request.owner_name,
				shop_name: request.shop_name,
				description: request.description || '',
				zone_id: request.zone_id,
				x: request.x,
				y: request.y,
				is_open: true,
				created_at: now,
				updated_at: now,
			});

			console.log(`[PlayerShopService] Shop created: ${request.shop_name} (ID: ${shopId})`);
			return { success: true, shopId };
		} catch (error) {
			console.error('[PlayerShopService] Failed to create shop:', error);
			return { success: false, error: 'Failed to create shop' };
		}
	}

	async deleteShop(shopId: number, ownerId: string): Promise<{ success: boolean; error?: string }> {
		try {
			const shop = shops.findOne((s: any) => s.id === shopId);
			if (!shop) return { success: false, error: 'Shop not found' };
			if (shop.owner_id !== ownerId) return { success: false, error: 'Not authorized to delete this shop' };

			shopItems.delete((i: any) => i.shop_id === shopId);
			shopTransactions.delete((t: any) => t.shop_id === shopId);
			shops.delete((s: any) => s.id === shopId);

			console.log(`[PlayerShopService] Shop deleted: ${shopId}`);
			return { success: true };
		} catch (error) {
			console.error('[PlayerShopService] Failed to delete shop:', error);
			return { success: false, error: 'Failed to delete shop' };
		}
	}

	async updateShop(
		shopId: number,
		ownerId: string,
		updates: { shop_name?: string; description?: string; is_open?: boolean },
	): Promise<{ success: boolean; error?: string }> {
		if (updates.shop_name !== undefined) {
			if (
				updates.shop_name.length < this.SHOP_NAME_MIN_LENGTH ||
				updates.shop_name.length > this.SHOP_NAME_MAX_LENGTH
			) {
				return {
					success: false,
					error: `Shop name must be between ${this.SHOP_NAME_MIN_LENGTH} and ${this.SHOP_NAME_MAX_LENGTH} characters`,
				};
			}
		}

		if (updates.description !== undefined && updates.description.length > this.DESCRIPTION_MAX_LENGTH) {
			return {
				success: false,
				error: `Description cannot exceed ${this.DESCRIPTION_MAX_LENGTH} characters`,
			};
		}

		try {
			const shop = shops.findOne((s: any) => s.id === shopId);
			if (!shop) return { success: false, error: 'Shop not found' };
			if (shop.owner_id !== ownerId) return { success: false, error: 'Not authorized to update this shop' };

			if (Object.keys(updates).length === 0) return { success: false, error: 'No updates provided' };

			shops.update((s: any) => s.id === shopId, { ...updates, updated_at: new Date().toISOString() });

			console.log(`[PlayerShopService] Shop updated: ${shopId}`);
			return { success: true };
		} catch (error) {
			console.error('[PlayerShopService] Failed to update shop:', error);
			return { success: false, error: 'Failed to update shop' };
		}
	}

	async addItem(
		shopId: number,
		ownerId: string,
		request: AddItemRequest,
	): Promise<{ success: boolean; error?: string }> {
		if (request.quantity <= 0) return { success: false, error: 'Quantity must be greater than 0' };
		if (request.price_per_unit <= 0) return { success: false, error: 'Price must be greater than 0' };

		try {
			const shop = shops.findOne((s: any) => s.id === shopId);
			if (!shop) return { success: false, error: 'Shop not found' };
			if (shop.owner_id !== ownerId) return { success: false, error: 'Not authorized to modify this shop' };

			const items = shopItems.find((i: any) => i.shop_id === shopId);
			if (items.length >= this.MAX_ITEMS_PER_SHOP) {
				return { success: false, error: `Shop can only have ${this.MAX_ITEMS_PER_SHOP} different items` };
			}

			const existing = shopItems.findOne((i: any) => i.shop_id === shopId && i.item_id === request.item_id);
			if (existing) {
				shopItems.update((i: any) => i.id === existing.id, {
					quantity: existing.quantity + request.quantity,
					price_per_unit: request.price_per_unit,
					updated_at: new Date().toISOString(),
				});
			} else {
				shopItems.insert({
					id: crypto.randomUUID(),
					shop_id: shopId,
					item_id: request.item_id,
					quantity: request.quantity,
					price_per_unit: request.price_per_unit,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				});
			}

			shops.update((s: any) => s.id === shopId, { updated_at: new Date().toISOString() });
			console.log(`[PlayerShopService] Item added to shop ${shopId}: ${request.item_id} x${request.quantity}`);
			return { success: true };
		} catch (error) {
			console.error('[PlayerShopService] Failed to add item:', error);
			return { success: false, error: 'Failed to add item' };
		}
	}

	async removeItem(shopId: number, ownerId: string, itemId: string): Promise<{ success: boolean; error?: string }> {
		try {
			const shop = shops.findOne((s: any) => s.id === shopId);
			if (!shop) return { success: false, error: 'Shop not found' };
			if (shop.owner_id !== ownerId) return { success: false, error: 'Not authorized to modify this shop' };

			shopItems.delete((i: any) => i.shop_id === shopId && i.item_id === itemId);
			shops.update((s: any) => s.id === shopId, { updated_at: new Date().toISOString() });

			console.log(`[PlayerShopService] Item removed from shop ${shopId}: ${itemId}`);
			return { success: true };
		} catch (error) {
			console.error('[PlayerShopService] Failed to remove item:', error);
			return { success: false, error: 'Failed to remove item' };
		}
	}

	async updateItemPrice(
		shopId: number,
		ownerId: string,
		itemId: string,
		newPrice: number,
	): Promise<{ success: boolean; error?: string }> {
		if (newPrice <= 0) return { success: false, error: 'Price must be greater than 0' };

		try {
			const shop = shops.findOne((s: any) => s.id === shopId);
			if (!shop) return { success: false, error: 'Shop not found' };
			if (shop.owner_id !== ownerId) return { success: false, error: 'Not authorized to modify this shop' };

			const item = shopItems.findOne((i: any) => i.shop_id === shopId && i.item_id === itemId);
			if (!item) return { success: false, error: 'Item not found in shop' };

			shopItems.update((i: any) => i.id === item.id, { price_per_unit: newPrice, updated_at: new Date().toISOString() });
			shops.update((s: any) => s.id === shopId, { updated_at: new Date().toISOString() });

			console.log(`[PlayerShopService] Item price updated in shop ${shopId}: ${itemId} -> ${newPrice}`);
			return { success: true };
		} catch (error) {
			console.error('[PlayerShopService] Failed to update price:', error);
			return { success: false, error: 'Failed to update price' };
		}
	}

	async purchaseItem(shopId: number, request: PurchaseRequest): Promise<PurchaseResult> {
		if (request.quantity <= 0) return { success: false, error: 'Quantity must be greater than 0' };

		try {
			const shop = shops.findOne((s: any) => s.id === shopId);
			if (!shop) return { success: false, error: 'Shop not found' };
			if (!shop.is_open) return { success: false, error: 'Shop is closed' };
			if (shop.owner_id === request.buyer_id) return { success: false, error: 'Cannot buy from your own shop' };

			const item = shopItems.findOne((i: any) => i.shop_id === shopId && i.item_id === request.item_id);
			if (!item) return { success: false, error: 'Item not found in shop' };

			if (item.quantity < request.quantity) {
				return { success: false, error: `Not enough stock. Available: ${item.quantity}` };
			}

			const totalCost = item.price_per_unit * request.quantity;
			const newQuantity = item.quantity - request.quantity;

			if (newQuantity === 0) {
				shopItems.delete((i: any) => i.id === item.id);
			} else {
				shopItems.update((i: any) => i.id === item.id, { quantity: newQuantity, updated_at: new Date().toISOString() });
			}

			shopTransactions.insert({
				id: crypto.randomUUID(),
				shop_id: shopId,
				buyer_id: request.buyer_id,
				buyer_name: request.buyer_name,
				item_id: request.item_id,
				quantity: request.quantity,
				price_per_unit: item.price_per_unit,
				total_cost: totalCost,
				created_at: new Date().toISOString(),
			});

			shops.update((s: any) => s.id === shopId, { updated_at: new Date().toISOString() });

			console.log(
				`[PlayerShopService] Purchase: ${request.buyer_name} bought ${request.item_id} x${request.quantity} from shop ${shopId} for ${totalCost}`,
			);

			return { success: true, totalCost };
		} catch (error) {
			console.error('[PlayerShopService] Failed to purchase item:', error);
			return { success: false, error: 'Failed to purchase item' };
		}
	}

	async searchShops(search: SearchShopsRequest = {}): Promise<PlayerShop[]> {
		try {
			let result = shops.getAll();

			if (search.zone_id) result = result.filter((s: any) => s.zone_id === search.zone_id);
			if (search.owner_id) result = result.filter((s: any) => s.owner_id === search.owner_id);
			if (search.search_name) {
				const name = search.search_name.toLowerCase();
				result = result.filter((s: any) => s.shop_name.toLowerCase().includes(name));
			}
			if (search.is_open !== undefined) result = result.filter((s: any) => s.is_open === search.is_open);

			result.sort((a: any, b: any) => b.updated_at.localeCompare(a.updated_at));

			if (search.item_id) {
				const shopIdsWithItem = new Set(
					shopItems.find((i: any) => i.item_id === search.item_id).map((i: any) => i.shop_id),
				);
				result = result.filter((s: any) => shopIdsWithItem.has(s.id));
			}

			const offset = search.offset || 0;
			const limit = search.limit || result.length;
			return result.slice(offset, offset + limit);
		} catch (error) {
			console.error('[PlayerShopService] Failed to search shops:', error);
			return [];
		}
	}

	async getShop(shopId: number): Promise<PlayerShop | null> {
		try {
			const shop = shops.findOne((s: any) => s.id === shopId);
			if (!shop) return null;

			const items = shopItems
				.find((i: any) => i.shop_id === shopId)
				.map((i: any) => ({ item_id: i.item_id, quantity: i.quantity, price_per_unit: i.price_per_unit }));

			return { ...shop, items };
		} catch (error) {
			console.error('[PlayerShopService] Failed to get shop:', error);
			return null;
		}
	}

	async getTransactionHistory(shopId: number, ownerId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
		try {
			const shop = shops.findOne((s: any) => s.id === shopId);
			if (!shop || shop.owner_id !== ownerId) return [];

			const all = shopTransactions
				.find((t: any) => t.shop_id === shopId)
				.sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));

			return all.slice(offset, offset + limit);
		} catch (error) {
			console.error('[PlayerShopService] Failed to get history:', error);
			return [];
		}
	}

	async getStatistics(
		shopId: number,
		ownerId: string,
	): Promise<{ totalSales: number; totalRevenue: number; uniqueCustomers: number } | null> {
		try {
			const shop = shops.findOne((s: any) => s.id === shopId);
			if (!shop || shop.owner_id !== ownerId) return null;

			const transactions = shopTransactions.find((t: any) => t.shop_id === shopId);
			const uniqueBuyers = new Set(transactions.map((t: any) => t.buyer_id));

			return {
				totalSales: transactions.length,
				totalRevenue: transactions.reduce((sum: number, t: any) => sum + t.total_cost, 0),
				uniqueCustomers: uniqueBuyers.size,
			};
		} catch (error) {
			console.error('[PlayerShopService] Failed to get statistics:', error);
			return null;
		}
	}
}
