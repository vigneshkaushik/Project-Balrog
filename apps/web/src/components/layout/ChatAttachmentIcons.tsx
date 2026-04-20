import { AiIdeaIcon } from "../inspector/AiIdeaIcon";
import type { ChatAttachmentKind } from "../../context/ChatAttachmentsContext";

/** Red-diamond "collision" glyph used for clash attachments. */
function ClashGlyph({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.8}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<title>Clash</title>
			<path d="M12 2L22 12L12 22L2 12Z" />
			<path d="M9 9L15 15M15 9L9 15" />
		</svg>
	);
}

/** Cube/object glyph for selected Speckle object attachments. */
function SelectedObjectGlyph({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.6}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<title>Selected object</title>
			<path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" />
			<path d="M3 7L12 12L21 7" />
			<path d="M12 12V22" />
		</svg>
	);
}

export function ChatAttachmentKindIcon({
	kind,
	className,
}: {
	kind: ChatAttachmentKind;
	className?: string;
}) {
	const cls = className ?? "h-3.5 w-3.5";
	if (kind === "clash") return <ClashGlyph className={cls} />;
	if (kind === "selected_object") return <SelectedObjectGlyph className={cls} />;
	return <AiIdeaIcon className={cls} />;
}
