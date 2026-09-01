-- Build 96: single active device per account
-- Tracks one active session per Drive Legal account.
-- On a new login the client calls createSession; if an active session
-- already exists for a different device the server returns a conflict
-- and the client prompts the user to take over or cancel.
CREATE TABLE IF NOT EXISTS `driver_sessions` (
  `id`            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `localUserId`   VARCHAR(128) NOT NULL,
  `sessionToken`  VARCHAR(128) NOT NULL UNIQUE,
  `deviceId`      VARCHAR(128) NOT NULL,
  -- Human-readable hint surfaced in the conflict dialog (e.g. "iPhone 14")
  `deviceLabel`   VARCHAR(255) NULL,
  `createdAt`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Set when this session is explicitly invalidated by a takeover
  `invalidatedAt` TIMESTAMP    NULL,
  INDEX `idx_driver_sessions_userId` (`localUserId`)
);
