/**
 * ArenaUI
 * UI for PvP arena matchmaking and leaderboard
 */

import type { ArenaManager, ArenaPlayer, ArenaMatch, LeaderboardEntry } from '../pvp/ArenaManager.ts';

export class ArenaUI {
	private container: HTMLElement;
	private arenaManager: ArenaManager;
	private currentTab: 'queue' | 'stats' | 'leaderboard' | 'history' = 'queue';
	private queueTimerInterval: Timer | null = null;
	private queueStartTime: number = 0;

	constructor(container: HTMLElement, arenaManager: ArenaManager) {
		this.container = container;
		this.arenaManager = arenaManager;

		this.setupEventListeners();
		this.render();
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		this.arenaManager.on('queue-joined', (queueSize) => {
			this.queueStartTime = Date.now();
			this.startQueueTimer();
			this.render();
		});

		this.arenaManager.on('queue-left', () => {
			this.stopQueueTimer();
			this.render();
		});

		this.arenaManager.on('match-found', (match) => {
			this.stopQueueTimer();
			this.showMatchFound(match);
		});

		this.arenaManager.on('match-started', (matchId) => {
			this.render();
		});

		this.arenaManager.on('match-completed', (matchId, ratingChange) => {
			this.showMatchResult(ratingChange);
			this.render();
		});

		this.arenaManager.on('match-cancelled', () => {
			this.showError('Match was cancelled');
			this.render();
		});

		this.arenaManager.on('stats-updated', () => {
			this.render();
		});

		this.arenaManager.on('leaderboard-updated', () => {
			this.render();
		});

		this.arenaManager.on('error', (message) => {
			this.showError(message);
		});
	}

	/**
	 * Start queue timer
	 */
	private startQueueTimer(): void {
		if (this.queueTimerInterval) {
			return;
		}

		this.queueTimerInterval = setInterval(() => {
			this.updateQueueTimer();
		}, 1000);
	}

	/**
	 * Stop queue timer
	 */
	private stopQueueTimer(): void {
		if (this.queueTimerInterval) {
			clearInterval(this.queueTimerInterval);
			this.queueTimerInterval = null;
		}
	}

	/**
	 * Update queue timer
	 */
	private updateQueueTimer(): void {
		const timerEl = document.getElementById('arena-queue-timer');
		if (timerEl && this.queueStartTime > 0) {
			const elapsed = Math.floor((Date.now() - this.queueStartTime) / 1000);
			const minutes = Math.floor(elapsed / 60);
			const seconds = elapsed % 60;
			timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
		}
	}

	/**
	 * Show match found notification
	 */
	private showMatchFound(match: ArenaMatch): void {
		const notification = document.createElement('div');
		notification.className = 'arena-notification';
		notification.style.cssText = `
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			padding: 40px;
			border-radius: 12px;
			box-shadow: 0 10px 30px rgba(0,0,0,0.5);
			z-index: 10001;
			text-align: center;
			min-width: 400px;
		`;

		const opponent =
			match.player1_id === this.arenaManager['playerId'] ? match.player2_name : match.player1_name;
		const opponentRating =
			match.player1_id === this.arenaManager['playerId'] ? match.player2_rating : match.player1_rating;

		notification.innerHTML = `
			<h2 style="margin: 0 0 20px 0; font-size: 32px;">Match Found!</h2>
			<div style="font-size: 18px; margin-bottom: 20px;">
				<div style="margin-bottom: 10px;">Opponent: <strong>${opponent}</strong></div>
				<div style="color: rgba(255,255,255,0.8);">Rating: ${opponentRating}</div>
			</div>
			<div style="font-size: 14px; color: rgba(255,255,255,0.6);">
				Prepare for battle!
			</div>
		`;

		document.body.appendChild(notification);

		setTimeout(() => {
			notification.remove();
		}, 5000);
	}

	/**
	 * Show match result
	 */
	private showMatchResult(ratingChange: number): void {
		const notification = document.createElement('div');
		notification.className = 'arena-notification';
		notification.style.cssText = `
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			background: ${ratingChange > 0 ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)'};
			color: white;
			padding: 40px;
			border-radius: 12px;
			box-shadow: 0 10px 30px rgba(0,0,0,0.5);
			z-index: 10001;
			text-align: center;
			min-width: 400px;
		`;

		notification.innerHTML = `
			<h2 style="margin: 0 0 20px 0; font-size: 32px;">${ratingChange > 0 ? 'Victory!' : 'Defeat'}</h2>
			<div style="font-size: 24px; font-weight: bold;">
				Rating: ${ratingChange > 0 ? '+' : ''}${ratingChange}
			</div>
		`;

		document.body.appendChild(notification);

		setTimeout(() => {
			notification.remove();
		}, 4000);
	}

