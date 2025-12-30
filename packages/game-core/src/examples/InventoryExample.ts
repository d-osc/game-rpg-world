/**
 * Inventory Example
 * Example of how to use the inventory system with UI and server validation
 */

import { InventoryManager, EquipmentManager } from '../inventory/index.ts';
import { InventoryUI } from '../ui/InventoryUI.ts';
import type { Item } from '../inventory/InventoryManager.ts';

export class InventoryExample {
	private inventoryManager: InventoryManager;
	private equipmentManager: EquipmentManager;
	private ui: InventoryUI;

	// Server validation callback (should connect to InventoryService)
	private serverValidationUrl: string;
	private playerId: string;

	constructor(playerId: string, serverUrl: string = 'http://localhost:3000') {
		this.playerId = playerId;
		this.serverValidationUrl = serverUrl;

		// Create managers
		this.inventoryManager = new InventoryManager({
			maxSlots: 100,
			maxWeight: 500,
		});

		this.equipmentManager = new EquipmentManager();

		// Create UI
		this.ui = new InventoryUI({
			container: document.body,
			inventoryManager: this.inventoryManager,
			equipmentManager: this.equipmentManager,
			onItemUse: (item) => this.handleItemUse(item),
			onItemDrop: (item, quantity) => this.handleItemDrop(item, quantity),
		});

		// Setup server sync
		this.setupServerSync();
	}

	/**
	 * Setup server synchronization
	 */
	private setupServerSync(): void {
		// When item is added locally, validate with server
		this.inventoryManager.on('item-added', async (item, quantity) => {
			const valid = await this.validateWithServer('add', item, quantity);
			if (!valid) {
				// Rollback if server rejects
				this.inventoryManager.removeItem(item.id, quantity);
				console.error('[InventoryExample] Server rejected item add');
			}
		});

		// When item is removed locally, sync with server
		this.inventoryManager.on('item-removed', async (item, quantity) => {
			await this.validateWithServer('remove', item, quantity);
		});

		// When item is moved, sync with server
		this.inventoryManager.on('item-moved', async (fromSlot, toSlot) => {
			await this.syncMoveWithServer(fromSlot, toSlot);
		});

		// When item is equipped, validate with server
		this.equipmentManager.on('item-equipped', async (slot, item) => {
			const valid = await this.validateWithServer('equip', item, 1);
			if (!valid) {
				// Rollback if server rejects
				this.equipmentManager.unequip(slot);
				console.error('[InventoryExample] Server rejected equip');
			}
		});

		// When item is unequipped, sync with server
		this.equipmentManager.on('item-unequipped', async (slot, item) => {
			await this.validateWithServer('unequip', item, 1);
		});
	}

	/**
	 * Validate action with server
	 */
	private async validateWithServer(action: string, item: Item, quantity: number): Promise<boolean> {
		try {
			const response = await fetch(`${this.serverValidationUrl}/api/inventory/${action}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.getAuthToken()}`,
				},
				body: JSON.stringify({
					player_id: this.playerId,
					item_id: item.id,
					quantity,
					item_weight: item.weight,
					is_stackable: item.stackable,
					max_stack: item.maxStack,
				}),
			});

			const result = await response.json();

			if (!result.valid) {
				console.error('[InventoryExample] Server validation failed:', result.error);
				alert(`Inventory Error: ${result.error}`);
				return false;
			}

			return true;
		} catch (error) {
			console.error('[InventoryExample] Server validation error:', error);
			// In case of network error, allow locally but log
			return true;
		}
	}

	/**
	 * Sync move action with server
	 */
	private async syncMoveWithServer(fromSlot: number, toSlot: number): Promise<void> {
		try {
			await fetch(`${this.serverValidationUrl}/api/inventory/move`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.getAuthToken()}`,
				},
				body: JSON.stringify({
					player_id: this.playerId,
					from_slot: fromSlot,
					to_slot: toSlot,
				}),
			});
		} catch (error) {
			console.error('[InventoryExample] Failed to sync move:', error);
		}
	}

	/**
	 * Handle item use
	 */
	private handleItemUse(item: Item): void {
		console.log('[InventoryExample] Using item:', item.name);

		// Example: Apply consumable effects
		if (item.type === 'consumable') {
			// TODO: Apply effects (heal HP, restore MP, etc.)
			console.log(`Used ${item.name}`);
		}
	}

	/**
	 * Handle item drop
	 */
	private handleItemDrop(item: Item, quantity: number): void {
		console.log('[InventoryExample] Dropping item:', item.name, 'x', quantity);

		// TODO: Drop item in world
		// This should create an item entity on the ground
	}

	/**
	 * Get auth token (placeholder)
	 */
	private getAuthToken(): string {
		// TODO: Get from auth service
		return localStorage.getItem('auth_token') || '';
	}

	/**
	 * Load inventory from server
	 */
	async loadFromServer(): Promise<void> {
		try {
			const response = await fetch(`${this.serverValidationUrl}/api/inventory/get`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${this.getAuthToken()}`,
				},
			});

			const items = await response.json();

			// Clear local inventory
			this.inventoryManager.clear();

			// Import server inventory
			const inventoryData = {
				slots: items.map((item: any) => ({
					slotIndex: item.slot_index,
					item: this.parseServerItem(item),
					quantity: item.quantity,
				})),
			};

			this.inventoryManager.import(inventoryData);
		} catch (error) {
			console.error('[InventoryExample] Failed to load inventory:', error);
		}
	}

	/**
	 * Parse server item to client format
	 */
	private parseServerItem(serverItem: any): Item {
		// TODO: Load from item database
		// This is a placeholder - should load from JSON database
		return {
			id: serverItem.item_id,
			name: serverItem.item_id,
			description: '',
			type: 'material',
			rarity: 'common',
			value: 0,
			weight: 1,
			stackable: true,
			maxStack: 99,
		};
	}

	/**
	 * Show inventory UI
	 */
	show(): void {
		this.ui.show();
	}

	/**
	 * Hide inventory UI
	 */
	hide(): void {
		this.ui.hide();
	}

	/**
	 * Toggle inventory UI
	 */
	toggle(): void {
		this.ui.toggle();
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.ui.destroy();
	}
}

/**
 * Usage Example:
 *
 * ```typescript
 * import { InventoryExample } from '@rpg/game-core';
 *
 * // Create inventory system
 * const inventory = new InventoryExample('player-123', 'http://localhost:3000');
 *
 * // Load from server
 * await inventory.loadFromServer();
 *
 * // Show UI (press 'I' key)
 * document.addEventListener('keydown', (e) => {
 *   if (e.key === 'i' || e.key === 'I') {
 *     inventory.toggle();
 *   }
 * });
 *
 * // Add item example
 * const sword: Item = {
 *   id: 'iron_sword',
 *   name: 'Iron Sword',
 *   description: 'A sturdy iron sword',
 *   type: 'weapon',
 *   rarity: 'common',
 *   value: 50,
 *   weight: 3.5,
 *   stackable: false,
 *   maxStack: 1,
 *   equipSlot: 'weapon',
 *   stats: {
 *     atk: 15,
 *     def: 0,
 *     spd: -2,
 *   },
 * };
 *
 * // Server will validate this
 * inventory.inventoryManager.addItem(sword);
 * ```
 */
