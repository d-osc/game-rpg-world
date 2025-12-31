/**
 * InventoryManager
 * Manages player inventory with slot and weight limits
 */

import { EventEmitter } from '../utils/EventEmitter.ts';

export interface Item {
	id: string;
	name: string;
	description: string;
	type: 'weapon' | 'armor' | 'accessory' | 'consumable' | 'material' | 'quest';
	rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
	weight: number;
	stackable: boolean;
	maxStack: number;
	value: number; // Gold value
	icon?: string;
	// Type-specific properties
	equipSlot?: 'weapon' | 'head' | 'body' | 'legs' | 'hands' | 'feet' | 'accessory1' | 'accessory2';
	stats?: {
		hp?: number;
		mp?: number;
		atk?: number;
		def?: number;
		spd?: number;
		luck?: number;
	};
	effects?: {
		type: string;
		value: number;
	}[];
}

export interface InventorySlot {
	item: Item | null;
	quantity: number;
}

export interface InventoryLimits {
	maxSlots: number;
	maxWeight: number;
}

export interface InventoryEvents {
	'item-added': (item: Item, quantity: number) => void;
	'item-removed': (item: Item, quantity: number) => void;
	'item-used': (item: Item) => void;
	'inventory-full': () => void;
	'weight-exceeded': () => void;
}

export class InventoryManager extends EventEmitter<InventoryEvents> {
	private slots: InventorySlot[] = [];
	private limits: InventoryLimits;
	private currentWeight: number = 0;

	constructor(limits: InventoryLimits = { maxSlots: 100, maxWeight: 500 }) {
		super();
		this.limits = limits;

		// Initialize empty slots
		for (let i = 0; i < limits.maxSlots; i++) {
			this.slots.push({ item: null, quantity: 0 });
		}
	}

	/**
	 * Add item to inventory
	 */
	addItem(item: Item, quantity: number = 1): boolean {
		if (quantity <= 0) return false;

		// Check weight limit
		const totalWeight = item.weight * quantity;
		if (this.currentWeight + totalWeight > this.limits.maxWeight) {
			this.emit('weight-exceeded');
			return false;
		}

		// If stackable, try to add to existing stack
		if (item.stackable) {
			const existingSlot = this.findItemSlot(item.id);
			if (existingSlot) {
				const canAdd = Math.min(
					quantity,
					item.maxStack - existingSlot.quantity,
				);
				if (canAdd > 0) {
					existingSlot.quantity += canAdd;
					this.currentWeight += item.weight * canAdd;
					this.emit('item-added', item, canAdd);

					// If there's remaining quantity, try to add to new slot
					if (canAdd < quantity) {
						return this.addItem(item, quantity - canAdd);
					}
					return true;
				}
			}
		}

		// Find empty slot
		const emptySlot = this.findEmptySlot();
		if (!emptySlot) {
			this.emit('inventory-full');
			return false;
		}

		// Add to new slot
		const canAdd = item.stackable ? Math.min(quantity, item.maxStack) : 1;
		emptySlot.item = item;
		emptySlot.quantity = canAdd;
		this.currentWeight += item.weight * canAdd;
		this.emit('item-added', item, canAdd);

		// If there's remaining quantity, try to add to new slot
		if (canAdd < quantity) {
			return this.addItem(item, quantity - canAdd);
		}

		return true;
	}

	/**
	 * Remove item from inventory
	 */
	removeItem(itemId: string, quantity: number = 1): boolean {
		if (quantity <= 0) return false;

		const slot = this.findItemSlot(itemId);
		if (!slot || !slot.item) return false;

		const removeQuantity = Math.min(quantity, slot.quantity);
		slot.quantity -= removeQuantity;
		this.currentWeight -= slot.item.weight * removeQuantity;

		this.emit('item-removed', slot.item, removeQuantity);

		// Clear slot if empty
		if (slot.quantity <= 0) {
			slot.item = null;
			slot.quantity = 0;
		}

		return true;
	}

	/**
	 * Use consumable item
	 */
	useItem(itemId: string): Item | null {
		const slot = this.findItemSlot(itemId);
		if (!slot || !slot.item) return null;

		if (slot.item.type !== 'consumable') {
			return null;
		}

		const item = slot.item;
		this.removeItem(itemId, 1);
		this.emit('item-used', item);

		return item;
	}

