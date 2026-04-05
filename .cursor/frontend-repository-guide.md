# Frontend repository guide (`apps/web`)

This document maps the **React + Vite** frontend: entry points, routing, layout, feature areas, shared state, and styling conventions. Use it when navigating or extending the UI.

---

## Location and stack

| Item        | Detail |
| ----------- | ------ |
| Root        | `apps/web/` |
| Build       | Vite 8, TypeScript |
| UI          | React 19, Tailwind CSS v4 (`@import 'tailwindcss'` in `src/index.css`) |
| Routing     | React Router 7 (`BrowserRouter`, nested routes) |
| 3D          | `@speckle/viewer` (wired via `useSpeckleViewer`) |

---

## Bootstrap and app shell

| File | Role |
| ---- | ---- |
| `index.html` | Vite HTML entry; mounts `#root`. |
| `src/main.tsx` | `createRoot`, `StrictMode`, `BrowserRouter`, wraps tree in **`AppProvider`**, imports **`index.css`**. |
| `src/App.tsx` | Declares **`Routes`**: all pages render inside **`AppLayout`**. |
| `src/index.css` | Tailwind import, **`:root` / `@theme`** primary palette (`--app-primary`, `--app-primary-hover`), **`.btn-primary`** component layer for standardized CTAs. |

**Route map**

| Path | Component | Purpose |
| ---- | ----------- | ------- |
| `/` (index) | `LandingPage` | Onboarding: Navisworks upload, Speckle URLs, navigation to inspector. |
| `/inspector` | `ClashInspector` | Clash inspection workspace (guards session via context). |

---

## Layout (`src/components/layout/`)

| Component | Responsibility |
| --------- | -------------- |
| **`AppLayout`** | Page chrome: main column (`<Outlet />`) for route content + fixed-width **`ChatSidebar`** on large screens. Responsive: column on small viewports, row on `md+`. |
| **`ChatSidebar`** | Right rail: **`POST /chat`** (SSE) for messages; **`GET /agent-config`** on mount and **`PUT /agent-config`** from the settings modal. Agent routing (provider, model, base URL, API key) is **stored only on the API**—the browser never persists secrets. Settings gear opens a dialog (provider, model, custom base URL, API key with show/hide). Renders **`AgentActivityLog`** above the reply. Splits assistant **`ChatMessage.text`** with **`splitAnswerStream`** (**`answerStreamSplit.ts`**): text **before** the last answer keyword goes to metadata as **`streamPreamble`**; the **main bubble** shows only **`assistantBubbleText`** (post-marker body + ReAct noise stripped). See **`postChatStream.ts`**, **`agentConfig.ts`**, **`answerStreamSplit.ts`**, **`assistantDisplayText.ts`**. |
| **`AgentActivityLog`** | Collapsible **agent metadata** (closed by default): header shows **Thinking** + dots while streaming and no answer slice yet (**`preAnswerStreaming`**), else a summary line (counts + **Metadata** when preamble text exists). Expanded: **Reasoning** card for raw **`streamPreamble`** (model output before **`Answer:`** / **`Final answer:`** / **`### Answer`**), **Extended thinking** (**`thought_delta`**), per-step **Reasoning** (**`agent_thought`**), tool calls/results. |

---

## Landing / onboarding (`src/components/landing/`)

| Component | Responsibility |
| --------- | -------------- |
| **`LandingPage`** | “Get started” card: steps copy, **`FileUpload`**, **`SpeckleUrlInput`**, **“Go to clash report”** (`btn-primary`). In **dev** (`import.meta.env.DEV`), the CTA can stay enabled without full setup; production still requires file + at least one Speckle URL. Navigates to `/inspector`. |
| **`FileUpload`** | Hidden file input + **`btn-primary`** trigger; accepts HTML/XML-style clash report extensions; calls **`setNavisworksReport`** on the context. |
| **`SpeckleUrlInput`** | **+ Add Speckle URL** adds rows; each row is URL input + delete control. Uses **`speckleUrlRows`** / **`appendSpeckleUrlRow`**, **`setSpeckleUrlAt`**, **`removeSpeckleUrlAt`**. |

---

## Inspector / clash workspace (`src/components/inspector/`)

| Component | Responsibility |
| --------- | -------------- |
| **`ClashInspector`** | **Session gate**: if no Navisworks file, no non-empty Speckle URL, or no clashes, **`Navigate`** to `/`. Layout: viewer region with **`SeverityFilter`** + **`ClashSelector`** overlay, **`ModelViewer`** below; **`AnalysisPanel`** placeholders for context and recommendations. Keeps **`selectedClashId`** valid when the filtered list changes. |
| **`ModelViewer`** | Container ref for Speckle; **`useSpeckleViewer`** with non-empty **`speckleUrls`**; empty state when no URLs. |
| **`ClashSelector`** | Select current clash from **`filteredClashes`**. |
| **`SeverityFilter`** | Adjusts **`severityThreshold`**; drives **`filteredClashes`**. |
| **`AnalysisPanel`** | Simple titled panel wrapper for future AI/context content. |

