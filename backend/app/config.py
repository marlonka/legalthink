from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

from .schemas import ProcessingRegion

BACKEND_DIR = Path(__file__).resolve().parent.parent
# The OpenAI SDK maps each region to its fixed endpoint (`data_residency`).
PROCESSING_REGIONS: tuple[ProcessingRegion, ...] = ("global", "eu")


@dataclass(frozen=True)
class Settings:
    data_dir: Path = field(default_factory=lambda: BACKEND_DIR / "data")
    api_key: str = field(default="", repr=False)
    api_token: str = field(default="", repr=False)
    allow_remote: bool = False
    allowed_origins: tuple[str, ...] = (
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    )
    allowed_hosts: tuple[str, ...] = ("localhost", "127.0.0.1", "[::1]")
    frontend_dir: Path = field(default_factory=lambda: BACKEND_DIR.parent / "frontend" / "dist")
    request_timeout: float = 600.0
    processing_region: ProcessingRegion = "global"
    max_upload_bytes: int = 12 * 1024 * 1024
    max_request_bytes: int = 13 * 1024 * 1024

    @classmethod
    def from_env(cls) -> Settings:
        load_dotenv(BACKEND_DIR / ".env")
        defaults = cls()
        region = os.getenv("OPENAI_PROCESSING_REGION", "global").strip().lower()
        if region not in PROCESSING_REGIONS:
            raise ValueError("OPENAI_PROCESSING_REGION must be global or eu.")
        remote = os.getenv("LEGALTHINK_ALLOW_REMOTE", "false").lower() == "true"
        token = os.getenv("LEGALTHINK_API_TOKEN", "")
        if remote and len(token) < 32:
            raise ValueError(
                "Remote access requires LEGALTHINK_API_TOKEN (at least 32 characters)."
            )
        if remote and (
            not os.getenv("LEGALTHINK_ALLOWED_ORIGINS") or not os.getenv("LEGALTHINK_ALLOWED_HOSTS")
        ):
            raise ValueError("Remote access requires explicit allowed origins and hosts.")
        if "*" in os.getenv("LEGALTHINK_ALLOWED_ORIGINS", "") or "*" in os.getenv(
            "LEGALTHINK_ALLOWED_HOSTS", ""
        ):
            raise ValueError("Wildcard hosts and origins are not allowed.")
        return cls(
            data_dir=Path(os.getenv("LEGALTHINK_DATA_DIR", str(defaults.data_dir))),
            api_key=os.getenv("OPENAI_API_KEY", ""),
            processing_region=region,
            api_token=token,
            allow_remote=remote,
            allowed_origins=tuple(
                x.strip()
                for x in os.getenv(
                    "LEGALTHINK_ALLOWED_ORIGINS", ",".join(defaults.allowed_origins)
                ).split(",")
                if x.strip()
            ),
            allowed_hosts=tuple(
                x.strip()
                for x in os.getenv(
                    "LEGALTHINK_ALLOWED_HOSTS", ",".join(defaults.allowed_hosts)
                ).split(",")
                if x.strip()
            ),
        )
