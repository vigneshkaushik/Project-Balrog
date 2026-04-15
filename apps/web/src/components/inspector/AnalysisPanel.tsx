import type { ReactNode } from 'react'

interface AnalysisPanelProps {
  title: string
  showTitle?: boolean
  children?: ReactNode
  onRunAnalysis?: () => void
  runAnalysisDisabled?: boolean
  runAnalysisPending?: boolean
}

export function AnalysisPanel({
  title,
  showTitle = true,
  children,
  onRunAnalysis,
  runAnalysisDisabled = false,
  runAnalysisPending = false,
}: AnalysisPanelProps) {
  const busy = runAnalysisPending
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {showTitle ? (
        <h3 className="shrink-0 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {title}
        </h3>
      ) : null}
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain text-sm text-neutral-700">
        {children}
      </div>
      {onRunAnalysis ? (
        <div className="mt-3 flex shrink-0 justify-end">
          <button
            type="button"
            onClick={onRunAnalysis}
            disabled={runAnalysisDisabled || busy}
            className="cursor-pointer rounded-md bg-slate-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-slate-600"
          >
            {busy ? 'Running…' : 'Run Analysis'}
          </button>
        </div>
      ) : null}
    </section>
  )
}
