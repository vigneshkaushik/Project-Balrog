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

function parseSingleQuotedObject(raw: string): Record<string, string> | null {
	const trimmed = raw.trim();
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
	const parsed: Record<string, string> = {};
	const pairRe = /'([^']+)'\s*:\s*'([^']*)'/g;
	let match: RegExpExecArray | null;
	while (true) {
		match = pairRe.exec(trimmed);
		if (!match) break;
		parsed[match[1]] = match[2];
	}
	return Object.keys(parsed).length > 0 ? parsed : null;
}

export function parseClashRecommendation(raw: string): ClashRecommendation | null {
	const parsed = parseSingleQuotedObject(raw);
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
	const parsed = parseSingleQuotedObject(raw);
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
