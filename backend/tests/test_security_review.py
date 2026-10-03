"""Independent regressions for document-import and evidence trust boundaries."""

import io
import zipfile
from pathlib import Path
from xml.etree import ElementTree

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import ArrayObject, DecodedStreamObject, DictionaryObject, NameObject

from app.analysis import verify_findings, verify_timeline
from app.config import Settings
from app.demo import demo_analysis
from app.export import docx
from app.extraction import ExtractionError, extract, extract_isolated
from app.main import create_app
from app.schemas import Document, ModelAnalysis


def test_word_export_bounds_metadata_without_truncating_visible_title():
    title = "Prüfung eines umfangreichen Rahmenvertrags – " * 8
    analysis = demo_analysis().model_copy(update={"title": title})
    with zipfile.ZipFile(io.BytesIO(docx(analysis))) as archive:
        metadata = ElementTree.fromstring(archive.read("docProps/core.xml"))
        document = ElementTree.fromstring(archive.read("word/document.xml"))
    metadata_title = metadata.find("{http://purl.org/dc/elements/1.1/}title")
    assert metadata_title is not None
    assert metadata_title.text == title[:255]
    assert title in "".join(document.itertext())


@pytest.mark.asyncio
async def test_document_worker_imports_when_server_started_outside_backend(tmp_path, monkeypatch):
    """The supported root-level dev launcher must still be able to import the worker."""
    monkeypatch.chdir(tmp_path)
    text, pages = await extract_isolated("Ein prüfbarer Vertragstext.".encode(), ".txt")
    assert text == "Ein prüfbarer Vertragstext."
    assert pages == 1
    assert list(Path(tmp_path).iterdir()) == []


def _finding_for(document, quote, claimed_location):
    return ModelAnalysis.model_validate(
        {
            "title": "Prüfung",
            "summary": "Ein synthetischer Befund.",
            "findings": [
                {
                    "title": "Klausel",
                    "severity": "medium",
                    "category": "Vertrag",
                    "description": "Prüfbedarf.",
                    "source_quote": quote,
                    "source_document_id": document.id,
                    "source_location": claimed_location,
                    "suggestion": "",
                    "legal_basis": "",
                    "source_urls": [],
                }
            ],
            "timeline": [],
            "questions": [],
        }
    )


def test_text_document_cannot_forge_pdf_page_provenance():
    quote = "Eine konkrete Klausel mit überprüfbarem Wortlaut."
    text = f"[Seite 999]\n{quote}"
    document = Document(
        id="text-1", name="vertrag.txt", text=text, page_count=1, char_count=len(text)
    )
    finding = verify_findings(_finding_for(document, quote, "Seite 777"), [document])[0]
    assert finding.verified is True
    assert finding.source_location == "Textfundstelle"


def test_cross_page_match_never_keeps_model_invented_location():
    text = "[Seite 1]\nDer Anspruch besteht\n\n[Seite 2]\nfür beide Vertragsparteien."
    quote = "Der Anspruch besteht\n\n[Seite 2]\nfür beide Vertragsparteien."
    document = Document(
        id="pdf-1", name="vertrag.pdf", text=text, page_count=2, char_count=len(text)
    )
    finding = verify_findings(_finding_for(document, quote, "Seite 777"), [document])[0]
    assert finding.verified is True
    assert finding.source_location == "Textfundstelle"


def test_timeline_checks_quote_and_replaces_model_claimed_source():
    text = "Am 2. Oktober ging die Kündigung beim Empfänger ein."
    document = Document(
        id="proof-1", name="Empfang.txt", text=text, page_count=1, char_count=len(text)
    )
    event = {
        "date": "2026-10-02",
        "event": "Zugang der Kündigung",
        "open_question": "",
        "source": "Erfundene Gerichtsakte, Seite 777",
        "source_document_id": document.id,
        "source_quote": text,
    }
    result = ModelAnalysis.model_validate(
        {
            "title": "Chronologie",
            "summary": "Zwei Ereignisse",
            "findings": [],
            "questions": [],
            "timeline": [event, {**event, "source_quote": "Die Kündigung ging niemals zu."}],
        }
    )
    verified, invented = verify_timeline(result, [document])
    assert verified.verified is True
    assert verified.source == f"Empfang.txt: {text}"
    assert invented.verified is False
    assert invented.source == "Beleg nicht bestätigt"


@pytest.fixture
def local_client(tmp_path):
    with TestClient(
        create_app(Settings(data_dir=tmp_path)),
        base_url="http://localhost",
        client=("127.0.0.1", 12345),
    ) as client:
        yield client


