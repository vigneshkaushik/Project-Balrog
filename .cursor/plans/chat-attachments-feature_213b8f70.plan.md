---
name: chat-attachments-feature
overview: Add Cursor/Gemini-style chat attachments so users can include recommendations, the current clash (with its computed context), and the selected Speckle object (with metadata) alongside their next chat message, then extend `POST /chat` to carry that structured context to the agent.
todos:
  - id: context-attachments
    content: Add ChatAttachmentsContext (types, provider, hook) and mount it in AppLayout beside FloatingChatProvider.
    status: completed
  - id: lift-selected-object
    content: Lift selectedObjectData / setSelectedObjectData into AppState (appStateContext + AppProvider), update ModelViewer and SpeckleObjectOverlay to read from context.
    status: completed
  - id: hoist-analysis
    content: Hoist clash analysis results (recommendations, watch_out_for, notes) out of ClashInspector into a small context keyed by clashId so the chat '+' menu can list them.
    status: completed
  - id: chip-row
    content: "Build ChatAttachmentChips row above the textarea in ChatWindow: per-kind icons, truncated labels, remove (×) button."
    status: completed
  - id: plus-menu
    content: Build ChatAddContextMenu (popover) in ChatWindow footer listing current clash, selected object, and each recommendation with enabled/disabled states and reasons.
    status: completed
  - id: source-buttons
    content: "Add 'Add to chat' buttons: in SpeckleObjectOverlay header, in Context panel header (clash), and per-item next to each recommendation in ClashInspector."
    status: completed
  - id: payload-client
    content: Extend postChatStream to accept attachments; trim selected object data via HIDDEN_KEYS; enforce MAX_BODY_BYTES; send JSON shape defined in plan.
    status: completed
  - id: payload-server
    content: Extend ChatRequest in apps/api/app/routes/chat.py with a discriminated attachments union; build a deterministic <attached_context> preamble prepended to user_msg.
    status: completed
  - id: clear-on-send
    content: Clear attachments after a successful send in ChatWindow; keep them on abort/error.
    status: completed
isProject: false
---

## Chat attachments — recommendations, clash + context, selected object

### UX (Cursor/Gemini-style)

- **Chip row** above the chat input in `ChatWindow`: one pill per attached item (icon + short label + `×` remove). Row is collapsible / horizontal-scroll when many. A `+` button sits inline with existing upload/send icons.
- `+` menu (popover over the chat footer) lists currently-available items; disabled rows show why (e.g. "No clash selected", "No recommendations yet"):
  - **Current clash** (`selected.label`) + its computed context objects and `context_region`.
  - **Selected object** (viewer title from `SpeckleObjectOverlay.getObjectTitle`) + its user metadata note.
  - **Recommendation #N** — one row per string in `analysisRecommendations` for the selected clash.
- **Per-source "Add to chat" buttons**:
  - `SpeckleObjectOverlay` header (next to the help icon): "Add to chat".
  - Recommendations panel: a small `+` icon beside each `<li>` in the ordered list in [ClashInspector.tsx](apps/web/src/components/inspector/ClashInspector.tsx) (around the `analysisRecommendations.map` block near line 831).
  - Context panel (clash + context bundle): a single "Add clash to chat" button in the `FloatingCard` header actions next to the existing "Show Context" button.
- **Removal**: `×` on each chip.
- **Lifecycle**: attachments are scoped to the next message — **cleared on successful send** (Cursor behavior). Aborting keeps them.
- **Styling**: reuse `rounded-lg border border-neutral-200 bg-neutral-50` (same look as existing chat input shell) with an icon per kind (clash = existing `AiIdeaIcon`-style lightbulb off, selected object = a cube/target glyph, recommendation = `AiIdeaIcon`).

### State: new `ChatAttachmentsContext`

Add `src/context/ChatAttachmentsContext.tsx`, provided at the same level as `FloatingChatProvider` in [AppLayout.tsx](apps/web/src/components/layout/AppLayout.tsx) so `ChatWindow`, inspector panels, and `SpeckleObjectOverlay` can all reach it.

```ts
export type ChatAttachment =
  | { kind: 'clash'; id: string; label: string; clash: Clash;
      clashContext: { context_region: ContextRegionPayload | null;
                      nearby_speckle_objects: NearbySpeckleObjectPayload[];
                      clash_objects_original: ClashObjectWithUserMetadata[] } }
  | { kind: 'selected_object'; id: string; label: string;
      objectData: Record<string, unknown>; userMetadata: string | null }
  | { kind: 'recommendation'; id: string; label: string;
      text: string; clashId: string; clashLabel: string }

interface ChatAttachmentsContextValue {
  attachments: ChatAttachment[]
  addAttachment(a: ChatAttachment): void   // dedupe by id
  removeAttachment(id: string): void
  clearAttachments(): void
}
```

Dedupe rule: `id` = `${kind}:${stableKey}` (e.g. `clash:<clashId>`, `selected_object:<speckleId>`, `recommendation:<clashId>:<hash(text)>`).

### Lifting `selectedObjectData` into `AppProvider`

Currently local to [ModelViewer.tsx](apps/web/src/components/inspector/ModelViewer.tsx) (line 104). Move the state onto `AppState` in [appStateContext.ts](apps/web/src/context/appStateContext.ts) as `selectedObjectData: Record<string, unknown> | null` + `setSelectedObjectData`. `ModelViewer` continues to drive it from the viewer's `SelectionExtension`, and `SpeckleObjectOverlay` now reads it from context instead of a prop. This unblocks the `+` menu and the overlay's "Add to chat" button.

### Exposing analysis results to the `+` menu

