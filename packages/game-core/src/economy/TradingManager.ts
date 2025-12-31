/**
 * TradingManager
 * Manages P2P trading between players
 */

import { EventEmitter } from '../utils/EventEmitter';

export interface TradeItem {
	item_id: string;
	quantity: number;
	slot?: number;
}

export interface TradeOffer {
	player_id: string;
	player_name: string;
	items: TradeItem[];
	currency: number;
	confirmed: boolean;
}

export interface Trade {
	trade_id: string;
	initiator: TradeOffer;
	partner: TradeOffer;
	status: 'pending' | 'active' | 'completed' | 'cancelled';
	created_at: number;
	expires_at: number;
}

export interface TradingManagerEvents {
	'trade-request-received': (fromPlayerId: string, fromPlayerName: string, tradeId: string) => void;
	'trade-request-accepted': (tradeId: string) => void;
	'trade-request-declined': (tradeId: string) => void;
	'trade-started': (trade: Trade) => void;
	'trade-updated': (trade: Trade) => void;
	'trade-confirmed': (playerId: string) => void;
	'trade-completed': (trade: Trade) => void;
	'trade-cancelled': (tradeId: string, reason: string) => void;
	'trade-expired': (tradeId: string) => void;
}

export class TradingManager extends EventEmitter<TradingManagerEvents> {
	private currentTrade: Trade | null = null;
	private pendingRequests: Map<string, Trade> = new Map();
	private tradeIdCounter: number = 0;
	private expirationTimer: number | null = null;

	private readonly TRADE_TIMEOUT = 300000; // 5 minutes
	private readonly REQUEST_TIMEOUT = 60000; // 1 minute

	// Callbacks
	private sendTradeMessageCallback: ((targetPlayerId: string, message: any) => void) | null = null;
	private checkInventoryCallback: ((items: TradeItem[]) => boolean) | null = null;
	private checkCurrencyCallback: ((amount: number) => boolean) | null = null;
	private removeItemsCallback: ((items: TradeItem[]) => boolean) | null = null;
	private addItemsCallback: ((items: TradeItem[]) => boolean) | null = null;
	private removeCurrencyCallback: ((amount: number) => boolean) | null = null;
	private addCurrencyCallback: ((amount: number) => boolean) | null = null;
	private validateTradeCallback: ((trade: Trade) => Promise<boolean>) | null = null;

	constructor() {
		super();
	}

	/**
	 * Set network callback
	 */
	setNetworkCallback(sendMessage: (targetPlayerId: string, message: any) => void): void {
		this.sendTradeMessageCallback = sendMessage;
	}

	/**
	 * Set inventory callbacks
	 */
	setInventoryCallbacks(
		checkInventory: (items: TradeItem[]) => boolean,
		removeItems: (items: TradeItem[]) => boolean,
		addItems: (items: TradeItem[]) => boolean,
	): void {
		this.checkInventoryCallback = checkInventory;
		this.removeItemsCallback = removeItems;
		this.addItemsCallback = addItems;
	}

	/**
	 * Set currency callbacks
	 */
	setCurrencyCallbacks(
		checkCurrency: (amount: number) => boolean,
		removeCurrency: (amount: number) => boolean,
		addCurrency: (amount: number) => boolean,
	): void {
		this.checkCurrencyCallback = checkCurrency;
		this.removeCurrencyCallback = removeCurrency;
		this.addCurrencyCallback = addCurrency;
	}

	/**
	 * Set validation callback (server-side)
	 */
	setValidationCallback(validate: (trade: Trade) => Promise<boolean>): void {
		this.validateTradeCallback = validate;
	}

