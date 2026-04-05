"""Reconstruct agent UI metadata from ReAct scratchpad text stored in LlamaIndex memory."""

from __future__ import annotations

import ast
import json
import re
from typing import Any


def _parse_action_input(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    if not raw:
        return {}
    try:
        v = ast.literal_eval(raw)
        if isinstance(v, dict):
            return dict(v)
    except (ValueError, SyntaxError, TypeError):
        pass
    try:
        v = json.loads(raw)
        if isinstance(v, dict):
            return dict(v)
    except (json.JSONDecodeError, TypeError):
        pass
    return {"raw": raw}


def parse_react_scratchpad(full: str) -> tuple[str, list[dict[str, Any]]]:
    """
    Split consolidated ReAct assistant memory into user-visible answer + activity items.

    Matches the string format produced by LlamaIndex ``*ReasoningStep.get_content()``
    (Thought / Action / Action Input / Observation / Answer).
    """
    activity: list[dict[str, Any]] = []
    s = full.strip()
    if not s:
        return "", []

    answer_m = re.search(r"(?is)(?:^|\n)Answer:\s*(.+)\Z", s)
    work = s[: answer_m.start()].strip() if answer_m else s.strip()

    if "Thought:" not in work and "Action:" not in work:
        out_text = answer_m.group(1).strip() if answer_m else s.strip()
        return (out_text, [])

    remainder = work
    tool_idx = 0
    while remainder:
        remainder = remainder.lstrip()
        if not remainder:
            break

        thought_m = re.match(
            r"Thought:\s*(.+?)(?=\n\s*Action:\s|\n\s*Answer:\s|\Z)",
            remainder,
            flags=re.DOTALL | re.IGNORECASE,
        )
        if not thought_m:
            break
        thought_txt = thought_m.group(1).strip()
        if thought_txt:
            activity.append({"type": "thought", "text": thought_txt})

        tail = remainder[thought_m.end() :].lstrip()
        if re.match(r"Answer:\s*", tail, re.IGNORECASE):
            break

        act_m = re.match(
            r"Action:\s*([^\n]+?)\s*\n\s*Action Input:\s*",
            tail,
            re.IGNORECASE,
        )
        if not act_m:
            break

        tool_name = act_m.group(1).strip()
        tail_input = tail[act_m.end() :]

        term_m = re.search(r"\n\s*(?:Observation:|Thought:)", tail_input, re.IGNORECASE)
        if term_m:
            raw_input = tail_input[: term_m.start()].strip()
            rest = tail_input[term_m.start() :]
        else:
            raw_input = tail_input.strip()
            rest = ""

        args = _parse_action_input(raw_input)
        tool_idx += 1
        tool_id = f"history-{tool_idx}"
        activity.append(
            {
                "type": "tool_call",
                "toolName": tool_name,
                "toolId": tool_id,
                "args": args,
            },
        )

        if not rest.strip():
            break

        obs_m = re.match(
            r"\n\s*Observation:\s*(.+?)(?=\n\s*Thought:\s|\Z)",
            rest,
            flags=re.DOTALL | re.IGNORECASE,
        )
        if obs_m:
            obs_txt = obs_m.group(1).strip()
            activity.append(
                {
                    "type": "tool_result",
                    "toolName": tool_name,
                    "toolId": tool_id,
                    "content": obs_txt,
                    "isError": False,
                },
            )
            remainder = rest[obs_m.end() :]
        else:
            remainder = rest

    if activity:
        text_out = answer_m.group(1).strip() if answer_m else ""
        if not text_out:
            text_out = s.strip()
        return (text_out, activity)

    out_text = answer_m.group(1).strip() if answer_m else s.strip()
    return (out_text, [])
