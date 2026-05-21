/**
 * RealtimeCombatSystem
 * Real-time action RPG combat — monsters roam the world, player attacks with key presses
 */

import { Vector2 } from '@rpg/game-engine';
import { EventEmitter } from '../utils/EventEmitter';
import { DamageFormulas } from './DamageFormulas';
import { CooldownTracker } from './CooldownTracker';
import { WorldMonster, type CombatStats } from './WorldMonster';
import { lootSystem, type LootResult } from './LootSystem';
import { dataLoader, type MonsterData, type SkillData } from '../data/DataLoader';
import { gameStateManager } from '../state/GameStateManager';

export interface RealtimeCombatEvents {
	'monster-damaged': (monsterId: string, damage: number, isCrit: boolean) => void;
	'monster-killed': (monsterId: string, loot: LootResult) => void;
	'player-damaged': (damage: number, sourceId: string) => void;
	'damage-number': (pos: { x: number; y: number }, damage: number, isCrit: boolean, isHeal: boolean) => void;
	'player-healed': (amount: number) => void;
}

const BASIC_ATTACK_COOLDOWN = 500; // ms
const STRONG_ATTACK_COOLDOWN = 900; // ms
const ATTACK_RANGE = 80; // pixels
const ATTACK_CONE_COS = 0.5; // ~60 degrees half-angle (cos(60°))

export class RealtimeCombatSystem extends EventEmitter<RealtimeCombatEvents> {
	private monsters: Map<string, WorldMonster> = new Map();
	private cooldowns: CooldownTracker = new CooldownTracker();
	private playerStats: CombatStats;

	constructor() {
		super();
		this.playerStats = this.loadPlayerStats();
	}

	private loadPlayerStats(): CombatStats {
		try {
			const ps = gameStateManager.getPlayerState();
			return {
				hp: ps.stats.hp,
				maxHp: ps.stats.maxHp,
				mp: ps.stats.mp,
				maxMp: ps.stats.maxMp,
				atk: ps.stats.atk,
				def: ps.stats.def,
				spd: ps.stats.spd,
				luck: ps.stats.luck,
			};
		} catch {
			return { hp: 100, maxHp: 100, mp: 30, maxMp: 30, atk: 10, def: 5, spd: 10, luck: 5 };
		}
	}

	syncPlayerStats(): void {
		this.playerStats = this.loadPlayerStats();
	}

	getPlayerStats(): CombatStats {
		return this.playerStats;
	}

	update(deltaTime: number, playerPos: Vector2): void {
		this.cooldowns.update(deltaTime);

		for (const [id, monster] of this.monsters) {
			monster.update(deltaTime, playerPos);

			// Monster attacks player
			if (monster.canAttack()) {
				const dmg = DamageFormulas.calculateBaseDamage(monster.stats.atk, this.playerStats.def);
				const isCrit = DamageFormulas.rollCritical(monster.stats.luck);
				const finalDmg = isCrit ? Math.floor(dmg * 1.5) : dmg;

				this.playerStats.hp = Math.max(0, this.playerStats.hp - finalDmg);
				monster.onAttack();

				this.emit('player-damaged', finalDmg, id);
				this.emit('damage-number', { x: playerPos.x, y: playerPos.y }, finalDmg, isCrit, false);

				// Sync back to GameStateManager
				const ps = gameStateManager.getPlayerState();
				if (ps) ps.stats.hp = this.playerStats.hp;

				if (this.playerStats.hp <= 0) {
					// Player death handled by WorldScene
				}
			}

			// Status effect damage (burn/poison)
			if (!monster.isAlive() && monster.aiState === 'dead') {
				// Check if we already processed death
				if (this.monsters.has(id)) {
					this.onMonsterDeath(monster);
				}
			}
		}
	}

	playerAttack(playerPos: Vector2, facing: Vector2, hand: 'left' | 'right' = 'left'): boolean {
		const cdKey = hand === 'left' ? 'player_attack_left' : 'player_attack_right';
		const cooldown = hand === 'left' ? BASIC_ATTACK_COOLDOWN : STRONG_ATTACK_COOLDOWN;
		const dmgMult = hand === 'left' ? 1.0 : 1.6;

		if (!this.cooldowns.isReady(cdKey)) return false;
		this.cooldowns.start(cdKey, cooldown);

		const dir = facing.length() > 0 ? facing.normalize() : new Vector2(0, 1);
		let hitAny = false;

		for (const [id, monster] of this.monsters) {
			if (!monster.isAlive()) continue;

			const toMonster = new Vector2(
				monster.position.x - playerPos.x,
				monster.position.y - playerPos.y,
			);
			const dist = toMonster.length();
			if (dist > ATTACK_RANGE) continue;

			// Cone check
			if (dist > 1) {
				const dot = dir.x * (toMonster.x / dist) + dir.y * (toMonster.y / dist);
				if (dot < ATTACK_CONE_COS) continue;
			}

			let dmg = Math.floor(DamageFormulas.calculateBaseDamage(this.playerStats.atk, monster.stats.def) * dmgMult);
			const isCrit = DamageFormulas.rollCritical(this.playerStats.luck);
			if (isCrit) dmg = Math.floor(dmg * 1.5);

			monster.takeDamage(dmg);
			this.emit('monster-damaged', id, dmg, isCrit);
			this.emit('damage-number', { x: monster.position.x, y: monster.position.y }, dmg, isCrit, false);
			hitAny = true;

			if (!monster.isAlive()) {
				this.onMonsterDeath(monster);
			}
		}

		return hitAny;
	}

