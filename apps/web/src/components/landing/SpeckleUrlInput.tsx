import { useApp } from '../../context/useApp'

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <title>Delete</title>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6z" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function SpeckleUrlInput() {
  const {
    speckleUrlRows,
    appendSpeckleUrlRow,
    setSpeckleUrlAt,
    removeSpeckleUrlAt,
  } = useApp()

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        onClick={appendSpeckleUrlRow}
        className="w-full cursor-pointer rounded-lg bg-neutral-200 px-5 py-3 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-300/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        + Add Speckle URL
      </button>

      {speckleUrlRows.length > 0 && (
        <div className="flex flex-col gap-2">
          {speckleUrlRows.map((row, index) => (
            <div
              key={row.id}
              className="flex items-center gap-2"
            >
              <input
                type="url"
                value={row.url}
                onChange={(e) => setSpeckleUrlAt(index, e.target.value)}
                placeholder="https://app.speckle.systems/..."
                aria-label={`Speckle model URL ${index + 1}`}
                className="min-w-0 flex-1 rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
              <button
                type="button"
                onClick={() => removeSpeckleUrlAt(index)}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
                aria-label={`Remove Speckle URL ${index + 1}`}
              >
                <TrashIcon className="pointer-events-none h-[18px] w-[18px]" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
