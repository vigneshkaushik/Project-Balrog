import type { Viewer } from "@speckle/viewer";
import { Box3, Vector3 } from "three";
import type { Clash } from "../types";
import {
	expandMatchedClashSubtreeSpeckleIds,
	resolveClashObjectNodes,
	unionBoxesForSpeckleObjectIds,
} from "./zoomToSmallestClashObject";

const DEFAULT_EXPAND_METERS = 2;
const MAX_NEARBY_OBJECTS = 120;
const MAX_OUTSIDE_REGION_ANNOTATED = 25;
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

function toRenderableObjectData(
	value: unknown,
	seen: WeakSet<object> = new WeakSet(),
): unknown {
	if (
		value == null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => toRenderableObjectData(item, seen));
	}
	if (!isRecord(value)) return String(value);
	if (seen.has(value)) return "[Circular]";
	seen.add(value);
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value)) {
		if (HIDDEN_KEYS.has(k) || k.startsWith("__")) continue;
		out[k] = toRenderableObjectData(v, seen);
	}
	seen.delete(value);
	return out;
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
	"itemName",
	"itemType",
	"item_type",
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
	const priority = new Map<string, number>(
		PRIORITY_KEYS.map((k, i) => [k, i] as const),
	);
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
			continue;
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
	name?: string | null;
	item_type?: string | null;
	summary: Record<string, unknown>;
	/** Free-form user note attached in the UI (embedded for the agent). */
	user_metadata?: string;
	/** True when the object was added only because the user annotated it outside the context AABB. */
	outside_context_region?: boolean;
}

function pickTextFromSummary(
	summary: Record<string, unknown>,
	keys: readonly string[],
): string | null {
	for (const key of keys) {
		const v = summary[key];
		if (typeof v === "string" && v.trim().length > 0) return v.trim();
	}
	for (const nestedKey of ["properties", "parameters"]) {
		const nested = summary[nestedKey];
		if (!isRecord(nested)) continue;
		for (const key of keys) {
			const v = nested[key];
			if (typeof v === "string" && v.trim().length > 0) return v.trim();
		}
	}
	return null;
}

function nearbyPayloadForSpeckleId(
	viewer: Viewer,
	speckleId: string,
): Omit<NearbySpeckleObjectPayload, "user_metadata" | "outside_context_region"> | null {
	const tree = viewer.getWorldTree();
	const nodes = tree.findId(speckleId) ?? [];
	const node = nodes[0];
	if (!node) return null;
	const renderTree = tree.getRenderTree();
	const renderViews = renderTree.getRenderViewsForNode(node);
	let speckleType: string | null = null;
	if (renderViews) {
		for (const rv of renderViews) {
			if (speckleType == null && typeof rv.speckleType === "string") {
				speckleType = rv.speckleType;
			}
		}
	}
	const raw = node.model?.raw;
	const summary = isRecord(raw) ? summarizeSpeckleRaw(raw) : { id: speckleId };
	const name = pickTextFromSummary(summary, [
		"itemName",
		"name",
		"Name",
		"family",
	]);
	const itemType = pickTextFromSummary(summary, [
		"itemType",
		"item_type",
		"type",
		"Type",
		"category",
	]);
	return {
		id: speckleId,
		speckle_type: speckleType,
		name,
		item_type: itemType,
		summary,
	};
}

export function fullSpeckleObjectPayloadForId(
	viewer: Viewer,
	speckleId: string,
): Record<string, unknown> | null {
	const tree = viewer.getWorldTree();
	const nodes = tree.findId(speckleId) ?? [];
	const node = nodes[0];
	if (!node) return null;
	const renderTree = tree.getRenderTree();
	const renderViews = renderTree.getRenderViewsForNode(node);
	let speckleType: string | null = null;
	if (renderViews) {
		for (const rv of renderViews) {
			if (speckleType == null && typeof rv.speckleType === "string") {
				speckleType = rv.speckleType;
			}
		}
	}

	const raw = node.model?.raw;
	const base = isRecord(raw) ? toRenderableObjectData(raw) : {};
	const out: Record<string, unknown> = isRecord(base) ? { ...base } : {};
	out.id = speckleId;
	if (speckleType) out.speckle_type = speckleType;
	if (typeof out.name !== "string") out.name = null;
	if (typeof out.type !== "string") out.type = null;
	return out;
}

