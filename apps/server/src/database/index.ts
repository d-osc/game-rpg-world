/**
 * Database Module
 * Exports all database functionality
 */

export { pool, testConnection, closePool, query, transaction } from './config.ts';
export type { DatabaseConfig } from './config.ts';
export { initializeDatabase } from './init.ts';
