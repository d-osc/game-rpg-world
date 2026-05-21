/**
 * GameStateManager
 * Manages global game state and coordinates between systems
 */

import { Vector2 } from '@rpg/game-engine';
import type { InventoryManager } from '../inventory/InventoryManager';
import type { JobManager } from '../jobs/JobManager';
import type { DataLoader } from '../data/DataLoader';
import type { EquipmentManager } from '../inventory/EquipmentManager';

// ============================================================================
// Player State
// ============================================================================

export interface PlayerStats {
	// Core stats
	hp: number;
	maxHp: number;
	mp: number;
	maxMp: number;

	// Combat stats
	atk: number;
	def: number;
	spd: number;
	luck: number;

	// Magic stats
	matk: number;
	mdef: number;
}

export interface PlayerState {
	// Identity
	id: string;
	name: string;

	// Level & Experience
	level: number;
	exp: number;
	expToNextLevel: number;

	// Stats
	stats: PlayerStats;

	// Currency
	gold: number;

	// Position
	currentZone: string;
	position: { x: number; y: number };

	// Jobs (managed by JobManager)
	// Inventory (managed by InventoryManager)
}

// ============================================================================
// World State
// ============================================================================

export interface WorldState {
	currentContinent: string;
	currentZone: string;
	discoveredZones: Set<string>;
	visitedTowns: Set<string>;
}

// ============================================================================
// Combat State
// ============================================================================

export interface CombatState {
	inCombat: boolean;
	currentEnemyId: string | null;
	turnNumber: number;
}

// ============================================================================
// Game State
// ============================================================================

export interface SaveData {
	version: string;
	timestamp: number;
	player: PlayerState;
	world: {
		currentContinent: string;
		currentZone: string;
		discoveredZones: string[];
		visitedTowns: string[];
	};
	inventory: any; // InventoryManager export
	jobs: any; // JobManager export

		equipment: any; // EquipmentManager export
}

// ============================================================================
// GameStateManager Class
// ============================================================================

export class GameStateManager {
	private static instance: GameStateManager;

	// State
	private playerState: PlayerState | null = null;
	private worldState: WorldState | null = null;
	private combatState: CombatState | null = null;

	// Managers (will be injected)
	private inventoryManager: InventoryManager | null = null;
	private jobManager: JobManager | null = null;
	private equipmentManager: EquipmentManager | null = null;
	private dataLoader: DataLoader | null = null;

	// Config
	private readonly SAVE_KEY = 'rpg_save_data';
	private readonly SAVE_VERSION = '1.0.0';

	private constructor() {}

	/**
	 * Get singleton instance
	 */
	static getInstance(): GameStateManager {
		if (!GameStateManager.instance) {
			GameStateManager.instance = new GameStateManager();
		}
		return GameStateManager.instance;
	}

	// ========================================================================
	// Initialization
	// ========================================================================

	/**
	 * Initialize managers
	 */
	initializeManagers(
		inventoryManager: InventoryManager,
		jobManager: JobManager,
		dataLoader: DataLoader,
		equipmentManager?: EquipmentManager
	): void {
		this.inventoryManager = inventoryManager;
		this.jobManager = jobManager;
		this.dataLoader = dataLoader;
		if (equipmentManager) {
			this.equipmentManager = equipmentManager;
			// Wire inventory sync so equip/unequip properly move items
			equipmentManager.setInventoryCallbacks(
				(itemId, qty) => inventoryManager.removeItem(itemId, qty),
				(item, qty) => inventoryManager.addItem(item, qty),
			);
		}
	}

	/**
	 * Create new game
	 */
	createNewGame(playerName: string, startingJob: string = 'warrior'): PlayerState {
		// Get starting job data
		const jobData = this.dataLoader?.getJob(startingJob);
		if (!jobData) {
			throw new Error(`Starting job not found: ${startingJob}`);
		}

		// Calculate initial stats (base job stats)
		const baseStats = jobData.baseStats;
		const initialStats: PlayerStats = {
			hp: baseStats.hp,
			maxHp: baseStats.hp,
			mp: baseStats.mp,
			maxMp: baseStats.mp,
			atk: baseStats.atk,
			def: baseStats.def,
			spd: baseStats.spd,
			luck: baseStats.luck,
			matk: 10, // Default magic attack
			mdef: 10, // Default magic defense
		};

		// Create player state
		this.playerState = {
			id: this.generatePlayerId(),
			name: playerName,
			level: 1,
			exp: 0,
			expToNextLevel: this.calculateExpForLevel(2),
			stats: initialStats,
			gold: 100, // Starting gold
			currentZone: 'town', // Starting zone
			position: { x: 100, y: 100 }, // Starting position
		};

		// Initialize world state
		this.worldState = {
			currentContinent: 'verdant_lands',
			currentZone: 'town',
			discoveredZones: new Set(['town']),
			visitedTowns: new Set(['town']),
		};

		// Initialize combat state
		this.combatState = {
			inCombat: false,
			currentEnemyId: null,
			turnNumber: 0,
		};

		// Clear singleton managers before creating new game state
		if (this.inventoryManager) {
			this.inventoryManager.clear();
		}
		if (this.equipmentManager) {
			this.equipmentManager.clear();
		}

		// Learn starting job (if job manager is initialized)
		if (this.jobManager) {
			const certificateId = jobData.requirements?.certificateId;
			this.jobManager.learnJob(startingJob, certificateId);
		}

		// Give starting equipment (if inventory manager is initialized)
		if (this.inventoryManager) {
			// We'll implement this when InventoryManager is wired up
			// this.inventoryManager.addItem('rusty_sword', 1);
			// this.inventoryManager.addItem('leather_armor', 1);
		}

		console.log('[GameStateManager] New game created:', this.playerState);

		return this.playerState;
	}

