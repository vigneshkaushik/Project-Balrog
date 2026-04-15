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
| 3D          | `@speckle/viewer` (wired via `useSpeckleViewer`), optional **`three`** for camera/box math in **`zoomToSmallestClashObject.ts`** |
| Speckle auth | Optional **`VITE_SPECKLE_TOKEN`** in `.env` — passed into the viewer hook when loading private streams |

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
| `/inspector` | `ClashInspector` | Clash inspection workspace (session gate via context; see inspector section). |

---

## Layout (`src/components/layout/`)

| Component | Responsibility |
| --------- | -------------- |
| **`AppLayout`** | Page chrome: route content via `<Outlet />`; inspector now uses floating overlays instead of a fixed right rail. |
| **`FloatingChat`** | Floating launcher + draggable/resizable chat window, grid-snapped via `useFloatingPanel`, with persisted open state (`balrog-floating-chat-open`). |
| **`ChatWindow`** | Floating chat panel body (renamed from `ChatSidebar`): SSE chat stream, agent config modal (`GET`/`PUT /agent-config`), history restore, activity log rendering. Header is drag-handle enabled (except interactive controls like settings button). |
| **`AgentActivityLog`** | Collapsible **agent metadata** (closed by default): header shows **Thinking** + dots while streaming and no answer slice yet (**`preAnswerStreaming`**), else a summary line (counts + **Metadata** when preamble text exists). Expanded: **Reasoning** card for raw **`streamPreamble`** (model output before **`Answer:`** / **`Final answer:`** / **`### Answer`**), **Extended thinking** (**`thought_delta`**), per-step **Reasoning** (**`agent_thought`**), tool calls/results. Tool results use **`ToolResultView`** for readable display. |
| **`ToolResultView`** | Renders **`tool_result`** activity content (and error styling when **`isError`**). Used from **`AgentActivityLog`**. |

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
| **`ClashInspector`** | Floating-panel workspace: draggable/resizable **`FloatingCard`** panels for Clash Controls, Context, Recommendations. Panels support collapse state, persistent layout, and grid snapping. Gate now waits for backend session hydration before redirect/toast. Context panel includes a `Show Context` toggle that computes nearby context objects (AABB-based) once per clash, persists them in local UI state, and renders a clickable context object list. |
| **`ModelViewer`** | Speckle container: `useSpeckleViewer` with trimmed URLs and optional token. Highlight system now supports clash object ids (**red**) plus optional context object ids (**light blue**) while ghosting the rest. Context-object clicks and clash-object clicks both support viewer focus/selection workflows. |
| **`SpeckleObjectOverlay`** | Floating, draggable, resizable card for selected Speckle object data. Uses the same floating-card styling language and `useFloatingPanel` grid behavior as other overlays; header can collapse details, and body scrolls for long payloads. |
| **`ClashSelector`** | Select current clash from **`filteredClashes`**; includes a **No clash selected** option so users can de-select and return viewer materials/filters to original state. |
| **`SeverityFilter`** | Collapsible card: **fixed `p-4`** on the shell so the header does not jump when toggling. Body animates via **CSS grid** `grid-rows-[0fr]` ↔ `grid-rows-[1fr]` (`transition-[grid-template-rows]`, respects **`motion-reduce`**). **`inert`** when collapsed so the range is not focusable. Drives **`severityThreshold`** and **`filteredClashes`**. Includes a **Highlight / Focused** toggle button near the visible-count chip that highlights all clashes at the current severity and ghosts the rest. |
| **`AnalysisPanel`** | Reusable analysis section wrapper with optional inner title and optional Run Analysis footer button (Context now hides both inner title and run button). |

---

## Global state (`src/context/`)

| Module | Role |
| ------ | ---- |
| **`appStateContext.ts`** | **`AppState`** type: clashes, Navisworks filename, Speckle rows/URLs, **`severityThreshold`** + **`setSeverityThreshold`**, **`highlightFilteredSeverity`** toggle, selection, derived **`filteredClashes`**, mutators, **`clearSession`**. |
| **`AppProvider.tsx`** | Implements state: clash upload/session hydration, Speckle row CRUD with stable **`id`**s, derived **`speckleUrls`** string array for viewers/guards. Selecting a clash turns off severity-highlight mode; enabling severity highlight clears selected clash. |
| **`useApp.ts`** | Hook to consume context (throws if outside provider). |

**Data flow (high level)**

1. User uploads a report → **`setNavisworksReport`** → mock **`clashes`**, filename stored.
2. User adds Speckle rows → **`speckleUrlRows`** / derived **`speckleUrls`**.
3. Inspector reads **`filteredClashes`**, **`selectedClashId`**, **`highlightFilteredSeverity`**, Speckle URLs for the viewer; severity filter narrows the clash list and can toggle severity-wide highlighting.

---

## Hooks (`src/hooks/`)

| Hook | Role |
| ---- | ---- |
| **`useSpeckleViewer`** | Creates / disposes **`@speckle/viewer`** on a container ref when **`enabled`** and URLs exist. Options: **`authToken`**, **`debug`**, **`enableSelection`**, **`enableCamera`**, **`onModelsLoaded`**. Uses a stable **`urlsKey`** string internally so callers are not forced to memoize URL arrays. |
| **`useFloatingPanel`** | Shared drag/resize/persist hook for floating overlays. Uses a single 16px panel grid (`PANEL_GRID`) for position and size snapping, viewport-clamped placement, and persistent layout (`panelLayoutStorage`). |

