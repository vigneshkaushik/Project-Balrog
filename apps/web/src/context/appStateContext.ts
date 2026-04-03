import { createContext } from 'react'
import type { Clash } from '../types'

export interface SpeckleUrlRow {
  id: string
  url: string
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
  severityThreshold: number
  setSeverityThreshold: (n: number) => void
  selectedClashId: string | null
  setSelectedClashId: (id: string | null) => void
  filteredClashes: Clash[]
  clearSession: () => void
}

export const AppContext = createContext<AppState | null>(null)
