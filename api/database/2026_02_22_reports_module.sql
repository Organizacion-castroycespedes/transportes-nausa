CREATE TABLE IF NOT EXISTS inspections (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  vehicle_id BIGINT NOT NULL,
  driver_id BIGINT NOT NULL,
  created_by BIGINT NOT NULL,
  inspection_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inspections_tenant_id ON inspections (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inspections_inspection_date ON inspections (inspection_date);
CREATE INDEX IF NOT EXISTS idx_inspections_created_by ON inspections (created_by);

CREATE TABLE IF NOT EXISTS inspection_email_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  inspection_id BIGINT,
  frequency VARCHAR(20),
  emails TEXT[],
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inspection_email_logs_tenant_id ON inspection_email_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inspection_email_logs_sent_at ON inspection_email_logs (sent_at);

CREATE TABLE IF NOT EXISTS tenant_report_settings (
  tenant_id BIGINT PRIMARY KEY,
  enabled_daily BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_weekly BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_monthly BOOLEAN NOT NULL DEFAULT FALSE,
  recipient_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_report_settings_daily ON tenant_report_settings (enabled_daily);
CREATE INDEX IF NOT EXISTS idx_tenant_report_settings_weekly ON tenant_report_settings (enabled_weekly);
CREATE INDEX IF NOT EXISTS idx_tenant_report_settings_monthly ON tenant_report_settings (enabled_monthly);
