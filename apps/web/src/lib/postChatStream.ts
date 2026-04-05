import { getApiBaseUrl } from './apiBase'

export interface ChatStreamHandlers {
  onMetadata: (conversationId: string) => void
  onToken: (content: string) => void
  /** Model extended-thinking deltas (when supported). */
  onThoughtDelta?: (delta: string) => void
  /** Parsed ReAct ``Thought:`` block after an LLM step. */
  onAgentThought?: (text: string) => void
  onToolCall?: (payload: {
    tool_name: string
    tool_id: string
    tool_kwargs: Record<string, unknown>
  }) => void
  onToolResult?: (payload: {
    tool_name: string
    tool_id: string
    content: string
    is_error: boolean
  }) => void
  onDone: () => void
  onError: (detail: string) => void
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split('\n').filter((l) => l.length > 0)
  let event = ''
  const dataLines: string[] = []
  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }
  if (dataLines.length === 0) return null
  return { event: event || 'message', data: dataLines.join('\n') }
}

/**
 * POST /chat and consume Server-Sent Events from the Balrog API
 * (`metadata`, `token`, `thought_delta`, `agent_thought`, `tool_call`,
 * `tool_result`, `done`, `error`).
 */
export async function postChatStream(
  message: string,
  conversationId: string | null,
  handlers: ChatStreamHandlers,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const signal = options?.signal
  const base = getApiBaseUrl()
  const body: { message: string; conversation_id?: string } = { message }
  if (conversationId) {
    body.conversation_id = conversationId
  }

  let res: Response
  try {
    res = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if (
      signal?.aborted ||
      (e instanceof DOMException && e.name === 'AbortError')
    ) {
      return
    }
    const msg = e instanceof Error ? e.message : 'Network error'
    handlers.onError(msg)
    return
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    handlers.onError(text || `${res.status} ${res.statusText}`)
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    handlers.onError('Empty response body')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  const dispatch = (block: string) => {
    const parsed = parseSseBlock(block)
    if (!parsed) return
    let payload: unknown
    try {
      payload = JSON.parse(parsed.data)
    } catch {
      return
    }
    const { event } = parsed
    if (event === 'metadata' && payload && typeof payload === 'object') {
      const id = (payload as { conversation_id?: string }).conversation_id
      if (typeof id === 'string' && id.length > 0) {
        handlers.onMetadata(id)
      }
      return
    }
    if (event === 'token' && payload && typeof payload === 'object') {
      const content = (payload as { content?: string }).content
      if (typeof content === 'string' && content.length > 0) {
        handlers.onToken(content)
      }
      return
    }
    if (event === 'thought_delta' && payload && typeof payload === 'object') {
      const delta = (payload as { delta?: string }).delta
      if (typeof delta === 'string' && delta.length > 0) {
        handlers.onThoughtDelta?.(delta)
      }
      return
    }
    if (event === 'agent_thought' && payload && typeof payload === 'object') {
      const text = (payload as { text?: string }).text
      if (typeof text === 'string' && text.length > 0) {
        handlers.onAgentThought?.(text)
      }
      return
    }
    if (event === 'tool_call' && payload && typeof payload === 'object') {
      const p = payload as {
        tool_name?: string
        tool_id?: string
        tool_kwargs?: Record<string, unknown>
      }
      if (
        typeof p.tool_name === 'string' &&
        typeof p.tool_id === 'string' &&
        p.tool_kwargs &&
        typeof p.tool_kwargs === 'object'
      ) {
        handlers.onToolCall?.({
          tool_name: p.tool_name,
          tool_id: p.tool_id,
          tool_kwargs: p.tool_kwargs,
        })
      }
      return
    }
    if (event === 'tool_result' && payload && typeof payload === 'object') {
      const p = payload as {
        tool_name?: string
        tool_id?: string
        content?: string
        is_error?: boolean
      }
      if (
        typeof p.tool_name === 'string' &&
        typeof p.tool_id === 'string' &&
        typeof p.content === 'string'
      ) {
        handlers.onToolResult?.({
          tool_name: p.tool_name,
          tool_id: p.tool_id,
          content: p.content,
          is_error: Boolean(p.is_error),
        })
      }
      return
    }
    if (event === 'done') {
      handlers.onDone()
      return
    }
    if (event === 'error' && payload && typeof payload === 'object') {
      const detail = (payload as { detail?: string }).detail
      handlers.onError(typeof detail === 'string' ? detail : 'Unknown error')
    }
  }

  try {
    while (true) {
      let readResult: ReadableStreamReadResult<Uint8Array>
      try {
        readResult = await reader.read()
      } catch (e) {
        if (
          signal?.aborted ||
          (e instanceof DOMException && e.name === 'AbortError')
        ) {
          return
        }
        handlers.onError(
          e instanceof Error ? e.message : 'Stream read failed',
        )
        return
      }
      const { done, value } = readResult
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      buffer = buffer.replace(/\r\n/g, '\n')
      while (true) {
        const sep = buffer.indexOf('\n\n')
        if (sep === -1) break
        const block = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        dispatch(block)
      }
    }
    if (buffer.trim()) {
      dispatch(buffer.replace(/\r\n/g, '\n'))
    }
  } finally {
    reader.releaseLock()
  }
}
