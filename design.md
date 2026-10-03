# LegalThinkGPT – Gestaltung

## Grundlage und Geltungsbereich

Grundlage sind die 13 vom Nutzer bereitgestellten Referenz-Screenshots: dunkle und helle Oberfläche, Navigation, Dokumentkarten, Eingabe, Menüs, Denkaufwand und Darstellungseinstellungen. Die Referenzen bleiben außerhalb des Repositories. Private Gesprächsinhalte, Namen und Verlaufstitel werden nicht übernommen.

Die Screenshots zeigen die visuelle Richtung. LegalThinkGPT behält seine vorhandenen Arbeitsabläufe: Dokumente auswählen, Prüfauftrag eingeben, Analyse starten, Befunde und Zitate prüfen, Berichte exportieren und Playbooks verwalten.

### Was die Referenzen belegen

- Dunkle Flächen sind neutral und nahezu schwarz. Karten und Menüs heben sich durch geringe Helligkeitsunterschiede ab.
- Eine schmale schwarze App-Leiste und eine breitere Inhaltsnavigation stehen links. Inhalt und Eingabe bilden eine gemeinsame, begrenzte Spalte.
- Normale Navigationseinträge haben keine eigene Karte. Auswahl und Hover füllen die ganze Zeile mit einer dezenten Fläche.
- Text ist linksbündig. Überschriften bleiben im Maßstab der Anwendung. Icons sind kleine, schlichte Linienzeichen.
- Der Composer ist stark gerundet. Hinzufügen, Denkaufwand und Senden liegen in seiner Bedienzeile.
- Menüs verwenden volle, gut anklickbare Zeilen. Zusatzinformationen sind dem Aktionsnamen untergeordnet.
- Einstellungen verwenden beschriftete Gruppen, zeilenweise angeordnete Werte und dünne Trennlinien.
- Die helle Darstellung nennt in den sichtbaren Einstellungen `#FCFCFC` als Hintergrund und `#0D0D0D` als Vordergrund.
- Blau ist in mehreren Bildern als Akzent sichtbar. Die letzte Referenz zeigt die Bedienung monochrom. Blau ist deshalb keine feste Markenfarbe für LegalThinkGPT.

### Was aus Screenshots nicht feststeht

Schriftfamilie, CSS-Maße, Breakpoints, Hover-Verhalten, Fokusführung und Animationsparameter lassen sich daraus nicht zuverlässig bestimmen. Die folgenden Maße sind umsetzbare Festlegungen für LegalThinkGPT. Sie sind keine Behauptung über den Originalcode von der Referenz.

### Gemessene Bildwerte

Die Pixel wurden mit `System.Drawing.GetPixel` in einem Raster von 4 px abgetastet. Die Werte beschreiben die gelieferten Bilddateien; sie beweisen keine identischen CSS-Werte im Original.

| Referenz                                             | Gemessene, wiederkehrende Bildwerte                                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dunkle Vollansichten, 1260 × 1301 und 1272 × 1295 px | Hauptfläche `#0E0E0E`, Karte `#1E1E1E`, äußere Leiste `#000000`, Composer `#212121`, Kontur `#323232`, Zeilenauswahl `#262626`, heller Text `#EDEDED` |
| Letzte dunkle Vollansicht                            | Monochrome Nachrichtenfläche `#2D2D2D`                                                                                                                |
| Helle Einstellungen, 1242 × 1061 px                  | Hauptfläche `#FCFCFC`, äußere Leiste `#F9F9F9`, Zeilenauswahl `#EFEFEF`, Kontur `#E2E2E2`, Text `#0D0D0D`                                             |
| Denkaufwand, 483 × 191 px                            | Popover `#303030`, Wertanzeige `#383838`, inaktive Spur `#454545`, blauer Akzent `#3A83F7`                                                            |

Die in den hellen Einstellungen eingeblendeten Farbwerte bestätigen Hintergrund und Vordergrund. Die dunkle Hauptfläche wird entsprechend den Bildpixeln auf `#0E0E0E` festgelegt. Der monochrome Akzent folgt der letzten Referenz.

## Flächen und Farben

Monochrome Bedienoberfläche. Farbe bleibt für Zustände und die Priorität eines Befunds reserviert. Keine grünen Markenflächen, farbigen Verläufe oder dekorativen Leuchteffekte.

| Rolle                | Dunkel    | Hell      |
| -------------------- | --------- | --------- |
| Hauptfläche          | `#0E0E0E` | `#FCFCFC` |
| Navigation           | `#0E0E0E` | `#FCFCFC` |
| Haupttext            | `#EDEDED` | `#0D0D0D` |
| Nebeninformationen   | `#B4B4B4` | `#535353` |
| Karte                | `#1E1E1E` | `#FFFFFF` |
| Composer             | `#212121` | `#FFFFFF` |
| Menü oder Popover    | `#303030` | `#FFFFFF` |
| Hover                | `#262626` | `#EFEFEF` |
| Trennlinie           | `#323232` | `#E2E2E2` |
| Primäraktion: Fläche | `#FFFFFF` | `#0D0D0D` |
| Primäraktion: Text   | `#0D0D0D` | `#FFFFFF` |

