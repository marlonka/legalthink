from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope


class BuildAssets(StaticFiles):
    """Vite's content-hashed assets are public and immutable across deployments."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        if response.status_code in (200, 304):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response
