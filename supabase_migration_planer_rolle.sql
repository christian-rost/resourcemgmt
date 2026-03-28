-- Migration: Planer-Rolle und Übernommen-Status
-- Fügt is_planer-Flag zu users und acknowledged-Felder zu planning_change_log hinzu

-- Neues Flag für Planer-Rolle (nur gültig zusammen mit role='manager')
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_planer boolean DEFAULT false;

-- Übernommen-Status für Planungsänderungs-Einträge
ALTER TABLE planning_change_log ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES users(id);
ALTER TABLE planning_change_log ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
