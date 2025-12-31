/**
 * JobManager
 * Multi-job system - learn and use skills from multiple jobs simultaneously
 */

import { EventEmitter } from '../utils/EventEmitter';

export interface JobStats {
	hp: number;
	mp: number;
	atk: number;
	def: number;
	spd: number;
	luck: number;
}

export interface JobSkill {
	skillId: string;
	learnLevel: number;
	description: string;
}

export interface PassiveAbility {
	id: string;
	name: string;
	description: string;
	effect: {
		type: string;
		category?: string;
		stat?: string;
		value: number;
		feature?: string;
		weaponType?: string;
	};
}

export interface Job {
	id: string;
	name: string;
	description: string;
	icon: string;
	baseStats: JobStats;
	statGrowth: JobStats;
	skills: JobSkill[];
	passiveAbilities: PassiveAbility[];
	equipmentRestrictions: {
		weapons: string[];
		armor: string[];
	};
	craftingRecipes?: string[];
	requirements: {
		baseJob: boolean;
		level: number;
		prerequisiteJobs?: string[];
		certificateId: string;
	};
}

export interface LearnedJob {
	jobId: string;
	level: number;
	experience: number;
	learnedAt: number;
	unlockedSkills: string[];
}

export interface JobManagerEvents {
	'job-learned': (jobId: string) => void;
	'job-level-up': (jobId: string, newLevel: number) => void;
	'skill-unlocked': (jobId: string, skillId: string) => void;
	'stats-changed': (totalStats: JobStats) => void;
	'passive-activated': (abilityId: string) => void;
}

export class JobManager extends EventEmitter<JobManagerEvents> {
	private learnedJobs: Map<string, LearnedJob> = new Map();
	private availableJobs: Map<string, Job> = new Map();
	private playerLevel: number = 1;

	constructor() {
		super();
	}

	/**
	 * Load job definitions
	 */
	loadJobs(jobs: Job[]): void {
		for (const job of jobs) {
			this.availableJobs.set(job.id, job);
		}
	}

	/**
	 * Learn a new job (using job certificate)
	 */
	learnJob(jobId: string, certificateItemId: string): boolean {
		const job = this.availableJobs.get(jobId);
		if (!job) {
			console.error(`[JobManager] Job not found: ${jobId}`);
			return false;
		}

		// Check if already learned
		if (this.learnedJobs.has(jobId)) {
			console.warn(`[JobManager] Job already learned: ${jobId}`);
			return false;
		}

		// Check certificate
		if (job.requirements.certificateId !== certificateItemId) {
			console.error(`[JobManager] Invalid certificate for job: ${jobId}`);
			return false;
		}

		// Check player level
		if (this.playerLevel < job.requirements.level) {
			console.error(`[JobManager] Player level too low for job: ${jobId}`);
			return false;
		}

		// Check prerequisites
		if (job.requirements.prerequisiteJobs) {
			for (const prereqJobId of job.requirements.prerequisiteJobs) {
				if (!this.learnedJobs.has(prereqJobId)) {
					console.error(`[JobManager] Prerequisite job not learned: ${prereqJobId}`);
					return false;
				}
			}
		}

		// Learn the job
		const learnedJob: LearnedJob = {
			jobId,
			level: 1,
			experience: 0,
			learnedAt: Date.now(),
			unlockedSkills: [],
		};

		this.learnedJobs.set(jobId, learnedJob);

		// Unlock level 1 skills
		this.unlockSkillsForLevel(jobId, 1);

		// Emit event
		this.emit('job-learned', jobId);
		this.emit('stats-changed', this.calculateTotalStats());

		return true;
	}

