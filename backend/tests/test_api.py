import io
import zipfile
from dataclasses import replace

import pytest
from docx import Document as WordDocument
from fastapi.testclient import TestClient
from lxml import etree
from pypdf import PdfWriter

from app.analysis import AnalysisError
from app.config import Settings
from app.extraction import ExtractionError, extract
from app.main import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app(Settings(data_dir=tmp_path, api_key=""))
    with TestClient(app, base_url="http://localhost", client=("127.0.0.1", 12345)) as client:
        yield client


def test_document_playbook_and_analysis_persistence(tmp_path):
    settings = Settings(data_dir=tmp_path, api_key="")
    with TestClient(
        create_app(settings), base_url="http://localhost", client=("127.0.0.1", 12345)
    ) as client:
        response = client.post(
            "/api/documents",
            files={
                "file": ("../../Mandat.txt", "Vertragsinhalt mit Umlauten: Kündigung.".encode())
            },
        )
        assert response.status_code == 201, response.text
        document = response.json()
        assert document["name"] == "Mandat.txt"
        assert document["char_count"] == 39
        book = client.post(
            "/api/playbooks", json={"name": "Kundensicht", "content": "Haftung prüfen."}
        )
        assert book.status_code == 201
        demo = client.post("/api/demo").json()
        assert demo["is_demo"] is True and demo["model"] == "Synthetisches Beispiel"
    with TestClient(
        create_app(settings), base_url="http://localhost", client=("127.0.0.1", 12345)
    ) as client:
        assert any(d["id"] == document["id"] for d in client.get("/api/documents").json())
        assert client.get(f"/api/analyses/{demo['id']}").json()["is_demo"] is True
        assert len(client.get("/api/playbooks").json()) == 1
        assert client.delete(f"/api/documents/{document['id']}").status_code == 204
        assert client.delete(f"/api/analyses/{demo['id']}").status_code == 204
        assert client.delete(f"/api/playbooks/{book.json()['id']}").status_code == 204
        assert client.delete(f"/api/documents/{document['id']}").status_code == 404


def test_analysis_without_config_returns_explicit_error(client):
    response = client.post("/api/analyses", json={"workflow": "contract", "document_ids": ["doc"]})
    assert response.status_code == 503
    assert "nicht eingerichtet" in response.json()["detail"]
    assert client.get("/api/analyses").json() == []


def test_playbook_edits_preserve_identity_and_survive_restart(tmp_path):
    settings = Settings(data_dir=tmp_path, api_key="")
    with TestClient(
        create_app(settings), base_url="http://localhost", client=("127.0.0.1", 12345)
    ) as client:
        original = client.post(
            "/api/playbooks", json={"name": "Kundensicht", "content": "Haftung prüfen."}
        ).json()
        edited = client.put(
            f"/api/playbooks/{original['id']}",
            json={"name": "Kundensicht · SaaS", "content": "Haftung und Datenexport prüfen."},
        )
        assert edited.status_code == 200
        expected = {
            **original,
            "name": "Kundensicht · SaaS",
            "content": "Haftung und Datenexport prüfen.",
        }
        assert edited.json() == expected
    with TestClient(
        create_app(settings), base_url="http://localhost", client=("127.0.0.1", 12345)
    ) as client:
        assert client.get("/api/playbooks").json() == [expected]


def test_playbook_edit_rejects_missing_and_invalid_records_without_changes(client):
    original = client.post(
        "/api/playbooks", json={"name": "Kundensicht", "content": "Haftung prüfen."}
    ).json()
    valid = {"name": "Neue Fassung", "content": "Haftung und Verfügbarkeit prüfen."}
    assert client.put("/api/playbooks/does-not-exist", json=valid).status_code == 404
    invalid = client.put(f"/api/playbooks/{original['id']}", json={**valid, "content": "   "})
    assert invalid.status_code == 422
    assert client.get("/api/playbooks").json() == [original]


