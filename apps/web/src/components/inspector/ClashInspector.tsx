import type { Viewer } from "@speckle/viewer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChatAttachments } from "../../context/ChatAttachmentsContext";
import { useClashAnalysis } from "../../context/ClashAnalysisContext";
import { useFloatingChat } from "../../context/FloatingChatContext";
import { useToast } from "../../context/ToastContext";
import { useApp } from "../../context/useApp";
import { AddToChatButton } from "../layout/AddToChatButton";
import {
	buildClashAttachment,
	buildRecommendationAttachment,
} from "../../lib/buildChatAttachments";
import type { SpeckleLoadState } from "../../hooks/useSpeckleViewer";
import { buildClashContextAnalysisPayload } from "../../lib/clashContextRegion";
import { fullSpeckleObjectPayloadForId } from "../../lib/clashContextRegion";
import {
	normalizeClashRecommendations,
	normalizeCoordinationWatchList,
	type ClashRecommendationItem,
} from "../../lib/clashAnalysisFormat";
import type {
	ContextRegionPayload,
	NearbySpeckleObjectPayload,
} from "../../lib/clashContextRegion";
import { clashReportGateMessage } from "../../lib/clashReportGateMessage";
import {
	clashParticipantSpeckleIdsForContextExclusion,
	resolveClashObjectNodes,
} from "../../lib/zoomToSmallestClashObject";
import {
	postClashAnalyzeContext,
	type ClashAnalysisMetadata,
	type ClashAnalyzeContextRequestBody,
	type ClashObjectWithUserMetadata,
} from "../../lib/postClashAnalysis";
import { AnalysisPanel } from "./AnalysisPanel";
import { ClashSelector } from "./ClashSelector";
import { FloatingCard } from "../ui/FloatingCard";
import { AiIdeaIcon } from "./AiIdeaIcon";
import {
	InspectorToolbar,
	type InspectorPanelId,
} from "./InspectorToolbar";
import { ModelViewer } from "./ModelViewer";
import { SpeckleLoadProgressBar } from "./SpeckleLoadProgressBar";
import { SeverityFilter } from "./SeverityFilter";

const INSPECTOR_OPEN_PANELS_KEY = "balrog-inspector-open-panels";
const INSPECTOR_PANEL_IDS: readonly InspectorPanelId[] = [
	"clash-controls",
	"clash-context",
	"clash-recommendations",
];

function readInitialOpenPanels(): Set<InspectorPanelId> {
	if (typeof window === "undefined") {
		return new Set();
	}
	try {
		const raw = window.localStorage.getItem(INSPECTOR_OPEN_PANELS_KEY);
		if (raw == null) {
			return new Set();
		}
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return new Set();
		}
		const valid = parsed.filter((id): id is InspectorPanelId =>
			INSPECTOR_PANEL_IDS.includes(id as InspectorPanelId),
		);
		return new Set(valid);
	} catch {
		return new Set();
	}
}

function ClosePanelButton({
	label,
	onClose,
}: {
	label: string;
	onClose: () => void;
}) {
	return (
		<button
			type="button"
			className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60"
			title={label}
			aria-label={label}
			onPointerDown={(event) => event.stopPropagation()}
			onClick={onClose}
		>
			<svg
				className="h-3.5 w-3.5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M6 6l12 12" />
				<path d="M18 6L6 18" />
			</svg>
		</button>
	);
}

/** Dedupes gate toast when React Strict Mode runs effects twice on mount. */
let lastInspectorGateToast: { at: number; message: string } | null = null;
const INSPECTOR_GATE_TOAST_DEDUPE_MS = 400;

const SEVERITY_COLORS: Record<string, string> = {
	CRITICAL: "bg-red-100 text-red-700",
	HIGH: "bg-orange-100 text-orange-800",
	MEDIUM: "bg-amber-100 text-amber-700",
	LOW: "bg-emerald-100 text-emerald-700",
};

function matchKeysForClashObject(obj: {
	elementId?: string | null;
	revitGlobalId?: string | null;
}): string[] {
	const keys: string[] = [];
	const e = obj.elementId?.trim();
	if (e) keys.push(e);
	const g = obj.revitGlobalId?.trim();
	if (g) keys.push(g);
	return keys;
}

function recommendationSeverityLabel(metadata: ClashAnalysisMetadata | null) {
	const raw = metadata?.severity.trim();
	if (!raw) return null;
	const lower = raw.toLowerCase();
	return `${lower.charAt(0).toUpperCase()}${lower.slice(1)} Severity`;
}

