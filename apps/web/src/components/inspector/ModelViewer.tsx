import {
	CameraController,
	DefaultObjectPickConfiguration,
	FilteringExtension,
	ObjectLayers,
	SelectionExtension,
	type SelectionExtensionOptions,
	SpeckleLineMaterial,
	type Viewer,
	ViewerEvent,
} from "@speckle/viewer";
import {
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Box3,
	BoxGeometry,
	Color,
	EdgesGeometry,
	Vector2,
	Vector3,
} from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
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
	expandMatchedClashSubtreeSpeckleIds,
	resolveClashObjectNodes,
	unionBoxesForSpeckleObjectIds,
	zoomViewerToSmallestClashObject,
} from "../../lib/zoomToSmallestClashObject";
import { SpeckleLoadProgressBar } from "./SpeckleLoadProgressBar";
import { SelectedObjectMetadataBadge } from "./SelectedObjectMetadataBadge";
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
	/** Nearby context object ids (AABB region) highlighted light blue when enabled. */
	contextObjectIds?: string[];
	/**
	 * When provided, a semi-transparent AABB overlay is added to the scene so
	 * the user can visualize the region used to collect context objects. When
	 * `null`/omitted, any previously added overlay is removed.
	 */
	contextBoundingBox?: {
		min: [number, number, number];
		max: [number, number, number];
	} | null;
	clashHighlightMode?: "single" | "severity" | "none";
	/** Fired when the viewer has finished loading models (same timing as internal highlight setup). */
	onViewerReady?: (viewer: Viewer) => void;
	/** Fired when the viewer is disposed (URL change, unmount). */
	onViewerDisposed?: () => void;
	/** Optional external observer for Speckle loading progress state. */
	onLoadStateChange?: (state: SpeckleLoadState) => void;
	/** Whether the internal top-center progress pill is shown. */
	showLoadProgress?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `FilteringExtension` state key for clash isolate / ghost (must be stable). */
const CLASH_ISOLATE_STATE_KEY = "balrog-clash-isolate";

