CREATE TABLE `courts` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`name` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `courts_tournament_id_idx` ON `courts` (`tournament_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `courts_tournament_name_unique` ON `courts` (`tournament_id`,`name`);--> statement-breakpoint
CREATE TABLE `match_service_states` (
	`match_id` text PRIMARY KEY NOT NULL,
	`game_no` integer NOT NULL,
	`serving_side` text,
	`service_court` text,
	`server_player_id` text,
	`receiver_player_id` text,
	`court_assignments_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `match_side_players` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`match_side_id` text NOT NULL,
	`side` text NOT NULL,
	`player_order` integer NOT NULL,
	`name` text NOT NULL,
	`team_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match_side_id`) REFERENCES `match_sides`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `match_side_players_match_id_idx` ON `match_side_players` (`match_id`);--> statement-breakpoint
CREATE INDEX `match_side_players_match_side_idx` ON `match_side_players` (`match_id`,`side`);--> statement-breakpoint
CREATE UNIQUE INDEX `match_side_players_match_side_order_unique` ON `match_side_players` (`match_id`,`side`,`player_order`);--> statement-breakpoint
CREATE TABLE `match_sides` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`side` text NOT NULL,
	`display_name` text NOT NULL,
	`seed_no` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `match_sides_match_id_idx` ON `match_sides` (`match_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `match_sides_match_side_unique` ON `match_sides` (`match_id`,`side`);--> statement-breakpoint
CREATE TABLE `match_snapshots` (
	`match_id` text PRIMARY KEY NOT NULL,
	`seq_no` integer NOT NULL,
	`state_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`court_id` text,
	`discipline` text DEFAULT 'MS' NOT NULL,
	`match_no` integer,
	`display_order` integer DEFAULT 0 NOT NULL,
	`event_name` text,
	`category` text,
	`round_name` text,
	`scoring_mode` text DEFAULT 'best_of_3_21' NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`current_game_no` integer DEFAULT 1 NOT NULL,
	`current_score_a` integer DEFAULT 0 NOT NULL,
	`current_score_b` integer DEFAULT 0 NOT NULL,
	`games_won_a` integer DEFAULT 0 NOT NULL,
	`games_won_b` integer DEFAULT 0 NOT NULL,
	`winner_side` text,
	`current_serving_side` text,
	`current_service_court` text,
	`current_server_player_id` text,
	`current_receiver_player_id` text,
	`last_seq_no` integer DEFAULT 0 NOT NULL,
	`scheduled_start_at` text,
	`actual_start_at` text,
	`actual_end_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `matches_tournament_id_idx` ON `matches` (`tournament_id`);--> statement-breakpoint
CREATE INDEX `matches_court_id_idx` ON `matches` (`court_id`);--> statement-breakpoint
CREATE INDEX `matches_current_server_idx` ON `matches` (`current_server_player_id`);--> statement-breakpoint
CREATE TABLE `score_event_undo_links` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`undo_event_id` text NOT NULL,
	`target_event_id` text NOT NULL,
	`target_seq_no` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`undo_event_id`) REFERENCES `score_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_event_id`) REFERENCES `score_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `score_event_undo_links_match_target_unique` ON `score_event_undo_links` (`match_id`,`target_seq_no`);--> statement-breakpoint
CREATE TABLE `score_events` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`seq_no` integer NOT NULL,
	`event_type` text NOT NULL,
	`side` text,
	`game_no` integer,
	`score_a_before` integer,
	`score_b_before` integer,
	`score_a_after` integer,
	`score_b_after` integer,
	`serving_side_before` text,
	`service_court_before` text,
	`server_player_id_before` text,
	`receiver_player_id_before` text,
	`serving_side_after` text,
	`service_court_after` text,
	`server_player_id_after` text,
	`receiver_player_id_after` text,
	`target_seq_no` integer,
	`reason` text,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`actor_name` text,
	`idempotency_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `score_events_match_seq_unique` ON `score_events` (`match_id`,`seq_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `score_events_match_idempotency_unique` ON `score_events` (`match_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `score_events_match_seq_idx` ON `score_events` (`match_id`,`seq_no`);--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`venue` text,
	`starts_at` text,
	`ends_at` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`public_slug` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournaments_public_slug_unique` ON `tournaments` (`public_slug`);