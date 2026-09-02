ALTER TABLE `drivers`
  ADD COLUMN `appAccountToken` varchar(36) NULL,
  ADD UNIQUE KEY `drivers_appAccountToken_unique` (`appAccountToken`);
