# Ressourcenmanagement – Anwender-Dokumentation

## Was ist das Ressourcenmanagement?

Das Ressourcenmanagement-System ermöglicht Unternehmensberatungen die strukturierte Erfassung von Arbeitszeiten und die Planung von Beratereinsätzen. Es unterstützt den vollständigen Workflow von der Zeitbuchung über die Freigabe bis zum PDF-Export für die Kundenabrechnung.

**Zugang:** https://rm.xqtfive.de

---

## Rollen und Berechtigungen

| Funktion | Berater | Manager | Admin |
|----------|---------|---------|-------|
| Eigene Zeiten erfassen | ✓ | ✓ | ✓ |
| Zeiten einreichen | ✓ | ✓ | ✓ |
| Zeiten anderer sehen | – | ✓ | ✓ |
| Zeiten freigeben/zurückweisen | – | ✓ | ✓ |
| Ressourcenplanung erstellen | – | ✓ | ✓ |
| Planungs-Dashboard | – | ✓ | ✓ |
| PDF-Export | ✓ (eigene) | ✓ | ✓ |
| Stammdaten verwalten | – | ✓ | ✓ |
| Benutzerverwaltung | – | – | ✓ |
| Systemkonfiguration | – | – | ✓ |

---

## Zeiterfassung

### Zeiten buchen

1. Tab **Zeiterfassung** öffnen
2. Ansicht wählen: **Tag**, **Woche** oder **Monat**
3. **`+ Eintrag`** klicken
4. Formular ausfüllen:
   - **Datum** wählen
   - **Projekt** aus der Liste wählen (nur zugeordnete Projekte)
   - **Stunden** eingeben (z. B. `8`)
   - **Pause (h)** eingeben (z. B. `0.5` für 30 Minuten)
   - **Kommentar** optional
   - **Abrechenbar** aktivieren wenn die Zeit dem Kunden berechnet wird
5. **Eintrag hinzufügen** → Buchung erhält Status **Entwurf**

### Status-Workflow

```
Entwurf
    ↓  Berater reicht ein
Eingereicht
    ↓  Manager/Admin gibt frei oder weist zurück
Freigegeben / Abgelehnt
```

- **Entwurf**: Bearbeitbar und löschbar durch den Ersteller
- **Eingereicht**: Wartet auf Freigabe durch Manager/Admin
- **Freigegeben**: Abgeschlossen, nicht mehr editierbar
- **Abgelehnt**: Mit Ablehnungsgrund, kann nicht erneut eingereicht werden

### Zeiten einreichen

**Tagesansicht:** Einzelnen Eintrag mit **Einreichen** einreichen, oder **Alle einreichen** für alle Einträge des Tages.

**Wochenansicht:** **Woche einreichen** reicht alle Entwürfe der Woche ein.

**Monatsansicht:** Einträge markieren (**Alle Draft wählen**) → **`{Anzahl} Einreichen`**

### Zeiten bearbeiten

Nur **Entwürfe** können bearbeitet oder gelöscht werden. Eingereichte oder freigegebene Einträge sind gesperrt. Admins können jederzeit bearbeiten.

### Buchungen kopieren (Monatsansicht)

1. Einträge in der Monatsansicht markieren
2. **Kopieren** → Zieldatum eingeben
3. Neue Buchungen werden als Entwurf angelegt

---

## Freigabe-Workflow (Manager/Admin)

In der **Tagesansicht** erscheint bei eingereichten Einträgen der Button **`✓ OK`** zur Freigabe.

Für eine Gesamtübersicht aller offenen Einreichungen aller Berater:
**Zeiterfassung** → Ansicht nach Berater filtern → eingereichte Einträge freigeben oder zurückweisen.

---

## Ressourcenplanung (Manager/Admin)

### Planungseinträge erstellen

1. Tab **Zeitplanung** öffnen
2. **`+ Planung`** klicken
3. Formular ausfüllen:
   - **Berater** wählen
   - **Projekt** wählen
   - **Tag** (optional) — leer lassen für Monatsplanung
   - **Stunden** eingeben
4. **Anlegen**

