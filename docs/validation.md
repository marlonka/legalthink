# Verbleibende Tests

Stand: 3. Oktober 2026. Auf Wunsch auf wesentliche Schutzmechanismen reduziert.

## Umfang

- `backend/tests/test_api.py`: Datenspeicherung, atomisches Speichern und Löschen, Abbruch, Eingabegrenzen einschließlich 1.000.000 Zeichen, vertrauliche Fehlermeldungen, Dokumentimport und Export bestehender Berichte.
- `backend/tests/test_analysis.py`: OpenAI-Anfrage mit Luna/Hoch, getrennte Anweisungen und Quelldaten, Cachepräfix, Quellenprüfung, Vergleichsrollen, Providerfehler und Abbruch. Providerantworten werden simuliert.
- `backend/tests/test_security_review.py`: Host-/Origin-/Token-Zugriff, PDF-Ressourcengrenzen, Dokumentherkunft sowie bekannte Import- und Exportfehler.
- `backend/tests/test_export.py`: Unbestätigte Zitate dürfen keine nachverfolgten Word-Änderungen erzeugen.
- `tests/built.spec.ts`: Ein Browserablauf gegen den Produktionsbuild: Start mit Luna/Hoch, lokales Beispiel, Quellenansicht, Markdown-Export und erneutes Öffnen. Prüft außerdem lokale Assets und Content Security Policy.

Entfernt: 43 Browserfälle für Layout, Motion, Themes, Bildschirmgrößen, Detailbedienung und große Texteingaben; doppelte Backendfälle, Demo-Matrizen und reine Formatierungsprüfungen. Die separate Vite-Testinstanz, zweite Playwright-Konfiguration und axe-Abhängigkeit entfallen. Keine automatischen Testwiederholungen.

## Ergebnis der Bereinigung

- Backend: 58 statt 91 Fälle; lokal bestanden in 4,11 Sekunden.
- Browser: 1 statt 44 Fälle; bestanden in 0,62 Sekunden, einschließlich Start des Testservers 3,0 Sekunden.
- Ruff, Prettier und `git diff --check`: bestanden. Produktcode unverändert; Browserprüfung gegen den vorhandenen Produktionsbuild.

Beim ersten Lauf lief der alte 20-ms-Abbruchtest vor Initialisierung des SDK-Transports ab. Der Test ersetzt jetzt direkt die wartende Providerantwort und wartet vor dem manuellen Abbruch auf deren Start. Timeout und Abbruch werden weiterhin geprüft. Die separate SDK-Serialisierungsprüfung bleibt erhalten.

## Ausführen

```sh
npm run build
npm run format:check
uv run --project backend --extra dev ruff check backend
npm run test:api
npx playwright install chromium
npm run test:built
```

Die CI führt dieselben Prüfungen aus. Tests verwenden synthetische Daten, eigene temporäre Datenverzeichnisse und einen leeren API-Schlüssel. Direkte httpx-Netzwerkzugriffe sind in Python-Tests gesperrt; die OpenAI-Anbindung wird über MockTransport geprüft.

## Grenzen

Layoutstabilität, Themevarianten, Fokusabläufe und Barrierefreiheit werden nicht mehr flächendeckend automatisch geprüft. Bei Änderungen die betroffenen Bedienabläufe gezielt prüfen.

Es liegt kein erfolgreicher Live-Modelltest vor. Rechtliche Ausgabequalität, tatsächliche Recherche, Cachetreffer, Kosten und Latenz bleiben ungeprüft. Das [Evaluationspaket](../evals/README.md) enthält manuelle Kriterien und synthetische Unterlagen; es wird nicht automatisch ausgeführt. Word-Paginierung wurde nicht visuell geprüft.

Ältere Design- und Workflowberichte dokumentieren den damaligen Stand und beschreiben teilweise inzwischen entfernte Tests.