	/**
	 * Show error message
	 */
	private showError(message: string): void {
		const errorDiv = document.createElement('div');
		errorDiv.className = 'arena-error';
		errorDiv.textContent = message;
		errorDiv.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			background: #f44336;
			color: white;
			padding: 12px 20px;
			border-radius: 4px;
			box-shadow: 0 2px 8px rgba(0,0,0,0.3);
			z-index: 10000;
		`;

		document.body.appendChild(errorDiv);

		setTimeout(() => {
			errorDiv.remove();
		}, 3000);
	}

	/**
	 * Render UI
	 */
	render(): void {
		this.container.innerHTML = '';

		const wrapper = document.createElement('div');
		wrapper.className = 'arena-ui';
		wrapper.style.cssText = `
			width: 900px;
			height: 600px;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			border-radius: 12px;
			padding: 20px;
			color: white;
			font-family: Arial, sans-serif;
			display: flex;
			flex-direction: column;
		`;

		// Header
		const header = document.createElement('div');
		header.style.cssText = 'margin-bottom: 20px;';
		header.innerHTML = `<h2 style="margin: 0; font-size: 24px;">⚔️ PvP Arena</h2>`;
		wrapper.appendChild(header);

		// Tabs
		const tabs = document.createElement('div');
		tabs.style.cssText = `
			display: flex;
			gap: 10px;
			margin-bottom: 20px;
		`;

		const tabButtons = [
			{ id: 'queue', label: 'Queue' },
			{ id: 'stats', label: 'My Stats' },
			{ id: 'leaderboard', label: 'Leaderboard' },
			{ id: 'history', label: 'Match History' },
		];

		tabButtons.forEach((tab) => {
			const button = document.createElement('button');
			button.textContent = tab.label;
			button.style.cssText = `
				padding: 10px 20px;
				border: none;
				border-radius: 6px;
				cursor: pointer;
				font-size: 14px;
				background: ${this.currentTab === tab.id ? '#ffffff' : 'rgba(255,255,255,0.2)'};
				color: ${this.currentTab === tab.id ? '#667eea' : 'white'};
				font-weight: ${this.currentTab === tab.id ? 'bold' : 'normal'};
			`;

			button.addEventListener('click', () => {
				this.currentTab = tab.id as any;
				this.render();
			});

			tabs.appendChild(button);
		});

		wrapper.appendChild(tabs);

		// Content
		const content = document.createElement('div');
		content.style.cssText = `
			flex: 1;
			overflow-y: auto;
			background: rgba(255,255,255,0.1);
			border-radius: 8px;
			padding: 20px;
		`;

		if (this.currentTab === 'queue') {
			this.renderQueueTab(content);
		} else if (this.currentTab === 'stats') {
			this.renderStatsTab(content);
		} else if (this.currentTab === 'leaderboard') {
			this.renderLeaderboardTab(content);
		} else if (this.currentTab === 'history') {
			this.renderHistoryTab(content);
		}

		wrapper.appendChild(content);

		// Close button
		const closeBtn = document.createElement('button');
		closeBtn.textContent = 'Close';
		closeBtn.style.cssText = `
			margin-top: 15px;
			padding: 10px 30px;
			border: none;
			border-radius: 6px;
			background: rgba(255,255,255,0.2);
			color: white;
			cursor: pointer;
			font-size: 14px;
			align-self: flex-end;
		`;
		closeBtn.addEventListener('click', () => {
			this.container.innerHTML = '';
		});
		wrapper.appendChild(closeBtn);

		this.container.appendChild(wrapper);
	}

	/**
	 * Render queue tab
	 */
	private renderQueueTab(content: HTMLElement): void {
		const inQueue = this.arenaManager.isInQueue();
		const currentMatch = this.arenaManager.getCurrentMatch();

		if (currentMatch) {
			// Show current match
			const opponent =
				currentMatch.player1_id === this.arenaManager['playerId']
					? currentMatch.player2_name
					: currentMatch.player1_name;
			const opponentRating =
				currentMatch.player1_id === this.arenaManager['playerId']
					? currentMatch.player2_rating
					: currentMatch.player1_rating;

			content.innerHTML = `
				<div style="text-align: center; padding: 40px;">
					<h3 style="margin-top: 0; font-size: 28px;">In Match</h3>
					<div style="margin: 30px 0; font-size: 20px;">
						<div style="margin-bottom: 15px;">vs <strong>${opponent}</strong></div>
						<div style="color: rgba(255,255,255,0.7);">Rating: ${opponentRating}</div>
					</div>
					<div style="font-size: 16px; color: rgba(255,255,255,0.6);">
						Status: ${currentMatch.status === 'pending' ? 'Starting...' : 'In Progress'}
					</div>
				</div>
			`;
		} else if (inQueue) {
			// Show queue status
			content.innerHTML = `
				<div style="text-align: center; padding: 40px;">
					<h3 style="margin-top: 0; font-size: 28px;">🔍 Searching for opponent...</h3>
					<div style="margin: 30px 0;">
						<div style="font-size: 48px; font-weight: bold; margin-bottom: 10px;" id="arena-queue-timer">0:00</div>
						<div style="font-size: 14px; color: rgba(255,255,255,0.7);">Time in queue</div>
					</div>
				</div>
			`;

			this.updateQueueTimer();

			const leaveBtn = document.createElement('button');
			leaveBtn.textContent = 'Leave Queue';
			leaveBtn.style.cssText = `
				display: block;
				margin: 20px auto 0;
				padding: 12px 30px;
				border: none;
				border-radius: 6px;
				background: #f44336;
				color: white;
				cursor: pointer;
				font-size: 16px;
				font-weight: bold;
			`;
			leaveBtn.addEventListener('click', () => {
				this.arenaManager.leaveQueue();
			});
			content.appendChild(leaveBtn);
		} else {
			// Show join queue button
			const stats = this.arenaManager.getStats();

			content.innerHTML = `
				<div style="text-align: center; padding: 40px;">
					<h3 style="margin-top: 0; font-size: 28px;">Ready to fight?</h3>
					${
						stats
							? `
						<div style="margin: 20px 0; font-size: 16px;">
							<div style="margin-bottom: 10px;">Your Rating: <strong>${stats.rating}</strong></div>
							<div style="color: rgba(255,255,255,0.7);">
								${stats.wins}W - ${stats.losses}L (${stats.win_rate.toFixed(1)}% win rate)
							</div>
						</div>
					`
							: ''
					}
				</div>
			`;

			const joinBtn = document.createElement('button');
			joinBtn.textContent = 'Join Queue';
			joinBtn.style.cssText = `
				display: block;
				margin: 20px auto 0;
				padding: 16px 40px;
				border: none;
				border-radius: 8px;
				background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
				color: white;
				cursor: pointer;
				font-size: 18px;
				font-weight: bold;
				box-shadow: 0 4px 12px rgba(0,0,0,0.3);
			`;
			joinBtn.addEventListener('click', async () => {
				await this.arenaManager.joinQueue();
			});
			content.appendChild(joinBtn);
		}
	}

	/**
	 * Render stats tab
	 */
	private renderStatsTab(content: HTMLElement): void {
		const stats = this.arenaManager.getStats();

		if (!stats) {
			content.innerHTML = '<p style="color: rgba(255,255,255,0.7);">Loading stats...</p>';
			this.arenaManager.fetchStats();
			return;
		}

		const totalMatches = stats.wins + stats.losses;

		content.innerHTML = `
			<div>
				<h3 style="margin-top: 0;">Your Arena Stats</h3>

				<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px;">
					<div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; text-align: center;">
						<div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 5px;">Rating</div>
						<div style="font-size: 36px; font-weight: bold;">${stats.rating}</div>
					</div>

					<div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; text-align: center;">
						<div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 5px;">Rank</div>
						<div style="font-size: 36px; font-weight: bold;">#${stats.rank || '---'}</div>
					</div>
				</div>

				<div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
					<h4 style="margin-top: 0;">Record</h4>
					<div style="font-size: 24px; margin-bottom: 10px;">
						<span style="color: #4CAF50;">${stats.wins}W</span> -
						<span style="color: #f44336;">${stats.losses}L</span>
					</div>
					<div style="font-size: 14px; color: rgba(255,255,255,0.7);">
						${totalMatches} total matches | ${stats.win_rate.toFixed(1)}% win rate
					</div>
				</div>

				<div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px;">
					<h4 style="margin-top: 0;">Streaks</h4>
					<div style="display: flex; justify-content: space-around;">
						<div>
							<div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 5px;">Current</div>
							<div style="font-size: 28px; font-weight: bold;">${stats.current_streak}</div>
						</div>
						<div>
							<div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 5px;">Best</div>
							<div style="font-size: 28px; font-weight: bold; color: #FFD700;">${stats.best_streak}</div>
						</div>
					</div>
				</div>
			</div>
		`;

		// Fetch rank
		this.arenaManager.getPlayerRank().then((rank) => {
			if (rank !== null) {
				const rankEl = content.querySelector('.rank-value');
				if (rankEl) {
					rankEl.textContent = `#${rank}`;
				}
			}
		});
	}

	/**
	 * Render leaderboard tab
	 */
	private renderLeaderboardTab(content: HTMLElement): void {
		const leaderboard = this.arenaManager.getLeaderboard();

		if (leaderboard.length === 0) {
			content.innerHTML = '<p style="color: rgba(255,255,255,0.7);">Loading leaderboard...</p>';
			this.arenaManager.fetchLeaderboard(50);
			return;
		}

		content.innerHTML = '<h3 style="margin-top: 0;">Top Players</h3>';

		const table = document.createElement('table');
		table.style.cssText = `
			width: 100%;
			border-collapse: collapse;
		`;

		table.innerHTML = `
			<thead>
				<tr style="border-bottom: 2px solid rgba(255,255,255,0.3);">
					<th style="padding: 10px; text-align: left;">Rank</th>
					<th style="padding: 10px; text-align: left;">Player</th>
					<th style="padding: 10px; text-align: center;">Rating</th>
					<th style="padding: 10px; text-align: center;">W/L</th>
					<th style="padding: 10px; text-align: center;">Win Rate</th>
				</tr>
			</thead>
		`;

		const tbody = document.createElement('tbody');

		leaderboard.forEach((entry, index) => {
			const row = document.createElement('tr');
			row.style.cssText = 'border-bottom: 1px solid rgba(255,255,255,0.1);';

			const isMe = entry.player_id === this.arenaManager['playerId'];
			const rankColor = entry.rank === 1 ? '#FFD700' : entry.rank === 2 ? '#C0C0C0' : entry.rank === 3 ? '#CD7F32' : 'white';

			row.innerHTML = `
				<td style="padding: 12px; font-weight: bold; color: ${rankColor};">
					${entry.rank === 1 ? '👑' : ''} #${entry.rank}
				</td>
				<td style="padding: 12px; ${isMe ? 'font-weight: bold; color: #FFD700;' : ''}">
					${entry.player_name} ${isMe ? '(You)' : ''}
				</td>
				<td style="padding: 12px; text-align: center; font-weight: bold;">${entry.rating}</td>
				<td style="padding: 12px; text-align: center;">${entry.wins}/${entry.losses}</td>
				<td style="padding: 12px; text-align: center;">${entry.win_rate.toFixed(1)}%</td>
			`;

			tbody.appendChild(row);
		});

		table.appendChild(tbody);
		content.appendChild(table);
	}

	/**
	 * Render history tab
	 */
	private renderHistoryTab(content: HTMLElement): void {
		content.innerHTML = '<h3 style="margin-top: 0;">Match History</h3><p style="color: rgba(255,255,255,0.7);">Loading...</p>';

		this.arenaManager.getMatchHistory(20).then((matches) => {
			content.innerHTML = '<h3 style="margin-top: 0;">Recent Matches</h3>';

			if (matches.length === 0) {
				content.innerHTML += '<p style="color: rgba(255,255,255,0.7);">No match history yet.</p>';
				return;
			}

			const list = document.createElement('div');
			list.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

			matches.forEach((match) => {
				const wasPlayer1 = match.player1_id === this.arenaManager['playerId'];
				const myRating = wasPlayer1 ? match.player1_rating : match.player2_rating;
				const opponent = wasPlayer1 ? match.player2_name : match.player1_name;
				const opponentRating = wasPlayer1 ? match.player2_rating : match.player1_rating;
				const won = match.winner_id === this.arenaManager['playerId'];

				const matchCard = document.createElement('div');
				matchCard.style.cssText = `
					padding: 15px;
					background: ${won ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'};
					border-left: 4px solid ${won ? '#4CAF50' : '#f44336'};
					border-radius: 6px;
				`;

				const date = new Date(match.completed_at!);
				const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

				matchCard.innerHTML = `
					<div style="display: flex; justify-content: space-between; align-items: center;">
						<div>
							<div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">
								${won ? '✅ Victory' : '❌ Defeat'} vs ${opponent}
							</div>
							<div style="font-size: 12px; color: rgba(255,255,255,0.6);">
								Your Rating: ${myRating} | Opponent: ${opponentRating}
							</div>
						</div>
						<div style="text-align: right; font-size: 12px; color: rgba(255,255,255,0.6);">
							${dateStr}
						</div>
					</div>
				`;

				list.appendChild(matchCard);
			});

			content.appendChild(list);
		});
	}

	/**
	 * Show UI
	 */
	show(): void {
		this.arenaManager.fetchStats();
		this.render();
	}

	/**
	 * Hide UI
	 */
	hide(): void {
		this.stopQueueTimer();
		this.container.innerHTML = '';
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.stopQueueTimer();
		this.container.innerHTML = '';
	}
}
