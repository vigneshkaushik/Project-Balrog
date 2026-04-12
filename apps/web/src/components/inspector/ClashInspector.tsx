import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { useApp } from "../../context/useApp";
import { clashReportGateMessage } from "../../lib/clashReportGateMessage";
import { AnalysisPanel } from "./AnalysisPanel";
import { ClashSelector } from "./ClashSelector";
import { ModelViewer } from "./ModelViewer";
import { SeverityFilter } from "./SeverityFilter";

/** Sheet height when fully collapsed: only the resize handle remains visible. */
const SHEET_COLLAPSED_PX = 24;

/** Dedupes gate toast when React Strict Mode runs effects twice on mount. */
let lastInspectorGateToast: { at: number; message: string } | null = null;
const INSPECTOR_GATE_TOAST_DEDUPE_MS = 400;

const SEVERITY_COLORS: Record<string, string> = {
	CRITICAL: "bg-red-100 text-red-700",
	MEDIUM: "bg-amber-100 text-amber-700",
	LOW: "bg-emerald-100 text-emerald-700",
};

export function ClashInspector() {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const {
		navisworksFileName,
		speckleUrls,
		filteredClashes,
		selectedClashId,
		setSelectedClashId,
		clashes,
		isUploading,
		uploadProgress,
		uploadError,
		clearSession,
	} = useApp();

	const hasSpeckleUrl = speckleUrls.some((u) => u.trim().length > 0);
	const hasClashReport = Boolean(navisworksFileName);
	const hasClashes = clashes.length > 0;

	const hasSession =
		hasSpeckleUrl && (hasClashReport || hasClashes || isUploading);

	useEffect(() => {
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
	}, [hasSession, hasSpeckleUrl, hasClashReport, navigate, showToast]);

	const containerRef = useRef<HTMLDivElement>(null);
	const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(
		null,
	);
	const [sheetHeight, setSheetHeight] = useState(240);
	const [isDraggingSheet, setIsDraggingSheet] = useState(false);
	/** Upload / severity inference does not count as analysis. */
	const [analysisHasRun, setAnalysisHasRun] = useState(false);

	useEffect(() => {
		if (filteredClashes.length === 0) return;

		const stillValid =
			selectedClashId && filteredClashes.some((c) => c.id === selectedClashId);

		if (!stillValid) {
			setSelectedClashId(filteredClashes[0].id);
		}
	}, [filteredClashes, selectedClashId, setSelectedClashId]);

	useEffect(() => {
		if (!isDraggingSheet) return;

		const onPointerMove = (event: PointerEvent) => {
			const dragState = dragStateRef.current;
			if (!dragState) return;

			const deltaY = dragState.startY - event.clientY;
			const hostHeight =
				containerRef.current?.clientHeight ?? window.innerHeight;
			const maxHeight = Math.max(280, Math.floor(hostHeight * 0.8));
			const nextHeight = Math.min(
				maxHeight,
				Math.max(SHEET_COLLAPSED_PX, dragState.startHeight + deltaY),
			);

			setSheetHeight(nextHeight);
		};

		const stopDragging = () => {
			setIsDraggingSheet(false);
			dragStateRef.current = null;
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", stopDragging);
		window.addEventListener("pointercancel", stopDragging);

		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", stopDragging);
			window.removeEventListener("pointercancel", stopDragging);
		};
	}, [isDraggingSheet]);

	const selected = filteredClashes.find((c) => c.id === selectedClashId);
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

	if (!hasSession) {
		return null;
	}
	const progressPct =
		uploadProgress && uploadProgress.total > 0
			? Math.round((uploadProgress.completed / uploadProgress.total) * 100)
			: 0;

	return (
		<div className="flex min-h-full min-w-0 flex-1 flex-col">
			{/* Upload progress bar */}
			{isUploading && uploadProgress && (
				<div className="z-30 flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur-sm">
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
			)}

			{/* Upload error banner */}
			{uploadError && (
				<div className="z-30 shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
					Upload error: {uploadError}
				</div>
			)}

			<div
				ref={containerRef}
				className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden"
			>
				<ModelViewer
					clashSelectionId={selectedClashId}
					clashObjectMatchKeys={selectedClashObjectMatchKeys}
				/>

				<div className="absolute left-3 top-3 z-10 w-80 max-w-[calc(100%-1.5rem)] space-y-3">
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
					<ClashSelector />
				</div>

				<div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
					<section
						className="pointer-events-auto flex w-full flex-col overflow-hidden border border-neutral-200 bg-white/95 shadow-xl backdrop-blur-sm"
						style={{ height: `${sheetHeight}px` }}
					>
						<button
							type="button"
							aria-expanded={sheetHeight > SHEET_COLLAPSED_PX}
							aria-label={
								sheetHeight <= SHEET_COLLAPSED_PX
									? "Expand analysis drawer"
									: "Resize or collapse analysis drawer"
							}
							onPointerDown={(event) => {
								dragStateRef.current = {
									startY: event.clientY,
									startHeight: sheetHeight,
								};
								setIsDraggingSheet(true);
							}}
							className="group flex h-6 min-h-0 shrink-0 cursor-row-resize items-center justify-center border-b border-neutral-200"
						>
							<span className="h-0.5 w-12 rounded-full bg-neutral-300 transition group-hover:bg-neutral-400" />
						</button>

						<div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-y-2 overflow-auto px-3 py-2 sm:grid-cols-[1fr_1px_1fr] sm:gap-y-0">
							<div className="min-h-0 min-w-0 sm:pr-6">
								<AnalysisPanel
									title="Context"
									onRunAnalysis={() => setAnalysisHasRun(true)}
								>
									{selected ? (
										<div className="space-y-3 text-sm text-neutral-700">
											<p>
												<span className="font-semibold text-neutral-900">
													Clash:
												</span>{" "}
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
													<span className="text-xs text-neutral-400">
														Not inferred
													</span>
												)}
											</p>

											{selected.description && (
												<p>
													<span className="font-semibold text-neutral-900">
														Type:
													</span>{" "}
													{selected.description}
												</p>
											)}

											{selected.status && (
												<p>
													<span className="font-semibold text-neutral-900">
														Status:
													</span>{" "}
													{selected.status}
												</p>
											)}

											{selected.distance != null && (
												<p>
													<span className="font-semibold text-neutral-900">
														Distance:
													</span>{" "}
													{selected.distance.toFixed(4)}
												</p>
											)}

											{selected.objects && selected.objects.length > 0 && (
												<div>
													<span className="font-semibold text-neutral-900">
														Objects:
													</span>
													<ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
														{selected.objects.map((obj) => (
															<li
																key={
																	obj.elementId ??
																	obj.revitGlobalId ??
																	obj.itemName
																}
															>
																{obj.itemName ?? "Unnamed"}
																{obj.itemType && (
																	<span className="text-neutral-400">
																		{" "}
																		— {obj.itemType}
																	</span>
																)}
															</li>
														))}
													</ul>
												</div>
											)}
										</div>
									) : (
										<p className="text-sm text-neutral-500">
											{!analysisHasRun
												? "Analysis has not been run"
												: "Select a clash to see context."}
										</p>
									)}
								</AnalysisPanel>
							</div>

							<div
								className="h-px w-full shrink-0 bg-neutral-200 sm:h-full sm:min-h-0 sm:w-full sm:self-stretch"
								aria-hidden
							/>

							<div className="min-h-0 min-w-0 sm:pl-6">
								<AnalysisPanel
									title="Recommendations"
									onRunAnalysis={() => setAnalysisHasRun(true)}
								>
									{selected ? (
										analysisHasRun ? (
											<div className="space-y-3 text-sm text-neutral-700">
												{selected.disciplines &&
													selected.disciplines.length > 0 && (
														<p>
															<span className="font-semibold text-neutral-900">
																Disciplines:
															</span>{" "}
															{selected.disciplines.join(", ")}
														</p>
													)}

												{selected.lead && selected.lead.length > 0 && (
													<p>
														<span className="font-semibold text-neutral-900">
															Lead (stays in place):
														</span>{" "}
														{selected.lead.join(", ")}
													</p>
												)}

												{!selected.severity && isUploading ? (
													<p className="text-xs italic text-neutral-400">
														Severity inference in progress…
													</p>
												) : !selected.severity ? (
													<p className="text-sm text-neutral-500">
														Severity not available yet for this clash.
													</p>
												) : (
													<div>
														<p className="font-semibold text-neutral-900">
															Suggested actions:
														</p>
														<ul className="mt-1 list-disc space-y-1 pl-5">
															<li>
																Confirm which trade owns the primary geometry.
															</li>
															<li>
																Check whether the MEP route can be shifted or
																rerouted.
															</li>
															<li>
																Verify if clearance, maintenance access, or fire
																code is affected.
															</li>
															<li>
																Capture the issue and draft a coordination note
																or RFI.
															</li>
														</ul>
													</div>
												)}
											</div>
										) : (
											<p className="text-sm text-neutral-500">
												Analysis has not been run
											</p>
										)
									) : (
										<p className="text-sm text-neutral-500">
											{!analysisHasRun
												? "Analysis has not been run"
												: "Select a clash to see recommendations."}
										</p>
									)}
								</AnalysisPanel>
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
