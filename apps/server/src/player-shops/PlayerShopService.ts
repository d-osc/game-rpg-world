/**
 * PlayerShopService
 * Server-side player shop management with PostgreSQL
 */

import type { Pool } from 'pg';

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
	private db: Pool;
	private readonly MAX_SHOPS_PER_PLAYER = 1;
	private readonly MAX_ITEMS_PER_SHOP = 100;
	private readonly SHOP_NAME_MIN_LENGTH = 3;
	private readonly SHOP_NAME_MAX_LENGTH = 50;
	private readonly DESCRIPTION_MAX_LENGTH = 200;

	constructor(db: Pool) {
		this.db = db;
	}

	/**
	 * Initialize database tables
	 */
	async initialize(): Promise<void> {
		const client = await this.db.connect();
		try {
			// Player shops table
			await client.query(`
				CREATE TABLE IF NOT EXISTS player_shops (
					id SERIAL PRIMARY KEY,
					owner_id VARCHAR(255) NOT NULL,
					owner_name VARCHAR(255) NOT NULL,
					shop_name VARCHAR(50) NOT NULL,
					description TEXT,
					zone_id VARCHAR(255) NOT NULL,
					x REAL NOT NULL,
					y REAL NOT NULL,
					is_open BOOLEAN DEFAULT true,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					UNIQUE(owner_id)
				)
			`);

			// Shop items table
			await client.query(`
				CREATE TABLE IF NOT EXISTS player_shop_items (
					id SERIAL PRIMARY KEY,
					shop_id INTEGER NOT NULL REFERENCES player_shops(id) ON DELETE CASCADE,
					item_id VARCHAR(255) NOT NULL,
					quantity INTEGER NOT NULL CHECK (quantity >= 0),
					price_per_unit INTEGER NOT NULL CHECK (price_per_unit > 0),
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					UNIQUE(shop_id, item_id)
				)
			`);

			// Shop transactions table
			await client.query(`
				CREATE TABLE IF NOT EXISTS player_shop_transactions (
					id SERIAL PRIMARY KEY,
					shop_id INTEGER NOT NULL REFERENCES player_shops(id),
					buyer_id VARCHAR(255) NOT NULL,
					buyer_name VARCHAR(255) NOT NULL,
					item_id VARCHAR(255) NOT NULL,
					quantity INTEGER NOT NULL,
					price_per_unit INTEGER NOT NULL,
					total_cost INTEGER NOT NULL,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				)
			`);

			// Indexes
			await client.query('CREATE INDEX IF NOT EXISTS idx_shops_zone ON player_shops(zone_id)');
			await client.query('CREATE INDEX IF NOT EXISTS idx_shops_owner ON player_shops(owner_id)');
			await client.query('CREATE INDEX IF NOT EXISTS idx_shop_items_shop ON player_shop_items(shop_id)');
			await client.query('CREATE INDEX IF NOT EXISTS idx_shop_items_item ON player_shop_items(item_id)');
			await client.query(
				'CREATE INDEX IF NOT EXISTS idx_shop_transactions_shop ON player_shop_transactions(shop_id)',
			);
			await client.query(
				'CREATE INDEX IF NOT EXISTS idx_shop_transactions_buyer ON player_shop_transactions(buyer_id)',
			);

			console.log('[PlayerShopService] Database tables initialized');
		} finally {
			client.release();
		}
	}

	/**
	 * Create a new player shop
	 */
	async createShop(request: CreateShopRequest): Promise<{ success: boolean; shopId?: number; error?: string }> {
		// Validate shop name
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

		// Validate description
		if (request.description && request.description.length > this.DESCRIPTION_MAX_LENGTH) {
			return {
				success: false,
				error: `Description cannot exceed ${this.DESCRIPTION_MAX_LENGTH} characters`,
			};
		}

		const client = await this.db.connect();
		try {
			await client.query('BEGIN');

			// Check if player already has a shop
			const existingShop = await client.query('SELECT id FROM player_shops WHERE owner_id = $1', [
				request.owner_id,
			]);

			if (existingShop.rows.length >= this.MAX_SHOPS_PER_PLAYER) {
				await client.query('ROLLBACK');
				return {
					success: false,
					error: `You can only have ${this.MAX_SHOPS_PER_PLAYER} shop at a time`,
				};
			}

			// Create shop
			const result = await client.query(
				`INSERT INTO player_shops
				(owner_id, owner_name, shop_name, description, zone_id, x, y, is_open)
				VALUES ($1, $2, $3, $4, $5, $6, $7, true)
				RETURNING id`,
				[
					request.owner_id,
					request.owner_name,
					request.shop_name,
					request.description || '',
					request.zone_id,
					request.x,
					request.y,
				],
			);

			await client.query('COMMIT');

			console.log(`[PlayerShopService] Shop created: ${request.shop_name} (ID: ${result.rows[0].id})`);

			return {
				success: true,
				shopId: result.rows[0].id,
			};
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[PlayerShopService] Failed to create shop:', error);
			return {
				success: false,
				error: 'Failed to create shop',
			};
		} finally {
			client.release();
		}
	}

	/**
	 * Delete a player shop
	 */
	async deleteShop(shopId: number, ownerId: string): Promise<{ success: boolean; error?: string }> {
		const client = await this.db.connect();
		try {
			await client.query('BEGIN');

			// Verify ownership
			const shop = await client.query('SELECT owner_id FROM player_shops WHERE id = $1', [shopId]);

			if (shop.rows.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Shop not found' };
			}

			if (shop.rows[0].owner_id !== ownerId) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Not authorized to delete this shop' };
			}

			// Delete shop (cascade will delete items and transactions)
			await client.query('DELETE FROM player_shops WHERE id = $1', [shopId]);

			await client.query('COMMIT');

			console.log(`[PlayerShopService] Shop deleted: ${shopId}`);

			return { success: true };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[PlayerShopService] Failed to delete shop:', error);
			return { success: false, error: 'Failed to delete shop' };
		} finally {
			client.release();
		}
	}

	/**
	 * Update shop details
	 */
	async updateShop(
		shopId: number,
		ownerId: string,
		updates: { shop_name?: string; description?: string; is_open?: boolean },
	): Promise<{ success: boolean; error?: string }> {
		// Validate updates
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

		const client = await this.db.connect();
		try {
			await client.query('BEGIN');

			// Verify ownership
			const shop = await client.query('SELECT owner_id FROM player_shops WHERE id = $1', [shopId]);

			if (shop.rows.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Shop not found' };
			}

			if (shop.rows[0].owner_id !== ownerId) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Not authorized to update this shop' };
			}

			// Build update query
			const updateFields: string[] = [];
			const values: any[] = [];
			let paramIndex = 1;

			if (updates.shop_name !== undefined) {
				updateFields.push(`shop_name = $${paramIndex++}`);
				values.push(updates.shop_name);
			}

			if (updates.description !== undefined) {
				updateFields.push(`description = $${paramIndex++}`);
				values.push(updates.description);
			}

			if (updates.is_open !== undefined) {
				updateFields.push(`is_open = $${paramIndex++}`);
				values.push(updates.is_open);
			}

			if (updateFields.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'No updates provided' };
			}

			updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
			values.push(shopId);

			await client.query(
				`UPDATE player_shops SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
				values,
			);

			await client.query('COMMIT');

			console.log(`[PlayerShopService] Shop updated: ${shopId}`);

			return { success: true };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[PlayerShopService] Failed to update shop:', error);
			return { success: false, error: 'Failed to update shop' };
		} finally {
			client.release();
		}
	}

	/**
	 * Add item to shop
	 */
	async addItem(
		shopId: number,
		ownerId: string,
		request: AddItemRequest,
	): Promise<{ success: boolean; error?: string }> {
		// Validate item
		if (request.quantity <= 0) {
			return { success: false, error: 'Quantity must be greater than 0' };
		}

		if (request.price_per_unit <= 0) {
			return { success: false, error: 'Price must be greater than 0' };
		}

		const client = await this.db.connect();
		try {
			await client.query('BEGIN');

			// Verify ownership
			const shop = await client.query('SELECT owner_id FROM player_shops WHERE id = $1', [shopId]);

			if (shop.rows.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Shop not found' };
			}

			if (shop.rows[0].owner_id !== ownerId) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Not authorized to modify this shop' };
			}

			// Check item count
			const itemCount = await client.query('SELECT COUNT(*) FROM player_shop_items WHERE shop_id = $1', [
				shopId,
			]);

			if (parseInt(itemCount.rows[0].count) >= this.MAX_ITEMS_PER_SHOP) {
				await client.query('ROLLBACK');
				return {
					success: false,
					error: `Shop can only have ${this.MAX_ITEMS_PER_SHOP} different items`,
				};
			}

			// Insert or update item
			await client.query(
				`INSERT INTO player_shop_items (shop_id, item_id, quantity, price_per_unit)
				VALUES ($1, $2, $3, $4)
				ON CONFLICT (shop_id, item_id)
				DO UPDATE SET
					quantity = player_shop_items.quantity + $3,
					price_per_unit = $4,
					updated_at = CURRENT_TIMESTAMP`,
				[shopId, request.item_id, request.quantity, request.price_per_unit],
			);

			// Update shop timestamp
			await client.query('UPDATE player_shops SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [shopId]);

			await client.query('COMMIT');

			console.log(`[PlayerShopService] Item added to shop ${shopId}: ${request.item_id} x${request.quantity}`);

			return { success: true };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[PlayerShopService] Failed to add item:', error);
			return { success: false, error: 'Failed to add item' };
		} finally {
			client.release();
		}
	}

	/**
	 * Remove item from shop
	 */
	async removeItem(
		shopId: number,
		ownerId: string,
		itemId: string,
	): Promise<{ success: boolean; error?: string }> {
		const client = await this.db.connect();
		try {
			await client.query('BEGIN');

			// Verify ownership
			const shop = await client.query('SELECT owner_id FROM player_shops WHERE id = $1', [shopId]);

			if (shop.rows.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Shop not found' };
			}

			if (shop.rows[0].owner_id !== ownerId) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Not authorized to modify this shop' };
			}

			// Delete item
			await client.query('DELETE FROM player_shop_items WHERE shop_id = $1 AND item_id = $2', [
				shopId,
				itemId,
			]);

			// Update shop timestamp
			await client.query('UPDATE player_shops SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [shopId]);

			await client.query('COMMIT');

			console.log(`[PlayerShopService] Item removed from shop ${shopId}: ${itemId}`);

			return { success: true };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[PlayerShopService] Failed to remove item:', error);
			return { success: false, error: 'Failed to remove item' };
		} finally {
			client.release();
		}
	}

	/**
	 * Update item price
	 */
	async updateItemPrice(
		shopId: number,
		ownerId: string,
		itemId: string,
		newPrice: number,
	): Promise<{ success: boolean; error?: string }> {
		if (newPrice <= 0) {
			return { success: false, error: 'Price must be greater than 0' };
		}

		const client = await this.db.connect();
		try {
			await client.query('BEGIN');

			// Verify ownership
			const shop = await client.query('SELECT owner_id FROM player_shops WHERE id = $1', [shopId]);

			if (shop.rows.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Shop not found' };
			}

			if (shop.rows[0].owner_id !== ownerId) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Not authorized to modify this shop' };
			}

			// Update price
			const result = await client.query(
				`UPDATE player_shop_items
				SET price_per_unit = $1, updated_at = CURRENT_TIMESTAMP
				WHERE shop_id = $2 AND item_id = $3`,
				[newPrice, shopId, itemId],
			);

			if (result.rowCount === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Item not found in shop' };
			}

			// Update shop timestamp
			await client.query('UPDATE player_shops SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [shopId]);

			await client.query('COMMIT');

			console.log(`[PlayerShopService] Item price updated in shop ${shopId}: ${itemId} -> ${newPrice}`);

			return { success: true };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[PlayerShopService] Failed to update price:', error);
			return { success: false, error: 'Failed to update price' };
		} finally {
			client.release();
		}
	}

	/**
	 * Purchase item from shop
	 */
	async purchaseItem(shopId: number, request: PurchaseRequest): Promise<PurchaseResult> {
		if (request.quantity <= 0) {
			return { success: false, error: 'Quantity must be greater than 0' };
		}

		const client = await this.db.connect();
		try {
			await client.query('BEGIN');

			// Get shop and item
			const shop = await client.query('SELECT owner_id, is_open FROM player_shops WHERE id = $1', [shopId]);

			if (shop.rows.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Shop not found' };
			}

			if (!shop.rows[0].is_open) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Shop is closed' };
			}

			// Prevent buying from own shop
			if (shop.rows[0].owner_id === request.buyer_id) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Cannot buy from your own shop' };
			}

			// Get item
			const item = await client.query(
				'SELECT quantity, price_per_unit FROM player_shop_items WHERE shop_id = $1 AND item_id = $2',
				[shopId, request.item_id],
			);

			if (item.rows.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Item not found in shop' };
			}

			const availableQuantity = item.rows[0].quantity;
			const pricePerUnit = item.rows[0].price_per_unit;

			if (availableQuantity < request.quantity) {
				await client.query('ROLLBACK');
				return {
					success: false,
					error: `Not enough stock. Available: ${availableQuantity}`,
				};
			}

			const totalCost = pricePerUnit * request.quantity;

			// Deduct item quantity
			const newQuantity = availableQuantity - request.quantity;

			if (newQuantity === 0) {
				// Remove item if quantity reaches 0
				await client.query('DELETE FROM player_shop_items WHERE shop_id = $1 AND item_id = $2', [
					shopId,
					request.item_id,
				]);
			} else {
				// Update quantity
				await client.query(
					'UPDATE player_shop_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE shop_id = $2 AND item_id = $3',
					[newQuantity, shopId, request.item_id],
				);
			}

			// Log transaction
			await client.query(
				`INSERT INTO player_shop_transactions
				(shop_id, buyer_id, buyer_name, item_id, quantity, price_per_unit, total_cost)
				VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[shopId, request.buyer_id, request.buyer_name, request.item_id, request.quantity, pricePerUnit, totalCost],
			);

			// Update shop timestamp
			await client.query('UPDATE player_shops SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [shopId]);

			await client.query('COMMIT');

			console.log(
				`[PlayerShopService] Purchase: ${request.buyer_name} bought ${request.item_id} x${request.quantity} from shop ${shopId} for ${totalCost}`,
			);

			return {
				success: true,
				totalCost,
			};
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[PlayerShopService] Failed to purchase item:', error);
			return { success: false, error: 'Failed to purchase item' };
		} finally {
			client.release();
		}
	}

	/**
	 * Search shops
	 */
	async searchShops(search: SearchShopsRequest = {}): Promise<PlayerShop[]> {
		try {
			let query = 'SELECT * FROM player_shops WHERE 1=1';
			const params: any[] = [];
			let paramIndex = 1;

			if (search.zone_id) {
				query += ` AND zone_id = $${paramIndex++}`;
				params.push(search.zone_id);
			}

			if (search.owner_id) {
				query += ` AND owner_id = $${paramIndex++}`;
				params.push(search.owner_id);
			}

			if (search.search_name) {
				query += ` AND shop_name ILIKE $${paramIndex++}`;
				params.push(`%${search.search_name}%`);
			}

			if (search.is_open !== undefined) {
				query += ` AND is_open = $${paramIndex++}`;
				params.push(search.is_open);
			}

			query += ' ORDER BY updated_at DESC';

			if (search.limit) {
				query += ` LIMIT $${paramIndex++}`;
				params.push(search.limit);
			}

			if (search.offset) {
				query += ` OFFSET $${paramIndex++}`;
				params.push(search.offset);
			}

			const result = await this.db.query(query, params);

			// If searching for items, filter shops that have the item
			if (search.item_id) {
				const shopsWithItem = await this.db.query(
					'SELECT DISTINCT shop_id FROM player_shop_items WHERE item_id = $1',
					[search.item_id],
				);

				const shopIds = new Set(shopsWithItem.rows.map((row) => row.shop_id));
				return result.rows.filter((shop) => shopIds.has(shop.id));
			}

			return result.rows;
		} catch (error) {
			console.error('[PlayerShopService] Failed to search shops:', error);
			return [];
		}
	}

	/**
	 * Get shop details with items
	 */
	async getShop(shopId: number): Promise<PlayerShop | null> {
		try {
			// Get shop
			const shopResult = await this.db.query('SELECT * FROM player_shops WHERE id = $1', [shopId]);

			if (shopResult.rows.length === 0) {
				return null;
			}

			const shop = shopResult.rows[0];

			// Get items
			const itemsResult = await this.db.query(
				'SELECT item_id, quantity, price_per_unit FROM player_shop_items WHERE shop_id = $1',
				[shopId],
			);

			return {
				...shop,
				items: itemsResult.rows,
			};
		} catch (error) {
			console.error('[PlayerShopService] Failed to get shop:', error);
			return null;
		}
	}

	/**
	 * Get transaction history
	 */
	async getTransactionHistory(
		shopId: number,
		ownerId: string,
		limit: number = 50,
		offset: number = 0,
	): Promise<any[]> {
		try {
			// Verify ownership
			const shop = await this.db.query('SELECT owner_id FROM player_shops WHERE id = $1', [shopId]);

			if (shop.rows.length === 0 || shop.rows[0].owner_id !== ownerId) {
				return [];
			}

			const result = await this.db.query(
				`SELECT * FROM player_shop_transactions
				WHERE shop_id = $1
				ORDER BY created_at DESC
				LIMIT $2 OFFSET $3`,
				[shopId, limit, offset],
			);

			return result.rows;
		} catch (error) {
			console.error('[PlayerShopService] Failed to get history:', error);
			return [];
		}
	}

	/**
	 * Get shop statistics
	 */
	async getStatistics(
		shopId: number,
		ownerId: string,
	): Promise<{ totalSales: number; totalRevenue: number; uniqueCustomers: number } | null> {
		try {
			// Verify ownership
			const shop = await this.db.query('SELECT owner_id FROM player_shops WHERE id = $1', [shopId]);

			if (shop.rows.length === 0 || shop.rows[0].owner_id !== ownerId) {
				return null;
			}

			const result = await this.db.query(
				`SELECT
					COUNT(*) as total_sales,
					COALESCE(SUM(total_cost), 0) as total_revenue,
					COUNT(DISTINCT buyer_id) as unique_customers
				FROM player_shop_transactions
				WHERE shop_id = $1`,
				[shopId],
			);

			return {
				totalSales: parseInt(result.rows[0].total_sales),
				totalRevenue: parseInt(result.rows[0].total_revenue),
				uniqueCustomers: parseInt(result.rows[0].unique_customers),
			};
		} catch (error) {
			console.error('[PlayerShopService] Failed to get statistics:', error);
			return null;
		}
	}
}
