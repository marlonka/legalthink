"""Synthetic, deterministic fixture. It never calls an API or reads user documents."""

from .analysis import verify_findings, verify_timeline
from .schemas import (
    Analysis,
    DemoScenario,
    Document,
    Finding,
    ModelAnalysis,
    ModelFinding,
    ModelTimelineEntry,
    Severity,
    new_id,
    now,
)

DEMO_ID = "demo-saas-vertrag"
DEMO_TEXT = """SYNTHETISCHES BEISPIEL · Kein echter Mandatsinhalt
Cloud-Dienstleistungsvertrag · Nordstern GmbH / Beispiel Cloud GmbH

§ 1 Leistungsumfang
Der Anbieter stellt einen webbasierten Projektraum für bis zu 50 Nutzer bereit.
Die monatliche Vergütung beträgt 2.400 Euro netto.

§ 4 Verfügbarkeit
Der Anbieter strebt eine Verfügbarkeit von 99,5 % im Kalendermonat an.
Wartungsarbeiten werden bei der Berechnung nicht berücksichtigt.

§ 7 Haftung
Die Haftung des Anbieters ist unabhängig vom Rechtsgrund auf die vom Kunden
im letzten Monat gezahlte Vergütung begrenzt.

§ 9 Laufzeit und Kündigung
Der Vertrag läuft zunächst zwölf Monate. Er verlängert sich um jeweils zwölf
Monate, wenn er nicht drei Monate vor Ablauf schriftlich gekündigt wird.

§ 11 Daten und Vertragsende
Nach Vertragsende stellt der Anbieter die Kundendaten für sieben Tage zum
Download bereit. Anschließend werden sämtliche Kundendaten gelöscht.
"""


def demo_document() -> Document:
    return Document(
        id=DEMO_ID,
        name="Beispiel · Cloud-Vertrag.txt",
        text=DEMO_TEXT,
        page_count=1,
        char_count=len(DEMO_TEXT),
    )


def _contract_analysis() -> Analysis:
    rows = [
        (
            "Haftung ohne erkennbare Ausnahmen",
            "high",
            "Haftung",
            "§ 7",
            "Die Haftung des Anbieters ist unabhängig vom Rechtsgrund auf die vom Kunden\n"
            "im letzten Monat gezahlte Vergütung begrenzt.",
            "Die pauschale Begrenzung auf eine Monatsvergütung erfasst ihrem Wortlaut nach auch "
            "Fallgruppen, für die eine Haftungsbeschränkung unzulässig sein kann. Ob die Klausel "
            "AGB ist und welche Interessenlage besteht, muss geklärt werden.",
            "Die Haftung für Vorsatz, grobe Fahrlässigkeit sowie Schäden aus der Verletzung von "
            "Leben, Körper oder Gesundheit bleibt unbeschränkt. Bei leicht fahrlässiger Verletzung "
            "wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, "
            "vorhersehbaren "
            "Schaden begrenzt. Zwingende gesetzliche Haftung bleibt unberührt.",
            "§ 276 Abs. 3 BGB; §§ 307, 310 BGB. Anwendbarkeit und konkrete Ausgestaltung prüfen.",
        ),
        (
            "Datenexport nach sieben Tagen beendet",
            "medium",
            "Vertragsende",
            "§ 11",
            "Nach Vertragsende stellt der Anbieter die Kundendaten für sieben Tage zum\n"
            "Download bereit. Anschließend werden sämtliche Kundendaten gelöscht.",
            "Sieben Tage lassen wenig Zeit für Migration und Prüfung der Vollständigkeit. "
            "Format, Unterstützung, gesetzliche Aufbewahrung und Löschbestätigung bleiben offen.",
            "Der Anbieter stellt die Kundendaten nach Vertragsende für 30 Tage in einem "
            "gängigen, maschinenlesbaren Format zum Export bereit. Die Löschung erfolgt nach "
            "bestätigtem Export oder Ablauf dieser Frist, soweit keine gesetzlichen "
            "Aufbewahrungspflichten entgegenstehen.",
            "Vertragliche Risikoverteilung; bei Auftragsverarbeitung "
            "Art. 28 Abs. 3 lit. g DSGVO prüfen.",
        ),
        (
            "Wartungszeiten bleiben unbegrenzt",
            "medium",
            "Service Level",
            "§ 4",
            "Wartungsarbeiten werden bei der Berechnung nicht berücksichtigt.",
            "Ohne Zeitfenster oder Obergrenze kann Wartung die angestrebte Verfügbarkeit deutlich "
            "relativieren. Ein verhandelbares Betriebsrisiko; die Rechtsfolge hängt "
            "vom Gesamtvertrag ab.",
            "Angekündigte Wartungsarbeiten werden nur innerhalb des vereinbarten "
            "Wartungsfensters [Zeitfenster] und bis zu [Stunden] pro Monat von der "
            "Verfügbarkeitsberechnung ausgenommen.",
            "Leistungsbeschreibung und gegebenenfalls Transparenzkontrolle nach § 307 BGB prüfen.",
        ),
    ]
    findings = [
        Finding(
            id=new_id(),
            title=r[0],
            severity=r[1],
            category=r[2],
            source_location=r[3],
            source_quote=r[4],
            description=r[5],
            suggestion=r[6],
            legal_basis=r[7],
            source_document_id=DEMO_ID,
            verified=True,
            source_urls=[],
        )
        for r in rows
    ]
    return Analysis(
        id=new_id(),
        title="Cloud-Vertrag · Beispielprüfung",
        workflow="contract",
        summary="Drei Verhandlungspunkte aus Kundensicht: Haftung, Datenexport und Wartungszeiten. "
        "AGB-Eigenschaft und tatsächliche Ausfallfolgen sind noch zu klären.",
        findings=findings,
        timeline=[],
        questions=[
            "Handelt es sich um AGB oder einen individuell ausgehandelten Vertrag?",
            "Welche Ausfallfolgen und Migrationszeiten sind für den Kunden relevant?",
            "Werden personenbezogene Daten im Auftrag verarbeitet und liegt ein AVV vor?",
        ],
        created_at=now(),
        model="Synthetisches Beispiel",
        effort="high",
        is_demo=True,
    )


