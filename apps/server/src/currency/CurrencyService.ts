/**
 * CurrencyService
 * Server-side currency management using elit/database
 */

import { Collection } from '../database/config.ts';

const currencyBalances = new Collection<any>('currency_balances');
const currencyTransactions = new Collection<any>('currency_transactions');

export interface CurrencyTransaction {
	player_id: string;
	amount: number;
	transaction_type: 'earn' | 'spend' | 'trade_send' | 'trade_receive' | 'shop_buy' | 'shop_sell';
	source?: string;
	target_player_id?: string;
	item_id?: string;
	quantity?: number;
	timestamp: string;
}

export interface CurrencyBalance {
	player_id: string;
	balance: number;
	last_updated: string;
}

export interface ValidationResult {
	success: boolean;
	newBalance?: number;
	error?: string;
}

export class CurrencyService {
	private readonly MAX_EARN_PER_HOUR = 10000;
	private readonly MAX_TRADE_AMOUNT = 1000000;
	private readonly SUSPICIOUS_TRANSACTION_COUNT = 50;

	async initializeTables(): Promise<void> {
		console.log('[CurrencyService] Database ready');
	}

	async getBalance(playerId: string): Promise<number> {
		const bal = currencyBalances.findOne((b: any) => b.player_id === playerId);
		if (!bal) {
			await this.initializePlayerBalance(playerId);
			return 0;
		}
		return bal.balance;
	}

	private async initializePlayerBalance(playerId: string, startingBalance: number = 0): Promise<void> {
		const existing = currencyBalances.findOne((b: any) => b.player_id === playerId);
		if (!existing) {
			const now = new Date().toISOString();
			currencyBalances.insert({
				player_id: playerId,
				balance: startingBalance,
				last_updated: now,
				created_at: now,
			});
		}
	}

	async addCurrency(
		playerId: string,
		amount: number,
		source: string,
		itemId?: string,
		quantity?: number,
	): Promise<ValidationResult> {
		if (amount <= 0) return { success: false, error: 'Amount must be positive' };

		const earningCheck = await this.checkEarningRate(playerId, amount);
		if (!earningCheck.valid) {
			console.warn(`[CurrencyService] Suspicious earning rate for player ${playerId}: ${earningCheck.reason}`);
			return { success: false, error: 'Rate limit exceeded' };
		}

		try {
			let bal = currencyBalances.findOne((b: any) => b.player_id === playerId);
			if (!bal) {
				await this.initializePlayerBalance(playerId, 0);
				bal = currencyBalances.findOne((b: any) => b.player_id === playerId);
			}

			const newBalance = (bal?.balance ?? 0) + amount;
			const now = new Date().toISOString();

			currencyBalances.update((b: any) => b.player_id === playerId, {
				balance: newBalance,
				last_updated: now,
			});

			currencyTransactions.insert({
				id: crypto.randomUUID(),
				player_id: playerId,
				amount,
				transaction_type: 'earn',
				source,
				item_id: itemId,
				quantity,
				timestamp: now,
			});

			return { success: true, newBalance };
		} catch (error) {
			console.error('[CurrencyService] Failed to add currency:', error);
			return { success: false, error: 'Database error' };
		}
	}

	async subtractCurrency(
		playerId: string,
		amount: number,
		source: string,
		itemId?: string,
		quantity?: number,
	): Promise<ValidationResult> {
		if (amount <= 0) return { success: false, error: 'Amount must be positive' };

		try {
			const bal = currencyBalances.findOne((b: any) => b.player_id === playerId);
			if (!bal) return { success: false, error: 'Player not found' };

			if (bal.balance < amount) return { success: false, error: 'Insufficient funds' };

			const newBalance = bal.balance - amount;
			const now = new Date().toISOString();

			currencyBalances.update((b: any) => b.player_id === playerId, {
				balance: newBalance,
				last_updated: now,
			});

			currencyTransactions.insert({
				id: crypto.randomUUID(),
				player_id: playerId,
				amount: -amount,
				transaction_type: 'spend',
				source,
				item_id: itemId,
				quantity,
				timestamp: now,
			});

			return { success: true, newBalance };
		} catch (error) {
			console.error('[CurrencyService] Failed to subtract currency:', error);
			return { success: false, error: 'Database error' };
		}
	}

