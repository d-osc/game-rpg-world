/**
 * ArenaService
 * Server-side PvP arena matchmaking and ranking system using elit/database
 */

import { Collection } from '../database/config.ts';

const arenaPlayers = new Collection<any>('arena_players');
const arenaMatches = new Collection<any>('arena_matches');

export interface ArenaPlayer {
	player_id: string;
	player_name: string;
	rank: number;
	rating: number;
	wins: number;
	losses: number;
	win_rate: number;
	current_streak: number;
	best_streak: number;
	last_match_at: string | null;
}

export interface QueueEntry {
	player_id: string;
	player_name: string;
	rating: number;
	queued_at: string;
}

export interface ArenaMatch {
	id: number;
	player1_id: string;
	player1_name: string;
	player1_rating: number;
	player2_id: string;
	player2_name: string;
	player2_rating: number;
	winner_id: string | null;
	status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
	started_at: string;
	completed_at: string | null;
}

export interface MatchResult {
	winner_id: string;
	loser_id: string;
	duration: number;
}

export interface JoinQueueRequest {
	player_id: string;
	player_name: string;
}

export interface LeaderboardEntry {
	rank: number;
	player_id: string;
	player_name: string;
	rating: number;
	wins: number;
	losses: number;
	win_rate: number;
}

export class ArenaService {
	private queue: Map<string, QueueEntry> = new Map();
	private activeMatches: Map<number, ArenaMatch> = new Map();
	private matchmakingInterval: Timer | null = null;
	private nextMatchId = 1;

	private readonly INITIAL_RATING = 1500;
	private readonly K_FACTOR = 32;
	private readonly RATING_RANGE = 200;
	private readonly QUEUE_TIMEOUT = 300000;
	private readonly MATCHMAKING_INTERVAL = 5000;
	private readonly MIN_MATCHES_FOR_RANK = 10;

	async initialize(): Promise<void> {
		const all = arenaMatches.getAll();
		if (all.length > 0) {
			this.nextMatchId = Math.max(...all.map((m: any) => m.id)) + 1;
		}
		console.log('[ArenaService] Database ready');
		this.startMatchmaking();
	}

	private startMatchmaking(): void {
		if (this.matchmakingInterval) return;
		this.matchmakingInterval = setInterval(() => { this.processMatchmaking(); }, this.MATCHMAKING_INTERVAL);
		console.log('[ArenaService] Matchmaking loop started');
	}

	stopMatchmaking(): void {
		if (this.matchmakingInterval) {
			clearInterval(this.matchmakingInterval);
			this.matchmakingInterval = null;
			console.log('[ArenaService] Matchmaking loop stopped');
		}
	}

	async joinQueue(request: JoinQueueRequest): Promise<{ success: boolean; error?: string; queueSize?: number }> {
		if (this.queue.has(request.player_id)) return { success: false, error: 'Already in queue' };

		const inMatch = Array.from(this.activeMatches.values()).some(
			(match) =>
				match.status === 'in_progress' &&
				(match.player1_id === request.player_id || match.player2_id === request.player_id),
		);
		if (inMatch) return { success: false, error: 'Already in an active match' };

		const player = await this.getOrCreatePlayer(request.player_id, request.player_name);

		this.queue.set(request.player_id, {
			player_id: request.player_id,
			player_name: request.player_name,
			rating: player.rating,
			queued_at: new Date().toISOString(),
		});

		console.log(`[ArenaService] Player ${request.player_name} joined queue (${this.queue.size} in queue)`);
		return { success: true, queueSize: this.queue.size };
	}

	leaveQueue(playerId: string): { success: boolean } {
		const removed = this.queue.delete(playerId);
		if (removed) console.log(`[ArenaService] Player ${playerId} left queue (${this.queue.size} in queue)`);
		return { success: removed };
	}

	private async processMatchmaking(): Promise<void> {
		if (this.queue.size < 2) return;

		const now = Date.now();
		const entries = Array.from(this.queue.values());

		entries.forEach((entry) => {
			if (now - new Date(entry.queued_at).getTime() > this.QUEUE_TIMEOUT) {
				this.queue.delete(entry.player_id);
				console.log(`[ArenaService] Player ${entry.player_name} removed from queue (timeout)`);
			}
		});

		const validEntries = Array.from(this.queue.values()).sort((a, b) => a.rating - b.rating);
		const matched: Set<string> = new Set();

		for (let i = 0; i < validEntries.length - 1; i++) {
			if (matched.has(validEntries[i]!.player_id)) continue;
			for (let j = i + 1; j < validEntries.length; j++) {
				if (matched.has(validEntries[j]!.player_id)) continue;
				const player1 = validEntries[i]!;
				const player2 = validEntries[j]!;
				if (Math.abs(player1.rating - player2.rating) <= this.RATING_RANGE) {
					await this.createMatch(player1, player2);
					matched.add(player1.player_id);
					matched.add(player2.player_id);
					this.queue.delete(player1.player_id);
					this.queue.delete(player2.player_id);
					break;
				}
			}
		}
	}

