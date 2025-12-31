/**
 * CombatSync
 * P2P combat synchronization for deterministic combat
 */

import type { CombatAction, CombatEntity, DamageResult } from './CombatManager';
import { EventEmitter } from '../utils/EventEmitter';

export interface CombatSyncMessage {
	type: 'combat-init' | 'combat-action' | 'combat-result' | 'combat-end';
	combatId: string;
	timestamp: number;
	data: any;
}

export interface CombatInitData {
	players: CombatEntity[];
	seed: number; // For deterministic RNG
}

export interface CombatActionData {
	turnNumber: number;
	action: CombatAction;
	actorState: {
		hp: number;
		mp: number;
	};
}

export interface CombatResultData {
	turnNumber: number;
	result: DamageResult;
	targetState: {
		hp: number;
		mp: number;
	};
	hash: string; // Validation hash
}

export interface CombatEndData {
	result: 'victory' | 'defeat' | 'fled';
	finalStates: Map<string, CombatEntity>;
}

export interface CombatSyncEvents {
	'sync-received': (message: CombatSyncMessage) => void;
	'desync-detected': (message: string) => void;
	'combat-validated': () => void;
}

export class CombatSync extends EventEmitter<CombatSyncEvents> {
	private combatId: string;
	private localPlayerId: string;
	private seed: number;
	private actionHistory: CombatActionData[] = [];
	private resultHistory: CombatResultData[] = [];
	private sendCallback: ((data: any) => void) | null = null;

	constructor(combatId: string, localPlayerId: string, seed?: number) {
		super();
		this.combatId = combatId;
		this.localPlayerId = localPlayerId;
		this.seed = seed || Date.now();
	}

	/**
	 * Set send callback for P2P messaging
	 */
	setSendCallback(callback: (data: any) => void): void {
		this.sendCallback = callback;
	}

	/**
	 * Send combat init to peer
	 */
	sendCombatInit(players: CombatEntity[]): void {
		const message: CombatSyncMessage = {
			type: 'combat-init',
			combatId: this.combatId,
			timestamp: Date.now(),
			data: {
				players,
				seed: this.seed,
			} as CombatInitData,
		};

		this.send(message);
	}

	/**
	 * Send action to peer
	 */
	sendAction(turnNumber: number, action: CombatAction, actorState: { hp: number; mp: number }): void {
		const actionData: CombatActionData = {
			turnNumber,
			action,
			actorState,
		};

		// Store in history
		this.actionHistory.push(actionData);

		const message: CombatSyncMessage = {
			type: 'combat-action',
			combatId: this.combatId,
			timestamp: Date.now(),
			data: actionData,
		};

		this.send(message);
	}

	/**
	 * Send result to peer
	 */
	sendResult(
		turnNumber: number,
		result: DamageResult,
		targetState: { hp: number; mp: number },
	): void {
		const hash = this.calculateResultHash(turnNumber, result, targetState);

		const resultData: CombatResultData = {
			turnNumber,
			result,
			targetState,
			hash,
		};

		// Store in history
		this.resultHistory.push(resultData);

		const message: CombatSyncMessage = {
			type: 'combat-result',
			combatId: this.combatId,
			timestamp: Date.now(),
			data: resultData,
		};

		this.send(message);
	}

	/**
	 * Send combat end to peer
	 */
	sendCombatEnd(result: 'victory' | 'defeat' | 'fled', finalStates: Map<string, CombatEntity>): void {
		const message: CombatSyncMessage = {
			type: 'combat-end',
			combatId: this.combatId,
			timestamp: Date.now(),
			data: {
				result,
				finalStates: Array.from(finalStates.entries()),
			},
		};

		this.send(message);
	}

	/**
	 * Handle received message from peer
	 */
	handleMessage(message: CombatSyncMessage): void {
		// Validate combat ID
		if (message.combatId !== this.combatId) {
			console.warn('[CombatSync] Received message for different combat');
			return;
		}

		this.emit('sync-received', message);

		switch (message.type) {
			case 'combat-init':
				this.validateCombatInit(message.data);
				break;
			case 'combat-action':
				this.validateAction(message.data);
				break;
			case 'combat-result':
				this.validateResult(message.data);
				break;
			case 'combat-end':
				this.validateCombatEnd(message.data);
				break;
		}
	}

