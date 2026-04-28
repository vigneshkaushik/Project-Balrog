"""Helpers for normalizing provider SDK exceptions into user-facing text."""

from __future__ import annotations

import ast
import re
from typing import Any


def _coerce_mapping(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        text = value.strip()
        if text.startswith("{") and text.endswith("}"):
            try:
                parsed = ast.literal_eval(text)
            except (ValueError, SyntaxError):
                return None
            if isinstance(parsed, dict):
                return parsed
    return None


def _extract_error_parts(exc: Exception) -> tuple[str | None, str | None, str | None]:
    text = str(exc).strip()
    payload = _coerce_mapping(text)

    error_type: str | None = None
    request_id: str | None = None
    message: str | None = None

    if payload:
        request_id_raw = payload.get("request_id")
        if isinstance(request_id_raw, str) and request_id_raw.strip():
            request_id = request_id_raw.strip()
        nested = payload.get("error")
        if isinstance(nested, dict):
            nested_type = nested.get("type")
            if isinstance(nested_type, str) and nested_type.strip():
                error_type = nested_type.strip()
            nested_message = nested.get("message")
            if isinstance(nested_message, str) and nested_message.strip():
                message = nested_message.strip()

    if not request_id:
        m = re.search(r"(req_[A-Za-z0-9]+)", text)
        if m:
            request_id = m.group(1)
    if not error_type:
        m = re.search(r"(invalid_request_error|rate_limit_error|authentication_error)", text)
        if m:
            error_type = m.group(1)
    if not message and text:
        message = text

    return message, error_type, request_id


def format_provider_error(exc: Exception) -> str:
    """Return a plain-text provider error users can copy/paste."""
    message, error_type, request_id = _extract_error_parts(exc)
    msg = (message or "Provider request failed.").strip()
    lower = msg.lower()

    if "credit balance is too low" in lower:
        msg = (
            "Anthropic API error: Your credit balance is too low to process this request. "
            "Please add credits or upgrade your Anthropic plan, then retry."
        )

    suffix_parts: list[str] = []
    if error_type:
        suffix_parts.append(f"type={error_type}")
    if request_id:
        suffix_parts.append(f"request_id={request_id}")
    if suffix_parts:
        return f"{msg} ({', '.join(suffix_parts)})"
    return msg
