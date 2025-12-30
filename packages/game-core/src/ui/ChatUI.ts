/**
 * ChatUI
 * Chat interface component
 */

import type { ChatManager, ChatMessage } from '@rpg/networking';

export interface ChatUIConfig {
	container: HTMLElement;
	maxMessages?: number;
	width?: string;
	height?: string;
}

export class ChatUI {
	private chatManager: ChatManager;
	private config: ChatUIConfig;
	private container: HTMLElement;
	private messagesContainer: HTMLDivElement;
	private inputContainer: HTMLDivElement;
	private input: HTMLInputElement;
	private sendButton: HTMLButtonElement;
	private isVisible: boolean = true;

	constructor(chatManager: ChatManager, config: ChatUIConfig) {
		this.chatManager = chatManager;
		this.config = {
			maxMessages: 50,
			width: '400px',
			height: '300px',
			...config,
		};
		this.container = config.container;

		this.messagesContainer = document.createElement('div');
		this.inputContainer = document.createElement('div');
		this.input = document.createElement('input');
		this.sendButton = document.createElement('button');

		this.init();
		this.setupEventListeners();
	}

	/**
	 * Initialize UI
	 */
	private init(): void {
		// Create chat container
		const chatBox = document.createElement('div');
		chatBox.id = 'chat-box';
		chatBox.style.cssText = `
			position: fixed;
			bottom: 20px;
			left: 20px;
			width: ${this.config.width};
			height: ${this.config.height};
			background: rgba(0, 0, 0, 0.8);
			border: 2px solid #333;
			border-radius: 8px;
			display: flex;
			flex-direction: column;
			font-family: monospace;
			z-index: 1000;
		`;

		// Messages container
		this.messagesContainer.id = 'chat-messages';
		this.messagesContainer.style.cssText = `
			flex: 1;
			overflow-y: auto;
			padding: 10px;
			color: #fff;
			font-size: 14px;
			line-height: 1.5;
		`;

		// Input container
		this.inputContainer.id = 'chat-input-container';
		this.inputContainer.style.cssText = `
			display: flex;
			padding: 10px;
			border-top: 1px solid #333;
			gap: 8px;
		`;

		// Input field
		this.input.id = 'chat-input';
		this.input.type = 'text';
		this.input.placeholder = 'Type a message...';
		this.input.maxLength = 500;
		this.input.style.cssText = `
			flex: 1;
			padding: 8px;
			background: rgba(255, 255, 255, 0.1);
			border: 1px solid #555;
			border-radius: 4px;
			color: #fff;
			font-family: monospace;
			font-size: 14px;
			outline: none;
		`;

		this.input.addEventListener('focus', () => {
			this.input.style.background = 'rgba(255, 255, 255, 0.15)';
			this.input.style.borderColor = '#777';
		});

		this.input.addEventListener('blur', () => {
			this.input.style.background = 'rgba(255, 255, 255, 0.1)';
			this.input.style.borderColor = '#555';
		});

		// Send button
		this.sendButton.id = 'chat-send';
		this.sendButton.textContent = 'Send';
		this.sendButton.style.cssText = `
			padding: 8px 16px;
			background: #4CAF50;
			border: none;
			border-radius: 4px;
			color: #fff;
			font-family: monospace;
			font-size: 14px;
			cursor: pointer;
			transition: background 0.2s;
		`;

		this.sendButton.addEventListener('mouseenter', () => {
			this.sendButton.style.background = '#45a049';
		});

		this.sendButton.addEventListener('mouseleave', () => {
			this.sendButton.style.background = '#4CAF50';
		});

		// Assemble UI
		this.inputContainer.appendChild(this.input);
		this.inputContainer.appendChild(this.sendButton);
		chatBox.appendChild(this.messagesContainer);
		chatBox.appendChild(this.inputContainer);
		this.container.appendChild(chatBox);

		// Load existing messages
		this.loadHistory();
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		// Send message on button click
		this.sendButton.addEventListener('click', () => {
			this.sendMessage();
		});

		// Send message on Enter key
		this.input.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				this.sendMessage();
			}
		});

		// Listen for new messages
		this.chatManager.on('message-received', (message) => {
			this.addMessage(message);
		});

		this.chatManager.on('message-sent', (message) => {
			this.addMessage(message, true);
		});
	}

	/**
	 * Send message
	 */
	private sendMessage(): void {
		const message = this.input.value.trim();
		if (!message) return;

		this.chatManager.sendMessage(message);
		this.input.value = '';
		this.input.focus();
	}

	/**
	 * Add message to UI
	 */
	private addMessage(message: ChatMessage, isSelf: boolean = false): void {
		const messageEl = document.createElement('div');
		messageEl.style.cssText = `
			margin-bottom: 8px;
			padding: 6px 8px;
			background: ${isSelf ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
			border-radius: 4px;
			word-wrap: break-word;
		`;

		// Timestamp
		const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
		});

		// Sender name
		const senderColor = isSelf ? '#4CAF50' : '#2196F3';

		messageEl.innerHTML = `
			<span style="color: #888; font-size: 12px;">[${time}]</span>
			<span style="color: ${senderColor}; font-weight: bold;"> ${message.senderName}:</span>
			<span style="color: #fff;"> ${this.escapeHtml(message.message)}</span>
		`;

		this.messagesContainer.appendChild(messageEl);

		// Auto-scroll to bottom
		this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

		// Limit messages
		const messages = this.messagesContainer.children;
		if (messages.length > this.config.maxMessages!) {
			this.messagesContainer.removeChild(messages[0]);
		}
	}

	/**
	 * Load chat history
	 */
	private loadHistory(): void {
		const history = this.chatManager.getRecentMessages(20);
		history.forEach((message) => {
			const isSelf = message.senderId === this.chatManager['localPlayerId'];
			this.addMessage(message, isSelf);
		});
	}

	/**
	 * Clear messages
	 */
	clear(): void {
		this.messagesContainer.innerHTML = '';
		this.chatManager.clearHistory();
	}

	/**
	 * Toggle visibility
	 */
	toggle(): void {
		this.isVisible = !this.isVisible;
		const chatBox = this.container.querySelector('#chat-box') as HTMLElement;
		if (chatBox) {
			chatBox.style.display = this.isVisible ? 'flex' : 'none';
		}
	}

	/**
	 * Show chat
	 */
	show(): void {
		this.isVisible = true;
		const chatBox = this.container.querySelector('#chat-box') as HTMLElement;
		if (chatBox) {
			chatBox.style.display = 'flex';
		}
	}

	/**
	 * Hide chat
	 */
	hide(): void {
		this.isVisible = false;
		const chatBox = this.container.querySelector('#chat-box') as HTMLElement;
		if (chatBox) {
			chatBox.style.display = 'none';
		}
	}

	/**
	 * Focus input
	 */
	focus(): void {
		this.input.focus();
	}

	/**
	 * Escape HTML to prevent XSS
	 */
	private escapeHtml(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * Destroy UI
	 */
	destroy(): void {
		const chatBox = this.container.querySelector('#chat-box');
		if (chatBox) {
			this.container.removeChild(chatBox);
		}
	}
}
