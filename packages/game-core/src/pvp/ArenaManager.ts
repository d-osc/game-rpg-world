/**
 * ArenaManager
 * Client-side PvP arena management
 */

import { EventEmitter } from '../utils/EventEmitter.ts';

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

export interface LeaderboardEntry {
	rank: number;
	player_id: string;
	player_name: string;
	rating: number;
	wins: number;
	losses: number;
	win_rate: number;
}

export interface QueueStatus {
	queueSize: number;
	averageRating: number;
	activeMatches: number;
}

export interface MatchResult {
	winner_id: string;
	loser_id: string;
	duration: number;
}

export interface ArenaManagerEvents {
	'queue-joined': (queueSize: number) => void;
	'queue-left': () => void;
	'match-found': (match: ArenaMatch) => void;
	'match-started': (matchId: number) => void;
	'match-completed': (matchId: number, ratingChange: number) => void;
	'match-cancelled': (matchId: number) => void;
	'stats-updated': (stats: ArenaPlayer) => void;
	'leaderboard-updated': (leaderboard: LeaderboardEntry[]) => void;
	'error': (message: string) => void;
}

export class ArenaManager extends EventEmitter<ArenaManagerEvents> {
	private apiUrl: string;
	private playerId: string;
	private playerName: string;
	private authToken: string | null = null;
	private inQueue: boolean = false;
	private currentMatch: ArenaMatch | null = null;
	private stats: ArenaPlayer | null = null;
	private leaderboard: LeaderboardEntry[] = [];
	private queuePollInterval: Timer | null = null;
	private matchPollInterval: Timer | null = null;

	// Polling intervals
	private readonly QUEUE_POLL_INTERVAL = 2000; // 2 seconds
	private readonly MATCH_POLL_INTERVAL = 1000; // 1 second

	constructor(apiUrl: string, playerId: string, playerName: string) {
		super();
		this.apiUrl = apiUrl;
		this.playerId = playerId;
		this.playerName = playerName;
	}

	/**
	 * Set auth token
	 */
	setAuthToken(token: string): void {
		this.authToken = token;
	}

