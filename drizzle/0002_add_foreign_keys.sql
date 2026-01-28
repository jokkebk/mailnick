-- SQLite doesn't support adding foreign keys to existing columns
-- so we need to recreate the tables

-- Recreate emails table with foreign key
CREATE TABLE `emails_new` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`from` text NOT NULL,
	`from_domain` text NOT NULL,
	`to` text,
	`subject` text,
	`snippet` text,
	`received_at` integer NOT NULL,
	`is_unread` integer DEFAULT true,
	`label_ids` text,
	`category` text,
	`category_confidence` integer,
	`raw_headers` text,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `tokens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Copy data from old table
INSERT INTO `emails_new` SELECT * FROM `emails`;
--> statement-breakpoint

-- Drop old table
DROP TABLE `emails`;
--> statement-breakpoint

-- Rename new table
ALTER TABLE `emails_new` RENAME TO `emails`;
--> statement-breakpoint

-- Recreate action_history table with foreign key
CREATE TABLE `action_history_new` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`email_id` text NOT NULL,
	`action_type` text NOT NULL,
	`original_state` text NOT NULL,
	`timestamp` integer NOT NULL,
	`undone` integer DEFAULT false,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `tokens`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Copy data from old table
INSERT INTO `action_history_new` SELECT * FROM `action_history`;
--> statement-breakpoint

-- Drop old table
DROP TABLE `action_history`;
--> statement-breakpoint

-- Rename new table
ALTER TABLE `action_history_new` RENAME TO `action_history`;
