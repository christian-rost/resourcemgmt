-- Migration: Planungsänderungs-Log
-- Erstellt Tabelle planning_change_log und fügt neue app_config-Einträge hinzu

CREATE TABLE IF NOT EXISTS planning_change_log (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  planning_entry_id text,        -- nullable (gelöschte Einträge verlieren FK)
  changed_by        uuid REFERENCES users(id),
  changed_at        timestamptz DEFAULT now(),
  action            text CHECK (action IN ('create','update','delete')),
  old_data          jsonb,       -- null bei create
  new_data          jsonb,       -- null bei delete
  affected_user_id  uuid REFERENCES users(id),  -- user_id des Planungseintrags
  project_id        text,
  plan_year         int,
  plan_month        int
);

-- Index für häufige Filter-Queries
CREATE INDEX IF NOT EXISTS idx_pcl_changed_at      ON planning_change_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcl_affected_user   ON planning_change_log (affected_user_id);
CREATE INDEX IF NOT EXISTS idx_pcl_project_id      ON planning_change_log (project_id);
CREATE INDEX IF NOT EXISTS idx_pcl_year_month      ON planning_change_log (plan_year, plan_month);

-- Standard-Konfigurationswerte für E-Mail und Rollen
INSERT INTO app_config (key, value) VALUES
  ('smtp_host',                 '')           ON CONFLICT (key) DO NOTHING;
INSERT INTO app_config (key, value) VALUES
  ('smtp_port',                 '587')        ON CONFLICT (key) DO NOTHING;
INSERT INTO app_config (key, value) VALUES
  ('smtp_user',                 '')           ON CONFLICT (key) DO NOTHING;
INSERT INTO app_config (key, value) VALUES
  ('smtp_password',             '')           ON CONFLICT (key) DO NOTHING;
INSERT INTO app_config (key, value) VALUES
  ('smtp_from',                 '')           ON CONFLICT (key) DO NOTHING;
INSERT INTO app_config (key, value) VALUES
  ('smtp_tls',                  'true')       ON CONFLICT (key) DO NOTHING;
INSERT INTO app_config (key, value) VALUES
  ('change_notification_roles', 'admin,manager') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_config (key, value) VALUES
  ('change_report_roles',       'admin,manager') ON CONFLICT (key) DO NOTHING;
