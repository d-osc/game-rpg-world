/**
 * ZoneDiscovery
 * Manages zone-based peer discovery for P2P networking
 */

import { EventEmitter } from '../utils/EventEmitter';

export interface ZonePlayerInfo {
	playerId: string;
	playerName: string;
	zoneId: string;
	joinedAt: number;
}

export interface ZoneDiscoveryEvents {
	'player-joined-zone': (playerInfo: ZonePlayerInfo) => void;
	'player-left-zone': (playerId: string, zoneId: string) => void;
	'zone-capacity-changed': (zoneId: string, currentCount: number, maxCapacity: number) => void;
}

export class ZoneDiscovery extends EventEmitter<ZoneDiscoveryEvents> {
	private currentZone: string | null = null;
	private playersInZone: Map<string, ZonePlayerInfo> = new Map();
	private zoneCapacities: Map<string, number> = new Map();

	// Callback to network manager for peer connections
	private connectToPeerCallback: ((peerId: string) => void) | null = null;
	private disconnectFromPeerCallback: ((peerId: string) => void) | null = null;

	constructor() {
		super();
	}

	/**
	 * Set network callbacks
	 */
	setNetworkCallbacks(
		connectCallback: (peerId: string) => void,
		disconnectCallback: (peerId: string) => void,
	): void {
		this.connectToPeerCallback = connectCallback;
		this.disconnectFromPeerCallback = disconnectCallback;
	}

	/**
	 * Set zone capacity
	 */
	setZoneCapacity(zoneId: string, capacity: number): void {
		this.zoneCapacities.set(zoneId, capacity);
	}

	/**
	 * Join a zone
	 */
	joinZone(zoneId: string, playerId: string, playerName: string): void {
		// Leave current zone if any
		if (this.currentZone) {
			this.leaveZone();
		}

		this.currentZone = zoneId;

		// Add self to zone
		const playerInfo: ZonePlayerInfo = {
			playerId,
			playerName,
			zoneId,
			joinedAt: Date.now(),
		};

		this.playersInZone.set(playerId, playerInfo);

		// Notify about joining
		this.emit('player-joined-zone', playerInfo);

		// Connect to existing peers in zone
		for (const player of this.playersInZone.values()) {
			if (player.playerId !== playerId) {
				this.connectToPeerCallback?.(player.playerId);
			}
		}

		// Update capacity
		this.updateZoneCapacity(zoneId);
	}

	/**
	 * Leave current zone
	 */
	leaveZone(): void {
		if (!this.currentZone) return;

		const zoneId = this.currentZone;

		// Disconnect from all peers in zone
		for (const player of this.playersInZone.values()) {
			this.disconnectFromPeerCallback?.(player.playerId);
		}

		// Clear zone
		this.playersInZone.clear();
		this.currentZone = null;

		// Notify about leaving
		this.emit('player-left-zone', 'self', zoneId);

		// Update capacity
		this.updateZoneCapacity(zoneId);
	}

	/**
	 * Handle remote player joining zone
	 */
	handlePlayerJoined(playerInfo: ZonePlayerInfo): void {
		// Only handle if in same zone
		if (playerInfo.zoneId !== this.currentZone) return;

		// Add player
		this.playersInZone.set(playerInfo.playerId, playerInfo);

		// Connect to peer
		this.connectToPeerCallback?.(playerInfo.playerId);

		// Notify
		this.emit('player-joined-zone', playerInfo);

		// Update capacity
		this.updateZoneCapacity(playerInfo.zoneId);
	}

	/**
	 * Handle remote player leaving zone
	 */
	handlePlayerLeft(playerId: string, zoneId: string): void {
		// Only handle if in same zone
		if (zoneId !== this.currentZone) return;

		// Remove player
		this.playersInZone.delete(playerId);

		// Disconnect from peer
		this.disconnectFromPeerCallback?.(playerId);

		// Notify
		this.emit('player-left-zone', playerId, zoneId);

		// Update capacity
		this.updateZoneCapacity(zoneId);
	}

	/**
	 * Get players in current zone
	 */
	getPlayersInZone(): ZonePlayerInfo[] {
		return Array.from(this.playersInZone.values());
	}

	/**
	 * Get player count in zone
	 */
	getPlayerCount(zoneId?: string): number {
		if (zoneId && zoneId !== this.currentZone) return 0;
		return this.playersInZone.size;
	}

	/**
	 * Check if zone is at capacity
	 */
	isZoneFull(zoneId: string): boolean {
		const capacity = this.zoneCapacities.get(zoneId);
		if (!capacity) return false;

		const currentCount = zoneId === this.currentZone ? this.playersInZone.size : 0;
		return currentCount >= capacity;
	}

	/**
	 * Get current zone
	 */
	getCurrentZone(): string | null {
		return this.currentZone;
	}

	/**
	 * Update zone capacity event
	 */
	private updateZoneCapacity(zoneId: string): void {
		const capacity = this.zoneCapacities.get(zoneId) || 0;
		const currentCount = zoneId === this.currentZone ? this.playersInZone.size : 0;

		this.emit('zone-capacity-changed', zoneId, currentCount, capacity);
	}

	/**
	 * Clear all data
	 */
	clear(): void {
		this.leaveZone();
		this.zoneCapacities.clear();
	}
}
