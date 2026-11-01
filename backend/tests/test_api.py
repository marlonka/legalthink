import asyncio
import io
import sqlite3
import threading
from dataclasses import replace

import httpx2
import pytest
from docx import Document as WordDocument
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from fastapi import Request
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from app.analysis import AnalysisError
from app.config import Settings
from app.extraction import ExtractionError, extract
from app.main import create_app
from app.schemas import Analysis, Document, Finding, TimelineEntry, new_id, now


@pytest.fixture
def client(tmp_path):
    app = create_app(Settings(data_dir=tmp_path, api_key=""))
    with TestClient(app, base_url="http://localhost", client=("127.0.0.1", 12345)) as client:
        yield client


class CompletedService:
    """Substitute the provider service, leaving API storage and validation intact."""

    def __init__(self):
        self.calls = []

    async def run(self, body, documents, playbook, *, pasted_document=None):
        self.calls.append((body, documents, pasted_document))
        return Analysis(
            id=new_id(),
            title="Offline-Ergebnis",
            workflow=body.workflow,
            summary="Prüfung beendet.",
            findings=[],
            timeline=[],
            questions=[],
            created_at=now(),
            model=body.model,
            effort=body.effort,
            is_demo=False,
            document_ids=body.document_ids,
            source_text_document_id=pasted_document.id if pasted_document else None,
            compliance_task=body.compliance_task,
        )


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
        original_url = f"/api/documents/{document['id']}/original"
        assert (
            client.get(original_url).content == "Vertragsinhalt mit Umlauten: Kündigung.".encode()
        )
        unavailable = client.post(
            "/api/analyses", json={"workflow": "contract", "document_ids": [document["id"]]}
        )
        assert unavailable.status_code == 503
        assert client.get("/api/analyses").json() == []
        book = client.post(
            "/api/playbooks", json={"name": "Kundensicht", "content": "Haftung prüfen."}
        )
        assert book.status_code == 201
        edited = client.put(
            f"/api/playbooks/{book.json()['id']}",
            json={"name": "Kundensicht · SaaS", "content": "Haftung und Datenexport prüfen."},
        )
        assert edited.status_code == 200
        assert edited.json() == {
            **book.json(),
            "name": "Kundensicht · SaaS",
            "content": "Haftung und Datenexport prüfen.",
        }
        demo = client.post("/api/demo", json={"scenario": "compare"}).json()
        assert demo["is_demo"] is True and demo["model"] == "Synthetisches Beispiel"
        # Existing installations had no demo flag and allowed deleting example sources.
        first_id, second_id = demo["document_ids"]
        legacy_source = client.app.state.store.get("documents", first_id)
        legacy_source.pop("is_demo")
        client.app.state.store.put("documents", legacy_source)
        with client.app.state.store.connection() as db:
            db.execute("DELETE FROM documents WHERE id=?", (second_id,))
    with TestClient(
        create_app(settings), base_url="http://localhost", client=("127.0.0.1", 12345)
    ) as client:
        assert any(d["id"] == document["id"] for d in client.get("/api/documents").json())
        restored = client.get(f"/api/analyses/{demo['id']}").json()
        assert restored["is_demo"] is True
        assert restored["findings"] == demo["findings"]
        sources = {doc["id"]: doc for doc in client.get("/api/documents").json()}
        for source_id in demo["document_ids"]:
            assert sources[source_id]["is_demo"] is True
            assert client.get(f"/api/documents/{source_id}/text").status_code == 200
            assert client.delete(f"/api/documents/{source_id}").status_code == 409
        assert client.get("/api/playbooks").json() == [edited.json()]
        assert client.delete(f"/api/documents/{document['id']}").status_code == 204
        assert client.get(original_url).status_code == 404
        assert client.delete(f"/api/analyses/{demo['id']}").status_code == 204
        assert client.delete(f"/api/playbooks/{book.json()['id']}").status_code == 204
        assert client.delete(f"/api/documents/{document['id']}").status_code == 404


