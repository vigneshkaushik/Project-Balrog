import { useEffect, useRef, type RefObject } from 'react'
import {
  CameraController,
  SelectionExtension,
  SpeckleLoader,
  UrlHelper,
  Viewer,
} from '@speckle/viewer'

export interface UseSpeckleViewerOptions {
  /** When false, skip initialization (e.g. empty container). */
  enabled?: boolean
  /** Called after `init` and all `loadObject` calls succeed for this viewer instance. */
  onModelsLoaded?: (viewer: Viewer) => void
}

/**
 * Initializes a Speckle Viewer in the given container and loads all models
 * for the provided Speckle URLs. Disposes the viewer on unmount or URL change.
 */
export function useSpeckleViewer(
  containerRef: RefObject<HTMLElement | null>,
  speckleUrls: string[],
  options: UseSpeckleViewerOptions = {},
) {
  const { enabled = true, onModelsLoaded } = options
  const viewerRef = useRef<Viewer | null>(null)
  const onModelsLoadedRef = useRef(onModelsLoaded)
  onModelsLoadedRef.current = onModelsLoaded

  useEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el) return

    const urls = speckleUrls.filter((u) => u.trim().length > 0)
    if (urls.length === 0) return

    let cancelled = false
    const viewer = new Viewer(el)
    viewerRef.current = viewer

    ;(async () => {
      try {
        await viewer.init()
        if (cancelled) return
        viewer.createExtension(CameraController)
        viewer.createExtension(SelectionExtension)

        for (const speckleUrl of urls) {
          if (cancelled) return
          const resolved = await UrlHelper.getResourceUrls(speckleUrl)
          for (const resourceUrl of resolved) {
            if (cancelled) return
            const loader = new SpeckleLoader(viewer.getWorldTree(), resourceUrl, '')
            await viewer.loadObject(loader, true)
          }
        }
        if (!cancelled) {
          onModelsLoadedRef.current?.(viewer)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[useSpeckleViewer]', err)
        }
      }
    })()

    return () => {
      cancelled = true
      viewer.dispose()
      viewerRef.current = null
    }
  }, [containerRef, enabled, speckleUrls])

  return viewerRef
}