	/**
	 * Request trade with another player
	 */
	requestTrade(
		targetPlayerId: string,
		targetPlayerName: string,
		myPlayerId: string,
		myPlayerName: string,
	): { success: boolean; error?: string; tradeId?: string } {
		// Check if already trading
		if (this.currentTrade) {
			return { success: false, error: 'Already in a trade' };
		}

		// Create trade request
		const tradeId = `trade_${this.tradeIdCounter++}`;
		const trade: Trade = {
			trade_id: tradeId,
			initiator: {
				player_id: myPlayerId,
				player_name: myPlayerName,
				items: [],
				currency: 0,
				confirmed: false,
			},
			partner: {
				player_id: targetPlayerId,
				player_name: targetPlayerName,
				items: [],
				currency: 0,
				confirmed: false,
			},
			status: 'pending',
			created_at: Date.now(),
			expires_at: Date.now() + this.REQUEST_TIMEOUT,
		};

		this.pendingRequests.set(tradeId, trade);

		// Send request to partner
		if (this.sendTradeMessageCallback) {
			this.sendTradeMessageCallback(targetPlayerId, {
				type: 'trade-request',
				trade_id: tradeId,
				from_player_id: myPlayerId,
				from_player_name: myPlayerName,
			});
		}

		// Set expiration timer
		setTimeout(() => {
			if (this.pendingRequests.has(tradeId)) {
				this.pendingRequests.delete(tradeId);
				this.emit('trade-expired', tradeId);
			}
		}, this.REQUEST_TIMEOUT);

		return { success: true, tradeId };
	}

	/**
	 * Handle incoming trade request
	 */
	handleTradeRequest(fromPlayerId: string, fromPlayerName: string, tradeId: string): void {
		// Check if already trading
		if (this.currentTrade) {
			// Send decline
			if (this.sendTradeMessageCallback) {
				this.sendTradeMessageCallback(fromPlayerId, {
					type: 'trade-declined',
					trade_id: tradeId,
					reason: 'Already in a trade',
				});
			}
			return;
		}

		// Emit event for UI to show
		this.emit('trade-request-received', fromPlayerId, fromPlayerName, tradeId);
	}

	/**
	 * Accept trade request
	 */
	acceptTradeRequest(tradeId: string, myPlayerId: string, myPlayerName: string): { success: boolean; error?: string } {
		if (this.currentTrade) {
			return { success: false, error: 'Already in a trade' };
		}

		// Create trade
		const trade: Trade = {
			trade_id: tradeId,
			initiator: {
				player_id: '', // Will be filled by initiator
				player_name: '',
				items: [],
				currency: 0,
				confirmed: false,
			},
			partner: {
				player_id: myPlayerId,
				player_name: myPlayerName,
				items: [],
				currency: 0,
				confirmed: false,
			},
			status: 'active',
			created_at: Date.now(),
			expires_at: Date.now() + this.TRADE_TIMEOUT,
		};

		this.currentTrade = trade;
		this.startExpirationTimer();

		// Send acceptance to initiator
		if (this.sendTradeMessageCallback) {
			this.sendTradeMessageCallback('', {
				// Will be routed by network layer
				type: 'trade-accepted',
				trade_id: tradeId,
				player_id: myPlayerId,
				player_name: myPlayerName,
			});
		}

		this.emit('trade-request-accepted', tradeId);
		this.emit('trade-started', trade);

		return { success: true };
	}

	/**
	 * Decline trade request
	 */
	declineTradeRequest(tradeId: string): void {
		this.pendingRequests.delete(tradeId);

		// Send decline message
		if (this.sendTradeMessageCallback) {
			this.sendTradeMessageCallback('', {
				type: 'trade-declined',
				trade_id: tradeId,
			});
		}

		this.emit('trade-request-declined', tradeId);
	}

	/**
	 * Add item to trade offer
	 */
	addItem(itemId: string, quantity: number, slot?: number): { success: boolean; error?: string } {
		if (!this.currentTrade) {
			return { success: false, error: 'Not in a trade' };
		}

		if (this.currentTrade.status !== 'active') {
			return { success: false, error: 'Trade not active' };
		}

		// Check if already confirmed
		if (this.currentTrade.initiator.confirmed) {
			return { success: false, error: 'Already confirmed trade' };
		}

		// Check inventory
		if (this.checkInventoryCallback && !this.checkInventoryCallback([{ item_id: itemId, quantity, slot }])) {
			return { success: false, error: 'Item not available in inventory' };
		}

		// Add to offer
		this.currentTrade.initiator.items.push({ item_id: itemId, quantity, slot });

		// Reset confirmations
		this.currentTrade.initiator.confirmed = false;
		this.currentTrade.partner.confirmed = false;

		// Send update
		this.sendTradeUpdate();

		return { success: true };
	}

