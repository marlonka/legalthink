from __future__ import annotations

import asyncio
import hashlib
import json
import re
import unicodedata
from time import perf_counter
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

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
    ComparisonEvidence,
    ComparisonSource,
    Document,
    Finding,
    ModelAnalysis,
    ModelComparisonAnalysis,
    ModelComparisonFinding,
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
    # The extractor adds one marker per page. Identical-looking document text
    # must not invent page provenance; ambiguous legacy text keeps only a quote match.
    if pages[0].strip() or pages[1::2] != [str(page) for page in range(1, document.page_count + 1)]:
        return None
    location = None
    for i in range(1, len(pages), 2):
        text = normalized(pages[i + 1])
        first = text.find(quote)
        if first < 0:
            continue
        if location is not None or text.find(quote, first + 1) >= 0:
            return None
        location = f"Seite {pages[i]}"
    return location


def resolve_source(document_id: str, quote: str, documents: list[Document]) -> Document | None:
    """Recover a malformed model ID only from one unambiguous verbatim source match."""
    source = next((doc for doc in documents if doc.id == document_id), None)
    if source:
        return source
    quote = normalized(quote)
    if len(quote) < 12:
        return None
    matches = [doc for doc in documents if quote in normalized(doc.text)]
    if len(matches) == 1:
        return matches[0]

    # Correspondence may repeat across case files. Require both a verbatim match
    # and one unambiguous UUID with a single changed or transposed digit.
    def simple_uuid_typo(candidate: str) -> bool:
        try:
            wanted, actual = UUID(document_id).hex, UUID(candidate).hex
        except ValueError:
            return False
        changed = [i for i, (a, b) in enumerate(zip(wanted, actual, strict=True)) if a != b]
        if len(changed) <= 1:
            return True
        if len(changed) != 2:
            return False
        a, b = changed
        return b == a + 1 and wanted[a] == actual[b] and wanted[b] == actual[a]

    nearby = [doc for doc in matches if simple_uuid_typo(doc.id)]
    return nearby[0] if len(nearby) == 1 else None


def recover_source_references(analysis: Analysis, documents: list[Document]) -> None:
    """Repair response references in memory; never rewrite saved reports or deleted sources."""
    ids = {doc.id for doc in documents}
    known_ids = {*analysis.document_ids, analysis.source_text_document_id}
    for item in [*analysis.findings, *analysis.timeline]:
        if item.source_document_id in ids or item.source_document_id in known_ids:
            continue
        source = resolve_source(item.source_document_id, item.source_quote, documents)
        if source is None:
            continue
        item.source_document_id = source.id
        item.verified = True
        location = _page_location(source, normalized(item.source_quote))
        if isinstance(item, Finding):
            item.source_document_name = source.name
            item.source_location = location or "Textfundstelle"
        else:
            item.source = source.name + (f" · {location}" if location else "")


def verify_findings(
    result: ModelAnalysis, documents: list[Document], allowed_urls: set[str] | None = None
) -> list[Finding]:
    findings = []
    for item in result.findings:
        comparison = None
        if isinstance(item, ModelComparisonFinding):
            # Document order is supplied by the user. The model cannot select another
            # document (including pasted correspondence) as either contract version.
            original, counterdraft = documents[:2]
            comparison = ComparisonEvidence(
                change_type=item.comparison.change_type,
                original=verify_comparison_source(original, item.comparison.original_quote),
                counterdraft=verify_comparison_source(
                    counterdraft, item.comparison.counterdraft_quote
                ),
            )
            target = (
                comparison.original
                if comparison.change_type == "removed"
                else comparison.counterdraft
            )
            item = item.model_copy(
                update={
                    "source_document_id": target.source_document_id,
                    "source_quote": target.source_quote,
                    "suggestion": "" if comparison.change_type == "removed" else item.suggestion,
                }
            )
        doc = resolve_source(item.source_document_id, item.source_quote, documents)
        quote = normalized(item.source_quote)
        # Case-sensitive, whitespace-tolerant containment. Verification means text match only.
        verified = bool(doc and len(quote) >= 12 and quote in normalized(doc.text))
        location = "Textfundstelle"
        if verified and doc:
            location = _page_location(doc, quote) or "Textfundstelle"
        elif not verified:
            location = "Beleg nicht bestätigt"
        fields = item.model_dump(exclude={"comparison"})
        fields["source_document_id"] = doc.id if doc else item.source_document_id
        fields["source_location"] = location
        fields["source_urls"] = [url for url in item.source_urls if url in (allowed_urls or set())]
        findings.append(
            Finding(
                **fields,
                id=new_id(),
                verified=verified,
                source_document_name=doc.name if doc else "",
                comparison=comparison,
            )
        )
    return findings


