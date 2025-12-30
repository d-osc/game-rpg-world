/**
 * Inventory Service
 * Server-side inventory validation and anti-cheat
 */

import { pool } from '../database/config.ts';
import type { PoolClient } from 'pg';

export interface InventoryItem {
	id: string;
	player_id: string;
	item_id: string;
	quantity: number;
	slot_index: number | null;
	is_equipped: boolean;
	acquired_at: Date;
}

export interface InventoryTransaction {
	player_id: string;
	action: 'add' | 'remove' | 'move' | 'equip' | 'unequip';
	item_id: string;
	quantity: number;
	slot_index?: number;
	previous_slot?: number;
}

export interface ValidationResult {
	valid: boolean;
	error?: string;
	current_weight?: number;
	current_slots?: number;
}

export class InventoryService {
	/**
	 * Validate and add item to player inventory
	 */
	async addItem(
		playerId: string,
		itemId: string,
		quantity: number,
		itemWeight: number,
		isStackable: boolean,
		maxStack: number,
		maxWeight: number = 500,
		maxSlots: number = 100,
	): Promise<ValidationResult> {
		const client = await pool.connect();

		try {
			await client.query('BEGIN');

			// Get current inventory state
			const inventoryState = await this.getInventoryState(client, playerId);

			// Validate weight
			const totalWeight = itemWeight * quantity;
			if (inventoryState.totalWeight + totalWeight > maxWeight) {
				await client.query('ROLLBACK');
				return {
					valid: false,
					error: 'Weight limit exceeded',
					current_weight: inventoryState.totalWeight,
				};
			}

			// If stackable, try to add to existing stacks
			if (isStackable) {
				const existingItems = await client.query(
					`SELECT id, quantity, slot_index
					FROM player_inventory
					WHERE player_id = $1 AND item_id = $2 AND is_equipped = false
					ORDER BY slot_index`,
					[playerId, itemId],
				);

				let remainingQuantity = quantity;

				for (const row of existingItems.rows) {
					if (remainingQuantity <= 0) break;

					const canAdd = Math.min(remainingQuantity, maxStack - row.quantity);
					if (canAdd > 0) {
						await client.query(
							`UPDATE player_inventory
							SET quantity = quantity + $1
							WHERE id = $2`,
							[canAdd, row.id],
						);
						remainingQuantity -= canAdd;

						// Log transaction
						await this.logTransaction(client, playerId, 'add', itemId, canAdd, row.slot_index);
					}
				}

				quantity = remainingQuantity;
			}

			// Add new items if quantity remains
			while (quantity > 0) {
				// Check slot limit
				if (inventoryState.usedSlots >= maxSlots) {
					await client.query('ROLLBACK');
					return {
						valid: false,
						error: 'Inventory slots full',
						current_slots: inventoryState.usedSlots,
					};
				}

				const addQuantity = isStackable ? Math.min(quantity, maxStack) : 1;

				// Find next available slot
				const nextSlot = await this.findNextAvailableSlot(client, playerId, maxSlots);

				// Insert new item
				await client.query(
					`INSERT INTO player_inventory (player_id, item_id, quantity, slot_index, is_equipped)
					VALUES ($1, $2, $3, $4, false)`,
					[playerId, itemId, addQuantity, nextSlot],
				);

				// Log transaction
				await this.logTransaction(client, playerId, 'add', itemId, addQuantity, nextSlot);

				quantity -= addQuantity;
				inventoryState.usedSlots++;
			}

			await client.query('COMMIT');

			// Log audit
			await this.logAudit(playerId, 'inventory_add', {
				item_id: itemId,
				quantity,
			});

			return { valid: true };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[InventoryService] Add item failed:', error);
			throw error;
		} finally {
			client.release();
		}
	}

	/**
	 * Validate and remove item from inventory
	 */
	async removeItem(playerId: string, itemId: string, quantity: number): Promise<ValidationResult> {
		const client = await pool.connect();

		try {
			await client.query('BEGIN');

			// Get all items of this type
			const result = await client.query(
				`SELECT id, quantity, slot_index
				FROM player_inventory
				WHERE player_id = $1 AND item_id = $2 AND is_equipped = false
				ORDER BY slot_index`,
				[playerId, itemId],
			);

			// Calculate total available
			const totalAvailable = result.rows.reduce((sum, row) => sum + row.quantity, 0);

			if (totalAvailable < quantity) {
				await client.query('ROLLBACK');
				return {
					valid: false,
					error: 'Insufficient quantity',
				};
			}

			// Remove items
			let remainingToRemove = quantity;

			for (const row of result.rows) {
				if (remainingToRemove <= 0) break;

				if (row.quantity <= remainingToRemove) {
					// Delete entire stack
					await client.query(`DELETE FROM player_inventory WHERE id = $1`, [row.id]);

					// Log transaction
					await this.logTransaction(client, playerId, 'remove', itemId, row.quantity, row.slot_index);

					remainingToRemove -= row.quantity;
				} else {
					// Reduce quantity
					await client.query(
						`UPDATE player_inventory
						SET quantity = quantity - $1
						WHERE id = $2`,
						[remainingToRemove, row.id],
					);

					// Log transaction
					await this.logTransaction(
						client,
						playerId,
						'remove',
						itemId,
						remainingToRemove,
						row.slot_index,
					);

					remainingToRemove = 0;
				}
			}

			await client.query('COMMIT');

			// Log audit
			await this.logAudit(playerId, 'inventory_remove', {
				item_id: itemId,
				quantity,
			});

			return { valid: true };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[InventoryService] Remove item failed:', error);
			throw error;
		} finally {
			client.release();
		}
	}

