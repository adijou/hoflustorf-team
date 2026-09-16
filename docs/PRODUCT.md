# Fachliche Grundlage des ersten Entwurfs

## Arbeitsmodell

- Zwei Mitarbeitende mit je 35 Wochenstunden; die Pferdepension bestimmt den überwiegenden Arbeitsbedarf.
- Jede Person erfasst ihre tatsächlichen Zeiten. Die Stunden werden nicht zwischen Personen verrechnet.
- Aufgabenerledigung und Zeiterfassung sind unabhängig: ein Haken ersetzt keinen Rapport und ein Rapport setzt keinen Erledigt-Haken.
- Ein Aufgabenbudget umfasst die Summe aller beteiligten Personen, beispielsweise zwei Personen à eine Stunde = zwei Personenstunden.
- Budgets sind Planungswerte. Sie begrenzen weder erfassbare Arbeitszeit noch entscheiden sie automatisch über den Anspruch auf Vergütung oder Kompensation.
- Die Anzeige des Wochenpensums ist keine Lohnabrechnung. Arbeitsverteilung, Absenzen, Feiertage und Ferien müssen vor der Berechnung rechtlicher Saldi geklärt werden.

## Ablauf

1. Hofleitung erstellt Aufgaben mit Termin, Wiederholung, Verantwortlichkeit, Personenbedarf und Minutenbudget.
2. Mitarbeitende können Aufgaben vorschlagen. Diese erscheinen vor Freigabe nicht im regulären Einsatzplan.
3. Notwendige ungeplante Arbeit kann ohne freigegebene Aufgabe mit Beschreibung rapportiert werden.
4. Jede Person trägt Datum, Beginn, Ende und tatsächlich bezogene Pause ein. Einsätze über Mitternacht werden am Tageswechsel geteilt. Ein Zeitraum wird nicht gleichzeitig mehreren Aufgaben zugerechnet.
5. Monatsrapporte werden persönlich eingereicht. Neue Einträge, Korrekturen und Stornierungen in diesem Monat sind danach gesperrt.
6. Die Hofleitung gibt den Rapport frei oder öffnet ihn mit Begründung zur Korrektur. Nach einer Korrektur ist eine erneute persönliche Einreichung nötig.
7. Die Hofleitung kann fremde Zeiten nach dem Öffnen des Monats mit Begründung korrigieren oder stornieren. Akteur, Zeitpunkt, Grund sowie vorheriger und neuer Wert werden protokolliert. Korrekturen werden beim betroffenen Eintrag angezeigt. Ein Monatsrapport muss anschliessend erneut persönlich eingereicht werden.

## Wiederholungen

Termine werden aus der Aufgabenvorlage für das gewählte Datum berechnet. Dadurch erzeugt wiederholtes Laden keine doppelten Aufgaben. Täglich bedeutet einschliesslich Wochenende. Wöchentlich verwendet den Wochentag des ersten Termins. Monatlich verwendet den Tag des ersten Termins, bei kürzeren Monaten den letzten Monatstag. Eine gestoppte Serie bleibt für historische Termine und Rapporte erhalten.

## Sprachen

Die Bedienoberfläche ist Deutsch/Spanisch. Aufgaben werden mit einem Titel und einer Beschreibung in der ausgewählten Eingabesprache erfasst. Beim Speichern ergänzt der Netlify AI Gateway die andere Sprache. Der Originaltext bleibt erhalten. Reine Planungsänderungen verwenden vorhandene Übersetzungen weiter; geänderte Texte werden neu übersetzt. Bei einem Ausfall wird das Original gespeichert und die Übersetzung sichtbar als offen markiert. Nur die beiden Aufgabentexte werden an den Übersetzungsdienst übermittelt.

Alte Aufgaben funktionieren ohne Datenmigration weiter. Die Hofleitung kann über «Übersetzung ergänzen» oder beim Bearbeiten die fehlende Übersetzung erzeugen lassen. Die Vorschau ruft keinen Übersetzungsdienst auf.

## Nächster fachlicher Schritt

Mit dem Team die Morgen- und Abendroutine, Weidegang, Misten, Fütterung und Zusatzarbeiten aufnehmen. Drei bis vier Wochen tatsächliche Zeiten vergleichen, dann realistische Budgets und sinnvolle Einzel-/Zweierzuständigkeiten festlegen. Personalplanung und die rechtliche Vertragsergänzung werden separat bestätigt.

## Bearbeiten und Löschen

- Hofleitung: alle Aufgaben und Vorschläge bearbeiten/löschen, Zeitrapporte korrigieren/stornieren, Monatsabschlüsse öffnen/löschen, Teamprofile bearbeiten/deaktivieren/wiederherstellen.
- Mitarbeitende: eigene noch nicht freigegebene Vorschläge bearbeiten/löschen sowie eigene offene Zeiteinträge bearbeiten/stornieren.
- Aufgaben werden logisch gelöscht und verschwinden aus der Planung; Titel und zugehörige Zeitrapporte bleiben erhalten. Neue Zeiten dürfen keiner gelöschten Aufgabe zugeordnet werden. Bereits vorhandene Einträge bleiben korrigierbar.
- Aufgabenänderungen gelten für die ganze Serie. Bereits erfasste Stunden und die zugehörigen Titel werden nicht nachträglich umgeschrieben. Geplante Termine und Budgets folgen der aktuellen Vorlage; es gibt noch keine Historisierung früherer Planversionen.
- Monatsrapport löschen entfernt ausschliesslich den Abschlussstatus. Die Einzelzeiten bleiben bestehen und können korrigiert werden.
- Teamprofil löschen sperrt den App-Zugang auch bei noch gültiger Identity-Sitzung, hebt Zuteilungen auf und erhält historische Rapporte. Es löscht kein Netlify-Identity-Konto. Einladungen, Anmelde-E-Mail und Rollen bleiben in der Identity-Verwaltung. Eigene Profile können nicht gelöscht werden.
- Wiederherstellung reaktiviert ein Profil bzw. eine Aufgabe. Aufgehobene Zuteilungen müssen neu gesetzt werden.
- Versionsprüfungen verhindern das Überschreiben zwischenzeitlicher Änderungen; Monatsrapporte erhalten zusätzlich eine eindeutige ID, damit eine alte Freigabe nicht auf einen neu eingereichten Rapport angewendet werden kann.

## Navigation in der Planung

Die Wochensicht öffnet ein Fenster von sieben Tagen ab heute (Datum in Europe/Zurich). Vorherige/nächste Woche verschieben es um genau sieben Tage. «Ab heute» setzt das Fenster zurück. Das Startdatum kann direkt gewählt werden. Die Tagesansicht hat eine eigene Datumauswahl mit Tagessprüngen und «Heute». Ein Klick auf einen Tag der Wochenübersicht öffnet diesen Tag. Kennzahlen in der Wochensicht beziehen sich auf alle sieben angezeigten Tage; die Tagesansicht behält ihren Vergleich mit dem Kalenderwochenpensum.
