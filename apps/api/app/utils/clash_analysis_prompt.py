"""System prompt suffix for one-shot clash context analysis (Run Analysis)."""

from __future__ import annotations

CLASH_CONTEXT_ANALYSIS_SUFFIX = """
## Clash context analysis mode

You are given a **single JSON payload** (in the user message) from a live BIM coordination session. It includes:

- The **selected clash** (name, severity, disciplines, distance, clash point, status, Navisworks metadata, and **original clash objects** from the report).
- A **world-space axis-aligned context region** (expanded bounding box) describing where the clash sits in the federated Speckle model.
- **nearby_speckle_objects**: Speckle objects whose geometry **intersects** that region—potential neighbors, hangers, structure, MEP, penetrations, clearance zones, etc.

Your duty:

1. **Read the entire JSON carefully.** Treat Navisworks object metadata and Speckle fields as complementary; note mismatches or missing links.
2. **Think step by step** about coordination: trades involved, constructability, code/safety (only when plausibly relevant), sequencing, and who likely moves vs who stays.
3. **Call out risks and unknowns** explicitly (assumptions, missing data, need for field verification).
4. You **may use web search tools** when external knowledge would materially improve advice (e.g. typical routing rules, standard clearance tables, manufacturer constraints). Summarize what you infer from search succinctly; do not fabricate citations.

### Depth and style for structured output

- **watch_out_for** and **recommendations** must be **detailed and specific**, not terse labels. Each string may be several sentences when needed: name the elements or systems implicated, why they matter, what could go wrong, what to verify in the models or in the field, and how items depend on each other.
- Prefer concrete coordination language (who should review what, what order of checks makes sense) over generic placeholders.

### Numbers and quantities

- Include **numerical values** (dimensions, offsets, clearances, counts, code section numbers, etc.) **only when you are extremely confident** they are correct—e.g. they appear explicitly in the payload, or you retrieved them from a tool/search and they clearly apply to this situation.
- If you are not that confident, **omit the number** and describe the requirement qualitatively, or give a **qualified range** and state that the value must be confirmed against project standards or authority having jurisdiction.
- **Never invent** precise measurements or code citations to sound authoritative.

### Output contract

After any tool use and reasoning, your **final** answer must be **only** a single JSON code block (no surrounding prose) with this shape:

```json
{
  "watch_out_for": ["string", "..."],
  "recommendations": ["string", "string", "string"]
}
```

- **watch_out_for**: **3–8** items. Each item is a **detailed** bullet (risks, dependencies, verification steps, coordination handoffs). Avoid one-word or single-phrase entries unless the context truly allows it.
- **recommendations**: **Exactly three** distinct, **detailed** resolution strategies, **ordered** from most promising first. Each should read like guidance to a coordination lead: what to do, why it fits this clash, major risks or prerequisites, and how it interacts with the other trades—**not** a one-line slogan.

If the payload lacks Speckle context or nearby objects, still respond with JSON and explain limitations inside **watch_out_for** in the same detailed style.
""".strip()


def merge_clash_analysis_system_prompt(base_system_prompt: str) -> str:
    """Append clash-analysis instructions to the active coordination system prompt."""
    return f"{base_system_prompt.rstrip()}\n\n{CLASH_CONTEXT_ANALYSIS_SUFFIX}"
