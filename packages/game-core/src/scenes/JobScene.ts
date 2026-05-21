/**
 * Job Scene (HTML Overlay)
 * View learned jobs, skills, and learn new jobs
 */

import { div, p, button, span } from './dom';
import { CreateStyle } from 'elit/style';
import { Scene, SceneType, keyboard, EnhancedSceneManager } from '@rpg/game-engine';
import { jobManager } from '../jobs/JobManager';
import { gameStateManager } from '../state/GameStateManager';
import { dataLoader, type JobData, type SkillData } from '../data/DataLoader';
import { inventoryManager } from '../inventory/InventoryManager';

interface MenuOption {
	text: string;
	action: () => void;
	enabled: boolean;
}

type ViewMode = 'jobs' | 'skills' | 'available';

export class JobScene extends Scene {
	private viewMode: ViewMode = 'jobs';
	private selectedIndex: number = 0;
	private scrollOffset: number = 0;
	private selectedJobId: string | null = null;

	private learnedJobs: { jobId: string; level: number; exp: number }[] = [];
	private availableJobs: JobData[] = [];
	private jobSkills: SkillData[] = [];

	private readonly ITEMS_PER_PAGE = 8;
	private actionMenuVisible: boolean = false;
	private actionMenuOptions: MenuOption[] = [];

	private listEl: HTMLElement | null = null;
	private actionMenuEl: HTMLElement | null = null;
	private keyHandlers: Map<string, (e: KeyboardEvent) => void> = new Map();

	constructor() {
		super('Jobs');
		this.sceneType = SceneType.HTML_OVERLAY;
	}

	override async load(): Promise<void> {
		console.log('[JobScene] Loading...');
		await dataLoader.loadAll();
		this.updateLearnedJobs();
		this.updateAvailableJobs();
		console.log('[JobScene] Loaded');
	}

	private setupStyles(): void {
		const css = new CreateStyle();
		css.addClass('job-root', {
			width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
			background: 'rgba(26,26,46,0.95)', color: '#fff', fontFamily: 'Arial, sans-serif',
			position: 'absolute', inset: '0',
		});
		css.addClass('job-panel', {
			width: '700px', maxHeight: '90vh', background: 'rgba(0,0,0,0.8)',
			border: '2px solid #6C5CE7', borderRadius: '12px', padding: '20px',
		});
		css.addClass('job-header', {
			display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px',
		});
		css.addClass('job-title', { fontSize: '24px', fontWeight: 'bold' });
		css.addClass('job-list', {
			maxHeight: '450px', overflowY: 'auto', borderRadius: '8px',
			background: 'rgba(0,0,0,0.3)', padding: '5px',
		});
		css.addClass('job-item', {
			padding: '12px 15px', margin: '5px 0', borderRadius: '6px',
			borderLeft: '4px solid transparent', transition: 'all 0.15s',
		});
		css.addClass('job-item-selected', { background: 'rgba(255,215,0,0.3)', borderLeftColor: '#FFD700' });
		css.addClass('job-name', { fontSize: '18px', fontWeight: 'bold' });
		css.addClass('job-desc', { fontSize: '14px', color: '#aaa', marginTop: '4px' });
		css.addClass('job-badge', { fontSize: '12px', color: '#2196F3', marginTop: '4px' });
		css.addClass('job-action-menu', {
			position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
			background: 'rgba(0,0,0,0.9)', border: '2px solid #6C5CE7', borderRadius: '8px',
			padding: '15px', zIndex: '10', minWidth: '200px',
		});
		css.addClass('job-action-btn', {
			display: 'block', width: '100%', padding: '10px', margin: '5px 0',
			background: '#16213e', color: '#eee', border: '1px solid #333',
			fontSize: '16px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left',
		});
		css.addClass('job-action-btn-selected', { background: '#533483', border: '2px solid #FFD700' });
		css.addClass('job-action-btn-disabled', { color: '#666', cursor: 'not-allowed' });
		css.addClass('job-hint', { color: '#888', fontSize: '14px', marginTop: '15px', textAlign: 'center' });
		css.inject();
	}

