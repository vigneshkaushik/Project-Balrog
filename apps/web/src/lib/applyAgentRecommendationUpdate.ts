import type { ClashAnalysisResult } from '../context/ClashAnalysisContext'
import { normalizeClashRecommendations } from './clashAnalysisFormat'
import type { ClashContextRecommendation } from './postClashAnalysis'

function readNonNegativeInt(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) {
		const n = Math.trunc(value)
		if (n >= 0 && Object.is(value, n)) return n
	}
	if (typeof value === 'string' && value.trim().length > 0) {
		const n = Number.parseInt(value, 10)
		if (!Number.isNaN(n) && n >= 0) return n
	}
	return null
}

function readClashId(value: unknown): string | null {
	if (typeof value !== 'string') return null
	const id = value.trim()
	return id.length > 0 ? id : null
}

/**
 * LlamaIndex uses `fn.__name__` when `name=` is omitted, so underscored Python helpers
 * surface as `_update_clash_recommendation`. Accept aliases so SSE handlers stay reliable.
 */
export function isUpdateClashRecommendationToolName(toolName: string): boolean {
	const base = toolName.trim().toLowerCase().replace(/^_+/, '')
	return (
		base === 'update_clash_recommendation' ||
		base === 'update_clash_recommendations'
	)
}

/**
 * Apply `update_clash_recommendation` tool kwargs from SSE into clash analysis state.
 */
export function applyAgentRecommendationUpdate(
	toolKwargs: Record<string, unknown>,
	getAnalysisForClash: (
		clashId: string | null | undefined,
	) => ClashAnalysisResult,
	setAnalysisForClash: (clashId: string, result: ClashAnalysisResult) => void,
): void {
	const clashId = readClashId(toolKwargs.clash_id ?? toolKwargs.clashId)
	const recommendationIndex = readNonNegativeInt(
		toolKwargs.recommendation_index ?? toolKwargs.recommendationIndex,
	)
	const rawRec = toolKwargs.recommendation

	if (clashId == null || recommendationIndex == null) {
		console.warn(
			'[Balrog] update_clash_recommendation: missing clash_id or recommendation_index',
			toolKwargs,
		)
		return
	}

	const normalized =
		rawRec != null && typeof rawRec === 'object' && !Array.isArray(rawRec)
			? normalizeClashRecommendations([rawRec as ClashContextRecommendation])[0]
			: null

	if (!normalized?.parsed) {
		console.warn(
			'[Balrog] update_clash_recommendation: invalid recommendation payload',
			rawRec,
		)
		return
	}

	const prev = getAnalysisForClash(clashId)
	if (
		recommendationIndex < 0 ||
		recommendationIndex >= prev.recommendations.length
	) {
		console.warn(
			`[Balrog] update_clash_recommendation: index ${recommendationIndex} out of range for clash ${clashId}`,
		)
		return
	}

	const nextRecs = [...prev.recommendations]
	nextRecs[recommendationIndex] = normalized

	setAnalysisForClash(clashId, {
		...prev,
		recommendations: nextRecs,
	})
}
