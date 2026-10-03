# Designprüfung

## Ergebnis

final result: passed

Keine offenen P0-, P1- oder P2-Befunde. Geprüft wurde die Übertragung der sichtbaren ChatGPT-Gestaltung auf die bestehenden juristischen Arbeitsabläufe, kein Nachbau der ChatGPT-Funktionen.

## Referenzen und Browserbilder

Referenzdateien liegen unter `C:/Users/Marlon/AppData/Local/Temp/`. Die Bilder und privaten Gesprächsinhalte werden nicht eingecheckt.

| Vergleich                           | Referenzdatei                                              | Implementierung                                         | Größe                                                          |
| ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| Einstellungen, dunkel, Seitenanfang | `codex-clipboard-fd6acb4e-43cf-408a-baa3-6ad45a123b2a.png` | `artifacts/settings-dark.png`                           | jeweils 1233 × 1017 px                                         |
| Einstellungen, hell, Seitenanfang   | `codex-clipboard-d728ca19-ce3e-4b41-a728-c1e62b42d1d2.png` | `artifacts/settings-light.png`                          | jeweils 1242 × 1061 px                                         |
| Denkaufwand, geöffnet               | `codex-clipboard-73f69650-2e12-4913-9a5c-f1b65ba289cb.png` | `artifacts/effort-dark-detail.png`                      | Referenz 483 × 191 px, Popover 275 × 177 px                    |
| Monochrome Akzente und Karten       | `codex-clipboard-01af327a-848d-4640-baf1-6ee29f68e107.png` | `artifacts/start-dark.png`, `artifacts/review-dark.png` | verschiedene Arbeitsabläufe; Flächen und Hierarchie verglichen |

Die Implementierung wurde in Chromium bei Geräteskalierung 1 aufgenommen. Referenzpixel und CSS-Pixel wurden für den Vergleich 1:1 behandelt; die ursprüngliche Browser-Skalierung ist unbekannt. Es wurden keine Referenzbilder gestreckt.

Quelle und Ergebnis stehen gemeinsam in `artifacts/compare-settings-dark.png`, `artifacts/compare-settings-light.png` und `artifacts/compare-effort-dark.png`. Die Gesamtansichten prüfen Aufbau und Dichte; der separate Reglervergleich prüft Menüfläche, Schrift, Radius, Spur und Auswahl. Der zusätzliche Kostenhinweis erklärt die größere Popover-Höhe. Der monochrome Regler folgt der letzten Referenz statt deren blauer Variante.

Zusätzliche gerenderte Zustände: neue Analyse, Befunde mit Quelle, Formulierungsvorschläge und Mobileinstieg in beiden Themes; Einstellungen und Menüs; Dialoge, Dokumentauswahl, leerer und befüllter Zustand über die bestehenden Browserabläufe. `artifacts/mobile-dark.png` und `artifacts/mobile-light.png` zeigen 390 × 844 px. Die Produktionsfassung wurde außerdem im eingebetteten Browser bei 563 px Breite geöffnet und bedient.

## Vergleich und Korrekturen

1. **P2 – unruhiger Umbruch der Prüfungsarten.** Vier lange Aktionen und eine einzelne zweite Zeile bei 768 px Inhaltsbreite. Sichtbare Bezeichnungen auf Vertrag, Vergleich, Chronologie, Datenschutz und Werbung gekürzt. Der Aktionswortlaut bleibt als Tooltip verfügbar. Nachprüfung: `start-dark.png`, `start-light.png`, beide Mobilbilder.
2. **P2 – übergroße Modusauswahl.** Drei separate Karten statt einer kompakten Einstellungszeile. Durch eine gemeinsame Kontur, Modus links und native Auswahl rechts ersetzt. Nachprüfung: beide Einstellungenbilder und kombinierte Vergleiche.
3. **P2 – Zitat unnötig weit unten.** Fundstelle doppelt und Kontextaktion vor dem Zitat. Wiederholung entfernt, Aktion darunter platziert. Nachprüfung: `review-dark.png` und `review-light.png`; Zitat und Kontext bleiben erreichbar.
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
- 16 Browser-Testfälle erfolgreich, einschließlich Theme-Persistenz, Systemwechsel, gesperrtem Browser-Speicher, schmalen Menüs und unterbrochenen Übergängen.
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

## Motion-Überarbeitung · 3. Oktober 2026

Fünf Subagents bearbeiteten die gemeinsame Physik, Navigation, Composer, Befunde und Overlays. Die Integration verwendet eine gemeinsame Motion-Basis und die vorhandene `motion/react`-Abhängigkeit.

| Prüfung | Nachweis |
| --- | --- |
| Auswahl und Positionswechsel | Navigation, Prüfungsarten, Tabs und Darstellung bewegen ihre Auswahlfläche; Dokumentchips animieren die Position. Beschriftungen und Texteingabe behalten ihre Größe. |
| Schnelle Unterbrechung | Neuer Browsertest öffnet und schließt Prüfoptionen mehrfach, kehrt eine Menüschließung um und wechselt direkt zum Regler. Nur aktuelle Bedienelemente bleiben erreichbar. |
| Dialoge | Neuer Browsertest schließt und öffnet denselben Dialog dreimal während des Nachlaufs, prüft Fokuswiederherstellung und zwölf Tab-Schritte. Bestehender Ablauf prüft Playbook-Vorschau → Bearbeiten → Speichern. |
| Reduzierte Bewegung | Neuer Browsertest wechselt die OS-Präferenz bei bereits geöffneter App und prüft acht aufeinanderfolgende Frames des Drawers. Keine Verschiebung oder Einblendung; Dialog und Fokus bleiben bedienbar. |
| Entfernte Dokumente | Bestehender Vergleichstest prüft zusätzlich Fokusübergabe an das verbleibende Dokument und danach an den Prüfauftrag. |
| Visuelle Kontrolle | Eingebetteter Browser: Regler und Playbook-Dialog auf Desktop, Drawer-Eintritt und Endzustand bei 390 × 844 px. Aktuelle Browserbilder für helle Einstellungen und dunkle Befunde geprüft. |
| Regressionen | Build, 43 API-Tests, 16 Browser-Tests und Produktions-Smoke-Test erfolgreich. Keine echten OpenAI-Anfragen. |

Dialoge werden außerhalb des App-Inhalts gerendert, damit Seitenbewegung ihre Position nicht verschiebt. Offene Dialoge sperren den Hintergrund. Ausblendende Dialoge, Chips, Menüs und Befunddetails werden sofort inert; die sichtbare Ausblendung verlängert ihre Bedienbarkeit nicht.

Die Prüfung bestätigt Verhalten und sichtbare Zustände in Chromium. Ein geräteübergreifender Framerate-Benchmark wurde nicht durchgeführt.
