/**
 * Job UI
 * HTML/CSS-based job management window
 */

import type { JobManager, Job, LearnedJob } from '../jobs/JobManager';

export interface JobUIConfig {
	container: HTMLElement;
	jobManager: JobManager;
	onJobLearn?: (jobId: string) => void;
}

export class JobUI {
	private container: HTMLElement;
	private jobManager: JobManager;
	private onJobLearn?: (jobId: string) => void;

	private window: HTMLElement | null = null;
	private isVisible: boolean = false;
	private selectedJobId: string | null = null;

	constructor(config: JobUIConfig) {
		this.container = config.container;
		this.jobManager = config.jobManager;
		this.onJobLearn = config.onJobLearn;

		this.createUI();
		this.setupEventListeners();
	}

	/**
	 * Create job UI
	 */
	private createUI(): void {
		this.window = document.createElement('div');
		this.window.className = 'job-window';
		this.window.style.display = 'none';
		this.window.innerHTML = `
			<div class="job-header">
				<h2>Jobs</h2>
				<button class="close-btn">&times;</button>
			</div>
			<div class="job-content">
				<div class="job-left">
					<h3>Learned Jobs</h3>
					<div class="learned-jobs-list" id="learned-jobs">
						<!-- Learned jobs will be listed here -->
					</div>
					<h3>Available Jobs</h3>
					<div class="available-jobs-list" id="available-jobs">
						<!-- Available jobs will be listed here -->
					</div>
				</div>
				<div class="job-right">
					<div class="job-details" id="job-details">
						<p class="placeholder">Select a job to view details</p>
					</div>
				</div>
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

		// Job manager events
		this.jobManager.on('job-learned', () => this.render());
		this.jobManager.on('job-level-up', () => this.render());
		this.jobManager.on('skill-unlocked', () => this.render());
	}

	/**
	 * Show job window
	 */
	show(): void {
		if (!this.window) return;
		this.window.style.display = 'block';
		this.isVisible = true;
		this.render();
	}

	/**
	 * Hide job window
	 */
	hide(): void {
		if (!this.window) return;
		this.window.style.display = 'none';
		this.isVisible = false;
	}

	/**
	 * Toggle job window
	 */
	toggle(): void {
		if (this.isVisible) {
			this.hide();
		} else {
			this.show();
		}
	}

	/**
	 * Render job lists
	 */
	private render(): void {
		if (!this.window) return;

		this.renderLearnedJobs();
		this.renderAvailableJobs();

		// Refresh details if a job is selected
		if (this.selectedJobId) {
			this.showJobDetails(this.selectedJobId);
		}
	}

	/**
	 * Render learned jobs
	 */
	private renderLearnedJobs(): void {
		const container = this.window?.querySelector('#learned-jobs');
		if (!container) return;

		const learnedJobs = this.jobManager.getAllLearnedJobs();

		if (learnedJobs.length === 0) {
			container.innerHTML = '<p class="empty-message">No jobs learned yet</p>';
			return;
		}

		container.innerHTML = learnedJobs
			.map((learnedJob) => {
				const job = this.jobManager.getJob(learnedJob.jobId);
				if (!job) return '';

				const expNeeded = 100 * (learnedJob.level + 1);
				const expPercent = (learnedJob.experience / expNeeded) * 100;

				return `
					<div class="job-item learned" data-job-id="${job.id}">
						<div class="job-icon">${job.icon}</div>
						<div class="job-info">
							<div class="job-name">${job.name}</div>
							<div class="job-level">Lv. ${learnedJob.level}</div>
							<div class="job-exp-bar">
								<div class="exp-fill" style="width: ${expPercent}%"></div>
							</div>
							<div class="job-exp-text">${learnedJob.experience}/${expNeeded} EXP</div>
						</div>
					</div>
				`;
			})
			.join('');

		// Add click handlers
		container.querySelectorAll('.job-item').forEach((el) => {
			el.addEventListener('click', () => {
				const jobId = (el as HTMLElement).dataset.jobId;
				if (jobId) this.showJobDetails(jobId);
			});
		});
	}

	/**
	 * Render available jobs
	 */
	private renderAvailableJobs(): void {
		const container = this.window?.querySelector('#available-jobs');
		if (!container) return;

		const availableJobs = this.jobManager.getAvailableJobsToLearn();

		if (availableJobs.length === 0) {
			container.innerHTML = '<p class="empty-message">No jobs available to learn</p>';
			return;
		}

		container.innerHTML = availableJobs
			.map((job) => {
				let requirements = `Level ${job.requirements.level}`;
				if (job.requirements.prerequisiteJobs && job.requirements.prerequisiteJobs.length > 0) {
					const prereqs = job.requirements.prerequisiteJobs
						.map((id) => this.jobManager.getJob(id)?.name || id)
						.join(', ');
					requirements += ` | Requires: ${prereqs}`;
				}

				return `
					<div class="job-item available" data-job-id="${job.id}">
						<div class="job-icon">${job.icon}</div>
						<div class="job-info">
							<div class="job-name">${job.name}</div>
							<div class="job-requirements">${requirements}</div>
						</div>
					</div>
				`;
			})
			.join('');

		// Add click handlers
		container.querySelectorAll('.job-item').forEach((el) => {
			el.addEventListener('click', () => {
				const jobId = (el as HTMLElement).dataset.jobId;
				if (jobId) this.showJobDetails(jobId);
			});
		});
	}

	/**
	 * Show job details
	 */
	private showJobDetails(jobId: string): void {
		const container = this.window?.querySelector('#job-details');
		if (!container) return;

		this.selectedJobId = jobId;

		const job = this.jobManager.getJob(jobId);
		if (!job) return;

		const learnedJob = this.jobManager.getLearnedJob(jobId);
		const isLearned = this.jobManager.hasJob(jobId);

		// Calculate total stats
		const totalStats = isLearned && learnedJob
			? {
				hp: job.baseStats.hp + job.statGrowth.hp * (learnedJob.level - 1),
				mp: job.baseStats.mp + job.statGrowth.mp * (learnedJob.level - 1),
				atk: job.baseStats.atk + job.statGrowth.atk * (learnedJob.level - 1),
				def: job.baseStats.def + job.statGrowth.def * (learnedJob.level - 1),
				spd: job.baseStats.spd + job.statGrowth.spd * (learnedJob.level - 1),
				luck: job.baseStats.luck + job.statGrowth.luck * (learnedJob.level - 1),
			}
			: job.baseStats;

		container.innerHTML = `
			<div class="job-detail-header">
				<div class="job-detail-icon">${job.icon}</div>
				<div class="job-detail-title">
					<h3>${job.name}</h3>
					${isLearned ? `<span class="badge-learned">Learned</span>` : `<span class="badge-available">Available</span>`}
				</div>
			</div>
			<div class="job-description">${job.description}</div>

			<h4>Stats ${isLearned && learnedJob ? `(Level ${learnedJob.level})` : '(Base)'}</h4>
			<div class="job-stats">
				<div class="stat-item">HP: ${totalStats.hp}</div>
				<div class="stat-item">MP: ${totalStats.mp}</div>
				<div class="stat-item">ATK: ${totalStats.atk}</div>
				<div class="stat-item">DEF: ${totalStats.def}</div>
				<div class="stat-item">SPD: ${totalStats.spd}</div>
				<div class="stat-item">LUCK: ${totalStats.luck}</div>
			</div>

			<h4>Skills</h4>
			<div class="job-skills">
				${job.skills
					.map((skill) => {
						const unlocked = learnedJob?.unlockedSkills.includes(skill.skillId) || false;
						return `
						<div class="skill-item ${unlocked ? 'unlocked' : 'locked'}">
							<div class="skill-name">${skill.skillId}</div>
							<div class="skill-learn">Lv. ${skill.learnLevel}</div>
							${unlocked ? '<span class="skill-status">✓</span>' : ''}
						</div>
					`;
					})
					.join('')}
			</div>

			<h4>Passive Abilities</h4>
			<div class="job-passives">
				${job.passiveAbilities
					.map((ability) => {
						return `
						<div class="passive-item ${isLearned ? 'active' : ''}">
							<div class="passive-name">${ability.name}</div>
							<div class="passive-description">${ability.description}</div>
						</div>
					`;
					})
					.join('')}
			</div>

			${!isLearned
				? `
				<button class="learn-job-btn" data-job-id="${job.id}">
					Learn Job (Requires ${job.requirements.certificateId})
				</button>
			`
				: ''}
		`;

		// Add learn button handler
		if (!isLearned) {
			const learnBtn = container.querySelector('.learn-job-btn');
			learnBtn?.addEventListener('click', () => {
				this.onJobLearn?.(jobId);
			});
		}
	}

	/**
	 * Apply CSS styles
	 */
	private applyStyles(): void {
		const style = document.createElement('style');
		style.textContent = `
			.job-window {
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
				display: flex;
				flex-direction: column;
			}

			.job-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 10px 20px;
				background: rgba(0, 0, 0, 0.3);
				border-bottom: 2px solid #444;
			}

