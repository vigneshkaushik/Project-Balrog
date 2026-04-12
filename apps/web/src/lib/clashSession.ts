import { getApiBaseUrl } from './apiBase'
import type {
  ClashInferenceResult,
  ParsedClashReportPayload,
} from '../types'

export interface ClashSessionSnapshot {
  has_session: boolean
  navisworks_file_name: string | null
  speckle_urls: string[]
  parsed: ParsedClashReportPayload | null
  inference_by_clash_guid: Record<string, ClashInferenceResult>
  inference_complete: boolean
}

export async function fetchClashSession(): Promise<ClashSessionSnapshot> {
  const res = await fetch(`${getApiBaseUrl()}/clashes/session`)
  if (!res.ok) {
    throw new Error(`Session fetch failed (${res.status})`)
  }
  return res.json() as Promise<ClashSessionSnapshot>
}

export async function saveClashSessionSpeckleUrls(
  speckleUrls: string[],
): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/clashes/session`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speckle_urls: speckleUrls }),
  })
  if (!res.ok) {
    throw new Error(`Speckle session save failed (${res.status})`)
  }
}

export async function deleteClashSession(): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/clashes/session`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    throw new Error(`Session delete failed (${res.status})`)
  }
}
