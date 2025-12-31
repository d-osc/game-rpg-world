/**
 * ArenaService
 * Server-side PvP arena matchmaking and ranking system
 */

import type { Pool } from 'pg';

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
	duration: number; // seconds
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
	private db: Pool;
	private queue: Map<string, QueueEntry> = new Map();
	private activeMatches: Map<number, ArenaMatch> = new Map();
	private matchmakingInterval: Timer | null = null;

	// Configuration
	private readonly INITIAL_RATING = 1500;
	private readonly K_FACTOR = 32; // ELO K-factor
	private readonly RATING_RANGE = 200; // Max rating difference for matching
	private readonly QUEUE_TIMEOUT = 300000; // 5 minutes
	private readonly MATCHMAKING_INTERVAL = 5000; // 5 seconds
	private readonly MIN_MATCHES_FOR_RANK = 10;

	constructor(db: Pool) {
		this.db = db;
	}

	/**
	 * Initialize database tables
	 */
	async initialize(): Promise<void> {
		const client = await this.db.connect();
		try {
			// Arena players table
			await client.query(`
				CREATE TABLE IF NOT EXISTS arena_players (
					player_id VARCHAR(255) PRIMARY KEY,
					player_name VARCHAR(255) NOT NULL,
					rating INTEGER DEFAULT 1500,
					wins INTEGER DEFAULT 0,
					losses INTEGER DEFAULT 0,
					current_streak INTEGER DEFAULT 0,
					best_streak INTEGER DEFAULT 0,
					last_match_at TIMESTAMP,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				)
			`);

			// Arena matches table
			await client.query(`
				CREATE TABLE IF NOT EXISTS arena_matches (
					id SERIAL PRIMARY KEY,
					player1_id VARCHAR(255) NOT NULL,
					player1_name VARCHAR(255) NOT NULL,
					player1_rating INTEGER NOT NULL,
					player2_id VARCHAR(255) NOT NULL,
					player2_name VARCHAR(255) NOT NULL,
					player2_rating INTEGER NOT NULL,
					winner_id VARCHAR(255),
					status VARCHAR(50) DEFAULT 'pending',
					duration INTEGER,
					started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					completed_at TIMESTAMP
				)
			`);

			// Indexes
			await client.query('CREATE INDEX IF NOT EXISTS idx_arena_players_rating ON arena_players(rating DESC)');
			await client.query('CREATE INDEX IF NOT EXISTS idx_arena_matches_status ON arena_matches(status)');
			await client.query(
				'CREATE INDEX IF NOT EXISTS idx_arena_matches_player1 ON arena_matches(player1_id)',
			);
			await client.query(
				'CREATE INDEX IF NOT EXISTS idx_arena_matches_player2 ON arena_matches(player2_id)',
			);

			console.log('[ArenaService] Database tables initialized');

			// Start matchmaking loop
			this.startMatchmaking();
		} finally {
			client.release();
		}
	}

	/**
	 * Start matchmaking loop
	 */
	private startMatchmaking(): void {
		if (this.matchmakingInterval) {
			return;
		}

		this.matchmakingInterval = setInterval(() => {
			this.processMatchmaking();
		}, this.MATCHMAKING_INTERVAL);

		console.log('[ArenaService] Matchmaking loop started');
	}

	/**
	 * Stop matchmaking loop
	 */
	stopMatchmaking(): void {
		if (this.matchmakingInterval) {
			clearInterval(this.matchmakingInterval);
			this.matchmakingInterval = null;
			console.log('[ArenaService] Matchmaking loop stopped');
		}
	}

	/**
	 * Join arena queue
	 */
	async joinQueue(request: JoinQueueRequest): Promise<{ success: boolean; error?: string; queueSize?: number }> {
		// Check if already in queue
		if (this.queue.has(request.player_id)) {
			return { success: false, error: 'Already in queue' };
		}

		// Check if in active match
		const inMatch = Array.from(this.activeMatches.values()).some(
			(match) =>
				match.status === 'in_progress' &&
				(match.player1_id === request.player_id || match.player2_id === request.player_id),
		);

		if (inMatch) {
			return { success: false, error: 'Already in an active match' };
		}

		// Get or create player rating
		const player = await this.getOrCreatePlayer(request.player_id, request.player_name);

		// Add to queue
		const entry: QueueEntry = {
			player_id: request.player_id,
			player_name: request.player_name,
			rating: player.rating,
			queued_at: new Date().toISOString(),
		};

		this.queue.set(request.player_id, entry);

		console.log(`[ArenaService] Player ${request.player_name} joined queue (${this.queue.size} in queue)`);

		return {
			success: true,
			queueSize: this.queue.size,
		};
	}

	/**
	 * Leave arena queue
	 */
	leaveQueue(playerId: string): { success: boolean } {
		const removed = this.queue.delete(playerId);

		if (removed) {
			console.log(`[ArenaService] Player ${playerId} left queue (${this.queue.size} in queue)`);
		}

		return { success: removed };
	}

	/**
	 * Process matchmaking
	 */
	private async processMatchmaking(): Promise<void> {
		if (this.queue.size < 2) {
			return;
		}

		const now = Date.now();
		const entries = Array.from(this.queue.values());

		// Remove timed out entries
		entries.forEach((entry) => {
			const queuedAt = new Date(entry.queued_at).getTime();
			if (now - queuedAt > this.QUEUE_TIMEOUT) {
				this.queue.delete(entry.player_id);
				console.log(`[ArenaService] Player ${entry.player_name} removed from queue (timeout)`);
			}
		});

		// Sort by rating
		const validEntries = Array.from(this.queue.values()).sort((a, b) => a.rating - b.rating);

		// Try to match players
		const matched: Set<string> = new Set();

		for (let i = 0; i < validEntries.length - 1; i++) {
			if (matched.has(validEntries[i].player_id)) {
				continue;
			}

			for (let j = i + 1; j < validEntries.length; j++) {
				if (matched.has(validEntries[j].player_id)) {
					continue;
				}

				const player1 = validEntries[i];
				const player2 = validEntries[j];
				const ratingDiff = Math.abs(player1.rating - player2.rating);

				// Check if ratings are close enough
				if (ratingDiff <= this.RATING_RANGE) {
					// Create match
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

	/**
	 * Create a match
	 */
	private async createMatch(player1: QueueEntry, player2: QueueEntry): Promise<ArenaMatch | null> {
		const client = await this.db.connect();
		try {
			await client.query('BEGIN');

			const result = await client.query(
				`INSERT INTO arena_matches
				(player1_id, player1_name, player1_rating, player2_id, player2_name, player2_rating, status)
				VALUES ($1, $2, $3, $4, $5, $6, 'pending')
				RETURNING *`,
				[player1.player_id, player1.player_name, player1.rating, player2.player_id, player2.player_name, player2.rating],
			);

			await client.query('COMMIT');

			const match: ArenaMatch = result.rows[0];
			this.activeMatches.set(match.id, match);

			console.log(
				`[ArenaService] Match created: ${player1.player_name} (${player1.rating}) vs ${player2.player_name} (${player2.rating})`,
			);

			return match;
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[ArenaService] Failed to create match:', error);
			return null;
		} finally {
			client.release();
		}
	}

	/**
	 * Start match
	 */
	async startMatch(matchId: number): Promise<{ success: boolean; error?: string }> {
		const client = await this.db.connect();
		try {
			await client.query('BEGIN');

			const result = await client.query(
				`UPDATE arena_matches
				SET status = 'in_progress'
				WHERE id = $1 AND status = 'pending'
				RETURNING *`,
				[matchId],
			);

			if (result.rows.length === 0) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Match not found or already started' };
			}

			await client.query('COMMIT');

			const match = result.rows[0];
			this.activeMatches.set(match.id, match);

			console.log(`[ArenaService] Match ${matchId} started`);

			return { success: true };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[ArenaService] Failed to start match:', error);
			return { success: false, error: 'Failed to start match' };
		} finally {
			client.release();
		}
	}

	/**
	 * Complete match with result
	 */
	async completeMatch(
		matchId: number,
		result: MatchResult,
	): Promise<{ success: boolean; error?: string; ratingChanges?: { winner: number; loser: number } }> {
		const match = this.activeMatches.get(matchId);

		if (!match) {
			return { success: false, error: 'Match not found' };
		}

		// Validate winner is one of the players
		if (result.winner_id !== match.player1_id && result.winner_id !== match.player2_id) {
			return { success: false, error: 'Invalid winner' };
		}

		// Validate loser is the other player
		const expectedLoserId = result.winner_id === match.player1_id ? match.player2_id : match.player1_id;
		if (result.loser_id !== expectedLoserId) {
			return { success: false, error: 'Invalid loser' };
		}

		const client = await this.db.connect();
		try {
			await client.query('BEGIN');

			// Get current ratings
			const winner = await this.getPlayer(result.winner_id);
			const loser = await this.getPlayer(result.loser_id);

			if (!winner || !loser) {
				await client.query('ROLLBACK');
				return { success: false, error: 'Player not found' };
			}

			// Calculate new ratings using ELO
			const expectedWinner = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
			const expectedLoser = 1 - expectedWinner;

			const newWinnerRating = Math.round(winner.rating + this.K_FACTOR * (1 - expectedWinner));
			const newLoserRating = Math.round(loser.rating + this.K_FACTOR * (0 - expectedLoser));

			const winnerRatingChange = newWinnerRating - winner.rating;
			const loserRatingChange = newLoserRating - loser.rating;

			// Update winner
			await client.query(
				`UPDATE arena_players
				SET rating = $1,
					wins = wins + 1,
					current_streak = current_streak + 1,
					best_streak = GREATEST(best_streak, current_streak + 1),
					last_match_at = CURRENT_TIMESTAMP,
					updated_at = CURRENT_TIMESTAMP
				WHERE player_id = $2`,
				[newWinnerRating, result.winner_id],
			);

			// Update loser
			await client.query(
				`UPDATE arena_players
				SET rating = $1,
					losses = losses + 1,
					current_streak = 0,
					last_match_at = CURRENT_TIMESTAMP,
					updated_at = CURRENT_TIMESTAMP
				WHERE player_id = $2`,
				[newLoserRating, result.loser_id],
			);

			// Update match
			await client.query(
				`UPDATE arena_matches
				SET winner_id = $1,
					status = 'completed',
					duration = $2,
					completed_at = CURRENT_TIMESTAMP
				WHERE id = $3`,
				[result.winner_id, result.duration, matchId],
			);

			await client.query('COMMIT');

			this.activeMatches.delete(matchId);

			console.log(
				`[ArenaService] Match ${matchId} completed: ${winner.player_name} wins (+${winnerRatingChange} rating)`,
			);

			return {
				success: true,
				ratingChanges: {
					winner: winnerRatingChange,
					loser: loserRatingChange,
				},
			};
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[ArenaService] Failed to complete match:', error);
			return { success: false, error: 'Failed to complete match' };
		} finally {
			client.release();
		}
	}

	/**
	 * Cancel match
	 */
	async cancelMatch(matchId: number): Promise<{ success: boolean; error?: string }> {
		const client = await this.db.connect();
		try {
			await client.query('BEGIN');

			await client.query(
				`UPDATE arena_matches
				SET status = 'cancelled',
					completed_at = CURRENT_TIMESTAMP
				WHERE id = $1`,
				[matchId],
			);

			await client.query('COMMIT');

			this.activeMatches.delete(matchId);

			console.log(`[ArenaService] Match ${matchId} cancelled`);

			return { success: true };
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('[ArenaService] Failed to cancel match:', error);
			return { success: false, error: 'Failed to cancel match' };
		} finally {
			client.release();
		}
	}

	/**
	 * Get or create player
	 */
	private async getOrCreatePlayer(playerId: string, playerName: string): Promise<ArenaPlayer> {
		let player = await this.getPlayer(playerId);

		if (!player) {
			const client = await this.db.connect();
			try {
				const result = await client.query(
					`INSERT INTO arena_players (player_id, player_name, rating)
					VALUES ($1, $2, $3)
					ON CONFLICT (player_id) DO UPDATE SET player_name = $2
					RETURNING *`,
					[playerId, playerName, this.INITIAL_RATING],
				);

				player = this.rowToPlayer(result.rows[0]);
				console.log(`[ArenaService] Created arena player: ${playerName}`);
			} finally {
				client.release();
			}
		}

		return player!;
	}

	/**
	 * Get player
	 */
	private async getPlayer(playerId: string): Promise<ArenaPlayer | null> {
		try {
			const result = await this.db.query('SELECT * FROM arena_players WHERE player_id = $1', [playerId]);

			if (result.rows.length === 0) {
				return null;
			}

			return this.rowToPlayer(result.rows[0]);
		} catch (error) {
			console.error('[ArenaService] Failed to get player:', error);
			return null;
		}
	}

	/**
	 * Get player stats
	 */
	async getPlayerStats(playerId: string): Promise<ArenaPlayer | null> {
		return this.getPlayer(playerId);
	}

	/**
	 * Get leaderboard
	 */
	async getLeaderboard(limit: number = 100, offset: number = 0): Promise<LeaderboardEntry[]> {
		try {
			const result = await this.db.query(
				`SELECT
					ROW_NUMBER() OVER (ORDER BY rating DESC) as rank,
					player_id,
					player_name,
					rating,
					wins,
					losses,
					CASE
						WHEN (wins + losses) > 0 THEN ROUND((wins::numeric / (wins + losses)) * 100, 2)
						ELSE 0
					END as win_rate
				FROM arena_players
				WHERE (wins + losses) >= $3
				ORDER BY rating DESC
				LIMIT $1 OFFSET $2`,
				[limit, offset, this.MIN_MATCHES_FOR_RANK],
			);

			return result.rows;
		} catch (error) {
			console.error('[ArenaService] Failed to get leaderboard:', error);
			return [];
		}
	}

	/**
	 * Get player rank
	 */
	async getPlayerRank(playerId: string): Promise<number | null> {
		try {
			const result = await this.db.query(
				`SELECT rank FROM (
					SELECT
						player_id,
						ROW_NUMBER() OVER (ORDER BY rating DESC) as rank
					FROM arena_players
					WHERE (wins + losses) >= $1
				) ranked
				WHERE player_id = $2`,
				[this.MIN_MATCHES_FOR_RANK, playerId],
			);

			if (result.rows.length === 0) {
				return null;
			}

			return parseInt(result.rows[0].rank);
		} catch (error) {
			console.error('[ArenaService] Failed to get player rank:', error);
			return null;
		}
	}

	/**
	 * Get match history
	 */
	async getMatchHistory(playerId: string, limit: number = 20, offset: number = 0): Promise<ArenaMatch[]> {
		try {
			const result = await this.db.query(
				`SELECT * FROM arena_matches
				WHERE (player1_id = $1 OR player2_id = $1)
				AND status = 'completed'
				ORDER BY completed_at DESC
				LIMIT $2 OFFSET $3`,
				[playerId, limit, offset],
			);

			return result.rows;
		} catch (error) {
			console.error('[ArenaService] Failed to get match history:', error);
			return [];
		}
	}

	/**
	 * Get queue status
	 */
	getQueueStatus(): { queueSize: number; averageRating: number; activeMatches: number } {
		const entries = Array.from(this.queue.values());
		const averageRating =
			entries.length > 0 ? Math.round(entries.reduce((sum, e) => sum + e.rating, 0) / entries.length) : 0;

		return {
			queueSize: this.queue.size,
			averageRating,
			activeMatches: this.activeMatches.size,
		};
	}

	/**
	 * Get active match for player
	 */
	getActiveMatch(playerId: string): ArenaMatch | null {
		for (const match of this.activeMatches.values()) {
			if (
				match.status === 'in_progress' &&
				(match.player1_id === playerId || match.player2_id === playerId)
			) {
				return match;
			}
		}
		return null;
	}

	/**
	 * Convert database row to ArenaPlayer
	 */
	private rowToPlayer(row: any): ArenaPlayer {
		const totalMatches = row.wins + row.losses;
		const winRate = totalMatches > 0 ? (row.wins / totalMatches) * 100 : 0;

		return {
			player_id: row.player_id,
			player_name: row.player_name,
			rank: 0, // Will be calculated when needed
			rating: row.rating,
			wins: row.wins,
			losses: row.losses,
			win_rate: Math.round(winRate * 100) / 100,
			current_streak: row.current_streak,
			best_streak: row.best_streak,
			last_match_at: row.last_match_at,
		};
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.stopMatchmaking();
		this.queue.clear();
		this.activeMatches.clear();
	}
}
