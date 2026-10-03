<img src="frontend/public/favicon.svg" width="48" height="48" alt="">

# LegalThink

Lokale Anwendung für Vertragsprüfung, Versionsvergleich, Chronologie, Datenschutz- und Werbeprüfung. Ergebnisse enthalten Fundstellen und Formulierungsvorschläge; Export als Word oder Markdown.

React und TypeScript im Browser. FastAPI, SQLite und die OpenAI Responses API im Python-Backend. Keine API-Schlüssel im Frontend.

[Lokal starten](#lokal-starten) · [Werkzeuge](#werkzeuge) · [Daten und Betrieb](#daten-und-betrieb) · [Architektur](docs/architecture.md) · [Mitwirken](CONTRIBUTING.md)

## Lokal starten

Voraussetzungen: Node.js 22.12+, [uv](https://docs.astral.sh/uv/getting-started/installation/) und Python 3.12+. `uv` kann Python bei Bedarf installieren.

```sh
git clone https://github.com/marlonka/legalthink.git
cd legalthink
npm ci
npm --prefix frontend ci
uv sync --project backend --extra dev
npm run dev
```

Öffnen: [localhost:5175](http://localhost:5175). **Beispiel öffnen** zeigt einen fiktiven Fall zur gewählten Prüfungsart ohne API-Aufruf. Datenschutz bietet eigene Beispiele für Allgemein, AVV und DSFA.

## Eigene Dokumente analysieren

Kopieren Sie `backend/.env.example` nach `backend/.env`. Tragen Sie Ihren OpenAI-Projektschlüssel ausschließlich dort als `OPENAI_API_KEY` ein. Starten Sie den Server neu. Die Datei ist von Git ausgeschlossen.

1. Arbeitsweise wählen und Dokumente hinzufügen: PDF mit Textebene, DOCX, TXT oder Markdown.
2. Zusätzlichen Kontext ergänzen, etwa E-Mails oder Gesprächsnotizen. Prüfauftrag bei Bedarf anpassen (maximal 10.000 Zeichen); optional ein Kanzlei-Playbook auswählen.
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

Weitere OpenAI-Modelle lassen sich unter **Einstellungen → Modell und Denkaufwand → Eigenes Modell hinzufügen** mit ihrer exakten Modell-ID ergänzen. Das Modell muss die Responses API und Structured Outputs unterstützen. Denkstufen und Websuche werden ausdrücklich nach den dokumentierten Fähigkeiten konfiguriert; „Modellstandard“ übermittelt keine Denkstufe. Hinzufügen löst keinen API-Aufruf aus, prüft keinen Modellzugang und ändert die aktuelle Auswahl nicht. Eigene Modelle bleiben im jeweiligen Browser gespeichert.

## API-Region und Flex

Die Einstellungen zeigen die gewählte API-Region. Ohne eigene Browserauswahl gilt die Servervorgabe: `OPENAI_PROCESSING_REGION=global` verwendet `api.openai.com`; `eu` verwendet `eu.api.openai.com`. Für eine geeignete EU-Konfiguration setzen Sie `OPENAI_PROCESSING_REGION=eu` in `backend/.env` und starten den Server neu. Neue Browserprofile und API-Anfragen ohne Regionsauswahl übernehmen diese Vorgabe. Global bleibt der Standard ohne diese Konfiguration.

Die Auswahl legt den Endpoint fest; sie prüft keine Projektfreigabe. Bei Fehlern erfolgt kein automatischer Wechsel auf Global. Aktuelle Regionen, Voraussetzungen und Datenkontrollen: [OpenAI: Data controls](https://developers.openai.com/api/docs/guides/your-data).

**Standard/Flex** und die Verarbeitungsregion sind in „Erweiterte Einstellungen“ direkt unter der Analyse-Werkzeugleiste wählbar. Das Playbook steht links neben der Webrecherche. Flex-Anfragen dürfen in dieser App bis zu 15 Minuten laufen; es gibt keinen automatischen erneuten Aufruf mit Standard. Informationen zu Verfügbarkeit, Verarbeitung und Preisen bleiben bei OpenAI: [Flex processing](https://developers.openai.com/api/docs/guides/flex-processing), [Preise](https://developers.openai.com/api/docs/pricing).

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

## Nutzung, Verantwortung und Lizenz

Betreiber verantworten ihre Installation, OpenAI-Konfiguration, Datenübermittlung und Verwendung der Ergebnisse. Vor dem Übermitteln von Mandatsdaten sind Berechtigung zur Weitergabe, anwaltliche Verschwiegenheit, Datenschutz und erforderliche Verträge zu prüfen. Nur erforderliche Inhalte übermitteln; Quellen, Rechtslage und Fristen vor Verwendung der Ergebnisse selbst prüfen. Zugriffsschutz, Datensicherung und Löschung bleiben Aufgaben des Betreibers. Diese Hinweise lassen gesetzliche Rechte und Haftung unberührt.

Das Projekt ist unabhängig von OpenAI. OpenAI-Verträge und API-Datenkontrollen gelten gesondert: [Vertragsbedingungen](https://openai.com/policies/services-agreement/), [Datenverarbeitung](https://developers.openai.com/api/docs/guides/your-data).

Der eigene Projektcode steht unter der [MIT-Lizenz](LICENSE), Copyright © 2026 Marlon Kaulich. Bibliotheken und Fonts behalten ihre eigenen Lizenzen; der Frontend-Build liefert die vollständigen Hinweise unter `/third-party-licenses.txt` aus. Bei Weitergabe einer Python-Installation müssen auch deren Paketlizenzen erhalten bleiben.

Befunde zu Namensrechten, Lizenzbestand und Datenverarbeitung: [rechtliche Bestandsaufnahme](docs/legal-review.md).

Die [Namensvorprüfung](docs/name-check.md) dokumentiert Registerabfragen und gleichnamige Rechtsanbieter. Sie bestätigt keine Markenfreiheit.

## Qualität prüfen

```sh
npm run build
npm run test:api
npx playwright install chromium
npm run test:built
```

Die automatisierten Tests verwenden lokale, synthetische Daten und simulierte Providerantworten. Sie lösen keine echten OpenAI-Anfragen aus. Echte Modellqualität, Projektzugriff, Kosten und Latenz müssen anschließend mit freigegebenen Testdaten bewertet werden.

`test:built` prüft die gebaute Oberfläche direkt über FastAPI, einschließlich Sicherheitsrichtlinie und Export. [Prüfprotokoll](docs/validation.md).

[Lighthouse-Messung](docs/performance.md): Performance 97 mobil / 100 Desktop, Best Practices 100 und CLS 0 in den beschriebenen lokalen Abschlussläufen.

## Mitwirken

Fehlerberichte brauchen reproduzierbare Schritte und synthetische Beispieldaten. Keine Mandatsunterlagen, Zugangsdaten oder ungekürzten Providerantworten in Issues und Pull Requests veröffentlichen. Einrichtung, Prüfungen und Beitragsumfang: [CONTRIBUTING.md](CONTRIBUTING.md).

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

Die frühere Gemini-Anwendung diente als Funktionsreferenz. LegalThink wurde neu implementiert. Designreferenz: [OpenAI UI Skills](https://github.com/ihlamury/design-skills/blob/main/skills/openai/SKILL.md), mit Anpassungen für nutzbare Eingaben, Kontrast und responsive Dokumentarbeit.
