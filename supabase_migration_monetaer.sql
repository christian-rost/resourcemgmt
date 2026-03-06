-- ============================================================
-- Migration: Monetäre Projektsteuerung und -erfassung
-- Branch: budget
-- Datum: 2026-03-06
-- ============================================================
-- Dieses Skript in der Supabase SQL-Konsole ausführen.
-- Alle Änderungen sind rückwärtskompatibel (neue Felder nullable).
-- ============================================================

-- 1. Globale Projekt-Mitarbeiter-Rollen (Stammdaten)
CREATE TABLE IF NOT EXISTS project_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT project_roles_name_unique UNIQUE (name)
);

-- 2. Rollenraten je Projekt (Tagessatz, Reisekostenpauschale)
CREATE TABLE IF NOT EXISTS project_role_rates (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role_id              UUID REFERENCES project_roles(id) ON DELETE SET NULL,
    custom_role_name     TEXT,
    daily_rate_eur       NUMERIC(10,2) NOT NULL DEFAULT 0,
    travel_cost_flat_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active            BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT role_or_custom CHECK (
        role_id IS NOT NULL OR (custom_role_name IS NOT NULL AND custom_role_name <> '')
    )
);

CREATE INDEX IF NOT EXISTS idx_project_role_rates_project
    ON project_role_rates(project_id);

-- 3. Projekt: Budget in EUR
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS budget_eur NUMERIC(12,2);

-- 4. Zeiterfassung: Rollenrate-Zuweisung
ALTER TABLE time_entries
    ADD COLUMN IF NOT EXISTS project_role_rate_id UUID
        REFERENCES project_role_rates(id) ON DELETE SET NULL;

-- 5. Planung: Rollenrate-Zuweisung
ALTER TABLE planning_entries
    ADD COLUMN IF NOT EXISTS project_role_rate_id UUID
        REFERENCES project_role_rates(id) ON DELETE SET NULL;

-- 6. app_config: Arbeitsstunden pro Tag für Stundensatz-Berechnung
INSERT INTO app_config (key, value)
VALUES ('daily_work_hours', '8')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Fertig. Prüfung:
-- SELECT * FROM project_roles;
-- SELECT * FROM project_role_rates;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'budget_eur';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'time_entries' AND column_name = 'project_role_rate_id';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'planning_entries' AND column_name = 'project_role_rate_id';
-- SELECT * FROM app_config WHERE key = 'daily_work_hours';
-- ============================================================
