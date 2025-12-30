/**
 * TradingUI
 * User interface for P2P trading
 */

import type { TradingManager, Trade, TradeItem } from '../economy/TradingManager.ts';

export class TradingUI {
	private container: HTMLElement | null = null;
	private tradingManager: TradingManager;
	private isVisible: boolean = false;

	constructor(tradingManager: TradingManager) {
		this.tradingManager = tradingManager;
		this.createUI();
		this.attachEventListeners();
	}

	/**
	 * Create UI elements
	 */
	private createUI(): void {
		this.container = document.createElement('div');
		this.container.id = 'trading-ui';
		this.container.style.cssText = `
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 800px;
			background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
			border: 2px solid #f39c12;
			border-radius: 10px;
			padding: 20px;
			display: none;
			z-index: 1000;
			font-family: Arial, sans-serif;
			color: #fff;
			box-shadow: 0 10px 40px rgba(0,0,0,0.5);
		`;

		this.container.innerHTML = `
			<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
				<h2 style="margin: 0; color: #f39c12;">Trading</h2>
				<button id="trading-close-btn" style="
					background: #e74c3c;
					color: white;
					border: none;
					padding: 8px 15px;
					border-radius: 5px;
					cursor: pointer;
					font-size: 16px;
				">✕</button>
			</div>

			<!-- Trade partner info -->
			<div id="trade-partner-info" style="margin-bottom: 15px; text-align: center;">
				<span id="partner-name" style="color: #f39c12; font-weight: bold;"></span>
			</div>

			<!-- Trade window -->
			<div style="display: flex; gap: 20px; margin-bottom: 15px;">
				<!-- Your offer -->
				<div style="flex: 1; border: 2px solid #4ecca3; border-radius: 5px; padding: 15px;">
					<h3 style="margin-top: 0; color: #4ecca3; font-size: 16px;">Your Offer</h3>

					<!-- Items -->
					<div style="margin-bottom: 10px;">
						<strong>Items:</strong>
						<div id="your-items" style="
							min-height: 100px;
							max-height: 200px;
							overflow-y: auto;
							background: #0f3460;
							border-radius: 5px;
							padding: 10px;
							margin-top: 5px;
						">
							<p style="color: #888; text-align: center; margin: 40px 0;">Drag items here</p>
						</div>
					</div>

					<!-- Currency -->
					<div>
						<strong>Currency:</strong>
						<input type="number" id="your-currency" min="0" value="0" style="
							width: 100%;
							padding: 8px;
							background: #0f3460;
							border: 1px solid #4ecca3;
							border-radius: 5px;
							color: #fff;
							margin-top: 5px;
						">
					</div>

					<!-- Confirm button -->
					<button id="your-confirm-btn" style="
						width: 100%;
						margin-top: 10px;
						padding: 10px;
						background: #0f3460;
						color: #fff;
						border: 2px solid #4ecca3;
						border-radius: 5px;
						cursor: pointer;
						font-weight: bold;
					">Confirm</button>
				</div>

				<!-- Partner's offer -->
				<div style="flex: 1; border: 2px solid #e74c3c; border-radius: 5px; padding: 15px;">
					<h3 style="margin-top: 0; color: #e74c3c; font-size: 16px;">Partner's Offer</h3>

					<!-- Items -->
					<div style="margin-bottom: 10px;">
						<strong>Items:</strong>
						<div id="partner-items" style="
							min-height: 100px;
							max-height: 200px;
							overflow-y: auto;
							background: #0f3460;
							border-radius: 5px;
							padding: 10px;
							margin-top: 5px;
						">
							<p style="color: #888; text-align: center; margin: 40px 0;">Waiting for offer...</p>
						</div>
					</div>

					<!-- Currency -->
					<div>
						<strong>Currency:</strong>
						<div id="partner-currency" style="
							width: 100%;
							padding: 8px;
							background: #0f3460;
							border: 1px solid #e74c3c;
							border-radius: 5px;
							margin-top: 5px;
							text-align: center;
						">0</div>
					</div>

					<!-- Status -->
					<div id="partner-confirm-status" style="
						width: 100%;
						margin-top: 10px;
						padding: 10px;
						background: #0f3460;
						border: 2px solid #888;
						border-radius: 5px;
						text-align: center;
						font-weight: bold;
						color: #888;
					">Waiting</div>
				</div>
			</div>

			<!-- Actions -->
			<div style="display: flex; gap: 10px;">
				<button id="trade-cancel-btn" style="
					flex: 1;
					padding: 12px;
					background: #e74c3c;
					color: white;
					border: none;
					border-radius: 5px;
					font-size: 16px;
					font-weight: bold;
					cursor: pointer;
				">Cancel Trade</button>
			</div>
		`;

		// Add styles
		const style = document.createElement('style');
		style.textContent = `
			.trade-item {
				background: #16213e;
				padding: 8px;
				margin-bottom: 5px;
				border-radius: 3px;
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			.trade-item .remove-btn {
				background: #e74c3c;
				color: white;
				border: none;
				padding: 3px 8px;
				border-radius: 3px;
				cursor: pointer;
				font-size: 12px;
			}
			#your-confirm-btn.confirmed {
				background: #4ecca3;
				color: #1a1a2e;
				border-color: #4ecca3;
			}
			#partner-confirm-status.confirmed {
				background: #4ecca3;
				color: #1a1a2e;
				border-color: #4ecca3;
			}
		`;
		document.head.appendChild(style);

		document.body.appendChild(this.container);
	}

