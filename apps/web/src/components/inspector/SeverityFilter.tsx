import { useId } from 'react'
import { useApp } from '../../context/useApp'

export function SeverityFilter() {
  const labelId = useId()
  const { severityThreshold, setSeverityThreshold, filteredClashes } = useApp()

  return (
    <div className="rounded-xl border border-neutral-200 bg-white/95 p-4 shadow-md backdrop-blur-sm">
      <h3 id={labelId} className="text-sm font-semibold text-neutral-900">
        Severity Scale Filter
      </h3>
      <div className="mt-3">
        <label htmlFor={`${labelId}-range`} className="sr-only">
          Minimum severity (0 to 10)
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">0</span>
          <input
            id={`${labelId}-range`}
            type="range"
            min={0}
            max={10}
            step={1}
            value={severityThreshold}
            onChange={(e) => setSeverityThreshold(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer accent-red-500"
          />
          <span className="text-xs text-neutral-500">10</span>
        </div>
      </div>
      <p className="mt-3 text-sm text-neutral-800">
        <span className="font-medium text-red-600">{filteredClashes.length}</span>{' '}
        clashes with severity{' '}
        <span className="font-medium text-red-600">{severityThreshold}</span> or
        higher.
      </p>
    </div>
  )
}
