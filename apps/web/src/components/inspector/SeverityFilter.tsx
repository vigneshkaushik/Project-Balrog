import { useId, useState } from 'react'
import { useApp } from '../../context/useApp'
import type { ClashSeverity } from '../../types'

const SEVERITY_OPTIONS: ClashSeverity[] = ['LOW', 'MEDIUM', 'CRITICAL']

function severityToIndex(s: ClashSeverity): number {
  const i = SEVERITY_OPTIONS.indexOf(s)
  return i >= 0 ? i : 0
}

export function SeverityFilter() {
  const labelId = useId()
  const rangeId = useId()
  const panelId = useId()
  const [expanded, setExpanded] = useState(true)
  const { severityThreshold, setSeverityThreshold, filteredClashes } = useApp()
  const stepIndex = severityToIndex(severityThreshold)

  return (
    <div className="w-full rounded-xl border border-neutral-200 bg-white/95 p-4 shadow-md backdrop-blur-sm">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500/60"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
      >
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform duration-300 ease-out motion-reduce:transition-none ${
            expanded ? 'rotate-0' : '-rotate-90'
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          focusable="false"
        >
          <title>Expand or collapse severity filter</title>
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
        <h3 id={labelId} className="text-sm font-semibold text-neutral-900">
          Severity filter
        </h3>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div
          className="min-h-0 overflow-hidden"
          id={panelId}
          inert={!expanded}
        >
          <div className="pt-3">
            <label
              htmlFor={rangeId}
              className="block text-xs font-medium text-neutral-600"
            >
              Minimum severity (drag to a stop: LOW, MEDIUM, CRITICAL)
            </label>
            <div className="mt-2 px-1">
              <datalist id={`${rangeId}-stops`}>
                {SEVERITY_OPTIONS.map((level, i) => (
                  <option key={level} value={String(i)} />
                ))}
              </datalist>
              <input
                id={rangeId}
                type="range"
                min={0}
                max={SEVERITY_OPTIONS.length - 1}
                step={1}
                list={`${rangeId}-stops`}
                value={stepIndex}
                onChange={(e) =>
                  setSeverityThreshold(
                    SEVERITY_OPTIONS[Number(e.target.value)] as ClashSeverity,
                  )
                }
                aria-valuemin={0}
                aria-valuemax={SEVERITY_OPTIONS.length - 1}
                aria-valuenow={stepIndex}
                aria-valuetext={`Minimum severity ${severityThreshold}`}
                aria-labelledby={labelId}
                className="h-2 w-full cursor-pointer accent-red-500"
              />
              <div
                className="mt-1.5 flex justify-between text-[10px] font-medium uppercase tracking-wide text-neutral-500"
                aria-hidden
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <span
                    key={s}
                    className={
                      s === severityThreshold ? 'text-red-600' : undefined
                    }
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-3 text-sm text-neutral-800">
              <span className="font-medium text-red-600">
                {filteredClashes.length}
              </span>{' '}
              clash{filteredClashes.length === 1 ? '' : 'es'} with minimum
              severity{' '}
              <span className="font-medium text-red-600">
                {severityThreshold}
              </span>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
