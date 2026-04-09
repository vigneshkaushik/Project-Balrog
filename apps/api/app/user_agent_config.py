"""Persisted per-deployment agent UI config (provider, model, API key) on disk."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.config import AgentSettings

_CONFIG_LOCK = threading.Lock()

MASKED_API_KEY_DISPLAY = "••••••••"


class PersistedUserAgentConfig(BaseModel):
    """Secrets file shape; never returned verbatim to clients."""

    provider: Literal["anthropic", "openai", "google", "custom"]
    model: str = Field(..., min_length=1)
    base_url: str | None = None
    api_key: str | None = None

    @model_validator(mode="after")
    def _custom_base(self) -> PersistedUserAgentConfig:
        if self.provider == "custom":
            if not (self.base_url and self.base_url.strip()):
                raise ValueError("base_url is required when provider is custom")
        return self


def default_config_path() -> Path:
    """``apps/api/data/agent_user_config.json`` (relative to package root)."""
    return Path(__file__).resolve().parent.parent / "data" / "agent_user_config.json"


def load_user_agent_config(path: Path) -> PersistedUserAgentConfig | None:
    if not path.is_file():
        return None
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        return PersistedUserAgentConfig.model_validate(data)
    except (OSError, json.JSONDecodeError, ValueError):
        return None


def save_user_agent_config(path: Path, config: PersistedUserAgentConfig) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    payload = config.model_dump(mode="json", exclude_none=True)
    text = json.dumps(payload, indent=2, ensure_ascii=False)
    with _CONFIG_LOCK:
        tmp.write_text(text, encoding="utf-8")
        tmp.replace(path)


def merge_persisted_api_key(
    settings: AgentSettings,
    stored: PersistedUserAgentConfig,
) -> AgentSettings:
    """When a key is stored for the active UI provider, use it instead of env defaults."""
    if stored.api_key and stored.api_key.strip():
        key = stored.api_key.strip()
        if stored.provider == "anthropic":
            return settings.model_copy(update={"anthropic_api_key": key})
        if stored.provider in ("openai", "custom"):
            return settings.model_copy(update={"openai_api_key": key})
        if stored.provider == "google":
            return settings.model_copy(update={"google_api_key": key})
    return settings


def env_key_configured_for_ui_provider(
    *,
    anthropic_key: str | None,
    openai_key: str | None,
    google_key: str | None,
    provider: str,
) -> bool:
    if provider == "anthropic":
        return bool(anthropic_key and anthropic_key.strip())
    if provider in ("openai", "custom"):
        return bool(openai_key and openai_key.strip())
    if provider == "google":
        return bool(google_key and google_key.strip())
    return False
