"""SSE chat endpoint backed by the LlamaIndex ReAct agent."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from sse_starlette import JSONServerSentEvent
from sse_starlette.sse import EventSourceResponse
from workflows.events import StopEvent

from llama_index.core.agent.workflow import AgentStream

router = APIRouter()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_id: str | None = Field(
        default=None,
        description="Client-supplied id to continue a thread; a new UUID is assigned if omitted.",
    )


async def _chat_sse_events(
    request: Request,
    payload: ChatRequest,
) -> AsyncIterator[JSONServerSentEvent]:
    conversation_id = payload.conversation_id or str(uuid.uuid4())
    try:
        yield JSONServerSentEvent(
            {"conversation_id": conversation_id},
            event="metadata",
        )

        store = request.app.state.chat_store
        agent = request.app.state.agent
        settings = request.app.state.settings

        memory = store.get_or_create_memory(conversation_id)
        async with store.lock_for(conversation_id):
            handler = agent.run(
                user_msg=payload.message,
                memory=memory,
                max_iterations=settings.max_agent_iterations,
            )
            async for ev in handler.stream_events():
                if isinstance(ev, AgentStream):
                    delta = ev.delta or ""
                    if delta:
                        yield JSONServerSentEvent(
                            {"content": delta},
                            event="token",
                        )
                elif isinstance(ev, StopEvent):
                    # Stream machinery terminates after StopEvent; nothing to send.
                    pass

            # Propagate workflow failures (e.g. LLM errors) to the client.
            await handler

        yield JSONServerSentEvent({}, event="done")
    except Exception as exc:  # noqa: BLE001 — surfaced to client as SSE error
        yield JSONServerSentEvent(
            {"detail": str(exc)},
            event="error",
        )


@router.post("/chat")
async def chat_stream(request: Request, payload: ChatRequest) -> EventSourceResponse:
    return EventSourceResponse(_chat_sse_events(request, payload))