Die Palette übernimmt gemessene Flächenwerte; Nebeninformationen und Primäraktionen sind daraus abgeleitete Implementierungswerte. Transparenz darf Text nicht unlesbar machen. Kontrast wird am gerenderten Ergebnis geprüft: mindestens 4,5:1 für normalen Text und 3:1 für große Schrift sowie relevante Bedienelemente. Rahmen zur rein dekorativen Trennung müssen nicht künstlich verstärkt werden.

Die einzelne LegalThinkGPT-Navigation übernimmt die Hauptnavigation der Referenz. Schwarz beziehungsweise `#F9F9F9` gehören zur dortigen äußeren App-Leiste, die hier entfällt.

### Darstellung wählen

Dunkel ist die Voreinstellung. In den Einstellungen stehen „Hell“, „Dunkel“ und „System“ zur Wahl. Die Auswahl bleibt im Browser gespeichert. „System“ folgt auch Änderungen der Betriebssystemdarstellung während einer geöffneten Sitzung. Ohne verfügbaren Browserspeicher bleibt die aktuelle Sitzung bedienbar; die Auswahl kann dann nach dem Neuladen zurückfallen.

Das gewählte Erscheinungsbild gilt bereits beim ersten Rendern, damit kein heller Zwischenzustand vor einer dunklen Seite erscheint. Die statischen Referenzen belegen weder die Originalimplementierung dieser Umschaltung noch Schriftfamilie und Übergangsdauer.

Priorität wird durch Text und ein kleines Farbsignal vermittelt. Ein roter Punkt allein erklärt keinen Befund. Verifiziertes Zitat und juristische Einschätzung erhalten keine gemeinsame Erfolgsfarbe.

## Aufbau und Abstände

### Desktop

- Eine echte Navigation für LegalThinkGPT. Die zusätzliche App-Leiste aus der Referenz wird nicht nachgebaut; ihre Funktionen existieren hier nicht.
- Zielbreite der Navigation: 288 px. Neue Analyse, Analysen, Playbooks und Einstellungen bleiben direkt erreichbar.
- Keine erfundenen Projekte, Nutzerprofile, Aktivitätszahlen oder Verlaufseinträge.
- Hauptinhalt mit 24–48 px seitlichem Abstand. Die sichtbare Breite bestimmt den Abstand, nicht ein großer fester Außenrand.
- Eingabe und einfache Einstellungsseiten: maximal 768 px Inhaltsbreite.
- Befundansicht: bis zu 1440 px. Befund und zugehöriger Dokumentausschnitt stehen nebeneinander, solange beide sinnvoll lesbar bleiben.
- Fließtext möglichst 60–85 Zeichen je Zeile. Lange Klauseln erhalten ausreichend Breite; Zeilen werden nicht zur Erzeugung leerer Flächen eingeengt.
- Navigation und Hauptinhalt können unabhängig scrollen. Fixierte Bedienelemente dürfen keine letzte Zeile verdecken.

In den großen Referenzen ist die äußere App-Leiste ungefähr 48 px breit, die anschließende Navigation ungefähr 288 px. Die Inhaltsspalte ist ungefähr 768 px breit. Das sind visuelle Näherungen aus den gelieferten Bildern, keine ausgelesenen CSS-Werte.

### Größenraster

| Eigenschaft                                    | Zielwert                                                 |
| ---------------------------------------------- | -------------------------------------------------------- |
| Grundraster                                    | 4 px                                                     |
| Zusammengehörige Elemente                      | 8–12 px Abstand                                          |
| Abstand zwischen Abschnitten                   | 24–32 px                                                 |
| Standard-Innenabstand                          | 16–24 px                                                 |
| Navigations- und Menüzeile                     | 36–44 px hoch                                            |
| Primäraktionen und Navigation auf Mobilgeräten | mindestens 44 px hoch                                    |
| Kleine Nebenaktionen auf Mobilgeräten          | mindestens 24 × 24 px, mit Abstand; möglichst 44 × 44 px |
| Zeilenradius                                   | 8–10 px                                                  |
| Kartenradius                                   | 24 px                                                    |
| Composer-Radius                                | 26 px                                                    |
| Menüradius                                     | 16 px                                                    |
| Dialogradius                                   | 24 px                                                    |
| Normale Trennlinie                             | 1 px                                                     |

Radien folgen der Größe des Elements. Kleine Schaltflächen werden nicht zu Miniaturkarten. Schatten helfen nur bei überlagernden Menüs und Dialogen; normale Inhaltsblöcke brauchen keinen Schatten.

## Typografie und Icons

- Die bereits lokal eingebundene Inter bleibt die Implementierungsschrift. Die Originalschrift der Referenz ist aus den Bildern nicht sicher bestimmbar.
- Fließtext und Texteingaben: 15–16 px, Zeilenhöhe 1,5–1,65.
- Navigation, Buttons und kompakte Feldwerte: 14 px, mindestens 20 px Zeilenhöhe.
- Ergänzende Metadaten: 12–13 px. Kein wesentlicher Zustand wird nur als kaum lesbare Kleinschrift dargestellt.
- Seitenüberschrift: 24–28 px, Gewicht 500. Keine riesige Hero-Schrift.
- Abschnittstitel: 16–18 px, Gewicht 500. Keine dekorativen Großbuchstaben oder Eyebrows.
- Gewichte 400, 500 und 600 reichen für die normale Hierarchie. Fett markiert Bedeutung, nicht ganze Absätze.
- Icons: vorhandene Lucide-Linienicons, meist 18–20 px, Strichstärke etwa 1,5–1,75. Nur eine Icon-Sprache.
- Icons ergänzen vorhandene Aktionen. Kein Symbol muss freien Platz füllen. Reine Icon-Buttons erhalten einen zugänglichen Namen und bei Bedarf einen Tooltip.

