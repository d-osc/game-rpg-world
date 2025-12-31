/**
 * Mobile Platform Adapter
 * Provides mobile-specific features to the game
 */

import { App } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { PushNotifications } from '@capacitor/push-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export class MobilePlatformAdapter {
	private isMobile: boolean;
	private isIOS: boolean;
	private isAndroid: boolean;

	constructor() {
		this.isMobile = this.detectMobile();
		this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
		this.isAndroid = /Android/.test(navigator.userAgent);
		this.initialize();
	}

	/**
	 * Detect if running on mobile
	 */
	private detectMobile(): boolean {
		return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
	}

	/**
	 * Initialize mobile features
	 */
	private async initialize(): Promise<void> {
		if (!this.isMobile) {
			console.log('[Mobile] Running in desktop mode');
			return;
		}

		console.log('[Mobile] Initializing mobile platform');
		console.log('[Mobile] Platform:', this.isIOS ? 'iOS' : this.isAndroid ? 'Android' : 'Unknown');

		try {
			// Hide splash screen
			await SplashScreen.hide();

			// Setup status bar
			await this.setupStatusBar();

			// Setup app state listeners
			this.setupAppListeners();

			// Setup keyboard
			this.setupKeyboard();

			// Request push notification permissions
			await this.setupPushNotifications();

			console.log('[Mobile] Platform initialized');
		} catch (error) {
			console.error('[Mobile] Initialization error:', error);
		}
	}

	/**
	 * Setup status bar
	 */
	private async setupStatusBar(): Promise<void> {
		try {
			await StatusBar.setStyle({ style: Style.Dark });
			await StatusBar.setBackgroundColor({ color: '#000000' });
			console.log('[Mobile] Status bar configured');
		} catch (error) {
			console.error('[Mobile] Status bar setup failed:', error);
		}
	}

	/**
	 * Setup app state listeners
	 */
	private setupAppListeners(): void {
		App.addListener('appStateChange', ({ isActive }) => {
			console.log('[Mobile] App state changed:', isActive ? 'active' : 'background');
			if (isActive) {
				this.onAppResume();
			} else {
				this.onAppPause();
			}
		});

		App.addListener('backButton', () => {
			console.log('[Mobile] Back button pressed');
			// Handle back button - can be customized per screen
			this.onBackButton();
		});
	}

	/**
	 * Setup keyboard
	 */
	private setupKeyboard(): void {
		Keyboard.addListener('keyboardWillShow', (info) => {
			console.log('[Mobile] Keyboard will show, height:', info.keyboardHeight);
		});

		Keyboard.addListener('keyboardWillHide', () => {
			console.log('[Mobile] Keyboard will hide');
		});
	}

	/**
	 * Setup push notifications
	 */
	private async setupPushNotifications(): Promise<void> {
		try {
			const permission = await PushNotifications.requestPermissions();

			if (permission.receive === 'granted') {
				await PushNotifications.register();
				console.log('[Mobile] Push notifications enabled');

				PushNotifications.addListener('registration', (token) => {
					console.log('[Mobile] Push registration token:', token.value);
				});

				PushNotifications.addListener('pushNotificationReceived', (notification) => {
					console.log('[Mobile] Push notification received:', notification);
				});

				PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
					console.log('[Mobile] Push notification action:', notification);
				});
			}
		} catch (error) {
			console.error('[Mobile] Push notifications setup failed:', error);
		}
	}

	/**
	 * App resume handler
	 */
	private onAppResume(): void {
		// Resume game, reconnect to server, etc.
		document.dispatchEvent(new Event('app-resume'));
	}

	/**
	 * App pause handler
	 */
	private onAppPause(): void {
		// Save game state, pause audio, etc.
		document.dispatchEvent(new Event('app-pause'));
	}

	/**
	 * Back button handler
	 */
	private onBackButton(): void {
		// Emit event for game to handle
		document.dispatchEvent(new Event('back-button'));
	}

	/**
	 * Check if running on mobile
	 */
	isMobilePlatform(): boolean {
		return this.isMobile;
	}

	/**
	 * Get platform type
	 */
	getPlatform(): 'ios' | 'android' | 'web' {
		if (this.isIOS) return 'ios';
		if (this.isAndroid) return 'android';
		return 'web';
	}

	/**
	 * Trigger haptic feedback
	 */
	async haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'): Promise<void> {
		if (!this.isMobile) return;

		try {
			switch (type) {
				case 'light':
					await Haptics.impact({ style: ImpactStyle.Light });
					break;
				case 'medium':
					await Haptics.impact({ style: ImpactStyle.Medium });
					break;
				case 'heavy':
					await Haptics.impact({ style: ImpactStyle.Heavy });
					break;
				case 'success':
					await Haptics.notification({ type: NotificationType.Success });
					break;
				case 'warning':
					await Haptics.notification({ type: NotificationType.Warning });
					break;
				case 'error':
					await Haptics.notification({ type: NotificationType.Error });
					break;
			}
		} catch (error) {
			console.error('[Mobile] Haptic feedback failed:', error);
		}
	}

	/**
	 * Hide keyboard
	 */
	async hideKeyboard(): Promise<void> {
		if (!this.isMobile) return;

		try {
			await Keyboard.hide();
		} catch (error) {
			console.error('[Mobile] Hide keyboard failed:', error);
		}
	}

	/**
	 * Show keyboard
	 */
	async showKeyboard(): Promise<void> {
		if (!this.isMobile) return;

		try {
			await Keyboard.show();
		} catch (error) {
			console.error('[Mobile] Show keyboard failed:', error);
		}
	}

	/**
	 * Get app info
	 */
	async getAppInfo(): Promise<{ version: string; build: string }> {
		try {
			const info = await App.getInfo();
			return {
				version: info.version,
				build: info.build,
			};
		} catch (error) {
			console.error('[Mobile] Get app info failed:', error);
			return { version: '1.0.0', build: '1' };
		}
	}

	/**
	 * Exit app (Android only)
	 */
	async exitApp(): Promise<void> {
		if (!this.isAndroid) {
			console.warn('[Mobile] Exit app only available on Android');
			return;
		}

		try {
			await App.exitApp();
		} catch (error) {
			console.error('[Mobile] Exit app failed:', error);
		}
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		App.removeAllListeners();
		Keyboard.removeAllListeners();
		PushNotifications.removeAllListeners();
	}
}

// Create global instance
const mobileAdapter = new MobilePlatformAdapter();

// Export for use in game code
export default mobileAdapter;

// Attach to window for easy access
if (typeof window !== 'undefined') {
	(window as any).mobileAdapter = mobileAdapter;
}
