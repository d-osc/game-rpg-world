/**
 * ClientNetworkManager
 * Client-side network layer connecting to the authoritative game server via WebSocket
 */

import {
	MessageType, encodeMessage, decodeMessage,
	type GameMessage, type PlayerPositionUpdate,
	type ZoneStateData, type PlayerEnterData, type PlayerLeaveData,
	type ChatMessageData, type ErrorData, type ChatChannel,
} from '@rpg/shared';
import { StateSync } from '../sync/StateSync.ts';
import { ChatManager } from '../chat/ChatManager.ts';

export interface ClientNetworkEvents {
	connected: () => void;
	disconnected: () => void;
	'zone-state': (data: ZoneStateData) => void;
	'player-entered': (data: PlayerEnterData) => void;
	'player-left': (data: PlayerLeaveData) => void;
	'position-update': (data: PlayerPositionUpdate[]) => void;
	'chat-message': (data: ChatMessageData) => void;
	error: (data: ErrorData) => void;
}

export class ClientNetworkManager {
	private ws: WebSocket | null = null;
	private serverUrl: string;
	private token: string;
	private playerId: string;
	private playerName: string;

	stateSync: StateSync;
	chatManager: ChatManager;

	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

	private listeners = new Map<string, Set<Function>>();

	constructor(serverUrl: string, token: string, playerId: string, playerName: string) {
		this.serverUrl = serverUrl;
		this.token = token;
		this.playerId = playerId;
		this.playerName = playerName;

		this.stateSync = new StateSync(playerId);
		this.chatManager = new ChatManager(playerId, playerName);

		// Wire chat manager to send via server
		this.chatManager.setSendCallbacks(
			() => true, // no peer-to-peer needed
			() => {},   // no broadcast needed — we send via sendChat
		);
	}

	/**
	 * Connect to game server
	 */
	async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				const url = `${this.serverUrl}?token=${this.token}`;
				this.ws = new WebSocket(url);

				this.ws.onopen = () => {
					console.log('[ClientNetwork] Connected to game server');
					this.reconnectAttempts = 0;
					this.startHeartbeat();
					this.emit('connected');
					resolve();
				};

				this.ws.onmessage = (event) => {
					const msg = decodeMessage(event.data as string);
					if (msg) this.handleServerMessage(msg);
				};

				this.ws.onclose = () => {
					console.log('[ClientNetwork] Disconnected');
					this.stopHeartbeat();
					this.emit('disconnected');
					this.tryReconnect();
				};

				this.ws.onerror = (err) => {
					console.error('[ClientNetwork] Connection error', err);
					reject(err);
				};
			} catch (err) {
				reject(err);
			}
		});
	}

	/**
	 * Disconnect from server
	 */
	disconnect(): void {
		this.stopHeartbeat();
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.reconnectAttempts = this.maxReconnectAttempts; // prevent reconnect
		this.ws?.close();
		this.ws = null;
		this.stateSync.clearAll();
		this.chatManager.destroy();
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	// ============================================================================
	// Zone
	// ============================================================================

	joinZone(zoneId: string): void {
		this.send({ type: MessageType.C2S_JOIN_ZONE, data: { zoneId } });
	}

	leaveZone(): void {
		this.send({ type: MessageType.C2S_LEAVE_ZONE, data: {} });
	}

	// ============================================================================
	// Position
	// ============================================================================

	sendPosition(x: number, y: number, anim: string): void {
		if (!this.isConnected()) return;
		if (!this.stateSync.shouldSync(Date.now())) return;

		const update: PlayerPositionUpdate = {
			playerId: this.playerId,
			x, y, anim,
			ts: Date.now(),
		};
		this.send({ type: MessageType.C2S_POSITION_UPDATE, data: update });
	}

	// ============================================================================
	// Chat
	// ============================================================================

	sendChat(message: string, channel: ChatChannel = 'zone', targetId?: string): void {
		this.send({
			type: MessageType.C2S_CHAT,
			data: { message, channel, targetId } as ChatMessageData,
		});
	}

	// ============================================================================
	// Server message dispatch
	// ============================================================================

	private handleServerMessage(msg: GameMessage): void {
		switch (msg.type) {
			case MessageType.S2C_ZONE_STATE: {
				const data = msg.data as ZoneStateData;
				this.stateSync.clearAll();
				this.emit('zone-state', data);
				break;
			}

			case MessageType.S2C_PLAYER_ENTER: {
				const data = msg.data as PlayerEnterData;
				this.emit('player-entered', data);
				break;
			}

			case MessageType.S2C_PLAYER_LEAVE: {
				const data = msg.data as PlayerLeaveData;
				this.stateSync.removeRemotePlayer(data.playerId);
				this.emit('player-left', data);
				break;
			}

			case MessageType.S2C_POSITION_BROADCAST: {
				const updates = msg.data as PlayerPositionUpdate[];
				for (const u of updates) {
					this.stateSync.updateRemotePlayer({
						playerId: u.playerId,
						position: { x: u.x, y: u.y },
						animation: u.anim,
						timestamp: u.ts,
					});
				}
				this.emit('position-update', updates);
				break;
			}

			case MessageType.S2C_CHAT: {
				const data = msg.data as ChatMessageData;
				this.chatManager.handleReceivedMessage({
					id: `${data.senderId}-${data.ts}`,
					senderId: data.senderId,
					senderName: data.senderName,
					message: data.message,
					timestamp: data.ts,
					type: data.channel === 'private' ? 'local' : 'global',
				});
				this.emit('chat-message', data);
				break;
			}

			case MessageType.S2C_ERROR: {
				const data = msg.data as ErrorData;
				console.error(`[ClientNetwork] Server error: ${data.code} - ${data.message}`);
				this.emit('error', data);
				break;
			}
		}
	}

	// ============================================================================
	// Connection management
	// ============================================================================

	private send(msg: GameMessage): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		try {
			this.ws.send(encodeMessage(msg));
		} catch {
			// connection closed
		}
	}

	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeatInterval = setInterval(() => {
			this.send({ type: MessageType.C2S_HEARTBEAT, data: {} });
		}, 10000); // every 10s
	}

	private stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	private tryReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.log('[ClientNetwork] Max reconnect attempts reached');
			return;
		}

		this.reconnectAttempts++;
		const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
		console.log(`[ClientNetwork] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

		this.reconnectTimer = setTimeout(() => {
			this.connect().catch(() => {});
		}, delay);
	}

	// ============================================================================
	// Event emitter
	// ============================================================================

	on<K extends keyof ClientNetworkEvents>(event: K, callback: ClientNetworkEvents[K]): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(callback);
	}

	off<K extends keyof ClientNetworkEvents>(event: K, callback: ClientNetworkEvents[K]): void {
		this.listeners.get(event)?.delete(callback);
	}

	private emit(event: string, ...args: any[]): void {
		this.listeners.get(event)?.forEach(cb => cb(...args));
	}
}
