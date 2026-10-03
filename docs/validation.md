# Prüfprotokoll

Stand: 3. Oktober 2026. Synthetische Unterlagen; keine echten OpenAI-Anfragen.

## Durchgeführt

| Prüfung | Ergebnis |
| --- | --- |
| TypeScript und Vite-Produktionsbuild | Erfolgreich |
| Python-Tests | 43 bestanden |
| Browserabläufe mit Chromium | 9 bestanden |
| Gebaute Oberfläche direkt über FastAPI | Bestanden; lokale Assets, CSP, Verlauf und Markdown-Export |
| Ruff und Prettier | Erfolgreich |
| Automatisierte WCAG-A/AA-Prüfungen mit axe | Keine gemeldeten Verstöße auf den geprüften Ansichten |
| Sichtprüfung | Desktop und Mobilgerät; Start, Befunde, Formulierungen und Dokumentauswahl |
| npm-Audit der Frontend-Produktionsabhängigkeiten | Keine bekannten Schwachstellen gemeldet |

Die Browserabläufe prüfen Modellwechsel mit unzulässigem Denkaufwand, lokalen Dokumentimport, Fehler ohne API-Schlüssel, mobile Darstellung, Fundstellen, Word-Download, Verlauf nach Neuladen, Playbook-Erstellung und -Bearbeitung, bestätigtes Löschen, wiederverwendbare Dokumente, Reihenfolge beim Versionsvergleich, Ladefehler mit Wiederholung und Tastaturfokus im mobilen Menü. Eine separate Prüfung lädt den Produktionsbuild ohne Vite direkt aus Python und erkennt Verstöße gegen die Content Security Policy.

Die Python-Suite deckt API-Validierung, Persistenz, Host/Origin/Loopback-Zugriff, Dokumentlimits, Parsergrenzen, simulierte Providerfehler, Zitatverifikation, Chronologiebelege, Quellenzuordnung, Request-Serialisierung und Export ab. Lange Berichtstitel lösten zunächst einen Word-Exportfehler aus; der Regressionstest scheiterte vor der Korrektur und besteht danach. OOXML-Revisionen, Hyperlinks und erhaltene Überschriften werden strukturell geprüft.

Die Oberfläche verwendet lokal ausgelieferte Inter-Schriften. Dateigrößen und Komprimierung werden im Vite-Build ausgegeben; sie sind keine gemessenen Ladezeiten.

## Grenzen der Nachweise

- Keine Live-Prüfung von Modellzugang, Ausgabequalität, Quellenrecherche, Kosten, Cache-Treffern oder Latenz. Dafür stehen [synthetische Evaluationsfälle](../evals/README.md) bereit.
- Word-Paginierung und Darstellung in Microsoft Word wurden nicht visuell geprüft. Der Export ist ein Prüfbericht mit Änderungsmarkierungen, keine formatgetreue Bearbeitung des Originalvertrags.
- axe ersetzt keine vollständige Barrierefreiheitsprüfung. Getestet wurden Chromium und ausgewählte Desktop-/Mobilansichten; keine vollständige Screenreader- oder Browsermatrix.
- Der Testlauf meldet eine vorgelagerte Starlette-Abkündigungswarnung für dessen httpx-Testclient. Alle Tests bestehen; Laufzeitintegration und künftige Dependency-Upgrades bleiben getrennt zu prüfen.
- Keine externe Sicherheitszertifizierung, Rechtsqualitätsfreigabe oder Mehrbenutzerfreigabe. Betriebsgrenzen: [Architektur](architecture.md).

## Wiederholen

```sh
npm ci
npm --prefix frontend ci
uv sync --project backend --extra dev --frozen
npm run build
npm run format:check
uv run --project backend --extra dev ruff check backend
npm run test:api
npx playwright install chromium
npm run test:e2e
npm run test:built
```

Die GitHub-Workflowdatei führt dieselben Kernprüfungen unter Linux aus. Tests löschen keinen bestehenden Arbeitsraum: Sie nutzen eigene temporäre Datenverzeichnisse und einen leeren API-Schlüssel.
