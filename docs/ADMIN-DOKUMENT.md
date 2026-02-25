# Ressourcenmanagement – Admin-Dokumentation

## Übersicht

Das Ressourcenmanagement-System ist eine webbasierte Anwendung zur Zeiterfassung und Ressourcenplanung für Unternehmensberatungen. Als Administrator haben Sie vollständigen Zugriff auf alle Systemfunktionen.

**URLs:**
- Frontend: https://rm.xqtfive.de
- Backend API: https://rm-api.xqtfive.de
- API-Dokumentation: https://rm-api.xqtfive.de/docs

---

## Infrastruktur

### Architektur

```
Browser → rm.xqtfive.de (Coolify, Node/serve, Port 3000)
               ↓ API-Calls
        rm-api.xqtfive.de (Coolify, Python/uvicorn, Port 8003)
               ↓ Datenbankzugriff
        supabase.xqtfive.de (PostgreSQL)
```

### Coolify – Backend-Service

| Feld | Wert |
|------|------|
| Repository | github.com/christian-rost/resourcemgmt |
| Branch | main |
| Build Pack | Nixpacks |
| Base Directory | `/` (Projekt-Root) |
| Port | 8003 |
| Domain | rm-api.xqtfive.de |

**Erforderliche Environment Variables:**

| Variable | Beschreibung | Pflicht |
|----------|--------------|---------|
| `SUPABASE_URL` | URL der Supabase-Instanz | Ja |
| `SUPABASE_KEY` | Service-Role-Key (nicht Anon-Key) | Ja |
| `JWT_SECRET` | Geheimer Schlüssel für JWT-Token | Ja |
| `admin_user` | Benutzername des Bootstrap-Admins | Empfohlen |
| `admin_pw` | Passwort des Bootstrap-Admins | Empfohlen |
| `CORS_ORIGINS` | Erlaubte Origins (kommagetrennt) | Nein |

`JWT_SECRET` generieren:
```bash
openssl rand -base64 32
```

`CORS_ORIGINS` Standardwert: `http://localhost:5174,http://localhost:3000`
Für Produktion: `https://rm.xqtfive.de`

### Coolify – Frontend-Service

| Feld | Wert |
|------|------|
| Repository | github.com/christian-rost/resourcemgmt |
| Branch | main |
| Build Pack | Nixpacks |
| Base Directory | `/frontend` |
| Port | 3000 |
| Domain | rm.xqtfive.de |

**Erforderliche Environment Variables:**

| Variable | Wert |
|----------|------|
| `VITE_API_URL` | `https://rm-api.xqtfive.de` |

---

## Supabase – Ersteinrichtung

### Schema einspielen

1. Supabase SQL Editor öffnen: https://supabase.xqtfive.de
2. Inhalt von `supabase/schema.sql` vollständig ausführen
3. Standardkonfiguration wird automatisch eingefügt (`app_config`)

### Tabellen-Übersicht

| Tabelle | Inhalt |
|---------|--------|
| `users` | Benutzerkonten mit Rollen und Passwort-Hash |
| `customers` | Kundenstammdaten |
| `projects` | Projekte mit Budget-Stunden |
| `project_assignments` | Zuordnung Berater ↔ Projekt |
| `time_entries` | Zeitbuchungen mit Status-Workflow |
| `planning_entries` | Ressourcenplanung (monatlich/täglich) |
| `app_config` | Systemkonfiguration (Schlüssel-Wert) |

### Supabase-Key

Der `SUPABASE_KEY` muss der **Service-Role-Key** sein (nicht der Anon-Key), da das Backend direkt auf alle Tabellen zugreift. Row-Level Security (RLS) ist nicht aktiv — der Zugriff wird ausschließlich durch die Backend-Autorisierung gesteuert.

---

## Admin-Bootstrap

