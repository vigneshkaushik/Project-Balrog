import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	useChatAttachments,
	type ChatAttachment,
} from "../../context/ChatAttachmentsContext";
import { useClashAnalysis } from "../../context/ClashAnalysisContext";
import { useApp } from "../../context/useApp";
import {
	buildClashAttachment,
	buildRecommendationAttachment,
	buildSelectedObjectAttachment,
} from "../../lib/buildChatAttachments";
import { buildClashContextAnalysisPayload } from "../../lib/clashContextRegion";
import { chatAttachmentKindLabel } from "../../lib/chatAttachmentLabels";
import { ChatAttachmentKindIcon } from "./ChatAttachmentIcons";

function PlusIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={1.8}
			stroke="currentColor"
			className="size-5"
			aria-hidden
		>
			<title>Add context</title>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M12 4.5v15m7.5-7.5h-15"
			/>
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg
			className="h-3.5 w-3.5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<title>Already added</title>
			<path d="M5 13l4 4L19 7" />
		</svg>
	);
}

interface MenuRowProps {
	kind: ChatAttachment["kind"];
	label: string;
	detail?: string;
	onAdd: () => void;
	disabled?: boolean;
	disabledReason?: string;
	alreadyAdded?: boolean;
}

function MenuRow({
	kind,
	label,
	detail,
	onAdd,
	disabled,
	disabledReason,
	alreadyAdded,
}: MenuRowProps) {
	const effectiveDisabled = Boolean(disabled) || Boolean(alreadyAdded);
	return (
		<button
			type="button"
			disabled={effectiveDisabled}
			onClick={onAdd}
			title={
				alreadyAdded
					? "Already attached"
					: disabled
						? disabledReason
						: undefined
			}
			className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-neutral-800 transition hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent"
		>
			<span className="shrink-0 text-neutral-500">
				<ChatAttachmentKindIcon kind={kind} />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-medium">{label}</span>
				{detail ? (
					<span className="block truncate text-[11px] text-neutral-500">
						{alreadyAdded ? "Already attached" : disabled ? disabledReason : detail}
					</span>
				) : alreadyAdded ? (
					<span className="block truncate text-[11px] text-neutral-500">
						Already attached
					</span>
				) : disabled ? (
					<span className="block truncate text-[11px] text-neutral-500">
						{disabledReason}
					</span>
				) : null}
			</span>
			{alreadyAdded ? (
				<span className="shrink-0 text-primary" aria-hidden>
					<CheckIcon />
				</span>
			) : null}
		</button>
	);
}