def verify_comparison_source(document: Document, quote: str) -> ComparisonSource:
    normalized_quote = normalized(quote)
    verified = bool(len(normalized_quote) >= 12 and normalized_quote in normalized(document.text))
    return ComparisonSource(
        source_document_id=document.id,
        source_document_name=document.name,
        source_quote=quote,
        source_location=(
            (_page_location(document, normalized_quote) or "Textfundstelle")
            if verified
            else "Beleg nicht bestätigt"
            if quote.strip()
            else ""
        ),
        verified=verified,
    )


def verify_timeline(result: ModelAnalysis, documents: list[Document]) -> list[TimelineEntry]:
    events = []
    for item in result.timeline:
        document = resolve_source(item.source_document_id, item.source_quote, documents)
        quote = normalized(item.source_quote)
        verified = bool(document and len(quote) >= 12 and quote in normalized(document.text))
        fields = item.model_dump()
        fields["source_document_id"] = document.id if document else item.source_document_id
        fields["source"] = "Beleg nicht bestätigt"
        if verified and document:
            location = _page_location(document, quote)
            fields["source"] = document.name + (f" · {location}" if location else "")
        events.append(TimelineEntry(**fields, verified=verified))
    return events


def provider_sources(response: Any) -> list[Source]:
    found: dict[str, Source] = {}

    def add_source(url: Any, title: str | None, *, replace: bool = False) -> None:
        if not isinstance(url, str):
            return
        try:
            parsed = urlsplit(url)
            if parsed.scheme not in {"http", "https"} or not parsed.hostname:
                return
        except ValueError:
            # A malformed citation must not discard an otherwise completed report.
            return
        if replace or url not in found:
            found[url] = Source(title=title or parsed.netloc, url=url)

    for item in response.output:
        if getattr(item, "type", "") == "message":
            for content in getattr(item, "content", []):
                for annotation in getattr(content, "annotations", []):
                    add_source(
                        getattr(annotation, "url", ""),
                        getattr(annotation, "title", None),
                        replace=True,
                    )
        if getattr(item, "type", "") == "web_search_call":
            for source in getattr(getattr(item, "action", None), "sources", []) or []:
                url = (
                    source.get("url", "")
                    if isinstance(source, dict)
                    else getattr(source, "url", "")
                )
                title = (
                    source.get("title")
                    if isinstance(source, dict)
                    else getattr(source, "title", None)
                )
                add_source(url, title)
    return list(found.values())[:30]


class AnalysisService:
    def __init__(self, client: AsyncOpenAI, timeout: float = 180.0):
        self.client = client
        self.timeout = timeout

    async def run(
        self,
        request: AnalysisRequest,
        documents: list[Document],
        playbook: Playbook | None = None,
        *,
        pasted_document: Document | None = None,
    ) -> Analysis:
        evidence_documents = [*documents, *([pasted_document] if pasted_document else [])]
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
        if pasted_document:
            payload["source_text_document"] = pasted_document.model_dump(
                include={"id", "name", "text"}
            )
        result_schema = ModelComparisonAnalysis if request.workflow == "compare" else ModelAnalysis
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
                    "schema": result_schema.model_json_schema(),
                }
            },
            "store": False,
            "max_output_tokens": 24000,
            "truncation": "disabled",
            "prompt_cache_key": hashlib.sha256(PROMPT_VERSION.encode()).hexdigest()[:32],
            "prompt_cache_options": {"mode": "explicit", "ttl": "30m"},
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
        except APIStatusError as error:
            if error.code == "model_not_found":
                raise AnalysisError(
                    f"Das Modell {request.model} ist für das OpenAI-Projekt dieses "
                    "API-Schlüssels nicht verfügbar. Prüfen Sie den Modellzugriff im "
                    "OpenAI-Projekt oder verwenden Sie einen Schlüssel aus einem "
                    "freigeschalteten Projekt.",
                    503,
                ) from None
            if error.status_code == 403:
                raise AnalysisError(
                    "OpenAI verweigert den Zugriff. Prüfen Sie die Berechtigungen des "
                    "API-Schlüssels und des zugehörigen Projekts.",
                    503,
                ) from None
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
            result = result_schema.model_validate_json(response.output_text)
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
        findings = verify_findings(result, evidence_documents, {s.url for s in sources})
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
            timeline=verify_timeline(result, evidence_documents),
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
            source_text_document_id=pasted_document.id if pasted_document else None,
            compliance_task=request.compliance_task,
        )
