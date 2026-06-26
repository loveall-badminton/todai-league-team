CREATE INDEX `rubbers_status_pair_idx` ON `rubbers` (`status`,`match_id`);--> statement-breakpoint
CREATE INDEX `score_events_event_type_idx` ON `score_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `teams_group_status_idx` ON `teams` (`group_code`,`status`);