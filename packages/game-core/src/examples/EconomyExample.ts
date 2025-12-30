/**
 * EconomyExample
 * Example of integrating crafting and trading systems
 */

import { CraftingManager } from '../economy/CraftingManager.ts';
import { TradingManager } from '../economy/TradingManager.ts';
import { CraftingUI } from '../ui/CraftingUI.ts';
import { TradingUI } from '../ui/TradingUI.ts';
import type { CraftingRecipe, TradeItem } from '../economy/index.ts';

// Mock inventory for example
const mockInventory = new Map<string, number>([
	['iron_ore', 10],
	['wood', 20],
	['leather', 5],
	['herb', 15],
	['water', 50],
	['coal', 8],
]);

let mockCurrency = 1000;

export class EconomyExample {
	private craftingManager: CraftingManager;
	private tradingManager: TradingManager;
	private craftingUI: CraftingUI;
	private tradingUI: TradingUI;

	constructor() {
		// Initialize crafting
		this.craftingManager = new CraftingManager();
		this.setupCrafting();

		// Initialize trading
		this.tradingManager = new TradingManager();
		this.setupTrading();

		// Create UIs
		this.craftingUI = new CraftingUI(this.craftingManager);
		this.tradingUI = new TradingUI(this.tradingManager);
	}

	/**
	 * Setup crafting system
	 */
	private setupCrafting(): void {
		// Set callbacks
		this.craftingManager.setInventoryCallbacks(
			// Check if player has items
			(itemId: string, quantity: number) => {
				const has = mockInventory.get(itemId) || 0;
				return has >= quantity;
			},
			// Consume items
			(items) => {
				for (const item of items) {
					const current = mockInventory.get(item.item_id) || 0;
					if (current < item.quantity) {
						return false;
					}
					mockInventory.set(item.item_id, current - item.quantity);
				}
				return true;
			},
			// Add item
			(itemId: string, quantity: number) => {
				const current = mockInventory.get(itemId) || 0;
				mockInventory.set(itemId, current + quantity);
				console.log(`[Crafting] Received ${quantity}x ${itemId}`);
				return true;
			},
		);

		this.craftingManager.setCurrencyCallbacks(
			// Check currency
			(amount: number) => {
				return mockCurrency >= amount;
			},
			// Consume currency
			(amount: number) => {
				if (mockCurrency < amount) return false;
				mockCurrency -= amount;
				console.log(`[Crafting] Spent ${amount} currency (remaining: ${mockCurrency})`);
				return true;
			},
		);

		this.craftingManager.setJobCallbacks(
			// Check job level
			(jobId: string, level: number) => {
				// For example, assume player has blacksmith level 5
				if (jobId === 'blacksmith') return level <= 5;
				return false;
			},
			// Check skill
			(skillId: string) => {
				// For example, assume player has basic skills
				return ['basic_smithing', 'basic_crafting'].includes(skillId);
			},
			// Add experience
			(jobId: string, exp: number) => {
				console.log(`[Crafting] Gained ${exp} EXP in ${jobId}`);
			},
		);

		// Load recipes
		this.loadCraftingRecipes();

		// Listen to events
		this.craftingManager.on('craft-completed', (result) => {
			if (result.success) {
				console.log(`[Crafting] Successfully crafted ${result.result_quantity}x ${result.result_item_id}`);
				console.log(`[Crafting] Gained ${result.experience_gained} EXP`);
			} else {
				console.error(`[Crafting] Failed: ${result.error}`);
			}
		});
	}

	/**
	 * Load crafting recipes
	 */
	private loadCraftingRecipes(): void {
		// Load from JSON (in real app, fetch from server)
		const recipes: CraftingRecipe[] = [
			{
				id: 'iron_sword',
				name: 'Iron Sword',
				category: 'weapon',
				result_item_id: 'iron_sword',
				result_quantity: 1,
				required_job: 'blacksmith',
				required_job_level: 1,
				crafting_time: 5000,
				materials: [
					{ item_id: 'iron_ore', quantity: 3 },
					{ item_id: 'wood', quantity: 1 },
				],
				currency_cost: 50,
				experience_gained: 100,
				success_rate: 95,
				skill_required: null,
			},
			{
				id: 'health_potion',
				name: 'Health Potion',
				category: 'consumable',
				result_item_id: 'health_potion',
				result_quantity: 3,
				required_job: null,
				required_job_level: 0,
				crafting_time: 2000,
				materials: [
					{ item_id: 'herb', quantity: 2 },
					{ item_id: 'water', quantity: 1 },
				],
				currency_cost: 10,
				experience_gained: 25,
				success_rate: 100,
				skill_required: null,
			},
		];

		this.craftingManager.loadRecipes(recipes);
	}

