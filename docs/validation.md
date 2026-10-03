# Verbleibende Tests

Stand: 3. Oktober 2026. Auf Wunsch auf wesentliche Schutzmechanismen reduziert.

## Umfang

- `backend/tests/test_api.py`: Datenspeicherung, atomisches Speichern und Löschen, Abbruch, Eingabegrenzen einschließlich 1.000.000 Zeichen, vertrauliche Fehlermeldungen, Dokumentimport und Export bestehender Berichte.
- `backend/tests/test_analysis.py`: OpenAI-Anfrage mit Luna/Sehr hoch, getrennte Anweisungen und Quelldaten, Cachepräfix, Quellenprüfung, Vergleichsrollen, Providerfehler und Abbruch. Providerantworten werden simuliert.
- `backend/tests/test_security_review.py`: Host-/Origin-/Token-Zugriff, PDF-Ressourcengrenzen, Dokumentherkunft sowie bekannte Import- und Exportfehler.
- `backend/tests/test_export.py`: Unbestätigte Zitate dürfen keine nachverfolgten Word-Änderungen erzeugen.
- `tests/built.spec.ts`: Ein Browserablauf gegen den Produktionsbuild: Start mit Luna/Sehr hoch, lokales Beispiel, Quellenansicht, Markdown-Export, erneutes Öffnen und Löschen mit anschließendem Browser-Zurück. Prüft außerdem lokale Assets und Content Security Policy.

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

Die CI führt dieselben Prüfungen aus. Tests verwenden synthetische Daten, eigene temporäre Datenverzeichnisse und einen leeren API-Schlüssel. Direkte HTTPX- und HTTPX2-Netzwerkzugriffe sind in Python-Tests gesperrt; die OpenAI-Anbindung wird über MockTransport geprüft.

## Grenzen

Layoutstabilität, Themevarianten, Fokusabläufe und Barrierefreiheit werden nicht mehr flächendeckend automatisch geprüft. Bei Änderungen die betroffenen Bedienabläufe gezielt prüfen.

Es liegt kein erfolgreicher Live-Modelltest vor. Rechtliche Ausgabequalität, tatsächliche Recherche, Cachetreffer, Kosten und Latenz bleiben ungeprüft. Das [Evaluationspaket](../evals/README.md) enthält manuelle Kriterien und synthetische Unterlagen; es wird nicht automatisch ausgeführt.

Ältere Design- und Workflowberichte dokumentieren den damaligen Stand und beschreiben teilweise inzwischen entfernte Tests.

## Abhängigkeiten und Review – 3. Oktober 2026

Aktualisierte Laufzeit- und Werkzeugversionen:

| Paket | Vorher installiert | Jetzt |
| --- | --- | --- |
| Vite | 7.3.6 | 8.3.2 |
| Vite React Plugin | 5.2.0 | 6.1.1 |
| TypeScript | 5.9.3 | 7.0.2 |
| Motion | 12.43.0 | 14.0.0 |
| Lucide React | 0.545.0 | 1.51.0 |
| docx-preview | 0.3.7 | 0.4.1 |
| JSZip | 3.10.1 | 3.10.2 |
| OpenAI Python | 2.54.0 | 3.24.0 |
| WebSockets | 17.1 | 17.2 |
| uv in CI | 0.11.28 | 0.12.22 |

Die übrigen direkten Pakete waren bereits auf dem aktuellen stabilen Stand. Manifest und Lockdateien halten die geprüften Versionen fest. HTTPX wird nur für FastAPI-Tests benötigt; der OpenAI-SDK nutzt HTTPX2. Der bisherige `extra_body`-Umweg für `prompt_cache_options` entfällt.

Migrationen anhand der Primärquellen geprüft: [Vite 8](https://vite.dev/guide/migration), [TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [Motion 13/14](https://motion.dev/docs/react-upgrade-guide), [Lucide 1](https://lucide.dev/guide/version-1), [docx-preview](https://github.com/VolodymyrBaydalka/docxjs/releases), [OpenAI HTTPX2](https://github.com/openai/openai-python/blob/main/httpx2.md).

- Unbenutzte Theme-Tokens, Modellbeschreibungen, eine unerreichbare Singular-Zuordnung und einen lokalen Typ-Export entfernt. Dynamische Vorschauimporte und Kompatibilitätspfade bleiben erhalten.
- Playbook-Import behält einen Namen, den der Nutzer während des Imports eingegeben hat.
- DOCX-Import weist offene Einfügungen, Löschungen und Verschiebungen mit einer konkreten Meldung ab, statt geänderte Passagen still auszulassen. Normale DOCX-Dateien bleiben importierbar.
- PDF-Seitenangaben werden nur aus einer vollständigen, eindeutigen Folge der vom Import erzeugten Seitenmarker abgeleitet. Dokumenttext wie `[Seite 999]` ergibt keine erfundene Seitenzahl. Der belegte Wortlaut bleibt als Textfundstelle verfügbar.
- Beide Quellenfehler wurden vor der Korrektur reproduziert. Drei zusätzliche Fälle in den bestehenden Testdateien schützen diese Datenintegrität; keine neue Testsuite.
- npm meldet für Root und Frontend keine veralteten direkten Pakete und keine bekannten Schwachstellen. `pip-audit` prüfte alle 42 festgeschriebenen Python-Drittanbieterpakete einschließlich plattformspezifischer Einträge: keine bekannten Schwachstellen, nichts übersprungen.
- Vorschau mit synthetischen Daten geprüft: Word-Paginierung über 11 Seiten, Zoom und Zitatmarkierung; PDF-Originalfarben und Zitatmarkierung; Menüfokus und unveränderte Positionen unter Motion 14; kein horizontaler Seitenüberlauf bei 390 px. Keine Konsolenfehler in diesen Abläufen.
- Abschließend: 69 Offline-Backendfälle und der einzelne Build-Smoke-Test bestanden. Produktionsbuild mit TypeScript 7/Vite 8, Ruff, Prettier und `git diff --check` bestanden. Keine echten OpenAI-Anfragen.

## Weiteres Code-Review – 3. Oktober 2026

Drei unabhängige Reviews: Frontend-Zustand, Backend-Lifecycle und Dokumentvorschau/Quellenverarbeitung.

- Gelöschte Analysen werden aus dem Frontend-Cache entfernt. Browser-Zurück zeigt den Fehlerzustand; ein Bericht einer anderen Route wird nicht vorübergehend eingeblendet.
- Routenwechsel brechen laufende Detailabrufe ab. Datenänderungen lösen keinen Scroll-Reset mehr aus. Redundanter Dokumentabruf und ungenutzter Playbook-Fehler-Prop entfernt.
- Unerwartete Analysefehler beenden auch den Disconnect-Watcher. Ein fehlerhaftes Lifespan-Ende schließt den OpenAI-Client.
- Ungültige Provider-Quellenlinks werden verworfen, statt einen fertigen Bericht abzubrechen. Annotationen und Suchquellen verwenden dieselbe Prüfung.
- Die beiden Backend-Lifecycle-Fehler und der Fehler bei kaputten URLs wurden vor der Korrektur reproduziert. Bestehende Tests erweitert, einen Lifecycle-Fall ergänzt; weiterhin nur ein Browser-Smoke-Test.
- 70 Offline-Backendfälle, Browser-Smoke-Test, Produktionsbuild, Ruff, Prettier und `git diff --check` bestanden. Keine echten OpenAI-Anfragen.
