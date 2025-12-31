/**
 * PlayerShopUI
 * UI for managing and browsing player shops
 */

import type { PlayerShopManager, PlayerShop, ShopItem } from '../economy/PlayerShopManager';

export class PlayerShopUI {
	private container: HTMLElement;
	private shopManager: PlayerShopManager;
	private currentTab: 'browse' | 'my-shop' | 'create' = 'browse';
	private selectedShop: PlayerShop | null = null;
	private getItemName?: (itemId: string) => string;

	constructor(container: HTMLElement, shopManager: PlayerShopManager) {
		this.container = container;
		this.shopManager = shopManager;

		this.setupEventListeners();
		this.render();
	}

	/**
	 * Set item name resolver
	 */
	setItemNameResolver(getItemName: (itemId: string) => string): void {
		this.getItemName = getItemName;
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		this.shopManager.on('shop-created', () => {
			this.currentTab = 'my-shop';
			this.render();
		});

		this.shopManager.on('shop-deleted', () => {
			this.currentTab = 'browse';
			this.render();
		});

		this.shopManager.on('shop-updated', () => {
			this.render();
		});

		this.shopManager.on('item-added', () => {
			this.render();
		});

		this.shopManager.on('item-removed', () => {
			this.render();
		});

		this.shopManager.on('item-purchased', () => {
			this.render();
		});

		this.shopManager.on('shops-found', () => {
			this.render();
		});

		this.shopManager.on('error', (message) => {
			this.showError(message);
		});
	}

