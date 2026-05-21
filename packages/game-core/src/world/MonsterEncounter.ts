/**
 * Monster Encounter System
 * Handles random encounters and battle transitions
 */

import { Vector2 } from '@rpg/game-engine';
import type { MonsterData } from '../data/DataLoader';

export interface EncounterZone {
	zoneId: string;
	zoneName: string;
	monsterIds: string[]; // Monster IDs that can appear
	encounterRate: number; // Steps per encounter (e.g., 10 = encounter every ~10 steps)
	minLevel: number;
	maxLevel: number;
}

export interface EncounterResult {
	monster: MonsterData;
	level: number;
}

export class MonsterEncounter {
	private encounterZones: Map<string, EncounterZone> = new Map();
	private currentZone: EncounterZone | null = null;

	// Encounter tracking
	private stepsSinceLastEncounter: number = 0;
	private encountersEnabled: boolean = true;

	// Callbacks
	public onEncounter: ((encounter: EncounterResult) => void) | null = null;

	/**
	 * Register an encounter zone
	 */
	addZone(zone: EncounterZone): void {
		this.encounterZones.set(zone.zoneId, zone);
		console.log(`[MonsterEncounter] Registered zone: ${zone.zoneName}`);
	}

	/**
	 * Get zone by ID
	 */
	getZone(zoneId: string): EncounterZone | undefined {
		return this.encounterZones.get(zoneId);
	}

	/**
	 * Set current zone
	 */
	setZone(zoneId: string): void {
		const zone = this.encounterZones.get(zoneId);
		if (!zone) {
			console.warn(`[MonsterEncounter] Zone not found: ${zoneId}`);
			return;
		}

		this.currentZone = zone;
		this.stepsSinceLastEncounter = 0;
		console.log(`[MonsterEncounter] Entered zone: ${zone.zoneName}`);
	}

	/**
	 * Update encounter system (call each frame player moves)
	 */
	update(playerMoved: boolean, monsters: MonsterData[]): void {
		if (!this.encountersEnabled || !this.currentZone || !playerMoved) {
			return;
		}

		this.stepsSinceLastEncounter++;

		// Check for encounter
		if (this.shouldEncounter()) {
			const encounter = this.generateEncounter(monsters);
			if (encounter && this.onEncounter) {
				this.stepsSinceLastEncounter = 0;
				this.onEncounter(encounter);
			}
		}
	}

	/**
	 * Determine if encounter should happen
	 */
	private shouldEncounter(): boolean {
		if (!this.currentZone) return false;

		// Base encounter rate
		const baseRate = this.currentZone.encounterRate;
		if (baseRate <= 0) return false;

		// Calculate probability based on steps
		// Encounter becomes more likely the more steps since last encounter
		const encounterChance = Math.min(this.stepsSinceLastEncounter / baseRate, 1.0);

		// Random check
		return Math.random() < encounterChance;
	}

	/**
	 * Generate an encounter
	 */
	private generateEncounter(allMonsters: MonsterData[]): EncounterResult | null {
		if (!this.currentZone) return null;

		// Filter monsters for this zone
		const zoneMonsters = allMonsters.filter((m) =>
			this.currentZone!.monsterIds.includes(m.id)
		);

		if (zoneMonsters.length === 0) {
			console.warn(`[MonsterEncounter] No monsters found for zone: ${this.currentZone.zoneName}`);
			return null;
		}

		// Pick random monster
		const monster = zoneMonsters[Math.floor(Math.random() * zoneMonsters.length)]!;

		// Generate level within zone range
		const level =
			Math.floor(
				Math.random() * (this.currentZone.maxLevel - this.currentZone.minLevel + 1)
			) + this.currentZone.minLevel;

		console.log(`[MonsterEncounter] Encountered: ${monster.name} (Lv.${level})`);

		return {
			monster,
			level,
		};
	}

	/**
	 * Enable encounters
	 */
	enable(): void {
		this.encountersEnabled = true;
		console.log('[MonsterEncounter] Encounters enabled');
	}

	/**
	 * Disable encounters (e.g., in towns)
	 */
	disable(): void {
		this.encountersEnabled = false;
		console.log('[MonsterEncounter] Encounters disabled');
	}

	/**
	 * Force an encounter (for testing)
	 */
	forceEncounter(monsters: MonsterData[]): EncounterResult | null {
		if (!this.currentZone) {
			console.warn('[MonsterEncounter] No current zone set');
			return null;
		}

		const encounter = this.generateEncounter(monsters);
		if (encounter && this.onEncounter) {
			this.onEncounter(encounter);
		}

		return encounter;
	}

	/**
	 * Reset step counter
	 */
	resetSteps(): void {
		this.stepsSinceLastEncounter = 0;
	}

	/**
	 * Get current zone
	 */
	getCurrentZone(): EncounterZone | null {
		return this.currentZone;
	}
}

// Singleton instance
export const monsterEncounter = new MonsterEncounter();
