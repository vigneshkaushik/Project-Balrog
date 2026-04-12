import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'

interface SpeckleObjectOverlayProps {
  objectData: Record<string, unknown>
}

const MIN_WIDTH = 280
const MIN_HEIGHT = 200
const DEFAULT_WIDTH = 360

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
  const priorityIndex = new Map(PRIORITY_KEYS.map((key, index) => [key, index]))
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
        <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
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
          <span className="text-[11px] uppercase tracking-wide text-neutral-500">
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
          <span className="text-[11px] uppercase tracking-wide text-neutral-500">
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
      <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
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

export function SpeckleObjectOverlay({ objectData }: SpeckleObjectOverlayProps) {
  const panelId = useId()
  const entries = getRenderableEntries(objectData)
  const [expanded, setExpanded] = useState(true)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [height, setHeight] = useState(0)
  const [isResizing, setIsResizing] = useState<'width' | 'height' | null>(null)

  useEffect(() => {
    // Set default height to 80% of container or window
    const parentHeight = window.innerHeight
    setHeight(Math.max(MIN_HEIGHT, Math.floor(parentHeight * 0.8)))
  }, [])

  const dragStartRef = useRef<{
    startX: number
    startY: number
    startWidth: number
    startHeight: number
  } | null>(null)

  const onStartResizeWidth = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      setIsResizing('width')
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: width,
        startHeight: height,
      }
    },
    [width, height],
  )

  const onStartResizeHeight = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      setIsResizing('height')
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: width,
        startHeight: height,
      }
    },
    [width, height],
  )

  useEffect(() => {
    if (!isResizing) return

    const onPointerMove = (e: PointerEvent) => {
      if (!dragStartRef.current) return
      const { startX, startY, startWidth, startHeight } = dragStartRef.current

      if (isResizing === 'width') {
        const deltaX = startX - e.clientX
        setWidth(Math.max(MIN_WIDTH, startWidth + deltaX))
      } else if (isResizing === 'height') {
        const deltaY = e.clientY - startY
        setHeight(Math.max(MIN_HEIGHT, startHeight + deltaY))
      }
    }

    const onPointerUp = () => {
      setIsResizing(null)
      dragStartRef.current = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [isResizing])

  return (
    <aside
      style={{ width: `${width}px` }}
      className="absolute right-3 top-3 z-10 flex max-h-[min(90vh,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-lg backdrop-blur-sm transition-[width] duration-300 ease-out motion-reduce:transition-none"
    >
      {/* Left resize handle */}
      <div
        onPointerDown={onStartResizeWidth}
        className="absolute left-0 top-0 bottom-0 z-10 w-1.5 cursor-ew-resize transition-colors hover:bg-primary/10 active:bg-primary/20"
      />

      <button
        type="button"
        className={`flex w-full shrink-0 cursor-pointer items-start gap-2 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40 ${
          expanded ? 'border-b border-neutral-200' : ''
        }`}
        aria-expanded={expanded}
        aria-controls={panelId}
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Selected object
          </p>
          <h3 className="truncate text-sm font-semibold text-neutral-900">
            {getObjectTitle(objectData)}
          </h3>
        </div>
      </button>

      <div
        className={`grid min-h-0 transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            id={panelId}
            inert={!expanded}
            style={{
              height:
                height > 0
                  ? `${height}px`
                  : expanded
                    ? 'min(80vh, calc(100vh - 8rem))'
                    : undefined,
            }}
            className="flex min-h-0 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
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

            <div
              onPointerDown={onStartResizeHeight}
              className="h-1.5 shrink-0 cursor-ns-resize transition-colors hover:bg-primary/10 active:bg-primary/20"
            />
          </div>
        </div>
      </div>
    </aside>
  )
}
