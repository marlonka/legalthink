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
    ProcessingRegion,
    Source,
    TimelineEntry,
    Usage,
    new_id,
    now,
)

# Reasoning tokens count toward this limit. A 1M-character matter at xhigh can need
# substantially more than the visible report; an incomplete response is not saved.
MAX_OUTPUT_TOKENS = 64_000
STANDARD_TIMEOUT_SECONDS = 600.0
FLEX_TIMEOUT_SECONDS = 900.0
# Localize hosted search; the tool otherwise assumes a user in the United States.
WEB_SEARCH_LOCATION = {"type": "approximate", "country": "DE", "timezone": "Europe/Berlin"}
MAX_SOURCES = 30
# A shorter quote is too unspecific to confirm; frontend/src/quote.ts uses the same.
MIN_QUOTE_LENGTH = 12
_URL_FORBIDDEN = re.compile(r'[\s<>"\x00-\x1f\x7f]')


class AnalysisError(Exception):
    def __init__(self, detail: str, status_code: int = 502):
        self.detail = detail
        self.status_code = status_code


def normalized(text: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", text)).strip()


def same_wording(first: str, second: str) -> bool:
    """Equal text apart from whitespace.

    Extractor versions differ in line breaks and spacing, for example where a form feed
    was removed or pypdf places a space. Different words or characters never match.
    """

    def compact(text: str) -> str:
        return re.sub(r"\s+", "", unicodedata.normalize("NFC", text))

    return compact(first) == compact(second)


class SourceIndex:
    """Normalized source texts and PDF pages, computed once per verification.

    Up to 1,000,000 characters are checked against 130 quotes; normalizing every
    source again for each quote took seconds and blocked the event loop.
    """

    def __init__(self, documents: list[Document]):
        self.documents = documents
        self.by_id = {document.id: document for document in documents}
        self._texts: dict[str, str] = {}
        self._pages: dict[str, list[tuple[str, str]] | None] = {}

    def text(self, document: Document) -> str:
        if document.id not in self._texts:
            self._texts[document.id] = normalized(document.text)
        return self._texts[document.id]

    def contains(self, document: Document | None, quote: str) -> bool:
        """Case-sensitive, whitespace-tolerant containment of a normalized quote."""
        return bool(document and len(quote) >= MIN_QUOTE_LENGTH and quote in self.text(document))

    def page_location(self, document: Document, quote: str) -> str | None:
        if document.id not in self._pages:
            self._pages[document.id] = _pdf_pages(document)
        pages = self._pages[document.id]
        if pages is None:
            return None
        location = None
        for number, text in pages:
            first = text.find(quote)
            if first < 0:
                continue
            if location is not None or text.find(quote, first + 1) >= 0:
                return None
            location = f"Seite {number}"
        return location

    def resolve(self, document_id: str, quote: str) -> Document | None:
        """Recover a malformed model ID only from one unambiguous verbatim source match."""
        source = self.by_id.get(document_id)
        if source:
            return source
        quote = normalized(quote)
        if len(quote) < MIN_QUOTE_LENGTH:
            return None
        matches = [doc for doc in self.documents if quote in self.text(doc)]
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


def _pdf_pages(document: Document) -> list[tuple[str, str]] | None:
    """Page number and normalized text per page, if the import's markers are complete."""
    if not document.name.lower().endswith(".pdf"):
        return None
    parts = re.split(r"\[Seite (\d+)\]\n", document.text)
    # The extractor adds one marker per page. Identical-looking document text
    # must not invent page provenance; ambiguous legacy text keeps only a quote match.
    if parts[0].strip() or parts[1::2] != [str(page) for page in range(1, document.page_count + 1)]:
        return None
    return [(parts[i], normalized(parts[i + 1])) for i in range(1, len(parts), 2)]


def recover_source_references(analysis: Analysis, documents: list[Document]) -> None:
    """Repair response references in memory; never rewrite saved reports or deleted sources."""
    index = SourceIndex(documents)
    known_ids = {*analysis.document_ids, analysis.source_text_document_id}
    for item in [*analysis.findings, *analysis.timeline]:
        if item.source_document_id in index.by_id or item.source_document_id in known_ids:
            continue
        source = index.resolve(item.source_document_id, item.source_quote)
        if source is None:
            continue
        item.source_document_id = source.id
        item.verified = True
        location = index.page_location(source, normalized(item.source_quote))
        if isinstance(item, Finding):
            item.source_document_name = source.name
            item.source_location = location or "Textfundstelle"
        else:
            item.source = source.name + (f" · {location}" if location else "")


def verify_findings(
    result: ModelAnalysis, documents: list[Document], allowed_urls: set[str] | None = None
) -> list[Finding]:
    index = SourceIndex(documents)
    findings = []
    for item in result.findings:
        comparison = None
        if isinstance(item, ModelComparisonFinding):
            # Document order is supplied by the user. The model cannot select another
            # document (including pasted correspondence) as either contract version.
            original, counterdraft = documents[:2]
            comparison = ComparisonEvidence(
                change_type=item.comparison.change_type,
                original=verify_comparison_source(index, original, item.comparison.original_quote),
                counterdraft=verify_comparison_source(
                    index, counterdraft, item.comparison.counterdraft_quote
                ),
            )
            # A replacement always targets the counterdraft. A deletion is evidenced in the
            # original, and a proposal there would become a false tracked change.
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
        doc = index.resolve(item.source_document_id, item.source_quote)
        quote = normalized(item.source_quote)
        # Verification means a text match only, not a legal or factual confirmation.
        verified = index.contains(doc, quote)
        location = "Textfundstelle"
        if verified and doc:
            location = index.page_location(doc, quote) or "Textfundstelle"
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


def verify_comparison_source(
    index: SourceIndex, document: Document, quote: str
) -> ComparisonSource:
    normalized_quote = normalized(quote)
    verified = index.contains(document, normalized_quote)
    return ComparisonSource(
        source_document_id=document.id,
        source_document_name=document.name,
        source_quote=quote,
        source_location=(
            (index.page_location(document, normalized_quote) or "Textfundstelle")
            if verified
            else "Beleg nicht bestätigt"
            if quote.strip()
            else ""
        ),
        verified=verified,
    )


def verify_timeline(result: ModelAnalysis, documents: list[Document]) -> list[TimelineEntry]:
    index = SourceIndex(documents)
    events = []
    for item in result.timeline:
        document = index.resolve(item.source_document_id, item.source_quote)
        quote = normalized(item.source_quote)
        verified = index.contains(document, quote)
        fields = item.model_dump()
        fields["source_document_id"] = document.id if document else item.source_document_id
        fields["source"] = "Beleg nicht bestätigt"
        if verified and document:
            location = index.page_location(document, quote)
            fields["source"] = document.name + (f" · {location}" if location else "")
        events.append(TimelineEntry(**fields, verified=verified))
    return events


def _content(item: Any) -> list[Any]:
    """Content parts of an output item. Reasoning items carry `content=None`."""
    return getattr(item, "content", None) or []


def final_output_texts(response: Any) -> list[str]:
    """Return the text of each final assistant message.

    GPT-6 models can add `commentary` messages (for example before a hosted web
    search) or, occasionally, an empty or repeated message. `response.output_text`
    joins all of them, which is not one JSON value.
    """
    messages = [item for item in response.output if getattr(item, "type", "") == "message"]
    final = [item for item in messages if getattr(item, "phase", None) == "final_answer"]
    texts = []
    for item in final or messages:
        if getattr(item, "phase", None) == "commentary":
            continue
        text = "".join(
            getattr(content, "text", "") or ""
            for content in _content(item)
            if getattr(content, "type", "") == "output_text"
        )
        if text.strip():
            texts.append(text)
    return texts


def parse_result(response: Any, schema: type[ModelAnalysis]) -> ModelAnalysis:
    """Accept exactly one distinct valid report; never choose between differing reports."""
    results: list[ModelAnalysis] = []
    for text in final_output_texts(response):
        try:
            result = schema.model_validate_json(text)
        except (ValidationError, ValueError):
            continue
        if result not in results:
            results.append(result)
    if len(results) != 1:
        raise AnalysisError(
            "Die Modellantwort entspricht nicht dem erforderlichen Format. "
            "Bitte die Analyse erneut starten."
        )
    return results[0]


def provider_sources(response: Any) -> list[Source]:
    """URLs from tool metadata: the answer's citations first, then other consulted sources.

    Only these URLs may appear as research evidence. Citations come first so that the
    stored list, which keeps at most MAX_SOURCES entries, never drops a cited source.
    """
    cited: dict[str, Source] = {}
    consulted: dict[str, Source] = {}

    def add(found: dict[str, Source], url: Any, title: Any) -> None:
        # Unencoded whitespace, control characters, quotes or angle brackets never
        # belong to a URL; they could also end a link in the Markdown export.
        if not isinstance(url, str) or _URL_FORBIDDEN.search(url):
            return
        try:
            parsed = urlsplit(url)
            if parsed.scheme not in {"http", "https"} or not parsed.hostname:
                return
        except ValueError:
            # A malformed citation must not discard an otherwise completed report.
            return
        if url not in found:
            label = title if isinstance(title, str) and title.strip() else parsed.netloc
            found[url] = Source(title=label, url=url)

    for item in response.output:
        kind = getattr(item, "type", "")
        if kind == "message":
            for content in _content(item):
                for annotation in getattr(content, "annotations", None) or []:
                    add(cited, getattr(annotation, "url", None), getattr(annotation, "title", None))
        elif kind == "web_search_call":
            for source in getattr(getattr(item, "action", None), "sources", None) or []:
                if isinstance(source, dict):
                    add(consulted, source.get("url"), source.get("title"))
                else:
                    add(consulted, getattr(source, "url", None), getattr(source, "title", None))
    return [*cited.values(), *(source for url, source in consulted.items() if url not in cited)]


class AnalysisService:
    def __init__(
        self,
        client: AsyncOpenAI,
        timeout: float = STANDARD_TIMEOUT_SECONDS,
        processing_region: ProcessingRegion = "global",
    ):
        self.client = client
        self.timeout = timeout
        self.processing_region = processing_region

    async def run(
        self,
        request: AnalysisRequest,
        documents: list[Document],
        playbook: Playbook | None = None,
        *,
        pasted_document: Document | None = None,
        answered: asyncio.Event | None = None,
    ) -> Analysis:
        """Request one analysis and verify its evidence.

        `answered` is set once OpenAI has returned a response. The request is billed from
        then on, so the caller keeps the result instead of cancelling it.
        """
        region = request.processing_region or self.processing_region
        client = (
            self.client
            if region == self.processing_region
            else self.client.with_options(data_residency=region)
        )
        timeout = FLEX_TIMEOUT_SECONDS if request.service_tier == "flex" else self.timeout
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
            "service_tier": request.service_tier,
            "input": [
                {
                    "role": "developer",
                    "content": [
                        {
                            "type": "input_text",
                            "text": SYSTEM_PROMPT,
                        },
                        {"type": "input_text", "text": scope},
                    ],
                },
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "legal_analysis",
                    "strict": True,
                    "schema": result_schema.model_json_schema(),
                }
            },
            "store": False,
            "max_output_tokens": MAX_OUTPUT_TOKENS,
            "truncation": "disabled",
            "prompt_cache_key": hashlib.sha256(
                f"{PROMPT_VERSION}:{request.model}".encode()
            ).hexdigest()[:32],
        }
        if request.effort != "auto":
            kwargs["reasoning"] = {"effort": request.effort}
        # Explicit cache breakpoints are not supported by every Responses model.
        # Custom models retain the common cache key and OpenAI's default caching.
        if request.custom_model is None:
            kwargs["prompt_cache_options"] = {"mode": "explicit", "ttl": "30m"}
            kwargs["input"][0]["content"][0]["prompt_cache_breakpoint"] = {"mode": "explicit"}
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
                    "user_location": WEB_SEARCH_LOCATION,
                }
            ]
            kwargs["include"] = ["web_search_call.action.sources"]
            kwargs["max_tool_calls"] = 5
        started = perf_counter()
        try:
            async with asyncio.timeout(timeout):
                response = await client.responses.create(**kwargs, timeout=timeout)
        except (TimeoutError, APITimeoutError):
            if request.service_tier == "flex":
                raise AnalysisError(
                    "Flex hat das Zeitlimit von 15 Minuten erreicht. Bitte später erneut "
                    "versuchen oder Standardverarbeitung wählen.",
                    504,
                ) from None
            raise AnalysisError(
                "Die Analyse hat das Zeitlimit erreicht. Bitte den Umfang "
                "reduzieren oder erneut starten.",
                504,
            ) from None
        except AuthenticationError:
            raise AnalysisError(
                "OpenAI hat die Anmeldung abgewiesen. Bitte API-Schlüssel und "
                "Zugriffsberechtigungen in der Serverkonfiguration prüfen.",
                503,
            ) from None
        except RateLimitError as error:
            if request.service_tier == "flex" and error.code == "resource_unavailable":
                raise AnalysisError(
                    "OpenAI hat derzeit keine Flex-Kapazität. Bitte später erneut starten "
                    "oder unter Erweiterte Einstellungen den Verarbeitungsmodus ändern.",
                    429,
                ) from None
            quota_messages = {
                "credit_balance_exhausted": (
                    "Das OpenAI-API-Guthaben ist aufgebraucht. Bitte die Abrechnung "
                    "bei OpenAI prüfen."
                ),
                "project_spend_limit_exceeded": (
                    "Das OpenAI-Projektlimit ist erreicht. Bitte die Limits des "
                    "zugehörigen Projekts bei OpenAI prüfen."
                ),
                "organization_spend_limit_exceeded": (
                    "Das Ausgabenlimit der OpenAI-Organisation ist erreicht. Bitte "
                    "die Organisationslimits bei OpenAI prüfen."
                ),
                "organization_usage_limit_exceeded": (
                    "Das Nutzungslimit der OpenAI-Organisation ist erreicht. Bitte "
                    "die Organisationslimits bei OpenAI prüfen."
                ),
            }
            if error.code in quota_messages:
                raise AnalysisError(quota_messages[error.code], 429) from None
            if error.code == "insufficient_quota" or error.type == "insufficient_quota":
                raise AnalysisError(
                    "OpenAI-API-Kontingent nicht verfügbar. Bitte Guthaben und Limits "
                    "bei OpenAI prüfen, bevor Sie erneut starten.",
                    429,
                ) from None
            raise AnalysisError(
                "OpenAI-Ratenlimit erreicht. Bitte später erneut starten.",
                429,
            ) from None
        except APIConnectionError:
            raise AnalysisError(
                "OpenAI ist nicht erreichbar. Bitte die Verbindung prüfen.", 503
            ) from None
        except APIStatusError as error:
            if error.code == "context_length_exceeded":
                raise AnalysisError(
                    "Die Eingabe überschreitet das Kontextlimit des gewählten Modells. "
                    "Bitte weniger Dokumente oder Text verwenden.",
                    422,
                ) from None
            if error.status_code == 400 and error.param == "service_tier":
                tier_label = "Flex" if request.service_tier == "flex" else "Standard"
                raise AnalysisError(
                    f"OpenAI hat den Verarbeitungsmodus {tier_label} abgewiesen. "
                    "Bitte die erlaubten Verarbeitungsmodi im OpenAI-Projekt prüfen "
                    "oder unter Erweiterte Einstellungen einen anderen Modus wählen.",
                    503,
                ) from None
            if error.status_code == 400 and error.param:
                parameter = str(error.param)
                if parameter.startswith("reasoning"):
                    raise AnalysisError(
                        "OpenAI unterstützt diesen Denkaufwand beim gewählten Modell nicht. "
                        "Prüfen Sie die Denkstufen in den Einstellungen oder wählen Sie "
                        "bei einem eigenen Modell den Modellstandard.",
                        422,
                    ) from None
                if parameter.startswith(("text.format", "response_format")):
                    raise AnalysisError(
                        "Das gewählte Modell unterstützt das benötigte strukturierte "
                        "Antwortformat nicht. Wählen Sie ein Modell mit Structured Outputs.",
                        422,
                    ) from None
                if parameter.startswith(("tools", "include", "max_tool_calls")):
                    raise AnalysisError(
                        "OpenAI hat die Webrecherche für dieses Modell abgewiesen. "
                        "Deaktivieren Sie die Webrecherche oder wählen Sie ein kompatibles Modell.",
                        422,
                    ) from None
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
                    "API-Schlüssels und des zugehörigen Projekts."
                    + (
                        " Gewählte Region: Europa. Prüfen Sie auch die Region des "
                        "OpenAI-Projekts; die Anfrage wurde nicht global wiederholt."
                        if region == "eu"
                        else ""
                    ),
                    503,
                ) from None
            if error.status_code == 400 and (region == "eu" or request.service_tier == "flex"):
                raise AnalysisError(
                    "OpenAI hat die Anfrage abgewiesen. Gewählt: "
                    + ("Europa" if region == "eu" else "Global")
                    + " · "
                    + ("Flex" if request.service_tier == "flex" else "Standard")
                    + ". Bitte die Verarbeitungseinstellungen und den Modellzugang "
                    "im OpenAI-Projekt prüfen. Die Auswahl wurde nicht geändert.",
                    503,
                ) from None
            if error.status_code == 408:
                raise AnalysisError(
                    "OpenAI hat die Anfrage wegen Zeitüberschreitung beendet. "
                    "Bitte später erneut starten oder den Umfang reduzieren.",
                    504,
                ) from None
            if error.status_code >= 500:
                raise AnalysisError(
                    "OpenAI ist vorübergehend nicht verfügbar. Bitte später erneut starten.",
                    503,
                ) from None
            raise AnalysisError(
                "OpenAI konnte die Anfrage nicht verarbeiten. Bitte Modellzugang "
                "und Konfiguration prüfen."
            ) from None

        provider_duration_ms = round((perf_counter() - started) * 1000)
        if answered is not None:
            answered.set()
        # Refusals are content parts of messages. Reasoning items carry no content list.
        if any(
            getattr(content, "type", "") == "refusal"
            for item in response.output
            if getattr(item, "type", "") == "message"
            for content in _content(item)
        ):
            raise AnalysisError(
                "Das Modell hat die Bearbeitung abgelehnt. Bitte den Prüfauftrag überarbeiten.",
                422,
            )
        if response.status != "completed":
            reason = getattr(getattr(response, "incomplete_details", None), "reason", None)
            if reason == "max_output_tokens":
                raise AnalysisError(
                    "Die Modellantwort hat das Ausgabelimit erreicht; Denkschritte zählen mit. "
                    "Es wurde kein Ergebnis gespeichert. Bitte den Prüfungsumfang reduzieren "
                    "oder eine niedrigere Denkstufe wählen."
                )
            if reason == "content_filter":
                raise AnalysisError(
                    "OpenAI hat die Ausgabe durch einen Inhaltsfilter beendet. Es wurde kein "
                    "Ergebnis gespeichert.",
                    422,
                )
            raise AnalysisError(
                "Die Modellantwort ist unvollständig. Es wurde kein Ergebnis "
                "gespeichert. Bitte den Prüfungsumfang reduzieren."
            )
        result = parse_result(response, result_schema)
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
        # Matching quotes against up to 1,000,000 characters runs off the event loop.
        findings, timeline = await asyncio.to_thread(
            lambda: (
                verify_findings(result, evidence_documents, {s.url for s in sources}),
                verify_timeline(result, evidence_documents),
            )
        )
        return Analysis(
            id=new_id(),
            title=result.title,
            workflow=request.workflow,
            summary=result.summary,
            findings=findings,
            timeline=timeline,
            questions=result.questions,
            created_at=now(),
            model=request.model,
            effort=request.effort,
            custom_model=request.custom_model,
            is_demo=False,
            usage=usage,
            sources=sources[:MAX_SOURCES],
            provider_request_id=getattr(response, "_request_id", None),
            provider_duration_ms=provider_duration_ms,
            processing_region=region,
            requested_service_tier=request.service_tier,
            service_tier=getattr(response, "service_tier", None),
            prompt_version=PROMPT_VERSION,
            document_ids=list(request.document_ids),
            source_text_document_id=pasted_document.id if pasted_document else None,
            compliance_task=request.compliance_task,
        )
