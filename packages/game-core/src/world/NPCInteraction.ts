/**
 * NPC Interaction System
 * Handles talking to NPCs, shops, and job trainers
 */

import { Vector2 } from '@rpg/game-engine';

export interface NPCDialogue {
	id: string;
	text: string;
	next?: string; // ID of next dialogue
	options?: DialogueOption[];
}

export interface DialogueOption {
	text: string;
	next?: string;
	action?: string; // 'shop', 'train_job', 'quest', 'close'
	actionData?: any;
}

export interface NPCData {
	id: string;
	name: string;
	type: 'villager' | 'merchant' | 'trainer' | 'quest_giver';
	position: Vector2;
	dialogues: NPCDialogue[];
	initialDialogue?: string; // ID of first dialogue (defaults to first dialogue)
	shop?: {
		items: string[]; // Item IDs
		buyPriceMultiplier: number; // Default: 1.0
		sellPriceMultiplier: number; // Default: 0.5
	};
	jobTrainer?: {
		jobId: string;
		certificateItemId: string;
	};
}

export class NPCInteraction {
	private npcs: Map<string, NPCData> = new Map();
	private currentNPC: NPCData | null = null;
	private currentDialogue: NPCDialogue | null = null;

	// Callbacks
	public onDialogueStart: ((npc: NPCData, dialogue: NPCDialogue) => void) | null = null;
	public onDialogueEnd: (() => void) | null = null;
	public onShopOpen: ((npc: NPCData) => void) | null = null;
	public onJobTrain: ((npc: NPCData, jobId: string) => void) | null = null;

	/**
	 * Register an NPC
	 */
	addNPC(npc: NPCData): void {
		this.npcs.set(npc.id, npc);
		console.log(`[NPCInteraction] Registered NPC: ${npc.name}`);
	}

	/**
	 * Get NPC by ID
	 */
	getNPC(id: string): NPCData | undefined {
		return this.npcs.get(id);
	}

	/**
	 * Get all NPCs
	 */
	getAllNPCs(): NPCData[] {
		return Array.from(this.npcs.values());
	}

	/**
	 * Find NPCs near a position
	 */
	getNPCsNear(position: Vector2, radius: number): NPCData[] {
		const nearby: NPCData[] = [];

		for (const npc of this.npcs.values()) {
			const distance = position.distance(npc.position);
			if (distance <= radius) {
				nearby.push(npc);
			}
		}

		return nearby;
	}

	/**
	 * Interact with NPC (start dialogue)
	 */
	interact(npcId: string): boolean {
		const npc = this.npcs.get(npcId);
		if (!npc) {
			console.warn(`[NPCInteraction] NPC not found: ${npcId}`);
			return false;
		}

		// Find initial dialogue (fallback to first dialogue if not specified)
		let initialDialogue = npc.dialogues.find((d) => d.id === npc.initialDialogue);
		if (!initialDialogue && npc.dialogues.length > 0) {
			initialDialogue = npc.dialogues[0];
		}
		if (!initialDialogue) {
			console.warn(`[NPCInteraction] No dialogues found for NPC: ${npc.name}`);
			return false;
		}

		this.currentNPC = npc;
		this.currentDialogue = initialDialogue;

		// Trigger callback
		if (this.onDialogueStart) {
			this.onDialogueStart(npc, initialDialogue);
		}

		console.log(`[NPCInteraction] Started dialogue with: ${npc.name}`);
		return true;
	}

	/**
	 * Select dialogue option
	 */
	selectOption(optionIndex: number): void {
		if (!this.currentNPC || !this.currentDialogue) {
			console.warn('[NPCInteraction] No active dialogue');
			return;
		}

		const options = this.currentDialogue.options;
		if (!options || optionIndex < 0 || optionIndex >= options.length) {
			console.warn('[NPCInteraction] Invalid option index');
			return;
		}

		const option = options[optionIndex]!;

		// Handle action
		if (option.action) {
			this.handleAction(option.action, option.actionData);
		}

		// Move to next dialogue
		if (option.next) {
			const nextDialogue = this.currentNPC.dialogues.find((d) => d.id === option.next);
			if (nextDialogue) {
				this.currentDialogue = nextDialogue;

				// Trigger callback
				if (this.onDialogueStart) {
					this.onDialogueStart(this.currentNPC, nextDialogue);
				}
			} else {
				this.endDialogue();
			}
		} else {
			this.endDialogue();
		}
	}

	/**
	 * Continue to next dialogue (for linear dialogues)
	 */
	continue(): void {
		if (!this.currentNPC || !this.currentDialogue) {
			console.warn('[NPCInteraction] No active dialogue');
			return;
		}

		// If current dialogue has next
		if (this.currentDialogue.next) {
			const nextDialogue = this.currentNPC.dialogues.find(
				(d) => d.id === this.currentDialogue!.next
			);
			if (nextDialogue) {
				this.currentDialogue = nextDialogue;

				// Trigger callback
				if (this.onDialogueStart) {
					this.onDialogueStart(this.currentNPC, nextDialogue);
				}
			} else {
				this.endDialogue();
			}
		} else {
			this.endDialogue();
		}
	}

	/**
	 * Handle dialogue action
	 */
	private handleAction(action: string, actionData?: any): void {
		console.log(`[NPCInteraction] Handling action: ${action}`, actionData);

		switch (action) {
			case 'shop':
				if (this.currentNPC && this.onShopOpen) {
					this.onShopOpen(this.currentNPC);
				}
				break;

			case 'train_job':
				if (this.currentNPC && this.currentNPC.jobTrainer && this.onJobTrain) {
					this.onJobTrain(this.currentNPC, this.currentNPC.jobTrainer.jobId);
				}
				break;

			case 'quest':
				// TODO: Quest system
				console.log('[NPCInteraction] Quest system not implemented yet');
				break;

			case 'rest':
				console.log('[NPCInteraction] Rest action triggered');
				// TODO: Implement rest (restore HP/MP for gold)
				break;

			case 'close':
				this.endDialogue();
				break;
		}
	}

	/**
	 * End current dialogue
	 */
	endDialogue(): void {
		console.log('[NPCInteraction] Ending dialogue');

		this.currentNPC = null;
		this.currentDialogue = null;

		// Trigger callback
		if (this.onDialogueEnd) {
			this.onDialogueEnd();
		}
	}

	/**
	 * Get current NPC
	 */
	getCurrentNPC(): NPCData | null {
		return this.currentNPC;
	}

	/**
	 * Get current dialogue
	 */
	getCurrentDialogue(): NPCDialogue | null {
		return this.currentDialogue;
	}

	/**
	 * Check if dialogue is active
	 */
	isDialogueActive(): boolean {
		return this.currentNPC !== null && this.currentDialogue !== null;
	}
}

// Singleton instance
export const npcInteraction = new NPCInteraction();