@pytest.mark.parametrize(
    "origin", ["https://attacker.example", "null", "http://localhost:5175.attacker.example"]
)
def test_browser_origin_blocks_reads_and_writes_without_touching_storage(local_client, origin):
    private = {"name": "Mandat", "content": "Vertraulicher synthetischer Inhalt"}
    control = local_client.post(
        "/api/playbooks", json=private, headers={"Origin": "http://localhost:5175"}
    )
    assert control.status_code == 201
    denied_write = local_client.post("/api/playbooks", json=private, headers={"Origin": origin})
    denied_read = local_client.get("/api/playbooks", headers={"Origin": origin})
    assert denied_write.status_code == denied_read.status_code == 403
    assert private["content"] not in denied_read.text
    assert len(local_client.get("/api/playbooks").json()) == 1


def test_rebinding_host_cannot_use_permitted_origin_to_mutate_workspace(local_client):
    response = local_client.post(
        "/api/playbooks",
        json={"name": "Untrusted", "content": "Must never persist"},
        headers={"Host": "rebind.attacker.example", "Origin": "http://localhost:5175"},
    )
    assert response.status_code == 403
    assert local_client.get("/api/playbooks").json() == []


def test_remote_client_cannot_spoof_loopback_using_forwarded_headers(tmp_path):
    with TestClient(
        create_app(Settings(data_dir=tmp_path)),
        base_url="http://localhost",
        client=("198.51.100.24", 12345),
    ) as client:
        response = client.get("/api/documents", headers={"X-Forwarded-For": "127.0.0.1"})
    assert response.status_code == 403


def test_remote_api_requires_token_and_origin_even_after_successful_preflight(tmp_path):
    token = "synthetic-token-for-offline-tests-only"
    app = create_app(
        Settings(
            data_dir=tmp_path,
            allow_remote=True,
            api_token=token,
            allowed_origins=("https://review.example",),
            allowed_hosts=("review.example",),
        )
    )
    with TestClient(
        app, base_url="https://review.example", client=("198.51.100.24", 12345)
    ) as client:
        preflight = client.options(
            "/api/playbooks",
            headers={
                "Origin": "https://review.example",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization",
            },
        )
        assert preflight.status_code == 200
        assert client.get("/api/playbooks").status_code == 401
        assert (
            client.get("/api/playbooks", headers={"Authorization": "Bearer wrong"}).status_code
            == 401
        )
        authorized = {"Authorization": f"Bearer {token}", "Origin": "https://review.example"}
        assert client.get("/api/playbooks", headers=authorized).json() == []
        assert (
            client.get("/api/playbooks", headers={**authorized, "Origin": "null"}).status_code
            == 403
        )


def test_validation_errors_never_echo_sensitive_request_values(local_client):
    private = "SYNTHETIC-CONFIDENTIAL-CONTEXT"
    response = local_client.post(
        "/api/analyses",
        json={
            "workflow": "contract",
            "document_ids": ["a"],
            "context": private,
            "model": "gpt-6.1-sol",
            "effort": "none",
        },
    )
    assert response.status_code == 422
    assert private not in response.text


_PDF_TEXT = b"BT /F1 12 Tf 72 720 Td (Ein pruefbarer Vertragstext.) Tj ET"


def _pdf_with_streams(streams):
    """Build a real, readable PDF without fixtures from outside this repository."""
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    page[NameObject("/Resources")] = DictionaryObject(
        {
            NameObject("/Font"): DictionaryObject(
                {
                    NameObject("/F1"): DictionaryObject(
                        {
                            NameObject("/Type"): NameObject("/Font"),
                            NameObject("/Subtype"): NameObject("/Type1"),
                            NameObject("/BaseFont"): NameObject("/Helvetica"),
                        }
                    ),
                }
            ),
        }
    )
    encoded = []
    for content in streams:
        stream = DecodedStreamObject()
        stream.set_data(content)
        encoded.append(writer._add_object(stream.flate_encode()))
    page[NameObject("/Contents")] = encoded[0] if len(encoded) == 1 else ArrayObject(encoded)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.mark.parametrize("split", [False, True], ids=["compressed-stream", "stream-array"])
def test_pdf_rejects_excessive_expansion_before_text_parsing(split):
    control, _ = extract(_pdf_with_streams([_PDF_TEXT]), ".pdf")
    assert "Ein pruefbarer Vertragstext." in control
    half = b" " * (2 * 1024 * 1024)
    streams = [half, half + _PDF_TEXT] if split else [half + half + _PDF_TEXT]
    data = _pdf_with_streams(streams)
    assert len(data) < 12 * 1024  # Small on disk; larger than the decoded-content budget.
    with pytest.raises(ExtractionError, match="zu komplex"):
        extract(data, ".pdf")
