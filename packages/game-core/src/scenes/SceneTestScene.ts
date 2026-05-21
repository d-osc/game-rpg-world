/**
 * Scene Test Scene (HTML Overlay)
 * Demonstrates EnhancedSceneManager functionality
 */

import { div, p, button, span } from './dom';
import { CreateStyle } from 'elit/style';
import { Scene, SceneType, EnhancedSceneManager } from '@rpg/game-engine';
import { MainMenuScene } from './MainMenuScene';
import { PauseMenuScene } from './PauseMenuScene';
import { CharacterCreationScene } from './CharacterCreationScene';
import { WorldScene } from './WorldScene';
import { CombatScene } from './CombatScene';
import { InventoryScene } from './InventoryScene';
import { JobScene } from './JobScene';
import { CraftingScene } from './CraftingScene';
import { dataLoader } from '../data/DataLoader';
import { gameStateManager } from '../state/GameStateManager';
import { inventoryManager } from '../inventory/InventoryManager';
import { jobManager } from '../jobs/JobManager';
import { equipmentManager } from '../inventory/EquipmentManager';

export class SceneTestScene extends Scene {
	private sceneManager!: EnhancedSceneManager;
	private infoEl: HTMLElement | null = null;

	constructor() {
		super('SceneTest');
		this.sceneType = SceneType.HTML_OVERLAY;
	}

	override async load(): Promise<void> {
		console.log('[SceneTestScene] Loading...');
		await dataLoader.loadAll();
		gameStateManager.initializeManagers(inventoryManager, jobManager, dataLoader, equipmentManager);

		const jobs = dataLoader.getAllJobs();
		if (jobs.length > 0) jobManager.loadJobs(jobs as any);

		this.sceneManager = EnhancedSceneManager.getInstance();
		this.registerScenes();
		console.log('[SceneTestScene] Loaded');
	}

	private registerScenes(): void {
		const scenes = [
			new MainMenuScene(), new PauseMenuScene(), new CharacterCreationScene(),
			new WorldScene(), new CombatScene(), new InventoryScene(),
			new JobScene(), new CraftingScene(),
		];
		for (const scene of scenes) {
			if (!this.sceneManager.getScene(scene.name)) {
				this.sceneManager.addScene(scene);
			}
		}
		console.log('[SceneTestScene] Scenes ready');
	}

	private setupStyles(): void {
		const css = new CreateStyle();
		css.addClass('st-root', {
			width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
			alignItems: 'center', justifyContent: 'center',
			background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
			color: '#ecf0f1', fontFamily: 'Arial, sans-serif', position: 'absolute', inset: '0',
			overflow: 'auto', padding: '40px',
		});
		css.addClass('st-title', {
			fontSize: '36px', fontWeight: 'bold', color: '#3498db', marginBottom: '30px',
		});
		css.addClass('st-grid', {
			display: 'grid', gridTemplateColumns: 'repeat(3, 200px)', gap: '15px', marginBottom: '30px',
		});
		css.addClass('st-btn', {
			padding: '15px', background: '#34495e', color: '#ecf0f1',
			border: '2px solid #7f8c8d', borderRadius: '8px', fontSize: '16px',
			cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
		});
		css.addClass('st-btn:hover', { background: '#3498db', borderColor: '#e74c3c' });
		css.addClass('st-info', {
			color: '#2ecc71', fontSize: '16px', marginBottom: '15px',
		});
		css.addClass('st-stack', {
			display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '15px',
		});
		css.addClass('st-stack-item', {
			padding: '8px 15px', background: '#34495e', borderRadius: '6px',
			border: '1px solid #7f8c8d', fontSize: '14px',
		});
		css.addClass('st-stack-current', { background: '#3498db', border: '2px solid #e74c3c' });
		css.inject();
	}

	private updateInfo(): void {
		if (!this.infoEl) return;
		const stack = this.sceneManager.getStack();
		const current = this.sceneManager.currentScene;
		this.infoEl.innerHTML = '';

		this.infoEl.appendChild(p({ className: 'st-info' },
			`Stack depth: ${this.sceneManager.stackDepth} | Current: ${current?.name || 'none'} | Transitioning: ${this.sceneManager.transitioning}`,
		));

		const stackDiv = div({ className: 'st-stack' });
		stack.forEach((scene, i) => {
			stackDiv.appendChild(span({
				className: 'st-stack-item' + (i === stack.length - 1 ? ' st-stack-current' : ''),
			}, scene.name));
		});
		this.infoEl.appendChild(stackDiv);
	}

