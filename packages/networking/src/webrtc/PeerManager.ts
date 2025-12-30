/**
 * PeerManager
 * Manages WebRTC peer-to-peer connections
 */

export interface PeerInfo {
	playerId: string;
	username: string;
	position: { x: number; y: number };
}

export interface PeerConnection {
	playerId: string;
	connection: RTCPeerConnection;
	dataChannel: RTCDataChannel | null;
	username: string;
}

export type PeerManagerEvents = {
	'peer-connected': (peer: PeerInfo) => void;
	'peer-disconnected': (playerId: string) => void;
	'peer-data': (playerId: string, data: any) => void;
	'connection-state-change': (playerId: string, state: RTCPeerConnectionState) => void;
};

export class PeerManager {
	private peers: Map<string, PeerConnection> = new Map();
	private localPlayerId: string;
	private eventListeners: Map<keyof PeerManagerEvents, Set<Function>> = new Map();

	// ICE server configuration (STUN/TURN)
	private iceServers: RTCIceServer[] = [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' },
	];

	constructor(localPlayerId: string) {
		this.localPlayerId = localPlayerId;
	}

	/**
	 * Create a new peer connection
	 */
	async createPeerConnection(
		peerId: string,
		username: string,
		isInitiator: boolean,
	): Promise<RTCPeerConnection> {
		if (this.peers.has(peerId)) {
			console.warn(`[PeerManager] Peer ${peerId} already exists`);
			return this.peers.get(peerId)!.connection;
		}

		// Create RTCPeerConnection
		const pc = new RTCPeerConnection({
			iceServers: this.iceServers,
		});

		const peerConnection: PeerConnection = {
			playerId: peerId,
			connection: pc,
			dataChannel: null,
			username,
		};

		this.peers.set(peerId, peerConnection);

		// Setup ICE candidate handling
		pc.onicecandidate = (event) => {
			if (event.candidate) {
				this.emit('ice-candidate', {
					peerId,
					candidate: event.candidate,
				});
			}
		};

		// Monitor connection state
		pc.onconnectionstatechange = () => {
			console.log(
				`[PeerManager] Connection with ${username} (${peerId}): ${pc.connectionState}`,
			);
			this.emit('connection-state-change', peerId, pc.connectionState);

			if (
				pc.connectionState === 'disconnected' ||
				pc.connectionState === 'failed' ||
				pc.connectionState === 'closed'
			) {
				this.removePeer(peerId);
			}
		};

		// Create data channel if initiator
		if (isInitiator) {
			const dataChannel = pc.createDataChannel('game-data', {
				ordered: false, // Unordered for lower latency (game data)
				maxRetransmits: 0, // Don't retransmit (stale data not useful)
			});
			this.setupDataChannel(peerId, dataChannel);
			peerConnection.dataChannel = dataChannel;
		} else {
			// Wait for data channel from remote peer
			pc.ondatachannel = (event) => {
				this.setupDataChannel(peerId, event.channel);
				peerConnection.dataChannel = event.channel;
			};
		}

		return pc;
	}

	/**
	 * Setup data channel event handlers
	 */
	private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
		channel.onopen = () => {
			console.log(`[PeerManager] Data channel open with ${peerId}`);
			const peer = this.peers.get(peerId);
			if (peer) {
				this.emit('peer-connected', {
					playerId: peer.playerId,
					username: peer.username,
					position: { x: 0, y: 0 }, // Will be updated via position sync
				});
			}
		};

		channel.onclose = () => {
			console.log(`[PeerManager] Data channel closed with ${peerId}`);
		};

		channel.onerror = (error) => {
			console.error(`[PeerManager] Data channel error with ${peerId}:`, error);
		};

