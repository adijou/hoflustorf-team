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
- Die Hofleitung sieht in Teamliste und Profilbearbeitung die aktuelle Anmelde-E-Mail. Die Function ergänzt sie über `admin.getUser(member.id)` ausschliesslich in autorisierten Manager-Antworten. Bestehende Profile werden damit ohne erneute Anmeldung zuordenbar; Namen und Pensen bleiben erhalten.
- E-Mail-Adressen werden nicht zusätzlich in Workspace oder Audit gespeichert. Mitarbeiter-Antworten enthalten keine E-Mail-Felder. Fehlende Identity-Konten oder Abfragefehler zeigen «Derzeit nicht verfügbar» und verhindern keine Namensänderungen. Anmeldeadressen bleiben ausschliesslich in Identity änderbar.
- Nur die Hofleitung darf aktive Aufgaben ändern, Aufgaben freigeben, Teamprofile verwalten und fremde Monatsrapporte freigeben/öffnen/löschen. Mitarbeitende dürfen eigene offene Vorschläge bearbeiten/löschen. Selbstfreigabe von Monatsrapporten ist ausgeschlossen.
- Änderungen und Stornierungen fremder Zeiten erfordern eine Begründung durch die Hofleitung. Geschlossene Monate sind auch für sie gesperrt, bis der Monat ausdrücklich geöffnet wurde.
- Ein in der App gelöschtes Teamprofil wird vor jeder Datenoperation abgewiesen und beim nächsten Login nicht automatisch neu angelegt.
- Mutationen prüfen den Request-Origin. Die API ist nicht für fremde Origins freigegeben.
- Antworten enthalten `Cache-Control: private, no-store` und `Netlify-CDN-Cache-Control: no-store`. Kein Service Worker cached Personaldaten.
- Der Browser speichert ausschliesslich die Spracheinstellung sowie die vom Identity-SDK verwaltete Sitzung. Arbeitsdaten werden nicht in localStorage geschrieben.
- Auf dem Server wird pro Befehl die aktuelle Workspace-Zeile unter `FOR UPDATE` geladen. Prüfung, Änderung und Audit werden atomar committed. Versionsnummern schützen Korrekturen vor veralteten Formularen.
- Serverseitige Validierung erlaubt nur definierte Aktionen und Felder. Ein UI-Schalter ist keine Berechtigungsprüfung.
- Stornierungen und Löschungen von Aufgaben/Profilen sind logisch. Audit-Einträge enthalten Akteur, Aktion, Eingaben, generierte Datensatz-ID, Workspace-Version, Zeitstempel und vorherige/neue Werte der betroffenen Entitäten.
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

## Automatische Übersetzung

`netlify/lib/translation.ts` ruft den AI Gateway aus der authentifizierten Workspace-Function auf. Modell: `gpt-4o-mini`, gemäss [Netlify-Modellliste](https://docs.netlify.com/build/ai-gateway/overview/). `OPENAI_BASE_URL` und `OPENAI_API_KEY` werden serverseitig über `Netlify.env.get` gelesen; es gibt keine Schlüssel im Client. Netlify stellt diese Variablen bei aktivierter AI-Gateway-Unterstützung bereit.

Im Projekt prüfen: AI-Funktionen verfügbar/aktiv, ausreichende Credits, Übersetzungen von DE nach ES und ES nach DE. Übermittelt werden nur Titel/Beschreibung, keine Nutzer-ID oder Stunden. Antworten werden gegen erwartete Felder und Längen geprüft. Ein Timeout nach zehn Sekunden oder eine fehlende Konfiguration lässt den Originaltext gespeichert und markiert die Übersetzung als offen. Ein erneuter Versuch ist über die Aufgabendetails möglich.

Die Übersetzung findet nach der Berechtigungs- und Versionsprüfung innerhalb der bestehenden Workspace-Transaktion statt. Im kleinen Team kann ein Übersetzungsaufruf daher andere Änderungen kurz blockieren, maximal bis zum Timeout. Bei höherer Last sollte die Übersetzung über eine separate Job-Queue erfolgen.

Deploy-Previews verwenden `npm run build:demo` und ausschliesslich flüchtige Beispieldaten. Automatische Übersetzungen werden dort nicht ausgeführt. Produktive Anmeldung und Übersetzung benötigen eigene Integrationstests mit einem autorisierten Konto.
