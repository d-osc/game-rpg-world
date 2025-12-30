/**
 * NetworkingExample
 * Example of how to integrate Chat and RemotePlayerRenderer with the game
 */

import { NetworkManager } from '@rpg/networking';
import { RemotePlayerRenderer } from '@rpg/game-engine';
import { ChatUI } from '../ui/ChatUI.ts';
import type { Canvas2DRenderer, Camera } from '@rpg/game-engine';

export class NetworkingExample {
	private networkManager: NetworkManager;
	private remotePlayerRenderer: RemotePlayerRenderer;
	private chatUI: ChatUI;

	constructor(
		renderer: Canvas2DRenderer,
		camera: Camera,
		config: {
			signalingUrl: string;
			token: string;
			playerId: string;
			playerName: string;
		},
	) {
		// Initialize network manager
		this.networkManager = new NetworkManager({
			signalingUrl: config.signalingUrl,
			token: config.token,
			playerId: config.playerId,
			playerName: config.playerName,
		});

		// Initialize remote player renderer
		this.remotePlayerRenderer = new RemotePlayerRenderer({
			renderer,
			camera,
			interpolation: true,
			nameTagOffset: 40,
		});

		// Initialize chat UI
		const chatContainer = document.body;
		const chatManager = this.networkManager.getChatManager();
		this.chatUI = new ChatUI(chatManager, {
			container: chatContainer,
			width: '400px',
			height: '300px',
		});

		this.setupNetworkEvents();
	}

	/**
	 * Setup network event handlers
	 */
	private setupNetworkEvents(): void {
		// Handle peer joined
		this.networkManager.on('peer-joined', (playerId, username) => {
			console.log(`Player joined: ${username} (${playerId})`);

			// Add remote player to renderer
			this.remotePlayerRenderer.updatePlayer({
				playerId,
				username,
				position: { x: 0, y: 0 },
				lastUpdateTime: Date.now(),
			});
		});

		// Handle peer left
		this.networkManager.on('peer-left', (playerId) => {
			console.log(`Player left: ${playerId}`);

			// Remove remote player from renderer
			this.remotePlayerRenderer.removePlayer(playerId);
		});

		// Handle peer data (non-chat messages)
		this.networkManager.on('peer-data', (playerId, data) => {
			// Handle different message types
			switch (data.type) {
				case 'player-state':
					this.handlePlayerStateUpdate(playerId, data.data);
					break;
				case 'player-animation':
					this.handlePlayerAnimation(playerId, data.data);
					break;
				default:
					console.log(`Unknown message type: ${data.type}`);
			}
		});
	}

	/**
	 * Handle player state update
	 */
	private handlePlayerStateUpdate(playerId: string, state: any): void {
		const player = this.remotePlayerRenderer.getPlayer(playerId);
		if (player) {
			// Update player position
			this.remotePlayerRenderer.updatePlayer({
				...player,
				position: state.position,
				velocity: state.velocity,
				lastUpdateTime: Date.now(),
			});
		}
	}

	/**
	 * Handle player animation update
	 */
	private handlePlayerAnimation(playerId: string, data: any): void {
		const player = this.remotePlayerRenderer.getPlayer(playerId);
		if (player) {
			this.remotePlayerRenderer.updatePlayer({
				...player,
				animation: data.animation,
				lastUpdateTime: Date.now(),
			});
		}
	}

	/**
	 * Connect to network
	 */
	async connect(): Promise<void> {
		await this.networkManager.connect();
	}

	/**
	 * Join a zone
	 */
	joinZone(zoneId: string): void {
		this.networkManager.joinZone(zoneId);
	}

	/**
	 * Update (called every frame)
	 */
	update(deltaTime: number): void {
		// Render remote players
		this.remotePlayerRenderer.render(deltaTime);
	}

	/**
	 * Send player state to peers
	 */
	sendPlayerState(position: { x: number; y: number }, velocity: { x: number; y: number }): void {
		this.networkManager.broadcast({
			type: 'player-state',
			data: {
				position,
				velocity,
			},
		});
	}

	/**
	 * Send player animation to peers
	 */
	sendPlayerAnimation(animation: string): void {
		this.networkManager.broadcast({
			type: 'player-animation',
			data: {
				animation,
			},
		});
	}

	/**
	 * Toggle chat visibility
	 */
	toggleChat(): void {
		this.chatUI.toggle();
	}

	/**
	 * Disconnect from network
	 */
	disconnect(): void {
		this.networkManager.disconnect();
		this.remotePlayerRenderer.clearAll();
	}
}

/**
 * Usage Example:
 *
 * ```typescript
 * import { NetworkingExample } from '@rpg/game-core';
 *
 * // In your game scene
 * const networking = new NetworkingExample(renderer, camera, {
 *   signalingUrl: 'ws://localhost:3001',
 *   token: 'your-jwt-token',
 *   playerId: 'player-123',
 *   playerName: 'Player Name',
 * });
 *
 * // Connect to network
 * await networking.connect();
 *
 * // Join a zone
 * networking.joinZone('zone-1');
 *
 * // In your game loop
 * networking.update(deltaTime);
 *
 * // Send player state (every 100ms or on change)
 * networking.sendPlayerState(
 *   { x: player.x, y: player.y },
 *   { x: player.velocityX, y: player.velocityY }
 * );
 *
 * // Toggle chat (e.g., on Enter key)
 * if (keyboard.isKeyJustPressed('Enter')) {
 *   networking.toggleChat();
 * }
 *
 * // Cleanup
 * networking.disconnect();
 * ```
 */