		channel.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				this.emit('peer-data', peerId, data);
			} catch (error) {
				console.error('[PeerManager] Failed to parse message:', error);
			}
		};
	}

	/**
	 * Create and send WebRTC offer
	 */
	async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
		const peer = this.peers.get(peerId);
		if (!peer) {
			throw new Error(`Peer ${peerId} not found`);
		}

		const offer = await peer.connection.createOffer();
		await peer.connection.setLocalDescription(offer);
		return offer;
	}

	/**
	 * Handle received WebRTC offer
	 */
	async handleOffer(
		peerId: string,
		offer: RTCSessionDescriptionInit,
	): Promise<RTCSessionDescriptionInit> {
		const peer = this.peers.get(peerId);
		if (!peer) {
			throw new Error(`Peer ${peerId} not found`);
		}

		await peer.connection.setRemoteDescription(new RTCSessionDescription(offer));
		const answer = await peer.connection.createAnswer();
		await peer.connection.setLocalDescription(answer);
		return answer;
	}

	/**
	 * Handle received WebRTC answer
	 */
	async handleAnswer(
		peerId: string,
		answer: RTCSessionDescriptionInit,
	): Promise<void> {
		const peer = this.peers.get(peerId);
		if (!peer) {
			throw new Error(`Peer ${peerId} not found`);
		}

		await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
	}

	/**
	 * Handle received ICE candidate
	 */
	async handleIceCandidate(
		peerId: string,
		candidate: RTCIceCandidateInit,
	): Promise<void> {
		const peer = this.peers.get(peerId);
		if (!peer) {
			console.warn(`[PeerManager] Peer ${peerId} not found for ICE candidate`);
			return;
		}

		try {
			await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
		} catch (error) {
			console.error('[PeerManager] Error adding ICE candidate:', error);
		}
	}

	/**
	 * Send data to specific peer
	 */
	sendToPeer(peerId: string, data: any): boolean {
		const peer = this.peers.get(peerId);
		if (!peer || !peer.dataChannel || peer.dataChannel.readyState !== 'open') {
			return false;
		}

		try {
			peer.dataChannel.send(JSON.stringify(data));
			return true;
		} catch (error) {
			console.error(`[PeerManager] Failed to send to ${peerId}:`, error);
			return false;
		}
	}

	/**
	 * Broadcast data to all connected peers
	 */
	broadcast(data: any): void {
		this.peers.forEach((peer) => {
			this.sendToPeer(peer.playerId, data);
		});
	}

	/**
	 * Remove a peer connection
	 */
	removePeer(peerId: string): void {
		const peer = this.peers.get(peerId);
		if (!peer) return;

		// Close data channel
		if (peer.dataChannel) {
			peer.dataChannel.close();
		}

		// Close peer connection
		peer.connection.close();

		// Remove from map
		this.peers.delete(peerId);

		console.log(`[PeerManager] Removed peer ${peerId}`);
		this.emit('peer-disconnected', peerId);
	}

	/**
	 * Get all connected peers
	 */
	getConnectedPeers(): PeerInfo[] {
		return Array.from(this.peers.values())
			.filter((peer) => peer.dataChannel?.readyState === 'open')
			.map((peer) => ({
				playerId: peer.playerId,
				username: peer.username,
				position: { x: 0, y: 0 }, // Position updated via StateSync
			}));
	}

	/**
	 * Check if peer is connected
	 */
	isPeerConnected(peerId: string): boolean {
		const peer = this.peers.get(peerId);
		return peer?.dataChannel?.readyState === 'open' ?? false;
	}

	/**
	 * Close all peer connections
	 */
	closeAll(): void {
		this.peers.forEach((peer) => {
			this.removePeer(peer.playerId);
		});
	}

	/**
	 * Event emitter
	 */
	on<K extends keyof PeerManagerEvents>(event: K, callback: PeerManagerEvents[K]): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event)!.add(callback);
	}

	/**
	 * Remove event listener
	 */
	off<K extends keyof PeerManagerEvents>(
		event: K,
		callback: PeerManagerEvents[K],
	): void {
		this.eventListeners.get(event)?.delete(callback);
	}

	/**
	 * Emit event
	 */
	private emit(event: string, ...args: any[]): void {
		const listeners = this.eventListeners.get(event as keyof PeerManagerEvents);
		if (listeners) {
			listeners.forEach((callback) => callback(...args));
		}
	}
}