def _document(scenario: str, slug: str, name: str, text: str) -> Document:
    text = "SYNTHETISCHES BEISPIEL · Fiktive Unterlagen\n\n" + text
    return Document(
        id=f"demo-{scenario}-{slug}",
        name=f"Beispiel · {name}.txt",
        text=text,
        page_count=1,
        char_count=len(text),
    )


SCENARIO_DOCUMENTS = {
    "compare": [
        _document(
            "compare",
            "v1",
            "01 Originalentwurf",
            """Cloud-Vertrag · Originalentwurf
§ 7 Haftung
Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung
auf die Jahresvergütung begrenzt.
Die Haftung für Vorsatz, grobe Fahrlässigkeit und Personenschäden bleibt unbeschränkt.
§ 11 Datenexport
Nach Vertragsende stehen die Kundendaten 30 Tage zum Export bereit.
""",
        ),
        _document(
            "compare",
            "v2",
            "02 Gegenentwurf",
            """Cloud-Vertrag · Gegenentwurf
§ 7 Haftung
Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung
auf eine Monatsvergütung begrenzt.
Die Haftung für Vorsatz, grobe Fahrlässigkeit und Personenschäden bleibt unbeschränkt.
§ 11 Datenexport
Nach Vertragsende stehen die Kundendaten sieben Tage zum Export bereit.
""",
        ),
    ],
    "chronology": [
        _document(
            "chronology",
            "bestellung",
            "01 Bestellbestätigung",
            """Bestellbestätigung vom 05.09.2026
Am 05.09.2026 wurde die Lieferung von zehn Arbeitsplatzrechnern bestätigt.
Als Liefertermin wurde der 15.09.2026 vereinbart.
""",
        ),
        _document(
            "chronology",
            "email",
            "02 E-Mail zum Lieferstand",
            """E-Mail des Kunden vom 17.09.2026
Am 17.09.2026 teilte der Kunde mit, dass noch kein Rechner eingetroffen sei.
Er bat um vollständige Lieferung bis zum 23.09.2026.
""",
        ),
        _document(
            "chronology",
            "notiz",
            "03 Wareneingangsnotiz",
            """Interne Notiz vom 24.09.2026
Am 23.09.2026 wurden sechs von zehn bestellten Rechnern angeliefert.
Ein unterschriebener Lieferschein liegt der Akte nicht bei.
""",
        ),
    ],
    "compliance": [
        _document(
            "compliance",
            "portal",
            "Kundenportal – Verarbeitung",
            """Projektbeschreibung Kundenportal
Die fiktive Nordstern GmbH betreibt ein Kundenportal für Supportanfragen.
Das Portal speichert Namen, geschäftliche E-Mail-Adressen und Supportnachrichten.
Der Hosting-Anbieter betreibt das Portal nach Weisung der Nordstern GmbH.
Der Analysedienst wertet Nutzungsdaten auch für eigene Produktentwicklung aus.
Alle Supportnachrichten werden ohne festgelegte Löschfrist aufbewahrt.
""",
        ),
    ],
    "avv": [
        _document(
            "avv",
            "vereinbarung",
            "Auftragsverarbeitungsvereinbarung",
            """AVV · Fiktive Cloud-Dienste
Der Dienstleister verarbeitet Kontaktdaten und Supportinhalte
nach dokumentierter Weisung des Kunden.
Neue Unterauftragnehmer können ohne vorherige Information des Kunden eingesetzt werden.
Nach Vertragsende werden alle Daten nach Wahl des Dienstleisters gelöscht oder weiter gespeichert.
Die technischen und organisatorischen Maßnahmen sind in Anlage 1 beschrieben.
""",
        ),
        _document(
            "avv",
            "tom",
            "Anlage 1 – Maßnahmen",
            """Anlage 1 · Technische und organisatorische Maßnahmen
Administratoren verwenden persönliche Konten mit Mehrfaktor-Authentisierung.
Wiederherstellungstests werden nach Bedarf durchgeführt; Testergebnisse werden nicht dokumentiert.
""",
        ),
    ],
    "dsfa": [
        _document(
            "dsfa",
            "verarbeitung",
            "Videoanalyse – Verarbeitung",
            """Projektbeschreibung · Fiktive Videoanalyse im Lager
Kameras erfassen während der gesamten Schicht alle Arbeitsplätze im Lager.
Zweck ist die Erkennung von Unfällen und blockierten Fluchtwegen.
Die Aufnahmen werden 90 Tage gespeichert und können von allen Schichtleitungen abgerufen werden.
Eine weniger eingriffsintensive Alternative wurde bisher nicht untersucht.
""",
        ),
        _document(
            "dsfa",
            "risiken",
            "Videoanalyse – offene Bewertungen",
            """Risikonotiz · Planungsstand
Die Zahl der betroffenen Beschäftigten und die erfassten Bildbereiche sind noch offen.
Eine Beschränkung auf Gefahrenzonen und eine kürzere Speicherung werden erwogen.
Diese Maßnahmen sind noch nicht beschlossen oder technisch umgesetzt.
Die Einbindung der Datenschutzbeauftragten ist geplant; eine Stellungnahme liegt noch nicht vor.
""",
        ),
    ],
    "advertising": [
        _document(
            "advertising",
            "werbung",
            "Produktseite – Werbeentwurf",
            """Werbeentwurf · Fiktives Reinigungsmittel
Unser Reiniger ist 100 % umweltneutral – von der Herstellung bis zur Entsorgung.
Er beseitigt sämtliche Allergierisiken in Ihrem Zuhause.
Das Angebot richtet sich an private Haushalte in Deutschland.
""",
        ),
        _document(
            "advertising",
            "nachweise",
            "Produktseite – Nachweisstand",
            """Interner Nachweisstand zum Werbeentwurf
Vorhanden ist eine interne Messung des Energieverbrauchs am Produktionsstandort.
Für Transport, Nutzung und Entsorgung liegen keine Umweltberechnungen vor.
Eine Untersuchung zu Allergierisiken wurde nicht durchgeführt.
""",
        ),
    ],
}


