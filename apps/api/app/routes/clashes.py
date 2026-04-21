"""Clash upload and severity inference endpoints (SSE streaming)."""

from __future__ import annotations

import asyncio
import json
import tempfile
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from llama_index.core.agent.workflow import AgentOutput, ToolCall
from llama_index.core.base.llms.types import TextBlock
from llama_index.core.llms import ChatMessage
from pydantic import BaseModel, ConfigDict, Field
from sse_starlette.sse import EventSourceResponse

from app.clash_session import ClashSessionStore
from app.utils.agent_tool_log import print_tool_call as log_agent_tool_call
from app.utils.clash_analysis_parse import (
    normalize_analysis_result,
    parse_clash_analysis_json,
)
from app.utils.clash_inference import (
    DEFAULT_CLASH_SEVERITY_PREPROMPT,
    batch_clashes,
    infer_single_batch,
)
from app.utils.clash_parser import parse_clash_xml

router = APIRouter(prefix="/clashes", tags=["clashes"])

UPLOAD_BATCH_SIZE = 20

# SSE: allow slow per-chunk sends during long inference (matches clash LLM timeout).
CLASH_UPLOAD_SSE_SEND_TIMEOUT_SEC = 5 * 60 * 60

# Incoming clash-context analysis JSON (Navisworks + Speckle neighbors).
MAX_ANALYZE_CONTEXT_BODY_CHARS = 600_000


def _agent_message_text(msg: ChatMessage) -> str:
    if msg.content:
        return str(msg.content).strip()
    parts: list[str] = []
    for block in msg.blocks or []:
        if isinstance(block, TextBlock):
            parts.append(block.text)
    return "\n".join(parts).strip()


class ClashAnalyzeContextBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    clash: dict[str, Any]
    clash_objects_original: list[dict[str, Any]] = Field(default_factory=list)
    context_region: dict[str, Any] | None = None
    nearby_speckle_objects: list[dict[str, Any]] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


class ClashAnalyzeContextResponse(BaseModel):
    watch_out_for: list[str]
    recommendations: list[str]
    notes: str | None = None


def _get_clash_session(request: Request) -> ClashSessionStore:
    return request.app.state.clash_session


class ClashSessionSpeckleBody(BaseModel):
    speckle_urls: list[str] = Field(default_factory=list)


@router.get("/session")
async def get_clash_session(request: Request) -> dict[str, Any]:
    """Return cached clash workspace (report, Speckle URLs, inference) if any."""
    store = _get_clash_session(request)
    return await store.snapshot()


@router.put("/session")
async def put_clash_session(
    request: Request,
    body: ClashSessionSpeckleBody,
) -> dict[str, Any]:
    """Persist Speckle model URLs for the active workspace (survives page reload)."""
    store = _get_clash_session(request)
    await store.set_speckle_urls(body.speckle_urls)
    return await store.snapshot()


@router.delete("/session")
async def delete_clash_session(request: Request) -> dict[str, str]:
    """Clear cached clash workspace."""
    store = _get_clash_session(request)
    await store.clear()
    return {"status": "ok"}


