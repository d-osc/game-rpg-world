/**
 * Inventory Service
 * Server-side inventory validation using elit/database
 */

import { inventory } from '../database/index.ts';
import { Collection } from '../database/config.ts';

const transactions = new Collection<any>('transactions');
const auditLogs = new Collection<any>('audit_logs');

export interface InventoryItem {
	id: string;
	playerId: string;
	itemId: string;
	quantity: number;
	slotIndex: number | null;
	isEquipped: boolean;
	acquiredAt: string;
}

export interface InventoryTransaction {
	playerId: string;
	action: 'add' | 'remove' | 'move' | 'equip' | 'unequip';
	itemId: string;
	quantity: number;
	slotIndex?: number;
	previousSlot?: number;
}

export interface ValidationResult {
	valid: boolean;
	error?: string;
	currentWeight?: number;
	currentSlots?: number;
}

export class InventoryService {
	async addItem(
		playerId: string, itemId: string, quantity: number,
		itemWeight: number, isStackable: boolean, maxStack: number,
		maxWeight: number = 500, maxSlots: number = 100,
	): Promise<ValidationResult> {
		try {
			const state = this.getInventoryState(playerId);
			const totalWeight = itemWeight * quantity;
			if (state.totalWeight + totalWeight > maxWeight) {
				return { valid: false, error: 'Weight limit exceeded', currentWeight: state.totalWeight };
			}

			if (isStackable) {
				const existing = inventory.find((i: any) => i.playerId === playerId && i.itemId === itemId && !i.isEquipped);
				let remaining = quantity;
				for (const item of existing) {
					if (remaining <= 0) break;
					const canAdd = Math.min(remaining, maxStack - item.quantity);
					if (canAdd > 0) {
						inventory.update((i: any) => i.id === item.id, { quantity: item.quantity + canAdd });
						remaining -= canAdd;
						this.logTransaction(playerId, 'add', itemId, canAdd, item.slotIndex);
					}
				}
				quantity = remaining;
			}

			while (quantity > 0) {
				if (state.usedSlots >= maxSlots) {
					return { valid: false, error: 'Inventory slots full', currentSlots: state.usedSlots };
				}
				const addQty = isStackable ? Math.min(quantity, maxStack) : 1;
				const slot = this.findNextAvailableSlot(playerId, maxSlots);
				inventory.insert({
					id: crypto.randomUUID(),
					playerId, itemId, quantity: addQty, slotIndex: slot,
					isEquipped: false, acquiredAt: new Date().toISOString(),
				});
				this.logTransaction(playerId, 'add', itemId, addQty, slot);
				quantity -= addQty;
				state.usedSlots++;
			}

			this.logAudit(playerId, 'inventory_add', { itemId, quantity });
			return { valid: true };
		} catch (error) {
			console.error('[InventoryService] Add item failed:', error);
			throw error;
		}
	}

	async removeItem(playerId: string, itemId: string, quantity: number): Promise<ValidationResult> {
		try {
			const items = inventory.find((i: any) => i.playerId === playerId && i.itemId === itemId && !i.isEquipped);
			const totalAvailable = items.reduce((sum: number, i: any) => sum + i.quantity, 0);
			if (totalAvailable < quantity) return { valid: false, error: 'Insufficient quantity' };

			let remaining = quantity;
			for (const item of items) {
				if (remaining <= 0) break;
				if (item.quantity <= remaining) {
					inventory.delete((i: any) => i.id === item.id);
					this.logTransaction(playerId, 'remove', itemId, item.quantity, item.slotIndex);
					remaining -= item.quantity;
				} else {
					inventory.update((i: any) => i.id === item.id, { quantity: item.quantity - remaining });
					this.logTransaction(playerId, 'remove', itemId, remaining, item.slotIndex);
					remaining = 0;
				}
			}

			this.logAudit(playerId, 'inventory_remove', { itemId, quantity });
			return { valid: true };
		} catch (error) {
			console.error('[InventoryService] Remove item failed:', error);
			throw error;
		}
	}

