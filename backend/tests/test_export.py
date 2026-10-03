import io

import pytest
from docx import Document
from docx.oxml.ns import qn

from app.demo import demo_analysis
from app.export import docx, markdown
from app.schemas import Analysis


@pytest.mark.parametrize("include_document_names", [True, False])
def test_finding_exports_identify_documents_and_support_legacy_records(include_document_names):
    record = demo_analysis("compare").model_dump()
    names = ["Kunden-E-Mail.txt", "Wareneingangsnotiz.txt"]
    for finding, name in zip(record["findings"], names, strict=True):
        finding.update(source_location="Seite 2", category="Beweismittel", severity="medium")
        if include_document_names:
            finding["source_document_name"] = name
        else:
            finding.pop("source_document_name", None)
    analysis = Analysis.model_validate(record)

    text = markdown(analysis).decode("utf-8")
    paragraphs = [paragraph.text for paragraph in Document(io.BytesIO(docx(analysis))).paragraphs]

    for name in names:
        source = f"{name} · Seite 2" if include_document_names else "Seite 2"
        assert f"Fundstelle: {source}" in text.splitlines()
        assert f"Priorität Mittel · Beweismittel · {source}" in paragraphs


def test_chronology_exports_keep_evidence_without_empty_contract_sections():
    analysis = demo_analysis("chronology")

    text = markdown(analysis).decode("utf-8")
    document = Document(io.BytesIO(docx(analysis)))
    paragraphs = [paragraph.text for paragraph in document.paragraphs]
    word_text = "\n".join(paragraphs)

    for exported in (text, word_text):
        assert "Chronologie" in exported
        assert "Formulierungsvorschlag" not in exported
        assert "Text und Änderungsvorschlag" not in exported
        assert "Kein Ersatztext" not in exported
        assert "folgenden Revisionen" not in exported
        assert "Keine nachverfolgte Änderung" not in exported
        assert "Zitat im Dokument bestätigt: Ja (nur Textabgleich)." in exported
        assert "nicht die behaupteten Tatsachen" in exported
    for finding in analysis.findings:
        assert finding.source_quote in paragraphs
        assert "> " + finding.source_quote.replace("\n", "\n> ") in text
    assert document.element.xpath("//w:del | //w:ins") == []
    assert document.settings.element.find(qn("w:trackRevisions")) is None


def test_unverified_proposal_is_preserved_and_labeled_without_revision_notice():
    analysis = demo_analysis()
    finding = analysis.findings[0].model_copy(update={"verified": False})
    analysis = analysis.model_copy(update={"findings": [finding]})

    text = markdown(analysis).decode("utf-8")
    document = Document(io.BytesIO(docx(analysis)))
    paragraphs = [paragraph.text for paragraph in document.paragraphs]

    assert finding.source_quote in paragraphs
    assert finding.suggestion in paragraphs
    assert "Formulierungsvorschlag" in paragraphs
    assert "> " + finding.source_quote.replace("\n", "\n> ") in text
    assert f"**Formulierungsvorschlag**\n\n{finding.suggestion}" in text
    for exported in (text, "\n".join(paragraphs)):
        assert "Zitat im Dokument bestätigt: Nein." in exported
        assert "folgenden Revisionen" not in exported
    assert document.element.xpath("//w:del | //w:ins") == []


def test_findings_without_quotes_do_not_export_empty_evidence_or_legal_sections():
    analysis = demo_analysis()
    finding = analysis.findings[0].model_copy(
        update={"source_quote": "", "suggestion": "", "legal_basis": "", "verified": False}
    )
    analysis = analysis.model_copy(update={"findings": [finding], "timeline": []})

    text = markdown(analysis).decode("utf-8")
    document = Document(io.BytesIO(docx(analysis)))
    word_text = "\n".join(paragraph.text for paragraph in document.paragraphs)

    assert not any(line.startswith(">") for line in text.splitlines())
    for exported in (text, word_text):
        assert finding.description in exported
        assert "Zitat im Dokument bestätigt:" not in exported
        assert "Formulierungsvorschlag" not in exported
        assert "Rechtlicher Bezug (zu prüfen)" not in exported
    assert document.element.xpath("//w:del | //w:ins") == []
