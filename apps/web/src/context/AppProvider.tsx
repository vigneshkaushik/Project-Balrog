import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Clash, ClashSeverity } from '../types'
import { clashMeetsMinimumSeverity } from '../types'
import { AppContext, type SpeckleUrlRow } from './appStateContext'

const MOCK_SEVERITIES: ClashSeverity[] = ['LOW', 'MEDIUM', 'CRITICAL']

function generateMockClashes(): Clash[] {
  const total = 200
  const clashes: Clash[] = []
  for (let i = 1; i <= total; i++) {
    const severity = MOCK_SEVERITIES[i % MOCK_SEVERITIES.length]
    clashes.push({
      id: String(i),
      label: `Clash #${i}`,
      severity,
    })
  }
  return clashes
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [clashes, setClashes] = useState<Clash[]>([])
  const [navisworksFileName, setNavisworksFileName] = useState<string | null>(
    null,
  )
  const [speckleUrlRows, setSpeckleUrlRows] = useState<SpeckleUrlRow[]>([])
  const speckleUrls = useMemo(
    () => speckleUrlRows.map((r) => r.url),
    [speckleUrlRows],
  )
  const [severityThreshold, setSeverityThreshold] =
    useState<ClashSeverity>('LOW')
  const [selectedClashId, setSelectedClashId] = useState<string | null>(null)

  const setNavisworksReport = useCallback((file: File | null) => {
    if (!file) {
      setNavisworksFileName(null)
      setClashes([])
      setSelectedClashId(null)
      return
    }
    setNavisworksFileName(file.name)
    const next = generateMockClashes()
    setClashes(next)
    setSelectedClashId(next[0]?.id ?? null)
  }, [])

  const appendSpeckleUrlRow = useCallback(() => {
    setSpeckleUrlRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), url: '' },
    ])
  }, [])

  const setSpeckleUrlAt = useCallback((index: number, url: string) => {
    setSpeckleUrlRows((prev) => {
      if (index < 0 || index >= prev.length) return prev
      const next = [...prev]
      next[index] = { ...next[index], url }
      return next
    })
  }, [])

  const removeSpeckleUrlAt = useCallback((index: number) => {
    setSpeckleUrlRows((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const filteredClashes = useMemo(
    () =>
      clashes.filter((c) =>
        clashMeetsMinimumSeverity(c.severity, severityThreshold),
      ),
    [clashes, severityThreshold],
  )

  const clearSession = useCallback(() => {
    setClashes([])
    setNavisworksFileName(null)
    setSpeckleUrlRows([])
    setSeverityThreshold('LOW')
    setSelectedClashId(null)
  }, [])

  const value = useMemo(
    () => ({
      clashes,
      navisworksFileName,
      setNavisworksReport,
      speckleUrls,
      speckleUrlRows,
      appendSpeckleUrlRow,
      setSpeckleUrlAt,
      removeSpeckleUrlAt,
      severityThreshold,
      setSeverityThreshold,
      selectedClashId,
      setSelectedClashId,
      filteredClashes,
      clearSession,
    }),
    [
      clashes,
      navisworksFileName,
      setNavisworksReport,
      speckleUrls,
      speckleUrlRows,
      appendSpeckleUrlRow,
      setSpeckleUrlAt,
      removeSpeckleUrlAt,
      severityThreshold,
      selectedClashId,
      filteredClashes,
      clearSession,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
