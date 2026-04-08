# Backend repository guide (`apps/api`)

This document maps the **FastAPI** backend: entrypoint, configuration, AI agent stack, chat/session storage, HTTP surface area, and how pieces connect at runtime. Use it when extending coordination logic, adding tools, or wiring the web app to streamed chat.

---

## Location and stack

| Item | Detail |
| ---- | ------ |
| Root | `apps/api/` |
| Entry | `main.py` — `FastAPI` app, lifespan, CORS, router mount |
| Package | `app/` — settings, agent factory, chat store, HTTP routes |
| Runtime | Python 3.12+, **[uv](https://docs.astral.sh/uv/)** for deps (`uv sync`, `uv run`) |
| HTTP | FastAPI + Uvicorn |
| AI | [LlamaIndex](https://www.llamaindex.ai/) **ReAct** workflow agent, pluggable LLMs |
| Streaming | [sse-starlette](https://github.com/sysid/sse-starlette) — Server-Sent Events for token streams |

---

## Bootstrap and request lifecycle

| File / symbol | Role |
| ------------- | ---- |
| `main.py` → `lifespan` | On startup: reads **`get_settings()`**, resolves **`user_agent_config_path`** (default **`apps/api/data/agent_user_config.json`** or **`AGENT_USER_CONFIG_PATH`**), loads **`load_user_agent_config`**, builds **`create_llm`**, **`create_react_agent(..., tool_ids=ENABLED_AGENT_TOOL_IDS)`**, **`ChatSessionStore(llm)`**, attaches all to **`app.state`**. |
| `main.py` → `app` | **`FastAPI`** title/description, **`CORSMiddleware`** from **`settings.cors_origins`**, includes **`chat`**, **`agent_config`**, and **`clashes`** routers, exposes **`GET /health`**. |

**Runtime state (`request.app.state`)**

| Attribute | Type (conceptual) | Purpose |
| --------- | ----------------- | ------- |
| `settings` | `AgentSettings` | Model/provider, prompts, iteration caps, CORS, optional persisted config path |
| `user_agent_config_path` | `Path` | JSON file for UI-saved agent settings |
| `user_agent_config` | `PersistedUserAgentConfig \| None` | Loaded/saved provider, model, optional **`base_url`** (custom OpenAI-compatible), optional **`api_key`**; updated on **`PUT /agent-config`** |
| `llm` | LlamaIndex `LLM` | Default env-based client (memory token counting baseline) |
| `agent` | `ReActAgent` | Default env-based agent when no persisted UI config exists |
| `chat_store` | `ChatSessionStore` | In-memory **`ChatMemoryBuffer`** per **`conversation_id`** |

---

## Configuration (`app/config.py`)

| Piece | Responsibility |
| ----- | ---------------- |
| **`AgentSettings`** | **Pydantic `BaseSettings`**: loads **`.env`** via `pydantic-settings`, with **`populate_by_name=True`** so fields accept **either** env-style aliases (**`LLM_PROVIDER`**, …) **or** Python field names (**`llm_provider`**, …) when constructing settings in code. |
| LLM provider | **`LLM_PROVIDER`**: `anthropic` \| `openai` \| `ollama` \| **`google`** (Gemini via **`llama-index-llms-google-genai`**). |
| Model id | **`MODEL_NAME`** (trimmed). API id for Anthropic/OpenAI/Google; Ollama fallback tag when **`OLLAMA_MODEL`** is unset. **`llm_model_id`** is passed to each SDK. |
| Cross-provider validation | **`_validate_llm_provider_config`**: requires the matching cloud API key (**`GOOGLE_API_KEY`** when **`google`**), allows `org/model` ids for **OpenAI-compatible** servers when **`OPENAI_BASE_URL`** is set, and requires **`MODEL_NAME`** or **`OLLAMA_MODEL`** for Ollama. |
| Cloud credentials | **`ANTHROPIC_API_KEY`**, **`OPENAI_API_KEY`**, **`GOOGLE_API_KEY`** — trimmed; blank becomes unset. Keys for inactive providers are ignored. |
| Persisted UI config path | **`AGENT_USER_CONFIG_PATH`** — optional override for the JSON file written by **`PUT /agent-config`**. |
| Cloud base URLs | **`ANTHROPIC_BASE_URL`** and **`OPENAI_BASE_URL`** are optional custom endpoints for Anthropic-compatible / OpenAI-compatible servers. Blank becomes unset. **`OPENAI_CONTEXT_WINDOW`** supports arbitrary model ids on compatible servers. |
| Ollama-only | **`OLLAMA_BASE_URL`**, **`OLLAMA_MODEL`**, **`OLLAMA_CONTEXT_WINDOW`** (`num_ctx`; avoids **`POST /api/show`**). Ignored when not using Ollama. |
| Sampling / agent limits | **`TEMPERATURE`**, **`MAX_TOKENS`** (cloud completion cap), **`MAX_AGENT_ITERATIONS`**. |
| Agent persona | **`SYSTEM_PROMPT`** (empty string falls back to built-in coordination assistant default). |
| Tools | **`ENABLED_AGENT_TOOL_IDS`** in **`app/routes/chat.py`**: ids passed to **`create_react_agent`** → **`resolve_tools`**. |
| CORS | **`CORS_ORIGINS`**: comma-separated list for browser clients (default includes Vite **`http://localhost:5173`**). |
| **`get_settings()`** | **`@lru_cache`** singleton — same resolved settings for app lifetime (reload dev server to pick up `.env` changes). |

See **`apps/api/.env.example`** for copy-paste env names and comments.

---

## Agent and tools (`app/agent.py`)

| Function / object | Responsibility |
| ----------------- | -------------- |
| **`create_llm`** | Instantiates LlamaIndex **`Anthropic`**, **`OpenAI`**, **`GoogleGenAI`**, or **`Ollama`**. **`model=`** is always **`settings.llm_model_id`**. Anthropic optionally receives **`anthropic_base_url`**. OpenAI cloud uses the standard wrapper; when **`OPENAI_BASE_URL`** is set, the backend uses a small **OpenAI-compatible wrapper** that accepts arbitrary model ids and uses **`OPENAI_CONTEXT_WINDOW`**. **Google** uses **`google_api_key`**. Ollama uses **`context_window`** and **`ollama_base_url`**. |
| **`_TOOL_REGISTRY`** | Maps string ids to **`FunctionTool`** instances (extensible). Today includes a demo **`echo`** tool. |
| **`resolve_tools`** | Maps registry/bundle ids to **`FunctionTool`** instances; raises if an unknown id is requested. |
| **`create_react_agent`** | Constructs **`ReActAgent`** with name/description, **`system_prompt`**, **`llm`**, **`tool_ids`**, **`streaming=True`**. |

**Extension point:** register single tools in **`_TOOL_REGISTRY`**, multi-tool bundles in **`_TOOL_BUNDLES`** (e.g. **`duckduckgo`** → **`DuckDuckGoSearchToolSpec.to_tool_list()`**), and add ids to **`ENABLED_AGENT_TOOL_IDS`** in **`app/routes/chat.py`**.

---

## Chat memory (`app/chat_store.py`)

| Class | Responsibility |
| ----- | ---------------- |
| **`ChatSessionStore`** | **In-memory** map: `conversation_id` → **`ChatMemoryBuffer`** (LlamaIndex), with **`asyncio.Lock`** per id so concurrent **`POST /chat`** for the same thread does not corrupt history. |
| **`token_limit`** | Default **`120_000`** tokens of buffer per conversation (constructor kwarg). |
| **`delete`** | Drops memory + lock for a conversation (available for future admin/cleanup APIs). |

**Important:** Chat turns are **in-memory** only—**lost on process restart**. **Agent UI configuration** (provider/model/key) is **persisted** separately under **`app/user_agent_config.py`** (JSON on disk).

---

## Persisted agent UI config (`app/user_agent_config.py`)

| Piece | Responsibility |
| ----- | ---------------- |
| **`PersistedUserAgentConfig`** | Pydantic model: **`provider`** (`anthropic` \| `openai` \| `google` \| **`custom`**), **`model`**, optional **`base_url`** (required when **`custom`**), optional **`api_key`**. |
| **`load_user_agent_config` / `save_user_agent_config`** | Read/write JSON with a file lock and atomic replace; default path via **`default_config_path()`** under **`apps/api/data/`** (directory gitignored except **`.gitignore`**). |
| **`merge_persisted_api_key`** | Merges stored secret into **`AgentSettings`** for the active UI provider (custom → OpenAI key). |
| **`env_key_configured_for_ui_provider`** | Used by **`GET /agent-config`** to report whether a key exists from env and/or file. |

---

## HTTP API — agent config (`app/routes/agent_config.py`)

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| **`/agent-config`** | `GET` | Public snapshot: **`provider`**, **`model`**, **`base_url`**, **`api_key_set`**, **`api_key_masked`** (display mask only—never the raw secret). If no file exists, reflects env defaults where possible. |
| **`/agent-config`** | `PUT` | Saves JSON config. **`api_key`** optional: omit or empty to **keep** an existing stored key. Validates by building effective settings and calling **`create_llm`**. Updates **`app.state.user_agent_config`**. |

**Shared merge logic:** **`AgentConfigPayload`** and **`apply_agent_config_overrides`** live in **`app/routes/chat.py`** and are imported by **`agent_config.py`** so PUT and chat use the same provider/model/base-url rules.

---

## HTTP API — chat (`app/routes/chat.py`)

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| **`/health`** | `GET` | Liveness: `{"status": "ok"}` (`main.py`). |
| **`/chat`** | `POST` | **SSE** stream for ReAct agent reply. |

**`POST /chat` body (JSON)**

| Field | Type | Description |
| ----- | ---- | ----------- |
| **`message`** | string, required | User text (min length 1). |
| **`conversation_id`** | string, optional | Thread id; if omitted, server generates a UUID and returns it in the first SSE event. |

**Chat routing:** If **`app.state.user_agent_config`** is set, each request builds a fresh LLM + **`ReActAgent`** from **env `AgentSettings`** merged with **`apply_agent_config_overrides`** + **`merge_persisted_api_key`**, and passes that LLM into **`get_or_create_memory`**. If no persisted config, the startup **`app.state.agent`** / **`llm`** are used. The client does **not** send per-request provider overrides in the chat body.

**SSE events (`text/event-stream`)**

| `event` | Payload (shape) | Meaning |
| ------- | --------------- | ------- |
| **`metadata`** | `{"conversation_id": "<uuid>"}` | Client should store id for follow-up turns. |
| **`token`** | `{"content": "<delta>"}` | Incremental model/agent output (often includes ReAct **`Thought:` / `Action:`** as well as the user-facing answer). The web app may **hide** scratchpad noise in the main bubble while still showing reasoning under agent metadata—see frontend **`assistantDisplayText`**. |
| **`thought_delta`** | `{"delta": "<text>"}` | Extended-thinking chunks when the LLM exposes them on **`AgentStream`**. |
| **`agent_thought`** | `{"text": "<thought>"}` | Parsed **`Thought:`** line from **`AgentOutput`** after each LLM step. |
| **`tool_call`** | `{"tool_name", "tool_id", "tool_kwargs"}` | Tool invocation (kwargs JSON-safe). |
| **`tool_result`** | `{"tool_name", "tool_id", "content", "is_error"}` | Tool output (long content may be truncated). |
| **`done`** | `{}` | Normal completion for this request. |
| **`error`** | `{"detail": "<message>"}` | Failure (e.g. LLM error); surfaced from exception handling. |

Implementation walks **`handler.stream_events()`**, mapping **`AgentStream`**, **`AgentOutput`**, **`ToolCall`**, **`ToolCallResult`**, and **`StopEvent`**, then **`await handler`** to propagate failures.

---

## HTTP API — clash ingestion (`app/routes/clashes.py`)

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| **`/clashes/upload`** | `POST` | Upload a Navisworks clash report XML (`multipart/form-data` field: **`file`**), parse all clashes, run LLM severity inference in parallel, merge inference into each clash by **`clashGuid`**, and return enriched JSON payload. |

**Flow**

1. Validate uploaded file extension (`.xml`) and non-empty payload.
2. Save bytes to a temp file and parse with **`app/utils/clash_parser.py`** (`parse_clash_xml`).
3. Collect clashes across all tests and infer severity via **`app/utils/clash_inference.py`** (`infer_clash_severities`).
4. Merge inference rows by id:
   - inference row key: `clash`
   - parsed clash key: `clashGuid`
5. Append only:
   - `severity`
   - `disciplines`
   - `lead`
6. Return the full parsed payload with these fields added per matched clash.

**Current runtime defaults in route**

- Prompt: `DEFAULT_CLASH_SEVERITY_PREPROMPT`
- Model/base url/key: from `request.app.state.settings`
- Inference params: `max_batch_size=40`, `max_workers=3`, `temperature=0.0`, `minify=True`

---

## Clash utilities (`app/utils`)

| File | Responsibility |
| ---- | -------------- |
| **`app/utils/clash_parser.py`** | XML parser + normalization helpers (`parse_clash_xml`, `parse_clash_result`, `parse_clash_object`), and `optimize_clash_for_agent` for LLM-friendly minified clash payloads. |
| **`app/utils/clash_inference.py`** | Parallel severity inference pipeline using LlamaIndex OpenAI wrapper. Includes adaptive batching (`batch_clashes`), code-fence stripping, minification handoff, default severity preprompt, and ordered result reassembly after concurrent execution. |

---

## Dependency overview (`pyproject.toml`)

Core packages: **FastAPI**, **Uvicorn**, **`llama-index-core`**, provider LLM extras (**anthropic**, **openai**, **ollama**, **google-genai** via **`llama-index-llms-google-genai`**), **sse-starlette**, **pydantic-settings**, **python-dotenv**, **llama-index-tools-duckduckgo**, **python-multipart** (file uploads).

---

## How this fits the product

**Project Balrog** (see root **[README.md](../README.md)**) targets AI-assisted **BIM clash resolution**. The backend delivers a **streaming coordination assistant** consumed by the web **`ChatSidebar`** via **`POST /chat`** (SSE), with **optional persisted LLM settings** via **`GET` / `PUT /agent-config`**. Clash ingestion, Speckle orchestration, and analysis panels may grow into additional routers or tools under **`app/`**; this guide reflects the **current** modular boundaries so new work stays consistent.

---

## Related docs

- **[apps/api/README.md](../apps/api/README.md)** — copy-paste setup, run command, endpoint summary.
- **[.cursor/frontend-repository-guide.md](./frontend-repository-guide.md)** — UI layout and state; pair with this doc when wiring chat or API calls.
