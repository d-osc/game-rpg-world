/**
 * Game Protocol
 * Single source of truth for all client-server message types and data shapes
 */

// ============================================================================
// Message Types
// ============================================================================

export enum MessageType {
	// Connection
	C2S_AUTH = 'c2s.auth',
	C2S_HEARTBEAT = 'c2s.heartbeat',

	// Zone management
	C2S_JOIN_ZONE = 'c2s.join_zone',
	C2S_LEAVE_ZONE = 'c2s.leave_zone',
	S2C_ZONE_STATE = 's2c.zone_state',
	S2C_PLAYER_ENTER = 's2c.player_enter',
	S2C_PLAYER_LEAVE = 's2c.player_leave',

	// Position sync (10Hz)
	C2S_POSITION_UPDATE = 'c2s.position',
	S2C_POSITION_BROADCAST = 's2c.position_broadcast',

	// Chat
	C2S_CHAT = 'c2s.chat',
	S2C_CHAT = 's2c.chat',
	S2C_PRIVATE_MESSAGE = 's2c.private_message',

	// Error
	S2C_ERROR = 's2c.error',
}

// ============================================================================
// Message Envelope
// ============================================================================

export interface GameMessage {
	type: MessageType;
	data: unknown;
	seq?: number;
}

// ============================================================================
// Position
// ============================================================================

export interface PlayerPositionUpdate {
	playerId: string;
	x: number;
	y: number;
	anim: string;
	ts: number;
}

// ============================================================================
// Zone
// ============================================================================

export interface ZonePlayerInfo {
	playerId: string;
	username: string;
	x: number;
	y: number;
	anim: string;
	level: number;
}

export interface ZoneStateData {
	zoneId: string;
	players: ZonePlayerInfo[];
}

export interface ZoneJoinData {
	zoneId: string;
}

export interface PlayerEnterData extends ZonePlayerInfo {}
export interface PlayerLeaveData {
	playerId: string;
}

// ============================================================================
// Chat
// ============================================================================

export type ChatChannel = 'global' | 'zone' | 'private';

export interface ChatMessageData {
	senderId: string;
	senderName: string;
	message: string;
	channel: ChatChannel;
	targetId?: string;
	ts: number;
}

// ============================================================================
// Auth
// ============================================================================

export interface AuthData {
	token: string;
	playerId: string;
	username: string;
}

// ============================================================================
// Error
// ============================================================================

export interface ErrorData {
	code: string;
	message: string;
}

// ============================================================================
// Helpers
// ============================================================================

export function encodeMessage(msg: GameMessage): string {
	return JSON.stringify(msg);
}

export function decodeMessage(raw: string): GameMessage | null {
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed.type === 'string') {
			return parsed as GameMessage;
		}
		return null;
	} catch {
		return null;
	}
}
