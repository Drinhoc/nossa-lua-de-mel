CREATE TABLE `answers` (
	`room` text NOT NULL,
	`round` text NOT NULL,
	`person` text NOT NULL,
	`body` text NOT NULL,
	`photo` text,
	`city` text NOT NULL,
	PRIMARY KEY(`room`, `round`, `person`),
	FOREIGN KEY (`room`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`person` text NOT NULL,
	`round` text NOT NULL,
	`mime` text NOT NULL,
	FOREIGN KEY (`room`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reveals` (
	`room` text NOT NULL,
	`round` text NOT NULL,
	`at` integer NOT NULL,
	`joint` text,
	`decision` text,
	PRIMARY KEY(`room`, `round`),
	FOREIGN KEY (`room`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`pedro` text NOT NULL,
	`mariana` text NOT NULL,
	`playlist` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL
);
