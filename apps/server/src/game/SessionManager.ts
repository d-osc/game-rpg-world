/**
 * SessionManager
 * Manages player sessions, heartbeats, and rate limiting
 */

import type { WebSocket } from 'elit/ws';
import { RateLimiter } from './RateLimiter.ts';

export interface SessionInfo {
	playerId: string;
	username: string;
	ws: WebSocket;
	connectedAt: number;
	lastHeartbeat: number;
	currentZoneId: string | null;
}

const HEARTBEAT_TIMEOUT = 30000; // 30s

export class SessionManager {
	private sessions = new Map<string, SessionInfo>();
	private rateLimiter = new RateLimiter();
	private heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null;

	constructor() {
		// Check for stale sessions every 15s
		this.heartbeatCheckInterval = setInterval(() => this.checkHeartbeats(), 15000);
	}

	createSession(playerId: string, username: string, ws: WebSocket): void {
		const now = Date.now();
		this.sessions.set(playerId, {
			playerId,
			username,
			ws,
			connectedAt: now,
			lastHeartbeat: now,
			currentZoneId: null,
		});
	}

	destroySession(playerId: string): void {
		this.sessions.delete(playerId);
	}

	heartbeat(playerId: string): void {
		const session = this.sessions.get(playerId);
		if (session) {
			session.lastHeartbeat = Date.now();
		}
	}

	isRateLimited(playerId: string, action: string, maxPerSecond: number): boolean {
		return this.rateLimiter.isLimited(`${playerId}:${action}`, maxPerSecond);
	}

	getSession(playerId: string): SessionInfo | undefined {
		return this.sessions.get(playerId);
	}

	setZone(playerId: string, zoneId: string | null): void {
		const session = this.sessions.get(playerId);
		if (session) {
			session.currentZoneId = zoneId;
		}
	}

	getOnlineCount(): number {
		return this.sessions.size;
	}

	getOnlinePlayerIds(): string[] {
		return Array.from(this.sessions.keys());
	}

	getAllSessions(): Map<string, SessionInfo> {
		return this.sessions;
	}

	private checkHeartbeats(): void {
		const now = Date.now();
		const stale: string[] = [];

		for (const [id, session] of this.sessions) {
			if (now - session.lastHeartbeat > HEARTBEAT_TIMEOUT) {
				stale.push(id);
			}
		}

		for (const id of stale) {
			console.log(`[SessionManager] Heartbeat timeout for ${id}, closing`);
			const session = this.sessions.get(id);
			if (session) {
				try { session.ws.close(); } catch { /* already closed */ }
			}
			// Don't delete here — disconnect handler will clean up
		}

		this.rateLimiter.cleanup();
	}

	destroy(): void {
		if (this.heartbeatCheckInterval) {
			clearInterval(this.heartbeatCheckInterval);
		}
	}
}
