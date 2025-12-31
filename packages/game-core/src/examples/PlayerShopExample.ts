/**
 * PlayerShopExample
 * Example usage of player shop system
 */

import { PlayerShopManager } from '../economy/PlayerShopManager';
import { PlayerShopUI } from '../ui/PlayerShopUI';

export class PlayerShopExample {
	private shopManager: PlayerShopManager;
	private shopUI: PlayerShopUI | null = null;

	// Mock inventory
	private inventory: Map<string, number> = new Map([
		['iron_sword', 5],
		['health_potion', 10],
		['iron_ore', 20],
	]);

	// Mock currency
	private currency: number = 5000;

	constructor() {
		this.shopManager = new PlayerShopManager('http://localhost:3000', 'player123', 'TestPlayer');

		// Set callbacks
		this.setupCallbacks();

		// Setup event listeners
		this.setupEventListeners();

		console.log('[PlayerShopExample] Initialized');
	}

	/**
	 * Setup callbacks
	 */
	private setupCallbacks(): void {
		// Inventory callbacks
		this.shopManager.setInventoryCallbacks(
			(itemId, quantity) => {
				const available = this.inventory.get(itemId) || 0;
				return available >= quantity;
			},
			(itemId, quantity) => {
				const available = this.inventory.get(itemId) || 0;
				if (available >= quantity) {
					this.inventory.set(itemId, available - quantity);
					console.log(`[Inventory] Consumed ${quantity}x ${itemId} (remaining: ${this.inventory.get(itemId)})`);
					return true;
				}
				return false;
			},
			(itemId, quantity) => {
				const current = this.inventory.get(itemId) || 0;
				this.inventory.set(itemId, current + quantity);
				console.log(`[Inventory] Added ${quantity}x ${itemId} (total: ${this.inventory.get(itemId)})`);
			},
		);

		// Currency callbacks
		this.shopManager.setCurrencyCallbacks(
			(amount) => this.currency >= amount,
			(amount) => {
				if (this.currency >= amount) {
					this.currency -= amount;
					console.log(`[Currency] Spent ${amount} (remaining: ${this.currency})`);
					return true;
				}
				return false;
			},
			(amount) => {
				this.currency += amount;
				console.log(`[Currency] Earned ${amount} (total: ${this.currency})`);
			},
		);
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		this.shopManager.on('shop-created', (shopId) => {
			console.log(`[Event] Shop created with ID: ${shopId}`);
		});

		this.shopManager.on('shop-updated', () => {
			console.log('[Event] Shop updated');
		});

		this.shopManager.on('shop-deleted', () => {
			console.log('[Event] Shop deleted');
		});

		this.shopManager.on('item-added', (itemId, quantity) => {
			console.log(`[Event] Item added: ${itemId} x${quantity}`);
		});

		this.shopManager.on('item-removed', (itemId) => {
			console.log(`[Event] Item removed: ${itemId}`);
		});

		this.shopManager.on('item-purchased', (shopId, itemId, quantity, totalCost) => {
			console.log(`[Event] Purchased ${itemId} x${quantity} from shop ${shopId} for ${totalCost}`);
		});

		this.shopManager.on('shops-found', (shops) => {
			console.log(`[Event] Found ${shops.length} shops`);
		});

		this.shopManager.on('error', (message) => {
			console.error(`[Event] Error: ${message}`);
		});
	}

	/**
	 * Example 1: Create a shop
	 */
	async exampleCreateShop(): Promise<void> {
		console.log('\n=== Example 1: Create Shop ===');

		const result = await this.shopManager.createShop({
			shop_name: "TestPlayer's Shop",
			description: 'Best deals in town!',
			zone_id: 'capital_city',
			x: 100,
			y: 200,
		});

		if (result.success) {
			console.log(`✓ Shop created with ID: ${result.shopId}`);
		} else {
			console.error(`✗ Failed to create shop: ${result.error}`);
		}
	}

