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

## Werkzeuge

| Werkzeug | Ergebnis |
| --- | --- |
| Vertragsprüfung | Priorisierte Befunde, Fundstellen und Formulierungsvorschläge |
| Versionsvergleich | Änderungen zwischen Ausgangs- und Gegenentwurf |
| Chronologie | Ereignisse, Quellen und offene Sachverhaltsfragen |
| Datenschutz | Strukturierte Prüfung von Datenschutzunterlagen |
| Werbeprüfung | Aussagen, Prüfbedarf und rechtliche Anknüpfungspunkte |
| Kanzlei-Playbooks | Eigene Prüfmaßstäbe und Formulierungsvorgaben |

## Modelle

| Modell | Denktiefe |
| --- | --- |
| `gpt-6.1-sol` | `low`, `medium`, `high`, `xhigh`, `max` |
| `gpt-6-luna` | `none`, `low`, `medium`, `high`, `xhigh`, `max` |

Standard für neue Browserprofile und API-Anfragen ohne Modellauswahl: `gpt-6-luna` mit Denktiefe `high`, auch bei eigener Installation. Eine ausdrücklich gewählte Alternative wird im jeweiligen Browser gespeichert. Mehr Denktiefe kann Wartezeit und Kosten erhöhen. Modellzugang hängt vom OpenAI-Projekt ab. Die verfügbaren API-Werte sind in der Oberfläche abgebildet; Codex-spezifische Einstellungen werden nicht als API-Funktionen ausgegeben.

## Daten und Betrieb

Dies ist ein lokal betriebener Einzelbenutzer-Arbeitsraum. Dokumenttexte, PDF-Originale, Playbooks und Analysen werden in einer lokalen SQLite-Datenbank gespeichert. Keine integrierte Anmeldung, Mandantentrennung oder Verschlüsselung der Datenbank. Der Entwicklungsserver bindet standardmäßig an die Loopback-Adresse.

Eingefügter Text wird mit der abgeschlossenen Analyse als TXT-Quelle gespeichert und kann unter „Quellen“ heruntergeladen werden. PDF-Fundstellen öffnen das Original mit Seitenwahl, Zoom und Markierung eines eindeutig gefundenen Zitats. Frühere PDF-Uploads enthalten nur den ausgelesenen Text; das Original kann nachträglich hinzugefügt werden, wenn der Text übereinstimmt. Das Löschen eines Dokuments entfernt auch sein gespeichertes PDF-Original.

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
