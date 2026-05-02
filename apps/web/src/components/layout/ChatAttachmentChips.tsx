import {
	type ChatAttachment,
	useChatAttachments,
} from "../../context/ChatAttachmentsContext";
import { chatAttachmentKindLabel } from "../../lib/chatAttachmentLabels";
import type { ChatAttachmentSummary } from "../../types";
import { ChatAttachmentKindIcon } from "./ChatAttachmentIcons";

/** Stable list key from kind + label (avoids index-as-key lint). */
function stableSummaryKey(summary: ChatAttachmentSummary): string {
	let h = 5381;
	const s = `${summary.kind}\0${summary.label}`;
	for (let i = 0; i < s.length; i += 1) {
		h = ((h << 5) + h) ^ s.charCodeAt(i);
	}
	return `${summary.kind}-${(h >>> 0).toString(36)}`;
}

const CHIP_BASE =
	"group inline-flex min-w-0 max-w-[260px] shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-white py-0.5 pl-2 text-xs text-neutral-700 shadow-sm";

function ChipRemoveIcon() {
	return (
		<svg
			className="h-3 w-3"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.4}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<title>Remove</title>
			<path d="M6 6L18 18" />
			<path d="M6 18L18 6" />
		</svg>
	);
}

function ModifyStickyIcon() {
	return (
		<svg
			className="h-3 w-3 shrink-0 text-primary"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<title>Sticky until removed</title>
			<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
		</svg>
	);
}

function DraftChip({
	attachment,
	onRemove,
}: {
	attachment: ChatAttachment;
	onRemove: (id: string) => void;
}) {
	const label = attachment.label || chatAttachmentKindLabel(attachment.kind);
	const isModifySticky =
		attachment.kind === "recommendation" && attachment.mode === "modify";
	const chipClass = isModifySticky
		? `${CHIP_BASE} border-primary/35 bg-primary/5 pr-1`
		: `${CHIP_BASE} pr-1`;
	const titleHint = isModifySticky
		? `${label} — stays attached until you remove it or re-run analysis`
		: label;
	return (
		<span className={chipClass} title={titleHint}>
			<span className="shrink-0 text-neutral-500" aria-hidden>
				{isModifySticky ? <ModifyStickyIcon /> : (
					<ChatAttachmentKindIcon kind={attachment.kind} />
				)}
			</span>
			{isModifySticky ? (
				<span className="shrink-0 rounded bg-primary/15 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-primary">
					Modify
				</span>
			) : null}
			<span className="min-w-0 flex-1 truncate">{label}</span>
			<button
				type="button"
				onClick={() => onRemove(attachment.id)}
				className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full p-0.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary/50"
				aria-label={`Remove ${label}`}
			>
				<ChipRemoveIcon />
			</button>
		</span>
	);
}

function ReadOnlyChip({ summary }: { summary: ChatAttachmentSummary }) {
	const label = summary.label || chatAttachmentKindLabel(summary.kind);
	return (
		<span className={`${CHIP_BASE} pr-2`} title={label}>
			<span className="shrink-0 text-neutral-500" aria-hidden>
				<ChatAttachmentKindIcon kind={summary.kind} />
			</span>
			<span className="min-w-0 flex-1 truncate">{label}</span>
		</span>
	);
}

/**
 * Row of currently-attached items. Renders `null` when empty so callers can
 * drop it above the chat input without reserving space.
 */
export function ChatAttachmentChips() {
	const { attachments, removeAttachment } = useChatAttachments();
	if (attachments.length === 0) return null;
	return (
		<ul
			className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-neutral-100 bg-white/60 px-3 py-2"
			aria-label="Attached to the next message"
		>
			{attachments.map((a) => (
				<li key={a.id} className="min-w-0">
					<DraftChip attachment={a} onRemove={removeAttachment} />
				</li>
			))}
		</ul>
	);
}

/** Read-only chips for a sent or restored user message. */
export function ChatMessageAttachmentChips({
	attachments,
	className = "",
}: {
	attachments: ChatAttachmentSummary[];
	className?: string;
}) {
	if (attachments.length === 0) return null;
	return (
		<ul
			className={`mb-1.5 flex flex-wrap items-center gap-1.5 ${className}`}
			aria-label="Attached context"
		>
			{attachments.map((a) => (
				<li key={stableSummaryKey(a)} className="min-w-0">
					<ReadOnlyChip summary={a} />
				</li>
			))}
		</ul>
	);
}
