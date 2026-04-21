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
| `main.py` → `lifespan` | On startup: reads **`get_settings()`** (env), loads persisted UI config from disk via **`load_user_agent_config`**, merges both into **`effective_agent_settings`**, builds **`create_llm`** + **`create_react_agent`** + **`ChatSessionStore`**, attaches all to **`app.state`**. |
| `main.py` → `app` | **`FastAPI`** title/description, **`CORSMiddleware`** from **`settings.cors_origins`**, includes **`chat`**, **`agent_config`**, and **`clashes`** routers, exposes **`GET /health`**. |

**Runtime state (`request.app.state`)**

| Attribute | Type (conceptual) | Purpose |
| --------- | ----------------- | ------- |
| `settings` | `AgentSettings` | Immutable env-based settings (`.env` snapshot at startup) |
| `effective_settings` | `AgentSettings` | **Active** settings: env merged with persisted UI config. Updated on **`PUT /agent-config`**. Used by chat and clash inference. |
| `user_agent_config_path` | `Path` | JSON file for UI-saved agent settings |
| `user_agent_config` | `PersistedUserAgentConfig \| None` | Loaded/saved provider, model, optional **`base_url`**, optional **`api_key`**; updated on **`PUT /agent-config`** |
| `llm` | LlamaIndex `LLM` | Active LLM instance built from `effective_settings`. Updated on **`PUT /agent-config`**. |
| `agent` | `ReActAgent` | Active agent built from `effective_settings`. Updated on **`PUT /agent-config`**. |
| `chat_store` | `ChatSessionStore` | In-memory **`ChatMemoryBuffer`** per **`conversation_id`** |

**Config precedence:** `.env` defines the **provider family** at startup (`LLM_PROVIDER`). On-disk `agent_user_config.json` is merged only when its saved provider matches that family (e.g. both Ollama or both OpenAI). If the file still says `openai` but `.env` says `ollama`, the file is **ignored** until you save again from the UI or align `.env` with the file. When there is no applicable saved file, `effective_settings == settings` (pure env). After `PUT /agent-config`, the server updates `effective_settings`, `llm`, and `agent` in place — no restart needed.

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
| Cloud base URLs | **`ANTHROPIC_BASE_URL`** and **`OPENAI_BASE_URL`** are optional custom endpoints for Anthropic-compatible / OpenAI-compatible servers. Blank becomes unset. When **`LLM_PROVIDER=ollama`** and **`OPENAI_BASE_URL`** is set, the backend uses the OpenAI-compatible client instead of the native Ollama client. **`OPENAI_CONTEXT_WINDOW`** supports arbitrary model ids on compatible servers. |
| Ollama-only | **`OLLAMA_BASE_URL`**, **`OLLAMA_MODEL`**, **`OLLAMA_CONTEXT_WINDOW`** (`num_ctx`; avoids **`POST /api/show`**). Ignored when not using Ollama. |
| Sampling / agent limits | **`TEMPERATURE`**, **`MAX_TOKENS`** (cloud completion cap), **`MAX_AGENT_ITERATIONS`**. |
| Agent persona | **`SYSTEM_PROMPT`** (empty string falls back to built-in coordination assistant default). |
| Tools | **`ENABLED_AGENT_TOOL_IDS`** in **`app/routes/chat.py`** (e.g. **`duckduckgo`**, **`playbooks`**): bundle/registry ids passed to **`create_react_agent`** → **`resolve_tools`**. |
| CORS | **`CORS_ORIGINS`**: comma-separated list for browser clients (default includes Vite **`http://localhost:5173`**). |
| **`get_settings()`** | **`@lru_cache`** singleton — same resolved settings for app lifetime (reload dev server to pick up `.env` changes). |

See **`apps/api/.env.example`** for copy-paste env names and comments.

---

## Agent and tools (`app/agent.py`)

| Function / object | Responsibility |
| ----------------- | -------------- |
| **`create_llm`** | Instantiates LlamaIndex **`Anthropic`**, **`OpenAI`**, **`GoogleGenAI`**, or **`Ollama`**. **`model=`** is always **`settings.llm_model_id`**. Anthropic optionally receives **`anthropic_base_url`**. OpenAI cloud uses the standard wrapper; when **`OPENAI_BASE_URL`** is set, the backend uses a small **OpenAI-compatible wrapper** (`OpenAICompatibleLLM`) that accepts arbitrary model ids and uses **`OPENAI_CONTEXT_WINDOW`**. **Google** uses **`google_api_key`**. Ollama uses **`context_window`** and **`ollama_base_url`** (native client), or the OpenAI-compatible wrapper when **`OPENAI_BASE_URL`** is set. |
| **`_TOOL_REGISTRY`** | Maps string ids to single **`FunctionTool`** instances. Includes a demo **`echo`** tool (optional demos). |
| **`_TOOL_BUNDLES`** | Maps bundle ids to callables returning **`list[FunctionTool]`**. **`duckduckgo`** → **`DuckDuckGoSearchToolSpec.to_tool_list()`**. **`playbooks`** → **`playbook_tool_list()`** from **`app/tools/playbook_tools.py`** (`get_playbook_directory`, **`read_clash_playbook`** over Markdown under **`apps/api/skills/playbooks/`**). |
| **`resolve_tools`** | Expands registry + bundle ids into concrete **`FunctionTool`** instances; raises if an unknown id is requested. |
| **`create_react_agent`** | **`resolve_tools(tool_ids)`** → passes resolved **`FunctionTool`** list to **`ReActAgent`** (name/description, **`system_prompt`**, **`llm`**, **`streaming=True`**). |

