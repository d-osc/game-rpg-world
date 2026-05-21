/**
 * Crafting Scene (HTML Overlay)
 * Craft items using recipes and materials
 */

import { div, p, button, span } from './dom';
import { CreateStyle } from 'elit/style';
import { Scene, SceneType, keyboard, EnhancedSceneManager } from '@rpg/game-engine';
import { craftingManager } from '../economy/CraftingManager';
import { inventoryManager } from '../inventory/InventoryManager';
import { gameStateManager } from '../state/GameStateManager';
import { dataLoader, type RecipeData } from '../data/DataLoader';
import { jobManager } from '../jobs/JobManager';

interface MenuOption {
	text: string;
	action: () => void;
	enabled: boolean;
}

type FilterType = 'all' | 'weapon' | 'armor' | 'consumable' | 'material';

export class CraftingScene extends Scene {
	private currentFilter: FilterType = 'all';
	private selectedIndex: number = 0;
	private scrollOffset: number = 0;

	private filteredRecipes: RecipeData[] = [];
	private selectedRecipe: RecipeData | null = null;

	private readonly ITEMS_PER_PAGE = 8;
	private craftingInProgress: boolean = false;
	private craftingRAF: number | null = null;
	private craftingResultTimer: ReturnType<typeof setTimeout> | null = null;
	private craftingProgress: number = 0;
	private actionMenuVisible: boolean = false;
	private actionMenuOptions: MenuOption[] = [];

	private listEl: HTMLElement | null = null;
	private actionMenuEl: HTMLElement | null = null;
	private progressEl: HTMLElement | null = null;
	private progressBarEl: HTMLElement | null = null;
	private keyHandlers: Map<string, (e: KeyboardEvent) => void> = new Map();

	constructor() {
		super('Crafting');
		this.sceneType = SceneType.HTML_OVERLAY;
	}

	override async load(): Promise<void> {
		console.log('[CraftingScene] Loading...');
		await dataLoader.loadAll();
		const recipes = dataLoader.getAllRecipes();
		if (recipes.length > 0) craftingManager.loadRecipes(recipes as any);
		this.setupCraftingManagerCallbacks();
		this.updateFilteredRecipes();
		console.log('[CraftingScene] Loaded');
	}

	private setupCraftingManagerCallbacks(): void {
		craftingManager.setInventoryCallbacks(
			(itemId: string, quantity: number) => inventoryManager.hasItem(itemId, quantity),
			(items) => {
				for (const mat of items) { if (!inventoryManager.removeItem(mat.item_id, mat.quantity)) return false; }
				return true;
			},
			(itemId: string, quantity: number) => {
				const itemData = dataLoader.getItem(itemId);
				if (!itemData) return false;
				return inventoryManager.addItem(itemData as any, quantity);
			},
		);
		craftingManager.setCurrencyCallbacks(
			(amount: number) => { try { return gameStateManager.getPlayerState().gold >= amount; } catch { return false; } },
			(amount: number) => { try { gameStateManager.removeGold(amount); return true; } catch { return false; } },
		);
		craftingManager.setJobCallbacks(
			(jobId: string, level: number) => { const j = jobManager.getLearnedJob(jobId); return j !== undefined && j.level >= level; },
			(skillId: string) => jobManager.getAllAvailableSkills().includes(skillId),
			(jobId: string, exp: number) => jobManager.addJobExperience(jobId, exp),
		);
	}

