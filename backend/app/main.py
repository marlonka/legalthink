from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Annotated, Literal

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from openai import AsyncOpenAI
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles

from . import export
from .analysis import AnalysisError, AnalysisService
from .config import Settings
from .demo import demo_analysis, demo_documents
from .extraction import ExtractionError, extract_isolated, safe_filename
from .schemas import (
    MODELS,
    Analysis,
    AnalysisRequest,
    DemoRequest,
    Document,
    Playbook,
    PlaybookInput,
    new_id,
    now,
)
from .security import RequestTooLarge, SecurityBoundary
from .store import Store


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.store = Store(config.data_dir)
        app.state.analysis_slots = asyncio.Semaphore(2)
        app.state.extraction_slots = asyncio.Semaphore(2)
        client = None
        app.state.analysis_service = None
        if config.api_key:
            client = AsyncOpenAI(
                api_key=config.api_key, max_retries=0, timeout=config.request_timeout
            )
            app.state.analysis_service = AnalysisService(client, config.request_timeout)
        yield
        if client:
            await client.close()

    app = FastAPI(
        title="LegalThinkGPT",
        version="0.1.0",
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
        # No provider exceptions, document content or keys leave the API.
        return JSONResponse(
            {"detail": "Die Anfrage konnte nicht verarbeitet werden. Bitte erneut versuchen."},
            status_code=500,
        )

    @app.get("/api/health")
    def health():
        return {"status": "ok", "api_configured": bool(config.api_key)}

    @app.get("/api/models")
    def models():
        return {"models": MODELS}

    @app.get("/api/documents", response_model=list[Document])
    def list_documents():
        return app.state.store.list("documents")

    @app.post("/api/documents", response_model=Document, status_code=201)
    async def upload(file: Annotated[UploadFile, File()]):
        name = safe_filename(file.filename)
        suffix = Path(name).suffix.lower()
        if suffix not in {".pdf", ".docx", ".txt", ".md"}:
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
            id=new_id(), name=name, text=text, page_count=pages, char_count=len(text)
        )
        await run_in_threadpool(app.state.store.put, "documents", document.model_dump())
        return document

    @app.delete("/api/documents/{document_id}", status_code=204)
    def delete_document(document_id: str):
        if not app.state.store.delete("documents", document_id):
            raise HTTPException(404, "Dokument nicht gefunden.")

    @app.get("/api/analyses", response_model=list[Analysis])
    def list_analyses():
        return app.state.store.list("analyses")

    def get_analysis(analysis_id: str) -> Analysis:
        value = app.state.store.get("analyses", analysis_id)
        if not value:
            raise HTTPException(404, "Analyse nicht gefunden.")
        return Analysis.model_validate(value)

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
        if sum(d.char_count for d in documents) > 300_000:
            raise HTTPException(
                422,
                "Die Auswahl überschreitet 300.000 Zeichen. Bitte den Prüfungsumfang reduzieren.",
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
            task = asyncio.create_task(service.run(body, documents, playbook))
            disconnect = asyncio.create_task(disconnected())
            try:
                done, _ = await asyncio.wait(
                    {task, disconnect}, return_when=asyncio.FIRST_COMPLETED
                )
                if disconnect in done or await request.is_disconnected():
                    raise HTTPException(499, "Analyse abgebrochen.")
                result = await task
                await run_in_threadpool(app.state.store.put, "analyses", result.model_dump())
                return result
            except AnalysisError as error:
                raise HTTPException(error.status_code, error.detail) from None
            finally:
                for pending in (task, disconnect):
                    if not pending.done():
                        pending.cancel()
                    with suppress(asyncio.CancelledError, AnalysisError):
                        await pending

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
        return app.state.store.list("playbooks")

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
                "Content-Disposition": f'attachment; filename="LegalThinkGPT-'
                f'{analysis.id}.{format}"'
            },
        )

    if config.frontend_dir.is_dir():
        assets = config.frontend_dir / "assets"
        if assets.is_dir():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")

        @app.get("/{path:path}")
        def frontend(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "API-Endpunkt nicht gefunden.")
            target = (config.frontend_dir / path).resolve()
            if target.is_relative_to(config.frontend_dir.resolve()) and target.is_file():
                return FileResponse(target)
            return FileResponse(config.frontend_dir / "index.html")

    return app


app = create_app()
