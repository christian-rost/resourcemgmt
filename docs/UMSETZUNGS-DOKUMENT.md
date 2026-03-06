# Ressourcenmanagement – Umsetzungs-Dokumentation

## Ziel-Architektur

```
Frontend (React 19 + Vite)
  → rm.xqtfive.de
  → Coolify, Nixpacks, Node 22, Port 3000
  → Base Directory: /frontend

Backend (Python 3.12 + FastAPI)
  → rm-api.xqtfive.de
  → Coolify, Nixpacks, Python 3.12, Port 8003
  → Base Directory: / (Projekt-Root)

Datenbank
  → Supabase (PostgreSQL) unter supabase.xqtfive.de
  → Service-Role-Key, kein RLS

Code-Repository
  → github.com/christian-rost/resourcemgmt
  → Branch: main
```

---

## Technische Entscheidungen

| Thema | Entscheidung | Begründung |
|-------|-------------|------------|
| Frontend-Framework | React 19 + Vite | Analog zu anderen Projekten (Stammdatenmanagement) |
| CSS | Vanilla CSS, keine UI-Bibliothek | XQT5 Corporate Design, Konsistenz mit anderen Projekten |
| Backend | FastAPI + uvicorn | Async, schnell, Pydantic v2-Integration |
| Auth | JWT (python-jose), bcrypt | Stateless, Standard |
| Datenbank | Supabase (supabase-py) | Bereits in Betrieb, kein separates DB-Management |
| PDF | ReportLab | Serverseitig, kein Browser-Rendering nötig |
| User-Storage | Supabase `users`-Tabelle | Konsistente UUIDs, keine Volume-Mounts in Coolify |
| Deployment | Coolify + Nixpacks | Bestehende Infrastruktur |

---

## Implementierungs-Phasen

### Phase 1 – Grundgerüst

**Ziel:** Lauffähiges Backend + Frontend mit Login

**Artefakte:**
- `backend/__init__.py`
- `backend/config.py` — Env-Vars (SUPABASE_URL, SUPABASE_KEY, JWT_SECRET, admin_user, admin_pw, CORS_ORIGINS, PORT=8003)
- `backend/database.py` — Supabase-Singleton mit `get_db()` / `get_client()`
- `backend/auth.py` — JWT erstellen/verifizieren, `hash_password()`, `authenticate_user()`, `require_role(*roles)`
- `backend/user_storage.py` — User-CRUD gegen Supabase-Tabelle
- `backend/main.py` — FastAPI-App, CORS, Rate-Limiter, Bootstrap-Admin, Auth-Endpoints, Router-Registration
- `frontend/src/auth.jsx` — Login-Formular, Token-Verwaltung
- `frontend/src/api.js` — `API_BASE` aus VITE_API_URL
- `frontend/src/index.css` — XQT5 Corporate Design (CSS-Variablen)
- `frontend/src/toast.jsx` — Toast-Benachrichtigungen
- `frontend/src/main.jsx`, `App.jsx` — App-Shell, Navigation

### Phase 2 – Stammdaten

**Ziel:** Kunden, Projekte, Beraterzuordnungen verwalten

**Artefakte:**
- `backend/routers/stammdaten.py`
  - GET/POST/PUT/DELETE `/api/stammdaten/customers`
  - GET/POST/PUT/DELETE `/api/stammdaten/projects`
  - GET `/api/stammdaten/projects/assigned`
  - GET/POST/DELETE `/api/stammdaten/assignments`
- `frontend/src/components/Stammdaten/StammdatenView.jsx`

**Besonderheit:** `/projects/assigned` gibt Consultants nur zugeordnete Projekte, Admins/Manager alle aktiven.

### Phase 3 – Zeiterfassung

**Ziel:** Zeitbuchungen mit vollständigem Status-Workflow

**Artefakte:**
- `backend/routers/zeiterfassung.py`
  - CRUD `/api/zeiterfassung/entries`
  - POST `/api/zeiterfassung/entries/{id}/status`
  - POST `/api/zeiterfassung/entries/copy`
  - GET `/api/zeiterfassung/summary`
  - GET `/api/zeiterfassung/approval-queue`
- `frontend/src/components/Zeiterfassung/`

**Status-Regeln:**
```
draft → submitted: Nur Eigentümer oder Admin
submitted → approved: Nur Admin/Manager
submitted → rejected: Nur Admin/Manager (rejection_reason erforderlich)
* → draft: Admin/Manager (Rücksetzen)
```