def demo_documents(scenario: DemoScenario = "contract") -> list[Document]:
    if scenario == "contract":
        return [demo_document()]
    return [document.model_copy() for document in SCENARIO_DOCUMENTS[scenario]]


def _finding(
    document: Document,
    quote: str,
    title: str,
    description: str,
    category: str,
    suggestion: str = "",
    legal_basis: str = "",
    severity: Severity = "medium",
) -> ModelFinding:
    return ModelFinding(
        title=title,
        severity=severity,
        category=category,
        description=description,
        source_quote=quote,
        source_document_id=document.id,
        source_location="Textfundstelle",
        suggestion=suggestion,
        legal_basis=legal_basis,
        source_urls=[],
    )


def _case(scenario: DemoScenario, documents: list[Document]) -> ModelAnalysis:
    first = documents[0]
    if scenario == "compare":
        second = documents[1]
        return ModelAnalysis(
            title="Cloud-Vertrag · Versionsvergleich",
            summary="Der Gegenentwurf reduziert die "
            "Haftungsgrenze von einer Jahres- auf eine Monatsvergütung und verkürzt "
            "den Datenexport "
            "von 30 auf sieben Tage. Die genannten Haftungsausnahmen bleiben unverändert.",
            findings=[
                _finding(
                    second,
                    "Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten "
                    "ist die Haftung auf eine Monatsvergütung begrenzt.",
                    "Haftungsgrenze von Jahres- auf Monatsvergütung reduziert",
                    "Original: Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten "
                    "ist die Haftung auf die Jahresvergütung begrenzt. Der Gegenentwurf "
                    "reduziert diese Grenze auf eine Monatsvergütung. Aus Kundensicht steht "
                    "damit weniger Haftungsvolumen zur Verfügung; Schadensprofil und "
                    "Zulässigkeit der Begrenzung sind zu prüfen.",
                    "Haftung",
                    "Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten "
                    "ist die Haftung auf die Jahresvergütung begrenzt.",
                    "Vertragliche Risikoverteilung; gegebenenfalls §§ 307, 310 BGB prüfen.",
                    "high",
                ),
                _finding(
                    second,
                    "Nach Vertragsende stehen die Kundendaten sieben Tage zum Export bereit.",
                    "Exportfenster von 30 auf sieben Tage verkürzt",
                    "Original: Nach Vertragsende stehen die Kundendaten 30 Tage zum Export bereit. "
                    "Im Gegenentwurf entfallen 23 Tage für Migration und Vollständigkeitsprüfung.",
                    "Vertragsende",
                    "Nach Vertragsende stehen die Kundendaten 30 Tage zum Export bereit.",
                    "Vertragliche Leistungs- und Übergabepflichten prüfen.",
                ),
            ],
            timeline=[],
            questions=[
                "Wie lange benötigt der Kunde für einen vollständigen Export?",
                "Welche vertragstypischen Schäden sollen abgedeckt werden?",
            ],
        )
    if scenario == "chronology":
        email, note = documents[1:]
        events = [
            (
                "2026-09-05",
                "Bestellung bestätigt",
                first,
                "Am 05.09.2026 wurde die Lieferung von zehn Arbeitsplatzrechnern bestätigt.",
                "",
            ),
            (
                "2026-09-15",
                "Vereinbarter Liefertermin",
                first,
                "Als Liefertermin wurde der 15.09.2026 vereinbart.",
                "Welche Abreden galten zu Teillieferungen und Verzögerungen?",
            ),
            (
                "2026-09-17",
                "Kunde meldet ausstehende Lieferung und bittet um Lieferung bis 23.09.",
                email,
                "Am 17.09.2026 teilte der Kunde mit, dass noch kein Rechner eingetroffen sei.\n"
                "Er bat um vollständige Lieferung bis zum 23.09.2026.",
                "Ist der Zugang der E-Mail belegt und welche rechtliche Bedeutung "
                "hat die Lieferbitte?",
            ),
            (
                "2026-09-23",
                "Sechs Rechner laut interner Notiz eingetroffen",
                note,
                "Am 23.09.2026 wurden sechs von zehn bestellten Rechnern angeliefert.",
                "Wo sind Lieferschein und Nachweis der noch fehlenden vier Rechner?",
            ),
        ]
        return ModelAnalysis(
            title="Rechnerlieferung · Chronologie",
            summary="Vier Ereignisse zwischen dem "
            "5. und 23. September 2026. Der Wareneingang von sechs Rechnern ist intern notiert; "
            "ein unterschriebener Lieferschein fehlt.",
            findings=[
                _finding(
                    note,
                    "Ein unterschriebener Lieferschein liegt der Akte nicht bei.",
                    "Wareneingang nur durch interne Notiz belegt",
                    "Die Notiz nennt sechs gelieferte Rechner. Menge, Empfang und "
                    "Zustand sollten durch Lieferschein oder weitere Belege geklärt werden.",
                    "Beweismittel",
                    legal_basis="Beweisbarkeit des Sachverhalts prüfen.",
                )
            ],
            timeline=[
                ModelTimelineEntry(
                    date=date,
                    event=event,
                    source="",
                    open_question=question,
                    source_document_id=doc.id,
                    source_quote=quote,
                )
                for date, event, doc, quote, question in events
            ],
            questions=[
                "Welche vier Geräte fehlen und wurden sie später geliefert?",
                "Welche konkreten Ausfallkosten sind dokumentiert?",
            ],
        )
    if scenario == "compliance":
        return ModelAnalysis(
            title="Kundenportal · Datenschutzprüfung",
            summary="Hosting und Nutzungsanalyse "
            "haben unterschiedliche Verarbeitungszwecke. Die Rollen des Analysedienstes und "
            "die Aufbewahrung von Supportnachrichten müssen geklärt werden.",
            findings=[
                _finding(
                    first,
                    "Der Analysedienst wertet Nutzungsdaten auch für "
                    "eigene Produktentwicklung aus.",
                    "Eigene Zwecke des Analysedienstes abgrenzen",
                    "Die Verarbeitung für eigene Produktentwicklung lässt sich nicht ohne "
                    "weitere Prüfung als reine Auftragsverarbeitung einordnen. Datenflüsse, "
                    "Entscheidungsbefugnisse und Vertragsunterlagen fehlen.",
                    "Rollen",
                    legal_basis="Rollen nach Art. 4 Nr. 7 und 8 DSGVO prüfen; "
                    "gegebenenfalls Art. 26 oder 28 DSGVO.",
                ),
                _finding(
                    first,
                    "Alle Supportnachrichten werden ohne festgelegte Löschfrist aufbewahrt.",
                    "Aufbewahrung nach Zweck und Inhalt festlegen",
                    "Ein Ende der Speicherung ist nicht festgelegt. Erforderliche "
                    "Aufbewahrungsdauer, gesetzliche Pflichten und Löschabläufe müssen "
                    "je Nachrichtenkategorie bestimmt werden.",
                    "Speicherung",
                    legal_basis="Speicherbegrenzung nach Art. 5 Abs. 1 lit. e DSGVO prüfen.",
                ),
            ],
            timeline=[],
            questions=[
                "Welche Nutzungsdaten erhält der Analysedienst?",
                "Wer entscheidet über Analysezwecke und Mittel?",
                "Welche Aufbewahrungspflichten gelten für Supportnachrichten?",
            ],
        )
    if scenario == "avv":
        measures = documents[1]
        return ModelAnalysis(
            title="Auftragsverarbeitung · AVV-Prüfung",
            summary="Unterauftragnehmer und Umgang "
            "mit Daten nach Vertragsende sind zu klären. Die Maßnahmen-Anlage enthält keine "
            "dokumentierten Wiederherstellungstests.",
            findings=[
                _finding(
                    first,
                    "Neue Unterauftragnehmer können ohne vorherige Information "
                    "des Kunden eingesetzt werden.",
                    "Verfahren für Unterauftragnehmer ergänzen",
                    "Die Klausel sieht keine Vorabinformation vor. Bestehende Genehmigungen "
                    "und das Verfahren für Änderungen sind zu klären. Die Mandantenrolle "
                    "ist für die gewünschte Verhandlungsposition noch offen.",
                    "Unterauftragnehmer",
                    "Der Einsatz weiterer Auftragsverarbeiter setzt eine vorherige "
                    "gesonderte oder allgemeine schriftliche Genehmigung des Verantwortlichen "
                    "voraus. Bei allgemeiner Genehmigung informiert der Auftragsverarbeiter "
                    "vor Änderungen und ermöglicht einen begründeten Einspruch.",
                    "Art. 28 Abs. 2 DSGVO; Anwendbarkeit und Verfahren prüfen.",
                ),
                _finding(
                    first,
                    "Nach Vertragsende werden alle Daten nach Wahl des Dienstleisters "
                    "gelöscht oder weiter gespeichert.",
                    "Rückgabe und Löschung nach Vertragsende regeln",
                    "Die Wahl wird allein dem Dienstleister zugewiesen. Die Entscheidung "
                    "des Verantwortlichen sowie mögliche gesetzliche Aufbewahrungspflichten "
                    "sind in der Regelung zu berücksichtigen.",
                    "Vertragsende",
                    "Nach Abschluss der Verarbeitung gibt der Auftragsverarbeiter die "
                    "personenbezogenen Daten nach Wahl des Verantwortlichen zurück oder "
                    "löscht sie, soweit keine gesetzliche Speicherungspflicht besteht.",
                    "Art. 28 Abs. 3 lit. g DSGVO prüfen.",
                ),
                _finding(
                    measures,
                    "Wiederherstellungstests werden nach Bedarf durchgeführt; "
                    "Testergebnisse werden nicht dokumentiert.",
                    "Wirksamkeit der Wiederherstellung nachvollziehbar machen",
                    "Rhythmus, Verantwortlichkeit und Ergebnisse der Tests fehlen. Ohne "
                    "diese Angaben ist die Wirksamkeit der Maßnahme nicht nachvollziehbar.",
                    "Technische Maßnahmen",
                    legal_basis="Art. 32 Abs. 1 DSGVO; "
                    "risikoangemessene Verfahren und Nachweise prüfen.",
                ),
            ],
            timeline=[],
            questions=[
                "Welche Vertragspartei wird vertreten?",
                "Welche Unterauftragnehmer sind bereits genehmigt?",
                "Welche Wiederherstellungszeiten werden benötigt?",
            ],
        )
    if scenario == "dsfa":
        risks = documents[1]
        return ModelAnalysis(
            title="Videoanalyse · DSFA-Vorbereitung",
            summary="Die Unterlagen beschreiben "
            "eine flächendeckende Videoerfassung im Lager. Alternativen, Betroffenenzahl und "
            "vorgesehene Wirkung geplanter Maßnahmen fehlen für die weitere Risikobewertung.",
            findings=[
                _finding(
                    first,
                    "Kameras erfassen während der gesamten Schicht alle Arbeitsplätze im Lager.",
                    "Erfassungsumfang am Unfallzweck messen",
                    "Die Erfassung sämtlicher Arbeitsplätze kann Beschäftigte umfassend "
                    "beobachtbar machen. Gefahrenbereiche, Erforderlichkeit und weniger "
                    "eingriffsintensive Alternativen sind zu untersuchen; eine Zulässigkeit "
                    "lässt sich daraus noch nicht ableiten.",
                    "Erforderlichkeit",
                    legal_basis="Art. 35 Abs. 1 und Abs. 7 DSGVO; DSFA-Pflicht und "
                    "Prüfungsumfang anhand des vollständigen Sachverhalts bestimmen.",
                    severity="high",
                ),
                _finding(
                    first,
                    "Die Aufnahmen werden 90 Tage gespeichert und können von allen "
                    "Schichtleitungen abgerufen werden.",
                    "Speicherdauer und Zugriffe begründen",
                    "Warum der Unfallzweck 90 Tage Speicherung und Zugriff durch alle "
                    "Schichtleitungen erfordert, geht aus den Unterlagen nicht hervor. "
                    "Kürzere Fristen, Berechtigungen und Protokollierung sind zu bewerten.",
                    "Risikominderung",
                    legal_basis="Art. 5 Abs. 1 lit. c und e, "
                    "Art. 32 und Art. 35 Abs. 7 DSGVO prüfen.",
                ),
                _finding(
                    risks,
                    "Diese Maßnahmen sind noch nicht beschlossen oder technisch umgesetzt.",
                    "Vorgesehene Wirkung geplanter Maßnahmen bewerten",
                    "Beschränkte Bildbereiche und kürzere Speicherung sind bisher nur "
                    "erwogen. Vorgesehene Wirkung, zugrunde liegende Annahmen und späterer "
                    "Nachweisbedarf sind zu dokumentieren. Umsetzungsplanung und verbleibende "
                    "Risiken bleiben offen.",
                    "Planungsstand",
                    legal_basis="Abhilfemaßnahmen im Rahmen von "
                    "Art. 35 Abs. 7 lit. d DSGVO prüfen.",
                ),
            ],
            timeline=[],
            questions=[
                "Wie viele Beschäftigte und welche Bildbereiche werden erfasst?",
                "Welche Alternativen wurden geprüft und warum verworfen?",
                "Wer bewertet die verbleibenden Risiken und wann?",
            ],
        )
    if scenario == "advertising":
        return ModelAnalysis(
            title="Reinigungsmittel · Werbeprüfung",
            summary="Zwei absolute Werbeaussagen "
            "gehen über den dokumentierten Nachweisstand hinaus. Die Umweltmessung betrifft "
            "nur den Produktionsstandort; eine Untersuchung zu Allergierisiken fehlt.",
            findings=[
                _finding(
                    first,
                    "Unser Reiniger ist 100 % umweltneutral – "
                    "von der Herstellung bis zur Entsorgung.",
                    "Umweltaussage umfasst unbelegte Lebenszyklusphasen",
                    "Der Nachweisstand nennt nur eine interne Energiemessung am "
                    "Produktionsstandort. Transport, Nutzung und Entsorgung sind nicht "
                    "untersucht. Die umfassende Aussage ist damit durch diese Unterlagen "
                    "nicht belegt; Messverfahren und Aussagekontext bleiben zu prüfen.",
                    "Umweltaussage",
                    legal_basis="Irreführung und einschlägige Anforderungen an "
                    "Umweltaussagen nach dem UWG anhand des Veröffentlichungszeitpunkts prüfen.",
                    severity="high",
                ),
                _finding(
                    first,
                    "Er beseitigt sämtliche Allergierisiken in Ihrem Zuhause.",
                    "Pauschales Gesundheitsversprechen ohne Untersuchung",
                    "Der Entwurf verspricht die Beseitigung sämtlicher Allergierisiken. "
                    "Laut Nachweisnotiz wurde keine entsprechende Untersuchung durchgeführt. "
                    "Wirkung, Zielgruppe und erforderliche Belege sind vor Verwendung zu klären.",
                    "Gesundheitsaussage",
                    legal_basis="Irreführungsverbot nach § 5 UWG "
                    "und je nach Produkt weitere einschlägige Vorgaben prüfen.",
                    severity="high",
                ),
            ],
            timeline=[],
            questions=[
                "Welche konkrete Eigenschaft wurde mit welcher Methode gemessen?",
                "Wann und in welchem Medium soll die Werbung erscheinen?",
            ],
        )
    raise ValueError("Unbekanntes Beispielszenario.")


def demo_analysis(scenario: DemoScenario = "contract") -> Analysis:
    documents = demo_documents(scenario)
    if scenario == "contract":
        analysis = _contract_analysis()
        result = ModelAnalysis(
            title=analysis.title,
            summary=analysis.summary,
            findings=[
                ModelFinding.model_validate(item.model_dump(exclude={"id", "verified"}))
                for item in analysis.findings
            ],
            timeline=[],
            questions=analysis.questions,
        )
    else:
        result = _case(scenario, documents)
        analysis = Analysis(
            id=new_id(),
            title=result.title,
            workflow="compliance" if scenario in {"avv", "dsfa"} else scenario,
            summary=result.summary,
            findings=[],
            timeline=[],
            questions=result.questions,
            created_at=now(),
            model="Synthetisches Beispiel",
            effort="high",
            is_demo=True,
        )
    analysis.findings = verify_findings(result, documents)
    analysis.timeline = verify_timeline(result, documents)
    analysis.document_ids = [document.id for document in documents]
    analysis.compliance_task = scenario if scenario in {"avv", "dsfa"} else "general"
    analysis.demo_scenario = scenario
    return analysis
