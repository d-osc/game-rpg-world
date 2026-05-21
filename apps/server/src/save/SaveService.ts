/**
 * Save/Load Service
 * Handles player save data management using elit/database
 */

import { profiles, saves, jobs, inventory, skills } from '../database/index.ts';
import { randomUUID } from 'crypto';

export interface PlayerSaveData {
	profile: {
		displayName: string;
		level: number;
		experience: number;
		gold: number;
		position: { x: number; y: number };
		currentMap: string;
		health: number;
		maxHealth: number;
		mana: number;
		maxMana: number;
		stats: {
			strength: number;
			dexterity: number;
			intelligence: number;
			vitality: number;
			luck: number;
		};
	};
	jobs: Array<{
		jobId: string;
		level: number;
		experience: number;
	}>;
	inventory: Array<{
		itemId: string;
		quantity: number;
		slotIndex: number | null;
		isEquipped: boolean;
	}>;
	skills: Array<{
		skillId: string;
		skillLevel: number;
		learnedFromJob: string;
	}>;
}

export interface SaveResponse {
	success: boolean;
	message: string;
	data?: PlayerSaveData;
	error?: string;
}

export class SaveService {
	static async loadSave(playerId: string): Promise<SaveResponse> {
		try {
			const profile = profiles.findOne((p: any) => p.playerId === playerId);
			if (!profile) {
				return { success: false, message: 'Player profile not found', error: 'PROFILE_NOT_FOUND' };
			}

			const playerJobs = jobs.find((j: any) => j.playerId === playerId);
			const playerInventory = inventory.find((i: any) => i.playerId === playerId);
			const playerSkills = skills.find((s: any) => s.playerId === playerId);

			const saveData: PlayerSaveData = {
				profile: {
					displayName: profile.displayName,
					level: profile.level,
					experience: profile.experience,
					gold: profile.gold,
					position: { x: profile.positionX, y: profile.positionY },
					currentMap: profile.currentMap,
					health: profile.health,
					maxHealth: profile.maxHealth,
					mana: profile.mana,
					maxMana: profile.maxMana,
					stats: profile.stats,
				},
				jobs: playerJobs.map((j: any) => ({ jobId: j.jobId, level: j.level, experience: j.experience })),
				inventory: playerInventory.map((i: any) => ({ itemId: i.itemId, quantity: i.quantity, slotIndex: i.slotIndex, isEquipped: i.isEquipped })),
				skills: playerSkills.map((s: any) => ({ skillId: s.skillId, skillLevel: s.skillLevel, learnedFromJob: s.learnedFromJob })),
			};

			console.log('[Save] Loaded save for player:', playerId);
			return { success: true, message: 'Save loaded successfully', data: saveData };
		} catch (error) {
			console.error('[Save] Load error:', error);
			return { success: false, message: 'Failed to load save', error: 'LOAD_ERROR' };
		}
	}

	static async saveSave(playerId: string, saveData: PlayerSaveData, saveType: 'auto' | 'manual' | 'checkpoint' = 'auto'): Promise<SaveResponse> {
		try {
			// Update profile
			profiles.update((p: any) => p.playerId === playerId, {
				displayName: saveData.profile.displayName,
				level: saveData.profile.level,
				experience: saveData.profile.experience,
				gold: saveData.profile.gold,
				positionX: saveData.profile.position.x,
				positionY: saveData.profile.position.y,
				currentMap: saveData.profile.currentMap,
				health: saveData.profile.health,
				maxHealth: saveData.profile.maxHealth,
				mana: saveData.profile.mana,
				maxMana: saveData.profile.maxMana,
				stats: saveData.profile.stats,
				updatedAt: new Date().toISOString(),
			});

			// Create save snapshot
			saves.insert({
				id: randomUUID(),
				playerId,
				saveData,
				saveType,
				createdAt: new Date().toISOString(),
			});

			// Cleanup old auto-saves (keep last 10)
			const allSaves = saves.find((s: any) => s.playerId === playerId && s.saveType === 'auto');
			if (allSaves.length > 10) {
				allSaves.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
				const toDelete = allSaves.slice(10);
				for (const s of toDelete) {
					saves.delete((sv: any) => sv.id === s.id);
				}
			}

			console.log('[Save] Saved data for player:', playerId, `(${saveType})`);
			return { success: true, message: 'Save successful' };
		} catch (error) {
			console.error('[Save] Save error:', error);
			return { success: false, message: 'Failed to save', error: 'SAVE_ERROR' };
		}
	}

	static async getSaveHistory(playerId: string, limit: number = 10): Promise<Array<{ id: string; saveType: string; createdAt: string }>> {
		try {
			const allSaves = saves.find((s: any) => s.playerId === playerId);
			allSaves.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
			return allSaves.slice(0, limit).map((s: any) => ({ id: s.id, saveType: s.saveType, createdAt: s.createdAt }));
		} catch {
			return [];
		}
	}

	static async loadSnapshot(playerId: string, saveId: string): Promise<SaveResponse> {
		try {
			const snapshot = saves.findOne((s: any) => s.id === saveId && s.playerId === playerId);
			if (!snapshot) {
				return { success: false, message: 'Save not found', error: 'SAVE_NOT_FOUND' };
			}
			return { success: true, message: 'Snapshot loaded successfully', data: snapshot.saveData };
		} catch (error) {
			console.error('[Save] Load snapshot error:', error);
			return { success: false, message: 'Failed to load snapshot', error: 'LOAD_SNAPSHOT_ERROR' };
		}
	}
}