	/**
	 * Attach event listeners
	 */
	private attachEventListeners(): void {
		// Close button
		const closeBtn = this.container?.querySelector('#trading-close-btn');
		closeBtn?.addEventListener('click', () => this.cancelTrade());

		// Cancel button
		const cancelBtn = this.container?.querySelector('#trade-cancel-btn');
		cancelBtn?.addEventListener('click', () => this.cancelTrade());

		// Currency input
		const currencyInput = this.container?.querySelector('#your-currency') as HTMLInputElement;
		currencyInput?.addEventListener('change', (e) => {
			const amount = parseInt((e.target as HTMLInputElement).value) || 0;
			this.tradingManager.setCurrency(amount);
		});

		// Confirm button
		const confirmBtn = this.container?.querySelector('#your-confirm-btn');
		confirmBtn?.addEventListener('click', () => {
			this.confirmTrade();
		});

		// Trading manager events
		this.tradingManager.on('trade-started', (trade) => {
			this.updateTradeWindow(trade);
		});

		this.tradingManager.on('trade-updated', (trade) => {
			this.updateTradeWindow(trade);
		});

		this.tradingManager.on('trade-confirmed', (playerId) => {
			this.updateConfirmStatus(playerId);
		});

		this.tradingManager.on('trade-completed', (trade) => {
			this.showNotification('Trade completed successfully!', 'success');
			this.hide();
		});

		this.tradingManager.on('trade-cancelled', (tradeId, reason) => {
			this.showNotification(`Trade cancelled: ${reason}`, 'error');
			this.hide();
		});

		this.tradingManager.on('trade-expired', (tradeId) => {
			this.showNotification('Trade expired', 'error');
			this.hide();
		});
	}

	/**
	 * Show trading UI with partner
	 */
	show(partnerName?: string): void {
		if (this.container) {
			this.container.style.display = 'block';
			this.isVisible = true;

			if (partnerName) {
				const partnerNameEl = this.container.querySelector('#partner-name');
				if (partnerNameEl) {
					partnerNameEl.textContent = `Trading with: ${partnerName}`;
				}
			}

			this.resetTradeWindow();
		}
	}

	/**
	 * Hide trading UI
	 */
	hide(): void {
		if (this.container) {
			this.container.style.display = 'none';
			this.isVisible = false;
			this.resetTradeWindow();
		}
	}

	/**
	 * Toggle UI
	 */
	toggle(): void {
		if (this.isVisible) {
			this.hide();
		} else {
			this.show();
		}
	}

	/**
	 * Reset trade window
	 */
	private resetTradeWindow(): void {
		// Reset your items
		const yourItems = this.container?.querySelector('#your-items');
		if (yourItems) {
			yourItems.innerHTML = '<p style="color: #888; text-align: center; margin: 40px 0;">Drag items here</p>';
		}

		// Reset your currency
		const yourCurrency = this.container?.querySelector('#your-currency') as HTMLInputElement;
		if (yourCurrency) {
			yourCurrency.value = '0';
		}

		// Reset partner items
		const partnerItems = this.container?.querySelector('#partner-items');
		if (partnerItems) {
			partnerItems.innerHTML = '<p style="color: #888; text-align: center; margin: 40px 0;">Waiting for offer...</p>';
		}

		// Reset partner currency
		const partnerCurrency = this.container?.querySelector('#partner-currency');
		if (partnerCurrency) {
			partnerCurrency.textContent = '0';
		}

		// Reset confirm buttons
		const confirmBtn = this.container?.querySelector('#your-confirm-btn');
		confirmBtn?.classList.remove('confirmed');
		if (confirmBtn) {
			(confirmBtn as HTMLElement).textContent = 'Confirm';
		}

		const partnerStatus = this.container?.querySelector('#partner-confirm-status');
		partnerStatus?.classList.remove('confirmed');
		if (partnerStatus) {
			partnerStatus.textContent = 'Waiting';
		}
	}

