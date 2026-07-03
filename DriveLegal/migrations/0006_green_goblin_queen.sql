CREATE TABLE `email_verification_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_verification_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_verification_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `drivers` ADD `emailVerified` boolean DEFAULT false NOT NULL;