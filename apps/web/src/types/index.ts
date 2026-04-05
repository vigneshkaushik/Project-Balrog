export interface Clash {
  id: string
  label: string
  severity: number
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