	/**
	 * Validate and move item to different slot
	 */
	async moveItem(
		playerId: string,
		fromSlot: number,
		toSlot: number,
		shouldMerge: boolean = true,
	): Promise<ValidationResult> {
		const client = await pool.connect();

		try {
			await client.query('BEGIN');

			// Get source item
			const sourceResult = await client.query(
				`SELECT id, item_id, quantity, is_equipped
				FROM player_inventory
				WHERE player_id = $1 AND slot_index = $2`,
				[playerId, fromSlot],
			);

			if (sourceResult.rows.length === 0) {
				await client.query('ROLLBACK');
				return { valid: false, error: 'Source slot is empty' };
			}

			const sourceItem = sourceResult.rows[0];

			// Get target slot
			const targetResult = await client.query(
				`SELECT id, item_id, quantity, is_equipped
				FROM player_inventory
				WHERE player_id = $1 AND slot_index = $2`,
				[playerId, toSlot],
			);

			if (targetResult.rows.length === 0) {
				// Target is empty - simple move
				await client.query(
					`UPDATE player_inventory
					SET slot_index = $1
					WHERE id = $2`,
					[toSlot, sourceItem.id],
				);

				// Log transaction
				await this.logTransaction(client, playerId, 'move', sourceItem.item_id, sourceItem.quantity, toSlot);
			} else {
				const targetItem = targetResult.rows[0];

				// If same item and should merge
				if (shouldMerge && sourceItem.item_id === targetItem.item_id) {
					// Merge stacks (note: need to validate max stack on client)
					await client.query(
						`UPDATE player_inventory
						SET quantity = quantity + $1
						WHERE id = $2`,
						[sourceItem.quantity, targetItem.id],
					);

					// Delete source
					await client.query(`DELETE FROM player_inventory WHERE id = $1`, [sourceItem.id]);

					// Log transaction
					await this.logTransaction(
						client,
						playerId,
						'move',
						sourceItem.item_id,
						sourceItem.quantity,
						toSlot,
					);
				} else {
					// Swap positions
					await client.query(
						`UPDATE player_inventory
						SET slot_index = $1
						WHERE id = $2`,
						[toSlot, sourceItem.id],
					);

					await client.query(
						`UPDATE player_inventory
						SET slot_index = $1
						WHERE id = $2`,
						[fromSlot, targetItem.id],
					);

					// Log transactions
					await this.logTransaction(
						client,
						playerId,
						'move',
						sourceItem.item_id,
						sourceItem.quantity,
						toSlot,
					);
					await this.logTransaction(
						client,
						playerId,
						'move',
						targetItem.item_id,
						targetItem.quantity,
						fromSlot,
					);
				}
			}

			await client.query('COMMIT');

			// Log audit
			await this.logAudit(playerId, 'inventory_move', {
				from_slot: fromSlot,
				to_slot: toSlot,
			});

			return { valid: true };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[InventoryService] Move item failed:', error);
			throw error;
		} finally {
			client.release();
		}
	}

	/**
	 * Validate and equip item
	 */
	async equipItem(playerId: string, slotIndex: number): Promise<ValidationResult> {
		const client = await pool.connect();

		try {
			await client.query('BEGIN');

			// Get item
			const result = await client.query(
				`SELECT id, item_id, is_equipped
				FROM player_inventory
				WHERE player_id = $1 AND slot_index = $2`,
				[playerId, slotIndex],
			);

			if (result.rows.length === 0) {
				await client.query('ROLLBACK');
				return { valid: false, error: 'Item not found' };
			}

			const item = result.rows[0];

			if (item.is_equipped) {
				await client.query('ROLLBACK');
				return { valid: false, error: 'Item already equipped' };
			}

			// Update equipped status
			await client.query(
				`UPDATE player_inventory
				SET is_equipped = true
				WHERE id = $1`,
				[item.id],
			);

			// Log transaction
			await this.logTransaction(client, playerId, 'equip', item.item_id, 1, slotIndex);

			await client.query('COMMIT');

			// Log audit
			await this.logAudit(playerId, 'inventory_equip', {
				item_id: item.item_id,
				slot_index: slotIndex,
			});

			return { valid: true };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[InventoryService] Equip item failed:', error);
			throw error;
		} finally {
			client.release();
		}
	}

