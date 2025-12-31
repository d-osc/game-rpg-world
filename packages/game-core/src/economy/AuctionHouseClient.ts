/**
 * AuctionHouseClient
 * Client-side auction house interface
 */

import { EventEmitter } from '../utils/EventEmitter';

export interface AuctionOrder {
	id: number;
	seller_id: string;
	seller_name: string;
	item_id: string;
	quantity: number;
	price_per_unit: number;
	total_price: number;
	created_at: string;
	expires_at: string;
	status: string;
}

export interface CreateOrderRequest {
	item_id: string;
	quantity: number;
	price_per_unit: number;
}

export interface SearchRequest {
	item_id?: string;
	min_price?: number;
	max_price?: number;
	sort_by?: 'price_asc' | 'price_desc' | 'date_asc' | 'date_desc';
	limit?: number;
	offset?: number;
}

export interface AuctionHouseClientEvents {
	'order-created': (orderId: number) => void;
	'order-bought': (order: AuctionOrder) => void;
	'order-cancelled': (orderId: number) => void;
	'search-results': (orders: AuctionOrder[]) => void;
	'error': (message: string) => void;
}

export class AuctionHouseClient extends EventEmitter<AuctionHouseClientEvents> {
	private apiUrl: string;
	private playerId: string;
	private playerName: string;
	private authToken: string | null = null;

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
	 * Create auction order
	 */
	async createOrder(request: CreateOrderRequest): Promise<{ success: boolean; orderId?: number; error?: string }> {
		try {
			const response = await fetch(`${this.apiUrl}/auction/create`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				body: JSON.stringify({
					seller_id: this.playerId,
					seller_name: this.playerName,
					...request,
				}),
			});

			const data = await response.json();

			if (data.success && data.orderId) {
				this.emit('order-created', data.orderId);
			} else if (data.error) {
				this.emit('error', data.error);
			}

			return data;
		} catch (error) {
			const errorMsg = 'Failed to create order';
			this.emit('error', errorMsg);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Buy order
	 */
	async buyOrder(orderId: number): Promise<{ success: boolean; order?: AuctionOrder; error?: string }> {
		try {
			const response = await fetch(`${this.apiUrl}/auction/buy/${orderId}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				body: JSON.stringify({
					buyer_id: this.playerId,
					buyer_name: this.playerName,
				}),
			});

			const data = await response.json();

			if (data.success && data.order) {
				this.emit('order-bought', data.order);
			} else if (data.error) {
				this.emit('error', data.error);
			}

			return data;
		} catch (error) {
			const errorMsg = 'Failed to buy order';
			this.emit('error', errorMsg);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Cancel order
	 */
	async cancelOrder(orderId: number): Promise<{ success: boolean; error?: string }> {
		try {
			const response = await fetch(`${this.apiUrl}/auction/cancel/${orderId}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				body: JSON.stringify({
					seller_id: this.playerId,
				}),
			});

			const data = await response.json();

			if (data.success) {
				this.emit('order-cancelled', orderId);
			} else if (data.error) {
				this.emit('error', data.error);
			}

			return data;
		} catch (error) {
			const errorMsg = 'Failed to cancel order';
			this.emit('error', errorMsg);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Search orders
	 */
	async searchOrders(search: SearchRequest = {}): Promise<AuctionOrder[]> {
		try {
			const params = new URLSearchParams();

			if (search.item_id) params.append('item_id', search.item_id);
			if (search.min_price !== undefined) params.append('min_price', search.min_price.toString());
			if (search.max_price !== undefined) params.append('max_price', search.max_price.toString());
			if (search.sort_by) params.append('sort_by', search.sort_by);
			if (search.limit) params.append('limit', search.limit.toString());
			if (search.offset) params.append('offset', search.offset.toString());

			const response = await fetch(`${this.apiUrl}/auction/search?${params.toString()}`, {
				method: 'GET',
				headers: {
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
			});

			const data = await response.json();

			if (data.orders) {
				this.emit('search-results', data.orders);
				return data.orders;
			}

			return [];
		} catch (error) {
			this.emit('error', 'Failed to search orders');
			return [];
		}
	}

	/**
	 * Get my orders
	 */
	async getMyOrders(includeInactive: boolean = false): Promise<AuctionOrder[]> {
		try {
			const params = new URLSearchParams();
			if (includeInactive) params.append('include_inactive', 'true');

			const response = await fetch(`${this.apiUrl}/auction/my-orders?${params.toString()}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
			});

			const data = await response.json();

			return data.orders || [];
		} catch (error) {
			this.emit('error', 'Failed to get orders');
			return [];
		}
	}

	/**
	 * Get order details
	 */
	async getOrder(orderId: number): Promise<AuctionOrder | null> {
		try {
			const response = await fetch(`${this.apiUrl}/auction/order/${orderId}`, {
				method: 'GET',
				headers: {
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
			});

			const data = await response.json();

			return data.order || null;
		} catch (error) {
			this.emit('error', 'Failed to get order');
			return null;
		}
	}

	/**
	 * Get transaction history
	 */
	async getTransactionHistory(limit: number = 50, offset: number = 0): Promise<any[]> {
		try {
			const response = await fetch(
				`${this.apiUrl}/auction/history?limit=${limit}&offset=${offset}`,
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
	 * Get statistics
	 */
	async getStatistics(): Promise<{
		totalSold: number;
		totalBought: number;
		totalRevenue: number;
		totalSpent: number;
		activeOrders: number;
	} | null> {
		try {
			const response = await fetch(`${this.apiUrl}/auction/statistics`, {
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
	 * Get item price history (useful for pricing)
	 */
	async getItemPriceHistory(itemId: string, days: number = 7): Promise<{ avgPrice: number; minPrice: number; maxPrice: number }> {
		try {
			const response = await fetch(
				`${this.apiUrl}/auction/item-price/${itemId}?days=${days}`,
				{
					method: 'GET',
					headers: {
						...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
					},
				},
			);

			const data = await response.json();

			return data.priceHistory || { avgPrice: 0, minPrice: 0, maxPrice: 0 };
		} catch (error) {
			return { avgPrice: 0, minPrice: 0, maxPrice: 0 };
		}
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.removeAllListeners();
	}
}
