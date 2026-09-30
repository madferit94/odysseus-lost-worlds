CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`submitted_at` integer,
	`nickname` text,
	`score` integer,
	`elapsed` integer,
	`normal_kills` integer,
	`boss_kills` integer,
	`damage_taken` integer,
	`retries` integer
);
--> statement-breakpoint
CREATE INDEX `idx_runs_ranking` ON `runs` (`score`,`elapsed`,`submitted_at`);
