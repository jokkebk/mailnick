import { env } from '$env/dynamic/private';
import { Database } from 'bun:sqlite';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

let initialized = false;

/**
 * Validates that all required environment variables are set
 * Throws an error with helpful message if any are missing
 */
function validateEnvironment() {
	const required = [
		{ key: 'GOOGLE_CLIENT_ID', description: 'Google OAuth Client ID' },
		{ key: 'GOOGLE_CLIENT_SECRET', description: 'Google OAuth Client Secret' },
		{ key: 'GOOGLE_REDIRECT_URI', description: 'Google OAuth Redirect URI' }
	];

	const missing: string[] = [];

	for (const { key, description } of required) {
		const value = process.env[key];
		if (!value || value.includes('your_') || value.includes('_here')) {
			missing.push(`${key} (${description})`);
		}
	}

	if (missing.length > 0) {
		const error = [
			'\n❌ Missing or invalid environment variables:',
			...missing.map((m) => `   - ${m}`),
			'\nPlease ensure you have:',
			'   1. Copied .env.example to .env',
			'   2. Configured all required values in .env',
			'   3. Set up Google Cloud Console OAuth credentials',
			'\nSee README.md for detailed setup instructions.\n'
		].join('\n');

		throw new Error(error);
	}

	// Check if .env exists
	if (!existsSync('.env')) {
		console.warn(
			'\n⚠️  Warning: .env file not found. Using environment variables from system.\n'
		);
	}
}

/**
 * Runs database migrations to ensure schema is up to date
 */
function runMigrations() {
	console.log('🔄 Checking database schema...');

	// Ensure data directory exists
	mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });

	const db = new Database(env.DATABASE_PATH, { create: true });

	// Run migrations (idempotent - safe to run multiple times)
	const migration = `
CREATE TABLE IF NOT EXISTS categories (
	id text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	description text,
	rules text,
	color text,
	auto_action text
);

CREATE TABLE IF NOT EXISTS tokens (
	id text PRIMARY KEY NOT NULL,
	access_token text NOT NULL,
	refresh_token text NOT NULL,
	expires_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS emails (
	id text PRIMARY KEY NOT NULL,
	account_id text NOT NULL,
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
	synced_at integer NOT NULL,
	FOREIGN KEY (account_id) REFERENCES tokens(id)
);

CREATE TABLE IF NOT EXISTS action_history (
	id text PRIMARY KEY NOT NULL,
	account_id text NOT NULL,
	email_id text NOT NULL,
	action_type text NOT NULL,
	original_state text NOT NULL,
	timestamp integer NOT NULL,
	undone integer DEFAULT 0,
	expires_at integer NOT NULL,
	FOREIGN KEY (account_id) REFERENCES tokens(id),
	FOREIGN KEY (email_id) REFERENCES emails(id)
);

CREATE TABLE IF NOT EXISTS cleanup_rules (
	id text PRIMARY KEY NOT NULL,
	account_id text NOT NULL,
	name text NOT NULL,
	match_criteria text NOT NULL,
	display_order integer NOT NULL,
	enabled integer DEFAULT 1,
	created_at integer NOT NULL,
	updated_at integer NOT NULL,
	color text,
	FOREIGN KEY (account_id) REFERENCES tokens(id)
);
`;

	try {
		db.exec(migration);

		// Add rule_id column to action_history (idempotent)
		try {
			db.exec(`ALTER TABLE action_history ADD COLUMN rule_id TEXT;`);
		} catch {
			// Column already exists
		}

		console.log('✅ Database schema ready');
	} catch (error) {
		console.error('❌ Failed to initialize database:', error);
		throw error;
	} finally {
		db.close();
	}
}

/**
 * Initializes the application on startup
 * - Validates environment variables
 * - Runs database migrations
 * Only runs once per application lifecycle
 */
export function initialize() {
	if (initialized) {
		return;
	}

	console.log('🚀 Initializing MailNick...');

	try {
		validateEnvironment();
		runMigrations();
		initialized = true;
		console.log('✅ MailNick initialized successfully\n');
	} catch (error) {
		console.error('❌ Initialization failed:', error);
		process.exit(1);
	}
}
