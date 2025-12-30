/**
 * ChatManager
 * Manages P2P text chat between players
 */

import { EventEmitter } from '../utils/EventEmitter.ts';

export interface ChatMessage {
	id: string;
	senderId: string;
	senderName: string;
	message: string;
	timestamp: number;
	type: 'local' | 'global'; // local = P2P chat, global = server chat
}

export interface ChatEvents {
	'message-received': (message: ChatMessage) => void;
	'message-sent': (message: ChatMessage) => void;
	'history-updated': () => void;
}

export class ChatManager extends EventEmitter<ChatEvents> {
	private localPlayerId: string;
	private localPlayerName: string;
	private chatHistory: ChatMessage[] = [];
	private maxHistorySize: number = 100;

	// Callback to send message via P2P (will be set by NetworkManager)
	private sendMessageCallback: ((peerId: string, data: any) => boolean) | null =
		null;
	private broadcastCallback: ((data: any) => void) | null = null;

	constructor(localPlayerId: string, localPlayerName: string) {
		super();
		this.localPlayerId = localPlayerId;
		this.localPlayerName = localPlayerName;
	}

	/**
	 * Set callbacks for sending messages
	 */
	setSendCallbacks(
		sendToPeer: (peerId: string, data: any) => boolean,
		broadcast: (data: any) => void,
	): void {
		this.sendMessageCallback = sendToPeer;
		this.broadcastCallback = broadcast;
	}

	/**
	 * Send a message to all peers (P2P broadcast)
	 */
	sendMessage(message: string): void {
		if (!this.broadcastCallback) {
			console.warn('[ChatManager] Broadcast callback not set');
			return;
		}

		const chatMessage: ChatMessage = {
			id: this.generateMessageId(),
			senderId: this.localPlayerId,
			senderName: this.localPlayerName,
			message,
			timestamp: Date.now(),
			type: 'local',
		};

		// Add to history
		this.addToHistory(chatMessage);

		// Broadcast to all peers
		this.broadcastCallback({
			type: 'chat-message',
			data: chatMessage,
		});

		this.emit('message-sent', chatMessage);
	}

	/**
	 * Send a private message to a specific peer
	 */
	sendPrivateMessage(peerId: string, message: string): boolean {
		if (!this.sendMessageCallback) {
			console.warn('[ChatManager] Send callback not set');
			return false;
		}

		const chatMessage: ChatMessage = {
			id: this.generateMessageId(),
			senderId: this.localPlayerId,
			senderName: this.localPlayerName,
			message: `[Private] ${message}`,
			timestamp: Date.now(),
			type: 'local',
		};

		// Add to history
		this.addToHistory(chatMessage);

		// Send to specific peer
		const success = this.sendMessageCallback(peerId, {
			type: 'chat-message',
			data: chatMessage,
		});

		if (success) {
			this.emit('message-sent', chatMessage);
		}

		return success;
	}

	/**
	 * Handle received chat message from peer
	 */
	handleReceivedMessage(message: ChatMessage): void {
		// Validate message
		if (!this.isValidMessage(message)) {
			console.warn('[ChatManager] Invalid message received', message);
			return;
		}

		// Add to history
		this.addToHistory(message);

		// Emit event
		this.emit('message-received', message);
	}

	/**
	 * Get chat history
	 */
	getChatHistory(): ChatMessage[] {
		return [...this.chatHistory];
	}

	/**
	 * Get recent messages (last N messages)
	 */
	getRecentMessages(count: number = 20): ChatMessage[] {
		const start = Math.max(0, this.chatHistory.length - count);
		return this.chatHistory.slice(start);
	}

	/**
	 * Clear chat history
	 */
	clearHistory(): void {
		this.chatHistory = [];
		this.emit('history-updated');
	}

	/**
	 * Filter messages by type
	 */
	getMessagesByType(type: 'local' | 'global'): ChatMessage[] {
		return this.chatHistory.filter((msg) => msg.type === type);
	}

	/**
	 * Search messages
	 */
	searchMessages(query: string): ChatMessage[] {
		const lowerQuery = query.toLowerCase();
		return this.chatHistory.filter(
			(msg) =>
				msg.message.toLowerCase().includes(lowerQuery) ||
				msg.senderName.toLowerCase().includes(lowerQuery),
		);
	}

	/**
	 * Add message to history with size limit
	 */
	private addToHistory(message: ChatMessage): void {
		this.chatHistory.push(message);

		// Maintain max history size (remove oldest messages)
		if (this.chatHistory.length > this.maxHistorySize) {
			this.chatHistory = this.chatHistory.slice(-this.maxHistorySize);
		}

		this.emit('history-updated');
	}

	/**
	 * Validate received message
	 */
	private isValidMessage(message: ChatMessage): boolean {
		return !!(
			message.id &&
			message.senderId &&
			message.senderName &&
			message.message &&
			message.timestamp &&
			message.type &&
			typeof message.message === 'string' &&
			message.message.length > 0 &&
			message.message.length <= 500 // Max message length
		);
	}

	/**
	 * Generate unique message ID
	 */
	private generateMessageId(): string {
		return `${this.localPlayerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Get message count
	 */
	getMessageCount(): number {
		return this.chatHistory.length;
	}

	/**
	 * Export chat history (for saving)
	 */
	exportHistory(): ChatMessage[] {
		return this.getChatHistory();
	}

	/**
	 * Import chat history (for loading)
	 */
	importHistory(messages: ChatMessage[]): void {
		this.chatHistory = messages.filter((msg) => this.isValidMessage(msg));
		this.emit('history-updated');
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.clearHistory();
		this.sendMessageCallback = null;
		this.broadcastCallback = null;
		this.removeAllListeners();
	}
}
