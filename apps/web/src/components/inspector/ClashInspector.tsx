import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { AnalysisPanel } from './AnalysisPanel'
import { ClashSelector } from './ClashSelector'
import { ModelViewer } from './ModelViewer'
import { SeverityFilter } from './SeverityFilter'

const viewerOnlyMode = true

/** Sheet height when fully collapsed: only the resize handle remains visible. */
const SHEET_COLLAPSED_PX = 24

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
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(
    null,
  )
  const [sheetHeight, setSheetHeight] = useState(240)
  const [isDraggingSheet, setIsDraggingSheet] = useState(false)

  useEffect(() => {
    if (filteredClashes.length === 0) return

    const stillValid =
      selectedClashId &&
      filteredClashes.some((c) => c.id === selectedClashId)

    if (!stillValid) {
      setSelectedClashId(filteredClashes[0].id)
    }
  }, [filteredClashes, selectedClashId, setSelectedClashId])

  useEffect(() => {
    if (!isDraggingSheet) return

    const onPointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState) return

      const deltaY = dragState.startY - event.clientY
      const hostHeight = containerRef.current?.clientHeight ?? window.innerHeight
      const maxHeight = Math.max(280, Math.floor(hostHeight * 0.8))
      const nextHeight = Math.min(
        maxHeight,
        Math.max(SHEET_COLLAPSED_PX, dragState.startHeight + deltaY),
      )

      setSheetHeight(nextHeight)
    }

    const stopDragging = () => {
      setIsDraggingSheet(false)
      dragStateRef.current = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }
  }, [isDraggingSheet])

  if (!hasSession) {
    return <Navigate to="/" replace />
  }

  const selected = filteredClashes.find((c) => c.id === selectedClashId)

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col">
      <div
        ref={containerRef}
        className="relative flex min-h-full min-w-0 flex-1 overflow-hidden"
      >
        <ModelViewer />

        <div className="absolute left-3 top-3 z-10 w-80 max-w-[calc(100%-1.5rem)] space-y-2">
          <SeverityFilter />
          <ClashSelector />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <section
            className="pointer-events-auto flex w-full flex-col overflow-hidden border border-neutral-200 bg-white/95 shadow-xl backdrop-blur-sm"
            style={{ height: `${sheetHeight}px` }}
          >
            <button
              type="button"
              aria-expanded={sheetHeight > SHEET_COLLAPSED_PX}
              aria-label={
                sheetHeight <= SHEET_COLLAPSED_PX
                  ? 'Expand analysis drawer'
                  : 'Resize or collapse analysis drawer'
              }
              onPointerDown={(event) => {
                dragStateRef.current = {
                  startY: event.clientY,
                  startHeight: sheetHeight,
                }
                setIsDraggingSheet(true)
              }}
              className="group flex h-6 min-h-0 shrink-0 cursor-row-resize items-center justify-center border-b border-neutral-200"
            >
              <span className="h-0.5 w-12 rounded-full bg-neutral-300 transition group-hover:bg-neutral-400" />
            </button>

            <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-y-2 overflow-auto px-3 py-2 sm:grid-cols-[1fr_1px_1fr] sm:gap-y-0">
              <div className="min-h-0 min-w-0 sm:pr-6">
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
                        {selected.severity ?? 'Not inferred yet'}
                      </p>
                      <p>
                        <span className="font-semibold text-neutral-900">
                          Description:
                        </span>{' '}
                        This clash appears to involve overlapping building elements
                        that may require coordination across multiple trades.
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
                        Review the selected issue in the 3D viewer and confirm
                        which element should maintain priority.
                      </p>
                    </div>
                  ) : viewerOnlyMode ? (
                    <p className="text-sm text-neutral-500">
                      Viewer-only mode is enabled. Clash report data will appear
                      once backend JSON is connected.
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-500">
                      Select a clash to see context.
                    </p>
                  )}
                </AnalysisPanel>
              </div>

              <div
                className="h-px w-full shrink-0 bg-neutral-200 sm:h-full sm:min-h-0 sm:w-full sm:self-stretch"
                aria-hidden
              />

              <div className="min-h-0 min-w-0 sm:pl-6">
                <AnalysisPanel title="Recommendations">
                  {selected ? (
                    <div className="space-y-3 text-sm text-neutral-700">
                      <p>Suggested next actions for this clash:</p>
                      <ul className="list-disc space-y-1 pl-5">
                        <li>Confirm which trade owns the primary geometry.</li>
                        <li>
                          Check whether the MEP route can be shifted or rerouted.
                        </li>
                        <li>
                          Verify if clearance, maintenance access, or fire code
                          is affected.
                        </li>
                        <li>
                          Capture the issue and draft a coordination note or RFI.
                        </li>
                      </ul>
                    </div>
                  ) : viewerOnlyMode ? (
                    <p className="text-sm text-neutral-500">
                      Viewer-only mode is enabled. Recommendations will appear
                      once clash data is returned from the backend.
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-500">
                      Run analysis to generate trade-aware recommendations.
                    </p>
                  )}
                </AnalysisPanel>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}