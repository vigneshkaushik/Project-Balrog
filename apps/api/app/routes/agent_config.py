"""Read/update persisted agent configuration (API keys kept server-side only)."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, model_validator

from app.agent import create_llm
from app.config import AgentSettings
from app.routes.chat import AgentConfigPayload, apply_agent_config_overrides
from app.user_agent_config import (
    MASKED_API_KEY_DISPLAY,
    PersistedUserAgentConfig,
    env_key_configured_for_ui_provider,
    merge_persisted_api_key,
    save_user_agent_config,
)

router = APIRouter(tags=["agent-config"])


class AgentConfigPublicResponse(BaseModel):
    provider: str
    model: str
    base_url: str | None
    api_key_set: bool
    api_key_masked: str | None


class AgentConfigPutBody(BaseModel):
    provider: Literal["anthropic", "openai", "google", "custom"]
    model: str = Field(..., min_length=1)
    base_url: str | None = None
    api_key: str | None = Field(
        default=None,
        description="New secret; omit or null to keep an existing stored key.",
    )

    @model_validator(mode="after")
    def _custom(self) -> AgentConfigPutBody:
        if self.provider == "custom":
            if not (self.base_url and self.base_url.strip()):
                raise ValueError("base_url is required when provider is custom")
        return self


def _settings_to_public_when_no_store(base: AgentSettings) -> AgentConfigPublicResponse:
    if base.llm_provider in ("anthropic", "openai", "google"):
        prov = base.llm_provider
        model = base.llm_model_id
    elif base.llm_provider == "ollama":
        prov = "anthropic"
        model = "claude-sonnet-4-20250514"
    else:
        prov = "anthropic"
        model = base.model_name
    has_key = env_key_configured_for_ui_provider(
        anthropic_key=base.anthropic_api_key,
        openai_key=base.openai_api_key,
        google_key=base.google_api_key,
        provider=prov,
    )
    return AgentConfigPublicResponse(
        provider=prov,
        model=model,
        base_url=None,
        api_key_set=has_key,
        api_key_masked=MASKED_API_KEY_DISPLAY if has_key else None,
    )


def _stored_to_public(
    cfg: PersistedUserAgentConfig,
    base: AgentSettings,
) -> AgentConfigPublicResponse:
    bu: str | None = None
    if cfg.provider == "custom" and cfg.base_url and cfg.base_url.strip():
        bu = cfg.base_url.strip().rstrip("/")
    stored_key = cfg.api_key.strip() if cfg.api_key else ""
    env_key = env_key_configured_for_ui_provider(
        anthropic_key=base.anthropic_api_key,
        openai_key=base.openai_api_key,
        google_key=base.google_api_key,
        provider=cfg.provider,
    )
    has_key = bool(stored_key) or env_key
    return AgentConfigPublicResponse(
        provider=cfg.provider,
        model=cfg.model,
        base_url=bu,
        api_key_set=has_key,
        api_key_masked=MASKED_API_KEY_DISPLAY if has_key else None,
    )


@router.get("/agent-config", response_model=AgentConfigPublicResponse)
def get_agent_config(request: Request) -> AgentConfigPublicResponse:
    base: AgentSettings = request.app.state.settings
    cfg: PersistedUserAgentConfig | None = request.app.state.user_agent_config
    if cfg is None:
        return _settings_to_public_when_no_store(base)
    return _stored_to_public(cfg, base)


@router.put("/agent-config", response_model=AgentConfigPublicResponse)
def put_agent_config(
    request: Request,
    body: AgentConfigPutBody,
) -> AgentConfigPublicResponse:
    base: AgentSettings = request.app.state.settings
    path: Path = request.app.state.user_agent_config_path
    existing: PersistedUserAgentConfig | None = request.app.state.user_agent_config

    api_key_in = body.api_key.strip() if body.api_key else ""
    if api_key_in:
        resolved_key: str | None = api_key_in
    elif existing and existing.api_key and existing.api_key.strip():
        resolved_key = existing.api_key.strip()
    else:
        resolved_key = None

    bu: str | None = None
    if body.provider == "custom":
        bu = body.base_url.strip().rstrip("/") if body.base_url else ""

    try:
        persisted = PersistedUserAgentConfig(
            provider=body.provider,
            model=body.model.strip(),
            base_url=bu,
            api_key=resolved_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    payload = AgentConfigPayload(
        provider=persisted.provider,
        model=persisted.model,
        base_url=persisted.base_url,
    )
    try:
        agent_settings = apply_agent_config_overrides(base, payload)
        agent_settings = merge_persisted_api_key(agent_settings, persisted)
        create_llm(agent_settings)
    except Exception as exc:  # noqa: BLE001 — return safe message to client
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    save_user_agent_config(path, persisted)
    request.app.state.user_agent_config = persisted
    return _stored_to_public(persisted, base)
