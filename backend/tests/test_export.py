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
