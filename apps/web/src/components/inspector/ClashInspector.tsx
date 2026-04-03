import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { AnalysisPanel } from './AnalysisPanel'
import { ClashSelector } from './ClashSelector'
import { ModelViewer } from './ModelViewer'
import { SeverityFilter } from './SeverityFilter'

export function ClashInspector() {
  const {
    navisworksFileName,
    speckleUrls,
    filteredClashes,
    selectedClashId,
    setSelectedClashId,
    clashes,
  } = useApp()

  const hasSession =
    Boolean(navisworksFileName) &&
    speckleUrls.some((u) => u.trim().length > 0) &&
    clashes.length > 0

  useEffect(() => {
    if (filteredClashes.length === 0) return
    const stillValid =
      selectedClashId &&
      filteredClashes.some((c) => c.id === selectedClashId)
    if (!stillValid) {
      setSelectedClashId(filteredClashes[0].id)
    }
  }, [filteredClashes, selectedClashId, setSelectedClashId])

  if (!hasSession) {
    return <Navigate to="/" replace />
  }

  const selected = filteredClashes.find((c) => c.id === selectedClashId)

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="relative flex min-h-[min(55vh,520px)] min-w-0 flex-1 flex-col">
            <div className="absolute left-3 top-3 z-10 max-w-[min(100%,320px)] space-y-2">
              <SeverityFilter />
              <ClashSelector />
            </div>
            <ModelViewer />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 w-full flex-col gap-4 md:flex-row">
        <AnalysisPanel title="Context">
          {selected ? (
            <p>
              Selected: {selected.label}. Severity {selected.severity}. (AI
              analysis will appear here.)
            </p>
          ) : (
            <p>Select a clash to see context.</p>
          )}
        </AnalysisPanel>
        <AnalysisPanel title="Recommendations">
          <p>Run analysis to generate trade-aware recommendations.</p>
        </AnalysisPanel>
      </div>
    </div>
  )
}
