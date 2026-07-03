CREATE TABLE `drivers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`localUserId` varchar(128) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`licenceNumber` varchar(64),
	`vehicleRegistration` varchar(32),
	`vehicleType` varchar(64),
	`driverType` enum('goods','passenger') NOT NULL DEFAULT 'passenger',
	`trialStartDate` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drivers_id` PRIMARY KEY(`id`),
	CONSTRAINT `drivers_localUserId_unique` UNIQUE(`localUserId`),
	CONSTRAINT `drivers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `shift_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`logId` varchar(255) NOT NULL,
	`driverLocalUserId` varchar(128) NOT NULL,
	`date` varchar(10) NOT NULL,
	`logData` json NOT NULL,
	`canonicalJson` text NOT NULL,
	`hash` varchar(128) NOT NULL,
	`previousHash` varchar(128) NOT NULL,
	`hashTimestamp` varchar(32) NOT NULL,
	`startTime` varchar(32) NOT NULL,
	`endTime` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shift_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `shift_logs_logId_unique` UNIQUE(`logId`)
);
