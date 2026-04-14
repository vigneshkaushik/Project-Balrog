import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/useApp'

interface ClashSelectorProps {
  disabled?: boolean
}

export function ClashSelector({ disabled = false }: ClashSelectorProps) {
  const labelId = useId()
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    clashes,
    filteredClashes,
    severityThreshold,
    selectedClashId,
    setSelectedClashId,
  } = useApp()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const normalizedQuery = query.trim().toLowerCase()
  const selectedClash = filteredClashes.find((c) => c.id === selectedClashId)
  const nameFilteredClashes = useMemo(
    () =>
      filteredClashes.filter((c) =>
        c.label.toLowerCase().includes(normalizedQuery),
      ),
    [filteredClashes, normalizedQuery],
  )

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedClash?.label ?? '')
    }
  }, [selectedClash, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [isOpen])

  if (clashes.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white/90 px-3 py-2.5 text-sm text-neutral-500 shadow-sm backdrop-blur-sm">
        <svg className="h-4 w-4 animate-pulse text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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
    <div ref={containerRef} className="relative group">
      <label htmlFor={labelId} className="sr-only">
        Select clash
      </label>

      <div className="flex w-full">
        <input
          id={labelId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false)
              setQuery(selectedClash?.label ?? '')
            }
          }}
          placeholder="Select or type clash name"
          disabled={disabled}
          className={`min-w-0 flex-1 rounded-l-lg border border-r-0 border-neutral-200 bg-white/95 px-3 py-2.5 text-sm font-semibold text-neutral-800 shadow-sm outline-none backdrop-blur-sm transition-all ${
            disabled
              ? 'cursor-not-allowed opacity-60'
              : 'hover:border-neutral-300 hover:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10'
          }`}
        />
        <button
          type="button"
          aria-label={isOpen ? 'Close clash options' : 'Open clash options'}
          onClick={() => setIsOpen((prev) => !prev)}
          disabled={disabled}
          className={`flex w-10 shrink-0 items-center justify-center rounded-r-lg border border-neutral-200 bg-white/95 text-neutral-500 shadow-sm transition ${
            disabled
              ? 'cursor-not-allowed opacity-60'
              : 'cursor-pointer hover:border-neutral-300 hover:bg-white hover:text-neutral-700'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {!disabled && isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 max-h-72 overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setSelectedClashId(null)
              setQuery('')
              setIsOpen(false)
            }}
          >
            De-select Clash
          </button>

          {nameFilteredClashes.length === 0 ? (
            <div className="px-3 py-2 text-xs text-neutral-500">
              No clashes match the current name filter.
            </div>
          ) : (
            nameFilteredClashes.map((c) => (
              <button
                key={c.id}
                type="button"
                className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelectedClashId(c.id)
                  setQuery(c.label)
                  setIsOpen(false)
                }}
              >
                {c.label}
                {c.severity ? (
                  <span className="text-neutral-400"> — {c.severity}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}

      {disabled ? (
        <p className="mt-1 text-[11px] text-neutral-500">
          Clash selector unlocks after the Speckle model finishes loading.
        </p>
      ) : null}
    </div>
  )
}
