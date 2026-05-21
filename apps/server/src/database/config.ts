/**
 * Database Configuration
 * Elit file-based database with collection helpers
 */

import { Database } from 'elit/database';

const DB_DIR = process.env.DB_DIR || './data/db';

export const db = new Database({ dir: DB_DIR, language: 'ts' });

/**
 * Collection helper — manages an array of records in a database file
 */
export class Collection<T extends Record<string, any>> {
	constructor(private name: string) {
		this.ensure();
	}

	/** Ensure the collection file exists */
	private ensure(): void {
		try {
			db.read(this.name);
		} catch {
			db.create(this.name, `export const ${this.name}: any[] = [];`);
		}
	}

	/** Read all records */
	getAll(): T[] {
		try {
			const code = db.read(this.name);
			const match = code.match(/export\s+const\s+\w+\s*[:=]\s*(\[[\s\S]*\])/);
			if (!match) return [];
			return JSON.parse(match[1]!);
		} catch {
			return [];
		}
	}

	/** Save all records */
	private saveAll(records: T[]): void {
		db.save(this.name, `export const ${this.name}: any[] = ${JSON.stringify(records, null, 2)};`);
	}

	/** Find records matching a predicate */
	find(predicate: (record: T) => boolean): T[] {
		return this.getAll().filter(predicate);
	}

	/** Find one record */
	findOne(predicate: (record: T) => boolean): T | undefined {
		return this.getAll().find(predicate);
	}

	/** Insert a record */
	insert(record: T): T {
		const records = this.getAll();
		records.push(record);
		this.saveAll(records);
		return record;
	}

	/** Update records matching predicate */
	update(predicate: (record: T) => boolean, changes: Partial<T>): number {
		const records = this.getAll();
		let count = 0;
		for (let i = 0; i < records.length; i++) {
			if (predicate(records[i]!)) {
				records[i] = { ...records[i]!, ...changes };
				count++;
			}
		}
		if (count > 0) this.saveAll(records);
		return count;
	}

	/** Delete records matching predicate */
	delete(predicate: (record: T) => boolean): number {
		const records = this.getAll();
		const before = records.length;
		const filtered = records.filter((r) => !predicate(r));
		this.saveAll(filtered);
		return before - filtered.length;
	}
}

// Shared collections
export const players = new Collection<any>('players');
export const sessions = new Collection<any>('sessions');
export const profiles = new Collection<any>('profiles');
export const saves = new Collection<any>('saves');
export const jobs = new Collection<any>('player_jobs');
export const inventory = new Collection<any>('player_inventory');
export const skills = new Collection<any>('player_skills');

// Connection test
export async function testConnection(): Promise<boolean> {
	try {
		db.read('players');
		console.log('[Database] Elit database ready');
		return true;
	} catch {
		console.log('[Database] Initializing new database');
		return true;
	}
}

export async function closePool(): Promise<void> {
	console.log('[Database] Closed');
}
