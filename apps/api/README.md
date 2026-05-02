# Balrog API

FastAPI backend with a LlamaIndex **ReAct** workflow agent, in-memory chat sessions, and **SSE** streaming on `POST /chat`.

## Setup

```bash
cd apps/api
cp .env.example .env
uv sync
```

Edit **`.env`** to pick one provider path:

- **Anthropic cloud**: `LLM_PROVIDER=anthropic`, `MODEL_NAME=<claude model id>`, `ANTHROPIC_API_KEY=...`
- **OpenAI cloud**: `LLM_PROVIDER=openai`, `MODEL_NAME=<openai model id>`, `OPENAI_API_KEY=...`
- **OpenAI-compatible server**: `LLM_PROVIDER=openai`, `OPENAI_BASE_URL=http://host:port/v1`, `MODEL_NAME=<id from /v1/models>`, `OPENAI_API_KEY=<real key or non-empty placeholder if the server ignores auth>`
- **Ollama**: `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://host:11434`, `MODEL_NAME=<tag>` or `OLLAMA_MODEL=<tag>`

## Run

From **`apps/api`** (after **`uv sync`**):

```bash
./dev.sh
```

Equivalent:

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You can also run **`./apps/api/dev.sh`** from the repository root; the script changes into its own directory before starting Uvicorn.

## Endpoints

- `GET /health` — liveness
- `POST /chat` — JSON body `{ "message": "...", "conversation_id": "<optional uuid>" }`, response is `text/event-stream` with events `metadata`, `token`, `thought_delta`, `agent_thought`, `tool_call`, `tool_result`, `done`, or `error`
- `POST /clashes/upload` — `multipart/form-data` XML upload (`file` field), parses clashes, infers severity in parallel, appends `severity` + `disciplines` + `lead` into each clash object, returns enriched JSON
- `POST /clashes/analyze-context` — JSON body with clash + Speckle neighborhood context; runs the configured ReAct agent (same tools as chat, including web search) and returns `{ "analysis_metadata", "engineering_scratchpad", "clash_summary", "coordination_watch_list", "recommendations", "notes" }`

### Test chat with curl

Use `curl -N` so the SSE stream is not buffered:

```bash
curl -N -X POST http://localhost:8000/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Say hello in one short sentence."}'
```

To continue a thread, reuse the `conversation_id` returned in the first `metadata` event:

```bash
curl -N -X POST http://localhost:8000/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Now answer in Spanish.","conversation_id":"<uuid-from-metadata>"}'
```

### Test clash upload with curl

```bash
curl -X POST "http://localhost:8000/clashes/upload" \
  -F "file=@apps/api/experiments/Base_Model_Arch_vs_Structural_Clashes.xml" \
  -H "Accept: application/json"
```

Save to disk:

```bash
curl -X POST "http://localhost:8000/clashes/upload" \
  -F "file=@apps/api/experiments/Base_Model_Arch_vs_Structural_Clashes.xml" \
  -H "Accept: application/json" \
  -o apps/api/experiments/clashes_with_severity.json
```

## Provider configuration

| Variable | Used when | Role |
| -------- | --------- | ---- |
| `LLM_PROVIDER` | Always | `anthropic`, `openai`, or `ollama`. |
| `MODEL_NAME` | Always | Anthropic/OpenAI API model id, or Ollama fallback model tag. |
| `ANTHROPIC_API_KEY` | `anthropic` | Required for Anthropic. |
| `OPENAI_API_KEY` | `openai` | Required for OpenAI and often for OpenAI-compatible clients; some self-hosted servers accept any non-empty placeholder. |
| `ANTHROPIC_BASE_URL` | `anthropic` | Optional custom Anthropic-compatible base URL. |
| `OPENAI_BASE_URL` | `openai` | Optional custom OpenAI-compatible base URL, such as `http://host:port/v1`. |
| `OPENAI_CONTEXT_WINDOW` | `openai` + `OPENAI_BASE_URL` | Context window used for arbitrary model ids on OpenAI-compatible servers. |
| `OLLAMA_BASE_URL` | `ollama` | Ollama API root only; normalized to remove trailing `/`. |
| `OLLAMA_MODEL` | `ollama` | Optional override that takes precedence over `MODEL_NAME`. |
| `OLLAMA_CONTEXT_WINDOW` | `ollama` | Explicit `num_ctx`; avoids `POST /api/show` probes on partial Ollama-compatible servers. |
| `MAX_TOKENS` | Anthropic/OpenAI | Max output tokens for cloud-style clients. |

**ReAct tools** are not configured via **`.env`**. Edit **`ENABLED_AGENT_TOOL_IDS`** in **`app/routes/chat.py`** (e.g. **`duckduckgo`** for web search, **`echo`** for a demo). DuckDuckGo requires outbound network.

Provider validation is **provider-aware**:

- Anthropic/OpenAI require the matching API key.
- OpenAI-compatible servers are supported via `OPENAI_BASE_URL`, including arbitrary model ids like `qwen/qwen3-vl-4b`.
- Ollama requires a non-empty model tag and uses `OLLAMA_CONTEXT_WINDOW` instead of probing `/api/show`.

## Chat memory

Per-`conversation_id` history is kept in RAM until the process exits; omit `conversation_id` to start a new thread (the response `metadata` event includes the assigned id).
