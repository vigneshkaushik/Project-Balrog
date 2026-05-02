import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type RefObject,
} from "react";
import type { PointerEventHandler } from "react";
import { createPortal } from "react-dom";
import {
	type AgentConfigPublic,
	type AgentProvider,
	DEFAULT_AGENT_CONFIG,
	fetchAgentConfig,
	MODEL_OPTIONS,
	saveAgentConfigToServer,
} from "../../lib/agentConfig";
import { splitAnswerStream } from "../../lib/answerStreamSplit";
import { assistantBubbleText } from "../../lib/assistantDisplayText";
import {
	fetchChatHistory,
	persistConversationId,
	readStoredConversationId,
} from "../../lib/chatHistory";
import { useChatAttachments } from "../../context/ChatAttachmentsContext";
import { useClashAnalysis } from "../../context/ClashAnalysisContext";
import { useFloatingChat } from "../../context/FloatingChatContext";
import {
	applyAgentRecommendationUpdate,
	isUpdateClashRecommendationToolName,
} from "../../lib/applyAgentRecommendationUpdate";
import { toChatAttachmentsWire } from "../../lib/chatAttachments";
import { postChatStream } from "../../lib/postChatStream";
import type { ChatAttachmentSummary, ChatMessage } from "../../types";
import { AgentActivityLog } from "./AgentActivityLog";
import { ChatMarkdown } from "./ChatMarkdown";
import { ChatAddContextMenu } from "./ChatAddContextMenu";
import {
	ChatAttachmentChips,
	ChatMessageAttachmentChips,
} from "./ChatAttachmentChips";

function UploadIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={1.5}
			stroke="currentColor"
			className="size-5"
			aria-hidden
		>
			<title>Upload</title>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
			/>
		</svg>
	);
}

function SettingsIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={1.5}
			stroke="currentColor"
			className="size-5"
			aria-hidden
		>
			<title>Settings</title>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
			/>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
			/>
		</svg>
	);
}

function EyeIcon({ open }: { open: boolean }) {
	if (open) {
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				strokeWidth={1.5}
				stroke="currentColor"
				className="size-5"
				aria-hidden
			>
				<title>Hide API key</title>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m12.743 12.743 3 3"
				/>
			</svg>
		);
	}
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={1.5}
			stroke="currentColor"
			className="size-5"
			aria-hidden
		>
			<title>Show API key</title>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
			/>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
			/>
		</svg>
	);
}

function SendIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="currentColor"
			className="size-5"
			aria-hidden
		>
			<title>Send</title>
			<path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
		</svg>
	);
}

const SETTINGS_VIEWPORT_MARGIN = 8;
const SETTINGS_GAP = 8;
const SETTINGS_MAX_WIDTH = 448;
const SETTINGS_MIN_WIDTH = 280;

