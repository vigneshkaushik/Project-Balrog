import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  type PanelSize,
  type PanelPosition,
  readPanelPosition,
  readPanelSize,
  savePanelPosition,
  savePanelSize,
} from '../lib/panelLayoutStorage'

export const PANEL_GRID = 16

/** Round a value to the nearest grid step. */
export function snapToGrid(value: number, grid = PANEL_GRID): number {
  return Math.round(value / grid) * grid
}

interface FloatingPanelOptions {
  panelId: string
  panelRef: RefObject<HTMLElement | null>
  initialPosition: PanelPosition
  initialSize: PanelSize
  minSize?: PanelSize
}

interface DragHandleProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
}

type ResizeDirection =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw'

interface ResizeHandleProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
}

interface FloatingPanelResult {
  position: PanelPosition
  size: PanelSize
  handleProps: DragHandleProps
  getResizeHandleProps: (direction: ResizeDirection) => ResizeHandleProps
}

const G = PANEL_GRID

function clampPosition(
  pos: PanelPosition,
  panelW: number,
  panelH: number,
): PanelPosition {
  const maxX = Math.max(0, window.innerWidth - panelW)
  const maxY = Math.max(0, window.innerHeight - panelH)
  return {
    x: Math.max(0, Math.min(pos.x, maxX)),
    y: Math.max(0, Math.min(pos.y, maxY)),
  }
}

function snapClampPosition(
  pos: PanelPosition,
  panelW: number,
  panelH: number,
): PanelPosition {
  const maxX = Math.max(0, Math.floor((window.innerWidth - panelW) / G) * G)
  const maxY = Math.max(0, Math.floor((window.innerHeight - panelH) / G) * G)
  return {
    x: Math.max(0, Math.min(snapToGrid(pos.x), maxX)),
    y: Math.max(0, Math.min(snapToGrid(pos.y), maxY)),
  }
}

function snapSize(size: PanelSize, min: PanelSize): PanelSize {
  const minW = snapToGrid(min.width)
  const minH = snapToGrid(min.height)
  return {
    width: Math.max(minW, snapToGrid(size.width)),
    height: Math.max(minH, snapToGrid(size.height)),
  }
}

function elClamp(pos: PanelPosition, el: HTMLElement | null): PanelPosition {
  return clampPosition(pos, el?.offsetWidth ?? 0, el?.offsetHeight ?? 0)
}

function elSnapClamp(pos: PanelPosition, el: HTMLElement | null): PanelPosition {
  return snapClampPosition(pos, el?.offsetWidth ?? 0, el?.offsetHeight ?? 0)
}

function readNormalizedLayout(
  panelId: string,
  initialPosition: PanelPosition,
  initialSize: PanelSize,
  minSize: PanelSize,
): { position: PanelPosition; size: PanelSize } {
  const size = snapSize(readPanelSize(panelId) ?? initialSize, minSize)
  const position = snapClampPosition(
    readPanelPosition(panelId) ?? initialPosition,
    size.width,
    size.height,
  )
  return { position, size }
}