	async transferCurrency(
		fromPlayerId: string,
		toPlayerId: string,
		amount: number,
	): Promise<ValidationResult> {
		if (amount <= 0) return { success: false, error: 'Amount must be positive' };
		if (amount > this.MAX_TRADE_AMOUNT) return { success: false, error: 'Amount exceeds trade limit' };
		if (fromPlayerId === toPlayerId) return { success: false, error: 'Cannot trade with self' };

		try {
			const fromBal = currencyBalances.findOne((b: any) => b.player_id === fromPlayerId);
			const toBal = currencyBalances.findOne((b: any) => b.player_id === toPlayerId);

			if (!fromBal) return { success: false, error: 'Sender not found' };
			if (!toBal) return { success: false, error: 'Receiver not found' };
			if (fromBal.balance < amount) return { success: false, error: 'Insufficient funds' };

			const now = new Date().toISOString();

			currencyBalances.update((b: any) => b.player_id === fromPlayerId, {
				balance: fromBal.balance - amount,
				last_updated: now,
			});

			currencyBalances.update((b: any) => b.player_id === toPlayerId, {
				balance: toBal.balance + amount,
				last_updated: now,
			});

			currencyTransactions.insert({
				id: crypto.randomUUID(),
				player_id: fromPlayerId,
				amount: -amount,
				transaction_type: 'trade_send',
				target_player_id: toPlayerId,
				timestamp: now,
			});

			currencyTransactions.insert({
				id: crypto.randomUUID(),
				player_id: toPlayerId,
				amount,
				transaction_type: 'trade_receive',
				target_player_id: fromPlayerId,
				timestamp: now,
			});

			return { success: true, newBalance: fromBal.balance - amount };
		} catch (error) {
			console.error('[CurrencyService] Failed to transfer currency:', error);
			return { success: false, error: 'Database error' };
		}
	}

	async getTransactionHistory(playerId: string, limit: number = 50, offset: number = 0): Promise<CurrencyTransaction[]> {
		const all = currencyTransactions
			.find((t: any) => t.player_id === playerId)
			.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
		return all.slice(offset, offset + limit);
	}

	private async checkEarningRate(playerId: string, amount: number): Promise<{ valid: boolean; reason?: string }> {
		const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
		const recent = currencyTransactions.find(
			(t: any) => t.player_id === playerId && t.transaction_type === 'earn' && t.timestamp > oneHourAgo,
		);

		const totalEarned = recent.reduce((sum: number, t: any) => sum + t.amount, 0);
		if (totalEarned + amount > this.MAX_EARN_PER_HOUR) {
			return { valid: false, reason: 'Hourly earning limit exceeded' };
		}

		if (recent.length > this.SUSPICIOUS_TRANSACTION_COUNT) {
			return { valid: false, reason: 'Too many transactions' };
		}

		return { valid: true };
	}

	async detectSuspiciousActivity(playerId: string): Promise<{ suspicious: boolean; reasons: string[] }> {
		const reasons: string[] = [];
		const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

		const recentEarns = currencyTransactions.find(
			(t: any) => t.player_id === playerId && t.transaction_type === 'earn' && t.timestamp > oneHourAgo,
		);
		const totalEarned = recentEarns.reduce((sum: number, t: any) => sum + t.amount, 0);
		if (totalEarned > this.MAX_EARN_PER_HOUR) reasons.push('Excessive earning rate');

		const recentAll = currencyTransactions.find((t: any) => t.player_id === playerId && t.timestamp > oneHourAgo);
		if (recentAll.length > this.SUSPICIOUS_TRANSACTION_COUNT) reasons.push('High transaction frequency');

		const bal = currencyBalances.findOne((b: any) => b.player_id === playerId);
		const currentBalance = bal?.balance ?? 0;
		if (currentBalance > 1000000 && totalEarned > currentBalance * 0.5) {
			reasons.push('Sudden large balance increase');
		}

		return { suspicious: reasons.length > 0, reasons };
	}

	async getStatistics(playerId: string): Promise<{
		totalEarned: number;
		totalSpent: number;
		totalTraded: number;
		transactionCount: number;
	}> {
		const all = currencyTransactions.find((t: any) => t.player_id === playerId);

		let totalEarned = 0;
		let totalSpent = 0;
		let totalTraded = 0;

		for (const t of all) {
			if (t.transaction_type === 'earn') totalEarned += t.amount;
			else if (t.transaction_type === 'spend') totalSpent += Math.abs(t.amount);
			else if (t.transaction_type === 'trade_send' || t.transaction_type === 'trade_receive') totalTraded += Math.abs(t.amount);
		}

		return {
			totalEarned,
			totalSpent,
			totalTraded,
			transactionCount: all.length,
		};
	}

	async resetCurrency(playerId: string): Promise<void> {
		currencyBalances.update((b: any) => b.player_id === playerId, {
			balance: 0,
			last_updated: new Date().toISOString(),
		});
		currencyTransactions.delete((t: any) => t.player_id === playerId);
	}
}
