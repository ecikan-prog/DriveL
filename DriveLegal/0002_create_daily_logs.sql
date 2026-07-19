CREATE TABLE IF NOT EXISTS daily_logs (
  id VARCHAR(191) NOT NULL,
  user_id VARCHAR(191) NOT NULL,
  date DATE NOT NULL,
  work_time_rule VARCHAR(50) NULL,

  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3) NOT NULL,

  total_driving_seconds INT NOT NULL DEFAULT 0,
  total_work_seconds INT NOT NULL DEFAULT 0,
  total_other_work_seconds INT NOT NULL DEFAULT 0,

  start_odometer DECIMAL(12,2) NULL,
  end_odometer DECIMAL(12,2) NULL,
  distance_km DECIMAL(12,2) NULL,
  odometer_inverted TINYINT(1) NOT NULL DEFAULT 0,

  start_location_json JSON NULL,
  end_location_json JSON NULL,
  breaks_json JSON NULL,
  events_json JSON NULL,
  other_work_periods_json JSON NULL,
  amendments_json JSON NULL,
  vehicle_changes_json JSON NULL,

  rest_override_flagged TINYINT(1) NOT NULL DEFAULT 0,
  rest_override_note TEXT NULL,

  integrity_hash VARCHAR(128) NULL,
  previous_hash VARCHAR(128) NULL,

  synced_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  INDEX idx_daily_logs_user_id (user_id),
  INDEX idx_daily_logs_start_time (start_time),
  INDEX idx_daily_logs_user_start (user_id, start_time)
);
