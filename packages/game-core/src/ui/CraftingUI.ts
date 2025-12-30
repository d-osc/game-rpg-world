/**
 * CraftingUI
 * User interface for crafting system
 */

import type { CraftingManager, CraftingRecipe, CraftingMaterial } from '../economy/CraftingManager.ts';

export class CraftingUI {
	private container: HTMLElement | null = null;
	private craftingManager: CraftingManager;
	private isVisible: boolean = false;

	private selectedRecipe: CraftingRecipe | null = null;
	private filterCategory: string = 'all';

	constructor(craftingManager: CraftingManager) {
		this.craftingManager = craftingManager;
		this.createUI();
		this.attachEventListeners();
	}

	/**
	 * Create UI elements
	 */
	private createUI(): void {
		this.container = document.createElement('div');
		this.container.id = 'crafting-ui';
		this.container.style.cssText = `
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 700px;
			max-height: 600px;
			background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
			border: 2px solid #4ecca3;
			border-radius: 10px;
			padding: 20px;
			display: none;
			z-index: 1000;
			font-family: Arial, sans-serif;
			color: #fff;
			box-shadow: 0 10px 40px rgba(0,0,0,0.5);
		`;

		this.container.innerHTML = `
			<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
				<h2 style="margin: 0; color: #4ecca3;">Crafting</h2>
				<button id="crafting-close-btn" style="
					background: #e74c3c;
					color: white;
					border: none;
					padding: 8px 15px;
					border-radius: 5px;
					cursor: pointer;
					font-size: 16px;
				">✕</button>
			</div>

			<!-- Category Filter -->
			<div id="crafting-category-filter" style="margin-bottom: 15px;">
				<button class="category-btn" data-category="all">All</button>
				<button class="category-btn" data-category="weapon">Weapons</button>
				<button class="category-btn" data-category="armor">Armor</button>
				<button class="category-btn" data-category="consumable">Consumables</button>
				<button class="category-btn" data-category="material">Materials</button>
			</div>

			<!-- Main Content -->
			<div style="display: flex; gap: 20px; height: 450px;">
				<!-- Recipe List -->
				<div style="flex: 1; overflow-y: auto; border: 1px solid #4ecca3; border-radius: 5px; padding: 10px;">
					<h3 style="margin-top: 0; color: #4ecca3; font-size: 16px;">Recipes</h3>
					<div id="crafting-recipe-list"></div>
				</div>

				<!-- Recipe Details -->
				<div style="flex: 1; border: 1px solid #4ecca3; border-radius: 5px; padding: 15px; overflow-y: auto;">
					<div id="crafting-recipe-details">
						<p style="color: #888; text-align: center; margin-top: 100px;">Select a recipe to view details</p>
					</div>
				</div>
			</div>

			<!-- Crafting Progress -->
			<div id="crafting-progress" style="display: none; margin-top: 15px;">
				<div style="background: #0f3460; border-radius: 10px; height: 30px; position: relative; overflow: hidden;">
					<div id="crafting-progress-bar" style="
						background: linear-gradient(90deg, #4ecca3 0%, #2ecc71 100%);
						height: 100%;
						width: 0%;
						transition: width 0.1s linear;
					"></div>
					<span id="crafting-progress-text" style="
						position: absolute;
						top: 50%;
						left: 50%;
						transform: translate(-50%, -50%);
						font-weight: bold;
						text-shadow: 0 0 5px rgba(0,0,0,0.5);
					">0%</span>
				</div>
			</div>
		`;

		// Add category button styles
		const style = document.createElement('style');
		style.textContent = `
			.category-btn {
				background: #0f3460;
				color: #fff;
				border: 1px solid #4ecca3;
				padding: 8px 15px;
				margin-right: 5px;
				border-radius: 5px;
				cursor: pointer;
				transition: all 0.2s;
			}
			.category-btn:hover {
				background: #4ecca3;
				color: #1a1a2e;
			}
			.category-btn.active {
				background: #4ecca3;
				color: #1a1a2e;
			}
			.recipe-item {
				background: #0f3460;
				padding: 10px;
				margin-bottom: 8px;
				border-radius: 5px;
				cursor: pointer;
				border: 2px solid transparent;
				transition: all 0.2s;
			}
			.recipe-item:hover {
				border-color: #4ecca3;
				transform: translateX(5px);
			}
			.recipe-item.selected {
				border-color: #4ecca3;
				background: #16213e;
			}
			.recipe-item.disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
			.material-item {
				display: flex;
				justify-content: space-between;
				padding: 5px;
				border-bottom: 1px solid #0f3460;
			}
			.material-item.missing {
				color: #e74c3c;
			}
			.material-item.available {
				color: #4ecca3;
			}
		`;
		document.head.appendChild(style);

		document.body.appendChild(this.container);
	}

