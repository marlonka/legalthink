# LegalThinkGPT

Lokale Anwendung für Vertragsprüfung, Versionsvergleich, Chronologie, Datenschutz- und Werbeprüfung. Ergebnisse enthalten Fundstellen und Formulierungsvorschläge; Export als Word oder Markdown.

React und TypeScript im Browser. FastAPI, SQLite und die OpenAI Responses API im Python-Backend. Keine API-Schlüssel im Frontend.

## Lokal starten

Voraussetzungen: Node.js 22.12+, [uv](https://docs.astral.sh/uv/getting-started/installation/) und Python 3.12+. `uv` kann Python bei Bedarf installieren.

```sh
npm ci
npm --prefix frontend ci
uv sync --project backend --extra dev
npm run dev
```

Öffnen: [localhost:5175](http://localhost:5175). **Beispiel öffnen** zeigt einen fiktiven Fall zur gewählten Prüfungsart ohne API-Aufruf. Datenschutz bietet eigene Beispiele für Allgemein, AVV und DSFA.

## Eigene Dokumente analysieren

Kopieren Sie `backend/.env.example` nach `backend/.env`. Tragen Sie Ihren OpenAI-Projektschlüssel ausschließlich dort als `OPENAI_API_KEY` ein. Starten Sie den Server neu. Die Datei ist von Git ausgeschlossen.

1. Arbeitsweise wählen und Dokumente hinzufügen: PDF mit Textebene, DOCX, TXT oder Markdown.
2. Perspektive und Prüfauftrag ergänzen; optional ein Kanzlei-Playbook auswählen.
3. Modell und Denktiefe wählen. Die Analyse beginnt erst nach dem ausdrücklichen Start.
4. Befunde, Originalstellen und Formulierungsvorschläge prüfen. Ergebnis als Word oder Markdown exportieren.

Für den Vergleich zuerst den eigenen Entwurf, dann den Gegenentwurf wählen. Gescannte PDFs benötigen vorher OCR. Der Import verarbeitet Text; er ersetzt keine Prüfung von Tabellen, Anhängen oder visuellen Vertragsbestandteilen.

DOCX-Dateien mit offenen Textänderungen werden beim Import abgewiesen. Nehmen Sie die Änderungen in einer Kopie zuerst an oder lehnen Sie sie ab; sonst würde der Textimport geänderte Passagen übergehen. Das Original bleibt unverändert.

## Werkzeuge

| Werkzeug | Ergebnis |
| --- | --- |
| Vertragsprüfung | Vertragspunkte, Klauselbelege und separate Klauselvorschläge |
| Versionsvergleich | Original und Gegenentwurf nebeneinander, Bewertung und separate Verhandlungsvorschläge |
| Chronologie | Ereignisse, Quellen und offene Sachverhaltsfragen |
| Datenschutz | Datenschutzfragen, AVV-Vertragspunkte oder DSFA-Risiken und Prüfpunkte; jeweils mit offenen Angaben |
| Werbeprüfung | Aussagen, Prüfbedarf und rechtliche Anknüpfungspunkte |
| Kanzlei-Playbooks | Eigene Prüfmaßstäbe und Formulierungsvorgaben |

Ergebnisansichten und Vorschlagsbezeichnungen richten sich nach der Aufgabe. Leere Nebenansichten entfallen. Fundstellen öffnen rechts neben der Analyse, auf schmaleren Fenstern bildschirmfüllend. Weitere Quellen lassen sich direkt aus der Ergebnisliste öffnen. Neue Vergleiche speichern und prüfen den Wortlaut beider Fassungen getrennt; ältere Ergebnisse behalten ihre vorhandenen Belege. Für die Gegenüberstellung alter Vergleiche ist eine neue Analyse nötig.

## Modelle

| Modell | Denktiefe |
| --- | --- |
| `gpt-6.1-sol` | `low`, `medium`, `high`, `xhigh`, `max` |
| `gpt-6-luna` | `none`, `low`, `medium`, `high`, `xhigh`, `max` |

Standard für neue Browserprofile und API-Anfragen ohne Modellauswahl: `gpt-6-luna` mit Denktiefe `xhigh`, auch bei eigener Installation. Eine ausdrücklich gewählte Alternative wird im jeweiligen Browser gespeichert. Mehr Denktiefe kann Wartezeit und Kosten erhöhen. Modellzugang hängt vom OpenAI-Projekt ab. Die verfügbaren API-Werte sind in der Oberfläche abgebildet; Codex-spezifische Einstellungen werden nicht als API-Funktionen ausgegeben.

## API-Region und Flex

Die Einstellungen zeigen die gewählte API-Region. Ohne eigene Browserauswahl gilt die Servervorgabe: `OPENAI_PROCESSING_REGION=global` verwendet `api.openai.com`; `eu` verwendet `eu.api.openai.com`. Für eine geeignete EU-Konfiguration setzen Sie `OPENAI_PROCESSING_REGION=eu` in `backend/.env` und starten den Server neu. Neue Browserprofile und API-Anfragen ohne Regionsauswahl übernehmen diese Vorgabe. Global bleibt der Standard ohne diese Konfiguration.

EU-Verarbeitung setzt die Freigaben und Aufbewahrungsvereinbarungen des OpenAI-Projekts voraus. Die App kann diese Berechtigung nicht automatisch ermitteln; die Auswahl eines Endpoints bestätigt sie nicht. Die Region umfasst EWR und Schweiz. OpenAI nennt für die hier verwendeten Modelle 10 % Regionalaufschlag; Systemdaten fallen nicht unter dieselbe Residenzzusage. Bei Fehlern erfolgt kein automatischer Wechsel auf Global. [OpenAI: Data controls](https://developers.openai.com/api/docs/guides/your-data).

**Flex** ist optional in den Einstellungen und Prüfoptionen wählbar. Für Luna und Sol liegen die Tokenpreise derzeit 50 % unter Standard; Werkzeugkosten sind davon getrennt. Antworten können länger dauern, Kapazität kann zeitweise fehlen. Flex-Anfragen dürfen bis zu 15 Minuten laufen. Es gibt keinen automatischen erneuten Aufruf zum Standardpreis. Der OpenAI-Leitfaden dokumentiert keinen separaten Flex-Aktivierungsschalter; Modell- und Projektzugriff müssen passen. [Flex processing](https://developers.openai.com/api/docs/guides/flex-processing), [Preise](https://developers.openai.com/api/docs/pricing).

## Daten und Betrieb

Dies ist ein lokal betriebener Einzelbenutzer-Arbeitsraum. Dokumenttexte, Originaldateien (PDF, DOCX, TXT und Markdown), Playbooks und Analysen werden in einer lokalen SQLite-Datenbank gespeichert. Keine integrierte Anmeldung, Mandantentrennung oder Verschlüsselung der Datenbank. Der Entwicklungsserver bindet standardmäßig an die Loopback-Adresse.

Eingefügter Text wird mit der abgeschlossenen Analyse als TXT-Quelle gespeichert. Dokumentnamen und „Fundstelle ansehen“ öffnen eine gemeinsame Vorschau:

- PDF: fortlaufende Originalseiten, Seitenwahl, Zoom und Markierung eines eindeutigen Zitats.
- Word: formatierte DOCX-Vorschau mit Tabellen, Rasterbildern und Änderungsverfolgung. Layout und Seitenumbrüche können von Word abweichen; Makros, externe Ressourcen und eingebettete aktive Inhalte werden nicht ausgeführt.
- TXT und Markdown: vollständiger Text mit Zitatmarkierung. Markdown bietet zusätzlich eine Leseansicht; externe Bilder und eingebettetes HTML werden nicht geladen.

Alle neuen Uploads behalten ihre ursprünglichen Bytes für den Download. Alte PDF-/Word-Quellen ohne Original zeigen den ausgelesenen Text. Eine Datei lässt sich nachträglich zuordnen, wenn ihr ausgelesener Text übereinstimmt; ein vorhandenes Original wird nicht überschrieben. Das Löschen eines Dokuments entfernt auch die gespeicherten Originalbytes.

Mitgelieferte Beispielquellen gehören nicht zur Liste eigener Dokumente und sind gegen Einzel- und Sammellöschung geschützt. Beispielberichte dürfen aus dem Verlauf entfernt und über „Beispiel öffnen“ erneut aufgerufen werden. Fehlende Quellen noch gespeicherter Beispielberichte werden beim Serverstart wiederhergestellt; eigene Uploads bleiben löschbar, auch bei gleichem Dateinamen.

Bei einer gestarteten KI-Analyse werden die ausgewählten Dokumenttexte, der Prüfauftrag und das ausgewählte Playbook an OpenAI übertragen. `store=false` verhindert die Speicherung der Response als abrufbares API-Objekt. Es ist **keine** Zusage zu Zero Data Retention oder EU-Verarbeitung. Projektverträge, Aufbewahrungsregeln und freigegebene Verarbeitung müssen zur Kanzlei passen. Details: [OpenAI-Integration](docs/openai-integration.md).

Fundstellenprüfung bedeutet, dass ein Zitat im ausgewählten Dokument gefunden wurde. Sie bestätigt weder die Richtigkeit einer Rechtsauffassung noch die Aktualität einer Norm. Ergebnisse sind Arbeitsentwürfe für die anwaltliche Prüfung. Die Beispieldaten belegen keine Modellqualität.

## Qualität prüfen

```sh
npm run build
npm run test:api
npx playwright install chromium
npm run test:built
```

Die automatisierten Tests verwenden lokale, synthetische Daten und simulierte Providerantworten. Sie lösen keine echten OpenAI-Anfragen aus. Echte Modellqualität, Projektzugriff, Kosten und Latenz müssen anschließend mit freigegebenen Testdaten bewertet werden.

`test:built` prüft die gebaute Oberfläche direkt über FastAPI, einschließlich Sicherheitsrichtlinie und Export. [Prüfprotokoll](docs/validation.md).

## Gebaute Oberfläche starten

Nach `npm run build` liefert FastAPI die gebaute Oberfläche und API auf derselben Adresse aus:

```sh
uv run --project backend uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Öffnen: [localhost:8000](http://localhost:8000). Für diesen lokalen Betrieb wird kein Vite-Entwicklungsserver benötigt. Der Arbeitsraum ist nicht für eine ungeschützte Veröffentlichung im Internet ausgelegt.

Unter [evals/](evals/README.md) liegen synthetische Fälle und Bewertungskriterien für die anschließende Prüfung der Modellqualität.

## Projektstruktur

```text
backend/       FastAPI, Dokumentimport, SQLite, OpenAI, Exporte, Tests
frontend/      React-Arbeitsraum und Gestaltungssystem
tests/         Ein Start-/Exporttest des Produktionsbuilds
docs/          Architektur und verifizierte API-Entscheidungen
scripts/       Lokaler Start
```

Die frühere Gemini-Anwendung diente als Funktionsreferenz. LegalThinkGPT wurde neu implementiert. Designreferenz: [OpenAI UI Skills](https://github.com/ihlamury/design-skills/blob/main/skills/openai/SKILL.md), mit Anpassungen für nutzbare Eingaben, Kontrast und responsive Dokumentarbeit.
