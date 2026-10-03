import asyncio
import json

import httpx
import pytest
from openai import AsyncOpenAI

from app.analysis import AnalysisError, AnalysisService
from app.schemas import AnalysisRequest, Document

QUOTE = "Die Haftung ist auf eine Monatsvergütung beschränkt."
DOC = Document(id="doc-1", name="Vertrag.txt", text=QUOTE, page_count=1, char_count=len(QUOTE))


def model_result():
    return {
        "title": "Vertragsprüfung",
        "summary": "Eine Klausel ist zu prüfen.",
        "findings": [
            {
                "title": "Haftungsgrenze",
                "severity": "high",
                "category": "Haftung",
                "description": "Die Ausnahmen sind zu prüfen.",
                "source_quote": QUOTE,
                "source_document_id": DOC.id,
                "source_location": "Seite 999",
                "suggestion": "Die Haftung für Vorsatz bleibt unbeschränkt.",
                "legal_basis": "§ 276 Abs. 3 BGB – Anwendbarkeit prüfen.",
                "source_urls": [
                    "https://gesetze-im-internet.de/bgb/__276.html",
                    "https://invented.invalid/proof",
                ],
            }
        ],
        "timeline": [],
        "questions": ["AGB oder Individualvereinbarung?"],
    }


def provider_response(result=None, status="completed", refusal=False, annotations=None):
    content = (
        [{"type": "refusal", "refusal": "Provider private refusal text"}]
        if refusal
        else [
            {
                "type": "output_text",
                "text": json.dumps(result or model_result()),
                "annotations": annotations or [],
            },
        ]
    )
    return {
        "id": "resp_offline",
        "object": "response",
        "created_at": 1,
        "model": "gpt-6-luna",
        "status": status,
        "output": [
            {
                "id": "msg_offline",
                "type": "message",
                "role": "assistant",
                "status": "completed",
                "content": content,
            }
        ],
        "usage": {
            "input_tokens": 2000,
            "output_tokens": 400,
            "total_tokens": 2400,
            "input_tokens_details": {"cached_tokens": 1000},
            "output_tokens_details": {"reasoning_tokens": 100},
        },
    }


def service_with_handler(handler, timeout=5):
    client = AsyncOpenAI(
        api_key="offline-test-key",
        max_retries=0,
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    return AnalysisService(client, timeout), client


async def test_serialized_openai_request_and_verified_evidence():
    captured = []

    def handler(request):
        captured.append(json.loads(request.content))
        return httpx.Response(
            200, json=provider_response(), headers={"x-request-id": "req_offline"}
        )

    service, client = service_with_handler(handler)
    try:
        result = await service.run(
            AnalysisRequest(workflow="contract", document_ids=[DOC.id]), [DOC]
        )
    finally:
        await client.close()
    body = captured[0]
    assert body["model"] == "gpt-6-luna"
    assert body["reasoning"] == {"effort": "high"}
    assert body["store"] is False
    assert body["prompt_cache_options"] == {"mode": "explicit", "ttl": "30m"}
    assert body["input"][0]["content"][0]["prompt_cache_breakpoint"] == {"mode": "explicit"}
    assert "prompt_cache_breakpoint" not in json.dumps(body["input"][1])
    assert "temperature" not in body and "tools" not in body
    assert body["text"]["format"]["strict"] is True
    assert body["text"]["format"]["schema"]["additionalProperties"] is False
    assert result.findings[0].verified
    assert result.findings[0].source_location == "Textfundstelle"
    assert result.findings[0].source_urls == []
    assert result.usage.cached_tokens == 1000
    assert result.provider_request_id == "req_offline"


async def test_research_retains_only_provider_attributed_urls():
    url = "https://gesetze-im-internet.de/bgb/__276.html"
    captured = []

    def handler(request):
        captured.append(json.loads(request.content))
        return httpx.Response(
            200,
            json=provider_response(
                annotations=[
                    {
                        "type": "url_citation",
                        "url": url,
                        "title": "§ 276 BGB",
                        "start_index": 0,
                        "end_index": 10,
                    }
                ]
            ),
        )

    service, client = service_with_handler(handler)
    try:
        result = await service.run(
            AnalysisRequest(workflow="contract", document_ids=[DOC.id], research=True), [DOC]
        )
    finally:
        await client.close()
    assert captured[0]["tools"][0]["type"] == "web_search"
    assert captured[0]["include"] == ["web_search_call.action.sources"]
    assert result.findings[0].source_urls == [url]
    assert [source.url for source in result.sources] == [url]


@pytest.mark.parametrize(
    "payload,expected",
    [
        (provider_response(status="incomplete"), "unvollständig"),
        (provider_response(refusal=True), "abgelehnt"),
        (provider_response(result={"unexpected": "PRIVATE CONTENT"}), "Format"),
    ],
)
async def test_provider_non_results_fail_closed(payload, expected):
    service, client = service_with_handler(lambda request: httpx.Response(200, json=payload))
    try:
        with pytest.raises(AnalysisError) as error:
            await service.run(AnalysisRequest(workflow="contract", document_ids=[DOC.id]), [DOC])
    finally:
        await client.close()
    assert expected in error.value.detail
    assert "PRIVATE" not in error.value.detail


@pytest.mark.parametrize("status,expected", [(401, 503), (429, 429), (500, 502)])
async def test_provider_errors_hide_raw_content(status, expected):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(
            status, json={"error": {"message": "PRIVATE DOCUMENT API KEY", "type": "test_error"}}
        )

    service, client = service_with_handler(handler)
    try:
        with pytest.raises(AnalysisError) as error:
            await service.run(AnalysisRequest(workflow="contract", document_ids=[DOC.id]), [DOC])
    finally:
        await client.close()
    assert error.value.status_code == expected
    assert "PRIVATE" not in error.value.detail
    assert len(calls) == 1  # No automatic duplicate billable analyses.


async def test_timeout_and_cancellation_stop_provider_work():
    finished = asyncio.Event()

    async def handler(request):
        try:
            await asyncio.sleep(60)
        finally:
            finished.set()

    service, client = service_with_handler(handler, timeout=0.02)
    try:
        with pytest.raises(AnalysisError) as error:
            await service.run(AnalysisRequest(workflow="contract", document_ids=[DOC.id]), [DOC])
        assert error.value.status_code == 504
        assert finished.is_set()
        finished.clear()
        service.timeout = 60
        task = asyncio.create_task(
            service.run(AnalysisRequest(workflow="contract", document_ids=[DOC.id]), [DOC])
        )
        await asyncio.sleep(0.02)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert finished.is_set()
    finally:
        await client.close()
