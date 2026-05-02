"""Utilities for batched/parallel LLM severity inference on clashes."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re
import threading
import time
from typing import Any

from llama_index.core.base.llms.types import MessageRole
from llama_index.core.llms import ChatMessage

from app.agent import create_llm
from app.config import AgentSettings
from app.utils.clash_parser import optimize_clash_for_agent

# Long-running SSE upload: allow each LLM batch call to run up to this many seconds.
CLASH_UPLOAD_LLM_HTTP_TIMEOUT_SEC = 5 * 60 * 60

DEFAULT_CLASH_SEVERITY_PREPROMPT = """
Role: You are a BIM Coordination Engine. Your mission is to analyze multi-object BIM clashes and provide a strategic resolution plan by identifying the "Lead" (the element that stays) and the "Movers" (the elements that must reroute).

1. Trade Priority Hierarchy (High to Low):

STRUCTURAL: Beams, Columns, Slabs, Metal Decks.

PLUMBING: Sanitary, Storm, Drainage.

MECHANICAL: Primary Duct Mains, AHUs.

PLUMBING: Domestic Water, Gas, Fire Protection.

ELECTRICAL: Cable Trays, Conduits, Lighting.

2. Triage Logic:

Determine Severity:
- CRITICAL: Any clash containing 2 or more items from Priority 1 or 2.
- MEDIUM: Any clash containing Priority 3 vs. Priority 1/2.
- LOW: Clashes containing only Priority 4 and 5 items.

3. Discipline Codes:
ARCHITECTURAL, STRUCTURAL, MECHANICAL, PLUMBING, FIRE_PROTECTION, ELECTRICAL.

Input Format (JSON):
{
  "id": "uuid",
  "type": "Hard | Soft",
  "items": [{ "n": "Name", "t": "Type" }, ...]
}

