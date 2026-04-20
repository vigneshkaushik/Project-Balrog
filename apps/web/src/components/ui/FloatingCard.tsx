import { type ReactNode, type RefObject, useMemo, useRef } from 'react'
import type { PanelPosition, PanelSize } from '../../lib/panelLayoutStorage'
import { useFloatingPanel } from '../../hooks/useFloatingPanel'

interface FloatingCardProps {
  panelId: string
  title: string
  titleIcon?: ReactNode
  titleSubtitle?: string
  initialPosition: PanelPosition
  initialSize: PanelSize
  widthClassName?: string
  className?: string
  children: ReactNode
  headerActions?: ReactNode
  headerToolbar?: ReactNode
  draggable?: boolean
  resizable?: boolean
  minSize?: PanelSize
  autoHeight?: boolean
  autoWidth?: boolean
  overflowMode?: 'clip' | 'visible'
  bodyScroll?: boolean
  showBody?: boolean
}

function coercePanelRef(
  ref: RefObject<HTMLElement | null>,
): RefObject<HTMLElement | null> {
  return ref
}

export function FloatingCard({
  panelId,
  title,
  titleIcon,
  titleSubtitle,
  initialPosition,
  initialSize,
  widthClassName = 'w-80',
  className = '',
  children,
  headerActions,
  headerToolbar,
  draggable = true,
  resizable = true,
  minSize,
  autoHeight = false,
  autoWidth = false,
  overflowMode = 'clip',
  bodyScroll = true,
  showBody = true,
}: FloatingCardProps) {
  const panelRef = useRef<HTMLElement>(null)
  const { position, size, handleProps, getResizeHandleProps } = useFloatingPanel({
    panelId,
    panelRef: coercePanelRef(panelRef),
    initialPosition,
    initialSize,
    minSize,
  })

  const style = useMemo(
    () => ({
      transform: `translate(${position.x}px, ${position.y}px)`,
      ...(autoWidth ? {} : { width: `${size.width}px` }),
      ...(autoHeight ? {} : { height: `${size.height}px` }),
    }),
    [autoHeight, autoWidth, position.x, position.y, size.height, size.width],
  )

  return (
    <section
      ref={panelRef}
      className={`floating-card pointer-events-auto absolute flex min-h-0 flex-col ${
        overflowMode === 'visible' ? 'overflow-visible' : 'overflow-hidden'
      } ${widthClassName} ${className}`}
      style={style}
    >
      <header
        className="border-b border-neutral-200"
      >
        <div
          className={`flex items-center justify-between gap-3 px-3 py-2 ${
            draggable ? 'drag-handle cursor-grab active:cursor-grabbing' : ''
          } ${
            headerToolbar ? 'border-b border-neutral-200' : ''
          }`}
          {...(draggable ? handleProps : {})}
        >
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
              {titleIcon ? (
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-primary">
                  {titleIcon}
                </span>
              ) : null}
              <span>{title}</span>
            </h3>
            {titleSubtitle ? (
              <p className="mt-0.5 truncate text-xs font-medium normal-case tracking-normal text-neutral-500">
                {titleSubtitle}
              </p>
            ) : null}
          </div>
          {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
        </div>
        {headerToolbar ? (
          <div
            className="overflow-x-auto px-3 py-2"
            onWheel={(event) => {
              const el = event.currentTarget
              if (!el) return
              // Let mouse wheel pan the horizontal toolbar without requiring Shift.
              const deltaX =
                Math.abs(event.deltaX) > 0
                  ? event.deltaX
                  : Math.abs(event.deltaY) > 0
                    ? event.deltaY
                    : 0
              if (deltaX === 0) return
              el.scrollLeft += deltaX
              event.preventDefault()
            }}
          >
            <div className="min-w-max">{headerToolbar}</div>
          </div>
        ) : null}
      </header>
      {showBody ? (
        <div
          className={`min-h-0 flex-1 p-3 ${
            bodyScroll ? 'overflow-y-auto' : 'overflow-visible'
          }`}
        >
          {children}
        </div>
      ) : null}
      {resizable ? (
        <>
          <div className="absolute inset-y-2 right-0 w-2 cursor-e-resize" {...getResizeHandleProps('e')} />
          <div className="absolute inset-y-2 left-0 w-2 cursor-w-resize" {...getResizeHandleProps('w')} />
          <div className="absolute inset-x-2 bottom-0 h-2 cursor-s-resize" {...getResizeHandleProps('s')} />
          <div className="absolute inset-x-2 top-0 h-2 cursor-n-resize" {...getResizeHandleProps('n')} />
          <div className="absolute right-0 top-0 h-3 w-3 cursor-ne-resize" {...getResizeHandleProps('ne')} />
          <div className="absolute left-0 top-0 h-3 w-3 cursor-nw-resize" {...getResizeHandleProps('nw')} />
          <div className="absolute right-0 bottom-0 h-3 w-3 cursor-se-resize" {...getResizeHandleProps('se')} />
          <div className="absolute bottom-0 left-0 h-3 w-3 cursor-sw-resize" {...getResizeHandleProps('sw')} />
        </>
      ) : null}
    </section>
  )
}
