/**
 * Tutorial Manager
 * Guides new players through game features
 */

export interface TutorialStep {
	id: string;
	title: string;
	description: string;
	objective: string;
	completed: boolean;
	prerequisite?: string; // Previous step ID
	trigger?: TutorialTrigger;
	reward?: TutorialReward;
}

export interface TutorialTrigger {
	type: 'movement' | 'combat' | 'inventory' | 'job' | 'craft' | 'trade' | 'custom';
	condition?: any;
}

export interface TutorialReward {
	exp?: number;
	gold?: number;
	items?: Array<{ id: string; quantity: number }>;
}

export class TutorialManager {
	private steps: Map<string, TutorialStep> = new Map();
	private completedSteps: Set<string> = new Set();
	private currentStep: TutorialStep | null = null;
	private enabled: boolean = true;
	private onStepComplete?: (step: TutorialStep) => void;
	private onStepStart?: (step: TutorialStep) => void;

	constructor() {
		this.initializeTutorialSteps();
	}

	/**
	 * Initialize tutorial steps
	 */
	private initializeTutorialSteps(): void {
		const steps: TutorialStep[] = [
			{
				id: 'welcome',
				title: 'Welcome to the World',
				description: 'Welcome, adventurer! Let me guide you through your journey.',
				objective: 'Click anywhere to continue',
				completed: false,
			},
			{
				id: 'movement',
				title: 'Learn to Move',
				description:
					'Use WASD keys or Arrow keys to move your character around the world.',
				objective: 'Move your character in all 4 directions',
				completed: false,
				prerequisite: 'welcome',
				trigger: { type: 'movement' },
				reward: { exp: 10 },
			},
			{
				id: 'open_inventory',
				title: 'Your Inventory',
				description: 'Press I to open your inventory. This is where you store items.',
				objective: 'Open your inventory (Press I)',
				completed: false,
				prerequisite: 'movement',
				trigger: { type: 'inventory' },
				reward: { exp: 15 },
			},
			{
				id: 'first_combat',
				title: 'Your First Battle',
				description:
					'Time to test your skills! Approach a monster and click to engage in combat.',
				objective: 'Win your first battle',
				completed: false,
				prerequisite: 'open_inventory',
				trigger: { type: 'combat' },
				reward: { exp: 50, gold: 20, items: [{ id: 'health_potion', quantity: 3 }] },
			},
			{
				id: 'use_skill',
				title: 'Use a Skill',
				description: 'Skills are powerful abilities. Try using a skill in combat.',
				objective: 'Use any skill in battle',
				completed: false,
				prerequisite: 'first_combat',
				trigger: { type: 'combat' },
				reward: { exp: 30 },
			},
			{
				id: 'learn_job',
				title: 'Choose Your Path',
				description:
					'Jobs unlock unique skills and abilities. Find a Job Certificate and learn your first job!',
				objective: 'Learn your first job',
				completed: false,
				prerequisite: 'use_skill',
				trigger: { type: 'job' },
				reward: { exp: 100, gold: 50 },
			},
			{
				id: 'craft_item',
				title: 'Crafting Basics',
				description:
					'Gather materials from battles and craft useful items. Open the crafting menu (C).',
				objective: 'Craft any item',
				completed: false,
				prerequisite: 'learn_job',
				trigger: { type: 'craft' },
				reward: { exp: 75, gold: 30 },
			},
			{
				id: 'p2p_trade',
				title: 'Trading with Players',
				description:
					'You can trade items and gold with other players. Try initiating a trade.',
				objective: 'Complete a trade with another player',
				completed: false,
				prerequisite: 'craft_item',
				trigger: { type: 'trade' },
				reward: { exp: 50, gold: 25 },
			},
			{
				id: 'tutorial_complete',
				title: 'Tutorial Complete!',
				description:
					'Congratulations! You have mastered the basics. The world is now yours to explore!',
				objective: 'Continue your adventure',
				completed: false,
				prerequisite: 'p2p_trade',
				reward: {
					exp: 200,
					gold: 100,
					items: [
						{ id: 'health_potion', quantity: 5 },
						{ id: 'mana_potion', quantity: 5 },
					],
				},
			},
		];

		for (const step of steps) {
			this.steps.set(step.id, step);
		}
	}

