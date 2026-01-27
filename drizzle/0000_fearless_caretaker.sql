CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`rules` text,
	`color` text,
	`auto_action` text
);
--> statement-breakpoint
CREATE TABLE `emails` (
	`id` text PRIMARY KEY NOT NULL,
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
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL
);
