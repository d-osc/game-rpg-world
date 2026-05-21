/**
 * Database Initialization
 * Seeds collections with empty arrays if they don't exist
 */

import { players, sessions, profiles, saves, jobs, inventory, skills, testConnection } from './config.ts';

export async function initializeDatabase(): Promise<void> {
	console.log('[Database] Initializing collections...');

	try {
		await testConnection();

		// Touch all collections to ensure they exist
		players.getAll();
		sessions.getAll();
		profiles.getAll();
		saves.getAll();
		jobs.getAll();
		inventory.getAll();
		skills.getAll();

		console.log('[Database] Collections ready');
	} catch (error) {
		console.error('[Database] Initialization failed:', error);
		throw error;
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	initializeDatabase()
		.then(() => { console.log('[Database] Init complete'); process.exit(0); })
		.catch((e) => { console.error(e); process.exit(1); });
}
