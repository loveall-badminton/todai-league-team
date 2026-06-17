PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_auth_user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`account_type` text DEFAULT 'participant' NOT NULL,
	`team_id` text,
	`display_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_auth_user_profiles`("user_id", "account_type", "team_id", "display_name", "created_at", "updated_at") SELECT "user_id", "account_type", "team_id", "display_name", "created_at", "updated_at" FROM `auth_user_profiles`;--> statement-breakpoint
DROP TABLE `auth_user_profiles`;--> statement-breakpoint
ALTER TABLE `__new_auth_user_profiles` RENAME TO `auth_user_profiles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `auth_user_profiles_account_type_idx` ON `auth_user_profiles` (`account_type`);--> statement-breakpoint
CREATE INDEX `auth_user_profiles_team_id_idx` ON `auth_user_profiles` (`team_id`);