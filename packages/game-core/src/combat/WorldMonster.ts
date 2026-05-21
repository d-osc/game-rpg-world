/**
 * WorldMonster
 * Living monster entity in the world with AI state machine
 */

import { Vector2 } from '@rpg/game-engine';
import type { MonsterData } from '../data/DataLoader';

export enum MonsterAIState {
	IDLE = 'idle',
	PATROL = 'patrol',
	CHASE = 'chase',
	ATTACK = 'attack',
	RETURN = 'return',
	DEAD = 'dead',
}

export interface CombatStats {
	hp: number;
	maxHp: number;
	mp: number;
	maxMp: number;
	atk: number;
	def: number;
	spd: number;
	luck: number;
}

export interface ActiveStatusEffect {
	type: string;
	value: number;
	remainingMs: number;
	tickIntervalMs: number;
	tickElapsedMs: number;
}

let nextMonsterId = 1;

export class WorldMonster {
	readonly id: string;
	readonly monsterData: MonsterData;
	readonly level: number;
	readonly stats: CombatStats;
	readonly spawnPosition: Vector2;

	position: Vector2;
	direction: Vector2 = new Vector2(0, 1);
	aiState: MonsterAIState = MonsterAIState.IDLE;

	aggroRange: number = 200;
	attackRange: number = 60;
	leashRange: number = 400;
	moveSpeed: number;
	attackCooldown: number = 0;
	attackInterval: number = 1.5;

	statusEffects: ActiveStatusEffect[] = [];

	// Patrol state
	private patrolTarget: Vector2 | null = null;
	private idleTimer: number = 0;

	constructor(monsterData: MonsterData, level: number, spawnPosition: Vector2) {
		this.id = `monster_${nextMonsterId++}`;
		this.monsterData = monsterData;
		this.level = level;
		this.spawnPosition = spawnPosition.clone();
		this.position = spawnPosition.clone();

		// Scale stats by level
		const s = monsterData.stats;
		const levelScale = 1 + (level - 1) * 0.15;
		this.stats = {
			hp: Math.floor(s.hp * levelScale),
			maxHp: Math.floor(s.hp * levelScale),
			mp: Math.floor(s.mp * levelScale),
			maxMp: Math.floor(s.mp * levelScale),
			atk: Math.floor(s.atk * levelScale),
			def: Math.floor(s.def * levelScale),
			spd: Math.floor(s.spd * levelScale),
			luck: Math.floor(s.luck * levelScale),
		};

		this.moveSpeed = 40 + s.spd * 0.5;

		// AI pattern adjustments
		if (monsterData.aiPattern === 'aggressive') {
			this.aggroRange = 280;
			this.moveSpeed *= 1.2;
		} else if (monsterData.aiPattern === 'defensive') {
			this.aggroRange = 120;
		}
	}

	update(deltaTime: number, playerPos: Vector2): void {
		if (this.aiState === MonsterAIState.DEAD) return;

		this.updateStatusEffects(deltaTime);
		this.updateAttackCooldown(deltaTime);

		const distToPlayer = this.position.distance(playerPos);

		switch (this.aiState) {
			case MonsterAIState.IDLE:
				this.updateIdle(deltaTime, distToPlayer);
				break;
			case MonsterAIState.PATROL:
				this.updatePatrol(deltaTime, distToPlayer, playerPos);
				break;
			case MonsterAIState.CHASE:
				this.updateChase(deltaTime, distToPlayer, playerPos);
				break;
			case MonsterAIState.ATTACK:
				this.updateAttack(deltaTime, distToPlayer, playerPos);
				break;
			case MonsterAIState.RETURN:
				this.updateReturn(deltaTime);
				break;
		}
	}

	private updateIdle(deltaTime: number, distToPlayer: number): void {
		if (distToPlayer < this.aggroRange) {
			this.aiState = MonsterAIState.CHASE;
			return;
		}

		this.idleTimer += deltaTime;
		if (this.idleTimer > 2 + Math.random() * 3) {
			this.idleTimer = 0;
			this.pickPatrolTarget();
			this.aiState = MonsterAIState.PATROL;
		}
	}

