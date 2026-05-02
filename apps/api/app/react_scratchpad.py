"""Reconstruct agent UI metadata from ReAct scratchpad text stored in LlamaIndex memory."""

from __future__ import annotations

import ast
import json
import re
from typing import Any

# Mirrors ``answerStreamSplit`` / ``assistantBubbleText`` in ``apps/web`` — use the LAST
# marker so earlier stray labels remain in preamble.
_ANSWER_MARKERS: tuple[str, ...] = (
    r"(?:^|\n)\s*Answer:\s*",
    r"(?:^|\n)\s*Final answer:\s*",
    r"(?:^|\n)\s*###\s*Answer\s*(?:\r?\n|$)",
)


def _split_scratchpad_and_answer(full: str) -> tuple[str, str]:
    """
    Split at the LAST answer marker into (preamble, answer_slice).
    If no marker, all content is preamble and answer is empty.
    """
    s = full.rstrip("\n\r\t ")
    if not s:
        return "", ""

    best_start = -1
    best_end = -1

    for pat_str in _ANSWER_MARKERS:
        r = re.compile(pat_str, re.MULTILINE | re.IGNORECASE | re.DOTALL)
        for m in r.finditer(s):
            if m.start() >= best_start:
                best_start = m.start()
                best_end = m.end()

    if best_start < 0:
        return s.strip(), ""

    preamble = s[:best_start].strip()
    answer = s[best_end:].strip()
    return preamble, answer


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

    Content before the first ``Thought:`` line (tables, narration, fenced blocks) was
    previously dropped during history hydration because parsers ``match`` anchored at the
    start of ``remainder``; capture it as a leading ``thought`` so the UI can show it again.
    """
    activity: list[dict[str, Any]] = []
    s = full.strip()
    if not s:
        return "", []

    work, answer_body = _split_scratchpad_and_answer(s)

    if not work:
        if answer_body:
            return answer_body, []
        return s, []

    # Leader text before the first Thought: cannot be consumed by regex.match on remainder.
    first_th_search = re.search(r"(?mi)^\s*Thought:", work)
    if first_th_search is None:
        orphan_leader = work.strip()
        remainder = ""
    elif first_th_search.start() > 0:
        orphan_leader = work[: first_th_search.start()].strip()
        remainder = work[first_th_search.start() :]
    else:
        orphan_leader = ""
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
        if re.match(r"(?:Answer|Final\s+answer)\s*:\s*", tail, re.IGNORECASE):
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

    if orphan_leader:
        activity.insert(0, {"type": "thought", "text": orphan_leader})

    if activity:
        text_out = answer_body
        if not text_out:
            text_out = s.strip()
        return (text_out, activity)

    return (answer_body if answer_body else s.strip(), [])
