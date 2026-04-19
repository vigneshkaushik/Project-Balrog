import type { Clash } from "../types";
import { getApiBaseUrl } from "./apiBase";
import type {
	ContextRegionPayload,
	NearbySpeckleObjectPayload,
} from "./clashContextRegion";

const MAX_BODY_BYTES = 550_000;

export type ClashObjectWithUserMetadata = NonNullable<Clash["objects"]>[number] & {
	user_metadata?: string;
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
	};
}

export interface ClashAnalyzeContextResponseBody {
	watch_out_for: string[];
	recommendations: string[];
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

	return {
		watch_out_for: Array.isArray(watch)
			? watch.filter((x): x is string => typeof x === "string")
			: [],
		recommendations: Array.isArray(rec)
			? rec.filter((x): x is string => typeof x === "string")
			: [],
		notes:
			typeof notes === "string" ? notes : notes == null ? null : String(notes),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
