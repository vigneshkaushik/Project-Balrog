import { getApiBaseUrl } from './apiBase'

export interface UploadClashHandlers {
  onParsed: (payload: Record<string, unknown>) => void
  onBatchResult: (data: {
    results: Record<string, unknown>[]
    completed: number
    total: number
  }) => void
  onDone: () => void
  onError: (detail: string) => void
}

/** Same shape as chat SSE: split on blank line between events (see `postChatStream`). */
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
 * Upload a clash report XML file via POST and consume the SSE response stream.
 * The backend emits: parsed → batch_result (×N) → done.
 */
export async function uploadClashReport(
  file: File,
  handlers: UploadClashHandlers,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const signal = options?.signal
  const formData = new FormData()
  formData.append('file', file)

  let response: Response
  try {
    response = await fetch(`${getApiBaseUrl()}/clashes/upload`, {
      method: 'POST',
      body: formData,
      headers: { Accept: 'text/event-stream' },
      signal,
    })
  } catch (e) {
    if (
      signal?.aborted ||
      (e instanceof DOMException && e.name === 'AbortError')
    ) {
      return
    }
    throw e instanceof Error ? e : new Error('Network error')
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Upload failed (${response.status}): ${text}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  const dispatch = (block: string) => {
    const parsed = parseSseBlock(block)
    if (!parsed) return
    let payload: unknown
    try {
      payload = JSON.parse(parsed.data)
    } catch {
      console.error('Failed to parse SSE JSON for event', parsed.event)
      return
    }
    const { event } = parsed
    if (event === 'parsed' && payload && typeof payload === 'object') {
      handlers.onParsed(payload as Record<string, unknown>)
      return
    }
    if (event === 'batch_result' && payload && typeof payload === 'object') {
      const p = payload as {
        results?: Record<string, unknown>[]
        completed?: number
        total?: number
      }
      if (Array.isArray(p.results)) {
        handlers.onBatchResult({
          results: p.results,
          completed: Number(p.completed),
          total: Number(p.total),
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
        throw e instanceof Error ? e : new Error('Stream read failed')
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
