/**
 * Mobile Platform Adapter
 * Provides mobile-specific features using web APIs
 * Elit handles the native wrapper via its mobile CLI
 */

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

	private detectMobile(): boolean {
		return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
	}

	private async initialize(): Promise<void> {
		if (!this.isMobile) {
			console.log('[Mobile] Running in desktop mode');
			return;
		}

		console.log('[Mobile] Platform:', this.isIOS ? 'iOS' : this.isAndroid ? 'Android' : 'Unknown');
		this.setupVisibilityListeners();
	}

	private setupVisibilityListeners(): void {
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				this.onAppPause();
			} else {
				this.onAppResume();
			}
		});
	}

	private onAppResume(): void {
		document.dispatchEvent(new Event('app-resume'));
	}

	private onAppPause(): void {
		document.dispatchEvent(new Event('app-pause'));
	}

	isMobilePlatform(): boolean {
		return this.isMobile;
	}

	getPlatform(): 'ios' | 'android' | 'web' {
		if (this.isIOS) return 'ios';
		if (this.isAndroid) return 'android';
		return 'web';
	}

	async haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'): Promise<void> {
		if (!this.isMobile) return;
		if (!navigator.vibrate) return;

		try {
			switch (type) {
				case 'light': navigator.vibrate(10); break;
				case 'medium': navigator.vibrate(25); break;
				case 'heavy': navigator.vibrate(50); break;
				case 'success': navigator.vibrate([10, 50, 10]); break;
				case 'warning': navigator.vibrate([25, 50, 25]); break;
				case 'error': navigator.vibrate([50, 50, 50, 50, 50]); break;
			}
		} catch {
			// Vibration API not supported
		}
	}

	async hideKeyboard(): Promise<void> {
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	}

	async showKeyboard(): Promise<void> {
		// Web API doesn't support showing keyboard programmatically
	}

	destroy(): void {
		// No native listeners to clean up
	}
}

const mobileAdapter = new MobilePlatformAdapter();

export default mobileAdapter;

if (typeof window !== 'undefined') {
	(window as any).mobileAdapter = mobileAdapter;
}
