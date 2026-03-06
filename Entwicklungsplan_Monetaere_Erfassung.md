# Entwicklungsplan: Monetäre Projektsteuerung und -erfassung

**Basis-Dokumente:**
- `Anforderungen_Zeiterfassung_Zeitplanung_v0_1.docx` (bestehende Anforderungen)
- `Anforderungen_Monetaere_Erfassung_v0_1.docx` (neue Anforderungen, dieses Dokument)

**Stand:** 2026-03-06
**Status:** Planung

---

## 1. Anforderungsanalyse und Abgleich

### 1.1 Neue Anforderungen (REQ-M*)

| ID | Anforderung | Priorität |
|----|-------------|-----------|
| REQ-M01 | Globale Projekt-Mitarbeiter-Rollen als Stammdaten anlegen/verwalten | Hoch |
| REQ-M02 | Projektspezifische Rollen (nur für ein Projekt, nicht global) | Mittel |
| REQ-M03 | Tagessatz in EUR + Reisekostenpauschale je Projekt-Rolle-Kombination | Hoch |
| REQ-M04 | Gleiche Rolle mehrfach mit unterschiedlichen Tagessätzen je Projekt | Mittel |
| REQ-M05 | Stundensatz = Tagessatz / konfigurierbare Arbeitsstunden (berechnetes Feld) | Mittel |
| REQ-M06 | Zuweisung von Rollen/Tagessätzen durch Manager oder Admin | Hoch |
| REQ-M07 | Rollenauswahl je Zeiterfassungszeile (Dropdown, read-only Werte) | Hoch |
| REQ-M08 | Autofill: Letzte Rolle eines Projekts wird vorausgewählt | Niedrig |
| REQ-M09 | Reporting/Export: Tagessätze und Reisekostenpauschalen ausgeben | Mittel |
| REQ-M10 | Projektplanung: Tagessätze + Reisekosten + Projekt-Budget (EUR) | Hoch |
| REQ-M11 | Automatische Budget-Kontrolle: Plan vs. Budget (farblich grün/rot) | Hoch |
| REQ-M12 | Budget-Dashboard: Plan vs. Ist, Trend, Forecast, Projekt-Dropdown | Mittel |
| REQ-M13 | *(Offene Frage)* Umsatzberechnung je Zeiterfassungszeile für Berater | Klärung nötig |

### 1.2 Synchronisation mit bestehenden Anforderungen

| Bestehende REQ | Betroffene neue Anforderung | Anpassungsbedarf |
|---|---|---|
| REQ-10 (Zeitkontingent/Budget-Validierung in Stunden) | REQ-M10/M11 | Budget-Validierung wird um EUR-Dimension erweitert (Stunden-Budget bleibt erhalten) |
| REQ-11 (Soll-Ist-Vergleich) | REQ-M12 | Dashboard wird um monetäre Dimension erweitert |
| REQ-12/13 (Dashboard + Report Zeitplanung) | REQ-M12 | Budget-Dashboard als eigener Bereich oder Tab |
| REQ-16/17 (PDF-Export, Report) | REQ-M09 | PDF/Excel-Export um Tagessatz, Reisekosten erweitern |
| REQ-18 (Billable/Non-billable) | REQ-M07 | Kombination Rolle + is_billable bleibt erhalten |

### 1.3 Offene Frage (aus Anforderungsdokument)

> **REQ-M13**: Sollen in der Zeiterfassung die Stundensätze × Zeiterfassungszeile berechnet und angezeigt werden (z. B. 0,5h × 200€/h = 100€ Umsatz)?

**Empfehlung:** Umsatzberechnung nur für Manager/Admin sichtbar (im Budget-Dashboard und Report), nicht für den Berater in der eigenen Zeiterfassung. Dies vermeidet Datenschutzkonflikte und entspricht typischen Praxisanforderungen in Unternehmensberatungen. **Klärung mit Auftraggeber vor Implementierung nötig.**

---

## 2. Datenbankschema-Erweiterungen

### 2.1 Neue Tabelle: `project_roles` (globale Stammdaten)

