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
}

export const AppContext = createContext<AppState | null>(null)
