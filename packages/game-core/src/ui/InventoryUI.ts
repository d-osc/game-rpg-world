/**
 * Inventory UI
 * HTML/CSS-based inventory window with drag-and-drop
 */

import type { InventoryManager, Item, InventorySlot } from '../inventory/InventoryManager.ts';
import type { EquipmentManager, EquipSlot } from '../inventory/EquipmentManager.ts';

export interface InventoryUIConfig {
	container: HTMLElement;
	inventoryManager: InventoryManager;
	equipmentManager: EquipmentManager;
	onItemUse?: (item: Item) => void;
	onItemDrop?: (item: Item, quantity: number) => void;
}

export class InventoryUI {
	private container: HTMLElement;
	private inventoryManager: InventoryManager;
	private equipmentManager: EquipmentManager;
	private onItemUse?: (item: Item) => void;
	private onItemDrop?: (item: Item, quantity: number) => void;

	private window: HTMLElement | null = null;
	private isVisible: boolean = false;

	// Drag-and-drop state
	private draggedSlot: number | null = null;
	private draggedEquipSlot: EquipSlot | null = null;

	constructor(config: InventoryUIConfig) {
		this.container = config.container;
		this.inventoryManager = config.inventoryManager;
		this.equipmentManager = config.equipmentManager;
		this.onItemUse = config.onItemUse;
		this.onItemDrop = config.onItemDrop;

		this.createUI();
		this.setupEventListeners();
	}

