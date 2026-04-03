import { useId } from 'react'
import { useApp } from '../../context/useApp'

export function ClashSelector() {
  const labelId = useId()
  const {
    filteredClashes,
    selectedClashId,
    setSelectedClashId,
  } = useApp()

  if (filteredClashes.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500">
        No clashes match this severity filter.
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={labelId} className="sr-only">
        Select clash
      </label>
      <select
        id={labelId}
        value={selectedClashId ?? ''}
        onChange={(e) => setSelectedClashId(e.target.value || null)}
        className="w-full max-w-xs rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
      >
        {filteredClashes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label} (severity {c.severity})
          </option>
        ))}
      </select>
    </div>
  )
}
