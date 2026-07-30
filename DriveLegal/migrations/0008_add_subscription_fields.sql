ALTER TABLE `drivers`
  ADD COLUMN `trialEndDate` varchar(32) NULL,
  ADD COLUMN `subscriptionStatus` enum(
    'trial',
    'active',
    'expired',
    'cancelled'
  ) NOT NULL DEFAULT 'trial',
  ADD COLUMN `subscriptionPlan` enum(
    'monthly',
    'annual'
  ) NULL,
  ADD COLUMN `subscriptionId` varchar(255) NULL,
  ADD COLUMN `currentPeriodEnd` varchar(32) NULL;
