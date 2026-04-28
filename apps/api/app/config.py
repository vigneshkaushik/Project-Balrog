"""Application settings loaded from environment (and optional `.env` file)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SYSTEM_PROMPT = """You are an AI assistant specialized in inter-trade clash \
resolution for AEC/BIM coordination. Your job is not merely to list or detect clashes, but \
to help teams move clashes toward resolution by weaving together multi-trade model context, \
clash data, and project requirements in one coherent thread of reasoning.

Ground your answers in this product intent:

- Prioritize resolution over detection: suggest practical next steps, trade-offs, and who may \
need to act.
- Treat multi-trade context as essential—architecture, structure, MEP, and other disciplines \
often interact; call out cross-trade dependencies and avoid siloed advice.
- Reduce trade-isolated thinking: when relevant, name which trades or models are implicated \
and how their constraints interact.
- Explain clash context, implications, and possible resolution paths clearly and \
professionally; when uncertain, say so and say what evidence would change your view.
- When helpful, support follow-up coordination (e.g. drafting RFIs, emails, or meeting \
notes)—concise, factual, and ready for the user to edit.

If the user's request is vague or underspecified, do not repeat the same reasoning, tools, \
or searches in a loop. Ask one or two concrete clarifying questions (or state what you need \
to proceed), then stop and wait for their reply. Prefer a short, direct clarification over \
extra tool rounds when you lack enough detail to help meaningfully."""

# Resolve `.env` next to `apps/api/` so settings load when the process cwd is the monorepo root.
_API_ROOT = Path(__file__).resolve().parent.parent