Output Format:
Return a JSON array of objects:
[
  {
    "clash": "uuid",
    "severity": "LOW | MEDIUM | CRITICAL",
    "disciplines": ["CODE1", "CODE2"],
  }
]
"""


def batch_clashes(
    clashes: list[dict[str, Any]],
    max_batch_size: int = 50,
    max_chars: int | None = None,
    max_workers: int = 1,
) -> list[list[dict[str, Any]]]:
    """
    Build clash batches for inference.

    - If ``max_chars`` is provided, uses greedy character-budget batching.
    - Otherwise, balances batches across workers while respecting ``max_batch_size``.
    """
    if not clashes:
        return []

    if max_chars:
        batches: list[list[dict[str, Any]]] = []
        current_batch: list[dict[str, Any]] = []
        current_chars = 0
        for clash in clashes:
            clash_json = json.dumps(clash)
            clash_len = len(clash_json)
            if current_batch and (current_chars + clash_len > max_chars):
                batches.append(current_batch)
                current_batch = []
                current_chars = 0
            current_batch.append(clash)
            current_chars += clash_len
        if current_batch:
            batches.append(current_batch)
        return batches

    total = len(clashes)
    max_workers = max(1, int(max_workers))
    max_batch_size = max(1, int(max_batch_size))

    min_batches_needed = (total + max_batch_size - 1) // max_batch_size
    preferred_batches = min(total, max_workers)
    batch_count = max(min_batches_needed, preferred_batches)

    base = total // batch_count
    remainder = total % batch_count

    batches = []
    start = 0
    for i in range(batch_count):
        size = base + (1 if i < remainder else 0)
        end = start + size
        batches.append(clashes[start:end])
        start = end
    return batches


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```\s*$", "", text)
    return text


def _clash_payload(clash: dict[str, Any], *, minify: bool) -> dict[str, Any]:
    if minify and "clashGuid" in clash:
        return optimize_clash_for_agent(clash)
    return clash


def infer_single_batch(
    clashes: list[dict[str, Any]],
    *,
    preprompt: str,
    settings: AgentSettings,
    minify: bool = True,
    temperature: float = 1.0,
) -> list[dict[str, Any]]:
    """Run severity inference on a single batch of clashes (synchronous)."""
    optimized = [_clash_payload(c, minify=minify) for c in clashes]
    llm_settings = (
        settings.model_copy(update={"temperature": temperature})
        if (settings.llm_provider != "anthropic" and "opus" not in settings.model_name)
        else settings.model_copy(update={"temperature": 1.0})
    )
    llm = create_llm(
        llm_settings,
        http_request_timeout=CLASH_UPLOAD_LLM_HTTP_TIMEOUT_SEC,
    )
    user_content = json.dumps(optimized, ensure_ascii=False)
    messages = [
        ChatMessage(role=MessageRole.SYSTEM, content=preprompt),
        ChatMessage(role=MessageRole.USER, content=user_content),
    ]
    resp = llm.chat(messages)
    text = _strip_code_fence(resp.message.content or "")
    parsed = json.loads(text)
    if not isinstance(parsed, list):
        raise ValueError(f"Expected JSON array from model, got {type(parsed)}")
    return parsed


def infer_clash_severities(
    clashes: list[dict[str, Any]],
    *,
    preprompt: str,
    settings: AgentSettings,
    max_batch_size: int = 40,
    max_chars: int | None = None,
    minify: bool = True,
    temperature: float = 0.0,
    max_workers: int = 3,
    debug: bool = False,
) -> list[dict[str, Any]]:
    """Infer clash severities using parallel LLM batch calls (same routing as chat)."""
    t_global = time.perf_counter()

    def _dbg(msg: str) -> None:
        if debug:
            dt = time.perf_counter() - t_global
            print(f"[infer +{dt:8.3f}s] {msg}")

    optimized = [_clash_payload(c, minify=minify) for c in clashes]
    batches = batch_clashes(
        optimized,
        max_batch_size=max_batch_size,
        max_chars=max_chars,
        max_workers=max_workers,
    )

    worker_count = (
        1 if len(batches) <= 1 or max_workers <= 1 else min(max_workers, len(batches))
    )
    _dbg(
        f"clashes={len(clashes)} batches={len(batches)} max_batch_size={max_batch_size} "
        f"worker_count={worker_count} provider={settings.llm_provider} "
        f"model={settings.llm_model_id}"
    )
    _dbg("batch sizes: " + ", ".join(str(len(chunk)) for chunk in batches))

    def _infer_batch(
        index: int, chunk: list[dict[str, Any]]
    ) -> tuple[int, list[dict[str, Any]]]:
        thread_name = threading.current_thread().name
        batch_start = time.perf_counter()
        _dbg(f"batch {index} START thread={thread_name} chunk_size={len(chunk)}")

        llm_init_start = time.perf_counter()
        llm_settings = settings.model_copy(update={"temperature": temperature})
        llm = create_llm(
            llm_settings,
            http_request_timeout=CLASH_UPLOAD_LLM_HTTP_TIMEOUT_SEC,
        )
        llm_init_elapsed = time.perf_counter() - llm_init_start

        user_content = json.dumps(chunk, ensure_ascii=False)
        messages = [
            ChatMessage(role=MessageRole.SYSTEM, content=preprompt),
            ChatMessage(role=MessageRole.USER, content=user_content),
        ]

        call_start = time.perf_counter()
        resp = llm.chat(messages)
        call_elapsed = time.perf_counter() - call_start

        text = _strip_code_fence(resp.message.content or "")
        parse_start = time.perf_counter()
        parsed = json.loads(text)
        parse_elapsed = time.perf_counter() - parse_start

        if not isinstance(parsed, list):
            raise ValueError(f"Expected JSON array from model, got {type(parsed)}")

        total_elapsed = time.perf_counter() - batch_start
        _dbg(
            f"batch {index} END thread={thread_name} llm_init={llm_init_elapsed:.2f}s "
            f"chat={call_elapsed:.2f}s parse={parse_elapsed:.3f}s total={total_elapsed:.2f}s"
        )
        return index, parsed

    if worker_count == 1:
        ordered_results = [
            _infer_batch(index, chunk) for index, chunk in enumerate(batches)
        ]
    else:
        ordered_results: list[tuple[int, list[dict[str, Any]]]] = []
        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            futures = [
                executor.submit(_infer_batch, index, chunk)
                for index, chunk in enumerate(batches)
            ]
            for future in as_completed(futures):
                ordered_results.append(future.result())

    out: list[dict[str, Any]] = []
    for _, parsed in sorted(ordered_results, key=lambda item: item[0]):
        out.extend(parsed)

    _dbg(
        f"done total_results={len(out)} total_time={time.perf_counter() - t_global:.2f}s"
    )
    return out
