/**
 * Character Creation Scene (HTML Overlay)
 * Create a new character with name and starting job
 */

import { div, p, button, span } from './dom';
import { CreateStyle } from 'elit/style';
import { Scene, SceneType, EnhancedSceneManager } from '@rpg/game-engine';
import { gameStateManager } from '../state/GameStateManager';
import { dataLoader, type JobData } from '../data/DataLoader';
import { inventoryManager } from '../inventory/InventoryManager';
import { jobManager } from '../jobs/JobManager';
import { equipmentManager } from '../inventory/EquipmentManager';

export class CharacterCreationScene extends Scene {
	private characterName: string = '';
	private selectedJobId: string = 'warrior';
	private availableJobs: JobData[] = [];
	private isEnteringName: boolean = true;
	private nameInput: HTMLInputElement | null = null;
	private jobCardEls: HTMLDivElement[] = [];
	private errorEl: HTMLElement | null = null;

	constructor() {
		super('CharacterCreation');
		this.sceneType = SceneType.HTML_OVERLAY;
	}

	override async load(): Promise<void> {
		console.log('[CharacterCreationScene] Loading...');
		await dataLoader.loadAll();

		const allJobs = dataLoader.getAllJobs();
		this.availableJobs = allJobs.slice(0, 4);
		if (this.availableJobs.length > 0) this.selectedJobId = this.availableJobs[0]!.id;

		console.log('[CharacterCreationScene] Loaded');
	}

	private setupStyles(): void {
		const css = new CreateStyle();
		css.addClass('cc-root', {
			position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
			background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
			color: '#fff', fontFamily: 'Arial, sans-serif', overflow: 'auto',
		});
		css.addClass('cc-panel', {
			width: '600px', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto',
			background: '#16213e', border: '4px solid #e94560',
			borderRadius: '12px', padding: '30px', boxSizing: 'border-box',
		});
		css.addClass('cc-title', {
			fontSize: '32px', fontWeight: 'bold', color: '#eee', textAlign: 'center',
			marginBottom: '20px', lineHeight: '1.3',
		});
		css.addClass('cc-label', {
			fontSize: '20px', fontWeight: 'bold', marginBottom: '10px', lineHeight: '1.4',
		});
		css.addClass('cc-input', {
			width: '100%', height: '50px', padding: '0 15px',
			background: '#0f3460', border: '3px solid #e94560', borderRadius: '8px',
			color: '#ddd', fontSize: '24px', fontFamily: 'Arial, sans-serif',
			outline: 'none', boxSizing: 'border-box',
		});
		css.addClass('cc-jobs', {
			display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '20px',
		});
		css.addClass('cc-job', {
			padding: '15px', background: '#0f3460', border: '1px solid #555',
			borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
		});
		css.addClass('cc-job-selected', {
			background: '#533483', border: '3px solid #e94560',
		});
		css.addClass('cc-job-name', {
			fontSize: '18px', fontWeight: 'bold', color: '#eee', textAlign: 'center',
		});
		css.addClass('cc-job-desc', {
			fontSize: '12px', color: '#bbb', textAlign: 'center', marginTop: '5px', lineHeight: '1.4',
		});
		css.addClass('cc-job-stats', {
			fontSize: '11px', color: '#aaa', textAlign: 'center', marginTop: '5px', lineHeight: '1.4',
		});
		css.addClass('cc-confirm', {
			display: 'block', width: '200px', height: '45px', margin: '25px auto 0',
			background: '#533483', color: '#eee', border: '2px solid #e94560',
			borderRadius: '8px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer',
		});
		css.addClass('cc-hint', {
			color: '#888', fontSize: '12px', textAlign: 'center', marginTop: '15px',
		});
		css.addClass('cc-error', {
			color: '#f44336', fontSize: '14px', textAlign: 'center', marginTop: '10px',
		});
		css.inject();
	}

	private updateJobSelection(): void {
		this.jobCardEls.forEach((el, i) => {
			const job = this.availableJobs[i];
			el.classList.toggle('cc-job-selected', job?.id === this.selectedJobId);
		});
	}

