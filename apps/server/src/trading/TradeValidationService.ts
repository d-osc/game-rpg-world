/**
 * TradeValidationService
 * P2P trade validation using elit/database
 */

import { Collection } from '../database/config.ts';

const tradeLogs = new Collection<any>('trade_logs');
const currencyBalances = new Collection<any>('currency_balances');

export interface TradeItem {
	itemId: string;
	quantity: number;
}

export interface TradeOffer {
	playerId: string;
	items: TradeItem[];
	currency: number;
}

export interface Trade {
	tradeId: string;
	initiator: TradeOffer;
	partner: TradeOffer;
	status: string;
}

export interface TradeValidationResult {
	valid: boolean;
	error?: string;
}

export class TradeValidationService {
	private activeTrades: Map<string, Trade> = new Map();
	private readonly MAX_TRADE_ITEMS = 20;
	private readonly MAX_TRADE_CURRENCY = 1000000;
	private readonly MAX_TRADES_PER_HOUR = 50;

	async validateTrade(trade: Trade): Promise<TradeValidationResult> {
		const basicCheck = this.validateTradeBasics(trade);
		if (!basicCheck.valid) return basicCheck;

		const rateCheck = await this.checkRateLimits(trade.initiator.playerId, trade.partner.playerId);
		if (!rateCheck.valid) return rateCheck;

		const currencyCheck = this.verifyCurrency(trade);
		if (!currencyCheck.valid) return currencyCheck;

		if (this.activeTrades.has(trade.tradeId)) return { valid: false, error: 'Duplicate trade detected' };
		this.activeTrades.set(trade.tradeId, trade);
		return { valid: true };
	}

	private validateTradeBasics(trade: Trade): TradeValidationResult {
		if (!trade.initiator.playerId || !trade.partner.playerId) return { valid: false, error: 'Invalid player IDs' };
		if (trade.initiator.playerId === trade.partner.playerId) return { valid: false, error: 'Cannot trade with self' };
		if (trade.initiator.items.length > this.MAX_TRADE_ITEMS) return { valid: false, error: 'Too many items (initiator)' };
		if (trade.partner.items.length > this.MAX_TRADE_ITEMS) return { valid: false, error: 'Too many items (partner)' };
		if (trade.initiator.currency < 0 || trade.initiator.currency > this.MAX_TRADE_CURRENCY) return { valid: false, error: 'Invalid currency (initiator)' };
		if (trade.partner.currency < 0 || trade.partner.currency > this.MAX_TRADE_CURRENCY) return { valid: false, error: 'Invalid currency (partner)' };
		for (const item of [...trade.initiator.items, ...trade.partner.items]) {
			if (item.quantity <= 0) return { valid: false, error: 'Invalid item quantity' };
		}
		return { valid: true };
	}

	private async checkRateLimits(initiatorId: string, partnerId: string): Promise<TradeValidationResult> {
		const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
		const initiatorCount = tradeLogs.find((t: any) =>
			(t.initiatorId === initiatorId || t.partnerId === initiatorId) && t.timestamp > oneHourAgo
		).length;
		if (initiatorCount > this.MAX_TRADES_PER_HOUR) return { valid: false, error: 'Rate limit exceeded (initiator)' };

		const partnerCount = tradeLogs.find((t: any) =>
			(t.initiatorId === partnerId || t.partnerId === partnerId) && t.timestamp > oneHourAgo
		).length;
		if (partnerCount > this.MAX_TRADES_PER_HOUR) return { valid: false, error: 'Rate limit exceeded (partner)' };
		return { valid: true };
	}

	private verifyCurrency(trade: Trade): TradeValidationResult {
		if (trade.initiator.currency > 0) {
			const bal = currencyBalances.findOne((b: any) => b.playerId === trade.initiator.playerId);
			if (!bal || bal.balance < trade.initiator.currency) return { valid: false, error: 'Insufficient currency (initiator)' };
		}
		if (trade.partner.currency > 0) {
			const bal = currencyBalances.findOne((b: any) => b.playerId === trade.partner.playerId);
			if (!bal || bal.balance < trade.partner.currency) return { valid: false, error: 'Insufficient currency (partner)' };
		}
		return { valid: true };
	}

	async logTrade(trade: Trade): Promise<void> {
		tradeLogs.insert({
			id: crypto.randomUUID(), tradeId: trade.tradeId,
			initiatorId: trade.initiator.playerId, partnerId: trade.partner.playerId,
			initiatorItems: trade.initiator.items, partnerItems: trade.partner.items,
			initiatorCurrency: trade.initiator.currency, partnerCurrency: trade.partner.currency,
			status: trade.status, timestamp: new Date().toISOString(),
		});
		this.activeTrades.delete(trade.tradeId);
	}

	async cancelTrade(tradeId: string): Promise<void> {
		this.activeTrades.delete(tradeId);
	}

	async getTradeHistory(playerId: string, limit: number = 50): Promise<any[]> {
		const all = tradeLogs.find((t: any) => t.initiatorId === playerId || t.partnerId === playerId);
		all.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
		return all.slice(0, limit);
	}

	async detectSuspiciousActivity(playerId: string): Promise<{ suspicious: boolean; reasons: string[] }> {
		const reasons: string[] = [];
		const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
		const recent = tradeLogs.find((t: any) =>
			(t.initiatorId === playerId || t.partnerId === playerId) && t.timestamp > oneHourAgo
		);
		if (recent.length > this.MAX_TRADES_PER_HOUR * 0.8) reasons.push('High trade frequency');
		return { suspicious: reasons.length > 0, reasons };
	}

	clearExpiredTrades(): void {
		const now = Date.now();
		for (const [tradeId] of this.activeTrades) {
			this.activeTrades.delete(tradeId);
		}
	}
}
