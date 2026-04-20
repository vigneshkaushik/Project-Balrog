import { createContext } from 'react'
import type { Clash, ClashSeverity } from '../types'

export interface SpeckleUrlRow {
  id: string
  url: string
}

export interface UploadProgress {
  completed: number
  total: number
}

/** Request focusing one clash-side object in the Speckle viewer (selection + zoom). */
export interface ClashObjectViewerFocusRequest {
  /** Increments on each request so repeating the same object still runs the effect. */
  id: number
  matchKeys: string[]
}

export interface AppState {
  /** True while restoring persisted clash session from backend on app boot. */
  isSessionHydrating: boolean
  clashes: Clash[]
  navisworksFileName: string | null
  setNavisworksReport: (file: File | null) => void
  /** URLs in row order (same length as `speckleUrlRows`). */
  speckleUrls: string[]
  speckleUrlRows: SpeckleUrlRow[]
  appendSpeckleUrlRow: () => void
  setSpeckleUrlAt: (index: number, url: string) => void
  removeSpeckleUrlAt: (index: number) => void
  /** Show only clashes whose inferred severity equals this level (LOW, MEDIUM, CRITICAL). */
  severityThreshold: ClashSeverity
  setSeverityThreshold: (s: ClashSeverity) => void
  highlightFilteredSeverity: boolean
  setHighlightFilteredSeverity: (next: boolean) => void
  selectedClashId: string | null
  setSelectedClashId: (id: string | null) => void
  filteredClashes: Clash[]
  clearSession: () => void

  isUploading: boolean
  uploadProgress: UploadProgress | null
  uploadError: string | null
  startClashUpload: () => void

  clashObjectViewerFocus: ClashObjectViewerFocusRequest | null
  requestClashObjectViewerFocus: (matchKeys: string[]) => void

  /** Speckle object id → free-form user note (persisted in localStorage). */
  objectMetadata: Record<string, string>
  setObjectMetadata: (speckleId: string, text: string) => void
  clearObjectMetadata: (speckleId: string) => void

  /**
   * Currently selected Speckle object's raw data from the viewer.
   * Lifted out of `ModelViewer` so non-viewer UI (e.g. the chat `+` menu) can
   * reference the active selection without prop drilling.
   */
  selectedObjectData: Record<string, unknown> | null
  setSelectedObjectData: (data: Record<string, unknown> | null) => void

  /**
   * Ready-to-use Speckle `Viewer` instance. Set by `ClashInspector` once the
   * viewer hook resolves, cleared when it unmounts. Exposed here so features
   * outside the inspector (chat attachments in particular) can traverse the
   * loaded scene without prop drilling.
   */
  speckleViewer: import('@speckle/viewer').Viewer | null
  setSpeckleViewer: (viewer: import('@speckle/viewer').Viewer | null) => void
}

export const AppContext = createContext<AppState | null>(null)
