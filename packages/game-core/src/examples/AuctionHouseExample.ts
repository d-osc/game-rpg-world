/**
 * AuctionHouseExample
 * Example of integrating auction house system
 */

import { AuctionHouseClient } from '../economy/AuctionHouseClient.ts';
import { AuctionHouseUI } from '../ui/AuctionHouseUI.ts';
import type { AuctionOrder } from '../economy/AuctionHouseClient.ts';

export class AuctionHouseExample {
	private auctionClient: AuctionHouseClient;
	private auctionUI: AuctionHouseUI;

	constructor(apiUrl: string = 'http://localhost:3000/api', playerId: string = 'player1', playerName: string = 'TestPlayer') {
		// Initialize client
		this.auctionClient = new AuctionHouseClient(apiUrl, playerId, playerName);

		// Set auth token (in real app, get from login)
		// this.auctionClient.setAuthToken('your-jwt-token');

		// Initialize UI
		this.auctionUI = new AuctionHouseUI(this.auctionClient);

		// Listen to events
		this.setupEventListeners();
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		this.auctionClient.on('order-created', (orderId) => {
			console.log(`[AuctionHouse] Order created with ID: ${orderId}`);
		});

		this.auctionClient.on('order-bought', (order) => {
			console.log(`[AuctionHouse] Successfully bought:`, order);
		});

		this.auctionClient.on('order-cancelled', (orderId) => {
			console.log(`[AuctionHouse] Order cancelled: ${orderId}`);
		});

		this.auctionClient.on('search-results', (orders) => {
			console.log(`[AuctionHouse] Found ${orders.length} orders`);
		});

		this.auctionClient.on('error', (message) => {
			console.error(`[AuctionHouse] Error: ${message}`);
		});
	}

	/**
	 * Open auction house UI
	 */
	openAuctionHouse(): void {
		this.auctionUI.show();
	}

	/**
	 * Close auction house UI
	 */
	closeAuctionHouse(): void {
		this.auctionUI.hide();
	}

	/**
	 * Example: Create an order programmatically
	 */
	async createOrderExample(): Promise<void> {
		console.log('\n=== Creating Order Example ===');

		const result = await this.auctionClient.createOrder({
			item_id: 'iron_sword',
			quantity: 1,
			price_per_unit: 500,
		});

		console.log('Create order result:', result);

		if (result.success) {
			console.log(`Order created with ID: ${result.orderId}`);
		} else {
			console.error(`Failed to create order: ${result.error}`);
		}
	}

	/**
	 * Example: Search for orders
	 */
	async searchExample(): Promise<void> {
		console.log('\n=== Searching Orders Example ===');

		// Search for specific item
		console.log('1. Searching for iron_sword...');
		const ironSwords = await this.auctionClient.searchOrders({
			item_id: 'iron_sword',
			sort_by: 'price_asc',
		});
		console.log(`Found ${ironSwords.length} iron sword orders`);
		if (ironSwords.length > 0) {
			console.log('Cheapest:', ironSwords[0]);
		}

		// Search by price range
		console.log('\n2. Searching for items between 100-1000 gold...');
		const affordableItems = await this.auctionClient.searchOrders({
			min_price: 100,
			max_price: 1000,
			sort_by: 'price_asc',
			limit: 10,
		});
		console.log(`Found ${affordableItems.length} affordable items`);

		// Get all orders sorted by newest
		console.log('\n3. Getting newest orders...');
		const newestOrders = await this.auctionClient.searchOrders({
			sort_by: 'date_desc',
			limit: 20,
		});
		console.log(`Found ${newestOrders.length} orders`);
	}

	/**
	 * Example: Get my orders
	 */
	async getMyOrdersExample(): Promise<void> {
		console.log('\n=== My Orders Example ===');

		const myOrders = await this.auctionClient.getMyOrders(false);
		console.log(`You have ${myOrders.length} active orders`);

		if (myOrders.length > 0) {
			console.log('Your orders:');
			myOrders.forEach((order) => {
				console.log(
					`  - ${order.item_id} x${order.quantity} @ ${order.price_per_unit} gold each (Total: ${order.total_price})`,
				);
			});
		}

		// Include inactive orders
		const allOrders = await this.auctionClient.getMyOrders(true);
		console.log(`Total orders (including inactive): ${allOrders.length}`);
	}

