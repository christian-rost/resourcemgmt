# Ressourcenmanagement – Feature-Dokumentation

## Produktziel

Webbasiertes System zur Zeiterfassung und Ressourcenplanung für Unternehmensberatungen. Kernfunktionen: strukturierter Genehmigungsworkflow für Zeitbuchungen, Ressourcenplanung mit Budget-Überwachung, PDF-Export für Kundenabrechnung.

---

## Implementierte Features (MVP)

### REQ-01 – Benutzerrollen
Drei Rollen mit abgestuften Berechtigungen:
- **admin**: Vollzugriff, Benutzerverwaltung, Konfiguration
- **manager**: Zeitplanung, Genehmigungen, Beraterübersicht
- **consultant**: Eigene Zeiterfassung, zugeordnete Projekte

### REQ-02 – Authentifizierung
- Login mit Benutzername + Passwort
- JWT-Token (24h Gültigkeit), gespeichert in LocalStorage
- Rate-Limit: 5 Login-Versuche pro Minute
- Passwort-Hashing mit bcrypt
- Admin-Bootstrap beim ersten Start via Umgebungsvariablen

### REQ-03 – Stammdaten: Kunden
- CRUD für Kunden (Name, Kürzel, Aktiv-Status)
- Admins und Manager haben Schreibzugriff
- Consultants haben Lesezugriff

### REQ-04 – Stammdaten: Projekte
- CRUD für Projekte (Kunde, Name, Kürzel, Budget-Stunden, Aktiv-Status)
- Verknüpfung mit Kunden (FK mit CASCADE)

### REQ-05 – Berater-Projekt-Zuordnung
- Zuordnung von Consultants zu Projekten
- Consultants sehen in der Zeiterfassung nur zugeordnete Projekte
- Admins/Manager sehen alle aktiven Projekte

### REQ-06 – Zeiterfassung: Buchung erstellen
- Felder: Datum, Projekt, Stunden, Pausenzeit, Kommentar, Abrechenbar
- Validierung: Stunden > 0, Pause ≥ 0
- Neue Buchungen starten im Status `draft`

### REQ-07 – Zeiterfassung: Monatsübersicht
- Listenansicht aller Buchungen eines Monats
- Filter nach Tag, Projekt
- Aggregation nach Projekt (Gesamtstunden, abrechenbare Stunden, Status-Counts)

### REQ-08 – Zeiterfassung: Buchungen kopieren
- Auswahl bestehender Buchungen + Zieldatum
- Neue Buchungen werden als Entwurf angelegt

### REQ-09 – Status-Workflow
Übergänge:
- `draft → submitted`: Berater reicht ein
- `submitted → approved`: Manager/Admin genehmigt
- `submitted → rejected`: Manager/Admin lehnt ab (mit Grund)
- `approved/rejected → draft`: Nur Admin (Rücksetzen)

### REQ-10 – Genehmigungswarteschlange
- Manager/Admin sehen alle eingereichten Buchungen aller Berater
- Sortiert nach Datum
- Enthält Projektname und Kundename

### REQ-11 – Soll-Ist-Vergleich
- Gegenüberstellung geplanter vs. tatsächlicher Stunden pro Projekt
- Für eigenen Benutzer (Consultant) oder beliebigen Berater (Manager/Admin)
- Delta = Ist - Soll

### REQ-12 – Ressourcenplanung: Einträge
- Planungseinträge pro Berater, Projekt, Monat (optional: Tag)
- `plan_day = NULL` → Monatsplanung
- Validierung: Stunden > 0, Monat 1–12, Tag 1–31

### REQ-13 – Planungs-Dashboard
- Alle Planungseinträge eines Jahres/Monats
- Filter: Kunde, Projekt, Berater
- Manager/Admin-Zugriff

### REQ-14 – Monat kopieren
- Alle Planungseinträge eines Monats in anderen Monat kopieren
- Optional: nur für einen bestimmten Berater

### REQ-15 – Budget-Validierung
- Vergleich geplanter Gesamtstunden vs. Projektbudget
- Zeigt alle Projekte mit Differenz
- Sortiert nach Überschreitung (absteigend)
- `over_budget: true` wenn Planung > Budget

### REQ-16 – PDF-Export Stundennachweis
- Monatsnachweis pro Projekt und Berater
- Format: Tabelle mit Datum, Stunden, Pause, Kommentar
- Enthält Firmenname (aus app_config)
- Dateiname: `Zeiterfassung_<Projekt>_<Jahr>-<Monat>.pdf`

### REQ-17 – PDF: Nur abrechenbare Stunden
- Filter `billable_only=true` reduziert Export auf abrechenbare Einträge
- Relevant für externe Kundenberichte

### REQ-18 – Benutzerverwaltung (Admin)
- CRUD für Benutzer
- Felder: Username (3–32 Zeichen), E-Mail, Passwort (min. 8 Zeichen), Rolle, Anzeigename
- Aktivieren/Deaktivieren ohne Löschen
- Admin kann sich nicht selbst löschen

### REQ-19 – Systemkonfiguration (Admin)
Konfigurierbare Parameter:
- `hours_per_day`: Arbeitsstunden pro Tag (Standard: 8)
- `company_name`: Firmenname
- `logo_url`: Logo-URL für PDF
- `primary_color`: Primärfarbe (#ee7f00)
- `dark_color`: Dunkelfarbe (#213452)

---

## Geplante Features (Backlog)

### E-Mail-Benachrichtigungen
- Notification an Manager wenn Buchungen eingereicht werden
- Notification an Berater bei Genehmigung/Ablehnung
- Tägliche/wöchentliche Zusammenfassung
- Status: **Zurückgestellt für spätere Phase**

### CSV-Export
- Tabellarischer Export der Zeitbuchungen
- Filter wie beim PDF-Export
- Für Weiterverarbeitung in Excel/ERP

### Feiertags-Kalender
- Hinterlegung von Feiertagen pro Bundesland
- Automatische Warnung bei Buchung an Feiertagen
- Anzeige in der Kalenderübersicht

### Überstunden-Konto
- Automatische Berechnung von Mehr-/Minderstunden
- Vergleich gegen `hours_per_day` Konfiguration
- Übertrag zwischen Monaten

### Projektberichte
- Gesamtauswertung pro Projekt über mehrere Monate
- Vergleich Budget vs. geplant vs. abgerechnet
- Trenddarstellung

### Berater-Kapazitätsplanung
- Kapazitätsansicht pro Berater über mehrere Monate
- Freie vs. belegte Tage
- Überbuchungswarnung

### Multi-Instanz-Fähigkeit
- Mandantenfähigkeit für mehrere Unternehmenseinheiten
- Getrennte Datenbereiche je Mandant

---

## Technische Rahmenbedingungen

- Kein UI-Framework (Vanilla CSS, XQT5 Corporate Design)
- Keine E-Mail-Bibliothek im MVP
- Supabase als einziger Datenspeicher (keine Dateisystem-Abhängigkeiten)
- Deployment ausschließlich über Coolify + Nixpacks
- PDF-Generierung serverseitig mit ReportLab
