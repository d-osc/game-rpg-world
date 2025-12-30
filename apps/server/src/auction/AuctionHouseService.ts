/**
 * AuctionHouseService
 * Server-side auction house with centralized order matching
 */

import type { Pool } from 'pg';

export interface AuctionOrder {
	id: number;
	seller_id: string;
	seller_name: string;
	item_id: string;
	quantity: number;
	price_per_unit: number;
	total_price: number;
	created_at: Date;
	expires_at: Date;
	status: 'active' | 'sold' | 'cancelled' | 'expired';
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
	private pool: Pool;
	private readonly ORDER_EXPIRATION_DAYS = 7;
	private readonly MAX_ACTIVE_ORDERS_PER_PLAYER = 50;
	private readonly AUCTION_FEE_PERCENT = 5; // 5% fee

	constructor(pool: Pool) {
		this.pool = pool;
	}

	/**
	 * Initialize auction house tables
	 */
	async initializeTables(): Promise<void> {
		const client = await this.pool.connect();

		try {
			await client.query('BEGIN');

			// Auction orders table
			await client.query(`
				CREATE TABLE IF NOT EXISTS auction_orders (
					id SERIAL PRIMARY KEY,
					seller_id VARCHAR(255) NOT NULL,
					seller_name VARCHAR(255) NOT NULL,
					item_id VARCHAR(255) NOT NULL,
					quantity INTEGER NOT NULL CHECK (quantity > 0),
					price_per_unit BIGINT NOT NULL CHECK (price_per_unit > 0),
					total_price BIGINT NOT NULL,
					created_at TIMESTAMP NOT NULL DEFAULT NOW(),
					expires_at TIMESTAMP NOT NULL,
					status VARCHAR(50) NOT NULL DEFAULT 'active',
					buyer_id VARCHAR(255),
					buyer_name VARCHAR(255),
					sold_at TIMESTAMP,

					FOREIGN KEY (seller_id) REFERENCES players(id) ON DELETE CASCADE
				)
			`);

			// Create indexes
			await client.query(`
				CREATE INDEX IF NOT EXISTS idx_auction_orders_item
				ON auction_orders(item_id)
			`);

			await client.query(`
				CREATE INDEX IF NOT EXISTS idx_auction_orders_seller
				ON auction_orders(seller_id)
			`);

			await client.query(`
				CREATE INDEX IF NOT EXISTS idx_auction_orders_status
				ON auction_orders(status)
			`);

			await client.query(`
				CREATE INDEX IF NOT EXISTS idx_auction_orders_price
				ON auction_orders(price_per_unit)
			`);

			await client.query(`
				CREATE INDEX IF NOT EXISTS idx_auction_orders_expires
				ON auction_orders(expires_at)
			`);

			// Auction transactions table (for history)
			await client.query(`
				CREATE TABLE IF NOT EXISTS auction_transactions (
					id SERIAL PRIMARY KEY,
					order_id INTEGER NOT NULL,
					seller_id VARCHAR(255) NOT NULL,
					buyer_id VARCHAR(255) NOT NULL,
					item_id VARCHAR(255) NOT NULL,
					quantity INTEGER NOT NULL,
					price_per_unit BIGINT NOT NULL,
					total_price BIGINT NOT NULL,
					auction_fee BIGINT NOT NULL,
					timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

					FOREIGN KEY (order_id) REFERENCES auction_orders(id) ON DELETE CASCADE
				)
			`);

			// Create index
			await client.query(`
				CREATE INDEX IF NOT EXISTS idx_auction_transactions_seller
				ON auction_transactions(seller_id)
			`);

			await client.query(`
				CREATE INDEX IF NOT EXISTS idx_auction_transactions_buyer
				ON auction_transactions(buyer_id)
			`);

			await client.query('COMMIT');
			console.log('[AuctionHouseService] Tables initialized successfully');
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[AuctionHouseService] Failed to initialize tables:', error);
			throw error;
		} finally {
			client.release();
		}
	}

