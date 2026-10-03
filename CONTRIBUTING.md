# Zu LegalThink beitragen

## Fehler und Änderungen

- Fehler mit Schritten, erwartetem Ergebnis und tatsächlichem Verhalten beschreiben. Betriebssystem, Browser und betroffene Dateiformate nennen.
- Ausschließlich synthetische Beispieldaten teilen. Keine Mandatsunterlagen, API-Schlüssel, `.env`-Dateien oder lokalen Datenbanken hochladen.
- Größere Funktionsänderungen zuerst in einem Issue beschreiben. Kleine, zusammenhängende Pull Requests erleichtern die Prüfung.

## Lokal entwickeln

Die Einrichtung steht in der [README](README.md#lokal-starten). `npm run dev` startet Oberfläche und Backend. „Beispiel öffnen“ funktioniert ohne OpenAI-Schlüssel.

Vor Änderungen an der Oberfläche [design.md](design.md) lesen. Texte benennen Aktionen, Zustände oder entscheidungsrelevante Informationen. Dark Mode, Light Mode, Tastaturbedienung und feste Positionen der Bedienelemente erhalten.

## Änderungen prüfen

```sh
npm run build
npm run format:check
uv run --project backend --extra dev ruff check backend
npm run test:api
npx playwright install chromium
npm run test:built
```

Führe die für deine Änderung relevanten Prüfungen aus; CI führt die vollständige Prüfung aus. Die bestehenden Tests verwenden synthetische Daten und simulierte Providerantworten. Echte OpenAI-Aufrufe sind kein Teil der Tests. Neue Tests sollen ein konkretes Produktrisiko abdecken, etwa Datenverlust, falsche Quellenzuordnung oder unbeabsichtigte API-Aufrufe.

Beschreibe im Pull Request das geänderte Verhalten und die tatsächlich ausgeführten Prüfungen. Füge bei sichtbaren Änderungen einen Screenshot mit synthetischen Inhalten hinzu. Verwende Conventional Commits, zum Beispiel `fix: retain source selection when switching tabs`.

## Lizenz

Beiträge müssen unter der [MIT-Lizenz](LICENSE) des Projekts bereitgestellt werden können. Bewahre Lizenzhinweise übernommener Bibliotheken und anderer Bestandteile. Kopiere keine proprietären Dokumente, Grafiken oder Schriftdateien in das Repository.