	/**
	 * Example 2: Add items to shop
	 */
	async exampleAddItems(): Promise<void> {
		console.log('\n=== Example 2: Add Items to Shop ===');

		const myShop = await this.shopManager.fetchMyShop();

		if (!myShop) {
			console.error('✗ You need to create a shop first');
			return;
		}

		// Add iron sword
		const result1 = await this.shopManager.addItem(myShop.id, {
			item_id: 'iron_sword',
			quantity: 2,
			price_per_unit: 500,
		});

		if (result1.success) {
			console.log('✓ Added 2x iron_sword at 500 each');
		}

		// Add health potion
		const result2 = await this.shopManager.addItem(myShop.id, {
			item_id: 'health_potion',
			quantity: 5,
			price_per_unit: 50,
		});

		if (result2.success) {
			console.log('✓ Added 5x health_potion at 50 each');
		}

		// Refresh shop to see items
		await this.shopManager.fetchMyShop();
		const updatedShop = this.shopManager.getMyShop();
		console.log('Current shop items:', updatedShop?.items);
	}

	/**
	 * Example 3: Update shop settings
	 */
	async exampleUpdateShop(): Promise<void> {
		console.log('\n=== Example 3: Update Shop Settings ===');

		const myShop = this.shopManager.getMyShop();

		if (!myShop) {
			console.error('✗ You need to create a shop first');
			return;
		}

		// Close shop
		const result1 = await this.shopManager.updateShop(myShop.id, {
			is_open: false,
		});

		if (result1.success) {
			console.log('✓ Shop closed');
		}

		// Reopen shop
		const result2 = await this.shopManager.updateShop(myShop.id, {
			is_open: true,
		});

		if (result2.success) {
			console.log('✓ Shop reopened');
		}

		// Update description
		const result3 = await this.shopManager.updateShop(myShop.id, {
			description: 'New and improved deals!',
		});

		if (result3.success) {
			console.log('✓ Description updated');
		}
	}

	/**
	 * Example 4: Search and browse shops
	 */
	async exampleSearchShops(): Promise<void> {
		console.log('\n=== Example 4: Search Shops ===');

		// Search shops in capital city
		const shops1 = await this.shopManager.searchShops({
			zone_id: 'capital_city',
			is_open: true,
			limit: 10,
		});

		console.log(`Found ${shops1.length} shops in capital_city`);
		shops1.forEach((shop) => {
			console.log(`- ${shop.shop_name} (Owner: ${shop.owner_name})`);
		});

		// Search shops by name
		const shops2 = await this.shopManager.searchShops({
			search_name: 'Test',
			limit: 5,
		});

		console.log(`\nFound ${shops2.length} shops matching "Test"`);

		// Search shops selling specific item
		const shops3 = await this.shopManager.searchShops({
			item_id: 'iron_sword',
			limit: 10,
		});

		console.log(`\nFound ${shops3.length} shops selling iron_sword`);
	}

	/**
	 * Example 5: Purchase from shop
	 */
	async examplePurchase(): Promise<void> {
		console.log('\n=== Example 5: Purchase from Shop ===');

		// Search for shops
		const shops = await this.shopManager.searchShops({
			item_id: 'health_potion',
			is_open: true,
			limit: 1,
		});

		if (shops.length === 0) {
			console.log('No shops found selling health_potion');
			return;
		}

		const shop = shops[0];
		console.log(`Found shop: ${shop.shop_name}`);

		// Get full shop details
		const fullShop = await this.shopManager.getShop(shop.id);

		if (!fullShop || !fullShop.items) {
			console.log('Shop has no items');
			return;
		}

		const healthPotion = fullShop.items.find((item) => item.item_id === 'health_potion');

		if (!healthPotion) {
			console.log('Shop does not have health_potion');
			return;
		}

		console.log(`health_potion: ${healthPotion.quantity} in stock at ${healthPotion.price_per_unit} each`);

		// Purchase 2 potions
		const result = await this.shopManager.purchaseItem(shop.id, {
			item_id: 'health_potion',
			quantity: 2,
		});

		if (result.success) {
			console.log(`✓ Purchased 2x health_potion for ${result.totalCost} total`);
			console.log(`Currency remaining: ${this.currency}`);
			console.log(`Inventory:`, Array.from(this.inventory.entries()));
		} else {
			console.error(`✗ Failed to purchase: ${result.error}`);
		}
	}