---

## Chat / API helpers (`src/lib/`)

| Module | Role |
| ------ | ---- |
| **`apiBase.ts`** | **`getApiBaseUrl()`** — backend origin from **`VITE_API_BASE_URL`** (default `http://localhost:8000`). |
| **`postChatStream.ts`** | **`postChatStream(message, conversationId, handlers, options?)`** — **`POST /chat`** with **`Accept: text/event-stream`**, parses SSE (`metadata`, `token`, `thought_delta`, `agent_thought`, `tool_call`, `tool_result`, `done`, `error`). Optional **`options.signal`** for abort. **Does not** send per-message agent overrides; the server uses persisted **`/agent-config`** or env defaults. |
| **`chatHistory.ts`** | **`fetchChatHistory(conversationId)`** — **`GET /chat/messages`**; **`CHAT_CONVERSATION_STORAGE_KEY`** for session-persisted conversation id. |
| **`agentConfig.ts`** | **`fetchAgentConfig`**, **`saveAgentConfigToServer`** for **`GET` / `PUT /agent-config`**; **`AgentConfigPublic`**, **`MODEL_OPTIONS`**, **`DEFAULT_AGENT_CONFIG`**. Request/response fields use API **snake_case** (`base_url`, `api_key_set`, `api_key_masked`). |
| **`answerStreamSplit.ts`** | **`splitAnswerStream(raw)`** — splits assistant output into **`preamble`** (everything before the **last** line-start marker among **`Answer:`**, **`Final answer:`**, **`### Answer`**) and **`answer`** (after that marker). If none match, all text stays in **`preamble`** and **`answer`** is empty (bubble stays empty; draft lives in metadata). |
| **`assistantDisplayText.ts`** | **`assistantBubbleText(raw)`** — takes **`splitAnswerStream(raw).answer`**, then strips ReAct **`Thought:` / `Action:`** noise (including **`Action: None`**, fenced blocks, separators) for the **main assistant bubble** only. Raw **`ChatMessage.text`** is unchanged. |
| **`zoomToSmallestClashObject.ts`** | **`zoomViewerToSmallestClashObject(viewer, applicationIds, options?)`** — walks Speckle **`TreeNode`** data, unions bounding boxes for matching **`applicationId`**s, fits camera via **`CameraController`**. |
| **`clashContextRegion.ts`** | Builds run-analysis context payload: resolves clash object nodes, computes region AABB (+ configurable expand meters), and gathers nearby Speckle objects intersecting the expanded region. Nearby collection now walks world-tree nodes and unions per-node render-view AABBs (more reliable than only scanning currently renderable views). |

---

## Types (`src/types/`)

| Export | Use |
| ------ | --- |
| **`ClashSeverity`** | **`LOW` \| `MEDIUM` \| `CRITICAL`** — aligns with backend inference. |
| **`normalizeClashSeverity`**, **`clashMeetsMinimumSeverity`** | Parsing unknown severities; filter logic (unknown passes only when minimum is **`LOW`**). |
| **`Clash`** | `id`, `label`, **`severity`** (nullable until inferred). |
| **`AgentActivityItem`** | Union: **`thought`**, **`tool_call`**, **`tool_result`** — shapes for **`ChatMessage.activity`**. |
| **`ChatMessage`** | Sidebar message: **`role`**, **`text`**, **`at`**, **`id`**; assistant may set **`streaming`**, **`activity`**, **`thinkingBuffer`** while SSE is processed. |

**`SpeckleUrlRow`** lives in **`appStateContext.ts`** (id + url for list keys).

---

## Styling conventions

- **Semantic primary color**: change **`--app-primary`** / **`--app-primary-hover`** in **`src/index.css`**; Tailwind **`primary`** utilities follow via **`@theme`**.
- **Primary buttons**: prefer **`btn-primary`** (+ **`btn-primary--full`** for full width) instead of one-off teal classes.
- **Floating overlays**: inspector, chat, and selected-object overlays now standardize on the same floating-card language (rounded border, blur, shadow), pointer-event boundaries, and **16px grid** snap for position/size.
- **Layout**: `AppLayout` uses `h-svh`, `min-h-0`, and flex foundations. Inspector overlays are absolute-positioned and grid-snapped; collapsed cards may switch to auto-size while preserving stored expanded size.

---

## Update log — 2026-04-15

- Replaced fixed inspector side/bottom layout with draggable floating cards (`Clash Controls`, `Context`, `Recommendations`) and collapse states.
- Added floating chat launcher/window (`FloatingChat` + `ChatWindow`) with drag-from-header behavior and consistent action color usage (`text-primary`).
- Unified floating grid behavior through `useFloatingPanel` and `PANEL_GRID` (16px), including load-time snapping and edge-safe clamp.
- Added context-object workflow:
  - `Show Context` toggle in Context header
  - context AABB object collection cached per clash (does not clear on toggle off)
  - viewer dual highlighting (clash red + context light blue)
  - clickable context object list in Context panel.
- Updated selected object overlay to floating-card style, drag/resize support, collapse behavior improvements, and scrollable content region.

---

## Related docs

- Root **[README.md](../README.md)** — run `pnpm dev` in `apps/web`, API CORS defaults.
- **[backend-repository-guide.md](./backend-repository-guide.md)** — backend modules, agent, SSE chat, configuration.
- **[apps/api/README.md](../apps/api/README.md)** — quick setup and endpoint cheatsheet.
