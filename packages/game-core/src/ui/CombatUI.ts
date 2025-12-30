/**
 * CombatUI
 * UI for turn-based combat
 */

import type {
	CombatManager,
	CombatEntity,
	CombatAction,
	CombatActionType,
} from '../combat/CombatManager.ts';

export interface CombatUIConfig {
	container: HTMLElement;
	onActionSelected: (action: CombatAction) => void;
}

export class CombatUI {
	private combat: CombatManager;
	private config: CombatUIConfig;
	private container: HTMLElement;
	private battleContainer: HTMLDivElement;
	private logContainer: HTMLDivElement;
	private actionMenu: HTMLDivElement;
	private currentActor: CombatEntity | null = null;

	constructor(combat: CombatManager, config: CombatUIConfig) {
		this.combat = combat;
		this.config = config;
		this.container = config.container;

		this.battleContainer = document.createElement('div');
		this.logContainer = document.createElement('div');
		this.actionMenu = document.createElement('div');

		this.init();
		this.setupEventListeners();
	}

	/**
	 * Initialize UI
	 */
	private init(): void {
		const combatBox = document.createElement('div');
		combatBox.id = 'combat-box';
		combatBox.style.cssText = `
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 800px;
			height: 600px;
			background: rgba(0, 0, 0, 0.95);
			border: 3px solid #666;
			border-radius: 12px;
			display: flex;
			flex-direction: column;
			font-family: monospace;
			z-index: 2000;
		`;

		// Battle container (shows entities)
		this.battleContainer.id = 'battle-container';
		this.battleContainer.style.cssText = `
			flex: 2;
			display: flex;
			justify-content: space-around;
			align-items: center;
			padding: 20px;
			background: linear-gradient(to bottom, #1a1a2e 0%, #16213e 100%);
		`;

		// Combat log
		this.logContainer.id = 'combat-log';
		this.logContainer.style.cssText = `
			flex: 1;
			overflow-y: auto;
			padding: 15px;
			background: rgba(0, 0, 0, 0.7);
			border-top: 2px solid #444;
			border-bottom: 2px solid #444;
			color: #fff;
			font-size: 14px;
			line-height: 1.6;
		`;

		// Action menu
		this.actionMenu.id = 'action-menu';
		this.actionMenu.style.cssText = `
			padding: 20px;
			background: rgba(0, 0, 0, 0.8);
			display: flex;
			gap: 10px;
			justify-content: center;
		`;

		combatBox.appendChild(this.battleContainer);
		combatBox.appendChild(this.logContainer);
		combatBox.appendChild(this.actionMenu);
		this.container.appendChild(combatBox);

		this.renderBattle();
		this.addLog('Combat started!', 'system');
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		this.combat.on('turn-start', (actorId) => {
			const actor = this.combat.getEntity(actorId);
			if (!actor) return;

			this.currentActor = actor;

			if (actor.isPlayer) {
				this.addLog(`${actor.name}'s turn!`, 'player');
				this.showActionMenu();
			} else {
				this.addLog(`${actor.name}'s turn!`, 'enemy');
				this.hideActionMenu();
			}

			this.renderBattle();
		});

		this.combat.on('action-executed', (action, result) => {
			const actor = this.combat.getEntity(action.actorId);
			const target = this.combat.getEntity(action.targetId);
			if (!actor || !target) return;

			let message = `${actor.name} attacks ${target.name}!`;
			if (result.damage > 0) {
				message += ` ${result.damage} damage!`;
				if (result.isCritical) message += ' Critical hit!';
				if (result.isWeak) message += ' Super effective!';
				if (result.isResisted) message += ' Not very effective...';
			}

			this.addLog(message, actor.isPlayer ? 'player' : 'enemy');
			this.renderBattle();
		});

		this.combat.on('entity-defeated', (entityId) => {
			const entity = this.combat.getEntity(entityId);
			if (!entity) return;

			this.addLog(`${entity.name} was defeated!`, 'system');
			this.renderBattle();
		});

		this.combat.on('combat-end', (result) => {
			if (result === 'victory') {
				this.addLog('Victory!', 'system');
			} else if (result === 'defeat') {
				this.addLog('Defeat...', 'system');
			} else if (result === 'fled') {
				this.addLog('Fled from battle!', 'system');
			}

			this.hideActionMenu();
		});
	}

	/**
	 * Render battle (entities)
	 */
	private renderBattle(): void {
		this.battleContainer.innerHTML = '';

		const entities = this.combat.getAllEntities();
		const players = entities.filter((e) => e.isPlayer);
		const enemies = entities.filter((e) => !e.isPlayer);

		// Player side
		const playerSide = document.createElement('div');
		playerSide.style.cssText = 'display: flex; flex-direction: column; gap: 15px;';
		players.forEach((player) => {
			playerSide.appendChild(this.createEntityCard(player, 'player'));
		});
		this.battleContainer.appendChild(playerSide);

		// VS text
		const vsText = document.createElement('div');
		vsText.textContent = 'VS';
		vsText.style.cssText = `
			font-size: 48px;
			font-weight: bold;
			color: #f39c12;
			text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
		`;
		this.battleContainer.appendChild(vsText);

		// Enemy side
		const enemySide = document.createElement('div');
		enemySide.style.cssText = 'display: flex; flex-direction: column; gap: 15px;';
		enemies.forEach((enemy) => {
			enemySide.appendChild(this.createEntityCard(enemy, 'enemy'));
		});
		this.battleContainer.appendChild(enemySide);
	}