	private async createMatch(player1: QueueEntry, player2: QueueEntry): Promise<ArenaMatch | null> {
		try {
			const matchId = this.nextMatchId++;
			const now = new Date().toISOString();
			const match: ArenaMatch = {
				id: matchId,
				player1_id: player1.player_id,
				player1_name: player1.player_name,
				player1_rating: player1.rating,
				player2_id: player2.player_id,
				player2_name: player2.player_name,
				player2_rating: player2.rating,
				winner_id: null,
				status: 'pending',
				started_at: now,
				completed_at: null,
			};

			arenaMatches.insert({ ...match });

			this.activeMatches.set(matchId, match);
			console.log(
				`[ArenaService] Match created: ${player1.player_name} (${player1.rating}) vs ${player2.player_name} (${player2.rating})`,
			);
			return match;
		} catch (error) {
			console.error('[ArenaService] Failed to create match:', error);
			return null;
		}
	}

	async startMatch(matchId: number): Promise<{ success: boolean; error?: string }> {
		try {
			const match = arenaMatches.findOne((m: any) => m.id === matchId && m.status === 'pending');
			if (!match) return { success: false, error: 'Match not found or already started' };

			arenaMatches.update((m: any) => m.id === matchId, { status: 'in_progress' });
			match.status = 'in_progress';
			this.activeMatches.set(matchId, match);

			console.log(`[ArenaService] Match ${matchId} started`);
			return { success: true };
		} catch (error) {
			console.error('[ArenaService] Failed to start match:', error);
			return { success: false, error: 'Failed to start match' };
		}
	}

	async completeMatch(
		matchId: number,
		result: MatchResult,
	): Promise<{ success: boolean; error?: string; ratingChanges?: { winner: number; loser: number } }> {
		const match = this.activeMatches.get(matchId);
		if (!match) return { success: false, error: 'Match not found' };

		if (result.winner_id !== match.player1_id && result.winner_id !== match.player2_id) {
			return { success: false, error: 'Invalid winner' };
		}
		const expectedLoserId = result.winner_id === match.player1_id ? match.player2_id : match.player1_id;
		if (result.loser_id !== expectedLoserId) return { success: false, error: 'Invalid loser' };

		try {
			const winner = await this.getPlayer(result.winner_id);
			const loser = await this.getPlayer(result.loser_id);
			if (!winner || !loser) return { success: false, error: 'Player not found' };

			const expectedWinner = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
			const expectedLoser = 1 - expectedWinner;

			const newWinnerRating = Math.round(winner.rating + this.K_FACTOR * (1 - expectedWinner));
			const newLoserRating = Math.round(loser.rating + this.K_FACTOR * (0 - expectedLoser));

			const winnerRatingChange = newWinnerRating - winner.rating;
			const loserRatingChange = newLoserRating - loser.rating;

			const now = new Date().toISOString();

			arenaPlayers.update((p: any) => p.player_id === result.winner_id, {
				rating: newWinnerRating,
				wins: winner.wins + 1,
				current_streak: winner.current_streak + 1,
				best_streak: Math.max(winner.best_streak, winner.current_streak + 1),
				last_match_at: now,
				updated_at: now,
			});

			arenaPlayers.update((p: any) => p.player_id === result.loser_id, {
				rating: newLoserRating,
				losses: loser.losses + 1,
				current_streak: 0,
				last_match_at: now,
				updated_at: now,
			});

			arenaMatches.update((m: any) => m.id === matchId, {
				winner_id: result.winner_id,
				status: 'completed',
				duration: result.duration,
				completed_at: now,
			});

			this.activeMatches.delete(matchId);

			console.log(
				`[ArenaService] Match ${matchId} completed: ${winner.player_name} wins (+${winnerRatingChange} rating)`,
			);

			return { success: true, ratingChanges: { winner: winnerRatingChange, loser: loserRatingChange } };
		} catch (error) {
			console.error('[ArenaService] Failed to complete match:', error);
			return { success: false, error: 'Failed to complete match' };
		}
	}

	async cancelMatch(matchId: number): Promise<{ success: boolean; error?: string }> {
		try {
			arenaMatches.update((m: any) => m.id === matchId, {
				status: 'cancelled',
				completed_at: new Date().toISOString(),
			});
			this.activeMatches.delete(matchId);
			console.log(`[ArenaService] Match ${matchId} cancelled`);
			return { success: true };
		} catch (error) {
			console.error('[ArenaService] Failed to cancel match:', error);
			return { success: false, error: 'Failed to cancel match' };
		}
	}