**Edit-Regel:** Nur `draft`-Einträge können bearbeitet/gelöscht werden. Admins können immer bearbeiten.

### Phase 4 – Ressourcenplanung

**Ziel:** Beratereinsätze planen, Budget überwachen

**Artefakte:**
- `backend/routers/zeitplanung.py`
  - CRUD `/api/zeitplanung/entries`
  - POST `/api/zeitplanung/entries/copy`
  - GET `/api/zeitplanung/dashboard`
  - GET `/api/zeitplanung/budget-validation`
  - GET `/api/zeitplanung/soll-ist`
- `frontend/src/components/Zeitplanung/ZeitplanungView.jsx`

**Budget-Validierung:** Aggregiert alle Planungsstunden pro Projekt und vergleicht mit `projects.budget_hours`. Delta = Planung - Budget. Positiv = Überschreitung.

**Soll-Ist:** Aggregiert Planungs- und Ist-Stunden pro Projekt. Delta = Ist - Soll.

### Phase 5 – Admin & Konfiguration

**Ziel:** Benutzerverwaltung und Systemkonfiguration

**Artefakte:**
- `backend/routers/admin.py`
  - CRUD `/api/admin/users`
  - GET/PUT `/api/admin/config`
- `frontend/src/components/Admin/AdminView.jsx`

**Konfigurationsschlüssel in `app_config`:**
- `hours_per_day`, `daily_work_hours`, `company_name`, `logo_url`, `primary_color`, `dark_color`

### Phase 6 – Reports

**Ziel:** PDF-Export für Kundenabrechnung

**Artefakte:**
- `backend/routers/reports.py` — GET `/api/reports/pdf`
- `backend/services/pdf_service.py` — ReportLab PDF-Generierung
- `backend/services/excel_service.py` — openpyxl Excel-Export (XQT5-Vorlage)
- `frontend/src/components/Reports/ReportsView.jsx`

**PDF-Inhalt:** Firmenname (aus app_config), Projektname/Kundename, Monat, Tabelle (Datum, Stunden, Pause, Kommentar), Gesamtsumme.
**Filter:** Nur `approved` Einträge, optional `billable_only=true`.

### Phase 7 – Monetäre Erfassung

**Ziel:** Tagessätze, EUR-Budgets und monetäres Dashboard

**Artefakte:**
- `supabase_migration_monetaer.sql` — DB-Migration (einmalig in Supabase ausführen)
- `backend/routers/stammdaten.py` — Neue Endpunkte für `project-roles` und `projects/{id}/role-rates`
- `backend/routers/zeitplanung.py` — Neue Endpunkte `budget-validation-eur` und `budget-dashboard`
- `backend/routers/zeiterfassung.py` — Feld `project_role_rate_id` in Buchungen
- `backend/routers/reports.py` — Join auf `project_role_rates` für PDF/Excel
- `backend/services/pdf_service.py` — Monetäre Spalten + EUR-Footer (rückwärtskompatibel)
- `frontend/src/components/Stammdaten/StammdatenView.jsx` — Tabs Projektrollen + Rollen & Tagessätze
- `frontend/src/components/Zeiterfassung/EntryForm.jsx` — Rollenauswahl + Autofill via localStorage
- `frontend/src/components/Budget/BudgetDashboard.jsx` — KPI-Karten, SVG-Liniendiagramm, Tabelle

**Autofill:** Letzte gewählte Rolle je Projekt wird in `localStorage` unter `lastRole_${projectId}` gespeichert.
**Forecast:** Linearer Forecast = (Ist-EUR bis heute / vergangene Tage) × Gesamttage im Jahr.
**Rückwärtskompatibilität:** Buchungen ohne `project_role_rate_id` verhalten sich wie zuvor.

---

## Supabase-Schema

Vollständiges Schema: `supabase/schema.sql`

**Tabellen (Grundschema `supabase/schema.sql`):**

```sql
users              (id uuid PK, username, email, display_name, role, password_hash, is_active)
customers          (id uuid PK, name, short_code, is_active)
projects           (id uuid PK, customer_id FK, name, short_code, budget_hours, is_active)
project_assignments(id uuid PK, project_id FK, user_id FK, UNIQUE(project_id, user_id))
time_entries       (id uuid PK, user_id FK, project_id FK, entry_date, start_time, end_time,
                    hours, break_hours, comment, is_billable, status,
                    approved_by FK, approved_at, rejection_reason)
planning_entries   (id uuid PK, user_id FK, project_id FK, plan_year, plan_month, plan_day,
                    hours)
app_config         (key text PK, value text)
```