	override renderHTML(): HTMLElement {
		this.setupStyles();

		const buttons = [
			{ label: '1: Main Menu', action: () => this.sceneManager.switchTo('MainMenu', { type: 'fade', duration: 500 }) },
			{ label: '2: Character Creation', action: () => this.sceneManager.switchTo('CharacterCreation', { type: 'fade', duration: 500 }) },
			{ label: '3: World Scene', action: () => this.sceneManager.switchTo('World', { type: 'fade', duration: 500 }) },
			{ label: '4: Combat', action: () => this.testCombat() },
			{ label: '5: Inventory', action: () => this.sceneManager.switchTo('Inventory', { type: 'fade', duration: 500 }) },
			{ label: '6: Jobs', action: () => this.sceneManager.switchTo('Jobs', { type: 'fade', duration: 500 }) },
			{ label: '7: Crafting', action: () => this.sceneManager.switchTo('Crafting', { type: 'fade', duration: 500 }) },
			{ label: '8: Pause Menu', action: () => this.sceneManager.push('PauseMenu', true, { type: 'none', duration: 0 }) },
			{ label: '9: Pop', action: () => this.sceneManager.pop({ type: 'none', duration: 0 }) },
		];

		const grid = div({ className: 'st-grid' });
		for (const btn of buttons) {
			grid.appendChild(button({ className: 'st-btn', onClick: () => btn.action() }, btn.label));
		}

		this.infoEl = div({});
		const root = div({ className: 'st-root' },
			p({ className: 'st-title' }, 'Scene Manager Test'),
			grid,
			this.infoEl,
			p({ style: 'color:#95a5a6;font-size:14px' }, 'Press number keys or click buttons | ESC: Return here | S: Stack info'),
		);

		this.updateInfo();
		return root as HTMLElement;
	}

	private async testCombat(): Promise<void> {
		const slime = dataLoader.getMonster('slime');
		if (!slime) { console.error('[SceneTestScene] Slime not found'); return; }
		await this.sceneManager.switchTo('Combat', { type: 'fade', duration: 500 });
		const combatScene = this.sceneManager.getScene('Combat') as CombatScene;
		if (combatScene) combatScene.startCombat(slime, 1);
	}

	override onHTMLMounted(el: HTMLElement): void {
		document.removeEventListener('keydown', this.handleKeyDown);
		document.addEventListener('keydown', this.handleKeyDown);
	}

	private handleKeyDown = (e: KeyboardEvent): void => {
		switch (e.key) {
			case '1': this.sceneManager.switchTo('MainMenu', { type: 'fade', duration: 500 }); e.preventDefault(); break;
			case '2': this.sceneManager.switchTo('CharacterCreation', { type: 'fade', duration: 500 }); e.preventDefault(); break;
			case '3': this.sceneManager.switchTo('World', { type: 'fade', duration: 500 }); e.preventDefault(); break;
			case '4': this.testCombat(); e.preventDefault(); break;
			case '5': this.sceneManager.switchTo('Inventory', { type: 'fade', duration: 500 }); e.preventDefault(); break;
			case '6': this.sceneManager.switchTo('Jobs', { type: 'fade', duration: 500 }); e.preventDefault(); break;
			case '7': this.sceneManager.switchTo('Crafting', { type: 'fade', duration: 500 }); e.preventDefault(); break;
			case '8': this.sceneManager.push('PauseMenu', true, { type: 'none', duration: 0 }); e.preventDefault(); break;
			case '9': this.sceneManager.pop({ type: 'none', duration: 0 }); e.preventDefault(); break;
			case 's': case 'S': this.updateInfo(); e.preventDefault(); break;
			case 'Escape':
				if (this.sceneManager.currentScene?.name !== 'SceneTest')
					this.sceneManager.switchTo('SceneTest', { type: 'fade', duration: 300 });
				e.preventDefault(); break;
		}
	};

	override update(deltaTime: number): void {}

	override onEnter(): void {
		super.onEnter();
		console.log('[SceneTestScene] Entered');
	}

	override onExit(): void {
		super.onExit();
		document.removeEventListener('keydown', this.handleKeyDown);
		console.log('[SceneTestScene] Exited');
	}

	override destroy(): void {
		this.onExit();
	}
}
