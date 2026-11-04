CREATE TABLE `upload` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`contentType` text NOT NULL,
	`size` integer NOT NULL,
	`postId` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upload_key_unique` ON `upload` (`key`);--> statement-breakpoint
CREATE INDEX `upload_postId_idx` ON `upload` (`postId`);