import type { Viewer } from "@speckle/viewer";
import { Box3, Vector3 } from "three";
import type { Clash } from "../types";
import {
	resolveClashObjectNodes,
	unionBoxesForSpeckleObjectIds,
} from "./zoomToSmallestClashObject";

const DEFAULT_EXPAND_METERS = 2;
const MAX_NEARBY_OBJECTS = 120;
const MAX_SUMMARY_CHARS_PER_OBJECT = 4000;

function readExpandMeters(): number {
	const raw = import.meta.env.VITE_CLASH_ANALYSIS_CONTEXT_EXPAND_METERS;
	if (typeof raw !== "string" || !raw.trim()) return DEFAULT_EXPAND_METERS;
	const n = Number.parseFloat(raw.trim());
	return Number.isFinite(n) && n >= 0 ? n : DEFAULT_EXPAND_METERS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const HIDDEN_KEYS = new Set([
	"__closure",
	"__parents",
	"bbox",
	"children",
	"displayStyle",
	"displayValue",
	"elements",
	"geometry",
	"renderMaterial",
	"transform",
	"@displayValue",
]);

const PRIORITY_KEYS = [
	"id",
	"name",
	"type",
	"speckle_type",
	"applicationId",
	"category",
	"level",
	"family",
	"units",
	"builtInCategory",
] as const;

function sortKeys(keys: string[]): string[] {
	const priority = new Map(PRIORITY_KEYS.map((k, i) => [k, i] as const));
	return [...keys].sort((a, b) => {
		const pa = priority.get(a) ?? 999;
		const pb = priority.get(b) ?? 999;
		if (pa !== pb) return pa - pb;
		return a.localeCompare(b);
	});
}

/** Shallow + one-level nested summary of a Speckle `raw` object for LLM payload. */
export function summarizeSpeckleRaw(
	raw: Record<string, unknown>,
	maxChars: number = MAX_SUMMARY_CHARS_PER_OBJECT,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	let budget = maxChars;

	const keys = sortKeys(
		Object.keys(raw).filter((k) => !HIDDEN_KEYS.has(k) && !k.startsWith("__")),
	);

	for (const key of keys) {
		if (budget <= 0) break;
		const v = raw[key];
		if (
			v == null ||
			typeof v === "string" ||
			typeof v === "number" ||
			typeof v === "boolean"
		) {
			const s = JSON.stringify({ [key]: v });
			if (s.length <= budget) {
				out[key] = v;
				budget -= s.length;
			}
			break;
		}
		if (Array.isArray(v)) {
			out[key] = `(${v.length} items)`;
			budget -= 32;
			continue;
		}
		if (isRecord(v)) {
			const nested: Record<string, unknown> = {};
			for (const [nk, nv] of Object.entries(v)) {
				if (budget <= 0) break;
				if (
					nv == null ||
					typeof nv === "string" ||
					typeof nv === "number" ||
					typeof nv === "boolean"
				) {
					nested[nk] = nv;
					budget -= String(nk).length + 20;
				}
			}
			out[key] = nested;
			continue;
		}
		out[key] = String(v).slice(0, 120);
		budget -= 120;
	}
	return out;
}

export interface ContextRegionPayload {
	min: [number, number, number];
	max: [number, number, number];
	expand_meters: number;
	source: "clash_geometry" | "clash_point" | "none";
}

function clashMatchKeys(clash: Clash): string[] {
	const keys = new Set<string>();
	for (const obj of clash.objects ?? []) {
		const e = obj.elementId?.trim();
		if (e) keys.add(e);
		const g = obj.revitGlobalId?.trim();
		if (g) keys.add(g);
	}
	return [...keys];
}

function boxFromClashPoint(clash: Clash): Box3 | null {
	const p = clash.clashPoint;
	if (!p) return null;
	const x = p.x;
	const y = p.y;
	const z = p.z;
	if (x == null || y == null || z == null) return null;
	if (!Number.isFinite(x + y + z)) return null;
	const v = new Vector3(x, y, z);
	const b = new Box3();
	b.setFromCenterAndSize(v, new Vector3(1e-3, 1e-3, 1e-3));
	return b;
}

function boxToPayload(
	box: Box3,
	expandMeters: number,
	source: ContextRegionPayload["source"],
): ContextRegionPayload {
	const min: [number, number, number] = [box.min.x, box.min.y, box.min.z];
	const max: [number, number, number] = [box.max.x, box.max.y, box.max.z];
	return { min, max, expand_meters: expandMeters, source };
}

export interface NearbySpeckleObjectPayload {
	id: string;
	speckle_type: string | null;
	summary: Record<string, unknown>;
}

/**
 * Build expanded world AABB around clash participants; collect Speckle objects
 * whose render views intersect that box.
 */
export function buildClashContextAnalysisPayload(
	viewer: Viewer,
	clash: Clash,
	options?: { expandMeters?: number; speckleUrlCount?: number },
): {
	context_region: ContextRegionPayload | null;
	nearby_speckle_objects: NearbySpeckleObjectPayload[];
	unmatched_clash_keys: string[];
	meta: { speckle_url_count: number; capped: boolean };
} {
	const expandMeters = options?.expandMeters ?? readExpandMeters();
	const speckleUrlCount = options?.speckleUrlCount ?? 0;
	const keys = clashMatchKeys(clash);
	const { matchedObjectIds, unmatchedElementIds } = resolveClashObjectNodes(
		viewer,
		keys,
	);

	let region: Box3 | null = unionBoxesForSpeckleObjectIds(
		viewer,
		matchedObjectIds,
	);
	let source: ContextRegionPayload["source"] = "clash_geometry";

	if (!region || region.isEmpty()) {
		region = boxFromClashPoint(clash);
		source = region ? "clash_point" : "none";
	}

	const regionPayload =
		region && !region.isEmpty()
			? (() => {
					const clone = region.clone();
					clone.expandByScalar(expandMeters);
					return boxToPayload(clone, expandMeters, source);
				})()
			: null;

	const expanded =
		region && !region.isEmpty()
			? region.clone().expandByScalar(expandMeters)
			: null;

	const nearby: NearbySpeckleObjectPayload[] = [];
	let capped = false;

	if (expanded && !expanded.isEmpty()) {
		const views = viewer
			.getWorldTree()
			.getRenderTree()
			.getRenderableRenderViews();
		type Scored = {
			id: string;
			dist: number;
			summary: Record<string, unknown>;
			st: string | null;
		};
		const bestById = new Map<string, Scored>();

		const center = new Vector3();
		expanded.getCenter(center);

		for (const rv of views) {
			const aabb = rv.aabb;
			if (!aabb || aabb.isEmpty()) continue;
			if (!expanded.intersectsBox(aabb)) continue;
			const id = rv.renderData.id;
			if (!id) continue;

			const box = aabb.clone();
			const c = new Vector3();
			box.getCenter(c);
			const dist = c.distanceToSquared(center);

			const found = viewer.getWorldTree().findId(id);
			const node = found?.[0];
			const raw = node?.model?.raw;
			const st = typeof rv.speckleType === "string" ? rv.speckleType : null;
			const summary = isRecord(raw) ? summarizeSpeckleRaw(raw) : { id };

			const prev = bestById.get(id);
			if (!prev || dist < prev.dist) {
				bestById.set(id, { id, dist, summary, st });
			}
		}

		const scored = [...bestById.values()].sort((a, b) => a.dist - b.dist);
		capped = scored.length > MAX_NEARBY_OBJECTS;
		const take = scored.slice(0, MAX_NEARBY_OBJECTS);
		for (const row of take) {
			nearby.push({
				id: row.id,
				speckle_type: row.st,
				summary: row.summary,
			});
		}
	}

	return {
		context_region: regionPayload,
		nearby_speckle_objects: nearby,
		unmatched_clash_keys: unmatchedElementIds,
		meta: { speckle_url_count: speckleUrlCount, capped },
	};
}