	private updatePatrol(deltaTime: number, distToPlayer: number, playerPos: Vector2): void {
		if (distToPlayer < this.aggroRange) {
			this.aiState = MonsterAIState.CHASE;
			return;
		}

		if (this.patrolTarget) {
			this.moveToward(this.patrolTarget, this.moveSpeed * 0.4, deltaTime);
			if (this.position.distance(this.patrolTarget) < 10) {
				this.patrolTarget = null;
				this.aiState = MonsterAIState.IDLE;
			}
		} else {
			this.aiState = MonsterAIState.IDLE;
		}
	}

	private updateChase(deltaTime: number, distToPlayer: number, playerPos: Vector2): void {
		if (distToPlayer > this.leashRange) {
			this.aiState = MonsterAIState.RETURN;
			return;
		}

		if (distToPlayer <= this.attackRange) {
			this.aiState = MonsterAIState.ATTACK;
			return;
		}

		this.moveToward(playerPos, this.moveSpeed, deltaTime);
	}

	private updateAttack(deltaTime: number, distToPlayer: number, playerPos: Vector2): void {
		if (distToPlayer > this.attackRange * 1.5) {
			this.aiState = MonsterAIState.CHASE;
			return;
		}

		// Face player
		const dir = new Vector2(playerPos.x - this.position.x, playerPos.y - this.position.y);
		if (dir.length() > 0) this.direction = dir.normalize();
	}

	private updateReturn(deltaTime: number): void {
		const distToSpawn = this.position.distance(this.spawnPosition);
		if (distToSpawn < 20) {
			// Heal to full on return
			this.stats.hp = this.stats.maxHp;
			this.aiState = MonsterAIState.IDLE;
			return;
		}
		this.moveToward(this.spawnPosition, this.moveSpeed, deltaTime);
	}

	private moveToward(target: Vector2, speed: number, deltaTime: number): void {
		const dir = new Vector2(target.x - this.position.x, target.y - this.position.y);
		const dist = dir.length();
		if (dist < 1) return;

		this.direction = dir.normalize();
		const step = Math.min(speed * deltaTime, dist);
		this.position = new Vector2(
			this.position.x + this.direction.x * step,
			this.position.y + this.direction.y * step,
		);
	}

	private pickPatrolTarget(): void {
		const angle = Math.random() * Math.PI * 2;
		const radius = 30 + Math.random() * 60;
		this.patrolTarget = new Vector2(
			this.spawnPosition.x + Math.cos(angle) * radius,
			this.spawnPosition.y + Math.sin(angle) * radius,
		);
	}

	private updateAttackCooldown(deltaTime: number): void {
		if (this.attackCooldown > 0) {
			this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
		}
	}

	private updateStatusEffects(deltaTime: number): void {
		const dtMs = deltaTime * 1000;
		for (let i = this.statusEffects.length - 1; i >= 0; i--) {
			const effect = this.statusEffects[i]!;
			effect.remainingMs -= dtMs;
			effect.tickElapsedMs += dtMs;

			if (effect.remainingMs <= 0) {
				this.statusEffects.splice(i, 1);
				continue;
			}

			if (effect.tickElapsedMs >= effect.tickIntervalMs) {
				effect.tickElapsedMs = 0;
				if (effect.type === 'burn' || effect.type === 'poison') {
					const dmg = Math.max(1, Math.floor(this.stats.maxHp * effect.value));
					this.takeDamage(dmg);
				}
			}
		}
	}

	takeDamage(amount: number): void {
		this.stats.hp = Math.max(0, this.stats.hp - amount);
		if (this.stats.hp <= 0) {
			this.aiState = MonsterAIState.DEAD;
		} else if (this.aiState === MonsterAIState.IDLE || this.aiState === MonsterAIState.PATROL) {
			this.aiState = MonsterAIState.CHASE;
		}
	}

	canAttack(): boolean {
		return this.aiState === MonsterAIState.ATTACK && this.attackCooldown <= 0;
	}

	onAttack(): void {
		this.attackCooldown = this.attackInterval;
	}

	isAlive(): boolean {
		return this.aiState !== MonsterAIState.DEAD;
	}
}
