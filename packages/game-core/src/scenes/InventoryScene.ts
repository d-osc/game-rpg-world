/**
 * Inventory Scene (HTML Overlay)
 * Manage inventory, equipment, and items
 */

import { div, p, button, span } from './dom';
import { CreateStyle } from 'elit/style';
import { Scene, SceneType, keyboard, EnhancedSceneManager } from '@rpg/game-engine';
import { inventoryManager } from '../inventory/InventoryManager';
import { equipmentManager } from '../inventory/EquipmentManager';
import { gameStateManager } from '../state/GameStateManager';
import { dataLoader, type ItemData } from '../data/DataLoader';

interface MenuOption {
	text: string;
	action: () => void;
	enabled: boolean;
}

type ViewMode = 'inventory' | 'equipment';
type FilterType = 'all' | 'weapon' | 'armor' | 'consumable' | 'material';

const RARITY_COLORS: Record<string, string> = {
	common: '#9E9E9E', uncommon: '#4CAF50', rare: '#2196F3', epic: '#9C27B0', legendary: '#FF9800',
};

export class InventoryScene extends Scene {
	private viewMode: ViewMode = 'inventory';
	private currentFilter: FilterType = 'all';
	private selectedIndex: number = 0;
	private scrollOffset: number = 0;

	private filteredItems: { slotIndex: number; item: ItemData; quantity: number }[] = [];
	private equippedItems: Map<string, ItemData> = new Map();

	private readonly ITEMS_PER_PAGE = 10;
	private actionMenuVisible: boolean = false;
	private actionMenuOptions: MenuOption[] = [];

	private listEl: HTMLElement | null = null;
	private infoEl: HTMLElement | null = null;
	private actionMenuEl: HTMLElement | null = null;
	private keyHandlers: Map<string, (e: KeyboardEvent) => void> = new Map();

	constructor() {
		super('Inventory');
		this.sceneType = SceneType.HTML_OVERLAY;
	}

	override async load(): Promise<void> {
		console.log('[InventoryScene] Loading...');
		await dataLoader.loadAll();
		this.updateFilteredItems();
		this.updateEquippedItems();
		console.log('[InventoryScene] Loaded');
	}

	private setupStyles(): void {
		const css = new CreateStyle();
		css.addClass('inv-root', {
			width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
			background: 'rgba(26,26,46,0.95)', color: '#fff', fontFamily: 'Arial, sans-serif',
			position: 'absolute', inset: '0',
		});
		css.addClass('inv-panel', {
			width: '700px', maxHeight: '90vh', background: 'rgba(0,0,0,0.8)',
			border: '2px solid #6C5CE7', borderRadius: '12px', padding: '20px',
		});
		css.addClass('inv-header', {
			display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px',
		});
		css.addClass('inv-title', { fontSize: '24px', fontWeight: 'bold' });
		css.addClass('inv-filter', { fontSize: '14px', color: '#aaa' });
		css.addClass('inv-list', {
			maxHeight: '400px', overflowY: 'auto', borderRadius: '8px',
			background: 'rgba(0,0,0,0.3)', padding: '5px',
		});
		css.addClass('inv-item', {
			display: 'flex', justifyContent: 'space-between', alignItems: 'center',
			padding: '8px 15px', margin: '3px 0', borderRadius: '6px', transition: 'background 0.15s',
		});
		css.addClass('inv-item-selected', { background: 'rgba(255,215,0,0.3)' });
		css.addClass('inv-item-name', { fontWeight: 'bold', fontSize: '16px' });
		css.addClass('inv-item-info', { color: '#aaa', fontSize: '14px' });
		css.addClass('inv-action-menu', {
			position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
			background: 'rgba(0,0,0,0.9)', border: '2px solid #6C5CE7', borderRadius: '8px',
			padding: '15px', zIndex: '10', minWidth: '200px',
		});
		css.addClass('inv-action-btn', {
			display: 'block', width: '100%', padding: '10px', margin: '5px 0',
			background: '#16213e', color: '#eee', border: '1px solid #333',
			fontSize: '16px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left',
		});
		css.addClass('inv-action-btn-selected', { background: '#533483', border: '2px solid #FFD700' });
		css.addClass('inv-action-btn-disabled', { color: '#666', cursor: 'not-allowed' });
		css.addClass('inv-hint', { color: '#888', fontSize: '14px', marginTop: '15px', textAlign: 'center' });
		css.inject();
	}

