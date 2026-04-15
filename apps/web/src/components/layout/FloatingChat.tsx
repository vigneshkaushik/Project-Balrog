import { useEffect, useMemo, useRef, useState } from 'react'
import { PANEL_GRID, snapToGrid, useFloatingPanel } from '../../hooks/useFloatingPanel'
import { ChatWindow } from '../layout/ChatWindow'

const CHAT_OPEN_KEY = 'balrog-floating-chat-open'
const G = PANEL_GRID

function readInitialOpenState() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(CHAT_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(readInitialOpenState)
  const panelRef = useRef<HTMLElement>(null)
  const initialSize = useMemo(() => {
    if (typeof window === 'undefined') return { width: 416, height: 560 }
    return {
      width: snapToGrid(Math.min(416, window.innerWidth - 2 * G)),
      height: snapToGrid(Math.min(Math.round(window.innerHeight * 0.64), 720)),
    }
  }, [])
  const initialPosition = useMemo(() => {
    if (typeof window === 'undefined') return { x: G, y: 96 }
    return {
      x: snapToGrid(Math.max(G, window.innerWidth - initialSize.width - G)),
      y: snapToGrid(Math.max(4 * G, window.innerHeight - initialSize.height - 5 * G)),
    }
  }, [initialSize.height, initialSize.width])
  const { position, size, handleProps, getResizeHandleProps } = useFloatingPanel({
    panelId: 'floating-chat-window',
    panelRef,
    initialPosition,
    initialSize,
    minSize: { width: 320, height: 320 },
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_OPEN_KEY, isOpen ? '1' : '0')
    } catch {
      // Ignore storage failures and continue with in-memory state.
    }
  }, [isOpen])

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div
        className={`pointer-events-auto origin-bottom-right transition-all duration-150 ${
          isOpen
            ? 'visible opacity-100'
            : 'invisible opacity-0'
        }`}
      >
        <section
          ref={panelRef}
          className="floating-card pointer-events-auto absolute overflow-hidden"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
          }}
        >
          <div className="h-full min-h-0">
            <ChatWindow
              className="rounded-xl border-0"
              onHeaderPointerDown={handleProps.onPointerDown}
            />
          </div>
          <div
            className="absolute inset-y-2 right-0 w-2 cursor-e-resize"
            {...getResizeHandleProps('e')}
          />
          <div
            className="absolute inset-y-2 left-0 w-2 cursor-w-resize"
            {...getResizeHandleProps('w')}
          />
          <div
            className="absolute inset-x-2 bottom-0 h-2 cursor-s-resize"
            {...getResizeHandleProps('s')}
          />
          <div
            className="absolute inset-x-2 top-0 h-2 cursor-n-resize"
            {...getResizeHandleProps('n')}
          />
          <div
            className="absolute right-0 top-0 h-3 w-3 cursor-ne-resize"
            {...getResizeHandleProps('ne')}
          />
          <div
            className="absolute left-0 top-0 h-3 w-3 cursor-nw-resize"
            {...getResizeHandleProps('nw')}
          />
          <div
            className="absolute right-0 bottom-0 h-3 w-3 cursor-se-resize"
            {...getResizeHandleProps('se')}
          />
          <div
            className="absolute bottom-0 left-0 h-3 w-3 cursor-sw-resize"
            {...getResizeHandleProps('sw')}
          />
        </section>
      </div>
      <button
        type="button"
        aria-label={
          isOpen ? 'Collapse floating chat' : 'Open floating chat'
        }
        aria-pressed={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`pointer-events-auto absolute bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border shadow-lg backdrop-blur-sm transition hover:scale-[1.03] ${
          isOpen
            ? 'border-primary/45 bg-primary/15 text-primary'
            : 'border-primary/35 bg-white/95 text-primary hover:bg-primary/5'
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M2.25 12c0-4.832 3.918-8.75 8.75-8.75h2c4.832 0 8.75 3.918 8.75 8.75v.5c0 4.694-3.7 8.524-8.342 8.742l-4.105 1.368a.75.75 0 0 1-.95-.95l.785-2.354A8.751 8.751 0 0 1 2.25 12Z" />
        </svg>
      </button>
    </div>
  )
}
