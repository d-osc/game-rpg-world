/**
 * Mobile Game Integration
 * Uses elit for touch controls and mobile UI
 */

import { div } from 'elit/el';
import { createState } from 'elit/state';
import { render } from 'elit/dom';
import { CreateStyle } from 'elit/style';
import mobileAdapter from './platform/MobilePlatformAdapter';
import { VirtualJoystick } from './ui/VirtualJoystick';
import { TouchControls } from './ui/TouchControls';

// Mobile controls visibility state
const controlsVisible = createState(true);

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

	private async initialize(): Promise<void> {
		console.log('[Mobile] Initializing mobile game');

		// Inject mobile controls styles
		const css = new CreateStyle();
		css.addId('mobile-controls-layer', {
			position: 'fixed', top: '0', left: '0',
			width: '100%', height: '100%',
			pointerEvents: 'none', zIndex: '999',
		});
		css.inject();

		if (mobileAdapter.isMobilePlatform()) {
			this.setupMobileControls();
			this.setupMobileEvents();
		}

		this.setupLifecycleListeners();
	}

	private setupMobileControls(): void {
		console.log('[Mobile] Setting up mobile controls');

		this.joystick = new VirtualJoystick(this.container, {
			onUpdate: (data) => {
				document.dispatchEvent(
					new CustomEvent('joystick-update', { detail: data })
				);
			},
		});

		this.touchControls = new TouchControls(this.container);

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

	private setupMobileEvents(): void {
		window.addEventListener('orientationchange', () => {
			console.log('[Mobile] Orientation changed');
			this.handleOrientationChange();
		});

		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				this.onAppPause();
			} else {
				this.onAppResume();
			}
		});
	}

	private setupLifecycleListeners(): void {
		document.addEventListener('app-resume', () => this.onAppResume());
		document.addEventListener('app-pause', () => this.onAppPause());
		document.addEventListener('back-button', () => this.onBackButton());
	}

	private handleOrientationChange(): void {
		document.dispatchEvent(new Event('orientation-change'));
		mobileAdapter.haptic('light');
	}

	private onAppResume(): void {
		document.dispatchEvent(new Event('game-resume'));
		controlsVisible.value = true;
	}

	private onAppPause(): void {
		document.dispatchEvent(new Event('game-pause'));
		controlsVisible.value = false;
	}

	private onBackButton(): void {
		document.dispatchEvent(new Event('back-button'));
	}

	showControls(): void {
		controlsVisible.value = true;
		if (this.joystick) this.joystick.show();
		if (this.touchControls) this.touchControls.show();
	}

	hideControls(): void {
		controlsVisible.value = false;
		if (this.joystick) this.joystick.hide();
		if (this.touchControls) this.touchControls.hide();
	}

	destroy(): void {
		if (this.joystick) this.joystick.destroy();
		if (this.touchControls) this.touchControls.destroy();
		mobileAdapter.destroy();
	}
}

export { mobileAdapter };
export { VirtualJoystick } from './ui/VirtualJoystick';
export { TouchControls } from './ui/TouchControls';

if (typeof window !== 'undefined') {
	(window as any).mobileAdapter = mobileAdapter;
}