def test_playbook_edit_cors_preflight_allows_configured_origin(client):
    origin = Settings().allowed_origins[0]
    response = client.options(
        "/api/playbooks/example",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == origin
    assert "PUT" in response.headers["Access-Control-Allow-Methods"]


@pytest.mark.parametrize(
    "body",
    [
        {"workflow": "compare", "document_ids": ["a"]},
        {"workflow": "contract", "document_ids": ["a", "a"]},
        {"workflow": "contract", "document_ids": ["a"], "model": "gpt-6.1-sol", "effort": "none"},
        {"workflow": "contract", "document_ids": ["a"], "effort": "ultra"},
        {"workflow": "contract", "document_ids": ["a"], "context": "PRIVATE" * 4000},
    ],
)
def test_invalid_analysis_inputs_never_echo_document_text(client, body):
    response = client.post("/api/analyses", json=body)
    assert response.status_code == 422
    assert "PRIVATE" not in response.text


def test_model_options_and_optional_luna_none(client):
    models = client.get("/api/models").json()["models"]
    assert {m["id"] for m in models} == {"gpt-6.1-sol", "gpt-6-luna"}
    luna = next(model for model in models if model["id"] == "gpt-6-luna")
    assert luna["default_effort"] == "high"
    response = client.post(
        "/api/analyses",
        json={
            "workflow": "contract",
            "document_ids": ["doc"],
            "model": "gpt-6-luna",
            "effort": "none",
        },
    )
    assert response.status_code == 503  # Valid settings reach credential boundary.


def test_exports_have_actual_tracked_changes_and_demo_label(client):
    analysis = client.post("/api/demo").json()
    docx = client.get(f"/api/analyses/{analysis['id']}/export?format=docx")
    assert docx.status_code == 200
    with zipfile.ZipFile(io.BytesIO(docx.content)) as archive:
        xml = etree.fromstring(archive.read("word/document.xml"))
        namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        assert len(xml.findall(".//w:del", namespace)) == 3
        assert len(xml.findall(".//w:ins", namespace)) == 3
        assert "SYNTHETISCHES BEISPIEL" in "".join(xml.itertext())
        assert "ursprüngliche Vertragsdokument" in "".join(xml.itertext())
    markdown = client.get(f"/api/analyses/{analysis['id']}/export?format=md")
    assert "SYNTHETISCHES BEISPIEL" in markdown.text
    assert "Zitat im Dokument bestätigt: Ja" in markdown.text


def test_unverified_quotes_never_become_word_revisions(client):
    analysis = client.post("/api/demo").json()
    analysis["findings"][0]["verified"] = False
    client.app.state.store.put("analyses", analysis)
    response = client.get(f"/api/analyses/{analysis['id']}/export?format=docx")
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        xml = etree.fromstring(archive.read("word/document.xml"))
        assert (
            len(xml.findall(".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}del"))
            == 2
        )


def test_word_research_sources_are_clickable_relationships(client):
    analysis = client.post("/api/demo").json()
    url = "https://www.gesetze-im-internet.de/bgb/__276.html"
    analysis["findings"][0]["source_urls"] = [url]
    analysis["sources"] = [{"title": "§ 276 BGB", "url": url}]
    client.app.state.store.put("analyses", analysis)
    response = client.get(f"/api/analyses/{analysis['id']}/export?format=docx")
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        xml = etree.fromstring(archive.read("word/document.xml"))
        links = xml.findall(
            ".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}hyperlink"
        )
        assert len(links) == 2
        relationships = etree.fromstring(archive.read("word/_rels/document.xml.rels"))
        assert any(
            rel.get("Target") == url and rel.get("TargetMode") == "External"
            for rel in relationships
        )


def test_bounded_upload_rejects_unsupported_and_oversized(client, tmp_path):
    assert (
        client.post("/api/documents", files={"file": ("malware.exe", b"data")}).status_code == 415
    )
    settings = replace(Settings(data_dir=tmp_path), max_upload_bytes=20, max_request_bytes=5000)
    with TestClient(
        create_app(settings), base_url="http://localhost", client=("127.0.0.1", 12345)
    ) as bounded:
        assert (
            bounded.post("/api/documents", files={"file": ("x.txt", b"a" * 21)}).status_code == 413
        )
        assert (
            bounded.post(
                "/api/playbooks", content=b"x", headers={"Content-Length": "9000"}
            ).status_code
            == 413
        )
        assert bounded.get("/api/documents").json() == []


def test_scanned_pdf_and_empty_or_long_text_rejected():
    pdf = PdfWriter()
    pdf.add_blank_page(width=100, height=100)
    data = io.BytesIO()
    pdf.write(data)
    with pytest.raises(ExtractionError, match="OCR"):
        extract(data.getvalue(), ".pdf")
    with pytest.raises(ExtractionError, match="leer"):
        extract(b"", ".txt")
    with pytest.raises(ExtractionError, match="lang"):
        extract(b"a" * 200001, ".txt")


def test_docx_table_and_paragraph_order():
    document = WordDocument()
    document.add_paragraph("Vor der Tabelle")
    document.add_table(rows=1, cols=1).cell(0, 0).text = "In der Tabelle"
    document.add_paragraph("Nach der Tabelle")
    output = io.BytesIO()
    document.save(output)
    text, pages = extract(output.getvalue(), ".docx")
    assert text == "Vor der Tabelle\n\nIn der Tabelle\n\nNach der Tabelle"
    assert pages == 0


def test_failed_upstream_analysis_is_not_persisted(client):
    class FailedService:
        async def run(self, *args):
            raise AnalysisError("Die Modellantwort ist unvollständig.")

    client.app.state.analysis_service = FailedService()
    document = client.post(
        "/api/documents", files={"file": ("x.txt", b"Some contract text.")}
    ).json()
    response = client.post(
        "/api/analyses", json={"workflow": "contract", "document_ids": [document["id"]]}
    )
    assert response.status_code == 502
    assert client.get("/api/analyses").json() == []


def test_unexpected_exception_never_escapes_to_asgi_server_logging(client):
    class UnexpectedFailure:
        async def run(self, *args):
            raise ValueError("SYNTHETIC PRIVATE DOCUMENT AND KEY")

    client.app.state.analysis_service = UnexpectedFailure()
    document = client.post("/api/documents", files={"file": ("x.txt", b"Contract text.")}).json()
    # TestClient raises escaped server errors by default, even after a 500 handler.
    response = client.post(
        "/api/analyses", json={"workflow": "contract", "document_ids": [document["id"]]}
    )
    assert response.status_code == 500
    assert "PRIVATE" not in response.text
    assert client.get("/api/analyses").json() == []


def test_streamed_body_limit_without_content_length(tmp_path):
    settings = replace(Settings(data_dir=tmp_path), max_request_bytes=128)
    with TestClient(
        create_app(settings), base_url="http://localhost", client=("127.0.0.1", 12345)
    ) as bounded:
        response = bounded.post(
            "/api/playbooks",
            content=iter([b"x" * 64] * 3),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 413
        assert bounded.get("/api/playbooks").json() == []
