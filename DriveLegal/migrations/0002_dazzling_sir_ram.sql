CREATE TABLE `operator_drivers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`operatorId` int NOT NULL,
	`driverLocalUserId` varchar(128) NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operator_drivers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(64) NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operators_id` PRIMARY KEY(`id`),
	CONSTRAINT `operators_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `drivers` MODIFY COLUMN `driverType` enum('goods','large_passenger','small_passenger','vehicle_recovery') NOT NULL DEFAULT 'small_passenger';