export function ModelViewer({
	clashSelectionId,
	clashObjectMatchKeys,
	contextObjectIds = [],
	contextBoundingBox = null,
	clashHighlightMode = "none",
	onViewerReady,
	onViewerDisposed,
	onLoadStateChange,
	showLoadProgress = true,
}: ModelViewerProps) {
	const {
		speckleUrls,
		clashObjectViewerFocus,
		selectedObjectData,
		setSelectedObjectData,
	} = useApp();
	const containerRef = useRef<HTMLElement>(null);
	const [loadedViewer, setLoadedViewer] = useState<Viewer | null>(null);
	const [speckleLoadState, setSpeckleLoadState] = useState<SpeckleLoadState>({
		loading: false,
		percent: 0,
	});
	const [isViewportHovered, setIsViewportHovered] = useState(false);

	const activeUrls = useMemo(
		() => speckleUrls.map((u) => u.trim()).filter((u) => u.length > 0),
		[speckleUrls],
	);

	const selectedSpeckleId = useMemo(() => {
		if (!selectedObjectData) return null;
		const id = selectedObjectData.id;
		return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
	}, [selectedObjectData]);

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

	const onLoadState = useCallback(
		(state: SpeckleLoadState) => {
			setSpeckleLoadState(state);
			onLoadStateChange?.(state);
		},
		[onLoadStateChange],
	);

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
		contextObjectIds: contextObjectIds
			.map((s) => s.trim())
			.filter((s) => s.length > 0),
	});

	const contextBoundingBoxKey = useMemo(
		() => (contextBoundingBox ? JSON.stringify(contextBoundingBox) : ""),
		[contextBoundingBox],
	);

	/** Re-run clash isolate when highlight inputs *or* bbox helper visibility change. */
	const clashIsolateEffectDeps = useMemo(
		() => ({ highlight: clashHighlightEffectKey, bbox: contextBoundingBoxKey }),
		[clashHighlightEffectKey, contextBoundingBoxKey],
	);

	/**
	 * Add/remove the context AABB helper in a layout effect so it is torn down
	 * *before* the clash isolate `useEffect` runs when the bbox is toggled off.
	 * Otherwise isolate re-applies while the helper mesh is still in the scene and
	 * can leave Speckle's batch/depth state inconsistent until the next isolate.
	 */
	useLayoutEffect(() => {
		if (!loadedViewer || !contextBoundingBoxKey) return;

		let box: {
			min: [number, number, number];
			max: [number, number, number];
		};
		try {
			box = JSON.parse(contextBoundingBoxKey);
		} catch {
			return;
		}

		const speckleRenderer = loadedViewer.getRenderer();
		const scene = speckleRenderer?.scene;
		if (!scene) return;

		const sizeX = Math.max(box.max[0] - box.min[0], 1e-4);
		const sizeY = Math.max(box.max[1] - box.min[1], 1e-4);
		const sizeZ = Math.max(box.max[2] - box.min[2], 1e-4);
		const cx = (box.min[0] + box.max[0]) / 2;
		const cy = (box.min[1] + box.max[1]) / 2;
		const cz = (box.min[2] + box.max[2]) / 2;

		const boxGeometry = new BoxGeometry(sizeX, sizeY, sizeZ);
		const edgesWork = new EdgesGeometry(boxGeometry);
		const lineGeometry = new LineSegmentsGeometry();
		lineGeometry.fromEdgesGeometry(edgesWork);

		const lineMaterial = new SpeckleLineMaterial({
			/** Orange-500: reads clearly vs gray ghosts and light-blue context tint (#7dd3fc). */
			color: new Color(0xf97316),
			linewidth: 5,
			worldUnits: false,
			transparent: true,
			opacity: 1,
			depthWrite: false,
			/**
			 * Overlay passes often render without the main scene depth buffer bound, so
			 * depth tests discard the whole line. Draw on top like other UI helpers.
			 */
			depthTest: false,
			vertexColors: false,
		});

		// set the diffuse value to orange as well, else it will be gray.
		(
			lineMaterial as unknown as {
				uniforms?: { diffuse?: { value: Color } };
			}
		).uniforms?.diffuse?.value?.copy(new Color(0xf97316));


		const drawingBufferSize = new Vector2();
		const glRenderer = speckleRenderer.renderer as unknown as {
			getDrawingBufferSize(target: Vector2): void;
		};
		/** `SpeckleLineMaterial` extends `LineMaterial`; package typings omit inherited fields. */
		const lineMat = lineMaterial as SpeckleLineMaterial & {
			resolution: Vector2;
			needsUpdate: boolean;
			dispose: () => void;
		};
		const updateResolution = () => {
			glRenderer.getDrawingBufferSize(drawingBufferSize);
			lineMat.resolution.copy(drawingBufferSize);
		};
		updateResolution();

		const edges = new LineSegments2(lineGeometry, lineMaterial);
		edges.frustumCulled = false;
		edges.renderOrder = 10000;
		edges.userData.isContextBoundingBoxOverlay = true;
		edges.userData.skipFiltering = true;
		/**
		 * `OVERLAY` (+ `MEASUREMENTS`) matches Speckle's overlay geometry pass only —
		 * not stream depth/stencil prepasses or the SHADED `MESH+PROPS` pass, so
		 * isolate/ghost batches are unaffected. Parent to `scene` in world space (not
		 * `rootGroup`) so the helper is never part of the streamed subtree.
		 */
		// edges.layers.mask =
		// 	(1 << ObjectLayers.OVERLAY) | (1 << ObjectLayers.MEASUREMENTS);
		edges.layers.set(ObjectLayers.OVERLAY);
		edges.position.set(cx, cy, cz);
		scene.add(edges);

		const worldBox = new Box3(
			new Vector3(box.min[0], box.min[1], box.min[2]),
			new Vector3(box.max[0], box.max[1], box.max[2]),
		);
		let zoomRaf1 = 0;
		let zoomRaf2 = 0;
		const runZoomToContextBox = () => {
			try {
				if (!loadedViewer.hasExtension(CameraController)) return;
				const camera = loadedViewer.getExtension(CameraController);
				camera.setCameraView(worldBox, true, 1.32);
				loadedViewer.requestRender();
			} catch (zoomErr) {
				console.warn(
					"[ModelViewer] Context bounding box camera fit failed:",
					zoomErr,
				);
			}
		};
		zoomRaf1 = requestAnimationFrame(() => {
			zoomRaf2 = requestAnimationFrame(runZoomToContextBox);
		});

		const roTarget = loadedViewer.getContainer();
		const resizeObserver =
			typeof ResizeObserver !== "undefined"
				? new ResizeObserver(() => {
						updateResolution();
						lineMat.needsUpdate = true;
						loadedViewer.requestRender();
					})
				: null;
		if (resizeObserver && roTarget) {
			resizeObserver.observe(roTarget);
		}

		loadedViewer.requestRender();

		return () => {
			cancelAnimationFrame(zoomRaf1);
			cancelAnimationFrame(zoomRaf2);
			resizeObserver?.disconnect();
			try {
				edges.removeFromParent();
			} catch {
				/* scene may be disposed */
			}
			lineGeometry.dispose();
			boxGeometry.dispose();
			edgesWork.dispose();
			lineMat.dispose();
		};
	}, [loadedViewer, contextBoundingBoxKey]);

	useEffect(() => {
		if (!loadedViewer) {
			if (import.meta.env.DEV) {
				console.debug(
					"[ModelViewer] Clash highlight skipped: viewer not ready yet",
				);
			}
			return;
		}

		const {
			keys: ids,
			contextObjectIds: contextIds,
			selectionId,
			mode,
		} = JSON.parse(clashIsolateEffectDeps.highlight) as {
			selectionId: string;
			mode: "single" | "severity" | "none";
			keys: string[];
			contextObjectIds: string[];
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

			const { matchedObjectIds, unmatchedElementIds, matchedNodes } =
				resolveClashObjectNodes(loadedViewer, ids);
			const contextExclusionIds =
				expandMatchedClashSubtreeSpeckleIds(matchedNodes);

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
				const uniqueContextIds = [...new Set(contextIds)];
				const contextOnlyIds = uniqueContextIds.filter(
					(id) => !contextExclusionIds.has(id),
				);
				const visibleIds =
					contextOnlyIds.length > 0
						? [...new Set([...matchedObjectIds, ...contextOnlyIds])]
						: matchedObjectIds;
				if (filteringExt) {
					filteringExt.isolateObjects(
						visibleIds,
						CLASH_ISOLATE_STATE_KEY,
						true,
						true,
					);
					const colors: { objectIds: string[]; color: string }[] = [
						{ objectIds: matchedObjectIds, color: "#ff0000" },
					];
					if (contextOnlyIds.length > 0) {
						colors.push({ objectIds: contextOnlyIds, color: "#7dd3fc" });
					}
					filteringExt.setUserObjectColors(colors);
					const renderer = loadedViewer.getRenderer();
					prevPickFilter = renderer.objectPickConfiguration.pickedObjectsFilter;
					const pickAllow = expandClashPickAllowIds(loadedViewer, visibleIds);
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
	}, [clashIsolateEffectDeps, loadedViewer]);

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
	}, [loadedViewer, clashObjectViewerFocus, setSelectedObjectData]);

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
	}, [loadedViewer, setSelectedObjectData]);

	useEffect(() => {
		if (activeUrls.length === 0) {
			setLoadedViewer(null);
			setSelectedObjectData(null);
			setSpeckleLoadState({ loading: false, percent: 0 });
		}
	}, [activeUrls.length, setSelectedObjectData]);

	return (
		<div className="relative h-full w-full min-h-0 flex-1 overflow-hidden bg-neutral-200/50">
			{activeUrls.length === 0 ? (
				<div className="absolute inset-0 flex min-h-[320px] items-center justify-center p-6 text-center text-sm text-neutral-500">
					Add at least one Speckle model URL on the landing page to load the 3D
					view.
				</div>
			) : (
				<div
					className="absolute inset-0 min-h-[320px]"
					onPointerEnter={() => setIsViewportHovered(true)}
					onPointerLeave={() => setIsViewportHovered(false)}
				>
					<section
						ref={containerRef}
						aria-label="Speckle 3D model viewer"
						className="absolute inset-0 min-h-[320px]"
					/>
					{showLoadProgress && speckleLoadState.loading ? (
						<SpeckleLoadProgressBar percent={speckleLoadState.percent} />
					) : null}
					{loadedViewer && selectedSpeckleId ? (
						<SelectedObjectBadgeOverlay
							viewer={loadedViewer}
							containerRef={containerRef}
							speckleId={selectedSpeckleId}
							isViewportHovered={isViewportHovered}
						/>
					) : null}
					{selectedObjectData ? <SpeckleObjectOverlay /> : null}
				</div>
			)}
		</div>
	);
}

