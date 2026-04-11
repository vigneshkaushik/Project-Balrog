/** Matches LLM clash inference output (`clash_inference.py` output schema). */
export type ClashSeverity = 'LOW' | 'MEDIUM' | 'CRITICAL'

const SEVERITY_RANK: Record<ClashSeverity, number> = {
  LOW: 0,
  MEDIUM: 1,
  CRITICAL: 2,
}

export function normalizeClashSeverity(
  value: unknown,
): ClashSeverity | null {
  if (typeof value !== 'string') return null
  const u = value.trim().toUpperCase()
  if (u === 'LOW' || u === 'MEDIUM' || u === 'CRITICAL') return u
  return null
}

/** Unknown / missing severity only passes when minimum is LOW. */
export function clashMeetsMinimumSeverity(
  severity: ClashSeverity | null | undefined,
  minimum: ClashSeverity,
): boolean {
  if (severity == null) return minimum === 'LOW'
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[minimum]
}

export interface ClashObject {
  revitGlobalId: string | null
  elementId: string | null
  itemName: string | null
  itemType: string | null
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
