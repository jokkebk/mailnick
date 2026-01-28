ALTER TABLE `emails` ADD COLUMN `account_id` text NOT NULL DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE `action_history` ADD COLUMN `account_id` text NOT NULL DEFAULT 'default';
