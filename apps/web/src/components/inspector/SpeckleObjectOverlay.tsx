import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/useApp'
import { useFloatingPanel } from '../../hooks/useFloatingPanel'

interface SpeckleObjectOverlayProps {
  objectData: Record<string, unknown>
}

const MIN_WIDTH = 288
const MIN_HEIGHT = 208
const DEFAULT_WIDTH = 352

const METADATA_HELP_LEAVE_DELAY_MS = 320
const METADATA_HELP_PANEL_WIDTH = 300
const METADATA_HELP_GAP_PX = 10

function helpBoxNearlyEqual(
  a: { top: number; left: number; width: number },
  b: { top: number; left: number; width: number },
): boolean {
  return (
    Math.abs(a.top - b.top) < 0.75 &&
    Math.abs(a.left - b.left) < 0.75 &&
    a.width === b.width
  )
}

const METADATA_HELP_TITLE = 'What this note is for'

const METADATA_HELP_BODY = [
  'Use this box to capture anything your coordination team should know about this object—who is supposed to move it, a hold or waiver, a substitution you agreed on, a job or RFI number, or a reminder to verify something in the field.',
  'When you run analysis for a clash, Balrog sends your note together with the clash and model context so the guidance matches how you are actually working the issue.',
  'Notes stay on this device in your browser only; they are not saved to Speckle or back into the clash report file.',
] as const

const PRIORITY_KEYS = [
  'id',
  'name',
  'type',
  'speckle_type',
  'applicationId',
  'category',
  'level',
  'family',
  'units',
  'builtInCategory',
] as const

