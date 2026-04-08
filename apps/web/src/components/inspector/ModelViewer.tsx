import { useRef } from 'react'
import { useApp } from '../../context/useApp'
import { useSpeckleViewer } from '../../hooks/useSpeckleViewer'

export function ModelViewer() {
  const { speckleUrls } = useApp()
  const containerRef = useRef<HTMLElement>(null)

  const activeUrls = speckleUrls
    .map((u) => u.trim())
    .filter((u) => u.length > 0)

  const authToken = import.meta.env.VITE_SPECKLE_TOKEN ?? ''

  useSpeckleViewer(containerRef, activeUrls, {
    enabled: activeUrls.length > 0,
    debug: true,
    authToken,
  })

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