export function ChatAddContextMenu({ disabled }: { disabled?: boolean }) {
	const menuId = useId();
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const popoverRef = useRef<HTMLDivElement | null>(null);

	const {
		filteredClashes,
		clashes,
		selectedClashId,
		selectedObjectData,
		speckleViewer,
		speckleUrls,
		objectMetadata,
	} = useApp();
	const { getAnalysisForClash } = useClashAnalysis();
	const { addAttachment, hasAttachment } = useChatAttachments();

	const selectedClash = useMemo(() => {
		if (!selectedClashId) return null;
		const pool = clashes.length > 0 ? clashes : filteredClashes;
		return pool.find((c) => c.id === selectedClashId) ?? null;
	}, [clashes, filteredClashes, selectedClashId]);

	const analysis = getAnalysisForClash(selectedClash?.id ?? null);
	const recommendations = analysis.recommendations;

	const close = useCallback(() => setOpen(false), []);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: PointerEvent) => {
			const t = e.target as Node | null;
			if (!t) return;
			if (popoverRef.current?.contains(t)) return;
			if (triggerRef.current?.contains(t)) return;
			setOpen(false);
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				setOpen(false);
			}
		};
		window.addEventListener("pointerdown", onPointerDown, true);
		window.addEventListener("keydown", onKeyDown, true);
		return () => {
			window.removeEventListener("pointerdown", onPointerDown, true);
			window.removeEventListener("keydown", onKeyDown, true);
		};
	}, [open]);

	const nonEmptySpeckleCount = useMemo(
		() => speckleUrls.filter((u) => u.trim().length > 0).length,
		[speckleUrls],
	);

	const handleAddCurrentClash = useCallback(() => {
		if (!selectedClash || !speckleViewer) return;
		try {
			const built = buildClashContextAnalysisPayload(
				speckleViewer,
				selectedClash,
				{
					speckleUrlCount: nonEmptySpeckleCount,
					objectMetadata,
				},
			);
			addAttachment(
				buildClashAttachment(selectedClash, {
					context_region: built.context_region,
					nearby_speckle_objects: built.nearby_speckle_objects,
					clash_objects_original: [],
					unmatched_clash_keys: built.unmatched_clash_keys,
					speckle_url_count: built.meta.speckle_url_count,
					capped: built.meta.capped,
				}),
			);
		} catch (err) {
			console.warn("[ChatAddContextMenu] Failed to build clash context", err);
		}
		close();
	}, [
		addAttachment,
		close,
		nonEmptySpeckleCount,
		objectMetadata,
		selectedClash,
		speckleViewer,
	]);

	const handleAddSelectedObject = useCallback(() => {
		if (!selectedObjectData) return;
		const id =
			typeof selectedObjectData.id === "string"
				? selectedObjectData.id.trim()
				: "";
		const userMeta = id && objectMetadata[id] ? objectMetadata[id] : null;
		addAttachment(buildSelectedObjectAttachment(selectedObjectData, userMeta));
		close();
	}, [addAttachment, close, objectMetadata, selectedObjectData]);

	const handleAddRecommendation = useCallback(
		(index: number) => {
			if (!selectedClash) return;
			const text = recommendations[index];
			if (!text) return;
			addAttachment(
				buildRecommendationAttachment(selectedClash, text, index),
			);
			close();
		},
		[addAttachment, close, recommendations, selectedClash],
	);

	const clashRow = useMemo(() => {
		if (!selectedClash) {
			return {
				disabled: true,
				reason: "No clash selected",
				label: "Current clash",
				detail: "Select a clash to attach its context",
				id: "",
			};
		}
		if (!speckleViewer) {
			return {
				disabled: true,
				reason: "Load the 3D model to compute clash context",
				label: `Clash: ${selectedClash.label}`,
				detail: undefined,
				id: `clash:${selectedClash.id}`,
			};
		}
		return {
			disabled: false,
			reason: undefined,
			label: `Clash: ${selectedClash.label}`,
			detail: selectedClash.testName ?? undefined,
			id: `clash:${selectedClash.id}`,
		};
	}, [selectedClash, speckleViewer]);

	const selectedObjectRow = useMemo(() => {
		if (!selectedObjectData) {
			return {
				disabled: true,
				reason: "No 3D object selected",
				label: "Selected object",
				detail: "Pick an object in the viewer",
				id: "",
			};
		}
		const name =
			(typeof selectedObjectData.name === "string" && selectedObjectData.name) ||
			(typeof selectedObjectData.type === "string" && selectedObjectData.type) ||
			"Selected object";
		const idStr =
			typeof selectedObjectData.id === "string"
				? selectedObjectData.id.trim()
				: "";
		return {
			disabled: false,
			reason: undefined,
			label: `Object: ${name}`,
			detail: idStr ? `id=${idStr.slice(0, 12)}…` : undefined,
			id: `selected_object:${idStr || "selected"}`,
		};
	}, [selectedObjectData]);

	return (
		<div className="relative">
			<button
				ref={triggerRef}
				type="button"
				disabled={disabled}
				onClick={() => setOpen((v) => !v)}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={menuId}
				aria-label="Add context to chat"
				title="Add context"
				className="cursor-pointer rounded p-1 text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<PlusIcon />
			</button>

			{open ? (
				<div
					ref={popoverRef}
					id={menuId}
					role="menu"
					className="absolute bottom-full left-0 z-30 mb-2 flex w-80 flex-col gap-0.5 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-lg"
				>
					<div className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
						Add to chat
					</div>

					<MenuRow
						kind="clash"
						label={clashRow.label}
						detail={clashRow.detail}
						disabled={clashRow.disabled}
						disabledReason={clashRow.reason}
						alreadyAdded={
							!clashRow.disabled && clashRow.id
								? hasAttachment(clashRow.id)
								: false
						}
						onAdd={handleAddCurrentClash}
					/>

					<MenuRow
						kind="selected_object"
						label={selectedObjectRow.label}
						detail={selectedObjectRow.detail}
						disabled={selectedObjectRow.disabled}
						disabledReason={selectedObjectRow.reason}
						alreadyAdded={
							!selectedObjectRow.disabled && selectedObjectRow.id
								? hasAttachment(selectedObjectRow.id)
								: false
						}
						onAdd={handleAddSelectedObject}
					/>

					<div className="mt-1 border-t border-neutral-100 pt-1 pb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
						{chatAttachmentKindLabel("recommendation")}s
					</div>
					{!selectedClash ? (
						<div className="px-2 py-1 text-[11px] text-neutral-400">
							Select a clash to see its recommendations.
						</div>
					) : recommendations.length === 0 ? (
						<div className="px-2 py-1 text-[11px] text-neutral-400">
							Run analysis on this clash to unlock per-recommendation attachments.
						</div>
					) : (
						recommendations.map((text, idx) => {
							const built = buildRecommendationAttachment(
								selectedClash,
								text,
								idx,
							);
							return (
								<MenuRow
									key={built.id}
									kind="recommendation"
									label={`#${idx + 1}: ${text}`}
									alreadyAdded={hasAttachment(built.id)}
									onAdd={() => handleAddRecommendation(idx)}
								/>
							);
						})
					)}
				</div>
			) : null}
		</div>
	);
}