	/**
	 * Create inventory UI
	 */
	private createUI(): void {
		this.window = document.createElement('div');
		this.window.className = 'inventory-window';
		this.window.style.display = 'none';
		this.window.innerHTML = `
			<div class="inventory-header">
				<h2>Inventory</h2>
				<button class="close-btn">&times;</button>
			</div>
			<div class="inventory-content">
				<div class="inventory-left">
					<div class="inventory-stats">
						<div class="stat-item">
							<span class="stat-label">Slots:</span>
							<span class="stat-value" id="slots-used">0</span>/<span id="slots-max">100</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Weight:</span>
							<span class="stat-value" id="weight-used">0</span>/<span id="weight-max">500</span>
						</div>
					</div>
					<div class="inventory-filters">
						<button class="filter-btn active" data-filter="all">All</button>
						<button class="filter-btn" data-filter="weapon">Weapons</button>
						<button class="filter-btn" data-filter="armor">Armor</button>
						<button class="filter-btn" data-filter="consumable">Consumables</button>
						<button class="filter-btn" data-filter="material">Materials</button>
					</div>
					<div class="inventory-sort">
						<label>Sort:</label>
						<select id="sort-select">
							<option value="slot">Slot</option>
							<option value="name">Name</option>
							<option value="type">Type</option>
							<option value="rarity">Rarity</option>
							<option value="value">Value</option>
						</select>
					</div>
					<div class="inventory-grid" id="inventory-grid">
						<!-- Slots will be generated here -->
					</div>
				</div>
				<div class="inventory-right">
					<div class="equipment-panel">
						<h3>Equipment</h3>
						<div class="equipment-slots">
							<div class="equipment-slot" data-slot="weapon">
								<div class="slot-label">Weapon</div>
								<div class="slot-item" data-equip-slot="weapon"></div>
							</div>
							<div class="equipment-slot" data-slot="head">
								<div class="slot-label">Head</div>
								<div class="slot-item" data-equip-slot="head"></div>
							</div>
							<div class="equipment-slot" data-slot="body">
								<div class="slot-label">Body</div>
								<div class="slot-item" data-equip-slot="body"></div>
							</div>
							<div class="equipment-slot" data-slot="legs">
								<div class="slot-label">Legs</div>
								<div class="slot-item" data-equip-slot="legs"></div>
							</div>
							<div class="equipment-slot" data-slot="hands">
								<div class="slot-label">Hands</div>
								<div class="slot-item" data-equip-slot="hands"></div>
							</div>
							<div class="equipment-slot" data-slot="feet">
								<div class="slot-label">Feet</div>
								<div class="slot-item" data-equip-slot="feet"></div>
							</div>
							<div class="equipment-slot" data-slot="accessory1">
								<div class="slot-label">Accessory 1</div>
								<div class="slot-item" data-equip-slot="accessory1"></div>
							</div>
							<div class="equipment-slot" data-slot="accessory2">
								<div class="slot-label">Accessory 2</div>
								<div class="slot-item" data-equip-slot="accessory2"></div>
							</div>
						</div>
						<div class="equipment-stats">
							<h4>Equipment Bonuses</h4>
							<div id="equipment-stats">
								<!-- Stats will be shown here -->
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="item-tooltip" id="item-tooltip" style="display: none;">
				<!-- Tooltip content -->
			</div>
		`;

		this.container.appendChild(this.window);
		this.applyStyles();
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		if (!this.window) return;

		// Close button
		const closeBtn = this.window.querySelector('.close-btn');
		closeBtn?.addEventListener('click', () => this.hide());

		// Filter buttons
		const filterBtns = this.window.querySelectorAll('.filter-btn');
		filterBtns.forEach((btn) => {
			btn.addEventListener('click', (e) => {
				const target = e.target as HTMLButtonElement;
				const filter = target.dataset.filter;

				// Update active state
				filterBtns.forEach((b) => b.classList.remove('active'));
				target.classList.add('active');

				// Apply filter
				this.applyFilter(filter || 'all');
			});
		});

		// Sort select
		const sortSelect = this.window.querySelector('#sort-select') as HTMLSelectElement;
		sortSelect?.addEventListener('change', (e) => {
			const sortBy = (e.target as HTMLSelectElement).value as any;
			this.inventoryManager.sort(sortBy);
			this.render();
		});

		// Inventory manager events
		this.inventoryManager.on('item-added', () => this.render());
		this.inventoryManager.on('item-removed', () => this.render());
		this.inventoryManager.on('item-moved', () => this.render());
		this.inventoryManager.on('inventory-full', () => this.showNotification('Inventory is full!', 'error'));
		this.inventoryManager.on('weight-exceeded', () => this.showNotification('Weight limit exceeded!', 'error'));

		// Equipment manager events
		this.equipmentManager.on('item-equipped', () => this.renderEquipment());
		this.equipmentManager.on('item-unequipped', () => this.renderEquipment());
	}

	/**
	 * Show inventory window
	 */
	show(): void {
		if (!this.window) return;
		this.window.style.display = 'block';
		this.isVisible = true;
		this.render();
		this.renderEquipment();
	}

	/**
	 * Hide inventory window
	 */
	hide(): void {
		if (!this.window) return;
		this.window.style.display = 'none';
		this.isVisible = false;
	}

	/**
	 * Toggle inventory window
	 */
	toggle(): void {
		if (this.isVisible) {
			this.hide();
		} else {
			this.show();
		}
	}

	/**
	 * Render inventory grid
	 */
	private render(): void {
		if (!this.window) return;

		const grid = this.window.querySelector('#inventory-grid');
		if (!grid) return;

		// Update stats
		const stats = this.inventoryManager.getStats();
		const limits = this.inventoryManager.getLimits();

		const slotsUsed = this.window.querySelector('#slots-used');
		const slotsMax = this.window.querySelector('#slots-max');
		const weightUsed = this.window.querySelector('#weight-used');
		const weightMax = this.window.querySelector('#weight-max');

		if (slotsUsed) slotsUsed.textContent = stats.usedSlots.toString();
		if (slotsMax) slotsMax.textContent = limits.maxSlots.toString();
		if (weightUsed) weightUsed.textContent = stats.currentWeight.toFixed(1);
		if (weightMax) weightMax.textContent = limits.maxWeight.toString();

		// Render slots
		const slots = this.inventoryManager.getAllSlots();
		grid.innerHTML = '';

		for (let i = 0; i < limits.maxSlots; i++) {
			const slot = slots.find((s) => s.slotIndex === i);
			const slotEl = this.createSlotElement(i, slot);
			grid.appendChild(slotEl);
		}
	}