Die Tabelle zeigt die Auslastung in Stunden und Personentagen (**PT**-Spalte).

### Monat kopieren

1. **Monat kopieren** klicken
2. **Zielmonat** und **Jahr** eingeben
3. **Kopieren** — alle Planungen des aktuellen Monats werden übertragen

### Soll-Ist-Vergleich

Im **Dashboard** unter **Soll-Ist-Vergleich**:
- Pro Projekt: geplante Stunden vs. erfasste Stunden vs. Differenz und Auslastung in %

### Budget-Validierung

Im Tab **Zeitplanung** wird bei Budgetüberschreitung das Badge **`⚠ {Anzahl} Budget-Überschreitung(en)`** angezeigt.

Der Abschnitt darunter listet alle Projekte mit Differenz zwischen Planung und Budget:
- **⚠ Überschritten**: Planung > Budget
- **Im Budget**: Planung ≤ Budget

---

## Stammdaten

### Kunden

**Stammdaten → Kunden → `+ Neu`**
- Name (Pflicht), Kürzel (optional)
- Bearbeiten: Stift-Icon → **Aktualisieren**
- Löschen: Papierkorb-Icon → Bestätigung erforderlich

### Projekte

**Stammdaten → Projekte → `+ Neu`**
- Projektname, Kürzel, Kunde, Budget (Stunden)
- Das **Budget** wird für die Budget-Validierung verwendet

### Beraterzuordnung

**Stammdaten → Berater-Zuordnung**
1. Projekt in der Projektliste auswählen
2. **`+ Zuordnen`** → Berater aus Dropdown wählen → **Zuordnen**
3. Entfernen: **Entfernen**-Button

Berater sehen in der Zeiterfassung nur zugeordnete Projekte. Admins und Manager sehen alle aktiven Projekte.

---

## Reports & Export

### PDF-Export

**Reports → PDF-Leistungsnachweis exportieren**

1. Jahr und Monat wählen
2. **Projekt** auswählen
3. Optional: **Berater** auswählen (nur Admin/Manager)
4. Optional: **Nur abrechenbare Einträge** aktivieren (Kundenreport)
5. **`⬇ PDF exportieren`**

**Hinweis:** Nur Buchungen mit Status **Freigegeben** erscheinen im PDF.

### Globales Planungs-Dashboard

**Reports** → Abschnitt **Globales Planungs-Dashboard**
Zeigt alle Planungseinträge des gewählten Monats mit Berater, Projekt, Kunde und Stunden.

### Abweichungs-Report

**Reports** → Abschnitt **Abweichungs-Report**
Alle Projekte mit Differenz zwischen Planung und Budget — überschrittene Projekte sind markiert.

---

## Admin

### Benutzerverwaltung

**Admin → Benutzer → `+ Neu`**
- Benutzername (3–32 Zeichen), Anzeigename, E-Mail, Rolle, Passwort (min. 8 Zeichen)
- Rollen: **Administrator**, **Manager**, **Berater**
- Benutzer deaktivieren: Bearbeiten → **Aktiv**-Checkbox deaktivieren → **Aktualisieren**

### Konfiguration

**Admin → Konfiguration**
- Stunden pro Arbeitstag, Unternehmensname, Logo-URL, Primärfarbe, Dunkelfarbe
- **Konfiguration speichern**

---

## Häufige Fragen

**Warum sehe ich ein Projekt nicht in der Zeiterfassung?**
Als Berater werden nur Projekte angezeigt, denen Sie zugeordnet sind. Wenden Sie sich an Ihren Administrator oder Manager (Stammdaten → Berater-Zuordnung).

**Kann ich einen freigegebenen Eintrag ändern?**
Nein. Freigegebene Buchungen sind gesperrt. Bei Fehler bitte Administrator kontaktieren.

**Wann erscheinen Stunden im PDF-Export?**
Nur Buchungen mit Status **Freigegeben** werden exportiert.

**Was bedeutet PT in der Zeitplanung?**
PT = Personentage. Berechnet aus den geplanten Stunden geteilt durch die konfigurierten Stunden pro Arbeitstag (Standard: 8).
