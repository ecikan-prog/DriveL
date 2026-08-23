ALTER TABLE `drivers`
  ADD COLUMN `status` enum('active','deleted') NOT NULL DEFAULT 'active',
  ADD COLUMN `deletedAt` timestamp NULL;
