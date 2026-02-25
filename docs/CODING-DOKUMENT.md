# Ressourcenmanagement – Coding-Dokumentation

## Projektstruktur

```
ressourcenmanagement/
├── backend/
│   ├── __init__.py
│   ├── auth.py            # JWT, Passwort-Hashing, require_role()
│   ├── config.py          # Env-Vars, Konfiguration
│   ├── database.py        # Supabase-Singleton
│   ├── main.py            # FastAPI App, CORS, Bootstrap, Router-Registration
│   ├── user_storage.py    # User-CRUD gegen Supabase
│   ├── routers/
│   │   ├── stammdaten.py  # /api/stammdaten/*
│   │   ├── zeiterfassung.py # /api/zeiterfassung/*
│   │   ├── zeitplanung.py # /api/zeitplanung/*
│   │   ├── admin.py       # /api/admin/*
│   │   └── reports.py     # /api/reports/*
│   └── services/
│       └── pdf_service.py # ReportLab PDF-Generierung
├── frontend/
│   ├── nixpacks.toml
│   ├── vite.config.js     # Dev-Proxy: /api → localhost:8003
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx        # Navigation, Routing, Role-Rendering
│   │   ├── auth.jsx       # Login, Token-Management
│   │   ├── api.js         # API_BASE aus VITE_API_URL
│   │   ├── index.css      # XQT5 Corporate Design, CSS-Variablen
│   │   ├── toast.jsx      # Toast-Benachrichtigungen
│   │   └── components/
│   │       ├── Login.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Zeiterfassung/
│   │       ├── Zeitplanung/
│   │       ├── Stammdaten/
│   │       ├── Admin/
│   │       └── Reports/
├── supabase/
│   └── schema.sql
├── docs/
├── nixpacks.toml          # Backend-Deployment (Projekt-Root)
├── pyproject.toml
├── requirements.txt       # Generiert via: uv pip compile pyproject.toml -o requirements.txt
└── .env.example
```

---

## Coding-Regeln

### Backend

- **Python 3.12**, FastAPI, Pydantic v2
- Alle Routers als eigenständige Module in `backend/routers/`
- Supabase-Singleton via `backend/database.py` — niemals direkt instanziieren
- Authentifizierung via `Depends(get_current_user)` oder `Depends(require_role(...))`
- Validierung ausschließlich via Pydantic-Models mit `@field_validator`
- Keine direkte SQL-Ausführung — ausschließlich Supabase-Client-API
- Fehlerbehandlung via `HTTPException` mit aussagekräftigen `detail`-Texten

### Frontend

- **React 19**, Vite, Vanilla CSS (kein UI-Framework)
- Alle API-Calls über `API_BASE` aus `api.js` (nie hartkodierte URLs)
- JWT-Token im LocalStorage unter Key `rm_token`
- State-Management ohne externe Bibliothek (useState/useEffect)
- Fehleranzeige immer via `toast.jsx`

### Deployment

- KEIN `uv` in Coolify verfügbar
- Backend nixpacks.toml: venv erstellen + pip install
- Frontend: Base Directory zwingend auf `/frontend` setzen

---

## Architektur-Entscheidungen

### Supabase-Singleton (database.py)

Problem: Mehrere Module (main.py, routers, user_storage) benötigen den Supabase-Client. Direkte Instanziierung in jedem Modul führt zu mehrfachen Verbindungen und zirkulären Imports.

Lösung: Singleton-Pattern in `database.py`:
```python
_client: Optional[Client] = None
# wird einmalig beim Import initialisiert

def get_db() -> Client:
    if not _client:
        raise HTTPException(status_code=503, detail="Database not configured")
    return _client
```

Alle Router importieren: `from ..database import get_db as get_supabase`

### VITE_API_URL Pattern

Problem: Im Entwicklungsmodus läuft Frontend auf Port 5174, Backend auf 8003 (gleicher Host). In Produktion sind es unterschiedliche Domains.

Lösung:
```js
// api.js
export const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : ''
```
- Entwicklung: `VITE_API_URL` nicht gesetzt → leerer String → Proxy greift
- Produktion: `VITE_API_URL=https://rm-api.xqtfive.de`

Vite-Proxy (nur Entwicklung):
```js
// vite.config.js
proxy: { '/api': 'http://localhost:8003' }
```

### Benutzer in Supabase

Benutzer werden in der Tabelle `users` in Supabase gespeichert (nicht als JSON-Dateien). Dies ermöglicht:
- Konsistente UUID-basierte Foreign Keys in allen anderen Tabellen
- Skalierbarkeit ohne Volume-Mounts in Coolify
- Direkter Datenbankzugriff für Joins

Das `user_storage.py` Modul kapselt alle User-Operationen und verwendet intern `database.get_client()`.

---

## API-Endpunkte

### Auth (`/api/auth/`)
| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| POST | `/api/auth/login` | Login, gibt JWT zurück (Rate-Limit: 5/min) |
| GET | `/api/auth/me` | Aktueller Benutzer |