	/**
	 * Remove item from trade offer
	 */
	removeItem(itemId: string): { success: boolean; error?: string } {
		if (!this.currentTrade) {
			return { success: false, error: 'Not in a trade' };
		}

		if (this.currentTrade.initiator.confirmed) {
			return { success: false, error: 'Already confirmed trade' };
		}

		// Remove item
		const index = this.currentTrade.initiator.items.findIndex((i) => i.item_id === itemId);
		if (index !== -1) {
			this.currentTrade.initiator.items.splice(index, 1);
		}

		// Reset confirmations
		this.currentTrade.initiator.confirmed = false;
		this.currentTrade.partner.confirmed = false;

		// Send update
		this.sendTradeUpdate();

		return { success: true };
	}

	/**
	 * Set currency offer
	 */
	setCurrency(amount: number): { success: boolean; error?: string } {
		if (!this.currentTrade) {
			return { success: false, error: 'Not in a trade' };
		}

		if (amount < 0) {
			return { success: false, error: 'Invalid amount' };
		}

		if (this.currentTrade.initiator.confirmed) {
			return { success: false, error: 'Already confirmed trade' };
		}

		// Check balance
		if (this.checkCurrencyCallback && !this.checkCurrencyCallback(amount)) {
			return { success: false, error: 'Insufficient currency' };
		}

		this.currentTrade.initiator.currency = amount;

		// Reset confirmations
		this.currentTrade.initiator.confirmed = false;
		this.currentTrade.partner.confirmed = false;

		// Send update
		this.sendTradeUpdate();

		return { success: true };
	}

	/**
	 * Confirm trade
	 */
	confirmTrade(): { success: boolean; error?: string } {
		if (!this.currentTrade) {
			return { success: false, error: 'Not in a trade' };
		}

		if (this.currentTrade.status !== 'active') {
			return { success: false, error: 'Trade not active' };
		}

		// Verify inventory and currency
		if (this.checkInventoryCallback && !this.checkInventoryCallback(this.currentTrade.initiator.items)) {
			return { success: false, error: 'Items no longer available' };
		}

		if (
			this.checkCurrencyCallback &&
			this.currentTrade.initiator.currency > 0 &&
			!this.checkCurrencyCallback(this.currentTrade.initiator.currency)
		) {
			return { success: false, error: 'Insufficient currency' };
		}

		// Confirm
		this.currentTrade.initiator.confirmed = true;
		this.emit('trade-confirmed', this.currentTrade.initiator.player_id);

		// Send confirmation
		if (this.sendTradeMessageCallback) {
			this.sendTradeMessageCallback(this.currentTrade.partner.player_id, {
				type: 'trade-confirmed',
				trade_id: this.currentTrade.trade_id,
				player_id: this.currentTrade.initiator.player_id,
			});
		}

		// Check if both confirmed
		if (this.currentTrade.partner.confirmed) {
			this.executeTrade();
		}

		return { success: true };
	}

