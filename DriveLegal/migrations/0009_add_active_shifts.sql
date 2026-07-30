CREATE TABLE `active_shifts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `driverLocalUserId` varchar(128) NOT NULL,
  `shiftData` json NOT NULL,
  `startTime` varchar(32) NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `active_shifts_id` PRIMARY KEY (`id`),
  CONSTRAINT `active_shifts_driver_unique` UNIQUE (`driverLocalUserId`)
);
