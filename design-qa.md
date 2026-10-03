# Designprüfung

> Historisches Prüfprotokoll. Die hier beschriebenen Browser-, Motion- und Layouttests wurden am 3. Oktober 2026 entfernt. Aktueller Testumfang: [Prüfprotokoll](docs/validation.md).

## Ergebnis

final result: passed

Keine offenen P0-, P1- oder P2-Befunde. Geprüft wurde die Übertragung der sichtbaren ChatGPT-Gestaltung auf die bestehenden juristischen Arbeitsabläufe, kein Nachbau der ChatGPT-Funktionen.

## Referenzen und Browserbilder

Referenzbilder wurden vom Projektinhaber bereitgestellt und bleiben außerhalb des Repositories. Private Gesprächsinhalte werden nicht eingecheckt.

| Vergleich                           | Referenzdatei                                              | Implementierung                                         | Größe                                                          |
| ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| Einstellungen, dunkel, Seitenanfang | Dunkle Einstellungsansicht | `artifacts/settings-dark.png`                           | jeweils 1233 × 1017 px                                         |
| Einstellungen, hell, Seitenanfang   | Helle Einstellungsansicht | `artifacts/settings-light.png`                          | jeweils 1242 × 1061 px                                         |
| Denkaufwand, geöffnet               | Geöffneter Denkaufwandregler | `artifacts/effort-dark-detail.png`                      | Referenz 483 × 191 px, Popover 275 × 177 px                    |
| Monochrome Akzente und Karten       | Monochrome Arbeitsansicht | `artifacts/start-dark.png`, `artifacts/review-dark.png` | verschiedene Arbeitsabläufe; Flächen und Hierarchie verglichen |

Die Implementierung wurde in Chromium bei Geräteskalierung 1 aufgenommen. Referenzpixel und CSS-Pixel wurden für den Vergleich 1:1 behandelt; die ursprüngliche Browser-Skalierung ist unbekannt. Es wurden keine Referenzbilder gestreckt.

Quelle und Ergebnis stehen gemeinsam in `artifacts/compare-settings-dark.png`, `artifacts/compare-settings-light.png` und `artifacts/compare-effort-dark.png`. Die Gesamtansichten prüfen Aufbau und Dichte; der separate Reglervergleich prüft Menüfläche, Schrift, Radius, Spur und Auswahl. Der zusätzliche Kostenhinweis erklärt die größere Popover-Höhe. Der monochrome Regler folgt der letzten Referenz statt deren blauer Variante.

Zusätzliche gerenderte Zustände: neue Analyse, Befunde mit Quelle, Formulierungsvorschläge und Mobileinstieg in beiden Themes; Einstellungen und Menüs; Dialoge, Dokumentauswahl, leerer und befüllter Zustand über die bestehenden Browserabläufe. `artifacts/mobile-dark.png` und `artifacts/mobile-light.png` zeigen 390 × 844 px. Die Produktionsfassung wurde außerdem im eingebetteten Browser bei 563 px Breite geöffnet und bedient.

## Vergleich und Korrekturen

1. **P2 – unruhiger Umbruch der Prüfungsarten.** Vier lange Aktionen und eine einzelne zweite Zeile bei 768 px Inhaltsbreite. Sichtbare Bezeichnungen auf Vertrag, Vergleich, Chronologie, Datenschutz und Werbung gekürzt. Der Aktionswortlaut bleibt als Tooltip verfügbar. Nachprüfung: `start-dark.png`, `start-light.png`, beide Mobilbilder.
2. **P2 – übergroße Modusauswahl.** Drei separate Karten statt einer kompakten Einstellungszeile. Durch eine gemeinsame Kontur, Modus links und native Auswahl rechts ersetzt. Nachprüfung: beide Einstellungenbilder und kombinierte Vergleiche.
3. **P2 – doppelte Fundstelle.** Wiederholte Angabe entfernt. Die Kontextaktion bleibt vor dem aufklappbaren Inhalt, damit sie beim Öffnen und Schließen an derselben Position steht. Nachprüfung: Befundbilder und Positionsmessung in `tests/stability.spec.ts`.
4. **P2 – Popover bei mittlerer Breite abgeschnitten.** Im eingebetteten Browser bei 563 px stand der Regler links außerhalb des Inhalts. Menüs bis 900 px links am Auslöserbereich ausgerichtet. Anschließend im selben Browser erneut geöffnet: gesamter Regler und Hinweis sichtbar. Browserprüfungen verlangen vollständig sichtbare Modell- und Denkaufwand-Menüs bei 320, 390, 568, 768 und 1024 px, jeweils dunkel und hell.

