import {
	CameraController,
	FilteringExtension,
	LoaderEvent,
	SelectionExtension,
	SpeckleLoader,
	UrlHelper,
	Viewer,
} from "@speckle/viewer";
import { type RefObject, useLayoutEffect, useRef } from "react";

export interface SpeckleLoadState {
	loading: boolean;
	/** Overall progress 0–100 across all resolved resources. */
	percent: number;
}

export interface UseSpeckleViewerOptions {
	enabled?: boolean;
	enableSelection?: boolean;
	enableCamera?: boolean;
	enableFiltering?: boolean;
	debug?: boolean;
	authToken?: string;
	onModelsLoaded?: (viewer: Viewer) => void;
	/** Fired when loading starts, on progress, and when loading finishes or errors. */
	onLoadState?: (state: SpeckleLoadState) => void;
	/** Called right before the viewer is disposed (remount, URL change, unmount). */
	onViewerDisposed?: () => void;
}

function normalizeLoaderProgress(progress: number): number {
	if (!Number.isFinite(progress)) return 0;
	if (progress >= 0 && progress <= 1) return progress * 100;
	return Math.min(100, Math.max(0, progress));
}

export function useSpeckleViewer(
	containerRef: RefObject<HTMLElement | null>,
	speckleUrls: string[],
	options: UseSpeckleViewerOptions = {},
) {
	const {
		enabled = true,
		enableSelection = true,
		enableCamera = true,
		enableFiltering = true,
		debug = false,
		authToken = "",
		onModelsLoaded,
		onLoadState,
		onViewerDisposed,
	} = options;

	const viewerRef = useRef<Viewer | null>(null);
	const onModelsLoadedRef = useRef(onModelsLoaded);
	onModelsLoadedRef.current = onModelsLoaded;
	const onLoadStateRef = useRef(onLoadState);
	onLoadStateRef.current = onLoadState;
	const onViewerDisposedRef = useRef(onViewerDisposed);
	onViewerDisposedRef.current = onViewerDisposed;

	// Stable dependency: callers often pass `urls.map(...).filter(...)` which is a
	// new array every render and would retrigger this effect indefinitely.
	const urlsKey = speckleUrls
		.map((u) => u.trim())
		.filter((u) => u.length > 0)
		.join("\u0001");

	useLayoutEffect(() => {
		if (!enabled) return;

		const urls = urlsKey.length > 0 ? urlsKey.split("\u0001") : [];

		if (urls.length === 0) return;

		let cancelled = false;
		let rafId = 0;
		let refAttempts = 0;
		const maxRefAttempts = 80;

		let viewer: Viewer | null = null;
		let mountedEl: HTMLElement | null = null;

		const startWithContainer = (el: HTMLElement) => {
			if (cancelled) return;
			mountedEl = el;
			el.innerHTML = "";

			viewer = new Viewer(el);
			viewerRef.current = viewer;

			const viewerInstance = viewer;
			void (async () => {
				try {
					onLoadStateRef.current?.({ loading: true, percent: 0 });

					if (debug) {
						console.log("[useSpeckleViewer] Initializing viewer...");
						console.log("[useSpeckleViewer] Input URLs:", urls);
						console.log(
							"[useSpeckleViewer] Auth token provided:",
							authToken ? "yes" : "no",
						);
					}

					await viewerInstance.init();
					if (cancelled) return;

					if (enableCamera) {
						viewerInstance.createExtension(CameraController);
						if (debug) {
							console.log("[useSpeckleViewer] CameraController enabled");
						}
					}

					if (enableSelection) {
						viewerInstance.createExtension(SelectionExtension);
						if (debug) {
							console.log("[useSpeckleViewer] SelectionExtension enabled");
						}
					}

					if (enableFiltering) {
						viewerInstance.createExtension(FilteringExtension);
						if (debug) {
							console.log("[useSpeckleViewer] FilteringExtension enabled");
						}
					}

					const resourceUrls: string[] = [];
					for (const speckleUrl of urls) {
						if (cancelled) return;

						if (debug) {
							console.log("[useSpeckleViewer] Loading Speckle URL:", speckleUrl);
						}

						const resolved = await UrlHelper.getResourceUrls(
							speckleUrl,
							authToken,
						);

						if (debug) {
							console.log("[useSpeckleViewer] Resolved resource URLs:", resolved);
						}

						resourceUrls.push(...resolved);
					}

					const total = resourceUrls.length;
					if (total === 0) {
						if (!cancelled) {
							onLoadStateRef.current?.({ loading: false, percent: 100 });
							onModelsLoadedRef.current?.(viewerInstance);
						}
						return;
					}

					let completed = 0;

					for (const resourceUrl of resourceUrls) {
						if (cancelled) return;

						if (debug) {
							console.log(
								"[useSpeckleViewer] Loading resource URL:",
								resourceUrl,
							);
						}

						const loader = new SpeckleLoader(
							viewerInstance.getWorldTree(),
							resourceUrl,
							authToken,
						);

						const onProgress = (payload: { progress: number }) => {
							if (cancelled) return;
							const local = normalizeLoaderProgress(payload.progress) / 100;
							const overall = ((completed + local) / total) * 100;
							onLoadStateRef.current?.({
								loading: true,
								percent: Math.min(100, Math.round(overall)),
							});
						};

						loader.on(LoaderEvent.LoadProgress, onProgress);

						try {
							await viewerInstance.loadObject(loader, true);
						} finally {
							loader.removeListener(LoaderEvent.LoadProgress, onProgress);
						}

						completed += 1;
						if (!cancelled) {
							onLoadStateRef.current?.({
								loading: true,
								percent: Math.round((completed / total) * 100),
							});
						}

						if (debug) {
							console.log("[useSpeckleViewer] Model loaded successfully");
						}
					}
					if (!cancelled) {
						onLoadStateRef.current?.({ loading: false, percent: 100 });
						onModelsLoadedRef.current?.(viewerInstance);
					}
				} catch (err) {
					if (!cancelled) {
						console.error("[useSpeckleViewer] Error:", err);
						onLoadStateRef.current?.({ loading: false, percent: 0 });
					}
				}
			})();
		};

		const tryAttachToContainer = () => {
			if (cancelled) return;
			const el = containerRef.current;
			if (!el) {
				refAttempts += 1;
				if (refAttempts < maxRefAttempts) {
					rafId = requestAnimationFrame(tryAttachToContainer);
				} else if (debug) {
					console.error(
						"[useSpeckleViewer] Container ref never attached; viewer not created",
					);
				}
				return;
			}
			startWithContainer(el);
		};

		tryAttachToContainer();

		return () => {
			cancelled = true;
			cancelAnimationFrame(rafId);

			try {
				onViewerDisposedRef.current?.();
			} catch (err) {
				console.warn("[useSpeckleViewer] onViewerDisposed warning:", err);
			}

			try {
				viewer?.dispose();
			} catch (err) {
				console.warn("[useSpeckleViewer] Dispose warning:", err);
			}

			viewerRef.current = null;
			if (mountedEl) {
				mountedEl.innerHTML = "";
				mountedEl = null;
			}
			viewer = null;
		};
	}, [
		containerRef,
		enabled,
		enableSelection,
		enableCamera,
		enableFiltering,
		debug,
		authToken,
		urlsKey,
	]);

	return viewerRef;
}
