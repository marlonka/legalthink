import io

from docx import Document

from app.demo import demo_analysis
from app.export import docx, markdown


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


def test_comparison_exports_both_versions_and_revises_only_counterdraft():
    title = "Prüfung eines umfangreichen Rahmenvertrags – " * 8
    analysis = demo_analysis("compare").model_copy(update={"title": title})
    finding = analysis.findings[0]
    text = markdown(analysis).decode("utf-8")
    document = Document(io.BytesIO(docx(analysis)))
    paragraphs = "\n".join(paragraph.text for paragraph in document.paragraphs)
    assert document.core_properties.title == title[:255]
    assert title in paragraphs
    assert "SYNTHETISCHES BEISPIEL" in paragraphs
    assert "ursprüngliche Vertragsdokument" in paragraphs
    assert finding.suggestion in [node.text for node in document.element.xpath("//w:ins//w:t")]
    for exported in (text, paragraphs):
        assert "Original" in exported and "Gegenentwurf" in exported
        assert finding.comparison.original.source_quote in exported
        assert finding.comparison.counterdraft.source_quote in exported
        assert finding.comparison.original.source_document_name in exported
        assert finding.comparison.counterdraft.source_document_name in exported
    deletions = [node.text for node in document.element.xpath("//w:delText")]
    assert finding.comparison.counterdraft.source_quote in deletions
    assert finding.comparison.original.source_quote not in deletions
