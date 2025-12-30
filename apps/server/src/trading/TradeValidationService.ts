/**
 * TradeValidationService
 * Server-side validation for P2P trades to prevent duplication and cheating
 */

import type { Pool } from 'pg';

export interface TradeItem {
	item_id: string;
	quantity: number;
}

export interface TradeOffer {
	player_id: string;
	items: TradeItem[];
	currency: number;
}

export interface Trade {
	trade_id: string;
	initiator: TradeOffer;
	partner: TradeOffer;
	status: string;
}

export interface TradeValidationResult {
	valid: boolean;
	error?: string;
}

export class TradeValidationService {
	private pool: Pool;
	private activeTrades: Map<string, Trade> = new Map();

	// Anti-cheat limits
	private readonly MAX_TRADE_ITEMS = 20; // Max items per side
	private readonly MAX_TRADE_CURRENCY = 1000000; // Max currency per trade
	private readonly MAX_TRADES_PER_HOUR = 50;

	constructor(pool: Pool) {
		this.pool = pool;
	}

	/**
	 * Initialize trade validation tables
	 */
	async initializeTables(): Promise<void> {
		const client = await this.pool.connect();

		try {
			await client.query('BEGIN');

			// Trade log table
			await client.query(`
				CREATE TABLE IF NOT EXISTS trade_logs (
					id SERIAL PRIMARY KEY,
					trade_id VARCHAR(255) NOT NULL,
					initiator_id VARCHAR(255) NOT NULL,
					partner_id VARCHAR(255) NOT NULL,
					initiator_items JSONB,
					partner_items JSONB,
					initiator_currency BIGINT,
					partner_currency BIGINT,
					status VARCHAR(50) NOT NULL,
					timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

					FOREIGN KEY (initiator_id) REFERENCES players(id) ON DELETE CASCADE,
					FOREIGN KEY (partner_id) REFERENCES players(id) ON DELETE CASCADE
				)
			`);

			// Create indexes
			await client.query(`
				CREATE INDEX IF NOT EXISTS idx_trade_logs_initiator
				ON trade_logs(initiator_id)
			`);

			await client.query(`
				CREATE INDEX IF NOT EXISTS idx_trade_logs_partner
				ON trade_logs(partner_id)
			`);

			await client.query(`
				CREATE INDEX IF NOT EXISTS idx_trade_logs_timestamp
				ON trade_logs(timestamp DESC)
			`);

			await client.query('COMMIT');
			console.log('[TradeValidationService] Tables initialized successfully');
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[TradeValidationService] Failed to initialize tables:', error);
			throw error;
		} finally {
			client.release();
		}
	}

	/**
	 * Validate trade before execution
	 */
	async validateTrade(trade: Trade): Promise<TradeValidationResult> {
		// Basic validation
		const basicCheck = this.validateTradeBasics(trade);
		if (!basicCheck.valid) {
			return basicCheck;
		}

		// Check rate limits
		const rateLimitCheck = await this.checkRateLimits(trade.initiator.player_id, trade.partner.player_id);
		if (!rateLimitCheck.valid) {
			return rateLimitCheck;
		}

		// Verify inventories
		const inventoryCheck = await this.verifyInventories(trade);
		if (!inventoryCheck.valid) {
			return inventoryCheck;
		}

		// Verify currency
		const currencyCheck = await this.verifyCurrency(trade);
		if (!currencyCheck.valid) {
			return currencyCheck;
		}

		// Check for duplicates
		if (this.activeTrades.has(trade.trade_id)) {
			return { valid: false, error: 'Duplicate trade detected' };
		}

		// Add to active trades
		this.activeTrades.set(trade.trade_id, trade);

		return { valid: true };
	}