	private updateUI(): void {
		if (!this.listEl) return;
		this.listEl.innerHTML = '';

		if (this.viewMode === 'inventory') {
			const visible = this.filteredItems.slice(this.scrollOffset, this.scrollOffset + this.ITEMS_PER_PAGE);
			if (visible.length === 0) {
				this.listEl.appendChild(p({ style: 'color:#888;font-style:italic;padding:20px;' }, 'No items'));
			}
			visible.forEach((itemData, index) => {
				const abs = this.scrollOffset + index;
				const selected = abs === this.selectedIndex && !this.actionMenuVisible;
				const color = RARITY_COLORS[itemData.item.rarity] || '#fff';
				const equipped = itemData.item.equipSlot && equipmentManager.isEquipped(itemData.item.id);
				const row = div({
					className: 'inv-item' + (selected ? ' inv-item-selected' : ''),
					onClick: () => { this.selectedIndex = abs; this.updateUI(); },
					onDblClick: () => { this.selectedIndex = abs; this.selectItem(); },
				},
					span({ className: 'inv-item-name', style: `color:${color}` }, `${itemData.item.name} x${itemData.quantity}${equipped ? ' [E]' : ''}`),
					span({ className: 'inv-item-info' }, `${itemData.item.type} | ${itemData.item.value}g`),
				);
				this.listEl!.appendChild(row);
			});
		} else {
			const slots = ['weapon', 'head', 'body', 'hands', 'legs', 'feet', 'accessory1', 'accessory2'];
			slots.forEach((slot, index) => {
				const equipped = this.equippedItems.get(slot);
				const selected = index === this.selectedIndex && !this.actionMenuVisible;
				const row = div({
					className: 'inv-item' + (selected ? ' inv-item-selected' : ''),
					onClick: () => { this.selectedIndex = index; this.updateUI(); },
					onDblClick: () => { this.selectedIndex = index; this.selectItem(); },
				},
					span({ className: 'inv-item-name' }, slot.charAt(0).toUpperCase() + slot.slice(1)),
					span({ className: 'inv-item-info' }, equipped ? equipped.name : '(Empty)'),
				);
				this.listEl!.appendChild(row);
			});
		}

		// Update action menu
		if (this.actionMenuVisible && this.actionMenuEl) {
			this.actionMenuEl.style.display = 'block';
			this.actionMenuEl.innerHTML = '';
			this.actionMenuOptions.forEach((opt, i) => {
				const btn = button({
					className: 'inv-action-btn' + (i === this.selectedIndex ? ' inv-action-btn-selected' : '') + (!opt.enabled ? ' inv-action-btn-disabled' : ''),
					onClick: () => opt.enabled && opt.action(),
				}, opt.text);
				this.actionMenuEl!.appendChild(btn);
			});
		} else if (this.actionMenuEl) {
			this.actionMenuEl.style.display = 'none';
		}
	}

