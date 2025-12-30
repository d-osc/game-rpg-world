/**
 * MonsterSpawner
 * Manages monster spawning and respawning in zones
 */

import { EventEmitter } from '../utils/EventEmitter.ts';
import type { Position } from './WorldManager.ts';
import type { Zone } from './WorldManager.ts';

export interface SpawnPoint {
	id: string;
	position: Position;
	radius: number;
	monsterTypes: string[];
	spawnInterval: number;
	maxMonsters: number;
}

export interface SpawnedMonster {
	id: string;
	monsterId: string;
	position: Position;
	spawnPointId: string;
	spawnedAt: number;
	isAlive: boolean;
}

export interface MonsterSpawnerEvents {
	'monster-spawned': (monster: SpawnedMonster) => void;
	'monster-despawned': (monsterId: string) => void;
	'monster-killed': (monsterId: string) => void;
}

export class MonsterSpawner extends EventEmitter<MonsterSpawnerEvents> {
	private spawnPoints: Map<string, SpawnPoint> = new Map();
	private spawnedMonsters: Map<string, SpawnedMonster> = new Map();
	private spawnTimers: Map<string, number> = new Map();
	private monsterIdCounter: number = 0;

	constructor() {
		super();
	}

	/**
	 * Create spawn points for a zone
	 */
	createSpawnPoints(zone: Zone): void {
		if (!zone.spawn_points || !zone.monsters) return;

		const numSpawnPoints = zone.spawn_points;
		const monstersPerPoint = Math.ceil(zone.monsters.length / numSpawnPoints);

		for (let i = 0; i < numSpawnPoints; i++) {
			// Generate random position within zone bounds
			const position: Position = {
				x: zone.position.x + Math.random() * zone.size.width,
				y: zone.position.y + Math.random() * zone.size.height,
			};

			// Assign monster types to this spawn point
			const startIdx = (i * monstersPerPoint) % zone.monsters.length;
			const monsterTypes = zone.monsters.slice(startIdx, startIdx + monstersPerPoint);

			if (monsterTypes.length === 0) {
				monsterTypes.push(zone.monsters[0]);
			}

			const spawnPoint: SpawnPoint = {
				id: `${zone.id}_spawn_${i}`,
				position,
				radius: 100,
				monsterTypes,
				spawnInterval: zone.respawn_time || 30000,
				maxMonsters: 3,
			};

			this.spawnPoints.set(spawnPoint.id, spawnPoint);

			// Start spawning
			this.startSpawning(spawnPoint.id);
		}
	}

	/**
	 * Start spawning at a spawn point
	 */
	private startSpawning(spawnPointId: string): void {
		const spawnPoint = this.spawnPoints.get(spawnPointId);
		if (!spawnPoint) return;

		// Initial spawn
		this.spawnMonsters(spawnPointId);

		// Setup respawn timer
		const timerId = window.setInterval(() => {
			this.spawnMonsters(spawnPointId);
		}, spawnPoint.spawnInterval);

		this.spawnTimers.set(spawnPointId, timerId);
	}

	/**
	 * Spawn monsters at a spawn point
	 */
	private spawnMonsters(spawnPointId: string): void {
		const spawnPoint = this.spawnPoints.get(spawnPointId);
		if (!spawnPoint) return;

		// Count current alive monsters at this spawn point
		const aliveCount = Array.from(this.spawnedMonsters.values()).filter(
			(m) => m.spawnPointId === spawnPointId && m.isAlive,
		).length;

		// Spawn up to max
		const toSpawn = spawnPoint.maxMonsters - aliveCount;

		for (let i = 0; i < toSpawn; i++) {
			// Random monster type from spawn point
			const monsterType =
				spawnPoint.monsterTypes[Math.floor(Math.random() * spawnPoint.monsterTypes.length)];

			// Random position within spawn point radius
			const angle = Math.random() * Math.PI * 2;
			const distance = Math.random() * spawnPoint.radius;

			const position: Position = {
				x: spawnPoint.position.x + Math.cos(angle) * distance,
				y: spawnPoint.position.y + Math.sin(angle) * distance,
			};

			const monster: SpawnedMonster = {
				id: `monster_${this.monsterIdCounter++}`,
				monsterId: monsterType,
				position,
				spawnPointId,
				spawnedAt: Date.now(),
				isAlive: true,
			};

			this.spawnedMonsters.set(monster.id, monster);
			this.emit('monster-spawned', monster);
		}
	}

	/**
	 * Mark monster as killed
	 */
	killMonster(monsterId: string): void {
		const monster = this.spawnedMonsters.get(monsterId);
		if (!monster) return;

		monster.isAlive = false;
		this.emit('monster-killed', monsterId);

		// Remove after delay to allow loot pickup
		setTimeout(() => {
			this.despawnMonster(monsterId);
		}, 5000);
	}

	/**
	 * Despawn monster
	 */
	despawnMonster(monsterId: string): void {
		const monster = this.spawnedMonsters.get(monsterId);
		if (!monster) return;

		this.spawnedMonsters.delete(monsterId);
		this.emit('monster-despawned', monsterId);
	}

	/**
	 * Get all spawned monsters
	 */
	getAllMonsters(): SpawnedMonster[] {
		return Array.from(this.spawnedMonsters.values());
	}

	/**
	 * Get alive monsters
	 */
	getAliveMonsters(): SpawnedMonster[] {
		return Array.from(this.spawnedMonsters.values()).filter((m) => m.isAlive);
	}

	/**
	 * Get monster by ID
	 */
	getMonster(monsterId: string): SpawnedMonster | undefined {
		return this.spawnedMonsters.get(monsterId);
	}

	/**
	 * Get monsters near position
	 */
	getMonstersNearPosition(position: Position, radius: number): SpawnedMonster[] {
		const nearbyMonsters: SpawnedMonster[] = [];

		for (const monster of this.spawnedMonsters.values()) {
			if (!monster.isAlive) continue;

			const distance = Math.sqrt(
				Math.pow(monster.position.x - position.x, 2) +
				Math.pow(monster.position.y - position.y, 2),
			);

			if (distance <= radius) {
				nearbyMonsters.push(monster);
			}
		}

		return nearbyMonsters;
	}

	/**
	 * Clear spawn points and monsters for a zone
	 */
	clearZone(zoneId: string): void {
		// Clear spawn points
		const spawnPointIds = Array.from(this.spawnPoints.keys()).filter((id) => id.startsWith(zoneId));

		for (const spawnPointId of spawnPointIds) {
			// Stop timer
			const timerId = this.spawnTimers.get(spawnPointId);
			if (timerId !== undefined) {
				clearInterval(timerId);
				this.spawnTimers.delete(spawnPointId);
			}

			this.spawnPoints.delete(spawnPointId);
		}

		// Clear monsters from this zone
		const monsterIds = Array.from(this.spawnedMonsters.keys()).filter((id) => {
			const monster = this.spawnedMonsters.get(id);
			return monster?.spawnPointId.startsWith(zoneId);
		});

		for (const monsterId of monsterIds) {
			this.spawnedMonsters.delete(monsterId);
		}
	}

	/**
	 * Clear all spawn points and monsters
	 */
	clearAll(): void {
		// Stop all timers
		for (const timerId of this.spawnTimers.values()) {
			clearInterval(timerId);
		}

		this.spawnPoints.clear();
		this.spawnedMonsters.clear();
		this.spawnTimers.clear();
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.clearAll();
	}
}