	/**
	 * Validate and unequip item
	 */
	async unequipItem(playerId: string, slotIndex: number): Promise<ValidationResult> {
		const client = await pool.connect();

		try {
			await client.query('BEGIN');

			// Get item
			const result = await client.query(
				`SELECT id, item_id, is_equipped
				FROM player_inventory
				WHERE player_id = $1 AND slot_index = $2`,
				[playerId, slotIndex],
			);

			if (result.rows.length === 0) {
				await client.query('ROLLBACK');
				return { valid: false, error: 'Item not found' };
			}

			const item = result.rows[0];

			if (!item.is_equipped) {
				await client.query('ROLLBACK');
				return { valid: false, error: 'Item not equipped' };
			}

			// Update equipped status
			await client.query(
				`UPDATE player_inventory
				SET is_equipped = false
				WHERE id = $1`,
				[item.id],
			);

			// Log transaction
			await this.logTransaction(client, playerId, 'unequip', item.item_id, 1, slotIndex);

			await client.query('COMMIT');

			// Log audit
			await this.logAudit(playerId, 'inventory_unequip', {
				item_id: item.item_id,
				slot_index: slotIndex,
			});

			return { valid: true };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[InventoryService] Unequip item failed:', error);
			throw error;
		} finally {
			client.release();
		}
	}

	/**
	 * Get full inventory for player
	 */
	async getInventory(playerId: string): Promise<InventoryItem[]> {
		const result = await pool.query(
			`SELECT id, player_id, item_id, quantity, slot_index, is_equipped, acquired_at
			FROM player_inventory
			WHERE player_id = $1
			ORDER BY slot_index`,
			[playerId],
		);

		return result.rows;
	}

	/**
	 * Get inventory state (weight, slots)
	 */
	private async getInventoryState(
		client: PoolClient,
		playerId: string,
	): Promise<{ totalWeight: number; usedSlots: number }> {
		const result = await client.query(
			`SELECT COUNT(DISTINCT slot_index) as used_slots
			FROM player_inventory
			WHERE player_id = $1`,
			[playerId],
		);

		// Note: Weight calculation needs item definitions
		// For now, return slot count only
		return {
			totalWeight: 0, // TODO: Calculate from item definitions
			usedSlots: parseInt(result.rows[0]?.used_slots || '0'),
		};
	}

	/**
	 * Find next available slot index
	 */
	private async findNextAvailableSlot(client: PoolClient, playerId: string, maxSlots: number): Promise<number> {
		const result = await client.query(
			`SELECT slot_index
			FROM player_inventory
			WHERE player_id = $1
			ORDER BY slot_index`,
			[playerId],
		);

		const usedSlots = new Set(result.rows.map((row) => row.slot_index));

		for (let i = 0; i < maxSlots; i++) {
			if (!usedSlots.has(i)) {
				return i;
			}
		}

		throw new Error('No available slots');
	}

	/**
	 * Log transaction for economy tracking
	 */
	private async logTransaction(
		client: PoolClient,
		playerId: string,
		action: string,
		itemId: string,
		quantity: number,
		slotIndex?: number,
	): Promise<void> {
		await client.query(
			`INSERT INTO transactions (player_id, transaction_type, amount, item_id, quantity, details)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				playerId,
				`inventory_${action}`,
				0, // No currency involved
				itemId,
				quantity,
				JSON.stringify({ slot_index: slotIndex }),
			],
		);
	}

	/**
	 * Log audit for anti-cheat
	 */
	private async logAudit(playerId: string, action: string, details: any): Promise<void> {
		await pool.query(
			`INSERT INTO audit_logs (player_id, action, details)
			VALUES ($1, $2, $3)`,
			[playerId, action, JSON.stringify(details)],
		);
	}

	/**
	 * Detect suspicious activity (anti-cheat heuristics)
	 */
	async detectSuspiciousActivity(playerId: string): Promise<{
		suspicious: boolean;
		reasons: string[];
	}> {
		const reasons: string[] = [];

		// Check for rapid item acquisition
		const rapidItemCheck = await pool.query(
			`SELECT COUNT(*) as count
			FROM transactions
			WHERE player_id = $1
			AND transaction_type = 'inventory_add'
			AND created_at > NOW() - INTERVAL '1 minute'`,
			[playerId],
		);

		if (parseInt(rapidItemCheck.rows[0]?.count || '0') > 50) {
			reasons.push('Rapid item acquisition (>50 items/minute)');
		}

		// Check for impossible inventory weight
		// TODO: Implement weight validation with item definitions

		// Check for duplicate unique items
		// TODO: Implement when unique items are defined

		return {
			suspicious: reasons.length > 0,
			reasons,
		};
	}
}