function recommendationSummaryText(
	item: ClashRecommendationItem | null,
	metadata: ClashAnalysisMetadata | null,
) {
	if (metadata?.severity_justification.trim()) {
		return metadata.severity_justification.trim();
	}
	return item?.parsed?.design_impact.trim() || null;
}

/** Bulleted section: maps to API `actions` or `feasibility_validations`. */
function RecommendationListSection({
	title,
	items,
}: {
	title: string;
	items: string[];
}) {
	if (items.length === 0) return null;
	return (
		<div className="py-3">
			<p className="mb-1 text-xs font-semibold text-neutral-800">{title}</p>
			<ul className="list-disc space-y-0.5 pl-5 text-xs leading-snug text-neutral-500">
				{items.map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
		</div>
	);
}

export function ClashInspector() {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const {
		isSessionHydrating,
		navisworksFileName,
		speckleUrls,
		filteredClashes,
		selectedClashId,
		highlightFilteredSeverity,
		setSelectedClashId,
		clashes,
		isUploading,
		uploadProgress,
		uploadError,
		clearSession,
		requestClashObjectViewerFocus,
		objectMetadata,
		setSpeckleViewer: publishSpeckleViewer,
	} = useApp();
	const {
		getAnalysisForClash,
		setAnalysisForClash,
		clearAnalysisForClash,
		clearAllAnalysis,
	} = useClashAnalysis();
	const {
		addAttachment,
		hasAttachment,
		clearAttachments,
		removeRecommendationAttachmentsForClash,
	} = useChatAttachments();
	const { setChatOpen, requestComposerFocus } = useFloatingChat();

	const hasSpeckleUrl = speckleUrls.some((u) => u.trim().length > 0);
	const hasClashReport = Boolean(navisworksFileName);
	const hasClashes = clashes.length > 0;

	const hasSession =
		hasSpeckleUrl && (hasClashReport || hasClashes || isUploading);

	useEffect(() => {
		if (isSessionHydrating) {
			return;
		}
		if (hasSession) {
			lastInspectorGateToast = null;
			return;
		}
		const message = clashReportGateMessage(hasSpeckleUrl, hasClashReport);
		const now = Date.now();
		const dup =
			lastInspectorGateToast &&
			lastInspectorGateToast.message === message &&
			now - lastInspectorGateToast.at < INSPECTOR_GATE_TOAST_DEDUPE_MS;
		if (!dup) {
			lastInspectorGateToast = { at: now, message };
			showToast("error", message);
		}
		navigate("/", { replace: true });
	}, [
		hasSession,
		hasSpeckleUrl,
		hasClashReport,
		isSessionHydrating,
		navigate,
		showToast,
	]);

	const containerRef = useRef<HTMLDivElement>(null);
	const [speckleViewer, setSpeckleViewer] = useState<Viewer | null>(null);
	const [speckleLoadState, setSpeckleLoadState] = useState<SpeckleLoadState>({
		loading: false,
		percent: 0,
	});
	const [analysisLoading, setAnalysisLoading] = useState(false);
	const [activeRecommendationIndex, setActiveRecommendationIndex] = useState(0);
	const [analysisError, setAnalysisError] = useState<string | null>(null);
	const [analysisCompleted, setAnalysisCompleted] = useState(false);
	const [openPanels, setOpenPanels] = useState<Set<InspectorPanelId>>(
		readInitialOpenPanels,
	);
	const [showClashContext, setShowClashContext] = useState(false);
	const [showContextBoundingBox, setShowContextBoundingBox] = useState(false);

	useEffect(() => {
		try {
			window.localStorage.setItem(
				INSPECTOR_OPEN_PANELS_KEY,
				JSON.stringify([...openPanels]),
			);
		} catch {
			// Ignore storage failures; in-memory state is source of truth.
		}
	}, [openPanels]);

	useEffect(() => {
		publishSpeckleViewer(speckleViewer);
		return () => publishSpeckleViewer(null);
	}, [publishSpeckleViewer, speckleViewer]);

	const togglePanel = useCallback((panelId: InspectorPanelId) => {
		setOpenPanels((prev) => {
			const next = new Set(prev);
			if (next.has(panelId)) {
				next.delete(panelId);
			} else {
				next.add(panelId);
			}
			return next;
		});
	}, []);

	const closePanel = useCallback((panelId: InspectorPanelId) => {
		setOpenPanels((prev) => {
			if (!prev.has(panelId)) return prev;
			const next = new Set(prev);
			next.delete(panelId);
			return next;
		});
	}, []);

	const isControlsOpen = openPanels.has("clash-controls");
	const isContextOpen = openPanels.has("clash-context");
	const isRecommendationsOpen = openPanels.has("clash-recommendations");
	const [contextObjectsByClashId, setContextObjectsByClashId] = useState<
		Record<string, NearbySpeckleObjectPayload[]>
	>({});
	const [contextRegionByClashId, setContextRegionByClashId] = useState<
		Record<string, ContextRegionPayload | null>
	>({});

	const storedAnalysis = getAnalysisForClash(selectedClashId);
	const analysisRecommendations = storedAnalysis.recommendations;
	const analysisMetadata = storedAnalysis.analysis_metadata;
	const analysisNotes = storedAnalysis.notes;

	useEffect(() => {
		void selectedClashId;
		setActiveRecommendationIndex(0);
		setAnalysisError(null);
		setAnalysisCompleted(false);
	}, [selectedClashId]);

	useEffect(() => {
		setActiveRecommendationIndex((prev) => {
			if (analysisRecommendations.length === 0) return 0;
			return Math.min(prev, analysisRecommendations.length - 1);
		});
	}, [analysisRecommendations.length]);

	useEffect(() => {
		if (!selectedClashId) return;
		const stillValid = filteredClashes.some((c) => c.id === selectedClashId);
		if (!stillValid) setSelectedClashId(null);
	}, [filteredClashes, selectedClashId, setSelectedClashId]);

	const selected = filteredClashes.find((c) => c.id === selectedClashId);
	const activeRecommendation =
		analysisRecommendations[activeRecommendationIndex] ?? null;
	const activeRecommendationAttachment =
		selected && activeRecommendation
			? buildRecommendationAttachment(
					selected,
					activeRecommendationIndex,
					"modify",
				)
			: null;
	const activeRecommendationInfoAttachment =
		selected && activeRecommendation
			? buildRecommendationAttachment(
					selected,
					activeRecommendationIndex,
					"attach",
				)
			: null;
	const isActiveRecommendationAttached = activeRecommendationAttachment
		? hasAttachment(activeRecommendationAttachment.id)
		: false;
	const isActiveRecommendationInfoAttached = activeRecommendationInfoAttachment
		? hasAttachment(activeRecommendationInfoAttachment.id)
		: false;
	const activeRecommendationSeverity =
		recommendationSeverityLabel(analysisMetadata);
	const activeRecommendationSummary = recommendationSummaryText(
		activeRecommendation,
		analysisMetadata,
	);
	const selectedClashObjectMatchKeys = useMemo(() => {
		const keys = new Set<string>();
		for (const obj of selected?.objects ?? []) {
			const e = obj.elementId?.trim();
			if (e) keys.add(e);
			const g = obj.revitGlobalId?.trim();
			if (g) keys.add(g);
		}
		return [...keys];
	}, [selected]);

	const selectedClashParticipantSpeckleIds = useMemo(() => {
		if (!speckleViewer || selectedClashObjectMatchKeys.length === 0) {
			return new Set<string>();
		}
		try {
			return clashParticipantSpeckleIdsForContextExclusion(
				speckleViewer,
				selectedClashObjectMatchKeys,
			);
		} catch {
			return new Set<string>();
		}
	}, [speckleViewer, selectedClashObjectMatchKeys]);

	const selectedClashContextObjects = useMemo(() => {
		if (!selected) return [];
		const raw = contextObjectsByClashId[selected.id] ?? [];
		if (selectedClashParticipantSpeckleIds.size === 0) return raw;
		return raw.filter(
			(obj) => !selectedClashParticipantSpeckleIds.has(obj.id),
		);
	}, [
		contextObjectsByClashId,
		selected,
		selectedClashParticipantSpeckleIds,
	]);
	const hasComputedSelectedClashContext = useMemo(() => {
		if (!selected) return false;
		return Object.hasOwn(contextObjectsByClashId, selected.id);
	}, [contextObjectsByClashId, selected]);
	const selectedClashContextIds = useMemo(
		() => selectedClashContextObjects.map((obj) => obj.id),
		[selectedClashContextObjects],
	);
	const nonEmptySpeckleCount = useMemo(
		() => speckleUrls.filter((u) => u.trim().length > 0).length,
		[speckleUrls],
	);

	useEffect(() => {
		const needsCompute = showClashContext || showContextBoundingBox;
		if (!needsCompute || !selected || !speckleViewer) {
			return;
		}
		const hasObjects = Object.hasOwn(contextObjectsByClashId, selected.id);
		const hasRegion = Object.hasOwn(contextRegionByClashId, selected.id);
		if (hasObjects && hasRegion) {
			return;
		}
		try {
			const built = buildClashContextAnalysisPayload(speckleViewer, selected, {
				speckleUrlCount: nonEmptySpeckleCount,
				objectMetadata,
			});
			setContextObjectsByClashId((prev) => ({
				...prev,
				[selected.id]: built.nearby_speckle_objects,
			}));
			setContextRegionByClashId((prev) => ({
				...prev,
				[selected.id]: built.context_region,
			}));
		} catch {
			setContextObjectsByClashId((prev) => ({
				...prev,
				[selected.id]: [],
			}));
			setContextRegionByClashId((prev) => ({
				...prev,
				[selected.id]: null,
			}));
		}
	}, [
		showClashContext,
		showContextBoundingBox,
		selected,
		speckleViewer,
		nonEmptySpeckleCount,
		contextObjectsByClashId,
		contextRegionByClashId,
		objectMetadata,
	]);

	const contextBoundingBoxForViewer = useMemo(() => {
		if (!showContextBoundingBox || !selected) return null;
		const region = contextRegionByClashId[selected.id];
		if (!region) return null;
		return { min: region.min, max: region.max };
	}, [showContextBoundingBox, selected, contextRegionByClashId]);

	const handleRunAnalysis = useCallback(async () => {
		if (!selected) {
			showToast("error", "Select a clash first.");
			return;
		}
		if (!speckleViewer) {
			showToast("error", "Wait for the Speckle model to finish loading.");
			return;
		}

		setAnalysisLoading(true);
		setAnalysisCompleted(false);
		setAnalysisError(null);
		setActiveRecommendationIndex(0);
		removeRecommendationAttachmentsForClash(selected.id);
		clearAnalysisForClash(selected.id);

		try {
			const built = buildClashContextAnalysisPayload(speckleViewer, selected, {
				speckleUrlCount: nonEmptySpeckleCount,
				objectMetadata,
			});
			const clashObjectsOriginal: ClashObjectWithUserMetadata[] = (
				selected.objects ?? []
			).map((obj) => {
				const keys = matchKeysForClashObject(obj);
				const { matchedObjectIds } = resolveClashObjectNodes(
					speckleViewer,
					keys,
				);
				let user_metadata: string | undefined;
				const speckleObjects: Array<Record<string, unknown>> = [];
				for (const sid of matchedObjectIds) {
					const note = objectMetadata[sid]?.trim();
					if (note) {
						user_metadata = note;
					}
					const full = fullSpeckleObjectPayloadForId(speckleViewer, sid);
					if (full) {
						const perObjectNote = objectMetadata[sid]?.trim();
						speckleObjects.push(
							perObjectNote ? { ...full, user_metadata: perObjectNote } : full,
						);
					}
				}
				return {
					...obj,
					...(user_metadata !== undefined ? { user_metadata } : {}),
					...(speckleObjects.length > 0 ? { speckle_objects: speckleObjects } : {}),
				};
			});
			const requestBody: ClashAnalyzeContextRequestBody = {
				clash: selected,
				clash_objects_original: clashObjectsOriginal,
				context_region: built.context_region,
				nearby_speckle_objects: built.nearby_speckle_objects,
				meta: {
					...built.meta,
					unmatched_clash_keys: built.unmatched_clash_keys,
					user_object_metadata: Object.fromEntries(
						Object.entries(objectMetadata).filter(([, v]) => v.trim().length > 0),
					),
				},
			};
			const res = await postClashAnalyzeContext(requestBody);
			const normalizedWatchList = normalizeCoordinationWatchList(
				res.coordination_watch_list,
			);
			const normalizedRecommendations = normalizeClashRecommendations(
				res.recommendations,
			);
			setAnalysisCompleted(true);
			setAnalysisForClash(selected.id, {
				analysis_metadata: res.analysis_metadata,
				engineering_scratchpad: res.engineering_scratchpad,
				clash_summary: res.clash_summary,
				recommendations: normalizedRecommendations,
				coordination_watch_list: normalizedWatchList,
				notes: res.notes,
			});
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Analysis request failed.";
			setAnalysisError(msg);
			showToast("error", msg);
		} finally {
			setAnalysisLoading(false);
		}
	}, [
		selected,
		speckleViewer,
		nonEmptySpeckleCount,
		objectMetadata,
		showToast,
		setAnalysisForClash,
		clearAnalysisForClash,
		removeRecommendationAttachmentsForClash,
	]);

	const currentClashAttachmentId = useMemo(
		() => (selected ? `clash:${selected.id}` : null),
		[selected],
	);
	const isCurrentClashAttached = currentClashAttachmentId
		? hasAttachment(currentClashAttachmentId)
		: false;
	const handleAddClashToChat = useCallback(() => {
		if (!selected || !speckleViewer) return;
		try {
			const cachedRegion = contextRegionByClashId[selected.id];
			const cachedNearby = contextObjectsByClashId[selected.id];
			let region: ContextRegionPayload | null | undefined = cachedRegion;
			let nearby: NearbySpeckleObjectPayload[] | undefined = cachedNearby;
			let unmatched: string[] | undefined;
			let speckleUrlCountMeta: number | undefined;
			let capped: boolean | undefined;
			if (region === undefined || nearby === undefined) {
				const built = buildClashContextAnalysisPayload(
					speckleViewer,
					selected,
					{
						speckleUrlCount: nonEmptySpeckleCount,
						objectMetadata,
					},
				);
				region = built.context_region;
				nearby = built.nearby_speckle_objects;
				unmatched = built.unmatched_clash_keys;
				speckleUrlCountMeta = built.meta.speckle_url_count;
				capped = built.meta.capped;
			}
			addAttachment(
				buildClashAttachment(selected, {
					context_region: region ?? null,
					nearby_speckle_objects: nearby ?? [],
					clash_objects_original: [],
					unmatched_clash_keys: unmatched,
					speckle_url_count: speckleUrlCountMeta,
					capped,
				}),
			);
		} catch (err) {
			console.warn("[ClashInspector] Add clash to chat failed:", err);
		}
	}, [
		addAttachment,
		contextObjectsByClashId,
		contextRegionByClashId,
		nonEmptySpeckleCount,
		objectMetadata,
		selected,
		speckleViewer,
	]);

	const severityHighlightMatchKeys = useMemo(() => {
		if (!highlightFilteredSeverity) return [];
		const keys = new Set<string>();
		for (const clash of filteredClashes) {
			for (const obj of clash.objects ?? []) {
				const e = obj.elementId?.trim();
				if (e) keys.add(e);
				const g = obj.revitGlobalId?.trim();
				if (g) keys.add(g);
			}
		}
		return [...keys];
	}, [filteredClashes, highlightFilteredSeverity]);

	const viewerHighlightMode: "single" | "severity" | "none" =
		selectedClashObjectMatchKeys.length > 0
			? "single"
			: severityHighlightMatchKeys.length > 0
				? "severity"
				: "none";
	const viewerHighlightMatchKeys =
		viewerHighlightMode === "single"
			? selectedClashObjectMatchKeys
			: severityHighlightMatchKeys;

	if (isSessionHydrating || !hasSession) {
		return null;
	}
	const progressPct =
		uploadProgress && uploadProgress.total > 0
			? Math.round((uploadProgress.completed / uploadProgress.total) * 100)
			: 0;

	return (
		<div
			ref={containerRef}
			className="relative h-full w-full min-h-0 min-w-0 overflow-hidden"
		>
			<div className="absolute inset-0 z-0">
				<ModelViewer
					clashSelectionId={selectedClashId}
					clashObjectMatchKeys={viewerHighlightMatchKeys}
					contextObjectIds={
						showClashContext && viewerHighlightMode === "single"
							? selectedClashContextIds
							: []
					}
					contextBoundingBox={contextBoundingBoxForViewer}
					clashHighlightMode={viewerHighlightMode}
					onViewerReady={setSpeckleViewer}
					onViewerDisposed={() => setSpeckleViewer(null)}
					onLoadStateChange={setSpeckleLoadState}
					showLoadProgress={false}
				/>
			</div>

			<div className="pointer-events-none absolute inset-0 z-20">
				{speckleLoadState.loading ? (
					<div className="absolute inset-x-0 top-14 z-40">
						<SpeckleLoadProgressBar percent={speckleLoadState.percent} />
					</div>
				) : null}

				{isUploading && uploadProgress ? (
					<div className="pointer-events-none absolute left-4 right-4 top-16 z-30">
						<div className="mx-auto flex max-w-xl items-center gap-3 rounded-lg border border-neutral-200 bg-white/90 px-4 py-2 shadow-sm backdrop-blur-sm">
							<span className="text-xs font-medium text-neutral-600">
								Processing clashes: {uploadProgress.completed}/
								{uploadProgress.total}
							</span>
							<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
								<div
									className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
									style={{ width: `${progressPct}%` }}
								/>
							</div>
							<span className="text-xs tabular-nums text-neutral-500">
								{progressPct}%
							</span>
						</div>
					</div>
				) : null}

				{uploadError ? (
					<div className="pointer-events-none absolute left-4 right-4 top-28 z-30">
						<div className="pointer-events-auto mx-auto max-w-xl select-text rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 shadow-sm">
							Upload error: {uploadError}
						</div>
					</div>
				) : null}

				<InspectorToolbar
					openPanels={openPanels}
					onTogglePanel={togglePanel}
				/>

				{isControlsOpen ? (
				<FloatingCard
					panelId="clash-controls"
					title="Clash Controls"
					initialPosition={{ x: 80, y: 80 }}
					initialSize={{ width: 320, height: 208 }}
					minSize={{ width: 304, height: 192 }}
					resizable={false}
					autoHeight
					overflowMode="visible"
					bodyScroll={false}
					headerActions={
						<ClosePanelButton
							label="Close clash controls"
							onClose={() => closePanel("clash-controls")}
						/>
					}
				>
					<div className="space-y-3">
						<button
							type="button"
							onClick={() => {
								clearSession();
								clearAllAnalysis();
								clearAttachments();
								navigate("/");
							}}
							className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur-md transition hover:border-neutral-300 hover:bg-white hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/50"
							title="Upload a new clash report and edit Speckle URLs"
						>
							<svg
								className="h-3.5 w-3.5 shrink-0 text-neutral-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
								aria-hidden="true"
							>
								<title>Upload</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
								/>
							</svg>
							<span>New report & URLs</span>
						</button>
						<SeverityFilter />
						<ClashSelector disabled={!speckleViewer} />
					</div>
				</FloatingCard>
				) : null}

				{isContextOpen ? (
				<FloatingCard
					panelId="clash-context"
					title="Context"
					widthClassName="w-fit"
					initialPosition={{ x: 80, y: 304 }}
					initialSize={{ width: 464, height: 368 }}
					minSize={{ width: 352, height: 224 }}
					headerActions={
						<ClosePanelButton
							label="Close context panel"
							onClose={() => closePanel("clash-context")}
						/>
					}
					headerToolbar={
						<div className="flex items-center gap-1.5">
							<span onPointerDown={(event) => event.stopPropagation()}>
								<AddToChatButton
									onClick={handleAddClashToChat}
									added={isCurrentClashAttached}
									disabled={!selected || !speckleViewer}
									label="Add clash to chat"
									title={
										!selected
											? "Select a clash first"
											: !speckleViewer
												? "Load the 3D model to compute clash context"
												: isCurrentClashAttached
													? "Clash already attached to next message"
													: "Attach this clash and its context to your next chat message"
									}
								/>
							</span>
							<button
								type="button"
								className="cursor-pointer rounded-md border px-2 py-1 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-primary"
								aria-pressed={showClashContext}
								disabled={!selected || !speckleViewer}
								title={
									showClashContext
										? "Hide clash context objects"
										: "Show clash context objects"
								}
								onPointerDown={(event) => event.stopPropagation()}
								onClick={() => setShowClashContext((prev) => !prev)}
							>
								{showClashContext ? "Hide Context" : "Show Context"}
							</button>
							<button
								type="button"
								className="cursor-pointer rounded-md border px-2 py-1 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-primary"
								aria-pressed={showContextBoundingBox}
								disabled={!selected || !speckleViewer}
								title={
									showContextBoundingBox
										? "Hide context bounding box"
										: "Show context bounding box"
								}
								onPointerDown={(event) => event.stopPropagation()}
								onClick={() => setShowContextBoundingBox((prev) => !prev)}
							>
								{showContextBoundingBox
									? "Hide Bounding Box"
									: "Show Bounding Box"}
							</button>
						</div>
					}
				>
					<div className="h-full min-h-0">
						<AnalysisPanel
							title="Context"
							showTitle={false}
						>
							{selected ? (
								<div className="space-y-3 text-sm text-neutral-700">
									{analysisLoading ? (
										<p className="text-xs italic text-neutral-500">
											Running analysis…
										</p>
									) : null}
									{analysisError ? (
										<p className="text-xs text-red-600">{analysisError}</p>
									) : null}
									<p>
										<span className="font-medium text-neutral-900">Clash:</span>{" "}
										{selected.label}
										{selected.testName && (
											<span className="ml-1 text-neutral-400">
												({selected.testName})
											</span>
										)}
									</p>
									<p className="flex items-center gap-2">
										<span className="font-medium text-neutral-900">
											Severity:
										</span>
										{selected.severity ? (
											<span
												className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[selected.severity] ?? ""}`}
											>
												{selected.severity}
											</span>
										) : isUploading ? (
											<span className="text-xs italic text-neutral-400">
												Processing…
											</span>
										) : (
											<span className="text-xs text-neutral-400">Not inferred</span>
										)}
									</p>
									{selected.disciplines && selected.disciplines.length > 0 ? (
										<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
											<span className="font-medium text-neutral-900">
												Disciplines:
											</span>
											<span className="flex flex-wrap gap-1.5">
												{selected.disciplines.map((d) => (
													<span
														key={d}
														className="inline-flex rounded-full bg-neutral-200/90 px-2 py-0.5 text-xs font-medium text-neutral-700"
													>
														{d}
													</span>
												))}
											</span>
										</div>
									) : null}
									{selected.lead && selected.lead.length > 0 ? (
										<p>
											<span className="font-medium text-neutral-900">
												Lead (stays in place):
											</span>{" "}
											{selected.lead.join(", ")}
										</p>
									) : null}
									{selected.description ? (
										<p>
											<span className="font-medium text-neutral-900">Type:</span>{" "}
											{selected.description}
										</p>
									) : null}
									{selected.status ? (
										<p>
											<span className="font-medium text-neutral-900">Status:</span>{" "}
											{selected.status}
										</p>
									) : null}
									{selected.distance != null ? (
										<p>
											<span className="font-medium text-neutral-900">
												Distance:
											</span>{" "}
											{selected.distance.toFixed(4)}
										</p>
									) : null}
									{selected.objects && selected.objects.length > 0 ? (
										<div>
											<span className="font-medium text-neutral-900">Objects:</span>
											<ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
												{selected.objects.map((obj) => {
													const keys = matchKeysForClashObject(obj);
													return (
														<li
															key={
																obj.elementId ??
																obj.revitGlobalId ??
																obj.itemName
															}
														>
															<button
																type="button"
																disabled={keys.length === 0}
																className="-ml-0.5 w-[calc(100%+0.125rem)] rounded px-0.5 text-left hover:bg-neutral-100 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60 disabled:hover:bg-transparent"
																onClick={() =>
																	requestClashObjectViewerFocus(keys)
																}
															>
																{obj.itemName ?? "Unnamed"}
																{obj.itemType ? (
																	<span className="text-neutral-400">
																		{" "}
																		— {obj.itemType}
																	</span>
																) : null}
															</button>
														</li>
													);
												})}
											</ul>
										</div>
									) : null}
									<div>
										<p className="text-sm font-semibold text-neutral-900">
											Context Objects ({selectedClashContextObjects.length})
										</p>
										{!hasComputedSelectedClashContext ? (
											<p className="mt-1 text-xs text-neutral-500">
												Context objects have not been generated yet. Click
												“Show Context” at least once.
											</p>
										) : selectedClashContextObjects.length === 0 ? (
											<p className="mt-1 text-xs text-neutral-500">
												No nearby context objects found.
											</p>
										) : (
											<ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
												{selectedClashContextObjects.map((obj) => (
													<li key={obj.id}>
														<button
															type="button"
															className="-ml-0.5 w-[calc(100%+0.125rem)] rounded px-0.5 text-left hover:bg-neutral-100 hover:underline"
															onClick={() =>
																requestClashObjectViewerFocus([obj.id])
															}
														>
															{obj.name ?? "Unnamed object"}
															{obj.item_type ? (
																<span className="text-neutral-400">
																	{" "}
																	— {obj.item_type}
																</span>
															) : null}
														</button>
													</li>
												))}
											</ul>
										)}
									</div>
								</div>
							) : (
								<p className="text-sm text-neutral-500">
									Select a clash to see context.
								</p>
							)}
						</AnalysisPanel>
					</div>
				</FloatingCard>
				) : null}

				{isRecommendationsOpen ? (
				<FloatingCard
					panelId="clash-recommendations"
					title="Recommendations"
					titleIcon={<AiIdeaIcon className="h-3.5 w-3.5" />}
					widthClassName="w-fit"
					initialPosition={{ x: 80, y: 384 }}
					initialSize={{ width: 464, height: 304 }}
					minSize={{ width: 352, height: 208 }}
					headerActions={
						<ClosePanelButton
							label="Close recommendations panel"
							onClose={() => closePanel("clash-recommendations")}
						/>
					}
				>
					{/*
						Layout mirrors API-backed fields:
						- severity / description ← analysis_metadata.severity + severity_justification (else design_impact)
						- currentStep badges ← recommendation index among recommendations[]
						- lead / supporting ← lead_trade + supporting_trades[]
						- actions ← actions[]
						- validations ← feasibility_validations[]
					*/}
					<div className="flex h-full min-h-0 flex-col text-xs text-neutral-700">
						{selected ? (
							<>
								<div className="min-h-0 flex-1 divide-y divide-neutral-200 overflow-y-auto">
									{analysisLoading ? (
										<p className="py-3 italic text-neutral-500">
											Running analysis…
										</p>
									) : null}
									{activeRecommendation ? (
										<>
											{/* analysis_metadata severity + rationale (description) */}
											<div className="space-y-2 py-3">
												{activeRecommendationSeverity ? (
													<p className="text-sm font-semibold text-red-600">
														{activeRecommendationSeverity}
													</p>
												) : null}
												{activeRecommendationSummary ? (
													<p className="leading-snug text-neutral-600">
														{activeRecommendationSummary}
													</p>
												) : null}
											</div>

											{/* currentStep: one badge per recommendation option */}
											<div className="space-y-3 py-3">
												<div className="flex flex-wrap items-center justify-between gap-2">
													<div className="flex flex-wrap gap-2">
														{analysisRecommendations.map((rec, idx) => {
															const isActive =
																idx === activeRecommendationIndex;
															return (
																<button
																	type="button"
																	key={`${selected.id}:${rec.raw}`}
																	onClick={() =>
																		setActiveRecommendationIndex(idx)
																	}
																	className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-xs font-semibold transition ${
																		isActive
																			? "bg-blue-500 text-white shadow-sm hover:bg-blue-600"
																			: "bg-neutral-600 text-white hover:bg-neutral-500"
																	}`}
																	aria-pressed={isActive}
																	aria-label={`Show recommendation ${idx + 1}`}
																>
																	{idx + 1}
																</button>
															);
														})}
													</div>
													<AddToChatButton
														className="h-8 shrink-0 !py-0"
														disabled={
															activeRecommendationInfoAttachment === null
														}
														added={isActiveRecommendationInfoAttached}
														title={
															isActiveRecommendationInfoAttached
																? "Recommendation already attached for context on your next message"
																: "Attach this recommendation to your next chat message as reference only"
														}
														label="Add to chat"
														onClick={() => {
															if (
																!activeRecommendationInfoAttachment ||
																isActiveRecommendationInfoAttached
															) {
																return;
															}
															addAttachment(
																activeRecommendationInfoAttachment,
															);
															setChatOpen(true);
															requestComposerFocus();
														}}
													/>
												</div>

												{activeRecommendation.parsed ? (
													<dl className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-x-2 gap-y-2 text-xs">
														<dt className="font-semibold text-neutral-800">
															Lead
														</dt>
														<dd className="text-neutral-500">
															{activeRecommendation.parsed.lead_trade}
														</dd>
														<dt className="font-semibold text-neutral-800">
															Supporting
														</dt>
														<dd className="text-neutral-500">
															{activeRecommendation.parsed.supporting_trades
																.length > 0
																? activeRecommendation.parsed.supporting_trades.join(
																		", ",
																	)
																: "—"}
														</dd>
													</dl>
												) : (
													<p className="whitespace-pre-wrap leading-snug text-neutral-600">
														{activeRecommendation.raw}
													</p>
												)}
											</div>

											{activeRecommendation.parsed ? (
												<>
													<RecommendationListSection
														title="Actions"
														items={activeRecommendation.parsed.actions}
													/>
													<RecommendationListSection
														title="Validations"
														items={
															activeRecommendation.parsed
																.feasibility_validations
														}
													/>
												</>
											) : null}

											{analysisNotes ? (
												<p className="py-3 text-[11px] leading-snug text-amber-800">
													<span className="font-semibold">Notes:</span>{" "}
													{analysisNotes}
												</p>
											) : null}
										</>
									) : analysisCompleted ? (
										<p className="py-3 text-neutral-500">
											No recommendations were returned. Check Context or try again.
										</p>
									) : (
										<p className="py-3 text-neutral-500">
											Run analysis to generate ranked resolution strategies for
											this clash.
										</p>
									)}
								</div>

								<div className="mt-3 grid shrink-0 grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2 border-t border-neutral-200 pt-3">
									<button
										type="button"
										disabled={
											!activeRecommendationAttachment ||
											isActiveRecommendationAttached
										}
										onClick={() => {
											if (!activeRecommendationAttachment) return;
											addAttachment(activeRecommendationAttachment);
											setChatOpen(true);
											requestComposerFocus();
										}}
										className="cursor-pointer rounded-lg bg-neutral-600 px-2 py-2 text-xs font-semibold text-white transition hover:bg-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-neutral-600"
										title={
											isActiveRecommendationAttached
												? "Recommendation already in chat composer"
												: "Send this recommendation to chat for revision"
										}
									>
										Modify
									</button>
									<button
										type="button"
										onClick={handleRunAnalysis}
										disabled={!speckleViewer || analysisLoading}
										className="cursor-pointer rounded-lg bg-neutral-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-neutral-600"
									>
										{analysisLoading
											? "Running…"
											: analysisCompleted
												? "Re-Run Analysis"
												: "Run Analysis"}
									</button>
								</div>
							</>
						) : (
							<p className="py-2 text-neutral-500">
								Select a clash to see recommendations.
							</p>
						)}
					</div>
				</FloatingCard>
				) : null}
			</div>
		</div>
	);
}
