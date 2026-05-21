/**
 * Main Menu Scene (HTML Overlay)
 * First scene shown to players
 */

import { div, h1, p, span, button } from './dom';
import { CreateStyle } from 'elit/style';
import { Scene, SceneType, EnhancedSceneManager } from '@rpg/game-engine';
import { gameStateManager } from '../state/GameStateManager';
import { dataLoader } from '../data/DataLoader';

interface MenuButton {
	label: string;
	action: () => void;
	enabled: boolean;
}

export class MainMenuScene extends Scene {
	private buttons: MenuButton[] = [];
	private selectedIndex: number = 0;
	private hasSaveData: boolean = false;
	private rootEl: HTMLElement | null = null;
	private buttonEls: HTMLButtonElement[] = [];

	constructor() {
		super('MainMenu');
		this.sceneType = SceneType.HTML_OVERLAY;
	}

	override async load(): Promise<void> {
		console.log('[MainMenuScene] Loading...');
		try {
			await dataLoader.loadAll();
		} catch (error) {
			console.error('[MainMenuScene] Failed to load game data:', error);
			return;
		}
		this.hasSaveData = gameStateManager.hasSaveData();
		this.setupButtons();
		console.log('[MainMenuScene] Loaded');
	}

	private setupButtons(): void {
		this.buttons = [
			{ label: 'New Game', action: () => this.onNewGame(), enabled: true },
			{ label: 'Continue', action: () => this.onContinue(), enabled: this.hasSaveData },
			{ label: 'Settings', action: () => this.onSettings(), enabled: false },
			{ label: 'Exit', action: () => this.onExitGame(), enabled: true },
		];
		this.selectedIndex = Math.max(0, this.buttons.findIndex((b) => b.enabled));
	}

	private setupStyles(): void {
		const css = new CreateStyle();
		css.addClass('mm-root', {
			width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
			background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
			color: '#fff', fontFamily: 'Arial, sans-serif',
		});
		css.addClass('mm-center', {
			position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column',
			alignItems: 'center', justifyContent: 'center',
		});
		css.addClass('mm-title', {
			fontSize: '64px', fontWeight: 'bold', color: '#eee', marginBottom: '8px',
			textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
		});
		css.addClass('mm-subtitle', {
			fontSize: '24px', color: '#aaa', marginBottom: '60px',
		});
		css.addClass('mm-btn', {
			width: '300px', height: '60px', margin: '10px 0',
			background: '#16213e', color: '#eee', border: '1px solid #333',
			fontSize: '24px', fontWeight: 'bold', cursor: 'pointer',
			borderRadius: '8px', transition: 'all 0.2s',
		});
		css.addClass('mm-btn-selected', {
			background: '#0f3460', border: '3px solid #e94560',
		});
		css.addClass('mm-btn-disabled', {
			background: '#2a2a3e', color: '#666', cursor: 'not-allowed',
		});
		css.addClass('mm-hint', {
			position: 'absolute', bottom: '20px', color: '#aaa', fontSize: '16px',
		});
		css.addClass('mm-save', {
			position: 'absolute', top: '20px', left: '20px', color: '#aaa', fontSize: '14px', lineHeight: '1.6',
		});
		css.inject();
	}

	private updateUI(): void {
		this.buttonEls.forEach((el, i) => {
			const btn = this.buttons[i];
			if (!btn) return;
			el.classList.toggle('mm-btn-selected', i === this.selectedIndex && btn.enabled);
			el.classList.toggle('mm-btn-disabled', !btn.enabled);
		});
	}