---

## Global state (`src/context/`)

| Module | Role |
| ------ | ---- |
| **`appStateContext.ts`** | **`AppState`** type: clashes, Navisworks filename, Speckle rows/URLs, severity + selection, **`filteredClashes`**, mutators, **`clearSession`**. |
| **`AppProvider.tsx`** | Implements state: mock clash generation on file upload, Speckle row CRUD with stable **`id`**s, derived **`speckleUrls`** string array for viewers and guards. |
| **`useApp.ts`** | Hook to consume context (throws if outside provider). |

**Data flow (high level)**

1. User uploads a report → **`setNavisworksReport`** → mock **`clashes`**, filename stored.
2. User adds Speckle rows → **`speckleUrlRows`** / derived **`speckleUrls`**.
3. Inspector reads **`filteredClashes`**, **`selectedClashId`**, Speckle URLs for the viewer.

---

## Hooks (`src/hooks/`)

| Hook | Role |
| ---- | ---- |
| **`useSpeckleViewer`** | Initializes / tears down **`@speckle/viewer`** on a container ref when enabled and URLs exist. |

---

## Chat / API helpers (`src/lib/`)

| Module | Role |
| ------ | ---- |
| **`apiBase.ts`** | **`getApiBaseUrl()`** — backend origin from **`VITE_API_BASE_URL`** (default `http://localhost:8000`). |
| **`postChatStream.ts`** | **`postChatStream(message, conversationId, handlers, options?)`** — **`POST /chat`** with **`Accept: text/event-stream`**, parses SSE (`metadata`, `token`, `thought_delta`, `agent_thought`, `tool_call`, `tool_result`, `done`, `error`). Optional **`options.signal`** for abort. **Does not** send per-message agent overrides; the server uses persisted **`/agent-config`** or env defaults. |
| **`agentConfig.ts`** | **`fetchAgentConfig`**, **`saveAgentConfigToServer`** for **`GET` / `PUT /agent-config`**; **`AgentConfigPublic`**, **`MODEL_OPTIONS`**, **`DEFAULT_AGENT_CONFIG`**. Request/response fields use API **snake_case** (`base_url`, `api_key_set`, `api_key_masked`). |
| **`answerStreamSplit.ts`** | **`splitAnswerStream(raw)`** — splits assistant output into **`preamble`** (everything before the **last** line-start marker among **`Answer:`**, **`Final answer:`**, **`### Answer`**) and **`answer`** (after that marker). If none match, all text stays in **`preamble`** and **`answer`** is empty (bubble stays empty; draft lives in metadata). |
| **`assistantDisplayText.ts`** | **`assistantBubbleText(raw)`** — takes **`splitAnswerStream(raw).answer`**, then strips ReAct **`Thought:` / `Action:`** noise (including **`Action: None`**, fenced blocks, separators) for the **main assistant bubble** only. Raw **`ChatMessage.text`** is unchanged. |

---

## Types (`src/types/`)

| Export | Use |
| ------ | --- |
| **`Clash`** | `id`, `label`, `severity` for list/filter/selection. |
| **`AgentActivityItem`** | Union: **`thought`** (reasoning text), **`tool_call`**, **`tool_result`** — shapes for **`ChatMessage.activity`**. |
| **`ChatMessage`** | Sidebar message: **`role`**, **`text`**, **`at`**, **`id`**; assistant may set **`streaming`**, **`activity`**, **`thinkingBuffer`** while SSE is processed. |

**`SpeckleUrlRow`** lives in **`appStateContext.ts`** (id + url for list keys).

---

## Styling conventions

- **Semantic primary color**: change **`--app-primary`** / **`--app-primary-hover`** in **`src/index.css`**; Tailwind **`primary`** utilities follow via **`@theme`**.
- **Primary buttons**: prefer **`btn-primary`** (+ **`btn-primary--full`** for full width) instead of one-off teal classes.
- **Layout**: `AppLayout` uses `h-svh`, `min-h-0`, and flex splitting so the main pane and sidebar scroll correctly.

---

## Related docs

- Root **[README.md](../README.md)** — run `pnpm dev` in `apps/web`, API CORS defaults.
- **[backend-repository-guide.md](./backend-repository-guide.md)** — backend modules, agent, SSE chat, configuration.
- **[apps/api/README.md](../apps/api/README.md)** — quick setup and endpoint cheatsheet.
