/**
 * CurrencyService
 * Server-side currency management with validation and anti-cheat
 */

import type { Pool } from 'pg';

export interface CurrencyTransaction {
	player_id: string;
	amount: number;
	transaction_type: 'earn' | 'spend' | 'trade_send' | 'trade_receive' | 'shop_buy' | 'shop_sell';
	source?: string;
	target_player_id?: string;
	item_id?: string;
	quantity?: number;
	timestamp: Date;
}

export interface CurrencyBalance {
	player_id: string;
	balance: number;
	last_updated: Date;
}

export interface ValidationResult {
	success: boolean;
	newBalance?: number;
	error?: string;
}

export class CurrencyService {
	private pool: Pool;

	// Anti-cheat thresholds
	private readonly MAX_EARN_PER_HOUR = 10000; // Max currency per hour from earning
	private readonly MAX_TRADE_AMOUNT = 1000000; // Max single trade amount
	private readonly SUSPICIOUS_TRANSACTION_COUNT = 50; // Transactions per hour

	constructor(pool: Pool) {
		this.pool = pool;
	}

	/**
	 * Initialize currency tables
	 */
	async initializeTables(): Promise<void> {
		const client = await this.pool.connect();

		try {
			await client.query('BEGIN');

			// Currency balances table
			await client.query(`
				CREATE TABLE IF NOT EXISTS currency_balances (
					player_id VARCHAR(255) PRIMARY KEY,
					balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
					last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
					created_at TIMESTAMP NOT NULL DEFAULT NOW()
				)
			`);

			// Currency transactions table
			await client.query(`
				CREATE TABLE IF NOT EXISTS currency_transactions (
					id SERIAL PRIMARY KEY,
					player_id VARCHAR(255) NOT NULL,
					amount BIGINT NOT NULL,
					transaction_type VARCHAR(50) NOT NULL,
					source VARCHAR(255),
					target_player_id VARCHAR(255),
					item_id VARCHAR(255),
					quantity INTEGER,
					timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

					FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
				)
			`);

			// Create indexes
			await client.query(`
				CREATE INDEX IF NOT EXISTS idx_currency_transactions_player
				ON currency_transactions(player_id)
			`);

			await client.query(`
				CREATE INDEX IF NOT EXISTS idx_currency_transactions_timestamp
				ON currency_transactions(timestamp DESC)
			`);

			await client.query(`
				CREATE INDEX IF NOT EXISTS idx_currency_transactions_type
				ON currency_transactions(transaction_type)
			`);

			await client.query('COMMIT');
			console.log('[CurrencyService] Tables initialized successfully');
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[CurrencyService] Failed to initialize tables:', error);
			throw error;
		} finally {
			client.release();
		}
	}

	/**
	 * Get player's currency balance
	 */
	async getBalance(playerId: string): Promise<number> {
		const result = await this.pool.query<CurrencyBalance>(
			'SELECT balance FROM currency_balances WHERE player_id = $1',
			[playerId],
		);

		if (result.rows.length === 0) {
			// Initialize balance if doesn't exist
			await this.initializePlayerBalance(playerId);
			return 0;
		}

		return Number(result.rows[0].balance);
	}

	/**
	 * Initialize player balance
	 */
	private async initializePlayerBalance(playerId: string, startingBalance: number = 0): Promise<void> {
		await this.pool.query(
			`INSERT INTO currency_balances (player_id, balance)
			 VALUES ($1, $2)
			 ON CONFLICT (player_id) DO NOTHING`,
			[playerId, startingBalance],
		);
	}

	/**
	 * Add currency (from gameplay)
	 */
	async addCurrency(
		playerId: string,
		amount: number,
		source: string,
		itemId?: string,
		quantity?: number,
	): Promise<ValidationResult> {
		if (amount <= 0) {
			return { success: false, error: 'Amount must be positive' };
		}

		// Anti-cheat: Check earning rate
		const earningCheck = await this.checkEarningRate(playerId, amount);
		if (!earningCheck.valid) {
			console.warn(
				`[CurrencyService] Suspicious earning rate for player ${playerId}: ${earningCheck.reason}`,
			);
			return { success: false, error: 'Rate limit exceeded' };
		}

		const client = await this.pool.connect();

		try {
			await client.query('BEGIN');

			// Update balance
			const result = await client.query<CurrencyBalance>(
				`UPDATE currency_balances
				 SET balance = balance + $1, last_updated = NOW()
				 WHERE player_id = $2
				 RETURNING balance`,
				[amount, playerId],
			);

			if (result.rows.length === 0) {
				// Initialize if doesn't exist
				await this.initializePlayerBalance(playerId, amount);
			}

			const newBalance = Number(result.rows[0]?.balance ?? amount);

			// Log transaction
			await client.query(
				`INSERT INTO currency_transactions
				 (player_id, amount, transaction_type, source, item_id, quantity)
				 VALUES ($1, $2, $3, $4, $5, $6)`,
				[playerId, amount, 'earn', source, itemId, quantity],
			);

			await client.query('COMMIT');

			return { success: true, newBalance };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[CurrencyService] Failed to add currency:', error);
			return { success: false, error: 'Database error' };
		} finally {
			client.release();
		}
	}

