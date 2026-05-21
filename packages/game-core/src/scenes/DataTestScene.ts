/**
 * DataTestScene
 * Tests data loading and game state initialization
 */

import { Scene, keyboard } from '@rpg/game-engine';
import { dataLoader } from '../data/DataLoader';
import { gameStateManager } from '../state/GameStateManager';
import { inventoryManager } from '../inventory/InventoryManager';
import { jobManager } from '../jobs/JobManager';
import { equipmentManager } from '../inventory/EquipmentManager';


export class DataTestScene extends Scene {
	private dataLoaded: boolean = false;
	private keyHandlers: Map<string, (e: KeyboardEvent) => void> = new Map();
	private gameInitialized: boolean = false;

	constructor() {
		super('DataTest');
	}

	override async load(): Promise<void> {
		await dataLoader.loadAll();
		this.dataLoaded = true;
		console.log('[DataTestScene] Data loaded');
	}

	override onEnter(): void {
		super.onEnter();
		console.log('[DataTestScene] Entered');
		this.setupInput();
	}

	override update(deltaTime: number): void {
		// No continuous updates needed
	}

	override render(ctx: CanvasRenderingContext2D): void {
		const w = ctx.canvas.width;
		const h = ctx.canvas.height;

		// Background
		ctx.fillStyle = '#1a1a2e';
		ctx.fillRect(0, 0, w, h);

		ctx.fillStyle = '#fff';
		ctx.font = '20px monospace';
		ctx.textAlign = 'center';

		ctx.fillText('Data Test Scene', w / 2, 60);

		ctx.font = '14px monospace';
		ctx.fillStyle = this.dataLoaded ? '#4CAF50' : '#f44336';
		ctx.fillText(`Data Loaded: ${this.dataLoaded}`, w / 2, 120);

		ctx.fillStyle = this.gameInitialized ? '#4CAF50' : '#f44336';
		ctx.fillText(`Game Initialized: ${this.gameInitialized}`, w / 2, 150);

		if (this.dataLoaded) {
			ctx.fillStyle = '#aaa';
			ctx.font = '12px monospace';
			const monsters = dataLoader.getAllMonsters();
			const items = dataLoader.getAllItems();
			const jobs = dataLoader.getAllJobs();
			const skills = dataLoader.getAllSkills();
			const recipes = dataLoader.getAllRecipes();
			const npcs = dataLoader.getAllNPCs();

			ctx.fillText(`Monsters: ${monsters.length}`, w / 2, 200);
			ctx.fillText(`Items: ${items.length}`, w / 2, 225);
			ctx.fillText(`Jobs: ${jobs.length}`, w / 2, 250);
			ctx.fillText(`Skills: ${skills.length}`, w / 2, 275);
			ctx.fillText(`Recipes: ${recipes.length}`, w / 2, 300);
			ctx.fillText(`NPCs: ${npcs.length}`, w / 2, 325);
		}

		ctx.fillStyle = '#888';
		ctx.font = '12px monospace';
		ctx.fillText('Press I to initialize game | Press ESC to go back', w / 2, h - 60);
	}

	private setupInput(): void {
		this.cleanupKeyboard();
		const bind = (key: string, fn: () => void) => {
			const handler = (e: KeyboardEvent) => { e.preventDefault(); fn(); };
			this.keyHandlers.set(key, handler);
			keyboard.onKeyDown(key, handler);
		};
		bind('KeyI', () => this.initializeGame());
		bind('Escape', () => console.log('[DataTestScene] ESC pressed'));
	}

	private cleanupKeyboard(): void {
		for (const [key, handler] of this.keyHandlers) {
			keyboard.removeKeyDownListener(key, handler);
		}
		this.keyHandlers.clear();
	}

	private initializeGame(): void {
		if (this.gameInitialized) {
			console.log('[DataTestScene] Game already initialized');
			return;
		}

		const jobs = dataLoader.getAllJobs();
		if (jobs.length > 0) {
			jobManager.loadJobs(jobs as any);
			gameStateManager.initializeManagers(inventoryManager, jobManager, dataLoader, equipmentManager);
			this.gameInitialized = true;
			console.log('[DataTestScene] Game initialized');
		} else {
			console.warn('[DataTestScene] No jobs loaded, cannot initialize');
		}
	}

	override onExit(): void {
		super.onExit();
		this.cleanupKeyboard();
	}

	override destroy(): void {
		this.cleanupKeyboard();
	}
}
