/**
 * WorldManager
 * Manages world state, continents, zones, and zone transitions
 */

import { EventEmitter } from '../utils/EventEmitter.ts';

export interface Position {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface Town {
	id: string;
	name: string;
	description: string;
	position: Position;
	services: string[];
	npcs: string[];
}

export interface Zone {
	id: string;
	name: string;
	description: string;
	type: 'hunting' | 'town' | 'dungeon';
	level_range: [number, number];
	position: Position;
	size: Size;
	map_file: string;
	monsters?: string[];
	spawn_points?: number;
	respawn_time?: number;
	max_capacity?: number;
}

export interface Continent {
	id: string;
	name: string;
	description: string;
	level_range: [number, number];
	climate: string;
	towns: Town[];
	zones: Zone[];
}

export interface WorldData {
	continents: Continent[];
	starting_location: {
		continent: string;
		town: string;
		position: Position;
	};
	fast_travel: {
		enabled: boolean;
		cost_per_continent: number;
		unlocked_towns_only: boolean;
	};
}

export interface WorldManagerEvents {
	'continent-changed': (continentId: string) => void;
	'zone-entered': (zoneId: string) => void;
	'zone-exited': (zoneId: string) => void;
	'town-entered': (townId: string) => void;
	'fast-travel': (from: string, to: string) => void;
}

export class WorldManager extends EventEmitter<WorldManagerEvents> {
	private worldData: WorldData | null = null;
	private currentContinent: Continent | null = null;
	private currentZone: Zone | null = null;
	private currentTown: Town | null = null;
	private currentPosition: Position = { x: 0, y: 0 };
	private unlockedTowns: Set<string> = new Set();

	constructor() {
		super();
	}

	/**
	 * Load world data
	 */
	loadWorld(worldData: WorldData): void {
		this.worldData = worldData;

		// Unlock starting town
		this.unlockedTowns.add(worldData.starting_location.town);

		// Set starting location
		const startingContinent = this.getContinent(worldData.starting_location.continent);
		if (startingContinent) {
			this.currentContinent = startingContinent;
			this.currentPosition = worldData.starting_location.position;

			// Find and enter starting town
			const startingTown = startingContinent.towns.find(
				(t) => t.id === worldData.starting_location.town,
			);
			if (startingTown) {
				this.currentTown = startingTown;
				this.emit('town-entered', startingTown.id);
			}
		}
	}

	/**
	 * Get continent by ID
	 */
	getContinent(continentId: string): Continent | null {
		if (!this.worldData) return null;
		return this.worldData.continents.find((c) => c.id === continentId) || null;
	}

	/**
	 * Get all continents
	 */
	getAllContinents(): Continent[] {
		return this.worldData?.continents || [];
	}

	/**
	 * Get zone by ID
	 */
	getZone(zoneId: string): Zone | null {
		if (!this.worldData) return null;

		for (const continent of this.worldData.continents) {
			const zone = continent.zones.find((z) => z.id === zoneId);
			if (zone) return zone;
		}

		return null;
	}

	/**
	 * Get town by ID
	 */
	getTown(townId: string): Town | null {
		if (!this.worldData) return null;

		for (const continent of this.worldData.continents) {
			const town = continent.towns.find((t) => t.id === townId);
			if (town) return town;
		}

		return null;
	}

	/**
	 * Enter a zone
	 */
	enterZone(zoneId: string): boolean {
		const zone = this.getZone(zoneId);
		if (!zone) {
			console.error(`[WorldManager] Zone not found: ${zoneId}`);
			return false;
		}

		// Exit current zone if any
		if (this.currentZone) {
			this.emit('zone-exited', this.currentZone.id);
		}

		// Exit current town if any
		if (this.currentTown) {
			this.currentTown = null;
		}

		// Enter new zone
		this.currentZone = zone;
		this.currentPosition = { ...zone.position };

		// Update continent if needed
		const zoneContinent = this.findContinentForZone(zoneId);
		if (zoneContinent && zoneContinent.id !== this.currentContinent?.id) {
			this.currentContinent = zoneContinent;
			this.emit('continent-changed', zoneContinent.id);
		}

		this.emit('zone-entered', zone.id);
		return true;
	}

	/**
	 * Enter a town
	 */
	enterTown(townId: string): boolean {
		const town = this.getTown(townId);
		if (!town) {
			console.error(`[WorldManager] Town not found: ${townId}`);
			return false;
		}

		// Exit current zone if any
		if (this.currentZone) {
			this.emit('zone-exited', this.currentZone.id);
			this.currentZone = null;
		}

		// Enter town
		this.currentTown = town;
		this.currentPosition = { ...town.position };

		// Unlock town for fast travel
		this.unlockedTowns.add(town.id);

		// Update continent if needed
		const townContinent = this.findContinentForTown(townId);
		if (townContinent && townContinent.id !== this.currentContinent?.id) {
			this.currentContinent = townContinent;
			this.emit('continent-changed', townContinent.id);
		}

		this.emit('town-entered', town.id);
		return true;
	}

