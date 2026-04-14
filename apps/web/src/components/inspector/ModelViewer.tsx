import {
	DefaultObjectPickConfiguration,
	FilteringExtension,
	SelectionExtension,
	type SelectionExtensionOptions,
	type Viewer,
	ViewerEvent,
} from "@speckle/viewer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../context/useApp";
import {
	type SpeckleLoadState,
	useSpeckleViewer,
} from "../../hooks/useSpeckleViewer";
import {
	expandClashPickAllowIds,
	renderViewAllowedForClashPick,
} from "../../lib/speckleExpandPickAllow";
import {
	resolveClashObjectNodes,
	zoomViewerToSmallestClashObject,
} from "../../lib/zoomToSmallestClashObject";
import { SpeckleLoadProgressBar } from "./SpeckleLoadProgressBar";
import { SpeckleObjectOverlay } from "./SpeckleObjectOverlay";

export interface ModelViewerProps {
	/**
	 * When the selected clash changes, re-run highlight even if the id list matches
	 * another clash (e.g. both empty).
	 */
	clashSelectionId?: string | null;
	/**
	 * Clash-side identifiers (`elementId`, `revitGlobalId`, …) resolved against the
	 * Speckle scene for red highlight + zoom.
	 */
	clashObjectMatchKeys?: string[];
	clashHighlightMode?: "single" | "severity" | "none";
	/** Fired when the viewer has finished loading models (same timing as internal highlight setup). */
	onViewerReady?: (viewer: Viewer) => void;
	/** Fired when the viewer is disposed (URL change, unmount). */
	onViewerDisposed?: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `FilteringExtension` state key for clash isolate / ghost (must be stable). */
const CLASH_ISOLATE_STATE_KEY = "balrog-clash-isolate";

export function ModelViewer({
	clashSelectionId,
	clashObjectMatchKeys,
	clashHighlightMode = "none",
	onViewerReady,
	onViewerDisposed,
}: ModelViewerProps) {
	const { speckleUrls, clashObjectViewerFocus } = useApp();
	const containerRef = useRef<HTMLElement>(null);
	const [loadedViewer, setLoadedViewer] = useState<Viewer | null>(null);
	const [selectedObjectData, setSelectedObjectData] = useState<Record<
		string,
		unknown
	> | null>(null);
	const [speckleLoadState, setSpeckleLoadState] = useState<SpeckleLoadState>({
		loading: false,
		percent: 0,
	});

	const activeUrls = useMemo(
		() => speckleUrls.map((u) => u.trim()).filter((u) => u.length > 0),
		[speckleUrls],
	);

	const authToken = import.meta.env.VITE_SPECKLE_TOKEN ?? "";

	const onModelsLoaded = useCallback(
		(viewer: Viewer) => {
			setLoadedViewer(viewer);
			onViewerReady?.(viewer);
		},
		[onViewerReady],
	);

	const handleViewerDisposed = useCallback(() => {
		setLoadedViewer(null);
		onViewerDisposed?.();
	}, [onViewerDisposed]);

	const onLoadState = useCallback((state: SpeckleLoadState) => {
		setSpeckleLoadState(state);
	}, []);

	useSpeckleViewer(containerRef, activeUrls, {
		enabled: activeUrls.length > 0,
		debug: true,
		authToken,
		onModelsLoaded,
		onLoadState,
		onViewerDisposed: handleViewerDisposed,
	});

	/** Includes `clashSelectionId` so changing clashes re-runs even when match keys are identical. */
	const clashHighlightEffectKey = JSON.stringify({
		selectionId: clashSelectionId ?? "",
		mode: clashHighlightMode,
		keys: (clashObjectMatchKeys ?? [])
			.map((s) => s.trim())
			.filter((s) => s.length > 0),
	});

	useEffect(() => {
		if (!loadedViewer) {
			if (import.meta.env.DEV) {
				console.debug(
					"[ModelViewer] Clash highlight skipped: viewer not ready yet",
				);
			}
			return;
		}

		const { keys: ids, selectionId, mode } = JSON.parse(
			clashHighlightEffectKey,
		) as {
			selectionId: string;
			mode: "single" | "severity" | "none";
			keys: string[];
		};

		let filteringExt: FilteringExtension | null = null;
		let selectionExt: SelectionExtension | null = null;
		let prevSelectionOptions: SelectionExtensionOptions | null = null;

		try {
			if (loadedViewer.hasExtension(FilteringExtension)) {
				filteringExt = loadedViewer.getExtension(FilteringExtension);
			}
		} catch (err) {
			console.warn("[ModelViewer] FilteringExtension unavailable:", err);
		}

		let zoomRaf1 = 0;
		let zoomRaf2 = 0;
		let pickFilterTouched = false;
		let prevPickFilter:
			| typeof DefaultObjectPickConfiguration.pickedObjectsFilter
			| null = null;

		try {
			if (filteringExt) {
				filteringExt.resetFilters();
			}

			if (ids.length === 0) {
				loadedViewer.requestRender();
				return () => {
					cancelAnimationFrame(zoomRaf1);
					cancelAnimationFrame(zoomRaf2);
					try {
						filteringExt?.resetFilters();
					} catch {
						/* disposed */
					}
					try {
						if (selectionExt && prevSelectionOptions) {
							selectionExt.clearSelection();
							selectionExt.options = prevSelectionOptions;
						}
					} catch {
						/* disposed */
					}
				};
			}

			const { matchedObjectIds, unmatchedElementIds } =
				resolveClashObjectNodes(loadedViewer, ids);

			if (import.meta.env.DEV) {
				console.debug("[ModelViewer] clash selection → Speckle", {
					selectionId,
					clashKeys: ids,
					matchedObjectCount: matchedObjectIds.length,
				});
			}

			if (unmatchedElementIds.length > 0) {
				console.warn(
					"[ModelViewer] No Speckle nodes matched clash identifiers:",
					unmatchedElementIds,
				);
			}

			if (matchedObjectIds.length > 0) {
				if (filteringExt) {
					filteringExt.isolateObjects(
						matchedObjectIds,
						CLASH_ISOLATE_STATE_KEY,
						true,
						true,
					);
					filteringExt.setUserObjectColors([
						{ objectIds: matchedObjectIds, color: "#ff0000" },
					]);
					const renderer = loadedViewer.getRenderer();
					prevPickFilter = renderer.objectPickConfiguration.pickedObjectsFilter;
					const pickAllow = expandClashPickAllowIds(
						loadedViewer,
						matchedObjectIds,
					);
					renderer.objectPickConfiguration = {
						pickedObjectsFilter: (args) => {
							if (!DefaultObjectPickConfiguration.pickedObjectsFilter(args)) {
								return false;
							}
							return renderViewAllowedForClashPick(pickAllow, args[0]);
						},
					};
					pickFilterTouched = true;
				} else if (loadedViewer.hasExtension(SelectionExtension)) {
					try {
						selectionExt = loadedViewer.getExtension(SelectionExtension);
						prevSelectionOptions = selectionExt.options;
						selectionExt.options = {
							selectionMaterialData: {
								...selectionExt.options.selectionMaterialData,
								color: 0xff0000,
							},
						};
						selectionExt.clearSelection();
						selectionExt.selectObjects(matchedObjectIds, true);
					} catch (selErr) {
						console.warn(
							"[ModelViewer] SelectionExtension clash highlight failed:",
							selErr,
						);
					}
				} else {
					console.warn(
						"[ModelViewer] No FilteringExtension or SelectionExtension; cannot highlight clashes",
					);
				}

				if (mode === "single") {
					const viewerForZoom = loadedViewer;
					const runZoom = () => {
						try {
							zoomViewerToSmallestClashObject(viewerForZoom, ids, {
								resolvedObjectIds: matchedObjectIds,
								transition: true,
								fit: 1.3,
							});
							viewerForZoom.requestRender();
						} catch (zoomErr) {
							console.warn("[ModelViewer] clash zoom failed:", zoomErr);
						}
					};
					zoomRaf1 = requestAnimationFrame(() => {
						zoomRaf2 = requestAnimationFrame(runZoom);
					});
				}
				loadedViewer.requestRender();
			}
		} catch (err) {
			console.error("[ModelViewer] Clash highlight / zoom failed:", err);
		}

		return () => {
			cancelAnimationFrame(zoomRaf1);
			cancelAnimationFrame(zoomRaf2);
			if (pickFilterTouched) {
				try {
					loadedViewer.getRenderer().objectPickConfiguration = {
						pickedObjectsFilter: prevPickFilter,
					};
				} catch {
					/* viewer may already be disposed */
				}
			}
			try {
				filteringExt?.resetFilters();
			} catch {
				/* viewer may already be disposed */
			}
			try {
				if (selectionExt && prevSelectionOptions) {
					selectionExt.clearSelection();
					selectionExt.options = prevSelectionOptions;
				}
			} catch {
				/* viewer may already be disposed */
			}
		};
	}, [clashHighlightEffectKey, loadedViewer]);

	/** Context → Objects list: select + zoom to one participant. */
	useEffect(() => {
		if (!loadedViewer || !clashObjectViewerFocus) return;

		const keys = clashObjectViewerFocus.matchKeys;
		if (keys.length === 0) return;

		let selectionExt: SelectionExtension | null = null;
		try {
			if (loadedViewer.hasExtension(SelectionExtension)) {
				selectionExt = loadedViewer.getExtension(SelectionExtension);
			}
		} catch {
			return;
		}
		if (!selectionExt) return;

		const { matchedObjectIds } = resolveClashObjectNodes(loadedViewer, keys);
		if (matchedObjectIds.length === 0) {
			if (import.meta.env.DEV) {
				console.warn(
					"[ModelViewer] Context object focus: no Speckle nodes for keys",
					keys,
				);
			}
			return;
		}

		try {
			selectionExt.selectObjects(matchedObjectIds, false);
			queueMicrotask(() => {
				try {
					const [first] = selectionExt.getSelectedObjects();
					setSelectedObjectData(isRecord(first) ? first : null);
				} catch {
					/* disposed */
				}
			});
		} catch (err) {
			console.warn("[ModelViewer] Context object select failed:", err);
			return;
		}

		let zoomRaf1 = 0;
		let zoomRaf2 = 0;
		const runZoom = () => {
			try {
				zoomViewerToSmallestClashObject(loadedViewer, keys, {
					resolvedObjectIds: matchedObjectIds,
					transition: true,
					fit: 1.3,
				});
				loadedViewer.requestRender();
			} catch (zoomErr) {
				console.warn("[ModelViewer] Context object zoom failed:", zoomErr);
			}
		};
		zoomRaf1 = requestAnimationFrame(() => {
			zoomRaf2 = requestAnimationFrame(runZoom);
		});
		loadedViewer.requestRender();

		return () => {
			cancelAnimationFrame(zoomRaf1);
			cancelAnimationFrame(zoomRaf2);
		};
	}, [loadedViewer, clashObjectViewerFocus]);

	useEffect(() => {
		if (!loadedViewer) return;

		const selectionExtension = loadedViewer.getExtension(SelectionExtension);
		if (!selectionExtension) return;

		const syncSelectedObject = () => {
			try {
				const [nextSelectedObject] = selectionExtension.getSelectedObjects();
				setSelectedObjectData(
					isRecord(nextSelectedObject) ? nextSelectedObject : null,
				);
			} catch (err) {
				console.warn("[ModelViewer] Selection sync failed:", err);
			}
		};

		syncSelectedObject();
		loadedViewer.on(ViewerEvent.ObjectClicked, syncSelectedObject);
	}, [loadedViewer]);

	useEffect(() => {
		if (activeUrls.length === 0) {
			setLoadedViewer(null);
			setSelectedObjectData(null);
			setSpeckleLoadState({ loading: false, percent: 0 });
		}
	}, [activeUrls.length]);

	return (
		<div className="relative min-h-0 flex-1 overflow-hidden bg-neutral-200/50">
			{activeUrls.length === 0 ? (
				<div className="absolute inset-0 flex min-h-[320px] items-center justify-center p-6 text-center text-sm text-neutral-500">
					Add at least one Speckle model URL on the landing page to load the 3D
					view.
				</div>
			) : (
				<>
					<section
						ref={containerRef}
						aria-label="Speckle 3D model viewer"
						className="absolute inset-0 min-h-[320px]"
					/>
					{speckleLoadState.loading ? (
						<SpeckleLoadProgressBar percent={speckleLoadState.percent} />
					) : null}
					{selectedObjectData ? (
						<SpeckleObjectOverlay objectData={selectedObjectData} />
					) : null}
				</>
			)}
		</div>
	);
}
