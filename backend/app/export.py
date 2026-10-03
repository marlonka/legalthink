from __future__ import annotations

import io
from datetime import UTC, datetime

from docx import Document
from docx.opc.constants import RELATIONSHIP_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

from .schemas import Analysis

DISCLAIMER = (
    "Arbeitsentwurf zur anwaltlichen Prüfung. Zitatbestätigung belegt nur die "
    "Textfundstelle, nicht die rechtliche Richtigkeit. Änderungen sind Vorschläge."
)
PRIORITIES = {"high": "Hoch", "medium": "Mittel", "low": "Niedrig", "info": "Hinweis"}


def markdown(analysis: Analysis) -> bytes:
    lines = [f"# {analysis.title}", "", DISCLAIMER, ""]
    if analysis.is_demo:
        lines += ["**SYNTHETISCHES BEISPIEL · Keine Modellanalyse**", ""]
    lines += [
        f"Erstellt: {analysis.created_at}",
        f"Modell: {analysis.model}",
        f"Denktiefe: {analysis.effort}",
        "",
        "## Überblick",
        "",
        analysis.summary,
        "",
    ]
    for index, finding in enumerate(analysis.findings, 1):
        lines += [
            f"## {index}. {finding.title}",
            "",
            f"Priorität: {PRIORITIES[finding.severity]} · {finding.category}",
            "",
            finding.description,
            "",
            f"Fundstelle: {finding.source_location}",
            f"Zitat im Dokument bestätigt: {'Ja' if finding.verified else 'Nein'}",
            "",
            "> " + finding.source_quote.replace("\n", "\n> "),
            "",
            "**Formulierungsvorschlag**",
            "",
            finding.suggestion or "Kein Ersatztext.",
            "",
            "**Rechtlicher Bezug (zu prüfen)**",
            "",
            finding.legal_basis,
            "",
        ]
        if finding.source_urls:
            lines += ["Recherchequellen zum Befund:", *[f"- {u}" for u in finding.source_urls], ""]
    if analysis.timeline:
        lines += ["## Chronologie", ""]
        for event in analysis.timeline:
            lines += [
                f"### {event.date} · {event.event}",
                f"Quelle: {event.source}",
                "",
                "> " + event.source_quote.replace("\n", "\n> "),
                "",
                f"Zitat im Dokument bestätigt: {'Ja' if event.verified else 'Nein'}",
                f"Offen: {event.open_question}" if event.open_question else "",
                "",
            ]
    if analysis.questions:
        lines += ["## Offene Fragen", "", *[f"- {q}" for q in analysis.questions], ""]
    if analysis.sources:
        lines += ["## Recherchequellen", "", *[f"- {s.title}: {s.url}" for s in analysis.sources]]
    return "\n".join(lines).encode("utf-8")


def add_revision(paragraph, text: str, deletion: bool, revision_id: int) -> None:
    element = OxmlElement("w:del" if deletion else "w:ins")
    element.set(qn("w:id"), str(revision_id))
    element.set(qn("w:author"), "LegalThinkGPT · Vorschlag")
    element.set(qn("w:date"), datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"))
    run = OxmlElement("w:r")
    content = OxmlElement("w:delText" if deletion else "w:t")
    content.set(qn("xml:space"), "preserve")
    content.text = text
    run.append(content)
    element.append(run)
    paragraph._p.append(element)


def add_hyperlink(paragraph, label: str, url: str) -> None:
    relationship = paragraph.part.relate_to(url, RELATIONSHIP_TYPE.HYPERLINK, is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), relationship)
    run = OxmlElement("w:r")
    properties = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "183D37")
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    properties.extend([color, underline])
    run.append(properties)
    text = OxmlElement("w:t")
    text.text = label
    run.append(text)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)


def docx(analysis: Analysis) -> bytes:
    document = Document()
    section = document.sections[0]
    section.top_margin = section.bottom_margin = Inches(0.8)
    normal = document.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.paragraph_format.space_after = Pt(7)
    for name in ("Title", "Heading 1", "Heading 2"):
        document.styles[name].font.color.rgb = RGBColor.from_string("183D37")
    # Word metadata has a 255-character limit; the document heading keeps the full title.
    document.core_properties.title = analysis.title[:255]
    document.core_properties.author = "LegalThinkGPT"
    document.add_heading(analysis.title, 0)
    if analysis.is_demo:
        document.add_paragraph("SYNTHETISCHES BEISPIEL · Keine Modellanalyse", "Subtitle")
    document.add_paragraph(DISCLAIMER)
    document.add_paragraph(f"{analysis.created_at[:10]} · {analysis.model} · {analysis.effort}")
    document.add_heading("Überblick", 1)
    document.add_paragraph(analysis.summary)
    document.add_paragraph(
        "Die folgenden Revisionen stehen in diesem Prüfvermerk. "
        "Sie wurden nicht in das ursprüngliche Vertragsdokument eingesetzt."
    )
    for index, finding in enumerate(analysis.findings, 1):
        document.add_heading(f"{index}. {finding.title}", 1)
        document.add_paragraph(
            f"Priorität {PRIORITIES[finding.severity]} · {finding.category} · "
            f"{finding.source_location}"
        )
        document.add_paragraph(finding.description)
        document.add_heading("Text und Änderungsvorschlag", 2)
        if finding.verified and finding.source_quote and finding.suggestion:
            paragraph = document.add_paragraph()
            add_revision(paragraph, finding.source_quote, True, index * 2)
            add_revision(paragraph, finding.suggestion, False, index * 2 + 1)
            document.add_paragraph("Nachverfolgte Änderung · Zitat im Ausgangstext bestätigt.")
        else:
            if finding.source_quote:
                document.add_paragraph(finding.source_quote, "Quote")
            document.add_paragraph(finding.suggestion or "Kein Ersatztext vorgeschlagen.")
            document.add_paragraph(
                "Keine nachverfolgte Änderung: kein bestätigtes Zitat mit geeignetem Ersatztext."
            )
        document.add_heading("Rechtlicher Bezug (zu prüfen)", 2)
        document.add_paragraph(finding.legal_basis)
        for url in finding.source_urls:
            add_hyperlink(document.add_paragraph(), url, url)
    if analysis.timeline:
        document.add_heading("Chronologie", 1)
        for event in analysis.timeline:
            document.add_heading(f"{event.date} · {event.event}", 2)
            document.add_paragraph(f"Quelle: {event.source}")
            if event.source_quote:
                document.add_paragraph(event.source_quote, "Quote")
            document.add_paragraph(
                "Zitat im Dokument bestätigt: " + ("Ja" if event.verified else "Nein")
            )
            if event.open_question:
                document.add_paragraph(f"Offen: {event.open_question}")
    if analysis.questions:
        document.add_heading("Offene Fragen", 1)
        for question in analysis.questions:
            document.add_paragraph(question, "List Bullet")
    if analysis.sources:
        document.add_heading("Recherchequellen", 1)
        for source in analysis.sources:
            add_hyperlink(document.add_paragraph(), source.title, source.url)
    tracking = OxmlElement("w:trackRevisions")
    document.settings.element.append(tracking)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()