	/**
	 * Update trade window with current trade state
	 */
	private updateTradeWindow(trade: Trade): void {
		// Update your items
		this.renderItems(trade.initiator.items, '#your-items', true);

		// Update partner items
		this.renderItems(trade.partner.items, '#partner-items', false);

		// Update partner currency
		const partnerCurrency = this.container?.querySelector('#partner-currency');
		if (partnerCurrency) {
			partnerCurrency.textContent = trade.partner.currency.toString();
		}

		// Update confirm status
		if (trade.initiator.confirmed) {
			const confirmBtn = this.container?.querySelector('#your-confirm-btn');
			confirmBtn?.classList.add('confirmed');
			if (confirmBtn) {
				(confirmBtn as HTMLElement).textContent = 'Confirmed ✓';
			}
		}

		if (trade.partner.confirmed) {
			const partnerStatus = this.container?.querySelector('#partner-confirm-status');
			partnerStatus?.classList.add('confirmed');
			if (partnerStatus) {
				partnerStatus.textContent = 'Confirmed ✓';
			}
		}
	}

	/**
	 * Render items list
	 */
	private renderItems(items: TradeItem[], containerId: string, allowRemove: boolean): void {
		const container = this.container?.querySelector(containerId);
		if (!container) return;

		if (items.length === 0) {
			container.innerHTML = allowRemove
				? '<p style="color: #888; text-align: center; margin: 40px 0;">Drag items here</p>'
				: '<p style="color: #888; text-align: center; margin: 40px 0;">No items offered</p>';
			return;
		}

		container.innerHTML = items
			.map(
				(item) => `
			<div class="trade-item">
				<span>${item.item_id} x${item.quantity}</span>
				${
					allowRemove
						? `<button class="remove-btn" data-item-id="${item.item_id}">✕</button>`
						: ''
				}
			</div>
		`,
			)
			.join('');

		// Add remove listeners
		if (allowRemove) {
			container.querySelectorAll('.remove-btn').forEach((btn) => {
				btn.addEventListener('click', (e) => {
					const itemId = (e.target as HTMLElement).dataset.itemId;
					if (itemId) {
						this.removeItem(itemId);
					}
				});
			});
		}
	}

	/**
	 * Add item to trade (called externally)
	 */
	addItem(itemId: string, quantity: number): void {
		const result = this.tradingManager.addItem(itemId, quantity);
		if (!result.success) {
			this.showNotification(result.error || 'Failed to add item', 'error');
		}
	}

	/**
	 * Remove item from trade
	 */
	private removeItem(itemId: string): void {
		const result = this.tradingManager.removeItem(itemId);
		if (!result.success) {
			this.showNotification(result.error || 'Failed to remove item', 'error');
		}
	}

	/**
	 * Confirm trade
	 */
	private confirmTrade(): void {
		const result = this.tradingManager.confirmTrade();
		if (!result.success) {
			this.showNotification(result.error || 'Failed to confirm trade', 'error');
		}
	}

	/**
	 * Cancel trade
	 */
	private cancelTrade(): void {
		this.tradingManager.cancelTrade();
	}

	/**
	 * Update confirm status
	 */
	private updateConfirmStatus(playerId: string): void {
		const trade = this.tradingManager.getCurrentTrade();
		if (!trade) return;

		if (playerId === trade.initiator.player_id) {
			const confirmBtn = this.container?.querySelector('#your-confirm-btn');
			confirmBtn?.classList.add('confirmed');
			if (confirmBtn) {
				(confirmBtn as HTMLElement).textContent = 'Confirmed ✓';
			}
		} else {
			const partnerStatus = this.container?.querySelector('#partner-confirm-status');
			partnerStatus?.classList.add('confirmed');
			if (partnerStatus) {
				partnerStatus.textContent = 'Confirmed ✓';
			}
		}
	}

	/**
	 * Show notification
	 */
	private showNotification(message: string, type: 'success' | 'error'): void {
		const notification = document.createElement('div');
		notification.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			background: ${type === 'success' ? '#2ecc71' : '#e74c3c'};
			color: white;
			padding: 15px 20px;
			border-radius: 5px;
			z-index: 10000;
			animation: slideIn 0.3s ease-out;
		`;
		notification.textContent = message;

		document.body.appendChild(notification);

		setTimeout(() => {
			notification.remove();
		}, 3000);
	}

	/**
	 * Destroy UI
	 */
	destroy(): void {
		this.container?.remove();
	}
}
