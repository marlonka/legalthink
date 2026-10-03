# Verbleibende Tests

Stand: 3. Oktober 2026. Auf Wunsch auf wesentliche Schutzmechanismen reduziert.

## Aktueller Stand

**44 Backendfälle statt 70; weiterhin ein Browser-Smoke-Test.** Testcode netto um 207 Zeilen reduziert. Produktcode, CI und Abhängigkeiten unverändert.

Vergleich auf demselben Prüfvenv: Baseline `2bec8b6` mit 70 bestandenen Fällen in 11,88 Sekunden; nach Bereinigung 44 bestandene Fälle in 8,03 Sekunden. Keine übersprungenen Tests und keine echten OpenAI-Anfragen. Einzelmessungen, kein Performance-Benchmark.

Abschluss: Browser-Smoke-Test, Produktionsbuild, Ruff, Prettier und `git diff --check` bestanden.

### Entfernt oder zusammengeführt

Pfade unter `backend/tests/`. Wiederholte Varianten wurden gestrichen; übernommene Prüfungen sind unten zugeordnet. Keine Fälle nur zum Senken des Zählers in Schleifen verschoben.

| Bisheriger Test / Varianten | Entscheidung und verbleibende Prüfung |
| --- | --- |
| `test_api.py::test_playbook_edits_preserve_identity_and_survive_restart`, `test_analysis_without_config_returns_explicit_error` | In `test_document_playbook_and_analysis_persistence` aufgenommen. Ein Server-Neustart prüft jetzt Dokumente, bearbeitete Playbooks und Berichte gemeinsam. |
| `test_api.py::test_bulk_document_deletion_requires_explicit_selection` | Leere Auswahl im vorhandenen Löschablauf geprüft. Zusätzliche Variante mit fehlendem JSON-Feld entfällt. |
| `test_api.py::test_pasted_source_persists_with_completed_result_and_preserves_version_ids` | Ein Vergleich mit Zusatzquelle reicht für diesen Speicherpfad. Doppelte Chronologie-Ausführung und künstlich langer Dateiname entfallen. Reine Texteingabe bleibt im Transaktions- und Analyse-Service-Test enthalten. |
| `test_api.py::test_mixed_document_and_pasted_text_limit_is_enforced_without_truncation` | Zwei Fälle für die gemeinsame Grenze von Dokumenten und Text behalten. Zweite Matrix nur mit Text entfernt. |
| `test_api.py::test_invalid_analysis_inputs_never_echo_document_text` | Eine repräsentative private, ungültige Eingabe in `test_validation_errors_never_echo_document_text`. Separate Prüfungen für Leertext, Dokumentzahl/-duplikate, Modell-/Effort-Paar und Subtask-Kombination entfallen. |
| `test_api.py::test_exports_preserve_revisions_labels_and_separate_timeline_quotes` | Word-Revisionen und Beispielkennzeichnung liegen in `test_export.py`. Eigenständige Chronologie-Altbestandsprüfung bleibt unter `test_legacy_timeline_quotes_survive_read_and_export_without_rewriting`. Keine feste Anzahl von Demo-Revisionen mehr. |
| `test_api.py::test_docx_table_and_paragraph_order` | Reihenfolge im bereits vorhandenen DOCX-Import geprüft; separater Direktaufruf entfällt. |
| `test_api.py::test_lifespan_closes_provider_after_application_error` | Interne SDK-Schließprüfung bei künstlicher App-Shutdown-Ausnahme entfernt. Analyseabbruch, Watcher-Cleanup, fehlgeschlagene Speicherung und vertrauliche Fehler bleiben separat geprüft. |
| `test_analysis.py::test_cached_prefix_excludes_changing_matter_and_workflow_data` | Zweiter SDK-Durchlauf zum Vergleich fester Cachewerte entfernt. Wire-Format, Cachemarkierung und Trennung privater Daten von Entwickleranweisungen im vorhandenen Serialisierungstest behalten. |
| `test_analysis.py::test_provider_errors_hide_raw_content`, `test_model_access_error_is_actionable_without_exposing_provider_details` | Sechs Varianten auf zwei Fälle in `test_provider_access_errors_are_actionable_without_retry_or_private_details` reduziert: Kontingent und Modellzugriff. Generische Fehler und Geheimhaltung prüft zusätzlich die API-Grenze. |
| `test_analysis.py::test_pdf_content_cannot_forge_page_attribution` | Zweite Marker-Variante entfernt. Echter PDF-Import mit gültiger Seite und gefälschtem Marker bleibt. |
| `test_security_review.py::test_word_export_bounds_metadata_without_truncating_visible_title` | Langer Titel im bestehenden Word-Vergleichsexport geprüft. |
| `test_security_review.py::test_document_worker_imports_when_server_started_outside_backend` | Standalone-Workerprüfung entfernt. Die echten API-Uploads starten weiterhin den Worker aus dem Repository-Verzeichnis. |
| `test_security_review.py::test_text_document_cannot_forge_pdf_page_provenance`, `test_cross_page_match_never_keeps_model_invented_location`, `test_timeline_checks_quote_and_replaces_model_claimed_source` | Gemeinsame Quellenfixtures in `test_analysis.py`; verifizierte und erfundene Chronologie-Zitate im selben realen Service-Durchlauf. Beim wiederholten PDF-Zitat Seitenzahl der Fixture korrigiert, damit tatsächlich Mehrdeutigkeit geprüft wird. |
| `test_security_review.py::test_browser_origin_blocks_reads_and_writes_without_touching_storage` | Gewöhnliche Fremddomain als doppelte Variante entfernt. Ähnlicher Hostname und `null` bleiben; Host-, Remote- und Token-Grenzen bleiben eigenständig. |
| `test_security_review.py::test_original_roundtrip_legacy_attachment_and_deletion` | PDF und DOCX mit ihren unterschiedlichen Parsern behalten. TXT-Originalbytes und Löschung im Persistenzablauf geprüft. Markdown verwendet denselben Textparser; dessen kompletter Dateiablauf wird nicht wiederholt. |