Beim ersten Start des Backends wird automatisch ein Admin-Benutzer angelegt, sofern `admin_user` und `admin_pw` als Environment Variables gesetzt sind. Dieser Vorgang läuft idempotent: wenn der Benutzer bereits existiert, passiert nichts.

Der Bootstrap-Admin hat die Rolle `admin` und die E-Mail `<admin_user>@local`.

---

## Benutzerverwaltung (im System)

Über **Admin → Benutzerverwaltung** können alle Benutzer verwaltet werden:

| Aktion | Beschreibung |
|--------|--------------|
| Neuer Benutzer | Username, E-Mail, Passwort, Rolle, Anzeigename |
| Bearbeiten | E-Mail, Anzeigename, Rolle, Passwort, Status (aktiv/inaktiv) |
| Löschen | Benutzer permanent entfernen (nicht sich selbst) |

**Rollen:**
- `admin`: Vollzugriff inkl. Benutzerverwaltung und Systemkonfiguration
- `manager`: Zeitplanung, Genehmigungen, Reports aller Berater
- `consultant`: Eigene Zeiterfassung, zugeordnete Projekte

**Passwortanforderungen:** Mindestens 8 Zeichen
**Benutzernamen:** 3–32 Zeichen

---

## Systemkonfiguration

Über **Admin → Konfiguration** (oder API `PUT /api/admin/config`):

| Schlüssel | Beschreibung | Standard |
|-----------|--------------|----------|
| `hours_per_day` | Arbeitsstunden pro Tag | `8` |
| `company_name` | Anzeigename des Unternehmens | `Unternehmensberatung` |
| `logo_url` | URL zum Firmenlogo | (leer) |
| `primary_color` | Primärfarbe (Hex) | `#ee7f00` |
| `dark_color` | Dunkle Farbe (Hex) | `#213452` |

---

## Stammdatenverwaltung

Kunden und Projekte werden unter **Stammdaten** verwaltet. Nur Admins und Manager haben Schreibzugriff.

**Kunden anlegen:** Name + optionaler Kürzel
**Projekte anlegen:** Kunde, Name, Kürzel, Budget-Stunden
**Berater zuordnen:** Projekt auswählen → Berater hinzufügen

Consultants sehen in der Zeiterfassung nur Projekte, denen sie zugeordnet sind.

---

## Deployment-Workflow

Bei Code-Änderungen:
1. Änderungen auf GitHub pushen (`main` Branch)
2. In Coolify: Backend-Service → **Redeploy**
3. In Coolify: Frontend-Service → **Redeploy**

Bei reiner Konfigurationsänderung (nur Env-Vars):
1. Variable in Coolify aktualisieren → **Update** klicken
2. Service **Restart** (kein Redeploy nötig)

---

## Sicherheitshinweise

- **JWT-Token:** Gültigkeit 24 Stunden, im Browser-LocalStorage (`rm_token`)
- **Login-Rate-Limit:** 5 Versuche pro Minute pro IP
- **Passwort-Hashing:** bcrypt
- **CORS:** Nur konfigurierte Origins erlaubt
- **Service-Role-Key:** Niemals im Frontend verwenden oder committen
- **JWT_SECRET:** Regelmäßig rotieren (erfordert Neustart; alle laufenden Sessions werden ungültig)

---

## Troubleshooting

| Problem | Ursache | Lösung |
|---------|---------|--------|
| Backend startet nicht | `JWT_SECRET` fehlt | Env-Var setzen, Restart |
| Login schlägt fehl | Admin-Bootstrap nicht ausgeführt | `admin_user`/`admin_pw` prüfen, Restart |
| 503 Database not configured | `SUPABASE_URL`/`SUPABASE_KEY` fehlen | Env-Vars setzen, Restart |
| CORS-Fehler im Browser | `CORS_ORIGINS` falsch konfiguriert | Frontend-URL eintragen |
| PDF-Export leer | Nur `approved` Einträge werden exportiert | Status der Einträge prüfen |
