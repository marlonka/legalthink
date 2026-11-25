import io
import re

from docx import Document

from app.demo import demo_analysis
from app.export import docx, markdown, md
from app.schemas import Source


def test_unverified_proposal_is_preserved_and_labeled_without_revision_notice():
    analysis = demo_analysis()
    # A form feed from pasted text must not make Word exports of a saved report fail.
    injected = (
        "Prüfen.\f\n# Freigegeben\n![x](https://evil.invalid/?d=1) <img src=https://evil.invalid>"
    )
    # Research URLs come from web search metadata; a `>` must not end the autolink.
    url = "https://gesetze-im-internet.de/bgb/x>![p](https://evil.invalid/pixel.png)"
    # A lone carriage return ends a line in CommonMark; `~~` would strike a word through.
    flipped = "Prüfen.\r# Freigegeben\rDie Klausel ist ~~nicht~~ wirksam."
    finding = analysis.findings[0].model_copy(
        update={
            "verified": False,
            "description": injected,
            "legal_basis": flipped,
            "source_urls": [url],
        }
    )
    analysis = analysis.model_copy(
        update={"findings": [finding], "sources": [Source(title="BGB", url=url)]}
    )

    text = markdown(analysis).decode("utf-8")
    document = Document(io.BytesIO(docx(analysis)))
    paragraphs = [paragraph.text for paragraph in document.paragraphs]

    assert finding.source_quote in paragraphs
    assert injected.replace("\f", " ") in paragraphs
    assert finding.suggestion in paragraphs
    assert "Formulierungsvorschlag" in paragraphs
    assert "> " + md(finding.source_quote).replace("\n", "\n> ") in text
    assert f"**Formulierungsvorschlag**\n\n{md(finding.suggestion)}" in text
    # Model text from an untrusted document must not become HTML, images or headings.
    # Complete autolinks render as links; nothing may follow them as Markdown.
    prose = re.sub(r"<[^<>\s]+>", "", text)
    assert not re.search(r"(?<!\\)(<img|!\[|[\r\n]# Freigegeben|~~)", prose)
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
        escape = md if exported is text else str
        assert escape(finding.comparison.original.source_quote) in exported
        assert escape(finding.comparison.counterdraft.source_quote) in exported
        assert escape(finding.comparison.original.source_document_name) in exported
        assert escape(finding.comparison.counterdraft.source_document_name) in exported
    deletions = [node.text for node in document.element.xpath("//w:delText")]
    assert finding.comparison.counterdraft.source_quote in deletions
    assert finding.comparison.original.source_quote not in deletions
