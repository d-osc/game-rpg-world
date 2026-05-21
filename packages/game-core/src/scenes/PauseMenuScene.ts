/**
 * Pause Menu Scene (HTML Overlay)
 * Overlay that pauses the game
 */

import { div, p, button } from './dom';
import { CreateStyle } from 'elit/style';
import { Scene, SceneType, EnhancedSceneManager } from '@rpg/game-engine';
import { gameStateManager } from '../state/GameStateManager';

interface MenuButton {
	label: string;
	action: () => void;
}

export class PauseMenuScene extends Scene {
	private buttons: MenuButton[] = [];
	private selectedIndex: number = 0;
	private buttonEls: HTMLButtonElement[] = [];

	constructor() {
		super('PauseMenu');
		this.sceneType = SceneType.HTML_OVERLAY;
	}

	override async load(): Promise<void> {
		console.log('[PauseMenuScene] Loading...');
		this.buttons = [
			{ label: 'Resume', action: () => this.onResume() },
			{ label: 'Inventory', action: () => this.onInventory() },
			{ label: 'Jobs & Skills', action: () => this.onJobs() },
			{ label: 'Crafting', action: () => this.onCrafting() },
			{ label: 'Save Game', action: () => this.onSave() },
			{ label: 'Main Menu', action: () => this.onMainMenu() },
		];
		console.log('[PauseMenuScene] Loaded');
	}

	private setupStyles(): void {
		const css = new CreateStyle();
		css.addClass('pm-overlay', {
			position: 'absolute', inset: '0', background: 'rgba(0,0,0,0.6)',
			display: 'flex', alignItems: 'center', justifyContent: 'center',
			fontFamily: 'Arial, sans-serif',
		});
		css.addClass('pm-panel', {
			width: '400px', background: '#16213e', border: '4px solid #e94560',
			borderRadius: '12px', padding: '30px', textAlign: 'center',
		});
		css.addClass('pm-title', {
			fontSize: '32px', fontWeight: 'bold', color: '#eee', marginBottom: '30px',
		});
		css.addClass('pm-btn', {
			width: '300px', height: '50px', margin: '8px 0',
			background: '#0f3460', color: '#eee', border: '1px solid #333',
			fontSize: '20px', fontWeight: 'bold', cursor: 'pointer',
			borderRadius: '8px', transition: 'all 0.2s',
		});
		css.addClass('pm-btn-selected', {
			background: '#533483', border: '2px solid #e94560',
		});
		css.addClass('pm-hint', {
			color: '#aaa', fontSize: '14px', marginTop: '20px',
		});
		css.inject();
	}

	private updateUI(): void {
		this.buttonEls.forEach((el, i) => {
			el.classList.toggle('pm-btn-selected', i === this.selectedIndex);
		});
	}

	override renderHTML(): HTMLElement {
		this.setupStyles();

		this.buttonEls = [];
		const btnContainer = div({ style: 'display:flex;flex-direction:column;align-items:center;' });

		for (const btn of this.buttons) {
			const el = button({ className: 'pm-btn', onClick: () => btn.action() }, btn.label) as HTMLButtonElement;
			this.buttonEls.push(el);
			btnContainer.appendChild(el);
		}

		const root = div({ className: 'pm-overlay' },
			div({ className: 'pm-panel' },
				p({ className: 'pm-title' }, 'PAUSED'),
				btnContainer,
				p({ className: 'pm-hint' }, 'Arrows/WASD: Navigate | Enter: Select | ESC: Resume'),
			),
		);

		this.updateUI();
		return root as HTMLElement;
	}

	override onHTMLMounted(el: HTMLElement): void {
		document.removeEventListener('keydown', this.handleKeyDown);
		document.addEventListener('keydown', this.handleKeyDown);
	}

	private handleKeyDown = (e: KeyboardEvent): void => {
		if (!this._isActive) return;
		switch (e.key) {
			case 'ArrowUp': case 'w': case 'W':
				this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length;
				this.updateUI(); e.preventDefault(); break;
			case 'ArrowDown': case 's': case 'S':
				this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length;
				this.updateUI(); e.preventDefault(); break;
			case 'Enter': case ' ':
				this.buttons[this.selectedIndex]?.action(); e.preventDefault(); break;
			case 'Escape':
				this.onResume(); e.preventDefault(); break;
		}
	};

	private onResume(): void {
		const sm = EnhancedSceneManager.getInstance();
		sm.pop({ type: 'fade', duration: 200 });
	}

	private onInventory(): void {
		const sm = EnhancedSceneManager.getInstance();
		sm.push('Inventory', true, { type: 'fade', duration: 200 });
	}

	private onJobs(): void {
		const sm = EnhancedSceneManager.getInstance();
		sm.push('Jobs', true, { type: 'fade', duration: 200 });
	}

	private onCrafting(): void {
		const sm = EnhancedSceneManager.getInstance();
		sm.push('Crafting', true, { type: 'fade', duration: 200 });
	}

	private onSave(): void {
		const success = gameStateManager.saveGame();
		console.log(success ? '[PauseMenuScene] Game saved' : '[PauseMenuScene] Save failed');
	}

	private onMainMenu(): void {
		const sm = EnhancedSceneManager.getInstance();
		sm.switchTo('MainMenu', { type: 'fade', duration: 500 });
	}

	override update(deltaTime: number): void {}

	override onEnter(): void {
		super.onEnter();
		console.log('[PauseMenuScene] Entered');
	}

	override onExit(): void {
		super.onExit();
		document.removeEventListener('keydown', this.handleKeyDown);
		console.log('[PauseMenuScene] Exited');
	}

	override destroy(): void {
		this.onExit();
	}
}
