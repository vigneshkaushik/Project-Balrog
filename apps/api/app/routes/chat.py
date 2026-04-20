"""SSE chat endpoint backed by the LlamaIndex ReAct agent."""

from __future__ import annotations

import json
import re
import uuid
from collections.abc import AsyncIterator
from typing import Annotated, Any, Literal, Union

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field
from sse_starlette import JSONServerSentEvent
from sse_starlette.sse import EventSourceResponse
from workflows.events import StopEvent

from llama_index.core.agent.workflow import AgentOutput, AgentStream, ToolCall, ToolCallResult
from llama_index.core.base.llms.types import MessageRole, TextBlock, ThinkingBlock
from llama_index.core.llms import ChatMessage
from llama_index.core.tools.types import ToolOutput

from app.config import AgentSettings
from app.react_scratchpad import parse_react_scratchpad

router = APIRouter()

ENABLED_AGENT_TOOL_IDS: list[str] = ["duckduckgo"]


class ClashContextAttachmentBody(BaseModel):
    """Computed context for a clash attachment (same shape as `/clashes/analyze-context`)."""

    context_region: dict[str, Any] | None = None
    nearby_speckle_objects: list[dict[str, Any]] = Field(default_factory=list)
    clash_objects_original: list[dict[str, Any]] = Field(default_factory=list)
    unmatched_clash_keys: list[str] | None = None
    speckle_url_count: int | None = None
    capped: bool | None = None


class ClashAttachment(BaseModel):
    kind: Literal["clash"] = "clash"
    label: str
    clash: dict[str, Any]
    clash_context: ClashContextAttachmentBody = Field(
        default_factory=ClashContextAttachmentBody,
    )


class SelectedObjectAttachment(BaseModel):
    kind: Literal["selected_object"] = "selected_object"
    label: str
    speckle_id: str | None = None
    object_data: dict[str, Any] = Field(default_factory=dict)
    user_metadata: str | None = None


class RecommendationAttachment(BaseModel):
    kind: Literal["recommendation"] = "recommendation"
    label: str
    text: str
    clash_id: str
    clash_label: str


ChatAttachment = Annotated[
    Union[ClashAttachment, SelectedObjectAttachment, RecommendationAttachment],
    Field(discriminator="kind"),
]


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_id: str | None = Field(
        default=None,
        description="Client-supplied id to continue a thread; a new UUID is assigned if omitted.",
    )
    attachments: list[ChatAttachment] | None = Field(
        default=None,
        description=(
            "Structured context the user attached to this turn "
            "(clash + context, selected Speckle object, recommendation). "
            "Rendered into a `<attached_context>` preamble prepended to the user message."
        ),
    )


class ChatHistoryMessage(BaseModel):
    role: str
    text: str
    activity: list[dict[str, Any]] | None = Field(
        default=None,
        description="Reconstructed ReAct trace (thought / tool_call / tool_result) when parsable.",
    )
    thinking_buffer: str | None = Field(
        default=None,
        description="Reasoning/thinking blocks if the provider stored them on the message.",
    )


class ChatHistoryResponse(BaseModel):
    messages: list[ChatHistoryMessage]


def _agent_message_text(msg: ChatMessage) -> str:
    if msg.content:
        return str(msg.content).strip()
    parts: list[str] = []
    for block in msg.blocks or []:
        if isinstance(block, TextBlock):
            parts.append(block.text)
    return "\n".join(parts).strip()


def _text_from_text_blocks(msg: ChatMessage) -> str:
    parts: list[str] = []
    for block in msg.blocks or []:
        if isinstance(block, TextBlock):
            parts.append(block.text)
    return "\n".join(parts).strip()


def _thinking_from_blocks(msg: ChatMessage) -> str | None:
    parts: list[str] = []
    for block in msg.blocks or []:
        if isinstance(block, ThinkingBlock) and block.content:
            parts.append(block.content)
    joined = "\n".join(parts).strip()
    return joined or None


def _message_role_str(msg: ChatMessage) -> str:
    r = msg.role
    return r.value if isinstance(r, MessageRole) else str(r)


