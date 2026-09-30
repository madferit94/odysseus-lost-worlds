CREATE TABLE `play_events` (
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`received_at` integer NOT NULL,
	`name` text NOT NULL,
	`active_ms` integer NOT NULL,
	`stage` integer NOT NULL,
	`attempt` integer NOT NULL,
	`hp` integer NOT NULL,
	`energy` integer NOT NULL,
	`lives` integer NOT NULL,
	`damage_taken` integer NOT NULL,
	`normal_kills` integer NOT NULL,
	`boss_kills` integer NOT NULL,
	`retries` integer NOT NULL,
	`god` text NOT NULL,
	`boss` text NOT NULL,
	`outcome` text NOT NULL,
	`duration_ms` integer NOT NULL,
	PRIMARY KEY(`session_id`, `seq`),
	FOREIGN KEY (`session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_play_events_received` ON `play_events` (`received_at`);--> statement-breakpoint
CREATE TABLE `play_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`started_at` integer NOT NULL,
	`version` text NOT NULL,
	`difficulty` text NOT NULL,
	`source` text NOT NULL,
	`is_test` integer NOT NULL,
	`consent_version` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_play_sessions_started` ON `play_sessions` (`started_at`);
