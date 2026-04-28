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

export interface ClashAnalyzeContextResponseBody {
	engineering_scratchpad: {
		identified_constraint: string;
		dimensional_considerations: string;
	} | null;
	clash_summary: {
		elements_involved: string[];
		yielding_element: string;
		anchor_constraint: string;
	} | null;
	watch_out_for: Array<{
		category: string;
		specific_metric: string;
	}>;
	recommendations: Array<{
		priority: string;
		technical_action: string;
		design_impact: string;
		effort_level: string;
		validations?: string[];
	}>;
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

	const watch = data.watch_out_for;
	const rec = data.recommendations;
	const notes = data.notes;
	const scratchpad = data.engineering_scratchpad;
	const summary = data.clash_summary;

	return {
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
		watch_out_for: Array.isArray(watch)
			? watch
					.filter(isRecord)
					.map((item) => ({
						category:
							typeof item.category === "string" ? item.category : "",
						specific_metric:
							typeof item.specific_metric === "string"
								? item.specific_metric
								: "",
					}))
					.filter(
						(item) =>
							item.category.trim().length > 0 &&
							item.specific_metric.trim().length > 0,
					)
			: [],
		recommendations: Array.isArray(rec)
			? rec
					.filter(isRecord)
					.map((item) => ({
						priority:
							typeof item.priority === "string" ? item.priority : "",
						technical_action:
							typeof item.technical_action === "string"
								? item.technical_action
								: "",
						design_impact:
							typeof item.design_impact === "string"
								? item.design_impact
								: "",
						effort_level:
							typeof item.effort_level === "string" ? item.effort_level : "",
						validations: Array.isArray(item.validations)
							? item.validations.filter((x): x is string => typeof x === "string")
							: [],
					}))
					.filter(
						(item) =>
							item.priority.trim().length > 0 &&
							item.technical_action.trim().length > 0 &&
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