class AgentSettings(BaseSettings):
    """Configurable ReAct agent and LLM parameters."""

    model_config = SettingsConfigDict(
        env_file=(str(_API_ROOT / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # Default to Ollama so the API boots without cloud keys; use `.env` / `.env.example` for Anthropic, etc.
    llm_provider: Literal["anthropic", "openai", "ollama", "google"] = Field(
        default="ollama",
        validation_alias="LLM_PROVIDER",
    )
    model_name: str = Field(
        default="llama3.2",
        validation_alias="MODEL_NAME",
    )

    anthropic_api_key: str | None = Field(default=None, validation_alias="ANTHROPIC_API_KEY")
    openai_api_key: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    google_api_key: str | None = Field(default=None, validation_alias="GOOGLE_API_KEY")
    anthropic_base_url: str | None = Field(
        default=None,
        validation_alias="ANTHROPIC_BASE_URL",
        description="Optional custom Anthropic-compatible API base URL.",
    )
    openai_base_url: str | None = Field(
        default=None,
        validation_alias="OPENAI_BASE_URL",
        description=(
            "OpenAI-compatible API base URL (e.g. http://host:port/v1). "
            "When LLM_PROVIDER=openai, uses this instead of OpenAI cloud. "
            "When LLM_PROVIDER=ollama, if set, uses this OpenAI-compatible endpoint instead of "
            "the native Ollama client (OLLAMA_BASE_URL is then unused for the LLM)."
        ),
    )
    openai_context_window: int = Field(
        default=32_768,
        ge=256,
        le=1_000_000,
        validation_alias="OPENAI_CONTEXT_WINDOW",
        description="Context window for OpenAI-compatible custom endpoints with arbitrary model ids.",
    )

    ollama_base_url: str = Field(
        default="http://localhost:11434",
        validation_alias="OLLAMA_BASE_URL",
        description="Ollama API root (no trailing path). Example: https://ollama.example.com or http://host.docker.internal:11434",
    )
    ollama_model: str | None = Field(
        default=None,
        validation_alias="OLLAMA_MODEL",
        description="When LLM_PROVIDER=ollama, Ollama model tag (e.g. llama3.2). If unset, MODEL_NAME is used.",
    )
    ollama_context_window: int = Field(
        default=32_768,
        ge=256,
        le=1_000_000,
        validation_alias="OLLAMA_CONTEXT_WINDOW",
        description="Ollama context size (num_ctx). A fixed value skips POST /api/show, "
        "which some non-standard gateways omit.",
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
    verbose_logging: bool = Field(
        default=False,
        validation_alias="VERBOSE",
        description="Enable verbose startup and endpoint payload logs.",
    )

    cors_origins_csv: str = Field(
        default="http://localhost:5173",
        validation_alias="CORS_ORIGINS",
    )

    agent_user_config_path: str | None = Field(
        default=None,
        validation_alias="AGENT_USER_CONFIG_PATH",
        description="Optional path to persisted agent UI config JSON; default is apps/api/data/agent_user_config.json.",
    )

    @field_validator("model_name")
    @classmethod
    def _strip_model_name(cls, v: str) -> str:
        return v.strip()

    @field_validator("anthropic_api_key", "openai_api_key", "google_api_key")
    @classmethod
    def _strip_optional_api_keys(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        return s if s else None

    @field_validator("anthropic_base_url", "openai_base_url")
    @classmethod
    def _normalize_optional_base_urls(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        return s.rstrip("/") if s else None

    @field_validator("system_prompt", mode="before")
    @classmethod
    def _default_system_if_empty(cls, v: object) -> object:
        if v is None:
            return DEFAULT_SYSTEM_PROMPT
        if isinstance(v, str) and not v.strip():
            return DEFAULT_SYSTEM_PROMPT
        return v

    @field_validator("ollama_base_url")
    @classmethod
    def _normalize_ollama_base_url(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            return "http://localhost:11434"
        return s.rstrip("/")

    @field_validator("ollama_model")
    @classmethod
    def _strip_ollama_model(cls, v: str | None) -> str | None:
        if v is None:
            return None
        t = v.strip()
        return t if t else None

    @model_validator(mode="after")
    def _validate_llm_provider_config(self) -> AgentSettings:
        """Align model id shape and credentials with LLM_PROVIDER."""
        if self.llm_provider in ("anthropic", "openai", "google") and not self.model_name:
            raise ValueError(
                "MODEL_NAME must be non-empty when LLM_PROVIDER is anthropic, openai, or google.",
            )
        if self.llm_provider == "anthropic":
            if "/" in self.model_name and self.anthropic_base_url is None:
                raise ValueError(
                    f"MODEL_NAME '{self.model_name}' looks like an Ollama model tag (contains '/'). "
                    "Set LLM_PROVIDER=ollama and use OLLAMA_BASE_URL; put the tag in "
                    "OLLAMA_MODEL or MODEL_NAME. "
                    "For anthropic cloud, MODEL_NAME must be a provider API id "
                    "(e.g. claude-sonnet-4-20250514 or gpt-4o).",
                )
            if not self.anthropic_api_key:
                raise ValueError(
                    "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic",
                )
        elif self.llm_provider == "openai":
            if "/" in self.model_name and self.openai_base_url is None:
                raise ValueError(
                    f"MODEL_NAME '{self.model_name}' contains '/', which is not valid for default OpenAI cloud model ids. "
                    "If this comes from an OpenAI-compatible self-hosted server, set OPENAI_BASE_URL "
                    "(for example http://host:port/v1). Otherwise use a cloud model id like gpt-4o.",
                )
            if not self.openai_api_key:
                raise ValueError(
                    "OPENAI_API_KEY is required when LLM_PROVIDER=openai",
                )
        elif self.llm_provider == "google":
            if not self.google_api_key:
                raise ValueError(
                    "GOOGLE_API_KEY is required when LLM_PROVIDER=google",
                )
        elif self.llm_provider == "ollama":
            mid = self.ollama_resolved_model
            if not mid.strip():
                raise ValueError(
                    "When LLM_PROVIDER=ollama, set MODEL_NAME or OLLAMA_MODEL to a model tag.",
                )
        return self

    @property
    def ollama_resolved_model(self) -> str:
        """Ollama model tag: OLLAMA_MODEL if set, otherwise MODEL_NAME."""
        return self.ollama_model if self.ollama_model is not None else self.model_name

    @property
    def llm_model_id(self) -> str:
        """Model identifier passed to the active provider (cloud or Ollama)."""
        if self.llm_provider == "ollama":
            return self.ollama_resolved_model
        return self.model_name

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        if not self.cors_origins_csv.strip():
            return ["http://localhost:5173"]
        return [p.strip() for p in self.cors_origins_csv.split(",") if p.strip()]


@lru_cache
def get_settings() -> AgentSettings:
    return AgentSettings()
