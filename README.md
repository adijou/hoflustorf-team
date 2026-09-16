# Hof Lustorf Team

Interne Aufgabenplanung und persönliche Arbeitsrapporte für den Hofalltag. Deutsch und Spanisch, mobil bedienbar und im Design der Hof-Lustorf-Website.

## Stand

Erster implementierter Entwurf. Der Quellcode enthält ausschliesslich fiktive Beispieldaten. Echte Konten und Arbeitsrapporte werden ausschliesslich über die geschützte Netlify Function und die Datenbank verarbeitet. Noch keine produktive Freigabe.

### Enthalten

- Tages- und Wochenplanung mit Einzelzuständigkeit, Zweierarbeit und gemeinsamem Aufgabenbudget.
- Einmalige, tägliche, wöchentliche und monatliche Aufgaben. Monatsende wird bei kurzen Monaten berücksichtigt.
- Mitarbeitende schlagen neue Aufgaben vor; die Hofleitung plant sie ein.
- Persönliche Rapporte mit Beginn, Ende, Pause, Aufgabe und Bemerkung; ungeplante notwendige Arbeit kann jederzeit ohne Aufgabe erfasst werden.
- Jede Person führt ihr eigenes Zeitkonto. Standard für Mitarbeitende: 35 Stunden pro Woche.
- Gemeinsame Aufgabenzeit addiert sämtliche beteiligten Personen. Budgetüberschreitungen kürzen keine Arbeitszeit.
- Prüfung auf überschneidende Einsätze und ungültige Zeitangaben.
- Monatsrapport einreichen, durch die Hofleitung freigeben oder mit Begründung zur Korrektur öffnen.
- Korrekturen mit Versionsprüfung; Stornierungen erhalten den Originaleintrag. Jede Änderung wird serverseitig protokolliert.
- CSV-Export mit Schutz gegen Tabellenformeln in Freitexten.
- Netlify Identity mit Einladungs-, Login- und Passwortwiederherstellungsoberfläche; Rollen `manager` und `staff`.

### Noch zu klären / vor Echtbetrieb zu prüfen

- Netlify-Projekt verbinden, Identity aktivieren, Registrierung auf **Invite only** setzen und Rollen serverseitig vergeben.
- Datenbankmigration und Anmeldung mit echten Testkonten auf Netlify prüfen. Lokale Domain- und Browserprüfungen ersetzen diesen Test nicht.
- Visuelle Prüfung auf Desktop und Smartphone nachholen: Die verfügbare Browserumgebung konnte die lokale Vorschau nicht öffnen.
- Aufgaben, Abläufe und belastbare Zeitbudgets mit dem Team bestimmen. Die Vorschauwerte sind keine Arbeitsvorgaben.
- Wochenverteilung, Ferien, Feiertage, Absenzen, Überstunden- und Kompensationsregeln festlegen. Die Anzeige vergleicht erfasste Stunden mit dem Wochenpensum; sie berechnet bewusst keinen abrechnungsfähigen Minusstunden- oder Feriensaldo.
- Datenschutz, Aufbewahrungsfristen, Backup/Restore und Zugangsverwaltung für den konkreten Betrieb festlegen.
- Offline-Erfassung, Anhänge, Lohnbuchhaltung, Benachrichtigungen und Änderungen bestehender Aufgaben/Serientermine sind noch nicht enthalten. Serien können vorerst gestoppt und neu angelegt werden.

## Entwicklung

Node.js 24, npm. Abhängigkeiten sind in `package-lock.json` festgehalten.

```sh
npm ci
npm run dev:demo
npm test
npm run build
```

`npm run dev:demo` und `npm run build:demo` aktivieren eine klar gekennzeichnete Vorschau mit flüchtigen Beispieldaten. Es gibt dort keine Authentifizierung; Datenänderungen bleiben ausschliesslich im Arbeitsspeicher des Browsers und verschwinden beim Neuladen. Niemals echte Personaldaten in diesen Modus eingeben.

`npm run build` erzeugt den regulären, anmeldungspflichtigen Client. `VITE_DEMO` muss in einem echten Team-Projekt fehlen oder `false` sein. Die API bleibt in jedem Modus geschützt und akzeptiert keine Demo-Identitäten.

Für die Netlify-Dienste `npx netlify dev` verwenden. Netlify Identity kann gemäss SDK-Dokumentation erst auf einem Netlify-Deploy vollständig getestet werden.

## Architektur

Vite + React + TypeScript, Netlify Functions, `@netlify/identity`, `@netlify/database` (Postgres). Details: [Betrieb und Einrichtung](docs/SETUP.md), [fachliche Regeln](docs/PRODUCT.md).

Das kleine Team wird in einer versionierten JSONB-Zeile in Postgres gespeichert. Jede Mutation sperrt diese Zeile in einer Transaktion und schreibt gleichzeitig einen separaten Audit-Eintrag. Damit gehen gleichzeitige Rapporte nicht durch gegenseitiges Überschreiben verloren. Diese einfache Architektur ist für ein kleines Team vorgesehen; bei grösserem Datenvolumen sind normalisierte Tabellen und paginierte Abfragen der nächste Ausbauschritt.

Original-Logo und Favicon stammen unverändert aus `adijou/hoflustorf`; Farben und Typografie folgen dessen `DESIGN.md`. Vertragsdateien, Löhne, Zugangsdaten und reale Rapporte gehören nicht in das Repository.
