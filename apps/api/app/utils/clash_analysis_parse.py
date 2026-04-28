"""Extract structured clash analysis JSON from model final text."""

from __future__ import annotations

import ast
import json
import re
from typing import Any
from pydantic import BaseModel, Field, ValidationError


class EngineeringScratchpad(BaseModel):
    identified_constraint: str
    dimensional_considerations: str


class ClashSummary(BaseModel):
    elements_involved: list[str] = Field(default_factory=list)
    yielding_element: str
    anchor_constraint: str


class ClashRecommendation(BaseModel):
    priority: str
    technical_action: str
    design_impact: str
    effort_level: str
    validations: list[str] = Field(default_factory=list)


class ClashWatchOut(BaseModel):
    category: str
    specific_metric: str


def _strip_outer_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```\s*$", "", text)
    return text.strip()


def _first_fenced_json_object(raw: str) -> str | None:
    idx = 0
    while True:
        start = raw.find("```", idx)
        if start < 0:
            return None
        rest = raw[start + 3 :].lstrip()
        if rest.lower().startswith("json"):
            rest = rest[4:].lstrip()
        end_fence = rest.find("```")
        if end_fence < 0:
            return None
        candidate = rest[:end_fence].strip()
        if candidate.startswith("{"):
            return candidate
        idx = start + 3


def _json_object_candidates(raw: str) -> list[str]:
    """Return balanced JSON-object-looking slices, including traces before Answer."""
    candidates: list[str] = []
    start: int | None = None
    depth = 0
    in_string = False
    escaped = False

    for idx, ch in enumerate(raw):
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
            continue
        if ch == "{":
            if depth == 0:
                start = idx
            depth += 1
            continue
        if ch == "}" and depth:
            depth -= 1
            if depth == 0 and start is not None:
                candidates.append(raw[start : idx + 1].strip())
                start = None

    return candidates


def extract_json_object_text(raw: str) -> str | None:
    if not raw or not raw.strip():
        return None
    fenced = _first_fenced_json_object(raw)
    if fenced:
        return fenced
    stripped = _strip_outer_fence(raw)
    if stripped.startswith("{"):
        return stripped
    candidates = _json_object_candidates(raw)
    return candidates[-1] if candidates else None


def parse_clash_analysis_json(raw: str) -> dict[str, Any] | None:
    candidates = []
    blob = extract_json_object_text(raw)
    if blob:
        candidates.append(blob)
    candidates.extend(_json_object_candidates(raw))

    first_object: dict[str, Any] | None = None
    for candidate in candidates:
        data = _parse_mapping(candidate)
        if data is None:
            continue
        if not isinstance(data, dict):
            continue
        if first_object is None:
            first_object = data
        if "recommendations" in data or "watch_out_for" in data:
            return data
    return first_object


def _stringify_analysis_item(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    try:
        return json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return str(value).strip()


def _pythonish_json_to_python_literals(text: str) -> str:
    """Convert JSON literals to Python for `ast.literal_eval` fallback."""
    out = re.sub(r"\btrue\b", "True", text, flags=re.IGNORECASE)
    out = re.sub(r"\bfalse\b", "False", out, flags=re.IGNORECASE)
    out = re.sub(r"\bnull\b", "None", out, flags=re.IGNORECASE)
    return out


def _parse_loose_value(text: str) -> Any | None:
    t = _strip_outer_fence(text).strip()
    if not t:
        return None
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        pass
    try:
        return ast.literal_eval(t)
    except (SyntaxError, ValueError):
        pass
    try:
        return ast.literal_eval(_pythonish_json_to_python_literals(t))
    except (SyntaxError, ValueError):
        return None


def _parse_mapping(text: str) -> dict[str, Any] | None:
    parsed = _parse_loose_value(text)
    return parsed if isinstance(parsed, dict) else None


def _coerce_item_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        parsed = _parse_loose_value(value)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            return [parsed]
    return []


def _coerce_scratchpad(value: Any) -> EngineeringScratchpad | None:
    if not isinstance(value, dict):
        return None
    try:
        return EngineeringScratchpad.model_validate(value)
    except ValidationError:
        return None


def _coerce_summary(value: Any) -> ClashSummary | None:
    if not isinstance(value, dict):
        return None
    try:
        return ClashSummary.model_validate(value)
    except ValidationError:
        return None


def _coerce_recommendations(value: Any) -> list[ClashRecommendation]:
    out: list[ClashRecommendation] = []
    for item in _coerce_item_list(value):
        if isinstance(item, str):
            parsed = _parse_loose_value(item)
            if isinstance(parsed, dict):
                item = parsed
        if not isinstance(item, dict):
            continue
        try:
            out.append(ClashRecommendation.model_validate(item))
        except ValidationError:
            continue
    return out


def _coerce_watch_out(value: Any) -> list[ClashWatchOut]:
    out: list[ClashWatchOut] = []
    for item in _coerce_item_list(value):
        if isinstance(item, str):
            parsed = _parse_loose_value(item)
            if isinstance(parsed, dict):
                item = parsed
        if not isinstance(item, dict):
            continue
        try:
            out.append(ClashWatchOut.model_validate(item))
        except ValidationError:
            continue
    return out


def normalize_analysis_result(
    data: dict[str, Any] | None,
    *,
    raw_text: str,
) -> tuple[
    EngineeringScratchpad | None,
    ClashSummary | None,
    list[ClashWatchOut],
    list[ClashRecommendation],
    str | None,
]:
    """Return structured analysis sections + fallback notes."""
    if data is None:
        t = raw_text.strip()
        return None, None, [], [], (t if t else None)

    scratchpad = _coerce_scratchpad(data.get("engineering_scratchpad"))
    summary = _coerce_summary(data.get("clash_summary"))
    out_wf = _coerce_watch_out(
        data.get("watch_out_for") or data.get("watch_out") or data.get("watchouts"),
    )
    out_rec = _coerce_recommendations(
        data.get("recommendations") or data.get("recommendation"),
    )

    notes: str | None = None
    if scratchpad is None and summary is None and not out_wf and not out_rec:
        t = raw_text.strip()
        notes = t if t else None

    return scratchpad, summary, out_wf, out_rec, notes
