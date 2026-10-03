# Fachliche Prüfung der Analyseanweisungen

Stand: 3. Oktober 2026. Geprüft wurden Prompts, Ergebnisschema, synthetische Beispiele und Export aus den Perspektiven Vertragsrecht, Zivilprozess, Datenschutz und deutsches Wettbewerbsrecht. Die Notiz dokumentiert Code- und Quellenprüfung; sie bewertet keine realen Modellantworten.

## Befunde und Korrekturen in `legal-review-v4`

| Bereich | Befund und umgesetzte Präzisierung |
| --- | --- |
| Vertrag | Rollen und Mandantenperspektive müssen durch Auftrag oder Unterlagen getragen sein. Regelungsinhalt, Rechtsrisiko, Verhandlungsinteresse und fehlende Angaben werden getrennt. Ersatztexte passen zum Quellzitat; unbetroffene Regelungen und belegte Parameter bleiben erhalten. Fehlende Klauseln erhalten kein erfundenes Zitat. |
| AGB im Geschäftsverkehr | Unternehmerstatus bedeutet nicht, dass jede AGB-Kontrolle entfällt. Die Anwendbarkeit wird anhand der Vertragsparteien, AGB-Eigenschaft und § 310 BGB geprüft; Klauselverbote werden nicht pauschal auf B2B übertragen. Individualabreden bleiben gesondert zu prüfen. |
| Versionsvergleich | Änderungen, Ergänzungen und Streichungen werden unterschieden; eine mögliche Verschiebung an eine andere Textstelle wird geprüft. Bei einer Streichung stammt der Beleg aus dem Original. Eine empfohlene Wiederaufnahme wird nicht als Ersatz des Originalzitats ausgegeben. Vorher/Nachher und Auswirkungen bleiben nachvollziehbar; Absichten der Gegenseite werden nicht unterstellt. |
| Chronologie | Eine dokumentierte Behauptung wird nicht automatisch zur bewiesenen Tatsache. Absender, Ereigniszeit und Belegdatum bleiben unterscheidbar; belegte Gegenangaben und offene Widersprüche werden berücksichtigt. Fristen werden ohne notwendige Voraussetzungen nicht verbindlich berechnet. |
| AVV | Die Mandantenrolle bleibt offen, bis sie feststeht. Ergänzt wurden ausdrücklich Art und Zweck der Verarbeitung, Rechte und Pflichten des Verantwortlichen, Vertraulichkeit, Drittlandweisungen und der Umgang mit rechtswidrigen Weisungen. Verhandlungsinteressen ändern zwingende Pflichten nicht. |
| DSFA | Pflichtprüfung und Vorbereitung der Folgenabschätzung werden getrennt. Maßgeblich sind Sachverhalt, Art. 35 DSGVO und die einschlägige Behördenliste. Geplante Wirkung, Umsetzung und belegte Wirksamkeit werden unterschieden; Datenschutzbeauftragter und gegebenenfalls vorherige Konsultation sind zu berücksichtigen. Das Ergebnis ist kein abgeschlossener DSFA-Bericht. |
| Werbung | Veröffentlichungszeitpunkt, Zielgruppe, Produkt, Medium und Aussageumfang bestimmen die Prüfung. Fehlende vorgelegte Nachweise sind kein automatischer Beweis der Unwahrheit. Besondere Verbote für Umweltwerbung werden neben der allgemeinen Irreführungsprüfung berücksichtigt; zusätzliche Nachweise machen nicht jede Aussage zulässig. |
| Export | Verfügbare Quelldateinamen werden bei den Befunden ausgegeben. Ohne Ersatztext entfällt ein leerer Formulierungsvorschlag. Nachverfolgte Änderungen bleiben Vorschläge im Prüfvermerk, keine Änderungen am Originalvertrag. |
| Prompt und Cache | Statische Entwicklerregeln stehen vor den Nutzdaten. Cache-Schreib-Tokens werden zusätzlich zu Eingabe-, Ausgabe- und Cache-Lese-Tokens erfasst. Die Metrik ermöglicht spätere Messung; sie belegt noch keine Ersparnis. |

Umsetzung: [Prompts](../backend/app/prompts.py), [Anfrageaufbau](../backend/app/analysis.py), [Schema](../backend/app/schemas.py), [Export](../backend/app/export.py). Im Vergleich entfernt der Server Ersatztexte, die nicht dem Gegenentwurf zugeordnet sind; ein Originalbeleg erzeugt dadurch keine irreführende Revision des Gegenentwurfs. Das vorhandene Ergebnisschema und die Bedienoberfläche reichen für die fachlichen Präzisierungen aus.