Das Markenzeichen ist ein gezeichnetes LT-Monogramm: ein aufrechtes L mit breitem Fuß und ein eingerücktes T. Beide Buchstaben bleiben durch einen durchgehenden Abstand getrennt. Auf dem 32er-Raster sind die Striche 6 Einheiten stark und die Abstände mindestens 3 Einheiten breit. Die gegenüberliegenden Außenecken sind gerundet. Das Zeichen bleibt einfarbig; L und T müssen auch bei 16 px lesbar sein. `BrandMark.tsx`, SVG-Download und Favicon verwenden dieselben zwei Pfade; die Oberfläche reserviert dafür 28 × 28 px.

## Navigation und Seiten

### Navigation

Logo als Identität, dann reale Funktionen. Aktuelle Seite durch Hintergrund und `aria-current` bzw. den bestehenden semantischen Auswahlzustand erkennbar machen. Hover, Tastaturfokus und Auswahl dürfen nicht identisch aussehen.

Lange Namen werden in der Navigation gekürzt; vollständige Namen bleiben im geöffneten Inhalt verfügbar. Löschaktionen erscheinen beim Hover und beim Tastaturfokus. Sie dürfen auf Touchgeräten nicht ausschließlich vom Hover abhängen.

### Neue Analyse

Der Prüfauftrag und seine Dokumente bilden den Schwerpunkt. Die Seite braucht keinen einleitenden Nutzenabsatz.

1. Prüfungsart wählen.
2. Dokumente hinzufügen, gespeicherte Dokumente auswählen oder Text einfügen.
3. Darunter den optionalen Prüfauftrag eingeben; Modell und Denkaufwand bleiben am Composer erreichbar.
4. Analyse starten.

Diese Reihenfolge beschreibt den Ablauf; sie wird nicht als erklärender Vier-Schritte-Text in die Oberfläche kopiert.

Der Composer darf höher werden, wenn Dokumente oder Optionen hinzukommen. Eingefügter Text scrollt innerhalb seines Feldes; Tippen verändert die Höhe nicht. Das Quellenfeld steht in allen Aufgaben über dem Prüfauftrag, ist anfangs 216 px hoch und lässt sich vertikal vergrößern. Dokumentnamen, Original/Gegenentwurf und Entfernen müssen in der Auswahl lesbar bleiben.

„Text oder E-Mail-Verlauf“ nimmt Quellenmaterial auf; „Prüfauftrag“ enthält die Arbeitsanweisung. Text allein genügt außer beim Versionsvergleich: Dort bleiben zwei Dokumente erforderlich, eingefügte Korrespondenz ergänzt sie. Ein gemeinsamer Zähler zeigt die Grenze von 1.000.000 Zeichen für Text und Dokumente. Zu lange Eingaben bleiben vollständig erhalten; der Start nennt die Überschreitung, statt Text still abzuschneiden.

Beide Texteingaben verwenden denselben sichtbaren Rahmen, Innenabstand, Radius und Fokuszustand. Ihre unterschiedlichen Anfangshöhen richten sich nach dem erwarteten Inhalt.

Dateitypen und Größenlimit stehen beim Hinzufügen. Datenübermittlung steht am Start der Analyse. Der Hinweis zur möglichen Übernahme von Dokumentinhalten in Suchanfragen steht bei Webrecherche. Kein allgemeiner Datenschutzhinweis als Dekoration unter jeder Seite.

Zusätzliche Prüfoptionen bleiben aufklappbar. Aktive Optionen werden auch im geschlossenen Zustand knapp erkennbar. Laufende Analyse zeigt Status und Abbruchaktion; vorhandene Eingaben bleiben erhalten.

Webrecherche ist bei neuen Entwürfen und API-Anfragen standardmäßig aktiv. Sie nutzt das OpenAI-Suchwerkzeug. Bewusstes Abschalten bleibt für den jeweiligen Entwurf erhalten; ein Aufgabenwechsel überschreibt diese Wahl nicht.

### Befunde und Dokumente

