"""Fail closed: the test suite cannot make real HTTPX or HTTPX2 network requests."""

import httpx
import httpx2
import pytest


@pytest.fixture(autouse=True)
def no_external_http(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("External HTTP is forbidden in offline tests.")

    async def async_forbidden(*args, **kwargs):
        raise AssertionError("External HTTP is forbidden in offline tests.")

    for http in (httpx, httpx2):
        monkeypatch.setattr(http.HTTPTransport, "handle_request", forbidden)
        monkeypatch.setattr(http.AsyncHTTPTransport, "handle_async_request", async_forbidden)
