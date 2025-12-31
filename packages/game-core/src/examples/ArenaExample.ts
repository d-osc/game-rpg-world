/**
 * ArenaExample
 * Example usage of PvP arena system
 */

import { ArenaManager } from '../pvp/ArenaManager';
import { ArenaUI } from '../ui/ArenaUI';

export class ArenaExample {
	private arenaManager: ArenaManager;
	private arenaUI: ArenaUI | null = null;

	constructor() {
		this.arenaManager = new ArenaManager('http://localhost:3000', 'player123', 'TestPlayer');

		// Setup event listeners
		this.setupEventListeners();

		console.log('[ArenaExample] Initialized');
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		this.arenaManager.on('queue-joined', (queueSize) => {
			console.log(`[Event] Joined queue (${queueSize} players in queue)`);
		});

		this.arenaManager.on('queue-left', () => {
			console.log('[Event] Left queue');
		});

		this.arenaManager.on('match-found', (match) => {
			console.log('[Event] Match found!');
			console.log('  Opponent:', match.player1_id === 'player123' ? match.player2_name : match.player1_name);
			console.log('  Match ID:', match.id);
		});

		this.arenaManager.on('match-started', (matchId) => {
			console.log(`[Event] Match ${matchId} started`);
		});

		this.arenaManager.on('match-completed', (matchId, ratingChange) => {
			console.log(`[Event] Match ${matchId} completed`);
			console.log(`  Rating change: ${ratingChange > 0 ? '+' : ''}${ratingChange}`);
		});

		this.arenaManager.on('match-cancelled', (matchId) => {
			console.log(`[Event] Match ${matchId} cancelled`);
		});

		this.arenaManager.on('stats-updated', (stats) => {
			console.log('[Event] Stats updated');
			console.log('  Rating:', stats.rating);
			console.log('  Record:', `${stats.wins}W - ${stats.losses}L`);
			console.log('  Win rate:', `${stats.win_rate.toFixed(1)}%`);
		});

		this.arenaManager.on('leaderboard-updated', (leaderboard) => {
			console.log(`[Event] Leaderboard updated (${leaderboard.length} players)`);
		});

		this.arenaManager.on('error', (message) => {
			console.error(`[Event] Error: ${message}`);
		});
	}

	/**
	 * Example 1: Join queue
	 */
	async exampleJoinQueue(): Promise<void> {
		console.log('\n=== Example 1: Join Queue ===');

		const result = await this.arenaManager.joinQueue();

		if (result.success) {
			console.log(`✓ Joined queue (${result.queueSize} players in queue)`);
			console.log('Waiting for match...');
		} else {
			console.error(`✗ Failed to join queue: ${result.error}`);
		}
	}

	/**
	 * Example 2: Leave queue
	 */
	async exampleLeaveQueue(): Promise<void> {
		console.log('\n=== Example 2: Leave Queue ===');

		const result = await this.arenaManager.leaveQueue();

		if (result.success) {
			console.log('✓ Left queue');
		} else {
			console.error(`✗ Failed to leave queue: ${result.error}`);
		}
	}

	/**
	 * Example 3: Get player stats
	 */
	async exampleGetStats(): Promise<void> {
		console.log('\n=== Example 3: Get Player Stats ===');

		const stats = await this.arenaManager.fetchStats();

		if (stats) {
			console.log('Player Stats:');
			console.log(`  Rating: ${stats.rating}`);
			console.log(`  Wins: ${stats.wins}`);
			console.log(`  Losses: ${stats.losses}`);
			console.log(`  Win Rate: ${stats.win_rate.toFixed(1)}%`);
			console.log(`  Current Streak: ${stats.current_streak}`);
			console.log(`  Best Streak: ${stats.best_streak}`);
		} else {
			console.log('No stats available (player has not played any matches)');
		}

		// Get rank
		const rank = await this.arenaManager.getPlayerRank();
		if (rank !== null) {
			console.log(`  Rank: #${rank}`);
		} else {
			console.log('  Rank: Unranked (need more matches)');
		}
	}

	/**
	 * Example 4: View leaderboard
	 */
	async exampleViewLeaderboard(): Promise<void> {
		console.log('\n=== Example 4: View Leaderboard ===');

		const leaderboard = await this.arenaManager.fetchLeaderboard(10);

		console.log('Top 10 Players:');
		console.log('Rank | Player Name          | Rating | W/L     | Win Rate');
		console.log('-----+---------------------+--------+---------+---------');

		leaderboard.forEach((entry) => {
			const rankStr = entry.rank.toString().padStart(4);
			const nameStr = entry.player_name.padEnd(20);
			const ratingStr = entry.rating.toString().padStart(6);
			const recordStr = `${entry.wins}/${entry.losses}`.padStart(7);
			const winRateStr = `${entry.win_rate.toFixed(1)}%`.padStart(7);

			console.log(`${rankStr} | ${nameStr} | ${ratingStr} | ${recordStr} | ${winRateStr}`);
		});
	}

	/**
	 * Example 5: View match history
	 */
	async exampleViewMatchHistory(): Promise<void> {
		console.log('\n=== Example 5: View Match History ===');

		const matches = await this.arenaManager.getMatchHistory(10);

		if (matches.length === 0) {
			console.log('No match history yet.');
			return;
		}

		console.log(`Recent Matches (${matches.length}):\n`);

		matches.forEach((match, index) => {
			const wasPlayer1 = match.player1_id === 'player123';
			const opponent = wasPlayer1 ? match.player2_name : match.player1_name;
			const myRating = wasPlayer1 ? match.player1_rating : match.player2_rating;
			const opponentRating = wasPlayer1 ? match.player2_rating : match.player1_rating;
			const won = match.winner_id === 'player123';

			console.log(`Match #${index + 1}:`);
			console.log(`  Result: ${won ? '✅ Victory' : '❌ Defeat'}`);
			console.log(`  Opponent: ${opponent} (Rating: ${opponentRating})`);
			console.log(`  Your Rating: ${myRating}`);
			console.log(`  Date: ${new Date(match.completed_at!).toLocaleString()}`);
			console.log('');
		});
	}