- Haupttitel ist der konkrete Berichtstitel. Prüfungsart, Modell und Zeitpunkt sind Metadaten.
- Zusammenfassung ohne zusätzliche werbliche Überschrift.
- Prüfpunkte, Textvorschläge und Chronologie bleiben unterschiedliche Ansichten; ihre Beschriftungen richten sich nach der Aufgabe.
- Prioritätszahlen stehen ausschließlich in den Filtern. Leere Nebenansichten entfallen; bei nur einer Ansicht ersetzt eine Abschnittsüberschrift die Tab-Leiste.
- „Quellen“ führt gespeicherte Dokumente und eingefügten Text auf. TXT-Downloads erhalten den vollständigen Quelltext.
- Fundstellen öffnen die gemeinsame Dokumentvorschau rechts oder bildschirmfüllend; siehe „Ergebnisansichten nach Aufgabe“. PDFs erscheinen mit stabiler Werkzeugleiste, Seitenwahl, Zoom und internem Scrollbereich; eine Zitatmarkierung setzt einen eindeutigen Texttreffer voraus.
- Jeder Befund hat eine lesbare Priorität, Beschreibung und bei Bedarf einen Rechtsbezug.
- Zwischen der anklickbaren Kopfzeile eines Befunds und dem aufgeklappten Inhalt bleiben 16 px Innenabstand. Der Abstand gehört zum Inhalt und bleibt bei Hover und Tastaturfokus unverändert; mobile Regeln ändern nur die seitlichen und unteren Abstände.
- Zitat und Änderungsvorschlag sind eindeutig bezeichnet. Keine bloße Farbmarkierung als angebliche Änderungsverfolgung.
- Der Dokumentbereich zeigt den tatsächlichen Dateinamen, die Fundstelle und den Wortlaut. Weiterer Dokumenttext bleibt bei Bedarf aufklappbar.
- „Zitat im Dokument gefunden“ bezeichnet einen Textabgleich. Die Einschränkung auf den Wortlaut wird direkt dort zugänglich erklärt.
- Fehlender ursprünglicher Dokumenttext wird sachlich benannt. Ein gespeichertes Zitat wird dadurch nicht als weiterhin live überprüfbar dargestellt.
- Export heißt Prüfbericht. Das UI darf keine bearbeitete Originaldatei versprechen, wenn der Export einen eigenständigen Bericht erzeugt.
- Tabellen erhalten eigene horizontale Scrollbereiche, falls nötig. Die ganze Seite darf dadurch nicht horizontal scrollen.

### Analysen und Playbooks

Listen bevorzugen gleichmäßige Zeilen vor vielen einzelnen Karten. Der Titel führt; Datum, Prüfungsart und Anzahl ergänzen. Keine Vorschaubeschreibung allein zur Füllung einer Zeile.

Playbooks bleiben fachliche Prüfvorgaben. Name und tatsächlicher Inhalt sind ausreichend. Kein abstrakter Claim zur „Kanzlei-DNA“ oder zu vermeintlich garantierter Konsistenz.

### Einstellungen

Verwandte Werte in Gruppen zusammenfassen. Pro Zeile eine Einstellung mit Bezeichnung links und Wert oder Bedienelement rechts. Auf kleinen Displays darf das Bedienelement darunter stehen.

Technische Informationen nur dort, wo sie zur Einrichtung oder Diagnose nötig sind. Hostdetails und API-Anfrage-IDs gehören nicht in die Hauptnavigation. Kein Konto-, Abrechnungs- oder Berechtigungsbereich ohne entsprechende Funktion.

## Menüs, Popover und Dialoge

- Menüs öffnen am auslösenden Element und bleiben innerhalb des sichtbaren Bereichs.
- Hintergrundfläche hebt sich von Composer oder Seite ab; eine dünne Kontur reicht neben einem zurückhaltenden Schatten.
- Gewählte Werte erhalten Häkchen oder einen eindeutigen Auswahlzustand. Auswahl nicht allein durch Farbe darstellen.
- Modellmenü zeigt die Modellnamen. Keine erfundenen Qualitätsversprechen oder generische Beschreibung je Modell.
- Standardauswahl: GPT-6 Luna mit Denkaufwand Hoch. Explizite Nutzerauswahl bleibt gespeichert.
- Webrecherche sitzt als Globus-Schalter direkt vor der Modellwahl: feste Größe, `aria-pressed`, Auswahlfläche und Häkchen. Kein alleinstehender Aktiv-Text unter der Werkzeugleiste. Der Hinweis zu Dokumentinhalten in Suchanfragen steht im Tooltip, zugänglich am Schalter und sichtbar in den Prüfoptionen. Dort bleibt die Playbook-Auswahl. Unter 420 px stehen Prüfoptionen und Globus gemeinsam über Modellwahl und Startaktion.
- Denkaufwand verwendet nur vom gewählten Modell unterstützte Werte. Bei einem Modellwechsel bleibt die Auswahl gültig.
- Denkaufwand verwendet einen nativen Range-Slider mit diskreten Stufen. Der aktuelle Wert steht oberhalb der Spur. Unterstützte Stufen werden in ihrer Reihenfolge auf die ganzzahligen Slider-Werte abgebildet; keine Zwischenwerte erfinden.
- Der Slider hat eine zugängliche Beschriftung, `aria-valuetext` für den benannten Wert und native Tastaturbedienung mit Pfeiltasten, Home und End. Ein knapper Kosten-/Zeithinweis bleibt dem Slider zugeordnet.
- Escape schließt. Nach dem Schließen kehrt Fokus zum Auslöser zurück.
- Modale Dialoge halten den Fokus innerhalb des Dialogs. Hintergrund wird für Interaktion gesperrt.
- Löschdialoge nennen das konkrete Objekt und die tatsächliche Folge. Keine allgemeine Warnung ohne Bezug.

## Mobile Darstellung

