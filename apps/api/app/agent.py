"""LLM and ReAct agent construction from settings."""

from __future__ import annotations

from collections.abc import Callable, Sequence

import tiktoken
from llama_index.core.agent.workflow import ReActAgent
from llama_index.core.base.llms.types import LLMMetadata, MessageRole
from llama_index.core.bridge.pydantic import PrivateAttr
from llama_index.core.llms.llm import LLM
from llama_index.core.tools import FunctionTool
from llama_index.llms.openai import OpenAI
from llama_index.tools.duckduckgo import DuckDuckGoSearchToolSpec

from app.config import AgentSettings


class OpenAICompatibleLLM(OpenAI):
    """OpenAI wrapper that accepts arbitrary model ids from compatible servers."""

    _custom_context_window: int = PrivateAttr()

    def __init__(self, *, context_window: int, **kwargs: object) -> None:
        super().__init__(**kwargs)
        self._custom_context_window = context_window

    @property
    def _tokenizer(self):  # type: ignore[override]
        try:
            return super()._tokenizer
        except Exception:  # noqa: BLE001 - fallback for unknown compatible model ids
            return tiktoken.get_encoding("cl100k_base")

    @property
    def metadata(self) -> LLMMetadata:  # type: ignore[override]
        return LLMMetadata(
            context_window=self._custom_context_window,
            num_output=self.max_tokens or -1,
            is_chat_model=True,
            is_function_calling_model=True,
            model_name=self.model,
            system_role=MessageRole.SYSTEM,
        )


def _echo_tool(text: str) -> str:
    """Return the same text (demo tool for verifying tool use)."""
    return text


_TOOL_REGISTRY: dict[str, FunctionTool] = {
    "echo": FunctionTool.from_defaults(_echo_tool),
}


def _duckduckgo_tool_list() -> list[FunctionTool]:
    """DuckDuckGo instant-answer + full search tools for the ReAct agent."""
    return DuckDuckGoSearchToolSpec().to_tool_list()


# One id expands to multiple FunctionTools (see resolve_tools).
_TOOL_BUNDLES: dict[str, Callable[[], list[FunctionTool]]] = {
    "duckduckgo": _duckduckgo_tool_list,
}


def create_llm(
    settings: AgentSettings,
    *,
    http_request_timeout: float | None = None,
) -> LLM:
    """Instantiate the configured LlamaIndex LLM for the selected provider.

    ``http_request_timeout`` (seconds), when set, is passed through to the
    provider client for long-running requests (e.g. clash severity batches).
    """
    t = http_request_timeout

    if settings.llm_provider == "anthropic":
        from llama_index.llms.anthropic import Anthropic

        assert settings.anthropic_api_key is not None
        kwargs: dict[str, object] = {
            "model": settings.llm_model_id,
            "api_key": settings.anthropic_api_key,
            "base_url": settings.anthropic_base_url,
            "temperature": settings.temperature,
            "max_tokens": settings.max_tokens,
        }
        if t is not None:
            kwargs["timeout"] = t
        return Anthropic(**kwargs)

    if settings.llm_provider == "openai":
        assert settings.openai_api_key is not None
        if settings.openai_base_url is not None:
            kwargs2: dict[str, object] = {
                "model": settings.llm_model_id,
                "api_key": settings.openai_api_key,
                "api_base": settings.openai_base_url,
                "temperature": settings.temperature,
                "max_tokens": settings.max_tokens,
                "context_window": settings.openai_context_window,
            }
            if t is not None:
                kwargs2["timeout"] = t
            return OpenAICompatibleLLM(**kwargs2)

        kwargs3: dict[str, object] = {
            "model": settings.llm_model_id,
            "api_key": settings.openai_api_key,
            "api_base": settings.openai_base_url,
            "temperature": settings.temperature,
            "max_tokens": settings.max_tokens,
        }
        if t is not None:
            kwargs3["timeout"] = t
        return OpenAI(**kwargs3)

    if settings.llm_provider == "google":
        from llama_index.llms.google_genai import GoogleGenAI

        assert settings.google_api_key is not None
        return GoogleGenAI(
            model=settings.llm_model_id,
            api_key=settings.google_api_key,
            temperature=settings.temperature,
            max_tokens=settings.max_tokens,
        )

    if settings.llm_provider == "ollama":
        if settings.openai_base_url is not None:
            # OpenAI-compatible HTTP (e.g. Ollama /v1, LiteLLM, or other gateways).
            api_key = settings.openai_api_key or "ollama"
            kwargs4: dict[str, object] = {
                "model": settings.llm_model_id,
                "api_key": api_key,
                "api_base": settings.openai_base_url,
                "temperature": settings.temperature,
                "max_tokens": settings.max_tokens,
                "context_window": settings.openai_context_window,
            }
            if t is not None:
                kwargs4["timeout"] = t
            return OpenAICompatibleLLM(**kwargs4)

        from llama_index.llms.ollama import Ollama

        return Ollama(
            model=settings.llm_model_id,
            base_url=settings.ollama_base_url,
            temperature=settings.temperature,
            context_window=settings.ollama_context_window,
            request_timeout=float(t) if t is not None else 120.0,
        )

    raise ValueError(f"Unknown LLM provider: {settings.llm_provider}")