	/**
	 * Add experience to a job
	 */
	addJobExperience(jobId: string, exp: number): void {
		const learnedJob = this.learnedJobs.get(jobId);
		if (!learnedJob) return;

		const job = this.availableJobs.get(jobId);
		if (!job) return;

		learnedJob.experience += exp;

		// Check for level up (simple formula: 100 * level)
		const expNeeded = this.getExpNeededForLevel(learnedJob.level + 1);
		if (learnedJob.experience >= expNeeded) {
			learnedJob.level++;
			learnedJob.experience -= expNeeded;

			// Unlock new skills
			this.unlockSkillsForLevel(jobId, learnedJob.level);

			this.emit('job-level-up', jobId, learnedJob.level);
			this.emit('stats-changed', this.calculateTotalStats());
		}
	}

	/**
	 * Get experience needed for a level
	 */
	private getExpNeededForLevel(level: number): number {
		return 100 * level;
	}

	/**
	 * Unlock skills for a specific level
	 */
	private unlockSkillsForLevel(jobId: string, level: number): void {
		const learnedJob = this.learnedJobs.get(jobId);
		const job = this.availableJobs.get(jobId);
		if (!learnedJob || !job) return;

		for (const jobSkill of job.skills) {
			if (jobSkill.learnLevel === level) {
				if (!learnedJob.unlockedSkills.includes(jobSkill.skillId)) {
					learnedJob.unlockedSkills.push(jobSkill.skillId);
					this.emit('skill-unlocked', jobId, jobSkill.skillId);
				}
			}
		}
	}

	/**
	 * Get all available skills from learned jobs
	 */
	getAllAvailableSkills(): string[] {
		const skills: string[] = [];

		for (const learnedJob of this.learnedJobs.values()) {
			skills.push(...learnedJob.unlockedSkills);
		}

		// Remove duplicates
		return [...new Set(skills)];
	}

	/**
	 * Calculate total stats from all learned jobs
	 */
	calculateTotalStats(): JobStats {
		const totalStats: JobStats = {
			hp: 0,
			mp: 0,
			atk: 0,
			def: 0,
			spd: 0,
			luck: 0,
		};

		for (const learnedJob of this.learnedJobs.values()) {
			const job = this.availableJobs.get(learnedJob.jobId);
			if (!job) continue;

			// Add base stats
			totalStats.hp += job.baseStats.hp;
			totalStats.mp += job.baseStats.mp;
			totalStats.atk += job.baseStats.atk;
			totalStats.def += job.baseStats.def;
			totalStats.spd += job.baseStats.spd;
			totalStats.luck += job.baseStats.luck;

			// Add stat growth per level (level - 1 because level 1 is base)
			const levelGrowth = learnedJob.level - 1;
			totalStats.hp += job.statGrowth.hp * levelGrowth;
			totalStats.mp += job.statGrowth.mp * levelGrowth;
			totalStats.atk += job.statGrowth.atk * levelGrowth;
			totalStats.def += job.statGrowth.def * levelGrowth;
			totalStats.spd += job.statGrowth.spd * levelGrowth;
			totalStats.luck += job.statGrowth.luck * levelGrowth;
		}

		return totalStats;
	}

	/**
	 * Get all active passive abilities
	 */
	getAllPassiveAbilities(): PassiveAbility[] {
		const abilities: PassiveAbility[] = [];

		for (const learnedJob of this.learnedJobs.values()) {
			const job = this.availableJobs.get(learnedJob.jobId);
			if (!job) continue;

			abilities.push(...job.passiveAbilities);
		}

		return abilities;
	}

