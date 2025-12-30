/**
 * CraftingManager
 * Manages crafting recipes, requirements, and crafting process
 */

import { EventEmitter } from '../utils/EventEmitter.ts';

export interface CraftingMaterial {
	item_id: string;
	quantity: number;
}

export interface CraftingRecipe {
	id: string;
	name: string;
	category: 'weapon' | 'armor' | 'consumable' | 'material' | 'accessory';
	result_item_id: string;
	result_quantity: number;
	required_job: string | null;
	required_job_level: number;
	crafting_time: number;
	materials: CraftingMaterial[];
	currency_cost: number;
	experience_gained: number;
	success_rate: number;
	skill_required: string | null;
}

export interface CraftingProgress {
	recipe_id: string;
	started_at: number;
	duration: number;
	progress: number;
}

export interface CraftingResult {
	success: boolean;
	result_item_id?: string;
	result_quantity?: number;
	experience_gained?: number;
	error?: string;
}

export interface CraftingManagerEvents {
	'craft-started': (recipeId: string, duration: number) => void;
	'craft-progress': (recipeId: string, progress: number) => void;
	'craft-completed': (result: CraftingResult) => void;
	'craft-failed': (recipeId: string, reason: string) => void;
}

export class CraftingManager extends EventEmitter<CraftingManagerEvents> {
	private recipes: Map<string, CraftingRecipe> = new Map();
	private currentCraft: CraftingProgress | null = null;
	private craftingTimer: number | null = null;

	// Callback to check inventory
	private checkInventoryCallback: ((itemId: string, quantity: number) => boolean) | null = null;
	private consumeItemsCallback: ((items: CraftingMaterial[]) => boolean) | null = null;
	private addItemCallback: ((itemId: string, quantity: number) => boolean) | null = null;
	private checkCurrencyCallback: ((amount: number) => boolean) | null = null;
	private consumeCurrencyCallback: ((amount: number) => boolean) | null = null;
	private checkJobCallback: ((jobId: string, level: number) => boolean) | null = null;
	private hasSkillCallback: ((skillId: string) => boolean) | null = null;
	private addExperienceCallback: ((jobId: string, exp: number) => void) | null = null;

	constructor() {
		super();
	}

	/**
	 * Set inventory callbacks
	 */
	setInventoryCallbacks(
		checkInventory: (itemId: string, quantity: number) => boolean,
		consumeItems: (items: CraftingMaterial[]) => boolean,
		addItem: (itemId: string, quantity: number) => boolean,
	): void {
		this.checkInventoryCallback = checkInventory;
		this.consumeItemsCallback = consumeItems;
		this.addItemCallback = addItem;
	}

	/**
	 * Set currency callbacks
	 */
	setCurrencyCallbacks(
		checkCurrency: (amount: number) => boolean,
		consumeCurrency: (amount: number) => boolean,
	): void {
		this.checkCurrencyCallback = checkCurrency;
		this.consumeCurrencyCallback = consumeCurrency;
	}

	/**
	 * Set job callbacks
	 */
	setJobCallbacks(
		checkJob: (jobId: string, level: number) => boolean,
		hasSkill: (skillId: string) => boolean,
		addExperience: (jobId: string, exp: number) => void,
	): void {
		this.checkJobCallback = checkJob;
		this.hasSkillCallback = hasSkill;
		this.addExperienceCallback = addExperience;
	}

	/**
	 * Load crafting recipes
	 */
	loadRecipes(recipes: CraftingRecipe[]): void {
		for (const recipe of recipes) {
			this.recipes.set(recipe.id, recipe);
		}

		console.log(`[CraftingManager] Loaded ${recipes.length} recipes`);
	}

	/**
	 * Get all recipes
	 */
	getAllRecipes(): CraftingRecipe[] {
		return Array.from(this.recipes.values());
	}

	/**
	 * Get recipe by ID
	 */
	getRecipe(recipeId: string): CraftingRecipe | undefined {
		return this.recipes.get(recipeId);
	}