const HIDDEN_KEYS = new Set([
  '__closure',
  '__parents',
  'bbox',
  'children',
  'displayStyle',
  'displayValue',
  'elements',
  'geometry',
  'renderMaterial',
  'transform',
  '@displayValue',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function formatLabel(key: string): string {
  return key
    .replace(/^@/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
}

function formatPrimitive(value: string | number | boolean | null): string {
  if (value == null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function sortEntries(entries: Array<[string, unknown]>): Array<[string, unknown]> {
  const priorityIndex = new Map<string, number>(
    PRIORITY_KEYS.map((key, index) => [key, index]),
  )
  return [...entries].sort(([a], [b]) => {
    const aPriority = priorityIndex.get(a) ?? Number.POSITIVE_INFINITY
    const bPriority = priorityIndex.get(b) ?? Number.POSITIVE_INFINITY
    if (aPriority !== bPriority) return aPriority - bPriority
    return a.localeCompare(b)
  })
}

function getRenderableEntries(objectData: Record<string, unknown>) {
  return sortEntries(
    Object.entries(objectData).filter(
      ([key]) => !HIDDEN_KEYS.has(key) && !key.startsWith('__'),
    ),
  )
}

function getArrayItemKey(label: string, item: unknown): string {
  if (isRecord(item)) {
    const preferredKey =
      item.id ?? item.applicationId ?? item.name ?? item.type ?? item.speckle_type
    if (isPrimitive(preferredKey)) return `${label}-${formatPrimitive(preferredKey)}`
  }

  if (isPrimitive(item)) return `${label}-${formatPrimitive(item)}`

  try {
    return `${label}-${JSON.stringify(item)}`
  } catch {
    return `${label}-(non-serializable)`
  }
}

function ValueView({
  label,
  value,
  depth = 0,
}: {
  label: string
  value: unknown
  depth?: number
}) {
  if (isPrimitive(value)) {
    return (
      <div className="grid grid-cols-[minmax(0,112px)_1fr] gap-x-3 gap-y-1 py-1.5">
        <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {formatLabel(label)}
        </dt>
        <dd className="min-w-0 break-words text-sm text-neutral-800">
          {formatPrimitive(value)}
        </dd>
      </div>
    )
  }

  if (Array.isArray(value)) {
    const preview =
      value.length === 0
        ? 'No items'
        : value.every(isPrimitive)
          ? value.map((item) => formatPrimitive(item)).join(', ')
          : `${value.length} item${value.length === 1 ? '' : 's'}`

    return (
      <details className="py-1.5" open={depth === 0}>
        <summary className="cursor-pointer list-none text-sm font-medium text-neutral-700">
          <span className="text-xs uppercase tracking-wide text-neutral-500">
            {formatLabel(label)}
          </span>
          <span className="ml-2 font-normal text-neutral-600">{preview}</span>
        </summary>
        {value.length > 0 ? (
          <div className="mt-2 space-y-1 border-l border-neutral-200 pl-3">
            {value.slice(0, 20).map((item, index) => (
              <ValueView
                key={getArrayItemKey(label, item)}
                label={String(index)}
                value={item}
                depth={depth + 1}
              />
            ))}
            {value.length > 20 ? (
              <p className="pt-1 text-xs text-neutral-500">
                {value.length - 20} more item
                {value.length - 20 === 1 ? '' : 's'} not shown
              </p>
            ) : null}
          </div>
        ) : null}
      </details>
    )
  }

  if (isRecord(value)) {
    const nestedEntries = getRenderableEntries(value)
    return (
      <details className="py-1.5" open={depth === 0}>
        <summary className="cursor-pointer list-none text-sm font-medium text-neutral-700">
          <span className="text-xs uppercase tracking-wide text-neutral-500">
            {formatLabel(label)}
          </span>
          <span className="ml-2 font-normal text-neutral-600">
            {nestedEntries.length} field{nestedEntries.length === 1 ? '' : 's'}
          </span>
        </summary>
        <dl className="mt-2 border-l border-neutral-200 pl-3">
          {nestedEntries.map(([nestedKey, nestedValue]) => (
            <ValueView
              key={`${label}-${nestedKey}`}
              label={nestedKey}
              value={nestedValue}
              depth={depth + 1}
            />
          ))}
        </dl>
      </details>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,112px)_1fr] gap-x-3 gap-y-1 py-1.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {formatLabel(label)}
      </dt>
      <dd className="min-w-0 break-words text-sm text-neutral-800">
        {String(value)}
      </dd>
    </div>
  )
}

function getObjectTitle(objectData: Record<string, unknown>): ReactNode {
  const name = objectData.name
  const type = objectData.type
  const speckleType = objectData.speckle_type

  if (typeof name === 'string' && name.trim()) return name
  if (typeof type === 'string' && type.trim()) return type
  if (typeof speckleType === 'string' && speckleType.trim()) return speckleType
  return 'Selected object'
}

function readSpeckleId(objectData: Record<string, unknown>): string | null {
  const id = objectData.id
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null
}

function SpeckleObjectOverlayComponent({ objectData }: SpeckleObjectOverlayProps) {
  const panelId = useId()
  const metadataHelpId = useId()
  const { objectMetadata, setObjectMetadata, clearObjectMetadata } = useApp()
  const speckleId = readSpeckleId(objectData)
  const storedNote = speckleId ? (objectMetadata[speckleId] ?? '') : ''
  const hasNote = storedNote.trim().length > 0
  const [editingMeta, setEditingMeta] = useState(false)
  const [draftMeta, setDraftMeta] = useState(storedNote)
  const [metadataHelpOpen, setMetadataHelpOpen] = useState(false)
  const [metadataHelpBox, setMetadataHelpBox] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const metadataHelpTriggerRef = useRef<HTMLButtonElement>(null)
  const metadataHelpPanelRef = useRef<HTMLDivElement>(null)
  const metadataHelpLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  const clearMetadataHelpLeaveTimer = useCallback(() => {
    if (metadataHelpLeaveTimerRef.current != null) {
      clearTimeout(metadataHelpLeaveTimerRef.current)
      metadataHelpLeaveTimerRef.current = null
    }
  }, [])

  const scheduleMetadataHelpClose = useCallback(() => {
    clearMetadataHelpLeaveTimer()
    metadataHelpLeaveTimerRef.current = setTimeout(() => {
      metadataHelpLeaveTimerRef.current = null
      setMetadataHelpOpen(false)
      setMetadataHelpBox(null)
    }, METADATA_HELP_LEAVE_DELAY_MS)
  }, [clearMetadataHelpLeaveTimer])

  const openMetadataHelp = useCallback(() => {
    clearMetadataHelpLeaveTimer()
    const btn = metadataHelpTriggerRef.current
    const nextBox =
      btn && typeof window !== 'undefined'
        ? (() => {
            const r = btn.getBoundingClientRect()
            const width = Math.min(METADATA_HELP_PANEL_WIDTH, window.innerWidth - 24)
            let left = r.right - width
            left = Math.max(12, Math.min(left, window.innerWidth - width - 12))
            const top = r.bottom + METADATA_HELP_GAP_PX
            return { top, left, width }
          })()
        : {
            top: 80,
            left: 16,
            width: METADATA_HELP_PANEL_WIDTH,
          }
    setMetadataHelpBox((prev) =>
      prev && helpBoxNearlyEqual(prev, nextBox) ? prev : nextBox,
    )
    setMetadataHelpOpen(true)
  }, [clearMetadataHelpLeaveTimer])

  const scheduleMetadataHelpCloseFromTrigger = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const next = e.relatedTarget as Node | null
      if (next && metadataHelpPanelRef.current?.contains(next)) return
      scheduleMetadataHelpClose()
    },
    [scheduleMetadataHelpClose],
  )

  const scheduleMetadataHelpCloseFromPanel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const next = e.relatedTarget as Node | null
      if (next && metadataHelpTriggerRef.current?.contains(next)) return
      scheduleMetadataHelpClose()
    },
    [scheduleMetadataHelpClose],
  )

  useLayoutEffect(() => {
    if (!metadataHelpOpen) return
    const update = () => {
      const btn = metadataHelpTriggerRef.current
      if (!btn || typeof window === 'undefined') return
      const r = btn.getBoundingClientRect()
      const width = Math.min(METADATA_HELP_PANEL_WIDTH, window.innerWidth - 24)
      let left = r.right - width
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12))
      const top = r.bottom + METADATA_HELP_GAP_PX
      const next = { top, left, width }
      setMetadataHelpBox((prev) =>
        prev && helpBoxNearlyEqual(prev, next) ? prev : next,
      )
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [metadataHelpOpen])

  useEffect(() => {
    if (!metadataHelpOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearMetadataHelpLeaveTimer()
        setMetadataHelpOpen(false)
        setMetadataHelpBox(null)
        metadataHelpTriggerRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      clearMetadataHelpLeaveTimer()
    }
  }, [metadataHelpOpen, clearMetadataHelpLeaveTimer])

  useEffect(() => {
    return () => clearMetadataHelpLeaveTimer()
  }, [clearMetadataHelpLeaveTimer])

  useEffect(() => {
    if (editingMeta) return
    setDraftMeta(storedNote)
  }, [storedNote, editingMeta])

  const entries = getRenderableEntries(objectData)
  const [expanded, setExpanded] = useState(true)
  const overlayRef = useRef<HTMLElement>(null)
  const initialSize = useMemo(() => {
    if (typeof window === 'undefined') {
      return { width: DEFAULT_WIDTH, height: 560 }
    }
    return {
      width: DEFAULT_WIDTH,
      height: Math.max(MIN_HEIGHT, Math.min(560, window.innerHeight - 32)),
    }
  }, [])
  const initialPosition = useMemo(() => {
    if (typeof window === 'undefined') return { x: 16, y: 64 }
    return {
      x: Math.max(16, window.innerWidth - initialSize.width - 16),
      y: 64,
    }
  }, [initialSize.width])
  const { position, size, handleProps, getResizeHandleProps } = useFloatingPanel({
    panelId: 'speckle-object-overlay',
    panelRef: overlayRef,
    initialPosition,
    initialSize,
    minSize: { width: MIN_WIDTH, height: MIN_HEIGHT },
  })

  const metadataHelpPortal =
    metadataHelpOpen &&
    metadataHelpBox &&
    typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={metadataHelpPanelRef}
            id={metadataHelpId}
            role="dialog"
            aria-modal="false"
            aria-labelledby={`${metadataHelpId}-heading`}
            className="fixed z-[200] rounded-lg border border-neutral-200 bg-white p-3 shadow-xl ring-1 ring-black/5 opacity-100 transition-opacity duration-200 ease-out motion-reduce:transition-none"
            style={{
              top: metadataHelpBox.top,
              left: metadataHelpBox.left,
              width: metadataHelpBox.width,
            }}
            onPointerEnter={clearMetadataHelpLeaveTimer}
            onPointerLeave={scheduleMetadataHelpCloseFromPanel}
          >
            <h2
              id={`${metadataHelpId}-heading`}
              className="text-xs font-semibold text-neutral-900"
            >
              {METADATA_HELP_TITLE}
            </h2>
            <div className="mt-2 space-y-2 text-xs leading-relaxed text-neutral-600">
              {METADATA_HELP_BODY.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
    <aside
      ref={overlayRef}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: `${size.width}px`,
        height: expanded ? `${size.height}px` : "auto",
      }}
      className="floating-card pointer-events-auto absolute left-0 top-0 z-10 flex max-h-[min(90vh,calc(100%-2rem))] flex-col overflow-hidden transition-[width] duration-300 ease-out motion-reduce:transition-none"
    >
      {/* Left resize handle */}
      <div
        {...getResizeHandleProps('w')}
        className="absolute left-0 top-0 bottom-0 z-10 w-1.5 cursor-ew-resize transition-colors hover:bg-primary/10 active:bg-primary/20"
      />

      <button
        type="button"
        className={`drag-handle flex w-full shrink-0 cursor-grab items-start gap-2 px-3 py-2 text-left active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40 ${
          expanded ? 'border-b border-neutral-200' : ''
        }`}
        aria-expanded={expanded}
        aria-controls={panelId}
        {...handleProps}
        onClick={() => setExpanded((open) => !open)}
      >
        <svg
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform duration-300 ease-out motion-reduce:transition-none ${
            expanded ? 'rotate-0' : '-rotate-90'
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          focusable="false"
        >
          <title>Expand or collapse object details</title>
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
            Selected object
          </p>
          <h3 className="truncate text-sm font-semibold text-neutral-900">
            {getObjectTitle(objectData)}
          </h3>
        </div>
      </button>

      <div
        className={`grid min-h-0 flex-1 transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            id={panelId}
            inert={!expanded}
            className="flex h-full min-h-0 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
              {speckleId ? (
                <div className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                      User metadata
                    </p>
                    <button
                      ref={metadataHelpTriggerRef}
                      type="button"
                      className="inline-flex shrink-0 cursor-help border-0 bg-transparent p-0 text-neutral-500 hover:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
                      aria-label="What is user metadata?"
                      aria-expanded={metadataHelpOpen}
                      aria-controls={metadataHelpId}
                      aria-haspopup="dialog"
                      onPointerEnter={() => {
                        openMetadataHelp()
                      }}
                      onPointerLeave={scheduleMetadataHelpCloseFromTrigger}
                      onFocus={() => {
                        openMetadataHelp()
                      }}
                    >
                      <svg
                        className="pointer-events-none h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.748 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.251 9H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                  {editingMeta ? (
                    <div className="mt-2 space-y-2">
                      <label htmlFor={`${panelId}-meta`} className="sr-only">
                        User metadata note
                      </label>
                      <textarea
                        id={`${panelId}-meta`}
                        rows={4}
                        value={draftMeta}
                        onChange={(e) => setDraftMeta(e.target.value)}
                        className="w-full resize-y rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary/50"
                        placeholder="Add coordinator notes…"
                      />
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setDraftMeta(storedNote)
                            setEditingMeta(false)
                          }}
                          className="cursor-pointer rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          Cancel
                        </button>
                        {hasNote ? (
                          <button
                            type="button"
                            onClick={() => {
                              clearObjectMetadata(speckleId)
                              setDraftMeta('')
                              setEditingMeta(false)
                            }}
                            className="cursor-pointer rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setObjectMetadata(speckleId, draftMeta)
                            setEditingMeta(false)
                          }}
                          className="cursor-pointer rounded-md bg-slate-600 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : hasNote ? (
                    <div className="mt-2 space-y-2">
                      <p className="whitespace-pre-wrap text-sm text-neutral-800">
                        {storedNote}
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingMeta(true)}
                          className="cursor-pointer rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => clearObjectMetadata(speckleId)}
                          className="cursor-pointer rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingMeta(true)}
                      className="mt-2 cursor-pointer rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                    >
                      Add metadata
                    </button>
                  )}
                </div>
              ) : null}
              {entries.length > 0 ? (
                <dl>
                  {entries.map(([key, value]) => (
                    <ValueView key={key} label={key} value={value} />
                  ))}
                </dl>
              ) : (
                <p className="py-3 text-sm text-neutral-500">
                  No displayable properties were found for this object.
                </p>
              )}
            </div>

            {expanded ? (
              <div
                {...getResizeHandleProps('s')}
                className="h-1.5 shrink-0 cursor-ns-resize transition-colors hover:bg-primary/10 active:bg-primary/20"
              />
            ) : null}
          </div>
        </div>
      </div>
    </aside>
    {metadataHelpPortal}
    </>
  )
}

/**
 * Memoized so per-frame parent re-renders (e.g. badge tracking, hover state)
 * do not recompute the property tree for the same `objectData` reference.
 */
export const SpeckleObjectOverlay = memo(SpeckleObjectOverlayComponent)
