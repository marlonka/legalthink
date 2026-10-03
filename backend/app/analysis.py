from __future__ import annotations

import asyncio
import hashlib
import json
import re
import unicodedata
from time import perf_counter
from typing import Any
from urllib.parse import urlsplit

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    AuthenticationError,
    RateLimitError,
)
from pydantic import ValidationError

from .prompts import COMPLIANCE_TASK_PROMPTS, PROMPT_VERSION, SYSTEM_PROMPT, WORKFLOW_PROMPTS
from .schemas import (
    Analysis,
    AnalysisRequest,
    Document,
    Finding,
    ModelAnalysis,
    Playbook,
    Source,
    TimelineEntry,
    Usage,
    new_id,
    now,
)


class AnalysisError(Exception):
    def __init__(self, detail: str, status_code: int = 502):
        self.detail = detail
        self.status_code = status_code


def normalized(text: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", text)).strip()


def _page_location(document: Document, quote: str) -> str | None:
    if not document.name.lower().endswith(".pdf"):
        return None
    pages = re.split(r"\[Seite (\d+)\]\n", document.text)
    for i in range(1, len(pages), 2):
        if quote in normalized(pages[i + 1]):
            return f"Seite {pages[i]}"
    return None


def verify_findings(
    result: ModelAnalysis, documents: list[Document], allowed_urls: set[str] | None = None
) -> list[Finding]:
    sources = {d.id: d for d in documents}
    findings = []
    for item in result.findings:
        doc = sources.get(item.source_document_id)
        quote = normalized(item.source_quote)
        # Case-sensitive, whitespace-tolerant containment. Verification means text match only.
        verified = bool(doc and len(quote) >= 12 and quote in normalized(doc.text))
        location = "Textfundstelle"
        if verified and doc:
            location = _page_location(doc, quote) or "Textfundstelle"
        elif not verified:
            location = "Beleg nicht bestätigt"
        fields = item.model_dump()
        fields["source_location"] = location
        fields["source_urls"] = [url for url in item.source_urls if url in (allowed_urls or set())]
        findings.append(
            Finding(
                **fields,
                id=new_id(),
                verified=verified,
                source_document_name=doc.name if doc else "",
            )
        )
    return findings


def verify_timeline(result: ModelAnalysis, documents: list[Document]) -> list[TimelineEntry]:
    documents_by_id = {d.id: d for d in documents}
    events = []
    for item in result.timeline:
        document = documents_by_id.get(item.source_document_id)
        quote = normalized(item.source_quote)
        verified = bool(document and len(quote) >= 12 and quote in normalized(document.text))
        fields = item.model_dump()
        fields["source"] = "Beleg nicht bestätigt"
        if verified and document:
            location = _page_location(document, quote)
            fields["source"] = document.name + (f" · {location}" if location else "")
        events.append(TimelineEntry(**fields, verified=verified))
    return events


def provider_sources(response: Any) -> list[Source]:
    found: dict[str, Source] = {}
    for item in response.output:
        if getattr(item, "type", "") == "message":
            for content in getattr(item, "content", []):
                for annotation in getattr(content, "annotations", []):
                    url = getattr(annotation, "url", "")
                    if url and urlsplit(url).scheme in {"http", "https"}:
                        found[url] = Source(title=getattr(annotation, "title", "Quelle"), url=url)
        if getattr(item, "type", "") == "web_search_call":
            for source in getattr(getattr(item, "action", None), "sources", []) or []:
                url = (
                    source.get("url", "")
                    if isinstance(source, dict)
                    else getattr(source, "url", "")
                )
                if url and urlsplit(url).scheme in {"http", "https"}:
                    title = (
                        source.get("title")
                        if isinstance(source, dict)
                        else getattr(source, "title", None)
                    )
                    found.setdefault(url, Source(title=title or urlsplit(url).netloc, url=url))
    return list(found.values())[:30]


class AnalysisService:
    def __init__(self, client: AsyncOpenAI, timeout: float = 180.0):
        self.client = client
        self.timeout = timeout

    async def run(
        self, request: AnalysisRequest, documents: list[Document], playbook: Playbook | None = None
    ) -> Analysis:
        scope = WORKFLOW_PROMPTS[request.workflow]
        if request.workflow == "compliance":
            scope += "\n" + COMPLIANCE_TASK_PROMPTS[request.compliance_task]
        scope += (
            "\nWebrecherche ist freigegeben."
            if request.research
            else "\nWebrecherche ist nicht freigegeben."
        )
        payload = {
            "workflow": request.workflow,
            "kontext": request.context,
            "recherche_freigegeben": request.research,
            "playbook": {"name": playbook.name, "content": playbook.content} if playbook else None,
            "documents": [doc.model_dump(include={"id", "name", "text"}) for doc in documents],
        }
        if request.workflow == "compliance":
            payload["compliance_task"] = request.compliance_task
        kwargs: dict[str, Any] = {
            "model": request.model,
            "input": [
                {
                    "role": "developer",
                    "content": [
                        {
                            "type": "input_text",
                            "text": SYSTEM_PROMPT,
                            "prompt_cache_breakpoint": {"mode": "explicit"},
                        },
                        {"type": "input_text", "text": scope},
                    ],
                },
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
            "reasoning": {"effort": request.effort},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "legal_analysis",
                    "strict": True,
                    "schema": ModelAnalysis.model_json_schema(),
                }
            },
            "store": False,
            "max_output_tokens": 24000,
            "truncation": "disabled",
            "prompt_cache_key": hashlib.sha256(PROMPT_VERSION.encode()).hexdigest()[:32],
            # Forward documented GPT-6 fields through the official SDK's escape hatch.
            # This also works with SDK releases that predate typed prompt_cache_options.
            "extra_body": {"prompt_cache_options": {"mode": "explicit", "ttl": "30m"}},
        }
        if request.research:
            kwargs["tools"] = [
                {
                    "type": "web_search",
                    "filters": {
                        "allowed_domains": [
                            "gesetze-im-internet.de",
                            "rechtsprechung-im-internet.de",
                            "eur-lex.europa.eu",
                            "curia.europa.eu",
                            "bundesgerichtshof.de",
                            "bundesverfassungsgericht.de",
                            "datenschutzkonferenz-online.de",
                            "edpb.europa.eu",
                            "bfdi.bund.de",
                        ]
                    },
                }
            ]
            kwargs["include"] = ["web_search_call.action.sources"]
            kwargs["max_tool_calls"] = 5
        started = perf_counter()
        try:
            async with asyncio.timeout(self.timeout):
                response = await self.client.responses.create(**kwargs)
        except (TimeoutError, APITimeoutError):
            raise AnalysisError(
                "Die Analyse hat das Zeitlimit erreicht. Bitte den Umfang "
                "reduzieren oder erneut starten.",
                504,
            ) from None
        except AuthenticationError:
            raise AnalysisError(
                "OpenAI-Zugang nicht gültig. Bitte die Serverkonfiguration prüfen.", 503
            ) from None
        except RateLimitError:
            raise AnalysisError(
                "OpenAI-Kontingent oder Ratenlimit erreicht. Bitte später erneut "
                "versuchen und das API-Kontingent prüfen.",
                429,
            ) from None
        except APIConnectionError:
            raise AnalysisError(
                "OpenAI ist nicht erreichbar. Bitte die Verbindung prüfen.", 503
            ) from None
        except APIStatusError:
            raise AnalysisError(
                "OpenAI konnte die Anfrage nicht verarbeiten. Bitte Modellzugang "
                "und Konfiguration prüfen."
            ) from None

        provider_duration_ms = round((perf_counter() - started) * 1000)
        for item in response.output:
            for content in getattr(item, "content", []):
                if getattr(content, "type", "") == "refusal":
                    raise AnalysisError(
                        "Das Modell hat die Bearbeitung abgelehnt. Bitte den "
                        "Prüfauftrag überarbeiten.",
                        422,
                    )
        if response.status != "completed":
            raise AnalysisError(
                "Die Modellantwort ist unvollständig. Es wurde kein Ergebnis "
                "gespeichert. Bitte den Prüfungsumfang reduzieren."
            )
        try:
            result = ModelAnalysis.model_validate_json(response.output_text)
        except (ValidationError, ValueError):
            raise AnalysisError(
                "Die Modellantwort entspricht nicht dem erforderlichen Format. "
                "Bitte die Analyse erneut starten."
            ) from None
        usage = None
        if response.usage:
            usage = Usage(
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                cached_tokens=getattr(response.usage.input_tokens_details, "cached_tokens", 0) or 0,
                cache_write_tokens=getattr(
                    response.usage.input_tokens_details, "cache_write_tokens", None
                ),
            )
        sources = provider_sources(response) if request.research else []
        findings = verify_findings(result, documents, {s.url for s in sources})
        if request.workflow == "compare":
            for finding in findings:
                # A proposed replacement must target the counterdraft. Original-only
                # evidence can document a deletion, but cannot produce a counterdraft redline.
                if finding.source_document_id != request.document_ids[1]:
                    finding.suggestion = ""
        return Analysis(
            id=new_id(),
            title=result.title,
            workflow=request.workflow,
            summary=result.summary,
            findings=findings,
            timeline=verify_timeline(result, documents),
            questions=result.questions,
            created_at=now(),
            model=request.model,
            effort=request.effort,
            is_demo=False,
            usage=usage,
            sources=sources,
            provider_request_id=getattr(response, "_request_id", None),
            provider_duration_ms=provider_duration_ms,
            prompt_version=PROMPT_VERSION,
            document_ids=list(request.document_ids),
            compliance_task=request.compliance_task,
        )