Die zusammengeführten Prüfungen wurden zusätzlich mit vier einmaligen Fehlern im Prozess geprüft: verworfene Playbook-Änderung, abgeschnittener Word-Titel, fälschlich bestätigtes Chronologie-Zitat und vertauschte Word-Absatz-/Tabellenreihenfolge. Alle vier Fehler wurden erkannt. Keine Produktionsdatei dafür verändert; keine zusätzlichen dauerhaften Tests.

Feldkombinationen, jede Provider-Statusvariante und interne Shutdown-Details werden bewusst nicht mehr einzeln automatisiert geprüft. Die Tests beweisen keine juristische Modellqualität.

## Umfang

- `backend/tests/test_api.py`: Datenspeicherung, atomisches Speichern und Löschen, Abbruch, Eingabegrenzen einschließlich 1.000.000 Zeichen, vertrauliche Fehlermeldungen, Dokumentimport und Export bestehender Berichte.
- `backend/tests/test_analysis.py`: OpenAI-Anfrage mit Luna/Sehr hoch, getrennte Anweisungen und Quelldaten, Cacheparameter, Quellenprüfung, Vergleichsrollen, wesentliche Providerfehler und Abbruch. Providerantworten werden simuliert.
- `backend/tests/test_security_review.py`: Host-/Origin-/Token-Zugriff, PDF-Ressourcengrenzen, Dokumentherkunft sowie bekannte Import- und Exportfehler.
- `backend/tests/test_export.py`: Unbestätigte Zitate dürfen keine nachverfolgten Word-Änderungen erzeugen.
- `tests/built.spec.ts`: Ein Browserablauf gegen den Produktionsbuild: Start mit Luna/Sehr hoch, lokales Beispiel, Quellenansicht, Markdown-Export, erneutes Öffnen und Löschen mit anschließendem Browser-Zurück. Prüft außerdem lokale Assets und Content Security Policy.

Entfernt: 43 Browserfälle für Layout, Motion, Themes, Bildschirmgrößen, Detailbedienung und große Texteingaben; doppelte Backendfälle, Demo-Matrizen und reine Formatierungsprüfungen. Die separate Vite-Testinstanz, zweite Playwright-Konfiguration und axe-Abhängigkeit entfallen. Keine automatischen Testwiederholungen.

## Frühere Bereinigung

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