	/**
	 * Load existing game
	 */
	loadGame(): boolean {
		try {
			const saveDataJson = localStorage.getItem(this.SAVE_KEY);
			if (!saveDataJson) {
				console.log('[GameStateManager] No save data found');
				return false;
			}

			const saveData: SaveData = JSON.parse(saveDataJson);

			// Version check
			if (saveData.version !== this.SAVE_VERSION) {
				console.warn(
					'[GameStateManager] Save data version mismatch:',
					saveData.version,
					'!==',
					this.SAVE_VERSION
				);
				// Could implement migration here
			}

			// Restore player state
			this.playerState = saveData.player;

			// Restore world state
			this.worldState = {
				currentContinent: saveData.world.currentContinent,
				currentZone: saveData.world.currentZone,
				discoveredZones: new Set(saveData.world.discoveredZones),
				visitedTowns: new Set(saveData.world.visitedTowns),
			};

			// Reset combat state
			this.combatState = {
				inCombat: false,
				currentEnemyId: null,
				turnNumber: 0,
			};

			// Restore inventory (if manager is initialized)
			if (this.inventoryManager && saveData.inventory) {
				this.inventoryManager.import(saveData.inventory);
			}

			// Restore jobs (if manager is initialized)
			if (this.jobManager && saveData.jobs) {
				this.jobManager.import(saveData.jobs);
			}



				// Restore equipment

				if (this.equipmentManager && saveData.equipment) {

					this.equipmentManager.import(saveData.equipment);

				}

			console.log('[GameStateManager] Game loaded successfully');
			return true;
		} catch (error) {
			console.error('[GameStateManager] Failed to load game:', error);
			return false;
		}
	}

	/**
	 * Save game
	 */
	saveGame(): boolean {
		try {
			if (!this.playerState || !this.worldState) {
				console.error('[GameStateManager] Cannot save: game not initialized');
				return false;
			}

			const saveData: SaveData = {
				version: this.SAVE_VERSION,
				timestamp: Date.now(),
				player: this.playerState,
				world: {
					currentContinent: this.worldState.currentContinent,
					currentZone: this.worldState.currentZone,
					discoveredZones: Array.from(this.worldState.discoveredZones),
					visitedTowns: Array.from(this.worldState.visitedTowns),
				},
				inventory: this.inventoryManager
					? this.inventoryManager.export()
					: null,
				jobs: this.jobManager ? this.jobManager.export() : null,

					equipment: this.equipmentManager ? this.equipmentManager.export() : null,
			};

			localStorage.setItem(this.SAVE_KEY, JSON.stringify(saveData));
			console.log('[GameStateManager] Game saved successfully');
			return true;
		} catch (error) {
			console.error('[GameStateManager] Failed to save game:', error);
			return false;
		}
	}

	/**
	 * Check if save exists
	 */
	hasSaveData(): boolean {
		return localStorage.getItem(this.SAVE_KEY) !== null;
	}

	/**
	 * Delete save data
	 */
	deleteSave(): void {
		localStorage.removeItem(this.SAVE_KEY);
		console.log('[GameStateManager] Save data deleted');
	}

	// ========================================================================
	// Player State Management
	// ========================================================================

	/**
	 * Get player state
	 */
	getPlayerState(): PlayerState {
		if (!this.playerState) {
			throw new Error('Player state not initialized');
		}
		return this.playerState;
	}

	/**
	 * Get player position as Vector2
	 */
	getPlayerPosition(): Vector2 {
		const player = this.getPlayerState();
		return new Vector2(player.position.x, player.position.y);
	}

	/**
	 * Set player position
	 */
	setPlayerPosition(x: number, y: number): void {
		const player = this.getPlayerState();
		player.position.x = x;
		player.position.y = y;
	}

	/**
	 * Add experience
	 */
	addExperience(amount: number): boolean {
		const player = this.getPlayerState();
		const MAX_PLAYER_LEVEL = 100;
		if (player.level >= MAX_PLAYER_LEVEL) return false;
		player.exp += amount;

		// Check for level up(s) - use while to support multi-level-up
		let leveledUp = false;
		while (player.exp >= player.expToNextLevel && player.level < MAX_PLAYER_LEVEL) {
			this.levelUp();
			leveledUp = true;
		}

		return leveledUp;
	}