**Clash playbooks (local Markdown, no vector store):** Trade-category folders (e.g. **`Structural_x_MEP/`**) contain **`*.md`** playbooks with YAML frontmatter (**`title`**, **`elements`**, **`applies_when`**, …). The agent is instructed via **`app/utils/clash_analysis_prompt.py`** (Layer C) to call **`get_playbook_directory`** then **`read_clash_playbook`** for run-analysis flows.

**Extension point:** add a single tool id → **`_TOOL_REGISTRY`**, or a bundle → **`_TOOL_BUNDLES`**, then register the bundle id in **`ENABLED_AGENT_TOOL_IDS`** in **`app/routes/chat.py`** (same list is used for the main agent and **`clash_analysis_agent`** in **`main.py`** / **`PUT /agent-config`**).

**Server logs — tool calls:** When the ReAct loop issues a tool invocation, **`app/utils/agent_tool_log.py`** prints one stdout line per call (**function `name`**, optional internal **`tool_id`**, JSON **`args` only** — never tool output). Wired for **`POST /chat`** (SSE) and **`POST /clashes/analyze-context`**. Look for the **`[Balrog agent]`** prefix in the uvicorn terminal.

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
| **`PersistedUserAgentConfig`** | Pydantic model: **`provider`** (`anthropic` \| `openai` \| `google` \| `custom` \| **`ollama`**), **`model`**, optional **`base_url`** (required when **`custom`**; optional for **`ollama`** to use OpenAI-compatible mode), optional **`api_key`**. |
| **`load_user_agent_config` / `save_user_agent_config`** | Read/write JSON with a file lock and atomic replace; default path via **`default_config_path()`** under **`apps/api/data/`** (directory gitignored except **`.gitignore`**). |
| **`effective_agent_settings(base, stored)`** | Merges persisted UI config into env-based **`AgentSettings`** — maps UI provider to **`llm_provider`**, overrides model/base-url, and substitutes the stored API key into the correct field. Returns unmodified env settings when no persisted config exists. Called at **startup** and on **`PUT /agent-config`**. |
| **`env_key_configured_for_ui_provider`** | Used by **`GET /agent-config`** to report whether a key exists from env and/or file. |

---

## HTTP API — agent config (`app/routes/agent_config.py`)

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| **`/agent-config`** | `GET` | Public snapshot: **`provider`**, **`model`**, **`base_url`**, **`api_key_set`**, **`api_key_masked`** (display mask only—never the raw secret). If no file exists, reflects env defaults. |
| **`/agent-config`** | `PUT` | Saves JSON config. **`api_key`** optional: omit or empty to **keep** an existing stored key. Validates by building effective settings and calling **`create_llm`**. Updates **`app.state.user_agent_config`**, **`app.state.effective_settings`**, **`app.state.llm`**, and **`app.state.agent`** so the new config takes effect immediately without a restart. |

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

**Chat routing:** every request uses the cached **`app.state.agent`** and **`app.state.llm`** (built from `effective_settings`). When the user changes settings via `PUT /agent-config`, those are refreshed in place. The client does **not** send per-request provider overrides in the chat body.

**SSE events (`text/event-stream`)**

| `event` | Payload (shape) | Meaning |
| ------- | --------------- | ------- |
| **`metadata`** | `{"conversation_id": "<uuid>"}` | Client should store id for follow-up turns. |
| **`token`** | `{"content": "<delta>"}` | Incremental model/agent output (often includes ReAct **`Thought:` / `Action:`** as well as the user-facing answer). The web app may **hide** scratchpad noise in the main bubble while still showing reasoning under agent metadata—see frontend **`assistantDisplayText`**. |
| **`thought_delta`** | `{"delta": "<text>"}` | Extended-thinking chunks when the LLM exposes them on **`AgentStream`**. |
| **`agent_thought`** | `{"text": "<thought>"}` | Parsed **`Thought:`** line from **`AgentOutput`** after each LLM step. |
| **`tool_call`** | `{"tool_name", "tool_id", "tool_kwargs"}` | Tool invocation (kwargs JSON-safe). The server also **`print`**s a one-line **`[Balrog agent] POST /chat tool_call …`** summary (name + args only) to the process stdout for terminal debugging. |
| **`tool_result`** | `{"tool_name", "tool_id", "content", "is_error"}` | Tool output (long content may be truncated). |
| **`done`** | `{}` | Normal completion for this request. |
| **`error`** | `{"detail": "<message>"}` | Failure (e.g. LLM error); surfaced from exception handling. |

