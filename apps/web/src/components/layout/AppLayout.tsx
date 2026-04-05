import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ChatSidebar } from './ChatSidebar'

const SIDEBAR_WIDTH_KEY = 'balrog-chat-sidebar-width'
const MIN_SIDEBAR_PX = 280
const MAX_SIDEBAR_PX = 640
const DEFAULT_SIDEBAR_PX = 380
const MD_BREAKPOINT_PX = 768

function readInitialSidebarWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_PX
  const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY)
  const v = Number.parseInt(raw ?? '', 10)
  if (Number.isFinite(v) && v >= MIN_SIDEBAR_PX && v <= MAX_SIDEBAR_PX) {
    return v
  }
  return DEFAULT_SIDEBAR_PX
}

export function AppLayout() {
  const [sidebarWidth, setSidebarWidth] = useState(readInitialSidebarWidth)
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== 'undefined' && window.innerWidth >= MD_BREAKPOINT_PX,
  )
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)
  const widthDuringDragRef = useRef(sidebarWidth)
  widthDuringDragRef.current = sidebarWidth

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MD_BREAKPOINT_PX}px)`)
    const apply = () => setIsDesktop(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDesktop) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      dragRef.current = {
        startX: e.clientX,
        startW: widthDuringDragRef.current,
      }
    },
    [isDesktop],
  )

  const onResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const { startX, startW } = dragRef.current
    const next = Math.min(
      MAX_SIDEBAR_PX,
      Math.max(MIN_SIDEBAR_PX, startW - (e.clientX - startX)),
    )
    widthDuringDragRef.current = next
    setSidebarWidth(next)
  }, [])

  const endResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      dragRef.current = null
      try {
        localStorage.setItem(
          SIDEBAR_WIDTH_KEY,
          String(widthDuringDragRef.current),
        )
      } catch {
        /* quota / private mode */
      }
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  const persistWidth = useCallback((w: number) => {
    widthDuringDragRef.current = w
    setSidebarWidth(w)
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w))
    } catch {
      /* ignore */
    }
  }, [])

  const onResizeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isDesktop) return
      const step = e.shiftKey ? 40 : 16
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        persistWidth(Math.max(MIN_SIDEBAR_PX, sidebarWidth - step))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        persistWidth(Math.min(MAX_SIDEBAR_PX, sidebarWidth + step))
      }
    },
    [isDesktop, persistWidth, sidebarWidth],
  )

  return (
    <div className="flex h-svh min-h-0 w-full flex-col bg-neutral-100 md:flex-row">
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </main>
      <div
        className="relative flex min-h-0 w-full shrink-0 flex-col md:h-svh md:max-w-none md:flex-shrink-0"
        style={isDesktop ? { width: sidebarWidth } : undefined}
      >
        <div
          role="slider"
          aria-orientation="vertical"
          aria-label="Chat panel width"
          aria-valuenow={Math.round(sidebarWidth)}
          aria-valuemin={MIN_SIDEBAR_PX}
          aria-valuemax={MAX_SIDEBAR_PX}
          tabIndex={0}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onKeyDown={onResizeKeyDown}
          className="group absolute top-0 bottom-0 left-0 z-10 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/35 md:block"
        >
          <span className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-neutral-300 transition-colors group-hover:bg-primary/50" />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ChatSidebar />
        </div>
      </div>
    </div>
  )
}
