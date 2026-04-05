import { useEffect, useRef } from 'react'
import { useApp } from '../../context/useApp'
import { useSpeckleViewer } from '../../hooks/useSpeckleViewer'
import { zoomViewerToSmallestClashObject } from '../../lib/zoomToSmallestClashObject'

export interface ModelViewerProps {
  /**
   * Speckle object / application ids for the current clash. When set, the viewer
   * frames the object with the smallest axis-aligned bounds among these ids.
   */
  clashObjectApplicationIds?: string[]
}

export function ModelViewer({ clashObjectApplicationIds }: ModelViewerProps) {
  const { speckleUrls } = useApp()
  const containerRef = useRef<HTMLElement>(null)

  const activeUrls = speckleUrls.filter((u) => u.trim().length > 0)
  const clashIdsRef = useRef<string[]>([])
  clashIdsRef.current =
    clashObjectApplicationIds
      ?.map((s) => s.trim())
      .filter((s) => s.length > 0) ?? []

  const viewerRef = useSpeckleViewer(containerRef, activeUrls, {
    enabled: activeUrls.length > 0,
    onModelsLoaded: (viewer) => {
      if (clashIdsRef.current.length > 0) {
        zoomViewerToSmallestClashObject(viewer, clashIdsRef.current)
      }
    },
  })

  const clashFramingKey = JSON.stringify(
    (clashObjectApplicationIds ?? [])
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  )

  useEffect(() => {
    const ids =
      clashFramingKey === '[]' ? [] : (JSON.parse(clashFramingKey) as string[])
    if (ids.length === 0) return
    const v = viewerRef.current
    if (v) zoomViewerToSmallestClashObject(v, ids)
  }, [clashFramingKey, viewerRef])

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200/50 shadow-inner">
      {activeUrls.length === 0 ? (
        <div className="flex h-full min-h-[320px] items-center justify-center p-6 text-center text-sm text-neutral-500">
          Add at least one Speckle model URL on the landing page to load the
          3D view.
        </div>
      ) : (
        <section
          ref={containerRef}
          aria-label="Speckle 3D model viewer"
          className="absolute inset-0 min-h-[320px]"
        />
      )}
    </div>
  )
}
