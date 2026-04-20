import type { MouseEventHandler } from "react";

interface AddToChatButtonProps {
	onClick: MouseEventHandler<HTMLButtonElement>;
	/** Display variant. `"compact"` is a small icon-only button for list rows. */
	variant?: "default" | "compact";
	disabled?: boolean;
	title?: string;
	/** Shown when attachment is already present; renders a check/"Added" state. */
	added?: boolean;
	/** Override visible label (default: "Add to chat" / "Added"). */
	label?: string;
	className?: string;
}

function PlusGlyph({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<title>Add</title>
			<path d="M12 5v14" />
			<path d="M5 12h14" />
		</svg>
	);
}

function CheckGlyph({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<title>Added</title>
			<path d="M5 13l4 4L19 7" />
		</svg>
	);
}

export function AddToChatButton({
	onClick,
	variant = "default",
	disabled,
	title,
	added,
	label,
	className,
}: AddToChatButtonProps) {
	const effectiveTitle =
		title ?? (added ? "Already attached to next message" : "Add to chat");
	const effectiveLabel = label ?? (added ? "Added" : "Add to chat");

	if (variant === "compact") {
		return (
			<button
				type="button"
				onClick={onClick}
				disabled={disabled || added}
				title={effectiveTitle}
				aria-label={effectiveTitle}
				className={`inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-neutral-400 transition hover:bg-neutral-100 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary/50 disabled:cursor-not-allowed disabled:text-primary/70 ${
					className ?? ""
				}`}
			>
				{added ? (
					<CheckGlyph className="h-3.5 w-3.5" />
				) : (
					<PlusGlyph className="h-3.5 w-3.5" />
				)}
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled || added}
			title={effectiveTitle}
			className={`inline-flex cursor-pointer items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700 transition hover:border-primary/40 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary/50 disabled:cursor-not-allowed disabled:border-primary/30 disabled:text-primary ${
				className ?? ""
			}`}
		>
			{added ? (
				<CheckGlyph className="h-3 w-3" />
			) : (
				<PlusGlyph className="h-3 w-3" />
			)}
			<span>{effectiveLabel}</span>
		</button>
	);
}