Analysis state (`analysisRecommendations`, `analysisWatchOut`, `analysisNotes`) lives in [ClashInspector.tsx](apps/web/src/components/inspector/ClashInspector.tsx). Hoist it into a small `ClashAnalysisContext` (or onto `AppState`) keyed by `clashId` so the chat `+` menu can enumerate per-recommendation rows for the currently selected clash without the chat having to traverse inspector internals.

### Chat payload: extend `POST /chat`

Update [postChatStream.ts](apps/web/src/lib/postChatStream.ts) and [chat.py](apps/api/app/routes/chat.py) with a single additive field:

```jsonc
{
  "message": "…",
  "conversation_id": "…",
  "attachments": [
    {
      "kind": "clash",
      "label": "Clash: Duct vs Beam (Level 3)",
      "clash": { /* existing Clash shape */ },
      "clash_context": {
        "context_region": { "min": {...}, "max": {...} } | null,
        "nearby_speckle_objects": [...],        // NearbySpeckleObjectPayload[]
        "clash_objects_original": [...]         // ClashObjectWithUserMetadata[]
      }
    },
    {
      "kind": "selected_object",
      "label": "Selected: Pipe-250mm",
      "speckle_id": "…",
      "object_data": { /* trimmed Record<string, unknown> */ },
      "user_metadata": "…" | null
    },
    {
      "kind": "recommendation",
      "label": "Recommendation #2 for 'Duct vs Beam'",
      "text": "…",
      "clash_id": "…",
      "clash_label": "…"
    }
  ]
}
```

Why this shape:

- **One list, discriminated by `kind`** keeps the wire format extensible without another round of renames when we later add drawings, RFIs, etc.
- **`label` on every attachment** lets the backend build a readable preamble without re-deriving it from nested fields.
- **Clash + its context are one attachment**, not two, because they're always meaningful together and the frontend already computes them as one via `buildClashContextAnalysisPayload` ([clashContextRegion.ts](apps/web/src/lib/clashContextRegion.ts)).
- **`object_data` is trimmed** on the client (reuse the `HIDDEN_KEYS` set from [SpeckleObjectOverlay.tsx](apps/web/src/components/inspector/SpeckleObjectOverlay.tsx)) so the payload stays small.
- **Size guard**: same `MAX_BODY_BYTES` approach as [postClashAnalysis.ts](apps/web/src/lib/postClashAnalysis.ts) — throw before fetch with a toast-friendly error.

### Backend handling

In [chat.py](apps/api/app/routes/chat.py):

1. Extend `ChatRequest` with `attachments: list[ChatAttachment] | None`. Define one Pydantic union per `kind` mirroring the JSON above; use `Field(discriminator="kind")`.
2. Build a deterministic preamble inside `_chat_sse_events` and send it as part of `user_msg` so memory captures it:

```
<attached_context>
[Clash] Duct vs Beam (Level 3)
  severity=CRITICAL, disciplines=…, objects=[…]
  context_region=…  nearby=12 objects
[Selected object] Pipe-250mm (id=abcd…)  user_metadata="Hold — waiting on RFI-221"
[Recommendation #2 for 'Duct vs Beam'] Re-route duct above beam flange …
</attached_context>

<user_message>
…original text…
</user_message>
```

Keep the raw JSON attached under each block (fenced JSON) so the agent can inspect structured fields when useful. No changes needed to tools or the ReAct loop.

3. No change to SSE events or `GET /chat/messages` — attachments are one-shot and already embedded in the persisted user message text.

### Data flow diagram

```mermaid
flowchart LR
    SPK["SpeckleObjectOverlay<br/>Add to chat"] --> CAC[ChatAttachmentsContext]
    REC["Recommendations list<br/>per-item + button"] --> CAC
    CTX["Context panel<br/>Add clash to chat"] --> CAC
    PLUS["ChatWindow '+' menu"] --> CAC
    CAC --> CHIPS["Chips row in ChatWindow"]
    CHIPS -->|send| POST["postChatStream"]
    POST -->|attachments JSON| API["POST /chat"]
    API --> PRE["Backend builds<br/>context preamble"]
    PRE --> AGENT["ReAct agent"]
    POST -->|onDone| CLR["clearAttachments()"]
```

### Files touched

- **New**: `apps/web/src/context/ChatAttachmentsContext.tsx`, `apps/web/src/components/layout/ChatAttachmentChips.tsx`, `apps/web/src/components/layout/ChatAddContextMenu.tsx`, optional `apps/web/src/context/ClashAnalysisContext.tsx`.
- **Modified**: [appStateContext.ts](apps/web/src/context/appStateContext.ts) + [AppProvider.tsx](apps/web/src/context/AppProvider.tsx) (lift `selectedObjectData`), [ModelViewer.tsx](apps/web/src/components/inspector/ModelViewer.tsx) (use context), [SpeckleObjectOverlay.tsx](apps/web/src/components/inspector/SpeckleObjectOverlay.tsx) (remove prop, add "Add to chat" button), [ClashInspector.tsx](apps/web/src/components/inspector/ClashInspector.tsx) (hoist analysis state + add buttons in Context and Recommendations panels), [ChatWindow.tsx](apps/web/src/components/layout/ChatWindow.tsx) (chips + `+` menu + clear on success), [AppLayout.tsx](apps/web/src/components/layout/AppLayout.tsx) (mount provider), [postChatStream.ts](apps/web/src/lib/postChatStream.ts) (accept attachments), [chat.py](apps/api/app/routes/chat.py) (schema + preamble).

### Out of scope

- Persisting attachments across process restart (chat memory is already in-memory only).
- Re-rendering old attachments in historical assistant turns retrieved via `GET /chat/messages`.
- New attachment kinds beyond the three requested (drawings, RFIs, etc.) — the discriminated union is structured to support them later.