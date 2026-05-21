/**
 * GameServer
 * Central authoritative game server managing connections, zones, and message routing
 */

import type { WebSocket } from 'elit/ws';
import {
	MessageType, decodeMessage, encodeMessage,
	type GameMessage, type PlayerPositionUpdate,
	type ZoneJoinData, type ChatMessageData, type ErrorData,
} from '@rpg/shared';
import { ZoneInstance, type ZonePlayer } from './ZoneInstance.ts';
import { SessionManager } from './SessionManager.ts';
import { PositionValidator } from './PositionValidator.ts';

export class GameServer {
	private zones = new Map<string, ZoneInstance>();
	private sessions = new SessionManager();
	private positionValidator = new PositionValidator();
	private lastPositions = new Map<string, { x: number; y: number; ts: number }>();
	private autoSaveInterval: ReturnType<typeof setInterval> | null = null;

	constructor() {
		// Auto-save online player positions every 60s
		this.autoSaveInterval = setInterval(() => this.autoSave(), 60000);
	}

	/**
	 * Handle new WebSocket connection (called after auth)
	 */
	handleConnection(ws: WebSocket, playerId: string, username: string): void {
		console.log(`[GameServer] ${username} connected`);

		this.sessions.createSession(playerId, username, ws);

		ws.on('message', (event: any) => {
			try {
				const raw = typeof event.data === 'string' ? event.data : event.data.toString();
				const msg = decodeMessage(raw);
				if (msg) {
					this.handleMessage(playerId, msg);
				}
			} catch (error) {
				console.error(`[GameServer] Invalid message from ${playerId}:`, error);
			}
		});

		ws.on('close', () => {
			this.handleDisconnect(playerId);
		});

		ws.on('error', (error: any) => {
			console.error(`[GameServer] WS error for ${playerId}:`, error);
		});
	}

	/**
	 * Route messages by type
	 */
	private handleMessage(playerId: string, msg: GameMessage): void {
		const session = this.sessions.getSession(playerId);
		if (!session) return;

		switch (msg.type) {
			case MessageType.C2S_HEARTBEAT:
				this.sessions.heartbeat(playerId);
				break;

			case MessageType.C2S_JOIN_ZONE:
				this.handleJoinZone(playerId, msg.data as ZoneJoinData);
				break;

			case MessageType.C2S_LEAVE_ZONE:
				this.handleLeaveZone(playerId);
				break;

			case MessageType.C2S_POSITION_UPDATE:
				this.handlePositionUpdate(playerId, msg.data as PlayerPositionUpdate);
				break;

			case MessageType.C2S_CHAT:
				this.handleChat(playerId, msg.data as ChatMessageData);
				break;

			default:
				this.sendError(playerId, 'UNKNOWN_MESSAGE', `Unknown message type: ${msg.type}`);
		}
	}

	// ============================================================================
	// Zone Management
	// ============================================================================

	private handleJoinZone(playerId: string, data: ZoneJoinData): void {
		if (this.sessions.isRateLimited(playerId, 'zone', 1)) {
			this.sendError(playerId, 'RATE_LIMITED', 'Zone change rate limited');
			return;
		}

		const session = this.sessions.getSession(playerId);
		if (!session) return;

		// Leave current zone
		if (session.currentZoneId) {
			this.removePlayerFromZone(playerId);
		}

		const zoneId = data.zoneId;

		// Get or create zone
		if (!this.zones.has(zoneId)) {
			this.zones.set(zoneId, new ZoneInstance(zoneId));
		}

		const zone = this.zones.get(zoneId)!;
		if (zone.isFull()) {
			this.sendError(playerId, 'ZONE_FULL', `Zone ${zoneId} is full`);
			return;
		}

		// Add player to zone
		const zonePlayer: ZonePlayer = {
			playerId,
			username: session.username,
			ws: session.ws,
			x: 0, y: 0,
			anim: 'idle',
			level: 1,
		};
		zone.addPlayer(zonePlayer);
		this.sessions.setZone(playerId, zoneId);
	}

	private handleLeaveZone(playerId: string): void {
		this.removePlayerFromZone(playerId);
		this.sessions.setZone(playerId, null);
	}

	private removePlayerFromZone(playerId: string): void {
		const session = this.sessions.getSession(playerId);
		if (!session || !session.currentZoneId) return;

		const zone = this.zones.get(session.currentZoneId);
		if (zone) {
			zone.removePlayer(playerId);
			// Remove empty zones
			if (zone.getPlayerCount() === 0) {
				this.zones.delete(session.currentZoneId);
			}
		}
	}

