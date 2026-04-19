import { useState } from "react";
import type { AgentActivityItem } from "../../types";
import { ToolResultView } from "./ToolResultView";

function ChevronIcon({
	open,
	className,
}: {
	open: boolean;
	className?: string;
}) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 16 16"
			fill="currentColor"
			className={`${className ?? "size-3"} transition-transform duration-150 ${open ? "rotate-90" : ""}`}
			aria-hidden
		>
			<title>Toggle</title>
			<path
				fillRule="evenodd"
				d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
				clipRule="evenodd"
			/>
		</svg>
	);
}

function formatArgs(args: Record<string, unknown>): string {
	try {
		return JSON.stringify(args, null, 2);
	} catch {
		return String(args);
	}
}

function summarizeLine(
	activity: AgentActivityItem[],
	thinkingBuffer?: string,
	streamPreamble?: string,
): string {
	const parts: string[] = [];
	const thoughts = activity.filter((i) => i.type === "thought").length;
	const tools = activity.filter((i) => i.type === "tool_call").length;
	const results = activity.filter((i) => i.type === "tool_result").length;
	if (streamPreamble?.trim()) parts.push("Metadata");
	if (thinkingBuffer?.trim()) parts.push("Extended thinking");
	if (thoughts > 0)
		parts.push(`${thoughts} reasoning step${thoughts > 1 ? "s" : ""}`);
	if (tools > 0) parts.push(`${tools} tool call${tools > 1 ? "s" : ""}`);
	if (results > 0) parts.push(`${results} result${results > 1 ? "s" : ""}`);
	return parts.join(" · ");
}

export interface AgentActivityLogProps {
	activity?: AgentActivityItem[];
	thinkingBuffer?: string;
	/** Raw model text before an answer keyword (shown in metadata, not the bubble). */
	streamPreamble?: string;
	streaming?: boolean;
	preAnswerStreaming?: boolean;
}

export function AgentActivityLog({
	activity = [],
	thinkingBuffer,
	streamPreamble,
	streaming,
	preAnswerStreaming = false,
}: AgentActivityLogProps) {
	const [open, setOpen] = useState(false);
	const hasExtended = Boolean(thinkingBuffer?.trim());
	const hasPreamble = Boolean(streamPreamble?.trim());
	const count = activity.length + (hasExtended ? 1 : 0) + (hasPreamble ? 1 : 0);
	const summary = summarizeLine(activity, thinkingBuffer, streamPreamble);

	if (count === 0 && !preAnswerStreaming) return null;

	return (
		<div className="mb-2">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full cursor-pointer items-center gap-1.5 rounded-md bg-neutral-100/80 px-2.5 py-1.5 text-left text-xs leading-snug text-neutral-600 transition-colors hover:bg-neutral-200/70"
			>
				<ChevronIcon open={open} className="size-3 shrink-0 text-neutral-400" />
				{preAnswerStreaming ? (
					<span
						className="flex items-center gap-1 font-medium text-neutral-700"
						role="status"
					>
						<span>Thinking</span>
						<span className="inline-flex items-center gap-px" aria-hidden>
							<span className="agent-thinking-dot inline-block size-1 rounded-full bg-neutral-500" />
							<span className="agent-thinking-dot inline-block size-1 rounded-full bg-neutral-500" />
							<span className="agent-thinking-dot inline-block size-1 rounded-full bg-neutral-500" />
						</span>
						{summary ? (
							<span className="ml-1 font-normal text-neutral-500">
								— {summary}
							</span>
						) : null}
					</span>
				) : (
					<span className="truncate text-neutral-500">
						{summary || "Agent metadata"}
					</span>
				)}
			</button>

			{open ? (
				<div className="mt-1 flex flex-col gap-1.5 pl-4">
					{hasPreamble ? (
						<ActivityCard
							label="Reasoning"
							accent="neutral"
							streaming={streaming && preAnswerStreaming}
						>
							<pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-neutral-900">
								{streamPreamble}
							</pre>
						</ActivityCard>
					) : null}
					{hasExtended ? (
						<ActivityCard
							label="Extended thinking"
							accent="violet"
							streaming={streaming}
						>
							<pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-violet-950">
								{thinkingBuffer}
							</pre>
						</ActivityCard>
					) : null}

					{activity.map((item, i) => {
						const key = `${item.type}-${i}-${item.type === "tool_call" ? item.toolId : item.type === "tool_result" ? item.toolId : "t"}`;
						if (item.type === "thought") {
							return (
								<ActivityCard key={key} label="Reasoning" accent="sky">
									<p className="whitespace-pre-wrap text-sm leading-relaxed text-sky-950">
										{item.text}
									</p>
								</ActivityCard>
							);
						}
						if (item.type === "tool_call") {
							return (
								<ActivityCard
									key={key}
									label={
										<>
											Tool call{" "}
											<code className="ml-1 rounded bg-amber-100/90 px-1 py-px font-mono text-xs font-medium text-amber-950">
												{item.toolName}
											</code>
										</>
									}
									accent="amber"
								>
									<details className="group">
										<summary className="cursor-pointer text-xs font-medium text-amber-800 hover:text-amber-950">
											Arguments
										</summary>
										<pre className="mt-1 max-h-36 overflow-auto rounded border border-amber-200/60 bg-white/80 p-2 font-mono text-xs leading-snug text-neutral-800">
											{formatArgs(item.args)}
										</pre>
									</details>
								</ActivityCard>
							);
						}
						return (
							<ActivityCard
								key={key}
								label={
									<>
										{item.isError ? "Tool error" : "Tool result"}{" "}
										<code
											className={`ml-1 rounded px-1 py-px font-mono text-xs font-medium ${item.isError ? "bg-red-100 text-red-950" : "bg-emerald-100 text-emerald-950"}`}
										>
											{item.toolName}
										</code>
									</>
								}
								accent={item.isError ? "red" : "emerald"}
							>
								<ToolResultView content={item.content} isError={item.isError} />
							</ActivityCard>
						);
					})}
				</div>
			) : null}
		</div>
	);
}

const ACCENT_CLASSES = {
	neutral: {
		border: "border-neutral-200/90",
		bg: "bg-neutral-50/90",
		label: "text-neutral-800",
	},
	violet: {
		border: "border-violet-200/80",
		bg: "bg-violet-50/60",
		label: "text-violet-800",
	},
	sky: {
		border: "border-sky-200/80",
		bg: "bg-sky-50/60",
		label: "text-sky-900",
	},
	amber: {
		border: "border-amber-200/80",
		bg: "bg-amber-50/60",
		label: "text-amber-900",
	},
	emerald: {
		border: "border-emerald-200/80",
		bg: "bg-emerald-50/60",
		label: "text-emerald-900",
	},
	red: {
		border: "border-red-200/80",
		bg: "bg-red-50/60",
		label: "text-red-800",
	},
} as const;

function ActivityCard({
	label,
	accent,
	streaming,
	children,
}: {
	label: React.ReactNode;
	accent: keyof typeof ACCENT_CLASSES;
	streaming?: boolean;
	children: React.ReactNode;
}) {
	const c = ACCENT_CLASSES[accent];
	return (
		<div className={`rounded-md border ${c.border} ${c.bg} px-2.5 py-2`}>
			<div
				className={`mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${c.label}`}
			>
				{label}
				{streaming ? (
					<span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-violet-500" />
				) : null}
			</div>
			{children}
		</div>
	);
}
