from __future__ import annotations

import hmac
import ipaddress

from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from .config import Settings


class RequestTooLarge(HTTPException):
    def __init__(self):
        super().__init__(413, "Die Anfrage ist zu groß.")


class SecurityBoundary:
    """ASGI boundary: bind policy, Host, Origin, optional bearer, and streamed body size."""

    def __init__(self, app, settings: Settings):
        self.app = app
        self.settings = settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {
            k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])
        }
        host = headers.get("host", "").split(":")[0]
        if headers.get("host", "").startswith("["):
            host = headers["host"].split("]")[0] + "]"
        if host not in self.settings.allowed_hosts:
            await JSONResponse({"detail": "Host nicht freigegeben."}, 403)(scope, receive, send)
            return
        origin = headers.get("origin")
        if origin and origin not in self.settings.allowed_origins:
            await JSONResponse({"detail": "Origin nicht freigegeben."}, 403)(scope, receive, send)
            return
        if scope.get("path", "").startswith("/api/"):
            client = scope.get("client")
            try:
                loopback = bool(client and ipaddress.ip_address(client[0]).is_loopback)
            except ValueError:
                loopback = False
            if not self.settings.allow_remote and not loopback:
                await JSONResponse(
                    {"detail": "Dieser Arbeitsbereich ist nur lokal erreichbar."}, 403
                )(scope, receive, send)
                return
            token = self.settings.api_token
            # Preflight does not read data or perform a mutation.
            if token and scope["method"] != "OPTIONS":
                actual = headers.get("authorization", "")
                if not hmac.compare_digest(actual.encode(), f"Bearer {token}".encode()):
                    await JSONResponse({"detail": "Zugriffstoken erforderlich."}, 401)(
                        scope, receive, send
                    )
                    return
        try:
            length = int(headers.get("content-length", "0"))
        except ValueError:
            length = self.settings.max_request_bytes + 1
        if length < 0 or length > self.settings.max_request_bytes:
            await JSONResponse(
                {"detail": "Die Anfrage ist zu groß (maximal 12 MB je Datei)."}, 413
            )(scope, receive, send)
            return
        received = 0
        response_started = False
        response_finished = False

        async def bounded_receive():
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > self.settings.max_request_bytes:
                raise RequestTooLarge()
            return message

        async def secured_send(message):
            nonlocal response_started, response_finished
            if message["type"] == "http.response.start":
                response_started = True
                extra = [
                    (b"x-content-type-options", b"nosniff"),
                    (b"referrer-policy", b"no-referrer"),
                    (b"x-frame-options", b"DENY"),
                    (
                        b"content-security-policy",
                        b"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; "
                        b"style-src 'self' 'unsafe-inline'; font-src 'self' blob:; "
                        b"img-src 'self' data:; "
                        b"worker-src 'self'; "
                        b"connect-src 'self'; base-uri 'none'; object-src 'none'; "
                        b"frame-ancestors 'none'; form-action 'self'",
                    ),
                ]
                if scope.get("path", "").startswith("/api/"):
                    extra.append((b"cache-control", b"no-store"))
                message["headers"] = list(message.get("headers", [])) + extra
            if message["type"] == "http.response.body" and not message.get("more_body", False):
                response_finished = True
            await send(message)

        try:
            await self.app(scope, bounded_receive, secured_send)
        except Exception:
            # Catch inside ServerErrorMiddleware: Starlette otherwise re-raises after
            # its 500 handler, allowing Uvicorn to log confidential exception values.
            if not response_started:
                await JSONResponse(
                    {
                        "detail": "Die Anfrage konnte nicht verarbeitet werden. "
                        "Bitte erneut versuchen."
                    },
                    500,
                )(scope, receive, secured_send)
            elif not response_finished:
                await send({"type": "http.response.body", "body": b"", "more_body": False})
