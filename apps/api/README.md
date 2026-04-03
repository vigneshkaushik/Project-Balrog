# Balrog API

FastAPI backend with a LlamaIndex **ReAct** workflow agent, in-memory chat sessions, and **SSE** streaming on `POST /chat`.

## Setup

```bash
cd apps/api
cp .env.example .env   # add API keys / model names
uv sync
```

## Run

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- `GET /health` — liveness
- `POST /chat` — JSON body `{ "message": "...", "conversation_id": "<optional uuid>" }`, response is `text/event-stream` with events `metadata`, `token`, `done`, or `error`

Defaults use **Anthropic** (`LLM_PROVIDER=anthropic`); set `ANTHROPIC_API_KEY` in `.env`. For local models use `LLM_PROVIDER=ollama` and `MODEL_NAME` / `OLLAMA_BASE_URL`.

## Chat memory

Per-`conversation_id` history is kept in RAM until the process exits; omit `conversation_id` to start a new thread (response `metadata` includes the assigned id).