	/**
	 * Create inventory slot element
	 */
	private createSlotElement(index: number, slot?: InventorySlot): HTMLElement {
		const slotEl = document.createElement('div');
		slotEl.className = 'inventory-slot';
		slotEl.dataset.slot = index.toString();

		if (slot && slot.item) {
			const item = slot.item;
			slotEl.classList.add('has-item');
			slotEl.classList.add(`rarity-${item.rarity}`);

			slotEl.innerHTML = `
				<div class="item-icon">${this.getItemIcon(item)}</div>
				${slot.quantity > 1 ? `<div class="item-quantity">${slot.quantity}</div>` : ''}
			`;

			// Drag start
			slotEl.draggable = true;
			slotEl.addEventListener('dragstart', (e) => {
				this.draggedSlot = index;
				slotEl.classList.add('dragging');
			});

			slotEl.addEventListener('dragend', () => {
				this.draggedSlot = null;
				slotEl.classList.remove('dragging');
			});

			// Right click for context menu
			slotEl.addEventListener('contextmenu', (e) => {
				e.preventDefault();
				this.showContextMenu(index, item, e.clientX, e.clientY);
			});

			// Hover for tooltip
			slotEl.addEventListener('mouseenter', (e) => {
				this.showTooltip(item, e.clientX, e.clientY);
			});

			slotEl.addEventListener('mouseleave', () => {
				this.hideTooltip();
			});
		}

		// Drop target
		slotEl.addEventListener('dragover', (e) => {
			e.preventDefault();
			slotEl.classList.add('drag-over');
		});

		slotEl.addEventListener('dragleave', () => {
			slotEl.classList.remove('drag-over');
		});

		slotEl.addEventListener('drop', (e) => {
			e.preventDefault();
			slotEl.classList.remove('drag-over');

			if (this.draggedSlot !== null && this.draggedSlot !== index) {
				this.inventoryManager.moveItem(this.draggedSlot, index);
			} else if (this.draggedEquipSlot !== null) {
				// Unequip to inventory
				const equipped = this.equipmentManager.getEquipment(this.draggedEquipSlot);
				if (equipped) {
					this.equipmentManager.unequip(this.draggedEquipSlot);
					// Item is already in inventory
				}
			}
		});

		return slotEl;
	}

	/**
	 * Render equipment panel
	 */
	private renderEquipment(): void {
		if (!this.window) return;

		const equipSlots: EquipSlot[] = ['weapon', 'head', 'body', 'legs', 'hands', 'feet', 'accessory1', 'accessory2'];

		equipSlots.forEach((slot) => {
			const slotEl = this.window?.querySelector(`[data-equip-slot="${slot}"]`);
			if (!slotEl) return;

			const item = this.equipmentManager.getEquipment(slot);

			if (item) {
				slotEl.innerHTML = `
					<div class="item-icon">${this.getItemIcon(item)}</div>
				`;
				slotEl.classList.add('has-item');
				slotEl.classList.add(`rarity-${item.rarity}`);

				// Make draggable
				slotEl.setAttribute('draggable', 'true');
				slotEl.addEventListener('dragstart', () => {
					this.draggedEquipSlot = slot;
				});

				slotEl.addEventListener('dragend', () => {
					this.draggedEquipSlot = null;
				});

				// Tooltip
				slotEl.addEventListener('mouseenter', (e) => {
					this.showTooltip(item, e.clientX, e.clientY);
				});

				slotEl.addEventListener('mouseleave', () => {
					this.hideTooltip();
				});
			} else {
				slotEl.innerHTML = '';
				slotEl.classList.remove('has-item');
				slotEl.removeAttribute('draggable');
			}

			// Drop target (equip from inventory)
			slotEl.addEventListener('dragover', (e) => {
				e.preventDefault();
			});

			slotEl.addEventListener('drop', (e) => {
				e.preventDefault();

				if (this.draggedSlot !== null) {
					const draggedSlot = this.inventoryManager.getSlot(this.draggedSlot);
					if (draggedSlot?.item && draggedSlot.item.equipSlot === slot) {
						this.equipmentManager.equip(draggedSlot.item);
					}
				}
			});
		});

		// Update equipment stats
		this.renderEquipmentStats();
	}