	private updateUI(): void {
		if (!this.listEl) return;
		this.listEl.innerHTML = '';

		const visible = this.getVisibleItems().slice(this.scrollOffset, this.scrollOffset + this.ITEMS_PER_PAGE);

		if (visible.length === 0) {
			const msg = this.viewMode === 'jobs' ? 'No jobs learned yet' :
			            this.viewMode === 'available' ? 'All jobs learned!' : 'No skills available';
			this.listEl.appendChild(p({ style: 'color:#888;font-style:italic;padding:20px;' }, msg));
		} else if (this.viewMode === 'jobs') {
			visible.forEach((learnedJob: any, index) => {
				const abs = this.scrollOffset + index;
				const selected = abs === this.selectedIndex && !this.actionMenuVisible;
				const jobData = dataLoader.getJob(learnedJob.jobId);
				if (!jobData) return;
				const skillCount = jobData.skills.filter(s => learnedJob.level >= s.learnLevel).length;
				this.listEl!.appendChild(div({
					className: 'job-item' + (selected ? ' job-item-selected' : ''),
					onClick: () => { this.selectedIndex = abs; this.updateUI(); },
					onDblClick: () => { this.selectedIndex = abs; this.selectItem(); },
				},
					span({ className: 'job-name', style: 'color:#4CAF50' }, jobData.name),
					span({ style: 'margin-left:15px;color:#fff' }, `Lv. ${learnedJob.level}`),
					p({ className: 'job-desc' }, jobData.description),
					p({ className: 'job-badge' }, `${skillCount} Skills`),
				));
			});
		} else if (this.viewMode === 'skills') {
			visible.forEach((skill: any, index) => {
				this.listEl!.appendChild(div({
					className: 'job-item',
				},
					span({ className: 'job-name', style: 'color:#2196F3' }, skill.name),
					span({ style: 'margin-left:15px;color:#aaa;font-size:14px' }, `MP: ${skill.mpCost} | Power: ${skill.power} | Acc: ${skill.accuracy}%`),
					p({ className: 'job-desc' }, skill.description),
					p({ style: 'font-size:12px;color:#888' }, `${skill.element} | ${skill.target}`),
				));
			});
		} else if (this.viewMode === 'available') {
			visible.forEach((job: any, index) => {
				const abs = this.scrollOffset + index;
				const selected = abs === this.selectedIndex && !this.actionMenuVisible;
				const hasCert = this.hasJobCertificate(job.id);
				this.listEl!.appendChild(div({
					className: 'job-item' + (selected ? ' job-item-selected' : ''),
					onClick: () => { this.selectedIndex = abs; this.updateUI(); },
					onDblClick: () => { this.selectedIndex = abs; this.selectItem(); },
				},
					span({ className: 'job-name', style: hasCert ? 'color:#4CAF50' : 'color:#666' }, job.name),
					span({ style: `margin-left:15px;font-size:14px;color:${hasCert ? '#FFD700' : '#888'}` }, hasCert ? '[Certificate Available]' : '[Need Certificate]'),
					p({ className: 'job-desc' }, job.description),
					p({ style: 'font-size:12px;color:#888' }, `Skills: ${job.skills.length}`),
				));
			});
		}

		// Action menu
		if (this.actionMenuVisible && this.actionMenuEl) {
			this.actionMenuEl.style.display = 'block';
			this.actionMenuEl.innerHTML = '';
			this.actionMenuOptions.forEach((opt, i) => {
				this.actionMenuEl!.appendChild(button({
					className: 'job-action-btn' + (i === this.selectedIndex ? ' job-action-btn-selected' : '') + (!opt.enabled ? ' job-action-btn-disabled' : ''),
					onClick: () => opt.enabled && opt.action(),
				}, opt.text));
			});
		} else if (this.actionMenuEl) {
			this.actionMenuEl.style.display = 'none';
		}
	}

