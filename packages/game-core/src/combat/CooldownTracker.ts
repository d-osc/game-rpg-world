/**
 * CooldownTracker
 * Generic cooldown manager for skills and attacks
 */

export class CooldownTracker {
	private cooldowns: Map<string, number> = new Map();

	update(deltaTime: number): void {
		const dtMs = deltaTime * 1000;
		for (const [key, remaining] of this.cooldowns) {
			const next = remaining - dtMs;
			if (next <= 0) {
				this.cooldowns.delete(key);
			} else {
				this.cooldowns.set(key, next);
			}
		}
	}

	start(key: string, durationMs: number): void {
		this.cooldowns.set(key, durationMs);
	}

	isReady(key: string): boolean {
		return !this.cooldowns.has(key);
	}

	getRemaining(key: string): number {
		return this.cooldowns.get(key) ?? 0;
	}

	getProgress(key: string, totalMs: number): number {
		const remaining = this.cooldowns.get(key);
		if (remaining === undefined) return 1;
		return 1 - (remaining / totalMs);
	}

	reset(key: string): void {
		this.cooldowns.delete(key);
	}

	resetAll(): void {
		this.cooldowns.clear();
	}
}