	/**
	 * Validate combat init
	 */
	private validateCombatInit(data: CombatInitData): void {
		// Ensure both sides use same seed for deterministic RNG
		if (data.seed !== this.seed) {
			console.warn('[CombatSync] Seed mismatch - using peer seed');
			this.seed = data.seed;
		}

		this.emit('combat-validated');
	}

	/**
	 * Validate action
	 */
	private validateAction(data: CombatActionData): void {
		// Check if action is in correct turn order
		const expectedTurn = this.actionHistory.length;
		if (data.turnNumber !== expectedTurn) {
			this.emit('desync-detected', `Turn number mismatch: expected ${expectedTurn}, got ${data.turnNumber}`);
			return;
		}

		// Store peer's action
		this.actionHistory.push(data);
		this.emit('combat-validated');
	}

	/**
	 * Validate result
	 */
	private validateResult(data: CombatResultData): void {
		// Verify hash matches
		const expectedHash = this.calculateResultHash(
			data.turnNumber,
			data.result,
			data.targetState,
		);

		if (data.hash !== expectedHash) {
			this.emit('desync-detected', `Result hash mismatch on turn ${data.turnNumber}`);
			return;
		}

		// Store validated result
		this.resultHistory.push(data);
		this.emit('combat-validated');
	}

	/**
	 * Validate combat end
	 */
	private validateCombatEnd(data: CombatEndData): void {
		// Can add final state validation here
		this.emit('combat-validated');
	}

	/**
	 * Calculate hash for result validation
	 */
	private calculateResultHash(
		turnNumber: number,
		result: DamageResult,
		targetState: { hp: number; mp: number },
	): string {
		const data = `${turnNumber}:${result.damage}:${result.isCritical}:${result.isWeak}:${result.isResisted}:${targetState.hp}:${targetState.mp}`;
		return this.simpleHash(data);
	}

	/**
	 * Simple hash function (for validation, not security)
	 */
	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return hash.toString(16);
	}

	/**
	 * Send message via callback
	 */
	private send(message: CombatSyncMessage): void {
		if (!this.sendCallback) {
			console.warn('[CombatSync] Send callback not set');
			return;
		}

		this.sendCallback({
			type: 'combat-sync',
			data: message,
		});
	}

	/**
	 * Get seeded random number (for deterministic RNG)
	 */
	getSeededRandom(): number {
		// Linear Congruential Generator
		this.seed = (this.seed * 9301 + 49297) % 233280;
		return this.seed / 233280;
	}

	/**
	 * Get action history
	 */
	getActionHistory(): CombatActionData[] {
		return [...this.actionHistory];
	}

	/**
	 * Get result history
	 */
	getResultHistory(): CombatResultData[] {
		return [...this.resultHistory];
	}

	/**
	 * Get combat ID
	 */
	getCombatId(): string {
		return this.combatId;
	}

	/**
	 * Get seed
	 */
	getSeed(): number {
		return this.seed;
	}

	/**
	 * Clear history
	 */
	clear(): void {
		this.actionHistory = [];
		this.resultHistory = [];
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.clear();
		this.sendCallback = null;
		this.removeAllListeners();
	}
}

/**
 * Deterministic Random Number Generator
 * Ensures both peers get same random results
 */
export class DeterministicRNG {
	private seed: number;

	constructor(seed: number) {
		this.seed = seed;
	}

	/**
	 * Get next random number (0-1)
	 */
	next(): number {
		this.seed = (this.seed * 9301 + 49297) % 233280;
		return this.seed / 233280;
	}

	/**
	 * Get random integer in range [min, max]
	 */
	nextInt(min: number, max: number): number {
		return Math.floor(this.next() * (max - min + 1)) + min;
	}

	/**
	 * Get random float in range [min, max)
	 */
	nextFloat(min: number, max: number): number {
		return this.next() * (max - min) + min;
	}

	/**
	 * Get random boolean
	 */
	nextBool(): boolean {
		return this.next() < 0.5;
	}

	/**
	 * Reset seed
	 */
	reset(seed: number): void {
		this.seed = seed;
	}

	/**
	 * Get current seed
	 */
	getSeed(): number {
		return this.seed;
	}
}