	override renderHTML(): HTMLElement {
		this.setupStyles();

		const stats = inventoryManager.getInventoryStats();
		this.listEl = div({ className: 'inv-list' });
		this.actionMenuEl = div({ className: 'inv-action-menu', style: 'display:none' });

		const root = div({ className: 'inv-root' },
			div({ className: 'inv-panel' },
				div({ className: 'inv-header' },
					span({ className: 'inv-title' }, this.viewMode === 'inventory' ? 'Inventory' : 'Equipment'),
					span({ className: 'inv-filter' }, `Filter: ${this.currentFilter} (F) | Slots: ${stats.usedSlots}/${stats.maxSlots} | Tab: Switch View`),
				),
				this.listEl,
				this.actionMenuEl,
				p({ className: 'inv-hint' }, '[↑↓/WS] Navigate | [Enter] Select | [Tab] View | [F] Filter | [Esc] Back'),
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
		bind('Enter', () => this.selectItem());
		bind(' ', () => this.selectItem());
		bind('Escape', () => this.onBack());
		bind('Tab', () => this.toggleViewMode());
		bind('KeyF', () => this.cycleFilter());
	}

	private cleanupKeyboard(): void {
		for (const [key, handler] of this.keyHandlers) {
			keyboard.removeKeyDownListener(key, handler);
		}
		this.keyHandlers.clear();
	}

	private navigateUp(): void {
		if (!this._isActive) return;
		if (this.actionMenuVisible) {
			if (!this.actionMenuOptions.some(o => o.enabled)) return;
			do { this.selectedIndex = (this.selectedIndex - 1 + this.actionMenuOptions.length) % this.actionMenuOptions.length; }
			while (!this.actionMenuOptions[this.selectedIndex]!.enabled);
		} else {
			const items = this.viewMode === 'inventory' ? this.filteredItems : this.getEquipmentSlotList();
			if (items.length === 0) return;
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			if (this.selectedIndex < this.scrollOffset) this.scrollOffset = this.selectedIndex;
		}
		this.updateUI();
	}

	private navigateDown(): void {
		if (!this._isActive) return;
		if (this.actionMenuVisible) {
			if (!this.actionMenuOptions.some(o => o.enabled)) return;
			do { this.selectedIndex = (this.selectedIndex + 1) % this.actionMenuOptions.length; }
			while (!this.actionMenuOptions[this.selectedIndex]!.enabled);
		} else {
			const items = this.viewMode === 'inventory' ? this.filteredItems : this.getEquipmentSlotList();
			if (items.length === 0) return;
			this.selectedIndex = Math.min(items.length - 1, this.selectedIndex + 1);
			if (this.selectedIndex >= this.scrollOffset + this.ITEMS_PER_PAGE) this.scrollOffset = this.selectedIndex - this.ITEMS_PER_PAGE + 1;
		}
		this.updateUI();
	}

	private selectItem(): void {
		if (!this._isActive) return;
		if (this.actionMenuVisible) {
			const opt = this.actionMenuOptions[this.selectedIndex];
			if (opt?.enabled) opt.action();
			return;
		}
		if (this.viewMode === 'inventory') {
			const selected = this.filteredItems[this.selectedIndex];
			if (selected) this.openActionMenu(selected.item, selected.slotIndex);
		} else {
			const entries = Array.from(this.equippedItems.entries());
			const selected = entries[this.selectedIndex];
			if (selected) this.onUnequip(selected[0]);
		}
	}

	private openActionMenu(item: ItemData, slotIndex: number): void {
		this.actionMenuVisible = true;
		this.selectedIndex = 0;
		this.actionMenuOptions = [];
		if (item.type === 'consumable' && item.consumableEffect) {
			this.actionMenuOptions.push({ text: 'Use', action: () => this.onUseItem(item, slotIndex), enabled: true });
		}
		if (item.equipSlot) {
			const isEq = equipmentManager.isEquipped(item.id);
			this.actionMenuOptions.push({ text: isEq ? 'Unequip' : 'Equip', action: () => isEq ? this.onUnequip(item.equipSlot!) : this.onEquip(item, slotIndex), enabled: true });
		}
		this.actionMenuOptions.push({ text: 'Drop', action: () => this.onDrop(item, slotIndex), enabled: true });
		this.actionMenuOptions.push({ text: 'Cancel', action: () => this.closeActionMenu(), enabled: true });
		this.updateUI();
	}

	private closeActionMenu(): void {
		this.actionMenuVisible = false;
		this.selectedIndex = 0;
		this.actionMenuOptions = [];
		this.updateUI();
	}

	private onUseItem(item: ItemData, slotIndex: number): void {
		if (item.type !== 'consumable' || !item.consumableEffect) return;
		const ps = gameStateManager.getPlayerState();
		if (!ps) return;
		switch (item.consumableEffect.type) {
			case 'heal_hp': ps.stats.hp = Math.min(ps.stats.maxHp, ps.stats.hp + item.consumableEffect.value); break;
			case 'heal_mp': ps.stats.mp = Math.min(ps.stats.maxMp, ps.stats.mp + item.consumableEffect.value); break;
			case 'heal_both':
				ps.stats.hp = Math.min(ps.stats.maxHp, ps.stats.hp + item.consumableEffect.value);
				ps.stats.mp = Math.min(ps.stats.maxMp, ps.stats.mp + item.consumableEffect.value);
				break;
		}
		inventoryManager.removeItem(item.id, 1);
		this.updateFilteredItems();
		this.closeActionMenu();
		gameStateManager.saveGame();
	}

	private onEquip(item: ItemData, slotIndex: number): void {
		if (!item.equipSlot) return;
		try {
			const inv = inventoryManager.findItem(item.id);
			if (inv) equipmentManager.equip(inv);
			this.updateFilteredItems();
			this.updateEquippedItems();
			this.closeActionMenu();
			gameStateManager.saveGame();
		} catch (error) { console.error('[InventoryScene] Equip error:', error); }
	}

	private onUnequip(slot: string): void {
		try {
			equipmentManager.unequip(slot as any);
			this.updateFilteredItems();
			this.updateEquippedItems();
			this.closeActionMenu();
			gameStateManager.saveGame();
		} catch (error) { console.error('[InventoryScene] Unequip error:', error); }
	}

	private onDrop(item: ItemData, slotIndex: number): void {
		try {
			inventoryManager.removeItem(item.id, 1);
			this.updateFilteredItems();
			this.closeActionMenu();
			gameStateManager.saveGame();
		} catch (error) { console.error('[InventoryScene] Drop error:', error); }
	}

	private toggleViewMode(): void {
		if (!this._isActive) return;
		this.viewMode = this.viewMode === 'inventory' ? 'equipment' : 'inventory';
		this.selectedIndex = 0;
		this.scrollOffset = 0;
		this.updateUI();
	}

	private cycleFilter(): void {
		if (!this._isActive || this.viewMode !== 'inventory') return;
		const filters: FilterType[] = ['all', 'weapon', 'armor', 'consumable', 'material'];
		this.currentFilter = filters[(filters.indexOf(this.currentFilter) + 1) % filters.length]!;
		this.updateFilteredItems();
		this.selectedIndex = 0;
		this.scrollOffset = 0;
		this.updateUI();
	}

	private updateFilteredItems(): void {
		const allItems = inventoryManager.getAllItems();
		this.filteredItems = allItems
			.map((slot, index) => {
				if (!slot.item) return null;
				const itemData = dataLoader.getItem(slot.item.id);
				if (!itemData) return null;
				if (this.currentFilter !== 'all' && itemData.type !== this.currentFilter) return null;
				return { slotIndex: index, item: itemData, quantity: slot.quantity };
			})
			.filter((item): item is NonNullable<typeof item> => item !== null);
	}

	private updateEquippedItems(): void {
		this.equippedItems.clear();
		const equipment = equipmentManager.getEquipment();
		for (const [slot, item] of Object.entries(equipment)) {
			if (item) {
				const itemData = dataLoader.getItem(item.id);
				if (itemData) this.equippedItems.set(slot, itemData);
			}
		}
	}

	private onBack(): void {
		if (!this._isActive) return;
		if (this.actionMenuVisible) { this.closeActionMenu(); return; }
		const sm = EnhancedSceneManager.getInstance();
		sm.pop({ type: 'fade', duration: 200 });
	}

	private getEquipmentSlotList(): string[] {
		return ['weapon', 'head', 'body', 'hands', 'legs', 'feet', 'accessory1', 'accessory2'];
	}

	override update(deltaTime: number): void {}

	override onEnter(): void {
		super.onEnter();
		this.setupInput();
		this.updateFilteredItems();
		this.updateEquippedItems();
		console.log('[InventoryScene] Entered');
	}

	override onExit(): void {
		super.onExit();
		this.cleanupKeyboard();
		console.log('[InventoryScene] Exited');
	}

	override destroy(): void {
		this.onExit();
	}
}
