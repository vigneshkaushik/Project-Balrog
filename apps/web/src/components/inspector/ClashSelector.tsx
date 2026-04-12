import { useId } from 'react'
import { useApp } from '../../context/useApp'

export function ClashSelector() {
  const labelId = useId()
  const {
    clashes,
    filteredClashes,
    severityThreshold,
    selectedClashId,
    setSelectedClashId,
  } = useApp()

  if (clashes.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white/90 px-3 py-2.5 text-sm text-neutral-500 shadow-sm backdrop-blur-sm">
        <svg className="h-4 w-4 animate-pulse text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        No clashes loaded yet.
      </div>
    )
  }

  if (filteredClashes.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-xs leading-relaxed text-amber-800 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2 font-semibold">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          No matches
        </div>
        <p className="mt-1 opacity-90">
          No clashes are inferred as {severityThreshold}. Try another severity or wait until
          inference finishes.
        </p>
      </div>
    )
  }

  return (
    <div className="relative group">
      <label htmlFor={labelId} className="sr-only">
        Select clash
      </label>
      
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400 group-focus-within:text-primary transition-colors">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>

      <select
        id={labelId}
        value={selectedClashId ?? ''}
        onChange={(e) => setSelectedClashId(e.target.value || null)}
        className="w-full appearance-none rounded-lg border border-neutral-200 bg-white/95 pl-9 pr-10 py-2.5 text-sm font-semibold text-neutral-800 shadow-sm outline-none backdrop-blur-sm transition-all hover:border-neutral-300 hover:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10"
      >
        {filteredClashes.map((c) => (
          <option key={c.id} value={c.id} className="font-sans py-2">
            {c.label} {c.severity ? `— ${c.severity}` : ''}
          </option>
        ))}
      </select>

      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral-400 group-hover:text-neutral-600 transition-colors">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}