	override renderHTML(): HTMLElement {
		this.setupStyles();
		this.listEl = div({ className: 'job-list' });
		this.actionMenuEl = div({ className: 'job-action-menu', style: 'display:none' });

		const viewLabel = this.viewMode === 'jobs' ? 'Learned Jobs' :
		                  this.viewMode === 'skills' ? `${dataLoader.getJob(this.selectedJobId!)?.name || ''} Skills` : 'Available Jobs';
		const hint = this.viewMode === 'skills'
			? '[Tab/Esc] Back to Jobs'
			: '[↑↓/WS] Navigate | [Enter] Select | [Tab] Switch View | [Esc] Back';

		const root = div({ className: 'job-root' },
			div({ className: 'job-panel' },
				div({ className: 'job-header' },
					span({ className: 'job-title' }, viewLabel),
					span({ style: 'color:#aaa;font-size:14px' }, `Total: ${this.learnedJobs.length}`),
				),
				this.listEl,
				this.actionMenuEl,
				p({ className: 'job-hint' }, hint),
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
		bind('Tab', () => this.cycleViewMode());
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
			const items = this.getVisibleItems();
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
			const items = this.getVisibleItems();
			if (items.length === 0) return;
			this.selectedIndex = Math.min(items.length - 1, this.selectedIndex + 1);
			if (this.selectedIndex >= this.scrollOffset + this.ITEMS_PER_PAGE) this.scrollOffset = this.selectedIndex - this.ITEMS_PER_PAGE + 1;
		}
		this.updateUI();
	}

	private getVisibleItems(): any[] {
		switch (this.viewMode) {
			case 'jobs': return this.learnedJobs;
			case 'skills': return this.jobSkills;
			case 'available': return this.availableJobs;
			default: return [];
		}
	}

	private selectItem(): void {
		if (!this._isActive) return;
		if (this.actionMenuVisible) {
			const opt = this.actionMenuOptions[this.selectedIndex];
			if (opt?.enabled) opt.action();
			return;
		}
		if (this.viewMode === 'jobs') {
			const selected = this.learnedJobs[this.selectedIndex];
			if (selected) this.viewJobDetails(selected.jobId);
		} else if (this.viewMode === 'available') {
			const selected = this.availableJobs[this.selectedIndex];
			if (selected) this.openLearnJobMenu(selected);
		}
	}

	private viewJobDetails(jobId: string): void {
		this.selectedJobId = jobId;
		this.jobSkills = dataLoader.getSkillsForJob(jobId);
		this.viewMode = 'skills';
		this.selectedIndex = 0;
		this.scrollOffset = 0;
		// Re-render the whole overlay for new view mode
		const sm = EnhancedSceneManager.getInstance();
		const overlay = (sm as any).overlayContainer as HTMLDivElement | null;
		if (overlay) {
			overlay.innerHTML = '';
			const el = this.renderHTML();
			overlay.appendChild(el);
			this.onHTMLMounted(el);
		}
	}

	private openLearnJobMenu(job: JobData): void {
		this.actionMenuVisible = true;
		this.selectedIndex = 0;
		const hasCert = this.hasJobCertificate(job.id);
		this.actionMenuOptions = [
			{ text: 'Learn Job', action: () => this.onLearnJob(job), enabled: hasCert && !this.isJobLearned(job.id) },
			{ text: 'Cancel', action: () => this.closeActionMenu(), enabled: true },
		];
		this.updateUI();
	}

	private closeActionMenu(): void {
		this.actionMenuVisible = false;
		this.selectedIndex = 0;
		this.actionMenuOptions = [];
		this.updateUI();
	}

	private onLearnJob(job: JobData): void {
		try {
			const certId = job.requirements?.certificateId;
			if (!certId) return;
			const certificate = inventoryManager.findItem(certId);
			if (!certificate) return;
			jobManager.learnJob(job.id, certId);
			inventoryManager.removeItem(certificate.id, 1);
			this.updateLearnedJobs();
			this.updateAvailableJobs();
			this.closeActionMenu();
			gameStateManager.saveGame();
		} catch (error) { console.error('[JobScene] Learn job error:', error); }
	}

	private hasJobCertificate(jobId: string): boolean {
		const job = dataLoader.getJob(jobId);
		if (!job?.requirements?.certificateId) return false;
		return inventoryManager.findItem(job.requirements.certificateId) !== null;
	}

	private isJobLearned(jobId: string): boolean {
		return jobManager.hasJob(jobId);
	}

	private cycleViewMode(): void {
		if (!this._isActive) return;
		if (this.viewMode === 'skills') {
			this.viewMode = 'jobs';
			this.selectedJobId = null;
			this.jobSkills = [];
		} else if (this.viewMode === 'jobs') {
			this.viewMode = 'available';
		} else {
			this.viewMode = 'jobs';
		}
		this.selectedIndex = 0;
		this.scrollOffset = 0;
		// Re-render for view mode change
		const sm = EnhancedSceneManager.getInstance();
		const overlay = (sm as any).overlayContainer as HTMLDivElement | null;
		if (overlay) {
			overlay.innerHTML = '';
			const el = this.renderHTML();
			overlay.appendChild(el);
			this.onHTMLMounted(el);
		}
	}

	private updateLearnedJobs(): void {
		this.learnedJobs = jobManager.getAllLearnedJobs().map(j => ({ jobId: j.jobId, level: j.level, exp: j.experience }));
	}

	private updateAvailableJobs(): void {
		this.availableJobs = dataLoader.getAllJobs().filter(j => !this.isJobLearned(j.id));
	}

	private onBack(): void {
		if (!this._isActive) return;
		if (this.actionMenuVisible) { this.closeActionMenu(); return; }
		if (this.viewMode === 'skills') {
			this.viewMode = 'jobs';
			this.selectedJobId = null;
			this.jobSkills = [];
			this.selectedIndex = 0;
			this.scrollOffset = 0;
			const sm = EnhancedSceneManager.getInstance();
			const overlay = (sm as any).overlayContainer as HTMLDivElement | null;
			if (overlay) { overlay.innerHTML = ''; overlay.appendChild(this.renderHTML()); this.onHTMLMounted(overlay.lastChild as HTMLElement); }
			return;
		}
		const sm = EnhancedSceneManager.getInstance();
		sm.pop({ type: 'fade', duration: 200 });
	}

	override update(deltaTime: number): void {}

	override onEnter(): void {
		super.onEnter();
		this.setupInput();
		this.updateLearnedJobs();
		this.updateAvailableJobs();
		console.log('[JobScene] Entered');
	}

	override onExit(): void {
		super.onExit();
		this.cleanupKeyboard();
		console.log('[JobScene] Exited');
	}

	override destroy(): void {
		this.onExit();
	}
}
