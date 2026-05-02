import type {
	ClashContextRecommendation,
	CoordinationWatchListEntry,
} from "./postClashAnalysis";

export type { ClashContextRecommendation, CoordinationWatchListEntry };

/** One recommendation row for UI (legacy string blobs or structured API objects). */
export interface ClashRecommendationItem {
	raw: string;
	parsed: ClashContextRecommendation | null;
}

/** One coordination watch-list row for UI. */
export interface CoordinationWatchListItemRow {
	raw: string;
	parsed: CoordinationWatchListEntry | null;
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

function coerceStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((x): x is string => typeof x === "string");
}

function recommendationFromLooseRecord(
	parsed: Record<string, string>,
): ClashContextRecommendation | null {
	const priority = (parsed.priority ?? "").trim();
	const lead_trade = (parsed.lead_trade ?? "Unspecified").trim();
	const design_impact = (parsed.design_impact ?? "").trim();
	const effort_level = (parsed.effort_level ?? "").trim();
	if (!priority || !lead_trade || !design_impact || !effort_level) {
		return null;
	}

	let actions: string[] = [];
	const rawActions = parsed.actions;
	if (rawActions) {
		try {
			const a = JSON.parse(rawActions) as unknown;
			actions = coerceStringList(a);
		} catch {
			actions = [];
		}
	}
	const technicalAction = parsed.technical_action?.trim();
	if (actions.length === 0 && technicalAction) {
		actions = [technicalAction];
	}

	let feasibility_validations: string[] = [];
	const rawVal = parsed.feasibility_validations ?? parsed.validations;
	if (rawVal) {
		try {
			const v = JSON.parse(rawVal) as unknown;
			feasibility_validations = coerceStringList(v);
		} catch {
			feasibility_validations = [];
		}
	}

	let supporting_trades: string[] = [];
	const rawSupports = parsed.supporting_trades;
	if (rawSupports) {
		try {
			const s = JSON.parse(rawSupports) as unknown;
			supporting_trades = coerceStringList(s);
		} catch {
			supporting_trades = [];
		}
	}

	return {
		priority,
		lead_trade,
		supporting_trades,
		design_impact,
		effort_level,
		actions,
		feasibility_validations,
	};
}

/** Parse a loose recommendation string (legacy / debug paths). */
export function parseClashRecommendation(
	raw: string,
): ClashContextRecommendation | null {
	const trimmed = raw.trim();
	if (trimmed.startsWith("{")) {
		try {
			const obj = JSON.parse(trimmed) as unknown;
			if (obj && typeof obj === "object" && !Array.isArray(obj)) {
				const v = validateRecommendation(obj as ClashContextRecommendation);
				if (v) return v;
			}
		} catch {
			/* fall through */
		}
	}
	const flat =
		parseJsonObjectStrings(raw) ?? parsePythonishDictString(raw);
	if (!flat) return null;
	return recommendationFromLooseRecord(flat);
}

function validateRecommendation(
	item: ClashContextRecommendation,
): ClashContextRecommendation | null {
	const priority = item.priority?.trim() ?? "";
	const lead_trade = item.lead_trade?.trim() ?? "";
	const design_impact = item.design_impact?.trim() ?? "";
	const effort_level = item.effort_level?.trim() ?? "";
	if (!priority || !lead_trade || !design_impact || !effort_level) {
		return null;
	}
	return {
		priority,
		lead_trade,
		supporting_trades: Array.isArray(item.supporting_trades)
			? item.supporting_trades.filter((x): x is string => typeof x === "string")
			: [],
		design_impact,
		effort_level,
		actions: Array.isArray(item.actions)
			? item.actions.filter((x): x is string => typeof x === "string")
			: [],
		feasibility_validations: Array.isArray(item.feasibility_validations)
			? item.feasibility_validations.filter(
					(x): x is string => typeof x === "string",
				)
			: [],
	};
}

export function parseCoordinationWatchListEntry(
	raw: string,
): CoordinationWatchListEntry | null {
	const trimmed = raw.trim();
	if (trimmed.startsWith("{")) {
		try {
			const obj = JSON.parse(trimmed) as unknown;
			if (obj && typeof obj === "object" && !Array.isArray(obj)) {
				const o = obj as Record<string, unknown>;
				const category =
					typeof o.category === "string" ? o.category.trim() : "";
				const specific_taskRaw =
					(typeof o.specific_task === "string" && o.specific_task) ||
					(typeof o.specific_metric === "string" && o.specific_metric) ||
					"";
				const specific_task = specific_taskRaw.trim();
				if (category && specific_task) {
					return { category, specific_task };
				}
			}
		} catch {
			/* fall through */
		}
	}
	const flat =
		parseJsonObjectStrings(raw) ?? parsePythonishDictString(raw);
	if (!flat) return null;
	const category = (flat.category ?? "").trim();
	const specific_task =
		(flat.specific_task ?? flat.specific_metric ?? "").trim();
	if (!category || !specific_task) return null;
	return { category, specific_task };
}

export function normalizeClashRecommendations(
	rawList: Array<string | ClashContextRecommendation>,
): ClashRecommendationItem[] {
	return rawList.map((item) => {
		if (typeof item === "string") {
			return { raw: item, parsed: parseClashRecommendation(item) };
		}
		return {
			raw: JSON.stringify(item),
			parsed: validateRecommendation(item),
		};
	});
}

export function normalizeCoordinationWatchList(
	rawList: Array<string | CoordinationWatchListEntry>,
): CoordinationWatchListItemRow[] {
	return rawList.map((item) => {
		if (typeof item === "string") {
			return { raw: item, parsed: parseCoordinationWatchListEntry(item) };
		}
		const category = item.category?.trim() ?? "";
		const specific_task = item.specific_task?.trim() ?? "";
		const parsed =
			category.length > 0 && specific_task.length > 0
				? { category, specific_task }
				: null;
		return {
			raw: JSON.stringify(item),
			parsed,
		};
	});
}

/** @deprecated Use normalizeCoordinationWatchList */
export const normalizeClashWatchOut = normalizeCoordinationWatchList;

export function recommendationItemDisplayText(
	item: ClashRecommendationItem,
): string {
	if (!item.parsed) return item.raw;
	const r = item.parsed;
	const supporting =
		r.supporting_trades.length > 0
			? ` Supporting trades: ${r.supporting_trades.join(", ")}.`
			: "";
	const actions =
		r.actions.length > 0 ? ` Actions: ${r.actions.join("; ")}.` : "";
	const validations =
		r.feasibility_validations.length > 0
			? ` Feasibility validations: ${r.feasibility_validations.join("; ")}.`
			: "";
	return `${r.priority}. Lead: ${r.lead_trade}.${supporting} Design impact: ${r.design_impact}. Effort: ${r.effort_level}.${actions}${validations}`;
}
