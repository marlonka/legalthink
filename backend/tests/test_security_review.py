"""Independent regressions for document-import and evidence trust boundaries."""

import io

import pytest
from docx import Document as WordDocument
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import ArrayObject, DecodedStreamObject, DictionaryObject, NameObject

from app.config import Settings
from app.demo import demo_analysis
from app.extraction import ExtractionError, extract
from app.main import create_app
from app.schemas import Document, TimelineEntry


@pytest.fixture
def local_client(tmp_path):
    with TestClient(
        create_app(Settings(data_dir=tmp_path)),
        base_url="http://localhost",
        client=("127.0.0.1", 12345),
    ) as client:
        yield client


@pytest.mark.parametrize("origin", ["null", "http://localhost:5175.attacker.example"])
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


def _original_file(suffix, text):
    if suffix == ".pdf":
        return _pdf_with_streams([_PDF_TEXT.replace(b"Vertragstext", text.encode())])
    if suffix == ".docx":
        document = WordDocument()
        document.add_paragraph(text)
        document.add_table(rows=1, cols=1).cell(0, 0).text = "In der Tabelle"
        document.add_paragraph("Nach der Tabelle")
        output = io.BytesIO()
        document.save(output)
        return output.getvalue()
    raise ValueError(suffix)


@pytest.mark.parametrize(
    ("suffix", "media_type"),
    [
        (".pdf", "application/pdf"),
        (".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ],
)
def test_original_roundtrip_legacy_attachment_and_deletion(local_client, suffix, media_type):
    original = _original_file(suffix, "Vertragstext")
    long_name = f"{'Vertrag' * 30}{suffix}"
    response = local_client.post("/api/documents", files={"file": (long_name, original)})
    assert response.status_code == 201
    uploaded = response.json()
    name = uploaded["name"]
    assert len(name) == 180 and name.endswith(suffix)
    if suffix == ".docx":
        assert uploaded["text"].splitlines() == [
            "Vertragstext",
            "",
            "In der Tabelle",
            "",
            "Nach der Tabelle",
        ]
        assert uploaded["page_count"] == 0
    original_url = f"/api/documents/{uploaded['id']}/original"
    assert uploaded["original_available"] is True
    downloaded = local_client.get(original_url)
    assert downloaded.content == original
    assert downloaded.headers["cache-control"] == "no-store"
    assert "content-encoding" not in downloaded.headers
    assert downloaded.headers["content-type"].startswith(media_type)
    assert name in downloaded.headers["content-disposition"]
    legacy = {**uploaded, "id": "legacy-source", "original_available": False}
    local_client.app.state.store.put("documents", legacy)
    legacy_url = "/api/documents/legacy-source/original"
    assert local_client.get(legacy_url).status_code == 404
    wrong_original = _original_file(suffix, "anderer Text")
    assert local_client.put(legacy_url, files={"file": (name, wrong_original)}).status_code == 422
    assert local_client.get(legacy_url).status_code == 404
    assert local_client.put(legacy_url, files={"file": ("Wrong.exe", original)}).status_code == 422
    attached = local_client.put(legacy_url, files={"file": (long_name, original)})
    assert attached.status_code == 200 and attached.json()["original_available"] is True
    assert local_client.get(legacy_url).content == original
    assert local_client.put(legacy_url, files={"file": (name, original)}).status_code == 409
    assert local_client.get(legacy_url).content == original
    assert local_client.delete(f"/api/documents/{uploaded['id']}").status_code == 204
    assert local_client.get(original_url).status_code == 404
    assert local_client.app.state.store.original(uploaded["id"]) is None
    assert (
        local_client.request(
            "DELETE", "/api/documents", json={"document_ids": ["legacy-source"]}
        ).status_code
        == 204
    )
    assert local_client.app.state.store.original("legacy-source") is None
    assert local_client.get("/api/documents/legacy-source/text").status_code == 404


def test_malformed_source_id_recovers_only_from_unique_case_source(local_client):
    text = "Wir werden die aufgeführten Schäden wie besprochen instandsetzen."
    document = Document(
        id="11111111-1111-4111-a123-456789abcdef",
        name="Eingefügter Text.txt",
        text=text,
        page_count=1,
        char_count=len(text),
    )
    event = TimelineEntry(
        date="2026-10-02",
        event="Reparatur zugesagt",
        source="Beleg nicht bestätigt",
        open_question="",
        source_document_id="model-typo",
        source_quote=text,
        verified=False,
    )
    report = demo_analysis().model_copy(
        update={
            "workflow": "chronology",
            "findings": [],
            "document_ids": [],
            "source_text_document_id": document.id,
            "timeline": [event],
        }
    )
    store = local_client.app.state.store
    store.save_analysis(report.model_dump(), document.model_dump())
    url = f"/api/analyses/{report.id}"
    recovered = local_client.get(url).json()["timeline"][0]
    assert recovered["source_document_id"] == document.id and recovered["verified"] is True
    assert recovered["source"] == document.name
    assert local_client.get("/api/analyses").json()[0]["timeline"][0] == recovered
    assert store.get("analyses", report.id)["timeline"][0]["source_document_id"] == "model-typo"
    # An identical quote in an unrelated file must not affect this case.
    other = document.model_copy(update={"id": "other", "name": "Andere Quelle.txt"})
    store.put("documents", other.model_dump())
    assert local_client.get(url).json()["timeline"][0]["verified"] is True
    report.document_ids = [other.id]
    store.put("analyses", report.model_dump())
    assert local_client.get(url).json()["timeline"][0]["verified"] is False
    # A transposed UUID digit identifies one source even if several quote the email.
    report.timeline[0].source_document_id = "11111111-1111-4111-a124-356789abcdef"
    store.put("analyses", report.model_dump())
    repaired = local_client.get(url).json()["timeline"][0]
    assert repaired["source_document_id"] == document.id and repaired["verified"] is True
    # A deleted, correctly identified source must never switch to another document.
    report.timeline[0].source_document_id = document.id
    store.put("analyses", report.model_dump())
    store.delete("documents", document.id)
    deleted = local_client.get(url).json()["timeline"][0]
    assert deleted["source_document_id"] == document.id and deleted["verified"] is False


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