```sql
CREATE TABLE project_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Beispieldaten: "Senior Consultant", "Manager", "Partner", "Junior Consultant"

### 2.2 Neue Tabelle: `project_role_rates` (Rolle + Satz je Projekt)

```sql
CREATE TABLE project_role_rates (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role_id               UUID REFERENCES project_roles(id) ON DELETE SET NULL,
    -- nullable: nur für projektspezifische Rollen ohne globale Stammdaten-Zuordnung
    custom_role_name      TEXT,
    -- Constraint: entweder role_id oder custom_role_name muss gesetzt sein
    daily_rate_eur        NUMERIC(10,2) NOT NULL DEFAULT 0,
    travel_cost_flat_eur  NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active             BOOLEAN NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT role_or_custom CHECK (
        role_id IS NOT NULL OR (custom_role_name IS NOT NULL AND custom_role_name != '')
    )
);
-- Index für schnellen Zugriff nach Projekt
CREATE INDEX idx_project_role_rates_project ON project_role_rates(project_id);
```

**Hinweis:** Dieselbe Rolle kann mehrfach mit unterschiedlichen Tagessätzen dem Projekt zugewiesen werden (kein Unique-Constraint auf project_id + role_id).

### 2.3 Erweiterung `projects`

```sql
ALTER TABLE projects ADD COLUMN budget_eur NUMERIC(12,2);
-- budget_hours bleibt unverändert erhalten (Stunden-Budget)
```

### 2.4 Erweiterung `time_entries`

```sql
ALTER TABLE time_entries
    ADD COLUMN project_role_rate_id UUID REFERENCES project_role_rates(id) ON DELETE SET NULL;
```

### 2.5 Erweiterung `planning_entries`

```sql
ALTER TABLE planning_entries
    ADD COLUMN project_role_rate_id UUID REFERENCES project_role_rates(id) ON DELETE SET NULL;