	/**
	 * Join arena queue
	 */
	async joinQueue(): Promise<{ success: boolean; error?: string; queueSize?: number }> {
		if (this.inQueue) {
			const error = 'Already in queue';
			this.emit('error', error);
			return { success: false, error };
		}

		if (this.currentMatch) {
			const error = 'Already in a match';
			this.emit('error', error);
			return { success: false, error };
		}

		try {
			const response = await fetch(`${this.apiUrl}/arena/queue/join`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				body: JSON.stringify({
					player_id: this.playerId,
					player_name: this.playerName,
				}),
			});

			const data = await response.json();

			if (data.success) {
				this.inQueue = true;
				this.emit('queue-joined', data.queueSize || 0);
				this.startQueuePolling();
			} else if (data.error) {
				this.emit('error', data.error);
			}

			return data;
		} catch (error) {
			const errorMsg = 'Failed to join queue';
			this.emit('error', errorMsg);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Leave arena queue
	 */
	async leaveQueue(): Promise<{ success: boolean; error?: string }> {
		if (!this.inQueue) {
			return { success: false, error: 'Not in queue' };
		}

		try {
			const response = await fetch(`${this.apiUrl}/arena/queue/leave`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				body: JSON.stringify({
					player_id: this.playerId,
				}),
			});

			const data = await response.json();

			if (data.success) {
				this.inQueue = false;
				this.stopQueuePolling();
				this.emit('queue-left');
			}

			return data;
		} catch (error) {
			const errorMsg = 'Failed to leave queue';
			this.emit('error', errorMsg);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Start queue polling
	 */
	private startQueuePolling(): void {
		if (this.queuePollInterval) {
			return;
		}

		this.queuePollInterval = setInterval(() => {
			this.checkForMatch();
		}, this.QUEUE_POLL_INTERVAL);
	}

	/**
	 * Stop queue polling
	 */
	private stopQueuePolling(): void {
		if (this.queuePollInterval) {
			clearInterval(this.queuePollInterval);
			this.queuePollInterval = null;
		}
	}

	/**
	 * Check for match
	 */
	private async checkForMatch(): Promise<void> {
		if (!this.inQueue) {
			this.stopQueuePolling();
			return;
		}

		try {
			const response = await fetch(`${this.apiUrl}/arena/match/active/${this.playerId}`, {
				method: 'GET',
				headers: {
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
			});

			const data = await response.json();

			if (data.match) {
				this.inQueue = false;
				this.stopQueuePolling();
				this.currentMatch = data.match;
				this.emit('match-found', data.match);
				this.startMatchPolling();
			}
		} catch (error) {
			// Silent fail, will retry on next poll
		}
	}

	/**
	 * Start match polling
	 */
	private startMatchPolling(): void {
		if (this.matchPollInterval) {
			return;
		}

		this.matchPollInterval = setInterval(() => {
			this.checkMatchStatus();
		}, this.MATCH_POLL_INTERVAL);
	}

	/**
	 * Stop match polling
	 */
	private stopMatchPolling(): void {
		if (this.matchPollInterval) {
			clearInterval(this.matchPollInterval);
			this.matchPollInterval = null;
		}
	}

	/**
	 * Check match status
	 */
	private async checkMatchStatus(): Promise<void> {
		if (!this.currentMatch) {
			this.stopMatchPolling();
			return;
		}

		try {
			const response = await fetch(`${this.apiUrl}/arena/match/${this.currentMatch.id}`, {
				method: 'GET',
				headers: {
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
			});

			const data = await response.json();

			if (data.match) {
				const match = data.match;

				// Check if match started
				if (match.status === 'in_progress' && this.currentMatch.status === 'pending') {
					this.emit('match-started', match.id);
				}

				// Check if match completed
				if (match.status === 'completed') {
					this.stopMatchPolling();
					const wasWinner = match.winner_id === this.playerId;
					const ratingChange = data.ratingChange || 0;
					this.currentMatch = null;
					this.emit('match-completed', match.id, ratingChange);
					await this.fetchStats();
				}

				// Check if match cancelled
				if (match.status === 'cancelled') {
					this.stopMatchPolling();
					this.currentMatch = null;
					this.emit('match-cancelled', match.id);
				}

				this.currentMatch = match;
			}
		} catch (error) {
			// Silent fail, will retry on next poll
		}
	}

	/**
	 * Complete match
	 */
	async completeMatch(result: MatchResult): Promise<{ success: boolean; error?: string; ratingChanges?: any }> {
		if (!this.currentMatch) {
			return { success: false, error: 'No active match' };
		}

		try {
			const response = await fetch(`${this.apiUrl}/arena/match/complete/${this.currentMatch.id}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				body: JSON.stringify(result),
			});

			const data = await response.json();

			if (data.success) {
				const wasWinner = result.winner_id === this.playerId;
				const myRatingChange = wasWinner ? data.ratingChanges?.winner || 0 : data.ratingChanges?.loser || 0;

				this.stopMatchPolling();
				this.currentMatch = null;
				this.emit('match-completed', this.currentMatch!.id, myRatingChange);
				await this.fetchStats();
			} else if (data.error) {
				this.emit('error', data.error);
			}

			return data;
		} catch (error) {
			const errorMsg = 'Failed to complete match';
			this.emit('error', errorMsg);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Fetch player stats
	 */
	async fetchStats(): Promise<ArenaPlayer | null> {
		try {
			const response = await fetch(`${this.apiUrl}/arena/stats/${this.playerId}`, {
				method: 'GET',
				headers: {
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
			});

			const data = await response.json();

			if (data.stats) {
				this.stats = data.stats;
				this.emit('stats-updated', data.stats);
				return data.stats;
			}

			return null;
		} catch (error) {
			this.emit('error', 'Failed to fetch stats');
			return null;
		}
	}

	/**
	 * Get player stats
	 */
	getStats(): ArenaPlayer | null {
		return this.stats;
	}

	/**
	 * Fetch leaderboard
	 */
	async fetchLeaderboard(limit: number = 100, offset: number = 0): Promise<LeaderboardEntry[]> {
		try {
			const response = await fetch(`${this.apiUrl}/arena/leaderboard?limit=${limit}&offset=${offset}`, {
				method: 'GET',
				headers: {
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
			});

			const data = await response.json();

			if (data.leaderboard) {
				this.leaderboard = data.leaderboard;
				this.emit('leaderboard-updated', data.leaderboard);
				return data.leaderboard;
			}

			return [];
		} catch (error) {
			this.emit('error', 'Failed to fetch leaderboard');
			return [];
		}
	}

	/**
	 * Get leaderboard
	 */
	getLeaderboard(): LeaderboardEntry[] {
		return this.leaderboard;
	}

	/**
	 * Get player rank
	 */
	async getPlayerRank(): Promise<number | null> {
		try {
			const response = await fetch(`${this.apiUrl}/arena/rank/${this.playerId}`, {
				method: 'GET',
				headers: {
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
			});

			const data = await response.json();

			return data.rank || null;
		} catch (error) {
			this.emit('error', 'Failed to get rank');
			return null;
		}
	}

	/**
	 * Get match history
	 */
	async getMatchHistory(limit: number = 20, offset: number = 0): Promise<ArenaMatch[]> {
		try {
			const response = await fetch(
				`${this.apiUrl}/arena/history/${this.playerId}?limit=${limit}&offset=${offset}`,
				{
					method: 'GET',
					headers: {
						...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
					},
				},
			);

			const data = await response.json();

			return data.matches || [];
		} catch (error) {
			this.emit('error', 'Failed to get match history');
			return [];
		}
	}

	/**
	 * Get queue status
	 */
	async getQueueStatus(): Promise<QueueStatus | null> {
		try {
			const response = await fetch(`${this.apiUrl}/arena/queue/status`, {
				method: 'GET',
				headers: {
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
			});

			const data = await response.json();

			return data.status || null;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Is in queue
	 */
	isInQueue(): boolean {
		return this.inQueue;
	}

	/**
	 * Get current match
	 */
	getCurrentMatch(): ArenaMatch | null {
		return this.currentMatch;
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.stopQueuePolling();
		this.stopMatchPolling();
		this.removeAllListeners();
		this.inQueue = false;
		this.currentMatch = null;
		this.stats = null;
		this.leaderboard = [];
	}
}
