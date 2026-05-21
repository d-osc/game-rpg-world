/**
 * ZoneInstance
 * Self-contained zone with player tracking and position buffer
 */

import type { WebSocket } from 'elit/ws';
import {
	MessageType, encodeMessage,
	type PlayerPositionUpdate, type ZonePlayerInfo, type ZoneStateData,
	type PlayerEnterData, type PlayerLeaveData,
} from '@rpg/shared';

export interface ZonePlayer {
	playerId: string;
	username: string;
	ws: WebSocket;
	x: number;
	y: number;
	anim: string;
	level: number;
}

export class ZoneInstance {
	readonly zoneId: string;
	private players = new Map<string, ZonePlayer>();
	private positionBuffer: PlayerPositionUpdate[] = [];
	private maxCapacity: number;

	constructor(zoneId: string, maxCapacity = 100) {
		this.zoneId = zoneId;
		this.maxCapacity = maxCapacity;
	}

	addPlayer(player: ZonePlayer): void {
		this.players.set(player.playerId, player);

		// Send full zone state to joiner
		const stateData: ZoneStateData = {
			zoneId: this.zoneId,
			players: Array.from(this.players.values()).map(p => ({
				playerId: p.playerId,
				username: p.username,
				x: p.x,
				y: p.y,
				anim: p.anim,
				level: p.level,
			})),
		};
		this.sendTo(player.playerId, { type: MessageType.S2C_ZONE_STATE, data: stateData });

		// Notify others
		const enterData: PlayerEnterData = {
			playerId: player.playerId,
			username: player.username,
			x: player.x,
			y: player.y,
			anim: player.anim,
			level: player.level,
		};
		this.broadcast({ type: MessageType.S2C_PLAYER_ENTER, data: enterData }, player.playerId);

		console.log(`[Zone:${this.zoneId}] ${player.username} joined (${this.players.size} players)`);
	}

	removePlayer(playerId: string): void {
		const player = this.players.get(playerId);
		if (!player) return;

		this.players.delete(playerId);

		// Notify others
		const leaveData: PlayerLeaveData = { playerId };
		this.broadcast({ type: MessageType.S2C_PLAYER_LEAVE, data: leaveData });

		console.log(`[Zone:${this.zoneId}] ${player.username} left (${this.players.size} players)`);
	}

	queuePosition(update: PlayerPositionUpdate): void {
		const player = this.players.get(update.playerId);
		if (player) {
			player.x = update.x;
			player.y = update.y;
			player.anim = update.anim;
		}
		this.positionBuffer.push(update);
	}

	getBroadcastPayload(): PlayerPositionUpdate[] {
		const payload = this.positionBuffer;
		this.positionBuffer = [];
		return payload;
	}

	getPlayer(playerId: string): ZonePlayer | undefined {
		return this.players.get(playerId);
	}

	getPlayerCount(): number {
		return this.players.size;
	}

	isFull(): boolean {
		return this.players.size >= this.maxCapacity;
	}

	getPlayerIds(): string[] {
		return Array.from(this.players.keys());
	}

	forEachPlayer(fn: (player: ZonePlayer) => void): void {
		this.players.forEach(fn);
	}

	private sendTo(playerId: string, msg: { type: MessageType; data: unknown }): void {
		const player = this.players.get(playerId);
		if (!player) return;
		try {
			player.ws.send(encodeMessage(msg));
		} catch {
			// connection likely closed
		}
	}

	private broadcast(msg: { type: MessageType; data: unknown }, excludeId?: string): void {
		const raw = encodeMessage(msg);
		this.players.forEach((player, id) => {
			if (id !== excludeId) {
				try {
					player.ws.send(raw);
				} catch {
					// connection likely closed
				}
			}
		});
	}
}