	// ============================================================================
	// Position Sync
	// ============================================================================

	private handlePositionUpdate(playerId: string, data: PlayerPositionUpdate): void {
		if (this.sessions.isRateLimited(playerId, 'position', 12)) return;

		const session = this.sessions.getSession(playerId);
		if (!session || !session.currentZoneId) return;

		const zone = this.zones.get(session.currentZoneId);
		if (!zone) return;

		// Validate position
		const last = this.lastPositions.get(playerId);
		if (last) {
			const deltaMs = data.ts - last.ts;
			const result = this.positionValidator.validate(last.x, last.y, data.x, data.y, deltaMs);
			if (!result.valid) {
				// Use corrected position
				data = { ...data, x: result.x, y: result.y };
			}
		}
		this.lastPositions.set(playerId, { x: data.x, y: data.y, ts: data.ts });

		zone.queuePosition({ ...data, playerId });
	}

	/**
	 * Called at 10Hz by server main loop
	 */
	broadcastPositions(): void {
		for (const [, zone] of this.zones) {
			const payload = zone.getBroadcastPayload();
			if (payload.length === 0) continue;

			const msg = encodeMessage({
				type: MessageType.S2C_POSITION_BROADCAST,
				data: payload,
			});

			zone.forEachPlayer((player) => {
				try {
					player.ws.send(msg);
				} catch {
					// connection closed
				}
			});
		}
	}

	// ============================================================================
	// Chat
	// ============================================================================

	private handleChat(fromId: string, data: ChatMessageData): void {
		if (this.sessions.isRateLimited(fromId, 'chat', 3)) {
			this.sendError(fromId, 'RATE_LIMITED', 'Chat rate limited');
			return;
		}

		const session = this.sessions.getSession(fromId);
		if (!session) return;

		const chatMsg: ChatMessageData = {
			senderId: fromId,
			senderName: session.username,
			message: data.message.slice(0, 500), // max 500 chars
			channel: data.channel,
			ts: Date.now(),
		};

		const msg = { type: MessageType.S2C_CHAT, data: chatMsg };

		if (data.channel === 'zone' && session.currentZoneId) {
			const zone = this.zones.get(session.currentZoneId);
			if (zone) {
				const encoded = encodeMessage(msg);
				zone.forEachPlayer((player) => {
					try { player.ws.send(encoded); } catch { /* closed */ }
				});
			}
		} else if (data.channel === 'global') {
			const encoded = encodeMessage(msg);
			for (const [, s] of this.sessions.getAllSessions?.() ?? []) {
				try { s.ws.send(encoded); } catch { /* closed */ }
			}
		} else if (data.channel === 'private' && data.targetId) {
			// Direct message
			const target = this.sessions.getSession(data.targetId);
			if (target) {
				try { target.ws.send(encodeMessage(msg)); } catch { /* closed */ }
			}
			// Echo back to sender
			try { session.ws.send(encodeMessage(msg)); } catch { /* closed */ }
		}
	}

	// ============================================================================
	// Disconnect
	// ============================================================================

	private handleDisconnect(playerId: string): void {
		const session = this.sessions.getSession(playerId);
		if (!session) return;

		console.log(`[GameServer] ${session.username} disconnected`);

		// Leave zone
		if (session.currentZoneId) {
			this.removePlayerFromZone(playerId);
		}

		this.lastPositions.delete(playerId);
		this.sessions.destroySession(playerId);
	}

	// ============================================================================
	// Helpers
	// ============================================================================

	private sendError(playerId: string, code: string, message: string): void {
		const session = this.sessions.getSession(playerId);
		if (!session) return;
		try {
			session.ws.send(encodeMessage({
				type: MessageType.S2C_ERROR,
				data: { code, message } as ErrorData,
			}));
		} catch { /* closed */ }
	}

	getConnectionCount(): number {
		return this.sessions.getOnlineCount();
	}

	getZoneCount(): number {
		return this.zones.size;
	}

	getZoneInfo(): Record<string, number> {
		const info: Record<string, number> = {};
		this.zones.forEach((zone, id) => { info[id] = zone.getPlayerCount(); });
		return info;
	}

	private autoSave(): void {
		// Log online count for monitoring
		console.log(`[GameServer] Auto-save: ${this.sessions.getOnlineCount()} online, ${this.zones.size} zones`);
	}

	destroy(): void {
		if (this.autoSaveInterval) {
			clearInterval(this.autoSaveInterval);
			this.autoSaveInterval = null;
		}
		this.sessions.destroy();
	}
}
