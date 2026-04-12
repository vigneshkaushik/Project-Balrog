import { getApiBaseUrl } from './apiBase'

export type AgentProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'custom'
  | 'ollama'

/** Public shape from GET /agent-config (no raw secrets). */
export interface AgentConfigPublic {
  provider: AgentProvider
  model: string
  base_url: string | null
  api_key_set: boolean
  api_key_masked: string | null
}

export const DEFAULT_AGENT_CONFIG: AgentConfigPublic = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  base_url: null,
  api_key_set: false,
  api_key_masked: null,
}

export const MODEL_OPTIONS: Record<
  Exclude<AgentProvider, 'custom' | 'ollama'>,
  string[]
> = {
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
  ],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'],
  google: [
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-2.0-flash-thinking-exp-01-21',
  ],
}

function isAgentProvider(v: string): v is AgentProvider {
  return (
    v === 'anthropic' ||
    v === 'openai' ||
    v === 'google' ||
    v === 'custom' ||
    v === 'ollama'
  )
}

function normalizePublic(raw: unknown): AgentConfigPublic {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_AGENT_CONFIG }
  const o = raw as Record<string, unknown>
  const provider =
    typeof o.provider === 'string' && isAgentProvider(o.provider)
      ? o.provider
      : DEFAULT_AGENT_CONFIG.provider
  const model =
    typeof o.model === 'string' && o.model.trim()
      ? o.model.trim()
      : DEFAULT_AGENT_CONFIG.model
  const base_url =
    typeof o.base_url === 'string' && o.base_url.trim()
      ? o.base_url
      : null
  const api_key_set = Boolean(o.api_key_set)
  const api_key_masked =
    typeof o.api_key_masked === 'string' && o.api_key_masked.length > 0
      ? o.api_key_masked
      : null
  if (provider !== 'custom' && provider !== 'ollama') {
    const opts = MODEL_OPTIONS[provider]
    if (!opts.includes(model)) {
      return {
        provider,
        model: opts[0],
        base_url: null,
        api_key_set,
        api_key_masked,
      }
    }
  }
  return {
    provider,
    model,
    base_url:
      provider === 'custom' || provider === 'ollama' ? base_url : null,
    api_key_set,
    api_key_masked,
  }
}

export async function fetchAgentConfig(): Promise<AgentConfigPublic> {
  const res = await fetch(`${getApiBaseUrl()}/agent-config`)
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(t || `${res.status} ${res.statusText}`)
  }
  const data: unknown = await res.json()
  return normalizePublic(data)
}

export async function saveAgentConfigToServer(payload: {
  provider: AgentProvider
  model: string
  base_url?: string | null
  /** Omit or empty to keep existing stored key. */
  api_key?: string | undefined
}): Promise<AgentConfigPublic> {
  const body: Record<string, string> = {
    provider: payload.provider,
    model: payload.model,
  }
  if (payload.provider === 'custom') {
    body.base_url = payload.base_url?.trim() ?? ''
  }
  if (payload.provider === 'ollama') {
    body.base_url = payload.base_url?.trim() ?? ''
  }
  if (payload.api_key != null && payload.api_key !== '') {
    body.api_key = payload.api_key
  }
  const res = await fetch(`${getApiBaseUrl()}/agent-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = await res.text().catch(() => '')
    try {
      const j = JSON.parse(detail) as { detail?: unknown }
      if (typeof j.detail === 'string') detail = j.detail
      else if (Array.isArray(j.detail))
        detail = j.detail.map((e) => JSON.stringify(e)).join('; ')
    } catch {
      /* use raw */
    }
    throw new Error(detail || `${res.status} ${res.statusText}`)
  }
  const data: unknown = await res.json()
  return normalizePublic(data)
}