	private async getOrCreatePlayer(playerId: string, playerName: string): Promise<ArenaPlayer> {
		let player = await this.getPlayer(playerId);
		if (!player) {
			const now = new Date().toISOString();
			arenaPlayers.insert({
				player_id: playerId,
				player_name: playerName,
				rating: this.INITIAL_RATING,
				wins: 0,
				losses: 0,
				current_streak: 0,
				best_streak: 0,
				last_match_at: null,
				created_at: now,
				updated_at: now,
			});
			player = await this.getPlayer(playerId);
			console.log(`[ArenaService] Created arena player: ${playerName}`);
		} else {
			arenaPlayers.update((p: any) => p.player_id === playerId, { player_name: playerName });
		}
		return player!;
	}

	private async getPlayer(playerId: string): Promise<ArenaPlayer | null> {
		try {
			const row = arenaPlayers.findOne((p: any) => p.player_id === playerId);
			if (!row) return null;
			return this.rowToPlayer(row);
		} catch (error) {
			console.error('[ArenaService] Failed to get player:', error);
			return null;
		}
	}

	async getPlayerStats(playerId: string): Promise<ArenaPlayer | null> {
		return this.getPlayer(playerId);
	}

	async getLeaderboard(limit: number = 100, offset: number = 0): Promise<LeaderboardEntry[]> {
		try {
			const all = arenaPlayers.getAll();
			const eligible = all.filter((p: any) => (p.wins + p.losses) >= this.MIN_MATCHES_FOR_RANK);
			eligible.sort((a: any, b: any) => b.rating - a.rating);

			return eligible.slice(offset, offset + limit).map((p: any, idx: number) => {
				const totalMatches = p.wins + p.losses;
				return {
					rank: offset + idx + 1,
					player_id: p.player_id,
					player_name: p.player_name,
					rating: p.rating,
					wins: p.wins,
					losses: p.losses,
					win_rate: totalMatches > 0 ? Math.round((p.wins / totalMatches) * 10000) / 100 : 0,
				};
			});
		} catch (error) {
			console.error('[ArenaService] Failed to get leaderboard:', error);
			return [];
		}
	}

	async getPlayerRank(playerId: string): Promise<number | null> {
		try {
			const all = arenaPlayers.getAll();
			const eligible = all.filter((p: any) => (p.wins + p.losses) >= this.MIN_MATCHES_FOR_RANK);
			eligible.sort((a: any, b: any) => b.rating - a.rating);
			const idx = eligible.findIndex((p: any) => p.player_id === playerId);
			return idx >= 0 ? idx + 1 : null;
		} catch (error) {
			console.error('[ArenaService] Failed to get player rank:', error);
			return null;
		}
	}

	async getMatchHistory(playerId: string, limit: number = 20, offset: number = 0): Promise<ArenaMatch[]> {
		try {
			const all = arenaMatches
				.find((m: any) => (m.player1_id === playerId || m.player2_id === playerId) && m.status === 'completed')
				.sort((a: any, b: any) => (b.completed_at || '').localeCompare(a.completed_at || ''));
			return all.slice(offset, offset + limit);
		} catch (error) {
			console.error('[ArenaService] Failed to get match history:', error);
			return [];
		}
	}

	getQueueStatus(): { queueSize: number; averageRating: number; activeMatches: number } {
		const entries = Array.from(this.queue.values());
		const averageRating =
			entries.length > 0 ? Math.round(entries.reduce((sum, e) => sum + e.rating, 0) / entries.length) : 0;
		return { queueSize: this.queue.size, averageRating, activeMatches: this.activeMatches.size };
	}

	getActiveMatch(playerId: string): ArenaMatch | null {
		for (const match of this.activeMatches.values()) {
			if (match.status === 'in_progress' && (match.player1_id === playerId || match.player2_id === playerId)) {
				return match;
			}
		}
		return null;
	}

	private rowToPlayer(row: any): ArenaPlayer {
		const totalMatches = row.wins + row.losses;
		const winRate = totalMatches > 0 ? (row.wins / totalMatches) * 100 : 0;
		return {
			player_id: row.player_id,
			player_name: row.player_name,
			rank: 0,
			rating: row.rating,
			wins: row.wins,
			losses: row.losses,
			win_rate: Math.round(winRate * 100) / 100,
			current_streak: row.current_streak,
			best_streak: row.best_streak,
			last_match_at: row.last_match_at,
		};
	}

	destroy(): void {
		this.stopMatchmaking();
		this.queue.clear();
		this.activeMatches.clear();
	}
}
