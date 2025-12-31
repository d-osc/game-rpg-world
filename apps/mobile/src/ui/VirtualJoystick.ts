/**
 * Virtual Joystick
 * Touch-based movement control for mobile
 */

export interface JoystickData {
	x: number; // -1 to 1
	y: number; // -1 to 1
	angle: number; // radians
	distance: number; // 0 to 1
	active: boolean;
}

export class VirtualJoystick {
	private container: HTMLElement;
	private base: HTMLElement;
	private stick: HTMLElement;
	private touchId: number | null = null;
	private baseRadius: number = 60;
	private stickRadius: number = 30;
	private maxDistance: number = 50;
	private data: JoystickData = {
		x: 0,
		y: 0,
		angle: 0,
		distance: 0,
		active: false,
	};
	private onUpdate?: (data: JoystickData) => void;

	constructor(container: HTMLElement, options?: { onUpdate?: (data: JoystickData) => void }) {
		this.container = container;
		this.onUpdate = options?.onUpdate;
		this.create();
		this.setupEvents();
	}

	/**
	 * Create joystick elements
	 */
	private create(): void {
		// Joystick wrapper
		const wrapper = document.createElement('div');
		wrapper.className = 'virtual-joystick';
		wrapper.style.cssText = `
			position: fixed;
			bottom: 80px;
			left: 80px;
			width: ${this.baseRadius * 2}px;
			height: ${this.baseRadius * 2}px;
			pointer-events: auto;
			touch-action: none;
			user-select: none;
			z-index: 1000;
		`;

		// Base circle
		this.base = document.createElement('div');
		this.base.className = 'joystick-base';
		this.base.style.cssText = `
			position: absolute;
			width: 100%;
			height: 100%;
			border-radius: 50%;
			background: rgba(255, 255, 255, 0.2);
			border: 2px solid rgba(255, 255, 255, 0.4);
		`;

		// Stick circle
		this.stick = document.createElement('div');
		this.stick.className = 'joystick-stick';
		this.stick.style.cssText = `
			position: absolute;
			width: ${this.stickRadius * 2}px;
			height: ${this.stickRadius * 2}px;
			border-radius: 50%;
			background: rgba(255, 255, 255, 0.8);
			border: 2px solid rgba(255, 255, 255, 1);
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			transition: opacity 0.2s;
		`;

		wrapper.appendChild(this.base);
		wrapper.appendChild(this.stick);
		this.container.appendChild(wrapper);
	}

	/**
	 * Setup touch events
	 */
	private setupEvents(): void {
		this.base.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
		document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
		document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
		document.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
	}

	/**
	 * Touch start handler
	 */
	private onTouchStart(e: TouchEvent): void {
		e.preventDefault();

		if (this.touchId !== null) return;

		const touch = e.changedTouches[0];
		this.touchId = touch.identifier;

		this.data.active = true;
		this.updateStickPosition(touch.clientX, touch.clientY);
	}

	/**
	 * Touch move handler
	 */
	private onTouchMove(e: TouchEvent): void {
		if (this.touchId === null) return;

		for (let i = 0; i < e.changedTouches.length; i++) {
			const touch = e.changedTouches[i];
			if (touch.identifier === this.touchId) {
				e.preventDefault();
				this.updateStickPosition(touch.clientX, touch.clientY);
				break;
			}
		}
	}

	/**
	 * Touch end handler
	 */
	private onTouchEnd(e: TouchEvent): void {
		if (this.touchId === null) return;

		for (let i = 0; i < e.changedTouches.length; i++) {
			const touch = e.changedTouches[i];
			if (touch.identifier === this.touchId) {
				this.touchId = null;
				this.resetStick();
				break;
			}
		}
	}

	/**
	 * Update stick position
	 */
	private updateStickPosition(touchX: number, touchY: number): void {
		const baseRect = this.base.getBoundingClientRect();
		const baseCenterX = baseRect.left + baseRect.width / 2;
		const baseCenterY = baseRect.top + baseRect.height / 2;

		// Calculate offset from center
		let deltaX = touchX - baseCenterX;
		let deltaY = touchY - baseCenterY;

		// Calculate distance and angle
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		const angle = Math.atan2(deltaY, deltaX);

		// Limit to max distance
		const clampedDistance = Math.min(distance, this.maxDistance);
		const normalizedDistance = clampedDistance / this.maxDistance;

		// Calculate stick position
		const stickX = Math.cos(angle) * clampedDistance;
		const stickY = Math.sin(angle) * clampedDistance;

		// Update stick visual position
		this.stick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;

		// Update data
		this.data.x = Math.cos(angle) * normalizedDistance;
		this.data.y = Math.sin(angle) * normalizedDistance;
		this.data.angle = angle;
		this.data.distance = normalizedDistance;
		this.data.active = true;

		// Callback
		if (this.onUpdate) {
			this.onUpdate(this.data);
		}
	}

	/**
	 * Reset stick to center
	 */
	private resetStick(): void {
		this.stick.style.transform = 'translate(-50%, -50%)';

		this.data.x = 0;
		this.data.y = 0;
		this.data.angle = 0;
		this.data.distance = 0;
		this.data.active = false;

		// Callback
		if (this.onUpdate) {
			this.onUpdate(this.data);
		}
	}

	/**
	 * Get current joystick data
	 */
	getData(): JoystickData {
		return { ...this.data };
	}

	/**
	 * Show joystick
	 */
	show(): void {
		const wrapper = this.container.querySelector('.virtual-joystick') as HTMLElement;
		if (wrapper) {
			wrapper.style.display = 'block';
		}
	}

	/**
	 * Hide joystick
	 */
	hide(): void {
		const wrapper = this.container.querySelector('.virtual-joystick') as HTMLElement;
		if (wrapper) {
			wrapper.style.display = 'none';
		}
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		const wrapper = this.container.querySelector('.virtual-joystick');
		if (wrapper) {
			wrapper.remove();
		}
	}
}
