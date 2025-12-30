/**
 * NPCManager
 * Manages NPCs, dialogue, and NPC interactions
 */

import { EventEmitter } from '../utils/EventEmitter.ts';
import type { Position } from './WorldManager.ts';

export interface NPCDialogue {
	greeting: string;
	farewell: string;
	[key: string]: string;
}

export interface NPCData {
	id: string;
	name: string;
	type: 'merchant' | 'service' | 'job_trainer' | 'quest';
	sprite: string;
	dialogue: NPCDialogue;
	services: string[];
	inventory?: string[];
	rest_cost?: number;
	job?: string;
	certificate?: string;
	quest_required?: string;
	prerequisites?: {
		jobs?: string[];
		level?: number;
	};
	quests?: string[];
}

export interface NPCInstance {
	npcId: string;
	position: Position;
	townId?: string;
	zoneId?: string;
}

export interface NPCManagerEvents {
	'npc-interact': (npcId: string) => void;
	'dialogue-start': (npcId: string, dialogue: string) => void;
	'dialogue-end': (npcId: string) => void;
	'service-requested': (npcId: string, service: string) => void;
}

export class NPCManager extends EventEmitter<NPCManagerEvents> {
	private npcData: Map<string, NPCData> = new Map();
	private npcInstances: NPCInstance[] = [];
	private activeDialogue: { npcId: string; text: string } | null = null;

	constructor() {
		super();
	}

	/**
	 * Load NPC data
	 */
	loadNPCs(npcs: NPCData[]): void {
		for (const npc of npcs) {
			this.npcData.set(npc.id, npc);
		}
	}

	/**
	 * Spawn NPC at location
	 */
	spawnNPC(npcId: string, position: Position, location?: { townId?: string; zoneId?: string }): void {
		const instance: NPCInstance = {
			npcId,
			position,
			townId: location?.townId,
			zoneId: location?.zoneId,
		};

		this.npcInstances.push(instance);
	}

	/**
	 * Get NPC data
	 */
	getNPC(npcId: string): NPCData | undefined {
		return this.npcData.get(npcId);
	}

	/**
	 * Get all NPC instances in a town
	 */
	getNPCsInTown(townId: string): NPCInstance[] {
		return this.npcInstances.filter((inst) => inst.townId === townId);
	}

	/**
	 * Get all NPC instances in a zone
	 */
	getNPCsInZone(zoneId: string): NPCInstance[] {
		return this.npcInstances.filter((inst) => inst.zoneId === zoneId);
	}

	/**
	 * Find NPC at position
	 */
	findNPCAtPosition(position: Position, radius: number = 50): NPCInstance | null {
		for (const instance of this.npcInstances) {
			const distance = Math.sqrt(
				Math.pow(instance.position.x - position.x, 2) +
				Math.pow(instance.position.y - position.y, 2),
			);

			if (distance <= radius) {
				return instance;
			}
		}

		return null;
	}

	/**
	 * Interact with NPC
	 */
	interact(npcId: string): void {
		const npc = this.getNPC(npcId);
		if (!npc) return;

		this.emit('npc-interact', npcId);
		this.startDialogue(npcId, npc.dialogue.greeting);
	}

	/**
	 * Start dialogue with NPC
	 */
	startDialogue(npcId: string, text: string): void {
		const npc = this.getNPC(npcId);
		if (!npc) return;

		this.activeDialogue = { npcId, text };
		this.emit('dialogue-start', npcId, text);
	}

	/**
	 * Get dialogue text (with variable substitution)
	 */
	getDialogue(npcId: string, key: string, variables?: Record<string, any>): string {
		const npc = this.getNPC(npcId);
		if (!npc || !npc.dialogue[key]) return '';

		let text = npc.dialogue[key];

		// Substitute variables
		if (variables) {
			for (const [varName, value] of Object.entries(variables)) {
				text = text.replace(`{${varName}}`, String(value));
			}
		}

		return text;
	}

	/**
	 * End dialogue
	 */
	endDialogue(): void {
		if (this.activeDialogue) {
			this.emit('dialogue-end', this.activeDialogue.npcId);
			this.activeDialogue = null;
		}
	}

	/**
	 * Request NPC service
	 */
	requestService(npcId: string, service: string): boolean {
		const npc = this.getNPC(npcId);
		if (!npc) return false;

		if (!npc.services.includes(service)) {
			console.error(`[NPCManager] NPC ${npcId} does not provide service: ${service}`);
			return false;
		}

		this.emit('service-requested', npcId, service);
		return true;
	}

	/**
	 * Check if NPC can provide job training
	 */
	canTrainJob(npcId: string, playerJobs: string[], playerLevel: number): {
		canTrain: boolean;
		reason?: string;
	} {
		const npc = this.getNPC(npcId);
		if (!npc || npc.type !== 'job_trainer') {
			return { canTrain: false, reason: 'Not a job trainer' };
		}

		if (!npc.job) {
			return { canTrain: false, reason: 'No job defined' };
		}

		// Check if already learned
		if (playerJobs.includes(npc.job)) {
			return { canTrain: false, reason: 'Job already learned' };
		}

		// Check prerequisites
		if (npc.prerequisites) {
			// Check required jobs
			if (npc.prerequisites.jobs) {
				for (const reqJob of npc.prerequisites.jobs) {
					if (!playerJobs.includes(reqJob)) {
						return { canTrain: false, reason: `Requires ${reqJob} job` };
					}
				}
			}

			// Check level
			if (npc.prerequisites.level && playerLevel < npc.prerequisites.level) {
				return { canTrain: false, reason: `Requires level ${npc.prerequisites.level}` };
			}
		}

		return { canTrain: true };
	}

	/**
	 * Get active dialogue
	 */
	getActiveDialogue(): { npcId: string; text: string } | null {
		return this.activeDialogue;
	}

	/**
	 * Clear all NPCs
	 */
	clear(): void {
		this.npcInstances = [];
		this.activeDialogue = null;
	}
}