	private setupStyles(): void {
		const css = new CreateStyle();
		css.addClass('craft-root', {
			width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
			background: 'rgba(26,26,46,0.95)', color: '#fff', fontFamily: 'Arial, sans-serif',
			position: 'absolute', inset: '0',
		});
		css.addClass('craft-panel', {
			width: '700px', maxHeight: '90vh', background: 'rgba(0,0,0,0.8)',
			border: '2px solid #6C5CE7', borderRadius: '12px', padding: '20px',
		});
		css.addClass('craft-header', {
			display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px',
		});
		css.addClass('craft-title', { fontSize: '24px', fontWeight: 'bold' });
		css.addClass('craft-list', {
			maxHeight: '450px', overflowY: 'auto', borderRadius: '8px',
			background: 'rgba(0,0,0,0.3)', padding: '5px',
		});
		css.addClass('craft-item', {
			padding: '10px 15px', margin: '5px 0', borderRadius: '6px',
			borderLeft: '4px solid transparent', transition: 'all 0.15s',
		});
		css.addClass('craft-item-selected', { background: 'rgba(255,215,0,0.3)', borderLeftColor: '#FFD700' });
		css.addClass('craft-progress-overlay', {
			position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
			background: 'rgba(0,0,0,0.9)', border: '3px solid #6C5CE7', borderRadius: '12px',
			padding: '30px', textAlign: 'center', zIndex: '20', width: '400px',
		});
		css.addClass('craft-progress-bar-bg', {
			width: '100%', height: '30px', background: 'rgba(255,255,255,0.1)',
			borderRadius: '15px', margin: '20px 0', overflow: 'hidden',
		});
		css.addClass('craft-progress-bar-fill', {
			height: '100%', background: '#2196F3', borderRadius: '15px', transition: 'width 0.1s',
		});
		css.addClass('craft-action-menu', {
			position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
			background: 'rgba(0,0,0,0.9)', border: '2px solid #6C5CE7', borderRadius: '8px',
			padding: '15px', zIndex: '10', minWidth: '250px',
		});
		css.addClass('craft-action-btn', {
			display: 'block', width: '100%', padding: '10px', margin: '5px 0',
			background: '#16213e', color: '#eee', border: '1px solid #333',
			fontSize: '16px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left',
		});
		css.addClass('craft-action-btn-selected', { background: '#533483', border: '2px solid #FFD700' });
		css.addClass('craft-hint', { color: '#888', fontSize: '14px', marginTop: '15px', textAlign: 'center' });
		css.inject();
	}

	private updateUI(): void {
		if (!this.listEl) return;
		this.listEl.innerHTML = '';

		const visible = this.filteredRecipes.slice(this.scrollOffset, this.scrollOffset + this.ITEMS_PER_PAGE);

		if (visible.length === 0) {
			this.listEl.appendChild(p({ style: 'color:#888;font-style:italic;padding:20px;' }, 'No recipes available'));
		} else {
			visible.forEach((recipe, index) => {
				const abs = this.scrollOffset + index;
				const selected = abs === this.selectedIndex && !this.actionMenuVisible && !this.craftingInProgress;
				const canCraft = craftingManager.canCraft(recipe.id).canCraft;
				const resultItem = dataLoader.getItem(recipe.result_item_id);

				const materialsHtml = recipe.materials.map(mat => {
					const item = dataLoader.getItem(mat.item_id);
					const has = inventoryManager.hasItem(mat.item_id);
					const qty = has ? inventoryManager.getItemCount(mat.item_id) : 0;
					const color = qty >= mat.quantity ? '#4CAF50' : '#f44336';
					return `<span style="color:${color}">${item?.name || mat.item_id}: ${qty}/${mat.quantity}</span>`;
				}).join(' | ');

				const row = div({
					className: 'craft-item' + (selected ? ' craft-item-selected' : ''),
					onClick: () => { this.selectedIndex = abs; this.updateUI(); },
					onDblClick: () => { this.selectedIndex = abs; this.selectRecipe(); },
				},
					div({},
						span({ style: `font-weight:bold;font-size:16px;color:${canCraft ? '#fff' : '#666'}` }, resultItem?.name || recipe.name),
						span({ style: 'margin-left:15px;font-size:14px;color:#aaa' }, `Time: ${recipe.crafting_time}s | Cost: ${recipe.currency_cost}g`),
						canCraft ? span({ style: 'float:right;color:#4CAF50;font-size:12px;font-weight:bold' }, '[Can Craft]') : span(),
					),
					p({ style: 'font-size:13px;margin-top:4px;' }),
					p({ style: 'font-size:12px;color:#888;margin-top:2px;' },
						recipe.required_job ? `Requires: ${dataLoader.getJob(recipe.required_job)?.name || recipe.required_job} Lv.${recipe.required_job_level}` : '',
						recipe.success_rate < 100 ? ` | Success: ${recipe.success_rate.toFixed(0)}%` : '',
					),
				);

				// Set materials text via innerHTML for colored spans
				const matP = row.querySelector('p:nth-child(2)') as HTMLElement;
				if (matP) matP.innerHTML = materialsHtml;

				this.listEl!.appendChild(row);
			});
		}

		// Action menu
		if (this.actionMenuVisible && this.actionMenuEl) {
			this.actionMenuEl.style.display = 'block';
			this.actionMenuEl.innerHTML = '';
			if (this.selectedRecipe) {
				const resultItem = dataLoader.getItem(this.selectedRecipe.result_item_id);
				this.actionMenuEl.appendChild(p({ style: 'font-weight:bold;font-size:16px;margin-bottom:10px;' }, resultItem?.name || this.selectedRecipe.name));
			}
			this.actionMenuOptions.forEach((opt, i) => {
				this.actionMenuEl!.appendChild(button({
					className: 'craft-action-btn' + (i === this.selectedIndex ? ' craft-action-btn-selected' : ''),
					onClick: () => opt.enabled && opt.action(),
				}, opt.text));
			});
		} else if (this.actionMenuEl) {
			this.actionMenuEl.style.display = 'none';
		}

		// Progress
		if (this.progressEl) {
			this.progressEl.style.display = this.craftingInProgress ? 'block' : 'none';
		}
		if (this.progressBarEl) {
			this.progressBarEl.style.width = `${this.craftingProgress * 100}%`;
		}
	}

