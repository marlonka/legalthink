from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import quote

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.gzip import GZipMiddleware

from . import export
from .analysis import AnalysisError, AnalysisService, normalized, recover_source_references
from .config import Settings
from .demo import demo_analysis, demo_documents, restore_demo_sources
from .extraction import ExtractionError, extract_isolated, safe_filename
from .schemas import (
    MAX_INSTRUCTION_CHARS,
    MAX_MATERIAL_CHARS,
    MODELS,
    Analysis,
    AnalysisRequest,
    DemoRequest,
    Document,
    DocumentDeleteRequest,
    Playbook,
    PlaybookInput,
    new_id,
    now,
)
from .security import RequestTooLarge, SecurityBoundary
from .static_assets import BuildAssets
from .store import ProtectedDocumentError, Store

DOCUMENT_MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
}


logger = logging.getLogger("legalthink")


def skipped_record(table: str) -> None:
    # Record content may be confidential; log only that a row was unreadable.
    logger.warning("Skipped an unreadable stored record in %s", table)


def readable(model: type[BaseModel], rows: list[dict]) -> list:
    """Validate stored rows one by one so one damaged row cannot hide all others."""
    items = []
    for row in rows:
        try:
            items.append(model.model_validate(row))
        except ValidationError:
            skipped_record(model.__name__)
    return items


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.store = Store(config.data_dir)
        restore_demo_sources(app.state.store)
        app.state.analysis_slots = asyncio.Semaphore(2)
        app.state.extraction_slots = asyncio.Semaphore(2)
        client = None
        app.state.analysis_service = None
        if config.api_key:
            client = AsyncOpenAI(
                api_key=config.api_key,
                data_residency=config.processing_region,
                max_retries=0,
                timeout=config.request_timeout,
            )
            app.state.analysis_service = AnalysisService(
                client, config.request_timeout, config.processing_region
            )
        try:
            yield
        finally:
            if client:
                await client.close()

    app = FastAPI(
        title="LegalThink",
        version="0.3.0",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(config.allowed_origins),
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        allow_credentials=False,
    )
    app.add_middleware(SecurityBoundary, settings=config)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        # Pydantic's default response may echo confidential input. Return safe field names only.
        for error in exc.errors():
            if error["type"] == "model_configuration":
                return JSONResponse({"detail": error["msg"]}, status_code=422)
            if error["loc"] == ("body", "model"):
                return JSONResponse(
                    {
                        "detail": "Ungültige OpenAI-Modell-ID. Erlaubt sind höchstens 120 Zeichen "
                        "aus Buchstaben, Zahlen, Punkt, Bindestrich, Unterstrich und Doppelpunkt. "
                        "Keine URL und keinen API-Schlüssel eingeben."
                    },
                    status_code=422,
                )
        if any(
            error["loc"] == ("body", "context") and error["type"] == "string_too_long"
            for error in exc.errors()
        ):
            limit = f"{MAX_INSTRUCTION_CHARS:,}".replace(",", ".")
            return JSONResponse(
                {
                    "detail": f"Der Prüfauftrag darf höchstens {limit} Zeichen enthalten. "
                    "Bitte kürzen Sie den Prüfauftrag."
                },
                status_code=422,
            )
        fields = ", ".join(sorted({str(e["loc"][-1]) for e in exc.errors()}))
        return JSONResponse(
            {"detail": f"Ungültige Eingabe: {fields}. Bitte Auswahl und Umfang prüfen."},
            status_code=422,
        )

    @app.exception_handler(RequestTooLarge)
    async def body_too_large(request: Request, exc: RequestTooLarge):
        return JSONResponse({"detail": "Die Anfrage ist zu groß."}, status_code=413)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        return JSONResponse({"detail": str(exc.detail)}, status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        # No provider exceptions, document content or keys leave the API or the log.
        logger.error("Unexpected %s on %s %s", type(exc).__name__, request.method, request.url.path)
        return JSONResponse(
            {"detail": "Die Anfrage konnte nicht verarbeitet werden. Bitte erneut versuchen."},
            status_code=500,
        )

    @app.get("/api/health")
    def health():
        return {
            "status": "ok",
            "api_configured": bool(config.api_key),
            "default_processing_region": config.processing_region,
        }

    @app.get("/api/models")
    def models():
        return {"models": MODELS}

    @app.get("/api/documents", response_model=list[Document])
    def list_documents():
        return readable(Document, app.state.store.list("documents"))

    @app.post("/api/documents", response_model=Document, status_code=201)
    async def upload(file: Annotated[UploadFile, File()]):
        name = safe_filename(file.filename)
        suffix = Path(name).suffix.lower()
        if suffix not in DOCUMENT_MEDIA_TYPES:
            await file.close()
            raise HTTPException(415, "Unterstützt werden PDF, DOCX, TXT und Markdown.")
        try:
            data = await file.read(config.max_upload_bytes + 1)
        finally:
            await file.close()
        if len(data) > config.max_upload_bytes:
            raise HTTPException(413, "Die Datei ist zu groß. Maximal 12 MB sind erlaubt.")
        slots = app.state.extraction_slots
        if slots.locked():
            raise HTTPException(429, "Es werden bereits zwei Dateien gelesen. Bitte kurz warten.")
        try:
            async with slots:
                text, pages = await extract_isolated(data, suffix)
        except ExtractionError as error:
            raise HTTPException(422, str(error)) from None
        except TimeoutError:
            raise HTTPException(
                422,
                "Das Lesen der Datei dauerte zu lange. Bitte eine vereinfachte Version hochladen.",
            ) from None
        document = Document(
            id=new_id(),
            name=name,
            text=text,
            page_count=pages,
            char_count=len(text),
            original_available=True,
        )
        await run_in_threadpool(app.state.store.save_document, document.model_dump(), data)
        return document

    @app.get("/api/documents/{document_id}/text")
    def download_text(document_id: str):
        source = app.state.store.get("documents", document_id)
        if not source:
            raise HTTPException(404, "Dokument nicht gefunden.")
        name = Path(safe_filename(source["name"])).stem + ".txt"
        return Response(
            source["text"].encode("utf-8"),
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"},
        )

    @app.get("/api/documents/{document_id}/original")
    def download_original(document_id: str):
        source = app.state.store.get("documents", document_id)
        original = app.state.store.original(document_id)
        if not source or original is None:
            raise HTTPException(404, "Die Originaldatei ist nicht gespeichert.")
        return Response(
            original,
            media_type=DOCUMENT_MEDIA_TYPES.get(
                Path(source["name"]).suffix.lower(), "application/octet-stream"
            ),
            headers={
                "Content-Disposition": (
                    f"attachment; filename*=UTF-8''{quote(safe_filename(source['name']))}"
                )
            },
        )

    @app.put("/api/documents/{document_id}/original", response_model=Document)
    async def attach_original(document_id: str, file: Annotated[UploadFile, File()]):
        source = app.state.store.get("documents", document_id)
        try:
            if not source:
                raise HTTPException(404, "Dokument nicht gefunden.")
            suffix = Path(source["name"]).suffix.lower()
            if suffix not in DOCUMENT_MEDIA_TYPES:
                raise HTTPException(422, "Für dieses Dateiformat ist keine Vorschau verfügbar.")
            if Path(safe_filename(file.filename)).suffix.lower() != suffix:
                raise HTTPException(422, "Bitte eine Datei im gleichen Format auswählen.")
            data = await file.read(config.max_upload_bytes + 1)
        finally:
            await file.close()
        if len(data) > config.max_upload_bytes:
            raise HTTPException(413, "Die Datei ist zu groß. Maximal 12 MB sind erlaubt.")
        slots = app.state.extraction_slots
        if slots.locked():
            raise HTTPException(429, "Es werden bereits zwei Dateien gelesen. Bitte kurz warten.")
        try:
            async with slots:
                text, _ = await extract_isolated(data, suffix)
        except ExtractionError as error:
            raise HTTPException(422, str(error)) from None
        except TimeoutError:
            raise HTTPException(422, "Das Lesen der Datei dauerte zu lange.") from None
        if normalized(text) != normalized(source["text"]):
            raise HTTPException(
                422, "Der Text dieser Datei stimmt nicht mit dem gespeicherten Quelltext überein."
            )
        try:
            updated = await run_in_threadpool(app.state.store.attach_original, document_id, data)
        except FileExistsError:
            raise HTTPException(
                409, "Für diese Quelle ist bereits eine Originaldatei gespeichert."
            ) from None
        if updated is None:
            raise HTTPException(404, "Dokument nicht mehr verfügbar.")
        return updated

    @app.delete("/api/documents", status_code=204)
    def delete_documents(body: DocumentDeleteRequest):
        app.state.store.delete_documents(body.document_ids)

    @app.delete("/api/documents/{document_id}", status_code=204)
    def delete_document(document_id: str):
        try:
            deleted = app.state.store.delete("documents", document_id)
        except ProtectedDocumentError as error:
            raise HTTPException(409, str(error)) from None
        if not deleted:
            raise HTTPException(404, "Dokument nicht gefunden.")

    @app.get("/api/analyses", response_model=list[Analysis])
    def list_analyses():
        documents = {
            doc.id: doc.model_dump()
            for doc in readable(Document, app.state.store.list("documents"))
        }
        analyses = []
        for value in app.state.store.list("analyses"):
            try:
                analyses.append(prepare_analysis(value, documents))
            except ValidationError:
                skipped_record("analyses")
        return analyses

    def prepare_analysis(value: dict, documents: dict | None = None) -> Analysis:
        def source_document(source_id):
            if documents is not None:
                return documents.get(source_id)
            return app.state.store.get("documents", source_id)

        analysis = Analysis.model_validate(value)
        source_ids = {*analysis.document_ids, analysis.source_text_document_id} - {None}
        sources = [
            Document.model_validate(source)
            for source_id in source_ids
            if (source := source_document(source_id))
        ]
        recover_source_references(analysis, sources)
        # Older reports can recover a file name while the source is still available.
        # Do not rewrite the saved report or accept model-generated document names.
        for finding in analysis.findings:
            if not finding.source_document_name:
                source = source_document(finding.source_document_id)
                if source:
                    finding.source_document_name = source["name"]
        return analysis

    def get_analysis(analysis_id: str) -> Analysis:
        value = app.state.store.get("analyses", analysis_id)
        if not value:
            raise HTTPException(404, "Analyse nicht gefunden.")
        return prepare_analysis(value)

    @app.get("/api/analyses/{analysis_id}", response_model=Analysis)
    def read_analysis(analysis_id: str):
        return get_analysis(analysis_id)

    @app.delete("/api/analyses/{analysis_id}", status_code=204)
    def delete_analysis(analysis_id: str):
        if not app.state.store.delete("analyses", analysis_id):
            raise HTTPException(404, "Analyse nicht gefunden.")

    @app.post("/api/analyses", response_model=Analysis, status_code=201)
    async def analyze(body: AnalysisRequest, request: Request):
        service = app.state.analysis_service
        if service is None:
            raise HTTPException(
                503,
                "OpenAI ist noch nicht eingerichtet. Der API-Schlüssel "
                "wird ausschließlich auf dem Server hinterlegt. "
                "Das Beispiel funktioniert ohne Schlüssel.",
            )
        documents = []
        for document_id in body.document_ids:
            value = await run_in_threadpool(app.state.store.get, "documents", document_id)
            if not value:
                raise HTTPException(404, "Ein ausgewähltes Dokument ist nicht mehr vorhanden.")
            documents.append(Document.model_validate(value))
        if sum(len(d.text) for d in documents) + len(body.source_text) > MAX_MATERIAL_CHARS:
            raise HTTPException(
                422,
                (
                    f"Die Auswahl überschreitet {MAX_MATERIAL_CHARS:,} Zeichen. "
                    "Bitte den Prüfungsumfang reduzieren."
                ).replace(",", "."),
            )
        pasted_document = None
        if body.source_text.strip():
            pasted_document = Document(
                id=new_id(),
                name="Eingefügter Text.txt",
                text=body.source_text,
                page_count=1,
                char_count=len(body.source_text),
            )
        playbook = None
        if body.playbook_id:
            value = await run_in_threadpool(app.state.store.get, "playbooks", body.playbook_id)
            if not value:
                raise HTTPException(404, "Playbook nicht gefunden.")
            playbook = Playbook.model_validate(value)
        slots = app.state.analysis_slots
        if slots.locked():
            raise HTTPException(429, "Es laufen bereits zwei Analysen. Bitte kurz warten.")

        async def disconnected():
            while not await request.is_disconnected():
                await asyncio.sleep(0.25)

        async with slots:
            task = asyncio.create_task(
                service.run(body, documents, playbook, pasted_document=pasted_document)
            )
            disconnect = asyncio.create_task(disconnected())
            try:
                done, _ = await asyncio.wait(
                    {task, disconnect}, return_when=asyncio.FIRST_COMPLETED
                )
                # A finished provider call is paid for; keep its result even if the
                # browser disconnected at the same moment.
                if task not in done:
                    raise HTTPException(499, "Analyse abgebrochen.")
                result = await task
                if pasted_document:
                    pasted_document.name = f"Text · {result.title[:100]}.txt"
                    result.source_text_document_name = pasted_document.name
                    for finding in result.findings:
                        if finding.source_document_id == pasted_document.id:
                            finding.source_document_name = pasted_document.name
                    for event in result.timeline:
                        if event.source_document_id == pasted_document.id:
                            event.source = pasted_document.name
                await run_in_threadpool(
                    app.state.store.save_analysis,
                    result.model_dump(),
                    pasted_document.model_dump() if pasted_document else None,
                )
                return result
            except AnalysisError as error:
                raise HTTPException(error.status_code, error.detail) from None
            finally:
                for pending in (task, disconnect):
                    if not pending.done():
                        pending.cancel()
                # A failed provider task must not prevent the disconnect watcher
                # from stopping. The original error still propagates from above.
                await asyncio.gather(task, disconnect, return_exceptions=True)

    @app.post("/api/demo", response_model=Analysis, status_code=201)
    def demo(body: DemoRequest | None = None):
        scenario = body.scenario if body else "contract"
        for document in demo_documents(scenario):
            app.state.store.put("documents", document.model_dump())
        analysis = demo_analysis(scenario)
        app.state.store.put("analyses", analysis.model_dump())
        return analysis

    @app.get("/api/playbooks", response_model=list[Playbook])
    def list_playbooks():
        return readable(Playbook, app.state.store.list("playbooks"))

    @app.post("/api/playbooks", response_model=Playbook, status_code=201)
    def save_playbook(body: PlaybookInput):
        playbook = Playbook(**body.model_dump(), id=new_id(), created_at=now())
        app.state.store.put("playbooks", playbook.model_dump())
        return playbook

    @app.put("/api/playbooks/{playbook_id}", response_model=Playbook)
    def update_playbook(playbook_id: str, body: PlaybookInput):
        previous = app.state.store.get("playbooks", playbook_id)
        if not previous:
            raise HTTPException(404, "Playbook nicht gefunden.")
        playbook = Playbook(**body.model_dump(), id=playbook_id, created_at=previous["created_at"])
        if not app.state.store.update("playbooks", playbook.model_dump()):
            raise HTTPException(404, "Playbook nicht gefunden.")
        return playbook

    @app.delete("/api/playbooks/{playbook_id}", status_code=204)
    def delete_playbook(playbook_id: str):
        if not app.state.store.delete("playbooks", playbook_id):
            raise HTTPException(404, "Playbook nicht gefunden.")

    @app.get("/api/analyses/{analysis_id}/export")
    def export_analysis(analysis_id: str, format: Literal["docx", "md"] = "docx"):
        analysis = get_analysis(analysis_id)
        data = export.docx(analysis) if format == "docx" else export.markdown(analysis)
        mime = (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            if format == "docx"
            else "text/markdown; charset=utf-8"
        )
        return Response(
            data,
            media_type=mime,
            headers={
                "Content-Disposition": f'attachment; filename="LegalThink-{analysis.id}.{format}"'
            },
        )

    if config.frontend_dir.is_dir():
        assets = config.frontend_dir / "assets"
        if assets.is_dir():
            app.mount(
                "/assets",
                GZipMiddleware(BuildAssets(directory=assets), minimum_size=1000, compresslevel=6),
                name="assets",
            )

        @app.get("/{path:path}")
        def frontend(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "API-Endpunkt nicht gefunden.")
            target = (config.frontend_dir / path).resolve()
            if target.is_relative_to(config.frontend_dir.resolve()) and target.is_file():
                return FileResponse(target, headers={"Cache-Control": "no-cache"})
            return FileResponse(
                config.frontend_dir / "index.html", headers={"Cache-Control": "no-cache"}
            )

    return app


app = create_app()