	/**
	 * Render equipment stats
	 */
	private renderEquipmentStats(): void {
		if (!this.window) return;

		const statsEl = this.window.querySelector('#equipment-stats');
		if (!statsEl) return;

		const stats = this.equipmentManager.getTotalStats();

		statsEl.innerHTML = `
			<div class="stat-row">HP: +${stats.hp}</div>
			<div class="stat-row">MP: +${stats.mp}</div>
			<div class="stat-row">ATK: +${stats.atk}</div>
			<div class="stat-row">DEF: +${stats.def}</div>
			<div class="stat-row">SPD: +${stats.spd}</div>
			<div class="stat-row">LUCK: +${stats.luck}</div>
		`;
	}

	/**
	 * Apply filter
	 */
	private applyFilter(filter: string): void {
		if (filter === 'all') {
			this.inventoryManager.clearFilter();
		} else {
			this.inventoryManager.filterByType(filter as any);
		}
		this.render();
	}

	/**
	 * Show context menu
	 */
	private showContextMenu(slotIndex: number, item: Item, x: number, y: number): void {
		const menu = document.createElement('div');
		menu.className = 'context-menu';
		menu.style.left = `${x}px`;
		menu.style.top = `${y}px`;

		const actions: { label: string; action: () => void }[] = [];

		// Use action
		if (item.type === 'consumable') {
			actions.push({
				label: 'Use',
				action: () => {
					this.onItemUse?.(item);
					this.inventoryManager.removeItem(item.id, 1);
				},
			});
		}

		// Equip action
		if (item.equipSlot) {
			actions.push({
				label: 'Equip',
				action: () => {
					this.equipmentManager.equip(item);
				},
			});
		}

		// Drop action
		actions.push({
			label: 'Drop',
			action: () => {
				const slot = this.inventoryManager.getSlot(slotIndex);
				if (slot) {
					this.onItemDrop?.(item, slot.quantity);
					this.inventoryManager.removeItem(item.id, slot.quantity);
				}
			},
		});

		menu.innerHTML = actions.map((a) => `<div class="menu-item">${a.label}</div>`).join('');

		menu.querySelectorAll('.menu-item').forEach((el, i) => {
			el.addEventListener('click', () => {
				actions[i].action();
				menu.remove();
			});
		});

		document.body.appendChild(menu);

		// Close on click outside
		setTimeout(() => {
			document.addEventListener(
				'click',
				() => {
					menu.remove();
				},
				{ once: true },
			);
		}, 0);
	}

	/**
	 * Show item tooltip
	 */
	private showTooltip(item: Item, x: number, y: number): void {
		const tooltip = this.window?.querySelector('#item-tooltip') as HTMLElement;
		if (!tooltip) return;

		tooltip.innerHTML = `
			<div class="tooltip-header rarity-${item.rarity}">
				<strong>${item.name}</strong>
			</div>
			<div class="tooltip-body">
				<div class="tooltip-type">${item.type}</div>
				<div class="tooltip-description">${item.description}</div>
				${item.stats ? this.renderItemStats(item.stats) : ''}
				<div class="tooltip-value">Value: ${item.value} gold</div>
				<div class="tooltip-weight">Weight: ${item.weight} kg</div>
				${item.stackable ? `<div class="tooltip-stack">Max Stack: ${item.maxStack}</div>` : ''}
			</div>
		`;

		tooltip.style.left = `${x + 10}px`;
		tooltip.style.top = `${y + 10}px`;
		tooltip.style.display = 'block';
	}

