import type { Clash } from "../types";
import { getApiBaseUrl } from "./apiBase";
import type {
	ContextRegionPayload,
	NearbySpeckleObjectPayload,
} from "./clashContextRegion";

const MAX_BODY_BYTES = 550_000;

export type ClashObjectWithUserMetadata = NonNullable<Clash["objects"]>[number] & {
	user_metadata?: string;
	speckle_objects?: Array<Record<string, unknown>>;
};

export interface ClashAnalyzeContextRequestBody {
	clash: Clash;
	clash_objects_original: ClashObjectWithUserMetadata[] | undefined;
	context_region: ContextRegionPayload | null;
	nearby_speckle_objects: NearbySpeckleObjectPayload[];
	meta: {
		speckle_url_count: number;
		capped: boolean;
		unmatched_clash_keys?: string[];
		user_object_metadata?: Record<string, string>;
	};
}

/** Mirrors `ClashAnalyzeContextResponse` / `clash_analysis_parse` on the API. */
export interface ClashAnalysisMetadata {
	playbook_source: string;
	severity: string;
	severity_justification: string;
}

export interface EngineeringScratchpad {
	identified_constraint: string;
	dimensional_considerations: string;
	logic_path: string;
}

export interface ClashAnalysisSummary {
	elements_involved: string[];
	yielding_element: string;
	anchor_constraint: string;
}

export interface ClashContextRecommendation {
	priority: string;
	lead_trade: string;
	supporting_trades: string[];
	design_impact: string;
	effort_level: string;
	actions: string[];
	feasibility_validations: string[];
}

export interface CoordinationWatchListEntry {
	category: string;
	specific_task: string;
}

export interface ClashAnalyzeContextResponseBody {
	analysis_metadata: ClashAnalysisMetadata | null;
	engineering_scratchpad: EngineeringScratchpad | null;
	clash_summary: ClashAnalysisSummary | null;
	coordination_watch_list: CoordinationWatchListEntry[];
	recommendations: ClashContextRecommendation[];
	notes: string | null;
}

export async function postClashAnalyzeContext(
	body: ClashAnalyzeContextRequestBody,
	options?: { signal?: AbortSignal },
): Promise<ClashAnalyzeContextResponseBody> {
	const json = JSON.stringify(body);
	if (json.length > MAX_BODY_BYTES) {
		throw new Error(
			`Analysis payload is too large (${json.length} bytes). Try a smaller context region or fewer loaded models.`,
		);
	}

	const res = await fetch(`${getApiBaseUrl()}/clashes/analyze-context`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: json,
		signal: options?.signal,
	});

	const text = await res.text();
	let data: unknown = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		/* non-JSON error */
	}

	if (!res.ok) {
		let detail: string;
		if (isRecord(data) && data.detail !== undefined) {
			const d = data.detail;
			detail = typeof d === "string" ? d : JSON.stringify(d);
		} else {
			detail = text || res.statusText;
		}
		throw new Error(detail || `Analysis failed (${res.status})`);
	}

	if (!isRecord(data)) {
		throw new Error("Invalid analysis response");
	}

	const metadata = data.analysis_metadata;
	const watch = data.coordination_watch_list;
	const rec = data.recommendations;
	const notes = data.notes;
	const scratchpad = data.engineering_scratchpad;
	const summary = data.clash_summary;

	return {
		analysis_metadata: isRecord(metadata)
			? {
					playbook_source:
						typeof metadata.playbook_source === "string"
							? metadata.playbook_source
							: "",
					severity: typeof metadata.severity === "string" ? metadata.severity : "",
					severity_justification:
						typeof metadata.severity_justification === "string"
							? metadata.severity_justification
							: "",
				}
			: null,
		engineering_scratchpad: isRecord(scratchpad)
			? {
					identified_constraint:
						typeof scratchpad.identified_constraint === "string"
							? scratchpad.identified_constraint
							: "",
					dimensional_considerations:
						typeof scratchpad.dimensional_considerations === "string"
							? scratchpad.dimensional_considerations
							: "",
					logic_path:
						typeof scratchpad.logic_path === "string"
							? scratchpad.logic_path
							: "",
				}
			: null,
		clash_summary: isRecord(summary)
			? {
					elements_involved: Array.isArray(summary.elements_involved)
						? summary.elements_involved.filter(
								(x): x is string => typeof x === "string",
							)
						: [],
					yielding_element:
						typeof summary.yielding_element === "string"
							? summary.yielding_element
							: "",
					anchor_constraint:
						typeof summary.anchor_constraint === "string"
							? summary.anchor_constraint
							: "",
				}
			: null,
		coordination_watch_list: Array.isArray(watch)
			? watch
					.filter(isRecord)
					.map((item) => ({
						category:
							typeof item.category === "string" ? item.category : "",
						specific_task:
							typeof item.specific_task === "string"
								? item.specific_task
								: "",
					}))
					.filter(
						(item) =>
							item.category.trim().length > 0 &&
							item.specific_task.trim().length > 0,
					)
			: [],
		recommendations: Array.isArray(rec)
			? rec
					.filter(isRecord)
					.map((item) => ({
						priority:
							typeof item.priority === "string" ? item.priority : "",
						lead_trade:
							typeof item.lead_trade === "string" ? item.lead_trade : "",
						supporting_trades: Array.isArray(item.supporting_trades)
							? item.supporting_trades.filter((x): x is string => typeof x === "string")
							: [],
						actions: Array.isArray(item.actions)
							? item.actions.filter((x): x is string => typeof x === "string")
							: [],
						design_impact:
							typeof item.design_impact === "string"
								? item.design_impact
								: "",
						effort_level:
							typeof item.effort_level === "string" ? item.effort_level : "",
						feasibility_validations: Array.isArray(item.feasibility_validations)
							? item.feasibility_validations.filter(
									(x): x is string => typeof x === "string",
								)
							: [],
					}))
					.filter(
						(item) =>
							item.priority.trim().length > 0 &&
							item.lead_trade.trim().length > 0 &&
							item.design_impact.trim().length > 0 &&
							item.effort_level.trim().length > 0,
					)
			: [],
		notes:
			typeof notes === "string" ? notes : notes == null ? null : String(notes),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