### Stammdaten (`/api/stammdaten/`)
| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/customers` | Alle Kunden |
| POST | `/customers` | Kunde erstellen (admin/manager) |
| PUT | `/customers/{id}` | Kunde aktualisieren |
| DELETE | `/customers/{id}` | Kunde löschen (admin) |
| GET | `/projects` | Alle Projekte (optional: ?customer_id=) |
| GET | `/projects/assigned` | Dem Nutzer zugeordnete Projekte |
| POST | `/projects` | Projekt erstellen |
| PUT | `/projects/{id}` | Projekt aktualisieren |
| DELETE | `/projects/{id}` | Projekt löschen (admin) |
| GET | `/assignments` | Berater-Zuordnungen |
| POST | `/assignments` | Zuordnung erstellen |
| DELETE | `/assignments/{id}` | Zuordnung entfernen |

### Zeiterfassung (`/api/zeiterfassung/`)
| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/entries` | Buchungen (?year=&month=&day=&user_id=&project_id=) |
| POST | `/entries` | Buchung erstellen |
| PUT | `/entries/{id}` | Buchung bearbeiten (nur draft) |
| DELETE | `/entries/{id}` | Buchung löschen (nur draft) |
| POST | `/entries/{id}/status` | Status ändern |
| POST | `/entries/copy` | Buchungen kopieren |
| GET | `/summary` | Aggregation pro Projekt (?year=&month=) |
| GET | `/approval-queue` | Eingereichte Buchungen (admin/manager) |

### Zeitplanung (`/api/zeitplanung/`)
| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/entries` | Planungseinträge (?year=&month=) |
| POST | `/entries` | Planung erstellen (admin/manager) |
| PUT | `/entries/{id}` | Planung aktualisieren |
| DELETE | `/entries/{id}` | Planung löschen |
| POST | `/entries/copy` | Monat kopieren |
| GET | `/dashboard` | Planungs-Dashboard |
| GET | `/budget-validation` | Budget-Überschreitungen |
| GET | `/soll-ist` | Soll-Ist-Vergleich |

### Admin (`/api/admin/`)
| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/users` | Alle Benutzer (admin/manager) |
| POST | `/users` | Benutzer erstellen (admin) |
| PUT | `/users/{id}` | Benutzer aktualisieren (admin) |
| DELETE | `/users/{id}` | Benutzer löschen (admin) |
| GET | `/config` | App-Konfiguration |
| PUT | `/config` | Konfiguration aktualisieren (admin) |

### Reports (`/api/reports/`)
| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/pdf` | PDF-Export (?year=&month=&project_id=&user_id=&billable_only=) |

---

## Datenbank-Schema

### Wichtige Beziehungen

```
customers (1) ──── (n) projects (1) ──── (n) project_assignments (n) ──── (1) users
                                  (1) ──── (n) time_entries       (n) ──── (1) users
                                  (1) ──── (n) planning_entries   (n) ──── (1) users
```

Alle `user_id`-Felder sind UUIDs und referenzieren `users(id)`.

### Status-Übergänge (time_entries)

```python
VALID_STATUSES = ("draft", "submitted", "approved", "rejected")

# Regeln in zeiterfassung.py:
# submitted:  nur aus draft, nur eigene Einträge (außer admin)
# approved:   nur aus submitted, nur admin/manager
# rejected:   nur aus submitted, nur admin/manager (+ rejection_reason)
# draft:      Rücksetzen nur durch admin/manager oder Eigentümer
```

---

## Fehlerjournal

### 2026-02-25 – Coolify: `uv: command not found`

**Ursache:** Nixpacks generiert standardmäßig einen Install-Befehl mit `uv`, welches in Coolify nicht im PATH ist.

**Fix:** `nixpacks.toml` im Projekt-Root mit explizitem Install-Befehl:
```toml
[phases.install]
cmds = ["python3 -m venv /opt/venv", "/opt/venv/bin/pip install -r requirements.txt"]
[start]
cmd = "uvicorn backend.main:app --host 0.0.0.0 --port 8003"
```

### 2026-02-25 – Coolify: `pip: command not found`

**Ursache:** Nix-Python hat kein `pip` im PATH.

**Fix:** `python3 -m pip install` statt `pip install`.
Dann festgestellt: auch `python3 -m pip` schlägt fehl wegen `externally-managed-environment`.

**Endgültiger Fix:** venv erstellen, dann pip aus dem venv nutzen (siehe oben).

### 2026-02-25 – Coolify: `ensurepip: externally-managed-environment`

**Ursache:** Nix-Python blockiert ensurepip mit PEP 668 (immutable Nix-Store).

**Fix:** Kein ensurepip — stattdessen direkt `python3 -m venv /opt/venv` (bringt eigenes pip mit).

### 2026-02-25 – Coolify Frontend: Backend-Log statt Frontend-Build

**Ursache:** Frontend-Service in Coolify hatte kein Base Directory gesetzt — Coolify verwendete das Root-`nixpacks.toml` (Backend) statt `frontend/nixpacks.toml`.

**Fix:** Base Directory im Coolify Frontend-Service auf `/frontend` setzen.

### 2026-02-25 – Backend startet nicht: `JWT_SECRET` fehlt

**Ursache:** `config.py` wirft RuntimeError wenn `JWT_SECRET` nicht gesetzt. Service wurde gestartet bevor die Env-Var gespeichert war.

**Fix:** Env-Var in Coolify setzen → **Update** klicken → Service **Restart**.

---

## Lokale Entwicklung

```bash
# Backend
cd /Users/cro/cursor_developments/ressourcenmanagement
cp .env.example .env
# .env ausfüllen
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8003

# Frontend
cd frontend
npm install
npm run dev  # Port 5174, Proxy zu localhost:8003
```

## Requirements aktualisieren

```bash
uv pip compile pyproject.toml -o requirements.txt
```