			.job-content {
				display: flex;
				flex: 1;
				overflow: hidden;
			}

			.job-left {
				width: 350px;
				padding: 20px;
				overflow-y: auto;
				border-right: 2px solid #444;
			}

			.job-right {
				flex: 1;
				padding: 20px;
				overflow-y: auto;
			}

			.job-left h3 {
				margin: 20px 0 10px 0;
				color: #4CAF50;
				font-size: 16px;
			}

			.job-left h3:first-child {
				margin-top: 0;
			}

			.learned-jobs-list,
			.available-jobs-list {
				display: flex;
				flex-direction: column;
				gap: 10px;
			}

			.job-item {
				display: flex;
				gap: 10px;
				padding: 10px;
				background: rgba(255, 255, 255, 0.05);
				border: 2px solid #333;
				border-radius: 4px;
				cursor: pointer;
				transition: all 0.2s;
			}

			.job-item:hover {
				background: rgba(255, 255, 255, 0.1);
				border-color: #4CAF50;
			}

			.job-item.learned {
				border-color: #4CAF50;
			}

			.job-icon {
				font-size: 32px;
				width: 40px;
				height: 40px;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.job-info {
				flex: 1;
			}

			.job-name {
				font-weight: bold;
				font-size: 14px;
			}

			.job-level {
				font-size: 12px;
				color: #4CAF50;
			}

			.job-requirements {
				font-size: 11px;
				color: #aaa;
			}

			.job-exp-bar {
				height: 4px;
				background: rgba(255, 255, 255, 0.1);
				border-radius: 2px;
				margin-top: 5px;
				overflow: hidden;
			}

			.exp-fill {
				height: 100%;
				background: #4CAF50;
				transition: width 0.3s;
			}

			.job-exp-text {
				font-size: 10px;
				color: #888;
				margin-top: 2px;
			}

			.empty-message {
				color: #888;
				font-style: italic;
				font-size: 12px;
			}

			.job-details {
				color: white;
			}

			.job-detail-header {
				display: flex;
				gap: 15px;
				align-items: center;
				margin-bottom: 15px;
			}

			.job-detail-icon {
				font-size: 48px;
			}

			.job-detail-title h3 {
				margin: 0;
			}

			.badge-learned {
				display: inline-block;
				padding: 2px 8px;
				background: #4CAF50;
				color: white;
				font-size: 11px;
				border-radius: 3px;
				margin-left: 10px;
			}

			.badge-available {
				display: inline-block;
				padding: 2px 8px;
				background: #2196F3;
				color: white;
				font-size: 11px;
				border-radius: 3px;
				margin-left: 10px;
			}

			.job-description {
				color: #ccc;
				margin-bottom: 20px;
				font-size: 14px;
			}

			.job-details h4 {
				margin: 15px 0 10px 0;
				color: #4CAF50;
				font-size: 14px;
			}

			.job-stats {
				display: grid;
				grid-template-columns: repeat(3, 1fr);
				gap: 8px;
				margin-bottom: 15px;
			}

			.stat-item {
				background: rgba(255, 255, 255, 0.05);
				padding: 8px;
				border-radius: 4px;
				font-size: 13px;
			}

			.job-skills {
				display: flex;
				flex-direction: column;
				gap: 5px;
			}

			.skill-item {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 8px;
				background: rgba(255, 255, 255, 0.05);
				border-radius: 4px;
				font-size: 12px;
			}

			.skill-item.unlocked {
				background: rgba(76, 175, 80, 0.2);
				border: 1px solid #4CAF50;
			}

			.skill-item.locked {
				opacity: 0.5;
			}

			.skill-status {
				color: #4CAF50;
				font-weight: bold;
			}

			.job-passives {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}

			.passive-item {
				padding: 10px;
				background: rgba(255, 255, 255, 0.05);
				border-radius: 4px;
			}

			.passive-item.active {
				background: rgba(76, 175, 80, 0.15);
				border: 1px solid #4CAF50;
			}

			.passive-name {
				font-weight: bold;
				font-size: 13px;
				margin-bottom: 5px;
			}

			.passive-description {
				font-size: 12px;
				color: #ccc;
			}

			.learn-job-btn {
				margin-top: 20px;
				width: 100%;
				padding: 12px;
				background: #4CAF50;
				color: white;
				border: none;
				border-radius: 4px;
				font-size: 14px;
				font-weight: bold;
				cursor: pointer;
				transition: background 0.2s;
			}

			.learn-job-btn:hover {
				background: #45a049;
			}

			.placeholder {
				color: #888;
				text-align: center;
				margin-top: 50px;
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
