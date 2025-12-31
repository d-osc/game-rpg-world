/**
 * Job Example
 * Example of how to use the multi-job system with UI
 */

import { JobManager } from '../jobs/JobManager';
import { JobUI } from '../ui/JobUI';
import type { Job } from '../jobs/JobManager';
import type { InventoryManager } from '../inventory/InventoryManager';

export class JobExample {
	private jobManager: JobManager;
	private ui: JobUI;
	private inventoryManager: InventoryManager;

	constructor(inventoryManager: InventoryManager) {
		this.inventoryManager = inventoryManager;

		// Create job manager
		this.jobManager = new JobManager();

		// Create UI
		this.ui = new JobUI({
			container: document.body,
			jobManager: this.jobManager,
			onJobLearn: (jobId) => this.handleJobLearn(jobId),
		});

		// Setup event listeners
		this.setupEventListeners();
	}

	/**
	 * Load job data from JSON
	 */
	async loadJobs(): Promise<void> {
		try {
			// Load job definitions (in a real app, load from JSON files)
			const jobs: Job[] = await this.fetchJobsFromServer();

			this.jobManager.loadJobs(jobs);
		} catch (error) {
			console.error('[JobExample] Failed to load jobs:', error);
		}
	}

	/**
	 * Fetch jobs from server (placeholder)
	 */
	private async fetchJobsFromServer(): Promise<Job[]> {
		// TODO: Fetch from packages/data/jobs/*.json
		// For now, return empty array
		return [];
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		// Job learned
		this.jobManager.on('job-learned', (jobId) => {
			console.log('[JobExample] Job learned:', jobId);
			this.showNotification(`Learned ${jobId}!`, 'success');
		});

		// Job level up
		this.jobManager.on('job-level-up', (jobId, newLevel) => {
			console.log('[JobExample] Job level up:', jobId, 'Level', newLevel);
			this.showNotification(`${jobId} reached level ${newLevel}!`, 'success');
		});

		// Skill unlocked
		this.jobManager.on('skill-unlocked', (jobId, skillId) => {
			console.log('[JobExample] Skill unlocked:', skillId, 'from', jobId);
			this.showNotification(`Unlocked skill: ${skillId}!`, 'info');
		});

		// Stats changed
		this.jobManager.on('stats-changed', (totalStats) => {
			console.log('[JobExample] Total stats:', totalStats);
		});
	}

	/**
	 * Handle job learn request
	 */
	private handleJobLearn(jobId: string): void {
		const job = this.jobManager.getJob(jobId);
		if (!job) return;

		const certificateId = job.requirements.certificateId;

		// Check if player has the certificate in inventory
		const hasInInventory = this.inventoryManager.hasItem(certificateId);

		if (!hasInInventory) {
			this.showNotification(
				`You need a ${certificateId.replace('_', ' ')} to learn this job!`,
				'error',
			);
			return;
		}

		// Use the certificate (remove from inventory)
		const removed = this.inventoryManager.removeItem(certificateId, 1);

		if (!removed) {
			this.showNotification('Failed to use certificate!', 'error');
			return;
		}

		// Learn the job
		const learned = this.jobManager.learnJob(jobId, certificateId);

		if (learned) {
			this.showNotification(`Successfully learned ${job.name}!`, 'success');
		} else {
			// Return certificate if learning failed
			this.inventoryManager.addItem(
				{
					id: certificateId,
					name: certificateId.replace('_', ' '),
					description: '',
					type: 'quest',
					rarity: 'common',
					value: 0,
					weight: 0.1,
					stackable: true,
					maxStack: 1,
				},
				1,
			);
			this.showNotification('Failed to learn job!', 'error');
		}
	}

	/**
	 * Add job experience (example: after combat)
	 */
	addExperience(jobId: string, exp: number): void {
		this.jobManager.addJobExperience(jobId, exp);
	}

	/**
	 * Show notification
	 */
	private showNotification(message: string, type: 'info' | 'error' | 'success' = 'info'): void {
		const notif = document.createElement('div');
		notif.className = `notification notification-${type}`;
		notif.textContent = message;
		notif.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			padding: 15px 20px;
			border-radius: 4px;
			color: white;
			z-index: 10000;
			font-family: Arial, sans-serif;
			background: ${
				type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'
			};
		`;

		document.body.appendChild(notif);

		setTimeout(() => {
			notif.remove();
		}, 3000);
	}

	/**
	 * Show job UI
	 */
	show(): void {
		this.ui.show();
	}

	/**
	 * Hide job UI
	 */
	hide(): void {
		this.ui.hide();
	}

	/**
	 * Toggle job UI
	 */
	toggle(): void {
		this.ui.toggle();
	}

	/**
	 * Get job manager (for external use)
	 */
	getJobManager(): JobManager {
		return this.jobManager;
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.ui.destroy();
	}
}

/**
 * Usage Example:
 *
 * ```typescript
 * import { JobExample } from '@rpg/game-core';
 * import { InventoryManager } from '@rpg/game-core';
 *
 * // Create inventory manager
 * const inventory = new InventoryManager();
 *
 * // Create job system
 * const jobSystem = new JobExample(inventory);
 *
 * // Load jobs
 * await jobSystem.loadJobs();
 *
 * // Give player a job certificate
 * inventory.addItem({
 *   id: 'warrior_certificate',
 *   name: "Warrior's Certificate",
 *   description: 'Learn the Warrior job',
 *   type: 'quest',
 *   rarity: 'common',
 *   value: 100,
 *   weight: 0.1,
 *   stackable: true,
 *   maxStack: 1,
 * });
 *
 * // Show UI (press 'J' key)
 * document.addEventListener('keydown', (e) => {
 *   if (e.key === 'j' || e.key === 'J') {
 *     jobSystem.toggle();
 *   }
 * });
 *
 * // After combat, add job experience
 * jobSystem.addExperience('warrior', 50);
 *
 * // Get all available skills
 * const skills = jobSystem.getJobManager().getAllAvailableSkills();
 * console.log('Available skills:', skills);
 *
 * // Check passive abilities
 * const passives = jobSystem.getJobManager().getAllPassiveAbilities();
 * console.log('Active passives:', passives);
 *
 * // Apply passive effects (example: damage bonus)
 * const baseDamage = 100;
 * const modifiedDamage = jobSystem.getJobManager().applyPassiveEffects(
 *   'damage_bonus',
 *   baseDamage,
 *   { category: 'physical' }
 * );
 * console.log('Modified damage:', modifiedDamage);
 * ```
 */
