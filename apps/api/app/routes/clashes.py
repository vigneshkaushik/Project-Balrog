"""Clash upload and severity inference endpoints (SSE streaming)."""

from __future__ import annotations

import asyncio
import json
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.clash_session import ClashSessionStore
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
