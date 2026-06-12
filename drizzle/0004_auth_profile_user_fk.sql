PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_auth_user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
	`account_type` text DEFAULT 'participant' NOT NULL,
	`team_id` text,
	`display_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_auth_user_profiles` SELECT * FROM `auth_user_profiles`;
--> statement-breakpoint
DROP TABLE `auth_user_profiles`;
--> statement-breakpoint
ALTER TABLE `__new_auth_user_profiles` RENAME TO `auth_user_profiles`;
--> statement-breakpoint
CREATE INDEX `auth_user_profiles_account_type_idx` ON `auth_user_profiles` (`account_type`);
--> statement-breakpoint
CREATE INDEX `auth_user_profiles_team_id_idx` ON `auth_user_profiles` (`team_id`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
