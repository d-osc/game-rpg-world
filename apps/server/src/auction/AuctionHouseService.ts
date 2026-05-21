/**
 * AuctionHouseService
 * Server-side auction house with centralized order matching using elit/database
 */

import { Collection } from '../database/config.ts';

const auctionOrders = new Collection<any>('auction_orders');
const auctionTransactions = new Collection<any>('auction_transactions');

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
	status: 'active' | 'sold' | 'cancelled' | 'expired';
	buyer_id?: string;
	buyer_name?: string;
	sold_at?: string;
}

export interface CreateOrderRequest {
	seller_id: string;
	seller_name: string;
	item_id: string;
	quantity: number;
	price_per_unit: number;
}

export interface SearchRequest {
	item_id?: string;
	min_price?: number;
	max_price?: number;
	seller_id?: string;
	sort_by?: 'price_asc' | 'price_desc' | 'date_asc' | 'date_desc';
	limit?: number;
	offset?: number;
}

export interface BuyOrderResult {
	success: boolean;
	order?: AuctionOrder;
	error?: string;
}

export class AuctionHouseService {
	private readonly ORDER_EXPIRATION_DAYS = 7;
	private readonly MAX_ACTIVE_ORDERS_PER_PLAYER = 50;
	private readonly AUCTION_FEE_PERCENT = 5;
	private nextOrderId = 1;

	async initializeTables(): Promise<void> {
		const all = auctionOrders.getAll();
		if (all.length > 0) {
			this.nextOrderId = Math.max(...all.map((o: any) => o.id)) + 1;
		}
		console.log('[AuctionHouseService] Database ready');
	}

	async createOrder(request: CreateOrderRequest): Promise<{ success: boolean; orderId?: number; error?: string }> {
		if (request.quantity <= 0) return { success: false, error: 'Invalid quantity' };
		if (request.price_per_unit <= 0) return { success: false, error: 'Invalid price' };

		try {
			const activeOrders = auctionOrders.find((o: any) => o.seller_id === request.seller_id && o.status === 'active');
			if (activeOrders.length >= this.MAX_ACTIVE_ORDERS_PER_PLAYER) {
				return { success: false, error: 'Too many active orders' };
			}

			const now = new Date();
			const expiresAt = new Date(now);
			expiresAt.setDate(expiresAt.getDate() + this.ORDER_EXPIRATION_DAYS);
			const totalPrice = request.price_per_unit * request.quantity;

			const orderId = this.nextOrderId++;
			auctionOrders.insert({
				id: orderId,
				seller_id: request.seller_id,
				seller_name: request.seller_name,
				item_id: request.item_id,
				quantity: request.quantity,
				price_per_unit: request.price_per_unit,
				total_price: totalPrice,
				created_at: now.toISOString(),
				expires_at: expiresAt.toISOString(),
				status: 'active',
			});

			console.log(`[AuctionHouse] Order created: ${orderId} by ${request.seller_name}`);
			return { success: true, orderId };
		} catch (error) {
			console.error('[AuctionHouseService] Failed to create order:', error);
			return { success: false, error: 'Database error' };
		}
	}

	async buyOrder(orderId: number, buyerId: string, buyerName: string): Promise<BuyOrderResult> {
		try {
			const order = auctionOrders.findOne((o: any) => o.id === orderId && o.status === 'active');
			if (!order) return { success: false, error: 'Order not found or already sold' };

			if (order.seller_id === buyerId) return { success: false, error: 'Cannot buy your own order' };
			if (new Date(order.expires_at) < new Date()) return { success: false, error: 'Order expired' };

			const totalPrice = order.total_price;
			const auctionFee = Math.floor(totalPrice * (this.AUCTION_FEE_PERCENT / 100));

			const now = new Date().toISOString();
			auctionOrders.update((o: any) => o.id === orderId, {
				status: 'sold',
				buyer_id: buyerId,
				buyer_name: buyerName,
				sold_at: now,
			});

			auctionTransactions.insert({
				id: crypto.randomUUID(),
				order_id: orderId,
				seller_id: order.seller_id,
				buyer_id: buyerId,
				item_id: order.item_id,
				quantity: order.quantity,
				price_per_unit: order.price_per_unit,
				total_price: totalPrice,
				auction_fee: auctionFee,
				timestamp: now,
			});

			console.log(`[AuctionHouse] Order ${orderId} sold to ${buyerName}`);
			return { success: true, order };
		} catch (error) {
			console.error('[AuctionHouseService] Failed to buy order:', error);
			return { success: false, error: 'Database error' };
		}
	}