	playerUseSkill(skillId: string, playerPos: Vector2, facing: Vector2): boolean {
		const skill = dataLoader.getSkill(skillId);
		if (!skill) return false;

		const cdKey = `player_skill_${skillId}`;
		if (!this.cooldowns.isReady(cdKey)) return false;

		// Check MP
		if (this.playerStats.mp < skill.mpCost) return false;

		// Consume MP
		this.playerStats.mp -= skill.mpCost;
		const ps = gameStateManager.getPlayerState();
		if (ps) ps.stats.mp = this.playerStats.mp;

		const cooldown = skill.cooldown ?? 3;
		this.cooldowns.start(cdKey, cooldown * 1000);

		const dir = facing.length() > 0 ? facing.normalize() : new Vector2(0, 1);

		// Determine targets
		if (skill.type === 'healing' || skill.type === 'support') {
			const healAmount = Math.floor(this.playerStats.maxHp * (skill.power / 100));
			this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + healAmount);
			if (ps) ps.stats.hp = this.playerStats.hp;
			this.emit('player-healed', healAmount);
			this.emit('damage-number', { x: playerPos.x, y: playerPos.y }, healAmount, false, true);
			return true;
		}

		// Offensive skill — hit monsters in range
		const skillRange = ATTACK_RANGE * 2;
		let hitAny = false;

		for (const [id, monster] of this.monsters) {
			if (!monster.isAlive()) continue;

			const toMonster = new Vector2(
				monster.position.x - playerPos.x,
				monster.position.y - playerPos.y,
			);
			const dist = toMonster.length();
			if (dist > skillRange) continue;

			// AOE hits all, single-target needs facing
			if (skill.target === 'single' && dist > 1) {
				const dot = dir.x * (toMonster.x / dist) + dir.y * (toMonster.y / dist);
				if (dot < 0) continue;
			}

			let dmg = DamageFormulas.calculateSkillDamage(
				skill.power, skill.type ?? 'physical',
				this.playerStats.atk, monster.stats.def, this.playerStats.luck,
			);
			const isCrit = DamageFormulas.rollCritical(this.playerStats.luck);
			if (isCrit) dmg = Math.floor(dmg * 1.5);

			// Element check
			const elem = DamageFormulas.checkElementEffectiveness(skill.element ?? 'neutral', monster.monsterData.element);
			if (elem.isWeak) dmg = Math.floor(dmg * 1.5);
			if (elem.isResisted) dmg = Math.floor(dmg * 0.5);

			monster.takeDamage(dmg);
			this.emit('monster-damaged', id, dmg, isCrit);
			this.emit('damage-number', { x: monster.position.x, y: monster.position.y }, dmg, isCrit, false);
			hitAny = true;

			if (!monster.isAlive()) {
				this.onMonsterDeath(monster);
			}
		}

		return hitAny;
	}

	spawnMonster(monsterData: MonsterData, level: number, position: Vector2): WorldMonster {
		const monster = new WorldMonster(monsterData, level, position);
		this.monsters.set(monster.id, monster);
		return monster;
	}

	removeMonster(monsterId: string): void {
		this.monsters.delete(monsterId);
	}

	getMonsters(): WorldMonster[] {
		return Array.from(this.monsters.values());
	}

	getAliveMonsters(): WorldMonster[] {
		return Array.from(this.monsters.values()).filter(m => m.isAlive());
	}

	getAliveMonsterCount(): number {
		let count = 0;
		for (const m of this.monsters.values()) {
			if (m.isAlive()) count++;
		}
		return count;
	}

	isSkillReady(skillId: string): boolean {
		return this.cooldowns.isReady(`player_skill_${skillId}`);
	}

	getSkillCooldownRemaining(skillId: string): number {
		return this.cooldowns.getRemaining(`player_skill_${skillId}`);
	}

	getBasicAttackReady(): boolean {
		return this.cooldowns.isReady('player_attack_left');
	}

	getStrongAttackReady(): boolean {
		return this.cooldowns.isReady('player_attack_right');
	}

	private onMonsterDeath(monster: WorldMonster): void {
		const loot = lootSystem.generateLoot(monster.monsterData, monster.level);
		lootSystem.applyLoot(loot);

		this.syncPlayerStats(); // refresh after loot (may have leveled up)

		this.emit('monster-killed', monster.id, loot);

		// Remove from active monsters after a short delay (let death animation play)
		setTimeout(() => {
			this.monsters.delete(monster.id);
		}, 100);
	}

	clearAll(): void {
		this.monsters.clear();
		this.cooldowns.resetAll();
	}
}

export const realtimeCombatSystem = new RealtimeCombatSystem();
