from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Workflow = Literal["contract", "compare", "chronology", "compliance", "advertising"]
ComplianceTask = Literal["general", "avv", "dsfa"]
DemoScenario = Literal[
    "contract", "compare", "chronology", "compliance", "avv", "dsfa", "advertising"
]
Effort = Literal["none", "low", "medium", "high", "xhigh", "max"]
ProcessingRegion = Literal["global", "eu"]
ServiceTier = Literal["default", "flex"]
Severity = Literal["high", "medium", "low", "info"]
MAX_MATERIAL_CHARS = 1_000_000
MAX_INSTRUCTION_CHARS = 10_000

MODELS = [
    {
        "id": "gpt-6-luna",
        "name": "GPT-6 Luna",
        "description": "Für fokussierte Aufgaben und schnelle erste Prüfungen.",
        "efforts": ["none", "low", "medium", "high", "xhigh", "max"],
        "default_effort": "xhigh",
    },
    {
        "id": "gpt-6.1-sol",
        "name": "GPT-6.1 Sol",
        "description": "Für anspruchsvolle Prüfungen und komplexe Abwägungen.",
        "efforts": ["low", "medium", "high", "xhigh", "max"],
        "default_effort": "xhigh",
    },
]


def new_id() -> str:
    return str(uuid4())


def now() -> str:
    return datetime.now(UTC).isoformat()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Document(StrictModel):
    id: str
    name: str
    text: str
    page_count: int
    char_count: int
    original_available: bool = False
    is_demo: bool = False


class DocumentDeleteRequest(StrictModel):
    document_ids: list[str] = Field(min_length=1, max_length=10_000)


class AnalysisRequest(StrictModel):
    workflow: Workflow
    document_ids: list[str] = Field(default_factory=list, max_length=12)
    source_text: str = Field(default="", max_length=MAX_MATERIAL_CHARS)
    context: str = Field(default="", max_length=MAX_INSTRUCTION_CHARS)
    model: Literal["gpt-6.1-sol", "gpt-6-luna"] = "gpt-6-luna"
    effort: Effort = "xhigh"
    playbook_id: str | None = None
    research: bool = True
    processing_region: ProcessingRegion | None = None
    service_tier: ServiceTier = "default"
    compliance_task: ComplianceTask = "general"

    @model_validator(mode="after")
    def validate_selection(self) -> AnalysisRequest:
        selected = next(m for m in MODELS if m["id"] == self.model)
        if self.effort not in selected["efforts"]:
            raise ValueError("Diese Denktiefe wird vom gewählten Modell nicht unterstützt.")
        if len(set(self.document_ids)) != len(self.document_ids):
            raise ValueError("Dokumente dürfen nur einmal ausgewählt werden.")
        if self.workflow == "compare" and len(self.document_ids) != 2:
            raise ValueError("Die Synopse benötigt genau zwei Dokumente: Entwurf und Gegenentwurf.")
        if not self.document_ids and not self.source_text.strip():
            raise ValueError("Bitte ein Dokument auswählen oder Text zur Prüfung einfügen.")
        if self.workflow != "compliance" and self.compliance_task != "general":
            raise ValueError("AVV und DSFA sind nur im Datenschutz-Workflow verfügbar.")
        return self


class DemoRequest(StrictModel):
    scenario: DemoScenario = "contract"


class ModelFinding(StrictModel):
    title: str
    severity: Severity
    category: str
    description: str
    source_quote: str
    source_document_id: str
    source_location: str
    suggestion: str
    legal_basis: str
    source_urls: list[str]


class ModelComparisonEvidence(StrictModel):
    change_type: Literal["modified", "added", "removed"]
    original_quote: str
    counterdraft_quote: str

    @model_validator(mode="after")
    def validate_sides(self) -> ModelComparisonEvidence:
        if self.change_type == "added" and self.original_quote.strip():
            raise ValueError("Eine ergänzte Regelung hat keinen Originalwortlaut.")
        if self.change_type == "removed" and self.counterdraft_quote.strip():
            raise ValueError("Eine gestrichene Regelung hat keinen Gegenentwurfswortlaut.")
        return self


class ModelComparisonFinding(ModelFinding):
    comparison: ModelComparisonEvidence


class ComparisonSource(StrictModel):
    source_document_id: str
    source_document_name: str
    source_quote: str
    source_location: str
    verified: bool


class ComparisonEvidence(StrictModel):
    change_type: Literal["modified", "added", "removed"]
    original: ComparisonSource
    counterdraft: ComparisonSource


class Finding(ModelFinding):
    id: str
    verified: bool
    source_document_name: str = ""
    comparison: ComparisonEvidence | None = None


class ModelTimelineEntry(StrictModel):
    date: str
    event: str
    source: str
    open_question: str
    source_document_id: str
    source_quote: str


class TimelineEntry(ModelTimelineEntry):
    verified: bool

    @model_validator(mode="after")
    def separate_legacy_quote(self) -> TimelineEntry:
        # Earlier records stored this exact suffix in source as well as source_quote.
        # Normalize the response only; leave the original SQLite record unchanged.
        suffix = ": " + self.source_quote
        if self.source_quote and self.source.endswith(suffix):
            self.source = self.source[: -len(suffix)]
        return self


class ModelAnalysis(StrictModel):
    title: str
    summary: str
    findings: list[ModelFinding] = Field(max_length=30)
    timeline: list[ModelTimelineEntry] = Field(max_length=100)
    questions: list[str] = Field(max_length=12)


class ModelComparisonAnalysis(ModelAnalysis):
    findings: list[ModelComparisonFinding] = Field(max_length=30)


class Usage(StrictModel):
    input_tokens: int
    output_tokens: int
    cached_tokens: int
    cache_write_tokens: int | None = None


class Source(StrictModel):
    title: str
    url: str


class Analysis(StrictModel):
    id: str
    title: str
    workflow: Workflow
    summary: str
    findings: list[Finding]
    timeline: list[TimelineEntry]
    questions: list[str]
    created_at: str
    model: str
    effort: Effort
    is_demo: bool
    usage: Usage | None = None
    sources: list[Source] = Field(default_factory=list)
    provider_request_id: str | None = None
    provider_duration_ms: int | None = None
    processing_region: ProcessingRegion | None = None
    requested_service_tier: ServiceTier | None = None
    service_tier: str | None = None
    prompt_version: str | None = None
    document_ids: list[str] = Field(default_factory=list)
    source_text_document_id: str | None = None
    source_text_document_name: str | None = None
    compliance_task: ComplianceTask = "general"
    demo_scenario: DemoScenario | None = None


class PlaybookInput(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=30000)

    @field_validator("name", "content")
    @classmethod
    def strip_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Das Feld darf nicht leer sein.")
        return value.strip()


class Playbook(PlaybookInput):
    id: str
    created_at: str
