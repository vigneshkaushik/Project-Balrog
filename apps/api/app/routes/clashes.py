"""Clash upload and severity inference endpoints."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from app.utils.clash_inference import (
    DEFAULT_CLASH_SEVERITY_PREPROMPT,
    infer_clash_severities,
)
from app.utils.clash_parser import parse_clash_xml

router = APIRouter(prefix="/clashes", tags=["clashes"])


def _collect_clashes(parsed_payload: dict[str, Any]) -> list[dict[str, Any]]:
    clashes: list[dict[str, Any]] = []
    for test in parsed_payload.get("tests", []):
        clashes.extend(test.get("clashes", []))
    return clashes


def _append_inference_by_guid(
    parsed_payload: dict[str, Any],
    inference_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    by_guid = {
        row.get("clash"): row
        for row in inference_rows
        if isinstance(row, dict) and row.get("clash")
    }
    for test in parsed_payload.get("tests", []):
        for clash in test.get("clashes", []):
            guid = clash.get("clashGuid")
            matched = by_guid.get(guid)
            if not matched:
                continue
            clash["severity"] = matched.get("severity")
            clash["disciplines"] = matched.get("disciplines", [])
            clash["lead"] = matched.get("lead", [])
    return parsed_payload


@router.post("/upload")
async def upload_clash_report(
    request: Request,
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Upload a Navisworks XML clash report, infer severity, return enriched JSON."""
    if not file.filename or not file.filename.lower().endswith(".xml"):
        raise HTTPException(
            status_code=400, detail="Expected an .xml clash report file."
        )
    print(f"Uploading clash report: {file.filename}")
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
    preprompt = DEFAULT_CLASH_SEVERITY_PREPROMPT
    max_batch_size = 40
    max_workers = 3
    print(
        f"Inferring clash severities for {len(clashes)} clashes with max_batch_size={max_batch_size} and max_workers={max_workers}"
    )
    try:
        inference_rows = infer_clash_severities(
            clashes,
            preprompt=preprompt,
            model=settings.model_name,
            api_key=settings.openai_api_key,
            api_base=settings.openai_base_url,
            max_batch_size=40,
            max_workers=3,
            minify=True,
            temperature=0.0,
            debug=False,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Failed to infer clash severities: {exc}",
        ) from exc

    enriched = _append_inference_by_guid(parsed_payload, inference_rows)
    return enriched
