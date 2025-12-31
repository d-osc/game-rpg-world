/**
 * PlayerShopManager
 * Client-side player shop management
 */

import { EventEmitter } from '../utils/EventEmitter';

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

export interface PlayerShopManagerEvents {
	'shop-created': (shopId: number) => void;
	'shop-updated': () => void;
	'shop-deleted': () => void;
	'item-added': (itemId: string, quantity: number) => void;
	'item-removed': (itemId: string) => void;
	'item-purchased': (shopId: number, itemId: string, quantity: number, totalCost: number) => void;
	'shops-found': (shops: PlayerShop[]) => void;
	'error': (message: string) => void;
}

export class PlayerShopManager extends EventEmitter<PlayerShopManagerEvents> {
	private apiUrl: string;
	private playerId: string;
	private playerName: string;
	private authToken: string | null = null;
	private myShop: PlayerShop | null = null;
	private nearbyShops: Map<number, PlayerShop> = new Map();

	// Callbacks for integration
	private checkInventoryCallback?: (itemId: string, quantity: number) => boolean;
	private consumeItemsCallback?: (itemId: string, quantity: number) => boolean;
	private addItemCallback?: (itemId: string, quantity: number) => void;
	private checkCurrencyCallback?: (amount: number) => boolean;
	private consumeCurrencyCallback?: (amount: number) => boolean;
	private addCurrencyCallback?: (amount: number) => void;

	constructor(apiUrl: string, playerId: string, playerName: string) {
		super();
		this.apiUrl = apiUrl;
		this.playerId = playerId;
		this.playerName = playerName;
	}

	/**
	 * Set auth token
	 */
	setAuthToken(token: string): void {
		this.authToken = token;
	}

	/**
	 * Set inventory callbacks
	 */
	setInventoryCallbacks(
		checkInventory: (itemId: string, quantity: number) => boolean,
		consumeItems: (itemId: string, quantity: number) => boolean,
		addItem: (itemId: string, quantity: number) => void,
	): void {
		this.checkInventoryCallback = checkInventory;
		this.consumeItemsCallback = consumeItems;
		this.addItemCallback = addItem;
	}

	/**
	 * Set currency callbacks
	 */
	setCurrencyCallbacks(
		checkCurrency: (amount: number) => boolean,
		consumeCurrency: (amount: number) => boolean,
		addCurrency: (amount: number) => void,
	): void {
		this.checkCurrencyCallback = checkCurrency;
		this.consumeCurrencyCallback = consumeCurrency;
		this.addCurrencyCallback = addCurrency;
	}

