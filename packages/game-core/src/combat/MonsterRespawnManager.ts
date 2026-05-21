/**
 * MonsterRespawnManager
 * Manages monster spawning and respawning in zones
 */

import { Vector2 } from '@rpg/game-engine';
import { WorldMonster } from './WorldMonster';
import { dataLoader, type MonsterData } from '../data/DataLoader';

interface RespawnEntry {
	monsterData: MonsterData;
	level: number;
	spawnPosition: Vector2;
	respawnAt: number;
}

export class MonsterRespawnManager {
	private respawnQueue: RespawnEntry[] = [];
	private zoneMonsterIds: string[] = [];
	private levelRange: [number, number] = [1, 5];
	private maxAliveMonsters: number = 8;
	private baseRespawnTime: number = 30000; // 30s
	private spawnPoints: Vector2[] = [];
	private initialized: boolean = false;

	initializeZone(
		zoneMonsterIds: string[],
		levelRange: [number, number],
		mapWidth: number,
		mapHeight: number,
		maxAlive: number = 8,
	): void {
		this.zoneMonsterIds = zoneMonsterIds;
		this.levelRange = levelRange;
		this.maxAliveMonsters = maxAlive;
		this.spawnPoints = this.generateSpawnPoints(mapWidth, mapHeight, 15);
		this.initialized = true;
	}

	generateInitialSpawns(): { monsterData: MonsterData; level: number; position: Vector2 }[] {
		if (!this.initialized || this.zoneMonsterIds.length === 0) return [];

		const spawns: { monsterData: MonsterData; level: number; position: Vector2 }[] = [];
		const count = Math.min(this.maxAliveMonsters, this.spawnPoints.length);

		for (let i = 0; i < count; i++) {
			const monsterId = this.zoneMonsterIds[i % this.zoneMonsterIds.length]!;
			const monsterData = this.getMonsterData(monsterId);
			if (!monsterData) continue;

			const level = this.randomLevel();
			const position = this.spawnPoints[i % this.spawnPoints.length]!;
			spawns.push({ monsterData, level, position });
		}

		return spawns;
	}

	queueRespawn(monsterData: MonsterData, level: number, spawnPosition: Vector2): void {
		const delay = this.baseRespawnTime + Math.random() * 10000;
		this.respawnQueue.push({
			monsterData,
			level,
			spawnPosition,
			respawnAt: Date.now() + delay,
		});
	}

	update(currentTime: number, aliveCount: number): { monsterData: MonsterData; level: number; position: Vector2 } | null {
		if (!this.initialized) return null;

		// Check respawn queue
		for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
			const entry = this.respawnQueue[i]!;
			if (currentTime >= entry.respawnAt && aliveCount < this.maxAliveMonsters) {
				this.respawnQueue.splice(i, 1);
				// Slightly randomize respawn position
				const pos = new Vector2(
					entry.spawnPosition.x + (Math.random() - 0.5) * 40,
					entry.spawnPosition.y + (Math.random() - 0.5) * 40,
				);
				return { monsterData: entry.monsterData, level: entry.level, position: pos };
			}
		}

		return null;
	}

	private generateSpawnPoints(mapWidth: number, mapHeight: number, count: number): Vector2[] {
		const points: Vector2[] = [];
		const margin = 60;
		for (let i = 0; i < count; i++) {
			points.push(new Vector2(
				margin + Math.random() * (mapWidth - margin * 2),
				margin + Math.random() * (mapHeight - margin * 2),
			));
		}
		return points;
	}

	private randomLevel(): number {
		const [min, max] = this.levelRange;
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	private getMonsterData(id: string): MonsterData | null {
		return dataLoader.getMonster(id) ?? null;
	}
}