@router.post(
    "/analyze-context",
    response_model=ClashAnalyzeContextResponse,
)
async def analyze_clash_context(
    request: Request,
    body: ClashAnalyzeContextBody,
) -> ClashAnalyzeContextResponse:
    """Run the configured ReAct agent (with web search) on clash + Speckle context."""
    wire = json.dumps(body.model_dump(), ensure_ascii=False, default=str)
    if len(wire) > MAX_ANALYZE_CONTEXT_BODY_CHARS:
        raise HTTPException(
            status_code=413,
            detail="Analysis payload too large. Reduce nearby objects or context size.",
        )

    payload_for_model = {
        "clash": body.clash,
        "clash_objects_original": body.clash_objects_original,
        "context_region": body.context_region,
        "nearby_speckle_objects": body.nearby_speckle_objects,
        "meta": body.meta,
    }
    user_msg = json.dumps(payload_for_model, ensure_ascii=False, indent=2)
    if len(user_msg) > MAX_ANALYZE_CONTEXT_BODY_CHARS:
        raise HTTPException(
            status_code=413,
            detail="Serialized analysis context exceeds server limit.",
        )

    store = request.app.state.chat_store
    llm = request.app.state.llm
    agent = request.app.state.clash_analysis_agent
    settings = request.app.state.effective_settings
    conv_id = str(uuid.uuid4())
    memory = store.get_or_create_memory(conv_id, llm=llm)

    try:
        async with store.lock_for(conv_id):
            handler = agent.run(
                user_msg=user_msg,
                memory=memory,
                max_iterations=settings.max_agent_iterations,
                early_stopping_method="generate",
            )
            async for ev in handler.stream_events():
                if isinstance(ev, ToolCall):
                    log_agent_tool_call(
                        "POST /clashes/analyze-context",
                        ev.tool_name,
                        ev.tool_id,
                        ev.tool_kwargs,
                    )
            result = await handler
    finally:
        store.delete(conv_id)

    raw_text = ""
    if isinstance(result, AgentOutput):
        raw_text = _agent_message_text(result.response)

    parsed = parse_clash_analysis_json(raw_text)
    watch_out_for, recommendations, notes = normalize_analysis_result(
        parsed,
        raw_text=raw_text,
    )

    return ClashAnalyzeContextResponse(
        watch_out_for=watch_out_for,
        recommendations=recommendations,
        notes=notes,
    )


def _collect_clashes(parsed_payload: dict[str, Any]) -> list[dict[str, Any]]:
    clashes: list[dict[str, Any]] = []
    for test in parsed_payload.get("tests", []):
        clashes.extend(test.get("clashes", []))
    return clashes


@router.post("/upload")
async def upload_clash_report(
    request: Request,
    file: UploadFile = File(...),
) -> EventSourceResponse:
    """Upload a Navisworks XML clash report; stream parsed clashes then
    progressive severity inference via SSE."""
    if not file.filename or not file.filename.lower().endswith(".xml"):
        raise HTTPException(
            status_code=400, detail="Expected an .xml clash report file."
        )

    xml_bytes = await file.read()
    if not xml_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    suffix = Path(file.filename).suffix or ".xml"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(xml_bytes)
        temp_path = Path(tmp.name)

    try:
        parsed_payload = parse_clash_xml(temp_path)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=400, detail=f"Failed to parse XML: {exc}"
        ) from exc
    finally:
        temp_path.unlink(missing_ok=True)

    clashes = _collect_clashes(parsed_payload)
    settings = request.app.state.effective_settings
    session_store = _get_clash_session(request)
    upload_name = file.filename or "report.xml"
    await session_store.begin_upload(upload_name, parsed_payload)

    async def _event_stream():
        yield {
            "event": "parsed",
            "data": json.dumps(parsed_payload),
        }

        if not clashes:
            await session_store.mark_inference_complete()
            yield {"event": "done", "data": "{}"}
            return

        batches = batch_clashes(
            clashes, max_batch_size=UPLOAD_BATCH_SIZE, max_workers=1
        )
        total = len(clashes)
        completed = 0

        for batch in batches:
            try:
                results = await asyncio.to_thread(
                    infer_single_batch,
                    batch,
                    preprompt=DEFAULT_CLASH_SEVERITY_PREPROMPT,
                    settings=settings,
                    minify=True,
                    temperature=0.0,
                )
                completed += len(batch)
                await session_store.merge_inference_batch(results)
                yield {
                    "event": "batch_result",
                    "data": json.dumps(
                        {
                            "results": results,
                            "completed": completed,
                            "total": total,
                        }
                    ),
                }
            except Exception as exc:  # noqa: BLE001
                yield {
                    "event": "error",
                    "data": json.dumps({"detail": str(exc)}),
                }
                return

        await session_store.mark_inference_complete()
        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(
        _event_stream(),
        send_timeout=CLASH_UPLOAD_SSE_SEND_TIMEOUT_SEC,
    )
