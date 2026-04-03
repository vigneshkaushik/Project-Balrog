"""LLM and ReAct agent construction from settings."""

from __future__ import annotations

from llama_index.core.agent.workflow import ReActAgent
from llama_index.core.llms.llm import LLM
from llama_index.core.tools import FunctionTool

from app.config import AgentSettings


def _echo_tool(text: str) -> str:
    """Return the same text (demo tool for verifying tool use)."""
    return text


_TOOL_REGISTRY: dict[str, FunctionTool] = {
    "echo": FunctionTool.from_defaults(_echo_tool),
}


def create_llm(settings: AgentSettings) -> LLM:
    """Instantiate the configured LlamaIndex LLM for the selected provider."""
    if settings.llm_provider == "anthropic":
        if not settings.anthropic_api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic",
            )
        from llama_index.llms.anthropic import Anthropic

        return Anthropic(
            model=settings.model_name,
            api_key=settings.anthropic_api_key,
            temperature=settings.temperature,
            max_tokens=settings.max_tokens,
        )

    if settings.llm_provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
        from llama_index.llms.openai import OpenAI

        return OpenAI(
            model=settings.model_name,
            api_key=settings.openai_api_key,
            temperature=settings.temperature,
            max_tokens=settings.max_tokens,
        )

    if settings.llm_provider == "ollama":
        from llama_index.llms.ollama import Ollama

        return Ollama(
            model=settings.model_name,
            base_url=settings.ollama_base_url,
            temperature=settings.temperature,
            request_timeout=120.0,
        )

    raise ValueError(f"Unknown LLM provider: {settings.llm_provider}")


def resolve_tools(settings: AgentSettings) -> list[FunctionTool]:
    """Map `tools_enabled` ids to concrete tools (extensible registry)."""
    tools: list[FunctionTool] = []
    unknown: list[str] = []
    for tool_id in settings.tools_enabled:
        t = _TOOL_REGISTRY.get(tool_id)
        if t is None:
            unknown.append(tool_id)
        else:
            tools.append(t)
    if unknown:
        known = ", ".join(sorted(_TOOL_REGISTRY)) or "(none registered)"
        raise ValueError(
            f"Unknown tool id(s): {unknown}. Known tools: {known}",
        )
    return tools


def create_react_agent(settings: AgentSettings, llm: LLM) -> ReActAgent:
    """Build a single ReActAgent instance used for all chat sessions (memory is per session)."""
    tools = resolve_tools(settings)
    return ReActAgent(
        name="CoordinationAgent",
        description="Assistant for BIM coordination and clash resolution support.",
        system_prompt=settings.system_prompt,
        llm=llm,
        tools=tools or None,
        streaming=True,
        verbose=False,
    )
