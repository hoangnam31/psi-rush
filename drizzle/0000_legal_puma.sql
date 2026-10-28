CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`token` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#8b5cf6' NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`progress` real DEFAULT 0 NOT NULL,
	`finish_position` integer,
	`is_ready` integer DEFAULT false NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_room_name_unique` ON `players` (`room_id`,`name`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`host_token` text NOT NULL,
	`title` text DEFAULT 'Wobble Cup' NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`max_players` integer DEFAULT 50 NOT NULL,
	`total_rounds` integer DEFAULT 3 NOT NULL,
	`current_round` integer DEFAULT 0 NOT NULL,
	`current_map` text,
	`map_pool` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_code_unique` ON `rooms` (`code`);--> statement-breakpoint
CREATE TABLE `round_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`player_id` text NOT NULL,
	`position` integer NOT NULL,
	`points` integer NOT NULL,
	`time_ms` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `round_result_player_unique` ON `round_results` (`room_id`,`round_number`,`player_id`);