/**
 * Virtual Joystick
 * Touch-based movement control using elit for DOM and styling
 */

import { div } from 'elit/el';
import { createState } from 'elit/state';
import { render } from 'elit/dom';
import { CreateStyle } from 'elit/style';

export interface JoystickData {
	x: number;
	y: number;
	angle: number;
	distance: number;
	active: boolean;
}

export class VirtualJoystick {
	private container: HTMLElement;
	private wrapper!: HTMLElement;
	private baseEl!: HTMLElement;
	private stickEl!: HTMLElement;
	private touchId: number | null = null;
	private baseRadius: number = 60;
	private stickRadius: number = 30;
	private maxDistance: number = 50;
	private data: JoystickData = {
		x: 0, y: 0, angle: 0, distance: 0, active: false,
	};
	private onUpdate?: (data: JoystickData) => void;

	constructor(container: HTMLElement, options?: { onUpdate?: (data: JoystickData) => void }) {
		this.container = container;
		this.onUpdate = options?.onUpdate;
		this.create();
		this.setupEvents();
	}

	private create(): void {
		// Inject joystick styles
		const css = new CreateStyle();
		css.addClass('vjoy-wrapper', {
			position: 'fixed', bottom: '80px', left: '80px',
			width: `${this.baseRadius * 2}px`, height: `${this.baseRadius * 2}px`,
			pointerEvents: 'auto', touchAction: 'none',
			userSelect: 'none', zIndex: '1000',
		});
		css.addClass('vjoy-base', {
			position: 'absolute', width: '100%', height: '100%',
			borderRadius: '50%',
			background: 'rgba(255, 255, 255, 0.2)',
			border: '2px solid rgba(255, 255, 255, 0.4)',
		});
		css.addClass('vjoy-stick', {
			position: 'absolute',
			width: `${this.stickRadius * 2}px`, height: `${this.stickRadius * 2}px`,
			borderRadius: '50%',
			background: 'rgba(255, 255, 255, 0.8)',
			border: '2px solid rgba(255, 255, 255, 1)',
			top: '50%', left: '50%',
			transform: 'translate(-50%, -50%)',
			transition: 'opacity 0.2s',
		});
		css.inject();

		// Build elements with elit
		this.wrapper = div({ className: 'vjoy-wrapper' }) as HTMLElement;
		this.baseEl = div({ className: 'vjoy-base' }) as HTMLElement;
		this.stickEl = div({ className: 'vjoy-stick' }) as HTMLElement;

		this.wrapper.appendChild(this.baseEl);
		this.wrapper.appendChild(this.stickEl);
		this.container.appendChild(this.wrapper);
	}

	private setupEvents(): void {
		this.baseEl.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
		document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
		document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
		document.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
	}

	private onTouchStart(e: TouchEvent): void {
		e.preventDefault();
		if (this.touchId !== null) return;
		const touch = e.changedTouches[0]!;
		this.touchId = touch.identifier;
		this.data.active = true;
		this.updateStickPosition(touch.clientX, touch.clientY);
	}

	private onTouchMove(e: TouchEvent): void {
		if (this.touchId === null) return;
		for (let i = 0; i < e.changedTouches.length; i++) {
			const touch = e.changedTouches[i]!;
			if (touch.identifier === this.touchId) {
				e.preventDefault();
				this.updateStickPosition(touch.clientX, touch.clientY);
				break;
			}
		}
	}

	private onTouchEnd(e: TouchEvent): void {
		if (this.touchId === null) return;
		for (let i = 0; i < e.changedTouches.length; i++) {
			const touch = e.changedTouches[i]!;
			if (touch.identifier === this.touchId) {
				this.touchId = null;
				this.resetStick();
				break;
			}
		}
	}

	private updateStickPosition(touchX: number, touchY: number): void {
		const baseRect = this.baseEl.getBoundingClientRect();
		const baseCenterX = baseRect.left + baseRect.width / 2;
		const baseCenterY = baseRect.top + baseRect.height / 2;

		let deltaX = touchX - baseCenterX;
		let deltaY = touchY - baseCenterY;

		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		const angle = Math.atan2(deltaY, deltaX);
		const clampedDistance = Math.min(distance, this.maxDistance);
		const normalizedDistance = clampedDistance / this.maxDistance;

		const stickX = Math.cos(angle) * clampedDistance;
		const stickY = Math.sin(angle) * clampedDistance;

		this.stickEl.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;

		this.data.x = Math.cos(angle) * normalizedDistance;
		this.data.y = Math.sin(angle) * normalizedDistance;
		this.data.angle = angle;
		this.data.distance = normalizedDistance;
		this.data.active = true;

		if (this.onUpdate) this.onUpdate(this.data);
	}

	private resetStick(): void {
		this.stickEl.style.transform = 'translate(-50%, -50%)';
		this.data.x = 0;
		this.data.y = 0;
		this.data.angle = 0;
		this.data.distance = 0;
		this.data.active = false;
		if (this.onUpdate) this.onUpdate(this.data);
	}

	getData(): JoystickData {
		return { ...this.data };
	}

	show(): void {
		this.wrapper.style.display = 'block';
	}

	hide(): void {
		this.wrapper.style.display = 'none';
	}

	destroy(): void {
		this.wrapper.remove();
	}
}