	override renderHTML(): HTMLElement {
		this.setupStyles();
		this.listEl = div({ className: 'craft-list' });
		this.actionMenuEl = div({ className: 'craft-action-menu', style: 'display:none' });
		this.progressBarEl = div({ className: 'craft-progress-bar-fill', style: 'width:0%' });
		this.progressEl = div({ className: 'craft-progress-overlay', style: 'display:none' },
			p({ style: 'font-size:18px;font-weight:bold' }, 'Crafting...'),
			div({ className: 'craft-progress-bar-bg' }, this.progressBarEl),
			p({ style: 'color:#aaa' }, '0%'),
		);

		const root = div({ className: 'craft-root' },
			div({ className: 'craft-panel' },
				div({ className: 'craft-header' },
					span({ className: 'craft-title' }, 'Crafting'),
					span({ style: 'color:#aaa;font-size:14px' }, `Category: ${this.currentFilter} (F to cycle)`),
				),
				this.listEl,
				this.actionMenuEl,
				this.progressEl,
				p({ className: 'craft-hint' }, '[↑↓/WS] Navigate | [Enter] Select | [F] Filter | [Esc] Back'),
			),
		);

		this.updateUI();
		return root as HTMLElement;
	}

	override onHTMLMounted(el: HTMLElement): void {
		this.setupInput();
	}

	private setupInput(): void {
		this.cleanupKeyboard();
		const bind = (key: string, fn: () => void) => {
			const handler = (e: KeyboardEvent) => { e.preventDefault(); fn(); };
			this.keyHandlers.set(key, handler);
			keyboard.onKeyDown(key, handler);
		};
		bind('ArrowUp', () => this.navigateUp());
		bind('ArrowDown', () => this.navigateDown());
		bind('KeyW', () => this.navigateUp());
		bind('KeyS', () => this.navigateDown());
		bind('Enter', () => this.selectRecipe());
		bind(' ', () => this.selectRecipe());
		bind('Escape', () => this.onBack());
		bind('KeyF', () => this.cycleFilter());
	}

	private cleanupKeyboard(): void {
		for (const [key, handler] of this.keyHandlers) {
			keyboard.removeKeyDownListener(key, handler);
		}
		this.keyHandlers.clear();
	}

	private navigateUp(): void {
		if (!this._isActive || this.craftingInProgress) return;
		if (this.actionMenuVisible) {
			if (!this.actionMenuOptions.some(o => o.enabled)) return;
			do { this.selectedIndex = (this.selectedIndex - 1 + this.actionMenuOptions.length) % this.actionMenuOptions.length; }
			while (!this.actionMenuOptions[this.selectedIndex]!.enabled);
		} else {
			if (this.filteredRecipes.length === 0) return;
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			if (this.selectedIndex < this.scrollOffset) this.scrollOffset = this.selectedIndex;
		}
		this.updateUI();
	}

	private navigateDown(): void {
		if (!this._isActive || this.craftingInProgress) return;
		if (this.actionMenuVisible) {
			if (!this.actionMenuOptions.some(o => o.enabled)) return;
			do { this.selectedIndex = (this.selectedIndex + 1) % this.actionMenuOptions.length; }
			while (!this.actionMenuOptions[this.selectedIndex]!.enabled);
		} else {
			if (this.filteredRecipes.length === 0) return;
			this.selectedIndex = Math.min(this.filteredRecipes.length - 1, this.selectedIndex + 1);
			if (this.selectedIndex >= this.scrollOffset + this.ITEMS_PER_PAGE) this.scrollOffset = this.selectedIndex - this.ITEMS_PER_PAGE + 1;
		}
		this.updateUI();
	}

