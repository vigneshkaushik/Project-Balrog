import { splitAnswerStream } from "./answerStreamSplit";
import { assistantBubbleText } from "./assistantDisplayText";
import type { ChatMessage } from "../types";

export interface AssistantDisplaySlices {
	/** Scratch / metadata shown in AgentActivityLog (before the final Answer marker while streaming). */
	streamPreamble: string;
	bubbleMarkdown: string;
	preAnswerStreaming: boolean;
}

/**
 * Split assistant `text` into log preamble vs main bubble Markdown.
 *
 * While streaming, preamble is whatever appears before the last Answer marker (`splitAnswerStream`).
 * Reloaded threads from `GET /chat/messages` store only the peeled answer in `text` plus `activity`,
 * without answer markers — then preamble must stay empty so the bubble shows `text`.
 */
export function assistantDisplaySlices(
	m: Pick<ChatMessage, "role" | "text" | "streaming" | "activity">,
): AssistantDisplaySlices {
	if (m.role !== "assistant") {
		return { streamPreamble: "", bubbleMarkdown: "", preAnswerStreaming: false };
	}

	const split = splitAnswerStream(m.text);
	const hasAnswerSlice = Boolean(split.answer.trim());
	const streamed = Boolean(m.streaming);
	const hasActivity =
		Array.isArray(m.activity) && m.activity.length > 0;

	const preAnswerStreaming = streamed && !hasAnswerSlice;

	if (!streamed && hasActivity && !hasAnswerSlice) {
		const bub = assistantBubbleText(m.text);
		return {
			streamPreamble: "",
			bubbleMarkdown: (bub.trim() ? bub : m.text).trim(),
			preAnswerStreaming: false,
		};
	}

	if (
		!streamed &&
		!hasAnswerSlice &&
		!hasActivity &&
		m.text.trim()
	) {
		return {
			streamPreamble: "",
			bubbleMarkdown: m.text.trim(),
			preAnswerStreaming: false,
		};
	}

	const bubbleMarkdown = assistantBubbleText(m.text);

	return {
		streamPreamble: split.preamble,
		bubbleMarkdown,
		preAnswerStreaming,
	};
}
