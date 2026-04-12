"""In-memory clash workspace session (latest upload + Speckle URLs + inference)."""

from __future__ import annotations

import asyncio
from typing import Any


class ClashSessionStore:
    """Caches the latest parsed Navisworks report, Speckle URLs, and severity inference.

    Single-tenant in-process cache (cleared on API restart). Used so the web app can
    rehydrate after a full page reload.
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._filename: str | None = None
        self._parsed: dict[str, Any] | None = None
        self._speckle_urls: list[str] = []
        self._inference_by_guid: dict[str, dict[str, Any]] = {}
        self._inference_complete: bool = False

    async def clear(self) -> None:
        async with self._lock:
            self._filename = None
            self._parsed = None
            self._speckle_urls = []
            self._inference_by_guid = {}
            self._inference_complete = False

    async def set_speckle_urls(self, urls: list[str]) -> None:
        async with self._lock:
            self._speckle_urls = list(urls)

    async def begin_upload(self, filename: str, parsed: dict[str, Any]) -> None:
        async with self._lock:
            self._filename = filename
            self._parsed = parsed
            self._inference_by_guid = {}
            self._inference_complete = False

    async def merge_inference_batch(self, results: list[dict[str, Any]]) -> None:
        async with self._lock:
            for row in results:
                guid = row.get("clash")
                if guid is None:
                    continue
                key = str(guid).strip().lower()
                if key:
                    self._inference_by_guid[key] = row

    async def mark_inference_complete(self) -> None:
        async with self._lock:
            self._inference_complete = True

    async def snapshot(self) -> dict[str, Any]:
        async with self._lock:
            has_session = self._parsed is not None or bool(self._speckle_urls)
            return {
                "has_session": has_session,
                "navisworks_file_name": self._filename,
                "speckle_urls": list(self._speckle_urls),
                "parsed": self._parsed,
                "inference_by_clash_guid": dict(self._inference_by_guid),
                "inference_complete": self._inference_complete,
            }
