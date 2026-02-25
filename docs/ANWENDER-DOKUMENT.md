# Ressourcenmanagement – Anwender-Dokumentation

## Was ist das Ressourcenmanagement?

Das Ressourcenmanagement-System ermöglicht Unternehmensberatungen die strukturierte Erfassung von Arbeitszeiten und die Planung von Beratereinsätzen. Es unterstützt den vollständigen Workflow von der Zeitbuchung über die Genehmigung bis zum PDF-Export für die Kundenabrechnung.

**Zugang:** https://rm.xqtfive.de

---

## Rollen und Berechtigungen

| Funktion | Consultant | Manager | Admin |
|----------|-----------|---------|-------|
| Eigene Zeiten erfassen | ✓ | ✓ | ✓ |
| Zeiten einreichen | ✓ | ✓ | ✓ |
| Zeiten anderer sehen | – | ✓ | ✓ |
| Zeiten genehmigen/ablehnen | – | ✓ | ✓ |
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
2. Datum auswählen (Tagesansicht oder Monatsübersicht)
3. **Neue Buchung** klicken
4. Projekt aus der Liste wählen (nur zugeordnete Projekte)
5. Stunden, Pausenzeit und optionalen Kommentar eingeben
6. **Abrechenbar** aktivieren wenn die Zeit dem Kunden berechnet wird
7. Speichern → Buchung erhält Status **Entwurf**

### Status-Workflow

```
Entwurf (draft)
    ↓  Berater reicht ein
Eingereicht (submitted)
    ↓  Manager/Admin genehmigt oder lehnt ab
Genehmigt (approved) / Abgelehnt (rejected)
```

- **Entwurf**: Nur sichtbar und bearbeitbar für den Ersteller
- **Eingereicht**: Wartet auf Genehmigung durch Manager/Admin
- **Genehmigt**: Abgeschlossen, nicht mehr editierbar
- **Abgelehnt**: Mit Ablehnungsgrund, kann nicht erneut eingereicht werden

### Zeiten bearbeiten

Nur **Entwürfe** können bearbeitet oder gelöscht werden. Eingereichte oder genehmigte Einträge sind gesperrt. Admins können jederzeit bearbeiten.

### Buchungen kopieren

Um wiederkehrende Buchungen zu erleichtern:
1. Bestehende Buchungen auswählen
2. **Kopieren** → Zieldatum auswählen
3. Neue Buchungen werden als Entwurf angelegt

### Monatsübersicht

Die Monatsansicht zeigt alle Buchungen des Monats mit:
- Gesamtstunden pro Projekt
- Aufteilung abrechenbar/nicht abrechenbar
- Status-Übersicht (Entwurf, Eingereicht, Genehmigt)

---

## Genehmigungsworkflow (Manager/Admin)

### Genehmigungswarteschlange

Unter **Zeiterfassung → Genehmigungen** sehen Manager und Admins alle eingereichten Buchungen aller Berater.

**Genehmigen:** Buchung markieren → **Genehmigen**
**Ablehnen:** Buchung markieren → **Ablehnen** → Ablehnungsgrund eingeben

### Berater-Filter

In der Listenansicht kann nach Berater, Projekt und Zeitraum gefiltert werden, um die Übersicht zu behalten.

---

## Ressourcenplanung (Manager/Admin)

### Planungseinträge erstellen

Unter **Zeitplanung** können Berater für Projekte eingeplant werden:
- **Monatsplanung**: Gesamtstunden für einen Monat
- **Tagesplanung**: Stunden für einen bestimmten Tag

Planungseinträge haben keinen Status-Workflow und können jederzeit geändert werden.

### Monat kopieren

Wiederkehrende Planungen können mit **Monat kopieren** vom Quellmonat in den Zielmonat übernommen werden. Optional kann ein einzelner Berater ausgewählt werden.

### Planungs-Dashboard

Das Dashboard zeigt alle Planungseinträge mit Filter nach:
- Jahr / Monat
- Kunde
- Projekt
- Berater

### Soll-Ist-Vergleich

Unter **Soll-Ist** wird die geplante Zeit der tatsächlich gebuchten Zeit gegenübergestellt:
- Pro Projekt: geplante Stunden, Ist-Stunden, Differenz
- Positive Differenz = mehr gearbeitet als geplant
- Negative Differenz = weniger gearbeitet als geplant

### Budget-Validierung

Zeigt alle Projekte, bei denen die geplanten Stunden das Projektbudget überschreiten. Sortiert nach Überschreitung (höchste zuerst).

---

## Stammdaten

### Kunden

Unter **Stammdaten → Kunden** werden alle Kunden verwaltet. Felder:
- Name (Pflicht)
- Kürzel (optional, für Berichte)
- Aktiv/Inaktiv

### Projekte

Unter **Stammdaten → Projekte**:
- Kunde, Name, Kürzel
- **Budget-Stunden**: Gesamtbudget für das Projekt (relevant für Budget-Validierung)
- Aktiv/Inaktiv

### Beraterzuordnung

Consultants sehen in der Zeiterfassung nur Projekte, denen sie zugeordnet sind. Die Zuordnung erfolgt unter **Stammdaten → Zuordnungen**:
1. Projekt auswählen
2. Berater hinzufügen
3. Zuordnung ist sofort aktiv

Admins und Manager sehen alle aktiven Projekte ohne Einschränkung.

---

## Reports & Export

### PDF-Export

Unter **Reports** kann ein Monats-Stundennachweis als PDF exportiert werden:
1. Jahr und Monat auswählen
2. Projekt auswählen
3. Optional: **Nur abrechenbare Stunden** aktivieren
4. **PDF exportieren** → Download startet

Der PDF-Export enthält:
- Firmenname und Logo (aus Systemkonfiguration)
- Projektname und Kundename
- Tabellarische Auflistung aller Buchungen des Monats
- Gesamtstunden

**Hinweis:** Nur **genehmigte** Buchungen werden im PDF angezeigt.

---

## Persönliches Konto

Das eigene Profil ist derzeit über den Admin-Bereich erreichbar. Passwort-Änderungen können nur durch einen Administrator vorgenommen werden.

---

## Häufige Fragen

**Warum sehe ich ein Projekt nicht in der Zeiterfassung?**
Als Consultant werden nur Projekte angezeigt, denen Sie zugeordnet sind. Wenden Sie sich an Ihren Administrator oder Manager.

**Kann ich eine genehmigte Buchung ändern?**
Nein. Genehmigte Buchungen sind gesperrt. Bei Fehler bitte Administrator kontaktieren.

**Was passiert bei einer Ablehnung?**
Der Ablehnungsgrund wird an der Buchung angezeigt. Die Buchung bleibt im Status "Abgelehnt" — sie kann nicht erneut eingereicht werden.

**Wann erscheinen Stunden im PDF-Export?**
Nur Buchungen mit Status "Genehmigt" werden exportiert. Stellen Sie sicher, dass die Buchungen des gewünschten Monats genehmigt sind.
