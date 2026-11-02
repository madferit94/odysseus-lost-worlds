ALTER TABLE `runs` ADD `difficulty` text;--> statement-breakpoint
CREATE INDEX `idx_runs_difficulty_ranking` ON `runs` (`difficulty`,`score`,`elapsed`,`submitted_at`);
