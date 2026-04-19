import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useApp } from "../../context/useApp";

export interface SelectedObjectMetadataBadgeProps {
	speckleId: string;
	/** Screen X relative to viewer container (pixels). */
	screenX: number;
	/** Screen Y relative to viewer container (pixels). */
	screenY: number;
	/** Show collapsed pill (viewport hover). */
	visible: boolean;
	containerWidth: number;
	containerHeight: number;
}

const BADGE_HEIGHT = 32;
const POPOVER_MAX_W = 280;
const BADGE_SURFACE_MS = 200;

export function SelectedObjectMetadataBadge({
	speckleId,
	screenX,
	screenY,
	visible,
	containerWidth,
	containerHeight,
}: SelectedObjectMetadataBadgeProps) {
	const { objectMetadata, setObjectMetadata, clearObjectMetadata } = useApp();
	const stored = objectMetadata[speckleId] ?? "";
	const hasNote = stored.trim().length > 0;
	const formId = useId();
	const [expanded, setExpanded] = useState(false);
	const [draft, setDraft] = useState(stored);
	const popoverRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (expanded) setDraft(stored);
	}, [expanded, stored]);

	useEffect(() => {
		if (!expanded) return;
		const onDocPointerDown = (e: PointerEvent) => {
			const el = popoverRef.current;
			if (el && !el.contains(e.target as Node)) {
				setExpanded(false);
			}
		};
		document.addEventListener("pointerdown", onDocPointerDown, true);
		return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
	}, [expanded]);

	const clamped = (() => {
		const halfW = POPOVER_MAX_W / 2;
		const pad = 8;
		let x = screenX;
		let y = screenY;
		x = Math.min(Math.max(x, halfW + pad), containerWidth - halfW - pad);
		y = Math.min(Math.max(y, BADGE_HEIGHT + pad), containerHeight - pad);
		return { x, y };
	})();

	const handleSave = useCallback(() => {
		setObjectMetadata(speckleId, draft);
		setExpanded(false);
	}, [draft, setObjectMetadata, speckleId]);

	const handleDelete = useCallback(() => {
		clearObjectMetadata(speckleId);
		setDraft("");
		setExpanded(false);
	}, [clearObjectMetadata, speckleId]);

	const handleCancel = useCallback(() => {
		setDraft(stored);
		setExpanded(false);
	}, [stored]);

	const wantMount = visible || expanded;
	const [mounted, setMounted] = useState(wantMount);
	const [surfaced, setSurfaced] = useState(false);

	useEffect(() => {
		if (wantMount) {
			setMounted(true);
		} else if (mounted) {
			setSurfaced(false);
			const id = window.setTimeout(() => setMounted(false), BADGE_SURFACE_MS);
			return () => window.clearTimeout(id);
		}
	}, [wantMount, mounted]);

	useLayoutEffect(() => {
		if (!mounted || !wantMount) return;
		setSurfaced(false);
		let cancelled = false;
		const id = requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (!cancelled) setSurfaced(true);
			});
		});
		return () => {
			cancelled = true;
			cancelAnimationFrame(id);
		};
	}, [mounted, wantMount]);

	if (!mounted) {
		return null;
	}

	return (
		<div
			ref={popoverRef}
			className={`absolute z-[15] ${surfaced ? "pointer-events-auto" : "pointer-events-none"}`}
			style={{
				left: 0,
				top: 0,
				transform: `translate(${clamped.x}px, ${clamped.y}px) translate(-50%, -100%)`,
			}}
			onPointerDown={(e) => e.stopPropagation()}
		>
			<div
				className={`flex flex-col items-center gap-1 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
					surfaced
						? "translate-y-0 opacity-100"
						: "translate-y-1 opacity-0"
				}`}
			>
			{expanded ? (
				<div
					className="w-[min(280px,calc(100vw-2rem))] rounded-lg border border-neutral-200 bg-white p-2 shadow-lg"
					role="dialog"
					aria-labelledby={`${formId}-title`}
				>
					<p
						id={`${formId}-title`}
						className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600"
					>
						Object note
					</p>
					<label htmlFor={`${formId}-textarea`} className="sr-only">
						Metadata for selected object
					</label>
					<textarea
						id={`${formId}-textarea`}
						rows={4}
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						className="w-full resize-y rounded border border-neutral-200 px-2 py-1.5 text-xs text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary/50"
						placeholder="Add coordinator notes…"
					/>
					<div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
						<button
							type="button"
							onClick={handleCancel}
							className="cursor-pointer rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
						>
							Cancel
						</button>
						{hasNote ? (
							<button
								type="button"
								onClick={handleDelete}
								className="cursor-pointer rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
							>
								Delete
							</button>
						) : null}
						<button
							type="button"
							onClick={handleSave}
							className="cursor-pointer rounded-md bg-slate-600 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
						>
							Save
						</button>
					</div>
				</div>
			) : null}

			<button
				type="button"
				onClick={() => setExpanded((e) => !e)}
				className="group flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-300 bg-white/95 px-2.5 py-1 text-xs font-medium text-neutral-800 shadow-sm backdrop-blur-sm transition-colors duration-150 hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-900 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/35"
				title={hasNote ? "Edit note" : "Add note"}
				aria-expanded={expanded}
			>
				<svg
					className="h-3.5 w-3.5 shrink-0 text-neutral-500 transition-colors duration-150 group-hover:text-neutral-700"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
					/>
				</svg>
				<span>{hasNote ? "Edit note" : "Add note"}</span>
			</button>
			</div>
		</div>
	);
}
