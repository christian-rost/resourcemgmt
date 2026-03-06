# Ressourcenmanagement – Anwender-Dokumentation

**Anwendung:** Zeiterfassung, Ressourcenplanung und monetäre Projektsteuerung für Unternehmensberatungen.

**URL:** https://rm.xqtfive.de

---

## Inhaltsverzeichnis

1. [Rollen und Berechtigungen](#1-rollen-und-berechtigungen)
2. [Login und Passwort](#2-login-und-passwort)
3. [Zeiterfassung — Berater](#3-zeiterfassung--berater)
4. [Zeiterfassung — Freigabe durch Manager/Admin](#4-zeiterfassung--freigabe-durch-manageradmin)
5. [Zeitplanung (Manager/Admin)](#5-zeitplanung-manageradmin)
6. [Stammdaten (Manager/Admin)](#6-stammdaten-manageradmin)
7. [Budget-Dashboard (Manager/Admin)](#7-budget-dashboard-manageradmin)
8. [Reports & Export](#8-reports--export)
9. [Admin — Benutzerverwaltung und Konfiguration](#9-admin--benutzerverwaltung-und-konfiguration)
10. [Häufige Fragen](#10-häufige-fragen)

---

## 1. Rollen und Berechtigungen

Das System kennt drei Rollen mit gestaffelten Berechtigungen:

| Funktion | Berater | Manager | Admin |
|----------|:-------:|:-------:|:-----:|
| Eigene Zeiten erfassen | ✓ | ✓ | ✓ |
| Zeiten einreichen | ✓ | ✓ | ✓ |
| Rolle/Tagessatz je Buchung auswählen | ✓ | ✓ | ✓ |
| PDF/Excel-Export (eigene) | ✓ | ✓ | ✓ |
| Zeiten anderer Berater einsehen | — | ✓ | ✓ |
| Buchungen freigeben / zurückweisen | — | ✓ | ✓ |
| Ressourcenplanung erstellen | — | ✓ | ✓ |
| Stammdaten verwalten | — | ✓ | ✓ |
| Projektrollen & Tagessätze hinterlegen | — | ✓ | ✓ |
| Budget-Dashboard | — | ✓ | ✓ |
| PDF/Excel aller Berater exportieren | — | ✓ | ✓ |
| Benutzerverwaltung | — | — | ✓ |
| Systemkonfiguration | — | — | ✓ |

> **Hinweis Manager:** Manager können keine eigenen Buchungen selbst freigeben — dies ist aus Compliance-Gründen bewusst gesperrt.

---

## 2. Login und Passwort

### Anmelden

1. https://rm.xqtfive.de aufrufen
2. Benutzername und Passwort eingeben → **Anmelden**

### Passwort ändern

Rechts oben: **Passwort** → aktuelles und neues Passwort eingeben → **Speichern**

Mindestlänge: 8 Zeichen. Bei vergessenem Passwort: Administrator kontaktieren.

---

## 3. Zeiterfassung — Berater

### 3.1 Ansichten

| Ansicht | Verwendung |
|---------|-----------|
| **Tag** | Einzeltag erfassen und bearbeiten |
| **Woche** | Wochenüberblick, schnell neue Tageseinträge hinzufügen |
| **Monat** | Gesamtmonat, Bulk-Einreichung, Buchungen kopieren |

Navigation zwischen Tagen/Wochen/Monaten: **‹** und **›** in der Toolbar.

### 3.2 Buchung erfassen

1. Ansicht **Tag** oder **Woche** öffnen
2. **`+ Eintrag`** klicken
3. Formular ausfüllen:

| Feld | Pflicht | Beschreibung |
|------|:-------:|--------------|
| Datum | ✓ | Arbeitstag |
| Projekt | ✓ | Nur zugeordnete Projekte erscheinen; Admins/Manager sehen alle aktiven Projekte |
| Arbeitsbeginn | ✓ | Startzeit im Format HH:MM |
| Arbeitsende | ✓ | Endzeit im Format HH:MM |
| Pause (h) | — | Pausendauer in Stunden, z. B. `0.5` für 30 Minuten |
| Stunden (berechnet) | — | Wird automatisch aus Start/Ende/Pause berechnet |
| Rolle / Tagessatz | — | Erscheint wenn der Manager Tagessätze für das Projekt hinterlegt hat |
| Kommentar | — | Tätigkeitsbeschreibung, erscheint im PDF-Export |
| Abrechenbar | — | Aktivieren wenn die Zeit dem Kunden in Rechnung gestellt wird |

4. **Eintrag hinzufügen** → Buchung erhält Status **Entwurf**

### 3.3 Rolle und Tagessatz auswählen

Wenn für das gewählte Projekt Rollen und Tagessätze hinterlegt sind, erscheint ein zusätzliches Dropdown **Rolle / Tagessatz**:

- Das Dropdown zeigt alle verfügbaren Rollen mit dem jeweiligen Tagessatz (z. B. `Senior Consultant – 1.200,00 €/Tag`)
- Nach der Auswahl werden **Stundensatz** und **Reisekostenpauschale** automatisch eingeblendet — diese Felder sind schreibgeschützt
- **Autofill:** Die zuletzt verwendete Rolle für ein Projekt wird beim nächsten Eintrag automatisch vorausgewählt. Einmal auswählen reicht für alle Folgebuchungen im selben Projekt

> Die Werte für Tagessatz und Reisekosten können vom Berater nicht verändert werden — diese werden ausschließlich vom Manager oder Administrator gepflegt.

### 3.4 Status-Workflow

```
Entwurf  →  Eingereicht  →  Freigegeben
                       ↘  Abgelehnt
```

| Status | Editierbar | Beschreibung |
|--------|:----------:|--------------|
| **Entwurf** | ✓ | Noch nicht eingereicht, kann bearbeitet und gelöscht werden |
| **Eingereicht** | — | Wartet auf Freigabe durch Manager oder Admin |
| **Freigegeben** | — | Abgeschlossen; erscheint im PDF/Excel-Export |
| **Abgelehnt** | — | Zurückgewiesen mit Ablehnungsgrund; nicht mehr editierbar |

> Nur Buchungen mit Status **Freigegeben** erscheinen im PDF- und Excel-Export.

### 3.5 Buchungen einreichen

**Tagesansicht:**
- Einzelner Eintrag: **Einreichen** am jeweiligen Eintrag
- Alle Entwürfe des Tages: **Alle einreichen** im Karten-Header

**Wochenansicht:**
- **Woche einreichen** reicht alle Entwürfe der aktuellen Woche ein

**Monatsansicht:**
- Checkbox neben den Einträgen setzen (oder **Alle Draft wählen**)
- **`{Anzahl} Einreichen`**

### 3.6 Buchungen bearbeiten und löschen

Nur Einträge mit Status **Entwurf** können bearbeitet (✎) oder gelöscht (✕) werden.

Um einen bereits eingereichten Eintrag zu korrigieren: Administrator kontaktieren.

### 3.7 Buchungen kopieren (Monatsansicht)

1. Monatsansicht öffnen
2. Einträge per Checkbox markieren
3. **Kopieren** → Zieldatum eingeben → **Kopieren**

Die kopierten Einträge werden als neue **Entwürfe** angelegt (inkl. Rolle/Tagessatz-Zuweisung).

### 3.8 Dashboard (eigene Übersicht)

Im Tab **Dashboard** sieht jeder Berater:
- Buchungsstatus des aktuellen Monats (Gesamt-/Abrechnungsstunden, Status-Verteilung)
- **Soll-Ist-Vergleich**: geplante Stunden vs. tatsächlich gebuchte Stunden je Projekt

---

## 4. Zeiterfassung — Freigabe durch Manager/Admin

### 4.1 Ausstehende Genehmigungen

Im unteren Bereich der **Zeiterfassung** erscheint bei Managern/Admins automatisch die Box **Ausstehende Genehmigungen** mit allen eingereichten Buchungen aller Berater.

> **Hinweis:** Manager sehen nur Buchungen anderer Berater — nicht ihre eigenen.

### 4.2 Freigabe oder Ablehnung

| Aktion | Vorgehen |
|--------|----------|
| Freigeben | **`✓ OK`** klicken |
| Ablehnen | **`✕ Ablehnen`** → optionalen Ablehnungsgrund eingeben → **Ablehnen** |

Der Berater sieht den Ablehnungsgrund in seiner Monatsansicht.

### 4.3 Buchungen einzelner Berater einsehen

Im Tab **Zeiterfassung** kann über den Filter **Berater** ein bestimmter Mitarbeiter ausgewählt werden, um seine Buchungen zu prüfen und freizugeben.

---

## 5. Zeitplanung (Manager/Admin)

### 5.1 Planungseintrag anlegen

1. Tab **Zeitplanung** öffnen
2. **`+ Planung`** klicken
3. Formular ausfüllen:

| Feld | Pflicht | Beschreibung |
|------|:-------:|--------------|
| Berater | ✓ | Zuzuordnender Mitarbeiter |
| Projekt | ✓ | Projekt aus Stammdaten |
| Jahr / Monat | ✓ | Planungszeitraum |
| Tag | — | Leer lassen für Monatsplanung; Tag angeben für Tagesplanung |
| Stunden | ✓ | Geplante Stunden |
| Rolle / Tagessatz | — | Wenn hinterlegt: Rolle auswählen für monetäre Hochrechnung |

4. **Anlegen**

### 5.2 Planungseinträge bearbeiten und löschen

- Bearbeiten: ✎-Icon → Stunden oder Tag anpassen → **Aktualisieren**
- Löschen: ✕-Icon

### 5.3 Monat kopieren

1. **Monat kopieren** klicken
2. Zielmonat und -jahr eingeben
3. Optional: einzelnen Berater auswählen (leer = alle)
4. **Kopieren**

Alle Planungseinträge des gewählten Monats werden in den Zielmonat übertragen.

### 5.4 Stunden-Budget-Validierung

Die Tabelle zeigt automatisch für jedes Projekt:
- **Geplante Stunden** vs. **Budget (Stunden)**
- Farbige Ampel: grün = im Budget, rot = überschritten
- Überschreitungen werden als Badge **`⚠ {Anzahl} Überschreitung(en)`** hervorgehoben

### 5.5 Soll-Ist-Vergleich

Zeigt pro Berater und Projekt die geplanten Stunden der aktiven Periode im Verhältnis zu den tatsächlich erfassten Stunden.

---

## 6. Stammdaten (Manager/Admin)

### 6.1 Kunden

**Stammdaten → Kunden**

| Aktion | Schritte |
|--------|----------|
| Anlegen | **`+ Neu`** → Name (Pflicht), Kürzel (optional) → **Anlegen** |
| Bearbeiten | ✎ → Felder ändern → **Aktualisieren** |
| Löschen | ✕ → Bestätigung erforderlich |

### 6.2 Projekte

**Stammdaten → Projekte**

| Feld | Beschreibung |
|------|--------------|
| Projektname | Vollständiger Name |
| Kürzel | Kurzbezeichnung (erscheint im Report-Header) |
| Kunde | Zuordnung zum Kunden |
| Budget (Stunden) | Zeitkontingent für die Stunden-Budget-Validierung |
| Budget (EUR) | Monetäres Budget für das Budget-Dashboard |

> **Empfehlung:** Beide Budget-Felder befüllen, um sowohl Stunden- als auch Kosten-Überwachung zu nutzen.

### 6.3 Berater-Zuordnung

**Stammdaten → Berater-Zuordnung**

1. Projekt in der linken Liste auswählen
2. **`+ Zuordnen`** → Benutzer aus Dropdown wählen → **Zuordnen**
3. Entfernen: **Entfernen**-Button

Berater sehen in der Zeiterfassung ausschließlich Projekte, denen sie zugeordnet sind. Manager und Admins sehen immer alle aktiven Projekte.

### 6.4 Projektrollen (globale Stammdaten)

**Stammdaten → Projektrollen**

Hier werden rollenübergreifende Bezeichnungen angelegt, die für alle Projekte verwendet werden können (z. B. `Junior Consultant`, `Senior Consultant`, `Manager`, `Partner`).

| Aktion | Schritte |
|--------|----------|
| Anlegen | **`+ Neu`** → Rollenbezeichnung (Pflicht), Beschreibung (optional) → **Anlegen** |
| Bearbeiten | ✎ → Felder ändern → **Aktualisieren** |
| Deaktivieren | ✎ → **Aktiv**-Checkbox deaktivieren → **Aktualisieren** |
| Löschen | ✕ → Bestätigung (nur Rollen ohne Projektzuordnungen) |

### 6.5 Rollen & Tagessätze je Projekt

**Stammdaten → Rollen & Tagessätze**

Hier werden Tagessätze und Reisekostenpauschalen projektspezifisch hinterlegt. Ein Projekt kann mehrere Einträge der gleichen Rolle mit unterschiedlichen Tagessätzen enthalten.

**Eintrag hinzufügen:**

1. Projekt in der linken Liste auswählen
2. **`+ Hinzufügen`**
3. Rollentyp wählen:
   - **Globale Rolle**: Rolle aus Dropdown wählen (aus Projektrollen-Stammdaten)
   - **Projektspezifisch**: Individuelle Bezeichnung eingeben (nur für dieses Projekt gültig)
4. **Tagessatz (EUR)** eingeben (z. B. `1200` für 1.200,00 €/Tag)
5. **Reisekostenpauschale (EUR)** eingeben (optional, z. B. `200`)
6. **Hinzufügen**

Der **Stundensatz** wird automatisch berechnet: Tagessatz ÷ 8 Arbeitsstunden/Tag.

**Anzeige in der Tabelle:**

| Spalte | Inhalt |
|--------|--------|
| Rolle | Name der globalen Rolle oder individuelle Bezeichnung |
| Tagessatz | Brutto-Tagessatz in EUR |
| Stundensatz | Berechnet: Tagessatz ÷ 8 |
| Reisekostenpauschale | Pauschalbetrag pro Eintrag |

> **Hinweis:** Tagessätze und Reisekostenpauschalen sind für Berater in der Zeiterfassung **schreibgeschützt** — sie können nur ausgewählt, nicht verändert werden.

---

## 7. Budget-Dashboard (Manager/Admin)

Tab **Budget** — nur für Manager und Administratoren sichtbar.

### 7.1 Projekt und Jahr auswählen

- **Jahresnavigation:** ‹ / › in der Toolbar
- **Projekt-Dropdown:** Zeigt alle Projekte mit hinterlegtem EUR-Budget

> Ist das gewünschte Projekt nicht in der Liste? In den Stammdaten → Projekte → **Budget (EUR)** eintragen.

### 7.2 KPI-Karten

| Karte | Inhalt |
|-------|--------|
| **Projekt-Budget** | Gesamtes EUR-Budget des Projekts |
| **Plan gesamt** | Summierter Jahresplan (Stunden × Stundensatz + Reisekosten) |
| **Ist (genehmigt)** | Summe aller freigegebenen Buchungen mit Prozentwert |
| **Forecast Jahresende** | Lineare Hochrechnung auf Basis der bisherigen Ist-Werte |

Die Forecast-Karte zeigt in **grün**, wenn das Budget voraussichtlich eingehalten wird, und in **rot**, wenn eine Überschreitung erwartet wird.

### 7.3 Liniendiagramm

Das Diagramm zeigt den kumulierten Verlauf über alle 12 Monate:

| Linie | Bedeutung |
|-------|-----------|
| Dunkle Linie (halbtransparent) | Kumulierter Plan-EUR |
| Orange Linie | Kumulierter Ist-EUR (nur freigegebene Buchungen) |
| Rote gestrichelte Linie | Budget-Grenze |
| Farbiger Punkt (grün/rot) | Forecast-Punkt am Jahresende |

### 7.4 Monatliche Aufstellung

Tabelle mit Plan- und Ist-Werten je Monat sowie kumulierten Werten und Abweichung zum Budget.

### 7.5 Budget-Kontrolle alle Projekte

Im unteren Bereich: Übersicht **aller** Projekte mit EUR-Budget für das gewählte Jahr:

- Geplanter Betrag vs. Budget
- Abweichung absolut und in Prozent
- Farbige Statusampel: **grün** = im Budget, **rot** = über Budget

### 7.6 Berechnung der monetären Werte

| Größe | Formel |
|-------|--------|
| Stundensatz | Tagessatz ÷ konfigurierte Arbeitsstunden/Tag (Standard: 8) |
| Monatlicher Plan-EUR | Σ (geplante Stunden × Stundensatz) + Σ Reisekostenpauschalen |
| Monatlicher Ist-EUR | Σ (gebuchte Stunden × Stundensatz) + Σ Reisekostenpauschalen (nur Status: Freigegeben) |
| Forecast | Durchschnittlicher monatlicher Ist-EUR × 12 |

> Buchungen ohne Rollenzuweisung fließen mit **0 EUR** in die monetäre Berechnung ein, zählen aber weiterhin in der Stunden-Auswertung.

---

## 8. Reports & Export

### 8.1 PDF-Leistungsnachweis

**Reports → PDF-Leistungsnachweis exportieren**

1. Jahr und Monat wählen
2. Projekt auswählen
3. Optional: Berater auswählen (nur Manager/Admin)
4. Optional: **Nur abrechenbare Einträge** aktivieren (filtert auf `is_billable = true`)
5. **`⬇ PDF exportieren`**

**Inhalt des PDFs:**
- Firmenlogo und Unternehmensname (aus Konfiguration)
- Kunde, Projekt, Berater, Monat
- Tabelle mit Datum, Wochentag, Stunden, Pause, Kommentar
- Wenn Rolle hinterlegt: zusätzliche Spalten **Rolle** und **Tagessatz**
- Footer: Gesamtstunden, Personentage; wenn Tagessätze vorhanden: **Leistungsbetrag**, **Reisekostenpauschale**, **Gesamtbetrag**
- Unterschriftenfelder

> Nur Buchungen mit Status **Freigegeben** erscheinen im PDF.

### 8.2 Excel-Leistungsnachweis

**Reports → Excel-Leistungsnachweis exportieren**

Gleicher Ablauf wie PDF. Der Excel-Export basiert auf der XQT5-Vorlage und enthält dieselben Zeiterfassungsdaten.

### 8.3 Sammel-Export (alle Berater)

**Reports → PDF/Excel für alle Berater exportieren**

Erstellt einen ZIP-Archiv mit je einem PDF/Excel pro Berater, der freigegebene Einträge im gewählten Monat und Projekt hat.

### 8.4 Berichts-Filter

| Filter | Beschreibung |
|--------|--------------|
| Nur abrechenbare Einträge | Schließt intern gebuchte Stunden aus dem Export aus |
| Berater | Manager/Admin können einen spezifischen Berater auswählen |

---

## 9. Admin — Benutzerverwaltung und Konfiguration

### 9.1 Benutzer verwalten

**Admin → Benutzer**

| Aktion | Schritte |
|--------|----------|
| Anlegen | **`+ Neu`** → Benutzername, Anzeigename, E-Mail, Rolle, Passwort → **Anlegen** |
| Bearbeiten | ✎ → Felder ändern → **Aktualisieren** |
| Deaktivieren | ✎ → **Aktiv**-Checkbox deaktivieren → **Aktualisieren** |
| Passwort zurücksetzen | ✎ → Neues Passwort eingeben → **Aktualisieren** |

**Rollen:**
- **Berater** — Zeiterfassung, eigene Reports
- **Manager** — Zeiterfassung + Freigabe, Planung, Stammdaten, Budget-Dashboard
- **Administrator** — alle Funktionen + Benutzerverwaltung + Konfiguration

**Passwortregeln:** Mindestens 8 Zeichen.

### 9.2 Systemkonfiguration

**Admin → Konfiguration**

| Einstellung | Beschreibung |
|-------------|--------------|
| Unternehmensname | Erscheint im PDF-Header |
| Logo-URL | URL zu einem Firmenlogo (PNG/SVG) |
| Primärfarbe | Corporate-Design-Farbe (Hex, z. B. `#ee7f00`) |
| Dunkelfarbe | Sekundärfarbe für Header und Tabellen (Hex, z. B. `#213452`) |
| Stunden pro Arbeitstag | Basis für Personentage-Berechnung und Stundensatz-Berechnung (Standard: 8) |

**Speichern** zum Übernehmen.

> **Wichtig:** Der Wert **Stunden pro Arbeitstag** beeinflusst die Stundensatz-Berechnung (`Tagessatz ÷ Stunden/Tag`). Änderungen wirken sich auf alle künftigen Darstellungen aus.

---

## 10. Häufige Fragen

**Warum sehe ich ein Projekt nicht in der Zeiterfassung?**
Als Berater werden nur Projekte angezeigt, denen Sie zugeordnet sind. Bitte Manager oder Admin kontaktieren → Stammdaten → Berater-Zuordnung.

**Warum erscheint kein Rollen-Dropdown in der Zeiterfassung?**
Für dieses Projekt wurden noch keine Tagessätze hinterlegt. Manager/Admin: Stammdaten → Rollen & Tagessätze → Projekt auswählen → Eintrag hinzufügen.

**Kann ich eine freigegebene Buchung nachträglich ändern?**
Nein. Freigegebene Buchungen sind gesperrt. Bei Fehlern bitte den Administrator kontaktieren.

**Wann erscheinen Buchungen im PDF-Export?**
Nur Buchungen mit Status **Freigegeben** werden exportiert.

**Warum ist das Projekt nicht im Budget-Dashboard sichtbar?**
Es muss ein EUR-Budget hinterlegt sein: Stammdaten → Projekte → Projekt bearbeiten → Budget (EUR) eintragen.

**Was bedeutet PT?**
PT = Personentage. Berechnet aus geplanten oder gebuchten Stunden geteilt durch die konfigurierten Arbeitsstunden/Tag (Standard: 8). Beispiel: 40 h ÷ 8 h/Tag = 5 PT.

**Kann ich eine Rolle mehrfach mit unterschiedlichen Tagessätzen hinterlegen?**
Ja. In Stammdaten → Rollen & Tagessätze kann dieselbe Rolle mehrfach mit verschiedenen Tagessätzen eingetragen werden (z. B. für verschiedene Vertragskonditionen desselben Projekts).

**Wie wird der Forecast berechnet?**
Aus dem Durchschnitt der monatlichen Ist-Werte der Monate, in denen bereits Buchungen vorliegen, multipliziert mit 12. Sind noch keine Ist-Buchungen vorhanden, entspricht der Forecast dem Jahresplan.

**Was ist der Unterschied zwischen „abrechenbar" und „nicht abrechenbar"?**
- **Abrechenbar**: Zeit wird dem Kunden in Rechnung gestellt; erscheint im Kundenreport (billable-only Export)
- **Nicht abrechenbar**: Intern gebuchte Zeit (z. B. interne Meetings, Reisezeiten); nur im internen Report sichtbar
