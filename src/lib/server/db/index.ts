import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';
import { DATABASE_PATH } from '$env/static/private';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

// Ensure data directory exists
mkdirSync(dirname(DATABASE_PATH), { recursive: true });

const sqlite = new Database(DATABASE_PATH, { create: true });
export const db = drizzle(sqlite, { schema });
