-- Ressourcenmanagement – Supabase Schema
-- Execute this in the Supabase SQL Editor

-- ── Kunden ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    short_code  text UNIQUE,
    is_active   boolean DEFAULT true,
    created_at  timestamptz DEFAULT now()
);

-- ── Projekte ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  uuid REFERENCES customers(id) ON DELETE CASCADE,
    name         text NOT NULL,
    short_code   text,
    budget_hours decimal DEFAULT 0,
    is_active    boolean DEFAULT true,
    created_at   timestamptz DEFAULT now()
);

-- ── Berater-Projekt-Zuordnung ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_assignments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
    user_id     text NOT NULL,
    created_at  timestamptz DEFAULT now(),
    UNIQUE (project_id, user_id)
);

-- ── Zeiterfassungen ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_entries (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          text NOT NULL,
    project_id       uuid REFERENCES projects(id) ON DELETE SET NULL,
    entry_date       date NOT NULL,
    hours            decimal NOT NULL CHECK (hours > 0),
    break_hours      decimal DEFAULT 0 CHECK (break_hours >= 0),
    comment          text,
    is_billable      boolean DEFAULT true,
    status           text DEFAULT 'draft'
                        CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    approved_by      text,
    approved_at      timestamptz,
    rejection_reason text,
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_date
    ON time_entries (user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_project
    ON time_entries (project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_status
    ON time_entries (status);

-- ── Zeitplanungen ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planning_entries (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     text NOT NULL,
    project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
    plan_year   integer NOT NULL,
    plan_month  integer NOT NULL CHECK (plan_month BETWEEN 1 AND 12),
    plan_day    integer CHECK (plan_day BETWEEN 1 AND 31),  -- NULL = Monatsplanung
    hours       decimal NOT NULL CHECK (hours > 0),
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planning_user_period
    ON planning_entries (user_id, plan_year, plan_month);
CREATE INDEX IF NOT EXISTS idx_planning_project
    ON planning_entries (project_id);

-- ── App-Konfiguration ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
    key        text PRIMARY KEY,
    value      text NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- Standardkonfiguration
INSERT INTO app_config (key, value) VALUES
    ('hours_per_day',  '8'),
    ('company_name',   'Unternehmensberatung'),
    ('logo_url',       ''),
    ('primary_color',  '#ee7f00'),
    ('dark_color',     '#213452')
ON CONFLICT (key) DO NOTHING;

-- ── Row-Level Security (optional, empfohlen) ──────────────────────────────────
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE planning_entries ENABLE ROW LEVEL SECURITY;
-- (RLS-Policies über Backend-JWT gesteuert – Anon-Key hat keinen Direktzugriff)