def with_duckduckgo_tool_name_aliases(tools: list[FunctionTool]) -> list[FunctionTool]:
    """
    LLMs often emit SCREAMING_SNAKE_CASE actions (e.g. DUCKDUCKGO_INSTANT_SEARCH)
    while specs register ``duckduckgo_instant_search``. Register uppercase aliases
    that call the same async implementation.
    """
    out = list(tools)
    registered = {t.metadata.name for t in out}
    for t in tools:
        name = t.metadata.name
        if "duckduckgo" not in name.lower():
            continue
        upper = name.upper()
        if upper != name and upper not in registered:
            registered.add(upper)
            out.append(
                FunctionTool.from_defaults(
                    async_fn=t.async_fn,
                    name=upper,
                    description=(
                        f"Alias for `{name}` (same tool). "
                        f"{t.metadata.description or ''}"
                    ),
                    fn_schema=t.metadata.fn_schema,
                    return_direct=t.metadata.return_direct,
                    partial_params=t.partial_params,
                )
            )
    return out


def resolve_tools(tool_ids: Sequence[str]) -> list[FunctionTool]:
    """Map tool bundle/registry ids to concrete FunctionTools."""
    tools: list[FunctionTool] = []
    unknown: list[str] = []
    for tool_id in tool_ids:
        if tool_id in _TOOL_BUNDLES:
            tools.extend(_TOOL_BUNDLES[tool_id]())
        elif (t := _TOOL_REGISTRY.get(tool_id)) is not None:
            tools.append(t)
        else:
            unknown.append(tool_id)
    if unknown:
        known_ids = sorted(_TOOL_REGISTRY.keys() | _TOOL_BUNDLES.keys())
        known = ", ".join(known_ids) or "(none registered)"
        raise ValueError(
            f"Unknown tool id(s): {unknown}. Known tools: {known}",
        )
    return tools


def create_react_agent(
    settings: AgentSettings,
    llm: LLM,
    *,
    tool_ids: Sequence[str],
    system_prompt: str | None = None,
) -> ReActAgent:
    """Build a ReActAgent (chat uses ``settings.system_prompt`` unless overridden)."""
    tools = with_duckduckgo_tool_name_aliases(resolve_tools(tool_ids))
    prompt = system_prompt if system_prompt is not None else settings.system_prompt
    return ReActAgent(
        name="CoordinationAgent",
        description="Assistant for BIM coordination and clash resolution support.",
        system_prompt=prompt,
        llm=llm,
        tools=tools or None,
        streaming=True,
        verbose=False,
    )
