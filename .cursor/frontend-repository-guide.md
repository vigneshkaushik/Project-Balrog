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
| 3D          | `@speckle/viewer` (wired via `useSpeckleViewer`), **`three`** for camera/box math in **`zoomToSmallestClashObject.ts`**, **`ModelViewer`**, and **`clashContextRegion.ts`**; **`@types/three`** as a devDependency for **`tsc -b`**. |
| Speckle auth | Optional **`VITE_SPECKLE_TOKEN`** in `.env` — passed into the viewer hook when loading private streams |

---

## Bootstrap and app shell

| File | Role |
| ---- | ---- |
| `index.html` | Vite HTML entry; mounts `#root`. |
| `src/main.tsx` | `createRoot`, `StrictMode`, `BrowserRouter`, wraps tree in **`AppProvider`** (+ **`ToastProvider`**), imports **`index.css`**. |
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
| **`AppLayout`** | Wraps the app in **`FloatingChatProvider`**, **`ClashAnalysisProvider`**, and **`ChatAttachmentsProvider`**, then route content via `<Outlet />` and an absolute full-viewport overlay for **`FloatingNavbar`** and **`FloatingChat`** (pointer-events shell; inspector **`InspectorToolbar`** / cards sit in the page’s own overlay layer). |
| **`FloatingNavbar`** | Top bar with **Balrog** title. On routes **other than** `/inspector`, shows a chat toggle ( **`AiChatIcon`** ) that uses **`useFloatingChat`** — same open state as the inspector toolbar chat button. On `/inspector`, chat is only opened from **`InspectorToolbar`** (no duplicate navbar control). |
| **`FloatingChat`** | Renders **only** the draggable/resizable chat window (grid-snapped via **`useFloatingPanel`**, persisted layout). Open/closed visibility comes from **`FloatingChatContext`**; there is **no** bottom-right FAB. Persisted flag: **`balrog-floating-chat-open`**. |
| **`AiChatIcon`** | Inline chat-bubble SVG with **`fill="currentColor"`** for navbar and inspector toolbar. |
| **`ChatWindow`** | Chat panel body: SSE stream, **`GET`/`PUT /agent-config`**, history restore, **`AgentActivityLog`**. Supports **chat attachments** via **`ChatAttachmentChips`** (draft pill row with remove `×`) and **`ChatAddContextMenu`** (`+` menu for clash / selected object / per-recommendation items). On send, the draft attachments are snapshotted into **`POST /chat`**, cleared from the composer, and **`ChatAttachmentSummary`** (`kind` + `label`) is stored on the **user message** so **`ChatMessageAttachmentChips`** shows the same context on the bubble. **`GET /chat/messages`** returns those summaries for user rows so a **browser refresh** (same API process + session conversation id) rehydrates chips. Header is drag-handle enabled (except interactive controls). **Agent settings** UI is rendered via **`createPortal`** with viewport-aware **`position: fixed`** placement so coordinates stay correct above backdrop-blur / transformed ancestors. |
| **`ChatAttachmentChips`** | Draft-only horizontal chip row above the chat textarea (reads **`ChatAttachmentsContext`**); one chip per item with remove `×`. |
| **`ChatMessageAttachmentChips`** | Read-only chip row for **sent / restored** user messages (same icon + label styling as draft chips, no remove). |
| **`ChatAddContextMenu`** | Footer `+` popover menu listing attachable context with disabled reasons and “already added” states. |
| **`AddToChatButton`** | Shared attach button used in inspector sources (default and compact variants, plus “Added” check state). |
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
| **`ClashInspector`** | Floating-panel workspace: draggable/resizable **`FloatingCard`** panels for Clash Controls, Context, Recommendations. Panels are opened/closed from **`InspectorToolbar`** (a floating vertical icon bar on the left). Each panel's header shows an **`X`** close button (via the local **`ClosePanelButton`**) instead of collapse chevrons. Open/closed state is persisted under **`balrog-inspector-open-panels`** (array of panel ids); panel position/size continues to persist via **`useFloatingPanel`** / **`panelLayoutStorage`**. Gate waits for backend session hydration before redirect/toast. Context panel includes **`Add clash to chat`**, **`Show Context`**, and **`Show Bounding Box`** controls in a dedicated **header toolbar row** (horizontally scrollable, non-draggable). Context objects are computed (AABB-based) once per clash, cached in local UI state, and rendered as a clickable list. Recommendations panel supports per-item attach (`+`) actions and renders recommendation **`validations`** when present. **Run analysis** passes **`objectMetadata`** into **`buildClashContextAnalysisPayload`**, attaches **`user_metadata`** and **`speckle_objects`** (full Speckle payloads per matched clash participant) on **`clash_objects_original`**, and includes `meta.user_object_metadata`; completed results are mirrored into **`ClashAnalysisContext`** keyed by `clashId`. |
| **`InspectorToolbar`** | Floating vertical toolbar: icon-only buttons for **Clash Controls** (sliders), **Context** (info), **Recommendations** (**`AiIdeaIcon`**), then **Chat** (**`AiChatIcon`**). Same button styling for all; `aria-pressed` reflects open state for panels and chat. Chat calls **`useFloatingChat`**. |
| **`AiIdeaIcon`** | Inline lightbulb-style SVG with **`currentColor`** for fill/stroke — used for Recommendations in the toolbar and the Recommendations **`FloatingCard`** title. |
| **`ModelViewer`** | Speckle container: `useSpeckleViewer` with trimmed URLs and optional token. Highlight system supports clash object ids (**red**) plus optional context object ids (**light blue**) while ghosting the rest. Context-object clicks and clash-object clicks both support viewer focus/selection workflows. **`SelectionExtension`** syncs **`selectedObjectData`** on **`ViewerEvent.ObjectClicked`** into **`AppState`**. Hover is tracked on a **wrapper** around the canvas + overlays so moving from the canvas to UI does not drop “viewport hovered.” Projects the selected object’s AABB center (**`unionBoxesForSpeckleObjectIds`**) to screen space (rAF + **`ResizeObserver`**) for **`SelectedObjectMetadataBadge`**. |
| **`SelectedObjectMetadataBadge`** | Viewport “Add note / Edit note” pill + expandable textarea; reads/writes **`objectMetadata`** via **`useApp()`**. Mount/opacity transitions avoid abrupt show/hide when **`visible`** toggles with the Speckle hover affordance. |
| **`SpeckleObjectOverlay`** | Floating, draggable, resizable card for selected Speckle object data. Uses the same floating-card styling language and **`useFloatingPanel`** as other overlays; header can collapse details; body scrolls for long payloads. Reads selected object from **`AppState`** (no prop from `ModelViewer`). **User metadata**: add/edit/delete free-form notes per Speckle **`objectData.id`**, synced with the viewport badge. Includes **Add to chat** in the details area for one-click selected-object attachment. **Help**: Heroicons-style info control beside the section title opens a **`createPortal`** dialog (fixed, **`z-[200]`**) with coordinator-facing copy; enter/leave uses **`metadataHelpVisible`** + delayed unmount; **`pointerleave`** ignores moves between trigger and panel (**`relatedTarget`** checks + **`metadataHelpPanelRef`**) to avoid flicker; scroll/resize updates the anchor box only when coordinates actually change (**`helpBoxNearlyEqual`**). |
| **`ClashSelector`** | Select current clash from **`filteredClashes`**; includes a **No clash selected** option so users can de-select and return viewer materials/filters to original state. |
| **`SeverityFilter`** | Collapsible card: **fixed `p-4`** on the shell so the header does not jump when toggling. Body animates via **CSS grid** `grid-rows-[0fr]` ↔ `grid-rows-[1fr]` (`transition-[grid-template-rows]`, respects **`motion-reduce`**). **`inert`** when collapsed so the range is not focusable. Drives **`severityThreshold`** and **`filteredClashes`**. Includes a **Highlight / Focused** toggle button near the visible-count chip that highlights all clashes at the current severity and ghosts the rest. |
| **`AnalysisPanel`** | Reusable analysis section wrapper with optional inner title and optional Run Analysis footer button (Context now hides both inner title and run button). |