Implementation walks **`handler.stream_events()`**, mapping **`AgentStream`**, **`AgentOutput`**, **`ToolCall`**, **`ToolCallResult`**, and **`StopEvent`**, then **`await handler`** to propagate failures.

---

## HTTP API — clash ingestion (`app/routes/clashes.py`)

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| **`/clashes/upload`** | `POST` | Upload a Navisworks clash report XML (`multipart/form-data` field: **`file`**), parse all clashes, run LLM severity inference in batches, and stream results via SSE. Uses **`app.state.effective_settings`** for model/key/base-url. |
| **`/clashes/analyze-context`** | `POST` | Run one-shot clash-context analysis from frontend JSON payload (`clash`, `clash_objects_original`, `context_region`, `nearby_speckle_objects`, `meta`) and return structured `{ watch_out_for, recommendations, notes }`. |

**Flow**

1. Validate uploaded file extension (`.xml`) and non-empty payload.
2. Save bytes to a temp file and parse with **`app/utils/clash_parser.py`** (`parse_clash_xml`).
3. Collect clashes across all tests and infer severity via **`app/utils/clash_inference.py`** (`infer_single_batch`).
4. Stream SSE events: **`parsed`** (full payload), **`batch_result`** (per batch with `results`, `completed`, `total`), **`done`** or **`error`**.

**`POST /clashes/analyze-context` runtime notes**

- Serializes and size-checks incoming context payload before model call (413 on oversized bodies).
- Runs the dedicated **`clash_analysis_agent`** with a fresh short-lived conversation memory per request.
- Uses `max_iterations=settings.max_agent_iterations` with `early_stopping_method="generate"` so max-iteration loops produce a final response instead of throwing runtime errors.
- Parses model output through **`parse_clash_analysis_json`** and **`normalize_analysis_result`** to enforce resilient structured output.
- Streams agent events during the run; each **`ToolCall`** prints **`[Balrog agent] POST /clashes/analyze-context tool_call …`** to stdout (name + args only), same helper as chat.

---

## Clash utilities (`app/utils`)

| File | Responsibility |
| ---- | -------------- |
| **`app/utils/clash_parser.py`** | XML parser + normalization helpers (`parse_clash_xml`, `parse_clash_result`, `parse_clash_object`), and `optimize_clash_for_agent` for LLM-friendly minified clash payloads. |
| **`app/utils/clash_inference.py`** | Parallel severity inference pipeline using LlamaIndex OpenAI wrapper. Includes adaptive batching (`batch_clashes`), code-fence stripping, minification handoff, default severity preprompt, and ordered result reassembly after concurrent execution. |
| **`app/utils/clash_analysis_prompt.py`** | Prompt suffix for run-analysis mode. Forces JSON-only final output (`watch_out_for`, `recommendations`), Layer C **playbook retrieval** (directory index → read Markdown), and use of clash + nearby Speckle context. |
| **`app/utils/clash_analysis_parse.py`** | Extracts/parses fenced or inline JSON from model output and normalizes fallback notes when strict JSON is missing. |

---

## Dependency overview (`pyproject.toml`)

Core packages: **FastAPI**, **Uvicorn**, **`llama-index-core`**, provider LLM extras (**anthropic**, **openai**, **ollama**, **google-genai** via **`llama-index-llms-google-genai`**), **sse-starlette**, **pydantic-settings**, **python-dotenv**, **llama-index-tools-duckduckgo**, **python-multipart** (file uploads).

---

## How this fits the product

**Project Balrog** (see root **[README.md](../README.md)**) targets AI-assisted **BIM clash resolution**. The backend delivers a **streaming coordination assistant** consumed by the web **`ChatSidebar`** via **`POST /chat`** (SSE), with **persisted LLM settings** via **`GET` / `PUT /agent-config`**. Clash ingestion, Speckle orchestration, and analysis panels may grow into additional routers or tools under **`app/`**; this guide reflects the **current** modular boundaries so new work stays consistent.

---

## Related docs

- **[apps/api/README.md](../apps/api/README.md)** — copy-paste setup, run command, endpoint summary.
- **[.cursor/frontend-repository-guide.md](./frontend-repository-guide.md)** — UI layout and state; pair with this doc when wiring chat or API calls.
