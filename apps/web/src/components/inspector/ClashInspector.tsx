import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { AnalysisPanel } from './AnalysisPanel'
import { ClashSelector } from './ClashSelector'
import { ModelViewer } from './ModelViewer'
import { SeverityFilter } from './SeverityFilter'

const viewerOnlyMode = true

export function ClashInspector() {
  const {
    navisworksFileName,
    speckleUrls,
    filteredClashes,
    selectedClashId,
    setSelectedClashId,
    clashes,
  } = useApp()

  const hasSpeckleUrl = speckleUrls.some((u) => u.trim().length > 0)
  const hasClashReport = Boolean(navisworksFileName)
  const hasClashes = clashes.length > 0

  const hasSession = viewerOnlyMode
    ? hasSpeckleUrl
    : hasClashReport && hasSpeckleUrl && hasClashes

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
            <div className="space-y-3 text-sm text-neutral-700">
              <p>
                <span className="font-semibold text-neutral-900">
                  Selected clash:
                </span>{' '}
                {selected.label}
              </p>
              <p>
                <span className="font-semibold text-neutral-900">
                  Severity:
                </span>{' '}
                {selected.severity}
              </p>
              <p>
                <span className="font-semibold text-neutral-900">
                  Description:
                </span>{' '}
                This clash appears to involve overlapping building elements that
                may require coordination across multiple trades.
              </p>
              <p>
                <span className="font-semibold text-neutral-900">
                  Likely trades involved:
                </span>{' '}
                Architectural / Structural / MEP
              </p>
              <p>
                <span className="font-semibold text-neutral-900">
                  Current focus:
                </span>{' '}
                Review the selected issue in the 3D viewer and confirm which
                element should maintain priority.
              </p>
            </div>
          ) : viewerOnlyMode ? (
            <p className="text-sm text-neutral-500">
              Viewer-only mode is enabled. Clash report data will appear once
              backend JSON is connected.
            </p>
          ) : (
            <p className="text-sm text-neutral-500">
              Select a clash to see context.
            </p>
          )}
        </AnalysisPanel>

        <AnalysisPanel title="Recommendations">
          {selected ? (
            <div className="space-y-3 text-sm text-neutral-700">
              <p>Suggested next actions for this clash:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Confirm which trade owns the primary geometry.</li>
                <li>Check whether the MEP route can be shifted or rerouted.</li>
                <li>
                  Verify if clearance, maintenance access, or fire code is
                  affected.
                </li>
                <li>
                  Capture the issue and draft a coordination note or RFI.
                </li>
              </ul>
            </div>
          ) : viewerOnlyMode ? (
            <p className="text-sm text-neutral-500">
              Viewer-only mode is enabled. Recommendations will appear once
              clash data is returned from the backend.
            </p>
          ) : (
            <p className="text-sm text-neutral-500">
              Run analysis to generate trade-aware recommendations.
            </p>
          )}
        </AnalysisPanel>
      </div>
    </div>
  )
}