/**
 * WebSocket Signaling Server
 * Handles WebRTC signaling for P2P connections
 */

import type { WebSocket } from 'elit/ws';

export interface PlayerConnection {
	playerId: string;
	username: string;
	ws: WebSocket;
	currentZone: string | null;
	position: { x: number; y: number };
}

export interface SignalingMessage {
	type:
		| 'join-zone'
		| 'leave-zone'
		| 'peer-list'
		| 'webrtc-offer'
		| 'webrtc-answer'
		| 'ice-candidate'
		| 'position-update'
		| 'disconnect';
	from?: string;
	to?: string;
	zoneId?: string;
	data?: any;
}

export class SignalingServer {
	private connections: Map<string, PlayerConnection> = new Map();
	private zones: Map<string, Set<string>> = new Map();

	/**
	 * Handle new WebSocket connection
	 */
	handleConnection(ws: WebSocket, playerId: string, username: string): void {
		console.log(`[Signaling] Player connected: ${username} (${playerId})`);

		// Store connection
		const connection: PlayerConnection = {
			playerId,
			username,
			ws,
			currentZone: null,
			position: { x: 0, y: 0 },
		};
		this.connections.set(playerId, connection);

		// Setup message handler
		ws.addEventListener('message', (event) => {
			try {
				const message: SignalingMessage = JSON.parse(event.data as string);
				this.handleMessage(playerId, message);
			} catch (error) {
				console.error('[Signaling] Invalid message:', error);
			}
		});

		// Handle disconnect
		ws.addEventListener('close', () => {
			this.handleDisconnect(playerId);
		});

		ws.addEventListener('error', (error) => {
			console.error(`[Signaling] WebSocket error for ${playerId}:`, error);
		});

		// Send welcome message
		this.sendToPlayer(playerId, {
			type: 'peer-list',
			data: { message: 'Connected to signaling server' },
		});
	}

	/**
	 * Handle incoming signaling messages
	 */
	private handleMessage(playerId: string, message: SignalingMessage): void {
		const connection = this.connections.get(playerId);
		if (!connection) return;

		switch (message.type) {
			case 'join-zone':
				this.handleJoinZone(playerId, message.zoneId!);
				break;

			case 'leave-zone':
				this.handleLeaveZone(playerId);
				break;

			case 'webrtc-offer':
			case 'webrtc-answer':
			case 'ice-candidate':
				this.relayMessage(playerId, message);
				break;

			case 'position-update':
				this.handlePositionUpdate(playerId, message.data);
				break;

			default:
				console.warn(`[Signaling] Unknown message type: ${message.type}`);
		}
	}

	/**
	 * Handle player joining a zone
	 */
	private handleJoinZone(playerId: string, zoneId: string): void {
		const connection = this.connections.get(playerId);
		if (!connection) return;

		// Leave current zone if any
		if (connection.currentZone) {
			this.handleLeaveZone(playerId);
		}

		// Add to new zone
		if (!this.zones.has(zoneId)) {
			this.zones.set(zoneId, new Set());
		}
		this.zones.get(zoneId)!.add(playerId);
		connection.currentZone = zoneId;

		console.log(
			`[Signaling] Player ${connection.username} joined zone ${zoneId}`,
		);

		// Get list of other players in zone
		const peersInZone = Array.from(this.zones.get(zoneId)!)
			.filter((id) => id !== playerId)
			.map((id) => {
				const peer = this.connections.get(id)!;
				return {
					playerId: peer.playerId,
					username: peer.username,
					position: peer.position,
				};
			});

		// Send peer list to joining player
		this.sendToPlayer(playerId, {
			type: 'peer-list',
			zoneId,
			data: { peers: peersInZone },
		});

		// Notify other players in zone about new player
		this.broadcastToZone(
			zoneId,
			{
				type: 'peer-list',
				data: {
					action: 'player-joined',
					player: {
						playerId: connection.playerId,
						username: connection.username,
						position: connection.position,
					},
				},
			},
			playerId,
		);
	}

	/**
	 * Handle player leaving a zone
	 */
	private handleLeaveZone(playerId: string): void {
		const connection = this.connections.get(playerId);
		if (!connection || !connection.currentZone) return;

		const zoneId = connection.currentZone;

		// Remove from zone
		this.zones.get(zoneId)?.delete(playerId);
		if (this.zones.get(zoneId)?.size === 0) {
			this.zones.delete(zoneId);
		}

		// Notify other players
		this.broadcastToZone(
			zoneId,
			{
				type: 'peer-list',
				data: {
					action: 'player-left',
					playerId: connection.playerId,
				},
			},
			playerId,
		);

		connection.currentZone = null;
		console.log(
			`[Signaling] Player ${connection.username} left zone ${zoneId}`,
		);
	}

	/**
	 * Handle position updates
	 */
	private handlePositionUpdate(
		playerId: string,
		data: { x: number; y: number },
	): void {
		const connection = this.connections.get(playerId);
		if (!connection) return;

		connection.position = data;

		// Broadcast to zone (position updates are handled via P2P, this is just for tracking)
	}

	/**
	 * Relay WebRTC signaling messages between peers
	 */
	private relayMessage(fromPlayerId: string, message: SignalingMessage): void {
		if (!message.to) {
			console.warn('[Signaling] Relay message missing "to" field');
			return;
		}

		const toConnection = this.connections.get(message.to);
		if (!toConnection) {
			console.warn(`[Signaling] Target player ${message.to} not found`);
			return;
		}

		// Forward message to target player
		this.sendToPlayer(message.to, {
			...message,
			from: fromPlayerId,
		});
	}

	/**
	 * Handle player disconnect
	 */
	private handleDisconnect(playerId: string): void {
		const connection = this.connections.get(playerId);
		if (!connection) return;

		console.log(`[Signaling] Player disconnected: ${connection.username}`);

		// Leave zone if in one
		if (connection.currentZone) {
			this.handleLeaveZone(playerId);
		}

		// Remove connection
		this.connections.delete(playerId);
	}

	/**
	 * Send message to specific player
	 */
	private sendToPlayer(playerId: string, message: SignalingMessage): void {
		const connection = this.connections.get(playerId);
		if (!connection) return;

		try {
			connection.ws.send(JSON.stringify(message));
		} catch (error) {
			console.error(`[Signaling] Failed to send to ${playerId}:`, error);
		}
	}

	/**
	 * Broadcast message to all players in a zone
	 */
	private broadcastToZone(
		zoneId: string,
		message: SignalingMessage,
		excludePlayerId?: string,
	): void {
		const playersInZone = this.zones.get(zoneId);
		if (!playersInZone) return;

		playersInZone.forEach((playerId) => {
			if (playerId !== excludePlayerId) {
				this.sendToPlayer(playerId, message);
			}
		});
	}

	/**
	 * Get connection count
	 */
	getConnectionCount(): number {
		return this.connections.size;
	}

	/**
	 * Get zone count
	 */
	getZoneCount(): number {
		return this.zones.size;
	}

	/**
	 * Get players in zone
	 */
	getPlayersInZone(zoneId: string): string[] {
		return Array.from(this.zones.get(zoneId) || []);
	}
}