**Static assets** (`public/`): only **`favicon.svg`** is shipped today (linked from **`index.html`**). Chat and recommendation icons live entirely in **`AiChatIcon`** and **`AiIdeaIcon`** as inline SVGs (**`currentColor`**) so they theme with surrounding UI.

---

## Global state (`src/context/`)

| Module | Role |
| ------ | ---- |
| **`appStateContext.ts`** | **`AppState`** type: clashes, Navisworks filename, Speckle rows/URLs, **`severityThreshold`** + **`setSeverityThreshold`**, **`highlightFilteredSeverity`** toggle, selection, derived **`filteredClashes`**, mutators, **`clearSession`**, **`clashObjectViewerFocus`** + **`requestClashObjectViewerFocus`** (Speckle selection/zoom from clash lists), plus **`objectMetadata`** (**`Record<speckleId, string>`**), **`setObjectMetadata`**, **`clearObjectMetadata`**, shared **`selectedObjectData`**, and shared **`speckleViewer`**. |
| **`AppProvider.tsx`** | Implements state: clash upload/session hydration, Speckle row CRUD with stable **`id`**s, derived **`speckleUrls`** string array for viewers/guards. Selecting a clash turns off severity-highlight mode; enabling severity highlight clears selected clash. **Object notes** persist under **`balrog-object-metadata`** in **`localStorage`**; **`clearSession`** wipes them and removes that key. Also stores shared **`selectedObjectData`** and **`speckleViewer`** for cross-feature consumers (chat attachment menu + overlay). |
| **`useApp.ts`** | Hook to consume context (throws if outside provider). |
| **`FloatingChatContext.tsx`** | **`FloatingChatProvider`** + **`useFloatingChat()`**: **`isChatOpen`**, **`setChatOpen`**, **`toggleChat`**. Persists **`balrog-floating-chat-open`** in **`localStorage`**. **`AppLayout`** wraps its contents with this provider so **`FloatingChat`**, **`FloatingNavbar`**, and **`InspectorToolbar`** share one chat visibility state. |
| **`ChatAttachmentsContext.tsx`** | One-turn attachment draft state for chat: `attachments[]`, `addAttachment` (dedupe by stable `id`), `removeAttachment`, `clearAttachments`, `hasAttachment`. Includes id helpers for clash/selected-object/recommendation attachments. |
| **`ClashAnalysisContext.tsx`** | Hoisted run-analysis output keyed by `clashId` (`recommendations`, `watchOutFor`, `notes`) so chat UI can list recommendation attachments independently of inspector internals. |

