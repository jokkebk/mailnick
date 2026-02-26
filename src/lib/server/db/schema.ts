import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const emails = sqliteTable('emails', {
	id: text('id').primaryKey(), // Gmail message ID
	accountId: text('account_id')
		.notNull()
		.references(() => tokens.id),
	threadId: text('thread_id').notNull(),
	from: text('from').notNull(),
	fromDomain: text('from_domain').notNull(), // Extracted for grouping
	to: text('to'),
	subject: text('subject'),
	snippet: text('snippet'), // Preview text
	receivedAt: integer('received_at', { mode: 'timestamp' }).notNull(),
	isUnread: integer('is_unread', { mode: 'boolean' }).default(true),
	labelIds: text('label_ids'), // JSON array
	category: text('category'), // LLM-assigned
	categoryConfidence: integer('category_confidence'), // 0-100
	rawHeaders: text('raw_headers'), // JSON for debugging
	syncedAt: integer('synced_at', { mode: 'timestamp' }).notNull()
});

export const categories = sqliteTable('categories', {
	id: text('id').primaryKey(),
	name: text('name').notNull(), // e.g., "AWS Notifications"
	description: text('description'),
	rules: text('rules'), // JSON: LLM prompt hints
	color: text('color'), // For UI
	autoAction: text('auto_action') // "archive" | "mark_read" | null
});

export const tokens = sqliteTable('tokens', {
	id: text('id').primaryKey(),
	accessToken: text('access_token').notNull(),
	refreshToken: text('refresh_token').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

export const actionHistory = sqliteTable('action_history', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	accountId: text('account_id')
		.notNull()
		.references(() => tokens.id),
	emailId: text('email_id')
		.notNull()
		.references(() => emails.id),
	actionType: text('action_type').notNull(), // 'mark_read', 'archive', 'trash', 'label'
	originalState: text('original_state').notNull(), // JSON: {isUnread, labelIds}
	timestamp: integer('timestamp', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	undone: integer('undone', { mode: 'boolean' }).default(false),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	ruleId: text('rule_id')
});

export const cleanupRules = sqliteTable('cleanup_rules', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	accountId: text('account_id')
		.notNull()
		.references(() => tokens.id),
	name: text('name').notNull(),
	matchCriteria: text('match_criteria').notNull(), // JSON
	displayOrder: integer('display_order').notNull(),
	enabled: integer('enabled', { mode: 'boolean' }).default(true),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	color: text('color') // UI color indicator
});
