import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Clash } from '../types'
import { AppContext, type SpeckleUrlRow } from './appStateContext'

function generateMockClashes(): Clash[] {
  const total = 200
  const clashes: Clash[] = []
  for (let i = 1; i <= total; i++) {
    const phase = i % 17
    const severity = Math.min(10, (phase * 3 + (i % 7)) % 11)
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
  const [severityThreshold, setSeverityThreshold] = useState(0)
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
    () => clashes.filter((c) => c.severity >= severityThreshold),
    [clashes, severityThreshold],
  )

  const clearSession = useCallback(() => {
    setClashes([])
    setNavisworksFileName(null)
    setSpeckleUrlRows([])
    setSeverityThreshold(0)
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
