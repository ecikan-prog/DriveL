CREATE TABLE IF NOT EXISTS `admin_accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(320) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `role` varchar(32) NOT NULL DEFAULT 'admin',
  `isActive` boolean NOT NULL DEFAULT true,
  `sessionVersion` int NOT NULL DEFAULT 0,
  `lastLogin` timestamp NULL,
  `passwordResetTokenHash` varchar(64) NULL,
  `passwordResetRequestedAt` timestamp NULL,
  `passwordResetExpiresAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `admin_accounts_id` PRIMARY KEY(`id`),
  CONSTRAINT `admin_accounts_email_unique` UNIQUE(`email`)
);
