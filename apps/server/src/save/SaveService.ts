/**
 * Save/Load Service
 * Handles player save data management
 */

import { query, transaction } from '../database/index.ts';
import type { PoolClient } from 'pg';

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
	/**
	 * Load player save data
	 */
	static async loadSave(playerId: string): Promise<SaveResponse> {
		try {
			// Load player profile
			const profileResult = await query(
				`SELECT display_name, level, experience, gold,
						position_x, position_y, current_map,
						health, max_health, mana, max_mana, stats
				 FROM player_profiles
				 WHERE player_id = $1`,
				[playerId],
			);

			if (profileResult.rows.length === 0) {
				return {
					success: false,
					message: 'Player profile not found',
					error: 'PROFILE_NOT_FOUND',
				};
			}

			const profile = profileResult.rows[0];

			// Load jobs
			const jobsResult = await query(
				`SELECT job_id, level, experience
				 FROM player_jobs
				 WHERE player_id = $1
				 ORDER BY learned_at ASC`,
				[playerId],
			);

			// Load inventory
			const inventoryResult = await query(
				`SELECT item_id, quantity, slot_index, is_equipped
				 FROM player_inventory
				 WHERE player_id = $1
				 ORDER BY slot_index ASC NULLS LAST`,
				[playerId],
			);

			// Load skills
			const skillsResult = await query(
				`SELECT skill_id, skill_level, learned_from_job
				 FROM player_skills
				 WHERE player_id = $1
				 ORDER BY learned_at ASC`,
				[playerId],
			);

			const saveData: PlayerSaveData = {
				profile: {
					displayName: profile.display_name,
					level: profile.level,
					experience: profile.experience,
					gold: profile.gold,
					position: {
						x: profile.position_x,
						y: profile.position_y,
					},
					currentMap: profile.current_map,
					health: profile.health,
					maxHealth: profile.max_health,
					mana: profile.mana,
					maxMana: profile.max_mana,
					stats: profile.stats,
				},
				jobs: jobsResult.rows.map((row) => ({
					jobId: row.job_id,
					level: row.level,
					experience: row.experience,
				})),
				inventory: inventoryResult.rows.map((row) => ({
					itemId: row.item_id,
					quantity: row.quantity,
					slotIndex: row.slot_index,
					isEquipped: row.is_equipped,
				})),
				skills: skillsResult.rows.map((row) => ({
					skillId: row.skill_id,
					skillLevel: row.skill_level,
					learnedFromJob: row.learned_from_job,
				})),
			};

			console.log('[Save] Loaded save for player:', playerId);

			return {
				success: true,
				message: 'Save loaded successfully',
				data: saveData,
			};
		} catch (error) {
			console.error('[Save] Load error:', error);
			return {
				success: false,
				message: 'Failed to load save',
				error: 'LOAD_ERROR',
			};
		}
	}

	/**
	 * Save player data
	 */
	static async saveSave(
		playerId: string,
		saveData: PlayerSaveData,
		saveType: 'auto' | 'manual' | 'checkpoint' = 'auto',
	): Promise<SaveResponse> {
		try {
			await transaction(async (client: PoolClient) => {
				// Update player profile
				await client.query(
					`UPDATE player_profiles
					 SET display_name = $1, level = $2, experience = $3, gold = $4,
					     position_x = $5, position_y = $6, current_map = $7,
					     health = $8, max_health = $9, mana = $10, max_mana = $11,
					     stats = $12, updated_at = CURRENT_TIMESTAMP
					 WHERE player_id = $13`,
					[
						saveData.profile.displayName,
						saveData.profile.level,
						saveData.profile.experience,
						saveData.profile.gold,
						saveData.profile.position.x,
						saveData.profile.position.y,
						saveData.profile.currentMap,
						saveData.profile.health,
						saveData.profile.maxHealth,
						saveData.profile.mana,
						saveData.profile.maxMana,
						JSON.stringify(saveData.profile.stats),
						playerId,
					],
				);

				// Create save snapshot
				await client.query(
					`INSERT INTO game_saves (player_id, save_data, save_type)
					 VALUES ($1, $2, $3)`,
					[playerId, JSON.stringify(saveData), saveType],
				);

				// Cleanup old auto-saves (keep last 10)
				await client.query(
					`DELETE FROM game_saves
					 WHERE player_id = $1 AND save_type = 'auto'
					 AND id NOT IN (
					     SELECT id FROM game_saves
					     WHERE player_id = $1 AND save_type = 'auto'
					     ORDER BY created_at DESC
					     LIMIT 10
					 )`,
					[playerId],
				);
			});

			console.log('[Save] Saved data for player:', playerId, `(${saveType})`);

			return {
				success: true,
				message: 'Save successful',
			};
		} catch (error) {
			console.error('[Save] Save error:', error);
			return {
				success: false,
				message: 'Failed to save',
				error: 'SAVE_ERROR',
			};
		}
	}

	/**
	 * Get save history
	 */
	static async getSaveHistory(
		playerId: string,
		limit: number = 10,
	): Promise<
		Array<{ id: string; saveType: string; createdAt: string }>
	> {
		try {
			const result = await query(
				`SELECT id, save_type, created_at
				 FROM game_saves
				 WHERE player_id = $1
				 ORDER BY created_at DESC
				 LIMIT $2`,
				[playerId, limit],
			);

			return result.rows.map((row) => ({
				id: row.id,
				saveType: row.save_type,
				createdAt: row.created_at,
			}));
		} catch (error) {
			console.error('[Save] Get history error:', error);
			return [];
		}
	}

	/**
	 * Load specific save snapshot
	 */
	static async loadSnapshot(
		playerId: string,
		saveId: string,
	): Promise<SaveResponse> {
		try {
			const result = await query(
				`SELECT save_data
				 FROM game_saves
				 WHERE id = $1 AND player_id = $2`,
				[saveId, playerId],
			);

			if (result.rows.length === 0) {
				return {
					success: false,
					message: 'Save not found',
					error: 'SAVE_NOT_FOUND',
				};
			}

			return {
				success: true,
				message: 'Snapshot loaded successfully',
				data: result.rows[0].save_data,
			};
		} catch (error) {
			console.error('[Save] Load snapshot error:', error);
			return {
				success: false,
				message: 'Failed to load snapshot',
				error: 'LOAD_SNAPSHOT_ERROR',
			};
		}
	}
}