def test_bulk_document_deletion_only_removes_confirmed_sources(client):
    analysis = client.post("/api/demo").json()
    client.post("/api/playbooks", json={"name": "Standard", "content": "Haftung prüfen."})
    example = client.get("/api/documents").json()[0]
    # User uploads remain deletable even with the same filename and text as an example.
    uploaded = Document(
        id=new_id(),
        name=example["name"],
        text=example["text"],
        page_count=1,
        char_count=example["char_count"],
        original_available=True,
    )
    client.app.state.store.save_document(uploaded.model_dump(), uploaded.text.encode())
    previous = client.get("/api/documents").json()
    assert client.request("DELETE", "/api/documents", json={"document_ids": []}).status_code == 422
    assert client.get("/api/documents").json() == previous
    confirmed = [doc["id"] for doc in previous]
    newer = Document(
        id=new_id(), name="Neu.txt", text="Später eingefügt", page_count=1, char_count=15
    )
    client.app.state.store.put("documents", newer.model_dump())
    for _ in range(2):  # Safe to retry if a successful response was lost.
        response = client.request("DELETE", "/api/documents", json={"document_ids": confirmed})
        assert response.status_code == 204
        remaining = {doc["id"]: doc for doc in client.get("/api/documents").json()}
        assert remaining == {example["id"]: example, newer.id: newer.model_dump()}
        assert client.get(f"/api/documents/{uploaded.id}/original").status_code == 404
        assert client.get(f"/api/documents/{example['id']}/text").text == example["text"]
    assert client.get(f"/api/analyses/{analysis['id']}").json()["findings"] == analysis["findings"]
    assert len(client.get("/api/playbooks").json()) == 1


def test_bulk_document_deletion_rolls_back_on_storage_failure(client):
    for doc_id in ("first", "second"):
        document = Document(
            id=doc_id, name=f"{doc_id}.txt", text="Quelle", page_count=1, char_count=6
        )
        client.app.state.store.put("documents", document.model_dump())
    previous = client.get("/api/documents").json()
    with client.app.state.store.connection() as db:
        db.execute(
            "CREATE TRIGGER stop_delete BEFORE DELETE ON documents WHEN OLD.id='second' "
            "BEGIN SELECT RAISE(ABORT, 'Simulated failure'); END"
        )
    with pytest.raises(sqlite3.IntegrityError):
        client.app.state.store.delete_documents(["first", "second"])
    assert client.get("/api/documents").json() == previous


def test_pasted_source_persists_with_completed_result_and_preserves_version_ids(client):
    quote = "Nachricht mit Umlauten: Rückfrage."

    class QuotedService(CompletedService):
        async def run(self, body, documents, playbook, *, pasted_document=None):
            result = await super().run(body, documents, playbook, pasted_document=pasted_document)
            result.title = "Vergleich zur Lieferung"
            result.findings = [
                Finding(
                    id=new_id(),
                    title="Rückfrage",
                    category="Zugang",
                    severity="info",
                    description="Die Nachricht enthält eine Rückfrage.",
                    source_quote=quote,
                    source_document_id=pasted_document.id,
                    source_document_name=pasted_document.name,
                    source_location="Textfundstelle",
                    suggestion="",
                    legal_basis="",
                    source_urls=[],
                    verified=True,
                )
            ]
            result.timeline = [
                TimelineEntry(
                    date="Datum offen",
                    event="Rückfrage in der Nachricht.",
                    open_question="Datum?",
                    source=pasted_document.name,
                    source_document_id=pasted_document.id,
                    source_quote=quote,
                    verified=True,
                )
            ]
            return result

    service = QuotedService()
    client.app.state.analysis_service = service
    document_ids = []
    for name in ("Original.txt", "Gegenentwurf.txt"):
        document = Document(id=new_id(), name=name, text=name, page_count=1, char_count=len(name))
        client.app.state.store.put("documents", document.model_dump())
        document_ids.append(document.id)
    text = "  E-Mail-Verlauf\nNachricht mit Umlauten: Rückfrage.\n"
    body = {
        "workflow": "compare",
        "document_ids": document_ids,
        "source_text": text,
        "context": "Bitte Zugang und widersprechende Angaben prüfen.".ljust(10_000),
    }
    response = client.post("/api/analyses", json=body)
    assert response.status_code == 201, response.text
    analysis = response.json()
    assert analysis["document_ids"] == document_ids
    pasted_id = analysis["source_text_document_id"]
    assert pasted_id and pasted_id not in document_ids
    documents = client.get("/api/documents").json()
    assert len(documents) == len(document_ids) + 1
    pasted = next(doc for doc in documents if doc["id"] == pasted_id)
    expected_name = "Text · Vergleich zur Lieferung.txt"
    assert pasted["name"] == expected_name
    assert analysis["source_text_document_name"] == expected_name
    assert analysis["findings"][0]["source_document_name"] == expected_name
    assert analysis["timeline"][0]["source"] == expected_name
    assert analysis["findings"][0]["source_quote"] == quote
    assert analysis["timeline"][0]["source_quote"] == quote
    assert pasted["text"] == text and pasted["char_count"] == len(text)
    downloaded = client.get(f"/api/documents/{pasted_id}/text")
    assert downloaded.content == text.encode("utf-8")
    assert downloaded.headers["content-disposition"].startswith("attachment;")
    request, versions, passed_source = service.calls[0]
    assert request.context == body["context"] and request.source_text == text
    assert [doc.id for doc in versions] == document_ids
    assert passed_source.id == pasted_id
    assert client.get(f"/api/analyses/{analysis['id']}").json() == analysis


