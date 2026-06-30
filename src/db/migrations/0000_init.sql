CREATE TABLE `ai_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`model` text NOT NULL,
	`what_said` text,
	`unseen` text,
	`action` text,
	`raw_response` text,
	`prompt_version` text,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`audio_path` text,
	`transcript` text,
	`duration_ms` integer,
	`whisper_model` text,
	`is_private` integer DEFAULT 0 NOT NULL,
	`mood_score` integer,
	`energy_level` integer,
	`tags` text,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `habit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_logs_habit_date_unique` ON `habit_logs` (`habit_id`,`date`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`label` text NOT NULL,
	`icon` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