	async moveItem(playerId: string, fromSlot: number, toSlot: number, shouldMerge: boolean = true): Promise<ValidationResult> {
		try {
			const source = inventory.findOne((i: any) => i.playerId === playerId && i.slotIndex === fromSlot);
			if (!source) return { valid: false, error: 'Source slot is empty' };

			const target = inventory.findOne((i: any) => i.playerId === playerId && i.slotIndex === toSlot);

			if (!target) {
				inventory.update((i: any) => i.id === source.id, { slotIndex: toSlot });
				this.logTransaction(playerId, 'move', source.itemId, source.quantity, toSlot);
			} else if (shouldMerge && source.itemId === target.itemId) {
				inventory.update((i: any) => i.id === target.id, { quantity: target.quantity + source.quantity });
				inventory.delete((i: any) => i.id === source.id);
				this.logTransaction(playerId, 'move', source.itemId, source.quantity, toSlot);
			} else {
				inventory.update((i: any) => i.id === source.id, { slotIndex: toSlot });
				inventory.update((i: any) => i.id === target.id, { slotIndex: fromSlot });
				this.logTransaction(playerId, 'move', source.itemId, source.quantity, toSlot);
				this.logTransaction(playerId, 'move', target.itemId, target.quantity, fromSlot);
			}

			this.logAudit(playerId, 'inventory_move', { fromSlot, toSlot });
			return { valid: true };
		} catch (error) {
			console.error('[InventoryService] Move item failed:', error);
			throw error;
		}
	}

	async equipItem(playerId: string, slotIndex: number): Promise<ValidationResult> {
		const item = inventory.findOne((i: any) => i.playerId === playerId && i.slotIndex === slotIndex);
		if (!item) return { valid: false, error: 'Item not found' };
		if (item.isEquipped) return { valid: false, error: 'Item already equipped' };
		inventory.update((i: any) => i.id === item.id, { isEquipped: true });
		this.logTransaction(playerId, 'equip', item.itemId, 1, slotIndex);
		this.logAudit(playerId, 'inventory_equip', { itemId: item.itemId, slotIndex });
		return { valid: true };
	}

	async unequipItem(playerId: string, slotIndex: number): Promise<ValidationResult> {
		const item = inventory.findOne((i: any) => i.playerId === playerId && i.slotIndex === slotIndex);
		if (!item) return { valid: false, error: 'Item not found' };
		if (!item.isEquipped) return { valid: false, error: 'Item not equipped' };
		inventory.update((i: any) => i.id === item.id, { isEquipped: false });
		this.logTransaction(playerId, 'unequip', item.itemId, 1, slotIndex);
		this.logAudit(playerId, 'inventory_unequip', { itemId: item.itemId, slotIndex });
		return { valid: true };
	}

	async getInventory(playerId: string): Promise<any[]> {
		return inventory.find((i: any) => i.playerId === playerId);
	}

	private getInventoryState(playerId: string): { totalWeight: number; usedSlots: number } {
		const items = inventory.find((i: any) => i.playerId === playerId);
		return { totalWeight: 0, usedSlots: new Set(items.map((i: any) => i.slotIndex)).size };
	}

	private findNextAvailableSlot(playerId: string, maxSlots: number): number {
		const items = inventory.find((i: any) => i.playerId === playerId);
		const used = new Set(items.map((i: any) => i.slotIndex));
		for (let i = 0; i < maxSlots; i++) {
			if (!used.has(i)) return i;
		}
		throw new Error('No available slots');
	}

	private logTransaction(playerId: string, action: string, itemId: string, quantity: number, slotIndex?: number): void {
		transactions.insert({
			id: crypto.randomUUID(), playerId,
			transactionType: `inventory_${action}`, amount: 0,
			itemId, quantity, details: { slotIndex },
			createdAt: new Date().toISOString(),
		});
	}

	private logAudit(playerId: string, action: string, details: any): void {
		auditLogs.insert({
			id: crypto.randomUUID(), playerId, action,
			details, createdAt: new Date().toISOString(),
		});
	}

	async detectSuspiciousActivity(playerId: string): Promise<{ suspicious: boolean; reasons: string[] }> {
		const reasons: string[] = [];
		const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
		const recentAdds = transactions.find((t: any) =>
			t.playerId === playerId && t.transactionType === 'inventory_add' && t.createdAt > oneMinuteAgo
		);
		if (recentAdds.length > 50) reasons.push('Rapid item acquisition (>50 items/minute)');
		return { suspicious: reasons.length > 0, reasons };
	}
}
