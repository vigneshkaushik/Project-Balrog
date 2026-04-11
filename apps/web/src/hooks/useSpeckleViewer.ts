import { useEffect, useRef, type RefObject } from 'react'
import {
  CameraController,
  SelectionExtension,
  SpeckleLoader,
  UrlHelper,
  Viewer,
} from '@speckle/viewer'

export interface UseSpeckleViewerOptions {
  enabled?: boolean
  enableSelection?: boolean
  enableCamera?: boolean
  debug?: boolean
  authToken?: string
  onModelsLoaded?: (viewer: Viewer) => void
}

export function useSpeckleViewer(
  containerRef: RefObject<HTMLElement | null>,
  speckleUrls: string[],
  options: UseSpeckleViewerOptions = {},
) {
  const {
    enabled = true,
    enableSelection = true,
    enableCamera = true,
    debug = false,
    authToken = '',
    onModelsLoaded,
  } = options

  const viewerRef = useRef<Viewer | null>(null)
  const onModelsLoadedRef = useRef(onModelsLoaded)
  onModelsLoadedRef.current = onModelsLoaded

  // Stable dependency: callers often pass `urls.map(...).filter(...)` which is a
  // new array every render and would retrigger this effect indefinitely.
  const urlsKey = speckleUrls
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
    .join('\u0001')

  useEffect(() => {
    if (!enabled) return

    const el = containerRef.current
    if (!el) return

    const urls = urlsKey.length > 0 ? urlsKey.split('\u0001') : []

    if (urls.length === 0) return

    let cancelled = false

    el.innerHTML = ''

    const viewer = new Viewer(el)
    viewerRef.current = viewer

    ;(async () => {
      try {
        if (debug) {
          console.log('[useSpeckleViewer] Initializing viewer...')
          console.log('[useSpeckleViewer] Input URLs:', urls)
          console.log(
            '[useSpeckleViewer] Auth token provided:',
            authToken ? 'yes' : 'no',
          )
        }

        await viewer.init()
        if (cancelled) return

        if (enableCamera) {
          viewer.createExtension(CameraController)
          if (debug) {
            console.log('[useSpeckleViewer] CameraController enabled')
          }
        }

        if (enableSelection) {
          viewer.createExtension(SelectionExtension)
          if (debug) {
            console.log('[useSpeckleViewer] SelectionExtension enabled')
          }
        }

        for (const speckleUrl of urls) {
          if (cancelled) return

          if (debug) {
            console.log('[useSpeckleViewer] Loading Speckle URL:', speckleUrl)
          }

          const resolved = await UrlHelper.getResourceUrls(speckleUrl, authToken)

          if (debug) {
            console.log('[useSpeckleViewer] Resolved resource URLs:', resolved)
          }

          for (const resourceUrl of resolved) {
            if (cancelled) return

            if (debug) {
              console.log(
                '[useSpeckleViewer] Loading resource URL:',
                resourceUrl,
              )
            }

            const loader = new SpeckleLoader(
              viewer.getWorldTree(),
              resourceUrl,
              authToken,
            )

            await viewer.loadObject(loader, true)

            if (debug) {
              console.log('[useSpeckleViewer] Model loaded successfully')
            }
          }
        }
        if (!cancelled) {
          onModelsLoadedRef.current?.(viewer)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[useSpeckleViewer] Error:', err)
        }
      }
    })()

    return () => {
      cancelled = true

      try {
        viewer.dispose()
      } catch (err) {
        console.warn('[useSpeckleViewer] Dispose warning:', err)
      }

      viewerRef.current = null
      el.innerHTML = ''
    }
  }, [
    containerRef,
    enabled,
    enableSelection,
    enableCamera,
    debug,
    authToken,
    urlsKey,
  ])

  return viewerRef
}