	/**
	 * Attach event listeners
	 */
	private attachEventListeners(): void {
		// Close button
		const closeBtn = this.container?.querySelector('#crafting-close-btn');
		closeBtn?.addEventListener('click', () => this.hide());

		// Category filter
		const categoryBtns = this.container?.querySelectorAll('.category-btn');
		categoryBtns?.forEach((btn) => {
			btn.addEventListener('click', (e) => {
				const category = (e.target as HTMLElement).dataset.category || 'all';
				this.filterCategory = category;
				this.updateCategoryButtons();
				this.renderRecipeList();
			});
		});

		// Crafting manager events
		this.craftingManager.on('craft-started', (recipeId, duration) => {
			this.showProgress();
		});

		this.craftingManager.on('craft-progress', (recipeId, progress) => {
			this.updateProgress(progress);
		});

		this.craftingManager.on('craft-completed', (result) => {
			this.hideProgress();
			if (result.success) {
				this.showNotification(`Crafting successful! Created ${result.result_quantity}x ${result.result_item_id}`, 'success');
			} else {
				this.showNotification(`Crafting failed: ${result.error}`, 'error');
			}
			this.renderRecipeDetails();
		});

		this.craftingManager.on('craft-failed', (recipeId, reason) => {
			this.hideProgress();
			this.showNotification(`Crafting failed: ${reason}`, 'error');
		});
	}

	/**
	 * Show UI
	 */
	show(): void {
		if (this.container) {
			this.container.style.display = 'block';
			this.isVisible = true;
			this.renderRecipeList();
			this.updateCategoryButtons();
		}
	}

	/**
	 * Hide UI
	 */
	hide(): void {
		if (this.container) {
			this.container.style.display = 'none';
			this.isVisible = false;
		}
	}

	/**
	 * Toggle UI
	 */
	toggle(): void {
		if (this.isVisible) {
			this.hide();
		} else {
			this.show();
		}
	}

	/**
	 * Update category buttons
	 */
	private updateCategoryButtons(): void {
		const buttons = this.container?.querySelectorAll('.category-btn');
		buttons?.forEach((btn) => {
			const category = (btn as HTMLElement).dataset.category;
			if (category === this.filterCategory) {
				btn.classList.add('active');
			} else {
				btn.classList.remove('active');
			}
		});
	}

	/**
	 * Render recipe list
	 */
	private renderRecipeList(): void {
		const listContainer = this.container?.querySelector('#crafting-recipe-list');
		if (!listContainer) return;

		const recipes = this.filterCategory === 'all'
			? this.craftingManager.getAllRecipes()
			: this.craftingManager.getRecipesByCategory(this.filterCategory);

		if (recipes.length === 0) {
			listContainer.innerHTML = '<p style="color: #888; text-align: center;">No recipes found</p>';
			return;
		}

		listContainer.innerHTML = recipes
			.map((recipe) => {
				const canCraft = this.craftingManager.canCraft(recipe.id);
				const isSelected = this.selectedRecipe?.id === recipe.id;

				return `
					<div class="recipe-item ${isSelected ? 'selected' : ''} ${!canCraft.canCraft ? 'disabled' : ''}"
						data-recipe-id="${recipe.id}">
						<div style="font-weight: bold; color: ${this.getRarityColor(recipe.category)};">${recipe.name}</div>
						<div style="font-size: 12px; color: #888;">${recipe.category}</div>
						${!canCraft.canCraft ? `<div style="font-size: 11px; color: #e74c3c;">${canCraft.reason}</div>` : ''}
					</div>
				`;
			})
			.join('');

		// Add click listeners
		listContainer.querySelectorAll('.recipe-item').forEach((item) => {
			item.addEventListener('click', (e) => {
				const recipeId = (e.currentTarget as HTMLElement).dataset.recipeId;
				if (recipeId) {
					this.selectRecipe(recipeId);
				}
			});
		});
	}

	/**
	 * Select recipe
	 */
	private selectRecipe(recipeId: string): void {
		const recipe = this.craftingManager.getRecipe(recipeId);
		if (recipe) {
			this.selectedRecipe = recipe;
			this.renderRecipeDetails();
			this.renderRecipeList(); // Update selection highlight
		}
	}