	/**
	 * Get recipes by category
	 */
	getRecipesByCategory(category: string): CraftingRecipe[] {
		return Array.from(this.recipes.values()).filter((r) => r.category === category);
	}

	/**
	 * Get craftable recipes (player has requirements)
	 */
	getCraftableRecipes(): CraftingRecipe[] {
		return Array.from(this.recipes.values()).filter((recipe) => {
			return this.canCraft(recipe.id).canCraft;
		});
	}

	/**
	 * Check if player can craft recipe
	 */
	canCraft(recipeId: string): {
		canCraft: boolean;
		reason?: string;
	} {
		const recipe = this.recipes.get(recipeId);
		if (!recipe) {
			return { canCraft: false, reason: 'Recipe not found' };
		}

		// Check if already crafting
		if (this.currentCraft) {
			return { canCraft: false, reason: 'Already crafting' };
		}

		// Check job requirement
		if (recipe.required_job && recipe.required_job_level > 0) {
			if (!this.checkJobCallback || !this.checkJobCallback(recipe.required_job, recipe.required_job_level)) {
				return {
					canCraft: false,
					reason: `Requires ${recipe.required_job} level ${recipe.required_job_level}`,
				};
			}
		}

		// Check skill requirement
		if (recipe.skill_required) {
			if (!this.hasSkillCallback || !this.hasSkillCallback(recipe.skill_required)) {
				return { canCraft: false, reason: `Requires skill: ${recipe.skill_required}` };
			}
		}

		// Check materials
		for (const material of recipe.materials) {
			if (!this.checkInventoryCallback || !this.checkInventoryCallback(material.item_id, material.quantity)) {
				return {
					canCraft: false,
					reason: `Missing materials: ${material.item_id} x${material.quantity}`,
				};
			}
		}

		// Check currency
		if (recipe.currency_cost > 0) {
			if (!this.checkCurrencyCallback || !this.checkCurrencyCallback(recipe.currency_cost)) {
				return { canCraft: false, reason: `Insufficient currency: ${recipe.currency_cost} required` };
			}
		}

		return { canCraft: true };
	}

	/**
	 * Start crafting
	 */
	startCrafting(recipeId: string): { success: boolean; error?: string } {
		// Check if can craft
		const check = this.canCraft(recipeId);
		if (!check.canCraft) {
			return { success: false, error: check.reason };
		}

		const recipe = this.recipes.get(recipeId);
		if (!recipe) {
			return { success: false, error: 'Recipe not found' };
		}

		// Consume materials
		if (this.consumeItemsCallback && !this.consumeItemsCallback(recipe.materials)) {
			return { success: false, error: 'Failed to consume materials' };
		}

		// Consume currency
		if (recipe.currency_cost > 0) {
			if (this.consumeCurrencyCallback && !this.consumeCurrencyCallback(recipe.currency_cost)) {
				return { success: false, error: 'Failed to consume currency' };
			}
		}

		// Start crafting
		this.currentCraft = {
			recipe_id: recipeId,
			started_at: Date.now(),
			duration: recipe.crafting_time,
			progress: 0,
		};

		// Emit event
		this.emit('craft-started', recipeId, recipe.crafting_time);

		// Start progress timer
		this.startCraftingTimer();

		return { success: true };
	}

	/**
	 * Start crafting timer
	 */
	private startCraftingTimer(): void {
		if (!this.currentCraft) return;

		const updateInterval = 100; // Update every 100ms

		this.craftingTimer = window.setInterval(() => {
			if (!this.currentCraft) {
				this.stopCraftingTimer();
				return;
			}

			const elapsed = Date.now() - this.currentCraft.started_at;
			this.currentCraft.progress = Math.min(elapsed / this.currentCraft.duration, 1);

			// Emit progress
			this.emit('craft-progress', this.currentCraft.recipe_id, this.currentCraft.progress);

			// Check if completed
			if (this.currentCraft.progress >= 1) {
				this.completeCrafting();
			}
		}, updateInterval);
	}

