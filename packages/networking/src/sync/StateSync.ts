/**
 * StateSync
 * Synchronizes game state between peers
 */

export interface PlayerState {
	playerId: string;
	position: { x: number; y: number };
	velocity?: { x: number; y: number };
	animation?: string;
	timestamp: number;
}

export class StateSync {
	private localPlayerId: string;
	private remotePlayers: Map<string, PlayerState> = new Map();
	private syncInterval: number = 100; // 10Hz (100ms)
	private lastSyncTime: number = 0;

	constructor(localPlayerId: string) {
		this.localPlayerId = localPlayerId;
	}

	/**
	 * Check if should sync (rate limiting)
	 */
	shouldSync(currentTime: number): boolean {
		return currentTime - this.lastSyncTime >= this.syncInterval;
	}

	/**
	 * Create sync message for local player
	 */
	createSyncMessage(playerState: Omit<PlayerState, 'playerId' | 'timestamp'>): PlayerState {
		this.lastSyncTime = Date.now();
		return {
			playerId: this.localPlayerId,
			...playerState,
			timestamp: this.lastSyncTime,
		};
	}

	/**
	 * Handle received player state
	 */
	updateRemotePlayer(state: PlayerState): void {
		const existing = this.remotePlayers.get(state.playerId);

		// Ignore old updates (out of order packets)
		if (existing && existing.timestamp > state.timestamp) {
			return;
		}

		this.remotePlayers.set(state.playerId, state);
	}

	/**
	 * Get remote player state
	 */
	getRemotePlayer(playerId: string): PlayerState | undefined {
		return this.remotePlayers.get(playerId);
	}

	/**
	 * Get all remote players
	 */
	getAllRemotePlayers(): PlayerState[] {
		return Array.from(this.remotePlayers.values());
	}

	/**
	 * Remove remote player
	 */
	removeRemotePlayer(playerId: string): void {
		this.remotePlayers.delete(playerId);
	}

	/**
	 * Clear all remote players
	 */
	clearAll(): void {
		this.remotePlayers.clear();
	}

	/**
	 * Interpolate remote player position for smooth movement
	 */
	interpolatePosition(
		playerId: string,
		deltaTime: number,
	): { x: number; y: number } | null {
		const player = this.remotePlayers.get(playerId);
		if (!player || !player.velocity) return null;

		// Simple linear interpolation based on velocity
		return {
			x: player.position.x + player.velocity.x * deltaTime,
			y: player.position.y + player.velocity.y * deltaTime,
		};
	}
}