	/**
	 * Example 6: Manage shop items
	 */
	async exampleManageItems(): Promise<void> {
		console.log('\n=== Example 6: Manage Shop Items ===');

		const myShop = this.shopManager.getMyShop();

		if (!myShop) {
			console.error('✗ You need to create a shop first');
			return;
		}

		// Update item price
		const result1 = await this.shopManager.updateItemPrice(myShop.id, 'iron_sword', 600);

		if (result1.success) {
			console.log('✓ Updated iron_sword price to 600');
		}

		// Remove item from shop
		const result2 = await this.shopManager.removeItem(myShop.id, 'health_potion');

		if (result2.success) {
			console.log('✓ Removed health_potion from shop');
			console.log('Items returned to inventory');
		}
	}

	/**
	 * Example 7: View statistics
	 */
	async exampleStatistics(): Promise<void> {
		console.log('\n=== Example 7: Shop Statistics ===');

		const myShop = this.shopManager.getMyShop();

		if (!myShop) {
			console.error('✗ You need to create a shop first');
			return;
		}

		const stats = await this.shopManager.getStatistics(myShop.id);

		if (stats) {
			console.log('Shop Statistics:');
			console.log(`- Total Sales: ${stats.totalSales}`);
			console.log(`- Total Revenue: ${stats.totalRevenue}`);
			console.log(`- Unique Customers: ${stats.uniqueCustomers}`);
		}

		// Get transaction history
		const transactions = await this.shopManager.getTransactionHistory(myShop.id, 10);

		console.log(`\nRecent Transactions (${transactions.length}):`);
		transactions.forEach((tx) => {
			console.log(`- ${tx.buyer_name} bought ${tx.quantity}x ${tx.item_id} for ${tx.total_cost}`);
		});
	}

	/**
	 * Example 8: UI Integration
	 */
	exampleUI(): void {
		console.log('\n=== Example 8: UI Integration ===');

		// Create UI container
		const container = document.createElement('div');
		container.id = 'player-shop-container';
		container.style.cssText = `
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			z-index: 1000;
		`;
		document.body.appendChild(container);

		// Create UI
		this.shopUI = new PlayerShopUI(container, this.shopManager);

		// Set item name resolver
		this.shopUI.setItemNameResolver((itemId) => {
			const names: Record<string, string> = {
				iron_sword: 'Iron Sword',
				health_potion: 'Health Potion',
				iron_ore: 'Iron Ore',
			};
			return names[itemId] || itemId;
		});

		// Show UI
		this.shopUI.show();

		console.log('✓ Player shop UI opened');
		console.log('You can now:');
		console.log('- Browse nearby shops');
		console.log('- Manage your shop');
		console.log('- Create a new shop');
	}

	/**
	 * Run all examples
	 */
	async runAllExamples(): Promise<void> {
		console.log('=== Running All Player Shop Examples ===\n');

		// Run examples in sequence
		await this.exampleCreateShop();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.exampleAddItems();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.exampleUpdateShop();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.exampleSearchShops();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.exampleManageItems();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.exampleStatistics();
		await new Promise((resolve) => setTimeout(resolve, 500));

		// UI example (runs independently)
		// this.exampleUI();

		console.log('\n=== All Examples Complete ===');
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		if (this.shopUI) {
			this.shopUI.destroy();
			this.shopUI = null;
		}

		this.shopManager.destroy();

		const container = document.getElementById('player-shop-container');
		if (container) {
			container.remove();
		}
	}
}

// Usage:
// const example = new PlayerShopExample();
// await example.runAllExamples();
// example.exampleUI();
