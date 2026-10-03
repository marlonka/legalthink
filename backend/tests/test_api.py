import asyncio
import io
import sqlite3
import threading
import zipfile
from dataclasses import replace

import pytest
from docx import Document as WordDocument
from fastapi import Request
from fastapi.testclient import TestClient
from lxml import etree
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


def test_bulk_document_deletion_only_removes_confirmed_sources(client):
    analysis = client.post("/api/demo").json()
    client.post("/api/playbooks", json={"name": "Standard", "content": "Haftung prüfen."})
    confirmed = [doc["id"] for doc in client.get("/api/documents").json()]
    newer = Document(
        id=new_id(), name="Neu.txt", text="Später eingefügt", page_count=1, char_count=15
    )
    client.app.state.store.put("documents", newer.model_dump())
    for _ in range(2):  # Safe to retry if a successful response was lost.
        response = client.request("DELETE", "/api/documents", json={"document_ids": confirmed})
        assert response.status_code == 204
        assert client.get("/api/documents").json() == [newer.model_dump()]
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


@pytest.mark.parametrize("body", [{}, {"document_ids": []}])
def test_bulk_document_deletion_requires_explicit_selection(client, body):
    client.post("/api/demo")
    previous = client.get("/api/documents").json()
    assert client.request("DELETE", "/api/documents", json=body).status_code == 422
    assert client.get("/api/documents").json() == previous


def test_analysis_without_config_returns_explicit_error(client):
    response = client.post("/api/analyses", json={"workflow": "contract", "document_ids": ["doc"]})
    assert response.status_code == 503
    assert "nicht eingerichtet" in response.json()["detail"]
    assert client.get("/api/analyses").json() == []


@pytest.mark.parametrize("compare", [False, True])
def test_pasted_source_persists_with_completed_result_and_preserves_version_ids(client, compare):
    quote = "Nachricht mit Umlauten: Rückfrage."

    class QuotedService(CompletedService):
        async def run(self, body, documents, playbook, *, pasted_document=None):
            result = await super().run(body, documents, playbook, pasted_document=pasted_document)
            result.title = "Ä" * 99 + "😀 weiterer Text" if compare else "Chronologie zur Lieferung"
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
    if compare:
        for name in ("Original.txt", "Gegenentwurf.txt"):
            document = Document(
                id=new_id(), name=name, text=name, page_count=1, char_count=len(name)
            )
            client.app.state.store.put("documents", document.model_dump())
            document_ids.append(document.id)
    text = "  E-Mail-Verlauf\n" + "Nachricht mit Umlauten: Rückfrage.\n" * 1_000
    body = {
        "workflow": "compare" if compare else "chronology",
        "source_text": text,
        "context": "Bitte Zugang und widersprechende Angaben prüfen.",
    }
    if compare:
        body["document_ids"] = document_ids
    response = client.post("/api/analyses", json=body)
    assert response.status_code == 201, response.text
    analysis = response.json()
    assert analysis["document_ids"] == document_ids
    pasted_id = analysis["source_text_document_id"]
    assert pasted_id and pasted_id not in document_ids
    documents = client.get("/api/documents").json()
    assert len(documents) == len(document_ids) + 1
    pasted = next(doc for doc in documents if doc["id"] == pasted_id)
    expected_name = (
        "Text · " + ("Ä" * 99 + "😀" if compare else "Chronologie zur Lieferung") + ".txt"
    )
    assert pasted["name"] == expected_name
    assert analysis["source_text_document_name"] == expected_name
    assert analysis["findings"][0]["source_document_name"] == expected_name
    assert analysis["timeline"][0]["source"] == expected_name
    assert analysis["findings"][0]["source_quote"] == quote
    assert analysis["timeline"][0]["source_quote"] == quote
    assert analysis["findings"][0]["verified"] and analysis["timeline"][0]["verified"]
    assert pasted["text"] == text and pasted["char_count"] == len(text)
    request, versions, passed_source = service.calls[0]
    assert request.context == body["context"] and request.source_text == text
    assert [doc.id for doc in versions] == document_ids
    assert passed_source.id == pasted_id
    assert client.get(f"/api/analyses/{analysis['id']}").json() == analysis


