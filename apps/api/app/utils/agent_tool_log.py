"""Stdout logging for ReAct tool invocations (function name + arguments only; never tool outputs)."""

from __future__ import annotations

import json
from typing import Any


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return str(value)


def print_tool_call(
    source: str,
    tool_name: str,
    tool_id: str | None,
    tool_kwargs: Any,
) -> None:
    """Print one line to stdout so uvicorn/FastAPI terminal logs show agent tool usage."""
    try:
        args_json = json.dumps(
            _json_safe(tool_kwargs),
            ensure_ascii=False,
            default=str,
        )
    except (TypeError, ValueError):
        args_json = repr(tool_kwargs)
    tid = f" tool_id={tool_id!r}" if tool_id else ""
    print(
        f"[Balrog agent] {source} tool_call name={tool_name!r}{tid} args={args_json}",
        flush=True,
    )