	/**
	 * Start tutorial system
	 */
	start(): void {
		this.enabled = true;
		this.currentStep = this.steps.get('welcome') || null;

		if (this.currentStep && this.onStepStart) {
			this.onStepStart(this.currentStep);
		}
	}

	/**
	 * Stop tutorial system
	 */
	stop(): void {
		this.enabled = false;
		this.currentStep = null;
	}

	/**
	 * Complete current step
	 */
	completeStep(stepId: string): void {
		const step = this.steps.get(stepId);
		if (!step || step.completed) return;

		step.completed = true;
		this.completedSteps.add(stepId);

		if (this.onStepComplete) {
			this.onStepComplete(step);
		}

		// Move to next step
		this.advanceToNextStep();
	}

	/**
	 * Advance to next step
	 */
	private advanceToNextStep(): void {
		if (!this.enabled) return;

		// Find next uncompleted step
		for (const step of this.steps.values()) {
			if (!step.completed) {
				// Check prerequisite
				if (step.prerequisite && !this.completedSteps.has(step.prerequisite)) {
					continue;
				}

				this.currentStep = step;

				if (this.onStepStart) {
					this.onStepStart(step);
				}

				return;
			}
		}

		// All steps completed
		this.currentStep = null;
	}

	/**
	 * Trigger tutorial step by action
	 */
	triggerAction(type: TutorialTrigger['type'], data?: any): void {
		if (!this.enabled || !this.currentStep) return;

		if (this.currentStep.trigger?.type === type) {
			this.completeStep(this.currentStep.id);
		}
	}

	/**
	 * Skip tutorial
	 */
	skip(): void {
		for (const step of this.steps.values()) {
			step.completed = true;
			this.completedSteps.add(step.id);
		}
		this.currentStep = null;
		this.enabled = false;
	}

	/**
	 * Reset tutorial
	 */
	reset(): void {
		for (const step of this.steps.values()) {
			step.completed = false;
		}
		this.completedSteps.clear();
		this.currentStep = null;
		this.enabled = false;
	}

	/**
	 * Get current step
	 */
	getCurrentStep(): TutorialStep | null {
		return this.currentStep;
	}

	/**
	 * Get completion progress
	 */
	getProgress(): { completed: number; total: number; percentage: number } {
		const total = this.steps.size;
		const completed = this.completedSteps.size;
		const percentage = Math.floor((completed / total) * 100);

		return { completed, total, percentage };
	}

	/**
	 * Check if tutorial is active
	 */
	isActive(): boolean {
		return this.enabled && this.currentStep !== null;
	}

	/**
	 * Check if step is completed
	 */
	isStepCompleted(stepId: string): boolean {
		return this.completedSteps.has(stepId);
	}

	/**
	 * Get all steps
	 */
	getAllSteps(): TutorialStep[] {
		return Array.from(this.steps.values());
	}

	/**
	 * Set step complete callback
	 */
	onComplete(callback: (step: TutorialStep) => void): void {
		this.onStepComplete = callback;
	}

	/**
	 * Set step start callback
	 */
	onStart(callback: (step: TutorialStep) => void): void {
		this.onStepStart = callback;
	}

	/**
	 * Export progress for save
	 */
	export(): any {
		return {
			completedSteps: Array.from(this.completedSteps),
			enabled: this.enabled,
			currentStep: this.currentStep?.id || null,
		};
	}

	/**
	 * Import progress from save
	 */
	import(data: any): void {
		this.completedSteps = new Set(data.completedSteps || []);
		this.enabled = data.enabled || false;

		// Update step completion status
		for (const stepId of this.completedSteps) {
			const step = this.steps.get(stepId);
			if (step) {
				step.completed = true;
			}
		}

		// Restore current step
		if (data.currentStep) {
			this.currentStep = this.steps.get(data.currentStep) || null;
		}
	}
}