	override renderHTML(): HTMLElement {
		this.setupStyles();

		// Name input (real HTML input)
		this.nameInput = document.createElement('input');
		this.nameInput.type = 'text';
		this.nameInput.className = 'cc-input';
		this.nameInput.placeholder = 'Enter character name...';
		this.nameInput.maxLength = 20;
		this.nameInput.addEventListener('input', () => {
			this.characterName = this.nameInput!.value;
		});
		this.nameInput.addEventListener('focus', () => { this.isEnteringName = true; });

		// Job cards
		this.jobCardEls = [];
		const jobsContainer = div({ className: 'cc-jobs' });

		for (const job of this.availableJobs) {
			const card = div({
				className: 'cc-job',
				onClick: () => {
					this.selectedJobId = job.id;
					this.isEnteringName = false;
					this.nameInput?.blur();
					this.updateJobSelection();
				},
			},
				p({ className: 'cc-job-name' }, job.name),
				p({ className: 'cc-job-desc' }, job.description.length > 40 ? job.description.slice(0, 40) + '...' : job.description),
				p({ className: 'cc-job-stats' }, `STR:${job.baseStats.atk} DEX:${job.baseStats.spd} INT:${job.baseStats.luck}`),
			) as HTMLDivElement;
			this.jobCardEls.push(card);
			jobsContainer.appendChild(card);
		}

		// Error element
		this.errorEl = p({ className: 'cc-error' }, '') as HTMLElement;

		const root = div({ className: 'cc-root' },
			div({ className: 'cc-panel' },
				p({ className: 'cc-title' }, 'Create Your Character'),
				p({ className: 'cc-label' }, 'Character Name:'),
				this.nameInput,
				p({ className: 'cc-label', style: 'margin-top:20px;' }, 'Choose Starting Job:'),
				jobsContainer,
				button({
					className: 'cc-confirm',
					onClick: () => this.onConfirm(),
				}, 'Create Character'),
				this.errorEl,
				p({ className: 'cc-hint' }, 'Type name, click a job, then Create | ESC: Cancel'),
			),
		);

		this.updateJobSelection();
		return root as HTMLElement;
	}

	override onHTMLMounted(el: HTMLElement): void {
		this.nameInput?.focus();
		document.removeEventListener('keydown', this.handleKeyDown);
		document.addEventListener('keydown', this.handleKeyDown);
	}

	private handleKeyDown = (e: KeyboardEvent): void => {
		if (!this._isActive) return;
		if (this.isEnteringName && document.activeElement === this.nameInput) {
			if (e.key === 'Enter') {
				if (this.characterName.trim().length > 0) {
					this.isEnteringName = false;
					this.nameInput?.blur();
				}
				e.preventDefault();
			} else if (e.key === 'Escape') {
				this.onCancel();
				e.preventDefault();
			}
			return;
		}

		// Job selection mode
		const idx = this.availableJobs.findIndex(j => j.id === this.selectedJobId);
		switch (e.key) {
			case 'ArrowLeft':
				if (idx > 0) { this.selectedJobId = this.availableJobs[idx - 1]!.id; this.updateJobSelection(); }
				e.preventDefault(); break;
			case 'ArrowRight':
				if (idx < this.availableJobs.length - 1) { this.selectedJobId = this.availableJobs[idx + 1]!.id; this.updateJobSelection(); }
				e.preventDefault(); break;
			case 'Enter': case ' ':
				this.onConfirm(); e.preventDefault(); break;
			case 'Escape':
				this.isEnteringName = true; this.nameInput?.focus(); e.preventDefault(); break;
		}
	};

	private onConfirm(): void {
		if (this.characterName.trim().length === 0) {
			if (this.errorEl) this.errorEl.textContent = 'Please enter a character name';
			this.isEnteringName = true;
			this.nameInput?.focus();
			return;
		}
		if (this.errorEl) this.errorEl.textContent = '';

		dataLoader.loadAll().then(() => {
				gameStateManager.initializeManagers(inventoryManager, jobManager, dataLoader, equipmentManager);

				const jobs = dataLoader.getAllJobs();
				if (jobs.length > 0) jobManager.loadJobs(jobs as any);

				gameStateManager.createNewGame(this.characterName.trim(), this.selectedJobId);
				gameStateManager.saveGame();

				const sm = EnhancedSceneManager.getInstance();
				sm.switchTo('World', { type: 'fade', duration: 500 });
			}).catch((err) => {
				console.error('[CharacterCreationScene] Failed to create character:', err);
				if (this.errorEl) this.errorEl.textContent = 'Failed to create character';
			});
	}

	private onCancel(): void {
		const sm = EnhancedSceneManager.getInstance();
		sm.switchTo('MainMenu', { type: 'fade', duration: 300 });
	}

	override update(deltaTime: number): void {}

	override onEnter(): void {
		super.onEnter();
		this.characterName = '';
		this.isEnteringName = true;
		console.log('[CharacterCreationScene] Entered');
	}

	override onExit(): void {
		super.onExit();
		document.removeEventListener('keydown', this.handleKeyDown);
		console.log('[CharacterCreationScene] Exited');
	}

	override destroy(): void {
		this.onExit();
	}
}