**Data flow (high level)**

1. User uploads a report → **`setNavisworksReport`** → mock **`clashes`**, filename stored.
2. User adds Speckle rows → **`speckleUrlRows`** / derived **`speckleUrls`**.
3. Inspector reads **`filteredClashes`**, **`selectedClashId`**, **`highlightFilteredSeverity`**, Speckle URLs for the viewer; severity filter narrows the clash list and can toggle severity-wide highlighting.
4. Per-object coordinator notes live in **`objectMetadata`** (Speckle object id → string); they feed the viewer badge + overlay editors and are embedded into **`POST /clashes/analyze-context`** payloads (`nearby_speckle_objects`, `clash_objects_original.user_metadata`, `clash_objects_original.speckle_objects[*].user_metadata`, and `meta.user_object_metadata`) when the user runs analysis.
5. Chat attachment sources (Context panel, Recommendations list, Selected object overlay, chat `+` menu) all write into **`ChatAttachmentsContext`**. On send, `ChatWindow` snapshots attachments into the **`POST /chat`** payload, clears the draft chips, attaches display **`ChatAttachmentSummary`** metadata to the optimistic user message, and streams the assistant reply. History reload maps **`attachments`** from **`GET /chat/messages`** onto user **`ChatMessage`** rows (see **`chatHistory.ts`**).

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
| **`postChatStream.ts`** | **`postChatStream(message, conversationId, handlers, options?)`** — **`POST /chat`** with **`Accept: text/event-stream`**, parses SSE (`metadata`, `token`, `thought_delta`, `agent_thought`, `tool_call`, `tool_result`, `done`, `error`). Supports `options.signal` + `options.attachments`. Includes request-size guard via **`CHAT_MAX_BODY_BYTES`** and **`ChatPayloadTooLargeError`** before fetch. |
| **`chatAttachments.ts`** | Frontend wire schema + converters for chat attachments (`toChatAttachmentWire`, `toChatAttachmentsWire`), including client-side `object_data` trimming (`HIDDEN_OBJECT_DATA_KEYS`). |
| **`buildChatAttachments.ts`** | Builders for `clash`, `selected_object`, and `recommendation` attachment objects with stable IDs and user-facing labels. |
| **`chatHistory.ts`** | **`fetchChatHistory(conversationId)`** — **`GET /chat/messages`** (user rows may include **`attachments`**: `[{ kind, label }]`); **`CHAT_CONVERSATION_STORAGE_KEY`** for session-persisted conversation id. |
| **`clashAnalysisFormat.ts`** | Normalizes run-analysis **`recommendations`** / **`watch_out_for`** into parsed objects for **`ClashInspector`** cards. Supports both legacy string items (JSON / Python `repr(dict)` parsing) and typed object arrays from the structured backend response. |
| **`agentConfig.ts`** | **`fetchAgentConfig`**, **`saveAgentConfigToServer`** for **`GET` / `PUT /agent-config`**; **`AgentConfigPublic`**, **`MODEL_OPTIONS`**, **`DEFAULT_AGENT_CONFIG`**. Request/response fields use API **snake_case** (`base_url`, `api_key_set`, `api_key_masked`). |
| **`answerStreamSplit.ts`** | **`splitAnswerStream(raw)`** — splits assistant output into **`preamble`** (everything before the **last** line-start marker among **`Answer:`**, **`Final answer:`**, **`### Answer`**) and **`answer`** (after that marker). If none match, all text stays in **`preamble`** and **`answer`** is empty (bubble stays empty; draft lives in metadata). |
| **`assistantDisplayText.ts`** | **`assistantBubbleText(raw)`** — takes **`splitAnswerStream(raw).answer`**, then strips ReAct **`Thought:` / `Action:`** noise (including **`Action: None`**, fenced blocks, separators) for the **main assistant bubble** only. Raw **`ChatMessage.text`** is unchanged. |
| **`zoomToSmallestClashObject.ts`** | **`zoomViewerToSmallestClashObject(viewer, applicationIds, options?)`** — walks Speckle **`TreeNode`** data, unions bounding boxes for matching **`applicationId`**s, fits camera via **`CameraController`**. |
| **`clashContextRegion.ts`** | Builds run-analysis context payload: resolves clash object nodes, computes region AABB (+ configurable expand meters), and gathers nearby Speckle objects intersecting the expanded region. Nearby collection walks world-tree nodes and unions per-node render-view AABBs. **`buildClashContextAnalysisPayload(viewer, clash, options?)`** accepts optional **`objectMetadata`**: merges **`user_metadata`** onto each **`nearby_speckle_objects`** row when present, and appends up to **25** annotated objects outside the region (**`outside_context_region: true`**) via **`worldTree.findId`**. Exposes **`fullSpeckleObjectPayloadForId`** for attaching rich Speckle properties onto clash participants. |
| **`postClashAnalysis.ts`** | **`postClashAnalyzeContext`** — request includes richer **`clash_objects_original`** rows (`user_metadata`, optional `speckle_objects`) and `meta.user_object_metadata`. Response contract is structured: `engineering_scratchpad`, `clash_summary`, typed `recommendations[]` (with optional `validations[]`), typed `watch_out_for[]`, plus `notes`. Payload size guard (**`MAX_BODY_BYTES`**) unchanged. |

