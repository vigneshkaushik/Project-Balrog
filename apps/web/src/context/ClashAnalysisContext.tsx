import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from 'react'

export interface ClashAnalysisResult {
	/** `analysisRecommendations` — ordered list of resolution strategies. */
	recommendations: string[]
	/** `analysisWatchOut` — list of things to watch out for. */
	watchOutFor: string[]
	/** Optional free-form notes returned by the analysis agent. */
	notes: string | null
}

const EMPTY_ANALYSIS: ClashAnalysisResult = {
	recommendations: [],
	watchOutFor: [],
	notes: null,
}

interface ClashAnalysisContextValue {
	/** Analysis output keyed by `Clash.id`. */
	analysisByClashId: Record<string, ClashAnalysisResult>
	/** Replace the analysis for one clash (overwrites any prior run). */
	setAnalysisForClash: (clashId: string, result: ClashAnalysisResult) => void
	/** Drop stored analysis for one clash (e.g. when user re-runs / deselects). */
	clearAnalysisForClash: (clashId: string) => void
	/** Clear everything (e.g. `clearSession`). */
	clearAllAnalysis: () => void
	/** Convenience: stored result for a clash, or an empty shape. */
	getAnalysisForClash: (clashId: string | null | undefined) => ClashAnalysisResult
}

const ClashAnalysisContext = createContext<ClashAnalysisContextValue | null>(
	null,
)

export function ClashAnalysisProvider({ children }: { children: ReactNode }) {
	const [analysisByClashId, setAnalysisByClashId] = useState<
		Record<string, ClashAnalysisResult>
	>({})

	const setAnalysisForClash = useCallback(
		(clashId: string, result: ClashAnalysisResult) => {
			const id = clashId.trim()
			if (!id) return
			setAnalysisByClashId((prev) => ({ ...prev, [id]: result }))
		},
		[],
	)

	const clearAnalysisForClash = useCallback((clashId: string) => {
		const id = clashId.trim()
		if (!id) return
		setAnalysisByClashId((prev) => {
			if (!(id in prev)) return prev
			const next = { ...prev }
			delete next[id]
			return next
		})
	}, [])

	const clearAllAnalysis = useCallback(() => {
		setAnalysisByClashId((prev) =>
			Object.keys(prev).length === 0 ? prev : {},
		)
	}, [])

	const getAnalysisForClash = useCallback(
		(clashId: string | null | undefined): ClashAnalysisResult => {
			if (!clashId) return EMPTY_ANALYSIS
			return analysisByClashId[clashId] ?? EMPTY_ANALYSIS
		},
		[analysisByClashId],
	)

	const value = useMemo<ClashAnalysisContextValue>(
		() => ({
			analysisByClashId,
			setAnalysisForClash,
			clearAnalysisForClash,
			clearAllAnalysis,
			getAnalysisForClash,
		}),
		[
			analysisByClashId,
			setAnalysisForClash,
			clearAnalysisForClash,
			clearAllAnalysis,
			getAnalysisForClash,
		],
	)

	return (
		<ClashAnalysisContext.Provider value={value}>
			{children}
		</ClashAnalysisContext.Provider>
	)
}

// eslint-disable-next-line react-refresh/only-export-components -- context hook pair
export function useClashAnalysis(): ClashAnalysisContextValue {
	const ctx = useContext(ClashAnalysisContext)
	if (!ctx) {
		throw new Error(
			'useClashAnalysis must be used within ClashAnalysisProvider',
		)
	}
	return ctx
}
