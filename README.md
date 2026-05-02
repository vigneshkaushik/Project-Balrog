# Project Balrog

A prototype web application for **AI-assisted inter-trade clash resolution** in AEC/BIM coordination workflows.

The current product direction uses a case study built around the **Snowdon Towers Revit sample models** across architectural, structural, and MEP disciplines.

The system is designed to ingest model references, clash reports, and project requirements, then help users understand clashes in context and move toward resolution faster.

---

## Project goals

- Help teams **resolve** clashes, not only detect them.
- Bring together **multi-trade model context**, clash data, and requirements in one workflow.
- Reduce coordination friction from **trade-isolated** decision-making.
- Use AI to explain clash **context**, **implications**, and **possible resolution paths**.
- Support follow-up coordination actions such as drafting RFIs or emails.

### Business / outcome goal

Demonstrate a compelling prototype that shows how AI can improve BIM coordination by turning raw clash data into **actionable cross-trade resolution support**.

### Product goal

Build a web application where a user can:

1. Paste relevant **Speckle** model URLs
2. Upload a **Navisworks** clash report
3. Inspect clashes by **severity**
4. Run **AI analysis** on a selected clash
5. Receive **contextual explanations**, requirement-aware **implications**, and **possible fixes**
6. Continue with a **chatbot** or **draft coordination output** for follow-up communication

---

## Primary users

- BIM coordinators
- Design and coordination teams working across trades

---

## Problem being addressed

In AEC/BIM workflows, models are often separated by trade for practical reasons. That separation makes independent discipline work easier, but it also creates **coordination blind spots**.

A clash may be visible in a coordination tool, but resolving it well usually needs more than geometry alone. Teams also need:

- Nearby **model context**
- Awareness of **related systems** from other trades
- **Relevant project requirements**
- Support for understanding **downstream implications**

This project is grounded in the idea that the real opportunity is not just clash detection, but **context-aware clash resolution support**.

---

## Architecture

The application uses a **monolithic web app** layout with clear internal boundaries for API, web UI, and infrastructure.

```
.
├── apps/
│   ├── api/
│   └── web/
```

### Structure intent

| Path            | Responsibility                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| **`apps/api/`** | Backend ingestion, analysis orchestration, requirement retrieval, context packaging, and AI-facing application logic |
| **`apps/web/`** | Frontend: model input, clash inspection, severity filtering, AI analysis, chat, and draft coordination workflows     |

---

## Technology Stack

- React frontend
- Python backend

---

## Running locally

Run the **API** and **web app** in separate terminals. Defaults expect the API on port **8000** and Vite on **5173** (CORS in `apps/api/.env.example` already allows `http://localhost:5173`).

### Prerequisites