/**
 * Tutorial UI Helper
 */
export class TutorialUI {
	private container: HTMLElement;
	private manager: TutorialManager;
	private overlay: HTMLElement | null = null;
	private panel: HTMLElement | null = null;

	constructor(container: HTMLElement, manager: TutorialManager) {
		this.container = container;
		this.manager = manager;

		// Listen to tutorial events
		this.manager.onStart(this.showStep.bind(this));
		this.manager.onComplete(this.hideStep.bind(this));
	}

	/**
	 * Show tutorial step
	 */
	private showStep(step: TutorialStep): void {
		this.hideStep(step); // Clear previous

		// Create overlay
		this.overlay = document.createElement('div');
		this.overlay.className = 'tutorial-overlay';
		this.overlay.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.7);
			z-index: 9998;
			pointer-events: auto;
		`;

		// Create panel
		this.panel = document.createElement('div');
		this.panel.className = 'tutorial-panel';
		this.panel.style.cssText = `
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			padding: 30px;
			border-radius: 15px;
			box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
			max-width: 500px;
			z-index: 9999;
			font-family: Arial, sans-serif;
		`;

		this.panel.innerHTML = `
			<h2 style="margin: 0 0 15px 0; font-size: 24px;">${step.title}</h2>
			<p style="margin: 0 0 15px 0; font-size: 16px; opacity: 0.9;">${step.description}</p>
			<div style="background: rgba(255, 255, 255, 0.2); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
				<strong style="display: block; margin-bottom: 5px;">Objective:</strong>
				<span style="font-size: 14px;">${step.objective}</span>
			</div>
			<div style="text-align: right;">
				<button id="tutorial-skip" style="
					background: rgba(255, 255, 255, 0.2);
					border: 2px solid white;
					color: white;
					padding: 10px 20px;
					border-radius: 5px;
					cursor: pointer;
					margin-right: 10px;
					font-size: 14px;
				">Skip Tutorial</button>
				<button id="tutorial-continue" style="
					background: white;
					border: none;
					color: #667eea;
					padding: 10px 20px;
					border-radius: 5px;
					cursor: pointer;
					font-weight: bold;
					font-size: 14px;
				">Continue</button>
			</div>
		`;

		// Add event listeners
		this.panel.querySelector('#tutorial-skip')?.addEventListener('click', () => {
			this.manager.skip();
			this.hideStep(step);
		});

		this.panel.querySelector('#tutorial-continue')?.addEventListener('click', () => {
			// Some steps auto-complete on continue
			if (step.id === 'welcome' || step.id === 'tutorial_complete') {
				this.manager.completeStep(step.id);
			}
			this.hideStep(step);
		});

		this.container.appendChild(this.overlay);
		this.container.appendChild(this.panel);
	}

	/**
	 * Hide tutorial step
	 */
	private hideStep(step: TutorialStep): void {
		if (this.overlay) {
			this.overlay.remove();
			this.overlay = null;
		}

		if (this.panel) {
			this.panel.remove();
			this.panel = null;
		}
	}

	/**
	 * Show tutorial progress indicator
	 */
	showProgress(): HTMLElement {
		const progress = this.manager.getProgress();

		const indicator = document.createElement('div');
		indicator.className = 'tutorial-progress';
		indicator.style.cssText = `
			position: fixed;
			bottom: 20px;
			right: 20px;
			background: rgba(0, 0, 0, 0.8);
			color: white;
			padding: 10px 15px;
			border-radius: 8px;
			font-size: 12px;
			z-index: 9997;
		`;

		indicator.textContent = `Tutorial: ${progress.completed}/${progress.total} (${progress.percentage}%)`;

		this.container.appendChild(indicator);

		return indicator;
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		if (this.overlay) this.overlay.remove();
		if (this.panel) this.panel.remove();
	}
}
