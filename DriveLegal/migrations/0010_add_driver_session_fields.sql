ALTER TABLE `drivers`
  ADD COLUMN `activeSessionTokenHash` varchar(128) NULL,
  ADD COLUMN `activeDeviceId` varchar(128) NULL,
  ADD COLUMN `activeDeviceLabel` varchar(255) NULL,
  ADD COLUMN `activeSessionUpdatedAt` timestamp NULL,
  ADD UNIQUE KEY `drivers_activeSessionTokenHash_unique` (`activeSessionTokenHash`);
