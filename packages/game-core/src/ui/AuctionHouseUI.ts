/**
 * AuctionHouseUI
 * User interface for auction house
 */

import type { AuctionHouseClient, AuctionOrder, SearchRequest } from '../economy/AuctionHouseClient';

export class AuctionHouseUI {
	private container: HTMLElement | null = null;
	private auctionClient: AuctionHouseClient;
	private isVisible: boolean = false;

	private currentTab: 'browse' | 'my-orders' | 'create' = 'browse';
	private currentOrders: AuctionOrder[] = [];
	private myOrders: AuctionOrder[] = [];

	constructor(auctionClient: AuctionHouseClient) {
		this.auctionClient = auctionClient;
		this.createUI();
		this.attachEventListeners();
	}

	/**
	 * Create UI elements
	 */
	private createUI(): void {
		this.container = document.createElement('div');
		this.container.id = 'auction-house-ui';
		this.container.style.cssText = `
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 900px;
			height: 650px;
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
				<h2 style="margin: 0; color: #f39c12;">🏪 Auction House</h2>
				<button id="ah-close-btn" style="
					background: #e74c3c;
					color: white;
					border: none;
					padding: 8px 15px;
					border-radius: 5px;
					cursor: pointer;
					font-size: 16px;
				">✕</button>
			</div>

			<!-- Tabs -->
			<div id="ah-tabs" style="display: flex; gap: 10px; margin-bottom: 15px;">
				<button class="ah-tab-btn active" data-tab="browse">Browse</button>
				<button class="ah-tab-btn" data-tab="my-orders">My Orders</button>
				<button class="ah-tab-btn" data-tab="create">Create Order</button>
			</div>

			<!-- Browse Tab -->
			<div id="tab-browse" class="ah-tab-content">
				<!-- Search Bar -->
				<div style="display: flex; gap: 10px; margin-bottom: 15px;">
					<input type="text" id="search-item-id" placeholder="Item ID" style="
						flex: 1;
						padding: 8px;
						background: #0f3460;
						border: 1px solid #f39c12;
						border-radius: 5px;
						color: #fff;
					">
					<input type="number" id="search-min-price" placeholder="Min Price" style="
						width: 120px;
						padding: 8px;
						background: #0f3460;
						border: 1px solid #f39c12;
						border-radius: 5px;
						color: #fff;
					">
					<input type="number" id="search-max-price" placeholder="Max Price" style="
						width: 120px;
						padding: 8px;
						background: #0f3460;
						border: 1px solid #f39c12;
						border-radius: 5px;
						color: #fff;
					">
					<select id="search-sort" style="
						padding: 8px;
						background: #0f3460;
						border: 1px solid #f39c12;
						border-radius: 5px;
						color: #fff;
					">
						<option value="date_desc">Newest First</option>
						<option value="date_asc">Oldest First</option>
						<option value="price_asc">Price: Low to High</option>
						<option value="price_desc">Price: High to Low</option>
					</select>
					<button id="search-btn" style="
						padding: 8px 20px;
						background: #f39c12;
						color: #1a1a2e;
						border: none;
						border-radius: 5px;
						font-weight: bold;
						cursor: pointer;
					">Search</button>
				</div>

				<!-- Orders List -->
				<div id="orders-list" style="
					height: 480px;
					overflow-y: auto;
					border: 1px solid #f39c12;
					border-radius: 5px;
					padding: 10px;
				">
					<p style="color: #888; text-align: center; margin-top: 100px;">Search for items to browse</p>
				</div>
			</div>

			<!-- My Orders Tab -->
			<div id="tab-my-orders" class="ah-tab-content" style="display: none;">
				<button id="refresh-my-orders-btn" style="
					padding: 8px 20px;
					background: #f39c12;
					color: #1a1a2e;
					border: none;
					border-radius: 5px;
					font-weight: bold;
					cursor: pointer;
					margin-bottom: 15px;
				">Refresh</button>

				<div id="my-orders-list" style="
					height: 520px;
					overflow-y: auto;
					border: 1px solid #f39c12;
					border-radius: 5px;
					padding: 10px;
				">
					<p style="color: #888; text-align: center; margin-top: 100px;">No orders</p>
				</div>
			</div>

			<!-- Create Order Tab -->
			<div id="tab-create" class="ah-tab-content" style="display: none;">
				<div style="max-width: 500px; margin: 0 auto; padding: 20px;">
					<h3 style="color: #f39c12;">Create New Order</h3>

					<div style="margin-bottom: 15px;">
						<label style="display: block; margin-bottom: 5px;">Item ID:</label>
						<input type="text" id="create-item-id" style="
							width: 100%;
							padding: 10px;
							background: #0f3460;
							border: 1px solid #f39c12;
							border-radius: 5px;
							color: #fff;
						">
					</div>

					<div style="margin-bottom: 15px;">
						<label style="display: block; margin-bottom: 5px;">Quantity:</label>
						<input type="number" id="create-quantity" min="1" value="1" style="
							width: 100%;
							padding: 10px;
							background: #0f3460;
							border: 1px solid #f39c12;
							border-radius: 5px;
							color: #fff;
						">
					</div>

					<div style="margin-bottom: 15px;">
						<label style="display: block; margin-bottom: 5px;">Price per Unit:</label>
						<input type="number" id="create-price" min="1" value="100" style="
							width: 100%;
							padding: 10px;
							background: #0f3460;
							border: 1px solid #f39c12;
							border-radius: 5px;
							color: #fff;
						">
					</div>

					<div id="create-total-price" style="
						margin-bottom: 15px;
						padding: 10px;
						background: #0f3460;
						border-radius: 5px;
						text-align: center;
					">
						Total Price: <span style="color: #f39c12; font-weight: bold;">100</span> gold
					</div>

					<button id="create-order-btn" style="
						width: 100%;
						padding: 12px;
						background: #f39c12;
						color: #1a1a2e;
						border: none;
						border-radius: 5px;
						font-size: 16px;
						font-weight: bold;
						cursor: pointer;
					">Create Order</button>

					<p style="color: #888; font-size: 12px; margin-top: 10px; text-align: center;">
						5% auction fee will be deducted from sales
					</p>
				</div>
			</div>
		`;

		// Add styles
		const style = document.createElement('style');
		style.textContent = `
			.ah-tab-btn {
				padding: 10px 20px;
				background: #0f3460;
				color: #fff;
				border: 2px solid transparent;
				border-radius: 5px;
				cursor: pointer;
				transition: all 0.2s;
			}
			.ah-tab-btn:hover {
				border-color: #f39c12;
			}
			.ah-tab-btn.active {
				background: #f39c12;
				color: #1a1a2e;
			}
			.order-card {
				background: #0f3460;
				padding: 15px;
				margin-bottom: 10px;
				border-radius: 5px;
				border: 2px solid transparent;
				transition: all 0.2s;
			}
			.order-card:hover {
				border-color: #f39c12;
			}
			.order-card-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 10px;
			}
			.order-card-title {
				font-weight: bold;
				color: #f39c12;
				font-size: 16px;
			}
			.order-card-body {
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			.order-card-info {
				flex: 1;
			}
			.order-card-actions button {
				padding: 8px 15px;
				border: none;
				border-radius: 5px;
				cursor: pointer;
				font-weight: bold;
				margin-left: 5px;
			}
			.buy-btn {
				background: #2ecc71;
				color: white;
			}
			.cancel-btn {
				background: #e74c3c;
				color: white;
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
		const closeBtn = this.container?.querySelector('#ah-close-btn');
		closeBtn?.addEventListener('click', () => this.hide());

		// Tab switching
		const tabBtns = this.container?.querySelectorAll('.ah-tab-btn');
		tabBtns?.forEach((btn) => {
			btn.addEventListener('click', (e) => {
				const tab = (e.target as HTMLElement).dataset.tab as 'browse' | 'my-orders' | 'create';
				this.switchTab(tab);
			});
		});

		// Search button
		const searchBtn = this.container?.querySelector('#search-btn');
		searchBtn?.addEventListener('click', () => this.performSearch());

		// Refresh my orders
		const refreshBtn = this.container?.querySelector('#refresh-my-orders-btn');
		refreshBtn?.addEventListener('click', () => this.loadMyOrders());

		// Create order price calculation
		const quantityInput = this.container?.querySelector('#create-quantity') as HTMLInputElement;
		const priceInput = this.container?.querySelector('#create-price') as HTMLInputElement;
		const updateTotalPrice = () => {
			const quantity = parseInt(quantityInput?.value) || 1;
			const price = parseInt(priceInput?.value) || 0;
			const total = quantity * price;
			const totalPriceEl = this.container?.querySelector('#create-total-price span');
			if (totalPriceEl) {
				totalPriceEl.textContent = total.toString();
			}
		};

		quantityInput?.addEventListener('input', updateTotalPrice);
		priceInput?.addEventListener('input', updateTotalPrice);

		// Create order button
		const createOrderBtn = this.container?.querySelector('#create-order-btn');
		createOrderBtn?.addEventListener('click', () => this.createOrder());

		// Auction client events
		this.auctionClient.on('order-created', (orderId) => {
			this.showNotification(`Order created successfully! ID: ${orderId}`, 'success');
			this.switchTab('my-orders');
		});

		this.auctionClient.on('order-bought', (order) => {
			this.showNotification(`Successfully bought ${order.quantity}x ${order.item_id}!`, 'success');
			this.performSearch();
		});

		this.auctionClient.on('order-cancelled', (orderId) => {
			this.showNotification(`Order #${orderId} cancelled`, 'success');
			this.loadMyOrders();
		});

		this.auctionClient.on('error', (message) => {
			this.showNotification(message, 'error');
		});
	}

	/**
	 * Show UI
	 */
	show(): void {
		if (this.container) {
			this.container.style.display = 'block';
			this.isVisible = true;
			this.performSearch(); // Initial search
		}
	}

	/**
	 * Hide UI
	 */
	hide(): void {
		if (this.container) {
			this.container.style.display = 'none';
			this.isVisible = false;
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
	 * Switch tab
	 */
	private switchTab(tab: 'browse' | 'my-orders' | 'create'): void {
		this.currentTab = tab;

		// Update tab buttons
		const tabBtns = this.container?.querySelectorAll('.ah-tab-btn');
		tabBtns?.forEach((btn) => {
			const btnTab = (btn as HTMLElement).dataset.tab;
			if (btnTab === tab) {
				btn.classList.add('active');
			} else {
				btn.classList.remove('active');
			}
		});

		// Show/hide tab content
		const tabContents = this.container?.querySelectorAll('.ah-tab-content');
		tabContents?.forEach((content) => {
			(content as HTMLElement).style.display = 'none';
		});

		const activeTab = this.container?.querySelector(`#tab-${tab}`);
		if (activeTab) {
			(activeTab as HTMLElement).style.display = 'block';
		}

		// Load data for tab
		if (tab === 'my-orders') {
			this.loadMyOrders();
		}
	}

	/**
	 * Perform search
	 */
	private async performSearch(): Promise<void> {
		const itemIdInput = this.container?.querySelector('#search-item-id') as HTMLInputElement;
		const minPriceInput = this.container?.querySelector('#search-min-price') as HTMLInputElement;
		const maxPriceInput = this.container?.querySelector('#search-max-price') as HTMLInputElement;
		const sortSelect = this.container?.querySelector('#search-sort') as HTMLSelectElement;

		const search: SearchRequest = {
			item_id: itemIdInput?.value || undefined,
			min_price: minPriceInput?.value ? parseInt(minPriceInput.value) : undefined,
			max_price: maxPriceInput?.value ? parseInt(maxPriceInput.value) : undefined,
			sort_by: (sortSelect?.value as any) || 'date_desc',
			limit: 50,
		};

		const orders = await this.auctionClient.searchOrders(search);
		this.currentOrders = orders;
		this.renderOrdersList(orders, 'orders-list', false);
	}

	/**
	 * Load my orders
	 */
	private async loadMyOrders(): Promise<void> {
		const orders = await this.auctionClient.getMyOrders(true);
		this.myOrders = orders;
		this.renderOrdersList(orders, 'my-orders-list', true);
	}

	/**
	 * Render orders list
	 */
	private renderOrdersList(orders: AuctionOrder[], containerId: string, showCancel: boolean): void {
		const container = this.container?.querySelector(`#${containerId}`);
		if (!container) return;

		if (orders.length === 0) {
			container.innerHTML = '<p style="color: #888; text-align: center; margin-top: 100px;">No orders found</p>';
			return;
		}

		container.innerHTML = orders
			.map((order) => {
				const isActive = order.status === 'active';
				const expiresAt = new Date(order.expires_at);
				const timeLeft = Math.max(0, expiresAt.getTime() - Date.now());
				const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));

				return `
					<div class="order-card">
						<div class="order-card-header">
							<div class="order-card-title">${order.item_id} x${order.quantity}</div>
							<div style="color: ${isActive ? '#2ecc71' : '#888'};">${order.status.toUpperCase()}</div>
						</div>
						<div class="order-card-body">
							<div class="order-card-info">
								<div>Price: <span style="color: #f39c12; font-weight: bold;">${order.price_per_unit}</span> gold/unit</div>
								<div>Total: <span style="color: #f39c12; font-weight: bold;">${order.total_price}</span> gold</div>
								<div style="font-size: 12px; color: #888;">
									Seller: ${order.seller_name} |
									${isActive ? `Expires in ${daysLeft} days` : `Ended`}
								</div>
							</div>
							<div class="order-card-actions">
								${isActive && !showCancel ? `<button class="buy-btn" data-order-id="${order.id}">Buy</button>` : ''}
								${isActive && showCancel ? `<button class="cancel-btn" data-order-id="${order.id}">Cancel</button>` : ''}
							</div>
						</div>
					</div>
				`;
			})
			.join('');

		// Attach button listeners
		container.querySelectorAll('.buy-btn').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				const orderId = parseInt((e.target as HTMLElement).dataset.orderId!);
				this.buyOrder(orderId);
			});
		});

		container.querySelectorAll('.cancel-btn').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				const orderId = parseInt((e.target as HTMLElement).dataset.orderId!);
				this.cancelOrder(orderId);
			});
		});
	}

	/**
	 * Buy order
	 */
	private async buyOrder(orderId: number): Promise<void> {
		const confirmed = confirm('Are you sure you want to buy this order?');
		if (!confirmed) return;

		await this.auctionClient.buyOrder(orderId);
	}

	/**
	 * Cancel order
	 */
	private async cancelOrder(orderId: number): Promise<void> {
		const confirmed = confirm('Are you sure you want to cancel this order?');
		if (!confirmed) return;

		await this.auctionClient.cancelOrder(orderId);
	}

	/**
	 * Create order
	 */
	private async createOrder(): Promise<void> {
		const itemIdInput = this.container?.querySelector('#create-item-id') as HTMLInputElement;
		const quantityInput = this.container?.querySelector('#create-quantity') as HTMLInputElement;
		const priceInput = this.container?.querySelector('#create-price') as HTMLInputElement;

		const itemId = itemIdInput?.value;
		const quantity = parseInt(quantityInput?.value) || 1;
		const pricePerUnit = parseInt(priceInput?.value) || 100;

		if (!itemId) {
			this.showNotification('Please enter an item ID', 'error');
			return;
		}

		await this.auctionClient.createOrder({
			item_id: itemId,
			quantity,
			price_per_unit: pricePerUnit,
		});

		// Clear inputs
		itemIdInput.value = '';
		quantityInput.value = '1';
		priceInput.value = '100';
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
