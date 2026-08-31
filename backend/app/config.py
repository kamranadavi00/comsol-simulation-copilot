import os
from dataclasses import dataclass, field


def _frontend_origins() -> list[str]:
    value = os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return [origin.strip() for origin in value.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    frontend_origins: list[str] = field(default_factory=_frontend_origins)
    max_upload_bytes: int = 50 * 1024 * 1024
    max_mesh_upload_bytes: int = int(os.getenv("MAX_MESH_UPLOAD_MB", "512")) * 1024 * 1024


settings = Settings()
