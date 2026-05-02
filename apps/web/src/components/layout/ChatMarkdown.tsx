import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMarkdownVariant = "user" | "assistant";

function flattenText(children: ReactNode): string {
	let s = "";
	const walk = (n: ReactNode): void => {
		if (n == null || typeof n === "boolean") return;
		if (typeof n === "string" || typeof n === "number") {
			s += String(n);
			return;
		}
		if (Array.isArray(n)) {
			for (const c of n) walk(c);
		}
	};
	walk(children);
	return s;
}

function markdownComponents(
	variant: ChatMarkdownVariant,
): Partial<Components> {
	const inlineCodeBg =
		variant === "user"
			? "bg-primary/20 text-neutral-900"
			: "bg-neutral-200/95 text-neutral-900";

	return {
		p: ({ children }) => (
			<p className="mb-2 text-xs leading-snug last:mb-0">
				{children}
			</p>
		),
		ul: ({ children }) => (
			<ul className="mb-2 ml-3.5 list-disc space-y-0.5 pl-0 text-xs leading-snug marker:text-neutral-500 last:mb-0">
				{children}
			</ul>
		),
		ol: ({ children }) => (
			<ol className="mb-2 ml-3.5 list-decimal space-y-0.5 pl-0 text-xs leading-snug marker:text-neutral-500 last:mb-0">
				{children}
			</ol>
		),
		li: ({ children, className }) => (
			<li
				className={`text-xs leading-snug [&.task-list-item]:flex [&.task-list-item]:items-start [&.task-list-item]:gap-0.5 ${className ?? ""}`.trim()}
			>
				{children}
			</li>
		),
		strong: ({ children }) => (
			<strong className="font-semibold text-neutral-950">{children}</strong>
		),
		em: ({ children }) => <em className="italic">{children}</em>,
		del: ({ children }) => (
			<del className="text-neutral-600 line-through">{children}</del>
		),
		a: ({ children, href }) => (
			<a
				href={href}
				className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:text-primary hover:decoration-primary"
				target="_blank"
				rel="noopener noreferrer"
			>
				{children}
			</a>
		),
		blockquote: ({ children }) => (
			<blockquote className="mb-2 border-l-2 border-neutral-400/70 pl-2.5 text-xs leading-snug text-neutral-600 last:mb-0 [&_p]:mb-1 [&_p:last-child]:mb-0">
				{children}
			</blockquote>
		),
		h1: ({ children }) => (
			<h1 className="mb-1.5 mt-1 text-sm font-semibold tracking-tight text-neutral-950 first:mt-0">
				{children}
			</h1>
		),
		h2: ({ children }) => (
			<h2 className="mb-1 mt-1.5 text-xs font-semibold tracking-tight text-neutral-950 first:mt-0">
				{children}
			</h2>
		),
		h3: ({ children }) => (
			<h3 className="mb-1 mt-1.5 text-xs font-semibold text-neutral-950 first:mt-0">
				{children}
			</h3>
		),
		hr: () => <hr className="my-3 border-neutral-300/90" />,
		code: ({ className, children, ...props }) => {
			const hasLang = Boolean(/language-\w+/.exec(className ?? ""));
			const flattened = flattenText(children).replace(/\n$/, "");
			const multilineBlock = flattened.includes("\n");

			if (hasLang || multilineBlock) {
				return (
					<code className={className} {...props}>
						{children}
					</code>
				);
			}

			return (
				<code
					className={`rounded px-0.5 py-px font-mono text-[0.6875rem] leading-snug ${inlineCodeBg}`}
					{...props}
				>
					{children}
				</code>
			);
		},
		pre: ({ children }) => (
			<pre className="mb-2 max-w-full overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-900 px-2 py-1.5 font-mono text-[0.6875rem] leading-relaxed text-neutral-100 last:mb-0 [&_code]:rounded-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:font-mono [&_code]:text-inherit">
				{children}
			</pre>
		),
		table: ({ children }) => (
			<div className="mb-2 max-w-full overflow-x-auto last:mb-0">
				<table className="w-full border-collapse border border-neutral-300 text-left text-xs">
					{children}
				</table>
			</div>
		),
		thead: ({ children }) => (
			<thead className="bg-neutral-200/60">{children}</thead>
		),
		th: ({ children }) => (
			<th className="border border-neutral-300 px-2 py-1.5 font-semibold text-neutral-900">
				{children}
			</th>
		),
		td: ({ children }) => (
			<td className="border border-neutral-300 px-2 py-1.5 text-neutral-800">
				{children}
			</td>
		),
		tr: ({ children }) => <tr className="even:bg-neutral-50/80">{children}</tr>,
		input: ({ checked, disabled, type, ...rest }) =>
			type === "checkbox" ? (
				<input
					type="checkbox"
					checked={Boolean(checked)}
					disabled={disabled ?? true}
					readOnly
					className="mr-1.5 shrink-0 align-middle"
					tabIndex={-1}
					aria-hidden="true"
					{...rest}
				/>
			) : (
				<input type={type} checked={checked} disabled={disabled} {...rest} />
			),
	};
}

export interface ChatMarkdownProps {
	/** Markdown source */
	content: string;
	variant: ChatMarkdownVariant;
	className?: string;
}

/**
 * Renders chat bubble copy as Markdown (GFM): lists, headings, fenced code,
 * tables, links, etc. Caller handles empty strings.
 */
export function ChatMarkdown({ content, variant, className = "" }: ChatMarkdownProps) {
	const components = markdownComponents(variant);

	return (
		<div className={`chat-md min-w-0 break-words ${className}`.trim()}>
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
				{content}
			</ReactMarkdown>
		</div>
	);
}