---

## Types (`src/types/`)

| Export | Use |
| ------ | --- |
| **`ClashSeverity`** | **`LOW` \| `MEDIUM` \| `CRITICAL`** — aligns with backend inference. |
| **`normalizeClashSeverity`**, **`clashMatchesSeverityExactly`** | Parsing unknown severities; severity filter uses exact match against **`severityThreshold`**. |
| **`Clash`** | `id`, `label`, **`severity`** (nullable until inferred). |
| **`AgentActivityItem`** | Union: **`thought`**, **`tool_call`**, **`tool_result`** — shapes for **`ChatMessage.activity`**. |
| **`ChatMessage`** | Sidebar message: **`role`**, **`text`**, **`at`**, **`id`**; assistant may set **`streaming`**, **`activity`**, **`thinkingBuffer`** while SSE is processed. User messages may set optional **`attachments`**: **`ChatAttachmentSummary[]`** (`kind` + `label`) for chip display. |
| **`ChatAttachmentSummary`**, **`ChatAttachmentSummaryKind`** | Compact chip metadata for user messages; aligns with **`GET /chat/messages`** user **`attachments`** and optimistic send state. |

**`SpeckleUrlRow`** lives in **`appStateContext.ts`** (id + url for list keys).

---

## Styling conventions

- **Semantic primary color**: change **`--app-primary`** / **`--app-primary-hover`** in **`src/index.css`**; Tailwind **`primary`** utilities follow via **`@theme`**.
- **Primary buttons**: prefer **`btn-primary`** (+ **`btn-primary--full`** for full width) instead of one-off teal classes.
- **Floating overlays**: inspector, chat, and selected-object overlays now standardize on the same floating-card language (rounded border, blur, shadow), pointer-event boundaries, and **16px grid** snap for position/size.
- **FloatingCard headers**: use top-row title + optional `headerActions`; overflow-prone control groups belong in `headerToolbar` (second row, horizontal scroll). Toolbar row is intentionally non-draggable and supports wheel-to-horizontal scroll.
- **Layout**: `AppLayout` uses `h-svh`, `min-h-0`, and flex foundations. Inspector **`FloatingCard`** overlays are absolute-positioned and grid-snapped; closing a panel unmounts it while **`panelLayoutStorage`** keeps last position/size for the next open.

---

## Related docs

- Root **[README.md](../README.md)** — run `pnpm dev` in `apps/web`, API CORS defaults.
- **[backend-repository-guide.md](./backend-repository-guide.md)** — backend modules, agent, SSE chat, configuration (clash **`analyze-context`** prompt documents **`user_metadata`** / **`outside_context_region`** in **`apps/api/app/utils/clash_analysis_prompt.py`**).
- **[apps/api/README.md](../apps/api/README.md)** — quick setup and endpoint cheatsheet.