	/**
	 * Check if player can use a weapon type
	 */
	canUseWeapon(weaponType: string): boolean {
		for (const learnedJob of this.learnedJobs.values()) {
			const job = this.availableJobs.get(learnedJob.jobId);
			if (!job) continue;

			if (job.equipmentRestrictions.weapons.includes(weaponType)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if player can use an armor type
	 */
	canUseArmor(armorType: string): boolean {
		for (const learnedJob of this.learnedJobs.values()) {
			const job = this.availableJobs.get(learnedJob.jobId);
			if (!job) continue;

			if (job.equipmentRestrictions.armor.includes(armorType)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Get all crafting recipes from learned jobs
	 */
	getAllCraftingRecipes(): string[] {
		const recipes: string[] = [];

		for (const learnedJob of this.learnedJobs.values()) {
			const job = this.availableJobs.get(learnedJob.jobId);
			if (!job || !job.craftingRecipes) continue;

			recipes.push(...job.craftingRecipes);
		}

		return [...new Set(recipes)];
	}

	/**
	 * Get job details
	 */
	getJob(jobId: string): Job | undefined {
		return this.availableJobs.get(jobId);
	}

	/**
	 * Get learned job details
	 */
	getLearnedJob(jobId: string): LearnedJob | undefined {
		return this.learnedJobs.get(jobId);
	}

	/**
	 * Get all learned jobs
	 */
	getAllLearnedJobs(): LearnedJob[] {
		return Array.from(this.learnedJobs.values());
	}

	/**
	 * Check if job is learned
	 */
	hasJob(jobId: string): boolean {
		return this.learnedJobs.has(jobId);
	}

	/**
	 * Get jobs available to learn
	 */
	getAvailableJobsToLearn(): Job[] {
		const available: Job[] = [];

		for (const job of this.availableJobs.values()) {
			// Skip if already learned
			if (this.learnedJobs.has(job.id)) continue;

			// Check player level
			if (this.playerLevel < job.requirements.level) continue;

			// Check prerequisites
			if (job.requirements.prerequisiteJobs) {
				let hasAllPrereqs = true;
				for (const prereqJobId of job.requirements.prerequisiteJobs) {
					if (!this.learnedJobs.has(prereqJobId)) {
						hasAllPrereqs = false;
						break;
					}
				}
				if (!hasAllPrereqs) continue;
			}

			available.push(job);
		}

		return available;
	}

	/**
	 * Set player level (affects job requirements)
	 */
	setPlayerLevel(level: number): void {
		this.playerLevel = level;
	}

	/**
	 * Get player level
	 */
	getPlayerLevel(): number {
		return this.playerLevel;
	}

	/**
	 * Apply passive ability effects
	 */
	applyPassiveEffects(
		context: string,
		baseValue: number,
		options?: {
			category?: string;
			stat?: string;
			weaponType?: string;
		},
	): number {
		let modifiedValue = baseValue;
		const abilities = this.getAllPassiveAbilities();

		for (const ability of abilities) {
			const effect = ability.effect;

			// Match context and options
			if (effect.type === context) {
				// Check category if specified
				if (effect.category && options?.category !== effect.category) continue;

				// Check stat if specified
				if (effect.stat && options?.stat !== effect.stat) continue;

				// Check weapon type if specified
				if (effect.weaponType && options?.weaponType !== effect.weaponType) continue;

				// Apply the effect
				if (context.includes('bonus') || context.includes('increase')) {
					modifiedValue *= 1 + effect.value;
				} else if (context.includes('reduction') || context.includes('cost')) {
					modifiedValue *= 1 - effect.value;
				}

				this.emit('passive-activated', ability.id);
			}
		}

		return Math.floor(modifiedValue);
	}

	/**
	 * Check if feature is unlocked
	 */
	hasFeature(featureName: string): boolean {
		const abilities = this.getAllPassiveAbilities();

		for (const ability of abilities) {
			if (
				ability.effect.type === 'feature_unlock' &&
				ability.effect.feature === featureName
			) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Export job data for save
	 */
	export(): any {
		return {
			learnedJobs: Array.from(this.learnedJobs.entries()),
			playerLevel: this.playerLevel,
		};
	}

	/**
	 * Import job data from save
	 */
	import(data: any): void {
		if (data.learnedJobs) {
			this.learnedJobs = new Map(data.learnedJobs);
		}

		if (data.playerLevel !== undefined) {
			this.playerLevel = data.playerLevel;
		}

		// Recalculate stats
		this.emit('stats-changed', this.calculateTotalStats());
	}

	/**
	 * Clear all jobs (for logout/reset)
	 */
	clear(): void {
		this.learnedJobs.clear();
		this.playerLevel = 1;
	}
}
