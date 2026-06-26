CREATE TABLE `rate_limits` (
	`key` text NOT NULL,
	`window_start_seconds` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_key_window_unique` ON `rate_limits` (`key`,`window_start_seconds`);