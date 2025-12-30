/**
 * Database Configuration
 * PostgreSQL connection setup
 */

import pg from 'pg';

const { Pool } = pg;

export interface DatabaseConfig {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
	max?: number;
	idleTimeoutMillis?: number;
	connectionTimeoutMillis?: number;
}

// Load from environment variables with defaults
const config: DatabaseConfig = {
	host: process.env.DB_HOST || 'localhost',
	port: parseInt(process.env.DB_PORT || '5432', 10),
	database: process.env.DB_NAME || 'rpg_game',
	user: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASSWORD || 'postgres',
	max: 20, // Maximum number of clients in the pool
	idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
	connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection cannot be established
};

// Create the connection pool
export const pool = new Pool(config);

// Error handler
pool.on('error', (err) => {
	console.error('[Database] Unexpected error on idle client', err);
	process.exit(-1);
});

// Connection test
export async function testConnection(): Promise<boolean> {
	try {
		const client = await pool.connect();
		const result = await client.query('SELECT NOW()');
		client.release();
		console.log('[Database] ✓ Connection successful');
		console.log(`[Database] Server time: ${result.rows[0].now}`);
		return true;
	} catch (error) {
		console.error('[Database] ✗ Connection failed:', error);
		return false;
	}
}

// Graceful shutdown
export async function closePool(): Promise<void> {
	await pool.end();
	console.log('[Database] Connection pool closed');
}

// Query helper with error handling
export async function query<T = any>(
	text: string,
	params?: any[],
): Promise<pg.QueryResult<T>> {
	const start = Date.now();
	try {
		const result = await pool.query<T>(text, params);
		const duration = Date.now() - start;
		console.log('[Database] Query executed:', {
			text,
			duration: `${duration}ms`,
			rows: result.rowCount,
		});
		return result;
	} catch (error) {
		console.error('[Database] Query error:', { text, error });
		throw error;
	}
}

// Transaction helper
export async function transaction<T>(
	callback: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const result = await callback(client);
		await client.query('COMMIT');
		return result;
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}