function mergeUserMetadataIntoNearby(
	viewer: Viewer,
	nearby: NearbySpeckleObjectPayload[],
	clashParticipantObjectIds: Set<string>,
	objectMetadata: Record<string, string>,
): void {
	const trimmedMeta: Record<string, string> = {};
	for (const [k, v] of Object.entries(objectMetadata)) {
		const t = typeof v === "string" ? v.trim() : "";
		if (t) trimmedMeta[k] = t;
	}

	const nearbyIds = new Set(nearby.map((n) => n.id));
	for (const row of nearby) {
		const note = trimmedMeta[row.id]?.trim();
		if (note) row.user_metadata = note;
	}

	let addedOutside = 0;
	for (const speckleId of Object.keys(trimmedMeta).sort()) {
		if (addedOutside >= MAX_OUTSIDE_REGION_ANNOTATED) break;
		const note = trimmedMeta[speckleId]?.trim();
		if (!note) continue;
		if (nearbyIds.has(speckleId)) continue;
		if (clashParticipantObjectIds.has(speckleId)) continue;
		const base = nearbyPayloadForSpeckleId(viewer, speckleId);
		if (!base) continue;
		nearby.push({
			...base,
			user_metadata: note,
			outside_context_region: true,
		});
		nearbyIds.add(speckleId);
		addedOutside += 1;
	}
}

/**
 * Build expanded world AABB around clash participants; collect Speckle objects
 * whose render views intersect that box.
 */
export function buildClashContextAnalysisPayload(
	viewer: Viewer,
	clash: Clash,
	options?: {
		expandMeters?: number;
		speckleUrlCount?: number;
		objectMetadata?: Record<string, string>;
	},
): {
	context_region: ContextRegionPayload | null;
	nearby_speckle_objects: NearbySpeckleObjectPayload[];
	unmatched_clash_keys: string[];
	meta: { speckle_url_count: number; capped: boolean };
} {
	const expandMeters = options?.expandMeters ?? readExpandMeters();
	const speckleUrlCount = options?.speckleUrlCount ?? 0;
	const objectMetadata = options?.objectMetadata ?? {};
	const keys = clashMatchKeys(clash);
	const { matchedObjectIds, unmatchedElementIds, matchedNodes } =
		resolveClashObjectNodes(viewer, keys);
	const clashParticipantObjectIds =
		expandMatchedClashSubtreeSpeckleIds(matchedNodes);

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
		const worldTree = viewer.getWorldTree();
		const renderTree = worldTree.getRenderTree();
		type Scored = {
			id: string;
			dist: number;
			summary: Record<string, unknown>;
			st: string | null;
		};
		const bestById = new Map<string, Scored>();

		const center = new Vector3();
		expanded.getCenter(center);

		worldTree.walk((node) => {
			const renderViews = renderTree.getRenderViewsForNode(node);
			if (!renderViews || renderViews.length === 0) return true;

			const nodeBox = new Box3();
			let hasAabb = false;
			let speckleType: string | null = null;
			for (const rv of renderViews) {
				const aabb = rv.aabb;
				if (!aabb || aabb.isEmpty()) continue;
				if (!hasAabb) {
					nodeBox.copy(aabb);
					hasAabb = true;
				} else {
					nodeBox.union(aabb);
				}
				if (speckleType == null && typeof rv.speckleType === "string") {
					speckleType = rv.speckleType;
				}
			}
			if (!hasAabb || nodeBox.isEmpty()) return true;
			if (!expanded.intersectsBox(nodeBox)) return true;

			const id = node.model?.id;
			if (!id || typeof id !== "string") return true;
			if (clashParticipantObjectIds.has(id)) return true;

			const c = new Vector3();
			nodeBox.getCenter(c);
			const dist = c.distanceToSquared(center);
			const raw = node.model?.raw;
			const summary = isRecord(raw) ? summarizeSpeckleRaw(raw) : { id };

			const prev = bestById.get(id);
			if (!prev || dist < prev.dist) {
				bestById.set(id, { id, dist, summary, st: speckleType });
			}
			return true;
		});

		const scored = [...bestById.values()].sort((a, b) => a.dist - b.dist);
		capped = scored.length > MAX_NEARBY_OBJECTS;
		const take = scored.slice(0, MAX_NEARBY_OBJECTS);
		for (const row of take) {
			const name = pickTextFromSummary(row.summary, [
				"itemName",
				"name",
				"Name",
				"family",
			]);
			const itemType = pickTextFromSummary(row.summary, [
				"itemType",
				"item_type",
				"type",
				"Type",
				"category",
			]);
			nearby.push({
				id: row.id,
				speckle_type: row.st,
				name,
				item_type: itemType,
				summary: row.summary,
			});
		}
	}

	mergeUserMetadataIntoNearby(
		viewer,
		nearby,
		clashParticipantObjectIds,
		objectMetadata,
	);

	return {
		context_region: regionPayload,
		nearby_speckle_objects: nearby,
		unmatched_clash_keys: unmatchedElementIds,
		meta: { speckle_url_count: speckleUrlCount, capped },
	};
}