	/**
	 * Setup trading system
	 */
	private setupTrading(): void {
		// Set callbacks
		this.tradingManager.setInventoryCallbacks(
			// Check inventory
			(items: TradeItem[]) => {
				for (const item of items) {
					const has = mockInventory.get(item.item_id) || 0;
					if (has < item.quantity) {
						return false;
					}
				}
				return true;
			},
			// Remove items
			(items: TradeItem[]) => {
				for (const item of items) {
					const current = mockInventory.get(item.item_id) || 0;
					if (current < item.quantity) {
						return false;
					}
					mockInventory.set(item.item_id, current - item.quantity);
				}
				console.log('[Trading] Removed items:', items);
				return true;
			},
			// Add items
			(items: TradeItem[]) => {
				for (const item of items) {
					const current = mockInventory.get(item.item_id) || 0;
					mockInventory.set(item.item_id, current + item.quantity);
				}
				console.log('[Trading] Received items:', items);
				return true;
			},
		);

		this.tradingManager.setCurrencyCallbacks(
			// Check currency
			(amount: number) => {
				return mockCurrency >= amount;
			},
			// Remove currency
			(amount: number) => {
				if (mockCurrency < amount) return false;
				mockCurrency -= amount;
				console.log(`[Trading] Sent ${amount} currency`);
				return true;
			},
			// Add currency
			(amount: number) => {
				mockCurrency += amount;
				console.log(`[Trading] Received ${amount} currency`);
				return true;
			},
		);

		// Set network callback (mock)
		this.tradingManager.setNetworkCallback((targetPlayerId: string, message: any) => {
			console.log('[Trading] Send to peer:', targetPlayerId, message);
			// In real app, this would send via WebRTC
		});

		// Set validation callback (mock server validation)
		this.tradingManager.setValidationCallback(async (trade) => {
			console.log('[Trading] Server validation:', trade);
			// In real app, this would call server API
			return true;
		});

		// Listen to events
		this.tradingManager.on('trade-request-received', (fromPlayerId, fromPlayerName, tradeId) => {
			console.log(`[Trading] Trade request from ${fromPlayerName}`);
			// Auto-accept for example
			setTimeout(() => {
				this.tradingManager.acceptTradeRequest(tradeId, 'player1', 'TestPlayer');
			}, 1000);
		});

		this.tradingManager.on('trade-completed', (trade) => {
			console.log('[Trading] Trade completed!', trade);
		});
	}

	/**
	 * Open crafting window
	 */
	openCrafting(): void {
		this.craftingUI.show();
	}

	/**
	 * Open trading window
	 */
	openTrading(partnerName: string): void {
		this.tradingUI.show(partnerName);
	}

	/**
	 * Simulate crafting
	 */
	async simulateCrafting(): Promise<void> {
		console.log('\n=== Crafting Simulation ===');
		console.log('Starting inventory:', Object.fromEntries(mockInventory));
		console.log('Currency:', mockCurrency);

		// Try to craft iron sword
		console.log('\n1. Attempting to craft Iron Sword...');
		const canCraft = this.craftingManager.canCraft('iron_sword');
		console.log('Can craft:', canCraft);

		if (canCraft.canCraft) {
			const result = this.craftingManager.startCrafting('iron_sword');
			console.log('Craft started:', result);

			// Wait for completion
			await new Promise((resolve) => {
				this.craftingManager.once('craft-completed', resolve);
			});
		}

		console.log('\nFinal inventory:', Object.fromEntries(mockInventory));
		console.log('Final currency:', mockCurrency);
	}

	/**
	 * Simulate trading
	 */
	async simulateTrading(): Promise<void> {
		console.log('\n=== Trading Simulation ===');
		console.log('Starting inventory:', Object.fromEntries(mockInventory));
		console.log('Currency:', mockCurrency);

		// Request trade
		console.log('\n1. Requesting trade with Partner...');
		const tradeRequest = this.tradingManager.requestTrade('partner1', 'Partner', 'player1', 'TestPlayer');
		console.log('Trade request:', tradeRequest);

		if (!tradeRequest.success) return;

		// Wait for acceptance (simulated)
		await new Promise((resolve) => setTimeout(resolve, 1500));

		// Add items to trade
		console.log('\n2. Adding items to trade...');
		this.tradingManager.addItem('iron_ore', 5);
		this.tradingManager.setCurrency(100);

		// Simulate partner adding items
		console.log('\n3. Partner adds items...');
		this.tradingManager.handleTradeUpdate({
			trade_id: tradeRequest.tradeId!,
			items: [{ item_id: 'wood', quantity: 10 }],
			currency: 50,
			confirmed: false,
		});

		// Confirm trade
		console.log('\n4. Confirming trade...');
		this.tradingManager.confirmTrade();

		// Simulate partner confirming
		this.tradingManager.handleTradeUpdate({
			trade_id: tradeRequest.tradeId!,
			items: [{ item_id: 'wood', quantity: 10 }],
			currency: 50,
			confirmed: true,
		});

		// Wait for completion
		await new Promise((resolve) => {
			this.tradingManager.once('trade-completed', resolve);
		});

		console.log('\nFinal inventory:', Object.fromEntries(mockInventory));
		console.log('Final currency:', mockCurrency);
	}

	/**
	 * Run all examples
	 */
	async runExamples(): Promise<void> {
		await this.simulateCrafting();
		await new Promise((resolve) => setTimeout(resolve, 1000));
		await this.simulateTrading();
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.craftingManager.destroy();
		this.tradingManager.destroy();
		this.craftingUI.destroy();
		this.tradingUI.destroy();
	}
}

// Usage:
// const economy = new EconomyExample();
// economy.openCrafting();  // Open crafting UI
// economy.openTrading('PlayerName');  // Open trading UI
// await economy.runExamples();  // Run console simulations
