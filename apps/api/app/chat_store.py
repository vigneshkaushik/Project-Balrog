"""In-memory per-conversation chat memory (lost on process restart)."""

from __future__ import annotations

import asyncio
from collections import defaultdict

from llama_index.core.llms.llm import LLM
from llama_index.core.memory import ChatMemoryBuffer


class ChatSessionStore:
    """Keeps a `ChatMemoryBuffer` per conversation id, with per-session async locks."""

    def __init__(self, llm: LLM, *, token_limit: int = 120_000) -> None:
        self._llm = llm
        self._token_limit = token_limit
        self._memories: dict[str, ChatMemoryBuffer] = {}
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    def _get_lock(self, conversation_id: str) -> asyncio.Lock:
        return self._locks[conversation_id]

    def get_or_create_memory(self, conversation_id: str) -> ChatMemoryBuffer:
        if conversation_id not in self._memories:
            self._memories[conversation_id] = ChatMemoryBuffer.from_defaults(
                llm=self._llm,
                token_limit=self._token_limit,
            )
        return self._memories[conversation_id]

    def delete(self, conversation_id: str) -> None:
        self._memories.pop(conversation_id, None)
        self._locks.pop(conversation_id, None)

    def lock_for(self, conversation_id: str) -> asyncio.Lock:
        """Serialize requests for the same conversation to avoid corrupting memory."""
        return self._get_lock(conversation_id)