	/**
	 * Level up
	 */
	public levelUp(): boolean {
		const player = this.getPlayerState();
		player.level += 1;
		player.exp -= player.expToNextLevel;
		player.expToNextLevel = this.calculateExpForLevel(player.level + 1);

		// Apply stat growth from jobs
		if (this.jobManager) {
			const learnedJobs = this.jobManager.getAllLearnedJobs();
			for (const job of learnedJobs) {
				const jobData = this.dataLoader?.getJob(job.jobId);
				if (jobData) {
					player.stats.maxHp += jobData.statGrowth.hp;
					player.stats.maxMp += jobData.statGrowth.mp;
					player.stats.atk += jobData.statGrowth.atk;
					player.stats.def += jobData.statGrowth.def;
					player.stats.spd += jobData.statGrowth.spd;
					player.stats.luck += jobData.statGrowth.luck;
				}
			}
		}

		// Restore HP/MP on level up
		player.stats.hp = player.stats.maxHp;
		player.stats.mp = player.stats.maxMp;

		console.log(`[GameStateManager] Level up! Now level ${player.level}`);

		return true;
	}

	/**
	 * Calculate experience required for level
	 */
	private calculateExpForLevel(level: number): number {
		// Simple exponential curve: level^2 * 100
		return Math.floor(Math.pow(level, 2) * 100);
	}

	/**
	 * Add gold
	 */
	addGold(amount: number): void {
		const player = this.getPlayerState();
		player.gold += amount;
		if (player.gold < 0) player.gold = 0;
	}

	/**
	 * Remove gold
	 */
	removeGold(amount: number): boolean {
		const player = this.getPlayerState();
		if (player.gold >= amount) {
			player.gold -= amount;
			return true;
		}
		return false;
	}

	/**
	 * Heal player
	 */
	heal(amount: number): void {
		const player = this.getPlayerState();
		player.stats.hp = Math.min(player.stats.hp + amount, player.stats.maxHp);
	}

	/**
	 * Restore MP
	 */
	restoreMp(amount: number): void {
		const player = this.getPlayerState();
		player.stats.mp = Math.min(player.stats.mp + amount, player.stats.maxMp);
	}

	/**
	 * Take damage
	 */
	takeDamage(amount: number): void {
		const player = this.getPlayerState();
		player.stats.hp = Math.max(0, player.stats.hp - amount);
	}

	/**
	 * Use MP
	 */
	useMp(amount: number): boolean {
		const player = this.getPlayerState();
		if (player.stats.mp >= amount) {
			player.stats.mp -= amount;
			return true;
		}
		return false;
	}

	/**
	 * Check if player is alive
	 */
	isPlayerAlive(): boolean {
		return this.getPlayerState().stats.hp > 0;
	}

	// ========================================================================
	// World State Management
	// ========================================================================

	/**
	 * Get world state
	 */
	getWorldState(): WorldState {
		if (!this.worldState) {
			throw new Error('World state not initialized');
		}
		return this.worldState;
	}

	/**
	 * Change zone
	 */
	changeZone(zoneId: string): void {
		const world = this.getWorldState();
		world.currentZone = zoneId;
		world.discoveredZones.add(zoneId);

		// Update player state
		const player = this.getPlayerState();
		player.currentZone = zoneId;

		console.log(`[GameStateManager] Changed zone to: ${zoneId}`);
	}

	/**
	 * Visit town
	 */
	visitTown(townId: string): void {
		const world = this.getWorldState();
		world.visitedTowns.add(townId);
	}

	/**
	 * Check if zone is discovered
	 */
	isZoneDiscovered(zoneId: string): boolean {
		return this.getWorldState().discoveredZones.has(zoneId);
	}

	// ========================================================================
	// Combat State Management
	// ========================================================================

	/**
	 * Get combat state
	 */
	getCombatState(): CombatState {
		if (!this.combatState) {
			throw new Error('Combat state not initialized');
		}
		return this.combatState;
	}

	/**
	 * Start combat
	 */
	startCombat(enemyId: string): void {
		const combat = this.getCombatState();
		combat.inCombat = true;
		combat.currentEnemyId = enemyId;
		combat.turnNumber = 1;

		console.log(`[GameStateManager] Combat started with: ${enemyId}`);
	}

	/**
	 * End combat
	 */
	endCombat(): void {
		const combat = this.getCombatState();
		combat.inCombat = false;
		combat.currentEnemyId = null;
		combat.turnNumber = 0;

		console.log('[GameStateManager] Combat ended');
	}

	/**
	 * Check if in combat
	 */
	isInCombat(): boolean {
		return this.getCombatState().inCombat;
	}

	// ========================================================================
	// Utilities
	// ========================================================================

	/**
	 * Generate unique player ID
	 */
	private generatePlayerId(): string {
		return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Reset game state
	 */
	reset(): void {
		this.playerState = null;
		this.worldState = null;
		this.combatState = null;
		console.log('[GameStateManager] Game state reset');
	}
}

// Export singleton instance
export const gameStateManager = GameStateManager.getInstance();
