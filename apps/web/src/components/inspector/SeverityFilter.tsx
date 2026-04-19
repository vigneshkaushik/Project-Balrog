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
  const {
    severityThreshold,
    setSeverityThreshold,
    filteredClashes,
    highlightFilteredSeverity,
    setHighlightFilteredSeverity,
  } = useApp()
  const stepIndex = severityToIndex(severityThreshold)

  return (
    <div className="w-full rounded-xl border border-neutral-200 bg-white/95 p-4 shadow-lg backdrop-blur-md transition-all hover:shadow-xl">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 group"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <h3 id={labelId} className="text-sm font-semibold tracking-tight text-neutral-900">
            Severity Filter
          </h3>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-300 ease-in-out group-hover:text-neutral-600 ${
            expanded ? 'rotate-180' : 'rotate-0'
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <div
        className={`grid transition-[grid-template-rows,margin-top,opacity] duration-300 ease-in-out ${
          expanded ? 'grid-rows-[1fr] mt-4 opacity-100' : 'grid-rows-[0fr] mt-0 opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="min-h-0 overflow-hidden"
          id={panelId}
          inert={!expanded}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor={rangeId}
                className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                Severity (exact match)
              </label>

              <div className="relative px-1 pt-1">
                <input
                  id={rangeId}
                  type="range"
                  min={0}
                  max={SEVERITY_OPTIONS.length - 1}
                  step={1}
                  value={stepIndex}
                  onChange={(e) =>
                    setSeverityThreshold(
                      SEVERITY_OPTIONS[Number(e.target.value)] as ClashSeverity,
                    )
                  }
                  aria-valuemin={0}
                  aria-valuemax={SEVERITY_OPTIONS.length - 1}
                  aria-valuenow={stepIndex}
                  aria-valuetext={`Show only ${severityThreshold} clashes`}
                  aria-labelledby={labelId}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-100 accent-primary focus:outline-none"
                />
                <div
                  className="mt-2 flex justify-between text-xs font-medium text-neutral-400"
                  aria-hidden
                >
                  {SEVERITY_OPTIONS.map((s, i) => (
                    <span
                      key={s}
                      className={i === stepIndex ? 'text-primary' : undefined}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-semibold text-primary shadow-sm ring-1 ring-neutral-200">
                {filteredClashes.length}
              </div>
              <p className="text-xs font-medium text-neutral-600">
                Clash{filteredClashes.length === 1 ? '' : 'es'} visible
              </p>
              <button
                type="button"
                onClick={() =>
                  setHighlightFilteredSeverity(!highlightFilteredSeverity)
                }
                className={`ml-auto cursor-pointer rounded-md border px-2 py-1 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 ${
                  highlightFilteredSeverity
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100'
                }`}
                aria-pressed={highlightFilteredSeverity}
              >
                {highlightFilteredSeverity ? 'Focused' : 'Highlight'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
