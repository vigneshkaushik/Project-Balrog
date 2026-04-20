import {
	type ChatAttachment,
	useChatAttachments,
} from "../../context/ChatAttachmentsContext";
import { chatAttachmentKindLabel } from "../../lib/chatAttachmentLabels";
import { ChatAttachmentKindIcon } from "./ChatAttachmentIcons";

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

function Chip({
	attachment,
	onRemove,
}: {
	attachment: ChatAttachment;
	onRemove: (id: string) => void;
}) {
	const label = attachment.label || chatAttachmentKindLabel(attachment.kind);
	return (
		<span
			className="group inline-flex min-w-0 max-w-[260px] shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-white py-0.5 pl-2 pr-1 text-xs text-neutral-700 shadow-sm"
			title={label}
		>
			<span className="shrink-0 text-neutral-500" aria-hidden>
				<ChatAttachmentKindIcon kind={attachment.kind} />
			</span>
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
					<Chip attachment={a} onRemove={removeAttachment} />
				</li>
			))}
		</ul>
	);
}