**Monetäre Erweiterung (`supabase_migration_monetaer.sql`):**

```sql
project_roles      (id uuid PK, name text UNIQUE, description text, is_active bool)
project_role_rates (id uuid PK, project_id FK, role_id FK nullable, custom_role_name text,
                    daily_rate_eur numeric(10,2), travel_cost_flat_eur numeric(10,2), is_active bool)
-- Constraint: role_id IS NOT NULL OR custom_role_name != ''

ALTER TABLE projects      ADD COLUMN budget_eur numeric(12,2);
ALTER TABLE time_entries  ADD COLUMN project_role_rate_id uuid FK → project_role_rates;
ALTER TABLE planning_entries ADD COLUMN project_role_rate_id uuid FK → project_role_rates;
INSERT INTO app_config VALUES ('daily_work_hours', '8');
```

`hourly_rate_eur` wird nicht gespeichert — Berechnung: `daily_rate_eur / daily_work_hours`.

**Indexes:**
- `users`: username, email
- `time_entries`: (user_id, entry_date), project_id, status
- `planning_entries`: (user_id, plan_year, plan_month), project_id

**Standardkonfiguration (automatisch eingefügt):**
```sql
hours_per_day    = '8'
daily_work_hours = '8'
company_name     = 'Unternehmensberatung'
primary_color    = '#ee7f00'
dark_color       = '#213452'
```

---

## Coolify-Setup (vollständig)

### Backend-Service

1. New Resource → Application → GitHub → `christian-rost/resourcemgmt`
2. Branch: `main`, Build Pack: `Nixpacks`, Base Directory: `/`
3. Port: `8003`
4. Domain: `rm-api.xqtfive.de`
5. Environment Variables:

```
SUPABASE_URL      = https://supabase.xqtfive.de
SUPABASE_KEY      = <service-role-key>
JWT_SECRET        = <openssl rand -base64 32>
admin_user        = <wunsch-admin-username>
admin_pw          = <starkes-passwort>
CORS_ORIGINS      = https://rm.xqtfive.de
```

### Frontend-Service

1. New Resource → Application → GitHub → `christian-rost/resourcemgmt`
2. Branch: `main`, Build Pack: `Nixpacks`, **Base Directory: `/frontend`**
3. Port: `3000`
4. Domain: `rm.xqtfive.de`
5. Environment Variables:

```
VITE_API_URL = https://rm-api.xqtfive.de
```

### Deployment-Reihenfolge

1. Supabase: `schema.sql` ausführen (Ersteinrichtung)
2. Supabase: `supabase_migration_monetaer.sql` ausführen (monetäre Erweiterung, einmalig)
3. Backend deployen (wartet auf Supabase)
4. Frontend deployen (wartet auf Backend-URL)

---

## Deployment-Konfiguration

### `nixpacks.toml` (Backend, Projekt-Root)

```toml
[phases.setup]
nixPkgs = ["python312"]

[phases.install]
cmds = ["python3 -m venv /opt/venv", "/opt/venv/bin/pip install -r requirements.txt"]

[start]
cmd = "uvicorn backend.main:app --host 0.0.0.0 --port 8003"
```

**Warum venv:** Nix-Python ist "externally managed" (PEP 668). Ein eigenes venv umgeht den immutable Nix-Store. Nixpacks setzt `/opt/venv/bin` automatisch in `PATH`.

### `frontend/nixpacks.toml`

```toml
[phases.setup]
nixPkgs = ["nodejs_22"]

[phases.install]
cmds = ["npm install"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npx serve dist -s -p 3000 -L"
```

---

## Abhängigkeiten (Backend)

| Paket | Version | Zweck |
|-------|---------|-------|
| fastapi | 0.133.0 | Web-Framework |
| uvicorn | 0.41.0 | ASGI-Server |
| supabase | 2.28.0 | Datenbankzugriff |
| python-jose | 3.5.0 | JWT |
| passlib + bcrypt | 1.7.4 / 4.0.1 | Passwort-Hashing |
| slowapi | 0.1.9 | Rate-Limiting |
| reportlab | 4.4.10 | PDF-Generierung |
| openpyxl | 3.1.x | Excel-Export |
| pydantic | 2.12.5 | Validierung |
| python-dotenv | 1.2.1 | Env-Var-Laden |

`requirements.txt` wird mit `uv pip compile pyproject.toml -o requirements.txt` generiert.