	/**
	 * Validate basic trade properties
	 */
	private validateTradeBasics(trade: Trade): TradeValidationResult {
		// Check player IDs
		if (!trade.initiator.player_id || !trade.partner.player_id) {
			return { valid: false, error: 'Invalid player IDs' };
		}

		if (trade.initiator.player_id === trade.partner.player_id) {
			return { valid: false, error: 'Cannot trade with self' };
		}

		// Check item count
		if (trade.initiator.items.length > this.MAX_TRADE_ITEMS) {
			return { valid: false, error: 'Too many items (initiator)' };
		}

		if (trade.partner.items.length > this.MAX_TRADE_ITEMS) {
			return { valid: false, error: 'Too many items (partner)' };
		}

		// Check currency
		if (trade.initiator.currency < 0 || trade.initiator.currency > this.MAX_TRADE_CURRENCY) {
			return { valid: false, error: 'Invalid currency amount (initiator)' };
		}

		if (trade.partner.currency < 0 || trade.partner.currency > this.MAX_TRADE_CURRENCY) {
			return { valid: false, error: 'Invalid currency amount (partner)' };
		}

		// Check for negative quantities
		for (const item of [...trade.initiator.items, ...trade.partner.items]) {
			if (item.quantity <= 0) {
				return { valid: false, error: 'Invalid item quantity' };
			}
		}

		return { valid: true };
	}

	/**
	 * Check rate limits
	 */
	private async checkRateLimits(initiatorId: string, partnerId: string): Promise<TradeValidationResult> {
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

		// Check initiator
		const initiatorResult = await this.pool.query<{ count: string }>(
			`SELECT COUNT(*) as count
			 FROM trade_logs
			 WHERE (initiator_id = $1 OR partner_id = $1)
			 AND timestamp > $2`,
			[initiatorId, oneHourAgo],
		);

		const initiatorCount = Number(initiatorResult.rows[0]?.count ?? 0);
		if (initiatorCount > this.MAX_TRADES_PER_HOUR) {
			return { valid: false, error: 'Trade rate limit exceeded (initiator)' };
		}

		// Check partner
		const partnerResult = await this.pool.query<{ count: string }>(
			`SELECT COUNT(*) as count
			 FROM trade_logs
			 WHERE (initiator_id = $1 OR partner_id = $1)
			 AND timestamp > $2`,
			[partnerId, oneHourAgo],
		);

		const partnerCount = Number(partnerResult.rows[0]?.count ?? 0);
		if (partnerCount > this.MAX_TRADES_PER_HOUR) {
			return { valid: false, error: 'Trade rate limit exceeded (partner)' };
		}

		return { valid: true };
	}

	/**
	 * Verify player inventories (would need integration with InventoryService)
	 */
	private async verifyInventories(trade: Trade): Promise<TradeValidationResult> {
		// This would integrate with InventoryService to check:
		// 1. Players actually have the items they're offering
		// 2. Item quantities are correct
		// 3. Items aren't equipped or locked

		// For now, return valid (implement when integrating with InventoryService)
		return { valid: true };
	}

	/**
	 * Verify player currency (integration with CurrencyService)
	 */
	private async verifyCurrency(trade: Trade): Promise<TradeValidationResult> {
		// Check initiator currency
		if (trade.initiator.currency > 0) {
			const initiatorBalance = await this.pool.query<{ balance: string }>(
				'SELECT balance FROM currency_balances WHERE player_id = $1',
				[trade.initiator.player_id],
			);

			const balance = Number(initiatorBalance.rows[0]?.balance ?? 0);
			if (balance < trade.initiator.currency) {
				return { valid: false, error: 'Insufficient currency (initiator)' };
			}
		}

		// Check partner currency
		if (trade.partner.currency > 0) {
			const partnerBalance = await this.pool.query<{ balance: string }>(
				'SELECT balance FROM currency_balances WHERE player_id = $1',
				[trade.partner.player_id],
			);

			const balance = Number(partnerBalance.rows[0]?.balance ?? 0);
			if (balance < trade.partner.currency) {
				return { valid: false, error: 'Insufficient currency (partner)' };
			}
		}

		return { valid: true };
	}

