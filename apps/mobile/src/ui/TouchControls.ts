/**
 * Touch Controls
 * Mobile-friendly touch button controls
 */

export interface TouchButton {
	id: string;
	label: string;
	position: { bottom?: number; top?: number; left?: number; right?: number };
	size?: number;
	onPress?: () => void;
	onRelease?: () => void;
}

export class TouchControls {
	private container: HTMLElement;
	private buttons: Map<string, HTMLElement> = new Map();
	private activeTouch: Map<number, string> = new Map();

	constructor(container: HTMLElement) {
		this.container = container;
		this.setupContainer();
	}

	/**
	 * Setup container
	 */
	private setupContainer(): void {
		const wrapper = document.createElement('div');
		wrapper.className = 'touch-controls';
		wrapper.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
			z-index: 999;
		`;
		this.container.appendChild(wrapper);
	}

	/**
	 * Add button
	 */
	addButton(config: TouchButton): void {
		const button = document.createElement('div');
		button.id = `touch-btn-${config.id}`;
		button.className = 'touch-button';

		const size = config.size || 60;
		const position = config.position;

		let positionStyle = '';
		if (position.bottom !== undefined) positionStyle += `bottom: ${position.bottom}px;`;
		if (position.top !== undefined) positionStyle += `top: ${position.top}px;`;
		if (position.left !== undefined) positionStyle += `left: ${position.left}px;`;
		if (position.right !== undefined) positionStyle += `right: ${position.right}px;`;

		button.style.cssText = `
			position: fixed;
			${positionStyle}
			width: ${size}px;
			height: ${size}px;
			border-radius: 50%;
			background: rgba(255, 255, 255, 0.3);
			border: 2px solid rgba(255, 255, 255, 0.6);
			display: flex;
			align-items: center;
			justify-content: center;
			color: white;
			font-size: 14px;
			font-weight: bold;
			pointer-events: auto;
			touch-action: none;
			user-select: none;
			transition: all 0.1s;
		`;

		button.textContent = config.label;

		// Touch events
		button.addEventListener('touchstart', (e) => {
			e.preventDefault();
			const touch = e.changedTouches[0];
			this.activeTouch.set(touch.identifier, config.id);
			button.style.background = 'rgba(255, 255, 255, 0.6)';
			button.style.transform = 'scale(0.95)';
			if (config.onPress) config.onPress();
		}, { passive: false });

		button.addEventListener('touchend', (e) => {
			e.preventDefault();
			const touch = e.changedTouches[0];
			if (this.activeTouch.get(touch.identifier) === config.id) {
				this.activeTouch.delete(touch.identifier);
				button.style.background = 'rgba(255, 255, 255, 0.3)';
				button.style.transform = 'scale(1)';
				if (config.onRelease) config.onRelease();
			}
		}, { passive: false });

		button.addEventListener('touchcancel', (e) => {
			e.preventDefault();
			const touch = e.changedTouches[0];
			if (this.activeTouch.get(touch.identifier) === config.id) {
				this.activeTouch.delete(touch.identifier);
				button.style.background = 'rgba(255, 255, 255, 0.3)';
				button.style.transform = 'scale(1)';
				if (config.onRelease) config.onRelease();
			}
		}, { passive: false });

		const wrapper = this.container.querySelector('.touch-controls');
		if (wrapper) {
			wrapper.appendChild(button);
			this.buttons.set(config.id, button);
		}
	}

	/**
	 * Remove button
	 */
	removeButton(id: string): void {
		const button = this.buttons.get(id);
		if (button) {
			button.remove();
			this.buttons.delete(id);
		}
	}

	/**
	 * Show all buttons
	 */
	show(): void {
		const wrapper = this.container.querySelector('.touch-controls') as HTMLElement;
		if (wrapper) {
			wrapper.style.display = 'block';
		}
	}

	/**
	 * Hide all buttons
	 */
	hide(): void {
		const wrapper = this.container.querySelector('.touch-controls') as HTMLElement;
		if (wrapper) {
			wrapper.style.display = 'none';
		}
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.buttons.forEach((button) => button.remove());
		this.buttons.clear();
		this.activeTouch.clear();

		const wrapper = this.container.querySelector('.touch-controls');
		if (wrapper) {
			wrapper.remove();
		}
	}
}