@pytest.mark.parametrize("extra,expected_status", [(0, 201), (1, 422)])
@pytest.mark.parametrize("document_chars", [0, 200_000])
def test_mixed_document_and_pasted_text_limit_is_enforced_without_truncation(
    client, extra, expected_status, document_chars
):
    service = CompletedService()
    client.app.state.analysis_service = service
    text = "D" * document_chars
    document = Document(
        id=new_id(), name="Vertrag.txt", text=text, page_count=1, char_count=len(text)
    )
    if document_chars:
        client.app.state.store.put("documents", document.model_dump())
    pasted_text = "😀" * (1_000_000 - document_chars + extra)
    response = client.post(
        "/api/analyses",
        json={
            "workflow": "contract",
            "document_ids": [document.id] if document_chars else [],
            "source_text": pasted_text,
        },
    )
    assert response.status_code == expected_status, response.text
    if extra:
        assert not service.calls
        assert client.get("/api/documents").json() == (
            [document.model_dump()] if document_chars else []
        )
        assert client.get("/api/analyses").json() == []
    else:
        assert [doc.text for doc in service.calls[0][1]] == ([text] if document_chars else [])
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
        {"workflow": "chronology", "source_text": " \n\t", "context": "Nur ein Prüfauftrag"},
        {"workflow": "contract", "source_text": "PRIVATE" * 142_858},
        {"workflow": "compare", "source_text": "Zusatzquelle ohne beide Vertragsfassungen"},
        {"workflow": "compare", "document_ids": ["a"], "source_text": "Zusatzquelle"},
        {"workflow": "compare", "document_ids": ["a", "b", "c"], "source_text": "Zusatzquelle"},
        {"workflow": "compare", "document_ids": ["a"]},
        {"workflow": "contract", "document_ids": ["a", "a"]},
        {"workflow": "contract", "document_ids": ["a"], "model": "gpt-6.1-sol", "effort": "none"},
        {"workflow": "contract", "document_ids": ["a"], "effort": "ultra"},
        {"workflow": "contract", "document_ids": ["a"], "context": "PRIVATE" * 4000},
        {"workflow": "contract", "document_ids": ["a"], "compliance_task": "avv"},
        {"workflow": "chronology", "document_ids": ["a"], "compliance_task": "dsfa"},
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


def test_exports_preserve_revisions_labels_and_separate_timeline_quotes(client):
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


@pytest.mark.parametrize(
    "scenario,workflow,task,count",
    [
        ("contract", "contract", "general", 1),
        ("compare", "compare", "general", 2),
        ("chronology", "chronology", "general", 4),
        ("compliance", "compliance", "general", 1),
        ("avv", "compliance", "avv", 2),
        ("dsfa", "compliance", "dsfa", 2),
        ("advertising", "advertising", "general", 2),
    ],
)
def test_demo_scenarios_persist_matching_documents_and_confirmed_evidence(
    client, scenario, workflow, task, count
):
    class ForbiddenService:
        async def run(self, *args, **kwargs):
            pytest.fail("Demo scenarios must never invoke the model service.")

    client.app.state.analysis_service = ForbiddenService()
    response = client.post("/api/demo", json={"scenario": scenario})
    assert response.status_code == 201, response.text
    analysis = response.json()
    assert analysis["workflow"] == workflow
    assert analysis["compliance_task"] == task
    assert analysis["demo_scenario"] == scenario
    assert analysis["is_demo"] and analysis["model"] == "Synthetisches Beispiel"
    assert analysis["usage"] is None and analysis["sources"] == []
    documents = {document["id"]: document for document in client.get("/api/documents").json()}
    assert len(analysis["document_ids"]) == count
    for document_id in analysis["document_ids"]:
        assert "Beispiel" in documents[document_id]["name"]
        assert "SYNTHETISCHES BEISPIEL" in documents[document_id]["text"]
    assert analysis["findings"]
    for item in [*analysis["findings"], *analysis["timeline"]]:
        assert item["verified"], item["source_quote"]
        assert item["source_document_id"] in analysis["document_ids"]
        quote = " ".join(item["source_quote"].split())
        assert quote in " ".join(documents[item["source_document_id"]]["text"].split())
    if scenario == "compare":
        original, counter = [documents[document_id] for document_id in analysis["document_ids"]]
        assert "Originalentwurf" in original["name"]
        assert "Gegenentwurf" in counter["name"]
        assert "Jahresvergütung" in original["text"]
        assert "Monatsvergütung" in counter["text"]
        assert all(item["source_document_id"] == counter["id"] for item in analysis["findings"])
    if scenario == "chronology":
        assert [item["date"] for item in analysis["timeline"]] == [
            "2026-09-05",
            "2026-09-15",
            "2026-09-17",
            "2026-09-22",
            "2026-09-23",
        ]
        assert any(item["open_question"] for item in analysis["timeline"])
    assert client.get(f"/api/analyses/{analysis['id']}").json() == analysis


def test_demo_default_stays_contract_and_invalid_scenario_does_not_create_data(client):
    invalid = client.post("/api/demo", json={"scenario": "unrecognized"})
    assert invalid.status_code == 422
    assert client.get("/api/documents").json() == []
    assert client.get("/api/analyses").json() == []
    default = client.post("/api/demo").json()
    assert default["demo_scenario"] == "contract"
    assert default["workflow"] == "contract"


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


def test_unexpected_exception_never_escapes_to_asgi_server_logging(client):
    class UnexpectedFailure:
        async def run(self, *args, **kwargs):
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
