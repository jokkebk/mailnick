import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DATABASE_PATH = process.env.DATABASE_PATH || './data/emails.db';

// Ensure data directory exists
mkdirSync(dirname(DATABASE_PATH), { recursive: true });

const db = new Database(DATABASE_PATH, { create: true });

// Run migrations
const migration = `
CREATE TABLE IF NOT EXISTS categories (
	id text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	description text,
	rules text,
	color text,
	auto_action text
);

CREATE TABLE IF NOT EXISTS emails (
	id text PRIMARY KEY NOT NULL,
	thread_id text NOT NULL,
	"from" text NOT NULL,
	from_domain text NOT NULL,
	"to" text,
	subject text,
	snippet text,
	received_at integer NOT NULL,
	is_unread integer DEFAULT 1,
	label_ids text,
	category text,
	category_confidence integer,
	raw_headers text,
	synced_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
	id text PRIMARY KEY NOT NULL,
	access_token text NOT NULL,
	refresh_token text NOT NULL,
	expires_at integer NOT NULL
);
`;

db.exec(migration);
console.log('✓ Database schema created successfully');
db.close();
