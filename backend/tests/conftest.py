"""Fail closed: the test suite cannot make a real httpx/OpenAI network request."""

import httpx
import pytest


@pytest.fixture(autouse=True)
def no_external_http(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("External HTTP is forbidden in offline tests.")

    async def async_forbidden(*args, **kwargs):
        raise AssertionError("External HTTP is forbidden in offline tests.")

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", forbidden)
    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", async_forbidden)