## Rechtliche Primärquellen

- AGB: [§ 305 BGB](https://www.gesetze-im-internet.de/bgb/__305.html) betrifft insbesondere vorformulierte und im Einzelnen ausgehandelte Bedingungen; [§ 310 BGB](https://www.gesetze-im-internet.de/bgb/__310.html) regelt Unterschiede im Unternehmerverkehr; [§ 305b BGB](https://www.gesetze-im-internet.de/bgb/__305b.html) den Vorrang individueller Vertragsabreden.
- Zivilprozess: [§ 138 ZPO](https://www.gesetze-im-internet.de/zpo/__138.html) betrifft Parteivortrag und Bestreiten, [§ 286 ZPO](https://www.gesetze-im-internet.de/zpo/__286.html) die Beweiswürdigung. Fristbeginn und Berechnung richten sich unter anderem nach [§ 221](https://www.gesetze-im-internet.de/zpo/__221.html) und [§ 222 ZPO](https://www.gesetze-im-internet.de/zpo/__222.html). Die hier gewählte UI ist eine Produktentscheidung, keine gesetzliche Vorgabe.
- Datenschutz: [DSGVO, Art. 28 sowie 35–36](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:02016R0679-20160504) regelt AVV-Inhalte, DSFA und vorherige Konsultation. Die [DSK-Liste für den nichtöffentlichen Bereich](https://www.datenschutzkonferenz-online.de/media/ah/20181017_ah_DSK_DSFA_Muss-Liste_Version_1.1_Deutsch.pdf) ergänzt die allgemeine Pflichtprüfung; ihr Anwendungsbereich und die zuständige Aufsicht müssen zum Fall passen.
- Werbung: [§ 5 UWG](https://www.gesetze-im-internet.de/uwg_2004/__5.html) und der [UWG-Anhang, insbesondere Nr. 4a–4c](https://www.gesetze-im-internet.de/uwg_2004/UWG.pdf), enthalten unterschiedliche Anforderungen und Verbote. Maßgeblich ist die für den geprüften Veröffentlichungszeitpunkt geltende Fassung.

## Verbleibende Grenze bei Webrecherche

Recherche ist standardmäßig ausgeschaltet. Der ausdrückliche Schalter und die UI-Warnung weisen darauf hin, dass Suchanfragen Dokumentinhalte enthalten können. Bei aktivierter Recherche erhält derselbe Modellaufruf Dokumente und Suchwerkzeug. Datenminimierung in Suchanfragen wird per Prompt angewiesen, nicht technisch erzwungen. Eine Beschränkung auf amtliche Suchziele trennt den vertraulichen Kontext nicht vom Suchwerkzeug.

Eine getrennte Recherche mit begrenztem Kontext wäre eine weitere Architekturentscheidung. Automatisch erzeugte „anonyme“ Fragen garantieren ebenfalls keine Geheimhaltung: Details können erhalten bleiben oder Rückschlüsse ermöglichen. Statische Rechtsfragen verringern die Fallspezifität. In dieser Änderung wurde keine zusätzliche kostenpflichtige Recherchephase gebaut.

Für einen Kanzleieinsatz sind insbesondere Erforderlichkeit der Offenlegung, Dienstleisterauswahl, Verschwiegenheit, weitere Dienstleister und gegebenenfalls Auslandsbezug anhand der konkreten Einsatzkonfiguration zu prüfen: [§ 43e BRAO](https://www.gesetze-im-internet.de/brao/__43e.html), [§ 203 StGB](https://www.gesetze-im-internet.de/stgb/__203.html). Daraus folgt weder eine Compliancegarantie dieser Anwendung noch ein pauschales Unzulässigkeitsurteil über den Einsatz externer Dienste. Datenschutzrechtliche Anforderungen bleiben eigenständig zu prüfen.

## Aussagekraft der Prüfung

Keine echten OpenAI-Aufrufe im Rahmen dieser Prüfung. Synthetische Beispiele und Offline-Tests können Anwendungseigenschaften prüfen, aber keine juristische Modellqualität, echte Rechercheleistung, Cachetreffer, Kostenersparnis oder Latenz belegen. Eine bestätigte Textfundstelle bestätigt nur den Wortlaut, nicht Tatsachenwahrheit oder rechtliche Richtigkeit. Quellen-URLs belegen ebenfalls nicht automatisch die Schlussfolgerung eines Befunds.

Technische Einzelheiten und offene Live-Prüfung: [OpenAI-Integration](openai-integration.md). Ausgeführte Prüfungen und deren Umfang: [Prüfprotokoll](validation.md).
