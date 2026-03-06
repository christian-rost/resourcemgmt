# Ressourcenmanagement – Quickstart

**URL:** https://rm.xqtfive.de

---

## Login

1. https://rm.xqtfive.de aufrufen
2. **Benutzername** und **Passwort** eingeben → **Anmelden**

---

## Quickstart nach Rolle

### Berater — erste Zeitbuchung in 3 Schritten

**Schritt 1: Eintrag erfassen**

1. Tab **Zeiterfassung** öffnen
2. **`+ Eintrag`** klicken
3. Formular ausfüllen:
   | Feld | Beschreibung |
   |------|--------------|
   | Datum | Arbeitstag |
   | Projekt | Nur zugeordnete Projekte erscheinen |
   | Arbeitsbeginn / Arbeitsende | Uhrzeit eingeben — Stunden werden automatisch berechnet |
   | Pause (h) | z. B. `0.5` für 30 Minuten |
   | Rolle / Tagessatz | Auswählen wenn vom Manager hinterlegt (optional) |
   | Kommentar | Tätigkeitsbeschreibung (optional) |
   | Abrechenbar | Aktivieren wenn Zeit beim Kunden abgerechnet wird |
4. **Eintrag hinzufügen** → Status: **Entwurf**

**Schritt 2: Eintrag einreichen**

- Einzelner Eintrag: **Einreichen**-Button am Eintrag
- Alle Einträge des Tages: **Alle einreichen** (Header der Tagesansicht)

Status wechselt auf **Eingereicht**.

**Schritt 3: Freigabe abwarten**

| Status | Bedeutung |
|--------|-----------|
| Entwurf | Editierbar, noch nicht eingereicht |
| Eingereicht | Wartet auf Freigabe durch Manager/Admin |
| Freigegeben | Abgeschlossen, erscheint im PDF-Export |
| Abgelehnt | Mit Ablehnungsgrund, nicht mehr editierbar |

---

### Manager — Einrichtung Projekt mit Tagessätzen

**Schritt 1: Globale Rollen anlegen** (einmalig)

1. **Stammdaten** → Tab **Projektrollen** → **`+ Neu`**
2. Rollenbezeichnung eingeben (z. B. `Senior Consultant`, `Manager`) → **Anlegen**

**Schritt 2: Tagessätze je Projekt hinterlegen**

1. **Stammdaten** → Tab **Rollen & Tagessätze** → Projekt in der Liste wählen
2. **`+ Hinzufügen`** → Rolle aus Dropdown wählen → Tagessatz und ggf. Reisekostenpauschale eingeben → **Hinzufügen**

Der **Stundensatz** (Tagessatz ÷ 8 Std.) wird automatisch berechnet und angezeigt.

**Schritt 3: Budget hinterlegen**

1. **Stammdaten** → Tab **Projekte** → Projekt bearbeiten (✎)
2. Feld **Budget (EUR)** ausfüllen → **Aktualisieren**

**Schritt 4: Berater freigeben**

Eingereichte Buchungen erscheinen unter **Zeiterfassung → Ausstehende Genehmigungen**:
- **`✓ OK`** → freigeben
- **`✕ Ablehnen`** → mit optionalem Ablehnungsgrund zurückweisen

**Schritt 5: Budget überwachen**

Tab **Budget** → Projekt auswählen → Plan vs. Ist + Forecast auf einen Blick.

---

### Admin — Ersteinrichtung

1. **Admin → Benutzer → `+ Neu`**: Benutzerkonten für alle Mitarbeiter anlegen (Rollen: Berater / Manager / Administrator)
2. **Admin → Konfiguration**: Unternehmensname, Logo, Farben, Stunden/Tag einstellen → **Speichern**
3. **Stammdaten → Kunden → `+ Neu`**: Kunden anlegen
4. **Stammdaten → Projekte → `+ Neu`**: Projekte anlegen, Kunden zuordnen, Stunden- und EUR-Budget hinterlegen
5. **Stammdaten → Berater-Zuordnung**: Projekte den Beratern zuordnen
6. **Stammdaten → Projektrollen**: Globale Rollenbezeichnungen anlegen
7. **Stammdaten → Rollen & Tagessätze**: Tagessätze je Projekt hinterlegen

---

## Tipp: Autofill bei wiederkehrenden Buchungen

Die zuletzt verwendete Rolle wird pro Projekt automatisch vorausgefüllt. Einmal auswählen — bei allen folgenden Buchungen für dasselbe Projekt ist die Rolle bereits eingetragen.

---

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| Kein Projekt in der Auswahl | Manager/Admin: Stammdaten → Berater-Zuordnung |
| Keine Rollenauswahl beim Erfassen | Manager/Admin: Stammdaten → Rollen & Tagessätze |
| Buchung nicht editierbar | Nur Entwürfe sind editierbar |
| PDF enthält keine Einträge | Einträge brauchen Status **Freigegeben** |
| Passwort vergessen | Admin → Benutzer → Bearbeiten |
