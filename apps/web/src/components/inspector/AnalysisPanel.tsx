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
    <section className="flex min-h-[160px] flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
      <div className="mt-3 min-h-[72px] flex-1 text-sm text-neutral-600">
        {children}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onRunAnalysis}
          className="cursor-pointer rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          Run Analysis
        </button>
      </div>
    </section>
  )
}