	/**
	 * Log completed trade
	 */
	async logTrade(trade: Trade): Promise<void> {
		await this.pool.query(
			`INSERT INTO trade_logs
			 (trade_id, initiator_id, partner_id, initiator_items, partner_items,
			  initiator_currency, partner_currency, status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[
				trade.trade_id,
				trade.initiator.player_id,
				trade.partner.player_id,
				JSON.stringify(trade.initiator.items),
				JSON.stringify(trade.partner.items),
				trade.initiator.currency,
				trade.partner.currency,
				trade.status,
			],
		);

		// Remove from active trades
		this.activeTrades.delete(trade.trade_id);
	}

	/**
	 * Cancel trade
	 */
	async cancelTrade(tradeId: string): Promise<void> {
		this.activeTrades.delete(tradeId);
	}

	/**
	 * Get trade history for player
	 */
	async getTradeHistory(
		playerId: string,
		limit: number = 50,
		offset: number = 0,
	): Promise<any[]> {
		const result = await this.pool.query(
			`SELECT * FROM trade_logs
			 WHERE initiator_id = $1 OR partner_id = $1
			 ORDER BY timestamp DESC
			 LIMIT $2 OFFSET $3`,
			[playerId, limit, offset],
		);

		return result.rows;
	}

	/**
	 * Detect suspicious trading patterns
	 */
	async detectSuspiciousActivity(playerId: string): Promise<{ suspicious: boolean; reasons: string[] }> {
		const reasons: string[] = [];
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

		// Check trade frequency
		const frequencyResult = await this.pool.query<{ count: string }>(
			`SELECT COUNT(*) as count
			 FROM trade_logs
			 WHERE (initiator_id = $1 OR partner_id = $1)
			 AND timestamp > $2`,
			[playerId, oneHourAgo],
		);

		const tradeCount = Number(frequencyResult.rows[0]?.count ?? 0);
		if (tradeCount > this.MAX_TRADES_PER_HOUR * 0.8) {
			reasons.push('High trade frequency');
		}

		// Check for one-sided trades (potential item transfer)
		const oneSidedResult = await this.pool.query<{ count: string }>(
			`SELECT COUNT(*) as count
			 FROM trade_logs
			 WHERE (
				(initiator_id = $1 AND initiator_items::text = '[]' AND initiator_currency = 0)
				OR (partner_id = $1 AND partner_items::text = '[]' AND partner_currency = 0)
			 )
			 AND timestamp > $2`,
			[playerId, oneHourAgo],
		);

		const oneSidedCount = Number(oneSidedResult.rows[0]?.count ?? 0);
		if (oneSidedCount > 5) {
			reasons.push('Multiple one-sided trades');
		}

		// Check for trades with same player repeatedly
		const samePlayerResult = await this.pool.query<{ partner_count: string }>(
			`SELECT COUNT(DISTINCT
				CASE
					WHEN initiator_id = $1 THEN partner_id
					ELSE initiator_id
				END
			) as partner_count
			 FROM trade_logs
			 WHERE (initiator_id = $1 OR partner_id = $1)
			 AND timestamp > $2`,
			[playerId, oneHourAgo],
		);

		const uniquePartners = Number(samePlayerResult.rows[0]?.partner_count ?? 0);
		if (tradeCount > 10 && uniquePartners < 3) {
			reasons.push('Trading with same players repeatedly');
		}

		return { suspicious: reasons.length > 0, reasons };
	}

	/**
	 * Get trade statistics
	 */
	async getTradeStatistics(playerId: string): Promise<{
		totalTrades: number;
		itemsTraded: number;
		currencyTraded: number;
	}> {
		const result = await this.pool.query<{
			total_trades: string;
			items_traded: string;
			currency_traded: string;
		}>(
			`SELECT
				COUNT(*) as total_trades,
				COALESCE(SUM(
					CASE WHEN initiator_id = $1
					THEN jsonb_array_length(initiator_items)
					ELSE jsonb_array_length(partner_items)
					END
				), 0) as items_traded,
				COALESCE(SUM(
					CASE WHEN initiator_id = $1
					THEN initiator_currency
					ELSE partner_currency
					END
				), 0) as currency_traded
			 FROM trade_logs
			 WHERE initiator_id = $1 OR partner_id = $1`,
			[playerId],
		);

		return {
			totalTrades: Number(result.rows[0]?.total_trades ?? 0),
			itemsTraded: Number(result.rows[0]?.items_traded ?? 0),
			currencyTraded: Number(result.rows[0]?.currency_traded ?? 0),
		};
	}

	/**
	 * Clear expired active trades
	 */
	clearExpiredTrades(): void {
		const now = Date.now();
		const expiredTrades: string[] = [];

		for (const [tradeId, trade] of this.activeTrades.entries()) {
			// Trades older than 10 minutes are considered expired
			if (now - Date.now() > 600000) {
				expiredTrades.push(tradeId);
			}
		}

		for (const tradeId of expiredTrades) {
			this.activeTrades.delete(tradeId);
		}

		if (expiredTrades.length > 0) {
			console.log(`[TradeValidationService] Cleared ${expiredTrades.length} expired trades`);
		}
	}
}