	/**
	 * Example 6: Simulate match
	 */
	async exampleSimulateMatch(): Promise<void> {
		console.log('\n=== Example 6: Simulate Match ===');

		// Join queue
		console.log('1. Joining queue...');
		await this.arenaManager.joinQueue();

		// Wait for match (in real scenario, this would be handled by polling)
		console.log('2. Waiting for match...');
		console.log('   (In real scenario, match would be found automatically)');

		// Simulate match found
		console.log('3. Match found!');

		// Get current match
		const match = this.arenaManager.getCurrentMatch();
		if (!match) {
			console.log('   No match found in this example');
			return;
		}

		// Simulate combat
		console.log('4. Combat in progress...');
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Complete match (simulate win)
		console.log('5. Completing match...');
		const result = await this.arenaManager.completeMatch({
			winner_id: 'player123',
			loser_id: match.player1_id === 'player123' ? match.player2_id : match.player1_id,
			duration: 120,
		});

		if (result.success) {
			console.log('✓ Match completed successfully');
			if (result.ratingChanges) {
				console.log(`   Rating change: +${result.ratingChanges.winner}`);
			}
		} else {
			console.error(`✗ Failed to complete match: ${result.error}`);
		}

		// Fetch updated stats
		await this.exampleGetStats();
	}

	/**
	 * Example 7: Check queue status
	 */
	async exampleCheckQueueStatus(): Promise<void> {
		console.log('\n=== Example 7: Check Queue Status ===');

		const status = await this.arenaManager.getQueueStatus();

		if (status) {
			console.log('Queue Status:');
			console.log(`  Players in queue: ${status.queueSize}`);
			console.log(`  Average rating: ${status.averageRating}`);
			console.log(`  Active matches: ${status.activeMatches}`);
		} else {
			console.log('Failed to get queue status');
		}
	}

	/**
	 * Example 8: UI Integration
	 */
	exampleUI(): void {
		console.log('\n=== Example 8: UI Integration ===');

		// Create UI container
		const container = document.createElement('div');
		container.id = 'arena-container';
		container.style.cssText = `
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			z-index: 1000;
		`;
		document.body.appendChild(container);

		// Create UI
		this.arenaUI = new ArenaUI(container, this.arenaManager);

		// Show UI
		this.arenaUI.show();

		console.log('✓ Arena UI opened');
		console.log('You can now:');
		console.log('- Join queue for matchmaking');
		console.log('- View your stats and rank');
		console.log('- Browse the leaderboard');
		console.log('- Check match history');
	}

	/**
	 * Example 9: Full matchmaking flow
	 */
	async exampleFullFlow(): Promise<void> {
		console.log('\n=== Example 9: Full Matchmaking Flow ===');

		// Step 1: Get initial stats
		console.log('Step 1: Fetching initial stats...');
		await this.exampleGetStats();

		// Step 2: Join queue
		console.log('\nStep 2: Joining queue...');
		await this.arenaManager.joinQueue();

		// Step 3: Wait for match
		console.log('\nStep 3: Waiting for match...');
		console.log('(Matchmaking will automatically find an opponent)');

		// Note: In a real scenario, the match-found event would trigger automatically
		// and you would handle it in the event listener

		console.log('\nFull flow initiated. Events will fire as matchmaking progresses.');
		console.log('Check the event listeners for match updates.');
	}

	/**
	 * Example 10: Rating calculation demonstration
	 */
	async exampleRatingCalculation(): Promise<void> {
		console.log('\n=== Example 10: Rating Calculation ===');
		console.log('Arena uses ELO rating system:');
		console.log('- Initial rating: 1500');
		console.log('- K-factor: 32');
		console.log('- Rating changes based on:');
		console.log('  1. Your current rating');
		console.log('  2. Opponent\'s rating');
		console.log('  3. Match outcome');
		console.log('');
		console.log('Example scenarios:');
		console.log('- Beat higher rated opponent: Large rating gain');
		console.log('- Beat lower rated opponent: Small rating gain');
		console.log('- Lose to higher rated opponent: Small rating loss');
		console.log('- Lose to lower rated opponent: Large rating loss');
	}

	/**
	 * Run all examples (non-UI)
	 */
	async runAllExamples(): Promise<void> {
		console.log('=== Running All Arena Examples ===\n');

		// Run examples in sequence
		await this.exampleGetStats();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.exampleViewLeaderboard();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.exampleViewMatchHistory();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.exampleCheckQueueStatus();
		await new Promise((resolve) => setTimeout(resolve, 500));

		await this.exampleRatingCalculation();
		await new Promise((resolve) => setTimeout(resolve, 500));

		// UI example (runs independently)
		// this.exampleUI();

		console.log('\n=== Examples Complete ===');
		console.log('To test matchmaking:');
		console.log('1. Open exampleUI() to use the UI');
		console.log('2. Or run exampleFullFlow() for programmatic matchmaking');
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		if (this.arenaUI) {
			this.arenaUI.destroy();
			this.arenaUI = null;
		}

		this.arenaManager.destroy();

		const container = document.getElementById('arena-container');
		if (container) {
			container.remove();
		}
	}
}

// Usage:
// const example = new ArenaExample();
// await example.runAllExamples();
// example.exampleUI();