	/**
	 * Stop crafting timer
	 */
	private stopCraftingTimer(): void {
		if (this.craftingTimer !== null) {
			clearInterval(this.craftingTimer);
			this.craftingTimer = null;
		}
	}

	/**
	 * Complete crafting
	 */
	private completeCrafting(): void {
		if (!this.currentCraft) return;

		const recipe = this.recipes.get(this.currentCraft.recipe_id);
		if (!recipe) {
			this.stopCraftingTimer();
			this.currentCraft = null;
			return;
		}

		// Check success (based on success rate)
		const roll = Math.random() * 100;
		const success = roll <= recipe.success_rate;

		if (success) {
			// Add result item
			if (this.addItemCallback) {
				this.addItemCallback(recipe.result_item_id, recipe.result_quantity);
			}

			// Add experience
			if (recipe.required_job && this.addExperienceCallback) {
				this.addExperienceCallback(recipe.required_job, recipe.experience_gained);
			}

			// Emit success
			this.emit('craft-completed', {
				success: true,
				result_item_id: recipe.result_item_id,
				result_quantity: recipe.result_quantity,
				experience_gained: recipe.experience_gained,
			});
		} else {
			// Crafting failed
			this.emit('craft-failed', this.currentCraft.recipe_id, 'Crafting failed');
			this.emit('craft-completed', {
				success: false,
				error: 'Crafting failed',
			});
		}

		// Reset
		this.stopCraftingTimer();
		this.currentCraft = null;
	}

	/**
	 * Cancel crafting
	 */
	cancelCrafting(): void {
		if (!this.currentCraft) return;

		const recipeId = this.currentCraft.recipe_id;

		this.stopCraftingTimer();
		this.currentCraft = null;

		this.emit('craft-failed', recipeId, 'Cancelled by player');
	}

	/**
	 * Get current crafting progress
	 */
	getCurrentCraft(): CraftingProgress | null {
		return this.currentCraft;
	}

	/**
	 * Check if crafting
	 */
	isCrafting(): boolean {
		return this.currentCraft !== null;
	}

	/**
	 * Get recipes that result in specific item
	 */
	getRecipesForItem(itemId: string): CraftingRecipe[] {
		return Array.from(this.recipes.values()).filter((r) => r.result_item_id === itemId);
	}

	/**
	 * Get recipes that use specific material
	 */
	getRecipesUsingMaterial(materialId: string): CraftingRecipe[] {
		return Array.from(this.recipes.values()).filter((r) =>
			r.materials.some((m) => m.item_id === materialId),
		);
	}

	/**
	 * Get total materials needed for recipe
	 */
	getTotalMaterialsNeeded(recipeId: string, quantity: number): CraftingMaterial[] {
		const recipe = this.recipes.get(recipeId);
		if (!recipe) return [];

		return recipe.materials.map((m) => ({
			item_id: m.item_id,
			quantity: m.quantity * quantity,
		}));
	}

	/**
	 * Get total cost for recipe
	 */
	getTotalCost(recipeId: string, quantity: number): number {
		const recipe = this.recipes.get(recipeId);
		if (!recipe) return 0;

		return recipe.currency_cost * quantity;
	}

	/**
	 * Export for save system
	 */
	export(): {
		currentCraft: CraftingProgress | null;
	} {
		return {
			currentCraft: this.currentCraft,
		};
	}

	/**
	 * Import from save system
	 */
	import(data: { currentCraft: CraftingProgress | null }): void {
		if (data.currentCraft) {
			this.currentCraft = data.currentCraft;
			this.startCraftingTimer();
		}
	}

	/**
	 * Clear all data
	 */
	clear(): void {
		this.stopCraftingTimer();
		this.currentCraft = null;
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.clear();
		this.recipes.clear();
	}
}