	private selectRecipe(): void {
		if (!this._isActive || this.craftingInProgress) return;
		if (this.actionMenuVisible) {
			const opt = this.actionMenuOptions[this.selectedIndex];
			if (opt?.enabled) opt.action();
			return;
		}
		const recipe = this.filteredRecipes[this.selectedIndex];
		if (recipe) this.openCraftMenu(recipe);
	}

	private openCraftMenu(recipe: RecipeData): void {
		this.selectedRecipe = recipe;
		this.actionMenuVisible = true;
		this.selectedIndex = 0;
		const canCraftResult = craftingManager.canCraft(recipe.id);
		this.actionMenuOptions = [
			{ text: 'Craft', action: () => this.onCraft(recipe), enabled: canCraftResult.canCraft },
			{ text: 'Cancel', action: () => this.closeActionMenu(), enabled: true },
		];
		this.updateUI();
	}

	private closeActionMenu(): void {
		this.actionMenuVisible = false;
		this.selectedRecipe = null;
		this.selectedIndex = 0;
		this.actionMenuOptions = [];
		this.updateUI();
	}

	private async onCraft(recipe: RecipeData): Promise<void> {
		this.closeActionMenu();
		this.craftingInProgress = true;
		this.craftingProgress = 0;
		this.updateUI();

		const craftTime = recipe.crafting_time;
		const startTime = Date.now();
		const updateProgress = () => {
			if (!this._isActive) return;
			this.craftingProgress = Math.min(1, (Date.now() - startTime) / craftTime);
			this.updateUI();
			if (this.craftingProgress < 1) {
				this.craftingRAF = requestAnimationFrame(updateProgress);
			} else {
				this.finishCrafting(recipe);
			}
		};
		updateProgress();
	}

	private finishCrafting(recipe: RecipeData): void {
		try {
			craftingManager.startCrafting(recipe.id);
			this.updateFilteredRecipes();
			gameStateManager.saveGame();
		} catch (error) {
			console.error('[CraftingScene] Crafting error:', error);
		} finally {
			this.craftingResultTimer = setTimeout(() => {
				this.craftingInProgress = false;
				this.craftingProgress = 0;
				this.updateUI();
			}, 1000);
		}
	}

	private cycleFilter(): void {
		if (!this._isActive || this.craftingInProgress) return;
		const filters: FilterType[] = ['all', 'weapon', 'armor', 'consumable', 'material'];
		this.currentFilter = filters[(filters.indexOf(this.currentFilter) + 1) % filters.length]!;
		this.updateFilteredRecipes();
		this.selectedIndex = 0;
		this.scrollOffset = 0;
		// Re-render for filter change
		const sm = EnhancedSceneManager.getInstance();
		const overlay = (sm as any).overlayContainer as HTMLDivElement | null;
		if (overlay) { overlay.innerHTML = ''; overlay.appendChild(this.renderHTML()); this.onHTMLMounted(overlay.lastChild as HTMLElement); }
	}

	private updateFilteredRecipes(): void {
		this.filteredRecipes = dataLoader.getAllRecipes().filter(r => this.currentFilter === 'all' || r.category === this.currentFilter);
	}

	private onBack(): void {
		if (!this._isActive || this.craftingInProgress) return;
		if (this.actionMenuVisible) { this.closeActionMenu(); return; }
		const sm = EnhancedSceneManager.getInstance();
		sm.pop({ type: 'fade', duration: 200 });
	}

	override update(deltaTime: number): void {}

	override onEnter(): void {
		super.onEnter();
		this.setupInput();
		this.updateFilteredRecipes();
		console.log('[CraftingScene] Entered');
	}

	override onExit(): void {
		super.onExit();
		this.cleanupKeyboard();
		if (this.craftingRAF !== null) { cancelAnimationFrame(this.craftingRAF); this.craftingRAF = null; }
		if (this.craftingResultTimer !== null) { clearTimeout(this.craftingResultTimer); this.craftingResultTimer = null; }
		this.craftingInProgress = false;
		this.craftingProgress = 0;
		console.log('[CraftingScene] Exited');
	}

	override destroy(): void {
		this.onExit();
	}
}
