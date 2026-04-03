"""Application settings loaded from environment (and optional `.env` file)."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SYSTEM_PROMPT = """You are a coordination assistant for AEC/BIM teams working with \
multi-trade models, clash reports, and design requirements. You help explain context, \
implications, and possible resolution paths clearly and professionally. When you are \
uncertain, say so and suggest what information would help."""


class AgentSettings(BaseSettings):
    """Configurable ReAct agent and LLM parameters."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    llm_provider: Literal["anthropic", "openai", "ollama"] = Field(
        default="anthropic",
        validation_alias="LLM_PROVIDER",
    )
    model_name: str = Field(
        default="claude-sonnet-4-20250514",
        validation_alias="MODEL_NAME",
    )

    anthropic_api_key: str | None = Field(default=None, validation_alias="ANTHROPIC_API_KEY")
    openai_api_key: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    ollama_base_url: str = Field(
        default="http://localhost:11434",
        validation_alias="OLLAMA_BASE_URL",
    )

    system_prompt: str = Field(
        default=DEFAULT_SYSTEM_PROMPT,
        validation_alias="SYSTEM_PROMPT",
    )
    temperature: float = Field(default=0.7, validation_alias="TEMPERATURE")
    max_tokens: int = Field(default=4096, ge=1, validation_alias="MAX_TOKENS")
    max_agent_iterations: int = Field(
        default=20,
        ge=1,
        le=200,
        validation_alias="MAX_AGENT_ITERATIONS",
    )

    # Comma-separated in .env (pydantic-settings would otherwise expect JSON for list fields).
    tools_enabled_csv: str = Field(default="", validation_alias="TOOLS_ENABLED")

    cors_origins_csv: str = Field(
        default="http://localhost:5173",
        validation_alias="CORS_ORIGINS",
    )

    @field_validator("system_prompt", mode="before")
    @classmethod
    def _default_system_if_empty(cls, v: object) -> object:
        if v is None:
            return DEFAULT_SYSTEM_PROMPT
        if isinstance(v, str) and not v.strip():
            return DEFAULT_SYSTEM_PROMPT
        return v

    @computed_field
    @property
    def tools_enabled(self) -> list[str]:
        if not self.tools_enabled_csv.strip():
            return []
        return [p.strip() for p in self.tools_enabled_csv.split(",") if p.strip()]

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        if not self.cors_origins_csv.strip():
            return ["http://localhost:5173"]
        return [p.strip() for p in self.cors_origins_csv.split(",") if p.strip()]


@lru_cache
def get_settings() -> AgentSettings:
    return AgentSettings()
