import type { Viewer } from "@speckle/viewer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { useApp } from "../../context/useApp";
import type { SpeckleLoadState } from "../../hooks/useSpeckleViewer";
import { buildClashContextAnalysisPayload } from "../../lib/clashContextRegion";
import { clashReportGateMessage } from "../../lib/clashReportGateMessage";
import {
	postClashAnalyzeContext,
	type ClashAnalyzeContextRequestBody,
} from "../../lib/postClashAnalysis";
import { AnalysisPanel } from "./AnalysisPanel";
import { ClashSelector } from "./ClashSelector";
import { FloatingCard } from "../ui/FloatingCard";
import { ModelViewer } from "./ModelViewer";
import { SpeckleLoadProgressBar } from "./SpeckleLoadProgressBar";
import { SeverityFilter } from "./SeverityFilter";

/** Dedupes gate toast when React Strict Mode runs effects twice on mount. */
let lastInspectorGateToast: { at: number; message: string } | null = null;
const INSPECTOR_GATE_TOAST_DEDUPE_MS = 400;

const SEVERITY_COLORS: Record<string, string> = {
	CRITICAL: "bg-red-100 text-red-700",
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
	} = useApp();

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
	const [analysisWatchOut, setAnalysisWatchOut] = useState<string[]>([]);
	const [analysisRecommendations, setAnalysisRecommendations] = useState<
		string[]
	>([]);
	const [analysisNotes, setAnalysisNotes] = useState<string | null>(null);
	const [analysisError, setAnalysisError] = useState<string | null>(null);
	const [analysisCompleted, setAnalysisCompleted] = useState(false);
	const [analysisContextPreview, setAnalysisContextPreview] =
		useState<ClashAnalyzeContextRequestBody | null>(null);
	const [isContextPreviewOpen, setIsContextPreviewOpen] = useState(false);
	const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
	const [isContextCollapsed, setIsContextCollapsed] = useState(true);
	const [isRecommendationsCollapsed, setIsRecommendationsCollapsed] =
		useState(true);

	useEffect(() => {
		// Clear prior Run Analysis output when the user picks another clash.
		void selectedClashId;
		setAnalysisWatchOut([]);
		setAnalysisRecommendations([]);
		setAnalysisNotes(null);
		setAnalysisError(null);
		setAnalysisCompleted(false);
	}, [selectedClashId]);

	useEffect(() => {
		if (!selectedClashId) return;
		const stillValid = filteredClashes.some((c) => c.id === selectedClashId);
		if (!stillValid) setSelectedClashId(null);
	}, [filteredClashes, selectedClashId, setSelectedClashId]);

	const selected = filteredClashes.find((c) => c.id === selectedClashId);
	const selectedClashName =
		clashes.find((c) => c.id === selectedClashId)?.label ?? "No clash selected";
	const collapseToggleClassName =
		"max-w-[16rem] cursor-pointer truncate rounded px-1.5 py-0.5 text-xs font-medium normal-case tracking-normal text-neutral-700 hover:bg-neutral-100";
	const compactToggleClassName =
		"cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100";
	const nonEmptySpeckleCount = useMemo(
		() => speckleUrls.filter((u) => u.trim().length > 0).length,
		[speckleUrls],
	);

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
		setAnalysisWatchOut([]);
		setAnalysisRecommendations([]);
		setAnalysisNotes(null);

		try {
			const built = buildClashContextAnalysisPayload(speckleViewer, selected, {
				speckleUrlCount: nonEmptySpeckleCount,
			});
			const requestBody: ClashAnalyzeContextRequestBody = {
				clash: selected,
				clash_objects_original: selected.objects ?? [],
				context_region: built.context_region,
				nearby_speckle_objects: built.nearby_speckle_objects,
				meta: {
					...built.meta,
					unmatched_clash_keys: built.unmatched_clash_keys,
				},
			};
			setAnalysisContextPreview(requestBody);
			setIsContextPreviewOpen(true);
			const res = await postClashAnalyzeContext(requestBody);
			setAnalysisWatchOut(res.watch_out_for);
			setAnalysisRecommendations(res.recommendations);
			setAnalysisNotes(res.notes);
			setAnalysisCompleted(true);
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Analysis request failed.";
			setAnalysisError(msg);
			showToast("error", msg);
		} finally {
			setAnalysisLoading(false);
		}
	}, [selected, speckleViewer, nonEmptySpeckleCount, showToast]);

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
						<div className="mx-auto max-w-xl rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 shadow-sm">
							Upload error: {uploadError}
						</div>
					</div>
				) : null}

				<FloatingCard
					panelId="clash-controls"
					title="Clash Controls"
					initialPosition={{ x: 16, y: 64 }}
					initialSize={{ width: 320, height: 208 }}
					minSize={{ width: 304, height: 192 }}
					resizable={false}
					autoHeight
					overflowMode="visible"
					bodyScroll={false}
					showBody={!isControlsCollapsed}
					titleSubtitle={isControlsCollapsed ? selectedClashName : undefined}
					headerActions={
						<button
							type="button"
							className={collapseToggleClassName}
							title={
								isControlsCollapsed
									? `Expand controls (${selectedClashName})`
									: "Collapse clash controls"
							}
							onPointerDown={(event) => event.stopPropagation()}
							onClick={() => setIsControlsCollapsed((prev) => !prev)}
						>
							<span className="text-neutral-400" aria-hidden="true">
								{isControlsCollapsed ? "▼" : "▲"}
							</span>
						</button>
					}
				>
					<div className="space-y-3">
						<button
							type="button"
							onClick={() => {
								clearSession();
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

				<FloatingCard
					panelId="clash-context"
					title="Context"
					widthClassName="w-fit"
					initialPosition={{ x: 16, y: 288 }}
					initialSize={{ width: 464, height: 368 }}
					minSize={{ width: 352, height: 224 }}
					autoHeight={isContextCollapsed}
					autoWidth={isContextCollapsed}
					showBody={!isContextCollapsed}
					resizable={!isContextCollapsed}
					headerActions={
						<button
							type="button"
							className={compactToggleClassName}
							title={isContextCollapsed ? "Expand context panel" : "Collapse context panel"}
							onPointerDown={(event) => event.stopPropagation()}
							onClick={() => setIsContextCollapsed((prev) => !prev)}
						>
							<span className="text-neutral-400" aria-hidden="true">
								{isContextCollapsed ? "▼" : "▲"}
							</span>
						</button>
					}
				>
					<div className="h-full min-h-0">
						<AnalysisPanel
							title="Context"
							onRunAnalysis={handleRunAnalysis}
							runAnalysisPending={analysisLoading}
							runAnalysisDisabled={!selected || !speckleViewer}
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
										<span className="font-semibold text-neutral-900">Clash:</span>{" "}
										{selected.label}
										{selected.testName && (
											<span className="ml-1 text-neutral-400">
												({selected.testName})
											</span>
										)}
									</p>
									<p className="flex items-center gap-2">
										<span className="font-semibold text-neutral-900">
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
										<p>
											<span className="font-semibold text-neutral-900">
												Disciplines:
											</span>{" "}
											{selected.disciplines.join(", ")}
										</p>
									) : null}
									{selected.lead && selected.lead.length > 0 ? (
										<p>
											<span className="font-semibold text-neutral-900">
												Lead (stays in place):
											</span>{" "}
											{selected.lead.join(", ")}
										</p>
									) : null}
									{selected.description ? (
										<p>
											<span className="font-semibold text-neutral-900">Type:</span>{" "}
											{selected.description}
										</p>
									) : null}
									{selected.status ? (
										<p>
											<span className="font-semibold text-neutral-900">Status:</span>{" "}
											{selected.status}
										</p>
									) : null}
									{selected.distance != null ? (
										<p>
											<span className="font-semibold text-neutral-900">
												Distance:
											</span>{" "}
											{selected.distance.toFixed(4)}
										</p>
									) : null}
									{selected.objects && selected.objects.length > 0 ? (
										<div>
											<span className="font-semibold text-neutral-900">Objects:</span>
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
									{analysisWatchOut.length > 0 ? (
										<div>
											<p className="font-semibold text-neutral-900">
												Things to watch out for
											</p>
											<ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
												{analysisWatchOut.map((line) => (
													<li key={line}>{line}</li>
												))}
											</ul>
										</div>
									) : null}
									{analysisNotes ? (
										<p className="whitespace-pre-wrap text-xs text-neutral-600">
											{analysisNotes}
										</p>
									) : null}
								</div>
							) : (
								<p className="text-sm text-neutral-500">
									Select a clash to see context.
								</p>
							)}
						</AnalysisPanel>
					</div>
				</FloatingCard>

				<FloatingCard
					panelId="clash-recommendations"
					title="Recommendations"
					widthClassName="w-fit"
					initialPosition={{ x: 16, y: 344 }}
					initialSize={{ width: 464, height: 304 }}
					minSize={{ width: 352, height: 208 }}
					autoHeight={isRecommendationsCollapsed}
					autoWidth={isRecommendationsCollapsed}
					showBody={!isRecommendationsCollapsed}
					resizable={!isRecommendationsCollapsed}
					headerActions={
						<button
							type="button"
							className={compactToggleClassName}
							title={
								isRecommendationsCollapsed
									? "Expand recommendations panel"
									: "Collapse recommendations panel"
							}
							onPointerDown={(event) => event.stopPropagation()}
							onClick={() => setIsRecommendationsCollapsed((prev) => !prev)}
						>
							<span className="text-neutral-400" aria-hidden="true">
								{isRecommendationsCollapsed ? "▼" : "▲"}
							</span>
						</button>
					}
				>
					<div className="h-full min-h-0">
						<AnalysisPanel
							title="Recommendations"
							onRunAnalysis={handleRunAnalysis}
							runAnalysisPending={analysisLoading}
							runAnalysisDisabled={!selected || !speckleViewer}
						>
							{selected ? (
								<div className="space-y-3 text-sm text-neutral-700">
									{analysisLoading ? (
										<p className="text-xs italic text-neutral-500">
											Running analysis…
										</p>
									) : null}
									{analysisRecommendations.length > 0 ? (
										<ol className="list-decimal space-y-2 pl-5">
											{analysisRecommendations.map((rec) => (
												<li key={rec}>{rec}</li>
											))}
										</ol>
									) : analysisCompleted ? (
										<p className="text-sm text-neutral-500">
											No recommendations were returned. Check Context or try again.
										</p>
									) : (
										<p className="text-sm text-neutral-500">
											Run analysis to generate three ranked resolution
											strategies for this clash.
										</p>
									)}
								</div>
							) : (
								<p className="text-sm text-neutral-500">
									Select a clash to see recommendations.
								</p>
							)}
						</AnalysisPanel>
					</div>
				</FloatingCard>
			</div>
			{isContextPreviewOpen && analysisContextPreview ? (
					<div className="absolute inset-0 z-40 flex items-start justify-center bg-neutral-900/45 p-4 backdrop-blur-[1px]">
						<section className="mt-3 flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl">
							<header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
								<div>
									<h3 className="text-sm font-bold text-neutral-900">
										Analysis Context Payload
									</h3>
									<p className="text-xs text-neutral-500">
										Preview of the context sent to /clashes/analyze-context
									</p>
								</div>
								<button
									type="button"
									onClick={() => setIsContextPreviewOpen(false)}
									className="cursor-pointer rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
								>
									Close
								</button>
							</header>

							<div className="grid min-h-0 flex-1 gap-3 overflow-auto p-4 sm:grid-cols-2">
								<div className="min-h-0 rounded-lg border border-neutral-200">
									<div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
										Original clash objects (
										{analysisContextPreview.clash_objects_original?.length ?? 0})
									</div>
									<pre className="max-h-[55vh] overflow-auto px-3 py-2 text-[11px] leading-relaxed text-neutral-700">
										{JSON.stringify(
											analysisContextPreview.clash_objects_original ?? [],
											null,
											2,
										)}
									</pre>
								</div>

								<div className="min-h-0 rounded-lg border border-neutral-200">
									<div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
										Nearby objects (
										{analysisContextPreview.nearby_speckle_objects.length})
									</div>
									<div className="max-h-[55vh] space-y-2 overflow-auto px-3 py-2 text-[11px] leading-relaxed text-neutral-700">
										{analysisContextPreview.nearby_speckle_objects.length ===
										0 ? (
											<p className="text-xs text-neutral-500">
												No nearby objects found for this context region.
											</p>
										) : (
											analysisContextPreview.nearby_speckle_objects.map(
												(obj) => (
													<div
														key={obj.id}
														className="rounded-md border border-neutral-200 bg-white p-2"
													>
														<p className="text-xs font-semibold text-neutral-800">
															{obj.name ?? "Unnamed object"}
														</p>
														<div className="mt-1 flex flex-wrap gap-1 text-[10px]">
															<span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
																ID: {obj.id}
															</span>
															{obj.item_type ? (
																<span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
																	Item type: {obj.item_type}
																</span>
															) : null}
															{obj.speckle_type ? (
																<span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">
																	Geometry: {obj.speckle_type}
																</span>
															) : null}
														</div>
													</div>
												),
											)
										)}
									</div>
								</div>
							</div>
						</section>
					</div>
				) : null}
		</div>
	);
}
