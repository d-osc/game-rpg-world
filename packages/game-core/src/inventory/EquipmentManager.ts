/**
 * EquipmentManager
 * Manages equipped items and stat bonuses
 */

import { EventEmitter } from '../utils/EventEmitter';
import type { Item } from './InventoryManager';

export type EquipSlot = 'weapon' | 'head' | 'body' | 'legs' | 'hands' | 'feet' | 'accessory1' | 'accessory2';

export interface Equipment {
	weapon: Item | null;
	head: Item | null;
	body: Item | null;
	legs: Item | null;
	hands: Item | null;
	feet: Item | null;
	accessory1: Item | null;
	accessory2: Item | null;
}

export interface EquipmentStats {
	hp: number;
	mp: number;
	atk: number;
	def: number;
	spd: number;
	luck: number;
}

export interface EquipmentEvents {
	'item-equipped': (slot: EquipSlot, item: Item) => void;
	'item-unequipped': (slot: EquipSlot, item: Item) => void;
	'stats-changed': (stats: EquipmentStats) => void;
}

export class EquipmentManager extends EventEmitter<EquipmentEvents> {
	private equipment: Equipment = {
		weapon: null,
		head: null,
		body: null,
		legs: null,
		hands: null,
		feet: null,
		accessory1: null,
		accessory2: null,
	};

	private totalStats: EquipmentStats = {
		hp: 0,
		mp: 0,
		atk: 0,
		def: 0,
		spd: 0,
		luck: 0,
	};

	constructor() {
		super();
	}

	/**
	 * Equip item to slot
	 */
	equip(item: Item): Item | null {
		// Validate item can be equipped
		if (!item.equipSlot) {
			console.warn('[EquipmentManager] Item cannot be equipped:', item.name);
			return null;
		}

		const slot = item.equipSlot;

		// Get currently equipped item (to return to inventory)
		const previousItem = this.equipment[slot];

		// Equip new item
		this.equipment[slot] = item;

		// Recalculate stats
		this.recalculateStats();

		this.emit('item-equipped', slot, item);
		this.emit('stats-changed', this.totalStats);

		return previousItem;
	}

	/**
	 * Unequip item from slot
	 */
	unequip(slot: EquipSlot): Item | null {
		const item = this.equipment[slot];
		if (!item) return null;

		this.equipment[slot] = null;

		// Recalculate stats
		this.recalculateStats();

		this.emit('item-unequipped', slot, item);
		this.emit('stats-changed', this.totalStats);

		return item;
	}

	/**
	 * Get equipped item in slot
	 */
	getEquipped(slot: EquipSlot): Item | null {
		return this.equipment[slot];
	}

	/**
	 * Get all equipped items
	 */
	getAllEquipped(): Equipment {
		return { ...this.equipment };
	}

	/**
	 * Get total stats from equipment
	 */
	getTotalStats(): EquipmentStats {
		return { ...this.totalStats };
	}

	/**
	 * Check if slot is occupied
	 */
	isSlotOccupied(slot: EquipSlot): boolean {
		return this.equipment[slot] !== null;
	}

	/**
	 * Recalculate total stats from all equipment
	 */
	private recalculateStats(): void {
		this.totalStats = {
			hp: 0,
			mp: 0,
			atk: 0,
			def: 0,
			spd: 0,
			luck: 0,
		};

		// Sum stats from all equipped items
		Object.values(this.equipment).forEach((item) => {
			if (item && item.stats) {
				this.totalStats.hp += item.stats.hp || 0;
				this.totalStats.mp += item.stats.mp || 0;
				this.totalStats.atk += item.stats.atk || 0;
				this.totalStats.def += item.stats.def || 0;
				this.totalStats.spd += item.stats.spd || 0;
				this.totalStats.luck += item.stats.luck || 0;
			}
		});
	}

	/**
	 * Clear all equipment
	 */
	clear(): void {
		Object.keys(this.equipment).forEach((slot) => {
			this.equipment[slot as EquipSlot] = null;
		});
		this.recalculateStats();
		this.emit('stats-changed', this.totalStats);
	}

	/**
	 * Export equipment data (for saving)
	 */
	export(): Equipment {
		return this.getAllEquipped();
	}

	/**
	 * Import equipment data (for loading)
	 */
	import(data: Equipment): void {
		this.equipment = { ...data };
		this.recalculateStats();
		this.emit('stats-changed', this.totalStats);
	}

	/**
	 * Get equipment count
	 */
	getEquippedCount(): number {
		return Object.values(this.equipment).filter((item) => item !== null).length;
	}

	/**
	 * Calculate total equipment value
	 */
	getTotalValue(): number {
		return Object.values(this.equipment).reduce((total, item) => {
			return total + (item?.value || 0);
		}, 0);
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.clear();
		this.removeAllListeners();
	}
}