@pytest.mark.parametrize("extra,expected_status", [(0, 201), (1, 422)])
def test_mixed_document_and_pasted_text_limit_is_enforced_without_truncation(
    client, extra, expected_status
):
    document_chars = 200_000
    service = CompletedService()
    client.app.state.analysis_service = service
    text = "D" * document_chars
    document = Document(
        id=new_id(), name="Vertrag.txt", text=text, page_count=1, char_count=len(text)
    )
    client.app.state.store.put("documents", document.model_dump())
    pasted_text = "😀" * (1_000_000 - document_chars + extra)
    response = client.post(
        "/api/analyses",
        json={
            "workflow": "contract",
            "document_ids": [document.id],
            "source_text": pasted_text,
        },
    )
    assert response.status_code == expected_status, response.text
    if extra:
        assert not service.calls
        assert client.get("/api/documents").json() == [document.model_dump()]
        assert client.get("/api/analyses").json() == []
    else:
        assert [doc.text for doc in service.calls[0][1]] == [text]
        assert service.calls[0][2].text == pasted_text


def test_analysis_and_pasted_source_transaction_rolls_back_together(client):
    client.app.state.analysis_service = CompletedService()
    analysis = client.post(
        "/api/analyses",
        json={
            "workflow": "chronology",
            "source_text": "Bereits gespeicherte Nachricht.",
        },
    ).json()
    previous_documents = client.get("/api/documents").json()
    pasted = Document(
        id=new_id(), name="Eingefügter Text.txt", text="Neue Quelle", page_count=1, char_count=11
    )
    # Force the second INSERT to fail after inserting the new text source.
    with pytest.raises(sqlite3.IntegrityError):
        client.app.state.store.save_analysis(
            {**analysis, "source_text_document_id": pasted.id}, pasted.model_dump()
        )
    assert client.get("/api/documents").json() == previous_documents
    assert client.get(f"/api/analyses/{analysis['id']}").json() == analysis


def test_disconnect_cancels_analysis_without_saving_pasted_source(client, monkeypatch):
    cancelled = threading.Event()

    class WaitingService:
        async def run(self, *args, **kwargs):
            try:
                await asyncio.sleep(60)
            finally:
                cancelled.set()

    async def disconnected(request):
        return True

    client.app.state.analysis_service = WaitingService()
    monkeypatch.setattr(Request, "is_disconnected", disconnected)
    response = client.post(
        "/api/analyses",
        json={
            "workflow": "chronology",
            "source_text": "Private eingefügte Nachricht.",
        },
    )
    assert response.status_code == 499
    assert cancelled.is_set()
    assert client.get("/api/documents").json() == []
    assert client.get("/api/analyses").json() == []