def _extract_react_thought(content: str) -> str | None:
    """Parse a ReAct-style ``Thought:`` block (if present) from LLM output."""
    if not content or "Thought:" not in content:
        return None
    match = re.search(
        r"Thought:\s*(.+?)(?=\n\s*Action:\s|\n\s*Answer:\s|\Z)",
        content,
        re.DOTALL | re.IGNORECASE,
    )
    if not match:
        return None
    text = match.group(1).strip()
    return text or None


_USER_MESSAGE_TAG_RE = re.compile(
    r"<user_message>\s*(.*?)\s*</user_message>",
    re.DOTALL,
)


def _user_display_text(raw: str) -> str:
    """Strip the `<attached_context>` preamble + `<user_message>` tags that the
    chat endpoint embeds when attachments are sent, so history restores show only
    the user's original text. Falls back to `raw` for pre-feature messages.
    """
    if not raw:
        return raw
    match = _USER_MESSAGE_TAG_RE.search(raw)
    if match:
        inner = match.group(1).strip()
        if inner:
            return inner
    return raw


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return str(value)


_MAX_TOOL_OUTPUT_CHARS = 16_000
_MAX_ATTACHMENT_JSON_CHARS = 12_000


def _dump_attachment_json(data: Any) -> str:
    """Safe compact JSON dump for embedding attachment payloads in the preamble."""
    try:
        text = json.dumps(data, indent=2, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        text = str(data)
    if len(text) > _MAX_ATTACHMENT_JSON_CHARS:
        return text[:_MAX_ATTACHMENT_JSON_CHARS] + "\n… (truncated)"
    return text


def _clash_attachment_summary_line(attachment: ClashAttachment) -> str:
    clash = attachment.clash or {}
    parts: list[str] = []
    severity = clash.get("severity")
    if severity:
        parts.append(f"severity={severity}")
    disciplines = clash.get("disciplines")
    if isinstance(disciplines, list) and disciplines:
        parts.append(f"disciplines={','.join(str(d) for d in disciplines)}")
    objects = clash.get("objects")
    if isinstance(objects, list):
        parts.append(f"objects_count={len(objects)}")
    region = attachment.clash_context.context_region
    if region:
        parts.append(f"context_region.source={region.get('source', 'unknown')}")
    nearby_count = len(attachment.clash_context.nearby_speckle_objects or [])
    parts.append(f"nearby={nearby_count}")
    return ", ".join(parts) if parts else "(no summary)"


def _format_attachment(attachment: Any) -> str:
    """Render one attachment as a labeled block + fenced JSON body."""
    if isinstance(attachment, ClashAttachment):
        summary = _clash_attachment_summary_line(attachment)
        body = _dump_attachment_json(
            {
                "clash": attachment.clash,
                "clash_context": attachment.clash_context.model_dump(
                    exclude_none=True,
                ),
            },
        )
        return (
            f"[Clash] {attachment.label}\n"
            f"  {summary}\n"
            f"```json\n{body}\n```"
        )
    if isinstance(attachment, SelectedObjectAttachment):
        id_suffix = (
            f" (id={attachment.speckle_id})"
            if attachment.speckle_id
            else ""
        )
        meta_line = (
            f'  user_metadata="{attachment.user_metadata}"\n'
            if attachment.user_metadata
            else ""
        )
        body = _dump_attachment_json(attachment.object_data)
        return (
            f"[Selected object] {attachment.label}{id_suffix}\n"
            f"{meta_line}"
            f"```json\n{body}\n```"
        )
    if isinstance(attachment, RecommendationAttachment):
        return (
            f"[Recommendation for '{attachment.clash_label}' "
            f"(clash_id={attachment.clash_id})]\n"
            f"  {attachment.text}"
        )
    return ""


def build_attached_context_preamble(
    attachments: list[Any] | None,
) -> str:
    """Render the `<attached_context>` block prepended to `user_msg`.

    Returns an empty string when there are no attachments (no framing at all),
    so turns without attachments remain byte-identical to the pre-feature behaviour.
    """
    if not attachments:
        return ""
    blocks: list[str] = []
    for att in attachments:
        rendered = _format_attachment(att)
        if rendered:
            blocks.append(rendered)
    if not blocks:
        return ""
    return "<attached_context>\n" + "\n\n".join(blocks) + "\n</attached_context>\n\n"


def compose_user_message(
    message: str,
    attachments: list[Any] | None,
) -> str:
    """Combine the user-facing text with any attached-context preamble."""
    preamble = build_attached_context_preamble(attachments)
    if not preamble:
        return message
    return (
        f"{preamble}"
        f"<user_message>\n{message}\n</user_message>"
    )


def _format_tool_result_text(tool_output: ToolOutput) -> str:
    """
    Prefer JSON-serializing raw tool output (e.g. DuckDuckGo list[dict]) so clients
    can parse it. ``ToolOutput.content`` often uses Python repr (single quotes),
    which is not valid JSON.
    """
    raw = tool_output.raw_output
    if raw is not None:
        try:
            return json.dumps(raw, indent=2, ensure_ascii=False, default=str)
        except (TypeError, ValueError):
            pass
    text = tool_output.content
    if text and text.strip():
        return text
    if raw is not None:
        return str(raw)
    return "(empty tool output)"


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
        settings: AgentSettings = request.app.state.effective_settings
        llm = request.app.state.llm
        agent = request.app.state.agent

        memory = store.get_or_create_memory(conversation_id, llm=llm)
        composed_user_msg = compose_user_message(payload.message, payload.attachments)
        async with store.lock_for(conversation_id):
            handler = agent.run(
                user_msg=composed_user_msg,
                memory=memory,
                max_iterations=settings.max_agent_iterations,
            )
            async for ev in handler.stream_events():
                if isinstance(ev, AgentStream):
                    thinking = ev.thinking_delta or ""
                    if thinking:
                        yield JSONServerSentEvent(
                            {"delta": thinking},
                            event="thought_delta",
                        )
                    delta = ev.delta or ""
                    if delta:
                        yield JSONServerSentEvent(
                            {"content": delta},
                            event="token",
                        )
                elif isinstance(ev, AgentOutput):
                    thought = _extract_react_thought(_agent_message_text(ev.response))
                    if thought:
                        yield JSONServerSentEvent(
                            {"text": thought},
                            event="agent_thought",
                        )
                elif isinstance(ev, ToolCall):
                    yield JSONServerSentEvent(
                        {
                            "tool_name": ev.tool_name,
                            "tool_id": ev.tool_id,
                            "tool_kwargs": _json_safe(ev.tool_kwargs),
                        },
                        event="tool_call",
                    )
                elif isinstance(ev, ToolCallResult):
                    content = _format_tool_result_text(ev.tool_output)
                    if len(content) > _MAX_TOOL_OUTPUT_CHARS:
                        content = content[:_MAX_TOOL_OUTPUT_CHARS] + "\n… (truncated)"
                    yield JSONServerSentEvent(
                        {
                            "tool_name": ev.tool_name,
                            "tool_id": ev.tool_id,
                            "content": content,
                            "is_error": ev.tool_output.is_error,
                        },
                        event="tool_result",
                    )
                elif isinstance(ev, StopEvent):
                    pass

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


@router.get("/chat/messages", response_model=ChatHistoryResponse)
async def get_chat_messages(
    request: Request,
    conversation_id: str = Query(..., min_length=1, description="Conversation to load"),
) -> ChatHistoryResponse:
    """Return LlamaIndex chat memory for one conversation (in-process only)."""
    store = request.app.state.chat_store
    raw = await store.snapshot_messages(conversation_id)
    out: list[ChatHistoryMessage] = []
    for msg in raw:
        rs = _message_role_str(msg)
        if rs in ("system", "developer"):
            continue

        if rs == "user":
            text = _agent_message_text(msg)
            if not text:
                continue
            out.append(
                ChatHistoryMessage(role="user", text=_user_display_text(text)),
            )
            continue

        if rs in ("assistant", "model", "chatbot"):
            body = _text_from_text_blocks(msg)
            if not body:
                body = _agent_message_text(msg)
            if not body:
                continue
            thinking = _thinking_from_blocks(msg)
            display_text, activity = parse_react_scratchpad(body)
            out.append(
                ChatHistoryMessage(
                    role="assistant",
                    text=display_text,
                    activity=activity if activity else None,
                    thinking_buffer=thinking,
                ),
            )
            continue

    return ChatHistoryResponse(messages=out)
