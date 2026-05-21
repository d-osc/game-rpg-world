/**
 * DamageFormulas
 * Shared damage calculation utilities extracted from CombatManager
 * Used by both turn-based and real-time combat systems
 */

const ELEMENT_CHART: Map<string, { weak: string[]; resist: string[] }> = new Map([
	['fire', { weak: ['earth'], resist: ['water'] }],
	['water', { weak: ['fire'], resist: ['earth'] }],
	['earth', { weak: ['water'], resist: ['fire'] }],
	['neutral', { weak: [], resist: [] }],
]);

export class DamageFormulas {
	static calculateBaseDamage(atk: number, def: number): number {
		const raw = Math.max(1, atk * 2 - def);
		const variance = 0.85 + Math.random() * 0.15;
		return Math.floor(raw * variance);
	}

	static rollCritical(luck: number): boolean {
		const chance = 0.05 + luck / 1000;
		return Math.random() < chance;
	}

	static checkElementEffectiveness(
		attackElement: string,
		defenseElement: string,
	): { isWeak: boolean; isResisted: boolean } {
		const data = ELEMENT_CHART.get(attackElement);
		if (!data) return { isWeak: false, isResisted: false };
		return {
			isWeak: data.weak.includes(defenseElement),
			isResisted: data.resist.includes(defenseElement),
		};
	}

	static calculateSkillDamage(
		power: number,
		type: string,
		userAtk: number,
		targetDef: number,
		userLuck: number,
	): number {
		if (type === 'magic') {
			return Math.max(1, Math.floor((userLuck * power / 100) - (targetDef * 0.3)));
		}
		return Math.max(1, Math.floor((userAtk * power / 100) - (targetDef * 0.5)));
	}
}