def test_validation_errors_never_echo_document_text(client):
    service = CompletedService()
    client.app.state.analysis_service = service
    response = client.post(
        "/api/analyses",
        json={
            "workflow": "contract",
            "source_text": "Sachverhalt",
            "context": "PRIVATE" + "x" * 9994,
        },
    )
    assert response.status_code == 422
    assert "Prüfauftrag" in response.json()["detail"] and "10.000" in response.json()["detail"]
    assert "PRIVATE" not in response.text
    for invalid_model in (
        {"model": "https://PRIVATE.invalid/model"},
        {"model": "sk-PRIVATE"},
        {"model": "x" * 121},
        {"model": "custom-model", "effort": "auto"},
        {
            "model": "custom-model",
            "effort": "high",
            "research": False,
            "custom_model": {"efforts": ["auto"]},
        },
        {
            "model": "custom-model",
            "effort": "auto",
            "research": True,
            "custom_model": {"efforts": ["auto"]},
        },
    ):
        rejected = client.post(
            "/api/analyses",
            json={
                "workflow": "contract",
                "source_text": "PRIVATE Sachverhalt",
                **invalid_model,
            },
        )
        assert rejected.status_code == 422
        assert "PRIVATE" not in rejected.text
    assert not service.calls
    assert client.get("/api/analyses").json() == []


def test_legacy_timeline_quotes_survive_read_and_export_without_rewriting(client):
    chronology = client.post("/api/demo", json={"scenario": "chronology"}).json()
    for event in chronology["timeline"]:
        event["source"] += ": " + event["source_quote"]
    # Existing records used the combined label. Read/export must normalize without rewriting it.
    client.app.state.store.put("analyses", chronology)
    loaded = client.get(f"/api/analyses/{chronology['id']}").json()
    word = client.get(f"/api/analyses/{chronology['id']}/export?format=docx")
    markdown = client.get(f"/api/analyses/{chronology['id']}/export?format=md")
    assert word.status_code == markdown.status_code == 200
    paragraphs = [paragraph.text for paragraph in WordDocument(io.BytesIO(word.content)).paragraphs]
    timeline_paragraphs = paragraphs[paragraphs.index("Chronologie") + 1 :]
    timeline_markdown = markdown.text.split("## Chronologie\n", 1)[1]
    for event in loaded["timeline"]:
        assert event["source_quote"] not in event["source"]
        assert f"Quelle: {event['source']}" in paragraphs
        assert timeline_paragraphs.count(event["source_quote"]) == 1
        blockquote = "> " + event["source_quote"].replace("\n", "\n> ")
        assert timeline_markdown.count(blockquote) == 1
        assert f"Quelle: {event['source']}" in markdown.text
    assert (
        client.app.state.store.get("analyses", chronology["id"])["timeline"]
        == chronology["timeline"]
    )


def test_older_reports_recover_source_names_without_rewriting_saved_data(client):
    analysis = client.post("/api/demo").json()
    for finding in analysis["findings"]:
        finding.pop("source_document_name", None)
    for field in (
        "prompt_version",
        "provider_duration_ms",
        "source_text_document_id",
        "source_text_document_name",
    ):
        analysis.pop(field, None)
    analysis["usage"] = {"input_tokens": 2000, "output_tokens": 400, "cached_tokens": 1000}
    client.app.state.store.put("analyses", analysis)
    loaded = client.get(f"/api/analyses/{analysis['id']}").json()
    assert loaded["usage"]["cache_write_tokens"] is None
    assert loaded["provider_duration_ms"] is None and loaded["prompt_version"] is None
    assert loaded["source_text_document_id"] is None
    assert loaded["source_text_document_name"] is None
    assert all(
        f["source_document_name"] == "Beispiel · Cloud-Vertrag.txt" for f in loaded["findings"]
    )
    exported = client.get(f"/api/analyses/{analysis['id']}/export?format=md")
    assert "Beispiel · Cloud-Vertrag.txt" in exported.text
    assert client.app.state.store.get("analyses", analysis["id"]) == analysis


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


