"""Clash upload and severity inference endpoints (SSE streaming)."""

from __future__ import annotations

import asyncio
import json
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from sse_starlette.sse import EventSourceResponse

from app.utils.clash_inference import (
    DEFAULT_CLASH_SEVERITY_PREPROMPT,
    batch_clashes,
    infer_single_batch,
)
from app.utils.clash_parser import parse_clash_xml

router = APIRouter(prefix="/clashes", tags=["clashes"])

UPLOAD_BATCH_SIZE = 20


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
    settings = request.app.state.settings

    async def _event_stream():
        yield {
            "event": "parsed",
            "data": json.dumps(parsed_payload),
        }

        if not clashes:
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
                    model=settings.model_name,
                    api_key=settings.openai_api_key,
                    api_base=settings.openai_base_url,
                    minify=True,
                    temperature=0.0,
                )
                completed += len(batch)
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

        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(_event_stream())
