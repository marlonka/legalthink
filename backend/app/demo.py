"""Synthetic, deterministic fixture. It never calls an API or reads user documents."""

from .schemas import Analysis, Document, Finding, new_id, now

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


def demo_analysis() -> Analysis:
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
            "Ohne Zeitfenster oder Obergrenze kann Wartung die zugesagte Verfügbarkeit deutlich "
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
        effort="medium",
        is_demo=True,
    )
