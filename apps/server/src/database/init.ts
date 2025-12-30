/**
 * Database Initialization
 * Run database schema and setup
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool, testConnection } from './config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function initializeDatabase(): Promise<void> {
	console.log('[Database] Initializing database schema...');

	try {
		// Test connection first
		const connected = await testConnection();
		if (!connected) {
			throw new Error('Failed to connect to database');
		}

		// Read schema file
		const schemaPath = join(__dirname, 'schema.sql');
		const schema = readFileSync(schemaPath, 'utf-8');

		// Execute schema
		await pool.query(schema);

		console.log('[Database] ✓ Schema initialized successfully');
	} catch (error) {
		console.error('[Database] ✗ Failed to initialize schema:', error);
		throw error;
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	initializeDatabase()
		.then(() => {
			console.log('[Database] Initialization complete');
			process.exit(0);
		})
		.catch((error) => {
			console.error('[Database] Initialization failed:', error);
			process.exit(1);
		});
}