	async cancelOrder(orderId: number, sellerId: string): Promise<{ success: boolean; error?: string }> {
		try {
			const order = auctionOrders.findOne((o: any) => o.id === orderId && o.status === 'active');
			if (!order) return { success: false, error: 'Order not found' };
			if (order.seller_id !== sellerId) return { success: false, error: 'Not your order' };

			auctionOrders.update((o: any) => o.id === orderId, { status: 'cancelled' });
			console.log(`[AuctionHouse] Order ${orderId} cancelled by seller`);
			return { success: true };
		} catch (error) {
			console.error('[AuctionHouseService] Failed to cancel order:', error);
			return { success: false, error: 'Database error' };
		}
	}

	async searchOrders(search: SearchRequest): Promise<AuctionOrder[]> {
		try {
			const now = new Date().toISOString();
			let result = auctionOrders.find((o: any) => o.status === 'active' && o.expires_at > now);

			if (search.item_id) result = result.filter((o: any) => o.item_id === search.item_id);
			if (search.min_price != null) result = result.filter((o: any) => o.price_per_unit >= search.min_price!);
			if (search.max_price != null) result = result.filter((o: any) => o.price_per_unit <= search.max_price!);
			if (search.seller_id) result = result.filter((o: any) => o.seller_id === search.seller_id);

			switch (search.sort_by) {
				case 'price_asc': result.sort((a: any, b: any) => a.price_per_unit - b.price_per_unit); break;
				case 'price_desc': result.sort((a: any, b: any) => b.price_per_unit - a.price_per_unit); break;
				case 'date_asc': result.sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)); break;
				case 'date_desc':
				default: result.sort((a: any, b: any) => b.created_at.localeCompare(a.created_at)); break;
			}

			const offset = search.offset || 0;
			const limit = search.limit || 50;
			return result.slice(offset, offset + limit);
		} catch (error) {
			console.error('[AuctionHouseService] Failed to search orders:', error);
			return [];
		}
	}

	async getMyOrders(playerId: string, includeInactive: boolean = false): Promise<AuctionOrder[]> {
		try {
			let result = auctionOrders.find((o: any) => o.seller_id === playerId);
			if (!includeInactive) result = result.filter((o: any) => o.status === 'active');
			result.sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
			return result;
		} catch (error) {
			console.error('[AuctionHouseService] Failed to get orders:', error);
			return [];
		}
	}

	async getOrder(orderId: number): Promise<AuctionOrder | null> {
		try {
			return auctionOrders.findOne((o: any) => o.id === orderId) || null;
		} catch (error) {
			console.error('[AuctionHouseService] Failed to get order:', error);
			return null;
		}
	}

	async expireOldOrders(): Promise<number> {
		try {
			const now = new Date().toISOString();
			const expired = auctionOrders.find((o: any) => o.status === 'active' && o.expires_at < now);
			if (expired.length === 0) return 0;

			for (const order of expired) {
				auctionOrders.update((o: any) => o.id === order.id, { status: 'expired' });
			}

			console.log(`[AuctionHouse] Expired ${expired.length} orders`);
			return expired.length;
		} catch (error) {
			console.error('[AuctionHouseService] Failed to expire orders:', error);
			return 0;
		}
	}

	async getTransactionHistory(playerId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
		try {
			const all = auctionTransactions
				.find((t: any) => t.seller_id === playerId || t.buyer_id === playerId)
				.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
			return all.slice(offset, offset + limit);
		} catch (error) {
			console.error('[AuctionHouseService] Failed to get transaction history:', error);
			return [];
		}
	}

	async getStatistics(playerId: string): Promise<{
		totalSold: number;
		totalBought: number;
		totalRevenue: number;
		totalSpent: number;
		activeOrders: number;
	}> {
		try {
			const sold = auctionTransactions.find((t: any) => t.seller_id === playerId);
			const bought = auctionTransactions.find((t: any) => t.buyer_id === playerId);
			const active = auctionOrders.find((o: any) => o.seller_id === playerId && o.status === 'active');

			return {
				totalSold: sold.length,
				totalBought: bought.length,
				totalRevenue: sold.reduce((sum: number, t: any) => sum + (t.total_price - t.auction_fee), 0),
				totalSpent: bought.reduce((sum: number, t: any) => sum + t.total_price, 0),
				activeOrders: active.length,
			};
		} catch (error) {
			console.error('[AuctionHouseService] Failed to get statistics:', error);
			return { totalSold: 0, totalBought: 0, totalRevenue: 0, totalSpent: 0, activeOrders: 0 };
		}
	}
}