- Navigation wird unterhalb des vorhandenen Desktop-Breakpoints zum bedienbaren Drawer. Der vorhandene Breakpoint liegt bei 700 px und wird nur bei nachgewiesenem Platzproblem geändert.
- Kopfzeile zeigt Seitenidentität und Navigationstaste. Keine zusätzliche Logo- oder Sloganfläche.
- Außenabstand 16 px, bei sehr schmalen Ansichten mindestens 12 px.
- Workflow-Auswahl und Composer-Werkzeuge dürfen umbrechen. Reihenfolge und Beschriftung bleiben erhalten.
- Auf 320 px Breite entstehen keine abgeschnittenen Aktionen oder horizontales Seitenscrolling.
- Befund und Zitat stehen untereinander, wenn zwei lesbare Spalten nicht mehr passen. „Fundstelle ansehen“ führt zum zugehörigen Bereich.
- Popover erhalten eine Breitenbegrenzung relativ zum Viewport. Lange Datei- und Playbooknamen dürfen umbrechen.
- Dialoge bleiben mit Bildschirmtastatur bedienbar. Speichern, Abbrechen und Fehlerzustand müssen erreichbar sein.

## Fokus, Zustände und Bewegung

### Zustände

Normal, Hover, Fokus, aktiv, ausgewählt, deaktiviert und laufend sind getrennte Zustände. Deaktiviert bedeutet weder „versteckt“ noch „beschriftungslos“. Ladezustände nennen die laufende Tätigkeit. Fehler nennen das Problem und eine konkrete nächste Handlung, sofern diese bekannt ist.

Tastaturfokus erhält eine sichtbare, kontrastreiche Kontur mit Abstand zur Elementkante. Der Fokus bleibt auch auf ausgewählten Zeilen und hellen Primärbuttons erkennbar. Farbwechsel allein genügt nicht.

### Bewegung

Die Screenshots belegen keine Dauer oder Physik von der Referenz. Die folgenden Werte sind die abgestimmte Implementierung von LegalThinkGPT. Sie stehen zentral in `frontend/src/motion.tsx`. Verwendet wird `motion/react` (Motion, vormals Framer Motion).

| Preset | Steifigkeit | Dämpfung | Masse | Verwendung |
| --- | --- | --- | --- | --- |
| `control` | 500 | 38 | 0,8 | Rotation kleiner Statusicons innerhalb einer festen Fläche |
| `panel` | 400 | 38 | 0,9 | Eintritt der Dokumentvorschau |
| `fade` | — | — | — | Deckkraft: 120 ms, `easeOut` |
| `enter` / `exit` | — | — | — | Overlays: 160 ms hinein, 100 ms hinaus |
| `page` | — | — | — | Seitenwechsel: 180 ms |
| `press` / `release` | — | — | — | Klickfeedback: 60 ms drücken, 140 ms zurück |