	/**
	 * Show error message
	 */
	private showError(message: string): void {
		const errorDiv = document.createElement('div');
		errorDiv.className = 'player-shop-error';
		errorDiv.textContent = message;
		errorDiv.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			background: #f44336;
			color: white;
			padding: 12px 20px;
			border-radius: 4px;
			box-shadow: 0 2px 8px rgba(0,0,0,0.3);
			z-index: 10000;
		`;

		document.body.appendChild(errorDiv);

		setTimeout(() => {
			errorDiv.remove();
		}, 3000);
	}

	/**
	 * Render UI
	 */
	render(): void {
		this.container.innerHTML = '';

		const wrapper = document.createElement('div');
		wrapper.className = 'player-shop-ui';
		wrapper.style.cssText = `
			width: 900px;
			height: 600px;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			border-radius: 12px;
			padding: 20px;
			color: white;
			font-family: Arial, sans-serif;
			display: flex;
			flex-direction: column;
		`;

		// Header
		const header = document.createElement('div');
		header.style.cssText = 'margin-bottom: 20px;';
		header.innerHTML = `<h2 style="margin: 0; font-size: 24px;">Player Shops</h2>`;
		wrapper.appendChild(header);

		// Tabs
		const tabs = document.createElement('div');
		tabs.style.cssText = `
			display: flex;
			gap: 10px;
			margin-bottom: 20px;
		`;

		const tabButtons = [
			{ id: 'browse', label: 'Browse Shops' },
			{ id: 'my-shop', label: 'My Shop' },
			{ id: 'create', label: 'Create Shop' },
		];

		tabButtons.forEach((tab) => {
			const button = document.createElement('button');
			button.textContent = tab.label;
			button.style.cssText = `
				padding: 10px 20px;
				border: none;
				border-radius: 6px;
				cursor: pointer;
				font-size: 14px;
				background: ${this.currentTab === tab.id ? '#ffffff' : 'rgba(255,255,255,0.2)'};
				color: ${this.currentTab === tab.id ? '#667eea' : 'white'};
				font-weight: ${this.currentTab === tab.id ? 'bold' : 'normal'};
			`;

			button.addEventListener('click', () => {
				this.currentTab = tab.id as any;
				this.render();
			});

			tabs.appendChild(button);
		});

		wrapper.appendChild(tabs);

		// Content
		const content = document.createElement('div');
		content.style.cssText = `
			flex: 1;
			overflow-y: auto;
			background: rgba(255,255,255,0.1);
			border-radius: 8px;
			padding: 20px;
		`;

		if (this.currentTab === 'browse') {
			this.renderBrowseTab(content);
		} else if (this.currentTab === 'my-shop') {
			this.renderMyShopTab(content);
		} else if (this.currentTab === 'create') {
			this.renderCreateTab(content);
		}

		wrapper.appendChild(content);

		// Close button
		const closeBtn = document.createElement('button');
		closeBtn.textContent = 'Close';
		closeBtn.style.cssText = `
			margin-top: 15px;
			padding: 10px 30px;
			border: none;
			border-radius: 6px;
			background: rgba(255,255,255,0.2);
			color: white;
			cursor: pointer;
			font-size: 14px;
			align-self: flex-end;
		`;
		closeBtn.addEventListener('click', () => {
			this.container.innerHTML = '';
		});
		wrapper.appendChild(closeBtn);

		this.container.appendChild(wrapper);
	}

	/**
	 * Render browse tab
	 */
	private renderBrowseTab(content: HTMLElement): void {
		// Search form
		const searchForm = document.createElement('div');
		searchForm.style.cssText = 'margin-bottom: 20px;';

		const searchInput = document.createElement('input');
		searchInput.type = 'text';
		searchInput.placeholder = 'Search shop name...';
		searchInput.style.cssText = `
			padding: 8px 12px;
			border: none;
			border-radius: 4px;
			margin-right: 10px;
			width: 200px;
		`;

		const searchBtn = document.createElement('button');
		searchBtn.textContent = 'Search';
		searchBtn.style.cssText = `
			padding: 8px 16px;
			border: none;
			border-radius: 4px;
			background: #4CAF50;
			color: white;
			cursor: pointer;
		`;

		searchBtn.addEventListener('click', () => {
			this.shopManager.searchShops({ search_name: searchInput.value, is_open: true, limit: 20 });
		});

		searchForm.appendChild(searchInput);
		searchForm.appendChild(searchBtn);
		content.appendChild(searchForm);

		// Shop list
		const shops = this.shopManager.getNearbyShops();

		if (shops.length === 0) {
			content.innerHTML += '<p style="color: rgba(255,255,255,0.7);">No shops found. Use the search to find shops.</p>';
		} else {
			shops.forEach((shop) => {
				const shopCard = this.createShopCard(shop);
				content.appendChild(shopCard);
			});
		}

		// Selected shop details
		if (this.selectedShop) {
			const detailsDiv = document.createElement('div');
			detailsDiv.style.cssText = `
				margin-top: 20px;
				padding: 15px;
				background: rgba(255,255,255,0.2);
				border-radius: 8px;
			`;
			detailsDiv.innerHTML = `<h3 style="margin-top: 0;">${this.selectedShop.shop_name}</h3>`;

			if (this.selectedShop.items && this.selectedShop.items.length > 0) {
				const itemsList = document.createElement('div');
				itemsList.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

				this.selectedShop.items.forEach((item) => {
					const itemRow = this.createShopItemRow(item, this.selectedShop!.id);
					itemsList.appendChild(itemRow);
				});

				detailsDiv.appendChild(itemsList);
			} else {
				detailsDiv.innerHTML += '<p style="color: rgba(255,255,255,0.7);">No items in this shop.</p>';
			}

			content.appendChild(detailsDiv);
		}
	}

	/**
	 * Render my shop tab
	 */
	private renderMyShopTab(content: HTMLElement): void {
		const myShop = this.shopManager.getMyShop();

		if (!myShop) {
			content.innerHTML = `
				<p style="color: rgba(255,255,255,0.7);">You don't have a shop yet.</p>
				<p style="color: rgba(255,255,255,0.7);">Click "Create Shop" to open your own shop!</p>
			`;
			return;
		}

		// Shop info
		const infoDiv = document.createElement('div');
		infoDiv.style.cssText = 'margin-bottom: 20px;';
		infoDiv.innerHTML = `
			<h3 style="margin-top: 0;">${myShop.shop_name}</h3>
			<p style="color: rgba(255,255,255,0.8);">${myShop.description}</p>
			<p style="color: rgba(255,255,255,0.6); font-size: 12px;">
				Location: ${myShop.zone_id} (${myShop.x.toFixed(0)}, ${myShop.y.toFixed(0)})
			</p>
			<p style="color: rgba(255,255,255,0.6); font-size: 12px;">
				Status: ${myShop.is_open ? '🟢 Open' : '🔴 Closed'}
			</p>
		`;

		// Toggle open/close button
		const toggleBtn = document.createElement('button');
		toggleBtn.textContent = myShop.is_open ? 'Close Shop' : 'Open Shop';
		toggleBtn.style.cssText = `
			padding: 8px 16px;
			border: none;
			border-radius: 4px;
			background: ${myShop.is_open ? '#f44336' : '#4CAF50'};
			color: white;
			cursor: pointer;
			margin-right: 10px;
		`;
		toggleBtn.addEventListener('click', () => {
			this.shopManager.updateShop(myShop.id, { is_open: !myShop.is_open });
		});

		// Delete shop button
		const deleteBtn = document.createElement('button');
		deleteBtn.textContent = 'Delete Shop';
		deleteBtn.style.cssText = `
			padding: 8px 16px;
			border: none;
			border-radius: 4px;
			background: #9e9e9e;
			color: white;
			cursor: pointer;
		`;
		deleteBtn.addEventListener('click', () => {
			if (confirm('Are you sure you want to delete your shop?')) {
				this.shopManager.deleteShop(myShop.id);
			}
		});

		infoDiv.appendChild(toggleBtn);
		infoDiv.appendChild(deleteBtn);
		content.appendChild(infoDiv);

		// Add item form
		const addItemForm = document.createElement('div');
		addItemForm.style.cssText = `
			margin-bottom: 20px;
			padding: 15px;
			background: rgba(255,255,255,0.1);
			border-radius: 8px;
		`;
		addItemForm.innerHTML = '<h4 style="margin-top: 0;">Add Item</h4>';

		const itemIdInput = document.createElement('input');
		itemIdInput.type = 'text';
		itemIdInput.placeholder = 'Item ID';
		itemIdInput.style.cssText = 'padding: 8px; margin-right: 10px; border: none; border-radius: 4px;';

		const quantityInput = document.createElement('input');
		quantityInput.type = 'number';
		quantityInput.placeholder = 'Quantity';
		quantityInput.min = '1';
		quantityInput.style.cssText = 'padding: 8px; margin-right: 10px; border: none; border-radius: 4px; width: 100px;';

		const priceInput = document.createElement('input');
		priceInput.type = 'number';
		priceInput.placeholder = 'Price per unit';
		priceInput.min = '1';
		priceInput.style.cssText = 'padding: 8px; margin-right: 10px; border: none; border-radius: 4px; width: 120px;';

		const addBtn = document.createElement('button');
		addBtn.textContent = 'Add';
		addBtn.style.cssText = `
			padding: 8px 16px;
			border: none;
			border-radius: 4px;
			background: #4CAF50;
			color: white;
			cursor: pointer;
		`;
		addBtn.addEventListener('click', () => {
			const itemId = itemIdInput.value.trim();
			const quantity = parseInt(quantityInput.value);
			const price = parseInt(priceInput.value);

			if (itemId && quantity > 0 && price > 0) {
				this.shopManager.addItem(myShop.id, {
					item_id: itemId,
					quantity,
					price_per_unit: price,
				});
				itemIdInput.value = '';
				quantityInput.value = '';
				priceInput.value = '';
			}
		});

		addItemForm.appendChild(itemIdInput);
		addItemForm.appendChild(quantityInput);
		addItemForm.appendChild(priceInput);
		addItemForm.appendChild(addBtn);
		content.appendChild(addItemForm);

		// Items list
		if (myShop.items && myShop.items.length > 0) {
			const itemsDiv = document.createElement('div');
			itemsDiv.innerHTML = '<h4>Your Items</h4>';

			const itemsList = document.createElement('div');
			itemsList.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

			myShop.items.forEach((item) => {
				const itemRow = this.createMyShopItemRow(item, myShop.id);
				itemsList.appendChild(itemRow);
			});

			itemsDiv.appendChild(itemsList);
			content.appendChild(itemsDiv);
		} else {
			content.innerHTML += '<p style="color: rgba(255,255,255,0.7);">No items in your shop yet.</p>';
		}
	}

	/**
	 * Render create tab
	 */
	private renderCreateTab(content: HTMLElement): void {
		const myShop = this.shopManager.getMyShop();

		if (myShop) {
			content.innerHTML = `
				<p style="color: rgba(255,255,255,0.7);">You already have a shop.</p>
				<p style="color: rgba(255,255,255,0.7);">Go to "My Shop" to manage it.</p>
			`;
			return;
		}

		const form = document.createElement('div');
		form.style.cssText = 'display: flex; flex-direction: column; gap: 15px; max-width: 500px;';

		// Shop name
		const nameLabel = document.createElement('label');
		nameLabel.textContent = 'Shop Name:';
		const nameInput = document.createElement('input');
		nameInput.type = 'text';
		nameInput.placeholder = 'Enter shop name (3-50 characters)';
		nameInput.style.cssText = 'padding: 10px; border: none; border-radius: 4px;';

		// Description
		const descLabel = document.createElement('label');
		descLabel.textContent = 'Description:';
		const descInput = document.createElement('textarea');
		descInput.placeholder = 'Enter shop description (optional, max 200 characters)';
		descInput.rows = 3;
		descInput.style.cssText = 'padding: 10px; border: none; border-radius: 4px; resize: vertical;';

		// Zone ID
		const zoneLabel = document.createElement('label');
		zoneLabel.textContent = 'Zone ID:';
		const zoneInput = document.createElement('input');
		zoneInput.type = 'text';
		zoneInput.placeholder = 'Enter zone ID';
		zoneInput.style.cssText = 'padding: 10px; border: none; border-radius: 4px;';

		// Position X
		const xLabel = document.createElement('label');
		xLabel.textContent = 'Position X:';
		const xInput = document.createElement('input');
		xInput.type = 'number';
		xInput.placeholder = 'X coordinate';
		xInput.style.cssText = 'padding: 10px; border: none; border-radius: 4px;';

		// Position Y
		const yLabel = document.createElement('label');
		yLabel.textContent = 'Position Y:';
		const yInput = document.createElement('input');
		yInput.type = 'number';
		yInput.placeholder = 'Y coordinate';
		yInput.style.cssText = 'padding: 10px; border: none; border-radius: 4px;';

		// Create button
		const createBtn = document.createElement('button');
		createBtn.textContent = 'Create Shop';
		createBtn.style.cssText = `
			padding: 12px 24px;
			border: none;
			border-radius: 6px;
			background: #4CAF50;
			color: white;
			cursor: pointer;
			font-size: 16px;
			font-weight: bold;
		`;

		createBtn.addEventListener('click', () => {
			const shopName = nameInput.value.trim();
			const description = descInput.value.trim();
			const zoneId = zoneInput.value.trim();
			const x = parseFloat(xInput.value);
			const y = parseFloat(yInput.value);

			if (shopName && zoneId && !isNaN(x) && !isNaN(y)) {
				this.shopManager.createShop({
					shop_name: shopName,
					description,
					zone_id: zoneId,
					x,
					y,
				});
			}
		});

		form.appendChild(nameLabel);
		form.appendChild(nameInput);
		form.appendChild(descLabel);
		form.appendChild(descInput);
		form.appendChild(zoneLabel);
		form.appendChild(zoneInput);
		form.appendChild(xLabel);
		form.appendChild(xInput);
		form.appendChild(yLabel);
		form.appendChild(yInput);
		form.appendChild(createBtn);

		content.appendChild(form);
	}

	/**
	 * Create shop card
	 */
	private createShopCard(shop: PlayerShop): HTMLElement {
		const card = document.createElement('div');
		card.style.cssText = `
			padding: 15px;
			background: rgba(255,255,255,0.1);
			border-radius: 8px;
			margin-bottom: 10px;
			cursor: pointer;
			transition: background 0.2s;
		`;

		card.addEventListener('mouseenter', () => {
			card.style.background = 'rgba(255,255,255,0.2)';
		});

		card.addEventListener('mouseleave', () => {
			card.style.background = 'rgba(255,255,255,0.1)';
		});

		card.addEventListener('click', async () => {
			const fullShop = await this.shopManager.getShop(shop.id);
			this.selectedShop = fullShop;
			this.render();
		});

		card.innerHTML = `
			<h4 style="margin: 0 0 5px 0;">${shop.shop_name}</h4>
			<p style="margin: 0 0 5px 0; font-size: 14px; color: rgba(255,255,255,0.8);">${shop.description}</p>
			<p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.6);">
				Owner: ${shop.owner_name} | Zone: ${shop.zone_id} | ${shop.is_open ? '🟢 Open' : '🔴 Closed'}
			</p>
		`;

		return card;
	}

	/**
	 * Create shop item row for browsing
	 */
	private createShopItemRow(item: ShopItem, shopId: number): HTMLElement {
		const row = document.createElement('div');
		row.style.cssText = `
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 10px;
			background: rgba(255,255,255,0.1);
			border-radius: 6px;
		`;

		const itemName = this.getItemName ? this.getItemName(item.item_id) : item.item_id;

		const info = document.createElement('div');
		info.innerHTML = `
			<div style="font-weight: bold;">${itemName}</div>
			<div style="font-size: 12px; color: rgba(255,255,255,0.7);">
				Stock: ${item.quantity} | Price: ${item.price_per_unit} each
			</div>
		`;

		const buyBtn = document.createElement('button');
		buyBtn.textContent = 'Buy';
		buyBtn.style.cssText = `
			padding: 6px 16px;
			border: none;
			border-radius: 4px;
			background: #4CAF50;
			color: white;
			cursor: pointer;
		`;

		buyBtn.addEventListener('click', () => {
			const quantity = prompt(`How many do you want to buy? (Max: ${item.quantity})`);
			const qty = parseInt(quantity || '0');

			if (qty > 0 && qty <= item.quantity) {
				this.shopManager.purchaseItem(shopId, {
					item_id: item.item_id,
					quantity: qty,
				});
			}
		});

		row.appendChild(info);
		row.appendChild(buyBtn);

		return row;
	}

	/**
	 * Create shop item row for my shop
	 */
	private createMyShopItemRow(item: ShopItem, shopId: number): HTMLElement {
		const row = document.createElement('div');
		row.style.cssText = `
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 10px;
			background: rgba(255,255,255,0.1);
			border-radius: 6px;
		`;

		const itemName = this.getItemName ? this.getItemName(item.item_id) : item.item_id;

		const info = document.createElement('div');
		info.innerHTML = `
			<div style="font-weight: bold;">${itemName}</div>
			<div style="font-size: 12px; color: rgba(255,255,255,0.7);">
				Stock: ${item.quantity} | Price: ${item.price_per_unit} each
			</div>
		`;

		const actions = document.createElement('div');
		actions.style.cssText = 'display: flex; gap: 10px;';

		// Update price button
		const updatePriceBtn = document.createElement('button');
		updatePriceBtn.textContent = 'Update Price';
		updatePriceBtn.style.cssText = `
			padding: 6px 12px;
			border: none;
			border-radius: 4px;
			background: #2196F3;
			color: white;
			cursor: pointer;
			font-size: 12px;
		`;

		updatePriceBtn.addEventListener('click', () => {
			const newPrice = prompt('Enter new price:', item.price_per_unit.toString());
			const price = parseInt(newPrice || '0');

			if (price > 0) {
				this.shopManager.updateItemPrice(shopId, item.item_id, price);
			}
		});

		// Remove button
		const removeBtn = document.createElement('button');
		removeBtn.textContent = 'Remove';
		removeBtn.style.cssText = `
			padding: 6px 12px;
			border: none;
			border-radius: 4px;
			background: #f44336;
			color: white;
			cursor: pointer;
			font-size: 12px;
		`;

		removeBtn.addEventListener('click', () => {
			if (confirm(`Remove ${itemName} from your shop?`)) {
				this.shopManager.removeItem(shopId, item.item_id);
			}
		});

		actions.appendChild(updatePriceBtn);
		actions.appendChild(removeBtn);

		row.appendChild(info);
		row.appendChild(actions);

		return row;
	}

	/**
	 * Show UI
	 */
	show(): void {
		this.render();
	}

	/**
	 * Hide UI
	 */
	hide(): void {
		this.container.innerHTML = '';
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.container.innerHTML = '';
	}
}