	/**
	 * Hide tooltip
	 */
	private hideTooltip(): void {
		const tooltip = this.window?.querySelector('#item-tooltip') as HTMLElement;
		if (tooltip) {
			tooltip.style.display = 'none';
		}
	}

	/**
	 * Render item stats in tooltip
	 */
	private renderItemStats(stats: any): string {
		const statLines: string[] = [];
		if (stats.hp) statLines.push(`HP: +${stats.hp}`);
		if (stats.mp) statLines.push(`MP: +${stats.mp}`);
		if (stats.atk) statLines.push(`ATK: +${stats.atk}`);
		if (stats.def) statLines.push(`DEF: +${stats.def}`);
		if (stats.spd) statLines.push(`SPD: +${stats.spd}`);
		if (stats.luck) statLines.push(`LUCK: +${stats.luck}`);

		return statLines.length > 0 ? `<div class="tooltip-stats">${statLines.join('<br>')}</div>` : '';
	}

	/**
	 * Get item icon (placeholder - replace with actual sprites)
	 */
	private getItemIcon(item: Item): string {
		// TODO: Replace with actual item sprites
		const icons: Record<string, string> = {
			weapon: '⚔️',
			armor: '🛡️',
			consumable: '🧪',
			material: '💎',
		};

		return icons[item.type] || '📦';
	}

	/**
	 * Show notification
	 */
	private showNotification(message: string, type: 'info' | 'error' | 'success' = 'info'): void {
		const notif = document.createElement('div');
		notif.className = `notification notification-${type}`;
		notif.textContent = message;

		document.body.appendChild(notif);

		setTimeout(() => {
			notif.remove();
		}, 3000);
	}