	/**
	 * Execute trade (both players confirmed)
	 */
	private async executeTrade(): Promise<void> {
		if (!this.currentTrade) return;

		// Server validation
		if (this.validateTradeCallback) {
			const valid = await this.validateTradeCallback(this.currentTrade);
			if (!valid) {
				this.cancelTrade('Server validation failed');
				return;
			}
		}

		// Execute trade
		const trade = this.currentTrade;

		try {
			// Remove items from initiator
			if (this.removeItemsCallback && !this.removeItemsCallback(trade.initiator.items)) {
				throw new Error('Failed to remove items from initiator');
			}

			// Remove currency from initiator
			if (
				trade.initiator.currency > 0 &&
				this.removeCurrencyCallback &&
				!this.removeCurrencyCallback(trade.initiator.currency)
			) {
				throw new Error('Failed to remove currency from initiator');
			}

			// Add partner's items to initiator
			if (this.addItemsCallback && !this.addItemsCallback(trade.partner.items)) {
				throw new Error('Failed to add items to initiator');
			}

			// Add partner's currency to initiator
			if (trade.partner.currency > 0 && this.addCurrencyCallback) {
				this.addCurrencyCallback(trade.partner.currency);
			}

			// Mark as completed
			trade.status = 'completed';

			// Emit completion
			this.emit('trade-completed', trade);

			// Clear
			this.stopExpirationTimer();
			this.currentTrade = null;
		} catch (error) {
			console.error('[TradingManager] Trade execution failed:', error);
			this.cancelTrade('Trade execution failed');
		}
	}

	/**
	 * Cancel trade
	 */
	cancelTrade(reason: string = 'Cancelled by player'): void {
		if (!this.currentTrade) return;

		const tradeId = this.currentTrade.trade_id;

		// Send cancellation
		if (this.sendTradeMessageCallback) {
			this.sendTradeMessageCallback('', {
				type: 'trade-cancelled',
				trade_id: tradeId,
				reason,
			});
		}

		// Emit event
		this.emit('trade-cancelled', tradeId, reason);

		// Clear
		this.stopExpirationTimer();
		this.currentTrade = null;
	}

	/**
	 * Send trade update to partner
	 */
	private sendTradeUpdate(): void {
		if (!this.currentTrade) return;

		if (this.sendTradeMessageCallback) {
			this.sendTradeMessageCallback(this.currentTrade.partner.player_id, {
				type: 'trade-updated',
				trade_id: this.currentTrade.trade_id,
				items: this.currentTrade.initiator.items,
				currency: this.currentTrade.initiator.currency,
				confirmed: this.currentTrade.initiator.confirmed,
			});
		}

		this.emit('trade-updated', this.currentTrade);
	}

	/**
	 * Handle incoming trade update
	 */
	handleTradeUpdate(update: {
		trade_id: string;
		items: TradeItem[];
		currency: number;
		confirmed: boolean;
	}): void {
		if (!this.currentTrade || this.currentTrade.trade_id !== update.trade_id) return;

		// Update partner's offer
		this.currentTrade.partner.items = update.items;
		this.currentTrade.partner.currency = update.currency;
		this.currentTrade.partner.confirmed = update.confirmed;

		// Emit update
		this.emit('trade-updated', this.currentTrade);

		// Check if both confirmed
		if (this.currentTrade.initiator.confirmed && this.currentTrade.partner.confirmed) {
			this.executeTrade();
		}
	}

	/**
	 * Start expiration timer
	 */
	private startExpirationTimer(): void {
		if (!this.currentTrade) return;

		const timeLeft = this.currentTrade.expires_at - Date.now();

		this.expirationTimer = window.setTimeout(() => {
			if (this.currentTrade) {
				const tradeId = this.currentTrade.trade_id;
				this.cancelTrade('Trade expired');
				this.emit('trade-expired', tradeId);
			}
		}, timeLeft);
	}

	/**
	 * Stop expiration timer
	 */
	private stopExpirationTimer(): void {
		if (this.expirationTimer !== null) {
			clearTimeout(this.expirationTimer);
			this.expirationTimer = null;
		}
	}

	/**
	 * Get current trade
	 */
	getCurrentTrade(): Trade | null {
		return this.currentTrade;
	}

	/**
	 * Check if trading
	 */
	isTrading(): boolean {
		return this.currentTrade !== null;
	}

	/**
	 * Clear all data
	 */
	clear(): void {
		this.stopExpirationTimer();
		this.currentTrade = null;
		this.pendingRequests.clear();
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.clear();
	}
}