```

### 2.6 Erweiterung `app_config`

Neuer Konfigurationsschlüssel (initial befüllen):
```sql
INSERT INTO app_config (key, value) VALUES ('daily_work_hours', '8')
ON CONFLICT (key) DO NOTHING;
```

Dieser Wert wird für die Berechnung `Stundensatz = Tagessatz / daily_work_hours` verwendet.

---

## 3. Backend-Erweiterungen

### 3.1 `backend/routers/stammdaten.py` – Erweiterungen

**Neue Endpoints:**
- `GET /api/stammdaten/project-roles` – Alle globalen Rollen (alle Rollen)
- `POST /api/stammdaten/project-roles` – Rolle anlegen (admin/manager)
- `PUT /api/stammdaten/project-roles/{id}` – Rolle aktualisieren (admin/manager)
- `DELETE /api/stammdaten/project-roles/{id}` – Rolle löschen/deaktivieren (admin)
- `GET /api/stammdaten/projects/{project_id}/role-rates` – Rollenraten eines Projekts
- `POST /api/stammdaten/projects/{project_id}/role-rates` – Rollenrate anlegen (admin/manager)
- `PUT /api/stammdaten/projects/{project_id}/role-rates/{rate_id}` – Rollenrate aktualisieren
- `DELETE /api/stammdaten/projects/{project_id}/role-rates/{rate_id}` – Rollenrate entfernen

**Erweiterung bestehender Endpoints:**
- `GET /api/stammdaten/projects` → Feld `budget_eur` mit zurückgeben
- `POST /api/stammdaten/projects` → `budget_eur` als optionales Feld akzeptieren
- `PUT /api/stammdaten/projects/{id}` → `budget_eur` als optionales Update-Feld

**Berechnetes Feld `hourly_rate`:**
- Wird im Response berechnet aus `daily_rate_eur / daily_work_hours` (via app_config)
- Nicht in DB gespeichert, sondern serverseitig berechnet

### 3.2 `backend/routers/zeiterfassung.py` – Erweiterungen

- `TimeEntryCreate` + `TimeEntryUpdate`: neues optionales Feld `project_role_rate_id`
- `GET /api/zeiterfassung/entries` → Join mit `project_role_rates` + `project_roles` (name, daily_rate_eur, travel_cost_flat_eur, hourly_rate)
- `POST /api/zeiterfassung/entries/copy` → `project_role_rate_id` mitübernehmen

### 3.3 `backend/routers/zeitplanung.py` – Erweiterungen

- `PlanEntryCreate` + `PlanEntryUpdate`: neues optionales Feld `project_role_rate_id`
- `GET /api/zeitplanung/entries` → Join mit `project_role_rates`
- `POST /api/zeitplanung/entries/copy` → `project_role_rate_id` mitübernehmen
- Neuer Endpoint: `GET /api/zeitplanung/budget-validation-eur` (Plan-EUR vs. budget_eur)
  - Berechnung: `SUM(planned_hours / daily_work_hours * daily_rate_eur + travel_cost_flat_eur)` vs. `budget_eur`
  - Response: `{ project_id, project_name, customer_name, budget_eur, planned_eur, delta_eur, over_budget, delta_pct }`

### 3.4 Neuer Router: `backend/routers/budget_dashboard.py`

Endpoints für das Budget-Dashboard (nur admin/manager):

- `GET /api/budget-dashboard/overview`
  - Parameter: `project_id`, `year`, optional `month`
  - Response: monatliche Plan-EUR vs. Ist-EUR Reihe (für Grafik)

- `GET /api/budget-dashboard/trend`
  - Parameter: `project_id`, `year`
  - Response: monatliche Entwicklung kumuliert (für Trendlinie)

- `GET /api/budget-dashboard/forecast`
  - Parameter: `project_id`, `year`
  - Berechnung: lineare Extrapolation aus bisherigen Ist-Werten auf Jahresende
  - Response: `{ projected_annual_eur, budget_eur, projected_delta_eur }`

### 3.5 `backend/services/pdf_service.py` + `excel_service.py` – Erweiterungen

- Neue Spalten in Report-Ausgabe: "Rolle", "Tagessatz", "Stundensatz", "Reisekostenpauschale"
- Berechnete Summe im Footer: Gesamtbetrag (Stunden × Stundensatz), Reisekosten gesamt
- Nur ausgeben, wenn Rollendaten vorhanden (rückwärtskompatibel)

---

## 4. Frontend-Erweiterungen

### 4.1 `StammdatenView.jsx` – Erweiterungen

**Neuer Unterbereich: "Projekt-Mitarbeiter-Rollen"**
- Tabelle mit allen globalen Rollen (Name, Beschreibung, Aktiv/Inaktiv)
- Anlegen/Bearbeiten/Deaktivieren von Rollen (admin/manager)

**Erweiterung Projekt-Detail:**
- Neuer Abschnitt: "Rollen & Tagessätze" je Projekt
- Tabelle mit Rollenraten: Rolle (Drop-Down aus globalen Rollen oder Freitext), Tagessatz, Stundensatz (berechnet, read-only), Reisekostenpauschale
- Möglichkeit dieselbe Rolle mehrfach mit unterschiedlichen Sätzen hinzuzufügen
- Neues Feld: "Budget (EUR)" im Projekt-Formular

### 4.2 `EntryForm.jsx` / `TagView.jsx` / `WocheView.jsx` – Erweiterungen

**Rollenauswahl je Buchungszeile:**
- Dropdown: lädt `project_role_rates` für das gewählte Projekt
- Anzeige: "Rollenname – 1.000,00 €/Tag" (kombinierter Label)
- Nach Auswahl: Tagessatz, Stundensatz, Reisekostenpauschale als read-only Felder anzeigen
- **Autofill:** Letzte für das Projekt verwendete Rollenrate wird vorausgewählt (via localStorage oder API-Lookup)

**Formatierung:** Währungsbeträge immer im Format `1.000,00 €` (deutsch)

### 4.3 `ZeitplanungView.jsx` – Erweiterungen

- Rollenauswahl analog zur Zeiterfassung je Planeintrag
- Anzeige der plan-monetären Summe pro Projekt/Monat
- Visuelle Budget-Kontrolle: Plan-EUR vs. budget_eur mit grüner/roter Kennzeichnung

### 4.4 Neues Dashboard: `BudgetDashboard.jsx`

Zugänglich für admin/manager:
- **Projekt-Dropdown** zur Auswahl des betrachteten Projekts
- **Balken-/Liniendiagramm:** Plan-EUR vs. Ist-EUR je Monat (Bibliothek: Recharts oder native SVG)
- **Trendlinie:** lineare Extrapolation der Ist-Werte
- **Forecast-Anzeige:** Prognose Jahres-Gesamtbetrag vs. Budget
- **Farbliche Kennzeichnung:** grün = unter Budget, rot = über Budget
- **Budget-Anzeige:** absoluter Wert und prozentuale Auslastung

### 4.5 `ReportsView.jsx` – Erweiterungen

- PDF/Excel-Export: zusätzliche Spalten Rolle, Tagessatz, Reisekostenpauschale (wenn vorhanden)
- Anzeige Gesamt-Rechnungsbetrag in der Vorschau (nur wenn Rollendaten vorhanden)

---

## 5. Implementierungsphasen

### Phase 1 – Datenbankschema (Voraussetzung für alles)
1. SQL-Skript für neue Tabellen und Spalten erstellen und in Supabase ausführen
2. app_config: `daily_work_hours = 8` eintragen

**Liefert:** Datenbankstruktur für alle weiteren Phasen

### Phase 2 – Stammdaten Backend + Frontend (Grundlage)
1. Backend: `project_roles` CRUD in `stammdaten.py`
2. Backend: `project_role_rates` CRUD in `stammdaten.py`
3. Backend: `projects` um `budget_eur` erweitern
4. Frontend: Stammdatenverwaltung Rollen + Rollenraten + budget_eur

**Liefert:** Manager/Admin kann Rollen und Sätze anlegen und Projekten zuordnen

### Phase 3 – Zeiterfassung (Kernfunktion)
1. Backend: `time_entries` um `project_role_rate_id` erweitern
2. Backend: Join-Query und Stundensatz-Berechnung
3. Frontend: Rollenauswahl in EntryForm/TagView/WocheView mit Autofill
4. Frontend: Formatierung Währungsbeträge

**Liefert:** Berater kann Rolle je Buchung auswählen

### Phase 4 – Zeitplanung (Monetäre Planung)
1. Backend: `planning_entries` um `project_role_rate_id` erweitern
2. Backend: Budget-Validierung EUR (`/budget-validation-eur`)
3. Frontend: Rollenauswahl in Zeitplanung
4. Frontend: Plan-EUR-Summen und Budget-Ampel in ZeitplanungView

**Liefert:** Monetäre Planung mit Budget-Kontrolle (grün/rot)

### Phase 5 – Budget-Dashboard
1. Backend: neuer Router `budget_dashboard.py` mit Übersicht, Trend, Forecast
2. Frontend: `BudgetDashboard.jsx` mit Diagrammen und Projekt-Dropdown

**Liefert:** Grafisches Budget-Dashboard mit Trend und Forecast

### Phase 6 – Reporting/Export
1. Backend: PDF-Service um monetäre Felder erweitern
2. Backend: Excel-Service um monetäre Felder erweitern
3. Frontend: Reports-Ansicht anpassen

**Liefert:** Vollständige monetäre Reports

---

## 6. Klärungspunkte vor Start

| # | Frage | Entscheider |
|---|-------|-------------|
| 1 | **REQ-M13**: Umsatz je Zeiterfassungszeile für Berater sichtbar? Oder nur Manager/Admin? | Auftraggeber |
| 2 | Wie viele Arbeitsstunden pro Tag für Stundensatz-Berechnung? Standard 8h – konfigurierbar global oder je Projekt? | Auftraggeber |
| 3 | Soll der Forecast im Budget-Dashboard linear sein oder auf Basis von Vergangenheitsdaten gewichtet? | Auftraggeber |
| 4 | Sollen Reisekosten als Pauschale je Buchungstag addiert werden oder einmalig je Monat? | Auftraggeber |

---

## 7. Datenbankschema-Übersicht (nach Erweiterung)

```
users
projects         ← +budget_eur
  └── project_role_rates   (NEU: Rolle+Satz je Projekt)
        └── project_roles  (NEU: globale Stammdaten)

time_entries     ← +project_role_rate_id
planning_entries ← +project_role_rate_id
app_config       ← +daily_work_hours
```

---

## 8. Technische Hinweise

- **Währungsformatierung:** Frontend: `new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)` → `1.000,00 €`
- **Stundensatz:** Serverseitig berechnet: `hourly_rate = daily_rate_eur / daily_work_hours`; daily_work_hours aus app_config
- **Rückwärtskompatibilität:** Alle neuen Felder sind nullable → bestehende Buchungen ohne Rollenzuweisung bleiben gültig
- **Diagramm-Bibliothek:** Recharts (bereits in ähnlichen React-Projekten verwendet) oder native `<svg>` – kein zusätzliches Framework nötig
- **Berechtigungen:** Tagessätze und Umsatzwerte sind für Berater grundsätzlich read-only; Budget-Dashboard nur für admin/manager
