import { useEffect, useRef, useState } from 'react'
import type { Viewer } from '@speckle/viewer'
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
  const [loadedViewer, setLoadedViewer] = useState<Viewer | null>(null)

  const activeUrls = speckleUrls
    .map((u) => u.trim())
    .filter((u) => u.length > 0)

  const authToken = import.meta.env.VITE_SPECKLE_TOKEN ?? ''

  useSpeckleViewer(containerRef, activeUrls, {
    enabled: activeUrls.length > 0,
    debug: true,
    authToken,
    onModelsLoaded: (viewer) => {
      setLoadedViewer(viewer)
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
    if (ids.length === 0 || !loadedViewer) return
    zoomViewerToSmallestClashObject(loadedViewer, ids)
  }, [clashFramingKey, loadedViewer])

  useEffect(() => {
    if (activeUrls.length === 0) {
      setLoadedViewer(null)
    }
  }, [activeUrls.length])

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-neutral-200/50">
      {activeUrls.length === 0 ? (
        <div className="absolute inset-0 flex min-h-[320px] items-center justify-center p-6 text-center text-sm text-neutral-500">
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