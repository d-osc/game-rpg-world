/**
 * Mobile App Entry Point
 * Initializes mobile-specific features and starts the game
 */

import mobileAdapter from './platform/MobilePlatformAdapter';
import { VirtualJoystick } from './ui/VirtualJoystick';
import { TouchControls } from './ui/TouchControls';

/**
 * Mobile Game Integration
 */
export class MobileGame {
	private joystick?: VirtualJoystick;
	private touchControls?: TouchControls;
	private container: HTMLElement;

	constructor(container: HTMLElement) {
		this.container = container;
		this.initialize();
	}

	/**
	 * Initialize mobile features
	 */
	private async initialize(): Promise<void> {
		console.log('[Mobile] Initializing mobile game');

		// Only setup mobile controls on mobile platforms
		if (mobileAdapter.isMobilePlatform()) {
			this.setupMobileControls();
			this.setupMobileEvents();
		}

		// Listen for app lifecycle events
		this.setupLifecycleListeners();
	}

	/**
	 * Setup mobile controls
	 */
	private setupMobileControls(): void {
		console.log('[Mobile] Setting up mobile controls');

		// Create virtual joystick
		this.joystick = new VirtualJoystick(this.container, {
			onUpdate: (data) => {
				// Dispatch joystick input to game
				document.dispatchEvent(
					new CustomEvent('joystick-update', {
						detail: data,
					})
				);
			},
		});

		// Create touch controls
		this.touchControls = new TouchControls(this.container);

		// Add action buttons
		this.touchControls.addButton({
			id: 'attack',
			label: 'A',
			position: { bottom: 120, right: 80 },
			size: 70,
			onPress: () => {
				mobileAdapter.haptic('light');
				document.dispatchEvent(new CustomEvent('action-attack'));
			},
		});

		this.touchControls.addButton({
			id: 'skill',
			label: 'S',
			position: { bottom: 120, right: 180 },
			size: 70,
			onPress: () => {
				mobileAdapter.haptic('light');
				document.dispatchEvent(new CustomEvent('action-skill'));
			},
		});

		this.touchControls.addButton({
			id: 'item',
			label: 'I',
			position: { bottom: 220, right: 80 },
			size: 60,
			onPress: () => {
				mobileAdapter.haptic('light');
				document.dispatchEvent(new CustomEvent('action-item'));
			},
		});

		this.touchControls.addButton({
			id: 'menu',
			label: 'M',
			position: { top: 20, right: 20 },
			size: 50,
			onPress: () => {
				mobileAdapter.haptic('light');
				document.dispatchEvent(new CustomEvent('action-menu'));
			},
		});
	}

	/**
	 * Setup mobile-specific events
	 */
	private setupMobileEvents(): void {
		// Handle orientation changes
		window.addEventListener('orientationchange', () => {
			console.log('[Mobile] Orientation changed');
			this.handleOrientationChange();
		});

		// Handle visibility changes
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				console.log('[Mobile] App hidden');
				this.onAppPause();
			} else {
				console.log('[Mobile] App visible');
				this.onAppResume();
			}
		});
	}

	/**
	 * Setup lifecycle listeners
	 */
	private setupLifecycleListeners(): void {
		// App resume
		document.addEventListener('app-resume', () => {
			console.log('[Mobile] App resumed');
			this.onAppResume();
		});

		// App pause
		document.addEventListener('app-pause', () => {
			console.log('[Mobile] App paused');
			this.onAppPause();
		});

		// Back button
		document.addEventListener('back-button', () => {
			console.log('[Mobile] Back button pressed');
			this.onBackButton();
		});
	}

	/**
	 * Handle orientation change
	 */
	private handleOrientationChange(): void {
		// Notify game to adjust layout
		document.dispatchEvent(new Event('orientation-change'));

		// Give haptic feedback
		mobileAdapter.haptic('light');
	}

	/**
	 * App resume handler
	 */
	private onAppResume(): void {
		// Resume game loop
		document.dispatchEvent(new Event('game-resume'));

		// Show controls
		if (this.joystick) this.joystick.show();
		if (this.touchControls) this.touchControls.show();
	}

	/**
	 * App pause handler
	 */
	private onAppPause(): void {
		// Pause game loop
		document.dispatchEvent(new Event('game-pause'));

		// Hide controls
		if (this.joystick) this.joystick.hide();
		if (this.touchControls) this.touchControls.hide();
	}

	/**
	 * Back button handler
	 */
	private onBackButton(): void {
		// Let game handle back button
		document.dispatchEvent(new Event('back-button'));
	}

	/**
	 * Show mobile controls
	 */
	showControls(): void {
		if (this.joystick) this.joystick.show();
		if (this.touchControls) this.touchControls.show();
	}

	/**
	 * Hide mobile controls
	 */
	hideControls(): void {
		if (this.joystick) this.joystick.hide();
		if (this.touchControls) this.touchControls.hide();
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		if (this.joystick) this.joystick.destroy();
		if (this.touchControls) this.touchControls.destroy();
		mobileAdapter.destroy();
	}
}

// Export mobile adapter for direct access
export { mobileAdapter };

// Export UI components
export { VirtualJoystick } from './ui/VirtualJoystick';
export { TouchControls } from './ui/TouchControls';

// Attach to window for easy access
if (typeof window !== 'undefined') {
	(window as any).mobileAdapter = mobileAdapter;
}