Zwischenstände mit diesen Befunden waren nicht freigegeben. Nach den Korrekturen wurden die betroffenen Ansichten erneut gerendert und angesehen. Eine weitere unabhängige visuelle Prüfung der Mobil-, Einstellungs-, Regler- und Befundbilder fand keine weiteren P0/P1/P2-Abweichungen.

## Geprüfte Gestaltungsflächen

| Bereich             | Ergebnis                                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schrift             | Lokal geladene Inter, UI überwiegend 14 px, Lesetext 16 px, Überschriften 24–28 px. Originalschrift nicht aus den Bildern bestimmbar; keine Behauptung identischer Glyphen.                   |
| Abstände und Aufbau | Einzelne 288-px-Navigation, 768-px-Formulare, breitere Befundansicht, 26-px-Composer, 16-px-Menüs. Eigenständige App-Leiste und Profil werden mangels Funktionen nicht kopiert.               |
| Farben              | Gemessene neutrale Grundflächen und Abstufungen, monochrome Aktionen/Fokusringe. Alle Komponentenfarben kommen aus Theme-Tokens. Semantische Befund- und Änderungsfarben bleiben erhalten.    |
| Bilder und Icons    | Keine dekorativen Rasterbilder nötig. Vorhandene Produktmarke und Lucide-Linienicons bleiben scharf; keine kopierten ChatGPT-Logos, Avatare oder Gesprächsbilder.                             |
| Texte               | Funktionale Bezeichnungen, präzise Zustände und handlungsbezogene Hinweise. Keine neuen Slogans, Werbetexte oder künstlichen Profilinhalte.                                                   |
| Bedienung           | Upload, Vergleichsreihenfolge, Bibliothek, Playbooks, Quelle, Export, Modellwechsel, Regler, Theme-Auswahl und Navigation erhalten.                                                           |
| Barrierefreiheit    | axe WCAG 2 A/AA und 2.1 AA für geprüfte Ansichten; Kontrast erst nach abgeschlossener Einblendung. Tastaturregler, native Theme-Radios, Fokusführung, Escape und reduzierte Bewegung geprüft. |

## Technische Prüfung

- Produktionsbuild und TypeScript erfolgreich.
- Browserprüfungen umfassen Theme-Persistenz, Systemwechsel, gesperrten Browser-Speicher, schmale Menüs, unterbrochene Übergänge und Positionsmessungen über mehrere Frames. Aktueller Prüfumfang unten.
- Produktions-Smoke-Test über FastAPI erfolgreich: lokale Assets, CSP und Export.
- 43 API-Tests erfolgreich. Keine echten OpenAI-Anfragen; Testschlüssel leer.
- Keine Konsolenfehler in der geprüften Produktionsansicht des eingebetteten Browsers.
- Formatprüfung und `git diff --check` erfolgreich.

## Bewusste Unterschiede und Grenzen

- Die juristische Eingabe bleibt mehrzeilig; eine Chatzeile würde Dokumente und Prüfauftrag verdecken.
- Ein zentraler Theme-Schalter mit Beschriftungen ersetzt die kleinen Vorschaubilder. Keine Akzentpalette oder erfundene ChatGPT-Funktion ergänzt.
- Hinweise zur Einrichtung und Datenübermittlung gehören zu diesem Produkt und unterscheiden den Seiteninhalt von ChatGPT.
- Statische Vorlagen belegen keine originalen Animationszeiten. Die eigenen Federparameter sind in `design.md` dokumentiert; sie werden nicht als ausgelesene ChatGPT-Physik ausgegeben.
- Firefox, Safari, reale mobile Geräte und echte Modellantworten wurden nicht in diesem Durchgang geprüft.

## Abschluss

- [x] Korrekturen umgesetzt und erneut visuell geprüft.
- [x] Helle und dunkle Darstellung sowie relevante Breiten geprüft.
- [x] Gestaltungsregeln in `design.md` dokumentiert und in `AGENTS.md` verankert.
- [x] Referenzbilder und private Inhalte außerhalb des Repositories belassen.

## Layoutstabilität · 3. Oktober 2026

Drei Subagents bearbeiteten Composer und Dokumente, Befunde sowie Overlays. Die gemeinsame Integration vereinheitlicht das Seitenraster und entfernt Positions- und Größenanimationen von Bedienflächen. Ein zusätzlicher unabhängiger Review fand den Suchsprung im Dokumentdialog.

### Reproduzierte Fehler

Die neuen Positionsprüfungen wurden zuerst gegen den unveränderten Produktionsbuild von `c252f0f` ausgeführt. Alle sieben damaligen Fälle schlugen an. Die vorhandenen Funktionstests hatten diese Fehler nicht erfasst.