export function useFloatingPanel({
  panelId,
  panelRef,
  initialPosition,
  initialSize,
  minSize = { width: 288, height: 192 },
}: FloatingPanelOptions): FloatingPanelResult {
  const initialX = initialPosition.x
  const initialY = initialPosition.y
  const initialWidth = initialSize.width
  const initialHeight = initialSize.height
  const minWidth = minSize.width
  const minHeight = minSize.height

  const [layout, setLayout] = useState(() =>
    typeof window === 'undefined'
      ? { position: initialPosition, size: snapSize(initialSize, minSize) }
      : readNormalizedLayout(panelId, initialPosition, initialSize, minSize),
  )
  const { position, size } = layout

  const dragRef = useRef<{
    pointerId: number
    originX: number
    originY: number
    startX: number
    startY: number
  } | null>(null)
  const resizeRef = useRef<{
    pointerId: number
    direction: ResizeDirection
    originX: number
    originY: number
    startX: number
    startY: number
    startWidth: number
    startHeight: number
  } | null>(null)
  const getEl = useCallback(() => panelRef.current, [panelRef])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setLayout(
      readNormalizedLayout(
        panelId,
        { x: initialX, y: initialY },
        { width: initialWidth, height: initialHeight },
        { width: minWidth, height: minHeight },
      ),
    )
  }, [
    panelId,
    initialX,
    initialY,
    initialWidth,
    initialHeight,
    minWidth,
    minHeight,
  ])

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setLayout((prev) => ({ ...prev, position: elSnapClamp(prev.position, getEl()) }))
    })
    return () => cancelAnimationFrame(raf)
  }, [getEl])

  useEffect(() => {
    const handler = () => {
      setLayout((prev) => ({ ...prev, position: elSnapClamp(prev.position, getEl()) }))
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [getEl])

  const commitPosition = useCallback(
    (pos: PanelPosition) => {
      setLayout((prev) => ({ ...prev, position: pos }))
      savePanelPosition(panelId, pos)
    },
    [panelId],
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      dragRef.current = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        startX: position.x,
        startY: position.y,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [position.x, position.y],
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      setLayout((prev) => ({
        ...prev,
        position: elClamp(
          { x: d.startX + (e.clientX - d.originX), y: d.startY + (e.clientY - d.originY) },
          getEl(),
        ),
      }))
    }
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      dragRef.current = null
      const el = getEl()
      const raw = clampPosition(
        { x: d.startX + (e.clientX - d.originX), y: d.startY + (e.clientY - d.originY) },
        el?.offsetWidth ?? size.width,
        el?.offsetHeight ?? size.height,
      )
      commitPosition(elSnapClamp(raw, el))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [commitPosition, getEl, size])

  const handleProps = useMemo<DragHandleProps>(() => ({ onPointerDown }), [onPointerDown])

  const getResizeHandleProps = useCallback(
    (direction: ResizeDirection): ResizeHandleProps => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) return
        resizeRef.current = {
          pointerId: event.pointerId,
          direction,
          originX: event.clientX,
          originY: event.clientY,
          startX: position.x,
          startY: position.y,
          startWidth: size.width,
          startHeight: size.height,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      },
    }),
    [position.x, position.y, size.width, size.height],
  )

  useEffect(() => {
    const mw = snapToGrid(minSize.width)
    const mh = snapToGrid(minSize.height)

    const onMove = (e: PointerEvent) => {
      const r = resizeRef.current
      if (!r || e.pointerId !== r.pointerId) return
      const dx = e.clientX - r.originX
      const dy = e.clientY - r.originY
      const vw = window.innerWidth
      const vh = window.innerHeight
      let nx = r.startX, ny = r.startY, nw = r.startWidth, nh = r.startHeight

      if (r.direction.includes('e')) nw = Math.max(mw, Math.min(vw - r.startX, r.startWidth + dx))
      if (r.direction.includes('s')) nh = Math.max(mh, Math.min(vh - r.startY, r.startHeight + dy))
      if (r.direction.includes('w')) {
        const cw = Math.max(mw, r.startWidth - dx)
        nx = Math.max(0, r.startX + (r.startWidth - cw))
        nw = cw
      }
      if (r.direction.includes('n')) {
        const ch = Math.max(mh, r.startHeight - dy)
        ny = Math.max(0, r.startY + (r.startHeight - ch))
        nh = ch
      }
      const cp = elClamp({ x: nx, y: ny }, getEl())
      setLayout({
        position: cp,
        size: { width: Math.min(nw, vw - cp.x), height: Math.min(nh, vh - cp.y) },
      })
    }

    const onUp = (e: PointerEvent) => {
      const r = resizeRef.current
      if (!r || e.pointerId !== r.pointerId) return
      resizeRef.current = null
      const ss = snapSize(size, minSize)
      const sp = snapClampPosition(position, ss.width, ss.height)
      const fs = {
        width: Math.max(mw, Math.floor(Math.min(ss.width, window.innerWidth - sp.x) / G) * G),
        height: Math.max(mh, Math.floor(Math.min(ss.height, window.innerHeight - sp.y) / G) * G),
      }
      setLayout({ position: sp, size: fs })
      savePanelPosition(panelId, sp)
      savePanelSize(panelId, fs)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [getEl, minSize, panelId, position, size])

  return { position, size, handleProps, getResizeHandleProps }
}