	override renderHTML(): HTMLElement {
		this.setupStyles();

		this.buttonEls = [];
		const btnContainer = div({ style: 'display:flex;flex-direction:column;align-items:center;' });

		for (const btn of this.buttons) {
			const el = button({ className: 'mm-btn', onClick: () => btn.enabled && btn.action() }, btn.label) as HTMLButtonElement;
			if (!btn.enabled) el.classList.add('mm-btn-disabled');
			this.buttonEls.push(el);
			btnContainer.appendChild(el);
		}

		let saveInfo: HTMLElement = div();
		if (this.hasSaveData) {
			try {
				const player = gameStateManager.getPlayerState();
				if (player) {
					saveInfo = div({ className: 'mm-save' },
						p({}, `Saved: ${player.name}`),
						p({}, `Level: ${player.level} | Zone: ${player.currentZone}`),
					);
				}
			} catch {}
		}

		const centerContent = div({ className: 'mm-center' },
			h1({ className: 'mm-title' }, 'RPG Adventure'),
			p({ className: 'mm-subtitle' }, 'A 2D Multiplayer RPG'),
			btnContainer,
		);

		this.rootEl = div({ className: 'mm-root' },
			saveInfo,
			centerContent,
			p({ className: 'mm-hint' }, 'Arrow Keys/WASD: Navigate | Enter: Select | ESC: Exit'),
		) as HTMLElement;

		this.updateUI();
		return this.rootEl;
	}

	override onHTMLMounted(el: HTMLElement): void {
		document.removeEventListener('keydown', this.handleKeyDown);
		document.addEventListener('keydown', this.handleKeyDown);
	}

	private handleKeyDown = (e: KeyboardEvent): void => {
		if (!this._isActive) return;
		switch (e.key) {
			case 'ArrowUp': case 'w': case 'W':
				this.selectPrev(); e.preventDefault(); break;
			case 'ArrowDown': case 's': case 'S':
				this.selectNext(); e.preventDefault(); break;
			case 'Enter': case ' ':
				this.activateSelected(); e.preventDefault(); break;
			case 'Escape':
				this.onExitGame(); e.preventDefault(); break;
		}
	};

	private selectPrev(): void {
		for (let i = this.selectedIndex - 1; i >= 0; i--) {
			if (this.buttons[i]!.enabled) { this.selectedIndex = i; this.updateUI(); return; }
		}
		for (let i = this.buttons.length - 1; i > this.selectedIndex; i--) {
			if (this.buttons[i]!.enabled) { this.selectedIndex = i; this.updateUI(); return; }
		}
	}

	private selectNext(): void {
		for (let i = this.selectedIndex + 1; i < this.buttons.length; i++) {
			if (this.buttons[i]!.enabled) { this.selectedIndex = i; this.updateUI(); return; }
		}
		for (let i = 0; i < this.selectedIndex; i++) {
			if (this.buttons[i]!.enabled) { this.selectedIndex = i; this.updateUI(); return; }
		}
	}

	private activateSelected(): void {
		const btn = this.buttons[this.selectedIndex];
		if (btn && btn.enabled) btn.action();
	}

	private onNewGame(): void {
		console.log('[MainMenuScene] New Game');
		const sm = EnhancedSceneManager.getInstance();
		sm.switchTo('CharacterCreation', { type: 'fade', duration: 500 });
	}

	private onContinue(): void {
		if (!this.hasSaveData) return;
		const loaded = gameStateManager.loadGame();
		if (loaded) {
			const sm = EnhancedSceneManager.getInstance();
			sm.switchTo('World', { type: 'fade', duration: 500 });
		} else {
			console.error('[MainMenuScene] Failed to load save');
		}
	}

	private onSettings(): void {
		console.log('[MainMenuScene] Settings not implemented');
	}

	private onExitGame(): void {
		const sm = EnhancedSceneManager.getInstance();
		sm.switchTo('SceneTest', { type: 'fade', duration: 300 });
	}

	override update(deltaTime: number): void {}

	override onEnter(): void {
		super.onEnter();
		this.hasSaveData = gameStateManager.hasSaveData();
		this.setupButtons();
		console.log('[MainMenuScene] Entered');
	}

	override onExit(): void {
		super.onExit();
		document.removeEventListener('keydown', this.handleKeyDown);
		console.log('[MainMenuScene] Exited');
	}

	override destroy(): void {
		this.onExit();
	}
}