	/**
	 * Create a new shop
	 */
	async createShop(request: CreateShopRequest): Promise<{ success: boolean; shopId?: number; error?: string }> {
		try {
			const response = await fetch(`${this.apiUrl}/player-shops/create`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				body: JSON.stringify({
					owner_id: this.playerId,
					owner_name: this.playerName,
					...request,
				}),
			});

			const data = await response.json();

			if (data.success && data.shopId) {
				this.emit('shop-created', data.shopId);
				// Fetch the created shop
				await this.fetchMyShop();
			} else if (data.error) {
				this.emit('error', data.error);
			}

			return data;
		} catch (error) {
			const errorMsg = 'Failed to create shop';
			this.emit('error', errorMsg);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Delete shop
	 */
	async deleteShop(shopId: number): Promise<{ success: boolean; error?: string }> {
		try {
			const response = await fetch(`${this.apiUrl}/player-shops/delete/${shopId}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				body: JSON.stringify({
					owner_id: this.playerId,
				}),
			});

			const data = await response.json();

			if (data.success) {
				this.myShop = null;
				this.emit('shop-deleted');
			} else if (data.error) {
				this.emit('error', data.error);
			}

			return data;
		} catch (error) {
			const errorMsg = 'Failed to delete shop';
			this.emit('error', errorMsg);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Update shop details
	 */
	async updateShop(
		shopId: number,
		updates: { shop_name?: string; description?: string; is_open?: boolean },
	): Promise<{ success: boolean; error?: string }> {
		try {
			const response = await fetch(`${this.apiUrl}/player-shops/update/${shopId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				body: JSON.stringify({
					owner_id: this.playerId,
					...updates,
				}),
			});

			const data = await response.json();

			if (data.success) {
				this.emit('shop-updated');
				// Refresh shop data
				await this.fetchMyShop();
			} else if (data.error) {
				this.emit('error', data.error);
			}

			return data;
		} catch (error) {
			const errorMsg = 'Failed to update shop';
			this.emit('error', errorMsg);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Add item to shop
	 */
	async addItem(shopId: number, request: AddItemRequest): Promise<{ success: boolean; error?: string }> {
		// Check if player has the items
		if (this.checkInventoryCallback && !this.checkInventoryCallback(request.item_id, request.quantity)) {
			const error = 'Not enough items in inventory';
			this.emit('error', error);
			return { success: false, error };
		}

		try {
			const response = await fetch(`${this.apiUrl}/player-shops/add-item/${shopId}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				body: JSON.stringify({
					owner_id: this.playerId,
					...request,
				}),
			});

			const data = await response.json();

			if (data.success) {
				// Consume items from inventory
				if (this.consumeItemsCallback) {
					this.consumeItemsCallback(request.item_id, request.quantity);
				}

				this.emit('item-added', request.item_id, request.quantity);
				// Refresh shop data
				await this.fetchMyShop();
			} else if (data.error) {
				this.emit('error', data.error);
			}

			return data;
		} catch (error) {
			const errorMsg = 'Failed to add item';
			this.emit('error', errorMsg);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Remove item from shop
	 */
	async removeItem(shopId: number, itemId: string): Promise<{ success: boolean; error?: string }> {
		try {
			const response = await fetch(`${this.apiUrl}/player-shops/remove-item/${shopId}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				body: JSON.stringify({
					owner_id: this.playerId,
					item_id: itemId,
				}),
			});

			const data = await response.json();

			if (data.success) {
				// Return items to inventory
				const shopItem = this.myShop?.items?.find((item) => item.item_id === itemId);
				if (shopItem && this.addItemCallback) {
					this.addItemCallback(itemId, shopItem.quantity);
				}

				this.emit('item-removed', itemId);
				// Refresh shop data
				await this.fetchMyShop();
			} else if (data.error) {
				this.emit('error', data.error);
			}

			return data;
		} catch (error) {
			const errorMsg = 'Failed to remove item';
			this.emit('error', errorMsg);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Update item price
	 */
	async updateItemPrice(
		shopId: number,
		itemId: string,
		newPrice: number,
	): Promise<{ success: boolean; error?: string }> {
		try {
			const response = await fetch(`${this.apiUrl}/player-shops/update-price/${shopId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				body: JSON.stringify({
					owner_id: this.playerId,
					item_id: itemId,
					new_price: newPrice,
				}),
			});

			const data = await response.json();

			if (data.success) {
				// Refresh shop data
				await this.fetchMyShop();
			} else if (data.error) {
				this.emit('error', data.error);
			}

			return data;
		} catch (error) {
			const errorMsg = 'Failed to update price';
			this.emit('error', errorMsg);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Purchase item from shop
	 */
	async purchaseItem(
		shopId: number,
		request: PurchaseRequest,
	): Promise<{ success: boolean; totalCost?: number; error?: string }> {
		try {
			const response = await fetch(`${this.apiUrl}/player-shops/purchase/${shopId}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				body: JSON.stringify({
					buyer_id: this.playerId,
					buyer_name: this.playerName,
					...request,
				}),
			});

			const data = await response.json();

			if (data.success && data.totalCost !== undefined) {
				// Check if player has enough currency
				if (this.checkCurrencyCallback && !this.checkCurrencyCallback(data.totalCost)) {
					const error = 'Not enough currency';
					this.emit('error', error);
					return { success: false, error };
				}

				// Consume currency
				if (this.consumeCurrencyCallback) {
					this.consumeCurrencyCallback(data.totalCost);
				}

				// Add item to inventory
				if (this.addItemCallback) {
					this.addItemCallback(request.item_id, request.quantity);
				}

				this.emit('item-purchased', shopId, request.item_id, request.quantity, data.totalCost);

				// Refresh nearby shops to update stock
				await this.searchShops({ zone_id: this.nearbyShops.get(shopId)?.zone_id });
			} else if (data.error) {
				this.emit('error', data.error);
			}

			return data;
		} catch (error) {
			const errorMsg = 'Failed to purchase item';
			this.emit('error', errorMsg);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Search shops
	 */
	async searchShops(search: SearchShopsRequest = {}): Promise<PlayerShop[]> {
		try {
			const params = new URLSearchParams();

			if (search.zone_id) params.append('zone_id', search.zone_id);
			if (search.owner_id) params.append('owner_id', search.owner_id);
			if (search.item_id) params.append('item_id', search.item_id);
			if (search.search_name) params.append('search_name', search.search_name);
			if (search.is_open !== undefined) params.append('is_open', search.is_open.toString());
			if (search.limit) params.append('limit', search.limit.toString());
			if (search.offset) params.append('offset', search.offset.toString());

			const response = await fetch(`${this.apiUrl}/player-shops/search?${params.toString()}`, {
				method: 'GET',
				headers: {
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
			});

			const data = await response.json();

			if (data.shops) {
				// Update nearby shops cache
				data.shops.forEach((shop: PlayerShop) => {
					this.nearbyShops.set(shop.id, shop);
				});

				this.emit('shops-found', data.shops);
				return data.shops;
			}

			return [];
		} catch (error) {
			this.emit('error', 'Failed to search shops');
			return [];
		}
	}

	/**
	 * Get shop details
	 */
	async getShop(shopId: number): Promise<PlayerShop | null> {
		try {
			const response = await fetch(`${this.apiUrl}/player-shops/shop/${shopId}`, {
				method: 'GET',
				headers: {
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
			});

			const data = await response.json();

			return data.shop || null;
		} catch (error) {
			this.emit('error', 'Failed to get shop');
			return null;
		}
	}

	/**
	 * Fetch my shop
	 */
	async fetchMyShop(): Promise<PlayerShop | null> {
		const shops = await this.searchShops({ owner_id: this.playerId });
		this.myShop = shops.length > 0 ? shops[0] : null;

		if (this.myShop) {
			// Fetch full details including items
			const fullShop = await this.getShop(this.myShop.id);
			if (fullShop) {
				this.myShop = fullShop;
			}
		}

		return this.myShop;
	}

	/**
	 * Get my shop
	 */
	getMyShop(): PlayerShop | null {
		return this.myShop;
	}

	/**
	 * Get transaction history
	 */
	async getTransactionHistory(shopId: number, limit: number = 50, offset: number = 0): Promise<any[]> {
		try {
			const response = await fetch(
				`${this.apiUrl}/player-shops/history/${shopId}?limit=${limit}&offset=${offset}`,
				{
					method: 'GET',
					headers: {
						...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
					},
				},
			);

			const data = await response.json();

			return data.transactions || [];
		} catch (error) {
			this.emit('error', 'Failed to get history');
			return [];
		}
	}

	/**
	 * Get shop statistics
	 */
	async getStatistics(shopId: number): Promise<{
		totalSales: number;
		totalRevenue: number;
		uniqueCustomers: number;
	} | null> {
		try {
			const response = await fetch(`${this.apiUrl}/player-shops/statistics/${shopId}`, {
				method: 'GET',
				headers: {
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
			});

			const data = await response.json();

			return data.statistics || null;
		} catch (error) {
			this.emit('error', 'Failed to get statistics');
			return null;
		}
	}

	/**
	 * Get nearby shops in zone
	 */
	getNearbyShops(): PlayerShop[] {
		return Array.from(this.nearbyShops.values());
	}

	/**
	 * Clear nearby shops cache
	 */
	clearNearbyShops(): void {
		this.nearbyShops.clear();
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.removeAllListeners();
		this.nearbyShops.clear();
		this.myShop = null;
	}
}