	/**
	 * Fast travel to a town
	 */
	fastTravel(townId: string): { success: boolean; cost?: number; error?: string } {
		if (!this.worldData?.fast_travel.enabled) {
			return { success: false, error: 'Fast travel is not enabled' };
		}

		const town = this.getTown(townId);
		if (!town) {
			return { success: false, error: 'Town not found' };
		}

		// Check if town is unlocked
		if (this.worldData.fast_travel.unlocked_towns_only && !this.unlockedTowns.has(townId)) {
			return { success: false, error: 'Town not unlocked' };
		}

		// Calculate cost
		const targetContinent = this.findContinentForTown(townId);
		let cost = 0;

		if (targetContinent && targetContinent.id !== this.currentContinent?.id) {
			cost = this.worldData.fast_travel.cost_per_continent;
		}

		// Fast travel
		const from = this.currentTown?.id || this.currentZone?.id || 'unknown';
		this.enterTown(townId);
		this.emit('fast-travel', from, townId);

		return { success: true, cost };
	}

	/**
	 * Find continent containing a zone
	 */
	private findContinentForZone(zoneId: string): Continent | null {
		if (!this.worldData) return null;

		for (const continent of this.worldData.continents) {
			if (continent.zones.find((z) => z.id === zoneId)) {
				return continent;
			}
		}

		return null;
	}

	/**
	 * Find continent containing a town
	 */
	private findContinentForTown(townId: string): Continent | null {
		if (!this.worldData) return null;

		for (const continent of this.worldData.continents) {
			if (continent.towns.find((t) => t.id === townId)) {
				return continent;
			}
		}

		return null;
	}

	/**
	 * Get zones in current continent
	 */
	getZonesInCurrentContinent(): Zone[] {
		return this.currentContinent?.zones || [];
	}

	/**
	 * Get towns in current continent
	 */
	getTownsInCurrentContinent(): Town[] {
		return this.currentContinent?.towns || [];
	}

	/**
	 * Get zones by level range
	 */
	getZonesByLevel(playerLevel: number): Zone[] {
		if (!this.worldData) return [];

		const zones: Zone[] = [];

		for (const continent of this.worldData.continents) {
			for (const zone of continent.zones) {
				if (playerLevel >= zone.level_range[0] && playerLevel <= zone.level_range[1]) {
					zones.push(zone);
				}
			}
		}

		return zones;
	}

	/**
	 * Get current location info
	 */
	getCurrentLocation(): {
		continent: Continent | null;
		zone: Zone | null;
		town: Town | null;
		position: Position;
	} {
		return {
			continent: this.currentContinent,
			zone: this.currentZone,
			town: this.currentTown,
			position: { ...this.currentPosition },
		};
	}

	/**
	 * Update player position
	 */
	setPosition(position: Position): void {
		this.currentPosition = position;
	}

	/**
	 * Get current position
	 */
	getPosition(): Position {
		return { ...this.currentPosition };
	}

	/**
	 * Check if town is unlocked
	 */
	isTownUnlocked(townId: string): boolean {
		return this.unlockedTowns.has(townId);
	}

	/**
	 * Get all unlocked towns
	 */
	getUnlockedTowns(): string[] {
		return Array.from(this.unlockedTowns);
	}

	/**
	 * Unlock a town
	 */
	unlockTown(townId: string): void {
		this.unlockedTowns.add(townId);
	}

	/**
	 * Export world state for save
	 */
	export(): any {
		return {
			currentContinent: this.currentContinent?.id,
			currentZone: this.currentZone?.id,
			currentTown: this.currentTown?.id,
			currentPosition: this.currentPosition,
			unlockedTowns: Array.from(this.unlockedTowns),
		};
	}

	/**
	 * Import world state from save
	 */
	import(data: any): void {
		if (data.currentContinent) {
			this.currentContinent = this.getContinent(data.currentContinent);
		}

		if (data.currentZone) {
			this.currentZone = this.getZone(data.currentZone);
		}

		if (data.currentTown) {
			this.currentTown = this.getTown(data.currentTown);
		}

		if (data.currentPosition) {
			this.currentPosition = data.currentPosition;
		}

		if (data.unlockedTowns) {
			this.unlockedTowns = new Set(data.unlockedTowns);
		}
	}

	/**
	 * Clear world state
	 */
	clear(): void {
		this.currentContinent = null;
		this.currentZone = null;
		this.currentTown = null;
		this.currentPosition = { x: 0, y: 0 };
		this.unlockedTowns.clear();
	}
}
