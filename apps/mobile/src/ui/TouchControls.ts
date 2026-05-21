/**
 * Touch Controls
 * Mobile-friendly touch button controls using elit
 */

import { div } from 'elit/el';
import { CreateStyle } from 'elit/style';

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
	private wrapper!: HTMLElement;
	private buttons: Map<string, HTMLElement> = new Map();
	private activeTouch: Map<number, string> = new Map();

	constructor(container: HTMLElement) {
		this.container = container;
		this.create();
	}

	private create(): void {
		// Inject touch controls styles
		const css = new CreateStyle();
		css.addClass('touch-controls-layer', {
			position: 'fixed', top: '0', left: '0',
			width: '100%', height: '100%',
			pointerEvents: 'none', zIndex: '999',
		});
		css.addClass('touch-btn', {
			position: 'fixed', borderRadius: '50%',
			background: 'rgba(255, 255, 255, 0.3)',
			border: '2px solid rgba(255, 255, 255, 0.6)',
			display: 'flex', alignItems: 'center', justifyContent: 'center',
			color: '#fff', fontSize: '14px', fontWeight: 'bold',
			pointerEvents: 'auto', touchAction: 'none',
			userSelect: 'none', transition: 'all 0.1s',
		});
		css.addClass('touch-btn-active', {
			background: 'rgba(255, 255, 255, 0.6)',
			transform: 'scale(0.95)',
		});
		css.inject();

		this.wrapper = div({ className: 'touch-controls-layer' }) as HTMLElement;
		this.container.appendChild(this.wrapper);
	}

	addButton(config: TouchButton): void {
		const size = config.size || 60;
		const pos = config.position;

		let posStyle = '';
		if (pos.bottom !== undefined) posStyle += `bottom:${pos.bottom}px;`;
		if (pos.top !== undefined) posStyle += `top:${pos.top}px;`;
		if (pos.left !== undefined) posStyle += `left:${pos.left}px;`;
		if (pos.right !== undefined) posStyle += `right:${pos.right}px;`;

		const button = div({ className: 'touch-btn', id: `touch-btn-${config.id}` }, config.label) as HTMLElement;
		button.style.cssText += `width:${size}px;height:${size}px;${posStyle}`;

		button.addEventListener('touchstart', (e) => {
			e.preventDefault();
			const touch = e.changedTouches[0]!;
			this.activeTouch.set(touch.identifier, config.id);
			button.classList.add('touch-btn-active');
			if (config.onPress) config.onPress();
		}, { passive: false });

		button.addEventListener('touchend', (e) => {
			e.preventDefault();
			const touch = e.changedTouches[0]!;
			if (this.activeTouch.get(touch.identifier) === config.id) {
				this.activeTouch.delete(touch.identifier);
				button.classList.remove('touch-btn-active');
				if (config.onRelease) config.onRelease();
			}
		}, { passive: false });

		button.addEventListener('touchcancel', (e) => {
			e.preventDefault();
			const touch = e.changedTouches[0]!;
			if (this.activeTouch.get(touch.identifier) === config.id) {
				this.activeTouch.delete(touch.identifier);
				button.classList.remove('touch-btn-active');
				if (config.onRelease) config.onRelease();
			}
		}, { passive: false });

		this.wrapper.appendChild(button);
		this.buttons.set(config.id, button);
	}

	removeButton(id: string): void {
		const button = this.buttons.get(id);
		if (button) {
			button.remove();
			this.buttons.delete(id);
		}
	}

	show(): void {
		this.wrapper.style.display = 'block';
	}

	hide(): void {
		this.wrapper.style.display = 'none';
	}

	destroy(): void {
		this.buttons.forEach((button) => button.remove());
		this.buttons.clear();
		this.activeTouch.clear();
		this.wrapper.remove();
	}
}