	/**
	 * Subtract currency (for purchases)
	 */
	async subtractCurrency(
		playerId: string,
		amount: number,
		source: string,
		itemId?: string,
		quantity?: number,
	): Promise<ValidationResult> {
		if (amount <= 0) {
			return { success: false, error: 'Amount must be positive' };
		}

		const client = await this.pool.connect();

		try {
			await client.query('BEGIN');

			// Check balance first
			const balanceResult = await client.query<CurrencyBalance>(
				'SELECT balance FROM currency_balances WHERE player_id = $1 FOR UPDATE',
				[playerId],
			);

			if (balanceResult.rows.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Player not found' };
			}

			const currentBalance = Number(balanceResult.rows[0].balance);

			if (currentBalance < amount) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Insufficient funds' };
			}

			// Update balance
			const result = await client.query<CurrencyBalance>(
				`UPDATE currency_balances
				 SET balance = balance - $1, last_updated = NOW()
				 WHERE player_id = $2
				 RETURNING balance`,
				[amount, playerId],
			);

			const newBalance = Number(result.rows[0].balance);

			// Log transaction
			await client.query(
				`INSERT INTO currency_transactions
				 (player_id, amount, transaction_type, source, item_id, quantity)
				 VALUES ($1, $2, $3, $4, $5, $6)`,
				[playerId, -amount, 'spend', source, itemId, quantity],
			);

			await client.query('COMMIT');

			return { success: true, newBalance };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[CurrencyService] Failed to subtract currency:', error);
			return { success: false, error: 'Database error' };
		} finally {
			client.release();
		}
	}

	/**
	 * Transfer currency between players (P2P trading)
	 */
	async transferCurrency(
		fromPlayerId: string,
		toPlayerId: string,
		amount: number,
	): Promise<ValidationResult> {
		if (amount <= 0) {
			return { success: false, error: 'Amount must be positive' };
		}

		if (amount > this.MAX_TRADE_AMOUNT) {
			return { success: false, error: 'Amount exceeds trade limit' };
		}

		if (fromPlayerId === toPlayerId) {
			return { success: false, error: 'Cannot trade with self' };
		}

		const client = await this.pool.connect();

		try {
			await client.query('BEGIN');

			// Lock both accounts
			const fromResult = await client.query<CurrencyBalance>(
				'SELECT balance FROM currency_balances WHERE player_id = $1 FOR UPDATE',
				[fromPlayerId],
			);

			const toResult = await client.query<CurrencyBalance>(
				'SELECT balance FROM currency_balances WHERE player_id = $1 FOR UPDATE',
				[toPlayerId],
			);

			if (fromResult.rows.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Sender not found' };
			}

			if (toResult.rows.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Receiver not found' };
			}

			const fromBalance = Number(fromResult.rows[0].balance);

			if (fromBalance < amount) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Insufficient funds' };
			}

			// Deduct from sender
			await client.query(
				`UPDATE currency_balances
				 SET balance = balance - $1, last_updated = NOW()
				 WHERE player_id = $2`,
				[amount, fromPlayerId],
			);

			// Add to receiver
			await client.query(
				`UPDATE currency_balances
				 SET balance = balance + $1, last_updated = NOW()
				 WHERE player_id = $2`,
				[amount, toPlayerId],
			);

			// Log sender transaction
			await client.query(
				`INSERT INTO currency_transactions
				 (player_id, amount, transaction_type, target_player_id)
				 VALUES ($1, $2, $3, $4)`,
				[fromPlayerId, -amount, 'trade_send', toPlayerId],
			);

			// Log receiver transaction
			await client.query(
				`INSERT INTO currency_transactions
				 (player_id, amount, transaction_type, target_player_id)
				 VALUES ($1, $2, $3, $4)`,
				[toPlayerId, amount, 'trade_receive', fromPlayerId],
			);

			await client.query('COMMIT');

			const newBalance = fromBalance - amount;
			return { success: true, newBalance };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[CurrencyService] Failed to transfer currency:', error);
			return { success: false, error: 'Database error' };
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
	): Promise<CurrencyTransaction[]> {
		const result = await this.pool.query<CurrencyTransaction>(
			`SELECT * FROM currency_transactions
			 WHERE player_id = $1
			 ORDER BY timestamp DESC
			 LIMIT $2 OFFSET $3`,
			[playerId, limit, offset],
		);

		return result.rows;
	}

	/**
	 * Check earning rate (anti-cheat)
	 */
	private async checkEarningRate(playerId: string, amount: number): Promise<{ valid: boolean; reason?: string }> {
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

		const result = await this.pool.query<{ total: string; count: string }>(
			`SELECT
				COALESCE(SUM(amount), 0) as total,
				COUNT(*) as count
			 FROM currency_transactions
			 WHERE player_id = $1
			 AND transaction_type = 'earn'
			 AND timestamp > $2`,
			[playerId, oneHourAgo],
		);

		const totalEarned = Number(result.rows[0]?.total ?? 0);
		const transactionCount = Number(result.rows[0]?.count ?? 0);

		// Check if earning too much
		if (totalEarned + amount > this.MAX_EARN_PER_HOUR) {
			return { valid: false, reason: 'Hourly earning limit exceeded' };
		}

		// Check transaction frequency
		if (transactionCount > this.SUSPICIOUS_TRANSACTION_COUNT) {
			return { valid: false, reason: 'Too many transactions' };
		}

		return { valid: true };
	}

	/**
	 * Detect suspicious activity
	 */
	async detectSuspiciousActivity(playerId: string): Promise<{ suspicious: boolean; reasons: string[] }> {
		const reasons: string[] = [];
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

		// Check earning rate
		const earningResult = await this.pool.query<{ total: string }>(
			`SELECT COALESCE(SUM(amount), 0) as total
			 FROM currency_transactions
			 WHERE player_id = $1
			 AND transaction_type = 'earn'
			 AND timestamp > $2`,
			[playerId, oneHourAgo],
		);

		const totalEarned = Number(earningResult.rows[0]?.total ?? 0);
		if (totalEarned > this.MAX_EARN_PER_HOUR) {
			reasons.push('Excessive earning rate');
		}

		// Check transaction count
		const countResult = await this.pool.query<{ count: string }>(
			`SELECT COUNT(*) as count
			 FROM currency_transactions
			 WHERE player_id = $1
			 AND timestamp > $2`,
			[playerId, oneHourAgo],
		);

		const transactionCount = Number(countResult.rows[0]?.count ?? 0);
		if (transactionCount > this.SUSPICIOUS_TRANSACTION_COUNT) {
			reasons.push('High transaction frequency');
		}

		// Check for large sudden balance increase
		const balanceResult = await this.pool.query<{ balance: string }>(
			'SELECT balance FROM currency_balances WHERE player_id = $1',
			[playerId],
		);

		const currentBalance = Number(balanceResult.rows[0]?.balance ?? 0);
		if (currentBalance > 1000000 && totalEarned > currentBalance * 0.5) {
			reasons.push('Sudden large balance increase');
		}

		return { suspicious: reasons.length > 0, reasons };
	}

	/**
	 * Get currency statistics
	 */
	async getStatistics(playerId: string): Promise<{
		totalEarned: number;
		totalSpent: number;
		totalTraded: number;
		transactionCount: number;
	}> {
		const result = await this.pool.query<{
			total_earned: string;
			total_spent: string;
			total_traded: string;
			transaction_count: string;
		}>(
			`SELECT
				COALESCE(SUM(CASE WHEN transaction_type = 'earn' THEN amount ELSE 0 END), 0) as total_earned,
				COALESCE(SUM(CASE WHEN transaction_type = 'spend' THEN ABS(amount) ELSE 0 END), 0) as total_spent,
				COALESCE(SUM(CASE WHEN transaction_type IN ('trade_send', 'trade_receive') THEN ABS(amount) ELSE 0 END), 0) as total_traded,
				COUNT(*) as transaction_count
			 FROM currency_transactions
			 WHERE player_id = $1`,
			[playerId],
		);

		return {
			totalEarned: Number(result.rows[0]?.total_earned ?? 0),
			totalSpent: Number(result.rows[0]?.total_spent ?? 0),
			totalTraded: Number(result.rows[0]?.total_traded ?? 0),
			transactionCount: Number(result.rows[0]?.transaction_count ?? 0),
		};
	}

	/**
	 * Reset player currency (admin only)
	 */
	async resetCurrency(playerId: string): Promise<void> {
		const client = await this.pool.connect();

		try {
			await client.query('BEGIN');

			await client.query('UPDATE currency_balances SET balance = 0, last_updated = NOW() WHERE player_id = $1', [
				playerId,
			]);

			await client.query('DELETE FROM currency_transactions WHERE player_id = $1', [playerId]);

			await client.query('COMMIT');
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	}
}