	/**
	 * Render recipe details
	 */
	private renderRecipeDetails(): void {
		const detailsContainer = this.container?.querySelector('#crafting-recipe-details');
		if (!detailsContainer || !this.selectedRecipe) return;

		const recipe = this.selectedRecipe;
		const canCraft = this.craftingManager.canCraft(recipe.id);

		detailsContainer.innerHTML = `
			<h3 style="margin-top: 0; color: ${this.getRarityColor(recipe.category)};">${recipe.name}</h3>

			<div style="margin-bottom: 15px;">
				<strong>Category:</strong> ${recipe.category}<br>
				<strong>Crafting Time:</strong> ${(recipe.crafting_time / 1000).toFixed(1)}s<br>
				<strong>Success Rate:</strong> ${recipe.success_rate}%<br>
				${recipe.required_job ? `<strong>Required Job:</strong> ${recipe.required_job} Lv${recipe.required_job_level}<br>` : ''}
				${recipe.skill_required ? `<strong>Required Skill:</strong> ${recipe.skill_required}<br>` : ''}
			</div>

			<div style="margin-bottom: 15px;">
				<strong>Materials Required:</strong>
				<div style="margin-top: 5px;">
					${this.renderMaterials(recipe.materials)}
				</div>
			</div>

			<div style="margin-bottom: 15px;">
				<strong>Cost:</strong> ${recipe.currency_cost} gold
			</div>

			<div style="margin-bottom: 15px;">
				<strong>Result:</strong> ${recipe.result_quantity}x ${recipe.result_item_id}<br>
				<strong>Experience:</strong> +${recipe.experience_gained} EXP
			</div>

			<button id="craft-btn" style="
				width: 100%;
				padding: 12px;
				background: ${canCraft.canCraft ? '#4ecca3' : '#555'};
				color: ${canCraft.canCraft ? '#1a1a2e' : '#888'};
				border: none;
				border-radius: 5px;
				font-size: 16px;
				font-weight: bold;
				cursor: ${canCraft.canCraft ? 'pointer' : 'not-allowed'};
			" ${!canCraft.canCraft ? 'disabled' : ''}>
				${canCraft.canCraft ? 'Craft' : canCraft.reason}
			</button>
		`;

		// Craft button
		const craftBtn = detailsContainer.querySelector('#craft-btn');
		craftBtn?.addEventListener('click', () => {
			this.startCrafting();
		});
	}

	/**
	 * Render materials
	 */
	private renderMaterials(materials: CraftingMaterial[]): string {
		return materials
			.map((material) => {
				// This would check actual inventory in real implementation
				const hasEnough = true; // Placeholder
				return `
					<div class="material-item ${hasEnough ? 'available' : 'missing'}">
						<span>${material.item_id}</span>
						<span>${material.quantity}</span>
					</div>
				`;
			})
			.join('');
	}

	/**
	 * Start crafting
	 */
	private startCrafting(): void {
		if (!this.selectedRecipe) return;

		const result = this.craftingManager.startCrafting(this.selectedRecipe.id);
		if (!result.success) {
			this.showNotification(result.error || 'Failed to start crafting', 'error');
		}
	}

	/**
	 * Show progress bar
	 */
	private showProgress(): void {
		const progressDiv = this.container?.querySelector('#crafting-progress') as HTMLElement;
		if (progressDiv) {
			progressDiv.style.display = 'block';
		}
	}

	/**
	 * Hide progress bar
	 */
	private hideProgress(): void {
		const progressDiv = this.container?.querySelector('#crafting-progress') as HTMLElement;
		if (progressDiv) {
			progressDiv.style.display = 'none';
		}
		this.updateProgress(0);
	}

	/**
	 * Update progress bar
	 */
	private updateProgress(progress: number): void {
		const progressBar = this.container?.querySelector('#crafting-progress-bar') as HTMLElement;
		const progressText = this.container?.querySelector('#crafting-progress-text') as HTMLElement;

		if (progressBar && progressText) {
			const percentage = Math.round(progress * 100);
			progressBar.style.width = `${percentage}%`;
			progressText.textContent = `${percentage}%`;
		}
	}

	/**
	 * Get rarity color
	 */
	private getRarityColor(category: string): string {
		const colors: Record<string, string> = {
			weapon: '#e74c3c',
			armor: '#3498db',
			consumable: '#2ecc71',
			material: '#95a5a6',
			accessory: '#9b59b6',
		};
		return colors[category] || '#fff';
	}

	/**
	 * Show notification
	 */
	private showNotification(message: string, type: 'success' | 'error'): void {
		const notification = document.createElement('div');
		notification.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			background: ${type === 'success' ? '#2ecc71' : '#e74c3c'};
			color: white;
			padding: 15px 20px;
			border-radius: 5px;
			z-index: 10000;
			animation: slideIn 0.3s ease-out;
		`;
		notification.textContent = message;

		document.body.appendChild(notification);

		setTimeout(() => {
			notification.remove();
		}, 3000);
	}

	/**
	 * Destroy UI
	 */
	destroy(): void {
		this.container?.remove();
	}
}
