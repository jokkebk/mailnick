import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

let _db: ReturnType<typeof drizzle> | null = null;
function getDb() {
	if (!_db) {
		mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });
		const sqlite = new Database(env.DATABASE_PATH, { create: true });
		_db = drizzle(sqlite, { schema });
	}
	return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
	get(_, prop) {
		return (getDb() as any)[prop];
	}
});