interface SelectedObjectBadgeOverlayProps {
	viewer: Viewer;
	containerRef: RefObject<HTMLElement | null>;
	speckleId: string;
	isViewportHovered: boolean;
}

/**
 * Renders the viewport "Add note / Edit note" badge anchored to a selected
 * Speckle object. Owns its own rAF + screen-position state so per-frame
 * camera updates do **not** re-render the parent `ModelViewer` (and any
 * sibling overlays such as `SpeckleObjectOverlay`).
 *
 * The selected object's world-space AABB center is computed once per
 * `(viewer, speckleId)` and projected each frame; only the cheap projection
 * runs in the rAF loop.
 */
function SelectedObjectBadgeOverlay({
	viewer,
	containerRef,
	speckleId,
	isViewportHovered,
}: SelectedObjectBadgeOverlayProps) {
	const [badgeScreen, setBadgeScreen] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [containerSize, setContainerSize] = useState(() => {
		const el = containerRef.current;
		return {
			width: el?.clientWidth ?? 0,
			height: el?.clientHeight ?? 0,
		};
	});

	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el || typeof ResizeObserver === "undefined") return;
		const ro = new ResizeObserver(() => {
			setContainerSize({
				width: el.clientWidth,
				height: el.clientHeight,
			});
		});
		ro.observe(el);
		setContainerSize({
			width: el.clientWidth,
			height: el.clientHeight,
		});
		return () => ro.disconnect();
	}, [containerRef]);

	useEffect(() => {
		setBadgeScreen(null);

		const worldCenter = new Vector3();
		const projection = new Vector3();
		let hasCenter = false;
		let lastX = Number.NaN;
		let lastY = Number.NaN;
		let raf = 0;

		const ensureWorldCenter = (): boolean => {
			if (hasCenter) return true;
			const box = unionBoxesForSpeckleObjectIds(viewer, [speckleId]);
			if (!box || box.isEmpty()) return false;
			box.getCenter(worldCenter);
			hasCenter = true;
			return true;
		};

		const tick = () => {
			raf = requestAnimationFrame(tick);
			if (!ensureWorldCenter()) return;
			const el = containerRef.current;
			if (!el) return;
			const renderer = viewer.getRenderer();
			const camera = renderer?.renderingCamera;
			if (!camera) return;
			projection.copy(worldCenter).project(camera);
			const w = el.clientWidth;
			const h = el.clientHeight;
			if (w <= 0 || h <= 0) return;
			const x = (projection.x * 0.5 + 0.5) * w;
			const y = (-projection.y * 0.5 + 0.5) * h;
			if (Math.abs(x - lastX) > 0.5 || Math.abs(y - lastY) > 0.5) {
				lastX = x;
				lastY = y;
				setBadgeScreen({ x, y });
			}
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [viewer, speckleId, containerRef]);

	if (
		!badgeScreen ||
		containerSize.width <= 0 ||
		containerSize.height <= 0
	) {
		return null;
	}

	return (
		<SelectedObjectMetadataBadge
			speckleId={speckleId}
			screenX={badgeScreen.x}
			screenY={badgeScreen.y}
			visible={isViewportHovered}
			containerWidth={containerSize.width}
			containerHeight={containerSize.height}
		/>
	);
}