Layoutstabilität hat Vorrang. Die mobile Navigation blendet an ihrer endgültigen Position ein und aus. Kleine Icons dürfen sich innerhalb einer festen Fläche drehen. Neue Eingaben dürfen laufende Übergänge umkehren; niemals Animationen abwarten, bevor sich der Zustand ändert. Dialoge erhalten nur eine Deckkraftanimation, nicht zusätzlich eine zweite auf ihrem Inhalt. [Motion: physikalische Übergänge](https://motion.dev/docs/react-transitions)

#### Interaktionen

- Schaltflächen behalten Position und Größe beim Drücken. Feedback über Farbe oder kurze Deckkraftänderung. Keine `scale`-, `x`- oder `y`-Animation auf Bedienelementen oder deren Beschriftungen, auch nicht um wenige Pixel.
- Navigation, Prüfungsart, Tabs und Darstellung markieren die Auswahl an Ort und Stelle. Keine zwischen Controls wandernde Auswahlfläche und kein Wechsel der Schriftstärke, der die Breite verändert.
- Seiten, Popover, Dialoge und Statusmeldungen blenden nur ein beziehungsweise aus. Keine Verschiebung oder Skalierung der Leseflächen. Keine Verzögerung vor der nächsten Aktion.
- Bei Modell, Denkaufwand, Auswahlzahlen, Ladezuständen und Aktionsbeschriftungen Platz für die längste unterstützte Variante vorhalten. Unsichtbare Messbeschriftungen bleiben `aria-hidden`; nur der aktuelle Wert gehört zum zugänglichen Namen.
- Neue Analyse, Analysen, Playbooks und Einstellungen verwenden dasselbe Seitenraster. `--page-inset`, `--page-top` und `--page-bottom` legen Abstand und Ursprung gemeinsam fest. Lange Seiten erhalten reservierten Platz für Scrollleisten.
- Der Wechsel der Prüfungsart verschiebt weder Prüfauftrag noch Werkzeugleiste. Zusätzliche Hinweise und Optionen stehen unterhalb der Hauptbedienung. Dokumentchips behalten unabhängig von Metadaten und Vergleichsrolle feste Spalten.
- In der Dokumentauswahl bleiben Zeile, Dialog und Fußzeile beim An- und Abwählen stabil. Vergleichsreihenfolge und wechselnde Zähler dürfen oberhalb der Zeilen keinen neuen Platz beanspruchen.
- Aufklappen ändert die benötigte Fläche einmal direkt unter dem Auslöser, ohne federnde Höhenänderung. Eine Befundauswahl klappt nicht gleichzeitig einen anderen Befund oberhalb zu. Quellenwahl und geöffnete Befunde sind getrennte Zustände.
- Der native Denkaufwand-Slider aktualisiert Wert, Beschriftung und Übermittlung unmittelbar. Sein Auslöser bleibt bei allen Werten gleich breit.
- Modellmenüs fokussieren die aktuelle Auswahl. Pfeiltasten sowie Home/End bewegen den Fokus; Escape schließt und fokussiert den Auslöser. Ein Tabwechsel aus dem Picker schließt das Menü.

#### Unterbrechung und Barrierefreiheit

- `useMotionPreferences()` beobachtet die Betriebssystempräferenz auch während einer geöffneten Sitzung. Bei `prefers-reduced-motion: reduce` sind Übergänge sofort; räumliche Bewegung und Ladespinner entfallen. Status bleibt als Text erkennbar.
- `MotionConfig reducedMotion="user"` sichert neue Motion-Komponenten zusätzlich ab. Zustandsicons zeigen weiterhin die richtige Endstellung. [Motion: Barrierefreiheit](https://motion.dev/docs/react-accessibility)
- Mit `AnimatePresence` ausblendende Overlays werden sofort `inert` und `aria-hidden`. Sie dürfen während des sichtbaren Nachlaufs keine Klicks, Tabstopps oder doppelten Screenreader-Inhalte behalten. Inhalte im normalen Dokumentfluss werden beim Schließen sofort entfernt. [Motion: Anwesenheit während des Entfernens](https://motion.dev/docs/react-animate-presence)
- Beim Schließen eines Dialogs wird die Fokusführung sofort freigegeben und der Auslöser fokussiert. Der Hintergrund ist während des offenen Dialogs gesperrt. Erneutes Öffnen darf keinen zweiten Dialog oder veralteten Fokus erzeugen.
- Fundstellen scrollen nur auf ausdrückliche Auswahl und nur, wenn der Bereich außerhalb der sichtbaren Fläche liegt. Bei reduzierter Bewegung erfolgt der Sprung direkt.
- Keine Layout-Projektion auf Eingabefeldern, Textzeilen oder Dokumentchips. Keine permanente `will-change`-Belegung. Scrollanker dürfen bei Zustandswechseln nicht die Seite verschieben; Fokuswiederherstellung verwendet `preventScroll`.
- Schnelles Öffnen, Schließen, erneutes Öffnen, Tastaturbedienung und ein Präferenzwechsel während der Sitzung gehören zur Prüfung. Zusätzlich Position und Größe über mehrere Animationsframes messen: höchstens 0,5 CSS-Pixel Abweichung für unveränderte Bedienflächen. Screenshots und Kontrastprüfung erst nach abgeschlossenem Übergang erstellen.

## Textregeln

Jeder sichtbare Text benennt eine Aktion, einen Zustand, einen konkreten Sachverhalt, Daten, eine Identität oder eine entscheidungsrelevante Information. Das gilt auch für Text innerhalb von Bildern.

- Keine Slogans, Markenpoesie, abstrakten Nutzenversprechen oder künstlichen Dreierformeln.
- Keine motivierenden oder beruhigenden Sätze als Ersatz für eine Funktion.
- Keine dekorativen Eyebrows oder Profilattrappen.
- Keine Wiederholung einer unmittelbar sichtbaren Aktion im leeren Zustand.
- Kein behauptetes Qualitäts-, Sicherheits- oder Rechtsniveau ohne belastbare Grundlage.
- Hinweise dort zeigen, wo ihre Folge für die Handlung relevant wird. Vertiefungen aufklappbar halten.
- Leerzustände nennen den fehlenden Inhalt. Ein nächster Schritt ist nur nötig, wenn er nicht bereits direkt sichtbar ist.
- Im Zweifel streichen. Eine Floskel wird nicht durch eine geschliffenere Floskel ersetzt.

| Zweck                          | Passende Form                                  |
| ------------------------------ | ---------------------------------------------- |
| Neue Arbeit beginnen           | „Neue Analyse“                                 |
| Dokument auswählen             | „Dokumente hinzufügen“                         |
| Leere Verlaufsliste            | „Noch keine Analysen“                          |
| Wortlaut gefunden              | „Zitat im Dokument gefunden“                   |
| Nicht mehr gespeicherte Quelle | „Der Dokumenttext ist nicht mehr gespeichert.“ |
| Konkrete Fehlermeldung         | „Die Datei darf höchstens 12 MB groß sein.“    |

Die Beispiele sind Muster für vorhandene Funktionen, keine zusätzlichen Textelemente.

## Prüfung aus drei Perspektiven

### Aufgaben und Eingaben

- Vertrag, Vergleich, Chronologie, Datenschutz und Werbung verwenden ein gemeinsames Eingaberaster. Datenschutz hat eine kompakte Auswahl für Allgemein, AVV und DSFA in der reservierten Zeile neben dem Prüfauftrag.
- Jede der sieben Aufgaben hat einen eigenen Entwurf: Dokumentauswahl, eingefügter Text, Prüfauftrag, Playbook und Webrecherche bleiben beim Wechsel erhalten. Diese Entwürfe bestehen für die geöffnete Sitzung; ein Neuladen setzt sie zurück.
- Platzhalter zeigen kurze Beispiele mit „z. B.“. Sie werden niemals als tatsächlicher Prüfauftrag übermittelt. Die fachlichen Prüfanweisungen stammen aus den ausgewählten Aufgaben im Backend; das Textfeld ergänzt Mandantenrolle und konkreten Schwerpunkt.
- „Beispiel öffnen“ öffnet passende synthetische Unterlagen mit vorgegebenem Ergebnis. Es ersetzt weder Dokumentauswahl noch Prüfauftrag des Nutzers.
- Im Vergleich bleiben Original und Gegenentwurf festen Plätzen zugeordnet. Entfernen einer Fassung benennt die andere nicht um. Mehr als zwei Dateien werden vor dem Upload abgewiesen. Gespeicherte Ergebnisse nennen beide Eingabedokumente in ihrer ursprünglichen Reihenfolge.
- Chronologie öffnet die Zeittafel zuerst. „Fundstelle ansehen“ zeigt den Beleg zum gewählten Ereignis; Schließen führt den Tastaturfokus zurück. „Formulierung“ führt zum zugehörigen Vorschlag.
- Neue Profile starten mit Luna/Hoch. Modell und Denkaufwand werden als browserbezogene Präferenzen gespeichert; ein Beispielszenario ändert diese Auswahl nicht.

### Textredaktion

Ist die Oberfläche nach Entfernung eines Satzes genauso verständlich und bedienbar? Dann entfällt der Satz. Beschriftungen bleiben über Navigation, Dialoge und Aktionen hinweg konsistent. Ein sichtbarer Zustand darf nicht an drei Stellen erklärt werden.

### Juristische Arbeitspraxis

Sind Original, Gegenentwurf, Zitat, Modellbewertung und Formulierungsvorschlag klar unterscheidbar? Kann man lange Klauseln und ihre Fundstellen ohne unnötige Wechsel vergleichen? Bleiben Unsicherheiten und fehlende Dokumente erkennbar? Kein automatischer Textabgleich wird als rechtliche Freigabe bezeichnet.

### Ergebnisansichten nach Aufgabe

| Aufgabe | Hauptansicht | Textvorschläge |
| --- | --- | --- |
| Vertrag | Vertragspunkte: Textstelle zur Klausel, Einordnung, Rechtsbezug | Klauselvorschläge |
| Vergleich | Änderungen: Original und Gegenentwurf nebeneinander, danach Bewertung | Verhandlungsvorschläge |
| Chronologie | Datum, Ereignis, Beleg und offene Frage; zusätzliche Prüfpunkte nur bei vorhandenen Ergebnissen | Textvorschläge nur bei vorhandenem Ersatztext |
| Datenschutz | Datenschutzfragen: Prüfergebnis, Quellenauszug, Rechtsbezug und offene Angaben | Textvorschläge |
| AVV | Vertragspunkte mit Prüfergebnis, Klauselbeleg und offenen Angaben | Klauselvorschläge |
| DSFA | Risiken und Prüfpunkte, Unsicherheiten und offene Angaben | Vorhandene Textvorschläge, keine erfundene Maßnahmenliste |
| Werbung | Werbeaussagen: zitierte Textstelle vor der Einordnung und dem Rechtsbezug | Textalternativen |

- Priorität bezeichnet den Prüfbedarf. Sie ist kein Risikoscore oder Freigabestatus. Zähler bleiben in den Filtern; keine zusätzliche Zahlenübersicht.
- `suggestion` enthält ausschließlich Ersatztext. Maßnahmen und Klärungsbedarf stehen in der Bewertung beziehungsweise in offenen Fragen; vorhandene Ersatztexte niemals zu „Maßnahmen“ umbenennen.
- Im Vergleich stammen beide Wortlaute aus getrennten, fest zugeordneten Dokumentfassungen. Beide Zitate werden unabhängig abgeglichen. Alte Ergebnisse ohne dieses Datenpaar zeigen ihren bisherigen Beleg und keine erfundene zweite Fassung.
- Die Änderungskategorie stammt aus der Analyse. Ein leeres Zitat allein beweist keine Streichung oder Ergänzung. Eingereichter Gegenentwurf und vorgeschlagene Verhandlungsfassung bleiben getrennt.
- Ein Quellenzitat kann auch aus einem eingefügten E-Mail-Verlauf stammen. Rollenbezeichnungen dürfen aus einem allgemeinen Beleg keine rechtlich gesicherte Vertragsklausel oder Werbeaussage machen. Unbestätigte Zitate sind direkt gekennzeichnet.
- Fundstellen und Dokumentnamen öffnen dieselbe Dokumentvorschau. In Analysen ab 1400 px stehen Ergebnis und Dokument nebeneinander. Links bleiben mindestens 420 px; die Vorschau erhält höchstens die halbe Fensterbreite. Die Aufteilung ändert sich einmal beim Öffnen/Schließen, ohne Breitenanimation. Der sichtbare Quellen-Auslöser dient als Scrollanker. Bei weiteren Quellenwechseln bleibt die Aufteilung unverändert.
- Auf schmaleren Fenstern und außerhalb der Analyse öffnet die Vorschau bildschirmfüllend. Ein nativer Dialog führt den Fokus; Escape funktioniert auch innerhalb des Word-Dokuments. Schließen stellt den Fokus ohne Scrollsprung wieder her. Am Desktop bleibt die Ergebnisliste während der geteilten Ansicht bedienbar.
- Auf ausdrücklichen Nutzerwunsch fährt nur die Dokumentoberfläche beim Öffnen mit dem vorhandenen `panel`-Spring von rechts ein. Mit Reduced Motion entfällt diese Bewegung. Quellenwechsel animieren weder Rahmen noch Controls; die geschlossene Zitatzeile behält ihre Höhe.
- PDF: fortlaufende Seiten, sichtbare Nachbarseiten rendern, Seitenwahl, Zoom und Sprung zur Fundstelle. Nur eindeutige Texttreffer markieren; mehrdeutige Treffer benennen. Word: lokal gerenderte DOCX-Datei mit Tabellen, Bildern und sichtbaren Änderungen; keine behauptete Übereinstimmung mit Word-Seitenumbrüchen. TXT und Markdown: vollständiger Text; Markdown zusätzlich als Leseansicht ohne eingebettetes HTML oder externe Bilder. Zitate führen zum unveränderten Quelltext.
- Originaldateien bleiben als Download verfügbar. Alte PDF-/Word-Quellen ohne Original zeigen ihren ausgelesenen Text; eine passende Datei kann ergänzt werden. Der Textabgleich bestätigt den Wortlaut, keine Dateiauthentizität. Gespeicherte Originalbytes werden nicht ersetzt.
- PDF und Word starten bei 100 %; weitere Zoomstufen sind 25, 50, 75, 125, 150 und 200 %. Keine automatische Seitenbreite. Bei 100 % entsprechen Seitenmaße CSS-Druckmaßen (96 px pro Zoll); breite Seiten scrollen innerhalb der Vorschau.
- Word übernimmt gespeicherte Umbrüche und ergänzt Vorschauseiten anhand der DOCX-Seitenmaße. Lange Absätze und einfache Tabellen werden ohne Textverlust aufgeteilt; Seitenwahl und Zitatsprung beziehen sich auf diese Vorschauseiten. Die Seitenzahlen sind keine garantierten Word-Fundstellen. Mehrspaltige Abschnitte, übergroße unteilbare Objekte und Fußnoten bleiben vollständig sichtbar und können längere Seiten benötigen.
- PDF-Seiten erscheinen immer in Originalfarben: keine Filter, Invertierung oder Graustufen auf Canvas, Fotos oder Dokumentinhalt. Nur die Umgebung folgt dem Theme. Für die Word-Leseansicht bleibt die umschaltbare Graustufendarstellung bestehen: Papier `#242424`, schwarze Originalschrift als `#DBDBDB`, Umgebung `#171717`. „Originalfarben“ schaltet dort die Anzeigeanpassung ab. Downloads ändern sich nicht.
- Mobil stehen Vergleichsfassungen untereinander: Original, Gegenentwurf, Bewertung. Keine horizontale Seitenverschiebung. Leere Nebenansichten entfallen.

### Interface-Design

Hat jedes Element einen sinnvollen Platz und eine erkennbare Gewichtung? Tragen Abstände, Flächen und Schriftgrößen die Hierarchie ohne erklärende Zusatztexte? Sind Navigation, Startaktion und Quellenwechsel mit Maus, Tastatur und Touch erreichbar?

## Abnahme

### Umsetzung im Repository

- `frontend/src/theme.css`: gemeinsame semantische Tokens für beide Themes. Komponenten erhalten keine eigenen Hex-Farben.
- `frontend/public/theme-init.js`: gespeicherte Darstellung vor dem ersten Rendern anwenden. Hintergrundwerte dort und im HTML-Fallback mit den Seitentokens synchron halten.
- `frontend/src/theme.ts`: React-Anbindung an dieselbe Theme-Verwaltung.
- `frontend/src/styles.css`: Navigation, Eingabe, gemeinsame Controls und Popover.
- `frontend/src/workspace.css`: Befunde, Quellen, Listen, Playbooks und Einstellungen.
- `frontend/src/polish.css`: Dokumentauswahl und Fehler beim Laden.
- `tests/built.spec.ts`: Start des Produktionsbuilds, Luna/Hoch als Standard, Quellenansicht, Export und Verlauf. Layout und Bedienung bei betroffenen UI-Änderungen gezielt prüfen; keine automatisierte Theme-/Viewport-Matrix.

### Prüfpunkte

- Desktop: Neue Analyse, befüllter Composer, Befunde mit Quelle, Menü und Einstellungen visuell prüfen.
- Mobil: 320–390 px Breite, Navigation, Dokumentauswahl, Optionen und Dialoge prüfen.
- Dunkle und helle Darstellung auf harte Farbreste, Textkontrast und Fokus prüfen.
- Bestehende Abläufe für Upload, Vergleichsreihenfolge, Analyseauswahl, Export und Playbook-Bearbeitung erhalten.
- Tastaturfokus, Escape, Fokuswiederherstellung und reduzierte Bewegung prüfen.
- Keine privaten Referenzinhalte oder Screenshot-Dateien einchecken.
- Keine echten OpenAI-Anfragen während Entwicklung oder Tests.
- Gestaltung und Implementierung gemeinsam aktualisieren, wenn sich Zielwerte bei der visuellen Prüfung ändern.