	/**
	 * Example: Buy order
	 */
	async buyOrderExample(orderId: number): Promise<void> {
		console.log(`\n=== Buying Order ${orderId} ===`);

		// Get order details first
		const order = await this.auctionClient.getOrder(orderId);
		if (!order) {
			console.error('Order not found');
			return;
		}

		console.log('Order details:');
		console.log(`  Item: ${order.item_id} x${order.quantity}`);
		console.log(`  Price: ${order.total_price} gold`);
		console.log(`  Seller: ${order.seller_name}`);

		// Buy it
		const result = await this.auctionClient.buyOrder(orderId);

		if (result.success) {
			console.log('Successfully purchased!');
		} else {
			console.error(`Failed to buy: ${result.error}`);
		}
	}

	/**
	 * Example: Cancel order
	 */
	async cancelOrderExample(orderId: number): Promise<void> {
		console.log(`\n=== Cancelling Order ${orderId} ===`);

		const result = await this.auctionClient.cancelOrder(orderId);

		if (result.success) {
			console.log('Order cancelled successfully');
		} else {
			console.error(`Failed to cancel: ${result.error}`);
		}
	}

	/**
	 * Example: Get statistics
	 */
	async getStatisticsExample(): Promise<void> {
		console.log('\n=== Statistics Example ===');

		const stats = await this.auctionClient.getStatistics();

		if (stats) {
			console.log('Your Auction House Statistics:');
			console.log(`  Total Sold: ${stats.totalSold} items`);
			console.log(`  Total Bought: ${stats.totalBought} items`);
			console.log(`  Total Revenue: ${stats.totalRevenue} gold`);
			console.log(`  Total Spent: ${stats.totalSpent} gold`);
			console.log(`  Active Orders: ${stats.activeOrders}`);
			console.log(`  Net Profit: ${stats.totalRevenue - stats.totalSpent} gold`);
		}
	}

	/**
	 * Example: Get transaction history
	 */
	async getTransactionHistoryExample(): Promise<void> {
		console.log('\n=== Transaction History Example ===');

		const transactions = await this.auctionClient.getTransactionHistory(10, 0);

		console.log(`Found ${transactions.length} recent transactions`);

		if (transactions.length > 0) {
			console.log('Recent transactions:');
			transactions.slice(0, 5).forEach((tx: any) => {
				const date = new Date(tx.timestamp).toLocaleString();
				console.log(
					`  [${date}] ${tx.item_id} x${tx.quantity} @ ${tx.total_price} gold (Fee: ${tx.auction_fee})`,
				);
			});
		}
	}

	/**
	 * Example: Get item price history
	 */
	async getItemPriceHistoryExample(itemId: string): Promise<void> {
		console.log(`\n=== Price History for ${itemId} ===`);

		const priceHistory = await this.auctionClient.getItemPriceHistory(itemId, 7);

		console.log(`Price data (last 7 days):`);
		console.log(`  Average Price: ${priceHistory.avgPrice} gold`);
		console.log(`  Min Price: ${priceHistory.minPrice} gold`);
		console.log(`  Max Price: ${priceHistory.maxPrice} gold`);

		if (priceHistory.avgPrice > 0) {
			console.log(`\nPricing suggestion:`);
			console.log(`  Competitive: ${Math.floor(priceHistory.avgPrice * 0.95)} gold`);
			console.log(`  Market price: ${priceHistory.avgPrice} gold`);
			console.log(`  Premium: ${Math.floor(priceHistory.avgPrice * 1.1)} gold`);
		}
	}

	/**
	 * Run all examples
	 */
	async runAllExamples(): Promise<void> {
		console.log('='.repeat(50));
		console.log('AUCTION HOUSE EXAMPLES');
		console.log('='.repeat(50));

		await this.createOrderExample();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.searchExample();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.getMyOrdersExample();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.getStatisticsExample();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.getTransactionHistoryExample();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.getItemPriceHistoryExample('iron_sword');

		console.log('\n' + '='.repeat(50));
		console.log('EXAMPLES COMPLETED');
		console.log('='.repeat(50));
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.auctionClient.destroy();
		this.auctionUI.destroy();
	}
}

// Usage:
// const auctionHouse = new AuctionHouseExample();
// auctionHouse.openAuctionHouse();  // Open UI
// await auctionHouse.runAllExamples();  // Run console examples
