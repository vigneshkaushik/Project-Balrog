import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react'
import type {
	ClashAnalysisMetadata,
	ClashAnalysisSummary,
	EngineeringScratchpad,
} from '../lib/postClashAnalysis'
import type {
	ClashRecommendationItem,
	CoordinationWatchListItemRow,
} from '../lib/clashAnalysisFormat'

export interface ClashAnalysisResult {
	analysis_metadata: ClashAnalysisMetadata | null
	engineering_scratchpad: EngineeringScratchpad | null
	clash_summary: ClashAnalysisSummary | null
	recommendations: ClashRecommendationItem[]
	coordination_watch_list: CoordinationWatchListItemRow[]
	notes: string | null
}

const EMPTY_ANALYSIS: ClashAnalysisResult = {
	analysis_metadata: null,
	engineering_scratchpad: null,
	clash_summary: null,
	recommendations: [],
	coordination_watch_list: [],
	notes: null,
}

/** Browser-only persistence (survives refresh; cleared with analysis reset / new session flows). */
const CLASH_ANALYSIS_STORAGE_KEY = 'balrog-clash-analysis-v1'

function reviveRecommendationRows(raw: unknown): ClashRecommendationItem[] {
	if (!Array.isArray(raw)) return []
	const out: ClashRecommendationItem[] = []
	for (const row of raw) {
		if (!row || typeof row !== 'object' || Array.isArray(row)) continue
		const o = row as Record<string, unknown>
		const rawStr = typeof o.raw === 'string' ? o.raw : ''
		const parsed =
			o.parsed != null &&
			typeof o.parsed === 'object' &&
			!Array.isArray(o.parsed)
				? (o.parsed as ClashRecommendationItem['parsed'])
				: null
		if (!rawStr && parsed == null) continue
		out.push({
			raw: rawStr || JSON.stringify(parsed ?? {}),
			parsed,
		})
	}
	return out
}

function reviveWatchListRows(raw: unknown): CoordinationWatchListItemRow[] {
	if (!Array.isArray(raw)) return []
	const out: CoordinationWatchListItemRow[] = []
	for (const row of raw) {
		if (!row || typeof row !== 'object' || Array.isArray(row)) continue
		const o = row as Record<string, unknown>
		const rawStr = typeof o.raw === 'string' ? o.raw : ''
		const parsed =
			o.parsed != null &&
			typeof o.parsed === 'object' &&
			!Array.isArray(o.parsed)
				? (o.parsed as CoordinationWatchListItemRow['parsed'])
				: null
		if (!rawStr && parsed == null) continue
		out.push({
			raw: rawStr || JSON.stringify(parsed ?? {}),
			parsed,
		})
	}
	return out
}

function reviveNullableRecord<T extends object>(val: unknown): T | null {
	if (val == null) return null
	if (typeof val !== 'object' || Array.isArray(val)) return null
	return val as T
}

function loadPersistedAnalysis(): Record<string, ClashAnalysisResult> {
	if (typeof window === 'undefined') return {}
	try {
		const raw = window.localStorage.getItem(CLASH_ANALYSIS_STORAGE_KEY)
		if (!raw?.trim()) return {}
		const data = JSON.parse(raw) as unknown
		if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
		const out: Record<string, ClashAnalysisResult> = {}
		for (const [key, val] of Object.entries(
			data as Record<string, unknown>,
		)) {
			const id = key.trim()
			if (
				!id ||
				val == null ||
				typeof val !== 'object' ||
				Array.isArray(val)
			) {
				continue
			}
			const v = val as Record<string, unknown>
			out[id] = {
				analysis_metadata:
					reviveNullableRecord<ClashAnalysisMetadata>(
						v.analysis_metadata,
					),
				engineering_scratchpad:
					reviveNullableRecord<EngineeringScratchpad>(
						v.engineering_scratchpad,
					),
				clash_summary: reviveNullableRecord<ClashAnalysisSummary>(
					v.clash_summary,
				),
				recommendations: reviveRecommendationRows(v.recommendations),
				coordination_watch_list: reviveWatchListRows(
					v.coordination_watch_list,
				),
				notes:
					typeof v.notes === 'string'
						? v.notes
						: v.notes == null
							? null
							: String(v.notes),
			}
		}
		return out
	} catch {
		return {}
	}
}

function persistAnalysisSnapshot(map: Record<string, ClashAnalysisResult>): void {
	try {
		window.localStorage.setItem(
			CLASH_ANALYSIS_STORAGE_KEY,
			JSON.stringify(map),
		)
	} catch {
		/* quota / private mode */
	}
}

function clearPersistedAnalysis(): void {
	try {
		window.localStorage.removeItem(CLASH_ANALYSIS_STORAGE_KEY)
	} catch {
		/* ignore */
	}
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
	>(() => loadPersistedAnalysis())

	useEffect(() => {
		persistAnalysisSnapshot(analysisByClashId)
	}, [analysisByClashId])

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
		setAnalysisByClashId({})
		clearPersistedAnalysis()
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
