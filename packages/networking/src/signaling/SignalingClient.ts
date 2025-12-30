/**
 * SignalingClient
 * Client-side WebSocket connection to signaling server
 */

export interface SignalingMessage {
	type:
		| 'join-zone'
		| 'leave-zone'
		| 'peer-list'
		| 'webrtc-offer'
		| 'webrtc-answer'
		| 'ice-candidate'
		| 'position-update'
		| 'disconnect';
	from?: string;
	to?: string;
	zoneId?: string;
	data?: any;
}

export type SignalingClientEvents = {
	connected: () => void;
	disconnected: () => void;
	error: (error: Event) => void;
	'peer-list': (data: any) => void;
	'webrtc-offer': (from: string, offer: RTCSessionDescriptionInit) => void;
	'webrtc-answer': (from: string, answer: RTCSessionDescriptionInit) => void;
	'ice-candidate': (from: string, candidate: RTCIceCandidateInit) => void;
};

export class SignalingClient {
	private ws: WebSocket | null = null;
	private serverUrl: string;
	private token: string;
	private eventListeners: Map<keyof SignalingClientEvents, Set<Function>> = new Map();
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000; // Start with 1 second

	constructor(serverUrl: string, token: string) {
		this.serverUrl = serverUrl;
		this.token = token;
	}

	/**
	 * Connect to signaling server
	 */
	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				// Add token to URL query string
				const url = `${this.serverUrl}?token=${encodeURIComponent(this.token)}`;
				this.ws = new WebSocket(url);

				this.ws.onopen = () => {
					console.log('[SignalingClient] Connected to signaling server');
					this.reconnectAttempts = 0;
					this.emit('connected');
					resolve();
				};

				this.ws.onclose = (event) => {
					console.log('[SignalingClient] Disconnected from signaling server');
					this.emit('disconnected');
					this.attemptReconnect();
				};

				this.ws.onerror = (error) => {
					console.error('[SignalingClient] WebSocket error:', error);
					this.emit('error', error);
					reject(error);
				};

				this.ws.onmessage = (event) => {
					try {
						const message: SignalingMessage = JSON.parse(event.data);
						this.handleMessage(message);
					} catch (error) {
						console.error('[SignalingClient] Failed to parse message:', error);
					}
				};
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Handle incoming messages
	 */
	private handleMessage(message: SignalingMessage): void {
		switch (message.type) {
			case 'peer-list':
				this.emit('peer-list', message.data);
				break;

			case 'webrtc-offer':
				if (message.from && message.data) {
					this.emit('webrtc-offer', message.from, message.data);
				}
				break;

			case 'webrtc-answer':
				if (message.from && message.data) {
					this.emit('webrtc-answer', message.from, message.data);
				}
				break;

			case 'ice-candidate':
				if (message.from && message.data) {
					this.emit('ice-candidate', message.from, message.data);
				}
				break;

			default:
				console.warn(`[SignalingClient] Unknown message type: ${message.type}`);
		}
	}

	/**
	 * Attempt to reconnect
	 */
	private attemptReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error('[SignalingClient] Max reconnect attempts reached');
			return;
		}

		this.reconnectAttempts++;
		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

		console.log(
			`[SignalingClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
		);

		setTimeout(() => {
			this.connect().catch((error) => {
				console.error('[SignalingClient] Reconnect failed:', error);
			});
		}, delay);
	}

	/**
	 * Join a zone
	 */
	joinZone(zoneId: string): void {
		this.send({
			type: 'join-zone',
			zoneId,
		});
	}

	/**
	 * Leave current zone
	 */
	leaveZone(): void {
		this.send({
			type: 'leave-zone',
		});
	}

	/**
	 * Send WebRTC offer to peer
	 */
	sendOffer(to: string, offer: RTCSessionDescriptionInit): void {
		this.send({
			type: 'webrtc-offer',
			to,
			data: offer,
		});
	}

	/**
	 * Send WebRTC answer to peer
	 */
	sendAnswer(to: string, answer: RTCSessionDescriptionInit): void {
		this.send({
			type: 'webrtc-answer',
			to,
			data: answer,
		});
	}

	/**
	 * Send ICE candidate to peer
	 */
	sendIceCandidate(to: string, candidate: RTCIceCandidateInit): void {
		this.send({
			type: 'ice-candidate',
			to,
			data: candidate,
		});
	}

	/**
	 * Update position (for server tracking)
	 */
	updatePosition(x: number, y: number): void {
		this.send({
			type: 'position-update',
			data: { x, y },
		});
	}

	/**
	 * Send message to server
	 */
	private send(message: SignalingMessage): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.warn('[SignalingClient] WebSocket not open, cannot send message');
			return;
		}

		try {
			this.ws.send(JSON.stringify(message));
		} catch (error) {
			console.error('[SignalingClient] Failed to send message:', error);
		}
	}

	/**
	 * Disconnect from server
	 */
	disconnect(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	/**
	 * Check if connected
	 */
	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	/**
	 * Event emitter
	 */
	on<K extends keyof SignalingClientEvents>(
		event: K,
		callback: SignalingClientEvents[K],
	): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event)!.add(callback);
	}

	/**
	 * Remove event listener
	 */
	off<K extends keyof SignalingClientEvents>(
		event: K,
		callback: SignalingClientEvents[K],
	): void {
		this.eventListeners.get(event)?.delete(callback);
	}

	/**
	 * Emit event
	 */
	private emit(event: string, ...args: any[]): void {
		const listeners = this.eventListeners.get(event as keyof SignalingClientEvents);
		if (listeners) {
			listeners.forEach((callback) => callback(...args));
		}
	}
}
