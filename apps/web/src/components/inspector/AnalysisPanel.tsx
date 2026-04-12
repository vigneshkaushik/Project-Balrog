import type { ReactNode } from 'react'

interface AnalysisPanelProps {
  title: string
  children?: ReactNode
  onRunAnalysis?: () => void
}

export function AnalysisPanel({
  title,
  children,
  onRunAnalysis,
}: AnalysisPanelProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <h3 className="shrink-0 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h3>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain text-sm text-neutral-700">
        {children}
      </div>
      <div className="mt-3 flex shrink-0 justify-end">
        <button
          type="button"
          onClick={onRunAnalysis}
          className="cursor-pointer rounded-md bg-slate-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          Run Analysis
        </button>
      </div>
    </section>
  )
}