function clampNumber(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

/** Viewport-space placement for portaled `position: fixed` UI (must not use coords from inside backdrop-filter / transformed ancestors). */
function computeAdjacentSettingsPlacement(rect: DOMRect): {
	top: number;
	left: number;
	width: number;
	maxHeight: number;
} {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const m = SETTINGS_VIEWPORT_MARGIN;
	const g = SETTINGS_GAP;

	const maxFitW = vw - 2 * m;
	const width = clampNumber(
		Math.min(SETTINGS_MAX_WIDTH, maxFitW),
		Math.min(SETTINGS_MIN_WIDTH, maxFitW),
		Math.min(SETTINGS_MAX_WIDTH, maxFitW),
	);

	const spaceRight = vw - rect.right - g - m;
	const spaceLeft = rect.left - g - m;

	const leftIfRight = rect.right + g;
	const leftIfLeft = rect.left - g - width;

	const fits = (left: number) =>
		left >= m - 0.5 && left + width <= vw - m + 0.5;

	const okRight = fits(leftIfRight);
	const okLeft = fits(leftIfLeft);

	let left: number;
	if (okRight && okLeft) {
		left = spaceRight >= spaceLeft ? leftIfRight : leftIfLeft;
	} else if (okRight) {
		left = leftIfRight;
	} else if (okLeft) {
		left = leftIfLeft;
	} else {
		left = clampNumber(
			spaceRight >= spaceLeft ? leftIfRight : leftIfLeft,
			m,
			vw - m - width,
		);
	}

	left = clampNumber(left, m, vw - m - width);

	const top = clampNumber(rect.top, m, Math.max(m, vh - m - 80));
	// Tall enough for the form without a fractional overflow scrollbar; still capped by viewport.
	const maxHeight = Math.min(
		vh - 2 * m,
		Math.max(rect.height + 96, 680),
	);

	return { top, left, width, maxHeight };
}

interface ChatWindowProps {
	className?: string;
	/** When set, agent settings open as a floating panel beside this element (e.g. the floating chat card). */
	panelBoundsRef?: RefObject<HTMLElement | null>;
	onHeaderPointerDown?: PointerEventHandler<HTMLDivElement>;
}

export function ChatWindow({
	className = "",
	panelBoundsRef,
	onHeaderPointerDown,
}: ChatWindowProps) {
	const labelId = useId();
	const inputId = useId();
	const settingsTitleId = useId();
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [draft, setDraft] = useState("");
	const [agentConfig, setAgentConfig] = useState<AgentConfigPublic | null>(
		null,
	);
	const [configLoading, setConfigLoading] = useState(true);
	const [configError, setConfigError] = useState<string | null>(null);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [settingsDraft, setSettingsDraft] = useState({
		provider: DEFAULT_AGENT_CONFIG.provider,
		model: DEFAULT_AGENT_CONFIG.model,
		baseUrl: "",
		apiKeyInput: "",
	});
	const [showApiKey, setShowApiKey] = useState(false);
	const [settingsError, setSettingsError] = useState<string | null>(null);
	const [conversationId, setConversationId] = useState<string | null>(() =>
		readStoredConversationId(),
	);
	const [sending, setSending] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const {
		attachments,
		clearOneShotAttachments,
	} = useChatAttachments();
	const { getAnalysisForClash, setAnalysisForClash } = useClashAnalysis();
	const { composerFocusEpoch } = useFloatingChat();
	const [settingsPlacement, setSettingsPlacement] = useState<{
		top: number;
		left: number;
		width: number;
		maxHeight: number;
	} | null>(null);
	const settingsPlacementRaf = useRef<number>(0);

	const hasStickyModifyChip = useMemo(
		() =>
			attachments.some(
				(a) => a.kind === "recommendation" && a.mode === "modify",
			),
		[attachments],
	);

	useEffect(() => {
		if (composerFocusEpoch === 0) return;
		requestAnimationFrame(() => {
			textareaRef.current?.focus();
		});
	}, [composerFocusEpoch]);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	useEffect(() => {
		const id = readStoredConversationId();
		if (!id) return;
		const ac = new AbortController();
		void fetchChatHistory(id, { signal: ac.signal })
			.then((rows) => {
				const batch = crypto.randomUUID();
				const at = Date.now();
				setMessages(
					rows.map((m, i) => {
						const attachmentSummaries: ChatAttachmentSummary[] | undefined =
							m.role === "user" &&
							m.attachments &&
							m.attachments.length > 0
								? m.attachments
								: undefined;
						const base = {
							id: `hist-${batch}-${i}`,
							role: m.role === "user" ? "user" : "assistant",
							text: m.text,
							at: at + i,
							...(attachmentSummaries
								? { attachments: attachmentSummaries }
								: {}),
						} satisfies Pick<
							ChatMessage,
							"id" | "role" | "text" | "at" | "attachments"
						>;
						if (m.role !== "user" && m.activity?.length) {
							return {
								...base,
								activity: m.activity,
								...(m.thinking_buffer
									? { thinkingBuffer: m.thinking_buffer }
									: {}),
							} satisfies ChatMessage;
						}
						if (m.role !== "user" && m.thinking_buffer) {
							return {
								...base,
								thinkingBuffer: m.thinking_buffer,
							} satisfies ChatMessage;
						}
						return base satisfies ChatMessage;
					}),
				);
			})
			.catch((e: unknown) => {
				if (e instanceof DOMException && e.name === "AbortError") return;
				if (e instanceof Error && e.name === "AbortError") return;
				console.error("[ChatWindow] Failed to load chat history", e);
			});
		return () => ac.abort();
	}, []);

	useEffect(() => {
		let cancelled = false;
		setConfigLoading(true);
		void fetchAgentConfig()
			.then((c) => {
				if (!cancelled) {
					setAgentConfig(c);
					setConfigError(null);
				}
			})
			.catch((e: unknown) => {
				if (!cancelled) {
					setConfigError(
						e instanceof Error ? e.message : "Failed to load agent config",
					);
				}
			})
			.finally(() => {
				if (!cancelled) setConfigLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!settingsOpen) return;
		const src = agentConfig ?? DEFAULT_AGENT_CONFIG;
		setSettingsDraft({
			provider: src.provider,
			model: src.model,
			baseUrl: src.base_url ?? "",
			apiKeyInput: "",
		});
		setShowApiKey(false);
		setSettingsError(null);
	}, [settingsOpen, agentConfig]);

	useEffect(() => {
		if (!settingsOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setSettingsOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [settingsOpen]);

	const updateSettingsPlacement = useCallback(() => {
		const el = panelBoundsRef?.current;
		if (el) {
			setSettingsPlacement(
				computeAdjacentSettingsPlacement(el.getBoundingClientRect()),
			);
		} else {
			setSettingsPlacement(null);
		}
	}, [panelBoundsRef]);

	useLayoutEffect(() => {
		if (!settingsOpen) {
			setSettingsPlacement(null);
			return;
		}
		updateSettingsPlacement();
	}, [settingsOpen, updateSettingsPlacement]);

	useEffect(() => {
		if (!settingsOpen) return;
		const onResize = () => {
			updateSettingsPlacement();
		};
		const onPointerMove = () => {
			cancelAnimationFrame(settingsPlacementRaf.current);
			settingsPlacementRaf.current = requestAnimationFrame(() => {
				updateSettingsPlacement();
			});
		};
		window.addEventListener("resize", onResize);
		window.addEventListener("pointermove", onPointerMove);
		return () => {
			window.removeEventListener("resize", onResize);
			window.removeEventListener("pointermove", onPointerMove);
			cancelAnimationFrame(settingsPlacementRaf.current);
		};
	}, [settingsOpen, updateSettingsPlacement]);

	const send = useCallback(async () => {
		const text = draft.trim();
		if (!text || sending) return;

		const snapshot = attachments;
		const attachmentSummaries: ChatAttachmentSummary[] | undefined =
			snapshot.length > 0
				? snapshot.map((a) => ({ kind: a.kind, label: a.label }))
				: undefined;
		const userMsg: ChatMessage = {
			id: crypto.randomUUID(),
			role: "user",
			text,
			at: Date.now(),
			...(attachmentSummaries ? { attachments: attachmentSummaries } : {}),
		};
		const assistantId = crypto.randomUUID();
		const assistantMsg: ChatMessage = {
			id: assistantId,
			role: "assistant",
			text: "",
			at: Date.now(),
			streaming: true,
		};

		setMessages((prev) => [...prev, userMsg, assistantMsg]);
		setDraft("");
		const wireAttachments = toChatAttachmentsWire(snapshot, {
			resolveRecommendation: (clashId, idx) => {
				const item = getAnalysisForClash(clashId).recommendations[idx];
				return item?.parsed ?? null;
			},
		});
		clearOneShotAttachments();
		setSending(true);

		const ac = new AbortController();
		abortRef.current = ac;

		try {
			await postChatStream(
				text,
				conversationId,
				{
					onMetadata: (id) => {
						persistConversationId(id);
						setConversationId(id);
					},
					onToken: (delta) => {
						setMessages((prev) =>
							prev.map((m) =>
								m.id === assistantId ? { ...m, text: m.text + delta } : m,
							),
						);
					},
					onThoughtDelta: (delta) => {
						setMessages((prev) =>
							prev.map((m) =>
								m.id === assistantId
									? {
											...m,
											thinkingBuffer: (m.thinkingBuffer ?? "") + delta,
										}
									: m,
							),
						);
					},
					onAgentThought: (thoughtText) => {
						setMessages((prev) =>
							prev.map((m) =>
								m.id === assistantId
									? {
											...m,
											activity: [
												...(m.activity ?? []),
												{ type: "thought" as const, text: thoughtText },
											],
										}
									: m,
							),
						);
					},
					onToolCall: (p) => {
						if (isUpdateClashRecommendationToolName(p.tool_name)) {
							applyAgentRecommendationUpdate(
								p.tool_kwargs,
								getAnalysisForClash,
								setAnalysisForClash,
							);
						}
						setMessages((prev) =>
							prev.map((m) => {
								if (m.id !== assistantId) return m;
								const act = m.activity ?? [];
								const last = act[act.length - 1];
								if (
									last?.type === "tool_call" &&
									last.toolId === p.tool_id &&
									last.toolName === p.tool_name
								) {
									return m;
								}
								return {
									...m,
									activity: [
										...act,
										{
											type: "tool_call" as const,
											toolName: p.tool_name,
											toolId: p.tool_id,
											args: p.tool_kwargs,
										},
									],
								};
							}),
						);
					},
					onToolResult: (p) => {
						setMessages((prev) =>
							prev.map((m) => {
								if (m.id !== assistantId) return m;
								const act = m.activity ?? [];
								const last = act[act.length - 1];
								if (
									last?.type === "tool_result" &&
									last.toolId === p.tool_id &&
									last.content === p.content
								) {
									return m;
								}
								return {
									...m,
									activity: [
										...act,
										{
											type: "tool_result" as const,
											toolName: p.tool_name,
											toolId: p.tool_id,
											content: p.content,
											isError: p.is_error,
										},
									],
								};
							}),
						);
					},
					onDone: () => {},
					onError: (detail) => {
						setMessages((prev) =>
							prev.map((m) =>
								m.id === assistantId
									? {
											...m,
											text: m.text
												? `${m.text}\n\n[Error] ${detail}`
												: `[Error] ${detail}`,
										}
									: m,
							),
						);
					},
				},
				{ signal: ac.signal, attachments: wireAttachments },
			);
		} finally {
			abortRef.current = null;
			setSending(false);
			setMessages((prev) =>
				prev.map((m) =>
					m.id === assistantId ? { ...m, streaming: false } : m,
				),
			);
		}
	}, [
		attachments,
		clearOneShotAttachments,
		conversationId,
		draft,
		sending,
		getAnalysisForClash,
		setAnalysisForClash,
	]);

	const handleDraftProviderChange = (provider: AgentProvider) => {
		setSettingsDraft((d) => ({
			...d,
			provider,
			model:
				provider === "custom"
					? d.model
					: provider === "ollama"
						? "llama3.2"
						: MODEL_OPTIONS[provider][0],
			baseUrl:
				provider === "custom" || provider === "ollama" ? d.baseUrl : "",
			apiKeyInput: "",
		}));
	};

	const handleSaveAgentSettings = () => {
		if (settingsDraft.provider === "custom") {
			if (!settingsDraft.baseUrl.trim()) {
				setSettingsError("Base URL is required for a custom provider.");
				return;
			}
			if (!settingsDraft.model.trim()) {
				setSettingsError("Model name is required for a custom provider.");
				return;
			}
		}
		if (settingsDraft.provider === "ollama") {
			if (!settingsDraft.model.trim()) {
				setSettingsError("Model name is required for Ollama.");
				return;
			}
		}
		setSettingsError(null);
		void (async () => {
			try {
				const result = await saveAgentConfigToServer({
					provider: settingsDraft.provider,
					model: settingsDraft.model.trim(),
					base_url:
						settingsDraft.provider === "custom" ||
						settingsDraft.provider === "ollama"
							? settingsDraft.baseUrl.trim()
							: undefined,
					api_key: settingsDraft.apiKeyInput.trim() || undefined,
				});
				setAgentConfig(result);
				setSettingsOpen(false);
			} catch (e: unknown) {
				setSettingsError(
					e instanceof Error ? e.message : "Failed to save agent config",
				);
			}
		})();
	};

	return (
		<aside
			className={`flex h-full min-h-0 w-full flex-col bg-white ${className}`}
			aria-labelledby={labelId}
		>
			<div
				className={`drag-handle flex shrink-0 items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 ${
					onHeaderPointerDown
						? "cursor-grab active:cursor-grabbing"
						: ""
				}`}
				onPointerDown={onHeaderPointerDown}
			>
				<h2 id={labelId} className="text-sm font-semibold text-neutral-900">
					Coordination assistant
				</h2>
				<button
					type="button"
					disabled={configLoading}
					onPointerDown={(e) => e.stopPropagation()}
					onClick={() => setSettingsOpen(true)}
					className="cursor-pointer rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
					aria-label="Configure agent"
				>
					<SettingsIcon />
				</button>
			</div>
			{configError ? (
				<div className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-800">
					{configError}
				</div>
			) : null}

			{settingsOpen && typeof document !== "undefined"
				? createPortal(
						<>
							<button
								type="button"
								className="fixed inset-0 z-[100] cursor-default border-0 bg-black/40 p-0"
								aria-label="Close dialog"
								onClick={() => setSettingsOpen(false)}
							/>
							<div
								className={
									settingsPlacement
										? "pointer-events-none fixed inset-0 z-[101] p-0"
										: "pointer-events-none fixed inset-0 z-[101] flex items-center justify-center p-4"
								}
							>
								<div
									role="dialog"
									aria-modal="true"
									aria-labelledby={settingsTitleId}
									className={
										settingsPlacement
											? "pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg"
											: "pointer-events-auto flex max-h-[min(90vh,680px)] w-full max-w-md min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg"
									}
									style={
										settingsPlacement
											? {
													position: "fixed",
													top: settingsPlacement.top,
													left: settingsPlacement.left,
													width: settingsPlacement.width,
													maxHeight: settingsPlacement.maxHeight,
												}
											: undefined
									}
								>
									<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 pl-4 pr-3 [scrollbar-gutter:stable]">
							<h3
								id={settingsTitleId}
								className="text-sm font-semibold text-neutral-900"
							>
								Agent configuration
							</h3>
							<p className="mt-1 text-xs text-neutral-500">
								Settings are saved on the API server (including your API key).
								The browser never stores the secret.
							</p>

							<div className="mt-4 flex flex-col gap-3">
								<div>
									<label
										htmlFor="agent-provider"
										className="mb-1 block text-xs font-medium text-neutral-700"
									>
										Provider
									</label>
									<select
										id="agent-provider"
										value={settingsDraft.provider}
										onChange={(e) =>
											handleDraftProviderChange(e.target.value as AgentProvider)
										}
										className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
									>
										<option value="anthropic">Anthropic</option>
										<option value="openai">OpenAI</option>
										<option value="google">Google</option>
										<option value="ollama">Ollama</option>
										<option value="custom">Custom (OpenAI-compatible)</option>
									</select>
								</div>

								<div>
									<label
										htmlFor="agent-base-url"
										className="mb-1 block text-xs font-medium text-neutral-700"
									>
										Base URL
									</label>
									{(settingsDraft.provider === "custom" ||
										settingsDraft.provider === "ollama") && (
										<p className="mb-1 text-xs text-neutral-500">
											{settingsDraft.provider === "ollama"
												? "Optional. Leave empty for native Ollama (server env). Set to an OpenAI-compatible URL (e.g. …/v1) to use the HTTP API."
												: "Required for custom OpenAI-compatible endpoints."}
										</p>
									)}
									<input
										id="agent-base-url"
										type="url"
										value={settingsDraft.baseUrl}
										disabled={
											settingsDraft.provider !== "custom" &&
											settingsDraft.provider !== "ollama"
										}
										onChange={(e) =>
											setSettingsDraft((d) => ({
												...d,
												baseUrl: e.target.value,
											}))
										}
										placeholder={
											settingsDraft.provider === "ollama"
												? "e.g. http://localhost:11434/v1 (optional)"
												: "https://api.example.com/v1"
										}
										className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
									/>
								</div>

								<div>
									<label
										htmlFor="agent-model"
										className="mb-1 block text-xs font-medium text-neutral-700"
									>
										Model
									</label>
									{settingsDraft.provider === "custom" ||
									settingsDraft.provider === "ollama" ? (
										<input
											id="agent-model"
											type="text"
											value={settingsDraft.model}
											onChange={(e) =>
												setSettingsDraft((d) => ({
													...d,
													model: e.target.value,
												}))
											}
											placeholder={
												settingsDraft.provider === "ollama"
													? "e.g. llama3.2"
													: "e.g. my-model-id"
											}
											className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
										/>
									) : (
										<select
											id="agent-model"
											value={settingsDraft.model}
											onChange={(e) =>
												setSettingsDraft((d) => ({
													...d,
													model: e.target.value,
												}))
											}
											className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
										>
											{MODEL_OPTIONS[settingsDraft.provider].map((m) => (
												<option key={m} value={m}>
													{m}
												</option>
											))}
										</select>
									)}
								</div>

								<div>
									<div className="mb-1 flex items-center justify-between gap-2">
										<label
											htmlFor="agent-api-key"
											className="text-xs font-medium text-neutral-700"
										>
											API key
										</label>
										<button
											type="button"
											onClick={() => setShowApiKey((v) => !v)}
											className="cursor-pointer rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
											aria-pressed={showApiKey}
											aria-label={showApiKey ? "Hide API key" : "Show API key"}
										>
											<EyeIcon open={showApiKey} />
										</button>
									</div>
									<p className="mb-1.5 text-xs text-neutral-400">
										{(agentConfig?.api_key_set ?? false)
											? "Leave blank to keep the saved key."
											: "Required unless the server already has a key in the environment."}
									</p>
									<input
										id="agent-api-key"
										type={showApiKey ? "text" : "password"}
										value={settingsDraft.apiKeyInput}
										onChange={(e) =>
											setSettingsDraft((d) => ({
												...d,
												apiKeyInput: e.target.value,
											}))
										}
										placeholder={
											(agentConfig?.api_key_set ?? false) && !showApiKey
												? "••••••••••••"
												: "sk-…"
										}
										autoComplete="off"
										className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
									/>
								</div>

								{settingsError ? (
									<p className="text-xs text-red-600" role="alert">
										{settingsError}
									</p>
								) : null}

								<div className="flex justify-end gap-2 pt-1">
									<button
										type="button"
										onClick={() => setSettingsOpen(false)}
										className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={handleSaveAgentSettings}
										className="cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
									>
										Save
									</button>
								</div>
								</div>
									</div>
							</div>
						</div>
						</>,
						document.body,
					)
				: null}

			<div className="flex min-h-0 flex-1 flex-col px-3 py-2">
				{messages.length === 0 ? (
					<div className="flex flex-1 items-center justify-center px-2 text-center text-sm text-neutral-400">
						Ask about clashes, trades, or next steps. Messages stream from the
						Balrog API.
					</div>
				) : (
					<ul
						className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-2"
						aria-busy={sending}
					>
						{messages.map((m) => {
							const { preamble, answer } =
								m.role === "assistant"
									? splitAnswerStream(m.text)
									: { preamble: "", answer: m.text };
							const assistantVisible =
								m.role === "assistant" ? assistantBubbleText(m.text) : m.text;
							const preAnswerStreaming =
								m.role === "assistant" &&
								Boolean(m.streaming) &&
								!answer.trim();
							return (
								<li
									key={m.id}
									className={`rounded-lg px-3 py-2 text-sm ${
										m.role === "user"
											? "ml-6 bg-primary/10 text-neutral-900"
											: "mr-6 bg-neutral-100 text-neutral-800"
									}`}
								>
									{m.role === "assistant" && (
										<AgentActivityLog
											activity={m.activity}
											thinkingBuffer={m.thinkingBuffer}
											streamPreamble={preamble}
											streaming={m.streaming}
											preAnswerStreaming={preAnswerStreaming}
										/>
									)}
									{m.role === "user" &&
									((m.attachments?.length ?? 0) > 0 || m.text.trim()) ? (
										<div className="flex min-w-0 flex-col gap-2">
											{(m.attachments?.length ?? 0) > 0 ? (
												<ChatMessageAttachmentChips
													attachments={m.attachments!}
												/>
											) : null}
											{m.text.trim() ? (
												<ChatMarkdown
													content={m.text}
													variant="user"
												/>
											) : null}
										</div>
									) : null}
									{m.role === "assistant" &&
									m.streaming &&
									!assistantVisible ? null : assistantVisible ? (
										<ChatMarkdown
											content={assistantVisible}
											variant="assistant"
										/>
									) : null}
								</li>
							);
						})}
					</ul>
				)}
			</div>

			<div className="shrink-0 p-3">
				<div className="flex flex-col gap-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
					<ChatAttachmentChips />
					<div className="flex flex-col gap-2 px-2 py-2">
						<label htmlFor={inputId} className="sr-only">
							Message
						</label>
						<textarea
							id={inputId}
							ref={textareaRef}
							rows={1}
							value={draft}
							disabled={sending}
							onChange={(e) => setDraft(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									void send();
								}
							}}
							placeholder={
								hasStickyModifyChip
									? "Ask about or describe changes for the attached recommendation…"
									: "Write a message here..."
							}
							className="max-h-32 min-h-10 w-full resize-none bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none disabled:opacity-60"
						/>
						<div className="flex shrink-0 items-center justify-between gap-2">
							<div className="flex items-center gap-1">
								<ChatAddContextMenu disabled={sending} />
								<button
									type="button"
									disabled={sending}
									className="cursor-pointer rounded p-1 text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
									aria-label="Upload attachment"
								>
									<UploadIcon />
								</button>
							</div>
							<button
								type="button"
								disabled={sending || !draft.trim()}
								onClick={() => void send()}
								className="cursor-pointer rounded-lg p-2 text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
								aria-label="Send message"
							>
								<SendIcon />
							</button>
						</div>
					</div>
				</div>
			</div>
		</aside>
	);
}