	/**
	 * Move item between slots
	 */
	moveItem(fromIndex: number, toIndex: number): boolean {
		if (
			fromIndex < 0 ||
			fromIndex >= this.slots.length ||
			toIndex < 0 ||
			toIndex >= this.slots.length
		) {
			return false;
		}

		const fromSlot = this.slots[fromIndex];
		const toSlot = this.slots[toIndex];

		if (!fromSlot.item) return false;

		// If target slot is empty, just move
		if (!toSlot.item) {
			toSlot.item = fromSlot.item;
			toSlot.quantity = fromSlot.quantity;
			fromSlot.item = null;
			fromSlot.quantity = 0;
			return true;
		}

		// If same item and stackable, try to stack
		if (
			toSlot.item.id === fromSlot.item.id &&
			toSlot.item.stackable
		) {
			const canAdd = Math.min(
				fromSlot.quantity,
				toSlot.item.maxStack - toSlot.quantity,
			);
			if (canAdd > 0) {
				toSlot.quantity += canAdd;
				fromSlot.quantity -= canAdd;

				if (fromSlot.quantity <= 0) {
					fromSlot.item = null;
					fromSlot.quantity = 0;
				}
				return true;
			}
		}

		// Otherwise, swap slots
		const tempItem = toSlot.item;
		const tempQuantity = toSlot.quantity;
		toSlot.item = fromSlot.item;
		toSlot.quantity = fromSlot.quantity;
		fromSlot.item = tempItem;
		fromSlot.quantity = tempQuantity;

		return true;
	}

	/**
	 * Get item count
	 */
	getItemCount(itemId: string): number {
		let total = 0;
		this.slots.forEach((slot) => {
			if (slot.item && slot.item.id === itemId) {
				total += slot.quantity;
			}
		});
		return total;
	}

	/**
	 * Check if has item
	 */
	hasItem(itemId: string, quantity: number = 1): boolean {
		return this.getItemCount(itemId) >= quantity;
	}

	/**
	 * Get all items
	 */
	getAllItems(): InventorySlot[] {
		return this.slots.filter((slot) => slot.item !== null);
	}

	/**
	 * Get items by type
	 */
	getItemsByType(type: Item['type']): InventorySlot[] {
		return this.slots.filter((slot) => slot.item && slot.item.type === type);
	}

	/**
	 * Get items by rarity
	 */
	getItemsByRarity(rarity: Item['rarity']): InventorySlot[] {
		return this.slots.filter((slot) => slot.item && slot.item.rarity === rarity);
	}

	/**
	 * Get slot by index
	 */
	getSlot(index: number): InventorySlot | null {
		if (index < 0 || index >= this.slots.length) return null;
		return this.slots[index];
	}

	/**
	 * Get all slots
	 */
	getAllSlots(): InventorySlot[] {
		return [...this.slots];
	}

	/**
	 * Get current weight
	 */
	getCurrentWeight(): number {
		return this.currentWeight;
	}

	/**
	 * Get weight limit
	 */
	getMaxWeight(): number {
		return this.limits.maxWeight;
	}

	/**
	 * Get used slot count
	 */
	getUsedSlots(): number {
		return this.slots.filter((slot) => slot.item !== null).length;
	}

	/**
	 * Get max slots
	 */
	getMaxSlots(): number {
		return this.limits.maxSlots;
	}

	/**
	 * Check if inventory is full
	 */
	isFull(): boolean {
		return this.findEmptySlot() === null;
	}

	/**
	 * Calculate total value
	 */
	getTotalValue(): number {
		let total = 0;
		this.slots.forEach((slot) => {
			if (slot.item) {
				total += slot.item.value * slot.quantity;
			}
		});
		return total;
	}

	/**
	 * Sort inventory
	 */
	sort(by: 'name' | 'type' | 'rarity' | 'value' = 'type'): void {
		const items = this.getAllItems();

		items.sort((a, b) => {
			if (!a.item || !b.item) return 0;

			switch (by) {
				case 'name':
					return a.item.name.localeCompare(b.item.name);
				case 'type':
					return a.item.type.localeCompare(b.item.type);
				case 'rarity': {
					const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
					return rarityOrder[b.item.rarity] - rarityOrder[a.item.rarity];
				}
				case 'value':
					return b.item.value - a.item.value;
				default:
					return 0;
			}
		});

		// Clear all slots
		this.slots.forEach((slot) => {
			slot.item = null;
			slot.quantity = 0;
		});

		// Re-add sorted items
		items.forEach((slot, index) => {
			if (slot.item) {
				this.slots[index].item = slot.item;
				this.slots[index].quantity = slot.quantity;
			}
		});
	}

	/**
	 * Clear inventory
	 */
	clear(): void {
		this.slots.forEach((slot) => {
			slot.item = null;
			slot.quantity = 0;
		});
		this.currentWeight = 0;
	}

	/**
	 * Export inventory data (for saving)
	 */
	export(): { slots: InventorySlot[]; weight: number } {
		return {
			slots: this.getAllItems(),
			weight: this.currentWeight,
		};
	}

	/**
	 * Import inventory data (for loading)
	 */
	import(data: { slots: InventorySlot[]; weight: number }): void {
		this.clear();
		data.slots.forEach((slot) => {
			if (slot.item) {
				this.addItem(slot.item, slot.quantity);
			}
		});
	}

	/**
	 * Find item slot by ID
	 */
	private findItemSlot(itemId: string): InventorySlot | null {
		return this.slots.find((slot) => slot.item && slot.item.id === itemId) || null;
	}

	/**
	 * Find empty slot
	 */
	private findEmptySlot(): InventorySlot | null {
		return this.slots.find((slot) => slot.item === null) || null;
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.clear();
		this.removeAllListeners();
	}
}
