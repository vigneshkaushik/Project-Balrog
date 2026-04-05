/** Backend origin (no trailing slash). Override with `VITE_API_BASE_URL`. */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
  return raw.replace(/\/$/, '')
}
