import { SelectionExtension, type Viewer, ViewerEvent } from "@speckle/viewer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../context/useApp";
import {
	type SpeckleLoadState,
	useSpeckleViewer,
} from "../../hooks/useSpeckleViewer";
import { zoomViewerToSmallestClashObject } from "../../lib/zoomToSmallestClashObject";
import { SpeckleLoadProgressBar } from "./SpeckleLoadProgressBar";
import { SpeckleObjectOverlay } from "./SpeckleObjectOverlay";

export interface ModelViewerProps {
	/**
	 * Speckle object / application ids for the current clash. When set, the viewer
	 * frames the object with the smallest axis-aligned bounds among these ids.
	 */
	clashObjectApplicationIds?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function ModelViewer({ clashObjectApplicationIds }: ModelViewerProps) {
	const { speckleUrls } = useApp();
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

	const onModelsLoaded = useCallback((viewer: Viewer) => {
		setLoadedViewer(viewer);
	}, []);

	const onLoadState = useCallback((state: SpeckleLoadState) => {
		setSpeckleLoadState(state);
	}, []);

	useSpeckleViewer(containerRef, activeUrls, {
		enabled: activeUrls.length > 0,
		debug: true,
		authToken,
		onModelsLoaded,
		onLoadState,
	});

	const clashFramingKey = JSON.stringify(
		(clashObjectApplicationIds ?? [])
			.map((s) => s.trim())
			.filter((s) => s.length > 0),
	);

	useEffect(() => {
		const ids =
			clashFramingKey === "[]" ? [] : (JSON.parse(clashFramingKey) as string[]);
		if (ids.length === 0 || !loadedViewer) return;
		zoomViewerToSmallestClashObject(loadedViewer, ids);
	}, [clashFramingKey, loadedViewer]);

	useEffect(() => {
		if (!loadedViewer) return;

		const selectionExtension = loadedViewer.getExtension(SelectionExtension);
		if (!selectionExtension) return;

		const syncSelectedObject = () => {
			const [nextSelectedObject] = selectionExtension.getSelectedObjects();
			setSelectedObjectData(
				isRecord(nextSelectedObject) ? nextSelectedObject : null,
			);
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