	/**
	 * Apply CSS styles
	 */
	private applyStyles(): void {
		const style = document.createElement('style');
		style.textContent = `
			.inventory-window {
				position: fixed;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				width: 900px;
				height: 600px;
				background: rgba(20, 20, 30, 0.95);
				border: 2px solid #444;
				border-radius: 8px;
				color: white;
				font-family: Arial, sans-serif;
				z-index: 1000;
			}

			.inventory-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 10px 20px;
				background: rgba(0, 0, 0, 0.3);
				border-bottom: 2px solid #444;
			}

			.close-btn {
				background: none;
				border: none;
				color: white;
				font-size: 24px;
				cursor: pointer;
			}

			.inventory-content {
				display: flex;
				height: calc(100% - 60px);
			}

			.inventory-left {
				flex: 1;
				padding: 20px;
				overflow-y: auto;
			}

			.inventory-stats {
				display: flex;
				gap: 20px;
				margin-bottom: 15px;
			}

			.stat-item {
				font-size: 14px;
			}

			.stat-label {
				color: #aaa;
			}

			.stat-value {
				color: #4CAF50;
				font-weight: bold;
			}

			.inventory-filters {
				display: flex;
				gap: 5px;
				margin-bottom: 10px;
			}

			.filter-btn {
				padding: 5px 10px;
				background: rgba(255, 255, 255, 0.1);
				border: 1px solid #444;
				color: white;
				cursor: pointer;
				border-radius: 4px;
			}

			.filter-btn.active {
				background: rgba(76, 175, 80, 0.3);
				border-color: #4CAF50;
			}

			.inventory-sort {
				margin-bottom: 15px;
			}

			.inventory-sort select {
				background: rgba(255, 255, 255, 0.1);
				border: 1px solid #444;
				color: white;
				padding: 5px;
				border-radius: 4px;
			}

			.inventory-grid {
				display: grid;
				grid-template-columns: repeat(10, 50px);
				gap: 5px;
			}

			.inventory-slot {
				width: 50px;
				height: 50px;
				background: rgba(255, 255, 255, 0.05);
				border: 2px solid #333;
				border-radius: 4px;
				position: relative;
				cursor: pointer;
			}

			.inventory-slot.has-item {
				background: rgba(255, 255, 255, 0.1);
			}

			.inventory-slot.dragging {
				opacity: 0.5;
			}

			.inventory-slot.drag-over {
				border-color: #4CAF50;
				background: rgba(76, 175, 80, 0.2);
			}

			.rarity-common { border-color: #9E9E9E; }
			.rarity-uncommon { border-color: #4CAF50; }
			.rarity-rare { border-color: #2196F3; }
			.rarity-epic { border-color: #9C27B0; }
			.rarity-legendary { border-color: #FF9800; }

			.item-icon {
				font-size: 32px;
				text-align: center;
				line-height: 46px;
			}

			.item-quantity {
				position: absolute;
				bottom: 2px;
				right: 2px;
				background: rgba(0, 0, 0, 0.7);
				padding: 2px 4px;
				font-size: 10px;
				border-radius: 2px;
			}

			.inventory-right {
				width: 300px;
				padding: 20px;
				background: rgba(0, 0, 0, 0.2);
				border-left: 2px solid #444;
				overflow-y: auto;
			}

			.equipment-slots {
				display: grid;
				gap: 10px;
			}

			.equipment-slot {
				display: flex;
				align-items: center;
				gap: 10px;
			}

			.slot-label {
				width: 100px;
				font-size: 12px;
				color: #aaa;
			}

			.slot-item {
				width: 50px;
				height: 50px;
				background: rgba(255, 255, 255, 0.05);
				border: 2px solid #333;
				border-radius: 4px;
				position: relative;
			}

			.slot-item.has-item {
				background: rgba(255, 255, 255, 0.1);
			}

			.equipment-stats {
				margin-top: 20px;
				padding-top: 20px;
				border-top: 1px solid #444;
			}

			.stat-row {
				padding: 5px 0;
				color: #4CAF50;
			}

			.item-tooltip {
				position: fixed;
				background: rgba(0, 0, 0, 0.95);
				border: 2px solid #444;
				border-radius: 4px;
				padding: 10px;
				max-width: 250px;
				z-index: 10000;
				pointer-events: none;
			}

			.tooltip-header {
				padding: 5px;
				margin: -10px -10px 10px -10px;
				border-radius: 4px 4px 0 0;
			}

			.tooltip-body {
				font-size: 12px;
			}

			.tooltip-type {
				color: #aaa;
				font-style: italic;
				margin-bottom: 5px;
			}

			.tooltip-description {
				margin-bottom: 10px;
			}

			.tooltip-stats {
				color: #4CAF50;
				margin: 5px 0;
			}

			.context-menu {
				position: fixed;
				background: rgba(0, 0, 0, 0.95);
				border: 1px solid #444;
				border-radius: 4px;
				padding: 5px 0;
				z-index: 10000;
			}

			.menu-item {
				padding: 8px 20px;
				cursor: pointer;
			}

			.menu-item:hover {
				background: rgba(76, 175, 80, 0.3);
			}

			.notification {
				position: fixed;
				top: 20px;
				right: 20px;
				padding: 15px 20px;
				border-radius: 4px;
				color: white;
				z-index: 10000;
				animation: slideIn 0.3s ease;
			}

			.notification-error {
				background: #f44336;
			}

			.notification-success {
				background: #4CAF50;
			}

			.notification-info {
				background: #2196F3;
			}

			@keyframes slideIn {
				from {
					transform: translateX(400px);
					opacity: 0;
				}
				to {
					transform: translateX(0);
					opacity: 1;
				}
			}
		`;

		document.head.appendChild(style);
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.window?.remove();
	}
}
