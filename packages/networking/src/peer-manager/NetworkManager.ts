/**
 * NetworkManager
 * Coordinates signaling and WebRTC peer connections
 */

import { SignalingClient } from '../signaling/SignalingClient.ts';
import { PeerManager } from '../webrtc/PeerManager.ts';
import { ChatManager } from '../chat/ChatManager.ts';

export interface NetworkManagerConfig {
	signalingUrl: string;
	token: string;
	playerId: string;
	playerName: string;
}

export type NetworkManagerEvents = {
	connected: () => void;
	disconnected: () => void;
	'peer-joined': (playerId: string, username: string) => void;
	'peer-left': (playerId: string) => void;
	'peer-data': (playerId: string, data: any) => void;
};

export class NetworkManager {
	private signalingClient: SignalingClient;
	private peerManager: PeerManager;
	private chatManager: ChatManager;
	private config: NetworkManagerConfig;
	private eventListeners: Map<keyof NetworkManagerEvents, Set<Function>> = new Map();
	private currentZone: string | null = null;

	constructor(config: NetworkManagerConfig) {
		this.config = config;
		this.signalingClient = new SignalingClient(config.signalingUrl, config.token);
		this.peerManager = new PeerManager(config.playerId);
		this.chatManager = new ChatManager(config.playerId, config.playerName);

		this.setupEventHandlers();
		this.setupChatManager();
	}

	/**
	 * Setup event handlers
	 */
	private setupEventHandlers(): void {
		// Signaling events
		this.signalingClient.on('connected', () => {
			console.log('[NetworkManager] Connected to signaling server');
			this.emit('connected');
		});

		this.signalingClient.on('disconnected', () => {
			console.log('[NetworkManager] Disconnected from signaling server');
			this.emit('disconnected');
		});

		// Handle peer list (zone join response)
		this.signalingClient.on('peer-list', async (data) => {
			if (data.peers) {
				// New zone joined - connect to all peers
				for (const peer of data.peers) {
					await this.connectToPeer(peer.playerId, peer.username, true);
				}
			} else if (data.action === 'player-joined') {
				// New player joined zone - they will initiate connection
				console.log(`[NetworkManager] Player ${data.player.username} joined zone`);
			} else if (data.action === 'player-left') {
				// Player left zone
				console.log(`[NetworkManager] Player left zone: ${data.playerId}`);
				this.peerManager.removePeer(data.playerId);
			}
		});

		// Handle WebRTC signaling
		this.signalingClient.on('webrtc-offer', async (from, offer) => {
			console.log(`[NetworkManager] Received offer from ${from}`);

			// Create peer connection if it doesn't exist
			if (!this.peerManager.isPeerConnected(from)) {
				await this.peerManager.createPeerConnection(from, 'Unknown', false);
			}

			// Handle offer and send answer
			const answer = await this.peerManager.handleOffer(from, offer);
			this.signalingClient.sendAnswer(from, answer);

			// Setup ICE candidate forwarding for this peer
			this.peerManager.on('ice-candidate', ({ peerId, candidate }) => {
				if (peerId === from) {
					this.signalingClient.sendIceCandidate(peerId, candidate);
				}
			});
		});

		this.signalingClient.on('webrtc-answer', async (from, answer) => {
			console.log(`[NetworkManager] Received answer from ${from}`);
			await this.peerManager.handleAnswer(from, answer);
		});

		this.signalingClient.on('ice-candidate', async (from, candidate) => {
			await this.peerManager.handleIceCandidate(from, candidate);
		});

		// Peer events
		this.peerManager.on('peer-connected', (peer) => {
			console.log(`[NetworkManager] Peer connected: ${peer.username}`);
			this.emit('peer-joined', peer.playerId, peer.username);
		});

		this.peerManager.on('peer-disconnected', (playerId) => {
			console.log(`[NetworkManager] Peer disconnected: ${playerId}`);
			this.emit('peer-left', playerId);
		});

		this.peerManager.on('peer-data', (playerId, data) => {
			// Handle chat messages
			if (data.type === 'chat-message') {
				this.chatManager.handleReceivedMessage(data.data);
			} else {
				this.emit('peer-data', playerId, data);
			}
		});
	}

	/**
	 * Setup chat manager
	 */
	private setupChatManager(): void {
		// Set callbacks for sending messages
		this.chatManager.setSendCallbacks(
			(peerId, data) => this.sendToPeer(peerId, data),
			(data) => this.broadcast(data),
		);
	}

	/**
	 * Connect to signaling server
	 */
	async connect(): Promise<void> {
		await this.signalingClient.connect();
	}

	/**
	 * Join a game zone
	 */
	joinZone(zoneId: string): void {
		if (this.currentZone) {
			this.leaveZone();
		}

		this.currentZone = zoneId;
		this.signalingClient.joinZone(zoneId);
	}

	/**
	 * Leave current zone
	 */
	leaveZone(): void {
		if (!this.currentZone) return;

		this.signalingClient.leaveZone();
		this.peerManager.closeAll();
		this.currentZone = null;
	}

	/**
	 * Connect to a peer
	 */
	private async connectToPeer(
		peerId: string,
		username: string,
		isInitiator: boolean,
	): Promise<void> {
		console.log(
			`[NetworkManager] Connecting to peer ${username} (${peerId}) as ${isInitiator ? 'initiator' : 'receiver'}`,
		);

		// Create peer connection
		await this.peerManager.createPeerConnection(peerId, username, isInitiator);

		if (isInitiator) {
			// Create and send offer
			const offer = await this.peerManager.createOffer(peerId);
			this.signalingClient.sendOffer(peerId, offer);

			// Setup ICE candidate forwarding
			this.peerManager.on('ice-candidate', ({ peerId: candidatePeerId, candidate }) => {
				if (candidatePeerId === peerId) {
					this.signalingClient.sendIceCandidate(peerId, candidate);
				}
			});
		}
	}

	/**
	 * Send data to specific peer
	 */
	sendToPeer(peerId: string, data: any): boolean {
		return this.peerManager.sendToPeer(peerId, data);
	}

	/**
	 * Broadcast data to all peers
	 */
	broadcast(data: any): void {
		this.peerManager.broadcast(data);
	}

	/**
	 * Get connected peers
	 */
	getConnectedPeers() {
		return this.peerManager.getConnectedPeers();
	}

	/**
	 * Update position on signaling server
	 */
	updatePosition(x: number, y: number): void {
		this.signalingClient.updatePosition(x, y);
	}

	/**
	 * Get chat manager
	 */
	getChatManager(): ChatManager {
		return this.chatManager;
	}

	/**
	 * Disconnect from everything
	 */
	disconnect(): void {
		this.leaveZone();
		this.signalingClient.disconnect();
		this.chatManager.destroy();
	}

	/**
	 * Event emitter
	 */
	on<K extends keyof NetworkManagerEvents>(
		event: K,
		callback: NetworkManagerEvents[K],
	): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event)!.add(callback);
	}

	/**
	 * Remove event listener
	 */
	off<K extends keyof NetworkManagerEvents>(
		event: K,
		callback: NetworkManagerEvents[K],
	): void {
		this.eventListeners.get(event)?.delete(callback);
	}

	/**
	 * Emit event
	 */
	private emit(event: string, ...args: any[]): void {
		const listeners = this.eventListeners.get(event as keyof NetworkManagerEvents);
		if (listeners) {
			listeners.forEach((callback) => callback(...args));
		}
	}
}
