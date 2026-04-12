/** Matches LLM clash inference output (`clash_inference.py` output schema). */
export type ClashSeverity = 'LOW' | 'MEDIUM' | 'CRITICAL'

export function normalizeClashSeverity(
  value: unknown,
): ClashSeverity | null {
  if (typeof value !== 'string') return null
  const u = value.trim().toUpperCase()
  if (u === 'LOW' || u === 'MEDIUM' || u === 'CRITICAL') return u
  return null
}

/** True only when inferred severity equals the selected level (null/unknown never matches). */
export function clashMatchesSeverityExactly(
  severity: ClashSeverity | null | undefined,
  level: ClashSeverity,
): boolean {
  return severity != null && severity === level
}

export interface ClashObject {
  revitGlobalId: string | null
  elementId: string | null
  itemName: string | null
  itemType: string | null
  /** Navisworks layer from clash XML, when present */
  layer?: string | null
  rawAttributes?: Record<string, string | null>
  rawSmartTags?: Record<string, string | null>
}

export interface Clash {
  id: string
  label: string
  /** From inference; null if not yet assigned. */
  severity: ClashSeverity | null
  disciplines?: string[]
  lead?: string[]
  testName?: string
  description?: string | null
  status?: string | null
  distance?: number | null
  clashPoint?: { x: number | null; y: number | null; z: number | null } | null
  objects?: ClashObject[]
}

// --- `POST /clashes/upload` SSE payloads (`clash_parser.py` + `clash_inference.py`) ---

/** Root JSON from `parse_clash_xml` (SSE `parsed` event). */
export interface ParsedClashReportPayload {
  sourceFile: string
  sourcePath: string
  units: string | null
  tests: ParsedClashTest[]
}

export interface ParsedClashTestSummary {
  total: number | null
  new: number | null
  active: number | null
  reviewed: number | null
  approved: number | null
  resolved: number | null
}

export interface ParsedClashTest {
  testName: string | null
  testType: string | null
  testStatus: string | null
  tolerance: string | null
  summary: ParsedClashTestSummary
  clashes: ParsedClashResult[]
}

export interface ParsedClashResultMetadata {
  status: string | null
  description: string | null
  resultStatus: string | null
  distance: number | null
  href: string | null
  gridLocation: string | null
  createdAt: string | null
  clashPoint: { x: number | null; y: number | null; z: number | null } | null
}

export interface ParsedClashObjectPayload {
  revitGlobalId: string | null
  elementId: string | null
  clashMetadata: {
    layer: string | null
    itemName: string | null
    itemType: string | null
  }
  rawAttributes: Record<string, string | null>
  rawSmartTags: Record<string, string | null>
}

/** One clash row from XML (`parse_clash_result`). */
export interface ParsedClashResult {
  clashName: string | null
  clashGuid: string | null
  clashMetadata: ParsedClashResultMetadata
  objects: ParsedClashObjectPayload[]
}

/**
 * One object in the JSON array returned by `infer_single_batch`
 * (see `DEFAULT_CLASH_SEVERITY_PREPROMPT` in `clash_inference.py`).
 * Optional fields tolerate imperfect model JSON.
 */
export interface ClashInferenceResult {
  clash: string
  severity?: string
  disciplines?: string[]
  lead?: string[]
}

/** SSE `batch_result` event body (`clashes.upload_clash_report`). */
export interface ClashInferenceBatchPayload {
  results: ClashInferenceResult[]
  completed: number
  total: number
}

/** SSE `error` event body for clash upload. */
export interface ClashUploadErrorPayload {
  detail: string
}

/** Structured agent trace (ReAct reasoning, tools) streamed from the API */
export type AgentActivityItem =
  | { type: 'thought'; text: string }
  | {
      type: 'tool_call'
      toolName: string
      toolId: string
      args: Record<string, unknown>
    }
  | {
      type: 'tool_result'
      toolName: string
      toolId: string
      content: string
      isError: boolean
    }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: number
  /** Set while the assistant reply is streaming from the API */
  streaming?: boolean
  /** Agent reasoning / tool steps (from SSE `agent_thought`, `tool_call`, `tool_result`) */
  activity?: AgentActivityItem[]
  /** Extended-thinking deltas (SSE `thought_delta`) */
  thinkingBuffer?: string
}