	/**
	 * Create auction order (with item escrow)
	 */
	async createOrder(request: CreateOrderRequest): Promise<{ success: boolean; orderId?: number; error?: string }> {
		// Validate
		if (request.quantity <= 0) {
			return { success: false, error: 'Invalid quantity' };
		}

		if (request.price_per_unit <= 0) {
			return { success: false, error: 'Invalid price' };
		}

		const client = await this.pool.connect();

		try {
			await client.query('BEGIN');

			// Check active order count
			const countResult = await client.query<{ count: string }>(
				`SELECT COUNT(*) as count FROM auction_orders
				 WHERE seller_id = $1 AND status = 'active'`,
				[request.seller_id],
			);

			const activeCount = Number(countResult.rows[0]?.count ?? 0);
			if (activeCount >= this.MAX_ACTIVE_ORDERS_PER_PLAYER) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Too many active orders' };
			}

			// TODO: Verify player has items (integrate with InventoryService)
			// For now, assume validation is done client-side

			// Calculate expiration
			const expiresAt = new Date();
			expiresAt.setDate(expiresAt.getDate() + this.ORDER_EXPIRATION_DAYS);

			const totalPrice = request.price_per_unit * request.quantity;

			// Create order
			const result = await client.query<{ id: number }>(
				`INSERT INTO auction_orders
				 (seller_id, seller_name, item_id, quantity, price_per_unit, total_price, expires_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)
				 RETURNING id`,
				[
					request.seller_id,
					request.seller_name,
					request.item_id,
					request.quantity,
					request.price_per_unit,
					totalPrice,
					expiresAt,
				],
			);

			const orderId = result.rows[0].id;

			// TODO: Escrow items from seller's inventory
			// This would integrate with InventoryService to lock items

			await client.query('COMMIT');

			console.log(`[AuctionHouse] Order created: ${orderId} by ${request.seller_name}`);

			return { success: true, orderId };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[AuctionHouseService] Failed to create order:', error);
			return { success: false, error: 'Database error' };
		} finally {
			client.release();
		}
	}

	/**
	 * Buy order
	 */
	async buyOrder(orderId: number, buyerId: string, buyerName: string): Promise<BuyOrderResult> {
		const client = await this.pool.connect();

		try {
			await client.query('BEGIN');

			// Get order (with lock)
			const orderResult = await client.query<AuctionOrder>(
				`SELECT * FROM auction_orders
				 WHERE id = $1 AND status = 'active'
				 FOR UPDATE`,
				[orderId],
			);

			if (orderResult.rows.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Order not found or already sold' };
			}

			const order = orderResult.rows[0];

			// Check if buyer is seller
			if (order.seller_id === buyerId) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Cannot buy your own order' };
			}

			// Check if expired
			if (new Date(order.expires_at) < new Date()) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Order expired' };
			}

			// TODO: Check buyer's currency (integrate with CurrencyService)
			// For now, assume validation is done client-side

			const totalPrice = Number(order.total_price);
			const auctionFee = Math.floor(totalPrice * (this.AUCTION_FEE_PERCENT / 100));
			const sellerProceeds = totalPrice - auctionFee;

			// TODO: Transfer currency from buyer to seller
			// This would integrate with CurrencyService

			// TODO: Transfer items from escrow to buyer
			// This would integrate with InventoryService

			// Update order status
			await client.query(
				`UPDATE auction_orders
				 SET status = 'sold', buyer_id = $1, buyer_name = $2, sold_at = NOW()
				 WHERE id = $3`,
				[buyerId, buyerName, orderId],
			);

			// Log transaction
			await client.query(
				`INSERT INTO auction_transactions
				 (order_id, seller_id, buyer_id, item_id, quantity, price_per_unit, total_price, auction_fee)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[
					orderId,
					order.seller_id,
					buyerId,
					order.item_id,
					order.quantity,
					order.price_per_unit,
					totalPrice,
					auctionFee,
				],
			);

			await client.query('COMMIT');

			console.log(`[AuctionHouse] Order ${orderId} sold to ${buyerName}`);

			return { success: true, order };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[AuctionHouseService] Failed to buy order:', error);
			return { success: false, error: 'Database error' };
		} finally {
			client.release();
		}
	}

	/**
	 * Cancel order
	 */
	async cancelOrder(orderId: number, sellerId: string): Promise<{ success: boolean; error?: string }> {
		const client = await this.pool.connect();

		try {
			await client.query('BEGIN');

			// Get order
			const orderResult = await client.query<AuctionOrder>(
				`SELECT * FROM auction_orders
				 WHERE id = $1 AND status = 'active'
				 FOR UPDATE`,
				[orderId],
			);

			if (orderResult.rows.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Order not found' };
			}

			const order = orderResult.rows[0];

			// Verify seller
			if (order.seller_id !== sellerId) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Not your order' };
			}

			// Update status
			await client.query(`UPDATE auction_orders SET status = 'cancelled' WHERE id = $1`, [orderId]);

			// TODO: Return items from escrow to seller
			// This would integrate with InventoryService

			await client.query('COMMIT');

			console.log(`[AuctionHouse] Order ${orderId} cancelled by seller`);

			return { success: true };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[AuctionHouseService] Failed to cancel order:', error);
			return { success: false, error: 'Database error' };
		} finally {
			client.release();
		}
	}

	/**
	 * Search orders
	 */
	async searchOrders(search: SearchRequest): Promise<AuctionOrder[]> {
		let query = `SELECT * FROM auction_orders WHERE status = 'active' AND expires_at > NOW()`;
		const params: any[] = [];
		let paramIndex = 1;

		// Add filters
		if (search.item_id) {
			query += ` AND item_id = $${paramIndex}`;
			params.push(search.item_id);
			paramIndex++;
		}

		if (search.min_price !== undefined) {
			query += ` AND price_per_unit >= $${paramIndex}`;
			params.push(search.min_price);
			paramIndex++;
		}

		if (search.max_price !== undefined) {
			query += ` AND price_per_unit <= $${paramIndex}`;
			params.push(search.max_price);
			paramIndex++;
		}

		if (search.seller_id) {
			query += ` AND seller_id = $${paramIndex}`;
			params.push(search.seller_id);
			paramIndex++;
		}

		// Add sorting
		switch (search.sort_by) {
			case 'price_asc':
				query += ' ORDER BY price_per_unit ASC';
				break;
			case 'price_desc':
				query += ' ORDER BY price_per_unit DESC';
				break;
			case 'date_asc':
				query += ' ORDER BY created_at ASC';
				break;
			case 'date_desc':
			default:
				query += ' ORDER BY created_at DESC';
				break;
		}

		// Add limit and offset
		const limit = search.limit || 50;
		const offset = search.offset || 0;

		query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
		params.push(limit, offset);

		const result = await this.pool.query<AuctionOrder>(query, params);

		return result.rows;
	}

	/**
	 * Get player's orders
	 */
	async getMyOrders(
		playerId: string,
		includeInactive: boolean = false,
	): Promise<AuctionOrder[]> {
		let query = 'SELECT * FROM auction_orders WHERE seller_id = $1';

		if (!includeInactive) {
			query += " AND status = 'active'";
		}

		query += ' ORDER BY created_at DESC';

		const result = await this.pool.query<AuctionOrder>(query, [playerId]);

		return result.rows;
	}

	/**
	 * Get order by ID
	 */
	async getOrder(orderId: number): Promise<AuctionOrder | null> {
		const result = await this.pool.query<AuctionOrder>('SELECT * FROM auction_orders WHERE id = $1', [orderId]);

		return result.rows[0] || null;
	}

	/**
	 * Expire old orders
	 */
	async expireOldOrders(): Promise<number> {
		const client = await this.pool.connect();

		try {
			await client.query('BEGIN');

			// Get expired orders
			const expiredResult = await client.query<{ id: number; seller_id: string; item_id: string; quantity: number }>(
				`SELECT id, seller_id, item_id, quantity FROM auction_orders
				 WHERE status = 'active' AND expires_at < NOW()`,
			);

			const expiredOrders = expiredResult.rows;

			if (expiredOrders.length === 0) {
				await client.query('ROLLBACK');
				return 0;
			}

			// Update status
			await client.query(`UPDATE auction_orders SET status = 'expired' WHERE status = 'active' AND expires_at < NOW()`);

			// TODO: Return items from escrow to sellers
			// This would integrate with InventoryService

			await client.query('COMMIT');

			console.log(`[AuctionHouse] Expired ${expiredOrders.length} orders`);

			return expiredOrders.length;
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[AuctionHouseService] Failed to expire orders:', error);
			return 0;
		} finally {
			client.release();
		}
	}

	/**
	 * Get transaction history
	 */
	async getTransactionHistory(
		playerId: string,
		limit: number = 50,
		offset: number = 0,
	): Promise<any[]> {
		const result = await this.pool.query(
			`SELECT * FROM auction_transactions
			 WHERE seller_id = $1 OR buyer_id = $1
			 ORDER BY timestamp DESC
			 LIMIT $2 OFFSET $3`,
			[playerId, limit, offset],
		);

		return result.rows;
	}

	/**
	 * Get statistics
	 */
	async getStatistics(playerId: string): Promise<{
		totalSold: number;
		totalBought: number;
		totalRevenue: number;
		totalSpent: number;
		activeOrders: number;
	}> {
		const result = await this.pool.query<{
			total_sold: string;
			total_bought: string;
			total_revenue: string;
			total_spent: string;
			active_orders: string;
		}>(
			`SELECT
				COALESCE((SELECT COUNT(*) FROM auction_transactions WHERE seller_id = $1), 0) as total_sold,
				COALESCE((SELECT COUNT(*) FROM auction_transactions WHERE buyer_id = $1), 0) as total_bought,
				COALESCE((SELECT SUM(total_price - auction_fee) FROM auction_transactions WHERE seller_id = $1), 0) as total_revenue,
				COALESCE((SELECT SUM(total_price) FROM auction_transactions WHERE buyer_id = $1), 0) as total_spent,
				COALESCE((SELECT COUNT(*) FROM auction_orders WHERE seller_id = $1 AND status = 'active'), 0) as active_orders
			`,
			[playerId],
		);

		return {
			totalSold: Number(result.rows[0]?.total_sold ?? 0),
			totalBought: Number(result.rows[0]?.total_bought ?? 0),
			totalRevenue: Number(result.rows[0]?.total_revenue ?? 0),
			totalSpent: Number(result.rows[0]?.total_spent ?? 0),
			activeOrders: Number(result.rows[0]?.active_orders ?? 0),
		};
	}
}
