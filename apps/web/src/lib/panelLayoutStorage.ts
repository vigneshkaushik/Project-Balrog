export interface PanelPosition {
  x: number
  y: number
}

export interface PanelSize {
  width: number
  height: number
}

export interface PanelLayoutEntry extends PanelPosition {
  width?: number
  height?: number
}

export type PanelLayoutState = Record<string, PanelLayoutEntry>

const STORAGE_KEY = 'balrog-panel-layout'

function isValidEntry(value: unknown): value is PanelLayoutEntry {
  if (typeof value !== 'object' || value === null) return false
  const rec = value as Record<string, unknown>
  const hasXY = Number.isFinite(rec.x) && Number.isFinite(rec.y)
  if (!hasXY) return false
  const widthOk = rec.width == null || Number.isFinite(rec.width)
  const heightOk = rec.height == null || Number.isFinite(rec.height)
  return widthOk && heightOk
}

export function readPanelLayout(): PanelLayoutState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    const result: PanelLayoutState = {}
    for (const [panelId, entry] of Object.entries(parsed)) {
      if (!isValidEntry(entry)) continue
      result[panelId] = {
        x: entry.x,
        y: entry.y,
        width: entry.width,
        height: entry.height,
      }
    }
    return result
  } catch {
    return {}
  }
}

export function readPanelPosition(panelId: string): PanelPosition | null {
  const fullLayout = readPanelLayout()
  const entry = fullLayout[panelId]
  if (!entry) return null
  return { x: entry.x, y: entry.y }
}

export function savePanelPosition(panelId: string, position: PanelPosition): void {
  savePanelLayoutEntry(panelId, position)
}

export function readPanelSize(panelId: string): PanelSize | null {
  const fullLayout = readPanelLayout()
  const entry = fullLayout[panelId]
  if (!entry || !Number.isFinite(entry.width) || !Number.isFinite(entry.height)) {
    return null
  }
  const width = entry.width
  const height = entry.height
  if (typeof width !== 'number' || typeof height !== 'number') {
    return null
  }
  return { width, height }
}

export function savePanelSize(panelId: string, size: PanelSize): void {
  savePanelLayoutEntry(panelId, size)
}

export function savePanelLayoutEntry(
  panelId: string,
  entryPatch: Partial<PanelLayoutEntry>,
): void {
  if (typeof window === 'undefined') return
  try {
    const layout = readPanelLayout()
    const prev = layout[panelId] ?? { x: 0, y: 0 }
    layout[panelId] = { ...prev, ...entryPatch }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // Ignore storage failures and keep runtime state only.
  }
}