- **Backend:** Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- **Frontend:** Node.js and [pnpm](https://pnpm.io/) (the web app uses a `pnpm-lock.yaml`)

### Backend (`apps/api`)

```bash
cd apps/api
cp .env.example .env
# Edit .env: set LLM provider, API keys, and CORS if your frontend URL differs.
uv sync
./dev.sh
```

The **`dev.sh`** script runs Uvicorn with reload on `0.0.0.0:8000` via **`uv run`** (same as `uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000`). Run it from **`apps/api`**, or invoke **`./apps/api/dev.sh`** from the repo root.

- Health check: [http://localhost:8000/health](http://localhost:8000/health)
- More detail: [apps/api/README.md](apps/api/README.md)
- Clash upload endpoint: `POST /clashes/upload` (multipart XML file)

**Chat (SSE):** `POST /chat` accepts JSON `{ "message": "...", "conversation_id": "<optional uuid>" }` and returns `text/event-stream` with `metadata` (includes assigned `conversation_id` if you omitted it), `token` deltas, then `done` or `error`. Use **`curl -N`** so the stream is not buffered:

```bash
curl -N -X POST http://localhost:8000/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Say hello in one short sentence."}'
```

To continue a thread, add `"conversation_id":"<uuid-from-metadata>"` to the JSON body on the next request.

**Clash ingestion:** `POST /clashes/upload` accepts `multipart/form-data` with one `.xml` file field named `file`. The API parses clashes, infers severity in parallel, appends `severity`, `disciplines`, and `lead` onto each clash object (matched by `clashGuid`), and returns the enriched JSON payload.

```bash
curl -X POST "http://localhost:8000/clashes/upload" \
  -F "file=@apps/api/experiments/Base_Model_Arch_vs_Structural_Clashes.xml" \
  -H "Accept: application/json"
```

**Run analysis:** `POST /clashes/analyze-context` accepts clash + nearby Speckle context and returns structured output with `analysis_metadata`, `engineering_scratchpad`, `clash_summary`, `coordination_watch_list`, `recommendations`, and fallback `notes`.

#### LLM and model configuration

Settings live in **`apps/api/.env`** (see **[apps/api/.env.example](apps/api/.env.example)** for provider-specific blocks).

| Variable | Used when | Role |
| -------- | --------- | ---- |
| **`LLM_PROVIDER`** | Always | `anthropic` (default), `openai`, or `ollama`. |
| **`MODEL_NAME`** | Always | **Anthropic / OpenAI:** API model id (e.g. `claude-…`, `gpt-4o`). **Ollama:** model tag, or fallback when **`OLLAMA_MODEL`** is unset. |
| **`ANTHROPIC_API_KEY`** | `LLM_PROVIDER=anthropic` | Required. Ignored for OpenAI and Ollama. |
| **`OPENAI_API_KEY`** | `LLM_PROVIDER=openai` | Required. Ignored for Anthropic and Ollama. |
| **`ANTHROPIC_BASE_URL`** | `LLM_PROVIDER=anthropic` | Optional custom Anthropic-compatible base URL. Leave unset for Anthropic cloud. |
| **`OPENAI_BASE_URL`** | `LLM_PROVIDER=openai` | Optional custom OpenAI-compatible base URL (for self-hosted gateways / compatible servers). Leave unset for OpenAI cloud. |
| **`OPENAI_CONTEXT_WINDOW`** | `LLM_PROVIDER=openai` with `OPENAI_BASE_URL` | Context window used for OpenAI-compatible custom endpoints with arbitrary model ids. Ignored for OpenAI cloud. |
| **`OLLAMA_BASE_URL`** | `LLM_PROVIDER=ollama` | Ollama API root only (no path). Trimmed; trailing `/` removed; empty → `http://localhost:11434`. Ignored for cloud providers. |
| **`OLLAMA_MODEL`** | `LLM_PROVIDER=ollama` | Optional override; if set, used instead of **`MODEL_NAME`** as the Ollama tag. |
| **`OLLAMA_CONTEXT_WINDOW`** | `LLM_PROVIDER=ollama` | Context length (`num_ctx`) sent to Ollama; avoids **`POST /api/show`** probes. Ignored for Anthropic and OpenAI. |
| **`MAX_TOKENS`** | Anthropic and OpenAI | Max **output** tokens. With Ollama, context size is **`OLLAMA_CONTEXT_WINDOW`**; output limits follow LlamaIndex/Ollama defaults unless you tune **`additional_kwargs`** later. |

Startup validation is provider-aware: Anthropic/OpenAI require the matching API key, Ollama requires a non-empty model tag, and `org/model` ids like `qwen/qwen3-vl-4b` are accepted for **OpenAI-compatible** servers when **`OPENAI_BASE_URL`** is set.

For OpenAI-compatible self-hosted servers, set **`LLM_PROVIDER=openai`**, **`OPENAI_BASE_URL=http://host:port/v1`**, and use the model id reported by **`GET /v1/models`**. Some compatible servers ignore auth; if the client still requires a key, a non-empty placeholder like `OPENAI_API_KEY=dummy` may be sufficient. If the model id is not a standard OpenAI cloud name, set **`OPENAI_CONTEXT_WINDOW`** so the app does not rely on OpenAI’s built-in model registry.

Other shared knobs: **`TEMPERATURE`**, **`MAX_AGENT_ITERATIONS`**, **`SYSTEM_PROMPT`**, **`CORS_ORIGINS`**. ReAct tool ids are listed in **`apps/api/app/routes/chat.py`** as **`ENABLED_AGENT_TOOL_IDS`** (not **`.env`**). Restart the API after changing **`.env`** (settings are cached at startup).

### Frontend (`apps/web`)

```bash
cd apps/web
cp .env.example .env   # optional: set VITE_API_BASE_URL if the API is not on http://localhost:8000
pnpm install
pnpm dev
```

- Open the URL Vite prints (typically [http://localhost:5173](http://localhost:5173)).
- The sidebar chat calls **`POST /chat`** on the API origin from **`VITE_API_BASE_URL`** (default `http://localhost:8000`) and streams SSE `token` events into the UI.

### Production build (frontend only)

```bash
cd apps/web
pnpm run build
pnpm run preview   # optional: serve the built assets locally
```

---

## Current scope

**Intended workflow**

1. User pastes relevant Speckle model URLs.
2. User uploads a Navisworks clash report.
3. System organizes and filters clashes by severity.
4. User selects a clash and runs AI analysis.
5. System gathers local multi-trade context and relevant requirements.
6. AI returns explanation, implications, and possible resolutions.
7. User continues through chatbot interaction or drafts an email/RFI.

---
