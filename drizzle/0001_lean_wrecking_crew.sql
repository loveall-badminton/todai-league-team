CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`event_name` text DEFAULT '東大リーグ団体戦' NOT NULL,
	`group_stage_scoring_rule_id` text,
	`knockout_scoring_rule_id` text,
	`tiebreaker_scoring_rule_id` text,
	`lineup_reveal_policy` text DEFAULT 'on_tie_start' NOT NULL,
	`default_lineup_due_minutes_before` integer DEFAULT 10 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`group_stage_scoring_rule_id`) REFERENCES `scoring_rules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`knockout_scoring_rule_id`) REFERENCES `scoring_rules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tiebreaker_scoring_rule_id`) REFERENCES `scoring_rules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `group_standing_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`group_code` text NOT NULL,
	`team_id` text NOT NULL,
	`manual_rank` integer NOT NULL,
	`reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_standing_overrides_group_team_unique` ON `group_standing_overrides` (`group_code`,`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_standing_overrides_group_rank_unique` ON `group_standing_overrides` (`group_code`,`manual_rank`);--> statement-breakpoint
CREATE TABLE `lineup_items` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`rubber_code` text NOT NULL,
	`player1_id` text NOT NULL,
	`player2_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `lineup_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player1_id`) REFERENCES `team_players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player2_id`) REFERENCES `team_players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lineup_items_submission_rubber_unique` ON `lineup_items` (`submission_id`,`rubber_code`);--> statement-breakpoint
CREATE TABLE `lineup_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`tie_id` text NOT NULL,
	`team_id` text NOT NULL,
	`side` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`submitted_at` text,
	`locked_at` text,
	`revealed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tie_id`) REFERENCES `ties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lineup_submissions_tie_team_unique` ON `lineup_submissions` (`tie_id`,`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `lineup_submissions_tie_side_unique` ON `lineup_submissions` (`tie_id`,`side`);--> statement-breakpoint
CREATE TABLE `officiating_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`tie_id` text NOT NULL,
	`assigned_team_id` text,
	`role` text DEFAULT 'umpire_team' NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tie_id`) REFERENCES `ties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `officiating_assignments_tie_id_idx` ON `officiating_assignments` (`tie_id`);--> statement-breakpoint
CREATE INDEX `officiating_assignments_assigned_team_id_idx` ON `officiating_assignments` (`assigned_team_id`);--> statement-breakpoint
CREATE TABLE `ranking_tiebreakers` (
	`id` text PRIMARY KEY NOT NULL,
	`group_code` text NOT NULL,
	`reason` text NOT NULL,
	`team_a_id` text NOT NULL,
	`team_b_id` text NOT NULL,
	`match_id` text,
	`winner_team_id` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_a_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_b_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`winner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ranking_tiebreakers_group_code_idx` ON `ranking_tiebreakers` (`group_code`);--> statement-breakpoint
CREATE INDEX `ranking_tiebreakers_match_id_idx` ON `ranking_tiebreakers` (`match_id`);--> statement-breakpoint
CREATE TABLE `rubbers` (
	`id` text PRIMARY KEY NOT NULL,
	`tie_id` text NOT NULL,
	`code` text NOT NULL,
	`discipline` text NOT NULL,
	`display_order` integer NOT NULL,
	`scoring_rule_id` text NOT NULL,
	`match_id` text,
	`status` text DEFAULT 'not_ready' NOT NULL,
	`winner_side` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tie_id`) REFERENCES `ties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scoring_rule_id`) REFERENCES `scoring_rules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `rubbers_tie_id_idx` ON `rubbers` (`tie_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rubbers_tie_code_unique` ON `rubbers` (`tie_id`,`code`);--> statement-breakpoint
CREATE INDEX `rubbers_match_id_idx` ON `rubbers` (`match_id`);--> statement-breakpoint
CREATE TABLE `scoring_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`max_games` integer NOT NULL,
	`games_to_win` integer NOT NULL,
	`points_to_win` integer NOT NULL,
	`win_by` integer NOT NULL,
	`max_points` integer NOT NULL,
	`mid_game_interval_point` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scoring_rules_code_unique` ON `scoring_rules` (`code`);--> statement-breakpoint
CREATE TABLE `team_players` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text NOT NULL,
	`gender` text DEFAULT 'unknown' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_players_team_id_idx` ON `team_players` (`team_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text,
	`group_code` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ties` (
	`id` text PRIMARY KEY NOT NULL,
	`tie_code` text NOT NULL,
	`phase` text NOT NULL,
	`group_code` text,
	`round_label` text,
	`team_a_id` text,
	`team_b_id` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`team_score_a` integer DEFAULT 0 NOT NULL,
	`team_score_b` integer DEFAULT 0 NOT NULL,
	`winner_team_id` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`scheduled_start_at` text,
	`actual_start_at` text,
	`actual_end_at` text,
	`venue` text,
	`court_block_code` text,
	`lineup_due_at` text,
	`lineup_due_policy` text DEFAULT 'ten_minutes_before' NOT NULL,
	`lineups_revealed_at` text,
	`operation_note` text,
	`schedule_changed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_a_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`team_b_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`winner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ties_tie_code_unique` ON `ties` (`tie_code`);--> statement-breakpoint
CREATE INDEX `ties_group_code_idx` ON `ties` (`group_code`);--> statement-breakpoint
CREATE INDEX `ties_team_a_idx` ON `ties` (`team_a_id`);--> statement-breakpoint
CREATE INDEX `ties_team_b_idx` ON `ties` (`team_b_id`);--> statement-breakpoint
ALTER TABLE `matches` ADD `rubber_id` text REFERENCES rubbers(id);--> statement-breakpoint
ALTER TABLE `matches` ADD `ranking_tiebreaker_id` text REFERENCES ranking_tiebreakers(id);--> statement-breakpoint
ALTER TABLE `matches` ADD `scoring_rule_id` text REFERENCES scoring_rules(id);--> statement-breakpoint
CREATE INDEX `matches_rubber_id_idx` ON `matches` (`rubber_id`);--> statement-breakpoint
CREATE INDEX `matches_ranking_tiebreaker_id_idx` ON `matches` (`ranking_tiebreaker_id`);--> statement-breakpoint
CREATE INDEX `matches_scoring_rule_id_idx` ON `matches` (`scoring_rule_id`);