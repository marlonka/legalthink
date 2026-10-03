from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Workflow = Literal["contract", "compare", "chronology", "compliance", "advertising"]
Effort = Literal["none", "low", "medium", "high", "xhigh", "max"]
Severity = Literal["high", "medium", "low", "info"]

MODELS = [
    {
        "id": "gpt-6.1-sol",
        "name": "GPT-6.1 Sol",
        "description": "Für anspruchsvolle Prüfungen und komplexe Abwägungen.",
        "efforts": ["low", "medium", "high", "xhigh", "max"],
        "default_effort": "medium",
    },
    {
        "id": "gpt-6-luna",
        "name": "GPT-6 Luna",
        "description": "Für fokussierte Aufgaben und schnelle erste Prüfungen.",
        "efforts": ["none", "low", "medium", "high", "xhigh", "max"],
        "default_effort": "medium",
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


class AnalysisRequest(StrictModel):
    workflow: Workflow
    document_ids: list[str] = Field(min_length=1, max_length=12)
    context: str = Field(default="", max_length=20000)
    model: Literal["gpt-6.1-sol", "gpt-6-luna"] = "gpt-6.1-sol"
    effort: Effort = "medium"
    playbook_id: str | None = None
    research: bool = False

    @model_validator(mode="after")
    def validate_selection(self) -> AnalysisRequest:
        selected = next(m for m in MODELS if m["id"] == self.model)
        if self.effort not in selected["efforts"]:
            raise ValueError("Diese Denktiefe wird vom gewählten Modell nicht unterstützt.")
        if len(set(self.document_ids)) != len(self.document_ids):
            raise ValueError("Dokumente dürfen nur einmal ausgewählt werden.")
        if self.workflow == "compare" and len(self.document_ids) != 2:
            raise ValueError("Die Synopse benötigt genau zwei Dokumente: Entwurf und Gegenentwurf.")
        return self


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


class Finding(ModelFinding):
    id: str
    verified: bool


class ModelTimelineEntry(StrictModel):
    date: str
    event: str
    source: str
    open_question: str
    source_document_id: str
    source_quote: str


class TimelineEntry(ModelTimelineEntry):
    verified: bool


class ModelAnalysis(StrictModel):
    title: str
    summary: str
    findings: list[ModelFinding] = Field(max_length=30)
    timeline: list[ModelTimelineEntry] = Field(max_length=100)
    questions: list[str] = Field(max_length=12)


class Usage(StrictModel):
    input_tokens: int
    output_tokens: int
    cached_tokens: int


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
