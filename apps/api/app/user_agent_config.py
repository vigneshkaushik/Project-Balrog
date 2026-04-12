"""Persisted per-deployment agent UI config (provider, model, API key) on disk."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.config import AgentSettings

_CONFIG_LOCK = threading.Lock()

MASKED_API_KEY_DISPLAY = "••••••••"

_OPENAI_KEY_PROVIDERS = frozenset({"openai", "custom", "ollama"})

_UI_TO_LLM_PROVIDER: dict[str, str] = {
    "anthropic": "anthropic",
    "openai": "openai",
    "google": "google",
    "custom": "openai",
    "ollama": "ollama",
}


class PersistedUserAgentConfig(BaseModel):
    """Secrets file shape; never returned verbatim to clients."""

    provider: Literal["anthropic", "openai", "google", "custom", "ollama"]
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


def persisted_config_applies_to_env(
    base: AgentSettings,
    stored: PersistedUserAgentConfig | None,
) -> bool:
    """
    True when on-disk UI config should override env for this process.

    If ``LLM_PROVIDER`` in the environment does not match the saved provider
    family (e.g. .env says ``ollama`` but the JSON still says ``openai`` from an
    older session), the server uses environment-only settings so startup matches
    ``.env``. Saving again from the UI writes a new file aligned with the chosen
    provider.
    """
    if stored is None:
        return False
    return _UI_TO_LLM_PROVIDER[stored.provider] == base.llm_provider


def env_key_configured_for_ui_provider(
    *,
    anthropic_key: str | None,
    openai_key: str | None,
    google_key: str | None,
    provider: str,
) -> bool:
    """True when the environment already supplies a key for this UI provider."""
    if provider == "anthropic":
        return bool(anthropic_key and anthropic_key.strip())
    if provider in _OPENAI_KEY_PROVIDERS:
        return bool(openai_key and openai_key.strip())
    if provider == "google":
        return bool(google_key and google_key.strip())
    return False


# ---------------------------------------------------------------------------
# Merge persisted UI config with env-based AgentSettings
# ---------------------------------------------------------------------------

def effective_agent_settings(
    base: AgentSettings,
    stored: PersistedUserAgentConfig | None,
) -> AgentSettings:
    """
    Merge environment defaults with persisted UI config.

    Callers that load JSON from disk should pass ``stored`` only when
    ``persisted_config_applies_to_env`` is true so ``LLM_PROVIDER`` in ``.env``
    is not overridden by an older saved provider.

    When merged, the snapshot overrides provider, model, base URL, and API key
    for all LLM operations.
    """
    if stored is None:
        return base

    model = stored.model.strip()
    bu = (
        stored.base_url.strip().rstrip("/")
        if stored.base_url and stored.base_url.strip()
        else None
    )

    llm_provider = _UI_TO_LLM_PROVIDER[stored.provider]
    update: dict[str, Any] = {"llm_provider": llm_provider, "model_name": model}

    if stored.provider == "custom":
        update["openai_base_url"] = bu
    elif stored.provider == "openai":
        update["openai_base_url"] = None
    elif stored.provider == "anthropic":
        update["anthropic_base_url"] = None
    elif stored.provider == "ollama":
        update["ollama_model"] = None
        # Only override OPENAI_BASE_URL when the UI saved a base URL; otherwise
        # keep the value from .env (Ollama + OPENAI_BASE_URL compat mode).
        if bu is not None:
            update["openai_base_url"] = bu

    merged = base.model_copy(update=update)

    if stored.api_key and stored.api_key.strip():
        key = stored.api_key.strip()
        if stored.provider == "anthropic":
            merged = merged.model_copy(update={"anthropic_api_key": key})
        elif stored.provider in _OPENAI_KEY_PROVIDERS:
            merged = merged.model_copy(update={"openai_api_key": key})
        elif stored.provider == "google":
            merged = merged.model_copy(update={"google_api_key": key})

    return merged