| Ablauf | Gemessene Abweichung vor der Korrektur | Korrektur |
| --- | --- | --- |
| Button gedrückt halten | Breite änderte sich bereits im frühen Frame um 0,62 px | Deckkraft statt Skalierung |
| Neue Analyse → Playbooks | Überschrift um 76 px horizontal versetzt | Gemeinsame Inhaltsbreite und Seitenabstände |
| Prüfungsart wechseln | Eingabefeld um 31 px am Desktop, 52 px bei 390 px versetzt | Zusätzliche Optionen unter gemeinsamen Eingabebereich und Toolbar verschoben |
| Dokument auswählen | Angeklickte Checkbox um 18 px versetzt | Feste Statusfelder und Vergleichsplätze |
| Zweiten Befund öffnen | Dessen Überschrift bereits im frühen Frame um 3,91 px versetzt | Befunde unabhängig öffnen; vorherigen Befund oberhalb nicht automatisch schließen |
| Dokumentliste filtern | Nach der ersten Korrekturrunde weiterhin 41 px am Suchfeld bzw. 81 px am Footer | Ausgangshöhe der Liste behalten, auch ohne Treffer |

Die Werte zeigen konkrete Fehler in den Testabläufen, keine gemessenen Maxima über die gesamte Oberfläche.

### Geprüfte Abläufe

`tests/stability.spec.ts` enthält acht Fälle. Unveränderte Bedienflächen dürfen höchstens 0,5 CSS-Pixel in Position oder Größe abweichen; animierte Abläufe werden über 18 aufeinanderfolgende Frames gemessen.

- Gedrückter Button, Dialogeintritt, Dialogschließen und Fokuswiederherstellung.
- Gemeinsamer Ursprung der Überschriften für Neue Analyse, Analysen, Playbooks und Einstellungen, einschließlich wechselnder Scrollhöhe.
- Prüfungsarten, Modellwahl und Denkaufwand bei 390, 768 und 1280 px; kein horizontaler Überlauf.
- Dokumentauswahl, Filter mit Treffern, leere Suche und Zurücksetzen bei 390 × 844 und 320 × 620 px. Suchfeld, Dialog und Footer behalten ihre Geometrie.
- Zweiter Befund, Quellenkontext und wechselnder Prüfstatus; der jeweils angeklickte Auslöser bleibt stehen.

Prüfoptionen zusätzlich: Playbook-Dropdown und Webrecherche-Aktion sind auf derselben Bedienzeile ausgerichtet. Öffnen der Optionen und Umschalten der Checkbox bewegen den bestehenden Eingabebereich nicht. Browserbilder: `artifacts/options-1280.png`, `artifacts/options-768.png`, `artifacts/options-390.png`.

Wechselnde Beschriftungen reservieren ihre längste Variante. Ladeindikatoren ersetzen vorhandene Icons im selben Platz. Scrollbereiche reservieren Scrollleistenbreite. Seiten, Dialoge und Menüs blenden nur ein; Auswahlflächen wechseln ohne Fahrt. Zusätzlicher Inhalt erscheint sofort unter dem Auslöser. Die mobile Navigation behält ihren räumlichen Drawer-Übergang.

Die bestehenden Prüfungen für schnelle Menüwechsel, wiederholtes Öffnen von Dialogen, Fokusführung, Dokumententfernung und live geänderte Bewegungspräferenzen bleiben erhalten. Dialoge liegen außerhalb des App-Inhalts und sperren den Hintergrund. Ausblendende Overlays werden sofort inert. Entfernte Inhalte im Dokumentfluss verschwinden unmittelbar.

Grenzen: Chromium, synthetische Daten und lokale Beispiele; keine echten OpenAI-Anfragen. Keine geräteübergreifende Framerate-Messung. Die Tests belegen die genannten Abläufe und ersetzen keine Prüfung künftiger UI-Erweiterungen.

### Abschlussprüfung

- 24 Browserfälle bestanden, darunter acht Tests der Layoutstabilität.
- 43 Offline-API-Tests bestanden; SDK-Anfragen über MockTransport verwenden Luna/High.
- TypeScript, Produktionsbuild, Produktions-Smoke-Test, Ruff, Formatprüfung und Diff-Prüfung bestanden.
- Standard Luna/Hoch in Frontend und Backend; die Auswahl im vorhandenen Browser wurde ebenfalls umgestellt.
- Die lokalen Windows-Sandbox-Probleme mit `uv` und AsyncIO wurden durch direkten Aufruf der vorhandenen Python-Umgebung und Ausführung der betroffenen Tests außerhalb der Sandbox umgangen. Keine Produktänderung für diese Einschränkung.
