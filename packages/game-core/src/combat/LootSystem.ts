/**
 * LootSystem
 * Handles loot drops, experience rewards, and item distribution after combat
 */

import { dataLoader, type MonsterData, type ItemData, type ItemDrop } from '../data/DataLoader';
import { gameStateManager } from '../state/GameStateManager';
import { inventoryManager, type Item } from '../inventory/InventoryManager';

// ============================================================================
// Type Definitions
// ============================================================================

export interface LootResult {
	exp: number;
	gold: number;
	items: LootedItem[];
	leveledUp: boolean;
	newLevel?: number;
}

export interface LootedItem {
	itemId: string;
	itemName: string;
	quantity: number;
	rarity: string;
}

// ============================================================================
// LootSystem Class
// ============================================================================

export class LootSystem {
	/**
	 * Generate loot from defeated monster
	 */
	generateLoot(monsterData: MonsterData, monsterLevel: number): LootResult {
		const result: LootResult = {
			exp: 0,
			gold: 0,
			items: [],
			leveledUp: false,
		};

		// Calculate EXP reward
		result.exp = this.calculateExpReward(monsterData, monsterLevel);

		// Calculate gold reward
		result.gold = this.calculateGoldReward(monsterData, monsterLevel);

		// Generate item drops
		result.items = this.generateItemDrops(monsterData.drops);

		return result;
	}

	/**
	 * Calculate experience points reward
	 */
	private calculateExpReward(monsterData: MonsterData, monsterLevel: number): number {
		// Base EXP from monster data
		let exp = monsterData.exp;

		// Level scaling: higher level monsters give more exp
		const levelBonus = monsterLevel * 5;
		exp += levelBonus;

		// Random variance (+/- 10%)
		const variance = exp * 0.1;
		const randomVariance = (Math.random() * variance * 2) - variance;
		exp += randomVariance;

		return Math.floor(Math.max(1, exp));
	}

	/**
	 * Calculate gold reward
	 */
	private calculateGoldReward(monsterData: MonsterData, monsterLevel: number): number {
		// Base gold from monster data
		let gold = monsterData.gold;

		// Level scaling
		const levelBonus = monsterLevel * 2;
		gold += levelBonus;

		// Random variance (+/- 20%)
		const variance = gold * 0.2;
		const randomVariance = (Math.random() * variance * 2) - variance;
		gold += randomVariance;

		return Math.floor(Math.max(0, gold));
	}

	/**
	 * Generate item drops based on drop table
	 */
	private generateItemDrops(drops: ItemDrop[]): LootedItem[] {
		const lootedItems: LootedItem[] = [];

		for (const drop of drops) {
			// Check if item drops (based on chance)
			if (Math.random() <= drop.chance) {
				// Calculate quantity (random between min and max)
				const quantity = Math.floor(
					Math.random() * (drop.quantity.max - drop.quantity.min + 1) + drop.quantity.min
				);

				// Get item data
				const itemData = dataLoader.getItem(drop.itemId);
				if (itemData) {
					lootedItems.push({
						itemId: drop.itemId,
						itemName: itemData.name,
						quantity: quantity,
						rarity: itemData.rarity,
					});
				}
			}
		}

		return lootedItems;
	}

	/**
	 * Apply loot to player (update game state)
	 */
	applyLoot(loot: LootResult): void {
		const playerState = gameStateManager.getPlayerState();
		if (!playerState) {
			console.error('[LootSystem] No player state found');
			return;
		}

		// Add EXP via GameStateManager (handles multi-level-up)
		loot.leveledUp = gameStateManager.addExperience(loot.exp);
		loot.newLevel = loot.leveledUp ? playerState.level : undefined;

		// Add gold
		playerState.gold += loot.gold;

		// Add items to inventory
		for (const item of loot.items) {
			try {
				const itemData = dataLoader.getItem(item.itemId);
				if (itemData) {
					const typedItem: Item = {
						...itemData,
						type: itemData.type as Item['type'],
						rarity: itemData.rarity as Item['rarity'],
						equipSlot: itemData.equipSlot as Item['equipSlot'],
					};
					const added = inventoryManager.addItem(typedItem, item.quantity);
					if (!added) {
						console.warn(`[LootSystem] Inventory full - could not add ${item.itemName} x${item.quantity}`);
						}
				}
			} catch (error) {
				console.warn(`[LootSystem] Failed to add item ${item.itemId}: ${error}`);
			}
		}

		// Save game
		gameStateManager.saveGame();
	}

	/**
	 * Format loot result as readable message
	 */
	formatLootMessage(loot: LootResult): string[] {
		const messages: string[] = [];

		// EXP and gold
		messages.push(`Gained ${loot.exp} EXP and ${loot.gold} gold!`);

		// Level up
		if (loot.leveledUp && loot.newLevel) {
			messages.push(`Level up! You are now level ${loot.newLevel}!`);
		}

		// Items
		if (loot.items.length > 0) {
			messages.push('Items obtained:');
			for (const item of loot.items) {
				const rarityColor = this.getRarityEmoji(item.rarity);
				messages.push(`  ${rarityColor} ${item.itemName} x${item.quantity}`);
			}
		} else {
			messages.push('No items dropped.');
		}

		return messages;
	}

	/**
	 * Get emoji or indicator for item rarity
	 */
	private getRarityEmoji(rarity: string): string {
		switch (rarity.toLowerCase()) {
			case 'common':
				return '[C]';
			case 'uncommon':
				return '[U]';
			case 'rare':
				return '[R]';
			case 'epic':
				return '[E]';
			case 'legendary':
				return '[L]';
			default:
				return '[-]';
		}
	}

	/**
	 * Calculate bonus loot (e.g., for quests, achievements, luck stat)
	 */
	calculateBonusLoot(baseLoot: LootResult, bonusMultiplier: number = 1.0): LootResult {
		return {
			...baseLoot,
			exp: Math.floor(baseLoot.exp * bonusMultiplier),
			gold: Math.floor(baseLoot.gold * bonusMultiplier),
			// Items remain the same (not affected by multiplier in this implementation)
		};
	}

	/**
	 * Get guaranteed drop (for special encounters, bosses)
	 */
	addGuaranteedDrop(loot: LootResult, itemId: string, quantity: number = 1): void {
		const itemData = dataLoader.getItem(itemId);
		if (itemData) {
			loot.items.push({
				itemId: itemId,
				itemName: itemData.name,
				quantity: quantity,
				rarity: itemData.rarity,
			});
		}
	}

	/**
	 * Calculate drop chance bonus based on player's luck stat
	 */
	getLuckBonus(playerLuck: number): number {
		// 1% bonus drop chance per 10 luck
		return 1 + (playerLuck / 100);
	}

	/**
	 * Generate enhanced loot with luck bonus
	 */
	generateLootWithLuck(monsterData: MonsterData, monsterLevel: number, playerLuck: number): LootResult {
		const baseLoot = this.generateLoot(monsterData, monsterLevel);

		// Apply luck bonus to gold
		const luckBonus = this.getLuckBonus(playerLuck);
		baseLoot.gold = Math.floor(baseLoot.gold * luckBonus);

		// Additional roll for bonus items with luck
		const bonusRollChance = playerLuck / 100; // 10% bonus roll at 100 luck
		if (Math.random() < bonusRollChance) {
			// Re-roll item drops
			const bonusItems = this.generateItemDrops(monsterData.drops);
			baseLoot.items.push(...bonusItems);
		}

		return baseLoot;
	}
}

// Export singleton instance
export const lootSystem = new LootSystem();