	/**
	 * Create entity card
	 */
	private createEntityCard(entity: CombatEntity, side: 'player' | 'enemy'): HTMLDivElement {
		const card = document.createElement('div');
		const isActive = this.currentActor?.id === entity.id;
		const isAlive = entity.stats.hp > 0;

		card.style.cssText = `
			padding: 15px;
			background: ${isActive ? 'rgba(52, 152, 219, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
			border: 2px solid ${isActive ? '#3498db' : '#555'};
			border-radius: 8px;
			min-width: 200px;
			opacity: ${isAlive ? '1' : '0.4'};
		`;

		// Name and level
		const nameEl = document.createElement('div');
		nameEl.style.cssText = `
			font-size: 18px;
			font-weight: bold;
			color: ${side === 'player' ? '#2ecc71' : '#e74c3c'};
			margin-bottom: 8px;
		`;
		nameEl.textContent = `${entity.name} Lv.${entity.level}`;
		card.appendChild(nameEl);

		// HP bar
		const hpPercent = (entity.stats.hp / entity.stats.maxHp) * 100;
		const hpBar = this.createBar('HP', entity.stats.hp, entity.stats.maxHp, '#e74c3c', hpPercent);
		card.appendChild(hpBar);

		// MP bar
		const mpPercent = (entity.stats.mp / entity.stats.maxMp) * 100;
		const mpBar = this.createBar('MP', entity.stats.mp, entity.stats.maxMp, '#3498db', mpPercent);
		card.appendChild(mpBar);

		// Stats
		const statsEl = document.createElement('div');
		statsEl.style.cssText = `
			font-size: 12px;
			color: #bbb;
			margin-top: 8px;
		`;
		statsEl.textContent = `ATK:${entity.stats.atk} DEF:${entity.stats.def} SPD:${entity.stats.spd}`;
		card.appendChild(statsEl);

		return card;
	}

	/**
	 * Create stat bar
	 */
	private createBar(
		label: string,
		current: number,
		max: number,
		color: string,
		percent: number,
	): HTMLDivElement {
		const container = document.createElement('div');
		container.style.cssText = 'margin: 5px 0;';

		const labelEl = document.createElement('div');
		labelEl.style.cssText = 'font-size: 12px; color: #ccc; margin-bottom: 3px;';
		labelEl.textContent = `${label}: ${current}/${max}`;

		const barBg = document.createElement('div');
		barBg.style.cssText = `
			width: 100%;
			height: 8px;
			background: #333;
			border-radius: 4px;
			overflow: hidden;
		`;

		const barFill = document.createElement('div');
		barFill.style.cssText = `
			width: ${percent}%;
			height: 100%;
			background: ${color};
			transition: width 0.3s ease;
		`;

		barBg.appendChild(barFill);
		container.appendChild(labelEl);
		container.appendChild(barBg);

		return container;
	}

	/**
	 * Show action menu
	 */
	private showActionMenu(): void {
		this.actionMenu.innerHTML = '';

		if (!this.currentActor) return;

		const actions: { label: string; type: CombatActionType }[] = [
			{ label: 'Attack', type: 'ATTACK' },
			{ label: 'Skills', type: 'SKILL' },
			{ label: 'Items', type: 'ITEM' },
			{ label: 'Flee', type: 'FLEE' },
		];

		actions.forEach(({ label, type }) => {
			const button = this.createActionButton(label, () => {
				this.handleAction(type);
			});
			this.actionMenu.appendChild(button);
		});
	}

	/**
	 * Hide action menu
	 */
	private hideActionMenu(): void {
		this.actionMenu.innerHTML = '';
	}

	/**
	 * Create action button
	 */
	private createActionButton(label: string, onClick: () => void): HTMLButtonElement {
		const button = document.createElement('button');
		button.textContent = label;
		button.style.cssText = `
			padding: 15px 30px;
			font-size: 16px;
			font-weight: bold;
			font-family: monospace;
			background: #34495e;
			border: 2px solid #7f8c8d;
			border-radius: 8px;
			color: #ecf0f1;
			cursor: pointer;
			transition: all 0.2s;
		`;

		button.addEventListener('mouseenter', () => {
			button.style.background = '#4a6278';
			button.style.borderColor = '#95a5a6';
		});

		button.addEventListener('mouseleave', () => {
			button.style.background = '#34495e';
			button.style.borderColor = '#7f8c8d';
		});

		button.addEventListener('click', onClick);

		return button;
	}

	/**
	 * Handle action selection
	 */
	private handleAction(type: CombatActionType): void {
		if (!this.currentActor) return;

		const enemies = this.combat.getAllEntities().filter((e) => !e.isPlayer && e.stats.hp > 0);
		if (enemies.length === 0) return;

		// For now, target first enemy
		const target = enemies[0];

		const action: CombatAction = {
			actorId: this.currentActor.id,
			type,
			targetId: target.id,
		};

		// If skill, use first skill
		if (type === 'SKILL' && this.currentActor.skills.length > 0) {
			action.skillId = this.currentActor.skills[0];
		}

		this.config.onActionSelected(action);
		this.hideActionMenu();
	}

	/**
	 * Add log message
	 */
	private addLog(message: string, type: 'player' | 'enemy' | 'system'): void {
		const logEntry = document.createElement('div');
		logEntry.style.cssText = `
			margin-bottom: 5px;
			color: ${type === 'player' ? '#2ecc71' : type === 'enemy' ? '#e74c3c' : '#f39c12'};
		`;
		logEntry.textContent = `> ${message}`;

		this.logContainer.appendChild(logEntry);
		this.logContainer.scrollTop = this.logContainer.scrollHeight;
	}

	/**
	 * Clear log
	 */
	clearLog(): void {
		this.logContainer.innerHTML = '';
	}

	/**
	 * Destroy UI
	 */
	destroy(): void {
		const combatBox = this.container.querySelector('#combat-box');
		if (combatBox) {
			this.container.removeChild(combatBox);
		}
	}
}
