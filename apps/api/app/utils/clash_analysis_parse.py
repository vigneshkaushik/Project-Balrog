"""Extract structured clash analysis JSON from model final text."""

from __future__ import annotations

import json
import re
from typing import Any


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


def _brace_json_slice(raw: str) -> str | None:
    t = raw.strip()
    i = t.find("{")
    if i < 0:
        return None
    j = t.rfind("}")
    if j <= i:
        return None
    return t[i : j + 1]


def extract_json_object_text(raw: str) -> str | None:
    if not raw or not raw.strip():
        return None
    fenced = _first_fenced_json_object(raw)
    if fenced:
        return fenced
    stripped = _strip_outer_fence(raw)
    if stripped.startswith("{"):
        return stripped
    return _brace_json_slice(raw)


def parse_clash_analysis_json(raw: str) -> dict[str, Any] | None:
    blob = extract_json_object_text(raw)
    if not blob:
        return None
    try:
        data = json.loads(blob)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def normalize_analysis_result(
    data: dict[str, Any] | None,
    *,
    raw_text: str,
) -> tuple[list[str], list[str], str | None]:
    """Return (watch_out_for, recommendations, notes)."""
    if data is None:
        t = raw_text.strip()
        return [], [], (t if t else None)

    wf = data.get("watch_out_for")
    rec = data.get("recommendations")
    out_wf: list[str] = []
    out_rec: list[str] = []

    if isinstance(wf, list):
        out_wf = [str(x).strip() for x in wf if str(x).strip()]
    if isinstance(rec, list):
        out_rec = [str(x).strip() for x in rec if str(x).strip()]

    notes: str | None = None
    if not out_wf and not out_rec:
        t = raw_text.strip()
        notes = t if t else None

    return out_wf, out_rec, notes
