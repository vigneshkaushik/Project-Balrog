export interface ClashRecommendation {
	priority: string;
	technicalAction: string;
	designImpact: string;
	effortLevel: string;
}

export interface ClashWatchOut {
	category: string;
	specificMetric: string;
}

export interface ClashRecommendationItem {
	raw: string;
	parsed: ClashRecommendation | null;
}

export interface ClashWatchOutItem {
	raw: string;
	parsed: ClashWatchOut | null;
}

/**
 * Parse dict-shaped strings that often come from `str(dict)` on the API
 * (`normalize_analysis_result` uses `str(x)` on list items).
 *
 * Python uses double-quoted string values when the text contains apostrophes
 * (e.g. `"column's"`), so `'key': 'value'`-only parsing misses those entries.
 */
function parsePythonishDictString(raw: string): Record<string, string> | null {
	const trimmed = raw.trim();
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
	const parsed: Record<string, string> = {};
	// 'key': 'value' OR 'key': "value" (double-quoted segment may contain ')
	const pairRe =
		/'([^']+)'\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
	let match: RegExpExecArray | null;
	while (true) {
		match = pairRe.exec(trimmed);
		if (!match) break;
		const key = match[1];
		const vSq = match[2];
		const vDq = match[3];
		const value = vDq !== undefined ? vDq : (vSq ?? "");
		parsed[key] = value
			.replace(/\\([\\'"nrt])/g, (_c, ch: string) => {
				if (ch === "n") return "\n";
				if (ch === "r") return "\r";
				if (ch === "t") return "\t";
				return ch;
			})
			.replace(/\\u([0-9a-fA-F]{4})/g, (_c, hex: string) =>
				String.fromCharCode(Number.parseInt(hex, 16)),
			);
	}
	return Object.keys(parsed).length > 0 ? parsed : null;
}

function parseJsonObjectStrings(raw: string): Record<string, string> | null {
	const trimmed = raw.trim();
	if (!trimmed.startsWith("{")) return null;
	try {
		const data = JSON.parse(trimmed) as unknown;
		if (!data || typeof data !== "object" || Array.isArray(data)) return null;
		const out: Record<string, string> = {};
		for (const [k, v] of Object.entries(data)) {
			if (typeof v === "string") out[k] = v;
			else if (v != null) out[k] = String(v);
		}
		return Object.keys(out).length > 0 ? out : null;
	} catch {
		return null;
	}
}

export function parseClashRecommendation(raw: string): ClashRecommendation | null {
	const parsed =
		parseJsonObjectStrings(raw) ??
		parsePythonishDictString(raw);
	if (
		!parsed?.priority ||
		!parsed.technical_action ||
		!parsed.design_impact ||
		!parsed.effort_level
	) {
		return null;
	}
	return {
		priority: parsed.priority,
		technicalAction: parsed.technical_action,
		designImpact: parsed.design_impact,
		effortLevel: parsed.effort_level,
	};
}

export function parseClashWatchOut(raw: string): ClashWatchOut | null {
	const parsed =
		parseJsonObjectStrings(raw) ?? parsePythonishDictString(raw);
	if (!parsed?.category || !parsed.specific_metric) return null;
	return {
		category: parsed.category,
		specificMetric: parsed.specific_metric,
	};
}

export function normalizeClashRecommendations(
	rawList: string[],
): ClashRecommendationItem[] {
	return rawList.map((raw) => ({ raw, parsed: parseClashRecommendation(raw) }));
}

export function normalizeClashWatchOut(rawList: string[]): ClashWatchOutItem[] {
	return rawList.map((raw) => ({ raw, parsed: parseClashWatchOut(raw) }));
}

export function recommendationItemDisplayText(item: ClashRecommendationItem): string {
	if (!item.parsed) return item.raw;
	const { priority, technicalAction, designImpact, effortLevel } = item.parsed;
	return `${priority}. Action: ${technicalAction} Design impact: ${designImpact} Effort: ${effortLevel}.`;
}
