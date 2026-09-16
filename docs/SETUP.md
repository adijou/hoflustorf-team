# Einrichtung und Betrieb

## Vor einem Pilotbetrieb

1. Eigenes Netlify-Projekt mit `adijou/hoflustorf-team` verbinden. Build `npm run build`, Publish `dist`, Node 24. Noch keine Verbindung zur öffentlichen Event-Website ändern.
2. `VITE_DEMO=false` für das reguläre Projekt sicherstellen. Demo-Vorschauen ausschliesslich mit fiktiven Daten betreiben.
3. Netlify Identity aktivieren, Registrierung auf **Invite only** setzen. Der Client bietet keine Selbstregistrierung. Die API lehnt auch bestätigte Konten ohne passende Rolle ab.
4. Autorisierte Konten in Netlify Identity anlegen/einladen. Rollen in `app_metadata.roles`: Hofleitung `manager`, Mitarbeitende `staff`. `user_metadata` und Clientangaben können diese Rollen nicht setzen. Einladungen sind ein separater, ausdrücklich auszulösender Kommunikationsschritt.
5. Netlify Database wird über `@netlify/database` eingebunden; Migrationen liegen in `netlify/database/migrations`. Erfolgreiche Migration und API-Zugriff im Deploy prüfen.
6. Neue Mitarbeitende bekommen beim ersten autorisierten Zugriff 2'100 Wochenminuten. Die Hofleitung hat standardmässig kein eigenes Wochenpensum. Das Rollenmodell enthält keine öffentliche Benutzerverwaltung.
7. Erst nach der Prüfung von Rollen, Datenbank, Einladungsannahme, Passwortreset, Rapportfreigabe und Export für echte Rapporte freigeben.

## Sicherheitsmodell

- Alle Datenzugriffe laufen über `/api/workspace`, geschützt durch den serverseitigen `getUser()`-Aufruf des Netlify-Identity-SDK.
- Identitäten ohne Rolle `staff` oder `manager` erhalten 403. Nicht angemeldete Zugriffe erhalten 401.
- Mitarbeitende erhalten nur eigene Einzelrapporte und Monatsstatus. Das Team sieht die gemeinsamen Aufgaben und aggregierte Aufgabenzeiten.
- Nur die Hofleitung darf Aufgaben freigeben, Serien stoppen und fremde Monatsrapporte freigeben/öffnen. Selbstfreigabe von Monatsrapporten ist ausgeschlossen.
- Mutationen prüfen den Request-Origin. Die API ist nicht für fremde Origins freigegeben.
- Antworten enthalten `Cache-Control: private, no-store` und `Netlify-CDN-Cache-Control: no-store`. Kein Service Worker cached Personaldaten.
- Der Browser speichert ausschliesslich die Spracheinstellung sowie die vom Identity-SDK verwaltete Sitzung. Arbeitsdaten werden nicht in localStorage geschrieben.
- Auf dem Server wird pro Befehl die aktuelle Workspace-Zeile unter `FOR UPDATE` geladen. Prüfung, Änderung und Audit werden atomar committed. Versionsnummern schützen Korrekturen vor veralteten Formularen.
- Serverseitige Validierung erlaubt nur definierte Aktionen und Felder. Ein UI-Schalter ist keine Berechtigungsprüfung.
- Stornierungen sind logisch; Originaleinträge bleiben erhalten. Audit-Einträge enthalten Akteur, Aktion, Eingaben, generierte Datensatz-ID, Workspace-Version und Zeitstempel.
- Rolle entziehen/Account sperren erfolgt in Identity. Bestehende Audit- und Rapportdaten bleiben erhalten. Bei Entzug zusätzlich aktive Sitzungen gemäss Identity-Verfahren widerrufen; die Token-Lebensdauer berücksichtigen.

## Datenhaltung

Für zwei Mitarbeitende ist eine atomar versionierte Workspace-Zeile gewählt. API-Abfragen liefern vorerst alle für die Rolle sichtbaren Daten. Das ist keine Architektur für viele hundert Mitarbeitende. Bei Wachstum: normalisierte Tabellen, Zeitbereichsfilter, Pagination und Audit-Ansicht ergänzen.

Vor dem Echtbetrieb vertraglich/organisatorisch festlegen: Datenverantwortung, Region und Auftragsbearbeitung, Aufbewahrung, Sicherung, Wiederherstellung und Austrittsprozess. Ein CSV ist ein Rapportexport, kein vollständiges Backup. Datenbankbackups und Wiederherstellung müssen im konkreten Netlify-Projekt geprüft werden.

Netlify-Datenbank-Previews können mit einer Kopie der Produktionsdaten beginnen. Deshalb die selben Zugriffsregeln beibehalten und öffentliche Vorschauen nie mit dem produktiven Datenzugriff vermischen. Öffentlich zugängliche Demo-Clients dürfen ausschliesslich den flüchtigen Demo-Modus verwenden.

## Technische Prüfung

```sh
npm ci
npm test
npm run build
```

Die automatisierten Domain-Prüfungen decken gemeinsame Personenstunden, Budgetüberschreitungen, Überschneidungen, fremde Datenänderungen, Monatsabschluss, Korrekturen, Aufgabenfreigaben, Wiederholungen, Datumsgrenzen und CSV-Formelschutz ab.

Die authentifizierten Netlify-Integrationsabläufe sind lokal nicht vollständig prüfbar. Ein erfolgreicher Build und die Demo-Prüfung sind keine Behauptung eines bereits verifizierten produktiven Identity-/Datenbankbetriebs.