def test_docx_unresolved_text_revisions_are_rejected_before_storage(client):
    for revision in (None, "ins", "del", "moveFrom", "moveTo"):
        document = WordDocument()
        document.add_paragraph("Der Vertrag beginnt am 1. Januar.")
        # Nest the revision in a table to exercise the full document tree.
        paragraph = document.add_table(rows=1, cols=1).cell(0, 0).paragraphs[0]
        if revision:
            change = OxmlElement(f"w:{revision}")
            change.set(qn("w:id"), "1")
            run = OxmlElement("w:r")
            text = OxmlElement("w:delText" if revision in {"del", "moveFrom"} else "w:t")
            text.text = "Der Auftragnehmer haftet unbegrenzt."
            run.append(text)
            change.append(run)
            paragraph._p.append(change)
        else:
            paragraph.add_run("Der Auftragnehmer haftet unbegrenzt.")
        output = io.BytesIO()
        document.save(output)
        response = client.post(
            "/api/documents", files={"file": ("Vertrag.docx", output.getvalue())}
        )
        if revision:
            assert response.status_code == 422, revision
            assert "Änderungen" in response.json()["detail"]
        else:
            assert response.status_code == 201
            assert "haftet unbegrenzt" in response.json()["text"]
    assert len(client.get("/api/documents").json()) == 1


def test_failed_upstream_analysis_is_not_persisted(client):
    class FailedService:
        async def run(self, *args, **kwargs):
            raise AnalysisError("Die Modellantwort ist unvollständig.")

    client.app.state.analysis_service = FailedService()
    document = client.post(
        "/api/documents", files={"file": ("x.txt", b"Some contract text.")}
    ).json()
    response = client.post(
        "/api/analyses",
        json={
            "workflow": "contract",
            "document_ids": [document["id"]],
            "source_text": "Private zusätzliche Nachricht.",
        },
    )
    assert response.status_code == 502
    assert client.get("/api/analyses").json() == []
    assert client.get("/api/documents").json() == [document]


def test_production_client_does_not_retry_provider_failure(tmp_path, monkeypatch):
    calls = []

    async def provider_error(transport, request):
        calls.append(request)
        return httpx2.Response(
            503,
            json={"error": {"code": "server_is_overloaded", "message": "Unavailable"}},
            request=request,
        )

    # Replace only the network transport: the app constructs the real SDK client.
    monkeypatch.setattr(httpx2.AsyncHTTPTransport, "handle_async_request", provider_error)
    app = create_app(Settings(data_dir=tmp_path, api_key="synthetic-offline-key"))
    with TestClient(app, base_url="http://localhost", client=("127.0.0.1", 12345)) as client:
        response = client.post(
            "/api/analyses", json={"workflow": "chronology", "source_text": "Testnachricht."}
        )
        assert response.status_code == 503
        assert "vorübergehend" in response.json()["detail"]
        assert len(calls) == 1
        assert client.get("/api/analyses").json() == []
        assert client.get("/api/documents").json() == []


def test_unexpected_exception_never_escapes_to_asgi_server_logging(client, monkeypatch):
    monitoring = threading.Event()
    stopped = threading.Event()

    async def pending_disconnect(request):
        if monitoring.is_set():
            return False
        monitoring.set()
        try:
            await asyncio.Event().wait()
        finally:
            stopped.set()

    class UnexpectedFailure:
        async def run(self, *args, **kwargs):
            while not monitoring.is_set():
                await asyncio.sleep(0)
            raise ValueError("SYNTHETIC PRIVATE DOCUMENT AND KEY")

    monkeypatch.setattr(Request, "is_disconnected", pending_disconnect)
    client.app.state.analysis_service = UnexpectedFailure()
    document = client.post("/api/documents", files={"file": ("x.txt", b"Contract text.")}).json()
    # TestClient raises escaped server errors by default, even after a 500 handler.
    response = client.post(
        "/api/analyses", json={"workflow": "contract", "document_ids": [document["id"]]}
    )
    assert response.status_code == 500
    assert "PRIVATE" not in response.text
    assert stopped.is_set()
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
