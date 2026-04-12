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
  clearClashObjectViewerFocus: () => void
}

export const AppContext = createContext<AppState | null>(null)
