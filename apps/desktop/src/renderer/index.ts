/**
 * Desktop Renderer Entry Point
 * Integrates Electron features with the web app
 */

/**
 * Desktop Platform Adapter
 * Provides desktop-specific features to the game
 */
export class DesktopPlatformAdapter {
	private isElectron: boolean;

	constructor() {
		this.isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
		this.initialize();
	}

	/**
	 * Initialize desktop features
	 */
	private async initialize(): Promise<void> {
		if (!this.isElectron) {
			console.log('[Desktop] Running in web mode');
			return;
		}

		console.log('[Desktop] Running in Electron');
		console.log('[Desktop] Platform:', window.electronAPI.platform);

		// Get app version
		const version = await this.getAppVersion();
		console.log('[Desktop] Version:', version);

		// Setup keyboard shortcuts
		this.setupKeyboardShortcuts();
	}

	/**
	 * Setup keyboard shortcuts
	 */
	private setupKeyboardShortcuts(): void {
		document.addEventListener('keydown', (e) => {
			// F11 - Toggle fullscreen
			if (e.key === 'F11') {
				e.preventDefault();
				this.toggleFullscreen();
			}
		});
	}

	/**
	 * Check if running in Electron
	 */
	isDesktop(): boolean {
		return this.isElectron;
	}

	/**
	 * Show desktop notification
	 */
	async showNotification(title: string, body: string): Promise<void> {
		if (!this.isElectron) {
			// Fallback to web notifications
			if ('Notification' in window && Notification.permission === 'granted') {
				new Notification(title, { body });
			}
			return;
		}

		try {
			await window.electronAPI.showNotification(title, body);
		} catch (error) {
			console.error('[Desktop] Failed to show notification:', error);
		}
	}

	/**
	 * Toggle fullscreen
	 */
	async toggleFullscreen(): Promise<boolean> {
		if (!this.isElectron) {
			// Fallback to web fullscreen API
			if (!document.fullscreenElement) {
				await document.documentElement.requestFullscreen();
				return true;
			} else {
				await document.exitFullscreen();
				return false;
			}
		}

		try {
			const result = await window.electronAPI.toggleFullscreen();
			return result.fullscreen;
		} catch (error) {
			console.error('[Desktop] Failed to toggle fullscreen:', error);
			return false;
		}
	}

	/**
	 * Open external link
	 */
	async openExternal(url: string): Promise<void> {
		if (!this.isElectron) {
			window.open(url, '_blank');
			return;
		}

		try {
			await window.electronAPI.openExternal(url);
		} catch (error) {
			console.error('[Desktop] Failed to open external link:', error);
		}
	}

	/**
	 * Get app version
	 */
	async getAppVersion(): Promise<string> {
		if (!this.isElectron) {
			return '1.0.0 (Web)';
		}

		try {
			return await window.electronAPI.getAppVersion();
		} catch (error) {
			console.error('[Desktop] Failed to get version:', error);
			return 'Unknown';
		}
	}

	/**
	 * Get settings
	 */
	async getSettings(): Promise<any> {
		if (!this.isElectron) {
			// Load from localStorage for web
			const stored = localStorage.getItem('appSettings');
			return stored ? JSON.parse(stored) : {};
		}

		try {
			return await window.electronAPI.getSettings();
		} catch (error) {
			console.error('[Desktop] Failed to get settings:', error);
			return {};
		}
	}

	/**
	 * Save settings
	 */
	async saveSettings(settings: any): Promise<void> {
		if (!this.isElectron) {
			// Save to localStorage for web
			localStorage.setItem('appSettings', JSON.stringify(settings));
			return;
		}

		try {
			await window.electronAPI.saveSettings(settings);
		} catch (error) {
			console.error('[Desktop] Failed to save settings:', error);
		}
	}
}

// Create global instance
const desktopAdapter = new DesktopPlatformAdapter();

// Export for use in game code
export default desktopAdapter;

// Attach to window for easy access
if (typeof window !== 'undefined') {
	(window as any).desktopAdapter = desktopAdapter;
}
